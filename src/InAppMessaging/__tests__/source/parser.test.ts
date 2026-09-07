import syncResponse from '../fixtures/v4-sync-response.json';
import { parseSyncResponse, parseColor } from '../../source/parser';

// Imported rather than read from disk: jest runs these as CommonJS, where `import.meta` does not exist.
const fixture = JSON.stringify(syncResponse);

/** Minimal valid campaign; override what a test cares about. */
function campaign(
  over: Record<string, unknown> = {},
  content: Record<string, unknown> = {},
  locale: Record<string, unknown> = {}
) {
  return {
    campaignId: 1,
    variationId: 9,
    dispatchId: 'd-1',
    name: 'T',
    priority: 2,
    messageType: 2,
    trigger: {
      type: 'session_start',
      repeatable: false,
      minIntervalSeconds: null,
    },
    contentMode: 'prerendered',
    content: {
      closeBehaviour: 'both',
      imageUrl: null,
      buttons: null,
      ...content,
    },
    locale: { header: 'H', message: 'B', buttons: null, ...locale },
    isTest: false,
    expiresAt: null,
    ...over,
  };
}
const payload = (messages: unknown[], root: Record<string, unknown> = {}) =>
  JSON.stringify({
    cooldownSeconds: 30,
    quietHours: null,
    campaignOrdering: null,
    messages,
    ...root,
  });

describe('parseSyncResponse on the real alpha fixture', () => {
  const result = parseSyncResponse(fixture);
  it('keeps all eight campaigns in response order', () => {
    expect(result.campaigns.map((c) => c.campaignId)).toEqual([
      2055, 2054, 2057, 2042, 2058, 2059, 2060, 2061,
    ]);
    expect(result.cooldownMs).toBe(30_000);
    expect(result.quietHours).toBeNull();
    expect(result.rawJson).toBe(fixture);
  });
  it('reads a fullscreen with media artwork, navigate button and repeat rule', () => {
    const c = result.campaigns[0]!;
    expect(c.message.type).toBe('fullscreen');
    expect(c.message.campaignId).toBe(2055);
    expect(c.message.variationId).toBe(20);
    expect(c.message.isTest).toBe(false);
    expect(c.message.imageUrl).toBe(
      'https://i.ibb.co/G34R4MtM/83312799-summer-sale.jpg'
    );
    expect(c.message.orientation).toBe('portrait');
    expect(c.message.buttons).toEqual([
      {
        id: 'ok',
        text: 'Track my order',
        action: { type: 'navigate', route: 'orders', arguments: undefined },
        style: {},
      },
    ]);
    expect(c.trigger).toEqual({
      kind: 'event',
      eventName: 'place_order',
      filters: [],
    });
    expect(c.repeatable).toBe(true);
    expect(c.minIntervalMs).toBe(300_000);
    expect(c.message.showCloseButton).toBe(true);
    expect(c.message.dismissOnScrimTap).toBe(false);
    expect(c.message.style.backgroundColor).toBe('#ffffff');
    expect(c.message.style.headerColor).toBe('#111827');
    expect(c.message.style.bodyColor).toBe('#1f2937');
  });
  it('reads a slideup with swipe close and explicit auto-dismiss', () => {
    const c = result.campaigns[1]!;
    expect(c.message.type).toBe('slideup');
    expect(c.message.showCloseButton).toBe(false);
    expect(c.message.dismissOnScrimTap).toBe(true);
    expect(c.message.autoDismissMs).toBe(8000);
    expect(c.message.slidePosition).toBe('bottom');
    expect(c.minIntervalMs).toBeNull();
  });
  it('a modal with null content still parses with text only', () => {
    const c = result.campaigns[4]!;
    expect(c.message.type).toBe('modal');
    expect(c.message.body).toBe('EN summer sale');
    expect(c.message.header).toBeNull();
    expect(c.message.imageUrl).toBeNull();
    expect(c.message.autoDismissMs).toBeNull();
  });
});

describe('parseSyncResponse rules', () => {
  it('never throws on garbage', () => {
    expect(parseSyncResponse('not json').campaigns).toEqual([]);
    expect(parseSyncResponse('[]').campaigns).toEqual([]);
    expect(parseSyncResponse('{"messages": 3}').campaigns).toEqual([]);
  });
  it('defaults the cooldown when absent or negative', () => {
    expect(
      parseSyncResponse(payload([], { cooldownSeconds: undefined })).cooldownMs
    ).toBe(30_000);
    expect(
      parseSyncResponse(payload([], { cooldownSeconds: -1 })).cooldownMs
    ).toBe(30_000);
    expect(
      parseSyncResponse(payload([], { cooldownSeconds: 10 })).cooldownMs
    ).toBe(10_000);
  });
  it('reads quiet hours from the root', () => {
    expect(
      parseSyncResponse(
        payload([], {
          quietHours: { enabled: true, start: '22:00', end: '08:00' },
        })
      ).quietHours
    ).toEqual({ startMinute: 1320, endMinute: 480 });
  });
  it('drops a campaign without a numeric campaignId, trigger or renderable content', () => {
    expect(
      parseSyncResponse(payload([campaign({ campaignId: 'x' })])).campaigns
    ).toEqual([]);
    expect(
      parseSyncResponse(payload([campaign({ trigger: null })])).campaigns
    ).toEqual([]);
    expect(
      parseSyncResponse(
        payload([
          campaign({}, { imageUrl: null }, { header: null, message: null }),
        ])
      ).campaigns
    ).toEqual([]);
  });
  it('drops unsupported contentMode, trigger type, OR logic and a filter without a name', () => {
    expect(
      parseSyncResponse(payload([campaign({ contentMode: 'html' })])).campaigns
    ).toEqual([]);
    expect(
      parseSyncResponse(payload([campaign({ trigger: { type: 'push_open' } })]))
        .campaigns
    ).toEqual([]);
    expect(
      parseSyncResponse(
        payload([
          campaign({
            trigger: {
              type: 'event',
              name: 'e',
              metadataLogicalOperator: 'or',
              metadataFilters: [],
            },
          }),
        ])
      ).campaigns
    ).toEqual([]);
    expect(
      parseSyncResponse(
        payload([
          campaign({
            trigger: {
              type: 'event',
              name: 'e',
              metadataFilters: [{ metadataId: 4, operator: 'Is', value: 1 }],
            },
          }),
        ])
      ).campaigns
    ).toEqual([]);
  });
  it('keeps an event trigger with dashboard-named filters and drops only an unusable filter', () => {
    const r = parseSyncResponse(
      payload([
        campaign({
          trigger: {
            type: 'event',
            name: 'add_to_cart',
            metadataLogicalOperator: 'and',
            metadataFilters: [
              { name: 'price', operator: 'Between', value: '10,20' },
              { name: 'category', operator: 'Regex', value: 'x' },
              { name: 'qty', operator: 'Greater', value: null },
            ],
          },
        }),
      ])
    );
    expect(r.campaigns[0]!.trigger).toEqual({
      kind: 'event',
      eventName: 'add_to_cart',
      filters: [{ property: 'price', operator: 'between', value: '10,20' }],
    });
  });
  it('an event trigger without a name is dropped', () => {
    expect(
      parseSyncResponse(
        payload([campaign({ trigger: { type: 'event', eventId: 12 } })])
      ).campaigns
    ).toEqual([]);
  });
  it('keeps an unsupported messageType as type unsupported', () => {
    expect(
      parseSyncResponse(payload([campaign({ messageType: 4 })])).campaigns[0]!
        .message.type
    ).toBe('unsupported');
  });
  it('a slideup needs text, ignores buttons and gets the 8 s default auto-dismiss', () => {
    expect(
      parseSyncResponse(
        payload([
          campaign(
            { messageType: 1 },
            { imageUrl: 'https://x/y.png' },
            { header: null, message: null }
          ),
        ])
      ).campaigns
    ).toEqual([]);
    const c = parseSyncResponse(
      payload([
        campaign(
          { messageType: 1 },
          { buttons: [{ id: 'a', action: { type: 'dismiss' } }] },
          { buttons: [{ id: 'a', text: 'Go' }] }
        ),
      ])
    ).campaigns[0]!;
    expect(c.message.buttons).toEqual([]);
    expect(c.message.autoDismissMs).toBe(8000);
  });
  it('autoDismissSeconds 0 means stay; fractional rounds to ms', () => {
    expect(
      parseSyncResponse(payload([campaign({}, { autoDismissSeconds: 0 })]))
        .campaigns[0]!.message.autoDismissMs
    ).toBeNull();
    expect(
      parseSyncResponse(payload([campaign({}, { autoDismissSeconds: 2.5 })]))
        .campaigns[0]!.message.autoDismissMs
    ).toBe(2500);
  });
  it('closeBehaviour: button, swipe, both, unknown, and swipe promoted on fullscreen', () => {
    const cb = (v: unknown, type = 2) => {
      const m = parseSyncResponse(
        payload([campaign({ messageType: type }, { closeBehaviour: v })])
      ).campaigns[0]!.message;
      return [m.showCloseButton, m.dismissOnScrimTap];
    };
    expect(cb('button')).toEqual([true, false]);
    expect(cb('swipe')).toEqual([false, true]);
    expect(cb('both')).toEqual([true, true]);
    expect(cb(null)).toEqual([true, true]);
    expect(cb('weird')).toEqual([true, true]);
    expect(cb('swipe', 3)).toEqual([true, true]);
  });
  it('pairs buttons by id across content and locale, drops unpaired, keeps the first two', () => {
    const c = parseSyncResponse(
      payload([
        campaign(
          {},
          {
            buttons: [
              {
                id: 'a',
                action: {
                  type: 'open_url',
                  url: 'https://g.co',
                  external: true,
                },
                colors: { background: '#FF0000', text: '#FFFFFF' },
              },
              { id: 'b', action: { type: 'request_push_permission' } },
              { id: 'c', action: { type: 'dismiss' } },
              { id: 'zz', action: { type: 'dismiss' } },
            ],
          },
          {
            buttons: [
              { id: 'a', text: 'Shop' },
              { id: 'b', text: 'Notify me' },
              { id: 'c', text: 'Later' },
            ],
          }
        ),
      ])
    ).campaigns[0]!;
    expect(c.message.buttons.map((b) => b.id)).toEqual(['a', 'b']);
    expect(c.message.buttons[0]!.action).toEqual({
      type: 'open_url',
      url: 'https://g.co',
      external: true,
    });
    expect(c.message.buttons[0]!.style).toEqual({
      backgroundColor: '#ff0000',
      textColor: '#ffffff',
    });
    expect(c.message.buttons[1]!.action).toEqual({
      type: 'request_push_permission',
    });
  });
  it('button actions degrade to dismiss; message actions degrade to not tappable', () => {
    const c = parseSyncResponse(
      payload([
        campaign(
          {},
          {
            action: { type: 'open_url', url: '' },
            buttons: [
              { id: 'a', action: { type: 'open_url', url: '' } },
              { id: 'b', action: { type: 'teleport' } },
            ],
          },
          {
            buttons: [
              { id: 'a', text: 'A' },
              { id: 'b', text: 'B' },
            ],
          }
        ),
      ])
    ).campaigns[0]!;
    expect(c.message.clickAction).toBeNull();
    expect(c.message.buttons.map((b) => b.action)).toEqual([
      { type: 'dismiss' },
      { type: 'dismiss' },
    ]);
  });
  it('a message-level navigate action with arguments is kept', () => {
    const c = parseSyncResponse(
      payload([
        campaign(
          {},
          {
            action: {
              type: 'navigate',
              route: '/offers',
              arguments: { tab: 'new', n: 2, skip: null },
            },
          }
        ),
      ])
    ).campaigns[0]!;
    expect(c.message.clickAction).toEqual({
      type: 'navigate',
      route: '/offers',
      arguments: { tab: 'new', n: 2 },
    });
  });
  it('layout, orientation, slideFrom fall back on unknown values', () => {
    const m = parseSyncResponse(
      payload([
        campaign(
          { messageType: 3 },
          { layout: 'image_only', orientation: 'sideways', slideFrom: 'left' }
        ),
      ])
    ).campaigns[0]!.message;
    expect(m.layout).toBe('image_only');
    expect(m.orientation).toBe('any');
    expect(m.slidePosition).toBe('bottom');
    expect(
      parseSyncResponse(payload([campaign({}, { layout: 'image_and_text' })]))
        .campaigns[0]!.message.layout
    ).toBe('text_with_image');
  });
  it('artwork precedence: fullscreen prefers media, modal prefers imageUrl; video media ignored; blank urls are null', () => {
    const both = {
      imageUrl: 'https://a/i.png',
      media: { type: 'image', url: 'https://a/m.png' },
    };
    expect(
      parseSyncResponse(payload([campaign({ messageType: 3 }, both)]))
        .campaigns[0]!.message.imageUrl
    ).toBe('https://a/m.png');
    expect(
      parseSyncResponse(payload([campaign({ messageType: 2 }, both)]))
        .campaigns[0]!.message.imageUrl
    ).toBe('https://a/i.png');
    expect(
      parseSyncResponse(
        payload([
          campaign({}, { media: { type: 'video', url: 'https://a/v.mp4' } }),
        ])
      ).campaigns[0]!.message.imageUrl
    ).toBeNull();
    expect(
      parseSyncResponse(payload([campaign({}, { imageUrl: '  ' })]))
        .campaigns[0]!.message.imageUrl
    ).toBeNull();
  });
  it('reads colours, alignment, extras (coerced to strings), expiresAt and isTest', () => {
    const c = parseSyncResponse(
      payload([
        campaign(
          { isTest: true, expiresAt: '2026-09-07T10:00:00Z' },
          {
            colors: {
              background: '#FFFFFF',
              text: '#1F2937',
              header: '#111827',
              closeButton: '#80FF0000',
              frame: '#99000000',
            },
            textAlignment: { header: 'center', body: 'end' },
            extras: { promo: 'SUMMER', n: 3, gone: null },
          }
        ),
      ])
    ).campaigns[0]!;
    expect(c.isTest).toBe(true);
    expect(c.expiresAt).toBe(Date.parse('2026-09-07T10:00:00Z'));
    expect(c.message.style).toEqual({
      backgroundColor: '#ffffff',
      bodyColor: '#1f2937',
      headerColor: '#111827',
      closeButtonColor: 'rgba(255, 0, 0, 0.502)',
      scrimColor: 'rgba(0, 0, 0, 0.6)',
      headerAlign: 'center',
      bodyAlign: 'end',
    });
    expect(c.message.extras).toEqual({ promo: 'SUMMER', n: '3' });
  });
  it('derives the message id from campaign and variation', () => {
    expect(
      parseSyncResponse(payload([campaign({ variationId: 9 })])).campaigns[0]!
        .message.id
    ).toBe('1/9');
    expect(
      parseSyncResponse(payload([campaign({ variationId: null })]))
        .campaigns[0]!.message.id
    ).toBe('1');
  });
});

describe('parseColor', () => {
  it('normalises hex forms', () => {
    expect(parseColor('#FFFFFF')).toBe('#ffffff');
    expect(parseColor('1f2937')).toBe('#1f2937');
    expect(parseColor('#99000000')).toBe('rgba(0, 0, 0, 0.6)');
    expect(parseColor('#FF112233')).toBe('#112233');
  });
  it('accepts packed ARGB integers', () => {
    expect(parseColor(0xff112233)).toBe('#112233');
  });
  it('rejects malformed values', () => {
    expect(parseColor('#12')).toBeNull();
    expect(parseColor('#GGGGGG')).toBeNull();
    expect(parseColor(null)).toBeNull();
    expect(parseColor({})).toBeNull();
  });
});
