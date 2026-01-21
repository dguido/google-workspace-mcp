/**
 * Simple in-memory cache for path resolution.
 * Caches both full paths and intermediate segment lookups to avoid redundant API calls.
 */

interface CacheEntry {
  fileId: string;
  timestamp: number;
}

const TTL_MS = 60_000; // 60-second cache TTL

// Cache for full paths: "/foo/bar" -> fileId
const pathCache = new Map<string, CacheEntry>();

// Cache for segment lookups: "parentId:segmentName" -> fileId
const segmentCache = new Map<string, CacheEntry>();

function isExpired(entry: CacheEntry): boolean {
  return Date.now() - entry.timestamp > TTL_MS;
}

/**
 * Get a cached full path resolution.
 * @param path - The full path (e.g., "/Documents/Projects")
 * @returns The cached fileId or undefined if not cached/expired
 */
export function getCachedPath(path: string): string | undefined {
  const normalized = normalizePath(path);
  const entry = pathCache.get(normalized);
  if (!entry) return undefined;

  if (isExpired(entry)) {
    pathCache.delete(normalized);
    return undefined;
  }

  return entry.fileId;
}

/**
 * Cache a full path resolution.
 * @param path - The full path
 * @param fileId - The resolved file ID
 */
export function setCachedPath(path: string, fileId: string): void {
  const normalized = normalizePath(path);
  pathCache.set(normalized, { fileId, timestamp: Date.now() });
}

/**
 * Get a cached segment lookup.
 * @param parentId - The parent folder ID
 * @param segmentName - The folder/file name to look up
 * @returns The cached fileId or undefined if not cached/expired
 */
export function getCachedSegment(parentId: string, segmentName: string): string | undefined {
  const key = `${parentId}:${segmentName}`;
  const entry = segmentCache.get(key);
  if (!entry) return undefined;

  if (isExpired(entry)) {
    segmentCache.delete(key);
    return undefined;
  }

  return entry.fileId;
}

/**
 * Cache a segment lookup.
 * @param parentId - The parent folder ID
 * @param segmentName - The folder/file name
 * @param fileId - The resolved file ID
 */
export function setCachedSegment(parentId: string, segmentName: string, fileId: string): void {
  const key = `${parentId}:${segmentName}`;
  segmentCache.set(key, { fileId, timestamp: Date.now() });
}

/**
 * Clear the path cache.
 * @param path - Optional specific path to clear. If not provided, clears all.
 */
export function clearPathCache(path?: string): void {
  if (path) {
    const normalized = normalizePath(path);
    pathCache.delete(normalized);
  } else {
    pathCache.clear();
    segmentCache.clear();
  }
}

/**
 * Get cache statistics for debugging.
 */
export function getPathCacheStats(): { pathCount: number; segmentCount: number } {
  return {
    pathCount: pathCache.size,
    segmentCount: segmentCache.size,
  };
}

/**
 * Normalize a path for consistent caching.
 */
function normalizePath(path: string): string {
  return path.replace(/^\/+|\/+$/g, "").toLowerCase();
}
