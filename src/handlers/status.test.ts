import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { drive_v3 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { handleGetStatus, getUptimeSeconds, type StatusData } from "./status.js";

vi.mock("fs/promises", () => ({
  access: vi.fn(),
  readFile: vi.fn(),
  mkdir: vi.fn(),
}));

vi.mock("../auth/utils.js", () => ({
  getSecureTokenPath: vi.fn(() => "/mock/.tokens/google-workspace-mcp.json"),
  getKeysFilePath: vi.fn(() => "/mock/gcp-oauth.keys.json"),
}));

vi.mock("../auth/tokenManager.js", () => ({
  getLastTokenAuthError: vi.fn(() => null),
}));

vi.mock("../errors/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../errors/index.js")>();
  return {
    ...actual,
    validateOAuthConfig: vi.fn(() => Promise.resolve({ valid: true, errors: [], warnings: [] })),
  };
});

vi.mock("../config/services.js", () => ({
  getEnabledServices: vi.fn(() => new Set(["drive", "docs", "sheets"])),
  SERVICE_NAMES: ["drive", "docs", "sheets", "slides", "calendar", "gmail"],
  isToonEnabled: vi.fn(() => false),
}));

vi.mock("../utils/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/index.js")>();
  return {
    ...actual,
    log: vi.fn(),
    withTimeout: <T>(promise: Promise<T>) => promise,
  };
});

function createMockDrive(): drive_v3.Drive {
  return {
    about: {
      get: vi.fn(),
    },
  } as unknown as drive_v3.Drive;
}

function createMockAuthClient(credentials?: {
  access_token?: string;
  expiry_date?: number;
  refresh_token?: string;
}): OAuth2Client {
  return {
    credentials: credentials || {},
  } as unknown as OAuth2Client;
}

describe("getUptimeSeconds", () => {
  it("returns a positive number", () => {
    const uptime = getUptimeSeconds();
    expect(uptime).toBeGreaterThanOrEqual(0);
    expect(typeof uptime).toBe("number");
  });
});

describe("handleGetStatus", () => {
  let mockDrive: drive_v3.Drive;
  let mockAuthClient: OAuth2Client;
  let fs: typeof import("fs/promises");

  beforeEach(async () => {
    vi.clearAllMocks();
    mockDrive = createMockDrive();
    mockAuthClient = createMockAuthClient({
      access_token: "valid-token",
      expiry_date: Date.now() + 3600000,
      refresh_token: "refresh-token",
    });
    fs = await import("fs/promises");
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe("basic status", () => {
    it("returns correct structure for basic status", async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          access_token: "test-token",
          refresh_token: "test-refresh",
          expiry_date: Date.now() + 3600000,
          scope: "https://www.googleapis.com/auth/drive",
        }),
      );

      const result = await handleGetStatus(mockAuthClient, mockDrive, "2.0.0", {});

      expect(result.isError).toBe(false);
      const data = result.structuredContent as StatusData;
      expect(data.status).toBe("ok");
      expect(data.version).toBe("2.0.0");
      expect(data.uptime_seconds).toBeGreaterThanOrEqual(0);
      expect(data.timestamp).toBeDefined();
      expect(data.auth).toBeDefined();
      expect(data.auth.configured).toBe(true);
      expect(data.enabled_services).toContain("drive");
    });

    it("returns error status when credentials file is missing", async () => {
      vi.mocked(fs.access).mockRejectedValue(
        Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
      );
      vi.mocked(fs.readFile).mockRejectedValue(
        Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
      );

      const result = await handleGetStatus(null, null, "2.0.0", {});

      expect(result.isError).toBe(false);
      const data = result.structuredContent as StatusData;
      expect(data.status).toBe("error");
      expect(data.auth.configured).toBe(false);
    });

    it("handles malformed token file gracefully", async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockImplementation(async (path) => {
        if (String(path).includes("keys")) {
          return JSON.stringify({
            installed: {
              client_id: "test.apps.googleusercontent.com",
              client_secret: "secret",
            },
          });
        }
        return "not valid json{{{";
      });

      // Pass null authClient so it relies on token file (which is malformed)
      const result = await handleGetStatus(null, mockDrive, "2.0.0", {});

      expect(result.isError).toBe(false);
      const data = result.structuredContent as StatusData;
      expect(data.auth.token_status).toBe("invalid");
    });

    it("reports expired token correctly", async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          access_token: "expired-token",
          refresh_token: "test-refresh",
          expiry_date: Date.now() - 3600000, // Expired 1 hour ago
          scope: "https://www.googleapis.com/auth/drive",
        }),
      );

      const expiredAuthClient = createMockAuthClient({
        access_token: "expired-token",
        expiry_date: Date.now() - 3600000,
        refresh_token: "refresh-token",
      });

      const result = await handleGetStatus(expiredAuthClient, mockDrive, "2.0.0", {});

      expect(result.isError).toBe(false);
      const data = result.structuredContent as StatusData;
      expect(data.auth.token_status).toBe("expired");
      expect(data.status).toBe("warning");
    });

    it("reports error status when token is expired without refresh token", async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          access_token: "expired-token",
          expiry_date: Date.now() - 3600000,
          scope: "https://www.googleapis.com/auth/drive",
        }),
      );

      const result = await handleGetStatus(null, mockDrive, "2.0.0", {});

      expect(result.isError).toBe(false);
      const data = result.structuredContent as StatusData;
      expect(data.auth.token_status).toBe("expired");
      expect(data.status).toBe("error");
    });

    it("reports error status when token is missing", async () => {
      vi.mocked(fs.access).mockImplementation(async (path) => {
        if (String(path).includes("keys")) {
          return undefined;
        }
        throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
      });
      vi.mocked(fs.readFile).mockImplementation(async (path) => {
        if (String(path).includes("keys")) {
          return JSON.stringify({
            installed: {
              client_id: "test.apps.googleusercontent.com",
              client_secret: "secret",
            },
          });
        }
        throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
      });

      const result = await handleGetStatus(null, mockDrive, "2.0.0", {});

      expect(result.isError).toBe(false);
      const data = result.structuredContent as StatusData;
      expect(data.auth.token_status).toBe("missing");
      expect(data.status).toBe("error");
    });

    it("overrides token status when authClient has valid credentials", async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          access_token: "expired-token",
          expiry_date: Date.now() - 3600000, // File shows expired
          scope: "https://www.googleapis.com/auth/drive",
        }),
      );

      // But authClient has valid credentials
      const validAuthClient = createMockAuthClient({
        access_token: "valid-token",
        expiry_date: Date.now() + 3600000,
      });

      const result = await handleGetStatus(validAuthClient, mockDrive, "2.0.0", {});

      expect(result.isError).toBe(false);
      const data = result.structuredContent as StatusData;
      expect(data.auth.token_status).toBe("valid");
    });
  });

  describe("schema validation", () => {
    it("fails when validate_with_api is true without diagnose", async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          access_token: "test-token",
          refresh_token: "test-refresh",
          expiry_date: Date.now() + 3600000,
          scope: "https://www.googleapis.com/auth/drive",
        }),
      );

      const result = await handleGetStatus(mockAuthClient, mockDrive, "2.0.0", {
        validate_with_api: true,
        diagnose: false,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0]).toHaveProperty("text");
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("validate_with_api requires diagnose");
    });
  });

  describe("diagnose mode", () => {
    it("includes config_checks in diagnose mode", async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockImplementation(async (path) => {
        if (String(path).includes("keys")) {
          return JSON.stringify({
            installed: {
              client_id: "test.apps.googleusercontent.com",
              client_secret: "secret",
            },
          });
        }
        return JSON.stringify({
          access_token: "test-token",
          refresh_token: "test-refresh",
          expiry_date: Date.now() + 3600000,
          scope: "https://www.googleapis.com/auth/drive",
          created_at: new Date().toISOString(),
        });
      });

      const result = await handleGetStatus(mockAuthClient, mockDrive, "2.0.0", {
        diagnose: true,
      });

      expect(result.isError).toBe(false);
      const data = result.structuredContent as StatusData;
      expect(data.config_checks).toBeDefined();
      expect(Array.isArray(data.config_checks)).toBe(true);
      expect(data.recommendations).toBeDefined();
    });

    it("validates with API when requested", async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockImplementation(async (path) => {
        if (String(path).includes("keys")) {
          return JSON.stringify({
            installed: {
              client_id: "test.apps.googleusercontent.com",
              client_secret: "secret",
            },
          });
        }
        return JSON.stringify({
          access_token: "test-token",
          refresh_token: "test-refresh",
          expiry_date: Date.now() + 3600000,
          scope: "https://www.googleapis.com/auth/drive",
          created_at: new Date().toISOString(),
        });
      });

      vi.mocked(mockDrive.about.get).mockResolvedValue({
        data: { user: { emailAddress: "test@example.com" } },
      } as never);

      const result = await handleGetStatus(mockAuthClient, mockDrive, "2.0.0", {
        diagnose: true,
        validate_with_api: true,
      });

      expect(result.isError).toBe(false);
      const data = result.structuredContent as StatusData;
      expect(data.api_validation).toBeDefined();
      expect(data.api_validation?.success).toBe(true);
      expect(data.api_validation?.user_email).toBe("test@example.com");
    });

    it("handles API validation failure", async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockImplementation(async (path) => {
        if (String(path).includes("keys")) {
          return JSON.stringify({
            installed: {
              client_id: "test.apps.googleusercontent.com",
              client_secret: "secret",
            },
          });
        }
        return JSON.stringify({
          access_token: "test-token",
          refresh_token: "test-refresh",
          expiry_date: Date.now() + 3600000,
          scope: "https://www.googleapis.com/auth/drive",
          created_at: new Date().toISOString(),
        });
      });

      vi.mocked(mockDrive.about.get).mockRejectedValue(new Error("API access denied"));

      const result = await handleGetStatus(mockAuthClient, mockDrive, "2.0.0", {
        diagnose: true,
        validate_with_api: true,
      });

      expect(result.isError).toBe(false);
      const data = result.structuredContent as StatusData;
      expect(data.api_validation).toBeDefined();
      expect(data.api_validation?.success).toBe(false);
      expect(data.api_validation?.error).toContain("API access denied");
    });

    it("returns error when drive service is null during API validation", async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockImplementation(async (path) => {
        if (String(path).includes("keys")) {
          return JSON.stringify({
            installed: {
              client_id: "test.apps.googleusercontent.com",
              client_secret: "secret",
            },
          });
        }
        return JSON.stringify({
          access_token: "test-token",
          refresh_token: "test-refresh",
          expiry_date: Date.now() + 3600000,
          scope: "https://www.googleapis.com/auth/drive",
          created_at: new Date().toISOString(),
        });
      });

      const result = await handleGetStatus(mockAuthClient, null, "2.0.0", {
        diagnose: true,
        validate_with_api: true,
      });

      expect(result.isError).toBe(false);
      const data = result.structuredContent as StatusData;
      expect(data.api_validation?.success).toBe(false);
      expect(data.api_validation?.error).toContain("Drive service not initialized");
    });
  });

  describe("checkCredentialsFile (via diagnose mode)", () => {
    it("returns error when credentials file does not exist", async () => {
      vi.mocked(fs.access).mockImplementation(async (path) => {
        if (String(path).includes("keys")) {
          throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
        }
        return undefined;
      });
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          access_token: "test-token",
          refresh_token: "test-refresh",
          expiry_date: Date.now() + 3600000,
          scope: "https://www.googleapis.com/auth/drive",
          created_at: new Date().toISOString(),
        }),
      );

      const result = await handleGetStatus(mockAuthClient, mockDrive, "2.0.0", {
        diagnose: true,
      });

      expect(result.isError).toBe(false);
      const data = result.structuredContent as StatusData;
      const credCheck = data.config_checks?.find((c) => c.name === "credentials_file");
      expect(credCheck).toBeDefined();
      expect(credCheck?.status).toBe("error");
      expect(credCheck?.message).toContain("not found");
      expect(credCheck?.fix).toBeDefined();
    });

    it("returns error when credentials file is missing client_id", async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockImplementation(async (path) => {
        if (String(path).includes("keys")) {
          return JSON.stringify({
            installed: {
              client_secret: "secret",
            },
          });
        }
        return JSON.stringify({
          access_token: "test-token",
          refresh_token: "test-refresh",
          expiry_date: Date.now() + 3600000,
          scope: "https://www.googleapis.com/auth/drive",
          created_at: new Date().toISOString(),
        });
      });

      const result = await handleGetStatus(mockAuthClient, mockDrive, "2.0.0", {
        diagnose: true,
      });

      expect(result.isError).toBe(false);
      const data = result.structuredContent as StatusData;
      const credCheck = data.config_checks?.find((c) => c.name === "credentials_file");
      expect(credCheck).toBeDefined();
      expect(credCheck?.status).toBe("error");
      expect(credCheck?.message).toContain("missing client_id");
    });

    it("returns error when client_id has invalid format", async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockImplementation(async (path) => {
        if (String(path).includes("keys")) {
          return JSON.stringify({
            installed: {
              client_id: "invalid-client-id",
              client_secret: "secret",
            },
          });
        }
        return JSON.stringify({
          access_token: "test-token",
          refresh_token: "test-refresh",
          expiry_date: Date.now() + 3600000,
          scope: "https://www.googleapis.com/auth/drive",
          created_at: new Date().toISOString(),
        });
      });

      const result = await handleGetStatus(mockAuthClient, mockDrive, "2.0.0", {
        diagnose: true,
      });

      expect(result.isError).toBe(false);
      const data = result.structuredContent as StatusData;
      const credCheck = data.config_checks?.find((c) => c.name === "credentials_file");
      expect(credCheck).toBeDefined();
      expect(credCheck?.status).toBe("error");
      expect(credCheck?.message).toContain("Invalid client_id format");
    });

    it("returns ok status for valid credentials file", async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockImplementation(async (path) => {
        if (String(path).includes("keys")) {
          return JSON.stringify({
            installed: {
              client_id: "test.apps.googleusercontent.com",
              client_secret: "secret",
            },
          });
        }
        return JSON.stringify({
          access_token: "test-token",
          refresh_token: "test-refresh",
          expiry_date: Date.now() + 3600000,
          scope: "https://www.googleapis.com/auth/drive",
          created_at: new Date().toISOString(),
        });
      });

      const result = await handleGetStatus(mockAuthClient, mockDrive, "2.0.0", {
        diagnose: true,
      });

      expect(result.isError).toBe(false);
      const data = result.structuredContent as StatusData;
      const credCheck = data.config_checks?.find((c) => c.name === "credentials_file");
      expect(credCheck).toBeDefined();
      expect(credCheck?.status).toBe("ok");
      expect(credCheck?.message).toContain("Valid credentials file");
    });

    it("returns error when credentials file has parse error", async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockImplementation(async (path) => {
        if (String(path).includes("keys")) {
          return "not valid json{{{";
        }
        return JSON.stringify({
          access_token: "test-token",
          refresh_token: "test-refresh",
          expiry_date: Date.now() + 3600000,
          scope: "https://www.googleapis.com/auth/drive",
          created_at: new Date().toISOString(),
        });
      });

      const result = await handleGetStatus(mockAuthClient, mockDrive, "2.0.0", {
        diagnose: true,
      });

      expect(result.isError).toBe(false);
      const data = result.structuredContent as StatusData;
      const credCheck = data.config_checks?.find((c) => c.name === "credentials_file");
      expect(credCheck).toBeDefined();
      expect(credCheck?.status).toBe("error");
      expect(credCheck?.message).toContain("Failed to parse");
    });
  });

  describe("checkTokenFile (via diagnose mode)", () => {
    it("returns warning when token file does not exist", async () => {
      vi.mocked(fs.access).mockImplementation(async (path) => {
        if (String(path).includes("tokens") || String(path).includes("workspace")) {
          throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
        }
        return undefined;
      });
      vi.mocked(fs.readFile).mockImplementation(async (path) => {
        if (String(path).includes("keys")) {
          return JSON.stringify({
            installed: {
              client_id: "test.apps.googleusercontent.com",
              client_secret: "secret",
            },
          });
        }
        throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
      });

      const result = await handleGetStatus(mockAuthClient, mockDrive, "2.0.0", {
        diagnose: true,
      });

      expect(result.isError).toBe(false);
      const data = result.structuredContent as StatusData;
      const tokenCheck = data.config_checks?.find((c) => c.name === "token_file");
      expect(tokenCheck).toBeDefined();
      expect(tokenCheck?.status).toBe("warning");
      expect(tokenCheck?.message).toContain("No token file");
    });

    it("returns error when token has no access_token AND no refresh_token", async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockImplementation(async (path) => {
        if (String(path).includes("keys")) {
          return JSON.stringify({
            installed: {
              client_id: "test.apps.googleusercontent.com",
              client_secret: "secret",
            },
          });
        }
        return JSON.stringify({
          scope: "https://www.googleapis.com/auth/drive",
          created_at: new Date().toISOString(),
        });
      });

      const result = await handleGetStatus(mockAuthClient, mockDrive, "2.0.0", {
        diagnose: true,
      });

      expect(result.isError).toBe(false);
      const data = result.structuredContent as StatusData;
      const tokenCheck = data.config_checks?.find((c) => c.name === "token_file");
      expect(tokenCheck).toBeDefined();
      expect(tokenCheck?.status).toBe("error");
      expect(tokenCheck?.message).toContain("no valid tokens");
    });

    it("returns error when token is expired with no refresh_token", async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockImplementation(async (path) => {
        if (String(path).includes("keys")) {
          return JSON.stringify({
            installed: {
              client_id: "test.apps.googleusercontent.com",
              client_secret: "secret",
            },
          });
        }
        return JSON.stringify({
          access_token: "expired-token",
          expiry_date: Date.now() - 3600000,
          scope: "https://www.googleapis.com/auth/drive",
          created_at: new Date().toISOString(),
        });
      });

      const result = await handleGetStatus(mockAuthClient, mockDrive, "2.0.0", {
        diagnose: true,
      });

      expect(result.isError).toBe(false);
      const data = result.structuredContent as StatusData;
      const tokenCheck = data.config_checks?.find((c) => c.name === "token_file");
      expect(tokenCheck).toBeDefined();
      expect(tokenCheck?.status).toBe("error");
      expect(tokenCheck?.message).toContain("expired and no refresh token");
    });

    it("returns warning when token is expired but has refresh_token", async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockImplementation(async (path) => {
        if (String(path).includes("keys")) {
          return JSON.stringify({
            installed: {
              client_id: "test.apps.googleusercontent.com",
              client_secret: "secret",
            },
          });
        }
        return JSON.stringify({
          access_token: "expired-token",
          refresh_token: "valid-refresh",
          expiry_date: Date.now() - 3600000,
          scope: "https://www.googleapis.com/auth/drive",
          created_at: new Date().toISOString(),
        });
      });

      const result = await handleGetStatus(mockAuthClient, mockDrive, "2.0.0", {
        diagnose: true,
      });

      expect(result.isError).toBe(false);
      const data = result.structuredContent as StatusData;
      const tokenCheck = data.config_checks?.find((c) => c.name === "token_file");
      expect(tokenCheck).toBeDefined();
      expect(tokenCheck?.status).toBe("warning");
      expect(tokenCheck?.message).toContain("expired but refresh token available");
    });

    it("returns warning when token is approaching 7-day expiry", async () => {
      const sixDaysAgo = new Date();
      sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockImplementation(async (path) => {
        if (String(path).includes("keys")) {
          return JSON.stringify({
            installed: {
              client_id: "test.apps.googleusercontent.com",
              client_secret: "secret",
            },
          });
        }
        return JSON.stringify({
          access_token: "valid-token",
          refresh_token: "valid-refresh",
          expiry_date: Date.now() + 3600000,
          scope: "https://www.googleapis.com/auth/drive",
          created_at: sixDaysAgo.toISOString(),
        });
      });

      const result = await handleGetStatus(mockAuthClient, mockDrive, "2.0.0", {
        diagnose: true,
      });

      expect(result.isError).toBe(false);
      const data = result.structuredContent as StatusData;
      const tokenCheck = data.config_checks?.find((c) => c.name === "token_file");
      expect(tokenCheck).toBeDefined();
      expect(tokenCheck?.status).toBe("warning");
      expect(tokenCheck?.message).toContain("6 days old");
      expect(tokenCheck?.message).toContain("1 days until testing app expiry");
    });

    it("returns ok status for valid token", async () => {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockImplementation(async (path) => {
        if (String(path).includes("keys")) {
          return JSON.stringify({
            installed: {
              client_id: "test.apps.googleusercontent.com",
              client_secret: "secret",
            },
          });
        }
        return JSON.stringify({
          access_token: "valid-token",
          refresh_token: "valid-refresh",
          expiry_date: Date.now() + 3600000,
          scope: "https://www.googleapis.com/auth/drive",
          created_at: twoDaysAgo.toISOString(),
        });
      });

      const result = await handleGetStatus(mockAuthClient, mockDrive, "2.0.0", {
        diagnose: true,
      });

      expect(result.isError).toBe(false);
      const data = result.structuredContent as StatusData;
      const tokenCheck = data.config_checks?.find((c) => c.name === "token_file");
      expect(tokenCheck).toBeDefined();
      expect(tokenCheck?.status).toBe("ok");
      expect(tokenCheck?.message).toContain("Valid tokens");
    });

    it("calculates age correctly from created_at timestamp", async () => {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockImplementation(async (path) => {
        if (String(path).includes("keys")) {
          return JSON.stringify({
            installed: {
              client_id: "test.apps.googleusercontent.com",
              client_secret: "secret",
            },
          });
        }
        return JSON.stringify({
          access_token: "valid-token",
          refresh_token: "valid-refresh",
          expiry_date: Date.now() + 3600000,
          scope: "https://www.googleapis.com/auth/drive",
          created_at: threeDaysAgo.toISOString(),
        });
      });

      const result = await handleGetStatus(mockAuthClient, mockDrive, "2.0.0", {
        diagnose: true,
      });

      expect(result.isError).toBe(false);
      const data = result.structuredContent as StatusData;
      expect(data.token_check).toBeDefined();
      expect(data.token_check?.age_days).toBe(3);
      expect(data.token_check?.approaching_expiry).toBe(false);
    });

    it("returns error when token file has parse error", async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockImplementation(async (path) => {
        if (String(path).includes("keys")) {
          return JSON.stringify({
            installed: {
              client_id: "test.apps.googleusercontent.com",
              client_secret: "secret",
            },
          });
        }
        return "not valid json{{{";
      });

      const result = await handleGetStatus(mockAuthClient, mockDrive, "2.0.0", {
        diagnose: true,
      });

      expect(result.isError).toBe(false);
      const data = result.structuredContent as StatusData;
      const tokenCheck = data.config_checks?.find((c) => c.name === "token_file");
      expect(tokenCheck).toBeDefined();
      expect(tokenCheck?.status).toBe("error");
      expect(tokenCheck?.message).toContain("Failed to parse");
    });
  });

  describe("generateRecommendations (via diagnose mode)", () => {
    it("recommends OAuth setup when credentials file has error", async () => {
      vi.mocked(fs.access).mockImplementation(async (path) => {
        if (String(path).includes("keys")) {
          throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
        }
        return undefined;
      });
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          access_token: "test-token",
          refresh_token: "test-refresh",
          expiry_date: Date.now() + 3600000,
          scope: "https://www.googleapis.com/auth/drive",
          created_at: new Date().toISOString(),
        }),
      );

      const result = await handleGetStatus(mockAuthClient, mockDrive, "2.0.0", {
        diagnose: true,
      });

      expect(result.isError).toBe(false);
      const data = result.structuredContent as StatusData;
      expect(data.recommendations).toBeDefined();
      expect(data.recommendations?.some((r) => r.includes("OAuth credentials"))).toBe(true);
    });

    it("recommends re-auth when token file has error/warning", async () => {
      vi.mocked(fs.access).mockImplementation(async (path) => {
        if (String(path).includes("tokens") || String(path).includes("workspace")) {
          throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
        }
        return undefined;
      });
      vi.mocked(fs.readFile).mockImplementation(async (path) => {
        if (String(path).includes("keys")) {
          return JSON.stringify({
            installed: {
              client_id: "test.apps.googleusercontent.com",
              client_secret: "secret",
            },
          });
        }
        throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
      });

      const result = await handleGetStatus(mockAuthClient, mockDrive, "2.0.0", {
        diagnose: true,
      });

      expect(result.isError).toBe(false);
      const data = result.structuredContent as StatusData;
      expect(data.recommendations).toBeDefined();
      expect(data.recommendations?.some((r) => r.includes("authenticate"))).toBe(true);
    });

    it("calculates days left when token is approaching expiry", async () => {
      const sixDaysAgo = new Date();
      sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockImplementation(async (path) => {
        if (String(path).includes("keys")) {
          return JSON.stringify({
            installed: {
              client_id: "test.apps.googleusercontent.com",
              client_secret: "secret",
            },
          });
        }
        return JSON.stringify({
          access_token: "valid-token",
          refresh_token: "valid-refresh",
          expiry_date: Date.now() + 3600000,
          scope: "https://www.googleapis.com/auth/drive",
          created_at: sixDaysAgo.toISOString(),
        });
      });

      const result = await handleGetStatus(mockAuthClient, mockDrive, "2.0.0", {
        diagnose: true,
      });

      expect(result.isError).toBe(false);
      const data = result.structuredContent as StatusData;
      expect(data.recommendations).toBeDefined();
      expect(data.recommendations?.some((r) => r.includes("1 day"))).toBe(true);
    });

    it("includes error code in recommendation when last auth error exists", async () => {
      const { getLastTokenAuthError } = await import("../auth/tokenManager.js");
      vi.mocked(getLastTokenAuthError).mockReturnValue({
        code: "INVALID_GRANT",
        reason: "Token was revoked",
        fix: ["Re-authenticate"],
        message: "Token was revoked",
        name: "GoogleAuthError",
        toToolResponse: () => ({ isError: true, content: [{ type: "text", text: "error" }] }),
        toDisplayString: () => "Error: Token was revoked",
        isClientInvalid: () => false,
        requiresTokenClear: () => true,
      });

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockImplementation(async (path) => {
        if (String(path).includes("keys")) {
          return JSON.stringify({
            installed: {
              client_id: "test.apps.googleusercontent.com",
              client_secret: "secret",
            },
          });
        }
        return JSON.stringify({
          access_token: "valid-token",
          refresh_token: "valid-refresh",
          expiry_date: Date.now() + 3600000,
          scope: "https://www.googleapis.com/auth/drive",
          created_at: new Date().toISOString(),
        });
      });

      const result = await handleGetStatus(mockAuthClient, mockDrive, "2.0.0", {
        diagnose: true,
      });

      expect(result.isError).toBe(false);
      const data = result.structuredContent as StatusData;
      expect(data.recommendations).toBeDefined();
      expect(data.recommendations?.some((r) => r.includes("INVALID_GRANT"))).toBe(true);
    });

    it("includes failure reason when API validation fails", async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockImplementation(async (path) => {
        if (String(path).includes("keys")) {
          return JSON.stringify({
            installed: {
              client_id: "test.apps.googleusercontent.com",
              client_secret: "secret",
            },
          });
        }
        return JSON.stringify({
          access_token: "valid-token",
          refresh_token: "valid-refresh",
          expiry_date: Date.now() + 3600000,
          scope: "https://www.googleapis.com/auth/drive",
          created_at: new Date().toISOString(),
        });
      });

      vi.mocked(mockDrive.about.get).mockRejectedValue(new Error("Network timeout"));

      const result = await handleGetStatus(mockAuthClient, mockDrive, "2.0.0", {
        diagnose: true,
        validate_with_api: true,
      });

      expect(result.isError).toBe(false);
      const data = result.structuredContent as StatusData;
      expect(data.recommendations).toBeDefined();
      expect(data.recommendations?.some((r) => r.includes("API validation failed"))).toBe(true);
      expect(data.recommendations?.some((r) => r.includes("Network timeout"))).toBe(true);
    });

    it("returns default success message when all is OK", async () => {
      // Reset the token error mock to null for this test
      const { getLastTokenAuthError } = await import("../auth/tokenManager.js");
      vi.mocked(getLastTokenAuthError).mockReturnValue(null);

      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockImplementation(async (path) => {
        if (String(path).includes("keys")) {
          return JSON.stringify({
            installed: {
              client_id: "test.apps.googleusercontent.com",
              client_secret: "secret",
            },
          });
        }
        return JSON.stringify({
          access_token: "valid-token",
          refresh_token: "valid-refresh",
          expiry_date: Date.now() + 3600000,
          scope: "https://www.googleapis.com/auth/drive",
          created_at: twoDaysAgo.toISOString(),
        });
      });

      const result = await handleGetStatus(mockAuthClient, mockDrive, "2.0.0", {
        diagnose: true,
      });

      expect(result.isError).toBe(false);
      const data = result.structuredContent as StatusData;
      expect(data.recommendations).toBeDefined();
      // The status is ok when token_file check is ok, so we expect the success message
      const tokenCheck = data.config_checks?.find((c) => c.name === "token_file");
      expect(tokenCheck?.status).toBe("ok");
      expect(data.recommendations?.some((r) => r.includes("configured correctly"))).toBe(true);
    });

    it("recommends re-auth when no scopes found", async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockImplementation(async (path) => {
        if (String(path).includes("keys")) {
          return JSON.stringify({
            installed: {
              client_id: "test.apps.googleusercontent.com",
              client_secret: "secret",
            },
          });
        }
        return JSON.stringify({
          access_token: "valid-token",
          refresh_token: "valid-refresh",
          expiry_date: Date.now() + 3600000,
          created_at: new Date().toISOString(),
        });
      });

      const result = await handleGetStatus(mockAuthClient, mockDrive, "2.0.0", {
        diagnose: true,
      });

      expect(result.isError).toBe(false);
      const data = result.structuredContent as StatusData;
      expect(data.recommendations).toBeDefined();
      expect(data.recommendations?.some((r) => r.includes("No scopes found"))).toBe(true);
    });
  });
});
