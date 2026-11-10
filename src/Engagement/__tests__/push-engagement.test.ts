import { PushEngagementType, pushEngagementBody } from '../push-engagement';

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('push engagement', () => {
  it("uses the backend's numbers", () => {
    expect(PushEngagementType.Clicked).toBe(1);
    expect(PushEngagementType.Dismissed).toBe(2);
    expect(PushEngagementType.InfluencedOpen).toBe(3);
  });

  it('builds the body with exactly the backend field names', () => {
    const occurredAt = Date.UTC(2026, 10, 9, 18, 0, 0, 0);
    const body = pushEngagementBody(
      'tok-1',
      PushEngagementType.Clicked,
      occurredAt
    );

    expect(Object.keys(body).sort()).toEqual([
      'clickToken',
      'engagementType',
      'eventUid',
      'occurredAt',
    ]);
    expect(body.clickToken).toBe('tok-1');
    expect(body.engagementType).toBe(1);
    expect(body.eventUid).toMatch(UUID_V4);
    expect(body.occurredAt).toBe('2026-11-09T18:00:00.000Z');
  });

  it('sends engagementType as a JSON number', () => {
    const json = JSON.stringify(
      pushEngagementBody('tok-1', PushEngagementType.InfluencedOpen, 0)
    );

    expect(json).toContain('"engagementType":3');
  });

  it('writes occurredAt in UTC with milliseconds', () => {
    // 20:30:45.007 in Cairo (UTC+2) is 18:30:45.007 UTC
    const millis = Date.parse('2026-11-09T20:30:45.007+02:00');

    expect(
      pushEngagementBody('t', PushEngagementType.Clicked, millis).occurredAt
    ).toBe('2026-11-09T18:30:45.007Z');
  });

  it('gives every event a new eventUid', () => {
    const uids = new Set(
      Array.from(
        { length: 50 },
        () =>
          pushEngagementBody('tok-1', PushEngagementType.Clicked, 0).eventUid
      )
    );

    expect(uids.size).toBe(50);
  });

  it('builds a Dismissed body too, for when swipe-aways can be detected', () => {
    expect(
      pushEngagementBody('tok-1', PushEngagementType.Dismissed, 0)
        .engagementType
    ).toBe(2);
  });
});
