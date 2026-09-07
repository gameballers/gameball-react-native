import type { GameballAdapter, Platform } from './adapter';

export type { Platform };

/** The backend's numeric platform enum. 3 = Web is proposed; unknown values return 200 with no messages. */
export function platformCode(platform: Platform): 1 | 2 | 3 {
  return platform === 'ios' ? 1 : platform === 'android' ? 2 : 3;
}

export function osTypeFor(platform: Platform): 'iOS' | 'Android' | 'Web' {
  return platform === 'ios'
    ? 'iOS'
    : platform === 'android'
    ? 'Android'
    : 'Web';
}

/** Preferred language if it is a 2-letter code, else the global one if it is, else English. */
export function resolveLanguage(
  globalLang: string | undefined,
  preferred: string | null | undefined
): string {
  if (preferred && preferred.length === 2) return preferred;
  if (globalLang && globalLang.length === 2) return globalLang;
  return 'en';
}

export function detectPlatform(adapter?: GameballAdapter): Platform {
  try {
    return adapter?.platform?.() ?? 'web';
  } catch {
    return 'web';
  }
}
