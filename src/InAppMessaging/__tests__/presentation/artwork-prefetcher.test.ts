import {
  ImageArtworkPrefetcher,
  loadIntoMemory,
} from '../../presentation/artwork-prefetcher';
import type { Artwork } from '../../presentation/presenter';
import { message } from '../helpers/fixtures';
import { installFileReader, stubBlob } from '../support/file-reader-stub';
import { imageSizes, resetReactNativeStub } from '../support/react-native-stub';

const A = 'https://cdn.test/a.png';
const B = 'https://cdn.test/b.png';
const MISSING = 'https://cdn.test/missing.png';
const heldA: Artwork = {
  uri: 'data:image/png;base64,QQ==',
  width: 4,
  height: 3,
};
const heldB: Artwork = {
  uri: 'data:image/png;base64,Qg==',
  width: 1,
  height: 1,
};

/** A loader that serves these images and fails every other url, recording what it was asked for. */
function loader(images: Record<string, Artwork>) {
  const calls: string[] = [];
  return {
    calls,
    load: async (url: string): Promise<Artwork> => {
      calls.push(url);
      const artwork = images[url];
      if (!artwork) {
        throw new Error('404');
      }
      return artwork;
    },
  };
}

describe('ImageArtworkPrefetcher', () => {
  it('holds every image a message carries, and is ready only once all of them are held', async () => {
    const { load } = loader({ [A]: heldA, [B]: heldB });
    const p = new ImageArtworkPrefetcher({ load });

    expect(await p.prefetch(message({ imageUrl: A, iconUrl: B }))).toBe(true);
    expect(p.artworkFor(A)).toEqual(heldA);
    expect(p.artworkFor(B)).toEqual(heldB);

    expect(await p.prefetch(message({ imageUrl: A, iconUrl: MISSING }))).toBe(
      false
    );
    expect(p.artworkFor(MISSING)).toBeNull();
  });

  it('a message without artwork is ready without loading anything', async () => {
    const { load, calls } = loader({});
    const p = new ImageArtworkPrefetcher({ load });
    expect(await p.prefetch(message())).toBe(true);
    expect(calls).toEqual([]);
  });

  it('downloads an image once, however many campaigns carry it', async () => {
    const { load, calls } = loader({ [A]: heldA });
    const p = new ImageArtworkPrefetcher({ load });

    // Two variations sharing their artwork, warmed side by side; then the next sync of the same set.
    await Promise.all([
      p.prefetch(message({ id: '1', imageUrl: A })),
      p.prefetch(message({ id: '2', imageUrl: A })),
    ]);
    expect(await p.prefetch(message({ id: '1', imageUrl: A }))).toBe(true);

    expect(calls).toEqual([A]);
  });

  it('lets go of images no campaign carries any more, and fetches one afresh when a later sync carries it again', async () => {
    const { load, calls } = loader({ [A]: heldA, [B]: heldB });
    const p = new ImageArtworkPrefetcher({ load });
    await p.prefetch(message({ imageUrl: A, iconUrl: B }));

    p.retainOnly(new Set([A]));
    expect(p.artworkFor(A)).toEqual(heldA);
    expect(p.artworkFor(B)).toBeNull();

    p.retainOnly(new Set([A, B]));
    expect(await p.prefetch(message({ iconUrl: B }))).toBe(true);
    expect(calls).toEqual([A, B, B]);
  });

  it('does not keep an image whose download finishes after it stopped being wanted', async () => {
    let finish!: (artwork: Artwork) => void;
    const p = new ImageArtworkPrefetcher({
      load: () =>
        new Promise<Artwork>((resolve) => {
          finish = resolve;
        }),
    });

    const ready = p.prefetch(message({ imageUrl: A }));
    // Messaging stopped — a logout — while the image was still downloading.
    p.retainOnly(new Set());
    finish(heldA);

    expect(await ready).toBe(false);
    expect(p.artworkFor(A)).toBeNull();
  });

  it('does not remember a failure: the next attempt downloads again', async () => {
    // A failure is more often the network than the image, and the service retries on an interval
    // precisely so a blip does not bench a campaign for the rest of the session.
    let online = false;
    const calls: string[] = [];
    const p = new ImageArtworkPrefetcher({
      load: async (url) => {
        calls.push(url);
        if (!online) {
          throw new Error('offline');
        }
        return heldA;
      },
    });

    expect(await p.prefetch(message({ imageUrl: A }))).toBe(false);
    online = true;
    expect(await p.prefetch(message({ imageUrl: A }))).toBe(true);
    expect(p.artworkFor(A)).toEqual(heldA);
    expect(calls).toEqual([A, A]);
  });

  it('refuses cleartext http without asking the loader', async () => {
    const http = 'http://cdn.test/a.png';
    const { load, calls } = loader({ [http]: heldA });
    const p = new ImageArtworkPrefetcher({ load });
    expect(await p.prefetch(message({ imageUrl: http }))).toBe(false);
    expect(calls).toEqual([]);
    expect(p.artworkFor(http)).toBeNull();
  });
});

describe('loadIntoMemory', () => {
  const PNG_URI = 'data:image/png;base64,UE5H';
  const realFetch = globalThis.fetch;
  let removeFileReader = () => {};

  function serve(response: { ok: boolean; status: number }) {
    const blob = stubBlob('UE5H');
    globalThis.fetch = jest.fn(async () => ({
      ...response,
      blob: async () => blob,
    })) as unknown as typeof fetch;
    return blob;
  }

  beforeEach(() => {
    resetReactNativeStub();
    removeFileReader = installFileReader();
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    removeFileReader();
  });

  it('keeps the bytes as a data uri, measured, and frees the native blob', async () => {
    const blob = serve({ ok: true, status: 200 });
    imageSizes.set(PNG_URI, { width: 1200, height: 800 });

    expect(await loadIntoMemory(A)).toEqual({
      uri: PNG_URI,
      width: 1200,
      height: 800,
    });
    expect(blob.close).toHaveBeenCalledTimes(1);
  });

  it('fails on an http error', async () => {
    serve({ ok: false, status: 404 });
    imageSizes.set(PNG_URI, { width: 1200, height: 800 });
    await expect(loadIntoMemory(A)).rejects.toThrow('404');
  });

  it.each([
    ['cannot be measured', null],
    // iOS answers bytes that are not a picture with a size of nothing rather than an error.
    ['measure as nothing', { width: 0, height: 0 }],
  ])('fails on bytes that %s, and still frees the blob', async (_, size) => {
    const blob = serve({ ok: true, status: 200 });
    if (size) {
      imageSizes.set(PNG_URI, size);
    }
    await expect(loadIntoMemory(A)).rejects.toThrow();
    expect(blob.close).toHaveBeenCalledTimes(1);
  });
});
