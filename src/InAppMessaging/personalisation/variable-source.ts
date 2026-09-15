import { iamLog } from '../log';
import type { KeyValueStore } from '../storage/key-value-store';

export const DEFAULT_VARIABLE_CACHE_TTL_MS = 60_000;

export interface VariableSource {
  /** Empty when unavailable; never throws. */
  fetch(customerId: string): Promise<Record<string, string>>;
  /** Forgets everything, on the device too. Called on customer change and stop. */
  clear(): void;
  /** Only these token names are written to storage. */
  retainOnly(tokenNames: Set<string>): void;
}

const KEY = 'gameball_iam_variables';

export class CachingVariableSource implements VariableSource {
  private readonly fetcher: (
    customerId: string
  ) => Promise<Record<string, string>>;
  private readonly store: KeyValueStore;
  private readonly ttlMs: number;
  private readonly clock: () => number;
  private retained = new Set<string>();
  private customerId: string | null = null;
  private values: Record<string, string> | null = null;
  private fetchedAt: number | null = null;

  constructor(options: {
    fetcher: (customerId: string) => Promise<Record<string, string>>;
    store: KeyValueStore;
    ttlMs?: number;
    clock?: () => number;
  }) {
    this.fetcher = options.fetcher;
    this.store = options.store;
    this.ttlMs = options.ttlMs ?? DEFAULT_VARIABLE_CACHE_TTL_MS;
    this.clock = options.clock ?? (() => Date.now());
  }

  async fetch(customerId: string): Promise<Record<string, string>> {
    if (
      this.customerId === customerId &&
      this.values &&
      this.fetchedAt !== null &&
      this.clock() - this.fetchedAt < this.ttlMs
    ) {
      return this.values;
    }
    let values: Record<string, string>;
    try {
      values = await this.fetcher(customerId);
    } catch (error) {
      iamLog(
        `variables unavailable (${String(
          error
        )}); falling back to stored values`
      );
      return this.readStored(customerId);
    }
    this.customerId = customerId;
    this.values = values;
    this.fetchedAt = this.clock();
    this.storeRetained(customerId, values);
    return values;
  }

  retainOnly(tokenNames: Set<string>): void {
    this.retained = tokenNames;
  }

  clear(): void {
    this.customerId = null;
    this.values = null;
    this.fetchedAt = null;
    this.store.remove(KEY);
  }

  private storeRetained(
    customerId: string,
    values: Record<string, string>
  ): void {
    const keep: Record<string, string> = {};
    for (const [k, v] of Object.entries(values))
      if (this.retained.has(k)) keep[k] = v;
    try {
      if (Object.keys(keep).length === 0) {
        this.store.remove(KEY);
        return;
      }
      this.store.set(KEY, JSON.stringify({ customerId, values: keep }));
    } catch (error) {
      iamLog(`could not store personalisation values (${String(error)})`);
    }
  }

  private readStored(customerId: string): Record<string, string> {
    try {
      const raw = this.store.get(KEY);
      if (!raw) return {};
      const envelope: unknown = JSON.parse(raw);
      if (typeof envelope !== 'object' || envelope === null) {
        this.store.remove(KEY);
        return {};
      }
      const { customerId: owner, values } = envelope as {
        customerId?: unknown;
        values?: unknown;
      };
      if (owner !== customerId) {
        iamLog('stored values belonged to another customer; discarded');
        this.store.remove(KEY);
        return {};
      }
      if (typeof values !== 'object' || values === null) return {};
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(values as Record<string, unknown>))
        out[k] = String(v);
      return out;
    } catch (error) {
      iamLog(`could not read stored personalisation values (${String(error)})`);
      return {};
    }
  }
}
