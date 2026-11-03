import { setLogEnabled } from '../../log';
import { inAppWidgetUrl } from '../../presentation/widget-url';

describe('the url a game opens at', () => {
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  beforeEach(() => {
    setLogEnabled(true);
    log.mockClear();
  });
  afterAll(() => {
    log.mockRestore();
  });

  const wheel = { gameCampaignId: 9645, gameCampaignType: 'wheel' };
  /** Characters that encodeURIComponent rewrites, so the encoded form has to be hidden too. */
  const context = {
    apiKey: 'live-key+/=',
    customerId: 'c1',
    lang: 'en',
    sessionToken: 'session token&1',
  };

  const logged = () => log.mock.calls.map((call) => String(call[0])).join('\n');

  it('carries the api key and the session token to the widget', () => {
    const url = inAppWidgetUrl(wheel, context) ?? '';

    expect(url).toContain(`apiKey=${encodeURIComponent(context.apiKey)}`);
    expect(url).toContain(
      `sessionToken=${encodeURIComponent(context.sessionToken)}`
    );
  });

  it('never writes the api key or the session token to the log', () => {
    inAppWidgetUrl(wheel, context);

    const lines = logged();
    for (const secret of [context.apiKey, context.sessionToken]) {
      expect(lines).not.toContain(secret);
      expect(lines).not.toContain(encodeURIComponent(secret));
    }
  });

  it('still logs everything else, which is what makes a game that will not open diagnosable', () => {
    inAppWidgetUrl(wheel, context);

    const lines = logged();
    expect(lines).toContain('https://m.gameball.app?');
    expect(lines).toContain('customerId=c1');
    expect(lines).toContain('openDetail=details_wheel_9645');
    // Present but hidden, so a missing token can still be told from a redacted one.
    expect(lines).toContain('apiKey=<redacted>');
    expect(lines).toContain('sessionToken=<redacted>');
  });
});
