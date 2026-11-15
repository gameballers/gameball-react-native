import {
  attachAppStateSession,
  type AppStateLike,
} from '../../service/app-state-session';
import type { AppStateStatus } from 'react-native';

function fakeAppState(initial: AppStateStatus = 'active') {
  let listener: ((s: AppStateStatus) => void) | null = null;
  let removed = 0;
  const appState: AppStateLike = {
    currentState: initial,
    addEventListener: (_type, l) => {
      listener = l;
      return {
        remove: () => {
          removed += 1;
          listener = null;
        },
      };
    },
  };
  return {
    appState,
    emit: (s: AppStateStatus) => listener?.(s),
    get removed() {
      return removed;
    },
    get listening() {
      return listener !== null;
    },
  };
}

function recorder() {
  const calls: string[] = [];
  return {
    calls,
    onAppPaused: () => calls.push('pause'),
    onAppResumed: () => calls.push('resume'),
  };
}

describe('attachAppStateSession', () => {
  it('pauses on background and resumes on active', () => {
    const app = fakeAppState();
    const target = recorder();
    attachAppStateSession(target, app.appState);
    app.emit('background');
    app.emit('active');
    expect(target.calls).toEqual(['pause', 'resume']);
  });

  it('treats inactive as a pause, because nothing is readable behind a system prompt', () => {
    const app = fakeAppState();
    const target = recorder();
    attachAppStateSession(target, app.appState);
    app.emit('inactive');
    expect(target.calls).toEqual(['pause']);
  });

  it('reports one boundary for the inactive then background pair iOS sends', () => {
    const app = fakeAppState();
    const target = recorder();
    attachAppStateSession(target, app.appState);
    app.emit('inactive');
    app.emit('background');
    app.emit('active');
    expect(target.calls).toEqual(['pause', 'resume']);
  });

  it('ignores a repeated active, so a foreground app never re-syncs for nothing', () => {
    const app = fakeAppState();
    const target = recorder();
    attachAppStateSession(target, app.appState);
    app.emit('active');
    app.emit('active');
    expect(target.calls).toEqual([]);
  });

  it('starting while already backgrounded resumes on the next active', () => {
    const app = fakeAppState('background');
    const target = recorder();
    attachAppStateSession(target, app.appState);
    app.emit('active');
    expect(target.calls).toEqual(['resume']);
  });

  it('detaches', () => {
    const app = fakeAppState();
    const target = recorder();
    const detach = attachAppStateSession(target, app.appState);
    detach();
    expect(app.removed).toBe(1);
    expect(app.listening).toBe(false);
  });
});
