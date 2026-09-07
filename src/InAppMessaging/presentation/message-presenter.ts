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
export interface ReactMessagePresenterOptions {
  /** The screen's current orientation, when the host can report it. */
  orientation?: () => 'portrait' | 'landscape' | undefined;
}

export class ReactMessagePresenter implements MessagePresenter {
  private current: PresentedMessage | null = null;
  private listener: Listener | null = null;
  private readonly observers = new Set<Listener>();
  /** Hosts mounted while another one holds the screen, newest last. */
  private spares: Listener[] = [];
  private autoDismiss: ReturnType<typeof setTimeout> | null = null;
  private shown = false;
  private readonly orientation:
    | (() => 'portrait' | 'landscape' | undefined)
    | null;

  constructor(options: ReactMessagePresenterOptions = {}) {
    this.orientation = options.orientation ?? null;
  }

  /**
   * A full screen authored for one orientation waits for it rather than drawing sideways. The
   * refusal heals on its own: rotating the device is a display opportunity, and the service
   * retries the message it parked.
   */
  private orientationAllows(message: InAppMessage): boolean {
    if (
      message.type !== 'fullscreen' ||
      message.orientation === 'any' ||
      !this.orientation
    ) {
      return true;
    }
    const current = this.orientation();
    return current === undefined || current === message.orientation;
  }

  /** True while a host component is mounted. The service defers displays until it is. */
  get hasSurface(): boolean {
    return this.listener !== null;
  }

  get isShowing(): boolean {
    return this.current !== null;
  }

  /**
   * Called by the host component on mount. Returns its own removal.
   *
   * Mounting a second host does not steal the screen from the first — but it is remembered, so
   * that when the first unmounts the second takes over. Handing a second host a removal that did
   * nothing left the SDK with no surface at all the moment the first one went away: the host was
   * still on screen, `hasSurface` was false forever, and the service settled into a 250 ms retry
   * that could never succeed.
   */
  attach(listener: Listener): () => void {
    if (this.listener && this.listener !== listener) {
      iamLog(
        'a second in-app messaging host mounted; the first one keeps the screen'
      );
      this.spares.push(listener);
      return () => {
        this.spares = this.spares.filter((l) => l !== listener);
      };
    }
    this.listener = listener;
    listener(this.current);
    return () => {
      if (this.listener !== listener) {
        return;
      }
      const next = this.spares.pop() ?? null;
      this.listener = next;
      if (next) {
        iamLog('the in-app messaging host unmounted; a spare one took over');
        next(this.current);
      }
    };
  }

  /**
   * Watches what is on screen without being the surface it is drawn on.
   *
   * Any number of these, and none of them makes the SDK think it has somewhere to draw. It is how
   * a host learns that a message is up — to pause a video, say — and how the QA panel drives a
   * message it cannot tap.
   */
  observe(listener: Listener): () => void {
    this.observers.add(listener);
    listener(this.current);
    return () => {
      this.observers.delete(listener);
    };
  }

  private publish(entry: PresentedMessage | null): void {
    this.listener?.(entry);
    for (const observer of this.observers) {
      observer(entry);
    }
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
    if (!this.orientationAllows(message)) {
      iamLog(
        `message "${message.id}" needs ${message.orientation} orientation; deferring`
      );
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
    this.publish(entry);
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
    this.publish(null);
    entry.callbacks.onDismissed();
  }

  dispose(): void {
    this.dismiss();
    this.listener = null;
  }
}
