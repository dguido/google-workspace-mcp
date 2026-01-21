import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withTimeout, DEFAULT_API_TIMEOUT_MS } from "./timeout.js";

describe("withTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves when promise completes before timeout", async () => {
    const promise = Promise.resolve("success");
    const result = await withTimeout(promise, 1000, "Test operation");
    expect(result).toBe("success");
  });

  it("rejects with timeout error when promise takes too long", async () => {
    const slowPromise = new Promise((resolve) => setTimeout(() => resolve("late"), 2000));

    const resultPromise = withTimeout(slowPromise, 1000, "Test operation");

    vi.advanceTimersByTime(1001);

    await expect(resultPromise).rejects.toThrow("Test operation timed out after 1000ms");
  });

  it("uses default timeout when not specified", async () => {
    expect(DEFAULT_API_TIMEOUT_MS).toBe(30000);
  });

  it("propagates errors from the original promise", async () => {
    const failingPromise = Promise.reject(new Error("Original error"));

    await expect(withTimeout(failingPromise, 1000, "Test")).rejects.toThrow("Original error");
  });

  it("clears timeout when promise resolves", async () => {
    const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

    const promise = Promise.resolve("done");
    await withTimeout(promise, 1000, "Test");

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });
});
