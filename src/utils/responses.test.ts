import { describe, it, expect, vi } from "vitest";
import {
  successResponse,
  structuredResponse,
  errorResponse,
} from "./responses.js";

vi.mock("./logging.js", () => ({
  log: vi.fn(),
}));

describe("successResponse", () => {
  it("returns correct structure with text", () => {
    const result = successResponse("Operation successful");
    expect(result).toEqual({
      content: [{ type: "text", text: "Operation successful" }],
      isError: false,
    });
  });

  it("handles empty string", () => {
    const result = successResponse("");
    expect(result).toEqual({
      content: [{ type: "text", text: "" }],
      isError: false,
    });
  });
});

describe("structuredResponse", () => {
  it("returns correct structure with text and data", () => {
    const result = structuredResponse("File metadata", {
      id: "123",
      name: "test.txt",
    });
    expect(result).toEqual({
      content: [{ type: "text", text: "File metadata" }],
      structuredContent: { id: "123", name: "test.txt" },
      isError: false,
    });
  });

  it("handles nested data structures", () => {
    const data = {
      user: { name: "John", email: "john@example.com" },
      permissions: [{ role: "reader" }, { role: "writer" }],
    };
    const result = structuredResponse("Sharing info", data);
    expect(result.structuredContent).toEqual(data);
    expect(result.isError).toBe(false);
  });
});

describe("errorResponse", () => {
  it("returns correct structure with error message", () => {
    const result = errorResponse("Something went wrong");
    expect(result).toEqual({
      content: [{ type: "text", text: "Error: Something went wrong" }],
      isError: true,
    });
  });

  it("prefixes message with Error:", () => {
    const result = errorResponse("test");
    expect(result.content[0].text).toBe("Error: test");
  });
});
