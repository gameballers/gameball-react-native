import React from 'react';
import { View } from 'react-native';

/**
 * Stands in for `react-native-webview` under Jest.
 *
 * The real one reaches for a native module through `TurboModuleRegistry.getEnforcing`, which
 * throws outside an app — importing it would fail the whole suite at parse time rather than fail
 * an assertion.
 *
 * The stub keeps the props a test needs to drive: `onMessage` is how the injected readiness
 * script reports back, so a test can deliver "ready" without a browser.
 */
export interface WebViewMessageEvent {
  nativeEvent: { data: string };
}

interface StubProps {
  source?: { uri?: string };
  onMessage?: (event: WebViewMessageEvent) => void;
  injectedJavaScript?: string;
  onError?: () => void;
  [key: string]: unknown;
}

export function WebView(props: StubProps): React.ReactElement {
  return <View testID="gb-webview" {...props} />;
}

export default WebView;
