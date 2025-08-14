/**
 * Common types used throughout the Gameball SDK
 * Following React Native conventions with plain objects and optional properties
 */

export interface GameballConfig {
  apiKey: string;
  lang: string;
  shop?: string;
  platform?: string;
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
  pushProvider?: string;
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
  customerId: string;
  showCloseButton?: boolean;
  openDetail?: string;
  hideNavigation?: boolean;
  widgetUrlPrefix?: string;
  closeButtonColor?: string;
}

export type GameballSDKHeadersType = {
  'OS': string;
  'SDKVersion': string;
  'X-GB-Agent': string;
  'APIKey'?: string;
  'Content-Type': string;
};
