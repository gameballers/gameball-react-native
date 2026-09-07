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
