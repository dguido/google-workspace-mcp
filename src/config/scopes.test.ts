import { describe, it, expect, afterEach } from "vitest";
import { getScopesForEnabledServices } from "./scopes.js";
import { resetServiceConfig } from "./services.js";

describe("getScopesForEnabledServices", () => {
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

  describe("default (write) mode", () => {
    it("returns write scopes for drive", () => {
      delete process.env.GOOGLE_WORKSPACE_READ_ONLY;
      process.env.GOOGLE_WORKSPACE_SERVICES = "drive";
      const scopes = getScopesForEnabledServices();
      expect(scopes).toContain("https://www.googleapis.com/auth/drive");
      expect(scopes).toContain("https://www.googleapis.com/auth/drive.file");
      expect(scopes).toContain("https://www.googleapis.com/auth/drive.readonly");
    });

    it("includes mail.google.com scope for gmail", () => {
      delete process.env.GOOGLE_WORKSPACE_READ_ONLY;
      process.env.GOOGLE_WORKSPACE_SERVICES = "gmail";
      const scopes = getScopesForEnabledServices();
      expect(scopes).toContain("https://mail.google.com/");
    });
  });

  describe("read-only mode", () => {
    it("returns only readonly scope for drive", () => {
      process.env.GOOGLE_WORKSPACE_READ_ONLY = "true";
      process.env.GOOGLE_WORKSPACE_SERVICES = "drive";
      const scopes = getScopesForEnabledServices();
      expect(scopes).toEqual(["https://www.googleapis.com/auth/drive.readonly"]);
    });

    it("returns gmail.readonly instead of mail.google.com", () => {
      process.env.GOOGLE_WORKSPACE_READ_ONLY = "true";
      process.env.GOOGLE_WORKSPACE_SERVICES = "gmail";
      const scopes = getScopesForEnabledServices();
      expect(scopes).toEqual(["https://www.googleapis.com/auth/gmail.readonly"]);
      expect(scopes).not.toContain("https://mail.google.com/");
    });

    it("returns readonly scopes for all services", () => {
      process.env.GOOGLE_WORKSPACE_READ_ONLY = "true";
      delete process.env.GOOGLE_WORKSPACE_SERVICES;
      const scopes = getScopesForEnabledServices();
      for (const scope of scopes) {
        expect(scope).toContain("readonly");
      }
    });

    it("respects GOOGLE_WORKSPACE_SERVICES filtering", () => {
      process.env.GOOGLE_WORKSPACE_READ_ONLY = "true";
      process.env.GOOGLE_WORKSPACE_SERVICES = "drive,calendar";
      const scopes = getScopesForEnabledServices();
      expect(scopes).toHaveLength(2);
      expect(scopes).toContain("https://www.googleapis.com/auth/drive.readonly");
      expect(scopes).toContain("https://www.googleapis.com/auth/calendar.readonly");
    });
  });
});
