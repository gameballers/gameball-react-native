import React from 'react';
import { Dimensions, I18nManager, StyleSheet } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import type { InAppMessage, MessageButton } from '../../models/message';
import { createGameballInAppMessages } from '../../presentation/GameballInAppMessages';
import { ReactMessagePresenter } from '../../presentation/message-presenter';
import { FullscreenMetrics, ModalMetrics } from '../../presentation/metrics';
import { message } from '../helpers/fixtures';

/**
 * `react-native-safe-area-context` as a device runs it: the provider measures the screen where it
 * is drawn, reports that once it is on screen, and again whenever it changes, as a rotation does.
 * Installed for this suite only; the others run as an app without the package.
 */
jest.mock(
  'react-native-safe-area-context',
  () => {
    const mockReact = require('react');
    const start = { top: 62, right: 0, bottom: 34, left: 0 };
    let now = start;
    const listeners = new Set<() => void>();
    const SafeAreaInsetsContext = mockReact.createContext(null);
    function SafeAreaProvider({ children, initialMetrics, ...native }: any) {
      const [insets, setInsets] = mockReact.useState(
        initialMetrics?.insets ?? null
      );
      mockReact.useEffect(() => {
        const report = () => setInsets(now);
        listeners.add(report);
        report();
        return () => {
          listeners.delete(report);
        };
      }, []);
      return mockReact.createElement(
        'RNCSafeAreaProvider',
        native,
        insets === null
          ? null
          : mockReact.createElement(
              SafeAreaInsetsContext.Provider,
              { value: insets },
              children
            )
      );
    }
    return {
      SafeAreaProvider,
      SafeAreaInsetsContext,
      initialWindowMetrics: {
        insets: start,
        frame: { x: 0, y: 0, width: 402, height: 874 },
      },
      /** The device reports new insets. */
      mockReport(next: typeof start) {
        now = next;
        listeners.forEach((listener) => listener());
      },
    };
  },
  { virtual: true }
);

type Edges = { top: number; right: number; bottom: number; left: number };

const PORTRAIT = {
  window: { width: 402, height: 874, scale: 3, fontScale: 1 },
  insets: { top: 62, right: 0, bottom: 34, left: 0 },
};
/** The same phone on its side: the Dynamic Island moves to a side, the home indicator stays below. */
const LANDSCAPE = {
  window: { width: 874, height: 402, scale: 3, fontScale: 1 },
  insets: { top: 0, right: 62, bottom: 21, left: 62 },
};
/** A screen whose cutout is on one side only, so the two ends differ. */
const ONE_SIDED = {
  window: LANDSCAPE.window,
  insets: { top: 0, right: 0, bottom: 21, left: 48 },
};

function turn(to: typeof PORTRAIT): void {
  act(() => {
    Dimensions.set({ window: to.window, screen: to.window });
    require('react-native-safe-area-context').mockReport(to.insets);
  });
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

const callbacks = {
  onShown: () => {},
  onDismissed: () => {},
  onButtonPressed: () => {},
  onMessagePressed: () => {},
  onGameCompleted: () => {},
};

/** A presenter as the controller builds it: no artwork to hold, and a url for every game. */
function gamePresenter(): ReactMessagePresenter {
  return new ReactMessagePresenter({
    artwork: () => null,
    gameUrl: () =>
      'https://m.gameball.app?customerId=c1&apiKey=k&openDetail=details_wheel_7&hideNavigation=true',
  });
}

function game(type: 'modal' | 'fullscreen'): InAppMessage {
  return message({
    type,
    header: null,
    body: null,
    widget: { gameCampaignId: 7, gameCampaignType: 'wheel' },
  });
}

/** Mounts the host and puts [shown] up on it. */
function showing(
  shown: InAppMessage,
  presenter: ReactMessagePresenter,
  host: React.ReactElement | null = null
): TestRenderer.ReactTestRenderer {
  const Host = createGameballInAppMessages(presenter);
  const tree = mount(host ?? <Host />);
  act(() => {
    presenter.present(shown, callbacks);
  });
  return tree;
}

function drawn(
  tree: TestRenderer.ReactTestRenderer,
  testID: string
): TestRenderer.ReactTestInstance {
  return tree.root.find(
    (n) => typeof n.type === 'string' && n.props.testID === testID
  );
}

function styleOf(
  tree: TestRenderer.ReactTestRenderer,
  testID: string
): Record<string, unknown> {
  return (StyleSheet.flatten(drawn(tree, testID).props.style) ?? {}) as Record<
    string,
    unknown
  >;
}

function paddingOf(
  tree: TestRenderer.ReactTestRenderer,
  testID: string
): Edges {
  const style = styleOf(tree, testID);
  return {
    top: (style.paddingTop as number | undefined) ?? 0,
    right: (style.paddingRight as number | undefined) ?? 0,
    bottom: (style.paddingBottom as number | undefined) ?? 0,
    left: (style.paddingLeft as number | undefined) ?? 0,
  };
}

beforeEach(() => turn(PORTRAIT));

afterEach(() => {
  turn(PORTRAIT);
  jest.restoreAllMocks();
});

describe('a full-screen game', () => {
  it('sits inside the safe area on every side, and moves with it when the phone turns', () => {
    const tree = showing(game('fullscreen'), gamePresenter());
    expect(paddingOf(tree, 'gb-iam-game-frame')).toEqual(PORTRAIT.insets);

    turn(LANDSCAPE);
    // The portrait insets left a band across the top and none at the sides, so the game ran
    // under the Dynamic Island.
    expect(paddingOf(tree, 'gb-iam-game-frame')).toEqual(LANDSCAPE.insets);

    turn(PORTRAIT);
    expect(paddingOf(tree, 'gb-iam-game-frame')).toEqual(PORTRAIT.insets);
    unmount(tree);
  });

  it("keeps its close button at the safe area's top end when the phone turns", () => {
    const tree = showing(game('fullscreen'), gamePresenter());
    turn(LANDSCAPE);

    const close = styleOf(tree, 'gb-iam-close');
    expect(close.top).toBe(FullscreenMetrics.closeInset);
    expect(close.end).toBe(FullscreenMetrics.closeInset + 62);
    unmount(tree);
  });

  it('takes the end inset from the side the layout ends on', () => {
    const tree = showing(game('fullscreen'), gamePresenter());
    turn(ONE_SIDED);
    // Left to right, the end is the right, which has no cutout here.
    expect(styleOf(tree, 'gb-iam-close').end).toBe(
      FullscreenMetrics.closeInset
    );
    unmount(tree);

    jest.replaceProperty(I18nManager, 'isRTL', true);
    const mirrored = showing(game('fullscreen'), gamePresenter());
    // Right to left, `end` is the left, where the cutout is.
    expect(styleOf(mirrored, 'gb-iam-close').end).toBe(
      FullscreenMetrics.closeInset + 48
    );
    unmount(mirrored);
  });

  it("uses the app's own insets edge by edge, and the device's for the rest", () => {
    const presenter = gamePresenter();
    const Host = createGameballInAppMessages(presenter);
    const tree = showing(
      game('fullscreen'),
      presenter,
      <Host insets={{ top: 47 }} />
    );
    expect(paddingOf(tree, 'gb-iam-game-frame')).toEqual({
      ...PORTRAIT.insets,
      top: 47,
    });

    turn(LANDSCAPE);
    expect(paddingOf(tree, 'gb-iam-game-frame')).toEqual({
      ...LANDSCAPE.insets,
      top: 47,
    });
    unmount(tree);
  });
});

describe('a modal game', () => {
  it('is no taller than the safe height less its margins, both ways up, and keeps its shape', () => {
    const tree = showing(game('modal'), gamePresenter());
    // Centred on the screen, as every modal is, so the larger inset bounds both ends.
    expect(styleOf(tree, 'gb-iam-game-card').maxHeight).toBe(
      874 - 2 * (62 + ModalMetrics.margin)
    );

    turn(LANDSCAPE);
    // 70% of the window left a 193 x 276 card in landscape, too short for any of the scratch
    // area to show.
    expect(styleOf(tree, 'gb-iam-game-card').maxHeight).toBe(
      402 - 2 * (21 + ModalMetrics.margin)
    );
    expect(styleOf(tree, 'gb-iam-game-card').aspectRatio).toBe(0.7);
    unmount(tree);
  });
});

describe('a full-screen message', () => {
  it('keeps its copy inside the safe area on every side when the phone turns', () => {
    const tree = showing(
      message({ type: 'fullscreen' }),
      new ReactMessagePresenter({})
    );
    expect(paddingOf(tree, 'gb-iam-fullscreen')).toEqual(PORTRAIT.insets);

    turn(LANDSCAPE);
    expect(paddingOf(tree, 'gb-iam-fullscreen')).toEqual(LANDSCAPE.insets);
    unmount(tree);
  });

  it("keeps its close button at the safe area's top end when the phone turns", () => {
    const tree = showing(
      message({ type: 'fullscreen' }),
      new ReactMessagePresenter({})
    );
    turn(LANDSCAPE);

    const close = styleOf(tree, 'gb-iam-close');
    expect(close.top).toBe(FullscreenMetrics.closeInset);
    expect(close.end).toBe(FullscreenMetrics.closeInset + 62);
    unmount(tree);
  });

  it("takes its close button's end inset from the side the layout ends on", () => {
    const tree = showing(
      message({ type: 'fullscreen' }),
      new ReactMessagePresenter({})
    );
    turn(ONE_SIDED);
    expect(styleOf(tree, 'gb-iam-close').end).toBe(
      FullscreenMetrics.closeInset
    );
    unmount(tree);

    jest.replaceProperty(I18nManager, 'isRTL', true);
    const mirrored = showing(
      message({ type: 'fullscreen' }),
      new ReactMessagePresenter({})
    );
    expect(styleOf(mirrored, 'gb-iam-close').end).toBe(
      FullscreenMetrics.closeInset + 48
    );
    unmount(mirrored);
  });

  it('keeps the buttons over an image-only poster clear of the sides when the phone turns', () => {
    const poster = message({
      type: 'fullscreen',
      layout: 'image_only',
      imageUrl: 'https://cdn.test/poster.png',
      header: null,
      body: null,
      buttons: [
        {
          id: 'b0',
          text: 'Play',
          action: null,
          style: {},
        } as unknown as MessageButton,
      ],
    });
    const tree = showing(
      poster,
      new ReactMessagePresenter({
        artwork: () => ({
          uri: 'data:image/png;base64,aGVybw==',
          width: 1200,
          height: 800,
        }),
      })
    );
    turn(LANDSCAPE);
    // The poster runs edge to edge; the buttons over it keep to the safe area.
    const { left, right } = paddingOf(tree, 'gb-iam-buttons');
    expect(left).toBe(
      FullscreenMetrics.imageOnlyButtonsPadding.horizontal + 62
    );
    expect(right).toBe(
      FullscreenMetrics.imageOnlyButtonsPadding.horizontal + 62
    );
    unmount(tree);
  });
});

describe('where the insets are measured', () => {
  it.each([
    [
      'a slide-up',
      () =>
        showing(message({ type: 'slideup' }), new ReactMessagePresenter({})),
    ],
    ['a game still loading', () => showing(game('modal'), gamePresenter())],
  ])('lets every touch through to the app around %s', (_, show) => {
    const tree = show();
    // The package's native view, which no React type names.
    const measuring = tree.root.findAll(
      (n) => (n.type as unknown) === 'RNCSafeAreaProvider'
    );
    expect(measuring.length).toBeGreaterThan(0);
    for (const layer of measuring) {
      expect(layer.props.pointerEvents).toBe('box-none');
    }
    unmount(tree);
  });
});
