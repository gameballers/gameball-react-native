import { iamLog } from '../log';
import { hasExpiredAt, type Campaign } from '../models/campaign';
import { quietHoursContains, type QuietHours } from '../models/quiet-hours';
import { triggerMatches, type TriggerOccurrence } from '../models/trigger';
import type { CapState } from './frequency-cap';

export interface SelectInput {
  occurrence: TriggerOccurrence;
  campaigns: Campaign[];
  capState: CapState;
  nowMs: number;
  cooldownMs: number;
  quietHours: QuietHours | null;
}

/**
 * Chooses which campaign, if any, displays for an occurrence. Pure apart from logging.
 * Order: trigger match → not expired → repeat-eligible → renderable → quiet hours → cooldown →
 * highest priority, ties broken by response order (the marketer's ordering, applied by the backend).
 */
export function selectCampaign(input: SelectInput): Campaign | null {
  const { occurrence, campaigns, capState, nowMs, cooldownMs, quietHours } =
    input;
  const eligible: Campaign[] = [];
  for (const candidate of campaigns) {
    if (!triggerMatches(candidate.trigger, occurrence)) continue;
    if (hasExpiredAt(candidate, nowMs)) continue;
    if (!isRepeatEligible(candidate, capState, nowMs)) continue;
    if (candidate.message.type === 'unsupported') continue;
    eligible.push(candidate);
  }
  if (eligible.length === 0) return null;

  if (quietHours && quietHoursContains(quietHours, new Date(nowMs))) {
    iamLog(
      `${eligible.length} campaign(s) matched but it is inside the quiet-hours window (device local time); suppressed`
    );
    return null;
  }
  if (isWithinFloor(capState, nowMs, cooldownMs)) {
    iamLog(
      `${eligible.length} campaign(s) matched but the ${Math.round(
        cooldownMs / 1000
      )}s cooldown has not elapsed since the last message; suppressed`
    );
    return null;
  }

  // Stable sort by priority desc; JS sort is stable, so equal priorities keep response order.
  const ranked = eligible
    .map((c, index) => ({ c, index }))
    .sort((a, b) => b.c.priority - a.c.priority || a.index - b.index);
  return ranked[0]!.c;
}

/** Not repeatable = once ever. Repeatable = after its own minInterval since its last display. */
export function isRepeatEligible(
  campaign: Campaign,
  capState: CapState,
  nowMs: number
): boolean {
  const lastShown = capState.lastDisplayByCampaign.get(campaign.campaignId);
  if (lastShown === undefined) return true;
  if (!campaign.repeatable) return false;
  if (campaign.minIntervalMs === null) return true;
  return nowMs - lastShown >= campaign.minIntervalMs;
}

export function isWithinFloor(
  capState: CapState,
  nowMs: number,
  cooldownMs: number
): boolean {
  if (capState.lastDisplayAt === null) return false;
  return nowMs - capState.lastDisplayAt < cooldownMs;
}
