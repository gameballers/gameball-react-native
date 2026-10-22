import React from 'react';
import { Image, Modal, StyleSheet } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { createGameballInAppMessages } from '../../presentation/GameballInAppMessages';
import { ReactMessagePresenter } from '../../presentation/message-presenter';
import { ARTWORK_PAINT_TIMEOUT_MS } from '../../presentation/views/reveal';
import type { InAppMessage } from '../../models/message';
import { message } from '../helpers/fixtures';

function messageOf(overrides: Partial<InAppMessage> = {}): InAppMessage {
  return {
    id: 'm1',
    type: 'modal',
    header: 'Header',
    body: 'Body',
    imageUrl: null,
    buttons: [],
    clickAction: null,
    autoDismissMs: null,
    orientation: 'any',
    dismissible: true,
    scrimDismisses: true,
    style: {},
    ...overrides,
  } as InAppMessage;
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

function show(presenter: ReactMessagePresenter, shown: InAppMessage): void {
  presenter.present(shown, {
    onShown: () => {},
    onDismissed: () => {},
    onButtonPressed: () => {},
    onMessagePressed: () => {},
  });
}

describe('GameballInAppMessages', () => {
  it.each(['modal', 'fullscreen'] as const)(
    'lets the app keep every orientation while a %s is up',
    (type) => {
      const presenter = new ReactMessagePresenter({});
      const Host = createGameballInAppMessages(presenter);
      // Inside act: the host registers itself from an effect, and an effect does not run until
      // the render is committed. Outside it, the presenter would have no surface to draw on.
      const tree = mount(<Host />);

      act(() => {
        show(presenter, messageOf({ type }));
      });

      // React Native's Modal allows only portrait unless told otherwise, and imposes it on the
      // whole app: without this prop, showing a message rotates the customer's screen.
      const modal = tree.root.findByType(Modal);
      expect(modal.props.supportedOrientations).toEqual(
        expect.arrayContaining([
          'portrait',
          'landscape',
          'landscape-left',
          'landscape-right',
        ])
      );
      unmount(tree);
    }
  );

  it('draws a slide-up in place, with no Modal to take the screen', () => {
    const presenter = new ReactMessagePresenter({});
    const Host = createGameballInAppMessages(presenter);
    const tree = mount(<Host />);

    act(() => {
      show(presenter, messageOf({ type: 'slideup' }));
    });

    expect(tree.root.findAllByType(Modal)).toHaveLength(0);
    unmount(tree);
  });
});

const HERO = 'https://cdn.test/hero.png';
/** What the prefetcher holds for HERO once its bytes are in memory: a 1200 × 800 picture. */
const HERO_HELD = {
  uri: 'data:image/png;base64,aGVybw==',
  width: 1200,
  height: 800,
};

describe('artwork', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("draws an image-with-text modal's artwork at its own shape in the first frame, from the bytes already held", () => {
    // On a device Image.getSize answers a beat after the card has drawn — modelled here as never
    // answering — so a view that waits on it shows its copy alone and then grows. A React Native
    // Image has no intrinsic size either: given only a width it occupies no space at all.
    jest.spyOn(Image, 'getSize').mockImplementation(() => {});
    const presenter = new ReactMessagePresenter({
      artwork: (url) => (url === HERO ? HERO_HELD : null),
    });
    const Host = createGameballInAppMessages(presenter);
    const tree = mount(<Host />);

    act(() => {
      show(
        presenter,
        message({ type: 'modal', layout: 'text_with_image', imageUrl: HERO })
      );
    });

    const image = tree.root.findByProps({ testID: 'gb-iam-image' });
    // The held bytes, not the url: drawing from the url is a network request at display time.
    expect(image.props.source).toEqual({ uri: HERO_HELD.uri });
    expect(
      (StyleSheet.flatten(image.props.style) as { aspectRatio?: number })
        .aspectRatio
    ).toBe(1.5);
    unmount(tree);
  });

  /** Which image each type draws, and the slot its artwork comes from. */
  const drawn = [
    ['modal', 'gb-iam-image', { imageUrl: HERO }],
    ['fullscreen', 'gb-iam-image', { imageUrl: HERO }],
    ['slideup', 'gb-iam-icon', { iconUrl: HERO }],
  ] as const;

  it.each(drawn)(
    'keeps a %s off screen, untouchable and uncounted until its artwork has painted',
    (type, imageID, slot) => {
      const presenter = new ReactMessagePresenter({
        artwork: (url) => (url === HERO ? HERO_HELD : null),
      });
      const Host = createGameballInAppMessages(presenter);
      const tree = mount(<Host />);
      const calls = recorder();

      act(() => {
        presenter.present(message({ type, ...slot }), calls);
      });
      // Laid out is not painted: the image decodes after its view exists, and the frames between
      // are a card with a hole in it. Laying out is exactly when the impression used to be counted.
      act(() => layOut(tree));
      expect(calls.log).toEqual([]);
      expect(stage(tree)).toEqual(HIDDEN);

      act(() => paint(tree, imageID));
      expect(calls.log).toEqual(['shown']);
      expect(stage(tree)).toEqual(REVEALED);
      unmount(tree);
    }
  );

  it.each(drawn)(
    'takes a %s away unshown when its artwork fails to paint',
    (type, imageID, slot) => {
      const presenter = new ReactMessagePresenter({
        artwork: (url) => (url === HERO ? HERO_HELD : null),
      });
      const Host = createGameballInAppMessages(presenter);
      const tree = mount(<Host />);
      const calls = recorder();

      act(() => {
        presenter.present(message({ type, ...slot }), calls);
      });
      act(() => layOut(tree));
      act(() => {
        tree.root
          .findByProps({ testID: imageID })
          .props.onError({ nativeEvent: { error: 'could not decode' } });
      });

      // Never seen, so never counted: the campaign keeps its chance at the next trigger.
      expect(calls.log).toEqual(['dismissed']);
      expect(presenter.isShowing).toBe(false);
      unmount(tree);
    }
  );

  it('gives up on artwork that has not painted within the bound, and never on artwork that has', () => {
    jest.useFakeTimers();
    try {
      const presenter = new ReactMessagePresenter({
        artwork: (url) => (url === HERO ? HERO_HELD : null),
      });
      const Host = createGameballInAppMessages(presenter);
      const tree = mount(<Host />);

      const stuck = recorder();
      act(() => {
        presenter.present(message({ type: 'modal', imageUrl: HERO }), stuck);
      });
      act(() => layOut(tree));
      act(() => {
        jest.advanceTimersByTime(ARTWORK_PAINT_TIMEOUT_MS - 1);
      });
      expect(stuck.log).toEqual([]);
      act(() => {
        jest.advanceTimersByTime(1);
      });
      expect(stuck.log).toEqual(['dismissed']);

      const painted = recorder();
      act(() => {
        presenter.present(message({ type: 'modal', imageUrl: HERO }), painted);
      });
      act(() => layOut(tree));
      act(() => paint(tree, 'gb-iam-image'));
      act(() => {
        jest.advanceTimersByTime(ARTWORK_PAINT_TIMEOUT_MS * 2);
      });
      expect(painted.log).toEqual(['shown']);
      unmount(tree);
    } finally {
      jest.useRealTimers();
    }
  });

  it.each(['modal', 'fullscreen'] as const)(
    'dims the screen the moment a %s takes it, so no touch is held by something nobody can see',
    (type) => {
      const presenter = new ReactMessagePresenter({
        artwork: (url) => (url === HERO ? HERO_HELD : null),
      });
      const Host = createGameballInAppMessages(presenter);
      const tree = mount(<Host />);

      act(() => {
        show(presenter, message({ type, imageUrl: HERO }));
      });
      act(() => layOut(tree));

      // A Modal takes every touch on the screen from the moment it mounts, whatever is drawn in it:
      // a view controller of its own on iOS, a window of its own on Android. So from that moment
      // something has to be seen to be holding them — the backdrop — while the message waits.
      expect(tree.root.findAllByType(Modal)).toHaveLength(1);
      expect(onScreen(scrim(tree))).toBe(true);
      expect(stage(tree)).toEqual(HIDDEN);

      act(() => paint(tree, 'gb-iam-image'));
      expect(onScreen(scrim(tree))).toBe(true);
      expect(stage(tree)).toEqual(REVEALED);
      unmount(tree);
    }
  );

  it('holds a message presented the moment the last one left until its own artwork has painted', () => {
    const presenter = new ReactMessagePresenter({
      artwork: (url) => (url === HERO ? HERO_HELD : null),
    });
    const Host = createGameballInAppMessages(presenter);
    const tree = mount(<Host />);
    const next = recorder();
    const failing = {
      ...recorder(),
      // What the service does as a message leaves: presents the one parked behind it, there and
      // then — so React renders the two as one update, and the next message lands in the very view
      // the last one is leaving.
      onDismissed: () => {
        presenter.present(
          message({ id: 'next', type: 'modal', imageUrl: HERO }),
          next
        );
      },
    };

    act(() => {
      presenter.present(
        message({ id: 'failing', type: 'modal', imageUrl: HERO }),
        failing
      );
    });
    act(() => layOut(tree));
    act(() => {
      tree.root
        .findByProps({ testID: 'gb-iam-image' })
        .props.onError({ nativeEvent: { error: 'could not decode' } });
    });

    act(() => layOut(tree));
    expect(next.log).toEqual([]);
    expect(stage(tree)).toEqual(HIDDEN);
    act(() => paint(tree, 'gb-iam-image'));
    expect(next.log).toEqual(['shown']);
    expect(stage(tree)).toEqual(REVEALED);
    unmount(tree);
  });

  it.each(['modal', 'fullscreen', 'slideup'] as const)(
    'shows a %s with no artwork on its first layout, with nothing to wait for',
    (type) => {
      const presenter = new ReactMessagePresenter({ artwork: () => null });
      const Host = createGameballInAppMessages(presenter);
      const tree = mount(<Host />);
      const calls = recorder();

      act(() => {
        presenter.present(message({ type }), calls);
      });
      act(() => layOut(tree));

      expect(calls.log).toEqual(['shown']);
      expect(stage(tree)).toEqual(REVEALED);
      unmount(tree);
    }
  );
});

function recorder() {
  const log: string[] = [];
  return {
    log,
    onShown: () => log.push('shown'),
    onDismissed: () => log.push('dismissed'),
    onButtonPressed: () => log.push('button'),
    onMessagePressed: () => log.push('tap'),
  };
}

/** What the device does once the views exist: every one of them reports its layout. */
function layOut(tree: TestRenderer.ReactTestRenderer): void {
  const laidOut = tree.root.findAll(
    (node) =>
      typeof node.type === 'string' && typeof node.props.onLayout === 'function'
  );
  for (const node of laidOut) {
    node.props.onLayout({
      nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } },
    });
  }
}

/** The image's pixels reached the screen. */
function paint(tree: TestRenderer.ReactTestRenderer, testID: string): void {
  tree.root.findByProps({ testID }).props.onLoad({
    nativeEvent: { source: { width: 1200, height: 800, uri: HERO_HELD.uri } },
  });
}

/** Nothing of a message held for its artwork can be seen, touched or found by a screen reader. */
const HIDDEN = {
  opacity: 0,
  pointerEvents: 'none',
  hiddenFromScreenReaders: true,
};
const REVEALED = {
  opacity: 1,
  pointerEvents: 'box-none',
  hiddenFromScreenReaders: false,
};

/** The layer that dims the app behind a modal or a full screen. */
function scrim(
  tree: TestRenderer.ReactTestRenderer
): TestRenderer.ReactTestInstance {
  return tree.root.find(
    (n) => typeof n.type === 'string' && n.props.testID === 'gb-iam-scrim'
  );
}

/** Drawn, with colour, and with no transparent view anywhere above it. */
function onScreen(node: TestRenderer.ReactTestInstance): boolean {
  const own = StyleSheet.flatten(node.props.style) as {
    backgroundColor?: unknown;
  };
  if (!own.backgroundColor) {
    return false;
  }
  for (let n: TestRenderer.ReactTestInstance | null = node; n; n = n.parent) {
    if (typeof n.type !== 'string') {
      continue;
    }
    const style = (StyleSheet.flatten(n.props.style) ?? {}) as {
      opacity?: number;
    };
    if (style.opacity === 0) {
      return false;
    }
  }
  return true;
}

/** Whether anything of the message can be seen, touched or heard. */
function stage(tree: TestRenderer.ReactTestRenderer): typeof HIDDEN {
  const node = tree.root.find(
    (n) => typeof n.type === 'string' && n.props.testID === 'gb-iam-stage'
  );
  return {
    opacity: (StyleSheet.flatten(node.props.style) as { opacity: number })
      .opacity,
    pointerEvents: node.props.pointerEvents,
    // VoiceOver and TalkBack each find views a sighted customer cannot see, and each has its own
    // switch.
    hiddenFromScreenReaders:
      node.props.accessibilityElementsHidden === true &&
      node.props.importantForAccessibility === 'no-hide-descendants',
  };
}
