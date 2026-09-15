/**
 * The alpha credentials this sample runs against.
 *
 * `config.local.ts` is gitignored and holds the real key; `config.local.example.ts` shows its
 * shape. The key never enters a tracked file, exactly as in the web samples.
 */
export interface SampleConfig {
  apiKey: string;
  apiBaseUrl: string;
  customerId: string;
  lang: string;
  /** Where the simulator driver collects the panel's log lines and serves its commands. */
  reportUrl?: string;
}

let loaded: SampleConfig | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  loaded = require('./config.local').config as SampleConfig;
} catch {
  loaded = null;
}

export const config: SampleConfig | null = loaded;
