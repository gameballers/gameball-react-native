import { gameKey, messageKey } from '../../models/campaign-key';
import { MemoryStore } from '../../storage/key-value-store';
import {
  InMemoryFrequencyCap,
  StoredFrequencyCap,
} from '../../evaluation/frequency-cap';

const T0 = Date.parse('2026-09-06T10:00:00Z');

describe('InMemoryFrequencyCap', () => {
  it('starts empty and records displays', () => {
    const cap = new InMemoryFrequencyCap();
    cap.load('c1');
    expect(cap.snapshot().lastDisplayAt).toBeNull();
    cap.recordDisplay(messageKey(7), T0);
    cap.recordDisplay(messageKey(8), T0 + 1000);
    const s = cap.snapshot();
    expect(s.lastDisplayByCampaign.get(messageKey(7))).toBe(T0);
    expect(s.lastDisplayAt).toBe(T0 + 1000);
  });
});

describe('StoredFrequencyCap', () => {
  it('persists per customer and restores across instances', () => {
    const store = new MemoryStore();
    const a = new StoredFrequencyCap(store);
    a.load('c1');
    a.recordDisplay(messageKey(7), T0);
    const b = new StoredFrequencyCap(store);
    b.load('c1');
    expect(b.snapshot().lastDisplayByCampaign.get(messageKey(7))).toBe(T0);
    expect(b.snapshot().lastDisplayAt).toBe(T0);
    expect(JSON.parse(store.get('gameball_iam_display_history')!)).toEqual({
      customerId: 'c1',
      campaigns: { 'message:7': new Date(T0).toISOString() },
    });
  });
  it('discards history that belongs to another customer', () => {
    const store = new MemoryStore();
    const a = new StoredFrequencyCap(store);
    a.load('c1');
    a.recordDisplay(messageKey(7), T0);
    const b = new StoredFrequencyCap(store);
    b.load('c2');
    expect(b.snapshot().lastDisplayByCampaign.size).toBe(0);
    expect(store.get('gameball_iam_display_history')).toBeNull();
  });
  it('survives corrupt storage', () => {
    const store = new MemoryStore();
    store.set('gameball_iam_display_history', '{nope');
    const cap = new StoredFrequencyCap(store);
    expect(() => cap.load('c1')).not.toThrow();
    expect(cap.snapshot().lastDisplayAt).toBeNull();
  });
  it('merges what another tab wrote instead of overwriting it, and reload() picks it up', () => {
    const store = new MemoryStore();
    const tabA = new StoredFrequencyCap(store);
    const tabB = new StoredFrequencyCap(store);
    tabA.load('c1');
    tabB.load('c1');
    tabA.recordDisplay(messageKey(1), T0);
    tabB.recordDisplay(messageKey(2), T0 + 1000);
    expect(JSON.parse(store.get('gameball_iam_display_history')!)).toEqual({
      customerId: 'c1',
      campaigns: {
        'message:1': new Date(T0).toISOString(),
        'message:2': new Date(T0 + 1000).toISOString(),
      },
    });
    expect(tabA.snapshot().lastDisplayByCampaign.get(messageKey(2))).toBeUndefined();
    tabA.reload();
    expect(tabA.snapshot().lastDisplayByCampaign.get(messageKey(1))).toBe(T0);
    expect(tabA.snapshot().lastDisplayByCampaign.get(messageKey(2))).toBe(T0 + 1000);
    expect(tabA.snapshot().lastDisplayAt).toBe(T0 + 1000);
  });
  it('reload before the first load is a no-op', () => {
    const cap = new StoredFrequencyCap(new MemoryStore());
    expect(() => cap.reload()).not.toThrow();
    expect(cap.snapshot().lastDisplayAt).toBeNull();
  });
  it('load resets in-memory state', () => {
    const cap = new StoredFrequencyCap(new MemoryStore());
    cap.load('c1');
    cap.recordDisplay(messageKey(7), T0);
    cap.load('c2');
    expect(cap.snapshot().lastDisplayAt).toBeNull();
  });
  it('a reload triggered by a tab signed in as another customer leaves this tab alone', () => {
    const store = new MemoryStore();
    const tabA = new StoredFrequencyCap(store);
    tabA.load('c1');
    tabA.recordDisplay(messageKey(1), T0);
    const tabB = new StoredFrequencyCap(store);
    tabB.load('c2'); // discards c1's envelope, as a fresh sign-in does
    tabB.recordDisplay(messageKey(2), T0 + 1000);
    tabA.reload();
    expect(tabA.snapshot().lastDisplayByCampaign.get(messageKey(1))).toBe(T0);
    expect(tabA.snapshot().lastDisplayByCampaign.get(messageKey(2))).toBeUndefined();
    expect(
      JSON.parse(store.get('gameball_iam_display_history')!).customerId
    ).toBe('c2');
  });
  it('a corrupt history key is replaced on the next display instead of blocking persistence', () => {
    const store = new MemoryStore();
    store.set('gameball_iam_display_history', '{nope');
    const cap = new StoredFrequencyCap(store);
    cap.load('c1');
    cap.recordDisplay(messageKey(1), T0);
    expect(JSON.parse(store.get('gameball_iam_display_history')!)).toEqual({
      customerId: 'c1',
      campaigns: { 'message:1': new Date(T0).toISOString() },
    });
  });

  it('reads history written before game campaigns as message campaigns', () => {
    // Every history written by an earlier release keys on a bare number. Without this an update
    // loses it, and every once-ever campaign shows again.
    const store = new MemoryStore();
    store.set(
      'gameball_iam_display_history',
      JSON.stringify({
        customerId: 'c1',
        campaigns: { '7': new Date(T0).toISOString() },
      })
    );
    const cap = new StoredFrequencyCap(store);
    cap.load('c1');

    expect(cap.snapshot().lastDisplayByCampaign.get(messageKey(7))).toBe(T0);
  });

  it('keeps a game and a message of the same number apart across a reload', () => {
    const store = new MemoryStore();
    const cap = new StoredFrequencyCap(store);
    cap.load('c1');
    cap.recordDisplay(messageKey(9645), T0);
    cap.recordDisplay(gameKey(9645), T0 + 1000);

    const reloaded = new StoredFrequencyCap(store);
    reloaded.load('c1');

    expect(reloaded.snapshot().lastDisplayByCampaign.size).toBe(2);
    expect(reloaded.snapshot().lastDisplayByCampaign.get(gameKey(9645))).toBe(
      T0 + 1000
    );
  });
});