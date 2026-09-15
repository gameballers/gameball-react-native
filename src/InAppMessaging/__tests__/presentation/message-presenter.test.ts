import { ReactMessagePresenter } from '../../presentation/message-presenter';
import type { PresentedMessage } from '../../presentation/message-presenter';
import type { PresentCallbacks } from '../../presentation/presenter';
import { message } from '../helpers/fixtures';

function callbacks(): PresentCallbacks & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    onShown: () => calls.push('shown'),
    onButtonPressed: (b) => calls.push(`button:${b.id}`),
    onMessagePressed: () => calls.push('tap'),
    onDismissed: () => calls.push('dismissed'),
  };
}

function host(presenter: ReactMessagePresenter) {
  let current: PresentedMessage | null = null;
  const detach = presenter.attach((next) => {
    current = next;
  });
  return {
    detach,
    get current(): PresentedMessage | null {
      return current;
    },
  };
}

describe('ReactMessagePresenter', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('refuses to present until a host is mounted, so no impression is counted off screen', () => {
    const presenter = new ReactMessagePresenter();
    const cb = callbacks();
    expect(presenter.hasSurface).toBe(false);
    expect(presenter.present(message(), cb)).toBe(false);
    expect(cb.calls).toEqual([]);

    host(presenter);
    expect(presenter.hasSurface).toBe(true);
    expect(presenter.present(message(), cb)).toBe(true);
  });

  it('publishes the message to the host and reports shown on its first layout only', () => {
    const presenter = new ReactMessagePresenter();
    const mounted = host(presenter);
    const cb = callbacks();
    presenter.present(message({ id: 'm1' }), cb);

    expect(mounted.current?.message.id).toBe('m1');
    expect(cb.calls).toEqual([]);
    mounted.current?.onShown();
    mounted.current?.onShown();
    expect(cb.calls).toEqual(['shown']);
  });

  it('refuses a second message while one is showing', () => {
    const presenter = new ReactMessagePresenter();
    host(presenter);
    expect(presenter.present(message({ id: '1' }), callbacks())).toBe(true);
    expect(presenter.present(message({ id: '2' }), callbacks())).toBe(false);
  });

  it('auto-dismisses from the moment it was seen, not the moment it was presented', () => {
    const presenter = new ReactMessagePresenter();
    const mounted = host(presenter);
    const cb = callbacks();
    presenter.present(message({ autoDismissMs: 8000 }), cb);

    // Nothing is on screen yet, so the clock has not started.
    jest.advanceTimersByTime(8000);
    expect(cb.calls).toEqual([]);

    mounted.current?.onShown();
    jest.advanceTimersByTime(7999);
    expect(cb.calls).toEqual(['shown']);
    jest.advanceTimersByTime(1);
    expect(cb.calls).toEqual(['shown', 'dismissed']);
    expect(mounted.current).toBeNull();
  });

  it('a message with no auto-dismiss stays until it is dismissed', () => {
    const presenter = new ReactMessagePresenter();
    const mounted = host(presenter);
    const cb = callbacks();
    presenter.present(message({ autoDismissMs: null }), cb);
    mounted.current?.onShown();
    jest.advanceTimersByTime(600_000);
    expect(cb.calls).toEqual(['shown']);
    presenter.dismiss();
    expect(cb.calls).toEqual(['shown', 'dismissed']);
  });

  it('dismiss is idempotent and cancels the auto-dismiss it armed', () => {
    const presenter = new ReactMessagePresenter();
    const mounted = host(presenter);
    const cb = callbacks();
    presenter.present(message({ autoDismissMs: 5000 }), cb);
    mounted.current?.onShown();
    presenter.dismiss();
    presenter.dismiss();
    jest.advanceTimersByTime(10_000);
    expect(cb.calls).toEqual(['shown', 'dismissed']);
  });

  it('forwards taps on the surface and on a button', () => {
    const presenter = new ReactMessagePresenter();
    const mounted = host(presenter);
    const cb = callbacks();
    const m = message({
      buttons: [
        { id: 'go', text: 'Go', action: { type: 'dismiss' }, style: {} },
      ],
    });
    presenter.present(m, cb);
    mounted.current?.callbacks.onMessagePressed();
    mounted.current?.callbacks.onButtonPressed(m.buttons[0]!);
    expect(cb.calls).toEqual(['tap', 'button:go']);
  });

  it('a host that unmounts leaves no surface, and a later one sees what is showing', () => {
    const presenter = new ReactMessagePresenter();
    const first = host(presenter);
    presenter.present(message({ id: 'm1' }), callbacks());
    first.detach();
    expect(presenter.hasSurface).toBe(false);

    const second = host(presenter);
    expect(second.current?.message.id).toBe('m1');
  });

  it('dispose dismisses and releases the surface', () => {
    const presenter = new ReactMessagePresenter();
    host(presenter);
    const cb = callbacks();
    presenter.present(message(), cb);
    presenter.dispose();
    expect(cb.calls).toEqual(['dismissed']);
    expect(presenter.hasSurface).toBe(false);
    expect(presenter.isShowing).toBe(false);
  });
});
