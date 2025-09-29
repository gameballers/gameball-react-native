# Gameball React Native SDK

[![Version](https://img.shields.io/badge/version-3.0.0-blue.svg)](https://github.com/gameballers/gameball-react-native)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![React Native](https://img.shields.io/badge/React%20Native-0.70%2B-blue.svg)](https://reactnative.dev)
[![npm](https://img.shields.io/npm/v/react-native-gameball.svg)](https://www.npmjs.com/package/react-native-gameball)

Modern React Native SDK for integrating Gameball's customer engagement and loyalty platform with TypeScript-first design and React Native best practices.

## Features

- 🎯 **Customer Management** - Initialize and manage customer profiles
- 📊 **Event Tracking** - Track user actions and behaviors
- 🎁 **Profile Widget** - Display customer loyalty information
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
- **iOS**: 12.0+
- **Android**: API Level 21+

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
# React Native WebView (required for profile widget)
npm install react-native-webview

# AsyncStorage (optional, for enhanced functionality)
npm install @react-native-async-storage/async-storage
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

## API Methods

The SDK provides the following public methods:
- `init(config)` - Initialize the SDK with configuration
- `initializeCustomer(request, callback?)` - Register/initialize customer
- `sendEvent(event, callback?)` - Track user events
- `showProfile(request)` - Display profile widget
- `changeLanguage(language)` - Change SDK language
- `getReferralCode(url)` - Extract referral code from URL

## Advanced Usage

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
| `apiPrefix` | string | ❌ | Custom API base URL |

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
| `isGuest` | boolean | ❌ | Whether customer is a guest user |

**Validation Rules:**
- `customerId` cannot be empty or whitespace
- If `deviceToken` is provided, `pushProvider` must also be specified
- If `pushProvider` is specified, `deviceToken` must also be provided

### ShowProfileRequest
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `customerId` | string | ✅ | Customer identifier |
| `showCloseButton` | boolean | ❌ | Show close button in widget |
| `openDetail` | string | ❌ | Widget section to open ('profile', 'achievements', 'rewards') |
| `hideNavigation` | boolean | ❌ | Hide widget navigation |
| `widgetUrlPrefix` | string | ❌ | Custom widget URL prefix |
| `closeButtonColor` | string | ❌ | Close button color (hex code) |

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

## Documentation

- 📋 **[Changelog](./CHANGELOG.md)** - Version history and changes
- 🔄 **[Migration Guide](./MIGRATION.md)** - Upgrade from v2.x to v3.x
- 📝 **[Release Notes](./RELEASE_NOTES.md)** - Latest release details

## Support

- 📧 **Email**: support@gameball.co
- 📖 **Documentation**: [https://docs.gameball.co](https://docs.gameball.co)
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