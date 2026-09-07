import React, { useRef } from 'react';
import {
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import type { InAppMessage, MessageButton } from '../../models/message';
import { FullscreenMetrics, MessageMetrics } from '../metrics';
import { CloseGlyph, closeColorFor, Copy, MessageActionButton } from './shared';

/**
 * Edge to edge, covering the app.
 *
 * The artwork takes a fixed half of the safe area rather than whatever the copy leaves: an image
 * sized by subtraction lands on whatever ratio is left over and letterboxes when that does not
 * match the artwork. The copy takes the remainder and scrolls inside it, so the buttons — which
 * sit outside that scroll view — can never be pushed off.
 *
 * There is no swipe to dismiss. The surface fills the screen, so a downward drag has no edge to
 * travel to and would fight the copy's own scrolling.
 */
export function FullscreenView({
  message,
  onShown,
  onPress,
  onDismiss,
  topInset,
  bottomInset,
}: {
  message: InAppMessage;
  onShown: () => void;
  onPress: (button: MessageButton | null) => void;
  onDismiss: () => void;
  topInset: number;
  bottomInset: number;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const imageOnly =
    message.layout === 'image_only' && message.imageUrl !== null;

  return (
    <Animated.View
      testID="gb-iam-fullscreen"
      accessibilityRole="alert"
      accessibilityViewIsModal
      onLayout={() => {
        onShown();
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }}
      style={[
        StyleSheet.absoluteFill,
        {
          opacity,
          paddingTop: imageOnly ? 0 : topInset,
          paddingBottom: imageOnly ? 0 : bottomInset,
          backgroundColor:
            message.style.backgroundColor ?? MessageMetrics.defaultSurface,
        },
      ]}
    >
      <Pressable
        disabled={message.clickAction === null}
        onPress={() => onPress(null)}
        style={StyleSheet.absoluteFill}
        testID="gb-iam-surface"
      >
        {message.imageUrl ? (
          <Image
            testID="gb-iam-image"
            source={{ uri: message.imageUrl }}
            style={
              imageOnly
                ? styles.fill
                : { width: '100%', flexBasis: '50%', flexGrow: 0 }
            }
            resizeMode="cover"
          />
        ) : null}
      </Pressable>

      {imageOnly ? null : (
        <View style={styles.stack} pointerEvents="box-none">
          {message.imageUrl ? <View style={styles.imageSpacer} /> : null}
          <ScrollView contentContainerStyle={styles.copy}>
            <Copy
              header={message.header}
              body={message.body}
              style={message.style}
              headerFontSize={FullscreenMetrics.headerFontSize}
              headerLineHeight={FullscreenMetrics.headerLineHeight}
              bodyFontSize={FullscreenMetrics.bodyFontSize}
              bodyLineHeight={FullscreenMetrics.bodyLineHeight}
              spacing={FullscreenMetrics.headerToBodySpacing}
            />
          </ScrollView>
        </View>
      )}

      {message.buttons.length > 0 ? (
        <View
          style={[
            styles.buttons,
            imageOnly
              ? {
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  paddingHorizontal:
                    FullscreenMetrics.imageOnlyButtonsPadding.horizontal,
                  paddingBottom:
                    FullscreenMetrics.imageOnlyButtonsPadding.bottom +
                    bottomInset,
                  paddingTop: 0,
                }
              : null,
          ]}
        >
          {message.buttons.map((button, index) => (
            <MessageActionButton
              key={button.id}
              index={index}
              button={button}
              onPress={onPress}
              fullWidth
              fontSize={FullscreenMetrics.buttonFontSize}
              lineHeight={FullscreenMetrics.buttonLineHeight}
              paddingVertical={FullscreenMetrics.buttonPaddingVertical}
              paddingHorizontal={0}
            />
          ))}
        </View>
      ) : null}

      {message.showCloseButton ? (
        <CloseGlyph
          accessibilityLabel="Close"
          color={closeColorFor(message.style)}
          onPress={onDismiss}
          style={{
            top: FullscreenMetrics.closeInset + topInset,
            right: FullscreenMetrics.closeInset,
          }}
        />
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  /** Spelled out rather than StyleSheet.absoluteFillObject, which newer React Native types drop. */
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  stack: { flex: 1 },
  /** Holds the space the artwork occupies behind it, so the copy starts below the image. */
  imageSpacer: { flexBasis: '50%', flexGrow: 0 },
  copy: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingTop: FullscreenMetrics.contentPadding.top,
    paddingHorizontal: FullscreenMetrics.contentPadding.horizontal,
  },
  buttons: {
    gap: FullscreenMetrics.buttonSpacing,
    paddingTop: FullscreenMetrics.buttonsPadding.top,
    paddingHorizontal: FullscreenMetrics.buttonsPadding.horizontal,
    paddingBottom: FullscreenMetrics.buttonsPadding.bottom,
  },
});
