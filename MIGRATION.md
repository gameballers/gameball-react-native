# Migration Guide: Gameball React Native SDK

This guide provides migration instructions for upgrading between major versions of the Gameball React Native SDK.

---

## Table of Contents

- [v3.0.0 → v3.1.0](#migration-guide-v300--v310)
- [v2.x → v3.0.0](#migration-guide-v2x--v300)

---

## Migration Guide: v3.0.0 → v3.1.0

Version 3.1.0 introduces security enhancements. This is a **minor update** with no breaking changes.

### Overview of Changes

#### 🔒 What's New
- **Session Token authentication** for enhanced API security
- **Per-request session token override** for flexible authentication control on individual API calls
- **Automatic secure endpoint routing** when session token is provided

### Update Dependencies

Update your dependency to v3.1.0:

```bash
npm install react-native-gameball@^3.1.0
# or
yarn add react-native-gameball@^3.1.0
```

### Optional: Enable Session Token Authentication

If you want to use Session Token authentication, simply add it to your configuration:

```typescript
const gameballConfig = {
  apiKey: 'your-api-key',
  lang: 'en',
  sessionToken: 'your-secure-session-token'  // Optional: Add for secure authentication
};

await GameballApp.getInstance().init(gameballConfig);
```

When session token is provided:
- API requests automatically route to secure v4.1 endpoints
- `X-GB-TOKEN` header is included in authenticated requests
- Enhanced security for customer data

### New: Per-Request Session Token Override

You can now override or clear the session token for individual API calls:

```typescript
const gameballApp = GameballApp.getInstance();

// Override session token for a specific customer initialization
await gameballApp.initializeCustomer(
  {
    customerId: 'customer-123',
    email: 'user@example.com'
  },
  undefined,  // callback (optional)
  'user-specific-token'  // Override global token
);

// Clear session token for a specific event (anonymous tracking)
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

// Show profile with different authentication
await gameballApp.showProfile(
  {
    customerId: 'customer-123'
  },
  'session-token'
);
```

**Important Note:** The `sessionToken` parameter **always updates the global session token** when a method is called. If you provide a token, it becomes the new global token. If you don't provide the parameter (undefined), the global token is cleared. Each method call updates the global token, which is then used for subsequent API calls until changed again.

**Use Cases:**
- Multi-user scenarios where different users need different authentication
- Anonymous actions while maintaining global authentication
- Temporary authentication overrides for specific operations

### Migration Checklist

- [ ] Update package dependency to ^3.1.0
- [ ] Run `npm install` or `yarn install`
- [ ] (Optional) Add `sessionToken` to your GameballConfig if needed
- [ ] Verify all SDK functionality works correctly
- [ ] Test event tracking
- [ ] Test profile widget displays correctly

### Benefits After Migration

After upgrading to v3.1.0, you'll benefit from:

✅ **Optional Enhanced Security**: Session Token authentication when needed

✅ **Per-Request Control**: Override or clear tokens for individual API calls

✅ **Flexible Authentication**: Support multi-user scenarios and anonymous actions

✅ **Automatic Secure Routing**: SDK automatically uses secure endpoints when token is provided

✅ **Backward Compatible**: Existing code continues to work without changes

---

## Migration Guide: v2.x → v3.0.0

This guide helps you migrate from v2.x to v3.0.0 with modern React Native architecture and enhanced TypeScript features.

## Overview of Changes

### 🔧 What's New
- **GameballApp Singleton Pattern** with enhanced React Native integration
- **TypeScript-first API** with comprehensive type definitions and interfaces
- **Promise-based Architecture** for better async/await support with optional callback compatibility
- **Enhanced Developer Experience** with improved error handling and validation

### ⚠️ Breaking Changes
- Migration from individual method calls to centralized `GameballApp.getInstance()` pattern
- New interface-based request models for all SDK operations
- Method signature changes with TypeScript interfaces
- Updated configuration approach with enhanced validation

---

## Step-by-Step Migration

### 1. Update Dependencies

**Before (v2.x):**
```json
{
  "dependencies": {
    "react-native-gameball": "^2.1.3"
  }
}
```

**After (v3.0.0):**
```json
{
  "dependencies": {
    "react-native-gameball": "^3.0.0",
    "react-native-webview": "^13.0.0"
  }
}
```

```bash
npm install react-native-gameball@^3.0.0 react-native-webview
# or
yarn add react-native-gameball@^3.0.0 react-native-webview
```

### 2. SDK Initialization

**Before (v2.x):**
```javascript
import Gameball from 'react-native-gameball';

// Old initialization
Gameball.init({
  apiKey: 'your-api-key',
  lang: 'en',
  shop: 'your-shop',
  platform: 'your-platform'
});
```

**After (v3.0.0):**
```typescript
import { GameballApp } from 'react-native-gameball';

// New singleton pattern with async initialization
const gameballConfig = {
  apiKey: 'your-api-key',
  lang: 'en',
  shop: 'your-shop', // optional
  platform: 'your-platform' // optional
};

await GameballApp.getInstance().init(gameballConfig);
```

### 3. Customer Registration/Initialization

**Before (v2.x):**
```javascript
import Gameball from 'react-native-gameball';

// Old customer registration
Gameball.registerCustomer(
  'customer-123',
  'customer@example.com',
  '+1234567890',
  {
    displayName: 'John Doe',
    firstName: 'John',
    lastName: 'Doe'
  },
  'firebase-token',
  'Firebase',
  (response) => {
    console.log('Success:', response);
  },
  (error) => {
    console.error('Error:', error);
  }
);
```

**After (v3.0.0):**
```typescript
import { GameballApp, PushProvider } from 'react-native-gameball';

// New interface-based approach with TypeScript
const customerRequest = {
  customerId: 'customer-123',
  email: 'customer@example.com',
  mobile: '+1234567890',
  customerAttributes: {
    displayName: 'John Doe',
    firstName: 'John',
    lastName: 'Doe',
    customAttributes: {
      'tier': 'gold',
      'source': 'mobile_app'
    }
  },
  deviceToken: 'firebase-token',
  pushProvider: PushProvider.Firebase
};

// Promise-based (recommended)
try {
  const response = await GameballApp.getInstance().initializeCustomer(customerRequest);
  console.log('Customer initialized:', response.gameballId);
} catch (error) {
  console.error('Failed to initialize customer:', error);
}

// Or with callback (backward compatibility)
GameballApp.getInstance().initializeCustomer(customerRequest, {
  onSuccess: (response) => {
    console.log('Success:', response.gameballId);
  },
  onError: (error) => {
    console.error('Error:', error.message);
  }
});
```

### 4. Customer Attributes

**Before (v2.x):**
```javascript
// Old flat structure
const attributes = {
  displayName: 'John Doe',
  firstName: 'John',
  customAttribute1: 'value1',
  customAttribute2: 'value2'
};
```

**After (v3.0.0):**
```typescript
// New structured approach with TypeScript
const customerAttributes = {
  displayName: 'John Doe',
  firstName: 'John',
  lastName: 'Doe',
  gender: 'M',
  dateOfBirth: '1990-01-01',
  customAttributes: {
    'membership_tier': 'gold',
    'preferred_store': 'downtown'
  },
  additionalAttributes: {
    'utm_source': 'mobile_app',
    'campaign_id': 'summer2023'
  }
};
```

### 5. Event Tracking

**Before (v2.x):**
```javascript
import Gameball from 'react-native-gameball';

// Old event tracking
Gameball.sendEvent(
  'purchase',
  {
    amount: 99.99,
    currency: 'USD'
  },
  'customer-123',
  'customer@example.com',
  '+1234567890',
  (success) => {
    console.log('Event sent:', success);
  },
  (error) => {
    console.error('Event failed:', error);
  }
);
```

**After (v3.0.0):**
```typescript
import { GameballApp } from 'react-native-gameball';

// New structured event with nested data
const event = {
  customerId: 'customer-123',
  events: {
    'purchase_completed': {
      'amount': 99.99,
      'currency': 'USD',
      'item_count': 3,
      'category': 'electronics'
    }
  },
  email: 'customer@example.com', // optional
  mobile: '+1234567890' // optional
};

// Promise-based (recommended)
try {
  await GameballApp.getInstance().sendEvent(event);
  console.log('Event tracked successfully');
} catch (error) {
  console.error('Failed to track event:', error);
}

// Or with callback (backward compatibility)
GameballApp.getInstance().sendEvent(event, {
  onSuccess: (result) => {
    console.log('Event sent:', result);
  },
  onError: (error) => {
    console.error('Event failed:', error);
  }
});
```

### 6. Profile Widget

**Before (v2.x):**
```javascript
import Gameball from 'react-native-gameball';

// Old widget display
Gameball.showWidget('customer-123', {
  openDetail: 'achievements',
  hideNavigation: false
});
```

**After (v3.0.0):**
```typescript
import { GameballApp } from 'react-native-gameball';

// New structured widget request
const profileRequest = {
  customerId: 'customer-123',
  openDetail: 'achievements', // 'profile', 'achievements', 'rewards'
  hideNavigation: false,
  closeButtonColor: '#FF0000' // optional
};

try {
  await GameballApp.getInstance().showProfile(profileRequest);
} catch (error) {
  console.error('Failed to show profile:', error);
}
```

### 7. Push Notifications

**Before (v2.x):**
```javascript
// Old string-based provider
Gameball.registerCustomer(
  // ... other params
  'firebase-token',
  'Firebase', // string
  // ... callbacks
);
```

**After (v3.0.0):**
```typescript
import { GameballApp, PushProvider } from 'react-native-gameball';

// New enum-based provider with type safety
const request = {
  customerId: 'customer-123',
  deviceToken: 'firebase-token',
  pushProvider: PushProvider.Firebase, // or PushProvider.Huawei
  // ... other fields
};

await GameballApp.getInstance().initializeCustomer(request);
```

---

## Common Migration Patterns

### Error Handling Migration
**Before (v2.x):**
```javascript
Gameball.registerCustomer(
  // ... params
  (response) => {
    // Handle success
  },
  (error) => {
    // Handle error - limited error information
  }
);
```

**After (v3.0.0):**
```typescript
try {
  const response = await GameballApp.getInstance().initializeCustomer(request);
  // Handle success
} catch (error) {
  // Enhanced error handling with specific error types
  if (error.message.includes('Customer ID cannot be empty')) {
    // Handle validation error
  } else if (error.message.includes('HTTP 401')) {
    // Handle authentication error
  } else if (error.message.includes('HTTP 500')) {
    // Handle server error
  }
}
```

### Language Management Migration
**Before (v2.x):**
```javascript
// Language was set only during initialization
Gameball.init({
  apiKey: 'your-api-key',
  lang: 'en'
});
```

**After (v3.0.0):**
```typescript
// Language can be changed dynamically
await GameballApp.getInstance().init({ apiKey: 'your-api-key', lang: 'en' });

// Change language at runtime
GameballApp.getInstance().changeLanguage('ar');
```

---

## Migration Checklist

### Pre-Migration
- [ ] Review current SDK usage in your app
- [ ] Identify all SDK method calls that need updating
- [ ] Plan for testing after migration
- [ ] Backup current implementation

### During Migration
- [ ] Update React Native dependency to 3.0.0
- [ ] Install react-native-webview dependency
- [ ] Convert initialization to use `GameballApp.getInstance().init()`
- [ ] Replace `registerCustomer` calls with `initializeCustomer` using interface
- [ ] Update customer attributes to use structured `customerAttributes` object
- [ ] Migrate event tracking to new `Event` interface structure
- [ ] Update profile widget calls to use `ShowProfileRequest` interface
- [ ] Update push notification handling with `PushProvider` enum
- [ ] Convert callback-based code to async/await (recommended)

### Post-Migration
- [ ] Test all SDK functionality
- [ ] Verify error handling works correctly
- [ ] Test push notifications with both Firebase and Huawei
- [ ] Verify profile widget displays correctly
- [ ] Test event tracking with new structure
- [ ] Test language switching functionality
- [ ] Run full integration tests

---

## Troubleshooting

### Common Issues

1. **Build Errors After Update**
   ```
   Error: Unable to resolve module 'react-native-webview'
   ```
   **Solution**: Install the required peer dependency:
   ```bash
   npm install react-native-webview
   # For iOS
   cd ios && pod install
   ```

2. **Type Mismatch Errors**
   ```
   Error: Argument of type 'string' is not assignable to parameter of type 'PushProvider'
   ```
   **Solution**: Update to use the enum:
   ```typescript
   import { PushProvider } from 'react-native-gameball';
   // Use PushProvider.Firebase instead of 'Firebase'
   ```

3. **Missing Required Fields**
   ```
   Error: Customer ID cannot be empty
   ```
   **Solution**: Ensure all required fields are provided in the interface:
   ```typescript
   const request = {
     customerId: 'customer-123', // Required
     // ... other fields
   };
   ```

4. **Initialization Errors**
   ```
   Error: SDK not initialized
   ```
   **Solution**: Ensure async initialization completes before other calls:
   ```typescript
   await GameballApp.getInstance().init(config);
   // Now safe to call other methods
   ```

### Getting Help
- 📧 **Email**: support@gameball.co
- 📖 **Documentation**: [https://docs.gameball.co](https://docs.gameball.co)
- 🐛 **Issues**: [GitHub Issues](https://github.com/gameballers/gameball-react-native/issues)

---

## Benefits After Migration

✅ **Better Type Safety**: Comprehensive TypeScript interfaces prevent runtime errors
✅ **Improved Developer Experience**: Modern async/await API with optional callback support
✅ **Better Error Handling**: Specific error types and enhanced validation messages
✅ **Enhanced Performance**: Optimized internal architecture with singleton pattern
✅ **Future-Proof**: Modern foundation ready for upcoming React Native features
✅ **Consistent API**: Unified design patterns across all SDK methods

---

*For additional help with migration, contact support@gameball.co*