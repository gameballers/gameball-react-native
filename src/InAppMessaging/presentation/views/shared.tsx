import React from 'react';
import {
  I18nManager,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import type {
  MessageButton,
  MessageStyle,
  TextAlign,
} from '../../models/message';
import { MessageMetrics } from '../metrics';
import { resolveCloseGlyphColor } from '../close-glyph';

/**
 * `start` and `end` are what the composer authors in, and they mirror in Arabic.
 *
 * React Native does not understand either: `TextStyle['textAlign']` is physical, and the one value
 * that follows the layout direction is `auto`. So `start` becomes `auto`, and `end` is resolved
 * against the direction by hand — otherwise every Arabic message authored with the default
 * alignment is flushed to the left margin while its text runs right to left.
 */
export function textAlign(
  align: TextAlign | undefined
): TextStyle['textAlign'] {
  switch (align) {
    case 'left':
    case 'right':
    case 'center':
      return align;
    case 'end':
      return I18nManager.isRTL ? 'left' : 'right';
    default:
      return 'auto';
  }
}

/**
 * Where the close glyph sits on the inline-end edge — top-right in English, top-left in Arabic.
 *
 * React Native does not mirror a physical `right` under RTL, and the web SDK places this glyph
 * with `inset-inline-end`, which does; without this the close button stays in the wrong corner in
 * every RTL locale.
 */
export function closeInlineEnd(
  inset: number
): { left: number } | { right: number } {
  return I18nManager.isRTL ? { left: inset } : { right: inset };
}

/** A close glyph drawn from two crossing bars, so the SDK ships no icon asset. */
export function CloseGlyph({
  style,
  color,
  onPress,
  accessibilityLabel,
}: {
  style?: StyleProp<ViewStyle>;
  color: string;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const bar: ViewStyle = {
    position: 'absolute',
    width: MessageMetrics.closeGlyphSize - 6,
    height: 2,
    borderRadius: 1,
    backgroundColor: color,
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID="gb-iam-close"
      hitSlop={8}
      onPress={onPress}
      style={[styles.close, style]}
    >
      <View style={[bar, { transform: [{ rotate: '45deg' }] }]} />
      <View style={[bar, { transform: [{ rotate: '-45deg' }] }]} />
    </Pressable>
  );
}

export function closeColorFor(style: MessageStyle): string {
  return (
    resolveCloseGlyphColor(style.closeButtonColor, style.backgroundColor) ??
    MessageMetrics.closeGlyphOnLight
  );
}

/** One campaign button. Colours come from the campaign; geometry never does. */
export function MessageActionButton({
  button,
  onPress,
  fontSize,
  lineHeight,
  paddingVertical,
  paddingHorizontal,
  fullWidth,
  index,
}: {
  button: MessageButton;
  onPress: (button: MessageButton) => void;
  fontSize: number;
  lineHeight: number;
  paddingVertical: number;
  paddingHorizontal: number;
  fullWidth?: boolean;
  index: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      testID={`gb-iam-button-${index}`}
      onPress={() => onPress(button)}
      style={({ pressed }) => [
        {
          borderRadius: MessageMetrics.buttonCornerRadius,
          paddingVertical,
          paddingHorizontal,
          backgroundColor: button.style.backgroundColor ?? 'transparent',
          borderWidth: button.style.borderColor ? 1 : 0,
          borderColor: button.style.borderColor,
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: fullWidth ? 'stretch' : 'auto',
          // The press feedback the native renderers draw and a WebView had to fake.
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text
        numberOfLines={2}
        style={{
          fontSize,
          lineHeight,
          fontWeight: '600',
          textAlign: 'center',
          color: button.style.textColor ?? MessageMetrics.defaultBodyColor,
        }}
      >
        {button.text}
      </Text>
    </Pressable>
  );
}

/** Header and body, in the sizes the composer previewed. */
export function Copy({
  header,
  body,
  style,
  headerFontSize,
  headerLineHeight,
  bodyFontSize,
  bodyLineHeight,
  spacing,
}: {
  header: string | null;
  body: string | null;
  style: MessageStyle;
  headerFontSize: number;
  headerLineHeight: number;
  bodyFontSize: number;
  bodyLineHeight: number;
  spacing: number;
}) {
  return (
    <>
      {header ? (
        <Text
          testID="gb-iam-header"
          style={{
            fontSize: headerFontSize,
            lineHeight: headerLineHeight,
            fontWeight: '700',
            color: style.headerColor ?? MessageMetrics.defaultBodyColor,
            textAlign: textAlign(style.headerAlign),
            writingDirection: I18nManager.isRTL ? 'rtl' : 'ltr',
          }}
        >
          {header}
        </Text>
      ) : null}
      {body ? (
        <Text
          testID="gb-iam-body"
          style={{
            fontSize: bodyFontSize,
            lineHeight: bodyLineHeight,
            color: style.bodyColor ?? MessageMetrics.defaultBodyColor,
            textAlign: textAlign(style.bodyAlign),
            writingDirection: I18nManager.isRTL ? 'rtl' : 'ltr',
            marginTop: header ? spacing : 0,
          }}
        >
          {body}
        </Text>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  close: {
    position: 'absolute',
    width: MessageMetrics.closeHitTarget,
    height: MessageMetrics.closeHitTarget,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
});
