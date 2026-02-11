import { isToonEnabled } from "../config/services.js";
import { log } from "./logging.js";
import type { GoogleAuthError } from "../errors/google-auth-error.js";

export const DIAGNOSTIC_HINT = "\n\nCall get_status for full diagnostics.";

const CONFIG_ERROR_PATTERN =
  /credentials|authenticat|Invalid token|\btoken\b.*expired|\btoken\b.*refresh|\bscopes?\b|API.*not.*enabled|Client ID missing/i;

export function isConfigurationError(message: string): boolean {
  return CONFIG_ERROR_PATTERN.test(message);
}

/**
 * Maximum character limit for response content.
 * Large responses can overwhelm agent context windows.
 */
export const CHARACTER_LIMIT = 25000;

export interface TruncationResult {
  content: string;
  truncated: boolean;
  originalLength: number;
}

/**
 * Truncate response content if it exceeds the character limit.
 * Helps prevent overwhelming agent context windows with large API responses.
 */
export function truncateResponse(content: string): TruncationResult {
  if (content.length <= CHARACTER_LIMIT) {
    return { content, truncated: false, originalLength: content.length };
  }
  return {
    content:
      content.slice(0, CHARACTER_LIMIT) +
      `\n\n[TRUNCATED: Response exceeded ${CHARACTER_LIMIT} characters. ` +
      `Original length: ${content.length}. Consider using more specific queries.]`,
    truncated: true,
    originalLength: content.length,
  };
}

export interface ToolResponse {
  content: Array<{ type: string; text: string }>;
  isError: boolean;
  structuredContent?: Record<string, unknown>;
  [x: string]: unknown; // Allow additional properties for MCP SDK compatibility
}

/**
 * Standard error codes for categorizing errors.
 * Clients can use these to handle specific error types programmatically.
 * Aligned with MCP spec JSON-RPC error codes where applicable.
 */
export type ErrorCode =
  | "NOT_FOUND" // -30003
  | "ALREADY_EXISTS"
  | "PERMISSION_DENIED"
  | "INVALID_INPUT" // -32602
  | "RATE_LIMITED"
  | "QUOTA_EXCEEDED" // -30002
  | "AUTH_REQUIRED" // -31001
  | "INVALID_TOKEN" // -31002
  | "RESOURCE_LOCKED" // -30001
  | "UNSUPPORTED_OPERATION"
  | "INTERNAL_ERROR";

export interface ErrorOptions {
  /** Standard error code for programmatic handling */
  code?: ErrorCode;
  /** Additional context about the error */
  context?: Record<string, unknown>;
}

/**
 * Create a success response for a tool call.
 */
export function successResponse(text: string): ToolResponse {
  return { content: [{ type: "text", text }], isError: false };
}

/**
 * Create a structured response for a tool call.
 * Includes both human-readable text and machine-parseable structured data.
 * Use this for tools that return structured data (metadata, lists, quotas, etc.).
 */
export function structuredResponse<T extends Record<string, unknown>>(
  text: string,
  data: T,
): ToolResponse {
  const response: ToolResponse = {
    content: [{ type: "text", text }],
    isError: false,
  };

  // Only include structuredContent when TOON is disabled
  // When TOON is enabled, data is already in text - no need to duplicate
  if (!isToonEnabled()) {
    response.structuredContent = data;
  }

  return response;
}

/**
 * Create an error response for a tool call.
 * Logs the error message before returning.
 *
 * @param message - Human-readable error message
 * @param options - Optional error code and context for programmatic handling
 */
export function errorResponse(message: string, options?: ErrorOptions): ToolResponse {
  log("Error", { message, ...options });

  const response: ToolResponse = {
    content: [{ type: "text", text: `Error: ${message}` }],
    isError: true,
  };

  if (options?.code || options?.context) {
    response.structuredContent = {
      ...(options.code && { errorCode: options.code }),
      ...(options.context && { context: options.context }),
    };
  }

  return response;
}

/**
 * Create an error response from a GoogleAuthError.
 * Provides actionable guidance for authentication errors.
 */
export function authErrorResponse(error: GoogleAuthError): ToolResponse {
  log("Auth error", error.toToolResponse());

  return {
    content: [
      {
        type: "text",
        text: error.toDisplayString() + DIAGNOSTIC_HINT,
      },
    ],
    isError: true,
    structuredContent: {
      ...error.toToolResponse(),
      // Overrides any `diagnostic_tool` from toToolResponse()
      diagnostic_tool: "get_status",
    },
  };
}
