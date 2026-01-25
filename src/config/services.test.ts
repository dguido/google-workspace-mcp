import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  SERVICE_NAMES,
  getEnabledServices,
  isServiceEnabled,
  areUnifiedToolsEnabled,
  resetServiceConfig,
  isToonEnabled,
} from "./services.js";

describe("Service Configuration", () => {
  const originalEnv = process.env.GOOGLE_WORKSPACE_SERVICES;

  beforeEach(() => {
    resetServiceConfig();
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.GOOGLE_WORKSPACE_SERVICES;
    } else {
      process.env.GOOGLE_WORKSPACE_SERVICES = originalEnv;
    }
    resetServiceConfig();
  });

  describe("SERVICE_NAMES", () => {
    it("contains all expected services", () => {
      expect(SERVICE_NAMES).toEqual(["drive", "docs", "sheets", "slides", "calendar", "gmail"]);
    });
  });

  describe("getEnabledServices", () => {
    it("enables all services when env var is not set", () => {
      delete process.env.GOOGLE_WORKSPACE_SERVICES;
      const enabled = getEnabledServices();
      expect(enabled.size).toBe(6);
      expect([...enabled].sort()).toEqual(
        ["calendar", "docs", "drive", "gmail", "sheets", "slides"].sort(),
      );
    });

    it("enables no services when env var is empty", () => {
      process.env.GOOGLE_WORKSPACE_SERVICES = "";
      const enabled = getEnabledServices();
      expect(enabled.size).toBe(0);
    });

    it("enables no services when env var is whitespace only", () => {
      process.env.GOOGLE_WORKSPACE_SERVICES = "   ";
      const enabled = getEnabledServices();
      expect(enabled.size).toBe(0);
    });

    it("enables only specified services", () => {
      process.env.GOOGLE_WORKSPACE_SERVICES = "drive,gmail";
      const enabled = getEnabledServices();
      expect(enabled.size).toBe(2);
      expect(enabled.has("drive")).toBe(true);
      expect(enabled.has("gmail")).toBe(true);
      expect(enabled.has("docs")).toBe(false);
    });

    it("handles case insensitive service names", () => {
      process.env.GOOGLE_WORKSPACE_SERVICES = "DRIVE,Gmail,Docs";
      const enabled = getEnabledServices();
      expect(enabled.size).toBe(3);
      expect(enabled.has("drive")).toBe(true);
      expect(enabled.has("gmail")).toBe(true);
      expect(enabled.has("docs")).toBe(true);
    });

    it("handles whitespace around service names", () => {
      process.env.GOOGLE_WORKSPACE_SERVICES = " drive , gmail , docs ";
      const enabled = getEnabledServices();
      expect(enabled.size).toBe(3);
      expect(enabled.has("drive")).toBe(true);
      expect(enabled.has("gmail")).toBe(true);
      expect(enabled.has("docs")).toBe(true);
    });

    it("warns about unknown services but still enables valid ones", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      process.env.GOOGLE_WORKSPACE_SERVICES = "drive,foo,gmail,bar";

      const enabled = getEnabledServices();

      expect(enabled.size).toBe(2);
      expect(enabled.has("drive")).toBe(true);
      expect(enabled.has("gmail")).toBe(true);
      expect(warnSpy).toHaveBeenCalledOnce();
      expect(warnSpy.mock.calls[0][0]).toContain("Unknown services: foo, bar");
      expect(warnSpy.mock.calls[0][0]).toContain(
        "Valid: drive, docs, sheets, slides, calendar, gmail",
      );

      warnSpy.mockRestore();
    });

    it("caches the result on repeated calls", () => {
      process.env.GOOGLE_WORKSPACE_SERVICES = "drive";
      const first = getEnabledServices();
      const second = getEnabledServices();
      expect(first).toBe(second); // Same reference
    });

    it("handles single service", () => {
      process.env.GOOGLE_WORKSPACE_SERVICES = "calendar";
      const enabled = getEnabledServices();
      expect(enabled.size).toBe(1);
      expect(enabled.has("calendar")).toBe(true);
    });

    it("handles all services explicitly listed", () => {
      process.env.GOOGLE_WORKSPACE_SERVICES = "drive,docs,sheets,slides,calendar,gmail";
      const enabled = getEnabledServices();
      expect(enabled.size).toBe(6);
    });

    it("ignores empty items from multiple commas", () => {
      process.env.GOOGLE_WORKSPACE_SERVICES = "drive,,gmail,,,calendar";
      const enabled = getEnabledServices();
      expect(enabled.size).toBe(3);
      expect(enabled.has("drive")).toBe(true);
      expect(enabled.has("gmail")).toBe(true);
      expect(enabled.has("calendar")).toBe(true);
    });
  });

  describe("isServiceEnabled", () => {
    it("returns true for enabled services", () => {
      process.env.GOOGLE_WORKSPACE_SERVICES = "drive,gmail";
      expect(isServiceEnabled("drive")).toBe(true);
      expect(isServiceEnabled("gmail")).toBe(true);
    });

    it("returns false for disabled services", () => {
      process.env.GOOGLE_WORKSPACE_SERVICES = "drive,gmail";
      expect(isServiceEnabled("docs")).toBe(false);
      expect(isServiceEnabled("sheets")).toBe(false);
      expect(isServiceEnabled("slides")).toBe(false);
      expect(isServiceEnabled("calendar")).toBe(false);
    });

    it("returns true for all services when env var not set", () => {
      delete process.env.GOOGLE_WORKSPACE_SERVICES;
      for (const service of SERVICE_NAMES) {
        expect(isServiceEnabled(service)).toBe(true);
      }
    });
  });

  describe("areUnifiedToolsEnabled", () => {
    it("returns true when drive, docs, sheets, and slides are all enabled", () => {
      process.env.GOOGLE_WORKSPACE_SERVICES = "drive,docs,sheets,slides";
      expect(areUnifiedToolsEnabled()).toBe(true);
    });

    it("returns true when all services are enabled", () => {
      delete process.env.GOOGLE_WORKSPACE_SERVICES;
      expect(areUnifiedToolsEnabled()).toBe(true);
    });

    it("returns false when drive is missing", () => {
      process.env.GOOGLE_WORKSPACE_SERVICES = "docs,sheets,slides";
      expect(areUnifiedToolsEnabled()).toBe(false);
    });

    it("returns false when docs is missing", () => {
      process.env.GOOGLE_WORKSPACE_SERVICES = "drive,sheets,slides";
      expect(areUnifiedToolsEnabled()).toBe(false);
    });

    it("returns false when sheets is missing", () => {
      process.env.GOOGLE_WORKSPACE_SERVICES = "drive,docs,slides";
      expect(areUnifiedToolsEnabled()).toBe(false);
    });

    it("returns false when slides is missing", () => {
      process.env.GOOGLE_WORKSPACE_SERVICES = "drive,docs,sheets";
      expect(areUnifiedToolsEnabled()).toBe(false);
    });

    it("returns true with extra services beyond required four", () => {
      process.env.GOOGLE_WORKSPACE_SERVICES = "drive,docs,sheets,slides,gmail,calendar";
      expect(areUnifiedToolsEnabled()).toBe(true);
    });

    it("returns false when only calendar and gmail are enabled", () => {
      process.env.GOOGLE_WORKSPACE_SERVICES = "calendar,gmail";
      expect(areUnifiedToolsEnabled()).toBe(false);
    });
  });

  describe("resetServiceConfig", () => {
    it("clears cached config so env changes take effect", () => {
      process.env.GOOGLE_WORKSPACE_SERVICES = "drive";
      const first = getEnabledServices();
      expect(first.size).toBe(1);

      process.env.GOOGLE_WORKSPACE_SERVICES = "drive,gmail,calendar";
      // Without reset, cache returns old value
      const cached = getEnabledServices();
      expect(cached.size).toBe(1);

      resetServiceConfig();
      const fresh = getEnabledServices();
      expect(fresh.size).toBe(3);
    });
  });
});

describe("isToonEnabled", () => {
  const originalEnv = process.env.GOOGLE_WORKSPACE_TOON_FORMAT;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.GOOGLE_WORKSPACE_TOON_FORMAT;
    } else {
      process.env.GOOGLE_WORKSPACE_TOON_FORMAT = originalEnv;
    }
  });

  it("returns false by default when env var is not set", () => {
    delete process.env.GOOGLE_WORKSPACE_TOON_FORMAT;
    expect(isToonEnabled()).toBe(false);
  });

  it("returns true when env var is 'true'", () => {
    process.env.GOOGLE_WORKSPACE_TOON_FORMAT = "true";
    expect(isToonEnabled()).toBe(true);
  });

  it("returns false when env var is 'false'", () => {
    process.env.GOOGLE_WORKSPACE_TOON_FORMAT = "false";
    expect(isToonEnabled()).toBe(false);
  });

  it("returns false when env var is empty string", () => {
    process.env.GOOGLE_WORKSPACE_TOON_FORMAT = "";
    expect(isToonEnabled()).toBe(false);
  });

  it("returns false when env var is 'TRUE' (case sensitive)", () => {
    process.env.GOOGLE_WORKSPACE_TOON_FORMAT = "TRUE";
    expect(isToonEnabled()).toBe(false);
  });

  it("returns false when env var is '1'", () => {
    process.env.GOOGLE_WORKSPACE_TOON_FORMAT = "1";
    expect(isToonEnabled()).toBe(false);
  });

  it("returns false when env var is 'yes'", () => {
    process.env.GOOGLE_WORKSPACE_TOON_FORMAT = "yes";
    expect(isToonEnabled()).toBe(false);
  });
});
