import { log } from "./logging.js";

export interface ToolResponse {
  content: Array<{ type: string; text: string }>;
  isError: boolean;
  structuredContent?: Record<string, unknown>;
  [x: string]: unknown; // Allow additional properties for MCP SDK compatibility
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
export function structuredResponse(
  text: string,
  data: Record<string, unknown>,
): ToolResponse {
  return {
    content: [{ type: "text", text }],
    structuredContent: data,
    isError: false,
  };
}

/**
 * Create an error response for a tool call.
 * Logs the error message before returning.
 */
export function errorResponse(message: string): ToolResponse {
  log("Error", { message });
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    isError: true,
  };
}
