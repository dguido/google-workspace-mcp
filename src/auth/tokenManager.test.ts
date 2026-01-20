import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs/promises";
import { OAuth2Client, Credentials } from "google-auth-library";
import { TokenManager } from "./tokenManager.js";

// Mock the fs module
vi.mock("fs/promises");

// Mock the utils module
vi.mock("./utils.js", async () => {
  const actual = await vi.importActual("./utils.js");
  return {
    ...actual,
    getSecureTokenPath: vi.fn(
      () => "/mock/path/.config/google-drive-mcp/tokens.json",
    ),
    getLegacyTokenPath: vi.fn(() => "/mock/path/.gcp-saved-tokens.json"),
    getAdditionalLegacyPaths: vi.fn(() => ["/mock/path/google-tokens.json"]),
  };
});

// Mock the logging module
vi.mock("../utils/logging.js", () => ({
  log: vi.fn(),
}));

describe("auth/tokenManager", () => {
  let oauth2Client: OAuth2Client;
  let tokenManager: TokenManager;

  const validTokens: Credentials = {
    access_token: "test-access-token",
    refresh_token: "test-refresh-token",
    expiry_date: Date.now() + 3600 * 1000, // 1 hour in the future
    token_type: "Bearer",
    scope: "https://www.googleapis.com/auth/drive",
  };

  const expiredTokens: Credentials = {
    access_token: "expired-access-token",
    refresh_token: "test-refresh-token",
    expiry_date: Date.now() - 1000, // Already expired
    token_type: "Bearer",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    oauth2Client = new OAuth2Client("test-client-id", "test-client-secret");
    tokenManager = new TokenManager(oauth2Client);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getTokenPath", () => {
    it("returns the configured token path", () => {
      const path = tokenManager.getTokenPath();

      expect(path).toBe("/mock/path/.config/google-drive-mcp/tokens.json");
    });
  });

  describe("loadSavedTokens", () => {
    it("loads tokens from secure path when file exists", async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(validTokens));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);

      const result = await tokenManager.loadSavedTokens();

      expect(result).toBe(true);
      expect(oauth2Client.credentials.access_token).toBe("test-access-token");
      expect(oauth2Client.credentials.refresh_token).toBe("test-refresh-token");
    });

    it("returns false when token file does not exist", async () => {
      const fileError = new Error("ENOENT") as NodeJS.ErrnoException;
      fileError.code = "ENOENT";

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.access).mockRejectedValue(fileError);

      const result = await tokenManager.loadSavedTokens();

      expect(result).toBe(false);
    });

    it("returns false for invalid token format", async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(null));

      const result = await tokenManager.loadSavedTokens();

      expect(result).toBe(false);
    });

    it("returns false for non-object token format", async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify("not-an-object"));

      const result = await tokenManager.loadSavedTokens();

      expect(result).toBe(false);
    });

    it("handles JSON parse errors gracefully", async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue("invalid json {{{");
      vi.mocked(fs.unlink).mockResolvedValue(undefined);

      const result = await tokenManager.loadSavedTokens();

      expect(result).toBe(false);
    });
  });

  describe("legacy token migration", () => {
    it("migrates tokens from legacy path when current file does not exist", async () => {
      const fileError = new Error("ENOENT") as NodeJS.ErrnoException;
      fileError.code = "ENOENT";

      // First call (checking current path) fails
      // Second call (checking legacy path) succeeds
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.access)
        .mockRejectedValueOnce(fileError) // Current path doesn't exist
        .mockResolvedValueOnce(undefined); // Legacy path exists
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(validTokens));
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.unlink).mockResolvedValue(undefined);

      const result = await tokenManager.loadSavedTokens();

      expect(result).toBe(true);
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it("skips invalid legacy token format", async () => {
      const fileError = new Error("ENOENT") as NodeJS.ErrnoException;
      fileError.code = "ENOENT";

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.access)
        .mockRejectedValueOnce(fileError) // Current path doesn't exist
        .mockResolvedValueOnce(undefined) // Legacy path 1 exists
        .mockRejectedValue(fileError); // No more paths
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(null)); // Invalid format

      const result = await tokenManager.loadSavedTokens();

      expect(result).toBe(false);
    });
  });

  describe("saveTokens", () => {
    it("saves tokens to secure path with proper permissions", async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await tokenManager.saveTokens(validTokens);

      expect(fs.writeFile).toHaveBeenCalledWith(
        "/mock/path/.config/google-drive-mcp/tokens.json",
        JSON.stringify(validTokens, null, 2),
        { mode: 0o600 },
      );
      expect(oauth2Client.credentials.access_token).toBe("test-access-token");
    });

    it("creates token directory if it does not exist", async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await tokenManager.saveTokens(validTokens);

      expect(fs.mkdir).toHaveBeenCalledWith(
        "/mock/path/.config/google-drive-mcp",
        {
          recursive: true,
        },
      );
    });

    it("throws error when save fails", async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockRejectedValue(new Error("Write failed"));

      await expect(tokenManager.saveTokens(validTokens)).rejects.toThrow(
        "Write failed",
      );
    });
  });

  describe("clearTokens", () => {
    it("clears credentials and removes token file", async () => {
      oauth2Client.setCredentials(validTokens);
      vi.mocked(fs.unlink).mockResolvedValue(undefined);

      await tokenManager.clearTokens();

      expect(oauth2Client.credentials).toEqual({});
      expect(fs.unlink).toHaveBeenCalledWith(
        "/mock/path/.config/google-drive-mcp/tokens.json",
      );
    });

    it("handles already deleted token file gracefully", async () => {
      const fileError = new Error("ENOENT") as NodeJS.ErrnoException;
      fileError.code = "ENOENT";

      oauth2Client.setCredentials(validTokens);
      vi.mocked(fs.unlink).mockRejectedValue(fileError);

      // Should not throw
      await expect(tokenManager.clearTokens()).resolves.toBeUndefined();
      expect(oauth2Client.credentials).toEqual({});
    });

    it("does not throw for other unlink errors", async () => {
      oauth2Client.setCredentials(validTokens);
      vi.mocked(fs.unlink).mockRejectedValue(new Error("Permission denied"));

      // Should not throw (best-effort)
      await expect(tokenManager.clearTokens()).resolves.toBeUndefined();
    });
  });

  describe("refreshTokensIfNeeded", () => {
    it("returns true when token is still valid", async () => {
      oauth2Client.setCredentials(validTokens);

      const result = await tokenManager.refreshTokensIfNeeded();

      expect(result).toBe(true);
    });

    it("returns false when no tokens are available", async () => {
      oauth2Client.setCredentials({});

      const result = await tokenManager.refreshTokensIfNeeded();

      expect(result).toBe(false);
    });

    it("detects tokens nearing expiry (5 minute buffer)", async () => {
      const nearlyExpiredTokens: Credentials = {
        access_token: "nearly-expired-token",
        refresh_token: "test-refresh-token",
        expiry_date: Date.now() + 4 * 60 * 1000, // 4 minutes from now (within 5 min buffer)
      };

      oauth2Client.setCredentials(nearlyExpiredTokens);
      oauth2Client.refreshAccessToken = vi.fn().mockResolvedValue({
        credentials: {
          ...validTokens,
          access_token: "new-access-token",
        },
      });
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify(nearlyExpiredTokens),
      );
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = await tokenManager.refreshTokensIfNeeded();

      expect(result).toBe(true);
      expect(oauth2Client.refreshAccessToken).toHaveBeenCalled();
    });

    it("handles refresh failure", async () => {
      oauth2Client.setCredentials(expiredTokens);
      oauth2Client.refreshAccessToken = vi
        .fn()
        .mockRejectedValue(new Error("Refresh failed"));

      const result = await tokenManager.refreshTokensIfNeeded();

      expect(result).toBe(false);
    });
  });

  describe("validateTokens", () => {
    it("loads and validates saved tokens", async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(validTokens));

      const result = await tokenManager.validateTokens();

      expect(result).toBe(true);
    });

    it("returns false when no saved tokens exist", async () => {
      const fileError = new Error("ENOENT") as NodeJS.ErrnoException;
      fileError.code = "ENOENT";

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.access).mockRejectedValue(fileError);

      const result = await tokenManager.validateTokens();

      expect(result).toBe(false);
    });

    it("triggers refresh when tokens are expired", async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(expiredTokens));
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      oauth2Client.refreshAccessToken = vi.fn().mockResolvedValue({
        credentials: {
          ...validTokens,
          access_token: "refreshed-token",
        },
      });

      const result = await tokenManager.validateTokens();

      expect(result).toBe(true);
      expect(oauth2Client.refreshAccessToken).toHaveBeenCalled();
    });
  });

  describe("token refresh event listener", () => {
    it("saves tokens when refresh event is triggered", async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(validTokens));
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      // Trigger the tokens event
      oauth2Client.emit("tokens", {
        access_token: "new-access-token",
        refresh_token: "new-refresh-token",
      });

      // Give the async handler time to execute
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(fs.writeFile).toHaveBeenCalled();
    });

    it("preserves existing refresh_token when not provided in new tokens", async () => {
      const existingTokens = {
        ...validTokens,
        refresh_token: "existing-refresh-token",
      };

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(existingTokens));
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      // Trigger the tokens event with no refresh_token
      oauth2Client.emit("tokens", {
        access_token: "new-access-token",
        // No refresh_token
      });

      // Give the async handler time to execute
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Check that writeFile was called with the preserved refresh_token
      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      if (writeCall) {
        const writtenData = JSON.parse(writeCall[1] as string);
        expect(writtenData.refresh_token).toBe("existing-refresh-token");
      }
    });
  });
});
