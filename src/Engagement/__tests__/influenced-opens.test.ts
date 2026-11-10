import type { AppOpen } from '../app-opens';
import {
  InfluencedOpens,
  MAX_SAVED_PUSHES,
  type ReceivedPush,
  type ReceivedPushStore,
} from '../influenced-opens';

/** In memory, async like AsyncStorage. */
class MemoryStore implements ReceivedPushStore {
  saved: ReceivedPush[] = [];
  async load() {
    return this.saved.map((p) => ({ ...p }));
  }
  async save(pushes: ReceivedPush[]) {
    this.saved = pushes.map((p) => ({ ...p }));
  }
}

// Mirrors the Android SDK's InfluencedOpensTest.
describe('InfluencedOpens', () => {
  const minute = 60_000;
  let clock: number;
  let store: MemoryStore;
  let influenced: InfluencedOpens;

  const receive = (token: string) =>
    influenced.onReceived(token, token, clock - 500);
  const open = (fromTap = false): Promise<ReceivedPush | null> => {
    const appOpen: AppOpen = { type: 'warm', openedAt: clock, fromTap };
    return influenced.influencedBy(appOpen);
  };

  beforeEach(() => {
    clock = 1_000_000_000;
    store = new MemoryStore();
    influenced = new InfluencedOpens(store, () => clock);
  });

  it('credits an open within 30 minutes of an untapped push', async () => {
    await receive('tok-1');
    clock += 10 * minute;

    expect((await open())?.clickToken).toBe('tok-1');
  });

  it('credits an open at exactly 30 minutes', async () => {
    await receive('tok-1');
    clock += 30 * minute;

    expect((await open())?.clickToken).toBe('tok-1');
  });

  it('does not credit an open after 30 minutes', async () => {
    await receive('tok-1');
    clock += 31 * minute;

    expect(await open()).toBeNull();
  });

  it('never credits a tapped push', async () => {
    await receive('tok-1');
    clock += minute;
    await influenced.onTap('tok-1');

    expect(await open()).toBeNull();
  });

  it('gives the credit to the most recent push', async () => {
    await receive('tok-1');
    clock += 5 * minute;
    await receive('tok-2');
    clock += 5 * minute;

    expect((await open())?.clickToken).toBe('tok-2');
  });

  it('removes only the tapped push', async () => {
    await receive('tok-1');
    clock += minute;
    await receive('tok-2');
    await influenced.onTap('tok-2');
    clock += minute;

    expect((await open())?.clickToken).toBe('tok-1');
  });

  it('clears the saved pushes on an open', async () => {
    await receive('tok-1');
    clock += minute;
    await open();
    clock += minute;

    expect(await open()).toBeNull();
    expect(store.saved).toEqual([]);
  });

  it('clears the saved pushes on an open that is not influenced', async () => {
    await receive('tok-1');
    clock += 31 * minute;
    await open();

    expect(store.saved).toEqual([]);
  });

  it('credits nothing on an open from a tap, even an older untapped push, and clears the list', async () => {
    await receive('tok-A');
    clock += 5 * minute;
    await receive('tok-B');
    await influenced.onTap('tok-B');
    clock += minute;

    expect(await open(true)).toBeNull();
    expect(store.saved).toEqual([]);
  });

  it('does not credit an open with no push', async () => {
    expect(await open()).toBeNull();
  });

  it('saves the same push once', async () => {
    await receive('tok-1');
    await receive('tok-1');

    expect(store.saved).toHaveLength(1);
  });

  it('keeps at most 20 pushes, dropping the oldest', async () => {
    for (let i = 0; i < 25; i++) {
      await receive(`tok-${i}`);
      clock += 1;
    }

    expect(store.saved).toHaveLength(MAX_SAVED_PUSHES);
    expect(store.saved[store.saved.length - 1]!.clickToken).toBe('tok-24');
    expect(store.saved[0]!.clickToken).toBe('tok-5');
  });

  it('forgets everything on clear', async () => {
    await receive('tok-1');
    await influenced.clear();

    expect(await open()).toBeNull();
  });

  it('keeps a push that arrived after the open for the next open', async () => {
    const appOpen: AppOpen = { type: 'warm', openedAt: clock, fromTap: false };
    clock += 1_000;
    await receive('tok-late');

    expect(await influenced.influencedBy(appOpen)).toBeNull();
    expect(store.saved.map((p) => p.key)).toEqual(['tok-late']);
  });

  it('runs operations one after another, so none loses another one’s change', async () => {
    await Promise.all([receive('a'), receive('b'), receive('c')]);

    expect(store.saved.map((p) => p.key)).toEqual(['a', 'b', 'c']);
  });

  it('records sentAt and receivedAt', async () => {
    await influenced.onReceived('k', 'tok', 123);

    expect(store.saved).toEqual([
      { key: 'k', clickToken: 'tok', sentAt: 123, receivedAt: clock },
    ]);
  });
});
