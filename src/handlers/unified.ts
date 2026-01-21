import type { drive_v3, docs_v1, sheets_v4, slides_v1 } from "googleapis";
import { structuredResponse, errorResponse, validateArgs } from "../utils/index.js";
import type { ToolResponse } from "../utils/index.js";
import { CreateFileSchema, UpdateFileSchema, GetFileContentSchema } from "../schemas/unified.js";
import { resolveOptionalFolderPath, resolveFileIdFromPath } from "./helpers.js";
import {
  GOOGLE_MIME_TYPES,
  TEXT_MIME_TYPES,
  EXTENSION_TO_TYPE,
  type FileType,
  getExtension,
} from "../utils/mimeTypes.js";

/**
 * Infer file type from name extension or content structure
 */
function inferFileType(name: string, content: unknown, explicitType?: FileType): FileType {
  // Explicit type takes precedence
  if (explicitType) return explicitType;

  // Check extension
  const ext = getExtension(name);
  if (EXTENSION_TO_TYPE[ext]) {
    return EXTENSION_TO_TYPE[ext];
  }

  // Infer from content structure
  if (Array.isArray(content)) {
    // Check if it's a 2D array (sheet data)
    if (content.length > 0 && Array.isArray(content[0])) {
      return "sheet";
    }
    // Check if it's slides array
    if (
      content.length > 0 &&
      typeof content[0] === "object" &&
      "title" in content[0] &&
      "content" in content[0]
    ) {
      return "slides";
    }
  }

  // Default to doc for string content
  return "doc";
}

/**
 * Get file type from MIME type
 */
function getTypeFromMime(mimeType: string): FileType | "binary" {
  switch (mimeType) {
    case GOOGLE_MIME_TYPES.DOCUMENT:
      return "doc";
    case GOOGLE_MIME_TYPES.SPREADSHEET:
      return "sheet";
    case GOOGLE_MIME_TYPES.PRESENTATION:
      return "slides";
    case TEXT_MIME_TYPES.PLAIN:
    case TEXT_MIME_TYPES.MARKDOWN:
      return "text";
    default:
      if (mimeType.startsWith("text/")) return "text";
      return "binary";
  }
}

/**
 * Smart file creation that routes to appropriate handler based on type inference.
 */
export async function handleCreateFile(
  drive: drive_v3.Drive,
  docs: docs_v1.Docs,
  sheets: sheets_v4.Sheets,
  slides: slides_v1.Slides,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(CreateFileSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  // Resolve parent folder
  const parentFolderId = await resolveOptionalFolderPath(
    drive,
    data.parentFolderId,
    data.parentPath,
  );

  // Infer file type
  const fileType = inferFileType(data.name, data.content, data.type);

  switch (fileType) {
    case "doc": {
      const content =
        typeof data.content === "string" ? data.content : JSON.stringify(data.content);

      // Create Google Doc
      const doc = await drive.files.create({
        requestBody: {
          name: data.name,
          mimeType: GOOGLE_MIME_TYPES.DOCUMENT,
          parents: [parentFolderId],
        },
        supportsAllDrives: true,
      });

      // Insert content
      if (content) {
        await docs.documents.batchUpdate({
          documentId: doc.data.id!,
          requestBody: {
            requests: [
              { insertText: { location: { index: 1 }, text: content } },
              {
                updateParagraphStyle: {
                  range: { startIndex: 1, endIndex: content.length + 1 },
                  paragraphStyle: { namedStyleType: "NORMAL_TEXT" },
                  fields: "namedStyleType",
                },
              },
            ],
          },
        });
      }

      return structuredResponse(`Created Google Doc: ${data.name}\nID: ${doc.data.id}`, {
        id: doc.data.id,
        name: data.name,
        type: "doc",
        mimeType: GOOGLE_MIME_TYPES.DOCUMENT,
        webViewLink: `https://docs.google.com/document/d/${doc.data.id}/edit`,
      });
    }

    case "sheet": {
      // Ensure content is 2D array
      let sheetData: string[][];
      if (Array.isArray(data.content) && Array.isArray(data.content[0])) {
        sheetData = data.content as string[][];
      } else if (typeof data.content === "string") {
        // Parse CSV-like string
        sheetData = data.content.split("\n").map((row) => row.split(","));
      } else {
        return errorResponse("Sheet content must be a 2D array or CSV string");
      }

      // Create spreadsheet
      const spreadsheet = await sheets.spreadsheets.create({
        requestBody: {
          properties: { title: data.name },
          sheets: [
            {
              properties: {
                sheetId: 0,
                title: "Sheet1",
                gridProperties: {
                  rowCount: Math.max(1000, sheetData.length),
                  columnCount: 26,
                },
              },
            },
          ],
        },
      });

      // Move to folder
      await drive.files.update({
        fileId: spreadsheet.data.spreadsheetId!,
        addParents: parentFolderId,
        removeParents: "root",
        supportsAllDrives: true,
      });

      // Populate data
      if (sheetData.length > 0) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: spreadsheet.data.spreadsheetId!,
          range: "Sheet1!A1",
          valueInputOption: "RAW",
          requestBody: { values: sheetData },
        });
      }

      return structuredResponse(
        `Created Google Sheet: ${data.name}\nID: ${spreadsheet.data.spreadsheetId}`,
        {
          id: spreadsheet.data.spreadsheetId,
          name: data.name,
          type: "sheet",
          mimeType: GOOGLE_MIME_TYPES.SPREADSHEET,
          webViewLink: spreadsheet.data.spreadsheetUrl,
        },
      );
    }

    case "slides": {
      // Ensure content is slides array
      let slidesData: Array<{ title: string; content: string }>;
      if (
        Array.isArray(data.content) &&
        data.content.length > 0 &&
        typeof data.content[0] === "object" &&
        !Array.isArray(data.content[0]) &&
        "title" in data.content[0]
      ) {
        slidesData = data.content as Array<{ title: string; content: string }>;
      } else if (typeof data.content === "string") {
        // Create single slide with content
        slidesData = [{ title: data.name, content: data.content }];
      } else {
        return errorResponse("Slides content must be an array of {title, content} objects");
      }

      // Create presentation
      const presentation = await slides.presentations.create({
        requestBody: { title: data.name },
      });

      // Move to folder
      await drive.files.update({
        fileId: presentation.data.presentationId!,
        addParents: parentFolderId,
        removeParents: "root",
        supportsAllDrives: true,
      });

      // Add slides (simplified - would need full implementation for content)
      if (slidesData.length > 0) {
        const { randomUUID } = await import("node:crypto");
        const slideIds = slidesData.map(() => `slide_${randomUUID().substring(0, 8)}`);

        await slides.presentations.batchUpdate({
          presentationId: presentation.data.presentationId!,
          requestBody: {
            requests: slideIds.map((id) => ({
              createSlide: {
                objectId: id,
                slideLayoutReference: { predefinedLayout: "TITLE_AND_BODY" },
              },
            })),
          },
        });
      }

      return structuredResponse(
        `Created Google Slides: ${data.name}\nID: ${presentation.data.presentationId}`,
        {
          id: presentation.data.presentationId,
          name: data.name,
          type: "slides",
          mimeType: GOOGLE_MIME_TYPES.PRESENTATION,
          webViewLink: `https://docs.google.com/presentation/d/${presentation.data.presentationId}/edit`,
        },
      );
    }

    case "text": {
      const content =
        typeof data.content === "string" ? data.content : JSON.stringify(data.content);
      const mimeType = data.name.endsWith(".md") ? TEXT_MIME_TYPES.MARKDOWN : TEXT_MIME_TYPES.PLAIN;

      const file = await drive.files.create({
        requestBody: {
          name: data.name,
          mimeType,
          parents: [parentFolderId],
        },
        media: {
          mimeType,
          body: content,
        },
        supportsAllDrives: true,
      });

      return structuredResponse(`Created text file: ${data.name}\nID: ${file.data.id}`, {
        id: file.data.id,
        name: data.name,
        type: "text",
        mimeType,
        webViewLink: file.data.webViewLink,
      });
    }
  }
}

/**
 * Smart file update that detects file type and routes accordingly.
 */
export async function handleUpdateFile(
  drive: drive_v3.Drive,
  docs: docs_v1.Docs,
  sheets: sheets_v4.Sheets,
  _slides: slides_v1.Slides,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(UpdateFileSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  // Resolve file ID
  const fileId = await resolveFileIdFromPath(drive, data.fileId, data.filePath);

  // Get file metadata to determine type
  const file = await drive.files.get({
    fileId,
    fields: "name, mimeType",
    supportsAllDrives: true,
  });

  const fileType = getTypeFromMime(file.data.mimeType!);

  switch (fileType) {
    case "doc": {
      const content =
        typeof data.content === "string" ? data.content : JSON.stringify(data.content);

      // Get current document to find end index
      const doc = await docs.documents.get({ documentId: fileId });
      const endIndex = doc.data.body?.content?.slice(-1)[0]?.endIndex || 1;

      // Replace all content
      await docs.documents.batchUpdate({
        documentId: fileId,
        requestBody: {
          requests: [
            {
              deleteContentRange: {
                range: { startIndex: 1, endIndex: endIndex - 1 },
              },
            },
            { insertText: { location: { index: 1 }, text: content } },
          ],
        },
      });

      return structuredResponse(`Updated Google Doc: ${file.data.name}`, {
        id: fileId,
        name: file.data.name,
        type: "doc",
        updated: true,
      });
    }

    case "sheet": {
      let sheetData: string[][];
      if (Array.isArray(data.content) && Array.isArray(data.content[0])) {
        sheetData = data.content as string[][];
      } else if (typeof data.content === "string") {
        sheetData = data.content.split("\n").map((row) => row.split(","));
      } else {
        return errorResponse("Sheet content must be a 2D array or CSV string");
      }

      const range = data.range || "Sheet1!A1";

      await sheets.spreadsheets.values.update({
        spreadsheetId: fileId,
        range,
        valueInputOption: "RAW",
        requestBody: { values: sheetData },
      });

      return structuredResponse(`Updated Google Sheet: ${file.data.name}`, {
        id: fileId,
        name: file.data.name,
        type: "sheet",
        range,
        updated: true,
      });
    }

    case "slides": {
      return errorResponse(
        "Updating slides requires the updateGoogleSlides tool for slide-by-slide control. " +
          "Use updateGoogleSlides with presentationId and slides array.",
      );
    }

    case "text": {
      const content =
        typeof data.content === "string" ? data.content : JSON.stringify(data.content);

      await drive.files.update({
        fileId,
        media: {
          mimeType: file.data.mimeType!,
          body: content,
        },
        supportsAllDrives: true,
      });

      return structuredResponse(`Updated text file: ${file.data.name}`, {
        id: fileId,
        name: file.data.name,
        type: "text",
        updated: true,
      });
    }

    case "binary":
      return errorResponse(
        `Cannot update binary file "${file.data.name}" (${file.data.mimeType}). ` +
          "Use uploadFile to replace the file.",
      );
  }
}

/**
 * Smart content retrieval that returns appropriate format based on file type.
 */
export async function handleGetFileContent(
  drive: drive_v3.Drive,
  docs: docs_v1.Docs,
  sheets: sheets_v4.Sheets,
  slides: slides_v1.Slides,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(GetFileContentSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  // Resolve file ID
  const fileId = await resolveFileIdFromPath(drive, data.fileId, data.filePath);

  // Get file metadata
  const file = await drive.files.get({
    fileId,
    fields: "name, mimeType, modifiedTime, size",
    supportsAllDrives: true,
  });

  const fileType = getTypeFromMime(file.data.mimeType!);

  switch (fileType) {
    case "doc": {
      const doc = await docs.documents.get({ documentId: fileId });

      // Extract text content
      let content = "";
      const body = doc.data.body?.content || [];
      for (const element of body) {
        if (element.paragraph?.elements) {
          for (const textElement of element.paragraph.elements) {
            if (textElement.textRun?.content) {
              content += textElement.textRun.content;
            }
          }
        }
      }

      return structuredResponse(content.trim(), {
        fileId,
        name: file.data.name,
        type: "doc",
        mimeType: file.data.mimeType,
        content: content.trim(),
        metadata: {
          modifiedTime: file.data.modifiedTime,
          title: doc.data.title,
        },
      });
    }

    case "sheet": {
      const range = data.range || "A:ZZ";

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: fileId,
        range,
      });

      const values = response.data.values || [];

      return structuredResponse(
        `Sheet: ${file.data.name}\nRange: ${range}\nRows: ${values.length}`,
        {
          fileId,
          name: file.data.name,
          type: "sheet",
          mimeType: file.data.mimeType,
          content: values,
          range: response.data.range,
          metadata: {
            modifiedTime: file.data.modifiedTime,
            rowCount: values.length,
            columnCount: values[0]?.length || 0,
          },
        },
      );
    }

    case "slides": {
      const presentation = await slides.presentations.get({
        presentationId: fileId,
      });

      const slideData = (presentation.data.slides || []).map((slide, index) => {
        let title = "";
        let content = "";

        for (const element of slide.pageElements || []) {
          if (element.shape?.text?.textElements) {
            const text = element.shape.text.textElements
              .filter((te) => te.textRun?.content)
              .map((te) => te.textRun!.content)
              .join("");

            // First text element with content is likely the title
            if (!title && text.trim()) {
              title = text.trim();
            } else if (text.trim()) {
              content += text;
            }
          }
        }

        return {
          index,
          objectId: slide.objectId,
          title: title || `Slide ${index + 1}`,
          content: content.trim(),
        };
      });

      return structuredResponse(`Presentation: ${file.data.name}\nSlides: ${slideData.length}`, {
        fileId,
        name: file.data.name,
        type: "slides",
        mimeType: file.data.mimeType,
        content: slideData,
        metadata: {
          modifiedTime: file.data.modifiedTime,
          slideCount: slideData.length,
          title: presentation.data.title,
        },
      });
    }

    case "text": {
      const response = await drive.files.get(
        { fileId, alt: "media", supportsAllDrives: true },
        { responseType: "text" },
      );

      const content = typeof response.data === "string" ? response.data : String(response.data);

      return structuredResponse(content, {
        fileId,
        name: file.data.name,
        type: "text",
        mimeType: file.data.mimeType,
        content,
        metadata: {
          modifiedTime: file.data.modifiedTime,
          size: file.data.size,
        },
      });
    }

    case "binary":
      return errorResponse(
        `Cannot read binary file "${file.data.name}" (${file.data.mimeType}) as text. ` +
          "Use downloadFile to download the raw content.",
      );
  }
}
