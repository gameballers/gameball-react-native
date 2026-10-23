# Release Notes - Gameball React Native SDK

This file contains detailed release notes for the latest version. For complete version history, see [CHANGELOG.md](./CHANGELOG.md).

---

## Latest Release: v4.0.0

**Release Date**: October 23, 2026
**Version**: 4.0.0
**Type**: Major Release

---

## 🎉 What's New

v4.0.0 raises the minimum supported platform versions to **iOS 15.0** and **Android API 24 (Android 7.0)**, and adds **in-app messaging**: campaigns authored in the Gameball dashboard, displayed inside your app. In-app messaging is opt-in — until you call `startInAppMessaging` it makes no requests, starts no timers, stores nothing and draws nothing.

- **In-app messaging**: modal, slideup and fullscreen campaigns from the Gameball dashboard, drawn on `<GameballInAppMessages />`
- **Triggers**: session start, and custom events filtered on their metadata
- **Purchase logging**: `logPurchase(purchase)` for purchase-triggered campaigns
- **Hooks**: `beforeDisplay`, `onAction`, `onNavigate`, `openUrl`, `requestPushPermission` and `onInAppMessage(listener)` to control display, taps and navigation
- **Raised minimums**: iOS 15.0+ and Android API 24+ (Android 7.0)

---

## 🚀 Key Features

### 💬 Opting in

```tsx
import GameballApp, { GameballInAppMessages } from 'react-native-gameball';

// Once, near the root of the app and above your navigator
<GameballInAppMessages />

const gameballApp = GameballApp.getInstance();
await gameballApp.init({ apiKey: 'your-api-key', lang: 'en' });
await gameballApp.initializeCustomer({ customerId: 'customer-123' });
await gameballApp.startInAppMessaging({ customerId: 'customer-123' });

// On logout
gameballApp.stopInAppMessaging();
```

Starting for a different customer refetches campaigns and resets frequency caps, so you don't need to stop first.

### 🖼️ Message types

**Modal** — a card over a dimmed background, with up to two buttons.

**Slideup** — a banner at the top or bottom edge. It doesn't block the app, carries no buttons (the banner itself is the tap target), and is dismissed by swiping toward its own edge.

**Fullscreen** — edge to edge. A fullscreen campaign can insist on portrait or landscape, and waits until the device is turned that way.

### 🎯 Triggers

**Session start** fires on launch, and again when the app returns to the foreground after more than the session timeout (30 seconds by default; set it with `sessionTimeoutSeconds`).

**Custom events** match on the event name and, optionally, on the event's metadata. Events you already send through `sendEvent` reach the trigger engine automatically:

```typescript
await gameballApp.sendEvent({
  customerId: 'customer-123',
  events: { place_order: { total: 250 } },
});
```

### 🛒 Purchase logging

```typescript
await gameballApp.logPurchase({
  customerId: 'customer-123',
  productId: 'sku-42',
  price: 250,
  currency: 'USD',
});
```

`logPurchase` sends a `purchase` event to Gameball with `productId`, `price`, `currency` and `quantity` as metadata, whether or not in-app messaging has started, so purchase-triggered campaigns can filter on them.

### 🚦 What controls whether a message shows

A backend-controlled minimum interval between any two messages, per-campaign repeat rules that persist across restarts, campaign expiry and priority, and quiet hours. A message that can't be shown yet — because the Gameball profile widget, another message or one of your own overlays is open — waits and shows as soon as it can.

### 🖐️ Hooks

```typescript
await gameballApp.startInAppMessaging({
  customerId: 'customer-123',
  // Postpone during checkout rather than interrupting it.
  beforeDisplay: (message) => (checkoutInProgress ? 'later' : 'show'),
  // Return true if you handled the tap yourself.
  onAction: (message, button, action) => false,
  // Route a campaign's navigate action through your own navigator.
  onNavigate: (route, args) => navigation.navigate(route, args),
});

// See every message the SDK selects.
const unsubscribe = gameballApp.onInAppMessage((message) =>
  analytics.log('gb_message_selected', message.campaignId)
);

// Hold messages while your own modal is up.
gameballApp.setOverlayOpen(true);
```

Every hook is optional and individually guarded: if one throws, the SDK falls back to its own handling and the message still shows. A tap is reported to Gameball whatever `onAction` returns.

### 📊 Analytics and personalisation

Impressions, clicks and dismissals are reported automatically, batched and kept on the device until sent. Campaign text can contain `{token}` placeholders, filled with the customer's current values just before display (waiting at most two seconds). If the values don't arrive, the placeholders are removed rather than shown as raw `{braces}`, and the message still shows.

### 🔍 Diagnostics

```typescript
await gameballApp.init({ apiKey: 'your-api-key', lang: 'en', debug: true });
```

In-app messaging logs to the console with the prefix `[GameballIAM]`: on in development builds, off in release builds. Turn it on in a release build only to reproduce a reported problem.

### ⚠️ Availability

In-app messaging needs the in-app messaging endpoints enabled for your account. Where they aren't, the SDK logs the error in development builds and stays silent — nothing surfaces to your app.

---

## ⚠️ Breaking Changes

**This is a major release.** Apps that support iOS versions below 15.0 or Android versions below API 24 must raise their minimums before upgrading.

- **iOS**: minimum raised from 12.0 to **15.0**
- **Android**: minimum raised from API 21 (Android 5.0) to **API 24 (Android 7.0)**

There are no changes to the public API — every v3.x call keeps its signature and behaviour.

---

## 🔄 Changes

- Raised the minimum supported versions to iOS 15.0 and Android API 24 (Android 7.0)
- Added in-app messaging: `startInAppMessaging(options?)`, `stopInAppMessaging()`, `isInAppMessagingStarted` and `<GameballInAppMessages />`
- Added modal, slideup and fullscreen messages, triggered on session start or by custom events with metadata filters
- Added `logPurchase(purchase, callback?, sessionToken?)` to send purchase events that campaigns can target
- Added `beforeDisplay`, `onAction`, `onNavigate`, `openUrl` and `requestPushPermission` hooks, `onInAppMessage(listener)` and `setOverlayOpen(open)`
- Added automatic impression, click and dismissal analytics, kept on the device until sent
- Added `debug` to `GameballConfig` to control in-app messaging console output
- Added `react-native-safe-area-context` as an optional peer dependency

---

## Requirements

- React Native 0.70.0+
- TypeScript 4.0+
- Node.js 18.0+
- iOS 15.0+
- Android API 24+ (Android 7.0)
- Peer dependencies: `@react-native-async-storage/async-storage`, `react-native-device-info`, `react-native-modal`, `react-native-push-notification-popup` and `react-native-webview` (required); `react-native-safe-area-context` (optional)

---

## Migration

Raise your app's iOS deployment target to 15.0 and Android `minSdkVersion` to 24. No code changes are required — all v3.x calls work without modification. In-app messaging is opt-in; to adopt it, mount `<GameballInAppMessages />`, call `startInAppMessaging` once the customer is known and `stopInAppMessaging()` on logout. See [MIGRATION.md](./MIGRATION.md#migration-guide-v3x--v400).

---

## Installation

```bash
npm install react-native-gameball@^4.0.0
# or
yarn add react-native-gameball@^4.0.0
```

---

## Support

- 📧 Email: support@gameball.co
- 📖 Documentation: https://developer.gameball.co/
- 🐛 Issues: https://github.com/gameballers/gameball-react-native/issues

---

## Previous Release: v3.3.1

**Release Date**: October 23, 2026
**Version**: 3.3.1
**Type**: Feature Release

Brought the React Native SDK to parity with the other Gameball 3.3.x SDKs: `setLanguage(lang)` and per-call `lang`, `widgetEventCallback`, `hideProfile()`, `externalLinkCallback`, `handlePushClick(...)`, and `mobile` / `email` on `ShowProfileRequest`, plus fixes to `showProfile`, language handling and URL encoding. See [CHANGELOG.md](./CHANGELOG.md) for the full list.

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