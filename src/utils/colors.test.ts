import { describe, it, expect } from 'vitest';
import {
  toRgbColor,
  toDocsColorStyle,
  toSheetsColorStyle,
  toSlidesColorStyle,
  toSlidesSolidFill,
} from './colors.js';

describe('utils/colors', () => {
  describe('toRgbColor', () => {
    it('returns all values when provided', () => {
      const result = toRgbColor({ red: 0.5, green: 0.3, blue: 0.8 });

      expect(result).toEqual({ red: 0.5, green: 0.3, blue: 0.8 });
    });

    it('defaults undefined values to 0', () => {
      const result = toRgbColor({});

      expect(result).toEqual({ red: 0, green: 0, blue: 0 });
    });

    it('defaults individual undefined values to 0', () => {
      const result = toRgbColor({ red: 0.5 });

      expect(result).toEqual({ red: 0.5, green: 0, blue: 0 });
    });

    it('handles 0 values correctly (not as falsy)', () => {
      // 0 is a valid color value, but || treats it as falsy
      // This test documents the current behavior
      const result = toRgbColor({ red: 0, green: 0, blue: 0 });

      expect(result).toEqual({ red: 0, green: 0, blue: 0 });
    });

    it('handles full white color', () => {
      const result = toRgbColor({ red: 1, green: 1, blue: 1 });

      expect(result).toEqual({ red: 1, green: 1, blue: 1 });
    });
  });

  describe('toDocsColorStyle', () => {
    it('wraps color in Docs format', () => {
      const result = toDocsColorStyle({ red: 0.5, green: 0.3, blue: 0.8 });

      expect(result).toEqual({
        color: {
          rgbColor: { red: 0.5, green: 0.3, blue: 0.8 },
        },
      });
    });

    it('defaults missing values to 0', () => {
      const result = toDocsColorStyle({});

      expect(result).toEqual({
        color: {
          rgbColor: { red: 0, green: 0, blue: 0 },
        },
      });
    });

    it('handles partial color specification', () => {
      const result = toDocsColorStyle({ blue: 1 });

      expect(result).toEqual({
        color: {
          rgbColor: { red: 0, green: 0, blue: 1 },
        },
      });
    });
  });

  describe('toSheetsColorStyle', () => {
    it('wraps color in Sheets format', () => {
      const result = toSheetsColorStyle({ red: 0.5, green: 0.3, blue: 0.8 });

      expect(result).toEqual({
        rgbColor: { red: 0.5, green: 0.3, blue: 0.8 },
      });
    });

    it('defaults missing values to 0', () => {
      const result = toSheetsColorStyle({});

      expect(result).toEqual({
        rgbColor: { red: 0, green: 0, blue: 0 },
      });
    });

    it('handles partial color specification', () => {
      const result = toSheetsColorStyle({ green: 0.7 });

      expect(result).toEqual({
        rgbColor: { red: 0, green: 0.7, blue: 0 },
      });
    });
  });

  describe('toSlidesColorStyle', () => {
    it('wraps color in Slides format', () => {
      const result = toSlidesColorStyle({ red: 0.5, green: 0.3, blue: 0.8 });

      expect(result).toEqual({
        rgbColor: { red: 0.5, green: 0.3, blue: 0.8 },
      });
    });

    it('has same structure as Sheets color style', () => {
      const color = { red: 0.2, green: 0.4, blue: 0.6 };
      const slidesResult = toSlidesColorStyle(color);
      const sheetsResult = toSheetsColorStyle(color);

      expect(slidesResult).toEqual(sheetsResult);
    });

    it('defaults missing values to 0', () => {
      const result = toSlidesColorStyle({});

      expect(result).toEqual({
        rgbColor: { red: 0, green: 0, blue: 0 },
      });
    });
  });

  describe('toSlidesSolidFill', () => {
    it('creates solid fill with default alpha', () => {
      const result = toSlidesSolidFill({ red: 0.5, green: 0.3, blue: 0.8 });

      expect(result).toEqual({
        solidFill: {
          color: {
            rgbColor: { red: 0.5, green: 0.3, blue: 0.8 },
          },
          alpha: 1,
        },
      });
    });

    it('uses provided alpha value', () => {
      const result = toSlidesSolidFill({ red: 0.5, green: 0.3, blue: 0.8, alpha: 0.5 });

      expect(result).toEqual({
        solidFill: {
          color: {
            rgbColor: { red: 0.5, green: 0.3, blue: 0.8 },
          },
          alpha: 0.5,
        },
      });
    });

    it('handles alpha of 0 (fully transparent)', () => {
      const result = toSlidesSolidFill({ red: 1, green: 0, blue: 0, alpha: 0 });

      expect(result).toEqual({
        solidFill: {
          color: {
            rgbColor: { red: 1, green: 0, blue: 0 },
          },
          alpha: 0,
        },
      });
    });

    it('defaults color values to 0', () => {
      const result = toSlidesSolidFill({});

      expect(result).toEqual({
        solidFill: {
          color: {
            rgbColor: { red: 0, green: 0, blue: 0 },
          },
          alpha: 1,
        },
      });
    });
  });
});
