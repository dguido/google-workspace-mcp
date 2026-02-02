import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as path from "path";
import * as os from "os";
import {
  getSecureTokenPath,
  getKeysFilePath,
  getConfigDirectory,
  getLegacyKeysFilePath,
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

      expect(result).toBe(path.join(xdgConfigHome, "google-workspace-mcp", "tokens.json"));
    });

    it("falls back to ~/.config when XDG_CONFIG_HOME is not set", () => {
      delete process.env.GOOGLE_DRIVE_MCP_TOKEN_PATH;
      delete process.env.XDG_CONFIG_HOME;

      const result = getSecureTokenPath();

      const expectedPath = path.join(
        os.homedir(),
        ".config",
        "google-workspace-mcp",
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

  describe("getConfigDirectory", () => {
    it("uses XDG_CONFIG_HOME when set", () => {
      const xdgConfigHome = "/custom/config";
      process.env.XDG_CONFIG_HOME = xdgConfigHome;

      const result = getConfigDirectory();

      expect(result).toBe(path.join(xdgConfigHome, "google-workspace-mcp"));
    });

    it("falls back to ~/.config when XDG_CONFIG_HOME is not set", () => {
      delete process.env.XDG_CONFIG_HOME;

      const result = getConfigDirectory();

      expect(result).toBe(path.join(os.homedir(), ".config", "google-workspace-mcp"));
    });
  });

  describe("getLegacyKeysFilePath", () => {
    it("returns cwd-based path", () => {
      const result = getLegacyKeysFilePath();

      expect(result).toBe(path.join(process.cwd(), "gcp-oauth.keys.json"));
    });

    it("returns absolute path", () => {
      const result = getLegacyKeysFilePath();

      expect(path.isAbsolute(result)).toBe(true);
    });
  });

  describe("getKeysFilePath", () => {
    it("returns custom path when GOOGLE_DRIVE_OAUTH_CREDENTIALS is set", () => {
      const customPath = "/custom/credentials.json";
      process.env.GOOGLE_DRIVE_OAUTH_CREDENTIALS = customPath;

      const result = getKeysFilePath();

      expect(result).toBe(path.resolve(customPath));
    });

    it("returns new default path in config directory when env var not set", () => {
      delete process.env.GOOGLE_DRIVE_OAUTH_CREDENTIALS;
      delete process.env.XDG_CONFIG_HOME;

      const result = getKeysFilePath();

      const expectedPath = path.join(
        os.homedir(),
        ".config",
        "google-workspace-mcp",
        "credentials.json",
      );
      expect(result).toBe(expectedPath);
    });

    it("respects XDG_CONFIG_HOME for new default path", () => {
      delete process.env.GOOGLE_DRIVE_OAUTH_CREDENTIALS;
      const xdgConfigHome = "/custom/config";
      process.env.XDG_CONFIG_HOME = xdgConfigHome;

      const result = getKeysFilePath();

      expect(result).toBe(path.join(xdgConfigHome, "google-workspace-mcp", "credentials.json"));
    });

    it("resolves relative custom paths to absolute", () => {
      process.env.GOOGLE_DRIVE_OAUTH_CREDENTIALS = "./relative/credentials.json";

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

      expect(result).toContain("credentials.json");
      expect(result).toContain("google-workspace-mcp");
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

      expect(result).toContain("GOOGLE_WORKSPACE_MCP_TOKEN_PATH");
    });
  });
});
