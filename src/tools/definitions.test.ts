import { describe, it, expect, afterEach } from "vitest";
import { getAllTools } from "./definitions.js";
import { resetServiceConfig } from "../config/services.js";

describe("getAllTools", () => {
  const originalServices = process.env.GOOGLE_WORKSPACE_SERVICES;
  const originalReadOnly = process.env.GOOGLE_WORKSPACE_READ_ONLY;

  afterEach(() => {
    if (originalServices === undefined) {
      delete process.env.GOOGLE_WORKSPACE_SERVICES;
    } else {
      process.env.GOOGLE_WORKSPACE_SERVICES = originalServices;
    }
    if (originalReadOnly === undefined) {
      delete process.env.GOOGLE_WORKSPACE_READ_ONLY;
    } else {
      process.env.GOOGLE_WORKSPACE_READ_ONLY = originalReadOnly;
    }
    resetServiceConfig();
  });

  describe("default mode", () => {
    it("includes write tools when read-only mode is off", () => {
      delete process.env.GOOGLE_WORKSPACE_READ_ONLY;
      delete process.env.GOOGLE_WORKSPACE_SERVICES;
      const tools = getAllTools();
      const names = tools.map((t) => t.name);
      expect(names).toContain("create_text_file");
      expect(names).toContain("send_email");
      expect(names).toContain("delete_item");
    });
  });

  describe("read-only mode", () => {
    it("returns only readOnly tools", () => {
      process.env.GOOGLE_WORKSPACE_READ_ONLY = "true";
      delete process.env.GOOGLE_WORKSPACE_SERVICES;
      const tools = getAllTools();
      for (const tool of tools) {
        expect(tool.readOnly).toBe(true);
      }
    });

    it("excludes specific write tools", () => {
      process.env.GOOGLE_WORKSPACE_READ_ONLY = "true";
      delete process.env.GOOGLE_WORKSPACE_SERVICES;
      const names = getAllTools().map((t) => t.name);
      expect(names).not.toContain("create_text_file");
      expect(names).not.toContain("send_email");
      expect(names).not.toContain("delete_item");
      expect(names).not.toContain("star_file");
      expect(names).not.toContain("sheet_tabs");
      expect(names).not.toContain("update_google_doc");
      expect(names).not.toContain("create_event");
    });

    it("includes specific read tools", () => {
      process.env.GOOGLE_WORKSPACE_READ_ONLY = "true";
      delete process.env.GOOGLE_WORKSPACE_SERVICES;
      const names = getAllTools().map((t) => t.name);
      expect(names).toContain("search");
      expect(names).toContain("read_email");
      expect(names).toContain("get_google_doc_content");
      expect(names).toContain("list_trash");
      expect(names).toContain("get_file_content");
      expect(names).toContain("list_calendars");
      expect(names).toContain("list_contacts");
    });

    it("always includes discovery tools", () => {
      process.env.GOOGLE_WORKSPACE_READ_ONLY = "true";
      delete process.env.GOOGLE_WORKSPACE_SERVICES;
      const names = getAllTools().map((t) => t.name);
      expect(names).toContain("list_tools");
      expect(names).toContain("get_status");
    });

    it("returns exactly 30 read-only tools", () => {
      process.env.GOOGLE_WORKSPACE_READ_ONLY = "true";
      delete process.env.GOOGLE_WORKSPACE_SERVICES;
      const tools = getAllTools();
      expect(tools.length).toBe(30);
    });
  });
});
