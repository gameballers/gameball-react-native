import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { iamLog } from '../../log';

/**
 * How long artwork already held in memory may take to paint before the message is given up.
 *
 * The bytes are local by the time a message displays, so this is decode time — tens of
 * milliseconds — and the bound exists for the image that never decodes at all. It is short
 * because the wait is not free: a modal or a full screen spends it with the app dimmed behind its
 * Modal, which holds every touch on the screen until the message arrives or is given up.
 */
export const ARTWORK_PAINT_TIMEOUT_MS = 2_000;

/**
 * Holds a message out of sight until it can be seen whole.
 *
 * Laid out is not painted. An Image decodes after its view exists — even from bytes already in
 * memory — so the frames between the two are a card with a hole where its artwork belongs, and
 * the card's first layout, which is when the impression used to be counted, lands among them. A
 * message is revealed once it has laid out and its artwork, if it draws any, has painted; the
 * impression is counted at that moment and never before.
 *
 * Artwork that fails to paint, or has not painted within ARTWORK_PAINT_TIMEOUT_MS, takes the
 * message away unshown. onShown was never called, so no impression is logged and the frequency cap
 * is untouched: the campaign gets another go at its next trigger.
 */
export function useReveal(
  awaitsImage: boolean,
  onShown: () => void,
  onFailed: () => void
) {
  const [revealed, setRevealed] = useState(false);
  const laidOut = useRef(false);
  const painted = useRef(!awaitsImage);
  const settled = useRef(false);
  // Read through, never captured: the bound is armed once, and a host re-render must neither
  // re-arm it nor leave it calling a stale callback.
  const callbacks = useRef({ onShown, onFailed });
  callbacks.current = { onShown, onFailed };

  const reveal = () => {
    if (settled.current || !laidOut.current || !painted.current) {
      return;
    }
    settled.current = true;
    setRevealed(true);
    callbacks.current.onShown();
  };

  const fail = (reason: string) => {
    if (settled.current) {
      return;
    }
    settled.current = true;
    iamLog(`${reason}; taking the message away unshown`);
    callbacks.current.onFailed();
  };

  const failRef = useRef(fail);
  failRef.current = fail;
  useEffect(() => {
    if (!awaitsImage) {
      return;
    }
    const timer = setTimeout(
      () =>
        failRef.current(
          `artwork did not paint within ${ARTWORK_PAINT_TIMEOUT_MS}ms`
        ),
      ARTWORK_PAINT_TIMEOUT_MS
    );
    return () => clearTimeout(timer);
  }, [awaitsImage]);

  return {
    revealed,
    onLayout: () => {
      laidOut.current = true;
      reveal();
    },
    onImageLoad: () => {
      painted.current = true;
      reveal();
    },
    onImageError: () => fail('artwork could not be drawn'),
  };
}

/**
 * A message's content, transparent, untouchable and unheard until it is revealed.
 *
 * Transparent rather than unmounted: the artwork has to be laid out at its real size to decode at
 * all. Untouchable as well, because a button nobody can see would still take a tap — counting a
 * click on a message the customer never saw. And hidden from VoiceOver and TalkBack, which both
 * find views a sighted customer cannot see, and would announce a message that may yet be taken
 * away unshown.
 *
 * Content only, never the backdrop. A React Native Modal holds every touch on the screen from the
 * moment it mounts, whatever is drawn in it — a view controller of its own on iOS, a window of its
 * own on Android — so a modal or a full screen keeps its scrim outside the stage, on screen from
 * the first frame. A slide-up has no Modal and no scrim: while it waits, the app beneath stays
 * usable.
 */
export function Stage({
  revealed,
  children,
}: {
  revealed: boolean;
  children: React.ReactNode;
}) {
  return (
    <View
      testID="gb-iam-stage"
      style={[StyleSheet.absoluteFill, revealed ? styles.shown : styles.hidden]}
      pointerEvents={revealed ? 'box-none' : 'none'}
      accessibilityElementsHidden={!revealed}
      importantForAccessibility={revealed ? 'auto' : 'no-hide-descendants'}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  shown: { opacity: 1 },
  hidden: { opacity: 0 },
});
