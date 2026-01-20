import { z } from "zod";

export const CreateGoogleDocSchema = z
  .object({
    name: z.string().min(1, "Document name is required"),
    content: z.string(),
    parentFolderId: z.string().optional(),
    parentPath: z.string().optional(),
  })
  .refine((data) => !(data.parentFolderId && data.parentPath), {
    message: "Provide either parentFolderId or parentPath, not both",
  });

export const UpdateGoogleDocSchema = z.object({
  documentId: z.string().min(1, "Document ID is required"),
  content: z.string(),
});

export const GetGoogleDocContentSchema = z.object({
  documentId: z.string().min(1, "Document ID is required"),
});

export const AppendToDocSchema = z.object({
  documentId: z.string().min(1, "Document ID is required"),
  text: z.string().min(1, "Text is required"),
  insertNewline: z.boolean().optional().default(true),
});

export const InsertTextInDocSchema = z.object({
  documentId: z.string().min(1, "Document ID is required"),
  text: z.string().min(1, "Text is required"),
  index: z
    .number()
    .int()
    .min(1, "Index must be >= 1 (1 = beginning of document content)"),
});

export const DeleteTextInDocSchema = z
  .object({
    documentId: z.string().min(1, "Document ID is required"),
    startIndex: z.number().int().min(1, "Start index must be >= 1"),
    endIndex: z.number().int().min(2, "End index must be >= 2"),
  })
  .refine((data) => data.endIndex > data.startIndex, {
    message: "endIndex must be greater than startIndex",
  });

export const ReplaceTextInDocSchema = z.object({
  documentId: z.string().min(1, "Document ID is required"),
  searchText: z.string().min(1, "Search text is required"),
  replaceText: z.string(),
  matchCase: z.boolean().optional().default(true),
});

export const FormatGoogleDocRangeSchema = z.object({
  documentId: z.string().min(1, "Document ID is required"),
  startIndex: z.number().min(1, "Start index must be at least 1").optional(),
  endIndex: z.number().min(1, "End index must be at least 1").optional(),

  // Text formatting
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  strikethrough: z.boolean().optional(),
  fontSize: z.number().optional(),
  fontFamily: z.string().optional(),
  foregroundColor: z
    .object({
      red: z.number().min(0).max(1).optional(),
      green: z.number().min(0).max(1).optional(),
      blue: z.number().min(0).max(1).optional(),
    })
    .optional(),

  // Paragraph formatting
  alignment: z.enum(["START", "CENTER", "END", "JUSTIFIED"]).optional(),
  lineSpacing: z.number().optional(),
  spaceAbove: z.number().optional(),
  spaceBelow: z.number().optional(),
  namedStyleType: z
    .enum([
      "NORMAL_TEXT",
      "TITLE",
      "SUBTITLE",
      "HEADING_1",
      "HEADING_2",
      "HEADING_3",
      "HEADING_4",
      "HEADING_5",
      "HEADING_6",
    ])
    .optional(),
});

// Type exports
export type CreateGoogleDocInput = z.infer<typeof CreateGoogleDocSchema>;
export type UpdateGoogleDocInput = z.infer<typeof UpdateGoogleDocSchema>;
export type GetGoogleDocContentInput = z.infer<
  typeof GetGoogleDocContentSchema
>;
export type AppendToDocInput = z.infer<typeof AppendToDocSchema>;
export type InsertTextInDocInput = z.infer<typeof InsertTextInDocSchema>;
export type DeleteTextInDocInput = z.infer<typeof DeleteTextInDocSchema>;
export type ReplaceTextInDocInput = z.infer<typeof ReplaceTextInDocSchema>;
export type FormatGoogleDocRangeInput = z.infer<
  typeof FormatGoogleDocRangeSchema
>;
