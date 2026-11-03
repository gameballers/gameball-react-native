import { InAppMessagingController } from '../controller';
import type { PresentedMessage } from '../presentation/message-presenter';
import { installFileReader, stubBlob } from './support/file-reader-stub';
import {
  imageSizes,
  openedUrls,
  resetReactNativeStub,
} from './support/react-native-stub';

/**
 * The controller is the React Native-specific orchestration layer: it owns the lifecycle the host
 * drives, the hooks the host supplies and the one security boundary the SDK has — what a campaign
 * is allowed to open. None of that is covered by the vendored core's own tests.
 */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function controller() {
  const c = new InAppMessagingController();
  c.configure({
    apiKey: 'k',
    apiBaseUrl: 'https://api.test',
    lang: 'en',
    debug: false,
  });
  return c;
}

/**
 * The openUrl the controller handed the service — the same function a campaign's action reaches.
 * Read off the service because that is where the controller's decision actually lands; calling it
 * directly is what a campaign does.
 */
function openUrlOf(
  c: InAppMessagingController
): (url: string, external: boolean) => Promise<boolean> {
  const service = (c as unknown as { service: unknown }).service;
  if (!service) {
    throw new Error('messaging was never started, so there is no service');
  }
  return (
    service as { openUrl: (url: string, external: boolean) => Promise<boolean> }
  ).openUrl;
}

beforeEach(() => {
  resetReactNativeStub();
});

describe('what a campaign may open', () => {
  it.each([
    ['https://example.test/offer', true],
    ['http://example.test/offer', true],
    ['mailto:support@example.test', true],
    ['tel:+201234567890', true],
    ['javascript:alert(1)', false],
    ['file:///etc/passwd', false],
    ['myapp://transfer?to=someone', false],
    ['/offers', false],
    ['', false],
  ])('%s → %s', async (url, allowed) => {
    const ctl = controller();
    await ctl.start({ customerId: 'c1' }).catch(() => undefined);
    const openUrl = openUrlOf(ctl);
    openedUrls.length = 0;
    const opened = await openUrl(url, true);
    expect(opened).toBe(allowed);
    expect(openedUrls).toEqual(allowed ? [url] : []);
  });
});

describe('lifecycle', () => {
  it('lets go of the customer on stop, so the next start cannot resume them', async () => {
    const c = controller();
    c.identified('customer-a', 'en');
    await c.start();
    expect((c as unknown as { customerId: string | null }).customerId).toBe(
      'customer-a'
    );

    c.stop();
    await c.start();

    // No customer was identified after the stop, so there is nothing to start for — rather than
    // quietly showing customer A's messages to whoever is holding the phone now.
    expect(
      (c as unknown as { customerId: string | null }).customerId
    ).toBeNull();
    expect(c.isStarted).toBe(false);
  });

  it('is not brought back to life by a start that was already in flight', async () => {
    const c = controller();
    const starting = c.start({ customerId: 'c1' });
    c.stop();
    await starting;
    await flush();
    expect(c.isStarted).toBe(false);
  });

  it('uses the hooks from the most recent start, not the first', async () => {
    const c = controller();
    const first = jest.fn(() => true);
    const second = jest.fn(() => true);

    await c.start({ customerId: 'c1', openUrl: first });
    await c.start({ customerId: 'c1', openUrl: second });

    await openUrlOf(c)('https://example.test', true);
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });

  it('asks for campaigns in the language it was last told to use', () => {
    // GameballApp.changeLanguage updates its own config; messaging holds a separate one and has to
    // be told, or it goes on syncing in the language init() was given for the life of the app.
    const c = controller();
    const language = () =>
      (c as unknown as { language: () => string }).language.call(c);
    expect(language()).toBe('en');
    c.setLanguage('ar');
    expect(language()).toBe('ar');

    // A customer's own declared language still wins, as it does on every Gameball SDK.
    c.identified('a', 'fr');
    expect(language()).toBe('fr');
  });

  it('keeps a language only for the customer who declared it', () => {
    const c = controller();
    c.identified('a', 'ar');
    expect(
      (c as unknown as { preferredLanguage: string | null }).preferredLanguage
    ).toBe('ar');
    c.identified('b');
    expect(
      (c as unknown as { preferredLanguage: string | null }).preferredLanguage
    ).toBeNull();
  });
});

describe('artwork', () => {
  const IMAGE = 'https://cdn.test/hero.png';
  const HELD = 'data:image/png;base64,aGVybw==';
  const realFetch = globalThis.fetch;
  let removeFileReader = () => {};

  afterEach(() => {
    globalThis.fetch = realFetch;
    removeFileReader();
  });

  /** One modal with an image, shown at session start — the shape the sync endpoint returns. */
  const syncBody = JSON.stringify({
    cooldownSeconds: 30,
    quietHours: null,
    campaignOrdering: null,
    messages: [
      {
        campaignId: 1,
        variationId: 9,
        dispatchId: 'd-1',
        name: 'Hero',
        priority: 2,
        messageType: 2,
        trigger: {
          type: 'session_start',
          repeatable: false,
          minIntervalSeconds: null,
        },
        contentMode: 'prerendered',
        content: { closeBehaviour: 'both', imageUrl: IMAGE, buttons: null },
        locale: { header: 'H', message: 'B', buttons: null },
        isTest: false,
        expiresAt: null,
      },
    ],
  });

  it('hands the presenter the very images the service loaded, so an image message reaches the screen', async () => {
    removeFileReader = installFileReader();
    imageSizes.set(HELD, { width: 1200, height: 800 });
    const serve = async (input: string): Promise<unknown> => {
      if (input === IMAGE) {
        return {
          ok: true,
          status: 200,
          blob: async () => stubBlob('aGVybw=='),
        };
      }
      if (input.endsWith('/inapp-messages/sync')) {
        return { ok: true, status: 200, text: async () => syncBody };
      }
      return {
        ok: true,
        status: 200,
        text: async () => '{}',
        json: async () => ({}),
      };
    };
    globalThis.fetch = jest.fn(serve) as unknown as typeof fetch;

    const c = controller();
    const screen: { entry: PresentedMessage | null } = { entry: null };
    c.presenter.attach((entry) => {
      screen.entry = entry;
    });
    await c.start({ customerId: 'c1' });

    expect(screen.entry?.message.imageUrl).toBe(IMAGE);
    expect(screen.entry?.artwork.image).toEqual({
      uri: HELD,
      width: 1200,
      height: 800,
    });
    c.stop();
  });
});
