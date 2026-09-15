import type { InAppMessage, MessageButton } from '../models/message';

export interface PresentCallbacks {
  /** Once, when the message becomes visible (first paint). */
  onShown(): void;
  /** Per tap; does not dismiss — the service decides. */
  onButtonPressed(button: MessageButton): void;
  /** Only reachable when the campaign set a message-level action. */
  onMessagePressed(): void;
  /** Exactly once, after the message leaves the screen, however it left. */
  onDismissed(): void;
}

export interface MessagePresenter {
  readonly isShowing: boolean;
  /** False (no callbacks invoked) when there is no surface or a message is already showing. */
  present(message: InAppMessage, callbacks: PresentCallbacks): boolean;
  /** Removes the current message, if any. Idempotent. */
  dismiss(): void;
  /** Optional teardown on stopInAppMessaging(): release the surface entirely. Idempotent. */
  dispose?(): void;
}

export interface ArtworkPrefetcher {
  /** Whether the message's artwork is decoded and ready to paint. No artwork = ready. */
  prefetch(message: InAppMessage): Promise<boolean>;
}
