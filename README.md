# Gameball React Native SDK

[![Version](https://img.shields.io/badge/version-4.0.0-blue.svg)](https://github.com/gameballers/gameball-react-native)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![React Native](https://img.shields.io/badge/React%20Native-0.70%2B-blue.svg)](https://reactnative.dev)
[![npm](https://img.shields.io/npm/v/react-native-gameball.svg)](https://www.npmjs.com/package/react-native-gameball)

Modern React Native SDK for integrating Gameball's customer engagement and loyalty platform with TypeScript-first design and React Native best practices.

## Features

- 🎯 **Customer Management** - Initialize and manage customer profiles
- 📊 **Event Tracking** - Track user actions and behaviors
- 🎁 **Profile Widget** - Display customer loyalty information
- 💬 **In-App Messaging** - Show dashboard-authored campaigns in your app, opt-in and additive
- 🔧 **Modern Architecture** - Built with React Native best practices
- 🛡️ **Type Safety** - Full TypeScript support with comprehensive type definitions
- ⚡ **Promise-based API** - Modern async/await support with optional callbacks
- 📱 **Cross-platform** - iOS and Android support
- 🌐 **Internationalization** - Multi-language support

## Requirements

- **Minimum React Native Version**: 0.70.0
- **Target React Native Version**: Latest
- **TypeScript**: 4.0+
- **Node.js**: 18.0+
- **iOS**: 15.0+
- **Android**: API Level 24+ (Android 7.0)
- **Peer Dependencies**: `@react-native-async-storage/async-storage`, `react-native-device-info`, `react-native-modal`, `react-native-push-notification-popup` and `react-native-webview` are required; `react-native-safe-area-context` is optional (see [Peer Dependencies](#peer-dependencies))

> **Note**: Set your app's Android `minSdkVersion` to 24 or higher and its iOS deployment target
> (`IPHONEOS_DEPLOYMENT_TARGET` and the Podfile `platform :ios`) to 15.0 or higher. As of v4.0.0,
> earlier versions aren't supported.

## Installation

### npm
```bash
npm install react-native-gameball
```

### yarn
```bash
yarn add react-native-gameball
```

### Peer Dependencies
```bash
# Required
npm install @react-native-async-storage/async-storage react-native-device-info react-native-modal react-native-push-notification-popup react-native-webview

# Optional: exact safe-area placement for in-app messages (v4.0.0+)
npm install react-native-safe-area-context
```

## Quick Start

### 1. Initialize the SDK
```typescript
import { GameballApp } from 'react-native-gameball';

// Initialize the SDK
const gameballConfig = {
  apiKey: 'your-api-key',
  lang: 'en', // 'en' or 'ar'
  shop: 'your-shop-id', // optional
  platform: 'your-platform-id' // optional
};

await GameballApp.getInstance().init(gameballConfig);
```

### 2. Initialize Customer
```typescript
import { GameballApp, PushProvider } from 'react-native-gameball';

const customerRequest = {
  customerId: 'unique-customer-id',
  email: 'customer@example.com',
  mobile: '+1234567890',
  customerAttributes: {
    displayName: 'John Doe',
    firstName: 'John',
    lastName: 'Doe',
    customAttributes: {
      'vip_level': 'gold',
      'preferred_store': 'downtown'
    }
  },
  deviceToken: 'firebase-device-token', // optional
  pushProvider: PushProvider.Firebase // optional
};

try {
  const response = await GameballApp.getInstance().initializeCustomer(customerRequest);
  console.log('Customer initialized:', response.gameballId);
} catch (error) {
  console.error('Failed to initialize customer:', error);
}
```

### 3. Track Events
```typescript
import { GameballApp } from 'react-native-gameball';

const event = {
  customerId: 'unique-customer-id',
  events: {
    'purchase_completed': {
      'amount': 99.99,
      'currency': 'USD',
      'item_count': 3
    }
  },
  email: 'customer@example.com', // optional
  mobile: '+1234567890' // optional
};

try {
  await GameballApp.getInstance().sendEvent(event);
  console.log('Event tracked successfully');
} catch (error) {
  console.error('Failed to track event:', error);
}
```

### 4. Show Profile Widget

```typescript
import { GameballApp } from 'react-native-gameball';

// Authenticated mode
const profileRequest = {
  customerId: 'unique-customer-id',
  openDetail: 'achievements', // optional: 'profile', 'achievements', 'rewards'
  hideNavigation: false, // optional
  closeButtonColor: '#FF0000' // optional
};

try {
  await GameballApp.getInstance().showProfile(profileRequest);
} catch (error) {
  console.error('Failed to show profile:', error);
}
```

#### Guest Mode (v3.1.1+)

Display the profile widget without customer authentication:

```typescript
// Guest mode - no customer ID required
const guestRequest = {
  showCloseButton: true,
  closeButtonColor: '#4CAF50'
};

await GameballApp.getInstance().showProfile(guestRequest);
```

## In-App Messaging (v4.0.0+)

Displays campaigns you author in the Gameball dashboard — modals, slideup banners and fullscreen posters — inside your app.

It is **opt-in and additive**. Until you call `startInAppMessaging`, the module makes no requests, starts no timers, draws nothing and stores nothing, so upgrading without calling it changes nothing about how your app behaves.

> In-app messaging needs the `integrations/inapp-messages` endpoints enabled for your account. Where they are not, the SDK records the 404 in its diagnostic log and stays silent.

### Opting in

Messages are drawn on `<GameballInAppMessages />`. Mount it once, near the root of your app and above your navigator:

```tsx
import GameballApp, { GameballInAppMessages } from 'react-native-gameball';

export default function App() {
  return (
    <>
      <NavigationContainer>{/* your app */}</NavigationContainer>
      <GameballInAppMessages />
    </>
  );
}
```

Then start messaging once the customer is known:

```typescript
await GameballApp.getInstance().startInAppMessaging({ customerId: 'customer-123' });
```

`customerId` defaults to the customer passed to the last successful `initializeCustomer`. Awaiting the call is optional; it resolves once the customer's stored message history has loaded and campaigns have synced.

Call `stopInAppMessaging()` on logout. It dismisses anything on screen, sends pending analytics and clears state.

If your app uses `react-native-safe-area-context`, messages are placed clear of the notch and the home indicator. To pass your own insets instead: `<GameballInAppMessages insets={useSafeAreaInsets()} />`.

### What triggers a message

**Session start** — on launch, and again when the app returns to the foreground after more than `sessionTimeoutSeconds` (30 seconds by default).

**Custom events** — a campaign can target an event by name and filter on its metadata:

```typescript
await GameballApp.getInstance().sendEvent({
  customerId: 'customer-123',
  events: { add_to_cart: { productId: 'sku-001' } },
});
```

A campaign on `add_to_cart` can require `productId` to equal `sku-001`, or `price` to be above a number, and so on. A purchase logged through `logPurchase` reaches campaigns as an event named `purchase` whose `productId`, `price`, `currency` and `quantity` are available to filters.

Whether a matching campaign actually appears also depends on its frequency cap, the minimum interval between any two displays, its expiry and its priority — all set in the dashboard.

### Controlling display

```typescript
await GameballApp.getInstance().startInAppMessaging({
  customerId: 'customer-123',

  // Show it, hold it for the next opportunity, or drop it.
  beforeDisplay: (message) => (isCheckingOut ? 'later' : 'show'),

  // Return true if you handled the tap; false lets the SDK act.
  // `button` is null when the message surface itself was tapped.
  onAction: (message, button, action) => false,

  // Route a campaign's navigate action through your navigator.
  onNavigate: (route, args) => navigation.navigate(route, args),
});
```

Messages wait while the Gameball profile widget or another message is open. To hold them while your own modal, drawer or checkout step is up:

```typescript
GameballApp.getInstance().setOverlayOpen(true);
// ... later
GameballApp.getInstance().setOverlayOpen(false);
```

`onInAppMessage` reports every message the SDK selects, whatever happens to it afterwards:

```typescript
const unsubscribe = GameballApp.getInstance().onInAppMessage((message) => {
  console.log('selected', message.id);
});
```

### Personalisation

Campaign text can contain `{token}` placeholders. Just before a message with placeholders is shown, the SDK fetches the customer's current values and fills them in, so a points balance is current at the moment it appears. The fetch waits at most two seconds and its result is cached for a minute. If the values don't arrive in time, the placeholders are removed rather than shown as raw `{braces}`, and the message still appears. Messages with no placeholders skip the fetch entirely.

> Requires `integrations/inapp-messages/variables` to be enabled for your account. Until then, placeholders are removed from the text.

### Analytics

Impressions, clicks and dismissals are reported automatically — no integration required. A button tap is reported as a click carrying that button's id. Events are batched and persisted to device storage, so analytics logged just before the app is killed still arrive on the next launch.

## API Methods

The SDK provides the following public methods:
- `init(config)` - Initialize the SDK with configuration
- `initializeCustomer(request, callback?)` - Register/initialize customer
- `sendEvent(event, callback?)` - Track user events
- `showProfile(request)` - Display profile widget
- `hideProfile()` - Dismiss the profile widget
- `setLanguage(lang)` - Change SDK language at runtime
- `handlePushClick(payload, callback?)` - Report a push notification tap
- `changeLanguage(language)` - Change SDK language (deprecated, use `setLanguage`)
- `getReferralCode(url)` - Extract referral code from URL
- `logPurchase(purchase, callback?, sessionToken?)` - Report a purchase, which in-app messaging campaigns can target and filter on (v4.0.0+)
- `startInAppMessaging(options?)` - Opt in to in-app messaging (v4.0.0+)
- `stopInAppMessaging()` - Stop it and clear state; call on logout (v4.0.0+)
- `isInAppMessagingStarted` - Whether in-app messaging is currently running (v4.0.0+)
- `onInAppMessage(listener)` - Observe every in-app message the SDK selects; returns an unsubscribe function (v4.0.0+)
- `setOverlayOpen(open)` - Hold in-app messages while your own overlay is open (v4.0.0+)

## Advanced Usage

### Language Control (v3.3.1+)

```typescript
const gameballApp = GameballApp.getInstance();

// Change the global language without re-calling init().
// Also synced to the last initialized customer's preferred language.
gameballApp.setLanguage('ar');

// Override the language for one presentation only
await gameballApp.showProfile({ customerId: 'customer-123', lang: 'en' });
```

The widget language resolves in this order: `ShowProfileRequest.lang`, then the customer's `preferredLanguage`, then the global language, then `en`. Unsupported codes fall back to `en`.

### Widget Events and Closing the Widget (v3.3.1+)

```typescript
await gameballApp.showProfile({
  customerId: 'customer-123',
  // Widget events (e.g. game completion) as a { type, metadata } object
  widgetEventCallback: (event, error) => {
    if (error) return console.warn(error);
    console.log(event?.type, event?.metadata);
  },
  // Links leaving the widget; links tagged gbExternalBrowser=true always open in the device browser
  externalLinkCallback: (url) => Linking.openURL(url),
});

// Close the widget from the app
gameballApp.hideProfile();
```

### Push Click Tracking (v3.3.1+)

Call `handlePushClick` from your notification tap handler with the notification's data payload. It returns `true` for Gameball notifications and reports the tap so the campaign click is counted.

```typescript
messaging().onNotificationOpenedApp((remoteMessage) => {
  const isGameball = GameballApp.getInstance().handlePushClick(remoteMessage.data, {
    onError: (error) => console.warn(error),
  });
});
```

### Per-Request Session Token Override (v3.1.0+)

Override or clear the session token for individual API calls:

```typescript
const gameballApp = GameballApp.getInstance();

// Initialize customer with a different session token
await gameballApp.initializeCustomer(
  {
    customerId: 'customer-123',
    email: 'user@example.com'
  },
  undefined,  // callback (optional)
  'user-specific-token'  // Override global token
);

// Send an event without authentication (clear token for this request)
await gameballApp.sendEvent(
  {
    customerId: 'customer-123',
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
    customerId: 'customer-123'
  },
  'session-token'
);
```

**Important Note:** The `sessionToken` parameter **always updates the global session token** when a method is called. If you provide a token, it becomes the new global token. If you don't provide the parameter (undefined), the global token is cleared. Each method call updates the global token, which is then used for subsequent API calls until changed again.

### Customer Attributes
```typescript
const customerAttributes = {
  displayName: 'John Doe',
  firstName: 'John',
  lastName: 'Doe',
  gender: 'M',
  dateOfBirth: '1990-01-01',
  joinDate: '2023-01-01',
  preferredLanguage: 'en',
  customAttributes: {
    'membership_tier': 'gold',
    'favorite_category': 'electronics'
  },
  additionalAttributes: {
    'source': 'mobile_app',
    'campaign_id': 'summer2023'
  }
};
```

### Push Notifications
```typescript
// Firebase setup
import { PushProvider } from 'react-native-gameball';

const request = {
  customerId: 'customer-123',
  deviceToken: 'firebase-device-token',
  pushProvider: PushProvider.Firebase,
  // ... other fields
};

// Huawei setup (for Huawei devices)
const request = {
  customerId: 'customer-123',
  deviceToken: 'huawei-device-token',
  pushProvider: PushProvider.Huawei,
  // ... other fields
};
```

### Error Handling
```typescript
import { GameballApp } from 'react-native-gameball';

try {
  await GameballApp.getInstance().initializeCustomer(request);
} catch (error) {
  if (error.message.includes('Customer ID cannot be empty')) {
    // Handle validation error
  } else if (error.message.includes('HTTP 401')) {
    // Handle authentication error
  } else if (error.message.includes('HTTP 500')) {
    // Handle server error
  } else {
    // Handle general error
  }
}

// Using callbacks (backward compatibility)
GameballApp.getInstance().initializeCustomer(request, {
  onSuccess: (response) => {
    console.log('Success:', response.gameballId);
  },
  onError: (error) => {
    console.error('Error:', error.message);
  }
});
```

## Migration from v3.x

⚠️ **Version 4.0.0 is a major release** that adds in-app messaging. Every v3.x call keeps its signature and behaviour; the breaking change is the raised platform minimums — **iOS 15.0+** (was 12.0) and **Android API 24+** (was API 21). See the [Migration Guide](./MIGRATION.md#migration-guide-v3x--v400) for details.

## Migration from v2.x

⚠️ **Version 3.0.0 contains breaking changes**. See [Migration Guide](./MIGRATION.md) for detailed upgrade instructions.

## Configuration Options

### GameballConfig
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `apiKey` | string | ✅ | Your Gameball API key |
| `lang` | string | ✅ | Language code ('en' or 'ar') |
| `shop` | string | ❌ | Shop identifier |
| `platform` | string | ❌ | Platform identifier |
| `sessionToken` | string | ❌ | Session Token for secure authentication (enables automatic v4.1 endpoint routing) |
| `apiPrefix` | string | ❌ | Custom API base URL |
| `debug` | boolean | ❌ | In-app messaging console logs, prefixed `[GameballIAM]`. Defaults to `__DEV__` (v4.0.0+) |

### InitializeCustomerRequest
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `customerId` | string | ✅ | Unique customer identifier |
| `email` | string | ❌ | Customer email address |
| `mobile` | string | ❌ | Customer phone number |
| `referralCode` | string | ❌ | Referral code from another customer |
| `customerAttributes` | CustomerAttributes | ❌ | Additional customer information |
| `deviceToken` | string | ❌ | Push notification device token |
| `pushProvider` | PushProvider | ❌ | Push notification provider |
| `isGuest` | boolean | ❌ | Deprecated and ignored since v3.3.1: customers are always registered |

**Validation Rules:**
- `customerId` cannot be empty or whitespace
- If `deviceToken` is provided, `pushProvider` must also be specified
- If `pushProvider` is specified, `deviceToken` must also be provided

### ShowProfileRequest
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `customerId` | string | ❌ | Customer identifier (optional since v3.1.1 for guest mode) |
| `showCloseButton` | boolean | ❌ | Show close button in widget |
| `openDetail` | string | ❌ | Widget section to open ('profile', 'achievements', 'rewards') |
| `hideNavigation` | boolean | ❌ | Hide widget navigation |
| `widgetUrlPrefix` | string | ❌ | Custom widget URL prefix |
| `closeButtonColor` | string | ❌ | Close button color (hex code) |
| `mobile` | string | ❌ | Customer phone number |
| `email` | string | ❌ | Customer email address |
| `lang` | string | ❌ | Language for this presentation only (v3.3.1+) |
| `externalLinkCallback` | (url: string) => void | ❌ | Handles links leaving the widget |
| `widgetEventCallback` | (event, error?) => void | ❌ | Receives widget events (v3.3.1+) |

### CustomerAttributes
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `displayName` | string | ❌ | Customer display name |
| `firstName` | string | ❌ | Customer first name |
| `lastName` | string | ❌ | Customer last name |
| `mobile` | string | ❌ | Phone number |
| `email` | string | ❌ | Email address |
| `gender` | string | ❌ | Gender ('M' or 'F') |
| `dateOfBirth` | string | ❌ | Date of birth (YYYY-MM-DD) |
| `joinDate` | string | ❌ | Account creation date (YYYY-MM-DD) |
| `preferredLanguage` | string | ❌ | Preferred language code |
| `customAttributes` | Record<string, string> | ❌ | Custom key-value pairs |
| `additionalAttributes` | Record<string, string> | ❌ | Additional metadata |

### Event
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `customerId` | string | ✅ | Customer identifier |
| `events` | Record<string, Record<string, any>> | ✅ | Event data with nested properties |
| `mobile` | string | ❌ | Customer phone number |
| `email` | string | ❌ | Customer email address |

### StartInAppMessagingOptions
Options for `startInAppMessaging` (v4.0.0+). All are optional.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `customerId` | string | ❌ | Customer the campaigns are fetched for. Defaults to the customer passed to the last successful `initializeCustomer` |
| `beforeDisplay` | (message) => 'show' \| 'later' \| 'discard' | ❌ | Called before each message; shows every message when omitted |
| `onAction` | (message, button, action) => boolean | ❌ | Called on a tap; return `true` if you handled it, `false` to let the SDK act. `button` is null when the message itself was tapped |
| `onNavigate` | (route, args?) => void | ❌ | Called when a campaign navigates. Without it, navigate actions are ignored |
| `onMessage` | (message) => void | ❌ | Called with every message the SDK selects, like `onInAppMessage` |
| `openUrl` | (url, external) => boolean \| Promise<boolean> | ❌ | Opens campaign links yourself, e.g. in an in-app browser. Links open in the system browser when omitted |
| `requestPushPermission` | () => Promise<boolean> | ❌ | Asks for notification permission when a campaign requests it |
| `sessionTimeoutSeconds` | number | ❌ | Time in the background after which returning starts a new session (defaults to 30). Applies when messaging first starts |

**Validation Rules:**
- Ignored, with a debug log, when `init()` hasn't been called or no customer ID is known
- Calling it again for the same customer does nothing; a different `customerId` fetches that customer's campaigns

### GameballInAppMessages
The component in-app messages are drawn on (v4.0.0+). Mount it once, near the root of your app.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `insets` | { top?: number; bottom?: number } | ❌ | Safe-area insets. Read from `react-native-safe-area-context` when installed; otherwise the status-bar height on Android and 0 elsewhere |

### Purchase
Passed to `logPurchase`, which sends a `purchase` event that in-app messaging campaigns can target (v4.0.0+).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `customerId` | string | ✅ | Customer who made the purchase |
| `productId` | string | ✅ | Identifier of the purchased item |
| `price` | number | ✅ | Unit price |
| `currency` | string | ✅ | ISO currency code, e.g. `'USD'` |
| `quantity` | number | ❌ | Number of units (defaults to 1) |
| `properties` | Record<string, any> | ❌ | Extra metadata, also available to campaign filters |

**Example:**
```typescript
await GameballApp.getInstance().logPurchase(
  {
    customerId: 'customer-123',
    productId: 'sku-001',
    price: 49.99,
    currency: 'USD',
    quantity: 2,
  },
  { onSuccess: () => {}, onError: (error) => console.warn(error) }
);
```

## Metro Bundler / Build Configuration

### Metro Configuration
Add to your `metro.config.js`:
```javascript
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const config = {
  resolver: {
    assetExts: ['bin', 'txt', 'jpg', 'png', 'json', 'woff', 'woff2', 'ttf', 'otf'],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
```

### Proguard (Android)
Add to your `android/app/proguard-rules.pro`:
```proguard
-keep class com.gameballsdk.** { *; }
-keepnames class * extends com.gameballsdk.**
-dontwarn com.gameballsdk.**
```

## Troubleshooting

### Common Issues

**1. Widget not displaying**
- Ensure `react-native-webview` is properly installed and linked
- Check that the API key is valid and the customer is initialized
- Verify network connectivity

**2. Build errors on iOS**
- Clean build folder: `cd ios && xcodebuild clean`
- Reinstall pods: `cd ios && pod install --repo-update`

**3. Build errors on Android**
- Clean gradle cache: `cd android && ./gradlew clean`
- Check React Native version compatibility

**4. TypeScript errors**
- Ensure TypeScript version is 4.0+
- Run `npx tsc --noEmit` to check type errors

**5. In-app messages never appear**
- Check that `<GameballInAppMessages />` is mounted
- Check that `startInAppMessaging` runs after `init` with a customer ID, and that in-app messaging is enabled for your account

### Debug Logging

In-app messaging logs why a campaign was shown or skipped, prefixed `[GameballIAM]`. These logs are on in development builds and off in release builds; to turn them on in a release build while reproducing an issue:
```typescript
await GameballApp.getInstance().init({ apiKey: 'your-api-key', lang: 'en', debug: true });
```

## Documentation

- 📋 **[Changelog](./CHANGELOG.md)** - Version history and changes
- 🔄 **[Migration Guide](./MIGRATION.md)** - Upgrade instructions
- 📝 **[Release Notes](./RELEASE_NOTES.md)** - Latest release details

## Support

- 📧 **Email**: support@gameball.co
- 📖 **Documentation**: [https://developer.gameball.co/](https://developer.gameball.co/)
- 🐛 **Issues**: [GitHub Issues](https://github.com/gameballers/gameball-react-native/issues)

## License

MIT License

Copyright (c) 2024 Gameball

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.