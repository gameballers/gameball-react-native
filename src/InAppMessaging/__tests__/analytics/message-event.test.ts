/* eslint-disable no-bitwise -- Builds a deterministic byte array for the UUID fallback. */
import { createMessageEvent, uuidV4 } from '../../analytics/message-event';

describe('createMessageEvent', () => {
  it('shapes the wire payload and omits absent optionals', () => {
    const e = createMessageEvent({
      type: 'click',
      campaignId: 7,
      occurredAtMs: Date.parse('2026-09-06T12:00:00.000Z'),
      variationId: 3,
      dispatchId: 'd',
      buttonId: 'b1',
      url: 'https://g.co',
    });
    expect(e).toMatchObject({
      type: 'click',
      campaignId: 7,
      occurredAt: '2026-09-06T12:00:00.000Z',
      variationId: 3,
      dispatchId: 'd',
      buttonId: 'b1',
      url: 'https://g.co',
    });
    expect(e.eventUid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    const bare = createMessageEvent({
      type: 'impression',
      campaignId: 1,
      occurredAtMs: 0,
      variationId: null,
      dispatchId: null,
    });
    expect(Object.keys(bare).sort()).toEqual([
      'campaignId',
      'eventUid',
      'occurredAt',
      'type',
    ]);
  });
  it('uuids are unique', () => {
    expect(new Set(Array.from({ length: 200 }, uuidV4)).size).toBe(200);
  });
  it('falls back to crypto.getRandomValues when randomUUID is unavailable', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {
        getRandomValues: (a: Uint8Array) => {
          for (let i = 0; i < a.length; i++) a[i] = (i * 37) & 0xff;
          return a;
        },
      },
    });
    try {
      expect(uuidV4()).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      );
    } finally {
      if (original) Object.defineProperty(globalThis, 'crypto', original);
      else Reflect.deleteProperty(globalThis, 'crypto');
    }
  });
});
