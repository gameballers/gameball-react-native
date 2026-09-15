import GameballApp from 'react-native-gameball';
import { config } from './config';

/**
 * The SDK, configured once at import time.
 *
 * `init` is asynchronous — it fetches the account's bot settings — and every call that reaches the
 * network refuses to run until it has resolved. Firing it from a component effect leaves a window
 * in which the app is mounted and interactive but the SDK is not ready, and a child's effect runs
 * before its parent's, so the QA panel would be taking commands inside exactly that window.
 * Starting it here, and handing out the promise, closes the window for every caller.
 */
export const gameballReady: Promise<void> = config
  ? GameballApp.getInstance()
      .init({
        apiKey: config.apiKey,
        lang: config.lang,
        apiPrefix: config.apiBaseUrl,
      })
      .catch((error: unknown) => {
        console.log(`[GameballIAM] init failed (${String(error)})`);
      })
  : Promise.resolve();
