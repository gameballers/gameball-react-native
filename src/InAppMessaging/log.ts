/**
 * The switch lives on the global, not in this module's scope: the CommonJS build gives the
 * `@gameball/web-sdk/capacitor` subpath its own copy of this file, so a module-local flag left
 * the adapter's `capacitor:` lines — including the URLs it opens — printing after
 * `init({ debug: false })` had silenced everything else.
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
  return (globalThis as LogHost)[FLAG] ?? true;
}
