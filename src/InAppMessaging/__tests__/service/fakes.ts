import type { MessageAnalytics } from '../../analytics/analytics';
import type { MessageEvent } from '../../analytics/message-event';
import type { CampaignCache } from '../../source/campaign-cache';
import type { MessageSource } from '../../source/message-source';
import { emptySyncResult, type SyncResult } from '../../source/sync-result';
import type {
  ArtworkPrefetcher,
  MessagePresenter,
  PresentCallbacks,
} from '../../presentation/presenter';
import type { InAppMessage } from '../../models/message';
import type { VariableSource } from '../../personalisation/variable-source';
import { parseSyncResponse } from '../../source/parser';

export class FakeSource implements MessageSource {
  fetches = 0;
  constructor(
    public result: SyncResult | (() => SyncResult) | Error = emptySyncResult()
  ) {}
  async fetch(_customerId: string): Promise<SyncResult> {
    this.fetches++;
    if (this.result instanceof Error) throw this.result;
    return typeof this.result === 'function' ? this.result() : this.result;
  }
}

export class FakePresenter implements MessagePresenter {
  presented: { message: InAppMessage; callbacks: PresentCallbacks }[] = [];
  current: { message: InAppMessage; callbacks: PresentCallbacks } | null = null;
  refuse = false;
  attempts = 0;
  get isShowing() {
    return this.current !== null;
  }
  present(message: InAppMessage, callbacks: PresentCallbacks): boolean {
    this.attempts++;
    if (this.refuse || this.current) return false;
    this.current = { message, callbacks };
    this.presented.push(this.current);
    return true;
  }
  /** Simulates the first paint. */
  paint(): void {
    this.current?.callbacks.onShown();
  }
  tapButton(index = 0): void {
    const c = this.current!;
    c.callbacks.onButtonPressed(c.message.buttons[index]!);
  }
  tapMessage(): void {
    this.current!.callbacks.onMessagePressed();
  }
  dismiss(): void {
    const c = this.current;
    if (!c) return;
    this.current = null;
    c.callbacks.onDismissed();
  }
  get shownIds(): string[] {
    return this.presented.map((p) => p.message.id);
  }
}

export class RecordingAnalytics implements MessageAnalytics {
  events: MessageEvent[] = [];
  customers: string[] = [];
  flushes = 0;
  flushAlls = 0;
  disposed = 0;
  loads = 0;
  load(): void {
    this.loads++;
  }
  log(event: MessageEvent, customerId: string): void {
    this.events.push(event);
    this.customers.push(customerId);
  }
  async flush(): Promise<void> {
    this.flushes++;
  }
  async flushAll(): Promise<void> {
    this.flushAlls++;
  }
  dispose(): void {
    this.disposed++;
  }
  types(): string[] {
    return this.events.map((e) => e.type);
  }
}

export class FakeCache implements CampaignCache {
  raw: { customerId: string; rawJson: string } | null = null;
  writes = 0;
  read(customerId: string): SyncResult {
    if (!this.raw || this.raw.customerId !== customerId)
      return emptySyncResult();
    return { ...parseSyncResponse(this.raw.rawJson), rawJson: null };
  }
  write(customerId: string, rawJson: string): void {
    this.writes++;
    this.raw = { customerId, rawJson };
  }
  clear(): void {
    this.raw = null;
  }
}

export class FakePrefetcher implements ArtworkPrefetcher {
  failing = new Set<string>();
  calls: string[] = [];
  async prefetch(message: InAppMessage): Promise<boolean> {
    this.calls.push(message.id);
    const urls = [message.imageUrl, message.iconUrl].filter(
      (u): u is string => !!u
    );
    return urls.every((u) => !this.failing.has(u));
  }
}

export class FakeVariables implements VariableSource {
  values: Record<string, string> = {};
  fetches = 0;
  cleared = 0;
  retained = new Set<string>();
  delayMs = 0;
  async fetch(_customerId: string): Promise<Record<string, string>> {
    this.fetches++;
    if (this.delayMs) await new Promise((r) => setTimeout(r, this.delayMs));
    return this.values;
  }
  clear(): void {
    this.cleared++;
  }
  retainOnly(names: Set<string>): void {
    this.retained = names;
  }
}
