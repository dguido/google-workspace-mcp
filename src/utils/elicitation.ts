/**
 * Elicitation utilities for interactive disambiguation
 *
 * Elicitation allows the server to pause and request additional information
 * from the user during tool execution. This is useful for:
 * - File selection when multiple files match
 * - Confirmation of destructive operations
 * - Requesting missing required parameters
 *
 * When the client doesn't support elicitation, these functions fall back
 * to returning structured responses that prompt the user to retry with
 * more specific parameters.
 */

import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { log } from "./logging.js";

export interface FileOption {
  id: string;
  name: string;
  mimeType?: string;
  modifiedTime?: string;
  path?: string;
}

export interface ElicitFileSelectionResult {
  selectedFileId: string | null;
  cancelled: boolean;
  error?: string;
}

export interface ElicitConfirmationResult {
  confirmed: boolean;
  cancelled: boolean;
}

/**
 * Check if the server's connected client supports form elicitation
 */
export function supportsFormElicitation(server: Server): boolean {
  // Access the private _clientCapabilities field
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Accessing private _clientCapabilities
  const serverAny = server as unknown as {
    _clientCapabilities?: { elicitation?: { form?: boolean } };
  };
  return !!serverAny._clientCapabilities?.elicitation?.form;
}

/**
 * Elicit file selection from the user when multiple files match
 *
 * @param server - The MCP server instance
 * @param files - List of matching files to choose from
 * @param message - Optional message to display to the user
 * @returns Selected file ID or null if cancelled/unsupported
 */
export async function elicitFileSelection(
  server: Server,
  files: FileOption[],
  message?: string,
): Promise<ElicitFileSelectionResult> {
  if (files.length === 0) {
    return {
      selectedFileId: null,
      cancelled: false,
      error: "No files to select from",
    };
  }

  if (files.length === 1) {
    return { selectedFileId: files[0].id, cancelled: false };
  }

  // Check if client supports elicitation
  if (!supportsFormElicitation(server)) {
    log("Client does not support elicitation, returning file list");
    return {
      selectedFileId: null,
      cancelled: false,
      error: buildFileSelectionFallbackMessage(files, message),
    };
  }

  try {
    // Build enum values from file options
    const enumValues = files.map((f) => f.id);

    const result = await server.elicitInput({
      mode: "form",
      message: message || "Multiple files found. Please select one:",
      requestedSchema: {
        type: "object",
        properties: {
          selectedFile: {
            type: "string",
            title: "Select File",
            description: "Choose which file to use",
            enum: enumValues,
            // Note: enumLabels is not standard JSON Schema but some clients may support it
          },
        },
        required: ["selectedFile"],
      },
    });

    if (result.action === "accept" && result.content) {
      const content = result.content as { selectedFile?: string };
      return {
        selectedFileId: content.selectedFile || null,
        cancelled: false,
      };
    }

    return { selectedFileId: null, cancelled: true };
  } catch (error) {
    log("Elicitation failed", { error: error instanceof Error ? error.message : String(error) });
    return {
      selectedFileId: null,
      cancelled: false,
      error: buildFileSelectionFallbackMessage(files, message),
    };
  }
}

/**
 * Elicit confirmation for a potentially destructive operation
 *
 * @param server - The MCP server instance
 * @param message - Description of the operation to confirm
 * @param details - Optional additional details about the operation
 * @returns Whether the user confirmed or cancelled
 */
export async function elicitConfirmation(
  server: Server,
  message: string,
  details?: string,
): Promise<ElicitConfirmationResult> {
  if (!supportsFormElicitation(server)) {
    log("Client does not support elicitation for confirmation");
    return { confirmed: false, cancelled: false };
  }

  try {
    const fullMessage = details ? `${message}\n\nDetails: ${details}` : message;

    const result = await server.elicitInput({
      mode: "form",
      message: fullMessage,
      requestedSchema: {
        type: "object",
        properties: {
          confirm: {
            type: "boolean",
            title: "Confirm",
            description: "Check to confirm this operation",
            default: false,
          },
        },
        required: ["confirm"],
      },
    });

    if (result.action === "accept" && result.content) {
      const content = result.content as { confirm?: boolean };
      return { confirmed: !!content.confirm, cancelled: false };
    }

    return { confirmed: false, cancelled: true };
  } catch (error) {
    log("Confirmation elicitation failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { confirmed: false, cancelled: false };
  }
}

/**
 * Build a fallback message for file selection when elicitation is not available
 */
function buildFileSelectionFallbackMessage(files: FileOption[], message?: string): string {
  const header =
    message ||
    "Multiple files found with that name. Please specify which one by using the file ID:";

  const fileList = files
    .map((f, i) => {
      let entry = `${i + 1}. "${f.name}" (ID: ${f.id})`;
      if (f.mimeType) {
        entry += `\n   Type: ${f.mimeType}`;
      }
      if (f.modifiedTime) {
        entry += `\n   Modified: ${new Date(f.modifiedTime).toLocaleString()}`;
      }
      if (f.path) {
        entry += `\n   Path: ${f.path}`;
      }
      return entry;
    })
    .join("\n\n");

  return `${header}\n\n${fileList}\n\nPlease retry with the specific file ID.`;
}

/**
 * Format disambiguation options for non-elicitation fallback
 */
export function formatDisambiguationOptions(
  files: Array<{
    id: string;
    name: string;
    mimeType?: string;
    modifiedTime?: string | null;
    parents?: string[];
  }>,
  contextMessage: string,
): string {
  const options = files
    .map((f, i) => {
      const modified = f.modifiedTime
        ? ` (modified: ${new Date(f.modifiedTime).toLocaleDateString()})`
        : "";
      const type = f.mimeType ? ` [${f.mimeType.split(".").pop() || f.mimeType}]` : "";
      return `${i + 1}. ${f.name}${type}${modified}\n   ID: ${f.id}`;
    })
    .join("\n\n");

  return `${contextMessage}\n\n${options}\n\nTo proceed, please specify the file ID directly.`;
}
