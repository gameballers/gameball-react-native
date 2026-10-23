/**
 * The switch lives on the global rather than in this module's scope, so that a bundler which
 * gives two entry points their own copy of this file still shares one flag between them: a
 * module-local flag would leave half the module's lines printing after logging was turned off.
 */
const FLAG = '__gameballIamLogEnabled';
type LogHost = { [FLAG]?: boolean };

/** Local diagnostics for the in-app messaging module. Never sent anywhere. */
export function iamLog(message: string): void {
  if (!isLogEnabled()) return;
  console.log(`[GameballIAM] ${message}`);
}

export function setLogEnabled(value: boolean): void {
  (globalThis as LogHost)[FLAG] = value;
}

export function isLogEnabled(): boolean {
  // Until init() configures it, follow the build as configure() does; on in plain JS runtimes
  return (
    (globalThis as LogHost)[FLAG] ?? (typeof __DEV__ === 'undefined' || __DEV__)
  );
}
