import { describe, it, expect } from "vitest";
import {
  SearchSchema,
  CreateTextFileSchema,
  UpdateTextFileSchema,
  CreateFolderSchema,
  ListFolderSchema,
  DeleteItemSchema,
  RenameItemSchema,
  MoveItemSchema,
  BatchMoveSchema,
} from "./drive.js";

describe("SearchSchema", () => {
  it("accepts valid search query", () => {
    const result = SearchSchema.safeParse({ query: "test" });
    expect(result.success).toBe(true);
  });

  it("accepts optional pageSize", () => {
    const result = SearchSchema.safeParse({ query: "test", pageSize: 50 });
    expect(result.success).toBe(true);
  });

  it("accepts optional pageToken", () => {
    const result = SearchSchema.safeParse({
      query: "test",
      pageToken: "abc123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty query", () => {
    const result = SearchSchema.safeParse({ query: "" });
    expect(result.success).toBe(false);
  });

  it("rejects pageSize over 100", () => {
    const result = SearchSchema.safeParse({ query: "test", pageSize: 101 });
    expect(result.success).toBe(false);
  });
});

describe("CreateTextFileSchema", () => {
  it("accepts valid input", () => {
    const result = CreateTextFileSchema.safeParse({
      name: "file.txt",
      content: "hello",
    });
    expect(result.success).toBe(true);
  });

  it("accepts optional parentFolderId", () => {
    const result = CreateTextFileSchema.safeParse({
      name: "file.txt",
      content: "hello",
      parentFolderId: "folder123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = CreateTextFileSchema.safeParse({
      name: "",
      content: "hello",
    });
    expect(result.success).toBe(false);
  });

  it("accepts empty content", () => {
    const result = CreateTextFileSchema.safeParse({
      name: "file.txt",
      content: "",
    });
    expect(result.success).toBe(true);
  });
});

describe("UpdateTextFileSchema", () => {
  it("accepts valid input", () => {
    const result = UpdateTextFileSchema.safeParse({
      fileId: "abc123",
      content: "new content",
    });
    expect(result.success).toBe(true);
  });

  it("accepts optional name", () => {
    const result = UpdateTextFileSchema.safeParse({
      fileId: "abc123",
      content: "new content",
      name: "newname.txt",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty fileId", () => {
    const result = UpdateTextFileSchema.safeParse({
      fileId: "",
      content: "content",
    });
    expect(result.success).toBe(false);
  });
});

describe("CreateFolderSchema", () => {
  it("accepts valid input", () => {
    const result = CreateFolderSchema.safeParse({ name: "NewFolder" });
    expect(result.success).toBe(true);
  });

  it("accepts optional parent", () => {
    const result = CreateFolderSchema.safeParse({
      name: "NewFolder",
      parent: "parent123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = CreateFolderSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });
});

describe("ListFolderSchema", () => {
  it("accepts empty input", () => {
    const result = ListFolderSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts folderId", () => {
    const result = ListFolderSchema.safeParse({
      folderId: "folder123",
      pageSize: 50,
      pageToken: "token",
    });
    expect(result.success).toBe(true);
  });

  it("accepts folderPath", () => {
    const result = ListFolderSchema.safeParse({
      folderPath: "/Documents/Projects",
    });
    expect(result.success).toBe(true);
  });

  it("rejects both folderId and folderPath", () => {
    const result = ListFolderSchema.safeParse({
      folderId: "folder123",
      folderPath: "/Documents",
    });
    expect(result.success).toBe(false);
  });
});

describe("DeleteItemSchema", () => {
  it("accepts valid itemId", () => {
    const result = DeleteItemSchema.safeParse({ itemId: "item123" });
    expect(result.success).toBe(true);
  });

  it("rejects empty itemId", () => {
    const result = DeleteItemSchema.safeParse({ itemId: "" });
    expect(result.success).toBe(false);
  });
});

describe("RenameItemSchema", () => {
  it("accepts valid input", () => {
    const result = RenameItemSchema.safeParse({
      itemId: "item123",
      newName: "NewName",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty itemId", () => {
    const result = RenameItemSchema.safeParse({
      itemId: "",
      newName: "NewName",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty newName", () => {
    const result = RenameItemSchema.safeParse({
      itemId: "item123",
      newName: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("MoveItemSchema", () => {
  it("accepts itemId", () => {
    const result = MoveItemSchema.safeParse({ itemId: "item123" });
    expect(result.success).toBe(true);
  });

  it("accepts itemPath", () => {
    const result = MoveItemSchema.safeParse({
      itemPath: "/Documents/report.txt",
    });
    expect(result.success).toBe(true);
  });

  it("accepts optional destinationFolderId", () => {
    const result = MoveItemSchema.safeParse({
      itemId: "item123",
      destinationFolderId: "dest456",
    });
    expect(result.success).toBe(true);
  });

  it("rejects neither itemId nor itemPath", () => {
    const result = MoveItemSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects both itemId and itemPath", () => {
    const result = MoveItemSchema.safeParse({
      itemId: "item123",
      itemPath: "/Documents/report.txt",
    });
    expect(result.success).toBe(false);
  });
});

describe("BatchMoveSchema", () => {
  it("accepts fileIds with destinationFolderId", () => {
    const result = BatchMoveSchema.safeParse({
      fileIds: ["id1", "id2"],
      destinationFolderId: "dest123",
    });
    expect(result.success).toBe(true);
  });

  it("accepts filePaths with destinationPath", () => {
    const result = BatchMoveSchema.safeParse({
      filePaths: ["/Documents/a.txt", "/Documents/b.txt"],
      destinationPath: "/Archive",
    });
    expect(result.success).toBe(true);
  });

  it("rejects neither fileIds nor filePaths", () => {
    const result = BatchMoveSchema.safeParse({
      destinationFolderId: "dest123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects both fileIds and filePaths", () => {
    const result = BatchMoveSchema.safeParse({
      fileIds: ["id1"],
      filePaths: ["/Documents/a.txt"],
      destinationFolderId: "dest123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty fileIds array", () => {
    const result = BatchMoveSchema.safeParse({
      fileIds: [],
      destinationFolderId: "dest123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty filePaths array", () => {
    const result = BatchMoveSchema.safeParse({
      filePaths: [],
      destinationFolderId: "dest123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing destination", () => {
    const result = BatchMoveSchema.safeParse({
      fileIds: ["id1"],
    });
    expect(result.success).toBe(false);
  });
});
