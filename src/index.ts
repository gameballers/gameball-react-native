// Modern React Native API
import GameballApp from './GameballApp';
import GameballWidget from './GameballWidget';
import { GameballInAppMessages, inAppMessaging } from './InAppMessaging';
export { GameballApp, GameballWidget, GameballInAppMessages, inAppMessaging };
export default GameballApp;

// Types following React Native conventions
export type {
  GameballConfig,
  InitializeCustomerRequest,
  CustomerAttributes,
  InitializeCustomerResponse,
  Event,
  ShowProfileRequest,
  Callback,
} from './types/Common';

// Enums
export { PushProvider } from './types/Common';

// In-app messaging
export type {
  StartInAppMessagingOptions,
  GameballInAppMessagesProps,
  InAppMessage,
  MessageButton,
  ClickAction,
  MessageType,
  MessageLayout,
  MessageOrientation,
  SlidePosition,
  MessageStyle,
  ButtonStyle,
  BeforeDisplay,
  DisplayDecision,
  OnAction,
  TextAlign,
  PresentedMessage,
  PresentCallbacks,
} from './InAppMessaging';
