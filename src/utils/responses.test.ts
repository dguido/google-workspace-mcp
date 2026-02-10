import { describe, it, expect, vi } from "vitest";
import {
  successResponse,
  structuredResponse,
  errorResponse,
  authErrorResponse,
  isConfigurationError,
  DIAGNOSTIC_HINT,
} from "./responses.js";
import { GoogleAuthError } from "../errors/google-auth-error.js";

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

describe("isConfigurationError", () => {
  it.each([
    ["Invalid credentials format in /path", true],
    ["Authentication failed", true],
    ["Invalid token file format", true],
    ["token has expired, please refresh", true],
    ["token refresh failed", true],
    ["API not enabled for project", true],
    ["Client ID missing in credentials.", true],
    ["scope coverage insufficient", true],
    ["File not found", false],
    ["author name is required", false],
    ["tokenize the input", false],
    ["Upload successful", false],
  ])("classifies %j as %s", (msg, expected) => {
    expect(isConfigurationError(msg)).toBe(expected);
  });
});

describe("DIAGNOSTIC_HINT", () => {
  it("contains get_status reference", () => {
    expect(DIAGNOSTIC_HINT).toContain("get_status");
  });
});

describe("authErrorResponse", () => {
  const error = new GoogleAuthError({
    code: "TOKEN_EXPIRED",
    reason: "Access token has expired",
    fix: ["Run: npx @dguido/google-workspace-mcp auth"],
  });

  it("includes get_status hint in text content", () => {
    const result = authErrorResponse(error);
    expect(result.content[0].text).toContain("get_status");
  });

  it("includes diagnostic_tool in structured content", () => {
    const result = authErrorResponse(error);
    expect(result.structuredContent).toMatchObject({
      diagnostic_tool: "get_status",
    });
  });

  it("preserves original error fields in structured content", () => {
    const result = authErrorResponse(error);
    expect(result.structuredContent).toMatchObject({
      error_code: "TOKEN_EXPIRED",
      reason: "Access token has expired",
      fix_steps: ["Run: npx @dguido/google-workspace-mcp auth"],
    });
  });

  it("sets isError to true", () => {
    const result = authErrorResponse(error);
    expect(result.isError).toBe(true);
  });
});
