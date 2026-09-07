import { allFiltersMatch, type PropertyFilter } from './property-filter';

/** Reserved event name a purchase is reported under. */
export const PURCHASE_EVENT_NAME = 'purchase';

export type MessageTrigger =
  | { kind: 'session_start' }
  | { kind: 'event'; eventName: string; filters: PropertyFilter[] };

export type TriggerOccurrence =
  | { kind: 'session_start' }
  | { kind: 'event'; eventName: string; properties: Record<string, unknown> };

export const SESSION_START: TriggerOccurrence = { kind: 'session_start' };

export function eventOccurrence(
  eventName: string,
  properties: Record<string, unknown> = {}
): TriggerOccurrence {
  return { kind: 'event', eventName, properties };
}

export function purchaseOccurrence(input: {
  productId: string;
  price: number;
  currency: string;
  quantity?: number;
  properties?: Record<string, unknown>;
}): TriggerOccurrence {
  // Built-ins first so a caller's property of the same name wins.
  return eventOccurrence(PURCHASE_EVENT_NAME, {
    productId: input.productId,
    price: input.price,
    currency: input.currency,
    quantity: input.quantity ?? 1,
    ...(input.properties ?? {}),
  });
}

export function triggerMatches(
  declared: MessageTrigger,
  occurred: TriggerOccurrence
): boolean {
  if (declared.kind === 'session_start')
    return occurred.kind === 'session_start';
  if (occurred.kind !== 'event') return false;
  return (
    declared.eventName === occurred.eventName &&
    allFiltersMatch(declared.filters, occurred.properties)
  );
}
