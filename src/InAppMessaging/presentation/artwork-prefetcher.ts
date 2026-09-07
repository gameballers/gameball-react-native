import { Image } from 'react-native';
import { iamLog } from '../log';
import type { InAppMessage } from '../models/message';
import type { ArtworkPrefetcher } from './presenter';

/** Warms React Native's image cache so the view paints the artwork on its first frame. */
function loadWithImage(url: string): Promise<boolean> {
  return Image.prefetch(url).then(
    (ok) => ok !== false,
    () => false
  );
}

/**
 * Warms artwork before display so the impression never counts a message with a hole where its
 * image belongs. Cleartext URLs are refused outright: iOS ATS and Android block them, and one rule
 * on every platform beats a campaign that shows here and nowhere else.
 */
export class ImageArtworkPrefetcher implements ArtworkPrefetcher {
  private readonly load: (url: string) => Promise<boolean>;

  constructor(options: { load?: (url: string) => Promise<boolean> } = {}) {
    this.load = options.load ?? loadWithImage;
  }

  async prefetch(message: InAppMessage): Promise<boolean> {
    const urls = [message.imageUrl, message.iconUrl].filter(
      (u): u is string => !!u
    );
    if (urls.length === 0) return true;
    const results = await Promise.all(urls.map((url) => this.loadOne(url)));
    return results.every(Boolean);
  }

  private async loadOne(url: string): Promise<boolean> {
    if (url.startsWith('http://')) {
      iamLog(
        `artwork "${url}" is served over http and is refused — in-app artwork must be https`
      );
      return false;
    }
    try {
      const ok = await this.load(url);
      if (!ok) iamLog(`artwork "${url}" could not be loaded`);
      return ok;
    } catch (error) {
      iamLog(`artwork "${url}" could not be loaded (${String(error)})`);
      return false;
    }
  }
}
