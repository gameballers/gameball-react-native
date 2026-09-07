/**
 * Every layout constant the three message views use, in one place.
 *
 * These are the same numbers the Flutter, iOS and Android SDKs draw with, and the same ones the
 * dashboard's composer preview draws with — a campaign is meant to be the same shape wherever a
 * customer meets it, and a marketer previews it once. Values, not a themeable API: a campaign
 * controls colour, text and behaviour, never geometry.
 *
 * The type scale is the preview's, and the header-to-body ratio is the part that reads: 1.57 on a
 * modal, 1.50 on a full screen.
 */

export const MessageMetrics = {
  /** The dimmed layer behind a modal, when the campaign names no scrim colour. */
  defaultScrim: 'rgba(0, 0, 0, 0.6)',
  /** Close glyph on a light surface, when the campaign names no colour. */
  closeGlyphOnLight: '#111827',
  /** Close glyph on a dark surface. */
  closeGlyphOnDark: '#FFFFFF',
  /** The message surface, when the campaign names no background. */
  defaultSurface: '#FFFFFF',
  defaultBodyColor: '#1B1F27',
  /** The glyph itself, inside a 48 hit target that is the accessibility floor on both platforms. */
  closeGlyphSize: 24,
  closeHitTarget: 48,
  buttonCornerRadius: 8,
} as const;

export const ModalMetrics = {
  margin: 24,
  maxWidth: 420,
  cornerRadius: 16,
  contentPadding: { top: 20, horizontal: 20 },
  headerToBodySpacing: 8,
  buttonsPadding: { top: 20, horizontal: 20, bottom: 16 },
  buttonSpacing: 8,
  buttonPadding: { vertical: 12, horizontal: 20 },
  /** Buttons floated over a full-bleed image, in the image-only layout. */
  imageOnlyButtonsPadding: { horizontal: 20, bottom: 20 },
  closeInset: 4,
  /** The tallest artwork that still fills the card's width without bars, as a ratio. */
  minImageRatio: 0.55,
  /** Height always kept for the copy and buttons, whatever the artwork wants. */
  copyReserve: 120,
  /** The same, for an image-only modal where the artwork is the whole message. */
  imageOnlyHeightFraction: 0.65,
  headerFontSize: 22,
  headerLineHeight: 28,
  bodyFontSize: 14,
  bodyLineHeight: 20,
  buttonFontSize: 14,
  buttonLineHeight: 20,
} as const;

export const SlideupMetrics = {
  margin: 12,
  maxWidth: 480,
  cornerRadius: 12,
  contentPadding: { horizontal: 14, vertical: 12 },
  /** Lines of copy before the text ellipsises. A banner that grew with its copy would cover
   * the screen it exists not to block. */
  maxTextLines: 3,
  iconSize: 40,
  iconCornerRadius: 8,
  iconSpacing: 12,
  chevronSpacing: 8,
  chevronSize: 20,
  fontSize: 14,
  lineHeight: 20,
  /** Applied when the campaign names none, so a banner cannot sit over the app for ever. */
  defaultAutoDismissMs: 8000,
  /** How far a drag has to travel towards the edge before it counts as a dismissal. */
  swipeDismissDistance: 48,
} as const;

export const FullscreenMetrics = {
  contentPadding: { top: 24, horizontal: 24 },
  /** A fixed share, not "whatever the copy leaves": an image sized by subtraction lands on
   * whatever ratio is left over and letterboxes when that does not match the artwork. */
  imageHeightFraction: 0.5,
  imageOnlyButtonsPadding: { horizontal: 24, bottom: 32 },
  headerToBodySpacing: 12,
  buttonsPadding: { top: 28, horizontal: 24, bottom: 24 },
  buttonSpacing: 12,
  buttonPaddingVertical: 16,
  closeInset: 8,
  headerFontSize: 24,
  headerLineHeight: 32,
  bodyFontSize: 16,
  bodyLineHeight: 24,
  buttonFontSize: 16,
  buttonLineHeight: 20,
} as const;
