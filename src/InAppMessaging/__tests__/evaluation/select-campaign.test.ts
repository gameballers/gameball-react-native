import {
  selectCampaign,
  isRepeatEligible,
  isWithinFloor,
} from '../../evaluation/select-campaign';
import type { Campaign } from '../../models/campaign';
import type { CapState } from '../../evaluation/frequency-cap';
import { SESSION_START, eventOccurrence } from '../../models/trigger';
import { campaign, message, T0 } from '../helpers/fixtures';

const cap = (
  entries: [number, number][] = [],
  lastDisplayAt: number | null = null
): CapState => ({
  lastDisplayByCampaign: new Map(entries),
  lastDisplayAt:
    lastDisplayAt ??
    (entries.length ? Math.max(...entries.map((e) => e[1])) : null),
});
const select = (
  campaigns: Campaign[],
  over: Partial<Parameters<typeof selectCampaign>[0]> = {}
) =>
  selectCampaign({
    occurrence: SESSION_START,
    campaigns,
    capState: cap(),
    nowMs: T0,
    cooldownMs: 30_000,
    quietHours: null,
    ...over,
  });

describe('selectCampaign', () => {
  it('returns null when nothing matches the trigger', () => {
    expect(
      select([
        campaign(1, {
          trigger: { kind: 'event', eventName: 'x', filters: [] },
        }),
      ])
    ).toBeNull();
  });
  it('picks the highest priority, ties broken by response order', () => {
    expect(
      select([
        campaign(1, { priority: 1 }),
        campaign(2, { priority: 5 }),
        campaign(3, { priority: 5 }),
      ])?.campaignId
    ).toBe(2);
    expect(select([campaign(1), campaign(2), campaign(3)])?.campaignId).toBe(1);
  });
  it('skips expired, unsupported and already-shown non-repeatable campaigns', () => {
    expect(select([campaign(1, { expiresAt: T0 })])).toBeNull();
    expect(select([campaign(1, { expiresAt: T0 + 1 })])?.campaignId).toBe(1);
    expect(
      select([
        campaign(1, { message: message({ type: 'unsupported' }) }),
        campaign(2),
      ])?.campaignId
    ).toBe(2);
    expect(
      select([campaign(1)], { capState: cap([[1, T0 - 86_400_000]]) })
    ).toBeNull();
  });
  it('a repeatable campaign waits out its own interval', () => {
    const c = campaign(1, { repeatable: true, minIntervalMs: 60_000 });
    expect(
      select([c], { capState: cap([[1, T0 - 30_000]], T0 - 120_000) })
    ).toBeNull();
    expect(
      select([c], { capState: cap([[1, T0 - 60_000]], T0 - 120_000) })
        ?.campaignId
    ).toBe(1);
    expect(
      select([campaign(2, { repeatable: true })], {
        capState: cap([[2, T0 - 1]], T0 - 120_000),
      })?.campaignId
    ).toBe(2);
  });
  it('suppresses inside the cooldown floor and inside quiet hours', () => {
    expect(
      select([campaign(1)], { capState: cap([[9, T0 - 10_000]]) })
    ).toBeNull();
    expect(
      select([campaign(1)], { capState: cap([[9, T0 - 30_000]]) })?.campaignId
    ).toBe(1);
    const now = new Date(T0);
    const minute = now.getHours() * 60 + now.getMinutes();
    expect(
      select([campaign(1)], {
        quietHours: { startMinute: minute, endMinute: (minute + 1) % 1440 },
      })
    ).toBeNull();
  });
  it('matches events with filters', () => {
    const c = campaign(1, {
      trigger: {
        kind: 'event',
        eventName: 'add_to_cart',
        filters: [{ property: 'price', operator: 'greater_than', value: 100 }],
      },
    });
    expect(
      select([c], {
        occurrence: eventOccurrence('add_to_cart', { price: 150 }),
      })?.campaignId
    ).toBe(1);
    expect(
      select([c], { occurrence: eventOccurrence('add_to_cart', { price: 50 }) })
    ).toBeNull();
  });
});

describe('isRepeatEligible / isWithinFloor', () => {
  it('never shown is eligible; shown non-repeatable is not', () => {
    expect(isRepeatEligible(campaign(1), cap(), T0)).toBe(true);
    expect(isRepeatEligible(campaign(1), cap([[1, T0 - 5]]), T0)).toBe(false);
  });
  it('floor is strict', () => {
    expect(isWithinFloor(cap([[1, T0 - 29_999]]), T0, 30_000)).toBe(true);
    expect(isWithinFloor(cap([[1, T0 - 30_000]]), T0, 30_000)).toBe(false);
    expect(isWithinFloor(cap(), T0, 30_000)).toBe(false);
  });
});
