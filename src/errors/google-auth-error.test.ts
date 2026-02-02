import { describe, it, expect } from "vitest";
import { GoogleAuthError, type AuthErrorCode } from "./google-auth-error.js";

function createError(code: AuthErrorCode): GoogleAuthError {
  return new GoogleAuthError({
    code,
    reason: `Test error for ${code}`,
    fix: ["Fix step 1"],
  });
}

describe("GoogleAuthError", () => {
  describe("isClientInvalid", () => {
    it("returns true for DELETED_CLIENT", () => {
      const error = createError("DELETED_CLIENT");
      expect(error.isClientInvalid()).toBe(true);
    });

    it("returns true for INVALID_CLIENT", () => {
      const error = createError("INVALID_CLIENT");
      expect(error.isClientInvalid()).toBe(true);
    });

    it("returns false for other error codes", () => {
      const codes: AuthErrorCode[] = [
        "OAUTH_NOT_CONFIGURED",
        "REDIRECT_URI_MISMATCH",
        "INVALID_GRANT",
        "ACCESS_DENIED",
        "TOKEN_EXPIRED",
        "TOKEN_REVOKED",
        "INSUFFICIENT_SCOPE",
        "QUOTA_EXCEEDED",
        "API_NOT_ENABLED",
        "NETWORK_ERROR",
        "UNKNOWN",
      ];

      for (const code of codes) {
        const error = createError(code);
        expect(error.isClientInvalid()).toBe(false);
      }
    });
  });

  describe("requiresTokenClear", () => {
    it("returns true for INVALID_GRANT", () => {
      const error = createError("INVALID_GRANT");
      expect(error.requiresTokenClear()).toBe(true);
    });

    it("returns true for TOKEN_REVOKED", () => {
      const error = createError("TOKEN_REVOKED");
      expect(error.requiresTokenClear()).toBe(true);
    });

    it("returns true for DELETED_CLIENT", () => {
      const error = createError("DELETED_CLIENT");
      expect(error.requiresTokenClear()).toBe(true);
    });

    it("returns false for other error codes", () => {
      const codes: AuthErrorCode[] = [
        "OAUTH_NOT_CONFIGURED",
        "REDIRECT_URI_MISMATCH",
        "INVALID_CLIENT",
        "ACCESS_DENIED",
        "TOKEN_EXPIRED",
        "INSUFFICIENT_SCOPE",
        "QUOTA_EXCEEDED",
        "API_NOT_ENABLED",
        "NETWORK_ERROR",
        "UNKNOWN",
      ];

      for (const code of codes) {
        const error = createError(code);
        expect(error.requiresTokenClear()).toBe(false);
      }
    });
  });

  describe("toToolResponse", () => {
    it("returns structured data for MCP responses", () => {
      const error = new GoogleAuthError({
        code: "INVALID_GRANT",
        reason: "Token expired or revoked",
        fix: ["Re-authenticate", "Check token status"],
        links: [{ label: "Console", url: "https://console.cloud.google.com" }],
        account: "user@example.com",
      });

      const response = error.toToolResponse();

      expect(response.error_code).toBe("INVALID_GRANT");
      expect(response.reason).toBe("Token expired or revoked");
      expect(response.fix_steps).toEqual(["Re-authenticate", "Check token status"]);
      expect(response.links).toEqual([
        { label: "Console", url: "https://console.cloud.google.com" },
      ]);
      expect(response.account).toBe("user@example.com");
    });

    it("omits undefined optional fields", () => {
      const error = createError("UNKNOWN");
      const response = error.toToolResponse();

      expect(response).not.toHaveProperty("links");
      expect(response).not.toHaveProperty("auth_url");
      expect(response).not.toHaveProperty("account");
      expect(response).not.toHaveProperty("scope");
    });
  });

  describe("toDisplayString", () => {
    it("formats error for display to user", () => {
      const error = new GoogleAuthError({
        code: "INVALID_GRANT",
        reason: "Token expired or revoked",
        fix: ["Re-authenticate", "Check token status"],
        links: [{ label: "Console", url: "https://console.cloud.google.com" }],
        authUrl: "https://accounts.google.com/o/oauth2/auth",
      });

      const display = error.toDisplayString();

      expect(display).toContain("Token expired or revoked");
      expect(display).toContain("How to fix:");
      expect(display).toContain("1. Re-authenticate");
      expect(display).toContain("2. Check token status");
      expect(display).toContain("Helpful links:");
      expect(display).toContain("Console: https://console.cloud.google.com");
      expect(display).toContain("Re-authenticate at:");
    });
  });
});
