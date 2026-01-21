import { describe, it, expect, vi, beforeEach } from "vitest";
import type { drive_v3, docs_v1, sheets_v4, slides_v1 } from "googleapis";
import { handleCreateFile, handleUpdateFile, handleGetFileContent } from "./unified.js";

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
      update: vi.fn(),
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

function createMockSheets(): sheets_v4.Sheets {
  return {
    spreadsheets: {
      create: vi.fn(),
      get: vi.fn(),
      values: {
        get: vi.fn(),
        update: vi.fn(),
      },
    },
  } as unknown as sheets_v4.Sheets;
}

function createMockSlides(): slides_v1.Slides {
  return {
    presentations: {
      create: vi.fn(),
      get: vi.fn(),
      batchUpdate: vi.fn(),
    },
  } as unknown as slides_v1.Slides;
}

describe("handleCreateFile", () => {
  let mockDrive: drive_v3.Drive;
  let mockDocs: docs_v1.Docs;
  let mockSheets: sheets_v4.Sheets;
  let mockSlides: slides_v1.Slides;

  beforeEach(() => {
    mockDrive = createMockDrive();
    mockDocs = createMockDocs();
    mockSheets = createMockSheets();
    mockSlides = createMockSlides();
    vi.mocked(mockDrive.files.list).mockResolvedValue({
      data: { files: [] },
    } as never);
  });

  it("creates Google Doc from string content", async () => {
    vi.mocked(mockDrive.files.create).mockResolvedValue({
      data: { id: "doc123", name: "Test Doc" },
    } as never);
    vi.mocked(mockDocs.documents.batchUpdate).mockResolvedValue({} as never);

    const result = await handleCreateFile(mockDrive, mockDocs, mockSheets, mockSlides, {
      name: "Test Doc.gdoc",
      content: "Hello World",
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Created Google Doc");
  });

  it("creates Google Sheet from 2D array", async () => {
    vi.mocked(mockSheets.spreadsheets.create).mockResolvedValue({
      data: { spreadsheetId: "sheet123", spreadsheetUrl: "https://..." },
    } as never);
    vi.mocked(mockDrive.files.update).mockResolvedValue({} as never);
    vi.mocked(mockSheets.spreadsheets.values.update).mockResolvedValue({} as never);

    const result = await handleCreateFile(mockDrive, mockDocs, mockSheets, mockSlides, {
      name: "Test Sheet.gsheet",
      content: [
        ["A1", "B1"],
        ["A2", "B2"],
      ],
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Created Google Sheet");
  });

  it("creates text file from string content", async () => {
    vi.mocked(mockDrive.files.create).mockResolvedValue({
      data: { id: "txt123", name: "test.txt" },
    } as never);

    const result = await handleCreateFile(mockDrive, mockDocs, mockSheets, mockSlides, {
      name: "test.txt",
      content: "Plain text content",
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Created text file");
  });

  it("creates markdown file", async () => {
    vi.mocked(mockDrive.files.create).mockResolvedValue({
      data: { id: "md123", name: "README.md" },
    } as never);

    const result = await handleCreateFile(mockDrive, mockDocs, mockSheets, mockSlides, {
      name: "README.md",
      content: "# Title",
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Created text file");
  });

  it("returns error for empty name", async () => {
    const result = await handleCreateFile(mockDrive, mockDocs, mockSheets, mockSlides, {
      name: "",
      content: "Content",
    });
    expect(result.isError).toBe(true);
  });

  it("uses explicit type parameter", async () => {
    vi.mocked(mockSheets.spreadsheets.create).mockResolvedValue({
      data: { spreadsheetId: "sheet123", spreadsheetUrl: "https://..." },
    } as never);
    vi.mocked(mockDrive.files.update).mockResolvedValue({} as never);
    vi.mocked(mockSheets.spreadsheets.values.update).mockResolvedValue({} as never);

    const result = await handleCreateFile(mockDrive, mockDocs, mockSheets, mockSlides, {
      name: "data",
      content: [
        ["A1", "B1"],
        ["A2", "B2"],
      ],
      type: "sheet",
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Created Google Sheet");
  });

  it("returns error for invalid sheet content format", async () => {
    const result = await handleCreateFile(mockDrive, mockDocs, mockSheets, mockSlides, {
      name: "data.gsheet",
      content: { invalid: "format" },
      type: "sheet",
    });
    expect(result.isError).toBe(true);
  });

  it("creates slides presentation", async () => {
    vi.mocked(mockSlides.presentations.create).mockResolvedValue({
      data: { presentationId: "slides123" },
    } as never);
    vi.mocked(mockDrive.files.update).mockResolvedValue({} as never);
    vi.mocked(mockSlides.presentations.batchUpdate).mockResolvedValue({} as never);

    const result = await handleCreateFile(mockDrive, mockDocs, mockSheets, mockSlides, {
      name: "My Presentation.gslides",
      content: [{ title: "Slide 1", content: "Content" }],
      type: "slides",
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Created Google Slides");
  });
});

describe("handleUpdateFile", () => {
  let mockDrive: drive_v3.Drive;
  let mockDocs: docs_v1.Docs;
  let mockSheets: sheets_v4.Sheets;
  let mockSlides: slides_v1.Slides;

  beforeEach(() => {
    mockDrive = createMockDrive();
    mockDocs = createMockDocs();
    mockSheets = createMockSheets();
    mockSlides = createMockSlides();
    vi.mocked(mockDrive.files.list).mockResolvedValue({
      data: { files: [] },
    } as never);
  });

  it("updates Google Doc successfully", async () => {
    vi.mocked(mockDrive.files.get).mockResolvedValue({
      data: {
        name: "Test Doc",
        mimeType: "application/vnd.google-apps.document",
      },
    } as never);
    vi.mocked(mockDocs.documents.get).mockResolvedValue({
      data: { body: { content: [{ endIndex: 10 }] } },
    } as never);
    vi.mocked(mockDocs.documents.batchUpdate).mockResolvedValue({} as never);

    const result = await handleUpdateFile(mockDrive, mockDocs, mockSheets, mockSlides, {
      fileId: "doc123",
      content: "New content",
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Updated Google Doc");
  });

  it("updates Google Sheet successfully", async () => {
    vi.mocked(mockDrive.files.get).mockResolvedValue({
      data: {
        name: "Test Sheet",
        mimeType: "application/vnd.google-apps.spreadsheet",
      },
    } as never);
    vi.mocked(mockSheets.spreadsheets.values.update).mockResolvedValue({} as never);

    const result = await handleUpdateFile(mockDrive, mockDocs, mockSheets, mockSlides, {
      fileId: "sheet123",
      content: [
        ["A1", "B1"],
        ["A2", "B2"],
      ],
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Updated Google Sheet");
  });

  it("updates text file successfully", async () => {
    vi.mocked(mockDrive.files.get).mockResolvedValue({
      data: { name: "test.txt", mimeType: "text/plain" },
    } as never);
    vi.mocked(mockDrive.files.update).mockResolvedValue({} as never);

    const result = await handleUpdateFile(mockDrive, mockDocs, mockSheets, mockSlides, {
      fileId: "txt123",
      content: "Updated content",
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Updated text file");
  });

  it("returns error for slides update", async () => {
    vi.mocked(mockDrive.files.get).mockResolvedValue({
      data: {
        name: "Test Slides",
        mimeType: "application/vnd.google-apps.presentation",
      },
    } as never);

    const result = await handleUpdateFile(mockDrive, mockDocs, mockSheets, mockSlides, {
      fileId: "slides123",
      content: "New content",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("updateGoogleSlides");
  });

  it("returns error for binary file", async () => {
    vi.mocked(mockDrive.files.get).mockResolvedValue({
      data: { name: "image.png", mimeType: "image/png" },
    } as never);

    const result = await handleUpdateFile(mockDrive, mockDocs, mockSheets, mockSlides, {
      fileId: "img123",
      content: "Can't update binary",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Cannot update binary file");
  });

  it("returns error for empty fileId", async () => {
    const result = await handleUpdateFile(mockDrive, mockDocs, mockSheets, mockSlides, {
      fileId: "",
      content: "content",
    });
    expect(result.isError).toBe(true);
  });

  it("uses custom range for sheet update", async () => {
    vi.mocked(mockDrive.files.get).mockResolvedValue({
      data: {
        name: "Test Sheet",
        mimeType: "application/vnd.google-apps.spreadsheet",
      },
    } as never);
    vi.mocked(mockSheets.spreadsheets.values.update).mockResolvedValue({} as never);

    const result = await handleUpdateFile(mockDrive, mockDocs, mockSheets, mockSlides, {
      fileId: "sheet123",
      content: [["X"]],
      range: "Sheet2!B5",
    });
    expect(result.isError).toBe(false);
  });
});

describe("handleGetFileContent", () => {
  let mockDrive: drive_v3.Drive;
  let mockDocs: docs_v1.Docs;
  let mockSheets: sheets_v4.Sheets;
  let mockSlides: slides_v1.Slides;

  beforeEach(() => {
    mockDrive = createMockDrive();
    mockDocs = createMockDocs();
    mockSheets = createMockSheets();
    mockSlides = createMockSlides();
    vi.mocked(mockDrive.files.list).mockResolvedValue({
      data: { files: [] },
    } as never);
  });

  it("gets Google Doc content successfully", async () => {
    vi.mocked(mockDrive.files.get).mockResolvedValue({
      data: {
        name: "Test Doc",
        mimeType: "application/vnd.google-apps.document",
        modifiedTime: "2024-01-01T00:00:00.000Z",
      },
    } as never);
    vi.mocked(mockDocs.documents.get).mockResolvedValue({
      data: {
        title: "Test Doc",
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

    const result = await handleGetFileContent(mockDrive, mockDocs, mockSheets, mockSlides, {
      fileId: "doc123",
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Hello World");
  });

  it("gets Google Sheet content successfully", async () => {
    vi.mocked(mockDrive.files.get).mockResolvedValue({
      data: {
        name: "Test Sheet",
        mimeType: "application/vnd.google-apps.spreadsheet",
        modifiedTime: "2024-01-01T00:00:00.000Z",
      },
    } as never);
    vi.mocked(mockSheets.spreadsheets.values.get).mockResolvedValue({
      data: {
        values: [
          ["A1", "B1"],
          ["A2", "B2"],
        ],
        range: "Sheet1!A:ZZ",
      },
    } as never);

    const result = await handleGetFileContent(mockDrive, mockDocs, mockSheets, mockSlides, {
      fileId: "sheet123",
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Test Sheet");
  });

  it("gets Google Slides content successfully", async () => {
    vi.mocked(mockDrive.files.get).mockResolvedValue({
      data: {
        name: "Test Slides",
        mimeType: "application/vnd.google-apps.presentation",
        modifiedTime: "2024-01-01T00:00:00.000Z",
      },
    } as never);
    vi.mocked(mockSlides.presentations.get).mockResolvedValue({
      data: {
        title: "Test Slides",
        slides: [
          {
            objectId: "slide1",
            pageElements: [
              {
                shape: {
                  text: {
                    textElements: [{ textRun: { content: "Title" } }],
                  },
                },
              },
            ],
          },
        ],
      },
    } as never);

    const result = await handleGetFileContent(mockDrive, mockDocs, mockSheets, mockSlides, {
      fileId: "slides123",
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Slides: 1");
  });

  it("gets text file content successfully", async () => {
    vi.mocked(mockDrive.files.get)
      .mockResolvedValueOnce({
        data: {
          name: "test.txt",
          mimeType: "text/plain",
          modifiedTime: "2024-01-01T00:00:00.000Z",
          size: "100",
        },
      } as never)
      .mockResolvedValueOnce({ data: "Plain text content" } as never);

    const result = await handleGetFileContent(mockDrive, mockDocs, mockSheets, mockSlides, {
      fileId: "txt123",
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Plain text content");
  });

  it("returns error for binary file", async () => {
    vi.mocked(mockDrive.files.get).mockResolvedValue({
      data: { name: "image.png", mimeType: "image/png" },
    } as never);

    const result = await handleGetFileContent(mockDrive, mockDocs, mockSheets, mockSlides, {
      fileId: "img123",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Cannot read binary file");
  });

  it("returns error for empty fileId", async () => {
    const result = await handleGetFileContent(mockDrive, mockDocs, mockSheets, mockSlides, {
      fileId: "",
    });
    expect(result.isError).toBe(true);
  });

  it("uses custom range for sheet content", async () => {
    vi.mocked(mockDrive.files.get).mockResolvedValue({
      data: {
        name: "Test Sheet",
        mimeType: "application/vnd.google-apps.spreadsheet",
      },
    } as never);
    vi.mocked(mockSheets.spreadsheets.values.get).mockResolvedValue({
      data: { values: [["X"]], range: "Sheet1!A1:B2" },
    } as never);

    const result = await handleGetFileContent(mockDrive, mockDocs, mockSheets, mockSlides, {
      fileId: "sheet123",
      range: "A1:B2",
    });
    expect(result.isError).toBe(false);
  });
});
