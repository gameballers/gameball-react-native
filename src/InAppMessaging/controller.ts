import { Dimensions, Linking, Platform } from 'react-native';
import { BatchedMessageAnalytics } from './analytics/analytics';
import { GameballApiClient, DEFAULT_API_BASE_URL } from './api/client';
import { StoredFrequencyCap } from './evaluation/frequency-cap';
import { iamLog, setLogEnabled } from './log';
import type { InAppMessage } from './models/message';
import { CachingVariableSource } from './personalisation/variable-source';
import { ImageArtworkPrefetcher } from './presentation/artwork-prefetcher';
import { ReactMessagePresenter } from './presentation/message-presenter';
import {
  InAppMessagingService,
  type BeforeDisplay,
  type OnAction,
} from './service/in-app-messaging-service';
import { attachAppStateSession } from './service/app-state-session';
import { StoredCampaignCache } from './source/campaign-cache';
import { HttpMessageSource } from './source/message-source';
import { AsyncStorageStore } from './storage/async-storage-store';
import { platformCode } from './platform';
import { SDK_VERSION } from './version';

export interface InAppMessagingConfig {
  apiKey: string;
  /** Two-letter code. The identified customer's `preferredLanguage` wins over it. */
  lang?: string;
  apiBaseUrl?: string;
  appVersion?: string;
  /** Console diagnostics, prefixed `[GameballIAM]`. */
  debug?: boolean;
}

export interface StartInAppMessagingOptions {
  /** Defaults to the last identified customer. */
  customerId?: string;
  sessionTimeoutSeconds?: number;
  beforeDisplay?: BeforeDisplay;
  onAction?: OnAction;
  onNavigate?: (route: string, args?: Record<string, unknown>) => void;
  /** Every selected message, whatever the host then decides. */
  onMessage?: (message: InAppMessage) => void;
  openUrl?: (url: string, external: boolean) => boolean | Promise<boolean>;
  requestPushPermission?: () => Promise<boolean>;
}

/** Everything a campaign URL could reasonably be, and nothing a campaign should be able to run. */
const OPENABLE_SCHEMES = ['http:', 'https:', 'mailto:', 'tel:'];

function isOpenable(url: string): boolean {
  const scheme = /^([a-z][a-z0-9+.-]*:)/i.exec(url.trim())?.[1]?.toLowerCase();
  if (!scheme) {
    // A relative URL means nothing to a native app; there is no page to be relative to.
    iamLog(`refusing to open "${url}": it is not an absolute URL`);
    return false;
  }
  if (!OPENABLE_SCHEMES.includes(scheme)) {
    iamLog(`refusing to open "${url}": unsupported scheme`);
    return false;
  }
  return true;
}

/**
 * Owns the in-app messaging module for the app.
 *
 * `GameballApp` delegates to this rather than growing another 300 lines: everything here is about
 * messaging, and the SDK's other features do not need to know it exists.
 */
export class InAppMessagingController {
  readonly presenter = new ReactMessagePresenter({
    orientation: () => {
      const { width, height } = Dimensions.get('window');
      return width > height ? 'landscape' : 'portrait';
    },
  });

  private config: InAppMessagingConfig | null = null;
  private api: GameballApiClient | null = null;
  private service: InAppMessagingService | null = null;
  private detachSession: (() => void) | null = null;
  private detachOrientation: (() => void) | null = null;
  private customerId: string | null = null;
  private preferredLanguage: string | null = null;
  private overlayOpen = false;
  private starting: Promise<void> | null = null;
  private readonly listeners = new Set<(message: InAppMessage) => void>();

  configure(config: InAppMessagingConfig): void {
    this.config = config;
    setLogEnabled(config.debug ?? __DEV__);
    this.api = new GameballApiClient({
      apiKey: () => this.config?.apiKey ?? '',
      baseUrl: () => this.config?.apiBaseUrl ?? DEFAULT_API_BASE_URL,
      lang: () => this.language(),
      platformCode: () =>
        platformCode(Platform.OS === 'ios' ? 'ios' : 'android'),
      appVersion: () => this.config?.appVersion ?? '',
      sdkVersion: SDK_VERSION,
    });
  }

  get isStarted(): boolean {
    return this.service?.isStarted ?? false;
  }

  /** The customer messaging targets, and the language their messages are chosen in. */
  identified(customerId: string, preferredLanguage?: string | null): void {
    if (
      typeof preferredLanguage === 'string' &&
      preferredLanguage.length === 2
    ) {
      this.preferredLanguage = preferredLanguage;
    } else if (this.customerId !== customerId) {
      // A language belongs to the customer who declared it, never to whoever came before.
      this.preferredLanguage = null;
    }
    const changed = this.customerId !== null && this.customerId !== customerId;
    this.customerId = customerId;
    if (changed) {
      this.service?.onCustomerChanged(customerId);
    }
  }

  /**
   * Syncs campaigns and starts evaluating triggers.
   *
   * Awaited, unlike the other SDKs' equivalents, for one reason: storage is asynchronous on this
   * platform and the frequency history has to be in memory before the first campaign is judged
   * against it, or a once-ever message could show a second time.
   */
  async start(options: StartInAppMessagingOptions = {}): Promise<void> {
    if (this.starting) {
      return this.starting;
    }
    this.starting = this.startInternal(options).finally(() => {
      this.starting = null;
    });
    return this.starting;
  }

  private async startInternal(
    options: StartInAppMessagingOptions
  ): Promise<void> {
    const api = this.api;
    if (!api || !this.config) {
      iamLog('startInAppMessaging ignored: call init({ apiKey }) first');
      return;
    }
    const customerId = options.customerId ?? this.customerId;
    if (!customerId) {
      iamLog(
        'startInAppMessaging ignored: no customerId — pass one or identify a customer first'
      );
      return;
    }
    this.customerId = customerId;

    if (!this.service) {
      const store = new AsyncStorageStore();
      await store.hydrate();

      this.service = new InAppMessagingService({
        source: new HttpMessageSource((id) => api.sync(id)),
        presenter: this.presenter,
        frequencyCap: new StoredFrequencyCap(store),
        campaignCache: new StoredCampaignCache(store),
        analytics: new BatchedMessageAnalytics({
          store,
          send: (id, events) => api.sendMessageEvents(id, events),
        }),
        prefetcher: new ImageArtworkPrefetcher(),
        variables: new CachingVariableSource({
          store,
          fetcher: (id) => api.fetchVariables(id),
        }),
        hasSurface: () => this.presenter.hasSurface,
        isHostOverlayOpen: () => this.overlayOpen,
        navigate: (route, args) => {
          if (options.onNavigate) {
            options.onNavigate(route, args);
          } else {
            iamLog(
              `navigate to "${route}" ignored: pass onNavigate to startInAppMessaging()`
            );
          }
        },
        openUrl: async (url, external) => {
          if (!isOpenable(url)) {
            return false;
          }
          if (options.openUrl) {
            return options.openUrl(url, external);
          }
          // React Native has no in-app browser without a dependency this SDK does not take, so
          // both kinds of link leave for the system browser. An app that ships one should pass
          // `openUrl` and decide for itself.
          try {
            await Linking.openURL(url);
            return true;
          } catch (error) {
            iamLog(`could not open "${url}" (${String(error)})`);
            return false;
          }
        },
        requestPushPermission: async () => {
          if (options.requestPushPermission) {
            return options.requestPushPermission();
          }
          iamLog(
            'a campaign asked for push permission but no requester was provided; pass requestPushPermission to startInAppMessaging()'
          );
          return false;
        },
        emit: (message) => {
          try {
            options.onMessage?.(message);
          } catch (error) {
            iamLog(`onMessage threw (${String(error)})`);
          }
          for (const listener of this.listeners) {
            try {
              listener(message);
            } catch (error) {
              iamLog(`onInAppMessage listener threw (${String(error)})`);
            }
          }
        },
        sessionTimeoutMs:
          options.sessionTimeoutSeconds !== undefined
            ? options.sessionTimeoutSeconds * 1000
            : undefined,
      });

      const service = this.service;
      this.detachSession = attachAppStateSession(service);
      // Rotating the device can make a parked full screen presentable.
      const subscription = Dimensions.addEventListener('change', () =>
        service.onDisplayOpportunity()
      );
      this.detachOrientation = () => subscription.remove();
    }

    await this.service.start({
      customerId,
      beforeDisplay: options.beforeDisplay,
      onAction: options.onAction,
    });
  }

  stop(): void {
    this.service?.stop();
    this.detachSession?.();
    this.detachOrientation?.();
    this.detachSession = null;
    this.detachOrientation = null;
    this.presenter.dismiss();
    this.service = null;
  }

  /** Hold messages while the app's own modal, drawer or checkout step is open. */
  setOverlayOpen(open: boolean): void {
    this.overlayOpen = open;
    if (!open) {
      this.service?.onHostOverlayClosed();
    }
  }

  onMessage(listener: (message: InAppMessage) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Every custom event the app sends is also a trigger, evaluated before the request goes out. */
  onCustomEvent(name: string, properties: Record<string, unknown>): void {
    try {
      this.service?.onCustomEvent(name, properties);
    } catch (error) {
      iamLog(`onCustomEvent hook failed (${String(error)})`);
    }
  }

  private language(): string {
    const preferred = this.preferredLanguage;
    if (preferred && preferred.length === 2) {
      return preferred;
    }
    const global = this.config?.lang;
    return global && global.length === 2 ? global : 'en';
  }
}
