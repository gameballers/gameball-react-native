import { ImageArtworkPrefetcher } from '../../presentation/artwork-prefetcher';
import { message } from '../helpers/fixtures';

describe('ImageArtworkPrefetcher', () => {
  it('a message without artwork is ready; both urls are loaded concurrently and must all succeed', async () => {
    const load = jest.fn(async (url: string) => !url.includes('bad'));
    const p = new ImageArtworkPrefetcher({ load });
    expect(await p.prefetch(message())).toBe(true);
    expect(load).not.toHaveBeenCalled();
    expect(
      await p.prefetch(
        message({ imageUrl: 'https://cdn/a.png', iconUrl: 'https://cdn/i.png' })
      )
    ).toBe(true);
    expect(load).toHaveBeenCalledTimes(2);
    expect(
      await p.prefetch(
        message({
          imageUrl: 'https://cdn/bad.png',
          iconUrl: 'https://cdn/i.png',
        })
      )
    ).toBe(false);
  });
  it('refuses cleartext http without asking the loader', async () => {
    const load = jest.fn(async () => true);
    const p = new ImageArtworkPrefetcher({ load });
    expect(await p.prefetch(message({ imageUrl: 'http://cdn/a.png' }))).toBe(
      false
    );
    expect(load).not.toHaveBeenCalled();
  });
});
