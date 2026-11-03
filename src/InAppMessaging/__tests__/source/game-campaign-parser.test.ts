import { parseSyncResponse } from '../../source/parser';

const WHEEL = `{
  "campaignType": 2, "campaignId": 0, "variationId": 0, "dispatchId": null,
  "name": "Spin the Wheel", "priority": 0, "messageType": 2,
  "trigger": { "type": "session_start", "repeatable": true },
  "content": null, "locale": null, "localeCode": null,
  "expiresAt": null, "isTest": false,
  "gameCampaignId": 9645, "gameCampaignType": "wheel"
}`;

const sync = (entries: string) =>
  `{"cooldownSeconds":30,"messages":[${entries}]}`;

const campaigns = (entry: string) => parseSyncResponse(sync(entry)).campaigns;

describe('game campaigns', () => {
  it('parses an entry that carries no content of its own', () => {
    const parsed = campaigns(WHEEL);

    expect(parsed).toHaveLength(1);
    expect(parsed[0]!.message.widget).toEqual({
      gameCampaignId: 9645,
      gameCampaignType: 'wheel',
    });
  });

  it('skips an unrecognised campaignType rather than coercing it', () => {
    // A future kind must degrade to silence: it will never need to be displayed by an older
    // client, and guessing would draw something wrong.
    expect(campaigns(WHEEL.replace('"campaignType": 2', '"campaignType": 7'))).toHaveLength(0);
  });

  it('skips an unrecognised game type', () => {
    expect(
      campaigns(WHEEL.replace('"gameCampaignType": "wheel"', '"gameCampaignType": "roulette"'))
    ).toHaveLength(0);
  });

  it('skips a game entry with no gameCampaignId', () => {
    // campaignId is always 0 on a game, so without this there is nothing to open.
    expect(campaigns(WHEEL.replace('"gameCampaignId": 9645,', ''))).toHaveLength(0);
  });

  it('still drops a message that has nothing to render', () => {
    // The exemption is keyed off the kind, not off which fields are absent, so a malformed
    // message keeps failing for the right reason.
    const asMessage = WHEEL.replace('"campaignType": 2', '"campaignType": 1').replace(
      '"campaignId": 0',
      '"campaignId": 2215'
    );
    expect(campaigns(asMessage)).toHaveLength(0);
  });

  it('skips a screen-triggered game until screens are supported', () => {
    const screen = WHEEL.replace(
      '"trigger": { "type": "session_start", "repeatable": true }',
      '"trigger": { "type": "screen", "name": "cart", "repeatable": true }'
    );
    expect(campaigns(screen)).toHaveLength(0);
  });

  it('keeps a fullscreen game', () => {
    // Fullscreen works once it is measured in a real fullscreen box rather than a short wide one.
    const parsed = campaigns(WHEEL.replace('"messageType": 2', '"messageType": 3'));

    expect(parsed).toHaveLength(1);
    expect(parsed[0]!.message.type).toBe('fullscreen');
  });

  it('reads an entry with no campaignType as a message', () => {
    // Older payloads, and anything sent before the field is universal. Defaulting to the kind
    // that has always existed is safe; defaulting to a game would try to open nothing.
    const legacy = `{
      "campaignId": 2215, "messageType": 2,
      "trigger": { "type": "session_start", "repeatable": false },
      "content": {}, "locale": { "header": "Hello" }, "localeCode": "en"
    }`;
    const parsed = campaigns(legacy);

    expect(parsed).toHaveLength(1);
    expect(parsed[0]!.message.widget).toBeNull();
  });

  it('opens on its trigger, with no delay and no dismissal limit, whatever the entry carries', () => {
    // Both were product decisions: a game opens when its trigger fires, and follows the message
    // frequency rules rather than a give-up counter of its own.
    const withExtras = WHEEL.replace(
      '"isTest": false,',
      '"isTest": false, "delay": 30, "dismissLimit": 3,'
    );
    expect(campaigns(withExtras)[0]!.message.widget).toEqual({
      gameCampaignId: 9645,
      gameCampaignType: 'wheel',
    });
  });

  describe('frequency, read exactly as for a message', () => {
    const withTrigger = (trigger: string) =>
      campaigns(
        WHEEL.replace(
          '"trigger": { "type": "session_start", "repeatable": true }',
          `"trigger": ${trigger}`
        )
      )[0]!;

    it('is once ever when it is not repeatable', () => {
      const game = withTrigger(
        '{ "type": "session_start", "repeatable": false, "minIntervalSeconds": null }'
      );
      expect(game.repeatable).toBe(false);
      expect(game.minIntervalMs).toBeNull();
    });

    it('waits out its own minimum interval when it has one', () => {
      const game = withTrigger(
        '{ "type": "session_start", "repeatable": true, "minIntervalSeconds": 600 }'
      );
      expect(game.repeatable).toBe(true);
      expect(game.minIntervalMs).toBe(600_000);
    });

    it('gets no interval of its own when the sync sends none, as games do today', () => {
      // No game-specific default: the account cooldown is the only gap left to apply.
      const game = withTrigger(
        '{ "type": "session_start", "repeatable": true, "minIntervalSeconds": null }'
      );
      expect(game.repeatable).toBe(true);
      expect(game.minIntervalMs).toBeNull();
    });
  });
});
