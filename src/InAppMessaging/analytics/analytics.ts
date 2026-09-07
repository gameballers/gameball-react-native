import { iamLog } from '../log';
import type { KeyValueStore } from '../storage/key-value-store';
import type { MessageEvent } from './message-event';

export const DEFAULT_ANALYTICS_FLUSH_INTERVAL_MS = 30_000;
export const DEFAULT_ANALYTICS_BATCH_SIZE = 10;
export const MAX_EVENTS_PER_REQUEST = 50;
export const MAX_BUFFERED_ANALYTICS_EVENTS = 500;

/** accepted = drop the batch; retry = keep it; discard = poison, drop so later events are not blocked. */
export type SendResult = 'accepted' | 'retry' | 'discard';
/** Ships one batch that belongs to one customer. */
export type AnalyticsSender = (
  customerId: string,
  events: MessageEvent[]
) => Promise<SendResult>;

export interface MessageAnalytics {
  /** Restores anything left unsent by a previous page load, merged with memory by eventUid. Re-enables scheduling after dispose(). */
  load(): void;
  /** Records an event for the customer who saw the message. Never throws, never blocks. */
  log(event: MessageEvent, customerId: string): void;
  /** Sends one batch now (the oldest customer's events first). */
  flush(): Promise<void>;
  /** Keeps sending until the outbox is empty or a batch has to be retried. The pagehide / pause hook. */
  flushAll(): Promise<void>;
  /** Cancels timers and stops future sends and storage writes, leaving buffered events in memory for the next load(). */
  dispose(): void;
}

/**
 * An outbox entry pins the event to the customer it belongs to at the moment it is logged, so a
 * customer switch or a restored outbox on a later page load can never re-attribute it.
 */
interface OutboxEntry {
  customerId: string;
  event: MessageEvent;
}

const KEY = 'gameball_iam_analytics_outbox';

function isEntry(value: unknown): value is OutboxEntry {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as { customerId?: unknown; event?: unknown };
  return (
    typeof v.customerId === 'string' &&
    typeof v.event === 'object' &&
    v.event !== null &&
    typeof (v.event as { eventUid?: unknown }).eventUid === 'string'
  );
}

export class BatchedMessageAnalytics implements MessageAnalytics {
  private readonly send: AnalyticsSender;
  private readonly store: KeyValueStore;
  private readonly flushIntervalMs: number;
  private readonly batchSize: number;
  private readonly maxBuffered: number;
  private readonly maxPerRequest: number;

  private outbox: OutboxEntry[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly inFlight = new Set<string>();
  private active = true;

  constructor(options: {
    send: AnalyticsSender;
    store: KeyValueStore;
    flushIntervalMs?: number;
    batchSize?: number;
    maxBuffered?: number;
    maxPerRequest?: number;
  }) {
    this.send = options.send;
    this.store = options.store;
    this.flushIntervalMs =
      options.flushIntervalMs ?? DEFAULT_ANALYTICS_FLUSH_INTERVAL_MS;
    this.batchSize = options.batchSize ?? DEFAULT_ANALYTICS_BATCH_SIZE;
    this.maxBuffered = options.maxBuffered ?? MAX_BUFFERED_ANALYTICS_EVENTS;
    this.maxPerRequest = options.maxPerRequest ?? MAX_EVENTS_PER_REQUEST;
  }

  get bufferedCount(): number {
    return this.outbox.length;
  }
  get hasScheduledFlush(): boolean {
    return this.timer !== null;
  }

  load(): void {
    this.active = true;
    try {
      const raw = this.store.get(KEY);
      if (!raw) return;
      const decoded: unknown = JSON.parse(raw);
      if (!Array.isArray(decoded)) {
        iamLog('analytics: stored outbox is not a list; discarding it');
        this.store.remove(KEY);
        return;
      }
      // Rebuild rather than append: storage is persisted after every mutation, so it is normally
      // the superset of whatever is still in memory. Merging by eventUid means a dispose()
      // followed by load() restores the same buffer instead of duplicating it. Entries written by
      // a build that did not pin the customer are dropped: attributing them now would be a guess.
      const restored: OutboxEntry[] = [];
      let legacy = 0;
      for (const entry of decoded) {
        if (isEntry(entry)) restored.push(entry);
        else legacy++;
      }
      if (legacy > 0)
        iamLog(
          `analytics: dropped ${legacy} stored event(s) with no customer attribution`
        );
      const known = new Set(restored.map((e) => e.event.eventUid));
      for (const entry of this.outbox)
        if (!known.has(entry.event.eventUid)) restored.push(entry);
      this.outbox = restored;
      if (legacy > 0) this.persist();
      if (this.outbox.length > 0) {
        iamLog(`analytics: restored ${this.outbox.length} unsent event(s)`);
        this.arm();
      }
    } catch (error) {
      iamLog(`analytics: could not restore the outbox (${String(error)})`);
    }
  }

  log(event: MessageEvent, customerId: string): void {
    this.outbox.push({ customerId, event });
    iamLog(
      `${event.type}: campaign=${event.campaignId}${
        event.buttonId ? ` button=${event.buttonId}` : ''
      }`
    );
    if (this.outbox.length > this.maxBuffered) {
      const excess = this.outbox.length - this.maxBuffered;
      this.outbox.splice(0, excess);
      iamLog(
        `analytics: outbox at capacity; dropped ${excess} oldest event(s)`
      );
    }
    this.persist();
    if (this.outbox.length >= this.batchSize) void this.flush();
    else this.arm();
  }

  /** One request: the oldest entry's customer, up to maxPerRequest of that customer's events. */
  async flush(): Promise<void> {
    await this.sendNextBatch(false);
  }

  /** Drains every customer's events, stopping only when a batch has to be retried or the instance is disposed. */
  /**
   * Drains the whole outbox. Every customer's first batch goes out at once: on a pagehide the
   * requests are keepalive and only those issued before the page unloads survive, so waiting for
   * one customer's response before starting the next would lose the others' events.
   */
  async flushAll(): Promise<void> {
    if (!this.active) return;
    const customers = [...new Set(this.outbox.map((e) => e.customerId))].filter(
      (c) => !this.inFlight.has(c)
    );
    await Promise.all(customers.map((c) => this.sendBatchFor(c, true)));
  }

  private async sendNextBatch(drainAll: boolean): Promise<void> {
    // A disposed instance starts no new requests: not the batch-size trigger from a
    // post-dispose log(), and not the drained-backlog recursion below.
    if (!this.active) return;
    const next = this.outbox.find((e) => !this.inFlight.has(e.customerId));
    if (next) await this.sendBatchFor(next.customerId, drainAll);
  }

  /** One request for one customer; a customer never has two requests in flight (the backend dedupes by eventUid, but order matters for the cap). */
  private async sendBatchFor(
    customerId: string,
    drainAll: boolean
  ): Promise<void> {
    if (!this.active || this.inFlight.has(customerId)) return;
    const batch = this.outbox
      .filter((e) => e.customerId === customerId)
      .slice(0, this.maxPerRequest);
    if (batch.length === 0) return;
    this.inFlight.add(customerId);
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    let drained = false;
    try {
      const result = await this.send(
        customerId,
        batch.map((e) => e.event)
      );
      if (result === 'accepted') {
        drained = true;
        this.removeSent(batch);
        this.dropFromStorage(batch);
        iamLog(`analytics: sent ${batch.length} event(s) for "${customerId}"`);
      } else if (result === 'discard') {
        drained = true;
        this.removeSent(batch);
        this.dropFromStorage(batch);
        iamLog(
          `analytics: backend refused ${batch.length} event(s) and a retry cannot help; dropped so later events are not blocked`
        );
      } else {
        iamLog(
          `analytics: send failed; ${this.outbox.length} event(s) still queued`
        );
      }
    } catch (error) {
      iamLog(
        `analytics: send failed (${String(error)}); ${
          this.outbox.length
        } event(s) still queued`
      );
    } finally {
      this.inFlight.delete(customerId);
      if (this.outbox.length > 0) {
        // A backlog is chunked, so keep going rather than waiting a full interval per batch;
        // flushAll() additionally awaits the chain so a pagehide flush can hold the page.
        if (drained && drainAll) await this.sendNextBatch(true);
        else if (drained) void this.sendNextBatch(false);
        else this.arm();
      }
    }
  }

  dispose(): void {
    this.active = false;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private arm(): void {
    if (!this.active || this.timer !== null) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, this.flushIntervalMs);
  }

  /**
   * Removes exactly the entries that were sent, by eventUid rather than by position — log()
   * may have spliced from the front (the maxBuffered ceiling) while a batch snapshot taken
   * earlier was in flight, so the front of the current outbox no longer lines up with it.
   */
  private removeSent(batch: OutboxEntry[]): void {
    const sent = new Set(batch.map((e) => e.event.eventUid));
    this.outbox = this.outbox.filter((e) => !sent.has(e.event.eventUid));
  }

  /**
   * Drops a settled batch from storage whether or not this instance is still active. stop() flushes
   * and disposes in the same breath, so the accepted batch usually lands after dispose(): gating
   * this on `active` would leave those events in storage for the next start() to restore and resend.
   * Only the batch is removed — a post-dispose log() must still not write.
   */
  private dropFromStorage(batch: OutboxEntry[]): void {
    if (this.active) {
      this.persist();
      return;
    }
    try {
      const raw = this.store.get(KEY);
      if (!raw) return;
      const decoded: unknown = JSON.parse(raw);
      if (!Array.isArray(decoded)) return;
      const sent = new Set(batch.map((e) => e.event.eventUid));
      const remaining = decoded.filter(
        (e) => !(isEntry(e) && sent.has(e.event.eventUid))
      );
      if (remaining.length === decoded.length) return;
      if (remaining.length === 0) this.store.remove(KEY);
      else this.store.set(KEY, JSON.stringify(remaining));
    } catch (error) {
      iamLog(
        `analytics: could not drop the sent batch from the outbox (${String(
          error
        )})`
      );
    }
  }

  private persist(): void {
    // A disposed instance never writes the whole outbox again: an in-flight send that finishes
    // after dispose() still updates memory (removeSent above) and shrinks storage through
    // dropFromStorage, but events logged after dispose() live in memory only, and reach storage
    // through the in-memory merge in load(). The backend deduplicates on eventUid, so a restored
    // batch is at-least-once delivery, never data loss.
    if (!this.active) return;
    try {
      if (this.outbox.length === 0) this.store.remove(KEY);
      else this.store.set(KEY, JSON.stringify(this.outbox));
    } catch (error) {
      iamLog(`analytics: could not persist the outbox (${String(error)})`);
    }
  }
}

/** Writes analytics to the log and nowhere else. Tests and no-network hosts. */
export class LoggingMessageAnalytics implements MessageAnalytics {
  load(): void {}
  log(event: MessageEvent, customerId: string): void {
    iamLog(
      `${event.type}: campaign=${event.campaignId}${
        event.buttonId ? ` button=${event.buttonId}` : ''
      } customer=${customerId}`
    );
  }
  async flush(): Promise<void> {}
  async flushAll(): Promise<void> {}
  dispose(): void {}
}
