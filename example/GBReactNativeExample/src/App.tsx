/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, { useEffect, createRef } from 'react';
import { StatusBar, StyleSheet, useColorScheme, View, Button, Text } from 'react-native';
import GameballApp, { Callback, CustomerAttributes, GameballConfig, InitializeCustomerRequest, InitializeCustomerResponse, Event, GameballWidget } from 'react-native-gameball';
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
            await gameballApp.showProfile({
                customerId: "your-customer-id",
                closeButtonColor: "#FF0000",
                showCloseButton: false,
                openDetail: "achievements",
                hideNavigation: false
              })
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
