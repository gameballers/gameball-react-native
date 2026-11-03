import GameballApp from '../GameballApp';
import GameballWidget from '../GameballWidget';
import { API_ENDPOINTS } from '../constants';
import { inAppMessaging } from '../InAppMessaging';

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
