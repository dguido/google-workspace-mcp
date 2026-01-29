/**
 * Custom error class for Google authentication errors with structured context.
 * Provides actionable guidance for users to resolve common auth issues.
 */

export type AuthErrorCode =
  | "OAUTH_NOT_CONFIGURED"
  | "REDIRECT_URI_MISMATCH"
  | "INVALID_CLIENT"
  | "INVALID_GRANT"
  | "ACCESS_DENIED"
  | "TOKEN_EXPIRED"
  | "TOKEN_REVOKED"
  | "INSUFFICIENT_SCOPE"
  | "QUOTA_EXCEEDED"
  | "API_NOT_ENABLED"
  | "NETWORK_ERROR"
  | "UNKNOWN";

export interface ErrorLink {
  label: string;
  url: string;
}

export interface ErrorContext {
  code: AuthErrorCode;
  reason: string;
  fix: string[];
  links?: ErrorLink[];
  authUrl?: string;
  account?: string;
  scope?: string;
  originalError?: Error;
}

/**
 * Google Auth Error with structured context for actionable error messages.
 */
export class GoogleAuthError extends Error {
  public readonly code: AuthErrorCode;
  public readonly reason: string;
  public readonly fix: string[];
  public readonly links?: ErrorLink[];
  public readonly authUrl?: string;
  public readonly account?: string;
  public readonly scope?: string;
  public readonly originalError?: Error;

  constructor(context: ErrorContext) {
    super(context.reason);
    this.name = "GoogleAuthError";
    this.code = context.code;
    this.reason = context.reason;
    this.fix = context.fix;
    this.links = context.links;
    this.authUrl = context.authUrl;
    this.account = context.account;
    this.scope = context.scope;
    this.originalError = context.originalError;

    // Maintain proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, GoogleAuthError);
    }
  }

  /**
   * Convert to structured data for MCP tool response.
   */
  toToolResponse(): Record<string, unknown> {
    return {
      error_code: this.code,
      reason: this.reason,
      fix_steps: this.fix,
      ...(this.links && { links: this.links }),
      ...(this.authUrl && { auth_url: this.authUrl }),
      ...(this.account && { account: this.account }),
      ...(this.scope && { scope: this.scope }),
    };
  }

  /**
   * Format error for display to user.
   */
  toDisplayString(): string {
    const lines: string[] = [];

    lines.push(`Error: ${this.reason}`);
    lines.push("");
    lines.push("How to fix:");
    this.fix.forEach((step, i) => {
      lines.push(`  ${i + 1}. ${step}`);
    });

    if (this.links && this.links.length > 0) {
      lines.push("");
      lines.push("Helpful links:");
      this.links.forEach((link) => {
        lines.push(`  - ${link.label}: ${link.url}`);
      });
    }

    if (this.authUrl) {
      lines.push("");
      lines.push(`Re-authenticate at: ${this.authUrl}`);
    }

    return lines.join("\n");
  }
}
