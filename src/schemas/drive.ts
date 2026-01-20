import { z } from 'zod';

export const GetFolderTreeSchema = z
  .object({
    folderId: z.string().optional(),
    folderPath: z.string().optional(),
    depth: z.number().min(1).max(5).optional().default(2),
  })
  .refine((data) => !(data.folderId && data.folderPath), {
    message: 'Provide either folderId or folderPath, not both',
  });

export type GetFolderTreeInput = z.infer<typeof GetFolderTreeSchema>;

export const SearchSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  pageSize: z.number().int().min(1).max(100).optional(),
  pageToken: z.string().optional(),
});

export const CreateTextFileSchema = z
  .object({
    name: z.string().min(1, 'File name is required'),
    content: z.string(),
    parentFolderId: z.string().optional(),
    parentPath: z.string().optional(),
  })
  .refine((data) => !(data.parentFolderId && data.parentPath), {
    message: 'Provide either parentFolderId or parentPath, not both',
  });

export const UpdateTextFileSchema = z.object({
  fileId: z.string().min(1, 'File ID is required'),
  content: z.string(),
  name: z.string().optional(),
});

export const CreateFolderSchema = z
  .object({
    name: z.string().min(1, 'Folder name is required'),
    parent: z.string().optional(),
    parentPath: z.string().optional(),
  })
  .refine((data) => !(data.parent && data.parentPath), {
    message: 'Provide either parent (folderId) or parentPath, not both',
  });

export const ListFolderSchema = z.object({
  folderId: z.string().optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
  pageToken: z.string().optional(),
});

export const DeleteItemSchema = z.object({
  itemId: z.string().min(1, 'Item ID is required'),
});

export const RenameItemSchema = z.object({
  itemId: z.string().min(1, 'Item ID is required'),
  newName: z.string().min(1, 'New name is required'),
});

export const MoveItemSchema = z
  .object({
    itemId: z.string().min(1, 'Item ID is required'),
    destinationFolderId: z.string().optional(),
    destinationPath: z.string().optional(),
  })
  .refine((data) => !(data.destinationFolderId && data.destinationPath), {
    message: 'Provide either destinationFolderId or destinationPath, not both',
  });

export const CopyFileSchema = z.object({
  sourceFileId: z.string().min(1, 'Source file ID is required'),
  destinationName: z.string().optional(),
  destinationFolderId: z.string().optional(),
});

export const GetFileMetadataSchema = z.object({
  fileId: z.string().min(1, 'File ID is required'),
});

export const ExportFileSchema = z.object({
  fileId: z.string().min(1, 'File ID is required'),
  format: z.enum(['pdf', 'docx', 'xlsx', 'pptx', 'csv', 'tsv', 'odt', 'ods', 'odp']),
  outputPath: z.string().optional(),
});

// Sharing schemas
export const ShareFileSchema = z.object({
  fileId: z.string().min(1, 'File ID is required'),
  role: z.enum(['reader', 'commenter', 'writer', 'organizer']),
  type: z.enum(['user', 'group', 'domain', 'anyone']),
  emailAddress: z.string().email().optional(),
  domain: z.string().optional(),
  sendNotificationEmail: z.boolean().optional().default(true),
  emailMessage: z.string().optional(),
});

export const GetSharingSchema = z.object({
  fileId: z.string().min(1, 'File ID is required'),
});

// Revision schemas
export const ListRevisionsSchema = z.object({
  fileId: z.string().min(1, 'File ID is required'),
  pageSize: z.number().int().min(1).max(1000).optional(),
});

export const RestoreRevisionSchema = z.object({
  fileId: z.string().min(1, 'File ID is required'),
  revisionId: z.string().min(1, 'Revision ID is required'),
});

// Binary file schemas
export const DownloadFileSchema = z.object({
  fileId: z.string().min(1, 'File ID is required'),
  outputPath: z.string().optional(),
});

export const UploadFileSchema = z
  .object({
    name: z.string().min(1, 'File name is required'),
    sourcePath: z.string().optional(),
    base64Content: z.string().optional(),
    mimeType: z.string().optional(),
    folderId: z.string().optional(),
    folderPath: z.string().optional(),
  })
  .refine((data) => !(data.folderId && data.folderPath), {
    message: 'Provide either folderId or folderPath, not both',
  });

// Metadata schemas
export const GetStorageQuotaSchema = z.object({});

export const StarFileSchema = z.object({
  fileId: z.string().min(1, 'File ID is required'),
  starred: z.boolean(),
});

// File path resolution
export const ResolveFilePathSchema = z.object({
  path: z.string().min(1, 'Path is required'),
  type: z.enum(['file', 'folder', 'any']).optional().default('any'),
});

// Batch operations
export const BatchDeleteSchema = z.object({
  fileIds: z
    .array(z.string())
    .min(1, 'At least one file ID required')
    .max(100, 'Maximum 100 files per batch'),
});

export const BatchMoveSchema = z
  .object({
    fileIds: z
      .array(z.string())
      .min(1, 'At least one file ID required')
      .max(100, 'Maximum 100 files per batch'),
    destinationFolderId: z.string().optional(),
    destinationPath: z.string().optional(),
  })
  .refine((data) => data.destinationFolderId || data.destinationPath, {
    message: 'Either destinationFolderId or destinationPath is required',
  })
  .refine((data) => !(data.destinationFolderId && data.destinationPath), {
    message: 'Provide either destinationFolderId or destinationPath, not both',
  });

export const BatchShareSchema = z.object({
  fileIds: z
    .array(z.string())
    .min(1, 'At least one file ID required')
    .max(100, 'Maximum 100 files per batch'),
  email: z.string().email('Valid email is required'),
  role: z.enum(['reader', 'writer', 'commenter']),
  sendNotification: z.boolean().optional().default(true),
});

// Permission management
export const RemovePermissionSchema = z
  .object({
    fileId: z.string().min(1, 'File ID is required'),
    permissionId: z.string().optional(),
    email: z.string().email().optional(),
  })
  .refine((data) => data.permissionId || data.email, {
    message: 'Either permissionId or email is required',
  });

// Trash management
export const ListTrashSchema = z.object({
  pageSize: z.number().int().min(1).max(100).optional().default(50),
  pageToken: z.string().optional(),
});

export const RestoreFromTrashSchema = z.object({
  fileId: z.string().min(1, 'File ID is required'),
});

export const EmptyTrashSchema = z.object({
  confirm: z.literal(true, {
    errorMap: () => ({ message: 'Must set confirm: true to empty trash' }),
  }),
  driveId: z.string().optional(),
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
export type ResolveFilePathInput = z.infer<typeof ResolveFilePathSchema>;
export type BatchDeleteInput = z.infer<typeof BatchDeleteSchema>;
export type BatchMoveInput = z.infer<typeof BatchMoveSchema>;
export type BatchShareInput = z.infer<typeof BatchShareSchema>;
export type RemovePermissionInput = z.infer<typeof RemovePermissionSchema>;
export type ListTrashInput = z.infer<typeof ListTrashSchema>;
export type RestoreFromTrashInput = z.infer<typeof RestoreFromTrashSchema>;
export type EmptyTrashInput = z.infer<typeof EmptyTrashSchema>;
