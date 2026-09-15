import { iamLog } from '../log';
import { parseSyncResponse } from './parser';
import type { SyncResult } from './sync-result';

/** Where campaigns come from. Implementations may throw; the caller treats a failure as "keep the cache", never as "no campaigns". */
export interface MessageSource {
  fetch(customerId: string): Promise<SyncResult>;
}

/** Signals that a sync could not be performed, as opposed to returning nothing. */
export class SyncFailure extends Error {
  constructor() {
    super('the sync request did not return a usable response');
    this.name = 'SyncFailure';
  }
}

/** Fetches campaigns through a sender that returns the raw response body (or null on failure) and hands it to the parser. */
export class HttpMessageSource implements MessageSource {
  constructor(
    private readonly send: (customerId: string) => Promise<string | null>
  ) {}

  async fetch(customerId: string): Promise<SyncResult> {
    const body = await this.send(customerId);
    if (body === null) {
      iamLog('sync: no usable response');
      throw new SyncFailure();
    }
    return parseSyncResponse(body);
  }
}
