/**
 * Constants for Gameball React Native SDK
 */

// API Endpoints
export const API_ENDPOINTS = {
  BASE_URL: 'https://api.gameball.co',
  WIDGET_BASE_URL: 'https://m.gameball.app',
  BOT_SETTINGS: '/api/v1.0/Bots/BotSettings?c=mobile',
  API_V4_0: '/api/v4.0/integrations',
  API_V4_1: '/api/v4.1/integrations',
  INTEGRATIONS: '/api/v4.0/integrations',
  CUSTOMERS: '/customers',
  EVENTS: '/events',
  PUSH_CLICK: '/mobile/push-click',
  MOBILE_LOGS: '/mobile/logs',
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  NOT_INITIALIZED:
    'GameballApp must be initialized before use. Call init() first.',
  INITIALIZATION_FAILED: 'Initialization failed',
  EVENT_SENDING_FAILED: 'Event sending failed',
  PUSH_CLICK_FAILED: 'Push click reporting failed',
  INVALID_LANGUAGE: 'Language must be a two-letter code (e.g., "en", "ar")',
  FETCH_BOT_SETTINGS_FAILED: 'Failed to fetch bot settings. Status:',
} as const;

// WebView Configuration
export const WEBVIEW_CONFIG = {
  ALLOWED_ORIGINS: [
    'https://m.gameball.app*',
    'http://m.gameball.app*',
    'about:*',
    'intent://*',
  ],
} as const;

// Local storage keys
export const STORAGE_KEYS = {
  INSTALL_ID: 'gameball_install_id',
  CUSTOMER_ID: 'gameball_customer_id',
  CUSTOMER_PREFERRED_LANGUAGE: 'gameball_customer_preferred_language',
} as const;

// Default Values
export const DEFAULTS = {
  LANGUAGE: 'en',
  DEVICE_TOKEN: 'TEST',
} as const;
