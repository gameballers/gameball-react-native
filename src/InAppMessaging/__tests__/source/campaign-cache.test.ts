import syncResponse from '../fixtures/v4-sync-response.json';
import { MemoryStore } from '../../storage/key-value-store';
import { StoredCampaignCache } from '../../source/campaign-cache';

// Imported rather than read from disk: jest runs these as CommonJS, where `import.meta` does not exist.
const fixture = JSON.stringify(syncResponse);

describe('StoredCampaignCache', () => {
  it('writes and re-parses for the same customer, dropping rawJson', () => {
    const cache = new StoredCampaignCache(new MemoryStore());
    cache.write('c1', fixture);
    const r = cache.read('c1');
    expect(r.campaigns).toHaveLength(8);
    expect(r.cooldownMs).toBe(30_000);
    expect(r.rawJson).toBeNull();
  });
  it('returns empty for another customer and clears the entry', () => {
    const store = new MemoryStore();
    const cache = new StoredCampaignCache(store);
    cache.write('c1', fixture);
    expect(cache.read('c2').campaigns).toEqual([]);
    expect(store.get('gameball_iam_campaign_cache')).toBeNull();
  });
  it('returns empty on corrupt or missing data and on clear', () => {
    const store = new MemoryStore();
    const cache = new StoredCampaignCache(store);
    expect(cache.read('c1').campaigns).toEqual([]);
    store.set('gameball_iam_campaign_cache', '[1,2]');
    expect(cache.read('c1').campaigns).toEqual([]);
    cache.write('c1', fixture);
    cache.clear();
    expect(cache.read('c1').campaigns).toEqual([]);
  });
});
