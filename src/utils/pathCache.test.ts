import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  getCachedPath,
  setCachedPath,
  getCachedSegment,
  setCachedSegment,
  clearPathCache,
  getPathCacheStats,
} from "./pathCache.js";

describe("pathCache", () => {
  beforeEach(() => {
    clearPathCache();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("full path caching", () => {
    it("returns undefined for uncached path", () => {
      expect(getCachedPath("/foo/bar")).toBeUndefined();
    });

    it("returns cached path after setting", () => {
      setCachedPath("/foo/bar", "file123");
      expect(getCachedPath("/foo/bar")).toBe("file123");
    });

    it("normalizes paths (strips leading/trailing slashes)", () => {
      setCachedPath("/foo/bar/", "file123");
      expect(getCachedPath("foo/bar")).toBe("file123");
    });

    it("is case-insensitive", () => {
      setCachedPath("/Foo/Bar", "file123");
      expect(getCachedPath("/foo/bar")).toBe("file123");
    });

    it("expires after TTL", () => {
      vi.useFakeTimers();
      setCachedPath("/foo/bar", "file123");
      expect(getCachedPath("/foo/bar")).toBe("file123");

      // Advance time past TTL (60 seconds)
      vi.advanceTimersByTime(61_000);

      expect(getCachedPath("/foo/bar")).toBeUndefined();
    });
  });

  describe("segment caching", () => {
    it("returns undefined for uncached segment", () => {
      expect(getCachedSegment("parentId", "folder")).toBeUndefined();
    });

    it("returns cached segment after setting", () => {
      setCachedSegment("parentId", "folder", "childId");
      expect(getCachedSegment("parentId", "folder")).toBe("childId");
    });

    it("distinguishes segments by parent ID", () => {
      setCachedSegment("parent1", "folder", "child1");
      setCachedSegment("parent2", "folder", "child2");

      expect(getCachedSegment("parent1", "folder")).toBe("child1");
      expect(getCachedSegment("parent2", "folder")).toBe("child2");
    });

    it("expires after TTL", () => {
      vi.useFakeTimers();
      setCachedSegment("parentId", "folder", "childId");
      expect(getCachedSegment("parentId", "folder")).toBe("childId");

      vi.advanceTimersByTime(61_000);

      expect(getCachedSegment("parentId", "folder")).toBeUndefined();
    });
  });

  describe("clearPathCache", () => {
    it("clears specific path", () => {
      setCachedPath("/foo", "id1");
      setCachedPath("/bar", "id2");

      clearPathCache("/foo");

      expect(getCachedPath("/foo")).toBeUndefined();
      expect(getCachedPath("/bar")).toBe("id2");
    });

    it("clears all caches when no path specified", () => {
      setCachedPath("/foo", "id1");
      setCachedSegment("parent", "child", "childId");

      clearPathCache();

      expect(getCachedPath("/foo")).toBeUndefined();
      expect(getCachedSegment("parent", "child")).toBeUndefined();
    });
  });

  describe("getPathCacheStats", () => {
    it("returns correct counts", () => {
      expect(getPathCacheStats()).toEqual({ pathCount: 0, segmentCount: 0 });

      setCachedPath("/foo", "id1");
      setCachedPath("/bar", "id2");
      setCachedSegment("parent", "child", "childId");

      expect(getPathCacheStats()).toEqual({ pathCount: 2, segmentCount: 1 });
    });
  });
});
