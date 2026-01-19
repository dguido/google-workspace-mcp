import type { drive_v3 } from 'googleapis';
import { log } from '../utils/index.js';

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
