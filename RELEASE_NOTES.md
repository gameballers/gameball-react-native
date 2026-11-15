# Release Notes - Gameball React Native SDK

This file contains detailed release notes for the latest version. For complete version history, see [CHANGELOG.md](./CHANGELOG.md).

---

## Latest Release: v4.1.0

**Release Date**: 2026-11-19
**Version**: 4.1.0
**Type**: Minor Release

---

## 📱 What's New

v4.1.0 brings **game campaigns** to in-app messaging, shows campaigns when **any of their conditions** match, and reports **influenced opens** of Gameball pushes on Android. There are no breaking changes.

- **Game campaigns**: a spin the wheel, quiz or scratch and win opens itself over your app on its in-app messaging trigger
- **Any of the conditions**: a campaign set to match any of its event conditions shows when one of them matches
- **Influenced opens**: `handlePushReceived(payload, sentTime?)` reports app opens that a push led to without being tapped (Android)
- **Push taps counted once**: `handlePushClick` reports to the new `push-engagement` endpoint, once per tap, even when handed over before `init`
- **Widget host on the configuration**: `GameballConfig.widgetUrlPrefix` for the profile widget and game campaigns

---

## 🚀 Key Features

### 🎡 Game campaigns

A campaign the merchant set to open itself over your app arrives in the same sync as in-app messages and draws on the same surface, so **there is nothing extra to integrate**:

```typescript
await GameballApp.getInstance().startInAppMessaging({ customerId: 'customer-123' });
```

The SDK opens the game itself on `<GameballInAppMessages />` and shows the card only once the game has finished drawing, as a modal or fullscreen, with its own close button. Games follow the in-app message frequency rules — once ever unless repeatable, the campaign's minimum interval, the account-wide cooldown and quiet hours — and a game the customer has finished isn't offered again until the next successful sync. A game opens only from a campaign set this session's sync confirmed, and reports no in-app messaging telemetry.

### 🔀 Any of the conditions

A campaign whose event conditions are joined with "Any" (`OR`) shows when at least one of them matches, for messages and games alike. Such campaigns used to be skipped.

### 📣 Influenced opens

An influenced open is an app open that no tap caused, within 30 minutes of an untapped Gameball push arriving:

```typescript
// index.js, before AppRegistry.registerComponent
messaging().setBackgroundMessageHandler((remoteMessage) =>
  GameballApp.getInstance().handlePushReceived(remoteMessage.data, remoteMessage.sentTime)
);

// In the app
messaging().onMessage((remoteMessage) => {
  GameballApp.getInstance().handlePushReceived(remoteMessage.data, remoteMessage.sentTime);
});
```

`handlePushReceived` needs nothing but AsyncStorage, so it works in the background handler before `init`. Influenced opens are reported on Android only: on iOS, JavaScript doesn't run for alert pushes that arrive in the background. Swipe-aways aren't reported.

### 👆 Push taps counted once

`handlePushClick(payload, callback?)` now reports to `push-engagement`, which replaces `push-click`, and counts a tap once per app run. A tap handed over before `init` is held and reported once `init` is called. Taps and influenced opens stay on v4.0 when a session token is set.

### 🌐 Widget host on the configuration

`GameballConfig.widgetUrlPrefix` sets the widget host once, for the profile widget and every game a message opens. `ShowProfileRequest.widgetUrlPrefix` still overrides it for one presentation.

---

## 🐛 Fixes

- **Turning the phone**: messages and games stay in the safe area on every edge, measured live through `react-native-safe-area-context`; `insets` takes `left` and `right` too
- **Game end dates**: an end date the sync sends without a time zone is read as UTC; it used to be read as device-local time, so games ended early or late by the device's UTC offset

---

## ⚠️ Breaking Changes

None. Every v4.0.0 call keeps its signature and behaviour.

---

## 🔄 Changes

- Added game campaigns to in-app messaging
- Added any-condition (OR) event triggers
- Added `handlePushReceived(payload, sentTime?)` for influenced opens (Android)
- Added `GameballConfig.widgetUrlPrefix`
- Changed push tap reporting to the `push-engagement` endpoint, once per tap
- Fixed safe-area placement when the phone turns, and game end dates sent without a time zone

---

## 🔧 Technical Details

### Requirements

- React Native 0.70.0+
- TypeScript 4.0+
- Node.js 18.0+
- iOS 15.0+
- Android API 24+ (Android 7.0)
- Peer dependencies: `@react-native-async-storage/async-storage`, `react-native-device-info`, `react-native-modal`, `react-native-push-notification-popup` and `react-native-webview` (required); `react-native-safe-area-context` (optional)
- For influenced opens: RNFirebase's `setBackgroundMessageHandler` and `onMessage`

---

## 📚 Migration Support

No code changes are required. To report influenced opens, call `handlePushReceived` from RNFirebase's `setBackgroundMessageHandler` and `onMessage`.

### Migration Resources
- **[Migration Guide](./MIGRATION.md#migration-guide-v40x--v410)**: Step-by-step migration instructions
- **[README](./README.md)**: Complete usage documentation with examples
- **[Changelog](./CHANGELOG.md)**: Detailed list of all changes

### Support

- 📧 Email: support@gameball.co
- 📖 Documentation: https://developer.gameball.co/
- 🐛 Issues: https://github.com/gameballers/gameball-react-native/issues

---

## 📦 Installation

```bash
npm install react-native-gameball@^4.1.0
# or
yarn add react-native-gameball@^4.1.0
```

---

## Previous Release: v4.0.0

**Release Date**: 2026-10-23
**Type**: Major Release

Raised the minimum supported versions to iOS 15.0 and Android API 24 (Android 7.0), and added in-app messaging: modal, slideup and fullscreen campaigns from the Gameball dashboard drawn on `<GameballInAppMessages />`, triggered on session start or by custom events, with `logPurchase(purchase)`, display hooks, `onInAppMessage(listener)` and automatic analytics. See [CHANGELOG.md](./CHANGELOG.md) for the full history.
