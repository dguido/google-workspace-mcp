/**
 * Color conversion utilities for Google Workspace APIs.
 *
 * Each Google API (Docs, Sheets, Slides) uses slightly different
 * color structures. These helpers provide consistent conversions.
 */

/**
 * RGB color with values between 0 and 1.
 */
export interface RgbColor {
  red?: number;
  green?: number;
  blue?: number;
}

/**
 * RGB color with optional alpha channel for transparency.
 */
export interface RgbColorWithAlpha extends RgbColor {
  alpha?: number;
}

/**
 * Normalize RGB color values, defaulting undefined values to 0.
 */
export function toRgbColor(color: RgbColor): { red: number; green: number; blue: number } {
  return {
    red: color.red || 0,
    green: color.green || 0,
    blue: color.blue || 0,
  };
}

/**
 * Convert to Google Docs color style format.
 * Docs wraps RGB in { color: { rgbColor: {...} } }
 */
export function toDocsColorStyle(color: RgbColor): {
  color: { rgbColor: { red: number; green: number; blue: number } };
} {
  return {
    color: {
      rgbColor: toRgbColor(color),
    },
  };
}

/**
 * Convert to Google Sheets color style format.
 * Sheets uses { rgbColor: {...} } directly.
 */
export function toSheetsColorStyle(color: RgbColor): {
  rgbColor: { red: number; green: number; blue: number };
} {
  return {
    rgbColor: toRgbColor(color),
  };
}

/**
 * Convert to Google Slides color style format.
 * Slides uses { rgbColor: {...} } directly (same as Sheets).
 */
export function toSlidesColorStyle(color: RgbColor): {
  rgbColor: { red: number; green: number; blue: number };
} {
  return {
    rgbColor: toRgbColor(color),
  };
}

/**
 * Convert to Google Slides solid fill format.
 * Used for shape and text box backgrounds.
 */
export function toSlidesSolidFill(
  color: RgbColorWithAlpha
): { solidFill: { color: { rgbColor: { red: number; green: number; blue: number } }; alpha: number } } {
  return {
    solidFill: {
      color: toSlidesColorStyle(color),
      alpha: color.alpha ?? 1,
    },
  };
}
