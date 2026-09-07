import {
  relativeLuminance,
  resolveCloseGlyphColor,
} from '../../presentation/close-glyph';

describe('close glyph contrast', () => {
  it('computes relative luminance for hex and rgba', () => {
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5);
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('rgba(255, 255, 255, 0.5)')).toBeCloseTo(1, 5);
    expect(relativeLuminance('tomato')).toBeNull();
  });
  it('campaign colour wins; otherwise derive from the background; otherwise null', () => {
    expect(resolveCloseGlyphColor('#ff00ff', '#ffffff')).toBe('#ff00ff');
    expect(resolveCloseGlyphColor(undefined, '#ffffff')).toBe('#111827');
    expect(resolveCloseGlyphColor(undefined, '#111827')).toBe('#ffffff');
    expect(resolveCloseGlyphColor(undefined, undefined)).toBeNull();
  });
});
