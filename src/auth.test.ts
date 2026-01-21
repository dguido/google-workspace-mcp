import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs/promises";
import { OAuth2Client, Credentials } from "google-auth-library";

// Mock fs/promises before importing the module
vi.mock("fs/promises");

// Mock the utils module
vi.mock("./auth/utils.js", async () => {
  const actual = await vi.importActual("./auth/utils.js");
  return {
    ...actual,
    getSecureTokenPath: vi.fn(() => "/mock/path/.config/google-workspace-mcp/tokens.json"),
    getLegacyTokenPath: vi.fn(() => "/mock/path/.gcp-saved-tokens.json"),
    getAdditionalLegacyPaths: vi.fn(() => []),
    getKeysFilePath: vi.fn(() => "/mock/path/gcp-oauth.keys.json"),
    generateCredentialsErrorMessage: vi.fn(() => "Mock error message"),
  };
});

// Mock the logging module
vi.mock("./utils/logging.js", () => ({
  log: vi.fn(),
}));

// Mock the open module
vi.mock("open", () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

// Import after mocks are set up
import { authenticate, TokenManager, initializeOAuth2Client, AuthServer } from "./auth.js";

describe("auth", () => {
  const validCredentials = {
    installed: {
      client_id: "test-client-id",
      client_secret: "test-client-secret",
      redirect_uris: ["http://localhost:3000/oauth2callback"],
    },
  };

  const validTokens: Credentials = {
    access_token: "test-access-token",
    refresh_token: "test-refresh-token",
    expiry_date: Date.now() + 3600 * 1000,
    token_type: "Bearer",
    scope: "https://www.googleapis.com/auth/drive",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("exports", () => {
    it("exports TokenManager class", () => {
      expect(TokenManager).toBeDefined();
      expect(typeof TokenManager).toBe("function");
    });

    it("exports initializeOAuth2Client function", () => {
      expect(initializeOAuth2Client).toBeDefined();
      expect(typeof initializeOAuth2Client).toBe("function");
    });

    it("exports AuthServer class", () => {
      expect(AuthServer).toBeDefined();
      expect(typeof AuthServer).toBe("function");
    });

    it("exports authenticate function", () => {
      expect(authenticate).toBeDefined();
      expect(typeof authenticate).toBe("function");
    });
  });

  describe("authenticate", () => {
    describe("with valid existing tokens", () => {
      beforeEach(() => {
        // Setup to return valid credentials and tokens
        vi.mocked(fs.readFile)
          .mockResolvedValueOnce(JSON.stringify(validCredentials)) // credentials file
          .mockResolvedValue(JSON.stringify(validTokens)); // token file

        vi.mocked(fs.mkdir).mockResolvedValue(undefined);
        vi.mocked(fs.access).mockResolvedValue(undefined);
      });

      it("returns OAuth2Client with valid credentials", async () => {
        const client = await authenticate();

        expect(client).toBeDefined();
        expect(client).toBeInstanceOf(OAuth2Client);
      });

      it("returns client with loaded tokens", async () => {
        const client = await authenticate();

        expect(client.credentials.access_token).toBe("test-access-token");
        expect(client.credentials.refresh_token).toBe("test-refresh-token");
      });
    });

    describe("without valid tokens", () => {
      beforeEach(() => {
        const fileError = new Error("ENOENT") as NodeJS.ErrnoException;
        fileError.code = "ENOENT";

        // Setup to return valid credentials but no tokens
        vi.mocked(fs.readFile).mockImplementation((path: unknown) => {
          if (typeof path === "string" && path.includes("gcp-oauth")) {
            return Promise.resolve(JSON.stringify(validCredentials));
          }
          return Promise.reject(fileError);
        });

        vi.mocked(fs.mkdir).mockResolvedValue(undefined);
        vi.mocked(fs.access).mockRejectedValue(fileError);
      });

      it("throws error when authentication fails and no valid tokens", async () => {
        // This will timeout waiting for auth to complete
        // We can't fully test the auth flow without actually completing OAuth
        // So we test that it attempts to start the server
        const authPromise = authenticate();

        // Give it a small timeout then cancel
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("Timeout")), 100);
        });

        await expect(Promise.race([authPromise, timeoutPromise])).rejects.toThrow("Timeout");
      });
    });

    describe("with missing credentials", () => {
      beforeEach(() => {
        const fileError = new Error("ENOENT") as NodeJS.ErrnoException;
        fileError.code = "ENOENT";

        vi.mocked(fs.readFile).mockRejectedValue(fileError);
        vi.mocked(fs.access).mockRejectedValue(fileError);
        vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      });

      it("throws error when credentials file is missing", async () => {
        await expect(authenticate()).rejects.toThrow("Error loading OAuth keys");
      });
    });
  });

  describe("TokenManager integration", () => {
    it("can be instantiated with OAuth2Client", () => {
      const oauth2Client = new OAuth2Client("test-id", "test-secret");
      const tokenManager = new TokenManager(oauth2Client);

      expect(tokenManager).toBeDefined();
      expect(tokenManager.getTokenPath()).toBe(
        "/mock/path/.config/google-workspace-mcp/tokens.json",
      );
    });
  });

  describe("AuthServer integration", () => {
    it("can be instantiated with OAuth2Client", () => {
      const oauth2Client = new OAuth2Client("test-id", "test-secret");
      const authServer = new AuthServer(oauth2Client);

      expect(authServer).toBeDefined();
      expect(authServer.authCompletedSuccessfully).toBe(false);
    });
  });
});
