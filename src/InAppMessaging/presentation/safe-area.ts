import { Platform, StatusBar } from 'react-native';
import { iamLog } from '../log';

export interface Insets {
  top: number;
  bottom: number;
}

interface WindowMetrics {
  insets?: { top?: unknown; bottom?: unknown };
}

function positive(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : 0;
}

let resolved: Insets | null = null;

/**
 * The device's safe-area insets, as well as the SDK can know them.
 *
 * React Native's core exposes nothing here: `StatusBar.currentHeight` is Android-only, and the one
 * component that reads the insets is deprecated and warns. So this asks
 * `react-native-safe-area-context` — the community standard, and already present in any app using
 * React Navigation — through `initialWindowMetrics`, a plain value read at start-up that needs no
 * provider and works inside a `Modal`. It is resolved at runtime and optional, exactly like
 * AsyncStorage: absent, the numbers fall back to the status-bar height on Android and to zero.
 *
 * A host that knows better passes `insets` to `<GameballInAppMessages />`, which always wins.
 */
export function deviceInsets(): Insets {
  if (resolved) {
    return resolved;
  }
  const fallback: Insets = {
    top: Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
    bottom: 0,
  };
  try {
    const metrics: WindowMetrics | null | undefined =
      require('react-native-safe-area-context')?.initialWindowMetrics;
    const top = positive(metrics?.insets?.top);
    const bottom = positive(metrics?.insets?.bottom);
    resolved = top > 0 || bottom > 0 ? { top, bottom } : fallback;
  } catch {
    iamLog(
      'react-native-safe-area-context is not installed; messages fall back to the status-bar height. Pass insets to <GameballInAppMessages /> for exact placement.'
    );
    resolved = fallback;
  }
  return resolved;
}

/** Test seam: the insets are read once and cached for the life of the process. */
export function resetDeviceInsetsForTests(): void {
  resolved = null;
}
