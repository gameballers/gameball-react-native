import { uuidV4 } from '../InAppMessaging/analytics/message-event';

/**
 * What the customer did with a Gameball push, as the backend's push-engagement endpoint counts
 * it. The numbers are the backend's own (PushEngagementType in g-backend-v2): never renumber.
 */
export enum PushEngagementType {
  /** Tapped the notification or one of its action buttons. */
  Clicked = 1,
  /** Swiped it away, or tapped a "Later" / "No thanks" button. This SDK doesn't detect it yet. */
  Dismissed = 2,
  /** Didn't tap, but opened the app on their own soon after receiving it. */
  InfluencedOpen = 3,
}

/** The JSON body of one push-engagement report. */
export interface PushEngagementBody {
  clickToken: string;
  engagementType: PushEngagementType;
  /** New for each event; the backend never counts the same eventUid twice. */
  eventUid: string;
  /** ISO-8601 UTC with milliseconds: when it happened on the device, not when it was sent. */
  occurredAt: string;
}

export function pushEngagementBody(
  clickToken: string,
  engagementType: PushEngagementType,
  occurredAtMillis: number,
  newEventUid: () => string = uuidV4
): PushEngagementBody {
  return {
    clickToken,
    engagementType,
    eventUid: newEventUid(),
    occurredAt: new Date(occurredAtMillis).toISOString(),
  };
}
