import type { drive_v3 } from 'googleapis';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { log } from '../utils/index.js';

/**
 * Context passed to handlers for access to MCP features like progress and elicitation
 */
export interface HandlerContext {
  /** The MCP server instance */
  server: Server;
  /** Progress token from the client request (if provided) */
  progressToken?: string | number;
}

// Constants
export const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
export const TEXT_MIME_TYPES: Record<string, string> = {
  txt: 'text/plain',
  md: 'text/markdown'
};

export function getExtensionFromFilename(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

export function getMimeTypeFromFilename(filename: string): string {
  const ext = getExtensionFromFilename(filename);
  return TEXT_MIME_TYPES[ext] || 'text/plain';
}

/**
 * For text-based files, ensure they have a valid extension.
 */
export function validateTextFileExtension(name: string): void {
  const ext = getExtensionFromFilename(name);
  if (!['txt', 'md'].includes(ext)) {
    throw new Error("File name must end with .txt or .md for text files.");
  }
}

/**
 * Resolve a slash-delimited path (e.g. "/some/folder") within Google Drive
 * into a folder ID. Creates folders if they don't exist.
 */
export async function resolvePath(
  drive: drive_v3.Drive,
  pathStr: string
): Promise<string> {
  if (!pathStr || pathStr === '/') return 'root';

  const parts = pathStr.replace(/^\/+|\/+$/g, '').split('/');
  let currentFolderId: string = 'root';

  for (const part of parts) {
    if (!part) continue;
    const response = await drive.files.list({
      q: `'${currentFolderId}' in parents and name = '${part}' and mimeType = '${FOLDER_MIME_TYPE}' and trashed = false`,
      fields: 'files(id)',
      spaces: 'drive',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true
    });

    // If the folder segment doesn't exist, create it
    if (!response.data.files?.length) {
      const folderMetadata = {
        name: part,
        mimeType: FOLDER_MIME_TYPE,
        parents: [currentFolderId]
      };
      const folder = await drive.files.create({
        requestBody: folderMetadata,
        fields: 'id',
        supportsAllDrives: true
      });

      if (!folder.data.id) {
        throw new Error(`Failed to create intermediate folder: ${part}`);
      }

      currentFolderId = folder.data.id;
    } else {
      // Folder exists, proceed deeper
      currentFolderId = response.data.files[0].id!;
    }
  }

  return currentFolderId;
}

/**
 * Resolve a folder ID or path.
 * If it's a path (starts with '/'), resolve it.
 * If no folder is provided, return 'root'.
 */
export async function resolveFolderId(
  drive: drive_v3.Drive,
  input: string | undefined
): Promise<string> {
  if (!input) return 'root';

  if (input.startsWith('/')) {
    // Input is a path
    return resolvePath(drive, input);
  } else {
    // Input is a folder ID, return as-is
    return input;
  }
}

/**
 * Resolve optional folder parameters where user can provide either folderId OR folderPath.
 * Throws if both are provided. Returns 'root' if neither is provided.
 * Creates intermediate folders if folderPath doesn't exist.
 */
export async function resolveOptionalFolderPath(
  drive: drive_v3.Drive,
  folderId?: string,
  folderPath?: string
): Promise<string> {
  if (folderId && folderPath) {
    throw new Error("Provide either folderId or folderPath, not both");
  }
  if (folderId) return folderId;
  if (folderPath) return resolvePath(drive, folderPath);
  return 'root';
}

/**
 * Resolve a file by ID or path. Returns the file ID.
 * Unlike folder resolution, this does NOT create the file if it doesn't exist.
 */
export async function resolveFileIdFromPath(
  drive: drive_v3.Drive,
  fileId?: string,
  filePath?: string
): Promise<string> {
  if (fileId && filePath) {
    throw new Error("Provide either fileId or filePath, not both");
  }
  if (!fileId && !filePath) {
    throw new Error("Either fileId or filePath must be provided");
  }
  if (fileId) return fileId;

  // Parse path to get parent folder and filename
  const normalizedPath = filePath!.replace(/^\/+|\/+$/g, '');
  const parts = normalizedPath.split('/');
  const fileName = parts.pop();

  if (!fileName) {
    throw new Error("Invalid file path: no filename specified");
  }

  // Resolve parent folder (don't create if missing)
  let parentFolderId = 'root';
  if (parts.length > 0) {
    const parentPath = '/' + parts.join('/');
    parentFolderId = await resolvePathWithoutCreate(drive, parentPath);
  }

  // Find the file in the parent folder
  const escapedName = fileName.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const response = await drive.files.list({
    q: `'${parentFolderId}' in parents and name = '${escapedName}' and trashed = false`,
    fields: 'files(id, name)',
    pageSize: 1,
    includeItemsFromAllDrives: true,
    supportsAllDrives: true
  });

  if (!response.data.files?.length) {
    throw new Error(`File not found: ${filePath}`);
  }

  return response.data.files[0].id!;
}

/**
 * Resolve a path without creating folders. Throws if any folder doesn't exist.
 */
async function resolvePathWithoutCreate(
  drive: drive_v3.Drive,
  pathStr: string
): Promise<string> {
  if (!pathStr || pathStr === '/') return 'root';

  const parts = pathStr.replace(/^\/+|\/+$/g, '').split('/');
  let currentFolderId: string = 'root';

  for (const part of parts) {
    if (!part) continue;
    const escapedPart = part.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    const response = await drive.files.list({
      q: `'${currentFolderId}' in parents and name = '${escapedPart}' and mimeType = '${FOLDER_MIME_TYPE}' and trashed = false`,
      fields: 'files(id)',
      spaces: 'drive',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true
    });

    if (!response.data.files?.length) {
      throw new Error(`Folder not found: ${part} in path ${pathStr}`);
    }

    currentFolderId = response.data.files[0].id!;
  }

  return currentFolderId;
}

/**
 * Check if a file with the given name already exists in the specified folder.
 * Returns the file ID if it exists, null otherwise.
 */
export async function checkFileExists(
  drive: drive_v3.Drive,
  name: string,
  parentFolderId: string = 'root'
): Promise<string | null> {
  try {
    const escapedName = name.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    const query = `name = '${escapedName}' and '${parentFolderId}' in parents and trashed = false`;

    const res = await drive.files.list({
      q: query,
      fields: 'files(id, name, mimeType)',
      pageSize: 1,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true
    });

    if (res.data.files && res.data.files.length > 0) {
      return res.data.files[0].id || null;
    }
    return null;
  } catch (error) {
    log('Error checking file existence:', error);
    return null;
  }
}

/**
 * Convert A1 notation to GridRange for Google Sheets API
 */
export function convertA1ToGridRange(
  a1Notation: string,
  sheetId: number
): {
  sheetId: number;
  startColumnIndex?: number;
  endColumnIndex?: number;
  startRowIndex?: number;
  endRowIndex?: number;
} {
  const rangeRegex = /^([A-Z]*)([0-9]*)(:([A-Z]*)([0-9]*))?$/;
  const match = a1Notation.match(rangeRegex);

  if (!match) {
    throw new Error(`Invalid A1 notation: ${a1Notation}`);
  }

  const [, startCol, startRow, , endCol, endRow] = match;

  const gridRange: {
    sheetId: number;
    startColumnIndex?: number;
    endColumnIndex?: number;
    startRowIndex?: number;
    endRowIndex?: number;
  } = { sheetId };

  // Convert column letters to numbers (A=0, B=1, etc.)
  const colToNum = (col: string): number => {
    let num = 0;
    for (let i = 0; i < col.length; i++) {
      num = num * 26 + (col.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
    }
    return num - 1;
  };

  // Set start indices
  if (startCol) gridRange.startColumnIndex = colToNum(startCol);
  if (startRow) gridRange.startRowIndex = parseInt(startRow) - 1;

  // Set end indices (exclusive)
  if (endCol) {
    gridRange.endColumnIndex = colToNum(endCol) + 1;
  } else if (startCol && !endCol) {
    gridRange.endColumnIndex = gridRange.startColumnIndex! + 1;
  }

  if (endRow) {
    gridRange.endRowIndex = parseInt(endRow);
  } else if (startRow && !endRow) {
    gridRange.endRowIndex = gridRange.startRowIndex! + 1;
  }

  return gridRange;
}

// -----------------------------------------------------------------------------
// EMU (English Metric Units) Conversion Helpers
// -----------------------------------------------------------------------------
// EMU is the native unit for Google Slides positioning. These constants and
// functions help convert to/from common units.

export const EMU_PER_INCH = 914400;
export const EMU_PER_POINT = 12700;
export const EMU_PER_PIXEL_96DPI = 9525;

// Standard Google Slides dimensions in EMU (default 16:9 aspect ratio)
export const SLIDES_WIDTH_EMU = 9144000;  // 10 inches
export const SLIDES_HEIGHT_EMU = 5143500; // ~5.625 inches

export function inchesToEmu(inches: number): number {
  return Math.round(inches * EMU_PER_INCH);
}

export function pointsToEmu(points: number): number {
  return Math.round(points * EMU_PER_POINT);
}

export function pixelsToEmu(pixels: number, dpi = 96): number {
  return Math.round(pixels * EMU_PER_INCH / dpi);
}

export function emuToInches(emu: number): number {
  return emu / EMU_PER_INCH;
}

export function emuToPoints(emu: number): number {
  return emu / EMU_PER_POINT;
}

export function emuToPixels(emu: number, dpi = 96): number {
  return emu * dpi / EMU_PER_INCH;
}

// -----------------------------------------------------------------------------
// Batch Operation Helpers
// -----------------------------------------------------------------------------

export interface BatchResult<T> {
  success: T[];
  failed: Array<{ id: string; error: string }>;
}

interface BatchOperationOptions {
  operationName: string;
  concurrency?: number;
}

/**
 * Generic batch operation processor that handles progress reporting vs rate-limited modes
 * and normalizes results into success/failed arrays.
 *
 * This abstracts the common pattern used by handleBatchDelete, handleBatchMove, handleBatchShare.
 */
export async function processBatchOperation<T>(
  ids: string[],
  operation: (id: string) => Promise<T>,
  context: HandlerContext | undefined,
  options: BatchOperationOptions
): Promise<BatchResult<T>> {
  // Dynamically import utils to avoid circular dependencies
  const { processBatchWithProgress, withRateLimitedBatch } = await import('../utils/index.js');

  const concurrency = options.concurrency ?? 5;

  // Choose processing mode based on context availability
  const results = context?.server
    ? await processBatchWithProgress({
        server: context.server,
        progressToken: context.progressToken,
        items: ids,
        processor: operation,
        concurrency,
        operationName: options.operationName
      })
    : await withRateLimitedBatch(
        ids,
        operation,
        { concurrency, operationName: options.operationName }
      );

  // Normalize results into success/failed arrays
  const success: T[] = [];
  const failed: Array<{ id: string; error: string }> = [];

  results.forEach((result, index) => {
    if (result.success) {
      success.push(result.result);
    } else {
      failed.push({
        id: ids[index],
        error: result.error
      });
    }
  });

  return { success, failed };
}
