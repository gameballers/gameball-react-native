/** The platforms the messaging backend recognises. */
export type Platform = 'ios' | 'android';

/** The backend's numeric platform enum. */
export function platformCode(platform: Platform): 1 | 2 {
  return platform === 'ios' ? 1 : 2;
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
