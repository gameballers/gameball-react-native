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

export function hasExpiredAt(campaign: Campaign, nowMs: number): boolean {
  return campaign.expiresAt !== null && nowMs >= campaign.expiresAt;
}

export function campaignLabel(campaign: Campaign): string {
  return campaign.name === null
    ? `${campaign.campaignId}`
    : `${campaign.campaignId} (${campaign.name})`;
}
