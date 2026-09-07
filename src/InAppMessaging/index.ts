import { InAppMessagingController } from './controller';
import { createGameballInAppMessages } from './presentation/GameballInAppMessages';

/** One module per app, like the SDK it belongs to. */
export const inAppMessaging = new InAppMessagingController();

/**
 * Where in-app messages are drawn. Mount it once, near the root of the app and above the
 * navigator. Until it is mounted the SDK holds messages rather than counting impressions
 * nobody could see.
 */
export const GameballInAppMessages = createGameballInAppMessages(
  inAppMessaging.presenter
);

export type {
  InAppMessagingConfig,
  StartInAppMessagingOptions,
} from './controller';
export type { GameballInAppMessagesProps } from './presentation/GameballInAppMessages';
export type {
  InAppMessage,
  MessageButton,
  ClickAction,
  MessageType,
  MessageLayout,
  MessageOrientation,
  SlidePosition,
  MessageStyle,
  ButtonStyle,
  TextAlign,
} from './models/message';
export type {
  BeforeDisplay,
  DisplayDecision,
  OnAction,
} from './service/in-app-messaging-service';
