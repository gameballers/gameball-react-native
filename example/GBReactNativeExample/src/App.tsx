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
        platform: "your-platform-id"
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

          gameballApp.sendEvent(event, eventCallback)
        },
        onError: (error) => {
          console.log('Customer initialization failed:', error)
        }
      }

      await gameballApp.initializeCustomer(customer, callback)
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
