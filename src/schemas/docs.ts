import { z } from 'zod';

export const CreateGoogleDocSchema = z.object({
  name: z.string().min(1, "Document name is required"),
  content: z.string(),
  parentFolderId: z.string().optional()
});

export const UpdateGoogleDocSchema = z.object({
  documentId: z.string().min(1, "Document ID is required"),
  content: z.string()
});

export const FormatGoogleDocTextSchema = z.object({
  documentId: z.string().min(1, "Document ID is required"),
  startIndex: z.number().min(1, "Start index must be at least 1"),
  endIndex: z.number().min(1, "End index must be at least 1"),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  strikethrough: z.boolean().optional(),
  fontSize: z.number().optional(),
  foregroundColor: z.object({
    red: z.number().min(0).max(1).optional(),
    green: z.number().min(0).max(1).optional(),
    blue: z.number().min(0).max(1).optional()
  }).optional()
});

export const FormatGoogleDocParagraphSchema = z.object({
  documentId: z.string().min(1, "Document ID is required"),
  startIndex: z.number().min(1, "Start index must be at least 1"),
  endIndex: z.number().min(1, "End index must be at least 1"),
  namedStyleType: z.enum([
    'NORMAL_TEXT', 'TITLE', 'SUBTITLE',
    'HEADING_1', 'HEADING_2', 'HEADING_3',
    'HEADING_4', 'HEADING_5', 'HEADING_6'
  ]).optional(),
  alignment: z.enum(['START', 'CENTER', 'END', 'JUSTIFIED']).optional(),
  lineSpacing: z.number().optional(),
  spaceAbove: z.number().optional(),
  spaceBelow: z.number().optional()
});

export const GetGoogleDocContentSchema = z.object({
  documentId: z.string().min(1, "Document ID is required")
});

export const AppendToDocSchema = z.object({
  documentId: z.string().min(1, "Document ID is required"),
  text: z.string().min(1, "Text is required"),
  insertNewline: z.boolean().optional().default(true)
});

// Type exports
export type CreateGoogleDocInput = z.infer<typeof CreateGoogleDocSchema>;
export type UpdateGoogleDocInput = z.infer<typeof UpdateGoogleDocSchema>;
export type FormatGoogleDocTextInput = z.infer<typeof FormatGoogleDocTextSchema>;
export type FormatGoogleDocParagraphInput = z.infer<typeof FormatGoogleDocParagraphSchema>;
export type GetGoogleDocContentInput = z.infer<typeof GetGoogleDocContentSchema>;
export type AppendToDocInput = z.infer<typeof AppendToDocSchema>;
