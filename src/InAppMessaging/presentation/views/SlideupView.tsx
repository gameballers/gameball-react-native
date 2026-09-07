import React, { useMemo, useRef } from 'react';
import {
  Animated,
  I18nManager,
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { InAppMessage, MessageButton } from '../../models/message';
import { MessageMetrics, SlideupMetrics } from '../metrics';

/**
 * A banner at one edge that does not block the app.
 *
 * It enters from its own edge and leaves the same way, either on a drag towards that edge or when
 * its auto-dismiss elapses. It has no close glyph and no scrim: the whole point is that the
 * customer can ignore it and carry on, which is also why the copy is clamped rather than allowed
 * to grow the banner over the screen.
 */
export function SlideupView({
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
  const fromTop = message.slidePosition === 'top';
  const travel = useRef(new Animated.Value(fromTop ? -120 : 120)).current;
  const drag = useRef(new Animated.Value(0)).current;
  const tappable = message.clickAction !== null;

  const responder = useMemo(
    () =>
      PanResponder.create({
        // Claim the gesture only once it is clearly vertical, so a horizontal swipe in the
        // app underneath still belongs to the app.
        onMoveShouldSetPanResponder: (_e, g) =>
          Math.abs(g.dy) > 4 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_e, g) => {
          const towardsEdge = fromTop ? Math.min(0, g.dy) : Math.max(0, g.dy);
          drag.setValue(towardsEdge);
        },
        onPanResponderRelease: (_e, g) => {
          const travelled = fromTop ? -g.dy : g.dy;
          if (travelled > SlideupMetrics.swipeDismissDistance) {
            onDismiss();
            return;
          }
          Animated.spring(drag, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
          }).start();
        },
      }),
    [drag, fromTop, onDismiss]
  );

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        fromTop
          ? { top: 0, paddingTop: Math.max(SlideupMetrics.margin, topInset) }
          : {
              bottom: 0,
              paddingBottom: Math.max(SlideupMetrics.margin, bottomInset),
            },
      ]}
    >
      <Animated.View
        testID="gb-iam-slideup"
        accessibilityRole="alert"
        accessible
        onLayout={() => {
          onShown();
          Animated.spring(travel, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
          }).start();
        }}
        style={[
          styles.band,
          {
            backgroundColor:
              message.style.backgroundColor ?? MessageMetrics.defaultSurface,
            transform: [{ translateY: Animated.add(travel, drag) }],
          },
        ]}
        {...responder.panHandlers}
      >
        <Pressable
          disabled={!tappable}
          onPress={() => onPress(null)}
          style={styles.row}
          testID="gb-iam-surface"
        >
          {message.iconUrl ? (
            <Image
              source={{ uri: message.iconUrl }}
              style={styles.icon}
              resizeMode="cover"
            />
          ) : null}
          <Text
            testID="gb-iam-body"
            numberOfLines={SlideupMetrics.maxTextLines}
            style={[
              styles.text,
              {
                color:
                  message.style.bodyColor ?? MessageMetrics.defaultBodyColor,
                writingDirection: I18nManager.isRTL ? 'rtl' : 'ltr',
              },
            ]}
          >
            {[message.header, message.body].filter(Boolean).join(' ')}
          </Text>
          {tappable ? (
            <Text
              style={[
                styles.chevron,
                {
                  color:
                    message.style.bodyColor ?? MessageMetrics.defaultBodyColor,
                  transform: [{ scaleX: I18nManager.isRTL ? -1 : 1 }],
                },
              ]}
            >
              ›
            </Text>
          ) : null}
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: SlideupMetrics.margin,
    alignItems: 'center',
  },
  band: {
    width: '100%',
    maxWidth: SlideupMetrics.maxWidth,
    borderRadius: SlideupMetrics.cornerRadius,
    paddingHorizontal: SlideupMetrics.contentPadding.horizontal,
    paddingVertical: SlideupMetrics.contentPadding.vertical,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  icon: {
    width: SlideupMetrics.iconSize,
    height: SlideupMetrics.iconSize,
    borderRadius: SlideupMetrics.iconCornerRadius,
    marginEnd: SlideupMetrics.iconSpacing,
  },
  text: {
    flex: 1,
    fontSize: SlideupMetrics.fontSize,
    lineHeight: SlideupMetrics.lineHeight,
  },
  chevron: {
    marginStart: SlideupMetrics.chevronSpacing,
    fontSize: SlideupMetrics.chevronSize,
    lineHeight: SlideupMetrics.chevronSize + 2,
  },
});
