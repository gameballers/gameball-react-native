export type Platform = 'web' | 'ios' | 'android';

/**
 * Host-environment hooks. Websites need none of this; the Capacitor adapter (Plan 3)
 * implements all six. Every member is optional and a missing one falls back to the web default.
 */
export interface GameballAdapter {
  platform?(): Platform;
  onAppState?(listener: (state: 'active' | 'background') => void): () => void;
  openUrl?(url: string, external: boolean): Promise<boolean>;
  requestPushPermission?(): Promise<boolean>;
  appVersion?(): Promise<string | undefined>;
  orientation?(): 'portrait' | 'landscape' | undefined;
}
