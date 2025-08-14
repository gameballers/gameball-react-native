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
}
