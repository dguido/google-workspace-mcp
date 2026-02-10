import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs/promises";
import { validateOAuthConfig, isOAuthConfigured } from "./config-validator.js";

vi.mock("fs/promises");

// Mock auth utils - provide real getEnvVarCredentials
vi.mock("../auth/utils.js", async () => {
  const actual = await vi.importActual("../auth/utils.js");
  return {
    ...actual,
    getKeysFilePath: vi.fn(() => "/mock/credentials.json"),
    getSecureTokenPath: vi.fn(() => "/mock/config/tokens.json"),
    credentialsFileExists: vi.fn(() => Promise.resolve(false)),
  };
});

describe("config-validator", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure token dir check succeeds by default
    vi.mocked(fs.access).mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("validateOAuthConfig with env vars", () => {
    it("valid when env vars set with correct format", async () => {
      process.env.GOOGLE_CLIENT_ID = "12345.apps.googleusercontent.com";
      process.env.GOOGLE_CLIENT_SECRET = "secret";

      const result = await validateOAuthConfig();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("error when client_id has invalid format", async () => {
      process.env.GOOGLE_CLIENT_ID = "not-valid-format";
      process.env.GOOGLE_CLIENT_SECRET = "secret";

      const result = await validateOAuthConfig();

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe("INVALID_CLIENT");
    });

    it("warning when GOOGLE_CLIENT_SECRET not set", async () => {
      process.env.GOOGLE_CLIENT_ID = "12345.apps.googleusercontent.com";
      delete process.env.GOOGLE_CLIENT_SECRET;

      const result = await validateOAuthConfig();

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain("No client_secret found - some auth flows may not work");
    });

    it("warning for short client_id", async () => {
      process.env.GOOGLE_CLIENT_ID = "short.apps.googleusercontent.com";
      process.env.GOOGLE_CLIENT_SECRET = "secret";

      const result = await validateOAuthConfig();

      expect(result.warnings).toContain("client_id appears unusually short - may be truncated");
    });

    it("falls back to file validation when env vars not set", async () => {
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;

      const result = await validateOAuthConfig();

      // No credentials file exists (mock default)
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe("OAUTH_NOT_CONFIGURED");
    });
  });

  describe("isOAuthConfigured", () => {
    it("returns true when env vars set", async () => {
      process.env.GOOGLE_CLIENT_ID = "12345.apps.googleusercontent.com";

      const result = await isOAuthConfigured();

      expect(result).toBe(true);
    });

    it("returns false when no env vars and no file", async () => {
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;

      const result = await isOAuthConfigured();

      expect(result).toBe(false);
    });
  });
});
