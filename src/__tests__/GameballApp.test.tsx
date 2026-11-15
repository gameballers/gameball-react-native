import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import GameballApp from '../GameballApp';
import GameballWidget from '../GameballWidget';
import { API_ENDPOINTS } from '../constants';
import { GameballInAppMessages, inAppMessaging } from '../InAppMessaging';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('react-native-device-info', () =>
  require('react-native-device-info/jest/react-native-device-info-mock')
);

const ALPHA_WIDGET = 'https://m.gameball.app/alpha';

/** Every request answers 200 with an empty body unless a route says otherwise. */
function serve(routes: Record<string, string> = {}) {
  globalThis.fetch = jest.fn(async (input: unknown) => {
    const url = String(input);
    const route = Object.keys(routes).find((suffix) => url.includes(suffix));
    const body = route === undefined ? '{}' : routes[route]!;
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => body,
      json: async () => JSON.parse(body),
    };
  }) as unknown as typeof fetch;
}

const app = () => GameballApp.getInstance();

beforeEach(() => {
  serve();
  // showProfile warns when no <GameballWidget /> is mounted, which none of these need.
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  app().stopInAppMessaging();
  jest.restoreAllMocks();
});

describe('the widget host', () => {
  it('is set once on the configuration and loaded by the profile widget', async () => {
    await app().init({
      apiKey: 'k',
      lang: 'en',
      widgetUrlPrefix: ALPHA_WIDGET,
      debug: false,
    });

    await app().showProfile({ customerId: 'c1' });

    expect(GameballWidget.widgetUrlPrefix).toBe(ALPHA_WIDGET);
  });

  it('is still overridden by a showProfile that passes its own, for that presentation only', async () => {
    await app().init({
      apiKey: 'k',
      lang: 'en',
      widgetUrlPrefix: ALPHA_WIDGET,
      debug: false,
    });

    await app().showProfile({
      customerId: 'c1',
      widgetUrlPrefix: 'https://widget.example.test',
    });
    expect(GameballWidget.widgetUrlPrefix).toBe('https://widget.example.test');

    await app().showProfile({ customerId: 'c1' });
    expect(GameballWidget.widgetUrlPrefix).toBe(ALPHA_WIDGET);
  });

  it('is production when none is configured', async () => {
    await app().init({ apiKey: 'k', lang: 'en', debug: false });

    await app().showProfile({ customerId: 'c1' });

    expect(GameballWidget.widgetUrlPrefix).toBe(API_ENDPOINTS.WIDGET_BASE_URL);
  });

  it('reaches in-app messaging too, which has no showProfile call to take one from', async () => {
    await app().init({
      apiKey: 'k',
      lang: 'en',
      widgetUrlPrefix: ALPHA_WIDGET,
      debug: false,
    });

    expect(
      (inAppMessaging as unknown as { config: { widgetUrlPrefix?: string } })
        .config.widgetUrlPrefix
    ).toBe(ALPHA_WIDGET);
  });
});

describe('a game campaign', () => {
  /** A wheel the merchant set to open at session start, as the sync returns it. */
  const GAME_SYNC = JSON.stringify({
    cooldownSeconds: 30,
    quietHours: null,
    campaignOrdering: null,
    messages: [
      {
        campaignType: 2,
        campaignId: 0,
        variationId: 0,
        dispatchId: null,
        name: 'Spin the Wheel',
        priority: 0,
        messageType: 2,
        trigger: {
          type: 'session_start',
          repeatable: true,
          minIntervalSeconds: null,
        },
        content: null,
        locale: null,
        localeCode: null,
        expiresAt: null,
        isTest: false,
        gameCampaignId: 9645,
        gameCampaignType: 'wheel',
      },
    ],
  });

  beforeEach(() => {
    // The profile widget as an app that never opened it leaves it: nothing set.
    Object.assign(GameballWidget, {
      apiKey: '',
      customerId: null,
      sessionToken: '',
      lang: '',
      widgetUrlPrefix: '',
    });
  });

  /** Signs a customer in, starts messaging with the host mounted, and reads the game's url. */
  async function openGame(beforeStart?: () => Promise<void>): Promise<string> {
    serve({ '/inapp-messages/sync': GAME_SYNC });
    await app().init({
      apiKey: 'k',
      lang: 'en',
      apiPrefix: 'https://api.test',
      widgetUrlPrefix: ALPHA_WIDGET,
      debug: false,
    });
    await app().initializeCustomer({ customerId: 'c1' }, undefined, 'tok');
    await beforeStart?.();

    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<GameballInAppMessages />);
    });
    await act(async () => {
      await app().startInAppMessaging();
    });
    const webViews = tree.root.findAll(
      (n) => typeof n.type === 'string' && n.props.testID === 'gb-webview'
    );
    const url = webViews[0]?.props.source?.uri as string | undefined;
    act(() => {
      tree.unmount();
    });
    if (!url) {
      throw new Error('no game was opened');
    }
    return url;
  }

  it('opens without showProfile ever having been called', async () => {
    const url = await openGame();

    expect(url.startsWith(`${ALPHA_WIDGET}?`)).toBe(true);
    expect(url).toContain('apiKey=k');
    expect(url).toContain('customerId=c1');
    expect(url).toContain('lang=en');
    expect(url).toContain('sessionToken=tok');
    expect(url).toContain('openDetail=details_wheel_9645');
  });

  it('opens for the customer messaging runs for, not the one the profile widget last showed', async () => {
    const url = await openGame(async () => {
      await app().showProfile({ customerId: 'someone-else' });
    });

    expect(url).toContain('customerId=c1');
    expect(url).not.toContain('someone-else');
  });
});
