/** Maximum buttons a modal or fullscreen renders. Extra buttons are dropped at parse. */
export const MAX_MODAL_BUTTONS = 2;

export type MessageType = 'slideup' | 'modal' | 'fullscreen' | 'unsupported';
export type SlidePosition = 'top' | 'bottom';
export type MessageLayout = 'text_with_image' | 'image_only';
export type MessageOrientation = 'portrait' | 'landscape' | 'any';
export type TextAlign = 'left' | 'right' | 'center' | 'start' | 'end';

export type ClickAction =
  | { type: 'dismiss' }
  | { type: 'open_url'; url: string; external: boolean }
  | { type: 'navigate'; route: string; arguments?: Record<string, unknown> }
  | { type: 'request_push_permission' };

/** Colours are CSS colour strings (`#rrggbb` or `rgba(...)`); undefined means "use the host page". */
export interface ButtonStyle {
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
}

export interface MessageButton {
  id: string;
  text: string;
  action: ClickAction;
  style: ButtonStyle;
}

export interface MessageStyle {
  backgroundColor?: string;
  headerColor?: string;
  bodyColor?: string;
  scrimColor?: string;
  closeButtonColor?: string;
  headerAlign?: TextAlign;
  bodyAlign?: TextAlign;
}

/**
 * A reward campaign rendered as the message's own content.
 *
 * The campaign **is** the content — there is no headline, body, image or button, because this is
 * not a teaser that links to a game, it is the game.
 *
 * Deliberately not a URL on the wire: one would have to carry the api key and the player id,
 * making the payload both credential-bearing and customer-specific. The SDK composes the URL from
 * state it already holds and the two fields here.
 */
export interface WidgetContent {
  /** The challenge to open. All local bookkeeping keys off this, never off the entry's
   * `campaignId`, which is always 0 on a game. */
  gameCampaignId: number;
  /** Which game it is, as the open-details text: `wheel`, `quiz`, `scratch`… */
  gameCampaignType: string;
}

/** What the host widget is asked to open. */
export function openDetailFor(widget: WidgetContent): string {
  return `details_${widget.gameCampaignType}_${widget.gameCampaignId}`;
}

export interface InAppMessage {
  /** `campaignId` or `campaignId/variationId`; diagnostics only. */
  id: string;
  /** Correlation fields for the host's hooks (onMessage, beforeDisplay, onAction): the campaign
   * this message came from, its variation (null when the campaign has none), and whether it is a
   * dashboard test send — a test send is never reported to analytics. */
  campaignId: number;
  variationId: number | null;
  isTest: boolean;
  type: MessageType;
  header: string | null;
  body: string | null;
  imageUrl: string | null;
  iconUrl: string | null;
  /** What tapping the surface does. null = not tappable. */
  clickAction: ClickAction | null;
  showCloseButton: boolean;
  dismissOnScrimTap: boolean;
  /** null = stays until dismissed. */
  autoDismissMs: number | null;
  layout: MessageLayout;
  orientation: MessageOrientation;
  slidePosition: SlidePosition;
  buttons: MessageButton[];
  extras: Record<string, string>;
  style: MessageStyle;
  /** A reward campaign to render instead of artwork and copy. null for every ordinary message.
   *
   * A message carrying this renders a live widget, so it is exempt from the parser's "nothing to
   * render" rule — its content arrives over the network at display time rather than in the
   * payload. */
  widget: WidgetContent | null;
}

/** Whether this message's content is a reward campaign rather than artwork. */
export function isWidgetMessage(message: InAppMessage): boolean {
  return Boolean(message.widget);
}

/** Every image the message carries. All of them must be in memory before it may display. */
export function artworkUrlsOf(message: InAppMessage): string[] {
  return [message.imageUrl, message.iconUrl].filter(
    (url): url is string => !!url
  );
}

/** The same message with different text. Personalisation is the only caller. */
export function withText(
  message: InAppMessage,
  patch: {
    header?: string | null;
    body?: string | null;
    buttons?: MessageButton[];
  }
): InAppMessage {
  return {
    ...message,
    header: patch.header === undefined ? message.header : patch.header,
    body: patch.body === undefined ? message.body : patch.body,
    buttons: patch.buttons ?? message.buttons,
  };
}

export function buttonWithText(
  button: MessageButton,
  text: string
): MessageButton {
  return { ...button, text };
}
