import { describe, it, expect, vi, beforeEach } from "vitest";
import type { drive_v3, sheets_v4 } from "googleapis";
import {
  handleCreateGoogleSheet,
  handleUpdateGoogleSheet,
  handleGetGoogleSheetContent,
  handleFormatGoogleSheetCells,
  handleMergeGoogleSheetCells,
  handleAddGoogleSheetConditionalFormat,
  handleCreateSheetTab,
  handleDeleteSheetTab,
  handleRenameSheetTab,
} from "./sheets.js";

vi.mock("../utils/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/index.js")>();
  return {
    ...actual,
    log: vi.fn(),
    withTimeout: <T>(promise: Promise<T>) => promise,
  };
});

vi.mock("../utils/sheetCache.js", () => ({
  getCachedSheetMetadata: vi.fn(() => undefined),
  setCachedSheetMetadata: vi.fn(),
  clearSheetCache: vi.fn(),
}));

function createMockDrive(): drive_v3.Drive {
  return {
    files: {
      list: vi.fn(),
      update: vi.fn(),
      get: vi.fn(),
    },
  } as unknown as drive_v3.Drive;
}

function createMockSheets(): sheets_v4.Sheets {
  return {
    spreadsheets: {
      create: vi.fn(),
      get: vi.fn(),
      batchUpdate: vi.fn(),
      values: {
        update: vi.fn(),
        get: vi.fn(),
      },
    },
  } as unknown as sheets_v4.Sheets;
}

describe("handleCreateGoogleSheet", () => {
  let mockDrive: drive_v3.Drive;
  let mockSheets: sheets_v4.Sheets;

  beforeEach(() => {
    mockDrive = createMockDrive();
    mockSheets = createMockSheets();
    vi.mocked(mockDrive.files.list).mockResolvedValue({
      data: { files: [] },
    } as never);
  });

  it("creates spreadsheet successfully", async () => {
    vi.mocked(mockSheets.spreadsheets.create).mockResolvedValue({
      data: { spreadsheetId: "sheet123" },
    } as never);
    vi.mocked(mockDrive.files.update).mockResolvedValue({} as never);
    vi.mocked(mockSheets.spreadsheets.values.update).mockResolvedValue(
      {} as never,
    );

    const result = await handleCreateGoogleSheet(mockDrive, mockSheets, {
      name: "Test Sheet",
      data: [
        ["A1", "B1"],
        ["A2", "B2"],
      ],
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Created Google Sheet");
  });

  it("returns error when sheet already exists", async () => {
    vi.mocked(mockDrive.files.list).mockResolvedValue({
      data: { files: [{ id: "existing123" }] },
    } as never);

    const result = await handleCreateGoogleSheet(mockDrive, mockSheets, {
      name: "Existing Sheet",
      data: [[]],
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("already exists");
  });

  it("returns error for empty name", async () => {
    const result = await handleCreateGoogleSheet(mockDrive, mockSheets, {
      name: "",
      data: [[]],
    });
    expect(result.isError).toBe(true);
  });
});

describe("handleUpdateGoogleSheet", () => {
  let mockSheets: sheets_v4.Sheets;

  beforeEach(() => {
    mockSheets = createMockSheets();
  });

  it("updates spreadsheet successfully", async () => {
    vi.mocked(mockSheets.spreadsheets.values.update).mockResolvedValue(
      {} as never,
    );

    const result = await handleUpdateGoogleSheet(mockSheets, {
      spreadsheetId: "sheet123",
      range: "A1:B2",
      data: [["New", "Data"]],
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Updated Google Sheet");
  });

  it("returns error for empty spreadsheetId", async () => {
    const result = await handleUpdateGoogleSheet(mockSheets, {
      spreadsheetId: "",
      range: "A1",
      data: [[]],
    });
    expect(result.isError).toBe(true);
  });
});

describe("handleGetGoogleSheetContent", () => {
  let mockDrive: drive_v3.Drive;
  let mockSheets: sheets_v4.Sheets;

  beforeEach(() => {
    mockDrive = createMockDrive();
    mockSheets = createMockSheets();
    // Mock files.get to return correct MIME type
    vi.mocked(mockDrive.files.get).mockResolvedValue({
      data: {
        mimeType: "application/vnd.google-apps.spreadsheet",
        name: "Test Sheet",
      },
    } as never);
  });

  it("returns content successfully", async () => {
    vi.mocked(mockSheets.spreadsheets.values.get).mockResolvedValue({
      data: {
        values: [
          ["A1", "B1"],
          ["A2", "B2"],
        ],
      },
    } as never);

    const result = await handleGetGoogleSheetContent(mockDrive, mockSheets, {
      spreadsheetId: "sheet123",
      range: "A1:B2",
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("A1");
  });

  it("handles empty range", async () => {
    vi.mocked(mockSheets.spreadsheets.values.get).mockResolvedValue({
      data: { values: undefined },
    } as never);

    const result = await handleGetGoogleSheetContent(mockDrive, mockSheets, {
      spreadsheetId: "sheet123",
      range: "A1:A1",
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("empty range");
  });

  it("returns helpful error for file type mismatch", async () => {
    vi.mocked(mockDrive.files.get).mockResolvedValue({
      data: {
        mimeType: "application/vnd.google-apps.document",
        name: "My Doc",
      },
    } as never);

    const result = await handleGetGoogleSheetContent(mockDrive, mockSheets, {
      spreadsheetId: "doc123",
      range: "A1:A1",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("is not a Google Sheet");
    expect(result.content[0].text).toContain("Use getGoogleDocContent");
  });

  it("uses first sheet name when range is not provided", async () => {
    vi.mocked(mockSheets.spreadsheets.get).mockResolvedValue({
      data: { sheets: [{ properties: { title: "CustomSheet" } }] },
    } as never);
    vi.mocked(mockSheets.spreadsheets.values.get).mockResolvedValue({
      data: {
        values: [["A1", "B1"]],
      },
    } as never);

    const result = await handleGetGoogleSheetContent(mockDrive, mockSheets, {
      spreadsheetId: "sheet123",
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Content for range CustomSheet");

    // Verify the Sheets API was called with the first sheet name
    expect(mockSheets.spreadsheets.values.get).toHaveBeenCalledWith({
      spreadsheetId: "sheet123",
      range: "CustomSheet",
    });
  });

  it("falls back to Sheet1 when no sheets are returned", async () => {
    vi.mocked(mockSheets.spreadsheets.get).mockResolvedValue({
      data: { sheets: [] },
    } as never);
    vi.mocked(mockSheets.spreadsheets.values.get).mockResolvedValue({
      data: {
        values: [["A1"]],
      },
    } as never);

    const result = await handleGetGoogleSheetContent(mockDrive, mockSheets, {
      spreadsheetId: "sheet123",
    });
    expect(result.isError).toBe(false);

    expect(mockSheets.spreadsheets.values.get).toHaveBeenCalledWith({
      spreadsheetId: "sheet123",
      range: "Sheet1",
    });
  });
});

describe("handleFormatGoogleSheetCells", () => {
  let mockSheets: sheets_v4.Sheets;

  beforeEach(() => {
    mockSheets = createMockSheets();
    vi.mocked(mockSheets.spreadsheets.get).mockResolvedValue({
      data: { sheets: [{ properties: { sheetId: 0, title: "Sheet1" } }] },
    } as never);
  });

  it("formats cells with background color", async () => {
    vi.mocked(mockSheets.spreadsheets.batchUpdate).mockResolvedValue(
      {} as never,
    );

    const result = await handleFormatGoogleSheetCells(mockSheets, {
      spreadsheetId: "sheet123",
      range: "Sheet1!A1:B2",
      backgroundColor: { red: 1, green: 0, blue: 0 },
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Formatted cells");
    expect(result.content[0].text).toContain("cell");
  });

  it("formats cells with text formatting", async () => {
    vi.mocked(mockSheets.spreadsheets.batchUpdate).mockResolvedValue(
      {} as never,
    );

    const result = await handleFormatGoogleSheetCells(mockSheets, {
      spreadsheetId: "sheet123",
      range: "Sheet1!A1:B2",
      bold: true,
      italic: true,
      fontSize: 14,
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Formatted cells");
    expect(result.content[0].text).toContain("text");
  });

  it("formats cells with number formatting", async () => {
    vi.mocked(mockSheets.spreadsheets.batchUpdate).mockResolvedValue(
      {} as never,
    );

    const result = await handleFormatGoogleSheetCells(mockSheets, {
      spreadsheetId: "sheet123",
      range: "Sheet1!A1:A10",
      numberFormat: { pattern: "$#,##0.00", type: "CURRENCY" },
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Formatted cells");
    expect(result.content[0].text).toContain("number");
  });

  it("formats cells with borders", async () => {
    vi.mocked(mockSheets.spreadsheets.batchUpdate).mockResolvedValue(
      {} as never,
    );

    const result = await handleFormatGoogleSheetCells(mockSheets, {
      spreadsheetId: "sheet123",
      range: "Sheet1!A1:B2",
      borders: { style: "SOLID", width: 2 },
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Formatted cells");
    expect(result.content[0].text).toContain("borders");
  });

  it("formats cells with multiple options combined", async () => {
    vi.mocked(mockSheets.spreadsheets.batchUpdate).mockResolvedValue(
      {} as never,
    );

    const result = await handleFormatGoogleSheetCells(mockSheets, {
      spreadsheetId: "sheet123",
      range: "Sheet1!A1:B2",
      backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 },
      bold: true,
      horizontalAlignment: "CENTER",
      borders: { style: "SOLID" },
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Formatted cells");
  });

  it("returns error when no formatting options specified", async () => {
    const result = await handleFormatGoogleSheetCells(mockSheets, {
      spreadsheetId: "sheet123",
      range: "Sheet1!A1:B2",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("No formatting options");
  });

  it("returns error when sheet not found", async () => {
    vi.mocked(mockSheets.spreadsheets.get).mockResolvedValue({
      data: { sheets: [] },
    } as never);

    const result = await handleFormatGoogleSheetCells(mockSheets, {
      spreadsheetId: "sheet123",
      range: "NonExistent!A1",
      backgroundColor: { red: 1 },
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });
});

describe("handleMergeGoogleSheetCells", () => {
  let mockSheets: sheets_v4.Sheets;

  beforeEach(() => {
    mockSheets = createMockSheets();
    vi.mocked(mockSheets.spreadsheets.get).mockResolvedValue({
      data: { sheets: [{ properties: { sheetId: 0, title: "Sheet1" } }] },
    } as never);
  });

  it("merges cells successfully", async () => {
    vi.mocked(mockSheets.spreadsheets.batchUpdate).mockResolvedValue(
      {} as never,
    );

    const result = await handleMergeGoogleSheetCells(mockSheets, {
      spreadsheetId: "sheet123",
      range: "A1:B2",
      mergeType: "MERGE_ALL",
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Merged cells");
  });
});

describe("handleAddGoogleSheetConditionalFormat", () => {
  let mockSheets: sheets_v4.Sheets;

  beforeEach(() => {
    mockSheets = createMockSheets();
    vi.mocked(mockSheets.spreadsheets.get).mockResolvedValue({
      data: { sheets: [{ properties: { sheetId: 0, title: "Sheet1" } }] },
    } as never);
  });

  it("adds conditional format successfully", async () => {
    vi.mocked(mockSheets.spreadsheets.batchUpdate).mockResolvedValue(
      {} as never,
    );

    const result = await handleAddGoogleSheetConditionalFormat(mockSheets, {
      spreadsheetId: "sheet123",
      range: "A1:A10",
      condition: { type: "NUMBER_GREATER", value: "100" },
      format: { backgroundColor: { red: 1, green: 0, blue: 0 } },
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Added conditional formatting");
  });
});

describe("handleCreateSheetTab", () => {
  let mockSheets: sheets_v4.Sheets;

  beforeEach(() => {
    mockSheets = createMockSheets();
  });

  it("creates sheet tab successfully", async () => {
    // Sheet doesn't exist yet
    vi.mocked(mockSheets.spreadsheets.get).mockResolvedValue({
      data: { sheets: [{ properties: { sheetId: 0, title: "Sheet1" } }] },
    } as never);
    vi.mocked(mockSheets.spreadsheets.batchUpdate).mockResolvedValue({
      data: { replies: [{ addSheet: { properties: { sheetId: 123 } } }] },
    } as never);

    const result = await handleCreateSheetTab(mockSheets, {
      spreadsheetId: "sheet123",
      title: "NewTab",
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Created new sheet tab");
    expect(result.content[0].text).toContain("NewTab");
  });

  it("creates sheet tab at specific index", async () => {
    vi.mocked(mockSheets.spreadsheets.get).mockResolvedValue({
      data: { sheets: [{ properties: { sheetId: 0, title: "Sheet1" } }] },
    } as never);
    vi.mocked(mockSheets.spreadsheets.batchUpdate).mockResolvedValue({
      data: { replies: [{ addSheet: { properties: { sheetId: 123 } } }] },
    } as never);

    const result = await handleCreateSheetTab(mockSheets, {
      spreadsheetId: "sheet123",
      title: "NewTab",
      index: 0,
    });
    expect(result.isError).toBe(false);
  });

  it("returns error when tab already exists", async () => {
    vi.mocked(mockSheets.spreadsheets.get).mockResolvedValue({
      data: { sheets: [{ properties: { sheetId: 0, title: "ExistingTab" } }] },
    } as never);

    const result = await handleCreateSheetTab(mockSheets, {
      spreadsheetId: "sheet123",
      title: "ExistingTab",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("already exists");
  });

  it("returns error for empty spreadsheetId", async () => {
    const result = await handleCreateSheetTab(mockSheets, {
      spreadsheetId: "",
      title: "NewTab",
    });
    expect(result.isError).toBe(true);
  });

  it("returns error for empty title", async () => {
    const result = await handleCreateSheetTab(mockSheets, {
      spreadsheetId: "sheet123",
      title: "",
    });
    expect(result.isError).toBe(true);
  });
});

describe("handleDeleteSheetTab", () => {
  let mockSheets: sheets_v4.Sheets;

  beforeEach(() => {
    mockSheets = createMockSheets();
  });

  it("deletes sheet tab successfully", async () => {
    vi.mocked(mockSheets.spreadsheets.get).mockResolvedValue({
      data: {
        sheets: [
          { properties: { sheetId: 0, title: "Sheet1" } },
          { properties: { sheetId: 1, title: "ToDelete" } },
        ],
      },
    } as never);
    vi.mocked(mockSheets.spreadsheets.batchUpdate).mockResolvedValue(
      {} as never,
    );

    const result = await handleDeleteSheetTab(mockSheets, {
      spreadsheetId: "sheet123",
      sheetTitle: "ToDelete",
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Deleted sheet tab");
  });

  it("returns error when tab not found", async () => {
    vi.mocked(mockSheets.spreadsheets.get).mockResolvedValue({
      data: { sheets: [{ properties: { sheetId: 0, title: "Sheet1" } }] },
    } as never);

    const result = await handleDeleteSheetTab(mockSheets, {
      spreadsheetId: "sheet123",
      sheetTitle: "NonExistent",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });

  it("returns error when trying to delete last sheet", async () => {
    vi.mocked(mockSheets.spreadsheets.get).mockResolvedValue({
      data: { sheets: [{ properties: { sheetId: 0, title: "LastSheet" } }] },
    } as never);
    vi.mocked(mockSheets.spreadsheets.batchUpdate).mockRejectedValue(
      new Error("Cannot delete the last sheet"),
    );

    const result = await handleDeleteSheetTab(mockSheets, {
      spreadsheetId: "sheet123",
      sheetTitle: "LastSheet",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("at least one sheet");
  });

  it("returns error for empty spreadsheetId", async () => {
    const result = await handleDeleteSheetTab(mockSheets, {
      spreadsheetId: "",
      sheetTitle: "Sheet1",
    });
    expect(result.isError).toBe(true);
  });
});

describe("handleRenameSheetTab", () => {
  let mockSheets: sheets_v4.Sheets;

  beforeEach(() => {
    mockSheets = createMockSheets();
  });

  it("renames sheet tab successfully", async () => {
    vi.mocked(mockSheets.spreadsheets.get).mockResolvedValue({
      data: { sheets: [{ properties: { sheetId: 0, title: "OldName" } }] },
    } as never);
    vi.mocked(mockSheets.spreadsheets.batchUpdate).mockResolvedValue(
      {} as never,
    );

    const result = await handleRenameSheetTab(mockSheets, {
      spreadsheetId: "sheet123",
      currentTitle: "OldName",
      newTitle: "NewName",
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Renamed sheet tab");
    expect(result.content[0].text).toContain("OldName");
    expect(result.content[0].text).toContain("NewName");
  });

  it("returns error when source tab not found", async () => {
    vi.mocked(mockSheets.spreadsheets.get).mockResolvedValue({
      data: { sheets: [{ properties: { sheetId: 0, title: "Sheet1" } }] },
    } as never);

    const result = await handleRenameSheetTab(mockSheets, {
      spreadsheetId: "sheet123",
      currentTitle: "NonExistent",
      newTitle: "NewName",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });

  it("returns error when target name already exists", async () => {
    vi.mocked(mockSheets.spreadsheets.get).mockResolvedValue({
      data: {
        sheets: [
          { properties: { sheetId: 0, title: "OldName" } },
          { properties: { sheetId: 1, title: "ExistingName" } },
        ],
      },
    } as never);

    const result = await handleRenameSheetTab(mockSheets, {
      spreadsheetId: "sheet123",
      currentTitle: "OldName",
      newTitle: "ExistingName",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("already exists");
  });

  it("returns error for empty spreadsheetId", async () => {
    const result = await handleRenameSheetTab(mockSheets, {
      spreadsheetId: "",
      currentTitle: "OldName",
      newTitle: "NewName",
    });
    expect(result.isError).toBe(true);
  });

  it("returns error for empty currentTitle", async () => {
    const result = await handleRenameSheetTab(mockSheets, {
      spreadsheetId: "sheet123",
      currentTitle: "",
      newTitle: "NewName",
    });
    expect(result.isError).toBe(true);
  });

  it("returns error for empty newTitle", async () => {
    const result = await handleRenameSheetTab(mockSheets, {
      spreadsheetId: "sheet123",
      currentTitle: "OldName",
      newTitle: "",
    });
    expect(result.isError).toBe(true);
  });
});
