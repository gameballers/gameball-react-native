jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('react-native-device-info', () =>
  require('react-native-device-info/jest/react-native-device-info-mock')
);
jest.mock('../GameballWidget', () => ({
  __esModule: true,
  default: { isOpen: () => false, onClosed: null },
}));
jest.mock('../InAppMessaging', () => ({
  inAppMessaging: {
    configure: jest.fn(),
    identified: jest.fn(),
    onHostWidgetClosed: jest.fn(),
    onCustomEvent: jest.fn(),
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import GameballApp from '../GameballApp';
import { STORAGE_KEYS } from '../constants';

const fetchMock = jest.fn();
(global as any).fetch = fetchMock;

const ENGAGEMENT_URL =
  'https://api.gameball.co/api/v4.0/integrations/mobile/push-engagement';
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const pushClickCalls = () =>
  fetchMock.mock.calls.filter(([url]) => url === ENGAGEMENT_URL);

const savedPushes = async () =>
  JSON.parse(
    (await AsyncStorage.getItem(STORAGE_KEYS.RECEIVED_PUSHES)) ?? '[]'
  );

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('GameballApp push handling', () => {
  const app = GameballApp.getInstance();
  let logSpy: jest.SpyInstance;

  beforeAll(() => {
    // The influenced-open check after an app open waits on a timer; keep it from outliving the tests
    jest.useFakeTimers({
      doNotFake: ['setImmediate', 'nextTick', 'queueMicrotask'],
    });
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '',
    });
  });

  it('saves an arriving Gameball push before init (headless background handler)', async () => {
    const result = await app.handlePushReceived(
      { isGB: 'true', gbClickToken: 'tok-early' },
      1_000
    );

    expect(result).toBe(true);
    expect((await savedPushes()).map((p: any) => p.key)).toEqual(['tok-early']);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ignores a push that is not a Gameball one', async () => {
    expect(await app.handlePushReceived({ title: 'other app' }, 1_000)).toBe(
      false
    );
    expect(app.handlePushClick({ title: 'other app' })).toBe(false);
  });

  it('reports an error for a tap before init, and still reports that tap after init', async () => {
    const onError = jest.fn();
    expect(
      app.handlePushClick(
        { isGB: 'true', gbClickToken: 'tok-before-init' },
        { onError }
      )
    ).toBe(true);
    expect(onError).toHaveBeenCalled();
    expect(pushClickCalls()).toHaveLength(0);
    await flush();
    // A tapped push is never an influenced open
    expect((await savedPushes()).map((p: any) => p.key)).not.toContain(
      'tok-before-init'
    );

    await app.init({ apiKey: 'key' } as any);
    fetchMock.mockClear();

    const onSuccess = jest.fn();
    app.handlePushClick(
      { isGB: 'true', gbClickToken: 'tok-before-init' },
      { onSuccess }
    );
    await flush();
    expect(pushClickCalls()).toHaveLength(1);
    expect(onSuccess).toHaveBeenCalledWith(true);
  });

  it('reports the same tap once, however often it is passed in', async () => {
    const first = jest.fn();
    const second = jest.fn();

    expect(
      app.handlePushClick(
        { isGB: 'true', gbClickToken: 'tok-1' },
        { onSuccess: first }
      )
    ).toBe(true);
    expect(
      app.handlePushClick(
        { isGB: 'True', gbClickToken: 'tok-1' },
        { onSuccess: second }
      )
    ).toBe(true);
    await flush();

    expect(pushClickCalls()).toHaveLength(1);
    expect(JSON.parse(pushClickCalls()[0]![1].body)).toEqual({
      clickToken: 'tok-1',
      engagementType: 1,
      eventUid: expect.stringMatching(UUID_V4),
      occurredAt: expect.stringMatching(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      ),
    });
    expect(first).toHaveBeenCalledWith(true);
    expect(second).toHaveBeenCalledWith(true);
    expect(
      logSpy.mock.calls.filter(
        ([line]) =>
          line === 'GameballApp engagement push_click clickToken=tok-1'
      )
    ).toHaveLength(1);
  });

  it('removes a tapped push from the saved pushes', async () => {
    await app.handlePushReceived(
      { isGB: 'true', gbClickToken: 'tok-2' },
      1_000
    );
    app.handlePushClick({ isGB: 'true', gbClickToken: 'tok-2' });
    await flush();

    expect((await savedPushes()).map((p: any) => p.key)).not.toContain('tok-2');
  });

  it('reports a tap as Clicked to push-engagement, dated when it is handled, and never calls push-click', async () => {
    jest.setSystemTime(new Date('2026-11-09T18:10:00.123Z'));
    app.handlePushClick({ isGB: 'true', gbClickToken: 'tok-3' });
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, request] = fetchMock.mock.calls[0]!;
    expect(url).toBe(ENGAGEMENT_URL);
    expect(request.method).toBe('POST');
    expect(request.headers.APIKey).toBe('key');
    expect(JSON.parse(request.body)).toEqual({
      clickToken: 'tok-3',
      engagementType: 1,
      eventUid: expect.stringMatching(UUID_V4),
      occurredAt: '2026-11-09T18:10:00.123Z',
    });
    expect(
      fetchMock.mock.calls.some(([u]) => String(u).includes('push-click'))
    ).toBe(false);
  });

  it('stays on v4.0 with a session token, sending it as today', async () => {
    app.handlePushClick(
      { isGB: 'true', gbClickToken: 'tok-4' },
      undefined,
      'session-abc'
    );
    await flush();

    const [url, request] = fetchMock.mock.calls[0]!;
    expect(url).toBe(ENGAGEMENT_URL);
    expect(request.headers['X-GB-TOKEN']).toBe('session-abc');
  });

  it('gives each tap its own eventUid', async () => {
    app.handlePushClick({ isGB: 'true', gbClickToken: 'tok-5' });
    app.handlePushClick({ isGB: 'true', gbClickToken: 'tok-6' });
    await flush();

    const uids = pushClickCalls().map(([, r]) => JSON.parse(r.body).eventUid);
    expect(uids).toHaveLength(2);
    expect(uids[0]).not.toBe(uids[1]);
  });

  it('passes a failed report to onError, as before', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: async () => '',
    });
    const onError = jest.fn();
    expect(
      app.handlePushClick({ isGB: 'true', gbClickToken: 'tok-7' }, { onError })
    ).toBe(true);
    await flush();

    expect(onError).toHaveBeenCalledWith(new Error('HTTP 404: Not Found'));
  });

  it('sends nothing for a tap without a click token', async () => {
    expect(
      app.handlePushClick({ 'isGB': 'true', 'google.message_id': 'm-9' })
    ).toBe(true);
    await flush();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forgets saved pushes when a different customer is initialized', async () => {
    await app.initializeCustomer({ customerId: 'customer-a' } as any);
    await app.handlePushReceived(
      { isGB: 'true', gbClickToken: 'tok-a' },
      1_000
    );

    // Same customer again: kept
    await app.initializeCustomer({ customerId: 'customer-a' } as any);
    expect((await savedPushes()).map((p: any) => p.key)).toContain('tok-a');

    // Another customer: cleared
    await app.initializeCustomer({ customerId: 'customer-b' } as any);
    expect(await savedPushes()).toEqual([]);
  });
});
