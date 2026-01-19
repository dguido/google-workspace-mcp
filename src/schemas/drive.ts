import { z } from 'zod';

export const SearchSchema = z.object({
  query: z.string().min(1, "Search query is required"),
  pageSize: z.number().int().min(1).max(100).optional(),
  pageToken: z.string().optional()
});

export const CreateTextFileSchema = z.object({
  name: z.string().min(1, "File name is required"),
  content: z.string(),
  parentFolderId: z.string().optional()
});

export const UpdateTextFileSchema = z.object({
  fileId: z.string().min(1, "File ID is required"),
  content: z.string(),
  name: z.string().optional()
});

export const CreateFolderSchema = z.object({
  name: z.string().min(1, "Folder name is required"),
  parent: z.string().optional()
});

export const ListFolderSchema = z.object({
  folderId: z.string().optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
  pageToken: z.string().optional()
});

export const DeleteItemSchema = z.object({
  itemId: z.string().min(1, "Item ID is required")
});

export const RenameItemSchema = z.object({
  itemId: z.string().min(1, "Item ID is required"),
  newName: z.string().min(1, "New name is required")
});

export const MoveItemSchema = z.object({
  itemId: z.string().min(1, "Item ID is required"),
  destinationFolderId: z.string().optional()
});

export const CopyFileSchema = z.object({
  sourceFileId: z.string().min(1, "Source file ID is required"),
  destinationName: z.string().optional(),
  destinationFolderId: z.string().optional()
});

export const GetFileMetadataSchema = z.object({
  fileId: z.string().min(1, "File ID is required")
});

export const ExportFileSchema = z.object({
  fileId: z.string().min(1, "File ID is required"),
  format: z.enum(["pdf", "docx", "xlsx", "pptx", "csv", "tsv", "odt", "ods", "odp"]),
  outputPath: z.string().optional()
});

// Sharing schemas
export const ShareFileSchema = z.object({
  fileId: z.string().min(1, "File ID is required"),
  role: z.enum(["reader", "commenter", "writer", "organizer"]),
  type: z.enum(["user", "group", "domain", "anyone"]),
  emailAddress: z.string().email().optional(),
  domain: z.string().optional(),
  sendNotificationEmail: z.boolean().optional().default(true),
  emailMessage: z.string().optional()
});

export const GetSharingSchema = z.object({
  fileId: z.string().min(1, "File ID is required")
});

// Revision schemas
export const ListRevisionsSchema = z.object({
  fileId: z.string().min(1, "File ID is required"),
  pageSize: z.number().int().min(1).max(1000).optional()
});

export const RestoreRevisionSchema = z.object({
  fileId: z.string().min(1, "File ID is required"),
  revisionId: z.string().min(1, "Revision ID is required")
});

// Binary file schemas
export const DownloadFileSchema = z.object({
  fileId: z.string().min(1, "File ID is required"),
  outputPath: z.string().optional()
});

export const UploadFileSchema = z.object({
  name: z.string().min(1, "File name is required"),
  sourcePath: z.string().optional(),
  base64Content: z.string().optional(),
  mimeType: z.string().optional(),
  folderId: z.string().optional()
});

// Metadata schemas
export const GetStorageQuotaSchema = z.object({});

export const StarFileSchema = z.object({
  fileId: z.string().min(1, "File ID is required"),
  starred: z.boolean()
});

// Type exports
export type SearchInput = z.infer<typeof SearchSchema>;
export type CreateTextFileInput = z.infer<typeof CreateTextFileSchema>;
export type UpdateTextFileInput = z.infer<typeof UpdateTextFileSchema>;
export type CreateFolderInput = z.infer<typeof CreateFolderSchema>;
export type ListFolderInput = z.infer<typeof ListFolderSchema>;
export type DeleteItemInput = z.infer<typeof DeleteItemSchema>;
export type RenameItemInput = z.infer<typeof RenameItemSchema>;
export type MoveItemInput = z.infer<typeof MoveItemSchema>;
export type CopyFileInput = z.infer<typeof CopyFileSchema>;
export type GetFileMetadataInput = z.infer<typeof GetFileMetadataSchema>;
export type ExportFileInput = z.infer<typeof ExportFileSchema>;
export type ShareFileInput = z.infer<typeof ShareFileSchema>;
export type GetSharingInput = z.infer<typeof GetSharingSchema>;
export type ListRevisionsInput = z.infer<typeof ListRevisionsSchema>;
export type RestoreRevisionInput = z.infer<typeof RestoreRevisionSchema>;
export type DownloadFileInput = z.infer<typeof DownloadFileSchema>;
export type UploadFileInput = z.infer<typeof UploadFileSchema>;
export type GetStorageQuotaInput = z.infer<typeof GetStorageQuotaSchema>;
export type StarFileInput = z.infer<typeof StarFileSchema>;
