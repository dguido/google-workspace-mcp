import { describe, it, expect } from "vitest";
import {
  escapeQueryString,
  buildNameQuery,
  buildParentQuery,
  buildFullTextQuery,
  buildMimeTypeQuery,
  combineQueries,
} from "./gdrive-query.js";

describe("utils/gdrive-query", () => {
  describe("escapeQueryString", () => {
    it("returns unchanged string for regular text", () => {
      expect(escapeQueryString("hello world")).toBe("hello world");
    });

    it("escapes backslashes", () => {
      expect(escapeQueryString("path\\to\\file")).toBe("path\\\\to\\\\file");
    });

    it("escapes single quotes", () => {
      expect(escapeQueryString("it's a test")).toBe("it\\'s a test");
    });

    it("escapes both backslashes and single quotes", () => {
      expect(escapeQueryString("path\\to\\file's name")).toBe(
        "path\\\\to\\\\file\\'s name",
      );
    });

    it("handles empty string", () => {
      expect(escapeQueryString("")).toBe("");
    });

    it("handles multiple consecutive special characters", () => {
      expect(escapeQueryString("file'''name")).toBe("file\\'\\'\\'name");
    });
  });

  describe("buildNameQuery", () => {
    it("builds exact match query by default", () => {
      expect(buildNameQuery("document.txt")).toBe("name = 'document.txt'");
    });

    it("builds exact match query when exact is true", () => {
      expect(buildNameQuery("document.txt", true)).toBe(
        "name = 'document.txt'",
      );
    });

    it("builds contains query when exact is false", () => {
      expect(buildNameQuery("document", false)).toBe(
        "name contains 'document'",
      );
    });

    it("escapes special characters in name", () => {
      expect(buildNameQuery("file's name")).toBe("name = 'file\\'s name'");
    });

    it("escapes backslashes in name", () => {
      expect(buildNameQuery("path\\file")).toBe("name = 'path\\\\file'");
    });
  });

  describe("buildParentQuery", () => {
    it("builds parent query with folder ID", () => {
      expect(buildParentQuery("abc123")).toBe("'abc123' in parents");
    });

    it("builds parent query with root", () => {
      expect(buildParentQuery("root")).toBe("'root' in parents");
    });
  });

  describe("buildFullTextQuery", () => {
    it("builds full text search query", () => {
      expect(buildFullTextQuery("meeting notes")).toBe(
        "fullText contains 'meeting notes'",
      );
    });

    it("escapes special characters", () => {
      expect(buildFullTextQuery("client's report")).toBe(
        "fullText contains 'client\\'s report'",
      );
    });
  });

  describe("buildMimeTypeQuery", () => {
    it("builds MIME type query for folder", () => {
      expect(buildMimeTypeQuery("application/vnd.google-apps.folder")).toBe(
        "mimeType = 'application/vnd.google-apps.folder'",
      );
    });

    it("builds MIME type query for document", () => {
      expect(buildMimeTypeQuery("application/vnd.google-apps.document")).toBe(
        "mimeType = 'application/vnd.google-apps.document'",
      );
    });
  });

  describe("combineQueries", () => {
    it("combines two queries with and", () => {
      expect(combineQueries("name = 'test'", "trashed = false")).toBe(
        "name = 'test' and trashed = false",
      );
    });

    it("combines multiple queries", () => {
      expect(
        combineQueries("'root' in parents", "name = 'doc'", "trashed = false"),
      ).toBe("'root' in parents and name = 'doc' and trashed = false");
    });

    it("handles single query", () => {
      expect(combineQueries("name = 'test'")).toBe("name = 'test'");
    });

    it("filters out empty strings", () => {
      expect(combineQueries("name = 'test'", "", "trashed = false")).toBe(
        "name = 'test' and trashed = false",
      );
    });

    it("returns empty string for no conditions", () => {
      expect(combineQueries()).toBe("");
    });

    it("returns empty string for all empty conditions", () => {
      expect(combineQueries("", "", "")).toBe("");
    });
  });
});
