import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfo from 'react-native-device-info';
import { API_ENDPOINTS } from './constants';

const INSTALL_ID_KEY = 'gameball_install_id';

interface LoggerConfig {
  apiKey: string;
  baseUrl: string;
  sdkVersion: string;
}

/**
 * Fail-silent SDK telemetry logger. Fires one diagnostic entry per call directly to
 * api/v4.0/integrations/mobile/logs (forwarded to Datadog). The payload is sent as-is, immediately
 * and fire-and-forget; this layer must never throw into, or block, the host app.
 */
class GameballLogger {
  private context: Record<string, any> | null = null;
  private config: LoggerConfig | null = null;

  /** Configure the logger with the current SDK credentials. Called from init(). */
  configure(config: LoggerConfig): void {
    this.config = config;
  }

  /** Fire one SDK event immediately. Never throws. `params` is sent as-is. */
  log(event: string, params?: any): void {
    void this.send(event, params);
  }

  private async send(event: string, params?: any): Promise<void> {
    try {
      if (!this.config) return;
      const entry: Record<string, any> = { event, timestamp: Date.now() };
      if (params !== undefined && params !== null) entry.params = params;

      const body = { context: await this.buildContext(), logs: [entry] };
      const url = `${this.config.baseUrl}${API_ENDPOINTS.API_V4_0}${API_ENDPOINTS.MOBILE_LOGS}`;
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'APIKey': this.config.apiKey,
          'OS': Platform.OS,
          'SDKVersion': this.config.sdkVersion,
          'X-GB-Agent': `GB/react-native/${this.config.sdkVersion}`,
        },
        body: JSON.stringify(body),
      });
    } catch {
      // Telemetry must never affect the host app.
    }
  }

  private async buildContext(): Promise<Record<string, any>> {
    if (this.context) return this.context;

    let model: string | undefined;
    let osVersion: string | undefined;
    let appBundleId: string | undefined;
    try {
      model = DeviceInfo.getModel();
      osVersion = DeviceInfo.getSystemVersion();
      appBundleId = DeviceInfo.getBundleId();
    } catch {
      // best-effort
    }

    this.context = {
      sdkType: 'react-native',
      sdkVersion: this.config?.sdkVersion,
      devicePlatform: Platform.OS === 'ios' ? 'iOS' : 'Android',
      deviceOsVersion: osVersion,
      deviceModel: model,
      appBundleId,
      installId: await this.getInstallId(),
    };
    return this.context;
  }

  /** Returns the persisted per-install UUID, generating one on first access. */
  private async getInstallId(): Promise<string | null> {
    try {
      let id = await AsyncStorage.getItem(INSTALL_ID_KEY);
      if (!id) {
        id = this.uuidV4();
        await AsyncStorage.setItem(INSTALL_ID_KEY, id);
      }
      return id;
    } catch {
      return null;
    }
  }

  private uuidV4(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

export default new GameballLogger();
