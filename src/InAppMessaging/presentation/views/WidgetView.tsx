import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  I18nManager,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { iamLog } from '../../log';
import type { InAppMessage } from '../../models/message';
import { FullscreenMetrics, MessageMetrics, ModalMetrics } from '../metrics';
import { Stage } from './reveal';
import { CloseGlyph, closeInlineEnd } from './shared';
import { READINESS_SCRIPT } from './widget-readiness';

/**
 * How long the campaign has to become ready before the message is abandoned.
 *
 * Measured against the live widget: content arrives 2.4-5.9s after the load begins. Twelve
 * seconds clears that with room for a slow network, and a customer who would have waited longer
 * was going to close the card anyway.
 */
const READY_TIMEOUT_MS = 12_000;

/**
 * Width divided by height for a reward-campaign card. Measured, not chosen: the widget sizes its
 * content off the viewport *width*, so a box much wider than this clips its own copy — at roughly
 * 0.96 a wheel lost its right-hand label.
 */
const WIDGET_ASPECT_RATIO = 0.7;

interface Props {
  message: InAppMessage;
  /** The composed campaign URL. Built by the SDK from state it already holds. */
  url: string;
  /** The impression anchor. Called when the campaign is drawn, not when the view mounts. */
  onShown: () => void;
  /** The campaign never became ready; take the message away having never shown it. */
  onFailed: () => void;
  onDismiss: () => void;
  /** The widget reported the game finished: the customer played it through. */
  onCompleted: () => void;
  topInset?: number;
  rightInset?: number;
  bottomInset?: number;
  leftInset?: number;
}

const EVENT_PREFIX = 'gb:event:';

/**
 * An event the widget posted, or null when this cannot read one.
 *
 * Of the metadata only `gameReady`'s is read. The rest names the challenge and the widget's own
 * game type — `spinTheWheel` where the sync says `wheel` — so it is never matched against the
 * sync: an event from this view belongs to the game this view opened.
 */
function readWidgetEvent(
  raw: string
): { type: string; metadata: unknown } | null {
  try {
    const event: unknown = JSON.parse(raw);
    if (typeof event === 'object' && event !== null && !Array.isArray(event)) {
      const { type, metadata } = event as {
        type?: unknown;
        metadata?: unknown;
      };
      return typeof type === 'string' ? { type, metadata } : null;
    }
  } catch {
    // Not JSON: nothing this view acts on.
  }
  return null;
}

/**
 * A reward campaign in a WebView, revealed only once it has actually drawn.
 *
 * The page finishes navigating two to three seconds before the campaign exists — the widget
 * renders after its own fetches resolve — so showing on load alone puts a skeleton in front of the
 * customer every time.
 *
 * The widget says itself when the page is on screen, with a `gameReady` event, and whether the
 * game can be played. The readiness script's guess stays as the fallback for widgets that predate
 * that event; whichever comes first settles the view.
 */
export function WidgetView({
  message,
  url,
  onShown,
  onFailed,
  onDismiss,
  onCompleted,
  topInset = 0,
  rightInset = 0,
  bottomInset = 0,
  leftInset = 0,
}: Props): React.ReactElement {
  const { height } = useWindowDimensions();
  const [ready, setReady] = useState(false);
  const settled = useRef(false);

  /**
   * Settles exactly once. `failure` says why a game is taken away when it is not that the widget
   * ran out of time.
   */
  const settle = useCallback(
    (isReady: boolean, failure?: string) => {
      if (settled.current) return;
      settled.current = true;

      if (isReady) {
        setReady(true);
        onShown();
        return;
      }
      iamLog(
        failure !== undefined
          ? `widget ${failure}; taking the message away unshown`
          : `widget did not become ready within ${
              READY_TIMEOUT_MS / 1000
            }s; taking the message away unshown`
      );
      // onShown was never called, so no impression is logged and the frequency cap is untouched —
      // the campaign gets another go at its next trigger rather than being burned by a slow
      // network.
      onFailed();
    },
    [onShown, onFailed]
  );

  useEffect(() => {
    const timer = setTimeout(() => settle(false), READY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [settle]);

  /**
   * Settles on the widget's word that the page it opened is on screen. Only an explicit
   * `playable: false` holds the game back: the page is then the widget's "already played today",
   * "not available" or error screen, and that is all the customer would see.
   */
  const pageIsReady = useCallback(
    (metadata: unknown) => {
      const said = (
        typeof metadata === 'object' && metadata !== null ? metadata : {}
      ) as { playable?: unknown; reason?: unknown };
      if (said.playable !== false) {
        settle(true);
        return;
      }
      const reason = String(said.reason ?? 'no reason given');
      settle(false, `says the game cannot be played now (${reason})`);
    },
    [settle]
  );

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const raw = event.nativeEvent.data;
      if (raw === 'gb:ready') {
        settle(true);
        return;
      }
      if (raw === 'gb:timeout') {
        settle(false);
        return;
      }
      if (raw === 'gb:close') {
        onDismiss();
        return;
      }
      if (raw.startsWith(EVENT_PREFIX)) {
        const event = raw.slice(EVENT_PREFIX.length);
        iamLog(`game:${message.widget?.gameCampaignId ?? 0} reported ${event}`);
        const said = readWidgetEvent(event);
        if (said?.type === 'gameReady') {
          pageIsReady(said.metadata);
        } else if (said?.type === 'gameCompleted') {
          onCompleted();
        }
      }
    },
    [settle, pageIsReady, onDismiss, onCompleted, message.widget]
  );

  const fullscreen = message.type === 'fullscreen';

  const webView = (
    <WebView
      source={{ uri: url }}
      onMessage={onMessage}
      injectedJavaScript={READINESS_SCRIPT}
      scrollEnabled={false}
      androidHardwareAccelerationDisabled={false}
      style={styles.web}
      onError={() => settle(false)}
    />
  );

  // The widget's page draws no way out of a game on mobile, so the SDK draws one: at the top end,
  // over the game — on the card for a modal, and for a full screen in the safe area's corner, past
  // the top inset and the inset at the side the layout ends on (the left, under RTL). It closes
  // the game as Android's back button does, and so reports nothing either.
  const inset = fullscreen
    ? FullscreenMetrics.closeInset
    : ModalMetrics.closeInset;
  const endInset = fullscreen
    ? I18nManager.isRTL
      ? leftInset
      : rightInset
    : 0;
  const close = (
    <CloseGlyph
      accessibilityLabel="Close"
      color={MessageMetrics.gameCloseGlyph}
      disc={MessageMetrics.gameCloseDisc}
      onPress={onDismiss}
      style={{
        top: (fullscreen ? topInset : 0) + inset,
        ...closeInlineEnd(inset + endInset),
      }}
    />
  );

  // Centred on the screen, as every modal is, so the larger of the two insets bounds both ends,
  // with a message modal's margin past it — the rule the iOS SDK draws by. Turned on its side the
  // phone is short, and this rather than the width sets the card: a fixed share of the window left
  // one too short for any of a scratch card's play area to show.
  const cardMaxHeight = Math.max(
    0,
    height - 2 * (Math.max(topInset, bottomInset) + ModalMetrics.margin)
  );

  return (
    // Held out of sight, untouchable and unheard until drawn, rather than unmounted: the WebView
    // has to be laid out at its real size while it loads, or the page computes its layout against
    // nothing. The scrim waits with it — a game loads in the SDK's own layer, not a Modal, so for
    // the seconds that takes the app keeps its taps, with nothing on screen to explain otherwise.
    <Stage revealed={ready}>
      {fullscreen ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: message.style.backgroundColor ?? '#FFFFFF' },
          ]}
        >
          <View
            testID="gb-iam-game-frame"
            style={[
              styles.fullBleed,
              {
                paddingTop: topInset,
                paddingRight: rightInset,
                paddingBottom: bottomInset,
                paddingLeft: leftInset,
              },
            ]}
          >
            {webView}
          </View>
          {close}
        </View>
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.centre]}>
          {/* A tap on the dimmed app around a modal game closes it, as it does a modal message.
              Not announced: the close button is the way out a screen reader finds. */}
          <Pressable
            testID="gb-iam-scrim"
            accessible={false}
            importantForAccessibility="no"
            style={[StyleSheet.absoluteFill, styles.scrim]}
            onPress={onDismiss}
          />
          <View
            testID="gb-iam-game-card"
            style={[styles.card, { maxHeight: cardMaxHeight }]}
          >
            {webView}
            {close}
          </View>
        </View>
      )}
    </Stage>
  );
}

const styles = StyleSheet.create({
  centre: { justifyContent: 'center' },
  scrim: { backgroundColor: 'rgba(0,0,0,0.6)' },
  fullBleed: { flex: 1 },
  card: {
    alignSelf: 'center',
    width: '86%',
    maxWidth: 420,
    aspectRatio: WIDGET_ASPECT_RATIO,
    borderRadius: 16,
    overflow: 'hidden',
  },
  web: { flex: 1, backgroundColor: 'transparent' },
});
