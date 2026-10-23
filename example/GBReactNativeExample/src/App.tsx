/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, { useEffect, createRef } from 'react';
import { StatusBar, StyleSheet, useColorScheme, View, Button, Text } from 'react-native';
import GameballApp, { Callback, CustomerAttributes, GameballConfig, InitializeCustomerRequest, InitializeCustomerResponse, Event, GameballWidget, GameballInAppMessages } from 'react-native-gameball';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const safeAreaInsets = useSafeAreaInsets();
  const widgetRef = createRef<GameballWidget>();

  useEffect(() => {
    // Check if widget ref is set after component mount
    console.log('Widget ref on mount:', widgetRef.current)

    const initializeGameball = async () => {
      const gameballApp = GameballApp.getInstance()
      const config: GameballConfig = {
        apiKey: "your-api-key-here",
        lang: "en",
        shop: "your-shop-id",
        platform: "your-platform-id",
        // sessionToken: "your-session-token" // Optional: Enable secure authentication (v3.1.0+)
      }
      await gameballApp.init(config)

      const customerAttributes: CustomerAttributes = {
          displayName: "John Doe",
          firstName: "John",
          lastName: "Doe",
          mobile: "+1234567890",
          email: "user@example.com",
          gender: "M",
          dateOfBirth: "1990-01-01",
          joinDate: "2023-01-01",
          preferredLanguage: "en",
          customAttributes: {
            "platform": "react-native",
            "tier": "gold"
          },
          additionalAttributes: {
            "utm_source": "mobile_app",
            "campaign_id": "demo_campaign"
          }
        }

      const customer: InitializeCustomerRequest = {
        customerId: "your-customer-id",
        customerAttributes: customerAttributes,
      }

      const callback: Callback<InitializeCustomerResponse> = {
        onSuccess: (res) => {
          console.log('Customer initialized successfully:', res)

          // In-app messaging (v4.0.0+) - display campaigns authored in the Gameball dashboard.
          // Messages wait while the profile widget is open and appear once it closes.
          // Console logs explaining why each campaign was shown or skipped are on in development builds.
          gameballApp.startInAppMessaging({
            customerId: "your-customer-id",
            // Optional: 'show', 'later' (postpone) or 'discard' each message
            beforeDisplay: (message) => 'show',
            // Optional: return true to handle a tap yourself, false to let the SDK act
            onAction: (message, button, action) => false,
            // Optional: route a campaign's navigate action through your navigator
            // onNavigate: (route, args) => navigation.navigate(route, args),
          })
          // On logout - dismisses any message, sends pending analytics and clears state:
          // gameballApp.stopInAppMessaging()

          // Purchase logging (v4.0.0+) - purchase-triggered campaigns can filter on these fields
          gameballApp.logPurchase(
            {
              customerId: "your-customer-id",
              productId: "sku-001",
              price: 49.99,
              currency: "USD",
              quantity: 1,
            },
            {
              onSuccess: () => console.log('Purchase logged'),
              onError: (error) => console.log('Purchase logging error:', error),
            }
          )

          // Mark widget as ready after customer initialization
          const event: Event = {
            customerId: "your-customer-id",
            events: {
              "demo_event": {
                "action": "button_click",
                "value": 1
              }
            }
          }

        const eventCallback: Callback<boolean> = {
          onSuccess: async (res) => {
            console.log("event sent")
            // Authenticated mode
            await gameballApp.showProfile({
                customerId: "your-customer-id",
                closeButtonColor: "#FF0000",
                showCloseButton: false,
                openDetail: "achievements",
                hideNavigation: false
              })

            // Guest mode example (v3.1.1+) - no customer ID required
            // await gameballApp.showProfile({
            //     showCloseButton: true,
            //     closeButtonColor: "#4CAF50"
            //   })
          }
        }

          // Example 1: Send event with current global session token
          gameballApp.sendEvent(event, eventCallback)

          // Example 2: Send event with specific session token (updates global token)
          // gameballApp.sendEvent(event, eventCallback, 'session-token')

          // Example 3: Send anonymous event (clears global token)
          // gameballApp.sendEvent(event, eventCallback, null)

          // Note: sessionToken parameter always updates the global token
        },
        onError: (error) => {
          console.log('Customer initialization failed:', error)
        }
      }

      // Example 1: Initialize customer with default global session token (if set in config)
      await gameballApp.initializeCustomer(customer, callback)

      // Example 2: Initialize customer with specific session token (updates global token)
      // await gameballApp.initializeCustomer(customer, callback, 'user-specific-token')

      // Example 3: Initialize customer without authentication (clears global token)
      // await gameballApp.initializeCustomer(customer, callback, null)

      // Note: The sessionToken parameter always updates the global token.
      // If you provide a token, it becomes the new global token.
      // If you don't provide it (undefined), the global token is cleared.
    }

    initializeGameball()

    // In-app messaging (v4.0.0+): observe every message the SDK selects.
    // Safe to subscribe before startInAppMessaging is called.
    const stopObserving = GameballApp.getInstance().onInAppMessage((message) => {
      console.log(`In-app message selected: ${message.id} (${message.type})`)
    })
    return stopObserving
  }, []) // Empty dependency array means this runs only once

  return (
    <View style={[styles.container, { paddingTop: safeAreaInsets.top + 20 }]}>
      <Button
        title="Show Profile"
        onPress={async () => {
          if (true) {
            try {
              widgetRef.current?.showProfile()
            } catch (error) {
              console.log('Error showing profile:', error)
            }
          } else {
            console.log('Gameball not ready yet')
          }
        }}
      />
      <GameballWidget
        modal={true}
        ref={widgetRef}
      />
      {/* In-app messaging (v4.0.0+): where messages are drawn. Mount it once, above your content. */}
      <GameballInAppMessages insets={safeAreaInsets} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 20,
    paddingHorizontal: 16,
  },
});

export default App;
