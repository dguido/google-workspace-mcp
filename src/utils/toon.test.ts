import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { toToon } from "./toon.js";

vi.mock("@toon-format/toon", () => ({
  encode: vi.fn(),
}));

vi.mock("../config/services.js", () => ({
  isToonEnabled: vi.fn(),
}));

import { encode } from "@toon-format/toon";
import { isToonEnabled } from "../config/services.js";

const mockEncode = vi.mocked(encode);
const mockIsToonEnabled = vi.mocked(isToonEnabled);

describe("toToon", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("returns JSON when TOON is disabled", () => {
    mockIsToonEnabled.mockReturnValue(false);
    const data = { name: "test", count: 42 };

    const result = toToon(data);

    expect(result).toBe(JSON.stringify(data, null, 2));
    expect(mockEncode).not.toHaveBeenCalled();
  });

  it("returns TOON-encoded data when enabled", () => {
    mockIsToonEnabled.mockReturnValue(true);
    mockEncode.mockReturnValue("toon:encoded:data");
    const data = { items: [{ id: 1 }, { id: 2 }] };

    const result = toToon(data);

    expect(result).toBe("toon:encoded:data");
    expect(mockEncode).toHaveBeenCalledWith(data);
    expect(mockEncode).toHaveBeenCalledTimes(1);
  });

  it("falls back to JSON when encoding fails", () => {
    mockIsToonEnabled.mockReturnValue(true);
    mockEncode.mockImplementation(() => {
      throw new Error("Encoding failed");
    });
    const data = { error: "test" };

    const result = toToon(data);

    expect(result).toBe(JSON.stringify(data, null, 2));
    expect(mockEncode).toHaveBeenCalledWith(data);
  });

  it("handles empty objects", () => {
    mockIsToonEnabled.mockReturnValue(false);
    const data = {};

    const result = toToon(data);

    expect(result).toBe("{}");
  });

  it("handles nested objects when TOON disabled", () => {
    mockIsToonEnabled.mockReturnValue(false);
    const data = { outer: { inner: { deep: "value" } } };

    const result = toToon(data);

    expect(result).toBe(JSON.stringify(data, null, 2));
  });

  it("passes complex data structures to TOON encoder", () => {
    mockIsToonEnabled.mockReturnValue(true);
    mockEncode.mockReturnValue("complex:toon");
    const data = {
      files: [
        { id: "1", name: "file1.txt", size: 100 },
        { id: "2", name: "file2.txt", size: 200 },
      ],
      metadata: { total: 2, hasMore: false },
    };

    const result = toToon(data);

    expect(result).toBe("complex:toon");
    expect(mockEncode).toHaveBeenCalledWith(data);
  });
});
