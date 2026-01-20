import { describe, it, expect, vi, beforeEach } from "vitest";
import type { drive_v3, docs_v1 } from "googleapis";
import {
  handleCreateGoogleDoc,
  handleUpdateGoogleDoc,
  handleGetGoogleDocContent,
  handleAppendToDoc,
  handleFormatGoogleDocRange,
} from "./docs.js";

vi.mock("../utils/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/index.js")>();
  return {
    ...actual,
    log: vi.fn(),
    withTimeout: <T>(promise: Promise<T>) => promise,
  };
});

function createMockDrive(): drive_v3.Drive {
  return {
    files: {
      list: vi.fn(),
      create: vi.fn(),
      get: vi.fn(),
    },
  } as unknown as drive_v3.Drive;
}

function createMockDocs(): docs_v1.Docs {
  return {
    documents: {
      get: vi.fn(),
      batchUpdate: vi.fn(),
    },
  } as unknown as docs_v1.Docs;
}

describe("handleCreateGoogleDoc", () => {
  let mockDrive: drive_v3.Drive;
  let mockDocs: docs_v1.Docs;

  beforeEach(() => {
    mockDrive = createMockDrive();
    mockDocs = createMockDocs();
    vi.mocked(mockDrive.files.list).mockResolvedValue({
      data: { files: [] },
    } as never);
  });

  it("creates document successfully", async () => {
    vi.mocked(mockDrive.files.create).mockResolvedValue({
      data: {
        id: "doc123",
        name: "Test Doc",
        webViewLink: "https://docs.google.com/d/doc123",
      },
    } as never);
    vi.mocked(mockDocs.documents.batchUpdate).mockResolvedValue({} as never);

    const result = await handleCreateGoogleDoc(mockDrive, mockDocs, {
      name: "Test Doc",
      content: "Hello World",
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Created Google Doc");
  });

  it("returns error when document already exists", async () => {
    vi.mocked(mockDrive.files.list).mockResolvedValue({
      data: { files: [{ id: "existing123" }] },
    } as never);

    const result = await handleCreateGoogleDoc(mockDrive, mockDocs, {
      name: "Existing Doc",
      content: "Content",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("already exists");
  });

  it("returns error for empty name", async () => {
    const result = await handleCreateGoogleDoc(mockDrive, mockDocs, {
      name: "",
      content: "Content",
    });
    expect(result.isError).toBe(true);
  });
});

describe("handleUpdateGoogleDoc", () => {
  let mockDocs: docs_v1.Docs;

  beforeEach(() => {
    mockDocs = createMockDocs();
  });

  it("updates document successfully", async () => {
    vi.mocked(mockDocs.documents.get).mockResolvedValue({
      data: {
        title: "Test Doc",
        body: { content: [{ endIndex: 10 }] },
      },
    } as never);
    vi.mocked(mockDocs.documents.batchUpdate).mockResolvedValue({} as never);

    const result = await handleUpdateGoogleDoc(mockDocs, {
      documentId: "doc123",
      content: "New content",
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Updated Google Doc");
  });

  it("returns error for empty documentId", async () => {
    const result = await handleUpdateGoogleDoc(mockDocs, {
      documentId: "",
      content: "Content",
    });
    expect(result.isError).toBe(true);
  });
});

describe("handleGetGoogleDocContent", () => {
  let mockDrive: drive_v3.Drive;
  let mockDocs: docs_v1.Docs;

  beforeEach(() => {
    mockDrive = createMockDrive();
    mockDocs = createMockDocs();
    // Mock files.get to return correct MIME type
    vi.mocked(mockDrive.files.get).mockResolvedValue({
      data: {
        mimeType: "application/vnd.google-apps.document",
        name: "Test Doc",
      },
    } as never);
  });

  it("returns document content successfully", async () => {
    vi.mocked(mockDocs.documents.get).mockResolvedValue({
      data: {
        body: {
          content: [
            {
              paragraph: {
                elements: [{ textRun: { content: "Hello World" } }],
              },
            },
          ],
        },
      },
    } as never);

    const result = await handleGetGoogleDocContent(mockDrive, mockDocs, {
      documentId: "doc123",
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Hello World");
  });

  it("returns error for empty documentId", async () => {
    const result = await handleGetGoogleDocContent(mockDrive, mockDocs, {
      documentId: "",
    });
    expect(result.isError).toBe(true);
  });

  it("handles empty document", async () => {
    vi.mocked(mockDocs.documents.get).mockResolvedValue({
      data: { body: { content: [] } },
    } as never);

    const result = await handleGetGoogleDocContent(mockDrive, mockDocs, {
      documentId: "doc123",
    });
    expect(result.isError).toBe(false);
  });

  it("returns helpful error for file type mismatch", async () => {
    vi.mocked(mockDrive.files.get).mockResolvedValue({
      data: {
        mimeType: "application/vnd.google-apps.spreadsheet",
        name: "My Sheet",
      },
    } as never);

    const result = await handleGetGoogleDocContent(mockDrive, mockDocs, {
      documentId: "sheet123",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("is not a Google Doc");
    expect(result.content[0].text).toContain("Use getGoogleSheetContent");
  });
});

describe("handleAppendToDoc", () => {
  let mockDocs: docs_v1.Docs;

  beforeEach(() => {
    mockDocs = createMockDocs();
  });

  it("appends text to document successfully", async () => {
    vi.mocked(mockDocs.documents.get).mockResolvedValue({
      data: {
        title: "Test Doc",
        body: { content: [{ endIndex: 50 }] },
      },
    } as never);
    vi.mocked(mockDocs.documents.batchUpdate).mockResolvedValue({} as never);

    const result = await handleAppendToDoc(mockDocs, {
      documentId: "doc123",
      text: "Appended text",
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Appended");
    expect(result.content[0].text).toContain("13 characters");
  });

  it("appends text without newline", async () => {
    vi.mocked(mockDocs.documents.get).mockResolvedValue({
      data: {
        title: "Test Doc",
        body: { content: [{ endIndex: 50 }] },
      },
    } as never);
    vi.mocked(mockDocs.documents.batchUpdate).mockResolvedValue({} as never);

    const result = await handleAppendToDoc(mockDocs, {
      documentId: "doc123",
      text: "No newline",
      insertNewline: false,
    });
    expect(result.isError).toBe(false);
  });

  it("handles empty document", async () => {
    vi.mocked(mockDocs.documents.get).mockResolvedValue({
      data: {
        title: "Empty Doc",
        body: { content: [] },
      },
    } as never);
    vi.mocked(mockDocs.documents.batchUpdate).mockResolvedValue({} as never);

    const result = await handleAppendToDoc(mockDocs, {
      documentId: "doc123",
      text: "First content",
    });
    expect(result.isError).toBe(false);
  });

  it("returns error for empty documentId", async () => {
    const result = await handleAppendToDoc(mockDocs, {
      documentId: "",
      text: "Some text",
    });
    expect(result.isError).toBe(true);
  });

  it("returns error for empty text", async () => {
    const result = await handleAppendToDoc(mockDocs, {
      documentId: "doc123",
      text: "",
    });
    expect(result.isError).toBe(true);
  });
});

describe("handleFormatGoogleDocRange", () => {
  let mockDocs: docs_v1.Docs;

  beforeEach(() => {
    mockDocs = createMockDocs();
  });

  it("applies text formatting successfully", async () => {
    vi.mocked(mockDocs.documents.get).mockResolvedValue({
      data: { body: { content: [{ endIndex: 100 }] } },
    } as never);
    vi.mocked(mockDocs.documents.batchUpdate).mockResolvedValue({} as never);

    const result = await handleFormatGoogleDocRange(mockDocs, {
      documentId: "doc123",
      startIndex: 1,
      endIndex: 10,
      bold: true,
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Applied formatting");
    expect(result.content[0].text).toContain("bold");
  });

  it("applies paragraph formatting successfully", async () => {
    vi.mocked(mockDocs.documents.get).mockResolvedValue({
      data: { body: { content: [{ endIndex: 100 }] } },
    } as never);
    vi.mocked(mockDocs.documents.batchUpdate).mockResolvedValue({} as never);

    const result = await handleFormatGoogleDocRange(mockDocs, {
      documentId: "doc123",
      startIndex: 1,
      endIndex: 10,
      alignment: "CENTER",
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Applied formatting");
    expect(result.content[0].text).toContain("alignment");
  });

  it("applies combined text and paragraph formatting", async () => {
    vi.mocked(mockDocs.documents.get).mockResolvedValue({
      data: { body: { content: [{ endIndex: 100 }] } },
    } as never);
    vi.mocked(mockDocs.documents.batchUpdate).mockResolvedValue({} as never);

    const result = await handleFormatGoogleDocRange(mockDocs, {
      documentId: "doc123",
      startIndex: 1,
      endIndex: 10,
      bold: true,
      italic: true,
      alignment: "CENTER",
      namedStyleType: "HEADING_1",
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("bold");
    expect(result.content[0].text).toContain("italic");
    expect(result.content[0].text).toContain("alignment");
    expect(result.content[0].text).toContain("namedStyleType");
  });

  it("defaults to entire document when no range specified", async () => {
    vi.mocked(mockDocs.documents.get).mockResolvedValue({
      data: { body: { content: [{ endIndex: 50 }] } },
    } as never);
    vi.mocked(mockDocs.documents.batchUpdate).mockResolvedValue({} as never);

    const result = await handleFormatGoogleDocRange(mockDocs, {
      documentId: "doc123",
      bold: true,
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("1-50");
  });

  it("returns error when no formatting specified", async () => {
    vi.mocked(mockDocs.documents.get).mockResolvedValue({
      data: { body: { content: [{ endIndex: 100 }] } },
    } as never);

    const result = await handleFormatGoogleDocRange(mockDocs, {
      documentId: "doc123",
      startIndex: 1,
      endIndex: 10,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("No formatting options");
  });

  it("returns error for empty documentId", async () => {
    const result = await handleFormatGoogleDocRange(mockDocs, {
      documentId: "",
      bold: true,
    });
    expect(result.isError).toBe(true);
  });

  it("accepts all text formatting options", async () => {
    vi.mocked(mockDocs.documents.get).mockResolvedValue({
      data: { body: { content: [{ endIndex: 100 }] } },
    } as never);
    vi.mocked(mockDocs.documents.batchUpdate).mockResolvedValue({} as never);

    const result = await handleFormatGoogleDocRange(mockDocs, {
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
    expect(result.isError).toBe(false);
  });

  it("accepts all paragraph formatting options", async () => {
    vi.mocked(mockDocs.documents.get).mockResolvedValue({
      data: { body: { content: [{ endIndex: 100 }] } },
    } as never);
    vi.mocked(mockDocs.documents.batchUpdate).mockResolvedValue({} as never);

    const result = await handleFormatGoogleDocRange(mockDocs, {
      documentId: "doc123",
      startIndex: 1,
      endIndex: 10,
      namedStyleType: "HEADING_1",
      alignment: "CENTER",
      lineSpacing: 150,
      spaceAbove: 12,
      spaceBelow: 12,
    });
    expect(result.isError).toBe(false);
  });
});
