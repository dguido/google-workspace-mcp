import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as path from "path";
import * as os from "os";
import {
  getSecureTokenPath,
  getKeysFilePath,
  getConfigDirectory,
  generateCredentialsErrorMessage,
  getActiveProfile,
  getProfileDirectory,
  getEnvVarCredentials,
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
    it("returns custom path when GOOGLE_WORKSPACE_MCP_TOKEN_PATH is set", () => {
      const customPath = "/custom/path/to/tokens.json";
      process.env.GOOGLE_WORKSPACE_MCP_TOKEN_PATH = customPath;

      const result = getSecureTokenPath();

      expect(result).toBe(path.resolve(customPath));
    });

    it("uses XDG_CONFIG_HOME when set", () => {
      delete process.env.GOOGLE_WORKSPACE_MCP_TOKEN_PATH;
      const xdgConfigHome = "/custom/config";
      process.env.XDG_CONFIG_HOME = xdgConfigHome;

      const result = getSecureTokenPath();

      expect(result).toBe(path.join(xdgConfigHome, "google-workspace-mcp", "tokens.json"));
    });

    it("falls back to ~/.config when XDG_CONFIG_HOME is not set", () => {
      delete process.env.GOOGLE_WORKSPACE_MCP_TOKEN_PATH;
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
      process.env.GOOGLE_WORKSPACE_MCP_TOKEN_PATH = "./relative/tokens.json";

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

  describe("getKeysFilePath", () => {
    it("returns default path in config directory", () => {
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

    it("respects XDG_CONFIG_HOME for default path", () => {
      const xdgConfigHome = "/custom/config";
      process.env.XDG_CONFIG_HOME = xdgConfigHome;

      const result = getKeysFilePath();

      expect(result).toBe(path.join(xdgConfigHome, "google-workspace-mcp", "credentials.json"));
    });
  });

  describe("getActiveProfile", () => {
    it("returns null when env var is not set", () => {
      delete process.env.GOOGLE_WORKSPACE_MCP_PROFILE;
      expect(getActiveProfile()).toBeNull();
    });

    it("returns null when env var is empty string", () => {
      process.env.GOOGLE_WORKSPACE_MCP_PROFILE = "";
      expect(getActiveProfile()).toBeNull();
    });

    it("returns profile name when valid", () => {
      process.env.GOOGLE_WORKSPACE_MCP_PROFILE = "work";
      expect(getActiveProfile()).toBe("work");
    });

    it("accepts hyphens and underscores", () => {
      process.env.GOOGLE_WORKSPACE_MCP_PROFILE = "my-work_profile";
      expect(getActiveProfile()).toBe("my-work_profile");
    });

    it("throws on path traversal attempt", () => {
      process.env.GOOGLE_WORKSPACE_MCP_PROFILE = "../escape";
      expect(() => getActiveProfile()).toThrow("Invalid profile name");
    });

    it("throws on slash in name", () => {
      process.env.GOOGLE_WORKSPACE_MCP_PROFILE = "a/b";
      expect(() => getActiveProfile()).toThrow("Invalid profile name");
    });

    it("throws on name longer than 64 chars", () => {
      process.env.GOOGLE_WORKSPACE_MCP_PROFILE = "a".repeat(65);
      expect(() => getActiveProfile()).toThrow("Invalid profile name");
    });

    it("accepts name exactly 64 chars", () => {
      const name = "a".repeat(64);
      process.env.GOOGLE_WORKSPACE_MCP_PROFILE = name;
      expect(getActiveProfile()).toBe(name);
    });

    it("throws on backslash in name", () => {
      process.env.GOOGLE_WORKSPACE_MCP_PROFILE = "a\\b";
      expect(() => getActiveProfile()).toThrow("Invalid profile name");
    });

    it("throws on dot-only names", () => {
      process.env.GOOGLE_WORKSPACE_MCP_PROFILE = "..";
      expect(() => getActiveProfile()).toThrow("Invalid profile name");
    });

    it("throws on single dot name", () => {
      process.env.GOOGLE_WORKSPACE_MCP_PROFILE = ".";
      expect(() => getActiveProfile()).toThrow("Invalid profile name");
    });

    it("throws on null byte in name", () => {
      process.env.GOOGLE_WORKSPACE_MCP_PROFILE = "a\x00b";
      expect(() => getActiveProfile()).toThrow("Invalid profile name");
    });

    it("throws on unicode characters", () => {
      process.env.GOOGLE_WORKSPACE_MCP_PROFILE = "caf\u00e9";
      expect(() => getActiveProfile()).toThrow("Invalid profile name");
    });
  });

  describe("getProfileDirectory", () => {
    it("returns profiles subdirectory under config dir", () => {
      delete process.env.XDG_CONFIG_HOME;
      const result = getProfileDirectory("work");
      const expected = path.join(
        os.homedir(),
        ".config",
        "google-workspace-mcp",
        "profiles",
        "work",
      );
      expect(result).toBe(expected);
    });
  });

  describe("getSecureTokenPath with profile", () => {
    it("resolves to profile tokens path", () => {
      delete process.env.GOOGLE_WORKSPACE_MCP_TOKEN_PATH;
      delete process.env.XDG_CONFIG_HOME;
      process.env.GOOGLE_WORKSPACE_MCP_PROFILE = "personal";

      const result = getSecureTokenPath();
      const expected = path.join(
        os.homedir(),
        ".config",
        "google-workspace-mcp",
        "profiles",
        "personal",
        "tokens.json",
      );
      expect(result).toBe(expected);
    });

    it("explicit token path overrides profile", () => {
      process.env.GOOGLE_WORKSPACE_MCP_TOKEN_PATH = "/override/tokens.json";
      process.env.GOOGLE_WORKSPACE_MCP_PROFILE = "personal";

      const result = getSecureTokenPath();
      expect(result).toBe("/override/tokens.json");
    });
  });

  describe("getKeysFilePath with profile", () => {
    it("resolves to profile credentials path", () => {
      delete process.env.XDG_CONFIG_HOME;
      process.env.GOOGLE_WORKSPACE_MCP_PROFILE = "work";

      const result = getKeysFilePath();
      const expected = path.join(
        os.homedir(),
        ".config",
        "google-workspace-mcp",
        "profiles",
        "work",
        "credentials.json",
      );
      expect(result).toBe(expected);
    });
  });

  describe("generateCredentialsErrorMessage", () => {
    it("returns a non-empty string", () => {
      const result = generateCredentialsErrorMessage();

      expect(result).toBeTruthy();
      expect(typeof result).toBe("string");
    });

    it("includes env var instructions", () => {
      const result = generateCredentialsErrorMessage();

      expect(result).toContain("GOOGLE_CLIENT_ID");
      expect(result).toContain("GOOGLE_CLIENT_SECRET");
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

    it("includes batch API enablement URL", () => {
      const result = generateCredentialsErrorMessage();

      expect(result).toContain("flows/enableapi");
    });

    it("includes custom token path instructions", () => {
      const result = generateCredentialsErrorMessage();

      expect(result).toContain("GOOGLE_WORKSPACE_MCP_TOKEN_PATH");
    });

    it("includes profile info when profile is active", () => {
      process.env.GOOGLE_WORKSPACE_MCP_PROFILE = "work";
      const result = generateCredentialsErrorMessage();

      expect(result).toContain('Active profile: "work"');
      expect(result).toContain("profiles");
    });
  });

  describe("getEnvVarCredentials", () => {
    it("returns null when GOOGLE_CLIENT_ID not set", () => {
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;

      expect(getEnvVarCredentials()).toBeNull();
    });

    it("returns null when GOOGLE_CLIENT_ID is empty", () => {
      process.env.GOOGLE_CLIENT_ID = "";

      expect(getEnvVarCredentials()).toBeNull();
    });

    it("returns null when GOOGLE_CLIENT_ID is whitespace", () => {
      process.env.GOOGLE_CLIENT_ID = "   ";

      expect(getEnvVarCredentials()).toBeNull();
    });

    it("returns credentials when GOOGLE_CLIENT_ID is set", () => {
      process.env.GOOGLE_CLIENT_ID = "test.apps.googleusercontent.com";
      delete process.env.GOOGLE_CLIENT_SECRET;

      const result = getEnvVarCredentials();

      expect(result).not.toBeNull();
      expect(result!.client_id).toBe("test.apps.googleusercontent.com");
      expect(result!.client_secret).toBeUndefined();
      expect(result!.redirect_uris).toEqual(["http://127.0.0.1/oauth2callback"]);
    });

    it("includes client_secret when GOOGLE_CLIENT_SECRET is set", () => {
      process.env.GOOGLE_CLIENT_ID = "test.apps.googleusercontent.com";
      process.env.GOOGLE_CLIENT_SECRET = "my-secret";

      const result = getEnvVarCredentials();

      expect(result).not.toBeNull();
      expect(result!.client_secret).toBe("my-secret");
    });

    it("trims whitespace from both values", () => {
      process.env.GOOGLE_CLIENT_ID = "  test.apps.googleusercontent.com  ";
      process.env.GOOGLE_CLIENT_SECRET = "  my-secret  ";

      const result = getEnvVarCredentials();

      expect(result).not.toBeNull();
      expect(result!.client_id).toBe("test.apps.googleusercontent.com");
      expect(result!.client_secret).toBe("my-secret");
    });

    it("returns undefined client_secret when GOOGLE_CLIENT_SECRET is empty", () => {
      process.env.GOOGLE_CLIENT_ID = "test.apps.googleusercontent.com";
      process.env.GOOGLE_CLIENT_SECRET = "";

      const result = getEnvVarCredentials();

      expect(result).not.toBeNull();
      expect(result!.client_secret).toBeUndefined();
    });

    it("ignores GOOGLE_CLIENT_SECRET when GOOGLE_CLIENT_ID not set", () => {
      delete process.env.GOOGLE_CLIENT_ID;
      process.env.GOOGLE_CLIENT_SECRET = "orphan-secret";

      expect(getEnvVarCredentials()).toBeNull();
    });
  });
});
