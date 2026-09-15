import { CachingVariableSource } from '../../personalisation/variable-source';
import { MemoryStore } from '../../storage/key-value-store';

describe('CachingVariableSource', () => {
  let now = 1_000_000;
  const clock = () => now;

  it('caches within the ttl per customer and stores only retained tokens', async () => {
    const store = new MemoryStore();
    const fetcher = jest.fn(async () => ({
      name: 'Ana',
      email: 'a@x.io',
      points: '120',
    }));
    const src = new CachingVariableSource({ fetcher, store, clock });
    src.retainOnly(new Set(['name', 'points']));
    expect(await src.fetch('c1')).toEqual({
      name: 'Ana',
      email: 'a@x.io',
      points: '120',
    });
    await src.fetch('c1');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(JSON.parse(store.get('gameball_iam_variables')!)).toEqual({
      customerId: 'c1',
      values: { name: 'Ana', points: '120' },
    });
    await src.fetch('c2');
    expect(fetcher).toHaveBeenCalledTimes(2);
    now += 60_000;
    await src.fetch('c2');
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('falls back to stored values for the same customer when the fetch fails', async () => {
    const store = new MemoryStore();
    store.set(
      'gameball_iam_variables',
      JSON.stringify({ customerId: 'c1', values: { name: 'Ana' } })
    );
    const src = new CachingVariableSource({
      fetcher: async () => {
        throw new Error('offline');
      },
      store,
      clock,
    });
    expect(await src.fetch('c1')).toEqual({ name: 'Ana' });
    expect(await src.fetch('c2')).toEqual({});
    expect(store.get('gameball_iam_variables')).toBeNull();
  });

  it('clear forgets memory and storage', async () => {
    const store = new MemoryStore();
    const fetcher = jest.fn(async () => ({ name: 'Ana' }));
    const src = new CachingVariableSource({ fetcher, store, clock });
    src.retainOnly(new Set(['name']));
    await src.fetch('c1');
    src.clear();
    expect(store.get('gameball_iam_variables')).toBeNull();
    await src.fetch('c1');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
