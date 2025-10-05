# Release Notes - Gameball React Native SDK

This file contains detailed release notes for the latest version. For complete version history, see [CHANGELOG.md](./CHANGELOG.md).

---

## Latest Release: v3.1.0

**Release Date**: November 5, 2025
**Version**: 3.1.0
**Type**: Feature Release

---

## 🎉 What's New

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
npm install react-native-gameball@^3.1.0
npm install react-native-webview
```

### yarn
```bash
yarn add react-native-gameball@^3.1.0
yarn add react-native-webview
```

### GitHub
```bash
npm install gameballers/gameball-react-native#release-3.1.0
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

**Ready to upgrade?** Simply update your dependency to v3.1.0. No migration required!

*For technical support, contact us at support@gameball.co*