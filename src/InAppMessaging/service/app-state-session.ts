import { AppState, type AppStateStatus } from 'react-native';

/** What a session boundary reaches. The service decides what a pause and a resume mean. */
export interface SessionTarget {
  onAppPaused(): void;
  onAppResumed(): void;
}

/** The part of `AppState` this needs, so a test can drive it without React Native. */
export interface AppStateLike {
  currentState: AppStateStatus | null;
  addEventListener(
    type: 'change',
    listener: (state: AppStateStatus) => void
  ): { remove(): void };
}

/**
 * Turns app-state changes into session boundaries.
 *
 * `background` and `inactive` both pause. `inactive` is the iOS state for a phone call, the
 * app switcher, or a system prompt on top of the app, and the customer cannot read a message
 * through any of them; the service takes the first pause and ignores the rest, so an
 * `inactive` → `background` pair is one boundary rather than two.
 *
 * A pause is also the last dependable moment to flush analytics, which the service does — a
 * process that never comes back must not take reported impressions with it.
 */
export function attachAppStateSession(
  target: SessionTarget,
  appState: AppStateLike = AppState
): () => void {
  let paused =
    appState.currentState !== null && appState.currentState !== 'active';

  const subscription = appState.addEventListener('change', (state) => {
    const isActive = state === 'active';
    if (isActive && paused) {
      paused = false;
      target.onAppResumed();
      return;
    }
    if (!isActive && !paused) {
      paused = true;
      target.onAppPaused();
    }
  });

  return () => subscription.remove();
}
