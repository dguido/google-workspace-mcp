import { log } from "./logging.js";

export interface ToolResponse {
  content: Array<{ type: string; text: string }>;
  isError: boolean;
  structuredContent?: Record<string, unknown>;
  [x: string]: unknown; // Allow additional properties for MCP SDK compatibility
}

/**
 * Standard error codes for categorizing errors.
 * Clients can use these to handle specific error types programmatically.
 */
export type ErrorCode =
  | "NOT_FOUND"
  | "ALREADY_EXISTS"
  | "PERMISSION_DENIED"
  | "INVALID_INPUT"
  | "RATE_LIMITED"
  | "QUOTA_EXCEEDED"
  | "AUTH_REQUIRED"
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
export function structuredResponse(text: string, data: Record<string, unknown>): ToolResponse {
  return {
    content: [{ type: "text", text }],
    structuredContent: data,
    isError: false,
  };
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
