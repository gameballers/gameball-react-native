import React from 'react';
import {
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import GameballApp, { GameballInAppMessages } from 'react-native-gameball';
import { QaPanel } from './src/QaPanel';
import { config } from './src/config';
// Imported for its side effect: the SDK is configured as this module loads.
import './src/gameball';

export default function App() {
  const send = (name: string, properties: Record<string, unknown>) =>
    GameballApp.getInstance()
      .sendEvent({ customerId: config?.customerId ?? '', events: { [name]: properties } })
      .catch(() => {});

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.shop}>
        <Text style={styles.title}>Smart Shopper</Text>
        <Text style={styles.price}>Running shoes · EGP 1,200</Text>
        <View style={styles.shopRow}>
          <Pressable
            testID="shop-add-to-cart"
            style={styles.shopButton}
            onPress={() => send('add_to_cart', { price: 1200, category: 'shoes' })}
          >
            <Text style={styles.shopButtonText}>Add to cart</Text>
          </Pressable>
          <Pressable
            testID="shop-view-product"
            style={styles.shopButton}
            onPress={() => send('view_product_page', { productId: 'backpack' })}
          >
            <Text style={styles.shopButtonText}>View product</Text>
          </Pressable>
        </View>
      </View>

      <QaPanel />

      {/* Mounted once, above everything: this is where in-app messages are drawn. */}
      <GameballInAppMessages />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f7f7f5' },
  shop: { padding: 16 },
  title: { fontSize: 22, fontWeight: '700', color: '#1b1f27' },
  price: { fontSize: 15, color: '#57546a', marginTop: 4 },
  shopRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  shopButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e3e1da',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  shopButtonText: { fontSize: 14, color: '#1b1f27', fontWeight: '600' },
});
