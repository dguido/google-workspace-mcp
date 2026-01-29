import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { OAuth2Client } from "google-auth-library";
import { AuthServer } from "./server.js";
import * as fs from "fs/promises";
import http from "http";

// Mock fs/promises
vi.mock("fs/promises");

// Mock the client module
vi.mock("./client.js", () => ({
  loadCredentials: vi.fn().mockResolvedValue({
    client_id: "test-client-id",
    client_secret: "test-client-secret",
  }),
}));

// Mock the utils module
vi.mock("./utils.js", async () => {
  const actual = await vi.importActual("./utils.js");
  return {
    ...actual,
    getSecureTokenPath: vi.fn(() => "/mock/path/.config/google-workspace-mcp/tokens.json"),
  };
});

// Mock the logging module
vi.mock("../utils/logging.js", () => ({
  log: vi.fn(),
}));

// Mock the open module
vi.mock("open", () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

describe("auth/server", () => {
  let oauth2Client: OAuth2Client;
  let authServer: AuthServer;

  beforeEach(() => {
    vi.clearAllMocks();
    oauth2Client = new OAuth2Client("test-client-id", "test-client-secret");
    authServer = new AuthServer(oauth2Client);
  });

  afterEach(async () => {
    // Ensure server is stopped after each test
    await authServer.stop();
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("initializes with OAuth2Client", () => {
      expect(authServer).toBeDefined();
      expect(authServer.authCompletedSuccessfully).toBe(false);
    });
  });

  describe("getRunningPort", () => {
    it("returns null when server is not running", () => {
      expect(authServer.getRunningPort()).toBeNull();
    });
  });

  describe("start", () => {
    describe("with valid existing tokens", () => {
      beforeEach(() => {
        // Setup valid tokens
        const validTokens = {
          access_token: "valid-access-token",
          refresh_token: "valid-refresh-token",
          expiry_date: Date.now() + 3600 * 1000,
        };

        vi.mocked(fs.mkdir).mockResolvedValue(undefined);
        vi.mocked(fs.access).mockResolvedValue(undefined);
        vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(validTokens));
      });

      it("returns true when valid tokens exist", async () => {
        const result = await authServer.start(false);

        expect(result).toBe(true);
        expect(authServer.authCompletedSuccessfully).toBe(true);
      });

      it("does not start server when valid tokens exist", async () => {
        await authServer.start(false);

        expect(authServer.getRunningPort()).toBeNull();
      });
    });

    describe("without valid tokens", () => {
      beforeEach(() => {
        const fileError = new Error("ENOENT") as NodeJS.ErrnoException;
        fileError.code = "ENOENT";

        vi.mocked(fs.mkdir).mockResolvedValue(undefined);
        vi.mocked(fs.access).mockRejectedValue(fileError);
      });

      it("starts server on ephemeral port", async () => {
        const result = await authServer.start(false);

        expect(result).toBe(true);
        const port = authServer.getRunningPort();
        expect(port).not.toBeNull();
        // Ephemeral port should be > 0 (assigned by OS)
        expect(port).toBeGreaterThan(0);
      });

      it("binds to 127.0.0.1 loopback address", async () => {
        await authServer.start(false);

        const port = authServer.getRunningPort();
        expect(port).not.toBeNull();

        // Verify we can connect to 127.0.0.1 but the server is listening
        const response = await new Promise<{ statusCode: number }>((resolve, reject) => {
          const req = http.request(
            { hostname: "127.0.0.1", port: port!, path: "/", method: "GET" },
            (res) => resolve({ statusCode: res.statusCode || 0 }),
          );
          req.on("error", reject);
          req.end();
        });
        expect(response.statusCode).toBe(200);
      });
    });
  });

  describe("stop", () => {
    it("stops a running server", async () => {
      const fileError = new Error("ENOENT") as NodeJS.ErrnoException;
      fileError.code = "ENOENT";

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.access).mockRejectedValue(fileError);

      await authServer.start(false);
      expect(authServer.getRunningPort()).not.toBeNull();

      await authServer.stop();
      expect(authServer.getRunningPort()).toBeNull();
    });

    it("handles stop when server is not running", async () => {
      // Should not throw
      await expect(authServer.stop()).resolves.toBeUndefined();
    });
  });

  describe("HTTP server endpoints", () => {
    let serverPort: number;
    let localAuthServer: AuthServer;

    beforeEach(async () => {
      const fileError = new Error("ENOENT") as NodeJS.ErrnoException;
      fileError.code = "ENOENT";

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.access).mockRejectedValue(fileError);

      localAuthServer = new AuthServer(new OAuth2Client("test-client-id", "test-client-secret"));
      await localAuthServer.start(false);
      serverPort = localAuthServer.getRunningPort() as number;
    });

    afterEach(async () => {
      await localAuthServer.stop();
    });

    const makeRequest = (
      path: string,
    ): Promise<{
      statusCode: number;
      body: string;
      headers: http.IncomingHttpHeaders;
    }> => {
      return new Promise((resolve, reject) => {
        const req = http.request(
          {
            hostname: "127.0.0.1",
            port: serverPort,
            path,
            method: "GET",
          },
          (res) => {
            let body = "";
            res.on("data", (chunk) => (body += chunk));
            res.on("end", () => {
              resolve({
                statusCode: res.statusCode || 0,
                body,
                headers: res.headers,
              });
            });
          },
        );
        req.on("error", reject);
        req.end();
      });
    };

    it("serves auth link on root path", async () => {
      const response = await makeRequest("/");

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toBe("text/html");
      expect(response.body).toContain("Google Drive Authentication");
      expect(response.body).toContain("Authenticate with Google");
    });
  });

  describe("ephemeral port binding", () => {
    it("multiple servers get different ephemeral ports", async () => {
      const fileError = new Error("ENOENT") as NodeJS.ErrnoException;
      fileError.code = "ENOENT";

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.access).mockRejectedValue(fileError);

      // Start first server
      const server1 = new AuthServer(new OAuth2Client("test-client-id", "test-client-secret"));
      await server1.start(false);
      const port1 = server1.getRunningPort();

      // Start second server (should get different ephemeral port)
      const server2 = new AuthServer(new OAuth2Client("test-client-id", "test-client-secret"));
      await server2.start(false);
      const port2 = server2.getRunningPort();

      expect(port1).not.toBeNull();
      expect(port2).not.toBeNull();
      expect(port1).not.toBe(port2);
      // Both should be ephemeral ports (> 0)
      expect(port1).toBeGreaterThan(0);
      expect(port2).toBeGreaterThan(0);

      // Cleanup
      await server1.stop();
      await server2.stop();
    });
  });

  describe("authCompletedSuccessfully flag", () => {
    it("is false initially", () => {
      expect(authServer.authCompletedSuccessfully).toBe(false);
    });

    it("is true after successful token validation", async () => {
      const validTokens = {
        access_token: "valid-access-token",
        refresh_token: "valid-refresh-token",
        expiry_date: Date.now() + 3600 * 1000,
      };

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(validTokens));

      await authServer.start(false);

      expect(authServer.authCompletedSuccessfully).toBe(true);
    });
  });

  describe("PKCE (RFC 7636)", () => {
    let localAuthServer: AuthServer;
    let serverPort: number;

    beforeEach(async () => {
      const fileError = new Error("ENOENT") as NodeJS.ErrnoException;
      fileError.code = "ENOENT";

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.access).mockRejectedValue(fileError);

      localAuthServer = new AuthServer(new OAuth2Client("test-client-id", "test-client-secret"));
      await localAuthServer.start(false);
      serverPort = localAuthServer.getRunningPort() as number;
    });

    afterEach(async () => {
      await localAuthServer.stop();
    });

    it("includes code_challenge and code_challenge_method in auth URL", async () => {
      const response = await new Promise<{ body: string }>((resolve, reject) => {
        const req = http.request(
          { hostname: "127.0.0.1", port: serverPort, path: "/", method: "GET" },
          (res) => {
            let body = "";
            res.on("data", (chunk) => (body += chunk));
            res.on("end", () => resolve({ body }));
          },
        );
        req.on("error", reject);
        req.end();
      });

      // The auth URL in the page should contain PKCE parameters
      expect(response.body).toContain("code_challenge=");
      expect(response.body).toContain("code_challenge_method=S256");
    });

    it("includes state parameter in auth URL", async () => {
      const response = await new Promise<{ body: string }>((resolve, reject) => {
        const req = http.request(
          { hostname: "127.0.0.1", port: serverPort, path: "/", method: "GET" },
          (res) => {
            let body = "";
            res.on("data", (chunk) => (body += chunk));
            res.on("end", () => resolve({ body }));
          },
        );
        req.on("error", reject);
        req.end();
      });

      // The auth URL should contain state parameter for CSRF protection
      expect(response.body).toContain("state=");
    });
  });

  describe("state validation (RFC 8252 section 8.9)", () => {
    let localAuthServer: AuthServer;
    let serverPort: number;

    beforeEach(async () => {
      const fileError = new Error("ENOENT") as NodeJS.ErrnoException;
      fileError.code = "ENOENT";

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.access).mockRejectedValue(fileError);

      localAuthServer = new AuthServer(new OAuth2Client("test-client-id", "test-client-secret"));
      await localAuthServer.start(false);
      serverPort = localAuthServer.getRunningPort() as number;
    });

    afterEach(async () => {
      await localAuthServer.stop();
    });

    it("rejects callback with mismatched state parameter", async () => {
      const response = await new Promise<{ statusCode: number; body: string }>(
        (resolve, reject) => {
          const req = http.request(
            {
              hostname: "127.0.0.1",
              port: serverPort,
              path: "/oauth2callback?code=test-code&state=invalid-state",
              method: "GET",
            },
            (res) => {
              let body = "";
              res.on("data", (chunk) => (body += chunk));
              res.on("end", () => resolve({ statusCode: res.statusCode || 0, body }));
            },
          );
          req.on("error", reject);
          req.end();
        },
      );

      expect(response.statusCode).toBe(400);
      expect(response.body).toContain("Invalid state parameter");
      expect(response.body).toContain("CSRF");
    });

    it("rejects callback with missing state parameter when state is expected", async () => {
      const response = await new Promise<{ statusCode: number; body: string }>(
        (resolve, reject) => {
          const req = http.request(
            {
              hostname: "127.0.0.1",
              port: serverPort,
              path: "/oauth2callback?code=test-code",
              method: "GET",
            },
            (res) => {
              let body = "";
              res.on("data", (chunk) => (body += chunk));
              res.on("end", () => resolve({ statusCode: res.statusCode || 0, body }));
            },
          );
          req.on("error", reject);
          req.end();
        },
      );

      expect(response.statusCode).toBe(400);
      expect(response.body).toContain("Invalid state parameter");
    });
  });
});
