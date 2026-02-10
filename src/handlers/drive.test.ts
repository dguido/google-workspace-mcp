import { describe, it, expect, vi, beforeEach } from "vitest";
import type { drive_v3 } from "googleapis";
import {
  handleSearch,
  handleCreateTextFile,
  handleUpdateTextFile,
  handleCreateFolder,
  handleListFolder,
  handleDeleteItem,
  handleRenameItem,
  handleMoveItem,
  handleCopyFile,
  handleGetFileMetadata,
  handleExportFile,
  handleShareFile,
  handleGetSharing,
  handleListRevisions,
  handleRestoreRevision,
  handleDownloadFile,
  handleUploadFile,
  handleGetStorageQuota,
  handleStarFile,
  handleBatchRestore,
  handleRestoreFromTrash,
  handleResolveFilePath,
  handleGetFolderTree,
  handleBatchMove,
} from "./drive.js";

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
      copy: vi.fn(),
      export: vi.fn(),
    },
    permissions: {
      create: vi.fn(),
      list: vi.fn(),
    },
    revisions: {
      list: vi.fn(),
      get: vi.fn(),
    },
    about: {
      get: vi.fn(),
    },
  } as unknown as drive_v3.Drive;
}

describe("handleSearch", () => {
  let mockDrive: drive_v3.Drive;

  beforeEach(() => {
    mockDrive = createMockDrive();
  });

  it("returns success with search results", async () => {
    vi.mocked(mockDrive.files.list).mockResolvedValue({
      data: {
        files: [
          { name: "file1.txt", mimeType: "text/plain" },
          { name: "file2.md", mimeType: "text/markdown" },
        ],
      },
    } as never);

    const result = await handleSearch(mockDrive, { query: "test" });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Found 2 files");
  });

  it("returns error for invalid input", async () => {
    const result = await handleSearch(mockDrive, { query: "" });
    expect(result.isError).toBe(true);
  });

  it("handles API errors", async () => {
    vi.mocked(mockDrive.files.list).mockRejectedValue(new Error("API Error"));

    await expect(handleSearch(mockDrive, { query: "test" })).rejects.toThrow("API Error");
  });
});

describe("handleCreateTextFile", () => {
  let mockDrive: drive_v3.Drive;

  beforeEach(() => {
    mockDrive = createMockDrive();
    // Default: file doesn't exist
    vi.mocked(mockDrive.files.list).mockResolvedValue({
      data: { files: [] },
    } as never);
  });

  it("creates text file successfully", async () => {
    vi.mocked(mockDrive.files.create).mockResolvedValue({
      data: { id: "file123", name: "test.txt" },
    } as never);

    const result = await handleCreateTextFile(mockDrive, {
      name: "test.txt",
      content: "Hello",
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Created file");
  });

  it("throws error for invalid extension", async () => {
    await expect(
      handleCreateTextFile(mockDrive, {
        name: "test.pdf",
        content: "Hello",
      }),
    ).rejects.toThrow(".txt or .md");
  });

  it("returns error when file already exists", async () => {
    vi.mocked(mockDrive.files.list).mockResolvedValue({
      data: { files: [{ id: "existing123" }] },
    } as never);

    const result = await handleCreateTextFile(mockDrive, {
      name: "test.txt",
      content: "Hello",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("already exists");
  });
});

describe("handleUpdateTextFile", () => {
  let mockDrive: drive_v3.Drive;

  beforeEach(() => {
    mockDrive = createMockDrive();
  });

  it("updates text file successfully", async () => {
    vi.mocked(mockDrive.files.get).mockResolvedValue({
      data: { mimeType: "text/plain", name: "test.txt" },
    } as never);
    vi.mocked(mockDrive.files.update).mockResolvedValue({
      data: { name: "test.txt", modifiedTime: "2024-01-01" },
    } as never);

    const result = await handleUpdateTextFile(mockDrive, {
      fileId: "file123",
      content: "New content",
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Updated file");
  });

  it("returns error for non-text file", async () => {
    vi.mocked(mockDrive.files.get).mockResolvedValue({
      data: { mimeType: "application/pdf", name: "test.pdf" },
    } as never);

    const result = await handleUpdateTextFile(mockDrive, {
      fileId: "file123",
      content: "New content",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not a text");
  });

  it("returns error for empty fileId", async () => {
    const result = await handleUpdateTextFile(mockDrive, {
      fileId: "",
      content: "content",
    });
    expect(result.isError).toBe(true);
  });
});

describe("handleCreateFolder", () => {
  let mockDrive: drive_v3.Drive;

  beforeEach(() => {
    mockDrive = createMockDrive();
    vi.mocked(mockDrive.files.list).mockResolvedValue({
      data: { files: [] },
    } as never);
  });

  it("creates folder successfully", async () => {
    vi.mocked(mockDrive.files.create).mockResolvedValue({
      data: { id: "folder123", name: "NewFolder" },
    } as never);

    const result = await handleCreateFolder(mockDrive, { name: "NewFolder" });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Created folder");
  });

  it("returns error when folder already exists", async () => {
    vi.mocked(mockDrive.files.list).mockResolvedValue({
      data: { files: [{ id: "existing123" }] },
    } as never);

    const result = await handleCreateFolder(mockDrive, {
      name: "ExistingFolder",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("already exists");
  });

  it("returns error for empty name", async () => {
    const result = await handleCreateFolder(mockDrive, { name: "" });
    expect(result.isError).toBe(true);
  });
});

describe("handleListFolder", () => {
  let mockDrive: drive_v3.Drive;

  beforeEach(() => {
    mockDrive = createMockDrive();
  });

  it("lists folder contents successfully", async () => {
    vi.mocked(mockDrive.files.list).mockResolvedValue({
      data: {
        files: [
          { id: "1", name: "file1.txt", mimeType: "text/plain" },
          {
            id: "2",
            name: "SubFolder",
            mimeType: "application/vnd.google-apps.folder",
          },
        ],
      },
    } as never);

    const result = await handleListFolder(mockDrive, {});
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("file1.txt");
    expect(result.content[0].text).toContain("SubFolder");
  });

  it("handles empty folder", async () => {
    vi.mocked(mockDrive.files.list).mockResolvedValue({
      data: { files: [] },
    } as never);

    const result = await handleListFolder(mockDrive, { folderId: "folder123" });
    expect(result.isError).toBe(false);
  });
});

describe("handleDeleteItem", () => {
  let mockDrive: drive_v3.Drive;

  beforeEach(() => {
    mockDrive = createMockDrive();
  });

  it("moves item to trash successfully", async () => {
    vi.mocked(mockDrive.files.get).mockResolvedValue({
      data: { name: "test.txt", mimeType: "text/plain" },
    } as never);
    vi.mocked(mockDrive.files.update).mockResolvedValue({} as never);

    const result = await handleDeleteItem(mockDrive, { itemId: "item123" });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("to trash");
    expect(result.content[0].text).toContain("test.txt");
  });

  it("returns error for empty itemId", async () => {
    const result = await handleDeleteItem(mockDrive, { itemId: "" });
    expect(result.isError).toBe(true);
  });
});

describe("handleRenameItem", () => {
  let mockDrive: drive_v3.Drive;

  beforeEach(() => {
    mockDrive = createMockDrive();
  });

  it("renames item successfully", async () => {
    vi.mocked(mockDrive.files.get).mockResolvedValue({
      data: { name: "old.txt", mimeType: "text/plain" },
    } as never);
    vi.mocked(mockDrive.files.update).mockResolvedValue({
      data: { name: "new.txt" },
    } as never);

    const result = await handleRenameItem(mockDrive, {
      itemId: "item123",
      newName: "new.txt",
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("renamed");
  });

  it("throws error for invalid extension on text files", async () => {
    vi.mocked(mockDrive.files.get).mockResolvedValue({
      data: { name: "test.txt", mimeType: "text/plain" },
    } as never);

    await expect(
      handleRenameItem(mockDrive, {
        itemId: "item123",
        newName: "new.pdf",
      }),
    ).rejects.toThrow(".txt or .md");
  });
});

describe("handleMoveItem", () => {
  let mockDrive: drive_v3.Drive;

  beforeEach(() => {
    mockDrive = createMockDrive();
    // Default: folder path doesn't exist, so no path resolution needed
    vi.mocked(mockDrive.files.list).mockResolvedValue({
      data: { files: [] },
    } as never);
  });

  it("moves item successfully", async () => {
    vi.mocked(mockDrive.files.get)
      .mockResolvedValueOnce({
        data: { name: "file.txt", parents: ["parent1"] },
      } as never)
      .mockResolvedValueOnce({ data: { name: "DestFolder" } } as never);
    vi.mocked(mockDrive.files.update).mockResolvedValue({} as never);

    const result = await handleMoveItem(mockDrive, {
      itemId: "item123",
      destinationFolderId: "dest456",
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("moved");
  });

  it("returns error when moving folder into itself", async () => {
    const result = await handleMoveItem(mockDrive, {
      itemId: "folder123",
      destinationFolderId: "folder123",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("into itself");
  });

  it("returns error for empty itemId", async () => {
    const result = await handleMoveItem(mockDrive, { itemId: "" });
    expect(result.isError).toBe(true);
  });
});

describe("handleCopyFile", () => {
  let mockDrive: drive_v3.Drive;

  beforeEach(() => {
    mockDrive = createMockDrive();
    // Default: destination file doesn't exist
    vi.mocked(mockDrive.files.list).mockResolvedValue({
      data: { files: [] },
    } as never);
  });

  it("copies file successfully", async () => {
    vi.mocked(mockDrive.files.get).mockResolvedValue({
      data: { name: "original.txt", parents: ["parent123"] },
    } as never);
    vi.mocked(mockDrive.files.copy).mockResolvedValue({
      data: {
        id: "copy123",
        name: "Copy of original.txt",
        webViewLink: "https://...",
      },
    } as never);

    const result = await handleCopyFile(mockDrive, { sourceFileId: "file123" });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Copied file");
    expect(result.content[0].text).toContain("copy123");
  });

  it("copies file with custom name", async () => {
    vi.mocked(mockDrive.files.get).mockResolvedValue({
      data: { name: "original.txt", parents: ["parent123"] },
    } as never);
    vi.mocked(mockDrive.files.copy).mockResolvedValue({
      data: {
        id: "copy123",
        name: "custom-name.txt",
        webViewLink: "https://...",
      },
    } as never);

    const result = await handleCopyFile(mockDrive, {
      sourceFileId: "file123",
      destinationName: "custom-name.txt",
    });
    expect(result.isError).toBe(false);
  });

  it("returns error when destination already exists", async () => {
    vi.mocked(mockDrive.files.get).mockResolvedValue({
      data: { name: "original.txt", parents: ["parent123"] },
    } as never);
    vi.mocked(mockDrive.files.list).mockResolvedValue({
      data: { files: [{ id: "existing123" }] },
    } as never);

    const result = await handleCopyFile(mockDrive, { sourceFileId: "file123" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("already exists");
  });

  it("returns error for empty sourceFileId", async () => {
    const result = await handleCopyFile(mockDrive, { sourceFileId: "" });
    expect(result.isError).toBe(true);
  });
});

describe("handleGetFileMetadata", () => {
  let mockDrive: drive_v3.Drive;

  beforeEach(() => {
    mockDrive = createMockDrive();
  });

  it("returns file metadata successfully", async () => {
    vi.mocked(mockDrive.files.get).mockResolvedValue({
      data: {
        id: "file123",
        name: "test.txt",
        mimeType: "text/plain",
        size: "1024",
        createdTime: "2024-01-01T00:00:00.000Z",
        modifiedTime: "2024-01-02T00:00:00.000Z",
        owners: [{ displayName: "Test User" }],
        shared: false,
        starred: false,
        webViewLink: "https://...",
      },
    } as never);

    const result = await handleGetFileMetadata(mockDrive, {
      fileId: "file123",
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Name: test.txt");
    expect(result.content[0].text).toContain("Type: text/plain");
    expect(result.content[0].text).toContain("Test User");
  });

  it("returns error for empty fileId", async () => {
    const result = await handleGetFileMetadata(mockDrive, { fileId: "" });
    expect(result.isError).toBe(true);
  });
});

describe("handleExportFile", () => {
  let mockDrive: drive_v3.Drive;

  beforeEach(() => {
    mockDrive = createMockDrive();
  });

  it("exports Google Doc to PDF successfully", async () => {
    vi.mocked(mockDrive.files.get).mockResolvedValue({
      data: { name: "MyDoc", mimeType: "application/vnd.google-apps.document" },
    } as never);
    vi.mocked(mockDrive.files.export).mockResolvedValue({
      data: new ArrayBuffer(100),
    } as never);

    const result = await handleExportFile(mockDrive, {
      fileId: "doc123",
      format: "pdf",
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Exported");
    expect(result.content[0].text).toContain("MyDoc");
  });

  it("exports Google Sheet to CSV successfully", async () => {
    vi.mocked(mockDrive.files.get).mockResolvedValue({
      data: {
        name: "MySheet",
        mimeType: "application/vnd.google-apps.spreadsheet",
      },
    } as never);
    vi.mocked(mockDrive.files.export).mockResolvedValue({
      data: new ArrayBuffer(50),
    } as never);

    const result = await handleExportFile(mockDrive, {
      fileId: "sheet123",
      format: "csv",
    });
    expect(result.isError).toBe(false);
  });

  it("returns error for invalid format for file type", async () => {
    vi.mocked(mockDrive.files.get).mockResolvedValue({
      data: { name: "MyDoc", mimeType: "application/vnd.google-apps.document" },
    } as never);

    const result = await handleExportFile(mockDrive, {
      fileId: "doc123",
      format: "csv",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Cannot export");
  });

  it("returns error for non-Google Workspace file", async () => {
    vi.mocked(mockDrive.files.get).mockResolvedValue({
      data: { name: "file.pdf", mimeType: "application/pdf" },
    } as never);

    const result = await handleExportFile(mockDrive, {
      fileId: "pdf123",
      format: "pdf",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not a Google Doc");
  });

  it("returns error for empty fileId", async () => {
    const result = await handleExportFile(mockDrive, {
      fileId: "",
      format: "pdf",
    });
    expect(result.isError).toBe(true);
  });
});

// =============================================================================
// SHARING HANDLERS
// =============================================================================

describe("handleShareFile", () => {
  let mockDrive: drive_v3.Drive;

  beforeEach(() => {
    mockDrive = createMockDrive();
  });

  it("shares file with user successfully", async () => {
    vi.mocked(mockDrive.files.get).mockResolvedValue({
      data: { name: "test.txt" },
    } as never);
    vi.mocked(mockDrive.permissions.create).mockResolvedValue({
      data: { id: "perm123" },
    } as never);

    const result = await handleShareFile(mockDrive, {
      fileId: "file123",
      role: "reader",
      type: "user",
      emailAddress: "test@example.com",
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Shared");
    expect(result.content[0].text).toContain("test@example.com");
  });

  it("shares file with anyone successfully", async () => {
    vi.mocked(mockDrive.files.get).mockResolvedValue({
      data: { name: "test.txt" },
    } as never);
    vi.mocked(mockDrive.permissions.create).mockResolvedValue({
      data: { id: "perm123" },
    } as never);

    const result = await handleShareFile(mockDrive, {
      fileId: "file123",
      role: "reader",
      type: "anyone",
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("anyone with the link");
  });

  it("returns error when email missing for user type", async () => {
    const result = await handleShareFile(mockDrive, {
      fileId: "file123",
      role: "reader",
      type: "user",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Email address is required");
  });

  it("returns error for empty fileId", async () => {
    const result = await handleShareFile(mockDrive, {
      fileId: "",
      role: "reader",
      type: "anyone",
    });
    expect(result.isError).toBe(true);
  });
});

describe("handleGetSharing", () => {
  let mockDrive: drive_v3.Drive;

  beforeEach(() => {
    mockDrive = createMockDrive();
  });

  it("returns sharing settings successfully", async () => {
    vi.mocked(mockDrive.files.get).mockResolvedValue({
      data: { name: "test.txt", webViewLink: "https://..." },
    } as never);
    vi.mocked(mockDrive.permissions.list).mockResolvedValue({
      data: {
        permissions: [
          {
            id: "1",
            role: "owner",
            type: "user",
            emailAddress: "owner@example.com",
          },
          { id: "2", role: "reader", type: "anyone" },
        ],
      },
    } as never);

    const result = await handleGetSharing(mockDrive, { fileId: "file123" });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("owner@example.com");
    // structuredContent contains the data in a consistent format
    const structured = result.structuredContent as { permissions: Array<{ type: string }> };
    expect(structured.permissions).toHaveLength(2);
    expect(structured.permissions[1].type).toBe("anyone");
  });

  it("returns error for empty fileId", async () => {
    const result = await handleGetSharing(mockDrive, { fileId: "" });
    expect(result.isError).toBe(true);
  });
});

// =============================================================================
// REVISION HANDLERS
// =============================================================================

describe("handleListRevisions", () => {
  let mockDrive: drive_v3.Drive;

  beforeEach(() => {
    mockDrive = createMockDrive();
  });

  it("lists revisions successfully", async () => {
    vi.mocked(mockDrive.files.get).mockResolvedValue({
      data: { name: "test.pdf", mimeType: "application/pdf" },
    } as never);
    vi.mocked(mockDrive.revisions.list).mockResolvedValue({
      data: {
        revisions: [
          {
            id: "rev1",
            modifiedTime: "2024-01-01T00:00:00.000Z",
            size: "1024",
          },
          {
            id: "rev2",
            modifiedTime: "2024-01-02T00:00:00.000Z",
            size: "2048",
          },
        ],
      },
    } as never);

    const result = await handleListRevisions(mockDrive, { fileId: "file123" });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("2 found");
    expect(result.content[0].text).toContain("rev1");
    expect(result.content[0].text).toContain("rev2");
  });

  it("returns empty message when no revisions", async () => {
    vi.mocked(mockDrive.files.get).mockResolvedValue({
      data: { name: "test.pdf", mimeType: "application/pdf" },
    } as never);
    vi.mocked(mockDrive.revisions.list).mockResolvedValue({
      data: { revisions: [] },
    } as never);

    const result = await handleListRevisions(mockDrive, { fileId: "file123" });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("No revisions found");
  });

  it("returns error for Google Workspace files", async () => {
    vi.mocked(mockDrive.files.get).mockResolvedValue({
      data: { name: "MyDoc", mimeType: "application/vnd.google-apps.document" },
    } as never);

    const result = await handleListRevisions(mockDrive, { fileId: "file123" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Google Workspace files");
  });

  it("returns error for empty fileId", async () => {
    const result = await handleListRevisions(mockDrive, { fileId: "" });
    expect(result.isError).toBe(true);
  });
});

describe("handleRestoreRevision", () => {
  let mockDrive: drive_v3.Drive;

  beforeEach(() => {
    mockDrive = createMockDrive();
  });

  it("restores revision successfully", async () => {
    vi.mocked(mockDrive.files.get).mockResolvedValue({
      data: { name: "test.pdf", mimeType: "application/pdf" },
    } as never);
    vi.mocked(mockDrive.revisions.get).mockResolvedValue({
      data: new ArrayBuffer(100),
    } as never);
    vi.mocked(mockDrive.files.update).mockResolvedValue({} as never);

    const result = await handleRestoreRevision(mockDrive, {
      fileId: "file123",
      revisionId: "rev1",
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Restored");
    expect(result.content[0].text).toContain("rev1");
  });

  it("returns error for Google Workspace files", async () => {
    vi.mocked(mockDrive.files.get).mockResolvedValue({
      data: { name: "MyDoc", mimeType: "application/vnd.google-apps.document" },
    } as never);

    const result = await handleRestoreRevision(mockDrive, {
      fileId: "file123",
      revisionId: "rev1",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Google Workspace files");
  });

  it("returns error for empty fileId", async () => {
    const result = await handleRestoreRevision(mockDrive, {
      fileId: "",
      revisionId: "rev1",
    });
    expect(result.isError).toBe(true);
  });

  it("returns error for empty revisionId", async () => {
    const result = await handleRestoreRevision(mockDrive, {
      fileId: "file123",
      revisionId: "",
    });
    expect(result.isError).toBe(true);
  });
});

// =============================================================================
// BINARY FILE HANDLERS
// =============================================================================

describe("handleDownloadFile", () => {
  let mockDrive: drive_v3.Drive;

  beforeEach(() => {
    mockDrive = createMockDrive();
  });

  it("downloads file and returns base64 successfully", async () => {
    vi.mocked(mockDrive.files.get)
      .mockResolvedValueOnce({
        data: { name: "image.png", mimeType: "image/png", size: "1024" },
      } as never)
      .mockResolvedValueOnce({
        data: new ArrayBuffer(100),
      } as never);

    const result = await handleDownloadFile(mockDrive, { fileId: "file123" });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Downloaded");
    expect(result.content[0].text).toContain("image.png");
    expect(result.content[0].text).toContain("Base64 content");
  });

  it("returns error for Google Workspace files", async () => {
    vi.mocked(mockDrive.files.get).mockResolvedValue({
      data: { name: "MyDoc", mimeType: "application/vnd.google-apps.document" },
    } as never);

    const result = await handleDownloadFile(mockDrive, { fileId: "file123" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Google Workspace file");
    expect(result.content[0].text).toContain("exportFile");
  });

  it("returns error for empty fileId", async () => {
    const result = await handleDownloadFile(mockDrive, { fileId: "" });
    expect(result.isError).toBe(true);
  });
});

describe("handleUploadFile", () => {
  let mockDrive: drive_v3.Drive;

  beforeEach(() => {
    mockDrive = createMockDrive();
    // Default: file doesn't exist
    vi.mocked(mockDrive.files.list).mockResolvedValue({
      data: { files: [] },
    } as never);
  });

  it("uploads file from base64 successfully", async () => {
    vi.mocked(mockDrive.files.create).mockResolvedValue({
      data: { id: "file123", name: "image.png", webViewLink: "https://..." },
    } as never);

    const result = await handleUploadFile(mockDrive, {
      name: "image.png",
      base64Content: "iVBORw0KGgoAAAANSUhEUg==",
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Uploaded file");
    expect(result.content[0].text).toContain("image.png");
  });

  it("returns error when neither sourcePath nor base64Content provided", async () => {
    const result = await handleUploadFile(mockDrive, { name: "image.png" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("sourcePath or base64Content is required");
  });

  it("returns error when file already exists", async () => {
    vi.mocked(mockDrive.files.list).mockResolvedValue({
      data: { files: [{ id: "existing123" }] },
    } as never);

    const result = await handleUploadFile(mockDrive, {
      name: "image.png",
      base64Content: "iVBORw0KGgoAAAANSUhEUg==",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("already exists");
  });

  it("returns error for empty name", async () => {
    const result = await handleUploadFile(mockDrive, {
      name: "",
      base64Content: "iVBORw0KGgoAAAANSUhEUg==",
    });
    expect(result.isError).toBe(true);
  });
});

// =============================================================================
// METADATA HANDLERS
// =============================================================================

describe("handleGetStorageQuota", () => {
  let mockDrive: drive_v3.Drive;

  beforeEach(() => {
    mockDrive = createMockDrive();
  });

  it("returns storage quota successfully", async () => {
    vi.mocked(mockDrive.about.get).mockResolvedValue({
      data: {
        storageQuota: {
          limit: "16106127360",
          usage: "5368709120",
          usageInDrive: "4294967296",
          usageInDriveTrash: "1073741824",
        },
        user: { emailAddress: "test@example.com" },
      },
    } as never);

    const result = await handleGetStorageQuota(mockDrive, {});
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Google Drive Storage Quota");
    expect(result.content[0].text).toContain("test@example.com");
    expect(result.content[0].text).toContain("GB");
  });

  it("handles unlimited storage", async () => {
    vi.mocked(mockDrive.about.get).mockResolvedValue({
      data: {
        storageQuota: {
          usage: "1073741824",
          usageInDrive: "1073741824",
        },
        user: { emailAddress: "test@example.com" },
      },
    } as never);

    const result = await handleGetStorageQuota(mockDrive, {});
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Unlimited");
  });
});

describe("handleStarFile", () => {
  let mockDrive: drive_v3.Drive;

  beforeEach(() => {
    mockDrive = createMockDrive();
  });

  it("stars file successfully", async () => {
    vi.mocked(mockDrive.files.get).mockResolvedValue({
      data: { name: "test.txt" },
    } as never);
    vi.mocked(mockDrive.files.update).mockResolvedValue({} as never);

    const result = await handleStarFile(mockDrive, {
      fileId: "file123",
      starred: true,
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("starred");
    expect(result.content[0].text).toContain("test.txt");
  });

  it("unstars file successfully", async () => {
    vi.mocked(mockDrive.files.get).mockResolvedValue({
      data: { name: "test.txt" },
    } as never);
    vi.mocked(mockDrive.files.update).mockResolvedValue({} as never);

    const result = await handleStarFile(mockDrive, {
      fileId: "file123",
      starred: false,
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("unstarred");
    expect(result.content[0].text).toContain("test.txt");
  });

  it("returns error for empty fileId", async () => {
    const result = await handleStarFile(mockDrive, {
      fileId: "",
      starred: true,
    });
    expect(result.isError).toBe(true);
  });
});

describe("handleBatchRestore", () => {
  let mockDrive: drive_v3.Drive;

  beforeEach(() => {
    mockDrive = createMockDrive();
  });

  it("restores multiple files from trash successfully", async () => {
    vi.mocked(mockDrive.files.get).mockResolvedValue({
      data: { name: "test.txt", trashed: true },
    } as never);
    vi.mocked(mockDrive.files.update).mockResolvedValue({} as never);

    const result = await handleBatchRestore(mockDrive, {
      fileIds: ["file1", "file2"],
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("2 succeeded");
  });

  it("returns error when file is not in trash", async () => {
    vi.mocked(mockDrive.files.get).mockResolvedValue({
      data: { name: "test.txt", trashed: false },
    } as never);

    const result = await handleBatchRestore(mockDrive, { fileIds: ["file1"] });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("0 succeeded");
    expect(result.content[0].text).toContain("1 failed");
  });

  it("returns error for empty fileIds array", async () => {
    const result = await handleBatchRestore(mockDrive, { fileIds: [] });
    expect(result.isError).toBe(true);
  });
});

describe("handleRestoreFromTrash", () => {
  let mockDrive: drive_v3.Drive;

  beforeEach(() => {
    mockDrive = createMockDrive();
  });

  it("restores file from trash successfully", async () => {
    vi.mocked(mockDrive.files.get).mockResolvedValue({
      data: { name: "test.txt", trashed: true, parents: ["parent123"] },
    } as never);
    vi.mocked(mockDrive.files.update).mockResolvedValue({} as never);

    const result = await handleRestoreFromTrash(mockDrive, {
      fileId: "file123",
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Restored");
    expect(result.content[0].text).toContain("test.txt");
  });

  it("returns error when file is not in trash", async () => {
    vi.mocked(mockDrive.files.get).mockResolvedValue({
      data: { name: "test.txt", trashed: false },
    } as never);

    const result = await handleRestoreFromTrash(mockDrive, {
      fileId: "file123",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not in trash");
  });

  it("returns error for empty fileId", async () => {
    const result = await handleRestoreFromTrash(mockDrive, { fileId: "" });
    expect(result.isError).toBe(true);
  });
});

describe("handleDeleteItem folder counts", () => {
  let mockDrive: drive_v3.Drive;

  beforeEach(() => {
    mockDrive = createMockDrive();
  });

  it("shows item count when deleting folder", async () => {
    vi.mocked(mockDrive.files.get).mockResolvedValue({
      data: {
        name: "MyFolder",
        mimeType: "application/vnd.google-apps.folder",
      },
    } as never);
    vi.mocked(mockDrive.files.list).mockResolvedValue({
      data: {
        files: [
          { id: "file1", mimeType: "text/plain" },
          { id: "file2", mimeType: "text/plain" },
          { id: "folder1", mimeType: "application/vnd.google-apps.folder" },
        ],
      },
    } as never);
    vi.mocked(mockDrive.files.update).mockResolvedValue({} as never);

    const result = await handleDeleteItem(mockDrive, { itemId: "folder123" });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("2 files");
    expect(result.content[0].text).toContain("1 subfolder");
  });

  it("does not show count for empty folder", async () => {
    vi.mocked(mockDrive.files.get).mockResolvedValue({
      data: {
        name: "EmptyFolder",
        mimeType: "application/vnd.google-apps.folder",
      },
    } as never);
    vi.mocked(mockDrive.files.list).mockResolvedValue({
      data: { files: [] },
    } as never);
    vi.mocked(mockDrive.files.update).mockResolvedValue({} as never);

    const result = await handleDeleteItem(mockDrive, { itemId: "folder123" });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).not.toContain("contains");
  });
});

describe("handleListFolder error handling", () => {
  let mockDrive: drive_v3.Drive;

  beforeEach(() => {
    mockDrive = createMockDrive();
  });

  it("returns error with folder ID when folder not found", async () => {
    vi.mocked(mockDrive.files.list).mockRejectedValue(new Error("File not found"));

    const result = await handleListFolder(mockDrive, {
      folderId: "nonexistent123",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Folder not found");
    expect(result.content[0].text).toContain("nonexistent123");
  });
});

describe("handleResolveFilePath", () => {
  let mockDrive: drive_v3.Drive;

  beforeEach(() => {
    mockDrive = createMockDrive();
  });

  it("includes ID, name, path, and mimeType in text", async () => {
    vi.mocked(mockDrive.files.list).mockResolvedValue({
      data: {
        files: [
          {
            id: "folder123",
            name: "Marketing",
            mimeType: "application/vnd.google-apps.folder",
            modifiedTime: "2026-01-15T10:30:00.000Z",
          },
        ],
      },
    } as never);

    const result = await handleResolveFilePath(mockDrive, {
      path: "/Marketing",
    });
    expect(result.isError).toBe(false);
    const text = result.content[0].text as string;
    expect(text).toContain("Name: Marketing");
    expect(text).toContain("ID: folder123");
    expect(text).toContain("Path: /Marketing");
    expect(text).toContain("MIME type: application/vnd.google-apps.folder");

    const structured = result.structuredContent as {
      id: string;
      name: string;
      path: string;
    };
    expect(structured.id).toBe("folder123");
    expect(structured.name).toBe("Marketing");
    expect(structured.path).toBe("/Marketing");
  });

  it("root path includes ID root in text", async () => {
    const result = await handleResolveFilePath(mockDrive, {
      path: "/",
    });
    expect(result.isError).toBe(false);
    const text = result.content[0].text as string;
    expect(text).toContain("Name: My Drive");
    expect(text).toContain("ID: root");
    expect(text).toContain("Path: /");
    expect(text).toContain("Type: folder");
  });

  it("resolves a file with Type: file and includes Modified", async () => {
    vi.mocked(mockDrive.files.list).mockResolvedValue({
      data: {
        files: [
          {
            id: "file456",
            name: "report.pdf",
            mimeType: "application/pdf",
            modifiedTime: "2026-02-01T08:00:00.000Z",
          },
        ],
      },
    } as never);

    const result = await handleResolveFilePath(mockDrive, {
      path: "/report.pdf",
    });
    expect(result.isError).toBe(false);
    const text = result.content[0].text as string;
    expect(text).toContain("Type: file");
    expect(text).toContain("MIME type: application/pdf");
    expect(text).toContain("Modified: 2026-02-01T08:00:00.000Z");
  });

  it("omits MIME type and Modified when null", async () => {
    vi.mocked(mockDrive.files.list).mockResolvedValue({
      data: {
        files: [
          {
            id: "file789",
            name: "mystery",
            mimeType: null,
            modifiedTime: null,
          },
        ],
      },
    } as never);

    const result = await handleResolveFilePath(mockDrive, {
      path: "/mystery",
    });
    expect(result.isError).toBe(false);
    const text = result.content[0].text as string;
    expect(text).not.toContain("MIME type:");
    expect(text).not.toContain("Modified:");
    expect(text).toContain("Name: mystery");
    expect(text).toContain("ID: file789");
  });

  it("builds correct path for multi-segment paths", async () => {
    vi.mocked(mockDrive.files.list)
      .mockResolvedValueOnce({
        data: {
          files: [
            {
              id: "folderA",
              name: "Marketing",
              mimeType: "application/vnd.google-apps.folder",
            },
          ],
        },
      } as never)
      .mockResolvedValueOnce({
        data: {
          files: [
            {
              id: "fileB",
              name: "budget.xlsx",
              mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              modifiedTime: "2026-01-20T12:00:00.000Z",
            },
          ],
        },
      } as never);

    const result = await handleResolveFilePath(mockDrive, {
      path: "/Marketing/budget.xlsx",
    });
    expect(result.isError).toBe(false);
    const text = result.content[0].text as string;
    expect(text).toContain("Path: /Marketing/budget.xlsx");
    expect(text).toContain("ID: fileB");
    expect(text).toContain("Name: budget.xlsx");
  });
});

describe("handleGetFolderTree", () => {
  let mockDrive: drive_v3.Drive;

  beforeEach(() => {
    mockDrive = createMockDrive();
  });

  it("does not include IDs in text by default", async () => {
    vi.mocked(mockDrive.files.list).mockResolvedValue({
      data: {
        files: [
          {
            id: "child1",
            name: "readme.txt",
            mimeType: "text/plain",
          },
        ],
      },
    } as never);

    const result = await handleGetFolderTree(mockDrive, {});
    expect(result.isError).toBe(false);
    const text = result.content[0].text as string;
    expect(text).toContain("readme.txt");
    expect(text).not.toContain("(ID:");
  });

  it("includes IDs in text when includeIds is true", async () => {
    vi.mocked(mockDrive.files.list).mockResolvedValue({
      data: {
        files: [
          {
            id: "child1",
            name: "readme.txt",
            mimeType: "text/plain",
          },
          {
            id: "subfolder1",
            name: "Branding",
            mimeType: "application/vnd.google-apps.folder",
          },
        ],
      },
    } as never);

    const result = await handleGetFolderTree(mockDrive, {
      includeIds: true,
    });
    expect(result.isError).toBe(false);
    const text = result.content[0].text as string;
    expect(text).toContain("(ID: root)");
    expect(text).toContain("readme.txt (ID: child1)");
    expect(text).toContain("Branding (ID: subfolder1)");
  });
});

describe("handleListFolder with folderPath", () => {
  let mockDrive: drive_v3.Drive;

  beforeEach(() => {
    mockDrive = createMockDrive();
  });

  it("resolves folderPath to folder ID", async () => {
    // First call: resolve path segment "Documents"
    // Second call: list folder contents
    vi.mocked(mockDrive.files.list)
      .mockResolvedValueOnce({
        data: { files: [{ id: "docs-folder-id", name: "Documents" }] },
      } as never)
      .mockResolvedValueOnce({
        data: {
          files: [{ id: "1", name: "report.txt", mimeType: "text/plain" }],
        },
      } as never);

    const result = await handleListFolder(mockDrive, {
      folderPath: "/Documents",
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("report.txt");
  });

  it("rejects both folderId and folderPath", async () => {
    const result = await handleListFolder(mockDrive, {
      folderId: "folder123",
      folderPath: "/Documents",
    });
    expect(result.isError).toBe(true);
  });
});

describe("handleMoveItem with itemPath", () => {
  let mockDrive: drive_v3.Drive;

  beforeEach(() => {
    mockDrive = createMockDrive();
  });

  it("resolves itemPath to file ID and moves", async () => {
    vi.mocked(mockDrive.files.list)
      // resolveFileIdFromPath: find file in root
      .mockResolvedValueOnce({
        data: { files: [{ id: "resolved-file-id", name: "report.txt" }] },
      } as never);
    vi.mocked(mockDrive.files.get)
      // get item metadata (name, parents)
      .mockResolvedValueOnce({
        data: { name: "report.txt", parents: ["root"] },
      } as never)
      // get destination folder name
      .mockResolvedValueOnce({
        data: { name: "Archive" },
      } as never);
    vi.mocked(mockDrive.files.update).mockResolvedValue({} as never);

    const result = await handleMoveItem(mockDrive, {
      itemPath: "/report.txt",
      destinationFolderId: "archive-id",
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("moved");
    expect(result.content[0].text).toContain("report.txt");
  });
});

describe("handleBatchMove with filePaths", () => {
  let mockDrive: drive_v3.Drive;

  beforeEach(() => {
    mockDrive = createMockDrive();
  });

  it("resolves filePaths to IDs and moves", async () => {
    vi.mocked(mockDrive.files.list)
      // resolveFileIdFromPath for first file
      .mockResolvedValueOnce({
        data: { files: [{ id: "file-a-id", name: "a.txt" }] },
      } as never)
      // resolveFileIdFromPath for second file
      .mockResolvedValueOnce({
        data: { files: [{ id: "file-b-id", name: "b.txt" }] },
      } as never);

    vi.mocked(mockDrive.files.get)
      // destination folder name lookup
      .mockResolvedValueOnce({
        data: { name: "Archive" },
      } as never)
      // batch op: get file a metadata
      .mockResolvedValueOnce({
        data: { name: "a.txt", parents: ["root"] },
      } as never)
      // batch op: get file b metadata
      .mockResolvedValueOnce({
        data: { name: "b.txt", parents: ["root"] },
      } as never);

    vi.mocked(mockDrive.files.update).mockResolvedValue({} as never);

    const result = await handleBatchMove(mockDrive, {
      filePaths: ["/a.txt", "/b.txt"],
      destinationFolderId: "archive-id",
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("2 succeeded");
  });
});
