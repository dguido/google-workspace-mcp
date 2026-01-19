import type { drive_v3 } from 'googleapis';
import { log, successResponse, errorResponse } from '../utils/index.js';
import type { ToolResponse } from '../utils/index.js';
import {
  SearchSchema,
  CreateTextFileSchema,
  UpdateTextFileSchema,
  CreateFolderSchema,
  ListFolderSchema,
  DeleteItemSchema,
  RenameItemSchema,
  MoveItemSchema,
  CopyFileSchema,
  GetFileMetadataSchema,
  ExportFileSchema,
  ShareFileSchema,
  GetSharingSchema,
  ListRevisionsSchema,
  RestoreRevisionSchema,
  DownloadFileSchema,
  UploadFileSchema,
  GetStorageQuotaSchema,
  StarFileSchema
} from '../schemas/index.js';
import {
  FOLDER_MIME_TYPE,
  TEXT_MIME_TYPES,
  getMimeTypeFromFilename,
  validateTextFileExtension,
  resolveFolderId,
  checkFileExists
} from './helpers.js';

export async function handleSearch(
  drive: drive_v3.Drive,
  args: unknown
): Promise<ToolResponse> {
  const validation = SearchSchema.safeParse(args);
  if (!validation.success) {
    return errorResponse(validation.error.errors[0].message);
  }
  const { query: userQuery, pageSize, pageToken } = validation.data;

  const escapedQuery = userQuery.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const formattedQuery = `fullText contains '${escapedQuery}' and trashed = false`;

  const res = await drive.files.list({
    q: formattedQuery,
    pageSize: Math.min(pageSize || 50, 100),
    pageToken: pageToken,
    fields: "nextPageToken, files(id, name, mimeType, modifiedTime, size)",
    includeItemsFromAllDrives: true,
    supportsAllDrives: true
  });

  const fileList = res.data.files?.map(
    (f: drive_v3.Schema$File) => `${f.name} (${f.mimeType})`
  ).join("\n") || '';
  log('Search results', { query: userQuery, resultCount: res.data.files?.length });

  let response = `Found ${res.data.files?.length ?? 0} files:\n${fileList}`;
  if (res.data.nextPageToken) {
    response += `\n\nMore results available. Use pageToken: ${res.data.nextPageToken}`;
  }

  return successResponse(response);
}

export async function handleCreateTextFile(
  drive: drive_v3.Drive,
  args: unknown
): Promise<ToolResponse> {
  const validation = CreateTextFileSchema.safeParse(args);
  if (!validation.success) {
    return errorResponse(validation.error.errors[0].message);
  }
  const data = validation.data;

  validateTextFileExtension(data.name);
  const parentFolderId = await resolveFolderId(drive, data.parentFolderId);

  // Check if file already exists
  const existingFileId = await checkFileExists(drive, data.name, parentFolderId);
  if (existingFileId) {
    return errorResponse(
      `A file named "${data.name}" already exists in this location. ` +
      `To update it, use updateTextFile with fileId: ${existingFileId}`
    );
  }

  const fileMetadata = {
    name: data.name,
    mimeType: getMimeTypeFromFilename(data.name),
    parents: [parentFolderId]
  };

  log('About to create file', { driveExists: !!drive });

  const file = await drive.files.create({
    requestBody: fileMetadata,
    media: {
      mimeType: fileMetadata.mimeType,
      body: data.content,
    },
    supportsAllDrives: true
  });

  log('File created successfully', { fileId: file.data?.id });
  return successResponse(
    `Created file: ${file.data?.name || data.name}\nID: ${file.data?.id || 'unknown'}`
  );
}

export async function handleUpdateTextFile(
  drive: drive_v3.Drive,
  args: unknown
): Promise<ToolResponse> {
  const validation = UpdateTextFileSchema.safeParse(args);
  if (!validation.success) {
    return errorResponse(validation.error.errors[0].message);
  }
  const data = validation.data;

  // Check file MIME type
  const existingFile = await drive.files.get({
    fileId: data.fileId,
    fields: 'mimeType, name, parents',
    supportsAllDrives: true
  });

  const currentMimeType = existingFile.data.mimeType || 'text/plain';
  if (!Object.values(TEXT_MIME_TYPES).includes(currentMimeType)) {
    return errorResponse(
      `File "${existingFile.data.name}" (${data.fileId}) is not a text or markdown file. ` +
      `Current type: ${currentMimeType}. Supported types: text/plain, text/markdown.`
    );
  }

  const updateMetadata: { name?: string; mimeType?: string } = {};
  if (data.name) {
    validateTextFileExtension(data.name);
    updateMetadata.name = data.name;
    updateMetadata.mimeType = getMimeTypeFromFilename(data.name);
  }

  const updatedFile = await drive.files.update({
    fileId: data.fileId,
    requestBody: updateMetadata,
    media: {
      mimeType: updateMetadata.mimeType || currentMimeType,
      body: data.content
    },
    fields: 'id, name, modifiedTime, webViewLink',
    supportsAllDrives: true
  });

  return successResponse(
    `Updated file: ${updatedFile.data.name}\nModified: ${updatedFile.data.modifiedTime}`
  );
}

export async function handleCreateFolder(
  drive: drive_v3.Drive,
  args: unknown
): Promise<ToolResponse> {
  const validation = CreateFolderSchema.safeParse(args);
  if (!validation.success) {
    return errorResponse(validation.error.errors[0].message);
  }
  const data = validation.data;

  const parentFolderId = await resolveFolderId(drive, data.parent);

  // Check if folder already exists
  const existingFolderId = await checkFileExists(drive, data.name, parentFolderId);
  if (existingFolderId) {
    return errorResponse(
      `A folder named "${data.name}" already exists in this location. ` +
      `Folder ID: ${existingFolderId}`
    );
  }

  const folderMetadata = {
    name: data.name,
    mimeType: FOLDER_MIME_TYPE,
    parents: [parentFolderId]
  };

  const folder = await drive.files.create({
    requestBody: folderMetadata,
    fields: 'id, name, webViewLink',
    supportsAllDrives: true
  });

  log('Folder created successfully', { folderId: folder.data.id, name: folder.data.name });

  return successResponse(`Created folder: ${folder.data.name}\nID: ${folder.data.id}`);
}

export async function handleListFolder(
  drive: drive_v3.Drive,
  args: unknown
): Promise<ToolResponse> {
  const validation = ListFolderSchema.safeParse(args);
  if (!validation.success) {
    return errorResponse(validation.error.errors[0].message);
  }
  const data = validation.data;

  // Default to root if no folder specified
  const targetFolderId = data.folderId || 'root';

  const res = await drive.files.list({
    q: `'${targetFolderId}' in parents and trashed = false`,
    pageSize: Math.min(data.pageSize || 50, 100),
    pageToken: data.pageToken,
    fields: "nextPageToken, files(id, name, mimeType, modifiedTime, size)",
    orderBy: "name",
    includeItemsFromAllDrives: true,
    supportsAllDrives: true
  });

  const files = res.data.files || [];
  const formattedFiles = files.map((file: drive_v3.Schema$File) => {
    const isFolder = file.mimeType === FOLDER_MIME_TYPE;
    return `${isFolder ? '📁' : '📄'} ${file.name} (ID: ${file.id})`;
  }).join('\n');

  let response = `Contents of folder:\n\n${formattedFiles}`;
  if (res.data.nextPageToken) {
    response += `\n\nMore items available. Use pageToken: ${res.data.nextPageToken}`;
  }

  return successResponse(response);
}

export async function handleDeleteItem(
  drive: drive_v3.Drive,
  args: unknown
): Promise<ToolResponse> {
  const validation = DeleteItemSchema.safeParse(args);
  if (!validation.success) {
    return errorResponse(validation.error.errors[0].message);
  }
  const data = validation.data;

  const item = await drive.files.get({
    fileId: data.itemId,
    fields: 'name',
    supportsAllDrives: true
  });

  // Move to trash instead of permanent deletion
  await drive.files.update({
    fileId: data.itemId,
    requestBody: { trashed: true },
    supportsAllDrives: true
  });

  log('Item moved to trash successfully', { itemId: data.itemId, name: item.data.name });
  return successResponse(`Successfully moved to trash: ${item.data.name}`);
}

export async function handleRenameItem(
  drive: drive_v3.Drive,
  args: unknown
): Promise<ToolResponse> {
  const validation = RenameItemSchema.safeParse(args);
  if (!validation.success) {
    return errorResponse(validation.error.errors[0].message);
  }
  const data = validation.data;

  // If it's a text file, check extension
  const item = await drive.files.get({
    fileId: data.itemId,
    fields: 'name, mimeType',
    supportsAllDrives: true
  });

  if (Object.values(TEXT_MIME_TYPES).includes(item.data.mimeType || '')) {
    validateTextFileExtension(data.newName);
  }

  const updatedItem = await drive.files.update({
    fileId: data.itemId,
    requestBody: { name: data.newName },
    fields: 'id, name, modifiedTime',
    supportsAllDrives: true
  });

  return successResponse(
    `Successfully renamed "${item.data.name}" to "${updatedItem.data.name}"`
  );
}

export async function handleMoveItem(
  drive: drive_v3.Drive,
  args: unknown
): Promise<ToolResponse> {
  const validation = MoveItemSchema.safeParse(args);
  if (!validation.success) {
    return errorResponse(validation.error.errors[0].message);
  }
  const data = validation.data;

  const destinationFolderId = data.destinationFolderId
    ? await resolveFolderId(drive, data.destinationFolderId)
    : 'root';

  // Check we aren't moving a folder into itself
  if (data.destinationFolderId === data.itemId) {
    return errorResponse("Cannot move a folder into itself.");
  }

  const item = await drive.files.get({
    fileId: data.itemId,
    fields: 'name, parents',
    supportsAllDrives: true
  });

  // Perform move
  await drive.files.update({
    fileId: data.itemId,
    addParents: destinationFolderId,
    removeParents: item.data.parents?.join(',') || '',
    fields: 'id, name, parents',
    supportsAllDrives: true
  });

  // Get the destination folder name for a nice response
  const destinationFolder = await drive.files.get({
    fileId: destinationFolderId,
    fields: 'name',
    supportsAllDrives: true
  });

  return successResponse(
    `Successfully moved "${item.data.name}" to "${destinationFolder.data.name}"`
  );
}

export async function handleCopyFile(
  drive: drive_v3.Drive,
  args: unknown
): Promise<ToolResponse> {
  const validation = CopyFileSchema.safeParse(args);
  if (!validation.success) {
    return errorResponse(validation.error.errors[0].message);
  }
  const data = validation.data;

  // Get source file metadata
  const sourceFile = await drive.files.get({
    fileId: data.sourceFileId,
    fields: 'name, parents',
    supportsAllDrives: true
  });

  const destinationName = data.destinationName || `Copy of ${sourceFile.data.name}`;
  const destinationFolderId = data.destinationFolderId
    ? await resolveFolderId(drive, data.destinationFolderId)
    : (sourceFile.data.parents?.[0] || 'root');

  // Check if destination name already exists
  const existingFileId = await checkFileExists(drive, destinationName, destinationFolderId);
  if (existingFileId) {
    return errorResponse(
      `A file named "${destinationName}" already exists in the destination folder. ` +
      `Existing file ID: ${existingFileId}`
    );
  }

  // Copy the file
  const copiedFile = await drive.files.copy({
    fileId: data.sourceFileId,
    requestBody: {
      name: destinationName,
      parents: [destinationFolderId]
    },
    fields: 'id, name, webViewLink',
    supportsAllDrives: true
  });

  log('File copied successfully', { sourceId: data.sourceFileId, newId: copiedFile.data.id });

  return successResponse(
    `Copied file: ${copiedFile.data.name}\nNew ID: ${copiedFile.data.id}\nLink: ${copiedFile.data.webViewLink}`
  );
}

export async function handleGetFileMetadata(
  drive: drive_v3.Drive,
  args: unknown
): Promise<ToolResponse> {
  const validation = GetFileMetadataSchema.safeParse(args);
  if (!validation.success) {
    return errorResponse(validation.error.errors[0].message);
  }
  const data = validation.data;

  const file = await drive.files.get({
    fileId: data.fileId,
    fields: 'id, name, mimeType, size, createdTime, modifiedTime, owners, shared, webViewLink, parents, description, starred',
    supportsAllDrives: true
  });

  const metadata = file.data;
  const ownerNames = metadata.owners?.map(o => o.displayName || o.emailAddress).join(', ') || 'Unknown';
  const sizeStr = metadata.size ? `${(parseInt(metadata.size) / 1024).toFixed(2)} KB` : 'N/A';

  const response = [
    `Name: ${metadata.name}`,
    `ID: ${metadata.id}`,
    `Type: ${metadata.mimeType}`,
    `Size: ${sizeStr}`,
    `Created: ${metadata.createdTime}`,
    `Modified: ${metadata.modifiedTime}`,
    `Owner(s): ${ownerNames}`,
    `Shared: ${metadata.shared ? 'Yes' : 'No'}`,
    `Starred: ${metadata.starred ? 'Yes' : 'No'}`,
    metadata.description ? `Description: ${metadata.description}` : null,
    metadata.parents ? `Parent folder(s): ${metadata.parents.join(', ')}` : null,
    `Link: ${metadata.webViewLink}`
  ].filter(Boolean).join('\n');

  return successResponse(response);
}

const EXPORT_MIME_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  csv: 'text/csv',
  tsv: 'text/tab-separated-values',
  odt: 'application/vnd.oasis.opendocument.text',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  odp: 'application/vnd.oasis.opendocument.presentation'
};

const GOOGLE_DOC_FORMATS = ['pdf', 'docx', 'odt'];
const GOOGLE_SHEET_FORMATS = ['pdf', 'xlsx', 'csv', 'tsv', 'ods'];
const GOOGLE_SLIDES_FORMATS = ['pdf', 'pptx', 'odp'];

export async function handleExportFile(
  drive: drive_v3.Drive,
  args: unknown
): Promise<ToolResponse> {
  const validation = ExportFileSchema.safeParse(args);
  if (!validation.success) {
    return errorResponse(validation.error.errors[0].message);
  }
  const data = validation.data;

  // Get file metadata to determine type
  const file = await drive.files.get({
    fileId: data.fileId,
    fields: 'name, mimeType',
    supportsAllDrives: true
  });

  const mimeType = file.data.mimeType || '';
  const fileName = file.data.name || 'export';

  // Validate format is compatible with file type
  let validFormats: string[];
  if (mimeType === 'application/vnd.google-apps.document') {
    validFormats = GOOGLE_DOC_FORMATS;
  } else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
    validFormats = GOOGLE_SHEET_FORMATS;
  } else if (mimeType === 'application/vnd.google-apps.presentation') {
    validFormats = GOOGLE_SLIDES_FORMATS;
  } else {
    return errorResponse(
      `File "${fileName}" is not a Google Doc, Sheet, or Slides. ` +
      `Cannot export ${mimeType} files. Use this tool only for Google Workspace files.`
    );
  }

  if (!validFormats.includes(data.format)) {
    return errorResponse(
      `Cannot export Google ${mimeType.split('.').pop()} to ${data.format}. ` +
      `Valid formats: ${validFormats.join(', ')}`
    );
  }

  const exportMimeType = EXPORT_MIME_TYPES[data.format];

  // Export the file
  const response = await drive.files.export(
    { fileId: data.fileId, mimeType: exportMimeType },
    { responseType: 'arraybuffer' }
  );

  const buffer = Buffer.from(response.data as ArrayBuffer);

  // If outputPath is provided, save to file
  if (data.outputPath) {
    const fs = await import('fs/promises');
    const path = await import('path');

    const outputFileName = `${fileName}.${data.format}`;
    const fullPath = path.join(data.outputPath, outputFileName);

    await fs.writeFile(fullPath, buffer);

    log('File exported successfully', { fileId: data.fileId, outputPath: fullPath });
    return successResponse(`Exported "${fileName}" to: ${fullPath}`);
  }

  // Otherwise return base64-encoded content
  const base64Content = buffer.toString('base64');

  log('File exported successfully', { fileId: data.fileId, format: data.format });
  return successResponse(
    `Exported "${fileName}" as ${data.format}\n\n` +
    `Base64 content (${buffer.length} bytes):\n${base64Content}`
  );
}

// -----------------------------------------------------------------------------
// SHARING HANDLERS
// -----------------------------------------------------------------------------

export async function handleShareFile(
  drive: drive_v3.Drive,
  args: unknown
): Promise<ToolResponse> {
  const validation = ShareFileSchema.safeParse(args);
  if (!validation.success) {
    return errorResponse(validation.error.errors[0].message);
  }
  const data = validation.data;

  // Validate emailAddress required for user/group
  if ((data.type === 'user' || data.type === 'group') && !data.emailAddress) {
    return errorResponse(`Email address is required when sharing with type "${data.type}"`);
  }

  // Validate domain required for domain type
  if (data.type === 'domain' && !data.domain) {
    return errorResponse('Domain is required when sharing with type "domain"');
  }

  // Get file name for response
  const file = await drive.files.get({
    fileId: data.fileId,
    fields: 'name',
    supportsAllDrives: true
  });

  const permissionBody: {
    role: string;
    type: string;
    emailAddress?: string;
    domain?: string;
  } = {
    role: data.role,
    type: data.type
  };

  if (data.emailAddress) {
    permissionBody.emailAddress = data.emailAddress;
  }
  if (data.domain) {
    permissionBody.domain = data.domain;
  }

  const permission = await drive.permissions.create({
    fileId: data.fileId,
    requestBody: permissionBody,
    sendNotificationEmail: data.sendNotificationEmail,
    emailMessage: data.emailMessage,
    supportsAllDrives: true
  });

  log('File shared successfully', { fileId: data.fileId, permissionId: permission.data.id });

  let targetDesc = '';
  if (data.type === 'anyone') {
    targetDesc = 'anyone with the link';
  } else if (data.type === 'domain') {
    targetDesc = `anyone in ${data.domain}`;
  } else {
    targetDesc = data.emailAddress || '';
  }

  return successResponse(
    `Shared "${file.data.name}" with ${targetDesc} as ${data.role}\n` +
    `Permission ID: ${permission.data.id}`
  );
}

export async function handleGetSharing(
  drive: drive_v3.Drive,
  args: unknown
): Promise<ToolResponse> {
  const validation = GetSharingSchema.safeParse(args);
  if (!validation.success) {
    return errorResponse(validation.error.errors[0].message);
  }
  const data = validation.data;

  // Get file name
  const file = await drive.files.get({
    fileId: data.fileId,
    fields: 'name, webViewLink',
    supportsAllDrives: true
  });

  // Get permissions
  const permissions = await drive.permissions.list({
    fileId: data.fileId,
    fields: 'permissions(id, role, type, emailAddress, domain, displayName)',
    supportsAllDrives: true
  });

  const permissionList = permissions.data.permissions || [];

  const formattedPermissions = permissionList.map(p => {
    let target = '';
    if (p.type === 'anyone') {
      target = 'Anyone with the link';
    } else if (p.type === 'domain') {
      target = `Anyone in ${p.domain}`;
    } else {
      target = p.emailAddress || p.displayName || 'Unknown';
    }
    return `• ${target}: ${p.role} (ID: ${p.id})`;
  }).join('\n');

  return successResponse(
    `Sharing settings for "${file.data.name}":\n\n${formattedPermissions}\n\nLink: ${file.data.webViewLink}`
  );
}

// -----------------------------------------------------------------------------
// REVISION HANDLERS
// -----------------------------------------------------------------------------

export async function handleListRevisions(
  drive: drive_v3.Drive,
  args: unknown
): Promise<ToolResponse> {
  const validation = ListRevisionsSchema.safeParse(args);
  if (!validation.success) {
    return errorResponse(validation.error.errors[0].message);
  }
  const data = validation.data;

  // Get file name
  const file = await drive.files.get({
    fileId: data.fileId,
    fields: 'name, mimeType',
    supportsAllDrives: true
  });

  // Check if file supports revisions (Google Workspace files use different versioning)
  if (file.data.mimeType?.startsWith('application/vnd.google-apps')) {
    return errorResponse(
      `Google Workspace files (${file.data.mimeType}) do not support revision history through this API. ` +
      `Use the Google Docs/Sheets/Slides UI to view version history.`
    );
  }

  const revisions = await drive.revisions.list({
    fileId: data.fileId,
    pageSize: data.pageSize || 100,
    fields: 'revisions(id, modifiedTime, lastModifyingUser, size, keepForever)'
  });

  const revisionList = revisions.data.revisions || [];

  if (revisionList.length === 0) {
    return successResponse(`No revisions found for "${file.data.name}".`);
  }

  const formattedRevisions = revisionList.map((r, idx) => {
    const author = r.lastModifyingUser?.displayName || r.lastModifyingUser?.emailAddress || 'Unknown';
    const sizeStr = r.size ? `${(parseInt(r.size) / 1024).toFixed(2)} KB` : 'N/A';
    const keepForever = r.keepForever ? ' (pinned)' : '';
    return `${idx + 1}. ID: ${r.id} | ${r.modifiedTime} | ${author} | ${sizeStr}${keepForever}`;
  }).join('\n');

  return successResponse(
    `Revisions for "${file.data.name}" (${revisionList.length} found):\n\n${formattedRevisions}`
  );
}

export async function handleRestoreRevision(
  drive: drive_v3.Drive,
  args: unknown
): Promise<ToolResponse> {
  const validation = RestoreRevisionSchema.safeParse(args);
  if (!validation.success) {
    return errorResponse(validation.error.errors[0].message);
  }
  const data = validation.data;

  // Get file metadata
  const file = await drive.files.get({
    fileId: data.fileId,
    fields: 'name, mimeType',
    supportsAllDrives: true
  });

  // Check if file supports revisions
  if (file.data.mimeType?.startsWith('application/vnd.google-apps')) {
    return errorResponse(
      `Google Workspace files cannot be restored through this API. ` +
      `Use the Google Docs/Sheets/Slides UI to restore previous versions.`
    );
  }

  // Get revision content
  const revisionContent = await drive.revisions.get(
    { fileId: data.fileId, revisionId: data.revisionId, alt: 'media' },
    { responseType: 'arraybuffer' }
  );

  // Update file with revision content
  const { Readable } = await import('stream');
  const stream = Readable.from(Buffer.from(revisionContent.data as ArrayBuffer));

  await drive.files.update({
    fileId: data.fileId,
    media: {
      mimeType: file.data.mimeType || 'application/octet-stream',
      body: stream
    },
    supportsAllDrives: true
  });

  log('Revision restored successfully', { fileId: data.fileId, revisionId: data.revisionId });
  return successResponse(`Restored "${file.data.name}" to revision ${data.revisionId}`);
}

// -----------------------------------------------------------------------------
// BINARY FILE HANDLERS
// -----------------------------------------------------------------------------

const COMMON_MIME_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  mp3: 'audio/mpeg',
  zip: 'application/zip',
  json: 'application/json',
  xml: 'application/xml',
  html: 'text/html',
  css: 'text/css',
  js: 'application/javascript'
};

export async function handleDownloadFile(
  drive: drive_v3.Drive,
  args: unknown
): Promise<ToolResponse> {
  const validation = DownloadFileSchema.safeParse(args);
  if (!validation.success) {
    return errorResponse(validation.error.errors[0].message);
  }
  const data = validation.data;

  // Get file metadata
  const file = await drive.files.get({
    fileId: data.fileId,
    fields: 'name, mimeType, size',
    supportsAllDrives: true
  });

  const mimeType = file.data.mimeType || '';
  const fileName = file.data.name || 'download';

  // Reject Google Workspace files
  if (mimeType.startsWith('application/vnd.google-apps')) {
    return errorResponse(
      `"${fileName}" is a Google Workspace file (${mimeType}). ` +
      `Use exportFile instead to convert it to a downloadable format.`
    );
  }

  // Download file content
  const response = await drive.files.get(
    { fileId: data.fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'arraybuffer' }
  );

  const buffer = Buffer.from(response.data as ArrayBuffer);

  // If outputPath provided, save to file
  if (data.outputPath) {
    const fs = await import('fs/promises');
    const path = await import('path');

    const fullPath = path.join(data.outputPath, fileName);
    await fs.writeFile(fullPath, buffer);

    log('File downloaded successfully', { fileId: data.fileId, outputPath: fullPath });
    return successResponse(
      `Downloaded "${fileName}" to: ${fullPath}\n` +
      `Size: ${buffer.length} bytes\n` +
      `Type: ${mimeType}`
    );
  }

  // Otherwise return base64
  const base64Content = buffer.toString('base64');

  log('File downloaded successfully', { fileId: data.fileId, size: buffer.length });
  return successResponse(
    `Downloaded "${fileName}"\n` +
    `Size: ${buffer.length} bytes\n` +
    `Type: ${mimeType}\n\n` +
    `Base64 content:\n${base64Content}`
  );
}

export async function handleUploadFile(
  drive: drive_v3.Drive,
  args: unknown
): Promise<ToolResponse> {
  const validation = UploadFileSchema.safeParse(args);
  if (!validation.success) {
    return errorResponse(validation.error.errors[0].message);
  }
  const data = validation.data;

  // Require either sourcePath or base64Content
  if (!data.sourcePath && !data.base64Content) {
    return errorResponse('Either sourcePath or base64Content is required');
  }

  // Auto-detect mimeType from extension if not provided
  let mimeType = data.mimeType;
  if (!mimeType) {
    const ext = data.name.split('.').pop()?.toLowerCase() || '';
    mimeType = COMMON_MIME_TYPES[ext] || 'application/octet-stream';
  }

  // Resolve folder ID
  const folderId = data.folderId || 'root';

  // Check if file already exists
  const existingFileId = await checkFileExists(drive, data.name, folderId);
  if (existingFileId) {
    return errorResponse(
      `A file named "${data.name}" already exists in this location. ` +
      `Existing file ID: ${existingFileId}`
    );
  }

  // Prepare content stream
  let mediaBody: NodeJS.ReadableStream;
  if (data.sourcePath) {
    const fs = await import('fs');
    mediaBody = fs.createReadStream(data.sourcePath);
  } else {
    const { Readable } = await import('stream');
    const buffer = Buffer.from(data.base64Content!, 'base64');
    mediaBody = Readable.from(buffer);
  }

  // Upload file
  const file = await drive.files.create({
    requestBody: {
      name: data.name,
      parents: [folderId]
    },
    media: {
      mimeType,
      body: mediaBody
    },
    fields: 'id, name, webViewLink',
    supportsAllDrives: true
  });

  log('File uploaded successfully', { fileId: file.data.id, name: file.data.name });
  return successResponse(
    `Uploaded file: ${file.data.name}\n` +
    `ID: ${file.data.id}\n` +
    `Link: ${file.data.webViewLink}`
  );
}

// -----------------------------------------------------------------------------
// METADATA HANDLERS
// -----------------------------------------------------------------------------

export async function handleGetStorageQuota(
  drive: drive_v3.Drive,
  args: unknown
): Promise<ToolResponse> {
  const validation = GetStorageQuotaSchema.safeParse(args);
  if (!validation.success) {
    return errorResponse(validation.error.errors[0].message);
  }

  const about = await drive.about.get({
    fields: 'storageQuota, user'
  });

  const quota = about.data.storageQuota;
  const user = about.data.user;

  if (!quota) {
    return errorResponse('Unable to retrieve storage quota information');
  }

  const formatBytes = (bytes: string | undefined | null): string => {
    if (!bytes) return 'N/A';
    const num = parseInt(bytes);
    if (num >= 1073741824) return `${(num / 1073741824).toFixed(2)} GB`;
    if (num >= 1048576) return `${(num / 1048576).toFixed(2)} MB`;
    if (num >= 1024) return `${(num / 1024).toFixed(2)} KB`;
    return `${num} bytes`;
  };

  const limit = quota.limit ? formatBytes(quota.limit) : 'Unlimited';
  const usage = formatBytes(quota.usage);
  const usageInDrive = formatBytes(quota.usageInDrive);
  const usageInTrash = formatBytes(quota.usageInDriveTrash);

  let available = 'Unlimited';
  if (quota.limit && quota.usage) {
    const availableBytes = parseInt(quota.limit) - parseInt(quota.usage);
    available = formatBytes(String(availableBytes));
  }

  return successResponse(
    `Google Drive Storage Quota\n` +
    `User: ${user?.emailAddress || 'Unknown'}\n\n` +
    `Total limit: ${limit}\n` +
    `Total usage: ${usage}\n` +
    `Usage in Drive: ${usageInDrive}\n` +
    `Usage in Trash: ${usageInTrash}\n` +
    `Available: ${available}`
  );
}

export async function handleStarFile(
  drive: drive_v3.Drive,
  args: unknown
): Promise<ToolResponse> {
  const validation = StarFileSchema.safeParse(args);
  if (!validation.success) {
    return errorResponse(validation.error.errors[0].message);
  }
  const data = validation.data;

  // Get file name
  const file = await drive.files.get({
    fileId: data.fileId,
    fields: 'name',
    supportsAllDrives: true
  });

  // Update starred status
  await drive.files.update({
    fileId: data.fileId,
    requestBody: { starred: data.starred },
    supportsAllDrives: true
  });

  const action = data.starred ? 'starred' : 'unstarred';
  log(`File ${action} successfully`, { fileId: data.fileId });
  return successResponse(`Successfully ${action} "${file.data.name}"`);
}
