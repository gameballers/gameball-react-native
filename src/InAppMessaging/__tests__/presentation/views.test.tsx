import React from 'react';
import { I18nManager, ScrollView, StyleSheet } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { FullscreenView } from '../../presentation/views/FullscreenView';
import { ModalView } from '../../presentation/views/ModalView';
import { SlideupView } from '../../presentation/views/SlideupView';
import { textAlign } from '../../presentation/views/shared';
import type { InAppMessage, MessageButton } from '../../models/message';

function button(id: string): MessageButton {
  return {
    id,
    label: id,
    action: null,
    style: {},
  } as unknown as MessageButton;
}

function messageOf(overrides: Partial<InAppMessage> = {}): InAppMessage {
  return {
    id: 'm1',
    type: 'fullscreen',
    layout: 'stacked',
    header: 'Header',
    body: 'Body copy',
    imageUrl: 'https://example.test/art.png',
    buttons: [],
    clickAction: null,
    autoDismissMs: null,
    orientation: 'any',
    showCloseButton: true,
    slidePosition: 'bottom',
    style: {},
    ...overrides,
  } as unknown as InAppMessage;
}

function mount(element: React.ReactElement): TestRenderer.ReactTestRenderer {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(element);
  });
  return tree;
}

function unmount(tree: TestRenderer.ReactTestRenderer): void {
  act(() => {
    tree.unmount();
  });
}

const noop = () => {};

/** Either card type, with a close glyph asked for. */
function fullscreenOrModal(type: 'modal' | 'fullscreen') {
  const message = messageOf({ type, showCloseButton: true } as never);
  return mount(
    type === 'fullscreen' ? (
      <FullscreenView
        message={message}
        onShown={noop}
        onPress={noop}
        onDismiss={noop}
        topInset={0}
        bottomInset={0}
      />
    ) : (
      <ModalView
        message={message}
        onShown={noop}
        onPress={noop}
        onDismiss={noop}
        onScrim={noop}
      />
    )
  );
}

/** The share of its parent a node asks for, as authored. */
function flexBasisOf(node: TestRenderer.ReactTestInstance): unknown {
  return flatten(node).flexBasis;
}

function flatten(
  node: TestRenderer.ReactTestInstance
): Record<string, unknown> {
  return (StyleSheet.flatten(node.props.style as never) ?? {}) as Record<
    string,
    unknown
  >;
}

/** Host nodes carrying a test id, so a composite and its host are not counted twice. */
function hosts(
  scope: TestRenderer.ReactTestInstance,
  testID: string
): TestRenderer.ReactTestInstance[] {
  return scope.findAll(
    (node) => typeof node.type === 'string' && node.props.testID === testID,
    { deep: true }
  );
}

/** How the buttons row is positioned: in the flow, or floating over the artwork. */
function tree_position(
  tree: TestRenderer.ReactTestRenderer
): string | undefined {
  return flatten(tree.root.findByProps({ testID: 'gb-iam-buttons' }))
    .position as string | undefined;
}

function fullscreen(message: InAppMessage) {
  return mount(
    <FullscreenView
      message={message}
      onShown={noop}
      onPress={noop}
      onDismiss={noop}
      topInset={0}
      bottomInset={0}
    />
  );
}

describe('FullscreenView', () => {
  it.each([0, 1, 2])(
    'measures the copy against the same box as the artwork, with %i button(s)',
    (count) => {
      // The artwork is absolutely positioned over the whole surface and takes half of it. The
      // space held for it is a percentage too — of whatever column that spacer lives in. So the
      // two agree only while the spacer's column IS the whole surface. Leaving the buttons outside
      // that column shortened it, and the copy started half a buttons-row above the picture's
      // bottom edge and painted over it. A message with no buttons was unaffected, which is
      // exactly why the baseline screenshot looked right.
      const tree = fullscreen(
        messageOf({
          buttons: Array.from({ length: count }, (_, i) => button(`b${i}`)),
        })
      );

      const spacer = tree.root.findByProps({ testID: 'gb-iam-image-spacer' });
      const column = spacer.parent!;
      expect(column.findAllByType(ScrollView)).toHaveLength(1);
      expect(hosts(column, 'gb-iam-buttons')).toHaveLength(count > 0 ? 1 : 0);

      expect(flexBasisOf(spacer)).toBe(
        flexBasisOf(tree.root.findByProps({ testID: 'gb-iam-image' }))
      );
      unmount(tree);
    }
  );

  it('floats the buttons over an image-only message, which has no column to sit in', () => {
    const tree = fullscreen(
      messageOf({
        layout: 'image_only',
        header: null,
        body: null,
        buttons: [button('b0')],
      })
    );
    expect(tree_position(tree)).toBe('absolute');
    expect(tree.root.findAllByType(ScrollView)).toHaveLength(0);
    unmount(tree);
  });
});

describe('the close affordances each type offers', () => {
  // Since closeBehaviour was removed from the composer these are fixed per type rather than
  // per campaign, so they are worth stating outright: they are the whole of the behaviour.
  it('never draws a glyph on a slide-up, whatever the message says', () => {
    const tree = mount(
      <SlideupView
        message={messageOf({
          type: 'slideup',
          imageUrl: null,
          showCloseButton: true,
        } as never)}
        onShown={noop}
        onPress={noop}
        onDismiss={noop}
        topInset={0}
        bottomInset={0}
      />
    );
    expect(
      tree.root.findAllByProps({ accessibilityLabel: 'Close' })
    ).toHaveLength(0);
    unmount(tree);
  });

  it.each(['modal', 'fullscreen'] as const)(
    'always draws one on a %s',
    (type) => {
      const tree = fullscreenOrModal(type);
      expect(
        tree.root.findAllByProps({ accessibilityLabel: 'Close' }).length
      ).toBeGreaterThan(0);
      unmount(tree);
    }
  );
});

describe('right-to-left', () => {
  afterEach(() => {
    I18nManager.isRTL = false;
  });

  it.each([false, true])(
    'places the close glyph on the logical end edge, isRTL=%s',
    (rtl) => {
      // Deliberately not a physical side. React Native swaps left and right itself under RTL, so
      // a side picked from isRTL is mirrored twice and the glyph comes back to the wrong corner —
      // which is exactly what a device run in Arabic caught. `end` is resolved once, by the
      // layout engine.
      I18nManager.isRTL = rtl;
      const tree = fullscreen(messageOf());
      const glyph = flatten(
        tree.root.findByProps({ accessibilityLabel: 'Close' })
      ) as { left?: number; right?: number; end?: number };
      expect(glyph.end).toBeGreaterThan(0);
      expect(glyph.left).toBeUndefined();
      expect(glyph.right).toBeUndefined();
      unmount(tree);
    }
  );

  it('lets an unaligned message follow the layout direction', () => {
    // 'auto' is the only React Native value that mirrors; 'left' pins Arabic to the wrong margin.
    expect(textAlign(undefined)).toBe('auto');
    expect(textAlign('start')).toBe('auto');
    expect(textAlign('center')).toBe('center');
    expect(textAlign('end')).toBe('right');
    I18nManager.isRTL = true;
    expect(textAlign('end')).toBe('left');
  });
});

describe('SlideupView', () => {
  it('springs back when the OS takes the gesture away mid-drag', () => {
    const tree = mount(
      <SlideupView
        message={messageOf({ type: 'slideup', imageUrl: null })}
        onShown={noop}
        onPress={noop}
        onDismiss={noop}
        topInset={0}
        bottomInset={0}
      />
    );
    const banner = tree.root.findByProps({ testID: 'gb-iam-slideup' });
    const handlers = banner.props as {
      onResponderTerminate?: unknown;
      onStartShouldSetResponder?: unknown;
    };
    // PanResponder spreads its handlers onto the view it is attached to; without a terminate
    // handler a cancelled drag leaves the banner stranded off-position until it auto-dismisses.
    expect(typeof handlers.onResponderTerminate).toBe('function');
    unmount(tree);
  });
});

describe('the surface', () => {
  it('does not swallow taps when the message has no click action', () => {
    const tree = fullscreen(messageOf({ clickAction: null }));
    const surface = tree.root.findByProps({ testID: 'gb-iam-surface' });
    expect(surface.props.disabled).toBe(true);
    unmount(tree);
  });
});
