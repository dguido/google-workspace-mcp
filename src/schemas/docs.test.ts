import { describe, it, expect } from "vitest";
import {
  CreateGoogleDocSchema,
  UpdateGoogleDocSchema,
  GetGoogleDocContentSchema,
  FormatGoogleDocRangeSchema,
} from "./docs.js";

describe("CreateGoogleDocSchema", () => {
  it("accepts valid input", () => {
    const result = CreateGoogleDocSchema.safeParse({
      name: "My Doc",
      content: "Hello world",
    });
    expect(result.success).toBe(true);
  });

  it("accepts optional parentFolderId", () => {
    const result = CreateGoogleDocSchema.safeParse({
      name: "My Doc",
      content: "Hello",
      parentFolderId: "folder123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = CreateGoogleDocSchema.safeParse({
      name: "",
      content: "Hello",
    });
    expect(result.success).toBe(false);
  });
});

describe("UpdateGoogleDocSchema", () => {
  it("accepts valid input", () => {
    const result = UpdateGoogleDocSchema.safeParse({
      documentId: "doc123",
      content: "New content",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty documentId", () => {
    const result = UpdateGoogleDocSchema.safeParse({
      documentId: "",
      content: "content",
    });
    expect(result.success).toBe(false);
  });
});

describe("GetGoogleDocContentSchema", () => {
  it("accepts valid documentId", () => {
    const result = GetGoogleDocContentSchema.safeParse({
      documentId: "doc123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty documentId", () => {
    const result = GetGoogleDocContentSchema.safeParse({ documentId: "" });
    expect(result.success).toBe(false);
  });
});

describe("FormatGoogleDocRangeSchema", () => {
  it("accepts valid input with text formatting", () => {
    const result = FormatGoogleDocRangeSchema.safeParse({
      documentId: "doc123",
      startIndex: 1,
      endIndex: 10,
      bold: true,
    });
    expect(result.success).toBe(true);
  });

  it("accepts input without range (applies to entire document)", () => {
    const result = FormatGoogleDocRangeSchema.safeParse({
      documentId: "doc123",
      bold: true,
      italic: true,
    });
    expect(result.success).toBe(true);
  });

  it("accepts all text formatting options", () => {
    const result = FormatGoogleDocRangeSchema.safeParse({
      documentId: "doc123",
      startIndex: 1,
      endIndex: 10,
      bold: true,
      italic: true,
      underline: true,
      strikethrough: true,
      fontSize: 14,
      fontFamily: "Arial",
      foregroundColor: { red: 1, green: 0, blue: 0 },
    });
    expect(result.success).toBe(true);
  });

  it("accepts all paragraph formatting options", () => {
    const result = FormatGoogleDocRangeSchema.safeParse({
      documentId: "doc123",
      startIndex: 1,
      endIndex: 10,
      namedStyleType: "HEADING_1",
      alignment: "CENTER",
      lineSpacing: 150,
      spaceAbove: 12,
      spaceBelow: 12,
    });
    expect(result.success).toBe(true);
  });

  it("accepts combined text and paragraph formatting", () => {
    const result = FormatGoogleDocRangeSchema.safeParse({
      documentId: "doc123",
      startIndex: 1,
      endIndex: 10,
      bold: true,
      fontSize: 18,
      alignment: "CENTER",
      namedStyleType: "HEADING_1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty documentId", () => {
    const result = FormatGoogleDocRangeSchema.safeParse({
      documentId: "",
      bold: true,
    });
    expect(result.success).toBe(false);
  });

  it("rejects startIndex less than 1", () => {
    const result = FormatGoogleDocRangeSchema.safeParse({
      documentId: "doc123",
      startIndex: 0,
      endIndex: 10,
      bold: true,
    });
    expect(result.success).toBe(false);
  });

  it("rejects color values outside 0-1 range", () => {
    const result = FormatGoogleDocRangeSchema.safeParse({
      documentId: "doc123",
      foregroundColor: { red: 2 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid alignment", () => {
    const result = FormatGoogleDocRangeSchema.safeParse({
      documentId: "doc123",
      alignment: "INVALID",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid namedStyleType", () => {
    const result = FormatGoogleDocRangeSchema.safeParse({
      documentId: "doc123",
      namedStyleType: "INVALID",
    });
    expect(result.success).toBe(false);
  });
});
