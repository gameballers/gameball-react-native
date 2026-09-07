import {
  GameballApiClient,
  SYNC_PATH,
  EVENTS_PATH,
  VARIABLES_PATH,
  CUSTOMERS_PATH,
  CUSTOM_EVENTS_PATH,
} from '../../api/client';
import { createMessageEvent } from '../../analytics/message-event';

function client(
  responder: (url: string, init: RequestInit) => Response | Promise<Response>
) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = jest.fn(
    async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return responder(String(url), init ?? {});
    }
  ) as unknown as typeof fetch;
  const api = new GameballApiClient({
    apiKey: () => 'KEY',
    baseUrl: () => 'https://api.alpha.gameball.app',
    lang: () => 'ar',
    platformCode: () => 3,
    appVersion: () => '1.2.3',
    sdkVersion: '0.1.0',
    fetchImpl,
  });
  return { api, calls };
}
const json = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
const parseBody = (init: RequestInit) =>
  JSON.parse(String(init.body)) as Record<string, unknown>;

describe('GameballApiClient', () => {
  it('sync posts the platform body with the headers and returns the raw text', async () => {
    const { api, calls } = client(
      () => new Response('{"messages":[]}', { status: 200 })
    );
    expect(await api.sync('c1')).toBe('{"messages":[]}');
    expect(calls[0]!.url).toBe(`https://api.alpha.gameball.app${SYNC_PATH}`);
    expect(parseBody(calls[0]!.init)).toEqual({
      customerId: 'c1',
      platform: 3,
      locale: 'ar',
      appVersion: '1.2.3',
      sdkVersion: 'web/0.1.0',
    });
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers.ApiKey).toBe('KEY');
    expect(headers.Lang).toBe('ar');
    expect(headers['x-gb-agent']).toBe('GB/react-native/0.1.0');
    expect(headers['Content-Type']).toContain('application/json');
  });
  it('sync returns null on non-2xx and on a thrown fetch', async () => {
    expect(
      await client(() => json(404, { code: 7000 })).api.sync('c1')
    ).toBeNull();
    expect(
      await client(() => {
        throw new TypeError('Failed to fetch');
      }).api.sync('c1')
    ).toBeNull();
  });
  it('events: 2xx accepted, 408/429/5xx retry, other 4xx discard, throw retry, keepalive on', async () => {
    const events = [
      createMessageEvent({
        type: 'impression',
        campaignId: 1,
        occurredAtMs: 0,
      }),
    ];
    const { api, calls } = client(() =>
      json(202, { accepted: 1, rejected: 0 })
    );
    expect(await api.sendMessageEvents('c1', events)).toBe('accepted');
    expect(calls[0]!.url).toBe(`https://api.alpha.gameball.app${EVENTS_PATH}`);
    expect(parseBody(calls[0]!.init)).toEqual({
      customerId: 'c1',
      platform: 3,
      events,
    });
    expect(calls[0]!.init.keepalive).toBe(true);
    expect(
      await client(() => json(429)).api.sendMessageEvents('c1', events)
    ).toBe('retry');
    expect(
      await client(() => json(503)).api.sendMessageEvents('c1', events)
    ).toBe('retry');
    expect(
      await client(() => json(422)).api.sendMessageEvents('c1', events)
    ).toBe('discard');
    expect(
      await client(() => {
        throw new Error('offline');
      }).api.sendMessageEvents('c1', events)
    ).toBe('retry');
  });
  it('variables: coerces values to strings and returns {} on any failure', async () => {
    const { api, calls } = client(() =>
      json(200, { variables: { name: 'Ana', points: 120, gone: null } })
    );
    expect(await api.fetchVariables('c1')).toEqual({
      name: 'Ana',
      points: '120',
    });
    expect(calls[0]!.url).toBe(
      `https://api.alpha.gameball.app${VARIABLES_PATH}`
    );
    expect(await client(() => json(404)).api.fetchVariables('c1')).toEqual({});
    expect(
      await client(
        () => new Response('nope', { status: 200 })
      ).api.fetchVariables('c1')
    ).toEqual({});
  });
  it('initializeCustomer and sendEvent post the v4 shapes', async () => {
    const { api, calls } = client(() => json(200, {}));
    expect(
      await api.initializeCustomer('c1', { preferredLanguage: 'ar' }, 'Web')
    ).toBe(true);
    expect(calls[0]!.url).toBe(
      `https://api.alpha.gameball.app${CUSTOMERS_PATH}`
    );
    expect(parseBody(calls[0]!.init)).toEqual({
      customerId: 'c1',
      osType: 'Web',
      customerAttributes: { preferredLanguage: 'ar' },
    });
    expect(await api.sendEvent('c1', 'add_to_cart', { price: 120 })).toBe(true);
    expect(calls[1]!.url).toBe(
      `https://api.alpha.gameball.app${CUSTOM_EVENTS_PATH}`
    );
    expect(parseBody(calls[1]!.init)).toEqual({
      customerId: 'c1',
      events: { add_to_cart: { price: 120 } },
    });
    expect(await client(() => json(400)).api.sendEvent('c1', 'x', {})).toBe(
      false
    );
  });
});
