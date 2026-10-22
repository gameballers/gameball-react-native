/**
 * Common types used throughout the Gameball SDK
 * Following React Native conventions with plain objects and optional properties
 */

export enum PushProvider {
  firebase = 'Firebase',
  huawei = 'Huawei'
}

export interface GameballConfig {
  apiKey: string;
  lang: string;
  shop?: string;
  platform?: string;
  sessionToken?: string;
  apiPrefix?: string;
}

export interface Callback<T> {
  onSuccess?: (result: T) => void;
  onError?: (error: Error) => void;
}

export interface InitializeCustomerResponse {
  gameballId: string;
}

export interface InitializeCustomerRequest {
  customerId: string;
  email?: string;
  mobile?: string;
  referralCode?: string;
  customerAttributes?: CustomerAttributes;
  deviceToken?: string;
  pushProvider?: PushProvider;
  /** @deprecated Ignored: the SDK always initializes customers as registered. */
  isGuest?: boolean;
}

export interface CustomerAttributes {
  displayName?: string;
  firstName?: string;
  lastName?: string;
  mobile?: string;
  email?: string;
  gender?: string;
  dateOfBirth?: string;
  joinDate?: string;
  preferredLanguage?: string;
  customAttributes?: Record<string, string>;
  additionalAttributes?: Record<string, string>;
}

export interface Event {
  events: Record<string, Record<string, any>>;
  customerId: string;
  mobile?: string;
  email?: string;
}

export interface ShowProfileRequest {
  /** Optional customer identifier. When not provided, opens the guest view */
  customerId?: string;
  showCloseButton?: boolean;
  openDetail?: string;
  hideNavigation?: boolean;
  widgetUrlPrefix?: string;
  closeButtonColor?: string;
  mobile?: string;
  email?: string;
  /**
   * Optional language code (e.g. 'en', 'ar') for this widget presentation only. When not
   * provided, falls back to the customer preferred language, then the global language, then 'en'.
   */
  lang?: string;
  externalLinkCallback?: (url: string) => void;
  /**
   * Optional handler that receives widget events (e.g. game completion) posted from the widget
   * via window.WidgetEvent.postEvent as a {type, metadata} object; receives (null, error) when
   * the event payload can't be parsed.
   */
  widgetEventCallback?: WidgetEventCallback;
}

export interface WidgetEvent {
  type?: string;
  metadata?: Record<string, any>;
  [key: string]: any;
}

export type WidgetEventCallback = (event: WidgetEvent | null, error?: Error) => void;

export type GameballSDKHeadersType = {
  'OS': string;
  'SDKVersion': string;
  'X-GB-Agent': string;
  'APIKey'?: string;
  'Content-Type': string;
};
