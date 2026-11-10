import {
  AppOpenObserver,
  attachAppOpens,
  type AppOpen,
  type AppStateLike,
} from '../app-opens';

// Mirrors the Android SDK's AppOpenObserverTest, plus how AppState is read.
describe('AppOpenObserver', () => {
  let clock: number;
  let opens: AppOpen[];
  let observer: AppOpenObserver;

  beforeEach(() => {
    clock = 1_000_000;
    opens = [];
    observer = new AppOpenObserver(
      (open) => opens.push(open),
      () => clock
    );
  });

  it('counts the first foreground as cold', () => {
    observer.onForeground();

    expect(opens).toEqual([
      { type: 'cold', openedAt: 1_000_000, fromTap: false },
    ]);
  });

  it('counts a return after more than 30 s as warm', () => {
    observer.onForeground();
    observer.onBackground();
    clock += 31_000;
    observer.onForeground();

    expect(opens.map((o) => o.type)).toEqual(['cold', 'warm']);
    expect(opens[1]!.openedAt).toBe(1_031_000);
  });

  it('does not count a return within 30 s', () => {
    observer.onForeground();
    observer.onBackground();
    clock += 10_000;
    observer.onForeground();

    expect(opens).toHaveLength(1);
  });

  it('does not count a return after exactly 30 s', () => {
    observer.onForeground();
    observer.onBackground();
    clock += 30_000;
    observer.onForeground();

    expect(opens).toHaveLength(1);
  });

  it('measures the gap from the last time the app left', () => {
    observer.onForeground();
    observer.onBackground();
    clock += 20_000;
    observer.onForeground(); // within the gap: same open
    clock += 60_000;
    observer.onBackground();
    clock += 20_000;
    observer.onForeground(); // 20 s away: same open

    expect(opens).toHaveLength(1);
  });

  it('ignores a repeated foreground', () => {
    observer.onForeground();
    clock += 60_000;
    observer.onForeground();

    expect(opens).toHaveLength(1);
  });

  describe('taps', () => {
    it('marks the next open when the tap was handled while the app was away', () => {
      observer.onForeground();
      observer.onBackground();
      clock += 40_000;
      observer.noteTap();
      clock += 2_000;
      observer.onForeground();

      expect(opens[1]).toEqual({
        type: 'warm',
        openedAt: 1_042_000,
        fromTap: true,
      });
    });

    it('marks the cold open when the tap came before the app was first seen', () => {
      observer.noteTap();
      clock += 3_000;
      observer.onForeground();

      expect(opens[0]!.fromTap).toBe(true);
    });

    it('marks nothing for a tap on screen', () => {
      observer.onForeground();
      observer.noteTap();
      observer.onBackground();
      clock += 40_000;
      observer.onForeground();

      expect(opens.map((o) => o.fromTap)).toEqual([false, false]);
    });

    it('does not mark a return more than 60 s after the tap', () => {
      observer.onForeground();
      observer.onBackground();
      observer.noteTap();
      clock += 61_000;
      observer.onForeground();

      expect(opens[1]!.fromTap).toBe(false);
    });

    it('uses the mark up on a return within 30 s, which is not an open', () => {
      observer.onForeground();
      observer.onBackground();
      observer.noteTap();
      clock += 10_000;
      observer.onForeground(); // same open: nothing reported, mark used up
      observer.onBackground();
      clock += 40_000;
      observer.onForeground();

      expect(opens).toHaveLength(2);
      expect(opens[1]!.fromTap).toBe(false);
    });
  });
});

describe('attachAppOpens', () => {
  let clock: number;
  let opens: AppOpen[];
  let listener: ((state: any) => void) | null;
  let removed: boolean;

  const appStateIn = (currentState: string | undefined): AppStateLike => ({
    currentState,
    addEventListener: (_type, l) => {
      listener = l;
      return { remove: () => (removed = true) };
    },
  });

  const attach = (currentState: string | undefined) =>
    attachAppOpens(
      new AppOpenObserver(
        (open) => opens.push(open),
        () => clock
      ),
      appStateIn(currentState)
    );

  beforeEach(() => {
    clock = 5_000_000;
    opens = [];
    listener = null;
    removed = false;
  });

  it('reports a cold open at once when the app is already active', () => {
    attach('active');

    expect(opens).toEqual([
      { type: 'cold', openedAt: 5_000_000, fromTap: false },
    ]);
  });

  it('waits for the first active when started in the background (headless start)', () => {
    attach('background');
    expect(opens).toHaveLength(0);

    clock += 3_600_000;
    listener!('active');

    expect(opens).toEqual([
      { type: 'cold', openedAt: 8_600_000, fromTap: false },
    ]);
  });

  it('treats inactive as still on screen', () => {
    attach('active');
    listener!('inactive');
    clock += 120_000;
    listener!('active');

    expect(opens).toHaveLength(1);
  });

  it('counts background → active after more than 30 s as warm', () => {
    attach('active');
    listener!('inactive');
    listener!('background');
    clock += 45_000;
    listener!('inactive');
    listener!('active');

    expect(opens.map((o) => o.type)).toEqual(['cold', 'warm']);
  });

  it('stops listening when detached', () => {
    const detach = attach('active');
    detach();

    expect(removed).toBe(true);
  });
});
