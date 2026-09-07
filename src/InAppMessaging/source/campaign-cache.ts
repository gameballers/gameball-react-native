import { iamLog } from '../log';
import type { KeyValueStore } from '../storage/key-value-store';
import { parseSyncResponse } from './parser';
import { emptySyncResult, type SyncResult } from './sync-result';

export interface CampaignCache {
  read(customerId: string): SyncResult;
  write(customerId: string, rawJson: string): void;
  clear(): void;
}

const KEY = 'gameball_iam_campaign_cache';

/** Stores the raw sync payload (not parsed objects) so the parser stays the only reader. */
export class StoredCampaignCache implements CampaignCache {
  constructor(private readonly store: KeyValueStore) {}

  read(customerId: string): SyncResult {
    try {
      const raw = this.store.get(KEY);
      if (!raw) return emptySyncResult();
      const envelope: unknown = JSON.parse(raw);
      if (
        typeof envelope !== 'object' ||
        envelope === null ||
        Array.isArray(envelope)
      ) {
        this.store.remove(KEY);
        return emptySyncResult();
      }
      const { customerId: owner, payload } = envelope as {
        customerId?: unknown;
        payload?: unknown;
      };
      if (owner !== customerId) {
        iamLog('cached campaigns belonged to another customer; discarded');
        this.store.remove(KEY);
        return emptySyncResult();
      }
      if (typeof payload !== 'string') return emptySyncResult();
      const result = parseSyncResponse(payload);
      iamLog(`loaded ${result.campaigns.length} cached campaign(s)`);
      return { ...result, rawJson: null };
    } catch (error) {
      iamLog(`could not read the campaign cache (${String(error)})`);
      return emptySyncResult();
    }
  }

  write(customerId: string, rawJson: string): void {
    try {
      this.store.set(KEY, JSON.stringify({ customerId, payload: rawJson }));
    } catch (error) {
      iamLog(`could not write the campaign cache (${String(error)})`);
    }
  }

  clear(): void {
    this.store.remove(KEY);
  }
}
