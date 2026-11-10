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

import { AppState } from 'react-native';
import GameballApp from '../GameballApp';

const ENGAGEMENT_URL =
  'https://api.gameball.co/api/v4.0/integrations/mobile/push-engagement';
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const fetchMock = jest.fn();
(global as any).fetch = fetchMock;

const settle = async () => {
  for (let i = 0; i < 10; i++) {
    await new Promise((resolve) => setImmediate(resolve));
  }
};

const engagementBodies = () =>
  fetchMock.mock.calls
    .filter(([url]) => url === ENGAGEMENT_URL)
    .map(([, request]) => JSON.parse(request.body));

describe('GameballApp influenced opens', () => {
  const app = GameballApp.getInstance();
  let toForeground: (state: string) => void;

  beforeAll(async () => {
    jest.useFakeTimers({
      doNotFake: ['setImmediate', 'nextTick', 'queueMicrotask'],
    });
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockResolvedValue({
      ok: true,
      status: 202,
      text: async () => '',
    });

    // React Native's jest AppState has no state of its own; start in the background
    (AppState as any).currentState = 'background';
    await app.init({ apiKey: 'key' } as any);
    const calls = (AppState.addEventListener as jest.Mock).mock.calls;
    toForeground = calls[calls.length - 1]![1];
  });

  it('reports an influenced open as InfluencedOpen, dated at the open, after the wait', async () => {
    jest.setSystemTime(new Date('2026-11-09T18:00:00.000Z'));
    await app.handlePushReceived(
      { isGB: 'true', gbClickToken: 'tok-inf' },
      Date.now() - 1_000
    );
    jest.setSystemTime(new Date('2026-11-09T18:05:00.000Z'));
    fetchMock.mockClear();

    toForeground('active'); // the customer opens the app from the icon
    await settle();
    expect(engagementBodies()).toEqual([]); // nothing until the wait is over

    jest.advanceTimersByTime(10_000);
    await settle();

    expect(engagementBodies()).toEqual([
      {
        clickToken: 'tok-inf',
        engagementType: 3,
        eventUid: expect.stringMatching(UUID_V4),
        occurredAt: '2026-11-09T18:05:00.000Z',
      },
    ]);
  });

  it('reports only the tap when a tap opened the app', async () => {
    toForeground('background');
    jest.setSystemTime(new Date('2026-11-09T19:00:00.000Z'));
    await app.handlePushReceived({ isGB: 'true', gbClickToken: 'tok-A' }, 1);
    await app.handlePushReceived({ isGB: 'true', gbClickToken: 'tok-B' }, 2);
    jest.setSystemTime(new Date('2026-11-09T19:01:00.000Z'));
    fetchMock.mockClear();

    toForeground('active');
    app.handlePushClick({ isGB: 'true', gbClickToken: 'tok-B' });
    jest.advanceTimersByTime(10_000);
    await settle();

    expect(engagementBodies()).toEqual([
      expect.objectContaining({ clickToken: 'tok-B', engagementType: 1 }),
    ]);
  });
});
