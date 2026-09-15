import {
  AsyncStorageStore,
  IAM_STORAGE_KEYS,
  type AsyncStorageLike,
} from '../../storage/async-storage-store';

function fakeStorage(
  seed: Record<string, string> = {},
  fail: { read?: boolean; write?: boolean } = {}
) {
  const map = new Map(Object.entries(seed));
  const writes: [string, string | null][] = [];
  const backing: AsyncStorageLike = {
    multiGet: async (keys) => {
      if (fail.read) {
        throw new Error('read failed');
      }
      return keys.map((k) => [k, map.get(k) ?? null] as const);
    },
    setItem: async (k, v) => {
      if (fail.write) {
        throw new Error('write failed');
      }
      writes.push([k, v]);
      map.set(k, v);
    },
    removeItem: async (k) => {
      if (fail.write) {
        throw new Error('write failed');
      }
      writes.push([k, null]);
      map.delete(k);
    },
  };
  return { backing, map, writes };
}

const settle = () => new Promise((r) => setTimeout(r, 0));

describe('AsyncStorageStore', () => {
  it('hydrates this module keys and then reads them synchronously', async () => {
    const { backing } = fakeStorage({
      gameball_iam_display_history: '{"a":1}',
      unrelated_key: 'not ours',
    });
    const store = new AsyncStorageStore(backing);
    // Before hydration the store is empty, which is why messaging waits for it.
    expect(store.get('gameball_iam_display_history')).toBeNull();
    await store.hydrate();
    expect(store.get('gameball_iam_display_history')).toBe('{"a":1}');
    expect(store.get('unrelated_key')).toBeNull();
    expect(store.isPersistent).toBe(true);
  });

  it('reads only the four keys the module owns', async () => {
    const seen: string[] = [];
    const backing: AsyncStorageLike = {
      multiGet: async (keys) => {
        seen.push(...keys);
        return [];
      },
      setItem: async () => {},
      removeItem: async () => {},
    };
    await new AsyncStorageStore(backing).hydrate();
    expect(seen).toEqual([...IAM_STORAGE_KEYS]);
  });

  it('writes through, and a remove deletes rather than storing null', async () => {
    const { backing, writes, map } = fakeStorage();
    const store = new AsyncStorageStore(backing);
    await store.hydrate();
    store.set('gameball_iam_analytics_outbox', '[1]');
    expect(store.get('gameball_iam_analytics_outbox')).toBe('[1]');
    await settle();
    expect(map.get('gameball_iam_analytics_outbox')).toBe('[1]');
    store.remove('gameball_iam_analytics_outbox');
    await settle();
    expect(map.has('gameball_iam_analytics_outbox')).toBe(false);
    expect(writes).toEqual([
      ['gameball_iam_analytics_outbox', '[1]'],
      ['gameball_iam_analytics_outbox', null],
    ]);
  });

  it('without AsyncStorage it still works, in memory only', async () => {
    const store = new AsyncStorageStore(null);
    await store.hydrate();
    expect(store.isPersistent).toBe(false);
    store.set('gameball_iam_variables', '{}');
    expect(store.get('gameball_iam_variables')).toBe('{}');
  });

  it('a failed read starts empty instead of throwing', async () => {
    const { backing } = fakeStorage(
      { gameball_iam_campaign_cache: 'x' },
      { read: true }
    );
    const store = new AsyncStorageStore(backing);
    await expect(store.hydrate()).resolves.toBeUndefined();
    expect(store.get('gameball_iam_campaign_cache')).toBeNull();
  });

  it('a failed write keeps the value in memory, so the display it belongs to still happens', async () => {
    const { backing } = fakeStorage({}, { write: true });
    const store = new AsyncStorageStore(backing);
    await store.hydrate();
    store.set('gameball_iam_display_history', '{"2149":"now"}');
    await settle();
    expect(store.get('gameball_iam_display_history')).toBe('{"2149":"now"}');
  });
});
