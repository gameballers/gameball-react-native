import { iamLog } from '../log';
import type { KeyValueStore } from '../storage/key-value-store';

/** Immutable view of display history for the pure evaluator. Times are epoch ms. */
export interface CapState {
  lastDisplayByCampaign: ReadonlyMap<number, number>;
  lastDisplayAt: number | null;
}

export interface FrequencyCap {
  /** Restores history for `customerId`, discarding anything belonging to someone else. */
  load(customerId: string): void;
  snapshot(): CapState;
  /** Called at impression, never at selection. */
  recordDisplay(campaignId: number, atMs: number): void;
}

export class InMemoryFrequencyCap implements FrequencyCap {
  protected history = new Map<number, number>();
  protected lastDisplayAt: number | null = null;

  load(_customerId: string): void {
    this.history = new Map();
    this.lastDisplayAt = null;
  }
  snapshot(): CapState {
    return {
      lastDisplayByCampaign: new Map(this.history),
      lastDisplayAt: this.lastDisplayAt,
    };
  }
  recordDisplay(campaignId: number, atMs: number): void {
    this.history.set(campaignId, atMs);
    this.lastDisplayAt = atMs;
  }
}

export const DISPLAY_HISTORY_KEY = 'gameball_iam_display_history';

interface StoredHistory {
  customerId: unknown;
  campaigns: Map<number, number>;
}

/** Throws only on invalid JSON; a payload that is not an envelope is null (the caller drops it). */
function decodeEnvelope(raw: string): StoredHistory | null {
  const decoded: unknown = JSON.parse(raw);
  if (typeof decoded !== 'object' || decoded === null) return null;
  const envelope = decoded as { customerId?: unknown; campaigns?: unknown };
  const campaigns = new Map<number, number>();
  if (typeof envelope.campaigns === 'object' && envelope.campaigns !== null) {
    for (const [key, value] of Object.entries(
      envelope.campaigns as Record<string, unknown>
    )) {
      const id = Number(key);
      const at = typeof value === 'string' ? Date.parse(value) : NaN;
      if (!Number.isInteger(id) || Number.isNaN(at)) continue;
      campaigns.set(id, at);
    }
  }
  return { customerId: envelope.customerId, campaigns };
}

/** History that survives reloads, scoped to one customer and discarded on mismatch. */
export class StoredFrequencyCap extends InMemoryFrequencyCap {
  private customerId: string | null = null;

  constructor(private readonly store: KeyValueStore) {
    super();
  }

  override load(customerId: string): void {
    super.load(customerId);
    this.customerId = customerId;
    try {
      const raw = this.store.get(DISPLAY_HISTORY_KEY);
      if (!raw) return;
      const envelope = decodeEnvelope(raw);
      if (!envelope) {
        this.store.remove(DISPLAY_HISTORY_KEY);
        return;
      }
      if (envelope.customerId !== customerId) {
        iamLog('display history belonged to another customer; discarded');
        this.store.remove(DISPLAY_HISTORY_KEY);
        return;
      }
      this.absorb(envelope.campaigns);
      iamLog(`restored display history for ${this.history.size} campaign(s)`);
    } catch (error) {
      iamLog(`could not restore display history (${String(error)})`);
    }
  }

  /**
   * Re-reads what another tab has written since (spec §8). A no-op before the first load(), and a
   * no-op when the stored envelope belongs to someone else: a tab that signed in as another customer
   * must not wipe this tab's history or have its own envelope deleted from here.
   */
  reload(): void {
    if (this.customerId === null) return;
    try {
      const raw = this.store.get(DISPLAY_HISTORY_KEY);
      if (!raw) return;
      const stored = decodeEnvelope(raw);
      if (!stored || stored.customerId !== this.customerId) return;
      this.absorb(stored.campaigns);
    } catch (error) {
      iamLog(`could not reload display history (${String(error)})`);
    }
  }

  override recordDisplay(campaignId: number, atMs: number): void {
    super.recordDisplay(campaignId, atMs);
    this.persist();
  }

  /** Keeps the later of the two timestamps for every campaign present in both. */
  private absorb(campaigns: ReadonlyMap<number, number>): void {
    for (const [id, at] of campaigns) {
      const mine = this.history.get(id);
      if (mine === undefined || at > mine) this.history.set(id, at);
      if (this.lastDisplayAt === null || at > this.lastDisplayAt)
        this.lastDisplayAt = at;
    }
  }

  private persist(): void {
    if (this.customerId === null) return;
    try {
      // Merge on write: another tab may have recorded a display since this one last read, and a
      // plain overwrite would erase it (last writer wins). The union is the honest history.
      const raw = this.store.get(DISPLAY_HISTORY_KEY);
      let stored: StoredHistory | null = null;
      try {
        stored = raw ? decodeEnvelope(raw) : null;
      } catch {
        // A corrupt key must not stop history from persisting for the rest of the page load;
        // replacing it with this tab's own history is the self-healing move.
        iamLog('display history key was corrupt; replacing it');
      }
      if (stored && stored.customerId === this.customerId)
        this.absorb(stored.campaigns);
      if (this.history.size === 0) {
        this.store.remove(DISPLAY_HISTORY_KEY);
        return;
      }
      const campaigns: Record<string, string> = {};
      for (const [id, at] of this.history)
        campaigns[String(id)] = new Date(at).toISOString();
      this.store.set(
        DISPLAY_HISTORY_KEY,
        JSON.stringify({ customerId: this.customerId, campaigns })
      );
    } catch (error) {
      iamLog(`could not persist display history (${String(error)})`);
    }
  }
}
