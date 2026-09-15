import { HttpMessageSource, SyncFailure } from '../../source/message-source';

describe('HttpMessageSource', () => {
  it('parses the body the sender returns', async () => {
    const source = new HttpMessageSource(async () =>
      JSON.stringify({ cooldownSeconds: 30, messages: [] })
    );
    const result = await source.fetch('c1');
    expect(result.campaigns).toEqual([]);
    expect(result.cooldownMs).toBe(30_000);
  });

  it('rejects with SyncFailure when the sender has no usable response', async () => {
    const source = new HttpMessageSource(async () => null);
    await expect(source.fetch('c1')).rejects.toBeInstanceOf(SyncFailure);
  });
});
