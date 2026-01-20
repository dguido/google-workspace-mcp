import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getCachedSheetMetadata,
  setCachedSheetMetadata,
  clearSheetCache,
  getSheetCacheStats,
} from './sheetCache.js';

describe('sheetCache', () => {
  beforeEach(() => {
    clearSheetCache();
  });

  describe('setCachedSheetMetadata / getCachedSheetMetadata', () => {
    it('stores and retrieves sheet metadata', () => {
      setCachedSheetMetadata('spreadsheet1', [
        { title: 'Sheet1', sheetId: 0 },
        { title: 'Data', sheetId: 123 },
      ]);

      const sheet1 = getCachedSheetMetadata('spreadsheet1', 'Sheet1');
      expect(sheet1).toEqual({ sheetId: 0, title: 'Sheet1' });

      const dataSheet = getCachedSheetMetadata('spreadsheet1', 'Data');
      expect(dataSheet).toEqual({ sheetId: 123, title: 'Data' });
    });

    it('returns undefined for unknown spreadsheet', () => {
      const result = getCachedSheetMetadata('unknown', 'Sheet1');
      expect(result).toBeUndefined();
    });

    it('returns undefined for unknown sheet name', () => {
      setCachedSheetMetadata('spreadsheet1', [{ title: 'Sheet1', sheetId: 0 }]);

      const result = getCachedSheetMetadata('spreadsheet1', 'NonExistent');
      expect(result).toBeUndefined();
    });

    it('expires after TTL', () => {
      vi.useFakeTimers();

      setCachedSheetMetadata('spreadsheet1', [{ title: 'Sheet1', sheetId: 0 }]);

      // Before TTL - should return cached value
      expect(getCachedSheetMetadata('spreadsheet1', 'Sheet1')).toBeDefined();

      // After TTL (60 seconds) - should return undefined
      vi.advanceTimersByTime(61_000);
      expect(getCachedSheetMetadata('spreadsheet1', 'Sheet1')).toBeUndefined();

      vi.useRealTimers();
    });
  });

  describe('clearSheetCache', () => {
    it('clears specific spreadsheet from cache', () => {
      setCachedSheetMetadata('spreadsheet1', [{ title: 'Sheet1', sheetId: 0 }]);
      setCachedSheetMetadata('spreadsheet2', [{ title: 'Sheet1', sheetId: 0 }]);

      clearSheetCache('spreadsheet1');

      expect(getCachedSheetMetadata('spreadsheet1', 'Sheet1')).toBeUndefined();
      expect(getCachedSheetMetadata('spreadsheet2', 'Sheet1')).toBeDefined();
    });

    it('clears all cache when no argument provided', () => {
      setCachedSheetMetadata('spreadsheet1', [{ title: 'Sheet1', sheetId: 0 }]);
      setCachedSheetMetadata('spreadsheet2', [{ title: 'Sheet1', sheetId: 0 }]);

      clearSheetCache();

      expect(getCachedSheetMetadata('spreadsheet1', 'Sheet1')).toBeUndefined();
      expect(getCachedSheetMetadata('spreadsheet2', 'Sheet1')).toBeUndefined();
    });
  });

  describe('getSheetCacheStats', () => {
    it('returns cache statistics', () => {
      expect(getSheetCacheStats()).toEqual({ size: 0, entries: [] });

      setCachedSheetMetadata('spreadsheet1', [{ title: 'Sheet1', sheetId: 0 }]);
      setCachedSheetMetadata('spreadsheet2', [{ title: 'Sheet1', sheetId: 0 }]);

      const stats = getSheetCacheStats();
      expect(stats.size).toBe(2);
      expect(stats.entries).toContain('spreadsheet1');
      expect(stats.entries).toContain('spreadsheet2');
    });
  });
});
