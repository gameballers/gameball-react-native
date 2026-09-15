import {
  BatchedMessageAnalytics,
  type SendResult,
} from '../../analytics/analytics';
import {
  createMessageEvent,
  type MessageEvent,
} from '../../analytics/message-event';
import { MemoryStore } from '../../storage/key-value-store';

const ev = (n: number) =>
  createMessageEvent({ type: 'impression', campaignId: n, occurredAtMs: n });

type Sent = { customerId: string; events: MessageEvent[] };

function harness(
  result: SendResult | (() => SendResult) = 'accepted',
  opts: Partial<ConstructorParameters<typeof BatchedMessageAnalytics>[0]> = {}
) {
  const sent: Sent[] = [];
  const store = new MemoryStore();
  const analytics = new BatchedMessageAnalytics({
    store,
    send: async (customerId, events) => {
      sent.push({ customerId, events });
      return typeof result === 'function' ? result() : result;
    },
    ...opts,
  });
  analytics.load();
  return { analytics, sent, store };
}

const stored = (store: MemoryStore) =>
  JSON.parse(store.get('gameball_iam_analytics_outbox') ?? '[]') as {
    customerId: string;
    event: MessageEvent;
  }[];

describe('BatchedMessageAnalytics', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('buffers, persists with the customer pinned, and flushes on the interval', async () => {
    const { analytics, sent, store } = harness();
    analytics.log(ev(1), 'c1');
    expect(analytics.bufferedCount).toBe(1);
    expect(stored(store)).toMatchObject([
      { customerId: 'c1', event: { campaignId: 1 } },
    ]);
    expect(analytics.hasScheduledFlush).toBe(true);
    await jest.advanceTimersByTimeAsync(30_000);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.customerId).toBe('c1');
    expect(analytics.bufferedCount).toBe(0);
    expect(store.get('gameball_iam_analytics_outbox')).toBeNull();
  });

  it('flushes immediately at the batch size', async () => {
    const { analytics, sent } = harness();
    for (let i = 0; i < 10; i++) analytics.log(ev(i), 'c1');
    await jest.advanceTimersByTimeAsync(0);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.events).toHaveLength(10);
  });

  it('chunks a backlog at 50 per request and drains without waiting', async () => {
    const { analytics, sent } = harness('accepted', { batchSize: 1000 });
    for (let i = 0; i < 120; i++) analytics.log(ev(i), 'c1');
    await analytics.flush();
    await jest.advanceTimersByTimeAsync(0);
    expect(sent.map((b) => b.events.length)).toEqual([50, 50, 20]);
  });

  it('sends each customer their own batch, oldest customer first, never mixing them', async () => {
    const { analytics, sent } = harness('accepted', { batchSize: 1000 });
    analytics.log(ev(1), 'c1');
    analytics.log(ev(2), 'c2');
    analytics.log(ev(3), 'c1');
    await analytics.flushAll();
    expect(
      sent.map((b) => [b.customerId, b.events.map((e) => e.campaignId)])
    ).toEqual([
      ['c1', [1, 3]],
      ['c2', [2]],
    ]);
    expect(analytics.bufferedCount).toBe(0);
  });

  it('flushAll drains everything in one awaited call and stops at a retry', async () => {
    let result: SendResult = 'accepted';
    const { analytics, sent } = harness(() => result, { batchSize: 1000 });
    for (let i = 0; i < 120; i++) analytics.log(ev(i), 'c1');
    await analytics.flushAll();
    expect(sent.map((b) => b.events.length)).toEqual([50, 50, 20]);
    for (let i = 0; i < 3; i++) analytics.log(ev(i), 'c1');
    result = 'retry';
    await analytics.flushAll();
    expect(analytics.bufferedCount).toBe(3);
    expect(analytics.hasScheduledFlush).toBe(true);
  });

  it('keeps events on retry and re-arms; discards a poison batch', async () => {
    let result: SendResult = 'retry';
    const { analytics, sent } = harness(() => result);
    analytics.log(ev(1), 'c1');
    await analytics.flush();
    expect(analytics.bufferedCount).toBe(1);
    expect(analytics.hasScheduledFlush).toBe(true);
    result = 'discard';
    await analytics.flush();
    expect(analytics.bufferedCount).toBe(0);
    expect(sent).toHaveLength(2);
  });

  it('a thrown sender is a retry', async () => {
    const store = new MemoryStore();
    const analytics = new BatchedMessageAnalytics({
      store,
      send: async () => {
        throw new Error('offline');
      },
    });
    analytics.load();
    analytics.log(ev(1), 'c1');
    await analytics.flush();
    expect(analytics.bufferedCount).toBe(1);
  });

  it('drops the oldest past the ceiling', () => {
    const { analytics } = harness('accepted', {
      maxBuffered: 5,
      batchSize: 1000,
    });
    for (let i = 0; i < 7; i++) analytics.log(ev(i), 'c1');
    expect(analytics.bufferedCount).toBe(5);
  });

  it('restores an unsent outbox on load under its original customer and never regenerates eventUids', async () => {
    const store = new MemoryStore();
    const first = new BatchedMessageAnalytics({
      store,
      send: async () => 'retry',
    });
    first.load();
    const e = ev(1);
    first.log(e, 'c1');
    await first.flush();
    first.dispose();
    const sent: Sent[] = [];
    const second = new BatchedMessageAnalytics({
      store,
      send: async (customerId, events) => {
        sent.push({ customerId, events });
        return 'accepted';
      },
    });
    second.load();
    expect(second.bufferedCount).toBe(1);
    await second.flush();
    expect(sent[0]!.customerId).toBe('c1');
    expect(sent[0]!.events[0]!.eventUid).toBe(e.eventUid);
  });

  it('drops stored entries that carry no customer attribution instead of guessing', () => {
    const store = new MemoryStore();
    store.set(
      'gameball_iam_analytics_outbox',
      JSON.stringify([ev(1), { customerId: 'c2', event: ev(2) }, 'garbage'])
    );
    const analytics = new BatchedMessageAnalytics({
      store,
      send: async () => 'accepted',
    });
    analytics.load();
    expect(analytics.bufferedCount).toBe(1);
    expect(stored(store)).toMatchObject([{ customerId: 'c2' }]);
  });

  it('dispose cancels the timer and blocks re-arming until load', async () => {
    const { analytics } = harness('retry');
    analytics.log(ev(1), 'c1');
    analytics.dispose();
    expect(analytics.hasScheduledFlush).toBe(false);
    await analytics.flush();
    expect(analytics.hasScheduledFlush).toBe(false);
  });

  it('a flush while one is in flight is a no-op', async () => {
    let resolve!: (r: SendResult) => void;
    const sent: Sent[] = [];
    const analytics = new BatchedMessageAnalytics({
      store: new MemoryStore(),
      send: (customerId, events) => {
        sent.push({ customerId, events });
        return new Promise<SendResult>((r) => {
          resolve = r;
        });
      },
    });
    analytics.load();
    analytics.log(ev(1), 'c1');
    const p1 = analytics.flush();
    const p2 = analytics.flush();
    resolve('accepted');
    await Promise.all([p1, p2]);
    expect(sent).toHaveLength(1);
  });

  it('removes exactly the sent events by identity when the ceiling trims during an in-flight send', async () => {
    let resolveSend!: (r: SendResult) => void;
    const sent: Sent[] = [];
    const store = new MemoryStore();
    const analytics = new BatchedMessageAnalytics({
      store,
      send: (customerId, events) => {
        sent.push({ customerId, events });
        return new Promise<SendResult>((r) => {
          resolveSend = r;
        });
      },
      maxBuffered: 5,
      maxPerRequest: 3,
      batchSize: 1000,
    });
    analytics.load();
    for (let i = 0; i < 5; i++) analytics.log(ev(i), 'c1');
    const p = analytics.flush();
    analytics.log(ev(5), 'c1');
    analytics.log(ev(6), 'c1');
    resolveSend('accepted');
    await p;
    expect(sent[0]!.events.map((e) => e.campaignId)).toEqual([0, 1, 2]);
    expect(analytics.bufferedCount).toBe(4);
    expect(stored(store).map((e) => e.event.campaignId)).toEqual([3, 4, 5, 6]);
  });

  it('dispose then load restores the buffer without duplicating it', async () => {
    const store = new MemoryStore();
    const sent: Sent[] = [];
    const analytics = new BatchedMessageAnalytics({
      store,
      send: async (customerId, events) => {
        sent.push({ customerId, events });
        return 'accepted';
      },
    });
    analytics.load();
    const e1 = ev(1);
    const e2 = ev(2);
    analytics.log(e1, 'c1');
    analytics.log(e2, 'c1');
    analytics.dispose();
    analytics.load();
    expect(analytics.bufferedCount).toBe(2);
    await analytics.flush();
    expect(sent[0]!.events.map((e) => e.eventUid).sort()).toEqual(
      [e1.eventUid, e2.eventUid].sort()
    );
  });

  it('a stop-time flush drains storage too, so the next page load does not resend the batch', async () => {
    let resolveSend!: (r: SendResult) => void;
    const store = new MemoryStore();
    const analytics = new BatchedMessageAnalytics({
      store,
      send: () =>
        new Promise<SendResult>((r) => {
          resolveSend = r;
        }),
    });
    analytics.load();
    analytics.log(ev(1), 'c1');
    const p = analytics.flush();
    analytics.dispose(); // stop() flushes and disposes in the same breath
    resolveSend('accepted');
    await p;
    const next = new BatchedMessageAnalytics({
      store,
      send: async () => 'accepted',
    });
    next.load();
    expect(next.bufferedCount).toBe(0);
  });

  it('dispose stops future sends and drains the accepted batch from storage, but writes nothing new', async () => {
    let resolveSend!: (r: SendResult) => void;
    const sent: Sent[] = [];
    const store = new MemoryStore();
    const analytics = new BatchedMessageAnalytics({
      store,
      send: (customerId, events) => {
        sent.push({ customerId, events });
        return new Promise<SendResult>((r) => {
          resolveSend = r;
        });
      },
    });
    analytics.load();
    analytics.log(ev(1), 'c1');
    const p = analytics.flush();
    analytics.dispose();
    for (let i = 2; i <= 11; i++) analytics.log(ev(i), 'c1');
    expect(sent).toHaveLength(1);
    resolveSend('accepted');
    await p;
    expect(store.get('gameball_iam_analytics_outbox')).toBeNull();
    expect(analytics.bufferedCount).toBe(10);
    expect(analytics.hasScheduledFlush).toBe(false);
  });
});
