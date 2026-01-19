/**
 * Simple in-memory cache for sheet metadata (sheetName → sheetId mapping).
 * Avoids redundant API calls when applying multiple formatting operations
 * to the same spreadsheet.
 */

interface SheetMetadata {
  sheetId: number;
  title: string;
}

interface CacheEntry {
  sheets: Map<string, SheetMetadata>;
  timestamp: number;
}

const TTL_MS = 60_000; // 60-second cache TTL
const cache = new Map<string, CacheEntry>();

export function getCachedSheetMetadata(
  spreadsheetId: string,
  sheetName: string
): SheetMetadata | undefined {
  const entry = cache.get(spreadsheetId);
  if (!entry) return undefined;

  // Check if cache is expired
  if (Date.now() - entry.timestamp > TTL_MS) {
    cache.delete(spreadsheetId);
    return undefined;
  }

  return entry.sheets.get(sheetName);
}

export function setCachedSheetMetadata(
  spreadsheetId: string,
  sheets: Array<{ title: string; sheetId: number }>
): void {
  const sheetsMap = new Map<string, SheetMetadata>();
  for (const sheet of sheets) {
    sheetsMap.set(sheet.title, { sheetId: sheet.sheetId, title: sheet.title });
  }

  cache.set(spreadsheetId, {
    sheets: sheetsMap,
    timestamp: Date.now()
  });
}

export function clearSheetCache(spreadsheetId?: string): void {
  if (spreadsheetId) {
    cache.delete(spreadsheetId);
  } else {
    cache.clear();
  }
}

export function getSheetCacheStats(): { size: number; entries: string[] } {
  return {
    size: cache.size,
    entries: Array.from(cache.keys())
  };
}
