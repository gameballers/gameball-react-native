import type { MessageAnalytics } from '../analytics/analytics';
import {
  createMessageEvent,
  type MessageEventType,
} from '../analytics/message-event';
import type { CapState, FrequencyCap } from '../evaluation/frequency-cap';
import {
  isRepeatEligible,
  isWithinFloor,
  selectCampaign,
} from '../evaluation/select-campaign';
import { iamLog } from '../log';
import type { Campaign } from '../models/campaign';
import type {
  ClickAction,
  InAppMessage,
  MessageButton,
} from '../models/message';
import { quietHoursContains, type QuietHours } from '../models/quiet-hours';
import {
  SESSION_START,
  eventOccurrence,
  purchaseOccurrence,
  type TriggerOccurrence,
} from '../models/trigger';
import {
  clearUnresolvedTokens,
  messageHasTokens,
  substituteInto,
  tokensIn,
} from '../personalisation/tokens';
import type { VariableSource } from '../personalisation/variable-source';
import type {
  ArtworkPrefetcher,
  MessagePresenter,
} from '../presentation/presenter';
import type { CampaignCache } from '../source/campaign-cache';
import type { MessageSource } from '../source/message-source';
import {
  DEFAULT_DISPLAY_COOLDOWN_MS,
  type SyncResult,
} from '../source/sync-result';

export type DisplayDecision = 'show' | 'later' | 'discard';
export type BeforeDisplay = (message: InAppMessage) => DisplayDecision;
/** Return true to say the host handled the action; the click log and the dismissal still happen. */
export type OnAction = (
  message: InAppMessage,
  button: MessageButton | null,
  action: ClickAction
) => boolean;
export type Scheduler = (fn: () => void, ms: number) => unknown;
export type Canceller = (handle: unknown) => void;

/** Matched to the default cooldown so a warm session start is never blocked by the floor. */
export const DEFAULT_SESSION_TIMEOUT_MS = DEFAULT_DISPLAY_COOLDOWN_MS;
export const DEFAULT_ARTWORK_PREFETCH_TIMEOUT_MS = 5_000;
export const DEFAULT_VARIABLE_TIMEOUT_MS = 2_000;
export const DEFAULT_ARTWORK_RETRY_INTERVAL_MS = 30_000;
const PRE_ACTION_FLUSH_TIMEOUT_MS = 800;
const SLOW_PREFETCH_MS = 1_000;
const SURFACE_RETRY_MS = 250;

export interface ServiceOptions {
  source: MessageSource;
  presenter: MessagePresenter;
  frequencyCap: FrequencyCap;
  campaignCache: CampaignCache;
  analytics: MessageAnalytics;
  prefetcher: ArtworkPrefetcher;
  variables: VariableSource;
  isHostOverlayOpen?: () => boolean;
  /** Whether a surface exists at all (a document with a body). False = the refusal can heal on its own. */
  hasSurface?: () => boolean;
  navigate?: (route: string, args?: Record<string, unknown>) => void;
  openUrl?: (url: string, external: boolean) => Promise<boolean>;
  requestPushPermission?: () => Promise<boolean>;
  emit?: (message: InAppMessage) => void;
  clock?: () => number;
  schedule?: Scheduler;
  cancel?: Canceller;
  sessionTimeoutMs?: number;
  prefetchTimeoutMs?: number;
  variableTimeoutMs?: number;
  artworkRetryIntervalMs?: number;
}

/** Wires fetching, evaluation, deferral, display and analytics together. Owns the pending slot; owns no display policy (selectCampaign) and no drawing (presenter). */
export class InAppMessagingService {
  private readonly source: MessageSource;
  private readonly presenter: MessagePresenter;
  private readonly cap: FrequencyCap;
  private readonly cache: CampaignCache;
  private readonly analytics: MessageAnalytics;
  private readonly prefetcher: ArtworkPrefetcher;
  private readonly variables: VariableSource;
  private readonly isHostOverlayOpen: () => boolean;
  private readonly hasSurface: () => boolean;
  private readonly navigate: (
    route: string,
    args?: Record<string, unknown>
  ) => void;
  private readonly openUrl: (
    url: string,
    external: boolean
  ) => Promise<boolean>;
  private readonly requestPushPermission: () => Promise<boolean>;
  private readonly emit: ((message: InAppMessage) => void) | undefined;
  private readonly clock: () => number;
  private readonly schedule: Scheduler;
  private readonly cancel: Canceller;
  readonly sessionTimeoutMs: number;
  private readonly prefetchTimeoutMs: number;
  private readonly variableTimeoutMs: number;
  private readonly artworkRetryIntervalMs: number;

  private customerId: string | null = null;
  private generation = 0;
  private beforeDisplay: BeforeDisplay | undefined;
  private onAction: OnAction | undefined;
  private campaigns: Campaign[] = [];
  private artworkReady = new Set<number>();
  private artworkCheckedAt: number | null = null;
  private artworkRefreshInFlight = false;
  private cooldownMs = DEFAULT_DISPLAY_COOLDOWN_MS;
  private quietHours: QuietHours | null = null;
  private pending: Campaign | null = null;
  private floorRetry: unknown = null;
  private lastPausedAt: number | null = null;
  private surfaceRetryScheduled = false;
  private surfaceRetry: unknown = null;
  private presentationInFlight = false;

  constructor(options: ServiceOptions) {
    this.source = options.source;
    this.presenter = options.presenter;
    this.cap = options.frequencyCap;
    this.cache = options.campaignCache;
    this.analytics = options.analytics;
    this.prefetcher = options.prefetcher;
    this.variables = options.variables;
    this.isHostOverlayOpen = options.isHostOverlayOpen ?? (() => false);
    this.hasSurface = options.hasSurface ?? (() => true);
    this.navigate =
      options.navigate ??
      ((route) =>
        iamLog(
          `navigate to "${route}" ignored: no onNavigate hook was provided`
        ));
    this.openUrl = options.openUrl ?? (async () => false);
    this.requestPushPermission =
      options.requestPushPermission ?? (async () => false);
    this.emit = options.emit;
    this.clock = options.clock ?? (() => Date.now());
    this.schedule = options.schedule ?? ((fn, ms) => setTimeout(fn, ms));
    this.cancel =
      options.cancel ??
      ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
    this.sessionTimeoutMs =
      options.sessionTimeoutMs ?? DEFAULT_SESSION_TIMEOUT_MS;
    this.prefetchTimeoutMs =
      options.prefetchTimeoutMs ?? DEFAULT_ARTWORK_PREFETCH_TIMEOUT_MS;
    this.variableTimeoutMs =
      options.variableTimeoutMs ?? DEFAULT_VARIABLE_TIMEOUT_MS;
    this.artworkRetryIntervalMs =
      options.artworkRetryIntervalMs ?? DEFAULT_ARTWORK_RETRY_INTERVAL_MS;
  }

  get isStarted(): boolean {
    return this.customerId !== null;
  }
  get pendingCampaign(): Campaign | null {
    return this.pending;
  }

  /** Opts in for a customer and evaluates session start. Resolves after that evaluation. */
  async start(input: {
    customerId: string;
    beforeDisplay?: BeforeDisplay;
    onAction?: OnAction;
  }): Promise<void> {
    if (this.customerId === input.customerId) {
      iamLog(
        `start ignored: already running for customer "${input.customerId}"`
      );
      return;
    }
    this.beforeDisplay = input.beforeDisplay;
    this.onAction = input.onAction;
    this.resetFor(input.customerId);
    await this.syncAndEvaluateSessionStart(true);
  }

  stop(): void {
    if (!this.isStarted) return;
    this.generation++;
    this.clearPending();
    this.customerId = null; // before dismiss(): its callback must not revive the pending slot
    this.presenter.dismiss();
    this.campaigns = [];
    this.artworkReady = new Set();
    this.presentationInFlight = false;
    this.artworkRefreshInFlight = false;
    this.lastPausedAt = null;
    this.variables.clear();
    this.beforeDisplay = undefined;
    this.onAction = undefined;
    void this.analytics.flush();
    this.analytics.dispose();
    iamLog('in-app messaging stopped');
  }

  onCustomerChanged(customerId: string): void {
    if (!this.isStarted || this.customerId === customerId) return;
    iamLog(`customer changed to "${customerId}"; refetching campaigns`);
    this.resetFor(customerId);
    void this.syncAndEvaluateSessionStart(true);
  }

  onCustomEvent(
    eventName: string,
    properties: Record<string, unknown> = {}
  ): void {
    if (!this.isStarted) return;
    this.variables.clear(); // the customer just acted; a balance quoted next must be fresh
    this.evaluate(eventOccurrence(eventName, properties));
  }

  onPurchase(input: {
    productId: string;
    price: number;
    currency: string;
    quantity?: number;
    properties?: Record<string, unknown>;
  }): void {
    if (!this.isStarted) return;
    this.variables.clear();
    this.evaluate(purchaseOccurrence(input));
  }

  /** A resume after more than sessionTimeoutMs away begins a new session (re-sync + session_start). */
  onAppResumed(): void {
    if (!this.isStarted) return;
    const since = this.lastPausedAt;
    if (since === null) return;
    this.lastPausedAt = null;
    const away = this.clock() - since;
    if (away < this.sessionTimeoutMs) {
      iamLog(
        `resumed after ${Math.round(away / 1000)}s — same session, no trigger`
      );
      return;
    }
    iamLog(`resumed after ${Math.round(away / 1000)}s — new session`);
    void this.syncAndEvaluateSessionStart(false);
  }

  /** First pause wins; later ones are ignored until a resume clears it. Flushes, because the page may never come back. */
  onAppPaused(): void {
    if (!this.isStarted) return;
    if (this.lastPausedAt === null) this.lastPausedAt = this.clock();
    void this.analytics.flushAll();
  }

  onHostOverlayClosed(): void {
    this.retryPending();
  }

  /** Any change that may make a parked message presentable (orientation, host overlay, DOM ready). */
  onDisplayOpportunity(): void {
    this.retryPending();
  }

  // ---------------------------------------------------------------- internals

  private resetFor(customerId: string): void {
    this.generation++;
    this.clearPending();
    this.presenter.dismiss();
    this.campaigns = [];
    this.artworkReady = new Set();
    this.artworkCheckedAt = null;
    this.quietHours = null;
    this.presentationInFlight = false;
    this.artworkRefreshInFlight = false;
    this.lastPausedAt = null; // a pause belongs to the session it interrupted, not to the next customer's
    this.variables.clear();
    this.customerId = customerId;
  }

  private clearPending(): void {
    this.pending = null;
    if (this.floorRetry !== null) {
      this.cancel(this.floorRetry);
      this.floorRetry = null;
    }
    if (this.surfaceRetry !== null) {
      this.cancel(this.surfaceRetry);
      this.surfaceRetry = null;
    }
    this.surfaceRetryScheduled = false;
  }

  private async syncAndEvaluateSessionStart(
    loadPersisted: boolean
  ): Promise<void> {
    const customerId = this.customerId;
    if (customerId === null) return;
    const generation = this.generation;

    let cached: SyncResult | null = null;
    if (loadPersisted) {
      try {
        this.cap.load(customerId);
      } catch (error) {
        iamLog(`could not read display history (${String(error)})`);
      }
      try {
        const read = this.cache.read(customerId);
        cached = read.campaigns.length ? read : null;
      } catch (error) {
        iamLog(`could not read cached campaigns (${String(error)})`);
      }
      this.analytics.load();
    }

    let synced = false;
    try {
      const result = await this.source.fetch(customerId);
      if (this.generation !== generation) return;
      this.campaigns = result.campaigns;
      this.cooldownMs = result.cooldownMs;
      this.quietHours = result.quietHours;
      synced = true;
      iamLog(
        `synced ${this.campaigns.length} campaign(s), cooldown ${Math.round(
          this.cooldownMs / 1000
        )}s`
      );
      if (result.rawJson !== null) this.cache.write(customerId, result.rawJson);
    } catch (error) {
      if (this.generation !== generation) return;
      iamLog(`sync failed (${String(error)})`);
    }

    if (!synced && cached) {
      this.campaigns = cached.campaigns;
      this.cooldownMs = cached.cooldownMs;
      this.quietHours = cached.quietHours;
      iamLog(`falling back to ${this.campaigns.length} cached campaign(s)`);
    }

    await this.prefetchArtwork();
    if (this.generation !== generation) return;
    this.declarePersonalisationNeeds();
    this.evaluate(SESSION_START);
    // One line that always follows a start or a new session, so a host (or a test) can tell
    // "nothing matched" from "still prefetching artwork".
    iamLog('session start evaluated');
  }

  private declarePersonalisationNeeds(): void {
    const needed = new Set<string>();
    for (const c of this.campaigns)
      for (const t of tokensIn(c.message)) needed.add(t);
    this.variables.retainOnly(needed);
  }

  /** Warms every campaign's artwork concurrently; the impression must never count something the user could not see. */
  private async prefetchArtwork(): Promise<void> {
    const campaigns = this.campaigns;
    this.artworkCheckedAt = this.clock();
    if (campaigns.length === 0) {
      this.artworkReady = new Set();
      return;
    }
    const startedAt = this.clock();
    const generation = this.generation;
    const ready = await Promise.all(
      campaigns.map((c) => this.isArtworkReady(c))
    );
    // A stop/switch while the images loaded means these results belong to a session that is gone.
    if (this.generation !== generation) return;
    this.artworkReady = new Set(
      campaigns.filter((_, i) => ready[i]).map((c) => c.campaignId)
    );
    const took = this.clock() - startedAt;
    if (took > SLOW_PREFETCH_MS)
      iamLog(
        `artwork for ${campaigns.length} campaign(s) took ${took}ms, delaying the first message by that much`
      );
  }

  private async isArtworkReady(campaign: Campaign): Promise<boolean> {
    try {
      return await this.withTimeout(
        this.prefetcher.prefetch(campaign.message),
        this.prefetchTimeoutMs,
        () => {
          iamLog(
            `campaign "${campaign.campaignId}" artwork did not load within ${this.prefetchTimeoutMs}ms`
          );
          return false;
        }
      );
    } catch (error) {
      iamLog(
        `campaign "${campaign.campaignId}" artwork failed (${String(error)})`
      );
      return false;
    }
  }

  private maybeRefreshArtwork(notReady: Campaign[]): void {
    if (this.artworkRefreshInFlight) return;
    if (
      this.artworkCheckedAt !== null &&
      this.clock() - this.artworkCheckedAt < this.artworkRetryIntervalMs
    )
      return;
    this.artworkRefreshInFlight = true;
    this.artworkCheckedAt = this.clock();
    const generation = this.generation;
    void (async () => {
      try {
        const ready = await Promise.all(
          notReady.map((c) => this.isArtworkReady(c))
        );
        // The customer (or the campaign set) may have changed while the images loaded; marking
        // artwork ready for campaigns nobody is evaluating any more would be a stale write.
        if (this.generation !== generation) return;
        const recovered = notReady
          .filter((_, i) => ready[i])
          .map((c) => c.campaignId);
        if (recovered.length) {
          for (const id of recovered) this.artworkReady.add(id);
          iamLog(
            `artwork for ${recovered.length} campaign(s) loaded on retry; they can display again for the rest of this session`
          );
        }
      } finally {
        // A reset already cleared the flag and may have started a fresh pass; leave that one alone.
        if (this.generation === generation) this.artworkRefreshInFlight = false;
      }
    })();
  }

  private evaluate(occurrence: TriggerOccurrence): void {
    if (this.campaigns.length === 0) {
      iamLog('trigger ignored: no campaigns loaded');
      return;
    }
    const displayable: Campaign[] = [];
    const notReady: Campaign[] = [];
    for (const c of this.campaigns) {
      if (this.artworkReady.has(c.campaignId)) displayable.push(c);
      else {
        notReady.push(c);
        iamLog(`campaign "${c.campaignId}" passed over: artwork not ready`);
      }
    }
    if (notReady.length) this.maybeRefreshArtwork(notReady);
    if (displayable.length === 0) return;

    const now = this.clock();
    const campaign = selectCampaign({
      occurrence,
      campaigns: displayable,
      capState: this.cap.snapshot(),
      nowMs: now,
      cooldownMs: this.cooldownMs,
      quietHours: this.quietHours,
    });
    if (!campaign) return;

    this.emit?.(campaign.message);
    switch (this.decide(campaign.message)) {
      case 'discard':
        iamLog(`campaign "${campaign.campaignId}" discarded by beforeDisplay`);
        return;
      case 'later':
        this.defer(campaign, 'the host asked to display it later');
        return;
      case 'show': {
        // Snapshot before the winner displays so its own impression cannot rule the runner-up out.
        const capBefore = this.cap.snapshot();
        this.tryPresent(campaign);
        this.deferRunnerUp(occurrence, displayable, campaign, capBefore);
      }
    }
  }

  /** Keeps the next-best campaign for this occurrence behind the one on screen (D-31). Only when the winner took the screen. */
  private deferRunnerUp(
    occurrence: TriggerOccurrence,
    displayable: Campaign[],
    winner: Campaign,
    capBefore: CapState
  ): void {
    if (!this.presenter.isShowing || this.pending !== null) return;
    const runnerUp = selectCampaign({
      occurrence,
      campaigns: displayable.filter((c) => c.campaignId !== winner.campaignId),
      capState: capBefore,
      nowMs: this.clock(),
      cooldownMs: this.cooldownMs,
      quietHours: this.quietHours,
    });
    if (runnerUp)
      this.defer(
        runnerUp,
        `campaign "${winner.campaignId}" took this trigger first`
      );
  }

  private decide(message: InAppMessage): DisplayDecision {
    if (!this.beforeDisplay) return 'show';
    try {
      return this.beforeDisplay(message);
    } catch (error) {
      iamLog(`beforeDisplay threw; defaulting to show (${String(error)})`);
      return 'show';
    }
  }

  private tryPresent(campaign: Campaign): void {
    if (this.isHostOverlayOpen()) {
      this.defer(campaign, 'the host overlay is open');
      return;
    }
    if (this.presenter.isShowing) {
      this.defer(campaign, 'another message is showing');
      return;
    }
    if (this.presentationInFlight) {
      this.defer(campaign, 'another message is resolving its personalisation');
      return;
    }
    if (!messageHasTokens(campaign.message)) {
      this.present(campaign, campaign.message);
      return;
    }
    this.presentationInFlight = true;
    void this.resolveThenPresent(campaign);
  }

  private async resolveThenPresent(campaign: Campaign): Promise<void> {
    const customerId = this.customerId;
    const generation = this.generation;
    let message = campaign.message;
    try {
      if (customerId !== null) {
        const values = await this.withTimeout(
          this.variables.fetch(customerId),
          this.variableTimeoutMs,
          () => {
            iamLog(
              `personalisation for campaign "${campaign.campaignId}" did not arrive within ${this.variableTimeoutMs}ms; displaying the text from the last sync`
            );
            return {} as Record<string, string>;
          }
        );
        message = substituteInto(message, values);
      }
    } catch (error) {
      iamLog(
        `personalisation for campaign "${campaign.campaignId}" failed (${String(
          error
        )}); displaying the text from the last sync`
      );
    } finally {
      this.presentationInFlight = false;
    }
    message = clearUnresolvedTokens(message);
    if (!this.isStarted || this.generation !== generation) {
      iamLog(
        `campaign "${campaign.campaignId}" abandoned: messaging stopped while its personalisation was resolving`
      );
      return;
    }
    if (this.isHostOverlayOpen() || this.presenter.isShowing) {
      this.defer(
        campaign,
        'the screen was taken while personalisation resolved'
      );
      return;
    }
    this.present(campaign, message);
  }

  private present(campaign: Campaign, message: InAppMessage): void {
    // The customer the message is shown to: pinned now so a teardown or a customer switch that
    // dismisses it later still reports the dismissal (and the impression) under the right customer.
    const shownTo = this.customerId;
    if (shownTo === null) return;
    let shown = false;
    let engaged = false;
    const presented = this.presenter.present(message, {
      onShown: () => {
        shown = true;
        this.cap.recordDisplay(campaign.campaignId, this.clock());
        this.logEvent(campaign, 'impression', shownTo);
      },
      onButtonPressed: (button) => {
        engaged = true;
        this.logEvent(
          campaign,
          'click',
          shownTo,
          button.id,
          urlOf(button.action)
        );
        this.act(campaign.message, button, button.action);
      },
      onMessagePressed: () => {
        const action = campaign.message.clickAction;
        if (!action) return;
        engaged = true;
        this.logEvent(campaign, 'click', shownTo, undefined, urlOf(action));
        this.act(campaign.message, null, action);
      },
      onDismissed: () => {
        if (shown && !engaged) this.logEvent(campaign, 'dismiss', shownTo);
        this.retryPending();
      },
    });
    if (!presented) {
      this.defer(campaign, 'no presentation surface available');
      // Only a missing surface heals by itself, so only that is worth polling for. A presenter
      // that refuses for its own reasons waits for the next onDisplayOpportunity() or dismissal
      // instead — otherwise the poll would re-ask it every 250ms for the rest of the session.
      if (!this.surfaceRetryScheduled && !this.hasSurface()) {
        this.surfaceRetryScheduled = true;
        this.surfaceRetry = this.schedule(() => {
          this.surfaceRetry = null;
          this.surfaceRetryScheduled = false;
          this.retryPending();
        }, SURFACE_RETRY_MS);
      }
    }
  }

  private defer(campaign: Campaign, reason: string): void {
    if (this.pending && this.pending.campaignId !== campaign.campaignId)
      iamLog(
        `pending campaign "${this.pending.campaignId}" displaced by "${campaign.campaignId}"`
      );
    this.pending = campaign;
    iamLog(`campaign "${campaign.campaignId}" deferred: ${reason}`);
  }

  private logEvent(
    campaign: Campaign,
    type: MessageEventType,
    customerId: string,
    buttonId?: string,
    url?: string
  ): void {
    if (campaign.isTest) return; // a dashboard test send reports nothing
    this.analytics.log(
      createMessageEvent({
        type,
        campaignId: campaign.campaignId,
        variationId: campaign.variationId,
        dispatchId: campaign.dispatchId,
        occurredAtMs: this.clock(),
        buttonId,
        url,
      }),
      customerId
    );
  }

  private retryPending(): void {
    if (!this.isStarted) return;
    const campaign = this.pending;
    if (!campaign) return;
    this.pending = null;
    const capState = this.cap.snapshot();
    const now = this.clock();
    if (!isRepeatEligible(campaign, capState, now)) {
      iamLog(
        `pending campaign "${campaign.campaignId}" dropped: it may not display again yet`
      );
      return;
    }
    if (isWithinFloor(capState, now, this.cooldownMs)) {
      this.pending = campaign;
      this.scheduleFloorRetry(capState.lastDisplayAt);
      return;
    }
    if (this.quietHours && quietHoursContains(this.quietHours, new Date(now))) {
      iamLog(
        `pending campaign "${campaign.campaignId}" dropped: it is now inside the quiet-hours window`
      );
      return;
    }
    this.tryPresent(campaign);
  }

  /** Retries the parked message the moment the floor lapses (D-31). */
  private scheduleFloorRetry(lastDisplayAt: number | null): void {
    if (lastDisplayAt === null) return;
    const remaining = Math.max(
      0,
      this.cooldownMs - (this.clock() - lastDisplayAt)
    );
    if (this.floorRetry !== null) this.cancel(this.floorRetry);
    this.floorRetry = this.schedule(() => {
      this.floorRetry = null;
      this.retryPending();
    }, remaining);
  }

  /** Offers the tap to the host, dismisses, then acts (dismiss first so a navigation is not covered). */
  private act(
    message: InAppMessage,
    button: MessageButton | null,
    action: ClickAction
  ): void {
    const handled = this.askHost(message, button, action);
    this.presenter.dismiss();
    if (handled) {
      iamLog(`action on message "${message.id}" handled by the host`);
      return;
    }
    void this.flushThenRun(action);
  }

  private askHost(
    message: InAppMessage,
    button: MessageButton | null,
    action: ClickAction
  ): boolean {
    if (!this.onAction) return false;
    try {
      return this.onAction(message, button, action);
    } catch (error) {
      iamLog(
        `onAction threw; falling back to built-in handling (${String(error)})`
      );
      return false;
    }
  }

  private async flushThenRun(action: ClickAction): Promise<void> {
    if (action.type === 'open_url' || action.type === 'navigate') {
      try {
        await this.withTimeout(
          this.analytics.flush(),
          PRE_ACTION_FLUSH_TIMEOUT_MS,
          () => {
            iamLog(
              'telemetry flush did not finish before the action; the events stay queued'
            );
          }
        );
      } catch (error) {
        iamLog(`telemetry flush failed before the action (${String(error)})`);
      }
    }
    await this.runAction(action);
  }

  private async runAction(action: ClickAction): Promise<void> {
    switch (action.type) {
      case 'dismiss':
        return;
      case 'navigate':
        try {
          this.navigate(action.route, action.arguments);
        } catch (error) {
          iamLog(`onNavigate threw (${String(error)})`);
        }
        return;
      case 'open_url':
        try {
          const opened = await this.openUrl(action.url, action.external);
          if (!opened) iamLog(`could not open "${action.url}"`);
        } catch (error) {
          iamLog(`could not open "${action.url}" (${String(error)})`);
        }
        return;
      case 'request_push_permission':
        try {
          const granted = await this.requestPushPermission();
          iamLog(`push permission ${granted ? 'granted' : 'not granted'}`);
        } catch (error) {
          iamLog(`could not request push permission (${String(error)})`);
        }
    }
  }

  private withTimeout<T>(
    promise: Promise<T>,
    ms: number,
    onTimeout: () => T
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let settled = false;
      const handle = this.schedule(() => {
        if (!settled) {
          settled = true;
          resolve(onTimeout());
        }
      }, ms);
      promise.then(
        (value) => {
          if (!settled) {
            settled = true;
            this.cancel(handle);
            resolve(value);
          }
        },
        (error: unknown) => {
          if (!settled) {
            settled = true;
            this.cancel(handle);
            reject(error);
          }
        }
      );
    });
  }
}

function urlOf(action: ClickAction): string | undefined {
  return action.type === 'open_url' ? action.url : undefined;
}
