import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import type { InAppMessage, MessageButton } from '../../models/message';
import { MessageMetrics, ModalMetrics } from '../metrics';
import type { MessageArtwork } from '../presenter';
import { Stage, useReveal } from './reveal';
import {
  CloseGlyph,
  closeColorFor,
  closeInlineEnd,
  Copy,
  MessageActionButton,
} from './shared';

/**
 * A centred card over a dimmed app.
 *
 * Only the copy scrolls. The artwork and the buttons sit outside that scroll view, so a tall
 * poster can never push the call to action below the fold — the failure a single scroll view
 * produces, and the reason the other SDKs draw it this way too.
 */
export function ModalView({
  message,
  artwork,
  onShown,
  onFailed,
  onPress,
  onDismiss,
  onScrim,
}: {
  message: InAppMessage;
  artwork: MessageArtwork;
  onShown: () => void;
  /** The artwork never painted; take the message away having never shown it. */
  onFailed: () => void;
  onPress: (button: MessageButton | null) => void;
  onDismiss: () => void;
  onScrim: () => void;
}) {
  const { height, width } = useWindowDimensions();
  const image = artwork.image;
  const scale = useRef(new Animated.Value(0.96)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const { revealed, onLayout, onImageLoad, onImageError } = useReveal(
    image !== null,
    onShown,
    onFailed
  );
  useEffect(() => {
    if (!revealed) {
      return;
    }
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        bounciness: 2,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [revealed, scale, opacity]);
  const imageOnly = message.layout === 'image_only' && image !== null;
  const cardWidth = Math.min(
    ModalMetrics.maxWidth,
    width - ModalMetrics.margin * 2
  );

  // Two bounds, whichever is smaller: a shape bound, so the crossover is the same on every
  // device, and a reserve for the copy and buttons so a portrait poster cannot crush them.
  const stackedImageCap = Math.min(
    cardWidth / ModalMetrics.minImageRatio,
    height - ModalMetrics.margin * 2 - ModalMetrics.copyReserve
  );

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Outside the stage, on screen from the first frame: the Modal holds every touch from the
          moment it mounts, so the dimmed backdrop is what shows the customer why while the card
          waits for its artwork. */}
      <Pressable
        testID="gb-iam-scrim"
        accessibilityLabel="Close"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor:
              message.style.scrimColor ?? MessageMetrics.defaultScrim,
          },
        ]}
        onPress={() => (message.dismissOnScrimTap ? onScrim() : undefined)}
      />
      <Stage revealed={revealed}>
        <View style={styles.centre} pointerEvents="box-none">
          <Animated.View
            testID="gb-iam-modal"
            accessibilityRole="alert"
            accessibilityViewIsModal
            onLayout={onLayout}
            style={[
              styles.card,
              {
                width: cardWidth,
                maxHeight: height - ModalMetrics.margin * 2,
                backgroundColor:
                  message.style.backgroundColor ??
                  MessageMetrics.defaultSurface,
                opacity,
                transform: [{ scale }],
              },
            ]}
          >
            <Pressable
              disabled={message.clickAction === null}
              onPress={() => onPress(null)}
              testID="gb-iam-surface"
            >
              {image ? (
                <Image
                  testID="gb-iam-image"
                  source={{ uri: image.uri }}
                  style={
                    imageOnly
                      ? {
                          width: '100%',
                          height: height * ModalMetrics.imageOnlyHeightFraction,
                        }
                      : {
                          width: '100%',
                          // Its own shape, capped: the artwork fills the card's width without bars
                          // until the cap takes over, which is the rule the other SDKs draw by. A
                          // React Native Image has no intrinsic size — given only a width it draws
                          // nothing — so the shape is the one measured when the artwork was loaded.
                          aspectRatio: image.width / image.height,
                          maxHeight: stackedImageCap,
                        }
                  }
                  resizeMode={imageOnly ? 'cover' : 'contain'}
                  onLoad={onImageLoad}
                  onError={onImageError}
                />
              ) : null}
            </Pressable>

            {imageOnly ? (
              message.buttons.length > 0 ? (
                <View style={styles.overlayButtons}>
                  {message.buttons.map((button, index) => (
                    <MessageActionButton
                      key={button.id}
                      index={index}
                      button={button}
                      onPress={onPress}
                      fullWidth
                      fontSize={ModalMetrics.buttonFontSize}
                      lineHeight={ModalMetrics.buttonLineHeight}
                      paddingVertical={ModalMetrics.buttonPadding.vertical}
                      paddingHorizontal={ModalMetrics.buttonPadding.horizontal}
                    />
                  ))}
                </View>
              ) : null
            ) : (
              <>
                <ScrollView
                  style={styles.copyScroll}
                  contentContainerStyle={styles.copy}
                >
                  <Copy
                    header={message.header}
                    body={message.body}
                    style={message.style}
                    headerFontSize={ModalMetrics.headerFontSize}
                    headerLineHeight={ModalMetrics.headerLineHeight}
                    bodyFontSize={ModalMetrics.bodyFontSize}
                    bodyLineHeight={ModalMetrics.bodyLineHeight}
                    spacing={ModalMetrics.headerToBodySpacing}
                  />
                </ScrollView>
                {message.buttons.length > 0 ? (
                  <View style={styles.buttons}>
                    {message.buttons.map((button, index) => (
                      <MessageActionButton
                        key={button.id}
                        index={index}
                        button={button}
                        onPress={onPress}
                        fontSize={ModalMetrics.buttonFontSize}
                        lineHeight={ModalMetrics.buttonLineHeight}
                        paddingVertical={ModalMetrics.buttonPadding.vertical}
                        paddingHorizontal={
                          ModalMetrics.buttonPadding.horizontal
                        }
                      />
                    ))}
                  </View>
                ) : null}
              </>
            )}

            {message.showCloseButton ? (
              <CloseGlyph
                accessibilityLabel="Close"
                color={closeColorFor(message.style)}
                onPress={onDismiss}
                style={{
                  top: ModalMetrics.closeInset,
                  ...closeInlineEnd(ModalMetrics.closeInset),
                }}
              />
            ) : null}
          </Animated.View>
        </View>
      </Stage>
    </View>
  );
}

const styles = StyleSheet.create({
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: ModalMetrics.margin,
  },
  card: {
    borderRadius: ModalMetrics.cornerRadius,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.24,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  copyScroll: { flexGrow: 0 },
  copy: {
    paddingTop: ModalMetrics.contentPadding.top,
    paddingHorizontal: ModalMetrics.contentPadding.horizontal,
  },
  buttons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: ModalMetrics.buttonSpacing,
    paddingTop: ModalMetrics.buttonsPadding.top,
    paddingHorizontal: ModalMetrics.buttonsPadding.horizontal,
    paddingBottom: ModalMetrics.buttonsPadding.bottom,
  },
  overlayButtons: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: ModalMetrics.buttonSpacing,
    paddingHorizontal: ModalMetrics.imageOnlyButtonsPadding.horizontal,
    paddingBottom: ModalMetrics.imageOnlyButtonsPadding.bottom,
  },
});
