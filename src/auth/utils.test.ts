import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as path from "path";
import * as os from "os";
import {
  getSecureTokenPath,
  getLegacyTokenPath,
  getAdditionalLegacyPaths,
  getKeysFilePath,
  generateCredentialsErrorMessage,
} from "./utils.js";

describe("auth/utils", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset environment variables before each test
    vi.resetModules();
  });

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };
  });

  describe("getSecureTokenPath", () => {
    it("returns custom path when GOOGLE_DRIVE_MCP_TOKEN_PATH is set", () => {
      const customPath = "/custom/path/to/tokens.json";
      process.env.GOOGLE_DRIVE_MCP_TOKEN_PATH = customPath;

      const result = getSecureTokenPath();

      expect(result).toBe(path.resolve(customPath));
    });

    it("uses XDG_CONFIG_HOME when set", () => {
      delete process.env.GOOGLE_DRIVE_MCP_TOKEN_PATH;
      const xdgConfigHome = "/custom/config";
      process.env.XDG_CONFIG_HOME = xdgConfigHome;

      const result = getSecureTokenPath();

      expect(result).toBe(
        path.join(xdgConfigHome, "google-drive-mcp", "tokens.json"),
      );
    });

    it("falls back to ~/.config when XDG_CONFIG_HOME is not set", () => {
      delete process.env.GOOGLE_DRIVE_MCP_TOKEN_PATH;
      delete process.env.XDG_CONFIG_HOME;

      const result = getSecureTokenPath();

      const expectedPath = path.join(
        os.homedir(),
        ".config",
        "google-drive-mcp",
        "tokens.json",
      );
      expect(result).toBe(expectedPath);
    });

    it("resolves relative custom paths to absolute", () => {
      process.env.GOOGLE_DRIVE_MCP_TOKEN_PATH = "./relative/tokens.json";

      const result = getSecureTokenPath();

      expect(path.isAbsolute(result)).toBe(true);
    });
  });

  describe("getLegacyTokenPath", () => {
    it("returns path in project root with legacy filename", () => {
      const result = getLegacyTokenPath();

      expect(result).toContain(".gcp-saved-tokens.json");
      expect(path.isAbsolute(result)).toBe(true);
    });
  });

  describe("getAdditionalLegacyPaths", () => {
    it("includes GOOGLE_TOKEN_PATH when set", () => {
      const tokenPath = "/custom/google-tokens.json";
      process.env.GOOGLE_TOKEN_PATH = tokenPath;

      const result = getAdditionalLegacyPaths();

      expect(result).toContain(tokenPath);
    });

    it("includes cwd-based paths", () => {
      delete process.env.GOOGLE_TOKEN_PATH;

      const result = getAdditionalLegacyPaths();

      expect(result).toContain(path.join(process.cwd(), "google-tokens.json"));
      expect(result).toContain(
        path.join(process.cwd(), ".gcp-saved-tokens.json"),
      );
    });

    it("filters out undefined values", () => {
      delete process.env.GOOGLE_TOKEN_PATH;

      const result = getAdditionalLegacyPaths();

      expect(result.every((p) => p !== undefined && p !== null)).toBe(true);
    });

    it("returns array without GOOGLE_TOKEN_PATH when not set", () => {
      delete process.env.GOOGLE_TOKEN_PATH;

      const result = getAdditionalLegacyPaths();

      // Should have at least the two cwd-based paths
      expect(result.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("getKeysFilePath", () => {
    it("returns custom path when GOOGLE_DRIVE_OAUTH_CREDENTIALS is set", () => {
      const customPath = "/custom/credentials.json";
      process.env.GOOGLE_DRIVE_OAUTH_CREDENTIALS = customPath;

      const result = getKeysFilePath();

      expect(result).toBe(path.resolve(customPath));
    });

    it("returns default path when GOOGLE_DRIVE_OAUTH_CREDENTIALS is not set", () => {
      delete process.env.GOOGLE_DRIVE_OAUTH_CREDENTIALS;

      const result = getKeysFilePath();

      expect(result).toContain("gcp-oauth.keys.json");
      expect(path.isAbsolute(result)).toBe(true);
    });

    it("resolves relative custom paths to absolute", () => {
      process.env.GOOGLE_DRIVE_OAUTH_CREDENTIALS =
        "./relative/credentials.json";

      const result = getKeysFilePath();

      expect(path.isAbsolute(result)).toBe(true);
    });
  });

  describe("generateCredentialsErrorMessage", () => {
    it("returns a non-empty string", () => {
      const result = generateCredentialsErrorMessage();

      expect(result).toBeTruthy();
      expect(typeof result).toBe("string");
    });

    it("includes environment variable instructions", () => {
      const result = generateCredentialsErrorMessage();

      expect(result).toContain("GOOGLE_DRIVE_OAUTH_CREDENTIALS");
    });

    it("includes default file path information", () => {
      const result = generateCredentialsErrorMessage();

      expect(result).toContain("gcp-oauth.keys.json");
    });

    it("includes token storage location", () => {
      const result = generateCredentialsErrorMessage();

      expect(result).toContain("tokens.json");
    });

    it("includes Google Cloud Console instructions", () => {
      const result = generateCredentialsErrorMessage();

      expect(result).toContain("Google Cloud Console");
      expect(result).toContain("console.cloud.google.com");
    });

    it("includes custom token path instructions", () => {
      const result = generateCredentialsErrorMessage();

      expect(result).toContain("GOOGLE_DRIVE_MCP_TOKEN_PATH");
    });
  });
});
