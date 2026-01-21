import type { drive_v3, docs_v1 } from "googleapis";
import {
  log,
  successResponse,
  structuredResponse,
  errorResponse,
  withTimeout,
  validateArgs,
} from "../utils/index.js";
import { GOOGLE_MIME_TYPES, getMimeTypeSuggestion } from "../utils/mimeTypes.js";
import type { ToolResponse } from "../utils/index.js";
import {
  CreateGoogleDocSchema,
  UpdateGoogleDocSchema,
  GetGoogleDocContentSchema,
  AppendToDocSchema,
  InsertTextInDocSchema,
  DeleteTextInDocSchema,
  ReplaceTextInDocSchema,
  FormatGoogleDocRangeSchema,
} from "../schemas/index.js";
import { resolveOptionalFolderPath, checkFileExists } from "./helpers.js";
import { toDocsColorStyle } from "../utils/colors.js";

/**
 * Get the end index of a Google Doc's content.
 * Used for calculating document length and insert positions.
 */
function getDocumentEndIndex(document: docs_v1.Schema$Document): number {
  const content = document.body?.content;
  if (!content || content.length === 0) return 1;
  return content[content.length - 1]?.endIndex || 1;
}

export async function handleCreateGoogleDoc(
  drive: drive_v3.Drive,
  docs: docs_v1.Docs,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(CreateGoogleDocSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  const parentFolderId = await resolveOptionalFolderPath(
    drive,
    data.parentFolderId,
    data.parentPath,
  );

  // Check if document already exists
  const existingFileId = await checkFileExists(drive, data.name, parentFolderId);
  if (existingFileId) {
    return errorResponse(
      `A document named "${data.name}" already exists in this location. ` +
        `To update it, use updateGoogleDoc with documentId: ${existingFileId}`,
      { code: "ALREADY_EXISTS", context: { existingFileId } },
    );
  }

  log("Creating Google Doc", { parentFolderId });

  // Create empty doc
  let docResponse;
  try {
    docResponse = await drive.files.create({
      requestBody: {
        name: data.name,
        mimeType: "application/vnd.google-apps.document",
        parents: [parentFolderId],
      },
      fields: "id, name, webViewLink",
      supportsAllDrives: true,
    });
  } catch (createError: unknown) {
    const err = createError as {
      message?: string;
      code?: number;
      errors?: unknown;
      status?: number;
    };
    log("Drive files.create error details:", {
      message: err.message,
      code: err.code,
      errors: err.errors,
      status: err.status,
    });
    throw createError;
  }
  const doc = docResponse.data;

  await docs.documents.batchUpdate({
    documentId: doc.id!,
    requestBody: {
      requests: [
        {
          insertText: { location: { index: 1 }, text: data.content },
        },
        // Ensure the text is formatted as normal text, not as a header
        {
          updateParagraphStyle: {
            range: {
              startIndex: 1,
              endIndex: data.content.length + 1,
            },
            paragraphStyle: {
              namedStyleType: "NORMAL_TEXT",
            },
            fields: "namedStyleType",
          },
        },
      ],
    },
  });

  return successResponse(
    `Created Google Doc: ${doc.name}\nID: ${doc.id}\nLink: ${doc.webViewLink}`,
  );
}

export async function handleUpdateGoogleDoc(
  docs: docs_v1.Docs,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(UpdateGoogleDocSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  const document = await docs.documents.get({ documentId: data.documentId });

  // Delete all content
  const endIndex = getDocumentEndIndex(document.data);

  // Google Docs API doesn't allow deleting the final newline character
  // We need to leave at least one character in the document
  const deleteEndIndex = Math.max(1, endIndex - 1);

  if (deleteEndIndex > 1) {
    await docs.documents.batchUpdate({
      documentId: data.documentId,
      requestBody: {
        requests: [
          {
            deleteContentRange: {
              range: { startIndex: 1, endIndex: deleteEndIndex },
            },
          },
        ],
      },
    });
  }

  // Insert new content
  await docs.documents.batchUpdate({
    documentId: data.documentId,
    requestBody: {
      requests: [
        {
          insertText: { location: { index: 1 }, text: data.content },
        },
        // Ensure the text is formatted as normal text, not as a header
        {
          updateParagraphStyle: {
            range: {
              startIndex: 1,
              endIndex: data.content.length + 1,
            },
            paragraphStyle: {
              namedStyleType: "NORMAL_TEXT",
            },
            fields: "namedStyleType",
          },
        },
      ],
    },
  });

  return successResponse(`Updated Google Doc: ${document.data.title}`);
}

export async function handleGetGoogleDocContent(
  drive: drive_v3.Drive,
  docs: docs_v1.Docs,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(GetGoogleDocContentSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  // Check file type before calling Docs API to provide helpful error messages
  const metadata = await drive.files.get({
    fileId: data.documentId,
    fields: "mimeType,name",
    supportsAllDrives: true,
  });

  const mimeType = metadata.data.mimeType;
  if (mimeType !== GOOGLE_MIME_TYPES.DOCUMENT) {
    const fileName = metadata.data.name || data.documentId;
    const suggestion = getMimeTypeSuggestion(mimeType);
    return errorResponse(`"${fileName}" is not a Google Doc (type: ${mimeType}). ${suggestion}`);
  }

  const document = await withTimeout(
    docs.documents.get({ documentId: data.documentId }),
    30000,
    "Get document content",
  );

  const contentSegments: Array<{
    startIndex: number;
    endIndex: number;
    text: string;
  }> = [];
  let content = "";
  let currentIndex = 1;

  // Extract text content with indices
  if (document.data.body?.content) {
    for (const element of document.data.body.content) {
      if (element.paragraph?.elements) {
        for (const textElement of element.paragraph.elements) {
          if (textElement.textRun?.content) {
            const text = textElement.textRun.content;
            const startIdx = currentIndex;
            content += text;
            currentIndex += text.length;
            contentSegments.push({
              startIndex: startIdx,
              endIndex: currentIndex,
              text: text,
            });
          }
        }
      }
    }
  }

  // Format the response to show text with indices
  let formattedContent = "Document content with indices:\n\n";
  let lineStart = 1;
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineEnd = lineStart + line.length;
    if (line.trim()) {
      formattedContent += `[${lineStart}-${lineEnd}] ${line}\n`;
    }
    lineStart = lineEnd + 1; // +1 for the newline character
  }

  const textResponse = formattedContent + `\nTotal length: ${content.length} characters`;

  return structuredResponse(textResponse, {
    documentId: data.documentId,
    title: document.data.title,
    content: contentSegments,
    totalLength: content.length,
  });
}

export async function handleAppendToDoc(docs: docs_v1.Docs, args: unknown): Promise<ToolResponse> {
  const validation = validateArgs(AppendToDocSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  // Get document to find end index
  const document = await docs.documents.get({ documentId: data.documentId });
  const endIndex = getDocumentEndIndex(document.data);

  // Insert at end index - 1 (before the final newline)
  const insertIndex = Math.max(1, endIndex - 1);

  // Prepare the text to insert
  const textToInsert = data.insertNewline ? `\n${data.text}` : data.text;

  await docs.documents.batchUpdate({
    documentId: data.documentId,
    requestBody: {
      requests: [
        {
          insertText: {
            location: { index: insertIndex },
            text: textToInsert,
          },
        },
      ],
    },
  });

  log("Text appended to document", {
    documentId: data.documentId,
    textLength: data.text.length,
  });

  return successResponse(
    `Appended ${data.text.length} characters to document "${document.data.title}"`,
  );
}

export async function handleInsertTextInDoc(
  docs: docs_v1.Docs,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(InsertTextInDocSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  // Get document to validate index and get title
  const document = await docs.documents.get({ documentId: data.documentId });
  const docLength = getDocumentEndIndex(document.data);

  if (data.index >= docLength) {
    return errorResponse(
      `Index ${data.index} is beyond the document length (${docLength - 1} characters). ` +
        `Use appendToDoc to add text at the end, or specify an index between 1 and ${docLength - 1}.`,
    );
  }

  await docs.documents.batchUpdate({
    documentId: data.documentId,
    requestBody: {
      requests: [
        {
          insertText: {
            location: { index: data.index },
            text: data.text,
          },
        },
      ],
    },
  });

  log("Text inserted into document", {
    documentId: data.documentId,
    index: data.index,
    textLength: data.text.length,
  });

  return successResponse(
    `Inserted ${data.text.length} characters at index ${data.index} in "${document.data.title}"`,
  );
}

export async function handleDeleteTextInDoc(
  docs: docs_v1.Docs,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(DeleteTextInDocSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  // Get document to validate indices and get title
  const document = await docs.documents.get({ documentId: data.documentId });
  const docLength = getDocumentEndIndex(document.data);

  if (data.endIndex > docLength) {
    return errorResponse(
      `End index ${data.endIndex} is beyond the document length (${docLength - 1} characters). ` +
        `Valid range is 1 to ${docLength - 1}.`,
    );
  }

  const charsToDelete = data.endIndex - data.startIndex;

  await docs.documents.batchUpdate({
    documentId: data.documentId,
    requestBody: {
      requests: [
        {
          deleteContentRange: {
            range: {
              startIndex: data.startIndex,
              endIndex: data.endIndex,
            },
          },
        },
      ],
    },
  });

  log("Text deleted from document", {
    documentId: data.documentId,
    startIndex: data.startIndex,
    endIndex: data.endIndex,
  });

  return successResponse(
    `Deleted ${charsToDelete} characters (indices ${data.startIndex}-${data.endIndex}) from "${document.data.title}"`,
  );
}

export async function handleReplaceTextInDoc(
  docs: docs_v1.Docs,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(ReplaceTextInDocSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  // Get document title
  const document = await docs.documents.get({ documentId: data.documentId });

  const response = await docs.documents.batchUpdate({
    documentId: data.documentId,
    requestBody: {
      requests: [
        {
          replaceAllText: {
            containsText: {
              text: data.searchText,
              matchCase: data.matchCase,
            },
            replaceText: data.replaceText,
          },
        },
      ],
    },
  });

  // Get the number of replacements made
  const occurrencesChanged = response.data.replies?.[0]?.replaceAllText?.occurrencesChanged || 0;

  log("Text replaced in document", {
    documentId: data.documentId,
    occurrences: occurrencesChanged,
  });

  if (occurrencesChanged === 0) {
    return successResponse(
      `No occurrences of "${data.searchText}" found in "${document.data.title}"`,
    );
  }

  return successResponse(
    `Replaced ${occurrencesChanged} occurrence(s) of "${data.searchText}" with "${data.replaceText}" in "${document.data.title}"`,
  );
}

// -----------------------------------------------------------------------------
// DOC FORMATTING HELPERS
// -----------------------------------------------------------------------------

interface DocTextFormatOptions {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  fontSize?: number;
  fontFamily?: string;
  foregroundColor?: { red?: number; green?: number; blue?: number };
}

function buildDocTextStyle(data: DocTextFormatOptions): {
  style: Record<string, unknown>;
  fields: string[];
} {
  const style: Record<string, unknown> = {};
  const fields: string[] = [];

  if (data.bold !== undefined) {
    style.bold = data.bold;
    fields.push("bold");
  }
  if (data.italic !== undefined) {
    style.italic = data.italic;
    fields.push("italic");
  }
  if (data.underline !== undefined) {
    style.underline = data.underline;
    fields.push("underline");
  }
  if (data.strikethrough !== undefined) {
    style.strikethrough = data.strikethrough;
    fields.push("strikethrough");
  }
  if (data.fontSize !== undefined) {
    style.fontSize = { magnitude: data.fontSize, unit: "PT" };
    fields.push("fontSize");
  }
  if (data.fontFamily !== undefined) {
    style.weightedFontFamily = { fontFamily: data.fontFamily };
    fields.push("weightedFontFamily");
  }
  if (data.foregroundColor) {
    style.foregroundColor = toDocsColorStyle(data.foregroundColor);
    fields.push("foregroundColor");
  }

  return { style, fields };
}

interface DocParagraphFormatOptions {
  namedStyleType?: string;
  alignment?: string;
  lineSpacing?: number;
  spaceAbove?: number;
  spaceBelow?: number;
}

function buildDocParagraphStyle(data: DocParagraphFormatOptions): {
  style: Record<string, unknown>;
  fields: string[];
} {
  const style: Record<string, unknown> = {};
  const fields: string[] = [];

  if (data.namedStyleType !== undefined) {
    style.namedStyleType = data.namedStyleType;
    fields.push("namedStyleType");
  }
  if (data.alignment !== undefined) {
    style.alignment = data.alignment;
    fields.push("alignment");
  }
  if (data.lineSpacing !== undefined) {
    style.lineSpacing = data.lineSpacing;
    fields.push("lineSpacing");
  }
  if (data.spaceAbove !== undefined) {
    style.spaceAbove = { magnitude: data.spaceAbove, unit: "PT" };
    fields.push("spaceAbove");
  }
  if (data.spaceBelow !== undefined) {
    style.spaceBelow = { magnitude: data.spaceBelow, unit: "PT" };
    fields.push("spaceBelow");
  }

  return { style, fields };
}

// -----------------------------------------------------------------------------
// DOC FORMATTING HANDLER
// -----------------------------------------------------------------------------

export async function handleFormatGoogleDocRange(
  docs: docs_v1.Docs,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(FormatGoogleDocRangeSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  const document = await docs.documents.get({ documentId: data.documentId });
  const docEndIndex = getDocumentEndIndex(document.data);
  const startIndex = data.startIndex ?? 1;
  const endIndex = data.endIndex ?? docEndIndex;

  const requests: docs_v1.Schema$Request[] = [];
  const formatsApplied: string[] = [];

  const textResult = buildDocTextStyle(data);
  if (textResult.fields.length > 0) {
    requests.push({
      updateTextStyle: {
        range: { startIndex, endIndex },
        textStyle: textResult.style,
        fields: textResult.fields.join(","),
      },
    });
    formatsApplied.push(...textResult.fields);
  }

  const paragraphResult = buildDocParagraphStyle(data);
  if (paragraphResult.fields.length > 0) {
    requests.push({
      updateParagraphStyle: {
        range: { startIndex, endIndex },
        paragraphStyle: paragraphResult.style,
        fields: paragraphResult.fields.join(","),
      },
    });
    formatsApplied.push(...paragraphResult.fields);
  }

  if (requests.length === 0) {
    return errorResponse(
      "No formatting options specified. Provide at least one of: " +
        "bold, italic, underline, strikethrough, fontSize, fontFamily, foregroundColor, " +
        "namedStyleType, alignment, lineSpacing, spaceAbove, spaceBelow.",
    );
  }

  await docs.documents.batchUpdate({
    documentId: data.documentId,
    requestBody: { requests },
  });

  log("Applied formatting to document range", {
    documentId: data.documentId,
    startIndex,
    endIndex,
    formatsApplied,
  });
  return successResponse(
    `Applied formatting to range ${startIndex}-${endIndex}: ${formatsApplied.join(", ")}`,
  );
}
