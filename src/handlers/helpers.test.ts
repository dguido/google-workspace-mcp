import { describe, it, expect, vi } from "vitest";
import {
  getExtensionFromFilename,
  getMimeTypeFromFilename,
  validateTextFileExtension,
  convertA1ToGridRange,
  processBatchOperation,
} from "./helpers.js";

describe("getExtensionFromFilename", () => {
  it("returns extension for simple filename", () => {
    expect(getExtensionFromFilename("file.txt")).toBe("txt");
  });

  it("returns extension for filename with multiple dots", () => {
    expect(getExtensionFromFilename("file.name.md")).toBe("md");
  });

  it("returns lowercase extension", () => {
    expect(getExtensionFromFilename("FILE.TXT")).toBe("txt");
  });

  it("returns filename for filename without extension", () => {
    // split('.').pop() returns the whole string when there's no dot
    expect(getExtensionFromFilename("filename")).toBe("filename");
  });
});

describe("getMimeTypeFromFilename", () => {
  it("returns text/plain for .txt files", () => {
    expect(getMimeTypeFromFilename("file.txt")).toBe("text/plain");
  });

  it("returns text/markdown for .md files", () => {
    expect(getMimeTypeFromFilename("README.md")).toBe("text/markdown");
  });

  it("returns text/plain for unknown extensions", () => {
    expect(getMimeTypeFromFilename("file.xyz")).toBe("text/plain");
  });

  it("returns text/plain for files without extension", () => {
    expect(getMimeTypeFromFilename("filename")).toBe("text/plain");
  });
});

describe("validateTextFileExtension", () => {
  it("does not throw for .txt files", () => {
    expect(() => validateTextFileExtension("file.txt")).not.toThrow();
  });

  it("does not throw for .md files", () => {
    expect(() => validateTextFileExtension("readme.md")).not.toThrow();
  });

  it("throws for invalid extension", () => {
    expect(() => validateTextFileExtension("file.pdf")).toThrow(
      "File name must end with .txt or .md for text files.",
    );
  });

  it("throws for files without extension", () => {
    expect(() => validateTextFileExtension("filename")).toThrow(
      "File name must end with .txt or .md for text files.",
    );
  });
});

describe("convertA1ToGridRange", () => {
  it("converts single cell A1", () => {
    const result = convertA1ToGridRange("A1", 0);
    expect(result).toEqual({
      sheetId: 0,
      startColumnIndex: 0,
      endColumnIndex: 1,
      startRowIndex: 0,
      endRowIndex: 1,
    });
  });

  it("converts range A1:B2", () => {
    const result = convertA1ToGridRange("A1:B2", 0);
    expect(result).toEqual({
      sheetId: 0,
      startColumnIndex: 0,
      endColumnIndex: 2,
      startRowIndex: 0,
      endRowIndex: 2,
    });
  });

  it("converts multi-letter column AA1:AB10", () => {
    const result = convertA1ToGridRange("AA1:AB10", 0);
    expect(result).toEqual({
      sheetId: 0,
      startColumnIndex: 26,
      endColumnIndex: 28,
      startRowIndex: 0,
      endRowIndex: 10,
    });
  });

  it("converts column-only range A:B", () => {
    const result = convertA1ToGridRange("A:B", 0);
    expect(result).toEqual({
      sheetId: 0,
      startColumnIndex: 0,
      endColumnIndex: 2,
    });
  });

  it("converts row-only range 1:5", () => {
    const result = convertA1ToGridRange("1:5", 0);
    expect(result).toEqual({
      sheetId: 0,
      startRowIndex: 0,
      endRowIndex: 5,
    });
  });

  it("handles single column A", () => {
    const result = convertA1ToGridRange("A", 0);
    expect(result).toEqual({
      sheetId: 0,
      startColumnIndex: 0,
      endColumnIndex: 1,
    });
  });

  it("preserves sheetId", () => {
    const result = convertA1ToGridRange("A1", 42);
    expect(result.sheetId).toBe(42);
  });

  it("throws for invalid A1 notation", () => {
    expect(() => convertA1ToGridRange("invalid!", 0)).toThrow("Invalid A1 notation: invalid!");
  });
});

describe("processBatchOperation", () => {
  it("processes all items successfully without context", async () => {
    const ids = ["id1", "id2", "id3"];
    const operation = vi.fn().mockImplementation(async (id: string) => ({ id, processed: true }));

    const result = await processBatchOperation(ids, operation, undefined, {
      operationName: "test operation",
    });

    expect(result.success).toHaveLength(3);
    expect(result.failed).toHaveLength(0);
    expect(result.success).toEqual([
      { id: "id1", processed: true },
      { id: "id2", processed: true },
      { id: "id3", processed: true },
    ]);
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("handles partial failures", async () => {
    const ids = ["id1", "id2", "id3"];
    const operation = vi.fn().mockImplementation(async (id: string) => {
      if (id === "id2") {
        throw new Error("Operation failed for id2");
      }
      return { id, processed: true };
    });

    const result = await processBatchOperation(ids, operation, undefined, {
      operationName: "test operation",
    });

    expect(result.success).toHaveLength(2);
    expect(result.failed).toHaveLength(1);
    expect(result.success).toEqual([
      { id: "id1", processed: true },
      { id: "id3", processed: true },
    ]);
    expect(result.failed).toEqual([{ id: "id2", error: "Operation failed for id2" }]);
  });

  it("handles all failures", async () => {
    const ids = ["id1", "id2"];
    const operation = vi.fn().mockRejectedValue(new Error("All failed"));

    const result = await processBatchOperation(ids, operation, undefined, {
      operationName: "test operation",
    });

    expect(result.success).toHaveLength(0);
    expect(result.failed).toHaveLength(2);
    expect(result.failed[0].error).toBe("All failed");
    expect(result.failed[1].error).toBe("All failed");
  });

  it("handles empty ids array", async () => {
    const ids: string[] = [];
    const operation = vi.fn();

    const result = await processBatchOperation(ids, operation, undefined, {
      operationName: "test operation",
    });

    expect(result.success).toHaveLength(0);
    expect(result.failed).toHaveLength(0);
    expect(operation).not.toHaveBeenCalled();
  });

  it("respects concurrency option", async () => {
    const ids = ["id1", "id2", "id3", "id4", "id5", "id6"];
    const concurrentCalls: number[] = [];
    let currentConcurrent = 0;

    const operation = vi.fn().mockImplementation(async (id: string) => {
      currentConcurrent++;
      concurrentCalls.push(currentConcurrent);
      await new Promise((resolve) => setTimeout(resolve, 10));
      currentConcurrent--;
      return { id, processed: true };
    });

    const result = await processBatchOperation(ids, operation, undefined, {
      operationName: "test operation",
      concurrency: 2,
    });

    expect(result.success).toHaveLength(6);
    // Max concurrent should never exceed 2
    expect(Math.max(...concurrentCalls)).toBeLessThanOrEqual(2);
  });
});
