import type { AppOpen } from './app-opens';

/** A Gameball push that reached the phone and hasn't been tapped. `key` identifies the push. */
export interface ReceivedPush {
  key: string;
  clickToken: string | null;
  sentAt: number;
  receivedAt: number;
}

/** Where received pushes are kept between app launches. */
export interface ReceivedPushStore {
  load(): Promise<ReceivedPush[]>;
  save(pushes: ReceivedPush[]): Promise<void>;
}

export const INFLUENCE_WINDOW_MS = 30 * 60 * 1000;
export const MAX_SAVED_PUSHES = 20;

/**
 * Influenced opens: a push arrived, the user didn't tap it, and opened the app within
 * `windowMillis` of receiving it. Same rules as the Android SDK.
 *
 * - received → saved (the same push once, at most 20)
 * - tapped → removed; it's a normal tap and never counts as influenced
 * - app opened → if the most recent saved push arrived within the window, that push
 *   influenced the open; the saved pushes are cleared either way
 *
 * Every operation runs after the previous one finishes, so a read-modify-write never
 * loses another one's change.
 */
export class InfluencedOpens {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly store: ReceivedPushStore,
    private readonly now: () => number = () => Date.now(),
    private readonly windowMillis: number = INFLUENCE_WINDOW_MS
  ) {}

  onReceived(
    key: string,
    clickToken: string | null,
    sentAt: number
  ): Promise<void> {
    return this.serial(async () => {
      const pushes = (await this.store.load()).filter((p) => p.key !== key);
      pushes.push({ key, clickToken, sentAt, receivedAt: this.now() });
      await this.store.save(pushes.slice(-MAX_SAVED_PUSHES));
    });
  }

  onTap(key: string): Promise<void> {
    return this.serial(async () => {
      const pushes = await this.store.load();
      if (pushes.some((p) => p.key === key)) {
        await this.store.save(pushes.filter((p) => p.key !== key));
      }
    });
  }

  /**
   * The push that influenced `open`, or null for an ordinary open. Clears the pushes that
   * arrived up to the open; one that arrived after it (possible when this runs a moment
   * later) waits for the next open, as it would have on Android. An open from a tap is a
   * click, never influenced, even by an older push.
   */
  influencedBy(open: AppOpen): Promise<ReceivedPush | null> {
    return this.serial(async () => {
      const pushes = await this.store.load();
      const before = pushes.filter((p) => p.receivedAt <= open.openedAt);
      if (before.length === 0) return null;
      await this.store.save(pushes.filter((p) => p.receivedAt > open.openedAt));
      if (open.fromTap) return null;
      const latest = before.reduce((a, b) =>
        b.receivedAt > a.receivedAt ? b : a
      );
      return open.openedAt - latest.receivedAt <= this.windowMillis
        ? latest
        : null;
    });
  }

  /** Another customer's pushes must never credit this customer's opens. */
  clear(): Promise<void> {
    return this.serial(() => this.store.save([]));
  }

  private serial<T>(work: () => Promise<T>): Promise<T> {
    const result = this.queue.then(work, work);
    this.queue = result.catch(() => undefined);
    return result;
  }
}
