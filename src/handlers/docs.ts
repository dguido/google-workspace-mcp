import type { drive_v3, docs_v1 } from 'googleapis';
import { log, successResponse, errorResponse } from '../utils/index.js';
import type { ToolResponse } from '../utils/index.js';
import {
  CreateGoogleDocSchema,
  UpdateGoogleDocSchema,
  FormatGoogleDocTextSchema,
  FormatGoogleDocParagraphSchema,
  GetGoogleDocContentSchema,
  AppendToDocSchema
} from '../schemas/index.js';
import { resolveFolderId, checkFileExists } from './helpers.js';

export async function handleCreateGoogleDoc(
  drive: drive_v3.Drive,
  docs: docs_v1.Docs,
  args: unknown
): Promise<ToolResponse> {
  const validation = CreateGoogleDocSchema.safeParse(args);
  if (!validation.success) {
    return errorResponse(validation.error.errors[0].message);
  }
  const data = validation.data;

  const parentFolderId = await resolveFolderId(drive, data.parentFolderId);

  // Check if document already exists
  const existingFileId = await checkFileExists(drive, data.name, parentFolderId);
  if (existingFileId) {
    return errorResponse(
      `A document named "${data.name}" already exists in this location. ` +
      `To update it, use updateGoogleDoc with documentId: ${existingFileId}`
    );
  }

  log('Creating Google Doc', { parentFolderId });

  // Create empty doc
  let docResponse;
  try {
    docResponse = await drive.files.create({
      requestBody: {
        name: data.name,
        mimeType: 'application/vnd.google-apps.document',
        parents: [parentFolderId]
      },
      fields: 'id, name, webViewLink',
      supportsAllDrives: true
    });
  } catch (createError: unknown) {
    const err = createError as { message?: string; code?: number; errors?: unknown; status?: number };
    log('Drive files.create error details:', {
      message: err.message,
      code: err.code,
      errors: err.errors,
      status: err.status
    });
    throw createError;
  }
  const doc = docResponse.data;

  await docs.documents.batchUpdate({
    documentId: doc.id!,
    requestBody: {
      requests: [
        {
          insertText: { location: { index: 1 }, text: data.content }
        },
        // Ensure the text is formatted as normal text, not as a header
        {
          updateParagraphStyle: {
            range: {
              startIndex: 1,
              endIndex: data.content.length + 1
            },
            paragraphStyle: {
              namedStyleType: 'NORMAL_TEXT'
            },
            fields: 'namedStyleType'
          }
        }
      ]
    }
  });

  return successResponse(
    `Created Google Doc: ${doc.name}\nID: ${doc.id}\nLink: ${doc.webViewLink}`
  );
}

export async function handleUpdateGoogleDoc(
  docs: docs_v1.Docs,
  args: unknown
): Promise<ToolResponse> {
  const validation = UpdateGoogleDocSchema.safeParse(args);
  if (!validation.success) {
    return errorResponse(validation.error.errors[0].message);
  }
  const data = validation.data;

  const document = await docs.documents.get({ documentId: data.documentId });

  // Delete all content
  // End index of last piece of content (body's last element, fallback to 1 if none)
  const endIndex = document.data.body?.content?.[
    document.data.body.content.length - 1
  ]?.endIndex || 1;

  // Google Docs API doesn't allow deleting the final newline character
  // We need to leave at least one character in the document
  const deleteEndIndex = Math.max(1, endIndex - 1);

  if (deleteEndIndex > 1) {
    await docs.documents.batchUpdate({
      documentId: data.documentId,
      requestBody: {
        requests: [{
          deleteContentRange: {
            range: { startIndex: 1, endIndex: deleteEndIndex }
          }
        }]
      }
    });
  }

  // Insert new content
  await docs.documents.batchUpdate({
    documentId: data.documentId,
    requestBody: {
      requests: [
        {
          insertText: { location: { index: 1 }, text: data.content }
        },
        // Ensure the text is formatted as normal text, not as a header
        {
          updateParagraphStyle: {
            range: {
              startIndex: 1,
              endIndex: data.content.length + 1
            },
            paragraphStyle: {
              namedStyleType: 'NORMAL_TEXT'
            },
            fields: 'namedStyleType'
          }
        }
      ]
    }
  });

  return successResponse(`Updated Google Doc: ${document.data.title}`);
}

export async function handleFormatGoogleDocText(
  docs: docs_v1.Docs,
  args: unknown
): Promise<ToolResponse> {
  const validation = FormatGoogleDocTextSchema.safeParse(args);
  if (!validation.success) {
    return errorResponse(validation.error.errors[0].message);
  }
  const data = validation.data;

  // Build text style object
  const textStyle: Record<string, unknown> = {};
  const fields: string[] = [];

  if (data.bold !== undefined) {
    textStyle.bold = data.bold;
    fields.push('bold');
  }

  if (data.italic !== undefined) {
    textStyle.italic = data.italic;
    fields.push('italic');
  }

  if (data.underline !== undefined) {
    textStyle.underline = data.underline;
    fields.push('underline');
  }

  if (data.strikethrough !== undefined) {
    textStyle.strikethrough = data.strikethrough;
    fields.push('strikethrough');
  }

  if (data.fontSize !== undefined) {
    textStyle.fontSize = {
      magnitude: data.fontSize,
      unit: 'PT'
    };
    fields.push('fontSize');
  }

  if (data.foregroundColor) {
    textStyle.foregroundColor = {
      color: {
        rgbColor: {
          red: data.foregroundColor.red || 0,
          green: data.foregroundColor.green || 0,
          blue: data.foregroundColor.blue || 0
        }
      }
    };
    fields.push('foregroundColor');
  }

  if (fields.length === 0) {
    return errorResponse(
      "No formatting options specified. Provide at least one of: " +
      "bold, italic, underline, strikethrough, fontSize, foregroundColor."
    );
  }

  await docs.documents.batchUpdate({
    documentId: data.documentId,
    requestBody: {
      requests: [{
        updateTextStyle: {
          range: {
            startIndex: data.startIndex,
            endIndex: data.endIndex
          },
          textStyle,
          fields: fields.join(',')
        }
      }]
    }
  });

  return successResponse(
    `Applied text formatting to range ${data.startIndex}-${data.endIndex}`
  );
}

export async function handleFormatGoogleDocParagraph(
  docs: docs_v1.Docs,
  args: unknown
): Promise<ToolResponse> {
  const validation = FormatGoogleDocParagraphSchema.safeParse(args);
  if (!validation.success) {
    return errorResponse(validation.error.errors[0].message);
  }
  const data = validation.data;

  // Build paragraph style object
  const paragraphStyle: Record<string, unknown> = {};
  const fields: string[] = [];

  if (data.namedStyleType !== undefined) {
    paragraphStyle.namedStyleType = data.namedStyleType;
    fields.push('namedStyleType');
  }

  if (data.alignment !== undefined) {
    paragraphStyle.alignment = data.alignment;
    fields.push('alignment');
  }

  if (data.lineSpacing !== undefined) {
    paragraphStyle.lineSpacing = data.lineSpacing;
    fields.push('lineSpacing');
  }

  if (data.spaceAbove !== undefined) {
    paragraphStyle.spaceAbove = {
      magnitude: data.spaceAbove,
      unit: 'PT'
    };
    fields.push('spaceAbove');
  }

  if (data.spaceBelow !== undefined) {
    paragraphStyle.spaceBelow = {
      magnitude: data.spaceBelow,
      unit: 'PT'
    };
    fields.push('spaceBelow');
  }

  if (fields.length === 0) {
    return errorResponse(
      "No paragraph formatting options specified. Provide at least one of: " +
      "namedStyleType, alignment, lineSpacing, spaceAbove, spaceBelow."
    );
  }

  await docs.documents.batchUpdate({
    documentId: data.documentId,
    requestBody: {
      requests: [{
        updateParagraphStyle: {
          range: {
            startIndex: data.startIndex,
            endIndex: data.endIndex
          },
          paragraphStyle,
          fields: fields.join(',')
        }
      }]
    }
  });

  return successResponse(
    `Applied paragraph formatting to range ${data.startIndex}-${data.endIndex}`
  );
}

export async function handleGetGoogleDocContent(
  docs: docs_v1.Docs,
  args: unknown
): Promise<ToolResponse> {
  const validation = GetGoogleDocContentSchema.safeParse(args);
  if (!validation.success) {
    return errorResponse(validation.error.errors[0].message);
  }
  const data = validation.data;

  const document = await docs.documents.get({ documentId: data.documentId });

  let content = '';
  let currentIndex = 1;

  // Extract text content with indices
  if (document.data.body?.content) {
    for (const element of document.data.body.content) {
      if (element.paragraph?.elements) {
        for (const textElement of element.paragraph.elements) {
          if (textElement.textRun?.content) {
            const text = textElement.textRun.content;
            content += text;
            currentIndex += text.length;
          }
        }
      }
    }
  }

  // Format the response to show text with indices
  let formattedContent = 'Document content with indices:\n\n';
  let lineStart = 1;
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineEnd = lineStart + line.length;
    if (line.trim()) {
      formattedContent += `[${lineStart}-${lineEnd}] ${line}\n`;
    }
    lineStart = lineEnd + 1; // +1 for the newline character
  }

  return successResponse(
    formattedContent + `\nTotal length: ${content.length} characters`
  );
}

export async function handleAppendToDoc(
  docs: docs_v1.Docs,
  args: unknown
): Promise<ToolResponse> {
  const validation = AppendToDocSchema.safeParse(args);
  if (!validation.success) {
    return errorResponse(validation.error.errors[0].message);
  }
  const data = validation.data;

  // Get document to find end index
  const document = await docs.documents.get({ documentId: data.documentId });

  // Find the end index of the document content
  // body.content[last].endIndex gives us the position after the last character
  const bodyContent = document.data.body?.content || [];
  const lastElement = bodyContent[bodyContent.length - 1];
  const endIndex = lastElement?.endIndex || 1;

  // Insert at end index - 1 (before the final newline)
  const insertIndex = Math.max(1, endIndex - 1);

  // Prepare the text to insert
  const textToInsert = data.insertNewline ? `\n${data.text}` : data.text;

  await docs.documents.batchUpdate({
    documentId: data.documentId,
    requestBody: {
      requests: [{
        insertText: {
          location: { index: insertIndex },
          text: textToInsert
        }
      }]
    }
  });

  log('Text appended to document', { documentId: data.documentId, textLength: data.text.length });

  return successResponse(
    `Appended ${data.text.length} characters to document "${document.data.title}"`
  );
}
