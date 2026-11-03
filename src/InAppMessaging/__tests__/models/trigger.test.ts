import {
  triggerMatches,
  eventOccurrence,
  purchaseOccurrence,
  SESSION_START,
  PURCHASE_EVENT_NAME,
  type MessageTrigger,
} from '../../models/trigger';

describe('triggerMatches', () => {
  const session: MessageTrigger = { kind: 'session_start' };
  const addToCart: MessageTrigger = {
    kind: 'event',
    eventName: 'add_to_cart',
    filters: [],
  };
  const bigCart: MessageTrigger = {
    kind: 'event',
    eventName: 'add_to_cart',
    filters: [{ property: 'price', operator: 'greater_than', value: 100 }],
  };

  it('session start matches only a session start', () => {
    expect(triggerMatches(session, SESSION_START)).toBe(true);
    expect(triggerMatches(session, eventOccurrence('add_to_cart'))).toBe(false);
    expect(triggerMatches(addToCart, SESSION_START)).toBe(false);
  });
  it('an event matches on exact name', () => {
    expect(triggerMatches(addToCart, eventOccurrence('add_to_cart'))).toBe(
      true
    );
    expect(triggerMatches(addToCart, eventOccurrence('Add_To_Cart'))).toBe(
      false
    );
  });
  it('filters narrow the match', () => {
    expect(
      triggerMatches(bigCart, eventOccurrence('add_to_cart', { price: 120 }))
    ).toBe(true);
    expect(
      triggerMatches(bigCart, eventOccurrence('add_to_cart', { price: 80 }))
    ).toBe(false);
    expect(triggerMatches(bigCart, eventOccurrence('add_to_cart'))).toBe(false);
  });
  it('a purchase is an event named purchase with built-in properties', () => {
    const occ = purchaseOccurrence({
      productId: 'sku-1',
      price: 120,
      currency: 'USD',
    });
    expect(occ.kind).toBe('event');
    if (occ.kind !== 'event') throw new Error();
    expect(occ.eventName).toBe(PURCHASE_EVENT_NAME);
    expect(occ.properties).toEqual({
      productId: 'sku-1',
      price: 120,
      currency: 'USD',
      quantity: 1,
    });
  });
  it('caller properties override the purchase built-ins', () => {
    const occ = purchaseOccurrence({
      productId: 'sku-1',
      price: 1,
      currency: 'USD',
      properties: { price: 99 },
    });
    if (occ.kind !== 'event') throw new Error();
    expect(occ.properties.price).toBe(99);
  });
});
