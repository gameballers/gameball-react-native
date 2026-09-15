/**
 * What the in-app messaging core and its controller touch of React Native, and nothing else.
 *
 * These modules are plain TypeScript and their tests run in the `iam` jest project, which
 * deliberately does not load React Native's jest setup — that setup replaces the global timers,
 * and the analytics and service suites drive time with jest's own async fake timers.
 */
type Listener = (...args: unknown[]) => void;

export const Image = {
  prefetch: (_url: string): Promise<boolean> => Promise.resolve(true),
};

export const Platform = { OS: 'ios' as 'ios' | 'android' };

export const StatusBar = { currentHeight: 0 as number | undefined };

export const I18nManager = { isRTL: false };

/** Every URL a test told the SDK to open, newest last. */
export const openedUrls: string[] = [];

export const Linking = {
  openURL: (url: string): Promise<void> => {
    openedUrls.push(url);
    return Promise.resolve();
  },
};

let windowSize = { width: 390, height: 844 };
const dimensionListeners = new Set<Listener>();

export const Dimensions = {
  get: (_kind: string) => windowSize,
  addEventListener: (_type: string, listener: Listener) => {
    dimensionListeners.add(listener);
    return { remove: () => dimensionListeners.delete(listener) };
  },
};

/** Test helper: rotate the fake device and notify whoever is listening. */
export function setWindowSize(width: number, height: number): void {
  windowSize = { width, height };
  for (const listener of dimensionListeners) {
    listener({ window: windowSize });
  }
}

export function resetReactNativeStub(): void {
  openedUrls.length = 0;
  windowSize = { width: 390, height: 844 };
  dimensionListeners.clear();
  Platform.OS = 'ios';
  I18nManager.isRTL = false;
}

export const AppState = {
  currentState: 'active' as string,
  addEventListener: (_type: string, _listener: Listener) => ({
    remove: () => {},
  }),
};
