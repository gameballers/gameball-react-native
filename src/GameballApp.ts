import { Platform } from 'react-native';
import GameballWidget from './GameballWidget';
import type {
  GameballConfig,
  InitializeCustomerRequest,
  InitializeCustomerResponse,
  Event,
  ShowProfileRequest,
  Callback,
  GameballSDKHeadersType,
} from './types/Common';
import { API_ENDPOINTS, ERROR_MESSAGES } from './constants';

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

      // Fetch bot settings
      await this.fetchBotSettings();

      this.isInitialized = true;

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
    try {
      this.ensureInitialized();

      // Override or clear sessionToken - always update on every call
      this.sessionToken = sessionToken || null;

      // Validate the request - any validation errors will be caught and trigger callback
      this.validateCustomerRequest(request);

      // Process the request with internal fields (osType, channel)
      const processedRequest = this.processCustomerAttributes(request);

      const response = await this.makeRequest(API_ENDPOINTS.CUSTOMERS, processedRequest);

      // Extract gameballId from response
      const result: InitializeCustomerResponse = {
        gameballId: response.gameballId || response.id || '',
      };

      // Call callback if provided (backward compatibility)
      callback?.onSuccess?.(result);

      return result;
    } catch (error) {
      callback?.onError?.(
        error instanceof Error
          ? error
          : new Error(ERROR_MESSAGES.INITIALIZATION_FAILED)
      );
      throw error;
    }
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

      // Use the event data directly as it now matches the expected structure
      await this.makeRequest(API_ENDPOINTS.EVENTS, event);

      callback?.onSuccess?.(true);
      return true;
    } catch (error) {
      callback?.onError?.(
        error instanceof Error
          ? error
          : new Error(ERROR_MESSAGES.EVENT_SENDING_FAILED)
      );
      throw error;
    }
  }

  /**
   * Show the Gameball profile widget
   * @param request - Profile display configuration
   * @param sessionToken - Optional session token for this request.
   *                       If provided, overrides the global sessionToken.
   *                       If not provided (undefined), clears the global sessionToken.
   */
  async showProfile(request: ShowProfileRequest, sessionToken?: string | null): Promise<void> {
    this.ensureInitialized();

    // Override or clear sessionToken - always update on every call
    this.sessionToken = sessionToken || null;

    // Initialize the widget with the SDK configuration
    await GameballWidget.init({
      apiKey: this.apiKey,
      lang: this.config?.lang || 'en',
      shop: this.config?.shop,
      platform: this.config?.platform,
      sessionToken: this.sessionToken || undefined,
      widgetUrlPrefix: request.widgetUrlPrefix || API_ENDPOINTS.WIDGET_BASE_URL,
      customerId: request.customerId,
      openDetail: request.openDetail,
      hideNavigation: request.hideNavigation,
      modal: true,
      mainColor: this.mainColor || undefined,
      closeButtonColor: request.closeButtonColor,
    });

    // Create and show widget instance
    const widget = new GameballWidget({});
    widget.showProfile();
  }

  /**
   * Change the preferred language
   * @param language - Two-letter language code (e.g., 'en', 'ar')
   */
  changeLanguage(language: string): void {
    if (language.length !== 2) {
      throw new Error(ERROR_MESSAGES.INVALID_LANGUAGE);
    }

    if (this.config) {
      this.config.lang = language;
    }

    if (__DEV__) {
      console.log(`[GameballApp] Language changed to: ${language}`);
    }
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
    const hasDeviceToken = request.deviceToken != null && request.deviceToken.trim() !== '';
    const hasPushProvider = request.pushProvider != null;

    if (hasPushProvider && !hasDeviceToken) {
      throw new Error('Device token is required when push provider is set');
    }

    if (!hasPushProvider && hasDeviceToken) {
      throw new Error('Push provider is required when device token is set');
    }
  }

  private processCustomerAttributes(request: InitializeCustomerRequest): any {
    // Create internal request with osType and default isGuest
    const internalRequest = {
      ...request,
      osType: this.os,  // Always set internally
      isGuest: request.isGuest ?? false,  // Default to false if not provided
    };

    // If customerAttributes is null/undefined, initialize with default channel
    if (!request.customerAttributes) {
      return {
        ...internalRequest,
        customerAttributes: {
          channel: 'mobile'  // Always set internally
        }
      };
    }

    // Extract customAttributes and additionalAttributes from customerAttributes
    const { customAttributes, additionalAttributes, ...standardAttrs } = request.customerAttributes;

    // Build the processed customerAttributes object
    const processedCustomerAttributes: any = {
      channel: 'mobile', // Always set internally
      ...standardAttrs
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
      customerAttributes: processedCustomerAttributes
    };
  }

  private async makeRequest(endpoint: string, data?: any, method: 'GET' | 'POST' = 'POST'): Promise<any> {
    const baseUrl = this.config?.apiPrefix || API_ENDPOINTS.BASE_URL;
    let url: string;
    
    if (endpoint === API_ENDPOINTS.BOT_SETTINGS) {
      url = `${baseUrl}${endpoint}`;
    } else {
      const apiVersion = this.sessionToken ? API_ENDPOINTS.API_V4_1 : API_ENDPOINTS.API_V4_0;
      url = `${baseUrl}${apiVersion}${endpoint}`;
    }

    const headers: GameballSDKHeadersType = {
      'Content-Type': 'application/json',
      'APIKey': this.apiKey,
      'OS': this.os,
      'SDKVersion': this.sdkVersion,
      'X-GB-Agent': this.userAgent,
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

    return response.json();
  }

  private async fetchBotSettings(): Promise<void> {
    try {
      const response = await this.makeRequest(API_ENDPOINTS.BOT_SETTINGS, null, 'GET');

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
