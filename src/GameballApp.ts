import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import GameballWidget from './GameballWidget';
import GameballLogger from './GameballLogger';
import { LanguageUtils } from './GameballWidget/languageUtils';
import type {
  GameballConfig,
  InitializeCustomerRequest,
  InitializeCustomerResponse,
  Event,
  ShowProfileRequest,
  Callback,
  GameballSDKHeadersType,
} from './types/Common';
import { API_ENDPOINTS, ERROR_MESSAGES, STORAGE_KEYS } from './constants';
import { inAppMessaging } from './InAppMessaging';
import type { StartInAppMessagingOptions } from './InAppMessaging';
import type { InAppMessage } from './InAppMessaging/models/message';

const package_json = require('../package.json');

/**
 * Primary Gameball SDK entry point providing comprehensive functionality
 * with modern React Native API and builder pattern request models.
 *
 * Following React Native conventions:
 * - Singleton pattern for centralized SDK management
 * - Promise-based async operations with optional callbacks
 * - Platform-specific handling
 * - TypeScript-first design
 */
export class GameballApp {
  private static instance: GameballApp;

  private apiKey: string = '';
  private config: GameballConfig | null = null;
  private isInitialized: boolean = false;
  private mainColor: string | null = null;
  private sessionToken: string | null = null;
  private lang: string = 'en';
  private customerPreferredLanguage: string | null = null;

  // React Native specific properties
  private readonly sdkVersion = package_json.version;
  private readonly os = Platform.OS;
  private readonly userAgent = `GB/react-native/${package_json.version}`;

  private constructor() {}

  /**
   * Get the singleton instance of GameballApp
   * @returns GameballApp instance
   */
  static getInstance(): GameballApp {
    if (!GameballApp.instance) {
      GameballApp.instance = new GameballApp();
    }
    return GameballApp.instance;
  }

  /**
   * Initialize the Gameball SDK with configuration
   * @param config - Gameball configuration object
   * @returns Promise that resolves when initialization is complete
   */
  async init(config: GameballConfig): Promise<void> {
    try {
      this.config = config;
      this.apiKey = config.apiKey;
      this.sessionToken = config.sessionToken || null;
      this.lang = LanguageUtils.normalize(config.lang || 'en');

      // Restore the customer preferred language saved before a relaunch
      this.customerPreferredLanguage = await AsyncStorage.getItem(
        STORAGE_KEYS.CUSTOMER_PREFERRED_LANGUAGE
      ).catch(() => null);

      // In-app messaging shares this configuration; it opens no connection until it is started.
      inAppMessaging.configure({
        apiKey: config.apiKey,
        lang: config.lang,
        apiBaseUrl: config.apiPrefix,
        debug: config.debug,
      });

      // Fetch bot settings
      await this.fetchBotSettings();

      this.isInitialized = true;

      GameballLogger.configure({
        apiKey: this.apiKey,
        baseUrl: this.config?.apiPrefix || API_ENDPOINTS.BASE_URL,
        sdkVersion: this.sdkVersion,
      });

      if (__DEV__) {
        console.log('[GameballApp] SDK initialized successfully', {
          version: this.sdkVersion,
          platform: this.os,
          apiKey: config.apiKey.substring(0, 8) + '...',
        });
      }
    } catch (error) {
      if (__DEV__) {
        console.error('[GameballApp] Initialization failed:', error);
      }
      throw error;
    }
  }

  /**
   * Initialize a customer with Gameball
   * @param request - Customer initialization request
   * @param callback - Optional callback for backward compatibility
   * @param sessionToken - Optional session token for this request.
   *                       If provided, overrides the global sessionToken.
   *                       If not provided (undefined), clears the global sessionToken.
   * @returns Promise with initialization response
   */
  async initializeCustomer(
    request: InitializeCustomerRequest,
    callback?: Callback<InitializeCustomerResponse>,
    sessionToken?: string | null
  ): Promise<InitializeCustomerResponse> {
    let result: InitializeCustomerResponse;
    try {
      this.ensureInitialized();

      // Override or clear sessionToken - always update on every call
      this.sessionToken = sessionToken || null;

      // Validate the request - any validation errors will be caught and trigger callback
      this.validateCustomerRequest(request);

      AsyncStorage.setItem(STORAGE_KEYS.CUSTOMER_ID, request.customerId).catch(
        () => {}
      );

      // Store customer preferred language for widget display
      const preferredLanguage = request.customerAttributes?.preferredLanguage;
      if (preferredLanguage && preferredLanguage.trim() !== '') {
        this.setCustomerPreferredLanguage(
          LanguageUtils.normalize(preferredLanguage)
        );
      }

      // Process the request with internal fields (osType, channel)
      const processedRequest = this.processCustomerAttributes(request);

      const response = await this.makeRequest(
        API_ENDPOINTS.CUSTOMERS,
        processedRequest
      );

      // Extract gameballId from response
      result = {
        gameballId: response.gameballId || response.id || '',
      };

      // Messaging follows the identified customer; changing customer re-syncs their campaigns.
      inAppMessaging.identified(
        request.customerId,
        request.customerAttributes?.preferredLanguage
      );
    } catch (error) {
      callback?.onError?.(
        error instanceof Error
          ? error
          : new Error(ERROR_MESSAGES.INITIALIZATION_FAILED)
      );
      throw error;
    }

    // Outside the try so an exception thrown by onSuccess isn't also reported to onError
    callback?.onSuccess?.(result);
    return result;
  }

  /**
   * Send an event to Gameball
   * @param event - Event data to send
   * @param callback - Optional callback for backward compatibility
   * @param sessionToken - Optional session token for this request.
   *                       If provided, overrides the global sessionToken.
   *                       If not provided (undefined), clears the global sessionToken.
   * @returns Promise with success status
   */
  async sendEvent(
    event: Event,
    callback?: Callback<boolean>,
    sessionToken?: string | null
  ): Promise<boolean> {
    try {
      this.ensureInitialized();

      // Override or clear sessionToken - always update on every call
      this.sessionToken = sessionToken || null;

      // Every event is also a trigger. Evaluated first, so a matching message can display
      // without waiting for the round trip.
      for (const [name, properties] of Object.entries(event.events ?? {})) {
        inAppMessaging.onCustomEvent(name, properties ?? {});
      }

      // Use the event data directly as it now matches the expected structure
      await this.makeRequest(API_ENDPOINTS.EVENTS, event);
    } catch (error) {
      callback?.onError?.(
        error instanceof Error
          ? error
          : new Error(ERROR_MESSAGES.EVENT_SENDING_FAILED)
      );
      throw error;
    }

    // Outside the try so an exception thrown by onSuccess isn't also reported to onError
    callback?.onSuccess?.(true);
    return true;
  }

  /**
   * Handle a tap on a push notification. Call it from the app's own notification handler
   * with the notification's data payload (e.g. `remoteMessage.data` from
   * `onNotificationOpenedApp` / `getInitialNotification`).
   *
   * When the notification is a Gameball one and carries a click token, the tap is reported
   * to Gameball to count the campaign click; the optional callback receives that report's result.
   * @param payload - The notification's data payload
   * @param callback - Optional callback receiving whether the report succeeded
   * @param sessionToken - Optional session token for this request.
   *                       If provided, overrides the global sessionToken.
   *                       If not provided (undefined), clears the global sessionToken.
   * @returns true when the notification is a Gameball one
   */
  handlePushClick(
    payload: Record<string, any> | null | undefined,
    callback?: Callback<boolean>,
    sessionToken?: string | null
  ): boolean {
    if (String(payload?.isGB).toLowerCase() !== 'true') {
      return false;
    }

    const token = payload?.gbClickToken;

    // Override or clear sessionToken - always update on every call
    this.sessionToken = sessionToken || null;

    if (!this.isInitialized) {
      callback?.onError?.(new Error(ERROR_MESSAGES.NOT_INITIALIZED));
      return true;
    }

    if (typeof token !== 'string' || token.trim() === '') {
      return true;
    }

    this.makeRequest(API_ENDPOINTS.PUSH_CLICK, { clickToken: token }).then(
      () => callback?.onSuccess?.(true),
      (error) =>
        callback?.onError?.(
          error instanceof Error
            ? error
            : new Error(ERROR_MESSAGES.PUSH_CLICK_FAILED)
        )
    );
    return true;
  }

  /**
   * Show the Gameball profile widget
   * @param request - Profile display configuration
   * @param sessionToken - Optional session token for this request.
   *                       If provided, overrides the global sessionToken.
   *                       If not provided (undefined), clears the global sessionToken.
   */
  async showProfile(
    request: ShowProfileRequest,
    sessionToken?: string | null
  ): Promise<void> {
    this.ensureInitialized();

    // Override or clear sessionToken - always update on every call
    this.sessionToken = sessionToken || null;

    // Initialize the widget with the SDK configuration
    await GameballWidget.init({
      apiKey: this.apiKey,
      lang: LanguageUtils.resolve(
        this.lang,
        this.customerPreferredLanguage,
        request.lang
      ),
      shop: this.config?.shop,
      platform: this.config?.platform,
      sessionToken: this.sessionToken || undefined,
      widgetUrlPrefix: request.widgetUrlPrefix || API_ENDPOINTS.WIDGET_BASE_URL,
      customerId: request.customerId,
      openDetail: request.openDetail,
      hideNavigation: request.hideNavigation,
      modal: true,
      mainColor: this.mainColor || undefined,
      showCloseButton: request.showCloseButton,
      closeButtonColor: request.closeButtonColor,
      mobile: request.mobile,
      email: request.email,
      externalLinkCallback: request.externalLinkCallback,
      widgetEventCallback: request.widgetEventCallback,
    });

    // Show the mounted <GameballWidget /> with the configuration above
    if (!GameballWidget.showActiveProfile() && __DEV__) {
      console.warn(
        '[GameballApp] showProfile: no <GameballWidget /> is mounted to show'
      );
    }

    // showProfile renders a webview (never hits the backend), so log it here.
    // Full request as-is (the callbacks are functions — JSON.stringify drops them).
    GameballLogger.log('sdk.showProfile', request);
  }

  /**
   * Hide the currently shown profile widget. No-op when nothing is shown.
   * Counterpart to showProfile().
   */
  hideProfile(): void {
    GameballWidget.closeWidget();
  }

  /**
   * Change the SDK's global language without re-calling init(). Affects every showProfile()
   * that doesn't pass its own `lang`. Also becomes the customer's preferred language and is
   * synced to the last initialized customer's profile.
   * @param lang - A supported language code (e.g. 'en', 'ar'). Any other code falls back to 'en'.
   */
  setLanguage(lang: string): void {
    const language = LanguageUtils.normalize(lang);
    this.lang = language;
    // Customer language is read before the global one, so set it too
    this.setCustomerPreferredLanguage(language);
    if (this.config) {
      this.config.lang = language;
    }
    // In-app messaging keeps its own configuration, so it has to be told: without this it would
    // go on asking for campaigns in whichever language init() was given, for the life of the app.
    inAppMessaging.setLanguage(language);

    AsyncStorage.getItem(STORAGE_KEYS.CUSTOMER_ID)
      .then((customerId) => {
        if (!this.isInitialized || !customerId) return;
        // Pass the current session token: initializeCustomer replaces the stored one
        return this.initializeCustomer(
          { customerId, customerAttributes: { preferredLanguage: language } },
          undefined,
          this.sessionToken
        );
      })
      .catch(() => {});
  }

  /**
   * Change the preferred language
   * @deprecated Use setLanguage() instead.
   * @param language - Two-letter language code (e.g., 'en', 'ar')
   */
  changeLanguage(language: string): void {
    if (language.length !== 2) {
      throw new Error(ERROR_MESSAGES.INVALID_LANGUAGE);
    }
    this.setLanguage(language);
  }

  /**
   * Extract referral code from URL
   * @param url - URL containing referral code
   * @returns Referral code or null if not found
   */
  getReferralCode(url: string): string | null {
    try {
      const urlObj = new URL(url);
      return urlObj.searchParams.get('GBReferral');
    } catch {
      // Fallback for malformed URLs
      const match = url.match(/[?&]GBReferral=([^&]*)/);
      return match ? decodeURIComponent(match[1]!) : null;
    }
  }

  // Private helper methods
  private setCustomerPreferredLanguage(language: string): void {
    this.customerPreferredLanguage = language;
    AsyncStorage.setItem(
      STORAGE_KEYS.CUSTOMER_PREFERRED_LANGUAGE,
      language
    ).catch(() => {});
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error(ERROR_MESSAGES.NOT_INITIALIZED);
    }
  }

  private validateCustomerRequest(request: InitializeCustomerRequest): void {
    if (!request.customerId || request.customerId.trim() === '') {
      throw new Error('Customer ID cannot be empty');
    }

    // Validate that device token and push provider are both provided or both null
    const hasDeviceToken =
      request.deviceToken != null && request.deviceToken.trim() !== '';
    const hasPushProvider = request.pushProvider != null;

    if (hasPushProvider && !hasDeviceToken) {
      throw new Error('Device token is required when push provider is set');
    }

    if (!hasPushProvider && hasDeviceToken) {
      throw new Error('Push provider is required when device token is set');
    }
  }

  private processCustomerAttributes(request: InitializeCustomerRequest): any {
    // Create internal request with osType and isGuest
    const internalRequest = {
      ...request,
      osType: this.os, // Always set internally
      isGuest: false, // Hardcoded: the SDK never initializes a customer as a guest
    };

    // If customerAttributes is null/undefined, initialize with default channel
    if (!request.customerAttributes) {
      return {
        ...internalRequest,
        customerAttributes: {
          channel: 'mobile', // Always set internally
        },
      };
    }

    // Extract customAttributes and additionalAttributes from customerAttributes
    const { customAttributes, additionalAttributes, ...standardAttrs } =
      request.customerAttributes;

    // Build the processed customerAttributes object
    const processedCustomerAttributes: any = {
      channel: 'mobile', // Always set internally
      ...standardAttrs,
    };

    // Map customAttributes to 'custom' property
    if (customAttributes) {
      processedCustomerAttributes.custom = customAttributes;
    }

    // If additionalAttributes exist, flatten them at top level
    if (additionalAttributes) {
      Object.assign(processedCustomerAttributes, additionalAttributes);
    }

    return {
      ...internalRequest,
      customerAttributes: processedCustomerAttributes,
    };
  }

  /**
   * Sync campaigns and start showing in-app messages.
   *
   * Awaited: this platform's storage is asynchronous, and the frequency history has to be in
   * memory before the first campaign is judged against it. Mount `<GameballInAppMessages />`
   * once near the root of the app, or nothing has anywhere to draw.
   */
  async startInAppMessaging(
    options: StartInAppMessagingOptions = {}
  ): Promise<void> {
    this.ensureInitialized();
    return inAppMessaging.start(options);
  }

  /**
   * Stops in-app messaging, dismissing anything on screen, sending pending analytics and clearing
   * state. Call on logout. Safe to call when it was never started.
   */
  stopInAppMessaging(): void {
    inAppMessaging.stop();
  }

  get isInAppMessagingStarted(): boolean {
    return inAppMessaging.isStarted;
  }

  /** Hold messages while the app's own modal, drawer or checkout step is open. */
  setOverlayOpen(open: boolean): void {
    inAppMessaging.setOverlayOpen(open);
  }

  /** Observe every selected message. Returns an unsubscribe function. */
  onInAppMessage(listener: (message: InAppMessage) => void): () => void {
    return inAppMessaging.onMessage(listener);
  }

  private async makeRequest(
    endpoint: string,
    data?: any,
    method: 'GET' | 'POST' = 'POST'
  ): Promise<any> {
    const baseUrl = this.config?.apiPrefix || API_ENDPOINTS.BASE_URL;
    let url: string;

    if (endpoint === API_ENDPOINTS.BOT_SETTINGS) {
      url = `${baseUrl}${endpoint}`;
    } else {
      const apiVersion = this.sessionToken
        ? API_ENDPOINTS.API_V4_1
        : API_ENDPOINTS.API_V4_0;
      url = `${baseUrl}${apiVersion}${endpoint}`;
    }

    const headers: GameballSDKHeadersType = {
      'Content-Type': 'application/json',
      'APIKey': this.apiKey,
      'OS': this.os,
      'SDKVersion': this.sdkVersion,
      'X-GB-Agent': this.userAgent,
      'lang': LanguageUtils.resolve(this.lang, this.customerPreferredLanguage),
    };

    if (this.sessionToken) {
      (headers as any)['X-GB-TOKEN'] = this.sessionToken;
    }

    const requestOptions: RequestInit = {
      method,
      headers,
    };

    if (method === 'POST' && data) {
      requestOptions.body = JSON.stringify(data);
    }

    const response = await fetch(url, requestOptions);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // A 2xx is a success even when the body is empty or not JSON (e.g. an accepted event)
    const body = await response.text();
    try {
      return body ? JSON.parse(body) : {};
    } catch {
      return {};
    }
  }

  private async fetchBotSettings(): Promise<void> {
    try {
      const response = await this.makeRequest(
        API_ENDPOINTS.BOT_SETTINGS,
        null,
        'GET'
      );

      if (response && response.response) {
        this.mainColor = response.response.botMainColor.replace('#', '');
      }
    } catch (error) {
      console.error('Error fetching bot settings:', error);
    }
  }
}

// Export singleton instance for convenience
export default GameballApp;
