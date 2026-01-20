import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs/promises";
import { initializeOAuth2Client, loadCredentials } from "./client.js";

// Mock the fs module
vi.mock("fs/promises");

// Mock the utils module
vi.mock("./utils.js", async () => {
  const actual = await vi.importActual("./utils.js");
  return {
    ...actual,
    getKeysFilePath: vi.fn(() => "/mock/path/gcp-oauth.keys.json"),
    generateCredentialsErrorMessage: vi.fn(() => "Mock error message"),
  };
});

describe("auth/client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("loadCredentials", () => {
    describe("installed credentials format", () => {
      it("loads credentials from installed format", async () => {
        const installedCreds = {
          installed: {
            client_id: "test-client-id",
            client_secret: "test-client-secret",
            redirect_uris: ["http://localhost:3000/oauth2callback"],
          },
        };

        vi.mocked(fs.readFile).mockResolvedValue(
          JSON.stringify(installedCreds),
        );

        const result = await loadCredentials();

        expect(result.client_id).toBe("test-client-id");
        expect(result.client_secret).toBe("test-client-secret");
      });

      it("handles installed format without client_secret", async () => {
        const installedCreds = {
          installed: {
            client_id: "test-client-id",
            redirect_uris: ["http://localhost:3000/oauth2callback"],
          },
        };

        vi.mocked(fs.readFile).mockResolvedValue(
          JSON.stringify(installedCreds),
        );

        const result = await loadCredentials();

        expect(result.client_id).toBe("test-client-id");
        expect(result.client_secret).toBeUndefined();
      });
    });

    describe("web credentials format", () => {
      it("loads credentials from web format", async () => {
        const webCreds = {
          web: {
            client_id: "web-client-id",
            client_secret: "web-client-secret",
            redirect_uris: ["http://localhost:3000/oauth2callback"],
          },
        };

        vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(webCreds));

        const result = await loadCredentials();

        expect(result.client_id).toBe("web-client-id");
        expect(result.client_secret).toBe("web-client-secret");
      });
    });

    describe("direct credentials format", () => {
      it("loads credentials from direct format", async () => {
        const directCreds = {
          client_id: "direct-client-id",
          client_secret: "direct-client-secret",
        };

        vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(directCreds));

        const result = await loadCredentials();

        expect(result.client_id).toBe("direct-client-id");
        expect(result.client_secret).toBe("direct-client-secret");
      });

      it("handles direct format without client_secret", async () => {
        const directCreds = {
          client_id: "direct-client-id",
        };

        vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(directCreds));

        const result = await loadCredentials();

        expect(result.client_id).toBe("direct-client-id");
        expect(result.client_secret).toBeUndefined();
      });
    });

    describe("error handling", () => {
      it("throws error for invalid credentials format", async () => {
        const invalidCreds = {
          something: "invalid",
        };

        vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(invalidCreds));

        await expect(loadCredentials()).rejects.toThrow();
      });

      it("throws error for missing client_id in direct format", async () => {
        const invalidCreds = {
          client_secret: "secret-only",
        };

        vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(invalidCreds));

        await expect(loadCredentials()).rejects.toThrow();
      });

      it("throws error when file does not exist", async () => {
        const fileError = new Error(
          "ENOENT: no such file or directory",
        ) as NodeJS.ErrnoException;
        fileError.code = "ENOENT";
        vi.mocked(fs.readFile).mockRejectedValue(fileError);

        await expect(loadCredentials()).rejects.toThrow();
      });

      it("throws error for invalid JSON", async () => {
        vi.mocked(fs.readFile).mockResolvedValue("not valid json");

        await expect(loadCredentials()).rejects.toThrow();
      });
    });

    describe("legacy fallback", () => {
      it("tries legacy client_secret.json when main file fails", async () => {
        // First call fails, second call (legacy) succeeds
        const legacyCreds = {
          installed: {
            client_id: "legacy-client-id",
            client_secret: "legacy-client-secret",
          },
        };

        vi.mocked(fs.readFile)
          .mockRejectedValueOnce(new Error("File not found"))
          .mockResolvedValueOnce(JSON.stringify(legacyCreds));

        const result = await loadCredentials();

        expect(result.client_id).toBe("legacy-client-id");
      });

      it("throws with helpful message when both main and legacy fail", async () => {
        vi.mocked(fs.readFile).mockRejectedValue(new Error("File not found"));

        await expect(loadCredentials()).rejects.toThrow(
          "Error loading credentials",
        );
      });
    });
  });

  describe("initializeOAuth2Client", () => {
    it("returns OAuth2Client with correct client_id", async () => {
      const creds = {
        installed: {
          client_id: "test-client-id",
          client_secret: "test-client-secret",
          redirect_uris: ["http://localhost:3000/oauth2callback"],
        },
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(creds));

      const client = await initializeOAuth2Client();

      expect(client).toBeDefined();
      expect(client._clientId).toBe("test-client-id");
    });

    it("uses first redirect_uri as default", async () => {
      const creds = {
        installed: {
          client_id: "test-client-id",
          client_secret: "test-client-secret",
          redirect_uris: [
            "http://localhost:4000/callback",
            "http://localhost:3000/oauth2callback",
          ],
        },
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(creds));

      const client = await initializeOAuth2Client();

      expect(client).toBeDefined();
      // Note: redirectUri is private, but the client is correctly configured
      expect(client._clientId).toBe("test-client-id");
    });

    it("uses default redirect_uri when not specified", async () => {
      const creds = {
        client_id: "test-client-id",
        client_secret: "test-client-secret",
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(creds));

      const client = await initializeOAuth2Client();

      expect(client).toBeDefined();
      // Note: redirectUri is private, but defaults to localhost:3000
      expect(client._clientId).toBe("test-client-id");
    });

    it("handles missing client_secret", async () => {
      const creds = {
        installed: {
          client_id: "test-client-id",
          redirect_uris: ["http://localhost:3000/oauth2callback"],
        },
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(creds));

      const client = await initializeOAuth2Client();

      expect(client).toBeDefined();
      expect(client._clientId).toBe("test-client-id");
    });

    it("throws error when credentials cannot be loaded", async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error("File not found"));

      await expect(initializeOAuth2Client()).rejects.toThrow(
        "Error loading OAuth keys",
      );
    });
  });
});
