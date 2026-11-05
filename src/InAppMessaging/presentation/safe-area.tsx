import React from 'react';
import { Platform, StatusBar, StyleSheet } from 'react-native';
import { iamLog } from '../log';

/** Safe-area insets in points, one for each edge. */
export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Insets as `react-native-safe-area-context` reports them, read defensively. */
interface ReportedInsets {
  top?: unknown;
  right?: unknown;
  bottom?: unknown;
  left?: unknown;
}

/** The parts of `react-native-safe-area-context` the SDK uses. */
interface SafeAreaPackage {
  initialWindowMetrics?: { insets?: ReportedInsets } | null;
  SafeAreaProvider?: React.ComponentType<{
    initialMetrics: unknown;
    style: unknown;
    pointerEvents: 'box-none';
    children: React.ReactNode;
  }>;
  SafeAreaInsetsContext?: React.Context<ReportedInsets | null>;
}

function positive(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : 0;
}

function edges(reported: ReportedInsets | null | undefined): Insets {
  return {
    top: positive(reported?.top),
    right: positive(reported?.right),
    bottom: positive(reported?.bottom),
    left: positive(reported?.left),
  };
}

/**
 * Loaded once, as this module is imported, and never during a render.
 *
 * A render must not have side effects, and this has two: it reads a package that may not be
 * there, and it logs when it is not. Doing that from a component's body is how React ends up
 * warning that one component updated another while rendering.
 */
const safeArea: SafeAreaPackage | null = load();
let resolved: Insets = resolve();

function load(): SafeAreaPackage | null {
  try {
    return require('react-native-safe-area-context') ?? null;
  } catch {
    iamLog(
      'react-native-safe-area-context is not installed; messages fall back to the status-bar height. Pass insets to <GameballInAppMessages /> for exact placement.'
    );
    return null;
  }
}

function resolve(): Insets {
  const start = edges(safeArea?.initialWindowMetrics?.insets);
  if (start.top > 0 || start.right > 0 || start.bottom > 0 || start.left > 0) {
    return start;
  }
  return {
    top: Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
    right: 0,
    bottom: 0,
    left: 0,
  };
}

/**
 * The device's safe-area insets at start-up, as well as the SDK can know them.
 *
 * React Native's core exposes nothing here: `StatusBar.currentHeight` is Android-only, and the one
 * component that reads the insets is deprecated and warns. So this asks
 * `react-native-safe-area-context` — the community standard, and already present in any app using
 * React Navigation — through `initialWindowMetrics`, a plain value read at start-up. It is
 * resolved at runtime and optional, exactly like AsyncStorage: absent, the numbers fall back to
 * the status-bar height on Android and to zero.
 *
 * What a message is drawn with is [LiveInsets], which follows these as they change. A host that
 * knows better passes `insets` to `<GameballInAppMessages />`, which always wins.
 */
export function deviceInsets(): Insets {
  return resolved;
}

/**
 * Hands [children] the device's insets as they are now, and again whenever they change: turning
 * the phone moves the notch or the Dynamic Island to a side and takes the top inset away.
 *
 * With `react-native-safe-area-context` installed this draws the package's provider, which
 * measures the screen where it is drawn — inside a `Modal`, the Modal's own — and draws the
 * children again on a change. Its view fills the layer and lets every touch through, so a
 * slide-up, or a game still loading out of sight, leaves the app usable. Without the package the
 * start-up values stand, as before.
 */
export function LiveInsets({
  children,
}: {
  children: (insets: Insets) => React.ReactNode;
}): React.ReactElement {
  const Provider = safeArea?.SafeAreaProvider;
  const Measured = safeArea?.SafeAreaInsetsContext;
  const initialMetrics = safeArea?.initialWindowMetrics;
  if (!Provider || !Measured || !initialMetrics) {
    return <>{children(resolved)}</>;
  }
  return (
    // The start-up metrics draw the first frame at once rather than a blank one; the provider
    // replaces them as soon as it has measured.
    <Provider
      initialMetrics={initialMetrics}
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
    >
      <Measured.Consumer>
        {(measured) => children(measured ? edges(measured) : resolved)}
      </Measured.Consumer>
    </Provider>
  );
}

/** Test seam: re-reads the insets after a test has changed what the platform reports. */
export function resetDeviceInsetsForTests(): void {
  resolved = resolve();
}
