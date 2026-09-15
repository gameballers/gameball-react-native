import { Dimensions, Linking, Platform } from 'react-native';
import { BatchedMessageAnalytics } from './analytics/analytics';
import { GameballApiClient, DEFAULT_API_BASE_URL } from './api/client';
import { StoredFrequencyCap } from './evaluation/frequency-cap';
import { iamLog, setLogEnabled } from './log';
import type { InAppMessage } from './models/message';
import { CachingVariableSource } from './personalisation/variable-source';
import { ImageArtworkPrefetcher } from './presentation/artwork-prefetcher';
import { ReactMessagePresenter } from './presentation/message-presenter';
import {
  InAppMessagingService,
  type BeforeDisplay,
  type OnAction,
} from './service/in-app-messaging-service';
import { attachAppStateSession } from './service/app-state-session';
import { StoredCampaignCache } from './source/campaign-cache';
import { HttpMessageSource } from './source/message-source';
import { AsyncStorageStore } from './storage/async-storage-store';
import { platformCode } from './platform';
import { SDK_VERSION } from './version';

export interface InAppMessagingConfig {
  apiKey: string;
  /** Two-letter code. The identified customer's `preferredLanguage` wins over it. */
  lang?: string;
  apiBaseUrl?: string;
  appVersion?: string;
  /** Console diagnostics, prefixed `[GameballIAM]`. */
  debug?: boolean;
}

export interface StartInAppMessagingOptions {
  /** Defaults to the last identified customer. */
  customerId?: string;
  sessionTimeoutSeconds?: number;
  beforeDisplay?: BeforeDisplay;
  onAction?: OnAction;
  onNavigate?: (route: string, args?: Record<string, unknown>) => void;
  /** Every selected message, whatever the host then decides. */
  onMessage?: (message: InAppMessage) => void;
  openUrl?: (url: string, external: boolean) => boolean | Promise<boolean>;
  requestPushPermission?: () => Promise<boolean>;
}

/** Everything a campaign URL could reasonably be, and nothing a campaign should be able to run. */
const OPENABLE_SCHEMES = ['http:', 'https:', 'mailto:', 'tel:'];

function isOpenable(url: string): boolean {
  const scheme = /^([a-z][a-z0-9+.-]*:)/i.exec(url.trim())?.[1]?.toLowerCase();
  if (!scheme) {
    // A relative URL means nothing to a native app; there is no page to be relative to.
    iamLog(`refusing to open "${url}": it is not an absolute URL`);
    return false;
  }
  if (!OPENABLE_SCHEMES.includes(scheme)) {
    iamLog(`refusing to open "${url}": unsupported scheme`);
    return false;
  }
  return true;
}

/**
 * Owns the in-app messaging module for the app.
 *
 * `GameballApp` delegates to this rather than growing another 300 lines: everything here is about
 * messaging, and the SDK's other features do not need to know it exists.
 */
export class InAppMessagingController {
  readonly presenter = new ReactMessagePresenter({
    orientation: () => {
      const { width, height } = Dimensions.get('window');
      return width > height ? 'landscape' : 'portrait';
    },
  });

  private config: InAppMessagingConfig | null = null;
  private api: GameballApiClient | null = null;
  private service: InAppMessagingService | null = null;
  private detachSession: (() => void) | null = null;
  private detachOrientation: (() => void) | null = null;
  private customerId: string | null = null;
  private preferredLanguage: string | null = null;
  private overlayOpen = false;
  private starting: Promise<void> | null = null;
  /**
   * The options the most recent `start()` was given.
   *
   * Read through, never captured: the service is built once and its callbacks live as long as it
   * does, so a second `start()` with different hooks has to reach them somehow. Capturing the
   * first call's options would leave every later one silently ignored.
   */
  private options: StartInAppMessagingOptions = {};
  /**
   * Bumped by every `stop()`. `start()` is asynchronous — storage has to be read before the first
   * campaign is judged — and a `stop()` that lands inside that window would otherwise be undone by
   * the start it was meant to cancel.
   */
  private generation = 0;
  private readonly listeners = new Set<(message: InAppMessage) => void>();

  configure(config: InAppMessagingConfig): void {
    this.config = config;
    setLogEnabled(config.debug ?? __DEV__);
    this.api = new GameballApiClient({
      apiKey: () => this.config?.apiKey ?? '',
      baseUrl: () => this.config?.apiBaseUrl ?? DEFAULT_API_BASE_URL,
      lang: () => this.language(),
      platformCode: () =>
        platformCode(Platform.OS === 'ios' ? 'ios' : 'android'),
      appVersion: () => this.config?.appVersion ?? '',
      sdkVersion: SDK_VERSION,
    });
  }

  get isStarted(): boolean {
    return this.service?.isStarted ?? false;
  }

  /**
   * Replaces the language `init` configured, for every request from here on.
   *
   * A customer who declared a `preferredLanguage` still wins, as they do on every Gameball SDK:
   * this is the app's default, not an override of the customer's own choice. Campaigns already
   * synced keep the copy they were fetched with until the next sync.
   */
  setLanguage(lang: string): void {
    if (this.config) {
      this.config.lang = lang;
    }
  }

  /** The customer messaging targets, and the language their messages are chosen in. */
  identified(customerId: string, preferredLanguage?: string | null): void {
    if (
      typeof preferredLanguage === 'string' &&
      preferredLanguage.length === 2
    ) {
      this.preferredLanguage = preferredLanguage;
    } else if (this.customerId !== customerId) {
      // A language belongs to the customer who declared it, never to whoever came before.
      this.preferredLanguage = null;
    }
    const changed = this.customerId !== null && this.customerId !== customerId;
    this.customerId = customerId;
    if (changed) {
      this.service?.onCustomerChanged(customerId);
    }
  }

  /**
   * Syncs campaigns and starts evaluating triggers.
   *
   * Awaited, unlike the other SDKs' equivalents, for one reason: storage is asynchronous on this
   * platform and the frequency history has to be in memory before the first campaign is judged
   * against it, or a once-ever message could show a second time.
   */
  async start(options: StartInAppMessagingOptions = {}): Promise<void> {
    // Recorded before the in-flight check: a second call's hooks are the ones the host means to
    // use, whether or not it has to wait for the first call to finish.
    this.options = options;
    if (this.starting) {
      return this.starting;
    }
    this.starting = this.startInternal(options).finally(() => {
      this.starting = null;
    });
    return this.starting;
  }

  private async startInternal(
    options: StartInAppMessagingOptions
  ): Promise<void> {
    const generation = this.generation;
    const api = this.api;
    if (!api || !this.config) {
      iamLog('startInAppMessaging ignored: call init({ apiKey }) first');
      return;
    }
    const customerId = options.customerId ?? this.customerId;
    if (!customerId) {
      iamLog(
        'startInAppMessaging ignored: no customerId — pass one or identify a customer first'
      );
      return;
    }
    this.customerId = customerId;

    if (!this.service) {
      const store = new AsyncStorageStore();
      await store.hydrate();
      if (this.generation !== generation) {
        iamLog(
          'startInAppMessaging abandoned: messaging was stopped while it was starting'
        );
        return;
      }

      this.service = new InAppMessagingService({
        source: new HttpMessageSource((id) => api.sync(id)),
        presenter: this.presenter,
        frequencyCap: new StoredFrequencyCap(store),
        campaignCache: new StoredCampaignCache(store),
        analytics: new BatchedMessageAnalytics({
          store,
          send: (id, events) => api.sendMessageEvents(id, events),
        }),
        prefetcher: new ImageArtworkPrefetcher(),
        variables: new CachingVariableSource({
          store,
          fetcher: (id) => api.fetchVariables(id),
        }),
        hasSurface: () => this.presenter.hasSurface,
        isHostOverlayOpen: () => this.overlayOpen,
        navigate: (route, args) => {
          if (this.options.onNavigate) {
            this.options.onNavigate(route, args);
          } else {
            iamLog(
              `navigate to "${route}" ignored: pass onNavigate to startInAppMessaging()`
            );
          }
        },
        openUrl: async (url, external) => {
          if (!isOpenable(url)) {
            return false;
          }
          if (this.options.openUrl) {
            return this.options.openUrl(url, external);
          }
          // React Native has no in-app browser without a dependency this SDK does not take, so
          // both kinds of link leave for the system browser. An app that ships one should pass
          // `openUrl` and decide for itself.
          try {
            await Linking.openURL(url);
            return true;
          } catch (error) {
            iamLog(`could not open "${url}" (${String(error)})`);
            return false;
          }
        },
        requestPushPermission: async () => {
          if (this.options.requestPushPermission) {
            return this.options.requestPushPermission();
          }
          iamLog(
            'a campaign asked for push permission but no requester was provided; pass requestPushPermission to startInAppMessaging()'
          );
          return false;
        },
        emit: (message) => {
          try {
            this.options.onMessage?.(message);
          } catch (error) {
            iamLog(`onMessage threw (${String(error)})`);
          }
          for (const listener of this.listeners) {
            try {
              listener(message);
            } catch (error) {
              iamLog(`onInAppMessage listener threw (${String(error)})`);
            }
          }
        },
        sessionTimeoutMs:
          options.sessionTimeoutSeconds !== undefined
            ? options.sessionTimeoutSeconds * 1000
            : undefined,
      });

      const service = this.service;
      this.detachSession = attachAppStateSession(service);
      // Rotating the device can make a parked full screen presentable.
      const subscription = Dimensions.addEventListener('change', () =>
        service.onDisplayOpportunity()
      );
      this.detachOrientation = () => subscription.remove();
    }

    await this.service.start({
      customerId,
      // Delegates rather than the functions themselves: the service keeps whatever it is given
      // until the customer changes, and these forward to whichever `start()` ran last.
      beforeDisplay: (message) =>
        this.options.beforeDisplay?.(message) ?? 'show',
      onAction: (message, button, action) =>
        this.options.onAction?.(message, button, action) ?? false,
    });
  }

  /**
   * Stops messaging and lets go of the customer it was running for.
   *
   * This is a logout boundary, as it is on the other SDKs: the next `start()` needs a customer,
   * passed to it or identified through `initializeCustomer`, rather than quietly resuming the one
   * who was signed in before. Stored state — frequency history, the analytics outbox, the campaign
   * cache — is kept, so the same customer signing back in is not shown a once-ever message twice.
   */
  stop(): void {
    this.generation++;
    this.starting = null;
    this.service?.stop();
    this.detachSession?.();
    this.detachOrientation?.();
    this.detachSession = null;
    this.detachOrientation = null;
    this.presenter.dismiss();
    this.service = null;
    this.customerId = null;
    this.preferredLanguage = null;
    this.options = {};
  }

  /** Hold messages while the app's own modal, drawer or checkout step is open. */
  setOverlayOpen(open: boolean): void {
    this.overlayOpen = open;
    if (!open) {
      this.service?.onHostOverlayClosed();
    }
  }

  onMessage(listener: (message: InAppMessage) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Every custom event the app sends is also a trigger, evaluated before the request goes out. */
  onCustomEvent(name: string, properties: Record<string, unknown>): void {
    try {
      this.service?.onCustomEvent(name, properties);
    } catch (error) {
      iamLog(`onCustomEvent hook failed (${String(error)})`);
    }
  }

  private language(): string {
    const preferred = this.preferredLanguage;
    if (preferred && preferred.length === 2) {
      return preferred;
    }
    const global = this.config?.lang;
    return global && global.length === 2 ? global : 'en';
  }
}
