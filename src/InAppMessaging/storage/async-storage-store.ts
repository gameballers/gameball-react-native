import { iamLog } from '../log';
import type { KeyValueStore } from './key-value-store';

/** The four keys this module owns, so a hydrate reads exactly what it will need and nothing else. */
export const IAM_STORAGE_KEYS = [
  'gameball_iam_display_history',
  'gameball_iam_campaign_cache',
  'gameball_iam_analytics_outbox',
  'gameball_iam_variables',
] as const;

/** The slice of AsyncStorage this store uses. Structural, so any compatible implementation fits. */
export interface AsyncStorageLike {
  multiGet(
    keys: readonly string[]
  ): Promise<readonly (readonly [string, string | null])[]>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/**
 * Resolves `@react-native-async-storage/async-storage` at runtime.
 *
 * It is not a dependency of this SDK: an app that does not install it still gets messaging, with
 * frequency and the analytics outbox lasting only as long as the process — the same trade the Web
 * SDK makes in a browser that blocks storage. Requiring it here rather than importing it keeps the
 * module out of the bundle of an app that does not have it.
 */
export function resolveAsyncStorage(): AsyncStorageLike | null {
  try {
    const mod = require('@react-native-async-storage/async-storage');
    const candidate = (mod?.default ?? mod) as
      | Partial<AsyncStorageLike>
      | undefined;
    if (
      candidate &&
      typeof candidate.multiGet === 'function' &&
      typeof candidate.setItem === 'function' &&
      typeof candidate.removeItem === 'function'
    ) {
      return candidate as AsyncStorageLike;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * A synchronous view over asynchronous storage.
 *
 * The core reads and writes storage inside decisions it has to make immediately — whether a
 * campaign has already been shown, what the outbox holds — so its `KeyValueStore` is synchronous,
 * as it is on every other platform (`SharedPreferences`, `UserDefaults`, `localStorage`). React
 * Native's is not, so this holds the four keys in memory, hydrated once before messaging starts,
 * and writes through afterwards. A write that fails is logged once and the in-memory value stands:
 * losing a persisted impression is better than dropping the display it belongs to.
 */
export class AsyncStorageStore implements KeyValueStore {
  private readonly map = new Map<string, string>();
  private readonly backing: AsyncStorageLike | null;
  private warned = false;

  constructor(backing: AsyncStorageLike | null = resolveAsyncStorage()) {
    this.backing = backing;
  }

  /** True when values survive a restart. False after a failed or absent AsyncStorage. */
  get isPersistent(): boolean {
    return this.backing !== null;
  }

  /**
   * Loads this module's keys into memory. Call once, and await it, before messaging starts:
   * everything after it is synchronous.
   */
  async hydrate(): Promise<void> {
    if (!this.backing) {
      iamLog(
        'AsyncStorage is not installed; frequency, the campaign cache and unsent analytics last only for this app run'
      );
      return;
    }
    try {
      const entries = await this.backing.multiGet(IAM_STORAGE_KEYS);
      for (const [key, value] of entries) {
        if (typeof value === 'string') {
          this.map.set(key, value);
        }
      }
    } catch (error) {
      // A storage that cannot be read is treated as empty rather than fatal: the customer still
      // gets messages, and the first successful write repairs it.
      iamLog(
        `could not read stored in-app messaging state (${String(
          error
        )}); starting empty`
      );
    }
  }

  get(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  set(key: string, value: string): void {
    this.map.set(key, value);
    void this.persist(key, value);
  }

  remove(key: string): void {
    this.map.delete(key);
    void this.persist(key, null);
  }

  private async persist(key: string, value: string | null): Promise<void> {
    if (!this.backing) {
      return;
    }
    try {
      if (value === null) {
        await this.backing.removeItem(key);
      } else {
        await this.backing.setItem(key, value);
      }
    } catch (error) {
      if (!this.warned) {
        this.warned = true;
        iamLog(
          `could not write in-app messaging state (${String(
            error
          )}); it stays in memory`
        );
      }
    }
  }
}
