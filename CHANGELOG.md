# 📋 Changelog

All notable changes to Gameball React Native SDK are documented here.

---

## [3.3.1] - 2026-10-23 📱

> **Feature Release**: Brings the React Native SDK to parity with the iOS, Android and Flutter 3.3.x SDKs. Includes the 3.2.0, 3.3.0 and 3.3.1 changes, which were not published separately for React Native.

### ✨ Added
- 🎁 **Widget Events**: Added `widgetEventCallback` to `ShowProfileRequest`, which receives widget events (e.g. game completion) as a `{ type, metadata }` object (3.2.0)
- 🎁 **Dismiss the Widget**: Added `GameballApp.hideProfile()`, and the widget can now close itself through `window.GameballWidget.closeWidget()` (3.2.0)
- ⚙️ **External Link Handling**: Added `externalLinkCallback` to `ShowProfileRequest` for links that leave the widget; links tagged `gbExternalBrowser=true` always open in the device browser (3.2.0)
- ⚙️ **Customer Contact on showProfile**: Added optional `mobile` and `email` to `ShowProfileRequest` (3.2.0)
- 🔧 **SDK Telemetry**: Added fire-and-forget reporting of `showProfile` calls to Gameball's mobile logs endpoint (3.2.0)
- ⚙️ **Per-call Language**: Added optional `lang` to `ShowProfileRequest` for a single widget presentation (3.3.0)
- ⚙️ **Global Language**: Added `setLanguage(lang)` to change the SDK language without calling `init()` again (3.3.0)
- 🎁 **Push Click Tracking**: Added `handlePushClick(payload, callback?, sessionToken?)` to report Gameball push notification taps as campaign clicks (3.3.0)

### 🔄 Changed
- 🔧 **Registered Customers Only**: Changed `initializeCustomer` to always send `isGuest: false`; `InitializeCustomerRequest.isGuest` is deprecated and ignored (3.3.1)
- 🔧 **Reduced Telemetry**: Limited diagnostic logs to `showProfile` (3.3.1)
- 🔧 **changeLanguage**: Deprecated `changeLanguage` in favour of `setLanguage`
- 📦 **Peer Dependencies**: Declared `@react-native-async-storage/async-storage`, `react-native-device-info`, `react-native-modal`, `react-native-push-notification-popup` and `react-native-webview` as peer dependencies

### 🐛 Fixed
- 🔧 **In-app Widget Links**: Fixed Gameball links (`gameball.app` and `*.gameball.app`) opening in the external browser instead of inside the widget (3.2.0)
- 🔧 **showProfile**: Fixed `GameballApp.showProfile()` not opening the mounted `<GameballWidget />`
- 🔧 **showCloseButton**: Fixed `showProfile` ignoring `showCloseButton: false`
- 🔧 **closeButtonColor**: Fixed the close button keeping a previous custom color when a later `showProfile` call omits `closeButtonColor`
- 🔧 **setLanguage Priority**: Fixed a stale customer preferred language outranking `setLanguage`; the language is now synced to the last initialized customer's profile (3.3.1)
- 🔧 **Language After Relaunch**: Fixed the customer preferred language (including `setLanguage`) being lost after an app relaunch (3.3.2 on iOS)
- 🔧 **Unsupported Languages**: Fixed unsupported language codes being sent as-is; they now fall back to `en` (3.3.1)
- 🔧 **Close Button Direction**: Fixed the close button following the device locale instead of the widget language (3.3.1)
- 🔧 **Language Header**: Fixed API requests missing the `lang` header sent by the other SDKs
- 🔧 **sendEvent / initializeCustomer**: Fixed successful responses with an empty body being reported as failures, and an exception thrown in `onSuccess` also reaching `onError` (3.3.1)
- 🔧 **Widget URL Encoding**: Fixed widget URL values with special characters (e.g. `+`, `&`) not being encoded (3.3.1)
- 🔧 **hideNavigation**: Fixed `hideNavigation: false` being dropped from the widget URL

### 🔒 Security
- 🛡️ **Widget Session Token**: Fixed the widget reusing a previous `sessionToken` when a later `showProfile` call omits it

---

## [3.1.2] - 2026-04-08 🔧

> **Patch Release**: Fix widget loading delay caused by srcdoc iframe blocking

### 🐛 Fixed
- ⚡ **Widget Loading Delay**: Fixed loading delay caused by `srcdoc` iframe blocking — `about:blank` origin now whitelisted
- 🔄 **Widget Reload**: WebView now reloads on re-open to ensure fresh content

### 🔄 Changed
- 🏗️ **Custom Animated Modal**: Replaced `react-native-modal` in the profile widget with a custom slide-up modal using React Native's `Animated` API
- 🎯 **Lazy WebView Rendering**: Widget WebView is not rendered until first open, improving initial load performance

### 🛠️ Developer Experience
- ⚡ **Faster Widget**: Eliminated iframe-related loading delays for snappier widget presentation

---

## [3.1.1] - 2025-12-15 🔧

> **Patch Release**: Guest mode support for profile widget

### 🐛 Fixed
- 🎁 **Guest Mode Support**: Profile widget can now be displayed without customer authentication
- 🔓 **Optional Customer ID**: `ShowProfileRequest.customerId` is now optional, defaulting to `null` for guest mode

### 🔄 Changed
- 🏗️ **ShowProfileRequest**: No longer requires customer ID - supports guest mode scenarios
- 📝 **Widget URL Construction**: Enhanced to support both authenticated and guest modes

### 🛠️ Developer Experience
- ⚡ **Simpler API**: Show profile widget without customer ID for guest mode
- 🎯 **Flexible Usage**: Support for preview/showcase scenarios before user registration
- 📖 **Better Documentation**: Clear examples for both guest and authenticated modes

---

## [3.1.0] - 2025-11-05 🔒

> **Security Release**: Token-based authentication with per-request override support

### 🔒 Security
- 🛡️ Added Session Token authentication mechanism for secure API communication
- 🔐 Optional `sessionToken` parameter in `GameballConfig` for global token-based authentication
- 🎯 Per-request session token override support for flexible authentication control
- 🔄 Automatic secure endpoint routing (API v4.0 → v4.1) when session token is provided
- 📡 `X-GB-TOKEN` header added to requests when using session token authentication

### ✨ Added
- 🎯 Optional `sessionToken` parameter added to `initializeCustomer()` method
- 🎯 Optional `sessionToken` parameter added to `sendEvent()` method
- 🎯 Optional `sessionToken` parameter added to `showProfile()` method
- 🔄 Per-request token override allows temporary authentication changes without affecting global state
- ♻️ Passing `null` as sessionToken clears the token for that specific request

### 🔧 Internal Changes
- 🔧 Added conditional endpoint routing logic for API version selection
- 📊 Added API version constants (`API_V4_0`, `API_V4_1`) for version management
- 🎨 Session token now stored as instance variable for flexible per-request control

### 🐛 Fixed
- 🔧 Updated `PushProvider` enum to follow TypeScript lowerCamelCase convention (`firebase`, `huawei`)

---

## [3.0.0] - 2025-09-29 🎉

> **Major Release**: Complete SDK modernization with breaking API changes for React Native best practices

### ✨ Added
- 🏗️ **GameballApp Singleton Pattern**: Centralized SDK management with `getInstance()` method
- ⚙️ **Modern TypeScript API**: Full type safety with comprehensive interface definitions
- 🔧 **Promise-based Architecture**: Native async/await support with optional callback backward compatibility
- 🚀 **Enhanced Customer Management**: New `InitializeCustomerRequest` with builder-like object structure
- 📊 **Improved Event Tracking**: Restructured `Event` interface with flexible metadata support
- 🎁 **Advanced Profile Widget**: New `ShowProfileRequest` with comprehensive customization options
- 🌐 **Multi-language Support**: Dynamic language switching with `changeLanguage()` method
- 📱 **Push Notification Integration**: Native Firebase and Huawei push provider support
- 🛡️ **Enhanced Validation**: Comprehensive input validation with proper error messages
- 🔗 **Referral Code Extraction**: Built-in `getReferralCode()` utility for deep link handling
- ⚡ **Platform Detection**: Automatic OS and version detection for better analytics
- 🔧 **Debug Logging**: Development-mode logging for better debugging experience

### 🔄 Changed
- 💥 **BREAKING**: Migrated from individual method calls to singleton `GameballApp` pattern
- 💥 **BREAKING**: All request models now use plain object interfaces instead of builder classes
- 💥 **BREAKING**: Method signatures updated to use TypeScript interfaces with optional callbacks
- 💥 **BREAKING**: Customer attributes structure reorganized with `customAttributes` and `additionalAttributes`
- 💥 **BREAKING**: Event tracking now requires `events` object with nested event data
- 🚀 **Performance**: Optimized internal architecture with reduced memory footprint
- 📦 **Dependencies**: Updated to React Native 0.70+ with modern Metro bundler support
- 🔧 **Error Handling**: Enhanced error messages with specific validation feedback
- 📱 **Widget Integration**: Improved profile widget rendering with better customization options

### 🗑️ Removed
- 💥 **BREAKING**: Removed legacy builder pattern classes in favor of plain interfaces
- 💥 **BREAKING**: Deprecated old initialization methods
- 💥 **BREAKING**: Removed multiple method overloads (replaced with single interface-based methods)
- 🧹 **Cleanup**: Removed unused internal dependencies and legacy code paths

### 🐛 Fixed
- 🔧 **Widget Display**: Fixed profile widget not displaying on certain device configurations
- 🔧 **Memory Management**: Resolved memory leaks in WebView integration
- 🔧 **Type Safety**: Fixed TypeScript compilation issues with strict mode
- 🔧 **Async Handling**: Improved promise rejection handling and error propagation
- 🔧 **Push Notifications**: Fixed device token validation for Firebase and Huawei providers

### 🔒 Security
- 🛡️ **Input Validation**: Enhanced validation prevents invalid API calls and data corruption
- 🛡️ **API Key Management**: Improved API key handling with better security practices
- 🛡️ **Error Sanitization**: Proper error message sanitization to prevent information leakage

---

## [2.1.3] - 2025-06-30 🔧

> **Patch Release**: WebView optimizations and hardware acceleration

### ✨ Added
- 🔧 **WebView Version Control**: Set specific webview version for consistency
- ⚡ **Hardware Acceleration**: Enabled webview android hardware acceleration for better performance

### 🔄 Changed
- 📦 Updated WebView integration for better stability
- 🚀 Improved rendering performance on Android devices

---

## [2.1.2] - 2025-06-04 🔧

> **Patch Release**: RTL/LTR positioning improvements

### 🐛 Fixed
- 🔧 **Widget Positioning**: Handled LTR and RTL positioning of gameball widget's close button
- 📱 **Localization**: Improved widget display for Arabic and other RTL languages
- 🎯 **UI/UX**: Better close button placement based on language direction

### 🔄 Changed
- 🌐 Enhanced internationalization support for RTL languages
- 📦 Updated positioning logic for better cross-language compatibility

---

## [2.1.1] - 2024-01-07 🔧

> **Patch Release**: Repository restructuring and improvements

### 🔄 Changed
- 🏗️ **Repository Structure**: Refactored repository organization
- 📦 **Version Management**: Bumped version with improved release process
- 🔧 **Build Process**: Enhanced build configuration

### 🐛 Fixed
- 🔧 Fixed build and packaging issues
- 📱 Improved module resolution
- 🛡️ Enhanced error handling

---

## [2.1.0] - 2024-01-07 📱

> **Minor Release**: Enhanced initialization and Firebase integration

### ✨ Added
- 🔧 **New Init Parameters**: Added new initialization function parameters for better configuration
- 🔥 **Firebase Integration**: Added Firebase messaging integration for Android push notifications
- 📱 **React Native CLI Example**: Added comprehensive example app with React Native CLI
- 📊 **Notification Data Handling**: Enhanced notification data passing to Notification component

### 🔄 Changed
- 🚀 **Initialization Flow**: Improved SDK initialization with more flexible parameters
- 📦 **Dependencies**: Updated Firebase dependencies for better compatibility
- 🏗️ **Example App**: Refactored example app structure

### 🗑️ Removed
- 🧹 **Firebase Integration Cleanup**: Removed conflicting Firebase integration components for cleaner implementation

### 🐛 Fixed
- 🔧 Fixed notification handling edge cases
- 📱 Improved push notification registration flow
- 🛡️ Enhanced error reporting and debugging capabilities

---

*For migration guides and detailed upgrade instructions, see [MIGRATION.md](./MIGRATION.md)*