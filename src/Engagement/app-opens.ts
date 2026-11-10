import type { AppStateStatus } from 'react-native';

/**
 * One app-level open. `cold` is the first in this JS runtime, `warm` a later one. `fromTap`
 * when a Gameball tap handled while the app was away opened it.
 */
export interface AppOpen {
  type: 'cold' | 'warm';
  openedAt: number;
  fromTap: boolean;
}

/** In-app messaging's session timeout, so both agree on what an open is. */
export const SESSION_GAP_MS = 30_000;

/** How long a tap handled while the app is away can explain the next return to it. */
export const TAP_OPEN_WINDOW_MS = 60_000;

/**
 * Turns foreground/background moves into app opens. A return within `sessionGapMillis`
 * continues the last open; a later return is a warm open. Same rules as the Android SDK.
 */
export class AppOpenObserver {
  private started = false;
  private inForeground = false;
  private backgroundedAt: number | null = null;
  private tapAt: number | null = null;

  constructor(
    private readonly report: (open: AppOpen) => void,
    private readonly now: () => number = () => Date.now(),
    private readonly sessionGapMillis: number = SESSION_GAP_MS,
    private readonly tapWindowMillis: number = TAP_OPEN_WINDOW_MS
  ) {}

  /**
   * A Gameball tap was handled. While the app is away (including before it was first seen on
   * screen) it marks the next return as opened by the tap; on screen it opens nothing.
   */
  noteTap(): void {
    if (this.inForeground) return;
    this.tapAt = this.now();
  }

  onForeground(): void {
    // iOS goes active → inactive → active for the notification centre: still the same open
    if (this.inForeground) return;
    this.inForeground = true;
    const at = this.now();
    const away = this.backgroundedAt === null ? null : at - this.backgroundedAt;
    this.backgroundedAt = null;
    // Every return uses the tap mark up, even one that continues the last open
    const sinceTap = this.tapAt === null ? null : at - this.tapAt;
    this.tapAt = null;
    if (this.started && away !== null && away <= this.sessionGapMillis) return;
    this.report({
      type: this.started ? 'warm' : 'cold',
      openedAt: at,
      fromTap:
        sinceTap !== null && sinceTap >= 0 && sinceTap <= this.tapWindowMillis,
    });
    this.started = true;
  }

  onBackground(): void {
    if (!this.inForeground) return;
    this.inForeground = false;
    this.backgroundedAt = this.now();
  }
}

/** The part of `AppState` this needs, so a test can drive it without React Native. */
export interface AppStateLike {
  currentState: AppStateStatus | string | null | undefined;
  addEventListener(
    type: 'change',
    listener: (state: AppStateStatus) => void
  ): { remove(): void };
}

/**
 * Feeds `AppState` into an observer. Only `background` leaves the app: `inactive` is a phone
 * call, the app switcher or a system prompt on top of the app, and the app is still on screen.
 */
export function attachAppOpens(
  observer: AppOpenObserver,
  appState: AppStateLike
): () => void {
  if (appState.currentState === 'active') observer.onForeground();
  const subscription = appState.addEventListener('change', (state) => {
    if (state === 'active') observer.onForeground();
    else if (state === 'background') observer.onBackground();
  });
  return () => subscription.remove();
}
