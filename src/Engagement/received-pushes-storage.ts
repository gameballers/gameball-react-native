import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants';
import type { ReceivedPush, ReceivedPushStore } from './influenced-opens';

/**
 * Received pushes in AsyncStorage. The app is usually killed between a push arriving and the
 * next open, so memory isn't enough. Needs nothing from `init`, so it works in the headless
 * task RNFirebase runs for a background push.
 */
export class AsyncStorageReceivedPushes implements ReceivedPushStore {
  async load(): Promise<ReceivedPush[]> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.RECEIVED_PUSHES);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (p): p is ReceivedPush =>
          p !== null &&
          typeof p === 'object' &&
          typeof p.key === 'string' &&
          typeof p.receivedAt === 'number'
      );
    } catch {
      return [];
    }
  }

  async save(pushes: ReceivedPush[]): Promise<void> {
    if (pushes.length === 0) {
      await AsyncStorage.removeItem(STORAGE_KEYS.RECEIVED_PUSHES);
    } else {
      await AsyncStorage.setItem(
        STORAGE_KEYS.RECEIVED_PUSHES,
        JSON.stringify(pushes)
      );
    }
  }
}
