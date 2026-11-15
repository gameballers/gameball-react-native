import type { AppStateLike } from '../app-opens';
import { Engagement } from '../engagement';
import {
  InfluencedOpens,
  type ReceivedPush,
  type ReceivedPushStore,
} from '../influenced-opens';
import type { PushEngagementBody } from '../push-engagement';

class MemoryStore implements ReceivedPushStore {
  saved: ReceivedPush[] = [];
  async load() {
    return this.saved.map((p) => ({ ...p }));
  }
  async save(pushes: ReceivedPush[]) {
    this.saved = pushes.map((p) => ({ ...p }));
  }
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('Engagement', () => {
  const minute = 60_000;
  let clock: number;
  let store: MemoryStore;
  let logs: string[];
  let scheduled: (() => void)[];
  let listener: ((state: any) => void) | null;
  let reports: PushEngagementBody[];
  let engagement: Engagement;

  const appState = (currentState: string): AppStateLike => ({
    currentState,
    addEventListener: (_type, l) => {
      listener = l;
      return { remove: () => {} };
    },
  });

  /** Runs the influenced-open checks that wait for a late tap, then lets them finish. */
  const afterTapGrace = async () => {
    scheduled.splice(0).forEach((work) => work());
    await flush();
  };

  const gbPush = (token: string, extra: Record<string, string> = {}) => ({
    isGB: 'true',
    gbClickToken: token,
    ...extra,
  });

  beforeEach(() => {
    clock = 1_700_000_000_000;
    store = new MemoryStore();
    logs = [];
    scheduled = [];
    listener = null;
    reports = [];
    engagement = new Engagement({
      influenced: new InfluencedOpens(store, () => clock),
      now: () => clock,
      log: (name, fields) =>
        logs.push(
          `${name} ${Object.entries(fields)
            .map(([k, v]) => `${k}=${v}`)
            .join(' ')}`
        ),
      schedule: (work) => scheduled.push(work),
      report: (body) => {
        reports.push(body);
      },
    });
  });

  describe('push_received', () => {
    it('logs and saves a Gameball push', async () => {
      const result = await engagement.onReceived(
        gbPush('tok-1'),
        clock - 2_000
      );

      expect(result).toBe(true);
      expect(logs).toEqual([
        `push_received clickToken=tok-1 sentAt=${
          clock - 2_000
        } receivedAt=${clock}`,
      ]);
      expect(store.saved.map((p) => p.key)).toEqual(['tok-1']);
    });

    it('reads isGB without caring about case', async () => {
      expect(
        await engagement.onReceived({ isGB: 'TRUE', gbClickToken: 't' })
      ).toBe(true);
    });

    it('ignores other pushes', async () => {
      expect(await engagement.onReceived({ title: 'hi' })).toBe(false);
      expect(
        await engagement.onReceived({ isGB: 'false', gbClickToken: 't' })
      ).toBe(false);
      expect(await engagement.onReceived(null)).toBe(false);
      expect(await engagement.onReceived(undefined, 1)).toBe(false);

      expect(logs).toEqual([]);
      expect(store.saved).toEqual([]);
    });

    it('logs sentAt=0 when the sent time is unknown', async () => {
      await engagement.onReceived(gbPush('tok-1'));

      expect(logs[0]).toBe(
        `push_received clickToken=tok-1 sentAt=0 receivedAt=${clock}`
      );
    });

    it('falls back to the message id as the key when there is no click token', async () => {
      await engagement.onReceived({
        'isGB': 'true',
        'google.message_id': 'm-1',
      });

      expect(logs[0]).toContain('clickToken=null');
      expect(store.saved.map((p) => p.key)).toEqual(['m-1']);
    });
  });

  describe('push_click', () => {
    it('counts a tap once per app run', () => {
      expect(engagement.onTap(gbPush('tok-1'))).toBe(true);
      expect(engagement.onTap(gbPush('tok-1'))).toBe(false);

      expect(logs).toEqual(['push_click clickToken=tok-1']);
    });

    it('counts different pushes separately', () => {
      engagement.onTap(gbPush('tok-1'));
      engagement.onTap(gbPush('tok-2'));

      expect(logs).toEqual([
        'push_click clickToken=tok-1',
        'push_click clickToken=tok-2',
      ]);
    });

    it('uses the message id when there is no click token', () => {
      const push = { 'isGB': 'true', 'google.message_id': 'm-1' };
      expect(engagement.onTap(push)).toBe(true);
      expect(engagement.onTap(push)).toBe(false);
      expect(logs).toEqual(['push_click clickToken=null']);
    });

    it('removes the tapped push from the saved pushes', async () => {
      await engagement.onReceived(gbPush('tok-1'));
      engagement.onTap(gbPush('tok-1'));
      await flush();

      expect(store.saved).toEqual([]);
    });
  });

  describe('app_open and influenced_open', () => {
    it('logs a cold open when started while active', () => {
      engagement.start(appState('active'));

      expect(logs).toEqual([`app_open type=cold openedAt=${clock}`]);
    });

    it('starts once however often init runs', () => {
      engagement.start(appState('active'));
      engagement.start(appState('active'));

      expect(logs).toHaveLength(1);
    });

    it('logs nothing for a return within 30 s and a warm open after', () => {
      engagement.start(appState('active'));
      listener!('background');
      clock += 10_000;
      listener!('active');
      listener!('background');
      clock += 31_000;
      listener!('active');

      expect(logs).toEqual([
        `app_open type=cold openedAt=${clock - 41_000}`,
        `app_open type=warm openedAt=${clock}`,
      ]);
    });

    it('credits an open soon after an untapped push', async () => {
      const receivedAt = clock;
      await engagement.onReceived(gbPush('tok-1'), clock - 1_000);
      clock += 5 * minute;
      engagement.start(appState('active'));
      await afterTapGrace();

      expect(logs.slice(1)).toEqual([
        `app_open type=cold openedAt=${clock}`,
        `influenced_open clickToken=tok-1 sentAt=${
          receivedAt - 1_000
        } receivedAt=${receivedAt} type=cold openedAt=${clock}`,
      ]);
      expect(store.saved).toEqual([]);
    });

    it('does not credit a push the app was opened by tapping, even when the tap comes after the open', async () => {
      await engagement.onReceived(gbPush('tok-1'));
      clock += minute;
      engagement.start(appState('active')); // the open is seen first...
      engagement.onTap(gbPush('tok-1')); // ...then the app passes on the tap
      await afterTapGrace();

      expect(logs.slice(1)).toEqual([
        `app_open type=cold openedAt=${clock}`,
        'push_click clickToken=tok-1',
      ]);
    });

    it('credits the newest of two pushes', async () => {
      await engagement.onReceived(gbPush('tok-1'));
      clock += minute;
      await engagement.onReceived(gbPush('tok-2'));
      clock += minute;
      engagement.start(appState('active'));
      await afterTapGrace();

      expect(logs.filter((l) => l.startsWith('influenced_open'))).toHaveLength(
        1
      );
      expect(logs[logs.length - 1]).toContain(
        'influenced_open clickToken=tok-2'
      );
    });

    it('does not credit an open more than 30 minutes after the push', async () => {
      await engagement.onReceived(gbPush('tok-1'));
      clock += 31 * minute;
      engagement.start(appState('active'));
      await afterTapGrace();

      expect(logs.some((l) => l.startsWith('influenced_open'))).toBe(false);
      expect(store.saved).toEqual([]);
    });

    it('credits a warm open after the app was away more than 30 s', async () => {
      engagement.start(appState('active'));
      await afterTapGrace();
      listener!('background');
      clock += minute;
      await engagement.onReceived(gbPush('tok-1'));
      clock += minute;
      listener!('active');
      await afterTapGrace();

      expect(logs[logs.length - 1]).toBe(
        `influenced_open clickToken=tok-1 sentAt=0 receivedAt=${
          clock - minute
        } type=warm openedAt=${clock}`
      );
    });

    it('forgets saved pushes on clear', async () => {
      await engagement.onReceived(gbPush('tok-1'));
      await engagement.clearReceived();
      engagement.start(appState('active'));
      await afterTapGrace();

      expect(logs.some((l) => l.startsWith('influenced_open'))).toBe(false);
    });
  });

  describe('opens from a tap', () => {
    const influencedLogs = () =>
      logs.filter((l) => l.startsWith('influenced_open'));

    /** The app on screen, its first open settled, then sent to the background. */
    const openedThenAway = async () => {
      engagement.start(appState('active'));
      await afterTapGrace();
      listener!('background');
    };

    // a. A saved, then B saved and tapped, then the open
    it('credits nothing, not even an older untapped push, when a tap opened the app (tap after the open)', async () => {
      await engagement.onReceived(gbPush('tok-A'));
      clock += 5 * minute;
      await engagement.onReceived(gbPush('tok-B'));
      clock += minute;
      engagement.start(appState('active')); // cold open by the tap on B...
      engagement.onTap(gbPush('tok-B')); // ...which the app hands over just after
      await afterTapGrace();

      expect(logs.slice(2)).toEqual([
        `app_open type=cold openedAt=${clock}`,
        'push_click clickToken=tok-B',
      ]);
      expect(influencedLogs()).toEqual([]);
      expect(store.saved).toEqual([]);
    });

    it('credits nothing when the tap was handled while the app was away, just before it came back', async () => {
      await openedThenAway();
      clock += minute;
      await engagement.onReceived(gbPush('tok-A'));
      clock += 5 * minute;
      await engagement.onReceived(gbPush('tok-B'));
      clock += minute;
      engagement.onTap(gbPush('tok-B')); // RNFirebase can hand it over before AppState says active
      clock += 500;
      listener!('active');
      await afterTapGrace();

      expect(logs[logs.length - 1]).toBe(
        `app_open type=warm openedAt=${clock}`
      );
      expect(influencedLogs()).toEqual([]);
      expect(store.saved).toEqual([]);
    });

    it('counts a tap handled before init toward the cold open it caused', async () => {
      await engagement.onReceived(gbPush('tok-A'));
      clock += minute;
      engagement.onTap(gbPush('tok-B'));
      clock += 2_000;
      engagement.start(appState('active'));
      await afterTapGrace();

      expect(influencedLogs()).toEqual([]);
      expect(store.saved).toEqual([]);
    });

    // b. A tap while the app is on screen
    it('does not let a tap on screen stop the next icon open from being influenced', async () => {
      engagement.start(appState('active'));
      await afterTapGrace();
      clock += minute;
      engagement.onTap(gbPush('tok-on-screen')); // the app was already open
      listener!('background');
      clock += minute;
      await engagement.onReceived(gbPush('tok-A'));
      clock += minute;
      listener!('active'); // icon open
      await afterTapGrace();

      expect(influencedLogs()).toEqual([
        `influenced_open clickToken=tok-A sentAt=0 receivedAt=${
          clock - minute
        } type=warm openedAt=${clock}`,
      ]);
    });

    // c. A tap followed by a return within 30 s
    it('does not let a tap followed by a return within 30 s affect a later icon open', async () => {
      await openedThenAway();
      clock += 5_000;
      engagement.onTap(gbPush('tok-T'));
      clock += 1_000;
      listener!('active'); // back within 30 s: not an open, but it uses the tap up
      await afterTapGrace();
      listener!('background');
      clock += 5_000;
      await engagement.onReceived(gbPush('tok-A'));
      clock += 40_000;
      listener!('active'); // icon open, within 60 s of the tap
      await afterTapGrace();

      expect(influencedLogs()).toEqual([
        `influenced_open clickToken=tok-A sentAt=0 receivedAt=${
          clock - 40_000
        } type=warm openedAt=${clock}`,
      ]);
    });

    it('does not count a tap more than 60 s before the return', async () => {
      await openedThenAway();
      clock += minute;
      await engagement.onReceived(gbPush('tok-A'));
      engagement.onTap(gbPush('tok-T'));
      clock += 61_000;
      listener!('active');
      await afterTapGrace();

      expect(influencedLogs()).toHaveLength(1);
      expect(influencedLogs()[0]).toContain('clickToken=tok-A');
    });

    it('does not let a repeat of an already counted tap mark a later open', async () => {
      engagement.start(appState('active'));
      engagement.onTap(gbPush('tok-T')); // the tap that opened the app
      await afterTapGrace();
      listener!('background');
      clock += minute;
      await engagement.onReceived(gbPush('tok-A'));
      clock += minute;
      listener!('active'); // icon open
      engagement.onTap(gbPush('tok-T')); // the app hands the old tap over again
      await afterTapGrace();

      expect(influencedLogs()).toHaveLength(1);
      expect(influencedLogs()[0]).toContain('clickToken=tok-A');
    });
  });

  describe('reports to the backend', () => {
    const UUID_V4 =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

    it('reports an influenced open as InfluencedOpen, dated at the open rather than the check', async () => {
      await engagement.onReceived(gbPush('tok-1'), clock - 1_000);
      clock += 5 * minute;
      const openedAt = clock;
      engagement.start(appState('active'));
      clock += 10_000; // the check runs after the wait
      await afterTapGrace();

      expect(reports).toEqual([
        {
          clickToken: 'tok-1',
          engagementType: 3,
          eventUid: expect.stringMatching(UUID_V4),
          occurredAt: new Date(openedAt).toISOString(),
        },
      ]);
    });

    it('reports the push it credits: the newest', async () => {
      await engagement.onReceived(gbPush('tok-1'));
      clock += minute;
      await engagement.onReceived(gbPush('tok-2'));
      clock += minute;
      engagement.start(appState('active'));
      await afterTapGrace();

      expect(reports.map((r) => r.clickToken)).toEqual(['tok-2']);
    });

    it('logs an influenced open without a click token but does not report it', async () => {
      await engagement.onReceived({
        'isGB': 'true',
        'google.message_id': 'm-1',
      });
      clock += minute;
      engagement.start(appState('active'));
      await afterTapGrace();

      expect(
        logs.some((l) => l.startsWith('influenced_open clickToken=null'))
      ).toBe(true);
      expect(reports).toEqual([]);
    });

    it('reports nothing for an app open, an arrival or an open from a tap', async () => {
      await engagement.onReceived(gbPush('tok-1'));
      clock += minute;
      engagement.start(appState('active'));
      engagement.onTap(gbPush('tok-1')); // the tap opened the app; GameballApp reports taps
      await afterTapGrace();
      listener!('background');
      clock += 31 * minute;
      listener!('active'); // an ordinary warm open, nothing saved
      await afterTapGrace();

      expect(logs.filter((l) => l.startsWith('app_open'))).toHaveLength(2);
      expect(reports).toEqual([]);
    });

    it('gives each influenced open its own eventUid', async () => {
      await engagement.onReceived(gbPush('tok-1'));
      engagement.start(appState('active'));
      await afterTapGrace();
      listener!('background');
      clock += minute;
      await engagement.onReceived(gbPush('tok-2'));
      clock += minute;
      listener!('active');
      await afterTapGrace();

      expect(reports.map((r) => r.clickToken)).toEqual(['tok-1', 'tok-2']);
      expect(reports[0]!.eventUid).not.toBe(reports[1]!.eventUid);
    });

    it('keeps going when a report fails', async () => {
      const devLog = jest.spyOn(console, 'log').mockImplementation(() => {});
      const failing = new Engagement({
        influenced: new InfluencedOpens(store, () => clock),
        now: () => clock,
        log: () => {},
        schedule: (work) => scheduled.push(work),
        report: () => Promise.reject(new Error('HTTP 503')),
      });
      await failing.onReceived(gbPush('tok-1'));
      failing.start(appState('active'));

      await expect(afterTapGrace()).resolves.toBeUndefined();
      expect(store.saved).toEqual([]);
      devLog.mockRestore();
    });
  });
});
