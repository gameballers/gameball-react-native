/* eslint-disable no-bitwise -- Packed #RRGGBB values are unpacked with shifts and masks. */
const CLOSE_ON_LIGHT = '#111827';
const CLOSE_ON_DARK = '#ffffff';
/** Where black and white give identical contrast (4.58:1) against the same background. */
const THRESHOLD = 0.179;

function channels(cssColor: string): [number, number, number] | null {
  const hex = /^#([0-9a-f]{6})$/i.exec(cssColor.trim());
  if (hex) {
    const n = parseInt(hex[1]!, 16);
    return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
  }
  const rgba = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(
    cssColor.trim()
  );
  if (rgba) return [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])];
  return null;
}

/** WCAG relative luminance, ignoring alpha. Null for colours this SDK did not produce. */
export function relativeLuminance(cssColor: string): number | null {
  const rgb = channels(cssColor);
  if (!rgb) return null;
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
}

/** Campaign colour verbatim → derived from the background → null (inherit the page). */
export function resolveCloseGlyphColor(
  campaignColor: string | undefined,
  backgroundColor: string | undefined
): string | null {
  if (campaignColor) return campaignColor;
  if (!backgroundColor) return null;
  const lum = relativeLuminance(backgroundColor);
  if (lum === null) return null;
  return lum > THRESHOLD ? CLOSE_ON_LIGHT : CLOSE_ON_DARK;
}
