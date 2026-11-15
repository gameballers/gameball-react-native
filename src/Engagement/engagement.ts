import {
  AppOpenObserver,
  SESSION_GAP_MS,
  attachAppOpens,
  type AppOpen,
  type AppStateLike,
} from './app-opens';
import { InfluencedOpens } from './influenced-opens';
import {
  PushEngagementType,
  pushEngagementBody,
  type PushEngagementBody,
} from './push-engagement';

/**
 * How long after an app open the SDK waits before deciding whether a push influenced it.
 *
 * On Android the native SDK sees a tap before the open. In React Native the tap usually arrives
 * later, when the app passes RNFirebase's getInitialNotification / onNotificationOpenedApp
 * result to handlePushClick. A Gameball tap handled during the wait means the tap opened the
 * app: the open is a click, never an influenced open.
 *
 * 10 s, the same as the Flutter SDK: taps took 0.3 to 2.6 s to arrive on an emulator, and a slow
 * phone's cold start can take several seconds more.
 */
export const TAP_GRACE_MS = 10_000;

export type PushData = Record<string, any> | null | undefined;

const MESSAGE_ID_KEY = 'google.message_id';

export function isGameballPush(data: PushData): data is Record<string, any> {
  return String(data?.isGB).toLowerCase() === 'true';
}

function clickTokenOf(data: Record<string, any>): string | null {
  const token = data.gbClickToken;
  return typeof token === 'string' && token.trim() !== '' ? token : null;
}

/** The same push seen twice gives the same key: its click token, else its message id. */
export function pushKeyOf(data: Record<string, any>): string | null {
  const messageId = data[MESSAGE_ID_KEY] ?? data.messageId;
  return (
    clickTokenOf(data) ??
    (typeof messageId === 'string' && messageId !== '' ? messageId : null)
  );
}

/**
 * Every signal is logged. Taps and influenced opens are also reported to the backend; app opens
 * and arrivals are only logged.
 */
export function logSignal(
  name: string,
  fields: Record<string, string | number | null>
): void {
  const text = Object.entries(fields)
    .map(([key, value]) => `${key}=${value}`)
    .join(' ');
  console.log(`GameballApp engagement ${name} ${text}`);
}

export interface EngagementOptions {
  influenced: InfluencedOpens;
  now?: () => number;
  log?: typeof logSignal;
  schedule?: (work: () => void, delayMillis: number) => void;
  tapGraceMillis?: number;
  tapOpenWindowMillis?: number;
  /** Sends one push-engagement report; one attempt, no retry. */
  report?: (body: PushEngagementBody) => Promise<unknown> | void;
}

/** Push taps, app opens, push arrivals and influenced opens. */
export class Engagement {
  private readonly handledTaps = new Set<string>();
  private readonly influenced: InfluencedOpens;
  private readonly now: () => number;
  private readonly log: typeof logSignal;
  private readonly schedule: (work: () => void, delayMillis: number) => void;
  private readonly tapGraceMillis: number;
  private readonly report: (
    body: PushEngagementBody
  ) => Promise<unknown> | void;
  private readonly observer: AppOpenObserver;
  private detachAppOpens: (() => void) | null = null;
  /** The open whose influenced-open check is waiting for a late tap. */
  private waiting: { fromTap: boolean } | null = null;

  constructor(options: EngagementOptions) {
    this.influenced = options.influenced;
    this.now = options.now ?? (() => Date.now());
    this.log = options.log ?? logSignal;
    this.schedule =
      options.schedule ??
      ((work, delay) => {
        setTimeout(work, delay);
      });
    this.tapGraceMillis = options.tapGraceMillis ?? TAP_GRACE_MS;
    this.report = options.report ?? (() => undefined);
    // Made up front, so a tap handled before init still counts toward the open it caused
    this.observer = new AppOpenObserver(
      (open) => this.onAppOpen(open),
      this.now,
      SESSION_GAP_MS,
      options.tapOpenWindowMillis
    );
  }

  /** Starts watching app opens. Safe to call on every init. */
  start(appState: AppStateLike): void {
    if (this.detachAppOpens) return;
    this.detachAppOpens = attachAppOpens(this.observer, appState);
  }

  /** Saves an arriving Gameball push. False, and nothing saved, for any other push. */
  async onReceived(data: PushData, sentTime?: number | null): Promise<boolean> {
    if (!isGameballPush(data)) return false;
    const sentAt = typeof sentTime === 'number' ? sentTime : 0;
    const clickToken = clickTokenOf(data);
    this.log('push_received', {
      clickToken,
      sentAt,
      receivedAt: this.now(),
    });
    const key = pushKeyOf(data);
    if (key) {
      try {
        await this.influenced.onReceived(key, clickToken, sentAt);
      } catch (error) {
        if (__DEV__)
          console.log('[GameballApp] could not save a received push', error);
      }
    }
    return true;
  }

  /**
   * A tap on a Gameball push. True the first time it's seen in this app run, false for a
   * repeat (e.g. both getInitialNotification and onNotificationOpenedApp reporting it).
   */
  onTap(data: Record<string, any>): boolean {
    const key = pushKeyOf(data);
    if (key !== null) {
      if (this.handledTaps.has(key)) return false;
      this.handledTaps.add(key);
    }
    this.log('push_click', { clickToken: clickTokenOf(data) });
    this.noteTap();
    this.forget(data);
    return true;
  }

  /** Another customer's pushes must never credit this customer's opens. */
  clearReceived(): Promise<void> {
    return this.influenced.clear().catch(() => {});
  }

  // A tap during the wait after an open opened the app; one handled while the app is away
  // opens it on the next return. A tap on screen opens nothing.
  private noteTap(): void {
    if (this.waiting) this.waiting.fromTap = true;
    this.observer.noteTap();
  }

  // A tapped push is a normal tap and never counts toward an influenced open
  private forget(data: Record<string, any>): void {
    const key = pushKeyOf(data);
    if (key !== null) this.influenced.onTap(key).catch(() => {});
  }

  private onAppOpen(open: AppOpen): void {
    // Logged at once; whether a tap opened the app is only settled after the wait
    this.log('app_open', { type: open.type, openedAt: open.openedAt });
    const waiting = { fromTap: open.fromTap };
    this.waiting = waiting;
    this.schedule(() => {
      if (this.waiting === waiting) this.waiting = null;
      this.influenced
        .influencedBy({ ...open, fromTap: waiting.fromTap })
        .then((push) => {
          if (!push) return;
          this.log('influenced_open', {
            clickToken: push.clickToken,
            sentAt: push.sentAt,
            receivedAt: push.receivedAt,
            type: open.type,
            openedAt: open.openedAt,
          });
          // Without a click token there's nothing to credit on the backend: logged only.
          // Dated at the open, not at this check after the wait.
          if (push.clickToken) {
            return this.report(
              pushEngagementBody(
                push.clickToken,
                PushEngagementType.InfluencedOpen,
                open.openedAt
              )
            );
          }
          return undefined;
        })
        .catch((error) => {
          if (__DEV__) {
            console.log('[GameballApp] influenced open not reported', error);
          }
        });
    }, this.tapGraceMillis);
  }
}
