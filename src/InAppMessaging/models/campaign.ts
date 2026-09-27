import { gameKey, messageKey, type CampaignKey } from './campaign-key';
import type { InAppMessage } from './message';
import type { MessageTrigger } from './trigger';

/** A message plus the conditions under which it displays. Internal. */
export interface Campaign {
  campaignId: number;
  variationId: number | null;
  /** Opaque, echoed verbatim on telemetry. */
  dispatchId: string | null;
  name: string | null;
  trigger: MessageTrigger;
  /** Higher wins. */
  priority: number;
  message: InAppMessage;
  /** Epoch ms; null = no expiry. */
  expiresAt: number | null;
  /** Dashboard test send: displays normally, reports no telemetry. */
  isTest: boolean;
  repeatable: boolean;
  /** When repeatable, minimum gap since this campaign's own last display. */
  minIntervalMs: number | null;
}

/**
 * How this campaign is identified in display history.
 *
 * A game entry's `campaignId` is always 0, so its identity is the id of the game it opens.
 * Reading this rather than `campaignId` is what keeps the two kinds from sharing cap state —
 * challenge ids and message campaign ids are separate sequences that overlap numerically.
 */
export function campaignKeyOf(campaign: Campaign): CampaignKey {
  const widget = campaign.message.widget;
  return widget === null ? messageKey(campaign.campaignId) : gameKey(widget.gameCampaignId);
}

export function hasExpiredAt(campaign: Campaign, nowMs: number): boolean {
  return campaign.expiresAt !== null && nowMs >= campaign.expiresAt;
}

export function campaignLabel(campaign: Campaign): string {
  return campaign.name === null
    ? `${campaign.campaignId}`
    : `${campaign.campaignId} (${campaign.name})`;
}
