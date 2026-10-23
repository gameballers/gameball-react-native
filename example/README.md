# Gameball React Native SDK - Example App

This example demonstrates how to integrate and use the Gameball React Native SDK v4.0.0 in a React Native application.

## Features Demonstrated

- 🚀 **SDK Initialization** - Initialize the Gameball SDK with configuration
- 🔒 **Session Token Authentication** - Secure API authentication (v3.1.0+)
- 👤 **Customer Management** - Initialize customers with attributes
- 📊 **Event Tracking** - Track custom events with flexible authentication
- 🎁 **Profile Widget** - Display customer loyalty profiles (authenticated & guest mode)
- 🆕 **Guest Mode** - Show profile widget without customer authentication (v3.1.1+)
- 💬 **In-App Messaging** - Display dashboard campaigns with `startInAppMessaging` on `<GameballInAppMessages />`, observe them with `onInAppMessage` and stop on logout (v4.0.0+)
- 🛒 **Purchase Logging** - Send purchase events with `logPurchase` for purchase-triggered campaigns (v4.0.0+)

## Getting Started

### Prerequisites

- React Native 0.70+
- Node.js 18+
- iOS 15.0+ / Android API 24+ (Android 7.0)
- The SDK's peer dependencies: `@react-native-async-storage/async-storage`, `react-native-device-info`, `react-native-modal`, `react-native-push-notification-popup` and `react-native-webview`
- iOS development: Xcode 12+
- Android development: Android Studio

### Installation

1. **Install dependencies:**
   ```bash
   cd example
   npm install
   # or
   yarn install
   ```

2. **iOS Setup:**
   ```bash
   cd ios
   pod install
   cd ..
   ```

3. **Run the app:**
   ```bash
   # iOS
   npx react-native run-ios

   # Android
   npx react-native run-android
   ```

## Code Overview

### 1. SDK Initialization

```typescript
const gameballApp = GameballApp.getInstance()
const config: GameballConfig = {
  apiKey: "your-api-key",
  lang: "en",
  apiPrefix: "https://api.alpha.gameball.app",
  sessionToken: "your-session-token" // Optional: v3.1.0+ for secure authentication
}
await gameballApp.init(config)
```

### 2. Customer Initialization

```typescript
const customerAttributes: CustomerAttributes = {
  email: "user@example.com",
  customAttributes: {
    "platform": "react-native"
  },
  additionalAttributes: {
    "displayName": "John Doe",
    "mobile": "01000000000",
    "firstName": "John"
  }
}

const customer: InitializeCustomerRequest = {
  customerId: "unique-customer-id",
  customerAttributes: customerAttributes,
}

await gameballApp.initializeCustomer(customer, callback)
```

### 3. Event Tracking

```typescript
const event: Event = {
  customerId: "unique-customer-id",
  events: {
    "demo_event": {
      "action": "button_click",
      "value": 1
    }
  }
}

// Send event with current global session token
await gameballApp.sendEvent(event, eventCallback)

// Or override with specific token (updates global token)
// await gameballApp.sendEvent(event, eventCallback, 'user-token')

// Or send anonymously (clears global token)
// await gameballApp.sendEvent(event, eventCallback, null)
```

### 4. Profile Widget Display

```typescript
// Authenticated mode
await gameballApp.showProfile({
  customerId: "unique-customer-id",
  widgetUrlPrefix: "https://m.gameball.app/alpha",
  closeButtonColor: "#FF0000",
  showCloseButton: false
})

// Guest mode (v3.1.1+) - no customer ID required
await gameballApp.showProfile({
  showCloseButton: true,
  closeButtonColor: "#4CAF50"
})
```

### 5. In-App Messaging (v4.0.0+)

Messages are drawn on `<GameballInAppMessages />`, mounted once above the app's content:

```tsx
<GameballInAppMessages insets={safeAreaInsets} />
```

Messaging starts once the customer is known:

```typescript
gameballApp.startInAppMessaging({
  customerId: "unique-customer-id",
  beforeDisplay: (message) => 'show', // or 'later' / 'discard'
  onAction: (message, button, action) => false, // true if you handled the tap
})

// On logout
// gameballApp.stopInAppMessaging()
```

Campaigns are created in the Gameball dashboard, and in-app messaging must be enabled for your account. In development builds the console shows why each campaign was shown or skipped.

### 6. Purchase Logging (v4.0.0+)

```typescript
gameballApp.logPurchase({
  customerId: "unique-customer-id",
  productId: "sku-001",
  price: 49.99,
  currency: "USD",
})
```

## In-App Messaging Sample

`GameballIAMSample/` is a separate app for exercising in-app messaging on a device. Copy `src/config.local.example.ts` to `src/config.local.ts` (gitignored) and fill in your API key before running it.

## Key Components

### GameballApp Singleton
The main SDK entry point that manages configuration and API calls.

### GameballWidget Component
A React component that displays the customer loyalty profile widget.

### GameballInAppMessages Component
The component in-app messages are drawn on (v4.0.0+).

### TypeScript Interfaces
- `GameballConfig` - SDK configuration
- `InitializeCustomerRequest` - Customer initialization data
- `CustomerAttributes` - Customer profile attributes
- `Event` - Event tracking data
- `Purchase` - Purchase data for `logPurchase` (v4.0.0+)
- `Callback<T>` - Success/error callback pattern

## Configuration

Replace the example API key and configuration with your actual Gameball credentials:

```typescript
const config: GameballConfig = {
  apiKey: "your-actual-api-key", // Replace with your API key
  lang: "en", // or "ar"
  apiPrefix: "your-api-endpoint" // Optional custom endpoint
}
```

## Troubleshooting

### Common Issues

1. **Metro bundler issues:**
   ```bash
   npx react-native start --reset-cache
   ```

2. **iOS build issues:**
   ```bash
   cd ios && pod install --repo-update
   ```

3. **Android build issues:**
   ```bash
   cd android && ./gradlew clean
   ```

## Documentation

For complete documentation, see:
- [Main README](../README.md)
- [Migration Guide](../MIGRATION.md)
- [Changelog](../CHANGELOG.md)

## Support

- 📧 Email: support@gameball.co
- 🐛 Issues: [GitHub Issues](https://github.com/gameballers/gameball-react-native/issues)