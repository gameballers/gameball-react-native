import { iamLog } from '../log';
import type { InAppMessage } from '../models/message';
import type { MessagePresenter, PresentCallbacks } from './presenter';

/** What the host component renders, and how it reports back. */
export interface PresentedMessage {
  message: InAppMessage;
  /** Called by the view on its first painted frame. The impression is counted here. */
  onShown(): void;
  callbacks: PresentCallbacks;
}

type Listener = (current: PresentedMessage | null) => void;

/**
 * Bridges the service to React.
 *
 * The service is imperative and knows nothing about rendering; React draws from state. This holds
 * the one message that may be on screen and publishes it to whichever host component is mounted.
 * Nothing is drawn until a host mounts, which is why `hasSurface` exists: without it the service
 * would count an impression for a message no customer could see.
 *
 * `onShown` comes from the view's first layout rather than from `present`, because that is the
 * frame the customer could actually have seen — the same rule the other SDKs use, and it is also
 * when auto-dismiss starts.
 */
export class ReactMessagePresenter implements MessagePresenter {
  private current: PresentedMessage | null = null;
  private listener: Listener | null = null;
  private autoDismiss: ReturnType<typeof setTimeout> | null = null;
  private shown = false;

  /** True while a host component is mounted. The service defers displays until it is. */
  get hasSurface(): boolean {
    return this.listener !== null;
  }

  get isShowing(): boolean {
    return this.current !== null;
  }

  /** Called by the host component on mount. Returns its own removal. */
  attach(listener: Listener): () => void {
    if (this.listener) {
      iamLog(
        'a second in-app messaging host mounted; the first one keeps the screen'
      );
      return () => {};
    }
    this.listener = listener;
    listener(this.current);
    return () => {
      if (this.listener === listener) {
        this.listener = null;
      }
    };
  }

  present(message: InAppMessage, callbacks: PresentCallbacks): boolean {
    if (this.current) {
      iamLog('presenter busy: a message is already showing');
      return false;
    }
    if (!this.listener) {
      iamLog('no in-app messaging host mounted yet; deferring');
      return false;
    }
    this.shown = false;
    const entry: PresentedMessage = {
      message,
      callbacks,
      onShown: () => {
        // The view reports every layout pass; only the first one is an impression.
        if (this.shown || this.current !== entry) {
          return;
        }
        this.shown = true;
        callbacks.onShown();
        if (message.autoDismissMs !== null) {
          this.autoDismiss = setTimeout(
            () => this.dismiss(),
            message.autoDismissMs
          );
        }
      },
    };
    this.current = entry;
    this.listener(entry);
    return true;
  }

  dismiss(): void {
    const entry = this.current;
    if (!entry) {
      return;
    }
    // Cleared first, so a callback that dismisses again cannot report two dismissals.
    this.current = null;
    this.shown = false;
    if (this.autoDismiss !== null) {
      clearTimeout(this.autoDismiss);
      this.autoDismiss = null;
    }
    this.listener?.(null);
    entry.callbacks.onDismissed();
  }

  dispose(): void {
    this.dismiss();
    this.listener = null;
  }
}
