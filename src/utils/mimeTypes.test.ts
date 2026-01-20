import { describe, it, expect } from "vitest";
import {
  GOOGLE_MIME_TYPES,
  TEXT_MIME_TYPES,
  EXPORT_MIME_TYPES,
  EXTENSION_TO_TYPE,
  getExtension,
  inferTypeFromExtension,
  getMimeTypeFromExtension,
  isGoogleWorkspaceMimeType,
  isFolder,
  getTypeFromGoogleMime,
} from "./mimeTypes.js";

describe("utils/mimeTypes", () => {
  describe("GOOGLE_MIME_TYPES constants", () => {
    it("has correct document MIME type", () => {
      expect(GOOGLE_MIME_TYPES.DOCUMENT).toBe(
        "application/vnd.google-apps.document",
      );
    });

    it("has correct spreadsheet MIME type", () => {
      expect(GOOGLE_MIME_TYPES.SPREADSHEET).toBe(
        "application/vnd.google-apps.spreadsheet",
      );
    });

    it("has correct presentation MIME type", () => {
      expect(GOOGLE_MIME_TYPES.PRESENTATION).toBe(
        "application/vnd.google-apps.presentation",
      );
    });

    it("has correct folder MIME type", () => {
      expect(GOOGLE_MIME_TYPES.FOLDER).toBe(
        "application/vnd.google-apps.folder",
      );
    });
  });

  describe("TEXT_MIME_TYPES constants", () => {
    it("has correct plain text MIME type", () => {
      expect(TEXT_MIME_TYPES.PLAIN).toBe("text/plain");
    });

    it("has correct markdown MIME type", () => {
      expect(TEXT_MIME_TYPES.MARKDOWN).toBe("text/markdown");
    });
  });

  describe("EXPORT_MIME_TYPES constants", () => {
    it("has correct PDF MIME type", () => {
      expect(EXPORT_MIME_TYPES.PDF).toBe("application/pdf");
    });

    it("has correct DOCX MIME type", () => {
      expect(EXPORT_MIME_TYPES.DOCX).toBe(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      );
    });
  });

  describe("EXTENSION_TO_TYPE", () => {
    it("maps doc extensions to doc type", () => {
      expect(EXTENSION_TO_TYPE["docx"]).toBe("doc");
      expect(EXTENSION_TO_TYPE["doc"]).toBe("doc");
      expect(EXTENSION_TO_TYPE["gdoc"]).toBe("doc");
    });

    it("maps sheet extensions to sheet type", () => {
      expect(EXTENSION_TO_TYPE["xlsx"]).toBe("sheet");
      expect(EXTENSION_TO_TYPE["xls"]).toBe("sheet");
      expect(EXTENSION_TO_TYPE["csv"]).toBe("sheet");
      expect(EXTENSION_TO_TYPE["gsheet"]).toBe("sheet");
    });

    it("maps slides extensions to slides type", () => {
      expect(EXTENSION_TO_TYPE["pptx"]).toBe("slides");
      expect(EXTENSION_TO_TYPE["ppt"]).toBe("slides");
      expect(EXTENSION_TO_TYPE["gslides"]).toBe("slides");
    });

    it("maps text extensions to text type", () => {
      expect(EXTENSION_TO_TYPE["txt"]).toBe("text");
      expect(EXTENSION_TO_TYPE["md"]).toBe("text");
    });
  });

  describe("getExtension", () => {
    it("extracts extension from filename", () => {
      expect(getExtension("file.txt")).toBe("txt");
      expect(getExtension("document.docx")).toBe("docx");
    });

    it("handles multiple dots in filename", () => {
      expect(getExtension("my.file.name.pdf")).toBe("pdf");
    });

    it("returns lowercase extension", () => {
      expect(getExtension("FILE.TXT")).toBe("txt");
      expect(getExtension("Document.DOCX")).toBe("docx");
    });

    it("returns the filename when no extension present", () => {
      // When no dot present, the whole filename is returned
      expect(getExtension("noextension")).toBe("noextension");
    });

    it("handles empty filename", () => {
      expect(getExtension("")).toBe("");
    });
  });

  describe("inferTypeFromExtension", () => {
    it("infers doc type from docx", () => {
      expect(inferTypeFromExtension("report.docx")).toBe("doc");
    });

    it("infers sheet type from xlsx", () => {
      expect(inferTypeFromExtension("data.xlsx")).toBe("sheet");
    });

    it("infers slides type from pptx", () => {
      expect(inferTypeFromExtension("presentation.pptx")).toBe("slides");
    });

    it("infers text type from txt", () => {
      expect(inferTypeFromExtension("notes.txt")).toBe("text");
    });

    it("returns undefined for unknown extension", () => {
      expect(inferTypeFromExtension("image.png")).toBeUndefined();
    });
  });

  describe("getMimeTypeFromExtension", () => {
    it("returns plain text for txt", () => {
      expect(getMimeTypeFromExtension("file.txt")).toBe("text/plain");
    });

    it("returns markdown for md", () => {
      expect(getMimeTypeFromExtension("readme.md")).toBe("text/markdown");
    });

    it("returns csv for csv files", () => {
      expect(getMimeTypeFromExtension("data.csv")).toBe("text/csv");
    });

    it("defaults to text/plain for unknown", () => {
      expect(getMimeTypeFromExtension("file.xyz")).toBe("text/plain");
    });
  });

  describe("isGoogleWorkspaceMimeType", () => {
    it("returns true for Google Doc", () => {
      expect(isGoogleWorkspaceMimeType(GOOGLE_MIME_TYPES.DOCUMENT)).toBe(true);
    });

    it("returns true for Google Sheet", () => {
      expect(isGoogleWorkspaceMimeType(GOOGLE_MIME_TYPES.SPREADSHEET)).toBe(
        true,
      );
    });

    it("returns true for Google Slides", () => {
      expect(isGoogleWorkspaceMimeType(GOOGLE_MIME_TYPES.PRESENTATION)).toBe(
        true,
      );
    });

    it("returns true for Google Folder", () => {
      expect(isGoogleWorkspaceMimeType(GOOGLE_MIME_TYPES.FOLDER)).toBe(true);
    });

    it("returns false for regular MIME types", () => {
      expect(isGoogleWorkspaceMimeType("text/plain")).toBe(false);
      expect(isGoogleWorkspaceMimeType("application/pdf")).toBe(false);
    });
  });

  describe("isFolder", () => {
    it("returns true for folder MIME type", () => {
      expect(isFolder(GOOGLE_MIME_TYPES.FOLDER)).toBe(true);
    });

    it("returns false for non-folder types", () => {
      expect(isFolder(GOOGLE_MIME_TYPES.DOCUMENT)).toBe(false);
      expect(isFolder("text/plain")).toBe(false);
    });
  });

  describe("getTypeFromGoogleMime", () => {
    it("returns doc for document MIME type", () => {
      expect(getTypeFromGoogleMime(GOOGLE_MIME_TYPES.DOCUMENT)).toBe("doc");
    });

    it("returns sheet for spreadsheet MIME type", () => {
      expect(getTypeFromGoogleMime(GOOGLE_MIME_TYPES.SPREADSHEET)).toBe(
        "sheet",
      );
    });

    it("returns slides for presentation MIME type", () => {
      expect(getTypeFromGoogleMime(GOOGLE_MIME_TYPES.PRESENTATION)).toBe(
        "slides",
      );
    });

    it("returns undefined for other types", () => {
      expect(getTypeFromGoogleMime(GOOGLE_MIME_TYPES.FOLDER)).toBeUndefined();
      expect(getTypeFromGoogleMime("text/plain")).toBeUndefined();
    });
  });
});
