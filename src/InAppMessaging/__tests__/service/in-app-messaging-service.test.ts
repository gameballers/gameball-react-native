import { InAppMessagingService } from '../../service/in-app-messaging-service';
import { InMemoryFrequencyCap } from '../../evaluation/frequency-cap';
import type { Campaign } from '../../models/campaign';
import type { PropertyFilter } from '../../models/property-filter';
import type { SyncResult } from '../../source/sync-result';
import { campaign, message, T0 } from '../helpers/fixtures';
import {
  FakeCache,
  FakePrefetcher,
  FakePresenter,
  FakeSource,
  FakeVariables,
  RecordingAnalytics,
} from './fakes';

const eventTrigger = (eventName: string, filters: PropertyFilter[] = []) => ({
  kind: 'event' as const,
  eventName,
  filters,
});
const sync = (
  campaigns: Campaign[],
  over: Partial<SyncResult> = {}
): SyncResult => ({
  campaigns,
  cooldownMs: 30_000,
  quietHours: null,
  rawJson: JSON.stringify({ messages: [] }),
  ...over,
});

function harness(
  result: SyncResult | (() => SyncResult) | Error,
  opts: { overlayOpen?: () => boolean; hasSurface?: () => boolean } = {}
) {
  let now = T0;
  const source = new FakeSource(result);
  const presenter = new FakePresenter();
  const analytics = new RecordingAnalytics();
  const cache = new FakeCache();
  const prefetcher = new FakePrefetcher();
  const variables = new FakeVariables();
  const cap = new InMemoryFrequencyCap();
  const openUrl = jest.fn(async () => true);
  const navigate = jest.fn();
  const requestPushPermission = jest.fn(async () => true);
  const emitted: string[] = [];
  const service = new InAppMessagingService({
    source,
    presenter,
    analytics,
    campaignCache: cache,
    prefetcher,
    variables,
    frequencyCap: cap,
    isHostOverlayOpen: opts.overlayOpen ?? (() => false),
    hasSurface: opts.hasSurface,
    openUrl,
    navigate,
    requestPushPermission,
    emit: (m) => emitted.push(m.id),
    clock: () => now,
  });
  return {
    service,
    source,
    presenter,
    analytics,
    cache,
    prefetcher,
    variables,
    cap,
    openUrl,
    navigate,
    requestPushPermission,
    emitted,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe('InAppMessagingService', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  describe('session start', () => {
    it('fetches once, displays the session-start message, records the impression at paint and emits it', async () => {
      const h = harness(sync([campaign(1)]));
      await h.service.start({ customerId: 'c1' });
      expect(h.source.fetches).toBe(1);
      expect(h.presenter.shownIds).toEqual(['1']);
      expect(h.emitted).toEqual(['1']);
      expect(h.analytics.events).toEqual([]);
      h.presenter.paint();
      expect(h.analytics.types()).toEqual(['impression']);
      expect(h.cap.snapshot().lastDisplayByCampaign.get(1)).toBe(T0);
    });
    it('a second start for the same customer does not refetch; a new customer does and reloads history', async () => {
      const h = harness(sync([campaign(1)]));
      const load = jest.spyOn(h.cap, 'load');
      await h.service.start({ customerId: 'c1' });
      await h.service.start({ customerId: 'c1' });
      expect(h.source.fetches).toBe(1);
      h.service.onCustomerChanged('c2');
      await jest.advanceTimersByTimeAsync(0);
      expect(h.source.fetches).toBe(2);
      expect(load).toHaveBeenLastCalledWith('c2');
    });
    it('a successful sync is cached; a failed sync falls back to the cache and does not throw', async () => {
      const h = harness(
        sync([campaign(1)], {
          rawJson: JSON.stringify({
            cooldownSeconds: 30,
            messages: [
              {
                campaignId: 1,
                messageType: 2,
                trigger: { type: 'session_start' },
                locale: { message: 'cached' },
              },
            ],
          }),
        })
      );
      await h.service.start({ customerId: 'c1' });
      expect(h.cache.writes).toBe(1);
      const h2 = harness(new Error('offline'));
      h2.cache.raw = h.cache.raw;
      await h2.service.start({ customerId: 'c1' });
      expect(h2.presenter.shownIds).toEqual(['1']);
      const h3 = harness(new Error('offline'));
      await expect(
        h3.service.start({ customerId: 'c1' })
      ).resolves.toBeUndefined();
      expect(h3.presenter.shownIds).toEqual([]);
    });
  });

  describe('events', () => {
    it('displays a matching campaign, ignores non-matching ones and does nothing before start', async () => {
      const h = harness(
        sync([campaign(1, { trigger: eventTrigger('add_to_cart') })])
      );
      h.service.onCustomEvent('add_to_cart');
      expect(h.presenter.shownIds).toEqual([]);
      await h.service.start({ customerId: 'c1' });
      h.service.onCustomEvent('view_item');
      expect(h.presenter.shownIds).toEqual([]);
      h.service.onCustomEvent('add_to_cart');
      expect(h.presenter.shownIds).toEqual(['1']);
    });
    it('purchases match any-purchase and price-filtered campaigns', async () => {
      const h = harness(
        sync([
          campaign(1, {
            trigger: eventTrigger('purchase', [
              { property: 'price', operator: 'greater_than', value: 100 },
            ]),
            priority: 5,
          }),
          campaign(2, { trigger: eventTrigger('purchase') }),
        ])
      );
      await h.service.start({ customerId: 'c1' });
      h.service.onPurchase({ productId: 'p', price: 50, currency: 'USD' });
      expect(h.presenter.shownIds).toEqual(['2']);
      h.presenter.paint();
      h.presenter.dismiss();
      h.advance(31_000);
      h.service.onPurchase({ productId: 'p', price: 150, currency: 'USD' });
      expect(h.presenter.shownIds).toEqual(['2', '1']);
      expect(h.variables.cleared).toBeGreaterThan(0);
    });
  });

  describe('deferral and the pending slot', () => {
    it('defers while the host overlay is open and displays when it closes', async () => {
      let open = true;
      const h = harness(sync([campaign(1)]), { overlayOpen: () => open });
      await h.service.start({ customerId: 'c1' });
      expect(h.presenter.shownIds).toEqual([]);
      expect(h.service.pendingCampaign?.campaignId).toBe(1);
      open = false;
      h.service.onHostOverlayClosed();
      expect(h.presenter.shownIds).toEqual(['1']);
      expect(h.service.pendingCampaign).toBeNull();
    });
    it('defers when a message is showing and displays it after dismissal (outside the floor)', async () => {
      const h = harness(
        sync([campaign(1), campaign(2, { trigger: eventTrigger('e') })])
      );
      await h.service.start({ customerId: 'c1' });
      h.presenter.paint();
      h.advance(31_000);
      h.service.onCustomEvent('e');
      expect(h.presenter.shownIds).toEqual(['1']);
      h.presenter.dismiss();
      expect(h.presenter.shownIds).toEqual(['1', '2']);
    });
    it('a newer deferral displaces an older one', async () => {
      const h = harness(
        sync([
          campaign(1),
          campaign(2, { trigger: eventTrigger('e') }),
          campaign(3, { trigger: eventTrigger('f') }),
        ])
      );
      await h.service.start({ customerId: 'c1' });
      h.presenter.paint();
      h.advance(31_000);
      h.service.onCustomEvent('e');
      h.service.onCustomEvent('f');
      expect(h.service.pendingCampaign?.campaignId).toBe(3);
    });
    it('a trigger inside the floor is dropped, not deferred', async () => {
      const h = harness(
        sync([campaign(1), campaign(2, { trigger: eventTrigger('e') })])
      );
      await h.service.start({ customerId: 'c1' });
      h.presenter.paint();
      h.presenter.dismiss();
      h.advance(5_000);
      h.service.onCustomEvent('e');
      expect(h.presenter.shownIds).toEqual(['1']);
      expect(h.service.pendingCampaign).toBeNull();
    });
    it('a pending message already shown is dropped rather than repeated', async () => {
      const h = harness(
        sync([campaign(1), campaign(2, { trigger: eventTrigger('e') })])
      );
      await h.service.start({ customerId: 'c1' });
      h.presenter.paint();
      h.advance(31_000);
      h.service.onCustomEvent('e'); // 2 pending behind 1
      h.presenter.dismiss(); // 2 shows
      h.presenter.paint();
      h.advance(31_000);
      h.service.onCustomEvent('e'); // 2 again, not repeatable → nothing
      h.presenter.dismiss();
      expect(h.presenter.shownIds).toEqual(['1', '2']);
    });
  });

  describe('runner-up (D-31)', () => {
    it('the runner-up on the same trigger waits behind the winner and shows once the floor lapses', async () => {
      const h = harness(
        sync(
          [
            campaign(1, { trigger: eventTrigger('e'), priority: 5 }),
            campaign(2, { trigger: eventTrigger('e') }),
          ],
          { cooldownMs: 10_000 }
        )
      );
      await h.service.start({ customerId: 'c1' });
      h.service.onCustomEvent('e');
      expect(h.presenter.shownIds).toEqual(['1']);
      expect(h.service.pendingCampaign?.campaignId).toBe(2);
      h.presenter.paint();
      h.advance(3_000);
      h.presenter.dismiss(); // inside the 10 s floor: parked, timer armed
      expect(h.presenter.shownIds).toEqual(['1']);
      h.advance(7_000);
      await jest.advanceTimersByTimeAsync(7_000);
      expect(h.presenter.shownIds).toEqual(['1', '2']);
    });
    it('a deferred winner is not displaced by its own runner-up', async () => {
      let open = true;
      const h = harness(
        sync([
          campaign(1, { trigger: eventTrigger('e'), priority: 5 }),
          campaign(2, { trigger: eventTrigger('e') }),
        ]),
        { overlayOpen: () => open }
      );
      await h.service.start({ customerId: 'c1' });
      h.service.onCustomEvent('e');
      expect(h.service.pendingCampaign?.campaignId).toBe(1);
      open = false;
      h.service.onHostOverlayClosed();
      expect(h.presenter.shownIds).toEqual(['1']);
    });
  });

  describe('beforeDisplay', () => {
    it('discard shows nothing and leaves nothing pending; later parks it; a throwing hook shows', async () => {
      const h1 = harness(sync([campaign(1)]));
      await h1.service.start({
        customerId: 'c1',
        beforeDisplay: () => 'discard',
      });
      expect(h1.presenter.shownIds).toEqual([]);
      expect(h1.service.pendingCampaign).toBeNull();
      expect(h1.emitted).toEqual(['1']);
      const h2 = harness(sync([campaign(1)]));
      await h2.service.start({
        customerId: 'c1',
        beforeDisplay: () => 'later',
      });
      expect(h2.service.pendingCampaign?.campaignId).toBe(1);
      h2.service.onDisplayOpportunity();
      expect(h2.presenter.shownIds).toEqual(['1']);
      const h3 = harness(sync([campaign(1)]));
      await h3.service.start({
        customerId: 'c1',
        beforeDisplay: () => {
          throw new Error('boom');
        },
      });
      expect(h3.presenter.shownIds).toEqual(['1']);
    });
  });

  describe('interaction and analytics', () => {
    const withButton = (
      action: Campaign['message']['buttons'][number]['action']
    ) =>
      campaign(1, {
        message: message({
          id: '1',
          buttons: [{ id: 'b1', text: 'Go', action, style: {} }],
        }),
      });

    it('closing without interacting logs a dismiss; a button tap logs a click and suppresses the dismiss', async () => {
      const h = harness(sync([withButton({ type: 'dismiss' })]));
      await h.service.start({ customerId: 'c1' });
      h.presenter.paint();
      h.presenter.dismiss();
      expect(h.analytics.types()).toEqual(['impression', 'dismiss']);
      const h2 = harness(sync([withButton({ type: 'dismiss' })]));
      await h2.service.start({ customerId: 'c1' });
      h2.presenter.paint();
      h2.presenter.tapButton();
      expect(h2.analytics.types()).toEqual(['impression', 'click']);
      expect(h2.analytics.events[1]!.buttonId).toBe('b1');
      expect(h2.presenter.isShowing).toBe(false);
    });
    it('open_url flushes then opens; the click carries the url; a host handling it suppresses the action only', async () => {
      const h = harness(
        sync([
          withButton({ type: 'open_url', url: 'https://g.co', external: true }),
        ])
      );
      await h.service.start({ customerId: 'c1' });
      h.presenter.paint();
      h.presenter.tapButton();
      await jest.advanceTimersByTimeAsync(0);
      expect(h.analytics.flushes).toBeGreaterThan(0);
      expect(h.openUrl).toHaveBeenCalledWith('https://g.co', true);
      expect(h.analytics.events[1]!.url).toBe('https://g.co');
      const h2 = harness(
        sync([
          withButton({
            type: 'open_url',
            url: 'https://g.co',
            external: false,
          }),
        ])
      );
      const onAction = jest.fn(() => true);
      await h2.service.start({ customerId: 'c1', onAction });
      h2.presenter.paint();
      h2.presenter.tapButton();
      await jest.advanceTimersByTimeAsync(0);
      expect(onAction).toHaveBeenCalledWith(
        expect.objectContaining({ id: '1' }),
        expect.objectContaining({ id: 'b1' }),
        { type: 'open_url', url: 'https://g.co', external: false }
      );
      expect(h2.openUrl).not.toHaveBeenCalled();
      expect(h2.analytics.types()).toEqual(['impression', 'click']);
      expect(h2.presenter.isShowing).toBe(false);
    });
    it('navigate dismisses first then calls the hook; push permission calls the requester; a throwing onAction falls back', async () => {
      const h = harness(
        sync([
          withButton({
            type: 'navigate',
            route: '/offers',
            arguments: { tab: 'new' },
          }),
        ])
      );
      await h.service.start({ customerId: 'c1' });
      h.presenter.paint();
      h.presenter.tapButton();
      await jest.advanceTimersByTimeAsync(0);
      expect(h.navigate).toHaveBeenCalledWith('/offers', { tab: 'new' });
      const h2 = harness(
        sync([withButton({ type: 'request_push_permission' })])
      );
      await h2.service.start({
        customerId: 'c1',
        onAction: () => {
          throw new Error('x');
        },
      });
      h2.presenter.paint();
      h2.presenter.tapButton();
      await jest.advanceTimersByTimeAsync(0);
      expect(h2.requestPushPermission).toHaveBeenCalled();
    });
    it('a message-level action logs a body click; a message with no action ignores surface taps', async () => {
      const h = harness(
        sync([
          campaign(1, {
            message: message({ id: '1', clickAction: { type: 'dismiss' } }),
          }),
        ])
      );
      await h.service.start({ customerId: 'c1' });
      h.presenter.paint();
      h.presenter.tapMessage();
      expect(h.analytics.types()).toEqual(['impression', 'click']);
      expect(h.analytics.events[1]!.buttonId).toBeUndefined();
      const h2 = harness(sync([campaign(1)]));
      await h2.service.start({ customerId: 'c1' });
      h2.presenter.paint();
      h2.presenter.tapMessage();
      expect(h2.analytics.types()).toEqual(['impression']);
      expect(h2.presenter.isShowing).toBe(true);
    });
    it('a test send displays but reports nothing', async () => {
      const h = harness(sync([campaign(1, { isTest: true })]));
      await h.service.start({ customerId: 'c1' });
      h.presenter.paint();
      h.presenter.dismiss();
      expect(h.presenter.shownIds).toEqual(['1']);
      expect(h.analytics.events).toEqual([]);
    });
    it('events carry variation, dispatch and the injected clock', async () => {
      const h = harness(
        sync([campaign(1, { variationId: 4, dispatchId: 'dsp' })])
      );
      await h.service.start({ customerId: 'c1' });
      h.presenter.paint();
      expect(h.analytics.events[0]).toMatchObject({
        campaignId: 1,
        variationId: 4,
        dispatchId: 'dsp',
        occurredAt: new Date(T0).toISOString(),
      });
    });
  });

  describe('sessions', () => {
    it('logs every event against the customer the message was shown to', async () => {
      const h = harness(sync([campaign(1, { repeatable: true }), campaign(2)]));
      await h.service.start({ customerId: 'c1' });
      h.presenter.paint();
      h.presenter.dismiss();
      expect(h.analytics.customers.length).toBeGreaterThan(0);
      expect(new Set(h.analytics.customers)).toEqual(new Set(['c1']));
    });

    it('pause flushes; a resume after the timeout re-syncs and fires session start again; a brief resume does not', async () => {
      const h = harness(sync([campaign(1, { repeatable: true }), campaign(2)]));
      await h.service.start({ customerId: 'c1' });
      h.presenter.paint();
      h.presenter.dismiss();
      h.service.onAppPaused();
      expect(h.analytics.flushAlls).toBe(1);
      h.advance(10_000);
      h.service.onAppResumed();
      await jest.advanceTimersByTimeAsync(0);
      expect(h.source.fetches).toBe(1);
      h.service.onAppPaused();
      h.advance(5_000);
      h.service.onAppPaused(); // second pause must not reset the clock
      h.advance(26_000);
      h.service.onAppResumed();
      await jest.advanceTimersByTimeAsync(0);
      expect(h.source.fetches).toBe(2);
      expect(h.presenter.shownIds).toEqual(['1', '1']);
    });
    it('a resume with no preceding pause does nothing', async () => {
      const h = harness(sync([campaign(1)]));
      await h.service.start({ customerId: 'c1' });
      h.service.onAppResumed();
      expect(h.source.fetches).toBe(1);
    });
  });

  describe('quiet hours', () => {
    const nowMinute = () => {
      const d = new Date(T0);
      return d.getHours() * 60 + d.getMinutes();
    };
    it('suppresses inside the window and drops a pending message at retry once the window opened', async () => {
      const quiet = {
        startMinute: nowMinute(),
        endMinute: (nowMinute() + 120) % 1440,
      };
      const h = harness(sync([campaign(1)], { quietHours: quiet }));
      await h.service.start({ customerId: 'c1' });
      expect(h.presenter.shownIds).toEqual([]);
      const later = {
        startMinute: (nowMinute() + 5) % 1440,
        endMinute: (nowMinute() + 120) % 1440,
      };
      const h2 = harness(
        sync([campaign(1), campaign(2, { trigger: eventTrigger('e') })], {
          quietHours: later,
        })
      );
      await h2.service.start({ customerId: 'c1' });
      h2.presenter.paint();
      h2.advance(31_000);
      h2.service.onCustomEvent('e');
      expect(h2.service.pendingCampaign?.campaignId).toBe(2);
      h2.advance(5 * 60_000); // window is now open
      h2.presenter.dismiss();
      expect(h2.presenter.shownIds).toEqual(['1']);
      expect(h2.service.pendingCampaign).toBeNull();
    });
  });

  describe('artwork', () => {
    it('a campaign whose artwork failed is passed over so the next one wins, and recovers after the retry interval', async () => {
      const img = message({ id: '1', imageUrl: 'https://cdn/x.png' });
      const h = harness(
        sync([
          campaign(1, { priority: 5, message: img, repeatable: true }),
          campaign(2, { repeatable: true }),
        ])
      );
      h.prefetcher.failing.add('https://cdn/x.png');
      await h.service.start({ customerId: 'c1' });
      expect(h.presenter.shownIds).toEqual(['2']);
      h.presenter.paint();
      h.presenter.dismiss();
      h.prefetcher.failing.clear();
      h.service.onAppPaused();
      h.advance(31_000);
      h.service.onAppResumed();
      await jest.advanceTimersByTimeAsync(0);
      expect(h.presenter.shownIds).toEqual(['2', '1']);
    });
    it('refuses to re-attempt artwork more often than the retry interval', async () => {
      const img = message({ id: '1', imageUrl: 'https://cdn/x.png' });
      const h = harness(
        sync([campaign(1, { trigger: eventTrigger('e'), message: img })])
      );
      h.prefetcher.failing.add('https://cdn/x.png');
      await h.service.start({ customerId: 'c1' });
      const before = h.prefetcher.calls.length;
      h.service.onCustomEvent('e');
      h.service.onCustomEvent('e');
      await jest.advanceTimersByTimeAsync(0);
      expect(h.prefetcher.calls.length).toBe(before);
      h.advance(30_000);
      h.service.onCustomEvent('e');
      await jest.advanceTimersByTimeAsync(0);
      expect(h.prefetcher.calls.length).toBe(before + 1);
    });
  });

  describe('personalisation', () => {
    it('resolves tokens before display, blanks the unresolved ones, and declares retained tokens', async () => {
      const h = harness(
        sync([
          campaign(1, {
            message: message({
              id: '1',
              header: 'Hi {name}',
              body: '{points} pts {missing}',
            }),
          }),
        ])
      );
      h.variables.values = { name: 'Ana', points: '120' };
      await h.service.start({ customerId: 'c1' });
      await jest.advanceTimersByTimeAsync(0);
      expect(h.variables.retained).toEqual(
        new Set(['name', 'points', 'missing'])
      );
      expect(h.presenter.current!.message.header).toBe('Hi Ana');
      expect(h.presenter.current!.message.body).toBe('120 pts ');
    });
    it('a slow variables call is bounded and the message still displays', async () => {
      const h = harness(
        sync([
          campaign(1, { message: message({ id: '1', header: 'Hi {name}' }) }),
        ])
      );
      h.variables.delayMs = 10_000;
      const started = h.service.start({ customerId: 'c1' });
      await jest.advanceTimersByTimeAsync(2_100);
      await started;
      expect(h.presenter.current!.message.header).toBe('Hi ');
    });
  });

  describe('stop', () => {
    it('dismisses, clears pending, flushes and disposes analytics, and ignores later events', async () => {
      const h = harness(
        sync([campaign(1), campaign(2, { trigger: eventTrigger('e') })])
      );
      await h.service.start({ customerId: 'c1' });
      h.presenter.paint();
      h.advance(31_000);
      h.service.onCustomEvent('e');
      h.service.stop();
      expect(h.presenter.isShowing).toBe(false);
      expect(h.service.pendingCampaign).toBeNull();
      expect(h.service.isStarted).toBe(false);
      expect(h.analytics.flushes).toBe(1);
      expect(h.analytics.disposed).toBe(1);
      expect(h.variables.cleared).toBeGreaterThan(0);
      h.service.onCustomEvent('e');
      expect(h.presenter.shownIds).toEqual(['1']);
      expect(() => h.service.stop()).not.toThrow();
    });
  });

  describe('no surface', () => {
    it('a refused presentation is parked and retried shortly after while there is no surface', async () => {
      const h = harness(sync([campaign(1)]), { hasSurface: () => false });
      h.presenter.refuse = true;
      await h.service.start({ customerId: 'c1' });
      expect(h.service.pendingCampaign?.campaignId).toBe(1);
      h.presenter.refuse = false;
      await jest.advanceTimersByTimeAsync(300);
      expect(h.presenter.shownIds).toEqual(['1']);
    });

    it('a presenter that refuses with a surface present is asked once, then on the next opportunity', async () => {
      const h = harness(sync([campaign(1)]));
      h.presenter.refuse = true;
      await h.service.start({ customerId: 'c1' });
      await jest.advanceTimersByTimeAsync(300);
      expect(h.presenter.attempts).toBe(1); // no 250ms busy loop
      expect(h.service.pendingCampaign?.campaignId).toBe(1);
      h.presenter.refuse = false;
      h.service.onDisplayOpportunity();
      expect(h.presenter.shownIds).toEqual(['1']);
    });

    it('stop cancels a scheduled surface retry', async () => {
      const h = harness(sync([campaign(1)]), { hasSurface: () => false });
      h.presenter.refuse = true;
      await h.service.start({ customerId: 'c1' });
      h.service.stop();
      h.presenter.refuse = false;
      await jest.advanceTimersByTimeAsync(300);
      expect(h.presenter.shownIds).toEqual([]);
    });
  });

  describe('customer change', () => {
    it('a pause before the change does not start a session for the new customer on resume', async () => {
      const h = harness(sync([campaign(1)]));
      await h.service.start({ customerId: 'c1' });
      h.service.onAppPaused();
      h.advance(31_000);
      h.service.onCustomerChanged('c2');
      await jest.advanceTimersByTimeAsync(0);
      expect(h.source.fetches).toBe(2);
      h.service.onAppResumed();
      await jest.advanceTimersByTimeAsync(0);
      expect(h.source.fetches).toBe(2);
    });
  });
});
