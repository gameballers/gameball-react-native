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
  /** Whether the message's artwork is in memory and ready to paint. No artwork = ready. */
  prefetch(message: InAppMessage): Promise<boolean>;
  /**
   * Holds the artwork at these urls and nothing else, from now on. Called with a sync's set before
   * that set is warmed, so a download for an image the sync no longer carries is dropped.
   */
  retainOnly(urls: ReadonlySet<string>): void;
}

/** One image, held in memory so drawing it needs no network. */
export interface Artwork {
  /** A `data:` uri of the image's own bytes. */
  uri: string;
  /** In pixels. Known before display, so the view lays out at the artwork's shape first time. */
  width: number;
  height: number;
}

/** The held artwork for each slot a message draws. null = the message has none in that slot. */
export interface MessageArtwork {
  image: Artwork | null;
  icon: Artwork | null;
}
