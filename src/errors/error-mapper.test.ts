import { describe, it, expect } from "vitest";
import { GaxiosError, type GaxiosOptionsPrepared, type GaxiosResponse } from "gaxios";
import { isGoogleApiError, mapGoogleError } from "./error-mapper.js";

/** Create a mock GaxiosError for testing */
function createGaxiosError(code: string, description: string, status?: number): GaxiosError {
  const config: GaxiosOptionsPrepared = {
    url: new URL("https://oauth2.googleapis.com/token"),
    headers: new Headers(),
  };
  // GaxiosError constructor uses bodyUsed to determine if it should translate data
  // We create a response with bodyUsed=true to preserve our data
  const response = {
    status: status ?? 400,
    statusText: "Error",
    headers: new Headers(),
    config,
    data: { error: code, error_description: description },
    bodyUsed: true,
  } as unknown as GaxiosResponse;
  return new GaxiosError(description, config, response);
}

describe("isGoogleApiError", () => {
  it("returns true for GaxiosError instances", () => {
    const error = createGaxiosError("invalid_grant", "Token expired");
    expect(isGoogleApiError(error)).toBe(true);
  });

  it("returns false for plain Error instances", () => {
    const error = new Error("Something went wrong");
    expect(isGoogleApiError(error)).toBe(false);
  });

  it("returns false for non-error values", () => {
    expect(isGoogleApiError(null)).toBe(false);
    expect(isGoogleApiError(undefined)).toBe(false);
    expect(isGoogleApiError("string error")).toBe(false);
    expect(isGoogleApiError({ message: "object error" })).toBe(false);
  });
});

describe("mapGoogleError", () => {
  describe("OAuth error codes", () => {
    it("maps invalid_grant to INVALID_GRANT", () => {
      const error = createGaxiosError("invalid_grant", "Token revoked");
      const result = mapGoogleError(error);

      expect(result.code).toBe("INVALID_GRANT");
      expect(result.reason).toContain("revoked or expired");
      expect(result.fix.length).toBeGreaterThan(0);
    });

    it("maps access_denied to ACCESS_DENIED", () => {
      const error = createGaxiosError("access_denied", "User denied access");
      const result = mapGoogleError(error);

      expect(result.code).toBe("ACCESS_DENIED");
      expect(result.reason).toContain("denied");
      expect(result.fix).toContain("Re-run authentication and click 'Allow' when prompted");
    });

    it("maps redirect_uri_mismatch to REDIRECT_URI_MISMATCH", () => {
      const error = createGaxiosError("redirect_uri_mismatch", "URI does not match");
      const result = mapGoogleError(error);

      expect(result.code).toBe("REDIRECT_URI_MISMATCH");
      expect(result.reason).toContain("redirect URI mismatch");
      expect(result.links).toBeDefined();
      expect(result.links?.some((l) => l.url.includes("credentials"))).toBe(true);
    });

    it("maps invalid_client to INVALID_CLIENT", () => {
      const error = createGaxiosError("invalid_client", "Client ID not found");
      const result = mapGoogleError(error);

      expect(result.code).toBe("INVALID_CLIENT");
      expect(result.reason).toContain("invalid");
    });

    it("maps deleted_client to DELETED_CLIENT", () => {
      const error = createGaxiosError("deleted_client", "The OAuth client was deleted");
      const result = mapGoogleError(error);

      expect(result.code).toBe("DELETED_CLIENT");
      expect(result.reason).toContain("deleted");
      expect(result.fix).toContainEqual(expect.stringContaining("Google Cloud Console"));
      expect(result.links).toBeDefined();
      expect(result.links?.some((l) => l.url.includes("credentials"))).toBe(true);
    });

    it("maps insufficient_scope to INSUFFICIENT_SCOPE", () => {
      const error = createGaxiosError("insufficient_scope", "Missing drive.readonly scope");
      const result = mapGoogleError(error);

      expect(result.code).toBe("INSUFFICIENT_SCOPE");
      expect(result.reason).toContain("permissions");
    });
  });

  describe("HTTP status codes", () => {
    it("maps 401 status to TOKEN_EXPIRED", () => {
      const error = createGaxiosError("unauthorized", "Token expired", 401);
      const result = mapGoogleError(error);

      expect(result.code).toBe("TOKEN_EXPIRED");
      expect(result.reason).toContain("expired");
    });

    it("maps 403 with API not enabled message to API_NOT_ENABLED", () => {
      const error = createGaxiosError("forbidden", "Drive API has not been used in project", 403);
      const result = mapGoogleError(error);

      expect(result.code).toBe("API_NOT_ENABLED");
      expect(result.reason).toContain("not enabled");
    });

    it("maps 403 with scope message to INSUFFICIENT_SCOPE", () => {
      const error = createGaxiosError(
        "forbidden",
        "Request had insufficient authentication scope",
        403,
      );
      const result = mapGoogleError(error);

      expect(result.code).toBe("INSUFFICIENT_SCOPE");
    });

    it("maps 403 without specific message to ACCESS_DENIED", () => {
      const error = createGaxiosError("forbidden", "Access forbidden", 403);
      const result = mapGoogleError(error);

      expect(result.code).toBe("ACCESS_DENIED");
    });

    it("maps 429 status to QUOTA_EXCEEDED", () => {
      const error = createGaxiosError("rate_limit_exceeded", "Too many requests", 429);
      const result = mapGoogleError(error);

      expect(result.code).toBe("QUOTA_EXCEEDED");
      expect(result.reason).toContain("quota");
      expect(result.fix).toContain("Wait a few minutes and try again");
    });
  });

  describe("network errors", () => {
    it("maps ENOTFOUND to NETWORK_ERROR", () => {
      const error = new Error("getaddrinfo ENOTFOUND oauth2.googleapis.com");
      const result = mapGoogleError(error);

      expect(result.code).toBe("NETWORK_ERROR");
      expect(result.reason).toContain("Unable to connect");
      expect(result.fix).toContain("Check your internet connection");
    });

    it("maps ECONNREFUSED to NETWORK_ERROR", () => {
      const error = new Error("connect ECONNREFUSED 127.0.0.1:443");
      const result = mapGoogleError(error);

      expect(result.code).toBe("NETWORK_ERROR");
    });

    it("handles GaxiosError with network error code", () => {
      const error = createGaxiosError("ETIMEDOUT", "Connection timed out");
      error.code = "ETIMEDOUT";
      const result = mapGoogleError(error);

      expect(result.code).toBe("NETWORK_ERROR");
    });
  });

  describe("non-GaxiosError handling", () => {
    it("handles plain Error objects", () => {
      const error = new Error("Something unexpected happened");
      const result = mapGoogleError(error);

      expect(result.code).toBe("UNKNOWN");
      expect(result.reason).toBe("Something unexpected happened");
    });

    it("handles string errors", () => {
      const result = mapGoogleError("string error");

      expect(result.code).toBe("UNKNOWN");
      expect(result.reason).toBe("string error");
    });

    it("handles null/undefined", () => {
      const nullResult = mapGoogleError(null);
      expect(nullResult.code).toBe("UNKNOWN");

      const undefinedResult = mapGoogleError(undefined);
      expect(undefinedResult.code).toBe("UNKNOWN");
    });
  });

  describe("context handling", () => {
    it("includes account in error when provided", () => {
      const error = createGaxiosError("invalid_grant", "Token expired");
      const result = mapGoogleError(error, { account: "user@example.com" });

      expect(result.account).toBe("user@example.com");
    });

    it("includes authUrl in error when provided", () => {
      const error = createGaxiosError("access_denied", "User denied");
      const result = mapGoogleError(error, {
        authUrl: "https://accounts.google.com/oauth",
      });

      expect(result.authUrl).toBe("https://accounts.google.com/oauth");
    });

    it("includes scope in insufficient scope errors", () => {
      const error = createGaxiosError("insufficient_scope", "Missing scope");
      const result = mapGoogleError(error, {
        scope: "https://www.googleapis.com/auth/drive",
      });

      expect(result.scope).toBe("https://www.googleapis.com/auth/drive");
    });
  });

  describe("error properties", () => {
    it("includes fix steps array", () => {
      const error = createGaxiosError("invalid_grant", "Token expired");
      const result = mapGoogleError(error);

      expect(Array.isArray(result.fix)).toBe(true);
      expect(result.fix.length).toBeGreaterThan(0);
    });

    it("includes links for errors with console references", () => {
      const error = createGaxiosError("redirect_uri_mismatch", "URI mismatch");
      const result = mapGoogleError(error);

      expect(result.links).toBeDefined();
      expect(result.links!.length).toBeGreaterThan(0);
      expect(result.links![0]).toHaveProperty("label");
      expect(result.links![0]).toHaveProperty("url");
    });

    it("preserves original error", () => {
      const originalError = createGaxiosError("invalid_grant", "Original");
      const result = mapGoogleError(originalError);

      expect(result.originalError).toBe(originalError);
    });
  });

  describe("toToolResponse", () => {
    it("returns structured data for MCP responses", () => {
      const error = createGaxiosError("invalid_grant", "Token expired");
      const result = mapGoogleError(error);
      const response = result.toToolResponse();

      expect(response).toHaveProperty("error_code", "INVALID_GRANT");
      expect(response).toHaveProperty("reason");
      expect(response).toHaveProperty("fix_steps");
      expect(Array.isArray(response.fix_steps)).toBe(true);
    });
  });
});
