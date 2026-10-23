# Release Notes - Gameball React Native SDK

This file contains detailed release notes for the latest version. For complete version history, see [CHANGELOG.md](./CHANGELOG.md).

---

## Latest Release: v3.3.1

**Release Date**: October 23, 2026
**Version**: 3.3.1
**Type**: Feature Release

---

## 🎉 What's New

v3.3.1 brings the React Native SDK to parity with the iOS, Android and Flutter 3.3.x SDKs. It includes everything from 3.2.0, 3.3.0 and 3.3.1, which were not published separately for React Native.

### Language Control
- `setLanguage(lang)` changes the SDK language at runtime and syncs it to the customer's preferred language
- `ShowProfileRequest.lang` overrides the language for one presentation
- Unsupported codes fall back to `en`

### Widget Events and Dismissal
- `widgetEventCallback` receives widget events (e.g. game completion) as a `{ type, metadata }` object
- `GameballApp.hideProfile()` closes the widget, and the widget can close itself via `window.GameballWidget.closeWidget()`

### External Links
- Gameball links load inside the widget; other links go to `externalLinkCallback`, or the device browser when none is set
- Links tagged `gbExternalBrowser=true` always open in the device browser

### Push Click Tracking
- `handlePushClick(payload, callback?, sessionToken?)` reports Gameball push notification taps to count campaign clicks

### Customer Contact on showProfile
- Optional `mobile` and `email` on `ShowProfileRequest`

---

## 🚀 Key Features

### Language Control

```typescript
const gameballApp = GameballApp.getInstance();

// Change the global language at runtime (also synced to the customer's profile)
gameballApp.setLanguage('ar');

// Override the language for one presentation only
await gameballApp.showProfile({ customerId: 'customer-123', lang: 'en' });
```

### Widget Events, Links and Dismissal

```typescript
await gameballApp.showProfile({
  customerId: 'customer-123',
  widgetEventCallback: (event, error) => {
    if (error) return console.warn(error);
    console.log(event?.type, event?.metadata);
  },
  externalLinkCallback: (url) => Linking.openURL(url),
});

// Close the widget from the app
gameballApp.hideProfile();
```

### Push Click Tracking

```typescript
messaging().onNotificationOpenedApp((remoteMessage) => {
  const isGameball = GameballApp.getInstance().handlePushClick(remoteMessage.data, {
    onError: (error) => console.warn(error),
  });
});
```

---

## ⚠️ Breaking Changes

**None.** No public API was removed or renamed. See the behaviour changes below and in [MIGRATION.md](./MIGRATION.md).

---

## 🔄 Changes

- `GameballApp.showProfile()` now opens the mounted `<GameballWidget />`
- Successful `sendEvent` / `initializeCustomer` responses with an empty body are no longer reported as failures
- An exception thrown in `onSuccess` is no longer reported to `onError`
- All widget URL values are encoded
- API requests send the resolved `lang` header
- The customer preferred language is kept after an app relaunch
- `hideNavigation: false` is sent to the widget
- `showProfile` honours `showCloseButton: false`
- `sessionToken` and `closeButtonColor` apply to one `showProfile` call; the widget no longer reuses previous values
- The close button follows the widget language
- Customers are always initialized as registered (`isGuest` is deprecated and ignored)
- Telemetry is only sent for `showProfile`
- `changeLanguage` is deprecated in favour of `setLanguage`
- Native dependencies are declared as peer dependencies

---

## Requirements

- React Native 0.70.0+
- TypeScript 4.0+
- Node.js 18.0+
- iOS 12.0+
- Android API 21+

---

## Migration

No breaking API changes. Check the behaviour changes (`showProfile` now opens the widget, `isGuest` ignored, language fallback) in [MIGRATION.md](./MIGRATION.md).

---

## Installation

```bash
npm install react-native-gameball@^3.3.1
# or
yarn add react-native-gameball@^3.3.1
```

---

## Support

- 📧 Email: support@gameball.co
- 📖 Documentation: https://developer.gameball.co/
- 🐛 Issues: https://github.com/gameballers/gameball-react-native/issues

---

## Previous Release: v3.1.2

**Release Date**: April 8, 2026
**Version**: 3.1.2
**Type**: Patch Release

---

### What's New

v3.1.2 fixes a widget loading delay caused by `srcdoc` iframe blocking and replaces the profile widget's modal with a custom animated `Animated` slide-up modal. The widget WebView is rendered lazily on first open and reloads on re-open.

---

## Previous Release: v3.1.1

**Release Date**: December 15, 2025
**Version**: 3.1.1
**Type**: Patch Release

---

### What's New

Gameball React Native SDK v3.1.1 adds **guest mode support** for the profile widget, allowing users to explore loyalty features before signing up.

### 🐛 Fixed
- Guest mode support — profile widget can now be displayed without customer authentication
- `ShowProfileRequest.customerId` is now optional, defaulting to `null` for guest mode

### 🛠️ Developer Experience
- Simpler API — show profile widget without customer ID for guest mode
- Flexible usage — support for preview/showcase scenarios before user registration

---

## Previous Release: v3.1.0

**Release Date**: November 5, 2025
**Version**: 3.1.0
**Type**: Feature Release

---

### What's New

Gameball React Native SDK v3.1.0 introduces **Session Token authentication with per-request override support** for enhanced API security and flexibility. This feature release adds optional token-based authentication with automatic secure endpoint routing, plus the ability to override authentication on a per-request basis.

### 🔒 Security Enhancements

- **Session Token Authentication**: Optional token-based authentication mechanism for secure API communication
- **Per-Request Token Override**: Control authentication on individual API calls for maximum flexibility
- **Automatic Secure Routing**: SDK automatically switches from API v4.0 to v4.1 endpoints when session token is provided
- **Secure Header Transmission**: `X-GB-TOKEN` header added to requests when using session token authentication
- **Backward Compatible**: Existing implementations continue to work without any changes

### 🛠️ Developer Experience

- **Simple Configuration**: Add `sessionToken` to your config object to enable secure authentication globally
- **Flexible Control**: Override session token on individual method calls for granular authentication control
- **Transparent Security**: No code changes required beyond initial configuration
- **Easy Token Management**: Pass `null` to clear session token for specific requests

### 🐛 Bug Fixes

- **Enum Naming**: Updated `PushProvider` enum to follow TypeScript lowerCamelCase convention (`firebase`, `huawei`)

---

## 🚀 Key Features

### Session Token Authentication

Enable secure authentication by adding the `sessionToken` parameter to your SDK configuration:

```typescript
const gameballConfig = {
  apiKey: 'your-api-key',
  lang: 'en',
  sessionToken: 'your-secure-session-token'  // Optional: Enable secure authentication
};

await GameballApp.getInstance().init(gameballConfig);
```

When a session token is provided:
- All API requests automatically route to secure v4.1 endpoints
- `X-GB-TOKEN` header is included in all authenticated requests
- Enhanced security for customer data and API communications

### Per-Request Session Token Override

Override the global session token for individual API calls:

```typescript
const gameballApp = GameballApp.getInstance();

// Initialize customer with a different session token
await gameballApp.initializeCustomer(
  {
    customerId: 'customer123',
    email: 'user@example.com'
  },
  undefined,  // callback (optional)
  'different-token'  // Override global token
);

// Send an event without authentication (clear token for this request)
await gameballApp.sendEvent(
  {
    customerId: 'customer123',
    events: {
      page_view: {
        page: 'home'
      }
    }
  },
  undefined,  // callback (optional)
  null  // Clear token for this request
);

// Show profile with custom token
await gameballApp.showProfile(
  {
    customerId: 'customer123'
  },
  'session-token'
);
```

**Important Note:** The `sessionToken` parameter **always updates the global session token** when a method is called. If you provide a token, it becomes the new global token. If you don't provide the parameter (undefined), the global token is cleared. Each method call updates the global token, which is then used for subsequent API calls until changed again.

### Standard Configuration (Without Token)

```typescript
const gameballConfig = {
  apiKey: 'your-api-key',
  lang: 'en',
  shop: 'your-shop-id',      // optional
  platform: 'your-platform'   // optional
};

await GameballApp.getInstance().init(gameballConfig);
```

---

## ⚠️ Breaking Changes

**None.** This is a backward-compatible feature release. All existing v3.0.0 implementations continue to work without modification.

---

## 📈 What's Changed

### Security Improvements
- **Enhanced API Security**: GB Token authentication adds an additional security layer for sensitive operations
- **Automatic Endpoint Management**: Smart routing to secure endpoints when authentication is enabled
- **Secure Token Storage**: GB tokens are securely managed via instance variables

---

## 🔧 Technical Details

### Requirements
- **Minimum React Native**: 0.70.0
- **TypeScript**: 4.0+
- **Node.js**: 18.0+

### New Configuration Option

#### GameballConfig

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sessionToken` | string | ❌ Optional | GB Token for secure authentication |

### Internal Changes
- Added conditional API version routing logic in `makeRequest()` method
- Header generation now conditionally adds `X-GB-TOKEN` header when token is present
- Automatic API version switching logic (v4.0 → v4.1) based on token presence
- API version constants added (`API_V4_0`, `API_V4_1`)

---

## 🛡️ Security & Reliability

### Authentication Security
- **Optional GB Token**: Adds token-based authentication layer when needed
- **Automatic Secure Routing**: Transparent upgrade to secure v4.1 endpoints
- **Header Security**: Secure transmission of authentication tokens via HTTP headers
- **Token Management**: Secure storage and lifecycle management of GB tokens

---

## 📚 Upgrading from v3.0.0

### No Migration Required

This is a backward-compatible release. Your existing v3.0.0 code will continue to work without any changes.

### To Enable GB Token Authentication (Optional)

Simply add the `sessionToken` parameter to your existing configuration:

```typescript
// Before (v3.0.0) - Still works in v3.1.0
const gameballConfig = {
  apiKey: 'your-api-key',
  lang: 'en'
};

// After (v3.1.0) - With optional GB Token
const gameballConfig = {
  apiKey: 'your-api-key',
  lang: 'en',
  sessionToken: 'your-secure-gb-token'  // Add this line
};
```

### Support
- 📧 **Email**: support@gameball.co
- 📖 **Documentation**: [https://developer.gameball.co/](https://developer.gameball.co/)
- 🐛 **Issues**: [GitHub Issues](https://github.com/gameballers/gameball-react-native/issues)

---

## 🎯 What's Next

### Future Enhancements
- Enhanced analytics capabilities
- Additional security features
- Performance optimizations
- New integration features

### Roadmap
- Version 3.2.0: Enhanced analytics and reporting
- Future versions: Continued improvements and new features

---

## 📦 Installation

### npm
```bash
npm install react-native-gameball@^3.3.1
npm install react-native-webview
```

### yarn
```bash
yarn add react-native-gameball@^3.3.1
yarn add react-native-webview
```

### GitHub
```bash
npm install gameballers/gameball-react-native#release-3.3.1
```

---

## 🏆 Benefits Summary

✅ **Enhanced Security**: Optional GB Token authentication for sensitive operations
✅ **Backward Compatible**: Zero migration effort - existing code continues to work
✅ **Automatic Routing**: Smart endpoint selection based on authentication status
✅ **Simple Configuration**: One-line addition to enable secure authentication
✅ **Flexible**: Use token authentication only when needed
✅ **Transparent**: No code changes beyond initial configuration

---

## ⭐ Acknowledgments

We thank our development community for their feedback on security features.

---

**Ready to upgrade?** Simply update your dependency to v3.3.1. No migration required!

*For technical support, contact us at support@gameball.co*