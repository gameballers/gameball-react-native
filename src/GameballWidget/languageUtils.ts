export class LanguageUtils {
  private static readonly ltrLanguageCodes: string[] = [
    'en',
    'fr',
    'es',
    'de',
    'pt',
    'pl',
    'it',
    'hu',
    'zh-tw',
    'nl',
    'sv',
    'no',
    'dk',
    'ja',
  ];

  private static readonly rtlLanguageCodes: string[] = ['ar'];

  public static isLtr(languageCode: string): boolean {
    return this.ltrLanguageCodes.includes(languageCode);
  }

  public static isRtl(languageCode: string): boolean {
    return this.rtlLanguageCodes.includes(languageCode);
  }

  /** Returns the code trimmed and lowercased if it's supported, otherwise 'en'. */
  public static normalize(languageCode: string): string {
    const code = languageCode.trim().toLowerCase();
    return this.isLtr(code) || this.isRtl(code) ? code : 'en';
  }

  /**
   * Resolves the widget language, in priority order: the per-call override (e.g. passed to
   * showProfile), then the customer preferred language, then the global language, then 'en'.
   * The first one set wins; an unsupported code resolves to 'en'.
   */
  public static resolve(
    globalLang: string | null | undefined,
    preferredLang?: string | null,
    override?: string | null
  ): string {
    const lang = [override, preferredLang, globalLang].find((l) => l && l.trim() !== '');
    return this.normalize(lang ?? 'en');
  }
}
