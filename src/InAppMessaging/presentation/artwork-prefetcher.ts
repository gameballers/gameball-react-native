import { Image } from 'react-native';
import { iamLog } from '../log';
import { artworkUrlsOf, type InAppMessage } from '../models/message';
import type { Artwork, ArtworkPrefetcher } from './presenter';

/**
 * Downloads an image and keeps its bytes, measured, as a `data:` uri.
 *
 * Not `Image.prefetch`. That warms React Native's own caches, and none of them is one a view can
 * count on at display. iOS keys a decoded image by the size it was drawn at — a prefetch draws at
 * none — and refuses any over 2 MB decoded; the bytes go only to the shared URL cache, which
 * stores nothing over about 5% of its size and, for a response that names no lifetime (ours name
 * none), treats it as fresh for a tenth of its age — seconds, for an image uploaded a minute ago.
 * Android writes the bytes to a disk cache the host app's own images evict. Any of those sends the
 * view back to the network while the customer watches, and the message draws with a hole where
 * its artwork belongs. Bytes held here cannot be evicted out from under it, and decoding them
 * needs no network at all.
 */
export async function loadIntoMemory(url: string): Promise<Artwork> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const blob = await response.blob();
  let uri: string;
  try {
    uri = await readAsDataUri(blob);
  } finally {
    // A React Native blob lives in native memory until it is closed; the uri holds the bytes now.
    (blob as { close?: () => void }).close?.();
  }
  const { width, height } = await measure(uri);
  // iOS measures bytes that are not a picture as nothing at all rather than failing.
  if (!(width > 0 && height > 0)) {
    throw new Error('the bytes are not a picture');
  }
  return { uri, width, height };
}

function readAsDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('the image could not be read'));
      }
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error('the image could not be read'));
    reader.readAsDataURL(blob);
  });
}

/** The callback form, which every React Native version has; the promise form is recent. */
function measure(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
}

/**
 * Holds every campaign's artwork in memory before any of them displays, so a message is drawn
 * whole from its first frame and the impression never counts one with a hole where its image
 * belongs. Cleartext urls are refused outright: iOS ATS and Android block them, and one rule on
 * every platform beats a campaign that shows here and nowhere else.
 */
export class ImageArtworkPrefetcher implements ArtworkPrefetcher {
  private readonly load: (url: string) => Promise<Artwork>;
  private readonly held = new Map<string, Artwork>();
  /** Downloads under way, so campaigns sharing an image wait on one request rather than one each. */
  private readonly loading = new Map<string, Promise<Artwork>>();
  /** What retainOnly last asked to hold; null until it is first called. */
  private wanted: ReadonlySet<string> | null = null;

  constructor(options: { load?: (url: string) => Promise<Artwork> } = {}) {
    this.load = options.load ?? loadIntoMemory;
  }

  async prefetch(message: InAppMessage): Promise<boolean> {
    const urls = artworkUrlsOf(message);
    if (urls.length === 0) return true;
    const results = await Promise.all(urls.map((url) => this.loadOne(url)));
    return results.every(Boolean);
  }

  /** The image held for a url, or null when it is not in memory. */
  artworkFor(url: string): Artwork | null {
    return this.held.get(url) ?? null;
  }

  /**
   * Holds these and only these from now on. Anything else is let go, and a download still under
   * way for anything else is dropped when it lands — a stop part-way through a sync must not leave
   * that sync's images in memory for as long as the app runs.
   */
  retainOnly(urls: ReadonlySet<string>): void {
    this.wanted = urls;
    for (const url of [...this.held.keys()]) {
      if (!urls.has(url)) this.held.delete(url);
    }
  }

  private async loadOne(url: string): Promise<boolean> {
    if (this.held.has(url)) return true;
    if (url.startsWith('http://')) {
      iamLog(
        `artwork "${url}" is served over http and is refused — in-app artwork must be https`
      );
      return false;
    }
    let loading = this.loading.get(url);
    if (!loading) {
      const started = this.load(url);
      loading = started;
      this.loading.set(url, started);
      // Forgotten once it settles, either way: a failure is more often the network than the
      // image, so the next attempt must try again rather than be handed the same failure.
      const forget = () => {
        if (this.loading.get(url) === started) this.loading.delete(url);
      };
      started.then(forget, forget);
    }
    try {
      const artwork = await loading;
      if (this.wanted && !this.wanted.has(url)) return false;
      this.held.set(url, artwork);
      return true;
    } catch (error) {
      iamLog(`artwork "${url}" could not be loaded (${String(error)})`);
      return false;
    }
  }
}
