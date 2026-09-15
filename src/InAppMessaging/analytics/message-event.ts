/* eslint-disable no-bitwise -- A version-4 UUID is defined by setting bits 6 and 8 of the byte array. */
/** The backend's vocabulary: a button tap is a `click` carrying `buttonId`. */
export type MessageEventType = 'impression' | 'click' | 'dismiss';

/** One analytics event, already shaped as the JSON the backend receives. */
export interface MessageEvent {
  /** Generated once, never regenerated on retry — the backend deduplicates on it. */
  eventUid: string;
  type: MessageEventType;
  campaignId: number;
  /** ISO-8601 UTC, when it happened on the device (not when it was sent). */
  occurredAt: string;
  variationId?: number;
  dispatchId?: string;
  buttonId?: string;
  url?: string;
}

export function createMessageEvent(input: {
  type: MessageEventType;
  campaignId: number;
  occurredAtMs: number;
  variationId?: number | null;
  dispatchId?: string | null;
  buttonId?: string;
  url?: string;
}): MessageEvent {
  const event: MessageEvent = {
    eventUid: uuidV4(),
    type: input.type,
    campaignId: input.campaignId,
    occurredAt: new Date(input.occurredAtMs).toISOString(),
  };
  if (input.variationId !== null && input.variationId !== undefined)
    event.variationId = input.variationId;
  if (input.dispatchId) event.dispatchId = input.dispatchId;
  if (input.buttonId) event.buttonId = input.buttonId;
  if (input.url) event.url = input.url;
  return event;
}

/** What a runtime may offer for randomness. React Native has neither unless the host polyfills them. */
type CryptoLike = {
  randomUUID?: () => string;
  getRandomValues?: (a: Uint8Array) => Uint8Array;
};

/** Version-4 UUID via `crypto.randomUUID` when present, otherwise `getRandomValues`, otherwise Math.random. */
export function uuidV4(): string {
  const c = (globalThis as { crypto?: CryptoLike }).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(
    ''
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(
    12,
    16
  )}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
