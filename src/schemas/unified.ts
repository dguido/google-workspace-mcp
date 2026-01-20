import { z } from 'zod';

/**
 * Smart file creation that infers type from name/content.
 * Routes to appropriate Google Workspace type based on extension or explicit type.
 */
export const CreateFileSchema = z.object({
  name: z.string().min(1, "File name is required"),
  content: z.union([
    z.string(),
    z.array(z.array(z.string())),  // 2D array for sheets
    z.array(z.object({             // Slides array
      title: z.string(),
      content: z.string()
    }))
  ]),
  parentFolderId: z.string().optional(),
  parentPath: z.string().optional(),
  type: z.enum(["doc", "sheet", "slides", "text"]).optional()
}).refine(data => !(data.parentFolderId && data.parentPath), {
  message: "Provide either parentFolderId or parentPath, not both"
});

export type CreateFileInput = z.infer<typeof CreateFileSchema>;

/**
 * Smart file update that detects file type from ID.
 * Routes to appropriate update handler based on file's mimeType.
 */
export const UpdateFileSchema = z.object({
  fileId: z.string().optional(),
  filePath: z.string().optional(),
  content: z.union([
    z.string(),
    z.array(z.array(z.string())),  // 2D array for sheets
    z.array(z.object({             // Slides array
      title: z.string(),
      content: z.string()
    }))
  ]),
  range: z.string().optional()  // For sheets: "Sheet1!A1:C10"
}).refine(data => data.fileId || data.filePath, {
  message: "Either fileId or filePath must be provided"
}).refine(data => !(data.fileId && data.filePath), {
  message: "Provide either fileId or filePath, not both"
});

export type UpdateFileInput = z.infer<typeof UpdateFileSchema>;

/**
 * Smart content retrieval that detects file type.
 * Returns structured content for Sheets/Slides, text for Docs/text files.
 */
export const GetFileContentSchema = z.object({
  fileId: z.string().optional(),
  filePath: z.string().optional(),
  range: z.string().optional()  // For sheets: "Sheet1!A1:C10"
}).refine(data => data.fileId || data.filePath, {
  message: "Either fileId or filePath must be provided"
}).refine(data => !(data.fileId && data.filePath), {
  message: "Provide either fileId or filePath, not both"
});

export type GetFileContentInput = z.infer<typeof GetFileContentSchema>;
