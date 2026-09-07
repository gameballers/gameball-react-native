import React, { useEffect, useState } from 'react';
import {
  BackHandler,
  Modal,
  Platform,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import type { MessageButton } from '../models/message';
import type {
  PresentedMessage,
  ReactMessagePresenter,
} from './message-presenter';
import { SlideupView } from './views/SlideupView';
import { ModalView } from './views/ModalView';
import { FullscreenView } from './views/FullscreenView';

export interface GameballInAppMessagesProps {
  /**
   * Safe-area insets, when the app knows them. Without a dependency the SDK cannot read the
   * notch, so it uses the status-bar height on Android and 0 elsewhere. An app that already has
   * `react-native-safe-area-context` should pass its insets and get exact placement.
   */
  insets?: { top?: number; bottom?: number };
}

/**
 * Where in-app messages are drawn.
 *
 * Mount it once, near the root of the app and above the navigator, the way the Flutter SDK is
 * given a navigator key and the native SDKs take their own window. Until it is mounted the
 * service has no surface and holds messages rather than counting impressions nobody could see.
 *
 * Slide-ups render in place so the app underneath stays usable. Modals and full screens render
 * in a `Modal`, which puts them above everything the app draws — including a navigator's own
 * screens — and gives Android's back button somewhere to land.
 */
export function createGameballInAppMessages(presenter: ReactMessagePresenter) {
  return function GameballInAppMessages({
    insets,
  }: GameballInAppMessagesProps) {
    const [current, setCurrent] = useState<PresentedMessage | null>(null);

    useEffect(() => presenter.attach(setCurrent), []);

    const message = current?.message;

    // Android's back button closes a modal or a full screen, and never a slide-up: a banner is
    // not what the customer was trying to leave.
    useEffect(() => {
      if (!message || message.type === 'slideup' || Platform.OS !== 'android') {
        return;
      }
      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          presenter.dismiss();
          return true;
        }
      );
      return () => subscription.remove();
    }, [message]);

    if (!current || !message) {
      return null;
    }

    const topInset =
      insets?.top ??
      (Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0);
    const bottomInset = insets?.bottom ?? 0;

    const press = (button: MessageButton | null) => {
      if (button) {
        current.callbacks.onButtonPressed(button);
      } else {
        current.callbacks.onMessagePressed();
      }
    };
    const dismiss = () => presenter.dismiss();

    if (message.type === 'slideup') {
      return (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <SlideupView
            message={message}
            onShown={current.onShown}
            onPress={press}
            onDismiss={dismiss}
            topInset={topInset}
            bottomInset={bottomInset}
          />
        </View>
      );
    }

    return (
      <Modal
        visible
        transparent
        animationType="none"
        statusBarTranslucent
        // Every orientation, deliberately. A React Native Modal on iOS allows only portrait
        // unless told otherwise, and it imposes that on the whole app: showing a message would
        // rotate the customer's screen out from under them, and a landscape-only campaign would
        // be turned away by the very rotation it asked for. What the app supports is the app's
        // own business, declared in its Info.plist; a message must not narrow it.
        supportedOrientations={[
          'portrait',
          'portrait-upside-down',
          'landscape',
          'landscape-left',
          'landscape-right',
        ]}
        // Android's own back handling closes the Modal without telling the service; the handler
        // above owns that, so this is only the required prop.
        onRequestClose={dismiss}
      >
        {message.type === 'modal' ? (
          <ModalView
            message={message}
            onShown={current.onShown}
            onPress={press}
            onDismiss={dismiss}
            onScrim={dismiss}
          />
        ) : (
          <FullscreenView
            message={message}
            onShown={current.onShown}
            onPress={press}
            onDismiss={dismiss}
            topInset={topInset}
            bottomInset={bottomInset}
          />
        )}
      </Modal>
    );
  };
}
