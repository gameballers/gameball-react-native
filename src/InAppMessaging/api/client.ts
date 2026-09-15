import type { SendResult } from '../analytics/analytics';
import type { MessageEvent } from '../analytics/message-event';
import { iamLog } from '../log';

export const DEFAULT_API_BASE_URL = 'https://api.gameball.co';
const V4 = '/api/v4.0/integrations';
export const SYNC_PATH = `${V4}/inapp-messages/sync`;
export const EVENTS_PATH = `${V4}/inapp-messages/events`;
export const VARIABLES_PATH = `${V4}/inapp-messages/variables`;
export const CUSTOMERS_PATH = `${V4}/customers`;
export const CUSTOM_EVENTS_PATH = `${V4}/events`;

export interface ApiClientConfig {
  apiKey: () => string;
  baseUrl: () => string;
  lang: () => string;
  platformCode: () => number;
  appVersion: () => string;
  sdkVersion: string;
  fetchImpl?: typeof fetch;
}

/** Thin transport. Every rule about what a payload means lives in the parser and the service. */
export class GameballApiClient {
  constructor(private readonly config: ApiClientConfig) {}

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json; charset=UTF-8',
      'ApiKey': this.config.apiKey(),
      'Lang': this.config.lang(),
      'x-gb-agent': `GB/react-native/${this.config.sdkVersion}`,
    };
  }

  private post(
    path: string,
    body: unknown,
    keepalive = false
  ): Promise<Response> {
    const f =
      this.config.fetchImpl ??
      ((input: string, init?: RequestInit) => fetch(input, init));
    const init: RequestInit = {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    };
    if (keepalive) init.keepalive = true;
    return f(`${this.config.baseUrl().replace(/\/$/, '')}${path}`, init);
  }

  /** Raw response body, or null when there is nothing usable (the caller keeps its cache on null). */
  async sync(customerId: string): Promise<string | null> {
    try {
      const response = await this.post(SYNC_PATH, {
        customerId,
        platform: this.config.platformCode(),
        locale: this.config.lang(),
        appVersion: this.config.appVersion(),
        sdkVersion: `react-native/${this.config.sdkVersion}`,
      });
      if (!response.ok) {
        const text = await response.text();
        if (response.status === 404)
          iamLog(
            text.trim()
              ? `sync: HTTP 404 — the backend does not know customer "${customerId}"`
              : 'sync: HTTP 404 with no body — inapp-messages is not deployed on this base URL'
          );
        else iamLog(`sync: HTTP ${response.status}`);
        return null;
      }
      return await response.text();
    } catch (error) {
      iamLog(`sync request failed (${String(error)})`);
      return null;
    }
  }

  /** keepalive so the flush on pagehide survives the page going away (payloads stay well under 64 KB). */
  async sendMessageEvents(
    customerId: string,
    events: MessageEvent[]
  ): Promise<SendResult> {
    try {
      const response = await this.post(
        EVENTS_PATH,
        { customerId, platform: this.config.platformCode(), events },
        true
      );
      if (response.ok) {
        try {
          const body = (await response.json()) as { rejected?: unknown };
          if (typeof body.rejected === 'number' && body.rejected > 0)
            iamLog(
              `analytics: backend rejected ${body.rejected} of ${events.length} event(s) as malformed; they will not be retried`
            );
        } catch {
          /* diagnostics only */
        }
        return 'accepted';
      }
      if (
        response.status === 408 ||
        response.status === 429 ||
        response.status >= 500
      ) {
        iamLog(`analytics: HTTP ${response.status} — will retry`);
        return 'retry';
      }
      iamLog(
        `analytics: HTTP ${response.status} — dropping ${events.length} event(s), a retry cannot help`
      );
      return 'discard';
    } catch {
      return 'retry';
    }
  }

  async fetchVariables(customerId: string): Promise<Record<string, string>> {
    try {
      const response = await this.post(VARIABLES_PATH, { customerId });
      if (!response.ok) {
        iamLog(
          `variables: HTTP ${response.status} — displaying the text already held`
        );
        return {};
      }
      const body = (await response.json()) as { variables?: unknown };
      if (typeof body.variables !== 'object' || body.variables === null)
        return {};
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(
        body.variables as Record<string, unknown>
      ))
        if (v !== null && v !== undefined) out[k] = String(v);
      return out;
    } catch (error) {
      iamLog(`variables request failed (${String(error)})`);
      return {};
    }
  }

  async initializeCustomer(
    customerId: string,
    attributes: Record<string, unknown> = {},
    osType?: string
  ): Promise<boolean> {
    try {
      const body: Record<string, unknown> = {
        customerId,
        customerAttributes: attributes,
      };
      if (osType) body.osType = osType;
      const response = await this.post(CUSTOMERS_PATH, body);
      if (!response.ok) iamLog(`customers: HTTP ${response.status}`);
      return response.ok;
    } catch (error) {
      iamLog(`customers request failed (${String(error)})`);
      return false;
    }
  }

  async sendEvent(
    customerId: string,
    name: string,
    metadata: Record<string, unknown>
  ): Promise<boolean> {
    try {
      const response = await this.post(CUSTOM_EVENTS_PATH, {
        customerId,
        events: { [name]: metadata },
      });
      if (!response.ok) iamLog(`events: HTTP ${response.status}`);
      return response.ok;
    } catch (error) {
      iamLog(`events request failed (${String(error)})`);
      return false;
    }
  }
}
