/**
 * MIME type constants and mappings for Google Drive file types.
 * Consolidates duplicated MIME type definitions across handlers.
 */

/** Google Workspace MIME types */
export const GOOGLE_MIME_TYPES = {
  DOCUMENT: "application/vnd.google-apps.document",
  SPREADSHEET: "application/vnd.google-apps.spreadsheet",
  PRESENTATION: "application/vnd.google-apps.presentation",
  FOLDER: "application/vnd.google-apps.folder",
  DRAWING: "application/vnd.google-apps.drawing",
  FORM: "application/vnd.google-apps.form",
  SCRIPT: "application/vnd.google-apps.script",
  SITE: "application/vnd.google-apps.site",
  SHORTCUT: "application/vnd.google-apps.shortcut",
} as const;

/** Text file MIME types */
export const TEXT_MIME_TYPES = {
  PLAIN: "text/plain",
  MARKDOWN: "text/markdown",
  CSV: "text/csv",
  HTML: "text/html",
} as const;

/** Export MIME types for downloading Google Workspace files */
export const EXPORT_MIME_TYPES = {
  PDF: "application/pdf",
  DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  XLSX: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  PPTX: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  RTF: "application/rtf",
  ODT: "application/vnd.oasis.opendocument.text",
  ODS: "application/vnd.oasis.opendocument.spreadsheet",
  ODP: "application/vnd.oasis.opendocument.presentation",
  ZIP: "application/zip",
  EPUB: "application/epub+zip",
} as const;

/** File type categories */
export type FileType = "doc" | "sheet" | "slides" | "text";

/** Map file extensions to their type category */
export const EXTENSION_TO_TYPE: Record<string, FileType> = {
  // Google Doc types
  docx: "doc",
  doc: "doc",
  gdoc: "doc",
  odt: "doc",
  rtf: "doc",
  // Google Sheet types
  xlsx: "sheet",
  xls: "sheet",
  csv: "sheet",
  gsheet: "sheet",
  ods: "sheet",
  // Google Slides types
  pptx: "slides",
  ppt: "slides",
  gslides: "slides",
  odp: "slides",
  // Text types
  txt: "text",
  md: "text",
};

/** Map file extensions to their MIME type */
export const EXTENSION_TO_MIME: Record<string, string> = {
  txt: TEXT_MIME_TYPES.PLAIN,
  md: TEXT_MIME_TYPES.MARKDOWN,
  csv: TEXT_MIME_TYPES.CSV,
  html: TEXT_MIME_TYPES.HTML,
};

/**
 * Get the file extension from a filename.
 */
export function getExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() || "";
}

/**
 * Infer file type from filename extension.
 */
export function inferTypeFromExtension(filename: string): FileType | undefined {
  const ext = getExtension(filename);
  return EXTENSION_TO_TYPE[ext];
}

/**
 * Get MIME type from filename extension for text files.
 */
export function getMimeTypeFromExtension(filename: string): string {
  const ext = getExtension(filename);
  return EXTENSION_TO_MIME[ext] || TEXT_MIME_TYPES.PLAIN;
}

/**
 * Check if a MIME type is a Google Workspace type.
 */
export function isGoogleWorkspaceMimeType(mimeType: string): boolean {
  return mimeType.startsWith("application/vnd.google-apps.");
}

/**
 * Check if a MIME type is a folder.
 */
export function isFolder(mimeType: string): boolean {
  return mimeType === GOOGLE_MIME_TYPES.FOLDER;
}

/**
 * Get the file type category from a Google Workspace MIME type.
 */
export function getTypeFromGoogleMime(mimeType: string): FileType | undefined {
  switch (mimeType) {
    case GOOGLE_MIME_TYPES.DOCUMENT:
      return "doc";
    case GOOGLE_MIME_TYPES.SPREADSHEET:
      return "sheet";
    case GOOGLE_MIME_TYPES.PRESENTATION:
      return "slides";
    default:
      return undefined;
  }
}

/**
 * Returns a suggestion for which tool to use based on the file's MIME type.
 * Used when a user calls the wrong specific handler (e.g., getGoogleDocContent on a Sheet).
 */
export function getMimeTypeSuggestion(
  mimeType: string | null | undefined,
): string {
  switch (mimeType) {
    case GOOGLE_MIME_TYPES.DOCUMENT:
      return "Use getGoogleDocContent for Google Docs.";
    case GOOGLE_MIME_TYPES.SPREADSHEET:
      return "Use getGoogleSheetContent for spreadsheets.";
    case GOOGLE_MIME_TYPES.PRESENTATION:
      return "Use getGoogleSlidesContent for presentations.";
    default:
      return "Use getFileContent for automatic type detection.";
  }
}
