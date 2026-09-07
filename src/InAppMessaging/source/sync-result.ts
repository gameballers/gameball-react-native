import type { Campaign } from '../models/campaign';
import type { QuietHours } from '../models/quiet-hours';

/** Fallback gap between any two displayed messages when the sync omits `cooldownSeconds`. */
export const DEFAULT_DISPLAY_COOLDOWN_MS = 30_000;

export interface SyncResult {
  campaigns: Campaign[];
  cooldownMs: number;
  quietHours: QuietHours | null;
  /** The response exactly as it arrived; null for a result read from the cache. */
  rawJson: string | null;
}

export function emptySyncResult(): SyncResult {
  return {
    campaigns: [],
    cooldownMs: DEFAULT_DISPLAY_COOLDOWN_MS,
    quietHours: null,
    rawJson: null,
  };
}
