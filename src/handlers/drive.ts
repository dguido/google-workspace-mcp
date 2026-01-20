import type { drive_v3 } from "googleapis";
import {
  log,
  successResponse,
  structuredResponse,
  errorResponse,
  withTimeout,
  withRetry,
  elicitFileSelection,
  elicitConfirmation,
  formatDisambiguationOptions,
  validateArgs,
} from "../utils/index.js";
import type { ToolResponse } from "../utils/index.js";
import {
  escapeQueryString,
  combineQueries,
  buildFullTextQuery,
} from "../utils/gdrive-query.js";
import { formatBytes, formatBytesCompact } from "../utils/format.js";
import {
  GetFolderTreeSchema,
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
  StarFileSchema,
  ResolveFilePathSchema,
  BatchDeleteSchema,
  BatchRestoreSchema,
  BatchMoveSchema,
  BatchShareSchema,
  RemovePermissionSchema,
  ListTrashSchema,
  RestoreFromTrashSchema,
  EmptyTrashSchema,
} from "../schemas/index.js";
import {
  FOLDER_MIME_TYPE,
  TEXT_MIME_TYPES,
  getMimeTypeFromFilename,
  validateTextFileExtension,
  resolveFolderId,
  resolveOptionalFolderPath,
  checkFileExists,
  processBatchOperation,
} from "./helpers.js";
import type { HandlerContext } from "./helpers.js";

export async function handleSearch(
  drive: drive_v3.Drive,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(SearchSchema, args);
  if (!validation.success) return validation.response;
  const { query: userQuery, pageSize, pageToken } = validation.data;

  const formattedQuery = combineQueries(
    buildFullTextQuery(userQuery),
    "trashed = false",
  );

  const res = await drive.files.list({
    q: formattedQuery,
    pageSize: Math.min(pageSize || 50, 100),
    pageToken: pageToken,
    fields: "nextPageToken, files(id, name, mimeType, modifiedTime, size)",
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
  });

  const fileList =
    res.data.files
      ?.map((f: drive_v3.Schema$File) => `${f.name} (${f.mimeType})`)
      .join("\n") || "";
  log("Search results", {
    query: userQuery,
    resultCount: res.data.files?.length,
  });

  let response = `Found ${res.data.files?.length ?? 0} files:\n${fileList}`;
  if (res.data.nextPageToken) {
    response += `\n\nMore results available. Use pageToken: ${res.data.nextPageToken}`;
  }

  return successResponse(response);
}

export async function handleCreateTextFile(
  drive: drive_v3.Drive,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(CreateTextFileSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  validateTextFileExtension(data.name);
  const parentFolderId = await resolveOptionalFolderPath(
    drive,
    data.parentFolderId,
    data.parentPath,
  );

  // Check if file already exists
  const existingFileId = await checkFileExists(
    drive,
    data.name,
    parentFolderId,
  );
  if (existingFileId) {
    return errorResponse(
      `A file named "${data.name}" already exists in this location. ` +
        `To update it, use updateTextFile with fileId: ${existingFileId}`,
    );
  }

  const fileMetadata = {
    name: data.name,
    mimeType: getMimeTypeFromFilename(data.name),
    parents: [parentFolderId],
  };

  log("About to create file", { driveExists: !!drive });

  const file = await drive.files.create({
    requestBody: fileMetadata,
    media: {
      mimeType: fileMetadata.mimeType,
      body: data.content,
    },
    supportsAllDrives: true,
  });

  log("File created successfully", { fileId: file.data?.id });
  return successResponse(
    `Created file: ${file.data?.name || data.name}\nID: ${file.data?.id || "unknown"}`,
  );
}

export async function handleUpdateTextFile(
  drive: drive_v3.Drive,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(UpdateTextFileSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  // Check file MIME type
  const existingFile = await drive.files.get({
    fileId: data.fileId,
    fields: "mimeType, name, parents",
    supportsAllDrives: true,
  });

  const currentMimeType = existingFile.data.mimeType || "text/plain";
  if (!Object.values(TEXT_MIME_TYPES).includes(currentMimeType)) {
    return errorResponse(
      `File "${existingFile.data.name}" (${data.fileId}) is not a text or markdown file. ` +
        `Current type: ${currentMimeType}. Supported types: text/plain, text/markdown.`,
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
      body: data.content,
    },
    fields: "id, name, modifiedTime, webViewLink",
    supportsAllDrives: true,
  });

  return successResponse(
    `Updated file: ${updatedFile.data.name}\nModified: ${updatedFile.data.modifiedTime}`,
  );
}

export async function handleCreateFolder(
  drive: drive_v3.Drive,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(CreateFolderSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  const parentFolderId = await resolveOptionalFolderPath(
    drive,
    data.parent,
    data.parentPath,
  );

  // Check if folder already exists
  const existingFolderId = await checkFileExists(
    drive,
    data.name,
    parentFolderId,
  );
  if (existingFolderId) {
    return errorResponse(
      `A folder named "${data.name}" already exists in this location. ` +
        `Folder ID: ${existingFolderId}`,
    );
  }

  const folderMetadata = {
    name: data.name,
    mimeType: FOLDER_MIME_TYPE,
    parents: [parentFolderId],
  };

  const folder = await drive.files.create({
    requestBody: folderMetadata,
    fields: "id, name, webViewLink",
    supportsAllDrives: true,
  });

  log("Folder created successfully", {
    folderId: folder.data.id,
    name: folder.data.name,
  });

  return successResponse(
    `Created folder: ${folder.data.name}\nID: ${folder.data.id}`,
  );
}

export async function handleListFolder(
  drive: drive_v3.Drive,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(ListFolderSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  // Default to root if no folder specified
  const targetFolderId = data.folderId || "root";

  try {
    const res = await drive.files.list({
      q: `'${targetFolderId}' in parents and trashed = false`,
      pageSize: Math.min(data.pageSize || 50, 100),
      pageToken: data.pageToken,
      fields: "nextPageToken, files(id, name, mimeType, modifiedTime, size)",
      orderBy: "name",
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
    });

    const files = res.data.files || [];
    const formattedFiles = files
      .map((file: drive_v3.Schema$File) => {
        const isFolder = file.mimeType === FOLDER_MIME_TYPE;
        return `${isFolder ? "📁" : "📄"} ${file.name} (ID: ${file.id})`;
      })
      .join("\n");

    let response = `Contents of folder:\n\n${formattedFiles}`;
    if (res.data.nextPageToken) {
      response += `\n\nMore items available. Use pageToken: ${res.data.nextPageToken}`;
    }

    return successResponse(response);
  } catch (error) {
    // Handle 404 error with clearer message including folder ID
    if (error instanceof Error && error.message.includes("not found")) {
      return errorResponse(`Folder not found: ${targetFolderId}`);
    }
    throw error;
  }
}

export async function handleDeleteItem(
  drive: drive_v3.Drive,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(DeleteItemSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  const item = await drive.files.get({
    fileId: data.itemId,
    fields: "name, mimeType",
    supportsAllDrives: true,
  });

  // If it's a folder, count its contents before deleting
  let countInfo = "";
  if (item.data.mimeType === FOLDER_MIME_TYPE) {
    const contents = await drive.files.list({
      q: `'${data.itemId}' in parents and trashed = false`,
      fields: "files(id, mimeType)",
      pageSize: 1000,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    const files = contents.data.files || [];
    const fileCount = files.filter(
      (f) => f.mimeType !== FOLDER_MIME_TYPE,
    ).length;
    const folderCount = files.filter(
      (f) => f.mimeType === FOLDER_MIME_TYPE,
    ).length;

    if (fileCount > 0 || folderCount > 0) {
      const parts: string[] = [];
      if (fileCount > 0)
        parts.push(`${fileCount} file${fileCount !== 1 ? "s" : ""}`);
      if (folderCount > 0)
        parts.push(`${folderCount} subfolder${folderCount !== 1 ? "s" : ""}`);
      countInfo = ` (contains ${parts.join(", ")})`;
    }
  }

  // Move to trash instead of permanent deletion
  await drive.files.update({
    fileId: data.itemId,
    requestBody: { trashed: true },
    supportsAllDrives: true,
  });

  log("Item moved to trash successfully", {
    itemId: data.itemId,
    name: item.data.name,
  });
  return successResponse(`Moved "${item.data.name}" to trash${countInfo}`);
}

export async function handleRenameItem(
  drive: drive_v3.Drive,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(RenameItemSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  // If it's a text file, check extension
  const item = await drive.files.get({
    fileId: data.itemId,
    fields: "name, mimeType",
    supportsAllDrives: true,
  });

  if (Object.values(TEXT_MIME_TYPES).includes(item.data.mimeType || "")) {
    validateTextFileExtension(data.newName);
  }

  const updatedItem = await drive.files.update({
    fileId: data.itemId,
    requestBody: { name: data.newName },
    fields: "id, name, modifiedTime",
    supportsAllDrives: true,
  });

  return successResponse(
    `Successfully renamed "${item.data.name}" to "${updatedItem.data.name}"`,
  );
}

export async function handleMoveItem(
  drive: drive_v3.Drive,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(MoveItemSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  const destinationFolderId = await resolveOptionalFolderPath(
    drive,
    data.destinationFolderId,
    data.destinationPath,
  );

  // Check we aren't moving a folder into itself
  if (destinationFolderId === data.itemId) {
    return errorResponse("Cannot move a folder into itself.");
  }

  const item = await drive.files.get({
    fileId: data.itemId,
    fields: "name, parents",
    supportsAllDrives: true,
  });

  // Perform move
  await drive.files.update({
    fileId: data.itemId,
    addParents: destinationFolderId,
    removeParents: item.data.parents?.join(",") || "",
    fields: "id, name, parents",
    supportsAllDrives: true,
  });

  // Get the destination folder name for a nice response
  const destinationFolder = await drive.files.get({
    fileId: destinationFolderId,
    fields: "name",
    supportsAllDrives: true,
  });

  return successResponse(
    `Successfully moved "${item.data.name}" to "${destinationFolder.data.name}"`,
  );
}

export async function handleCopyFile(
  drive: drive_v3.Drive,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(CopyFileSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  // Get source file metadata
  const sourceFile = await drive.files.get({
    fileId: data.sourceFileId,
    fields: "name, parents",
    supportsAllDrives: true,
  });

  const destinationName =
    data.destinationName || `Copy of ${sourceFile.data.name}`;
  const destinationFolderId = data.destinationFolderId
    ? await resolveFolderId(drive, data.destinationFolderId)
    : sourceFile.data.parents?.[0] || "root";

  // Check if destination name already exists
  const existingFileId = await checkFileExists(
    drive,
    destinationName,
    destinationFolderId,
  );
  if (existingFileId) {
    return errorResponse(
      `A file named "${destinationName}" already exists in the destination folder. ` +
        `Existing file ID: ${existingFileId}`,
    );
  }

  // Copy the file
  const copiedFile = await drive.files.copy({
    fileId: data.sourceFileId,
    requestBody: {
      name: destinationName,
      parents: [destinationFolderId],
    },
    fields: "id, name, webViewLink",
    supportsAllDrives: true,
  });

  log("File copied successfully", {
    sourceId: data.sourceFileId,
    newId: copiedFile.data.id,
  });

  return successResponse(
    `Copied file: ${copiedFile.data.name}\nNew ID: ${copiedFile.data.id}\nLink: ${copiedFile.data.webViewLink}`,
  );
}

export async function handleGetFileMetadata(
  drive: drive_v3.Drive,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(GetFileMetadataSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  const file = await withTimeout(
    drive.files.get({
      fileId: data.fileId,
      fields:
        "id, name, mimeType, size, createdTime, modifiedTime, owners, shared, webViewLink, parents, description, starred",
      supportsAllDrives: true,
    }),
    30000,
    "Get file metadata",
  );

  const metadata = file.data;
  const ownerNames =
    metadata.owners?.map((o) => o.displayName || o.emailAddress).join(", ") ||
    "Unknown";
  const sizeStr = formatBytes(metadata.size);

  const textResponse = [
    `Name: ${metadata.name}`,
    `ID: ${metadata.id}`,
    `Type: ${metadata.mimeType}`,
    `Size: ${sizeStr}`,
    `Created: ${metadata.createdTime}`,
    `Modified: ${metadata.modifiedTime}`,
    `Owner(s): ${ownerNames}`,
    `Shared: ${metadata.shared ? "Yes" : "No"}`,
    `Starred: ${metadata.starred ? "Yes" : "No"}`,
    metadata.description ? `Description: ${metadata.description}` : null,
    metadata.parents
      ? `Parent folder(s): ${metadata.parents.join(", ")}`
      : null,
    `Link: ${metadata.webViewLink}`,
  ]
    .filter(Boolean)
    .join("\n");

  return structuredResponse(textResponse, {
    id: metadata.id,
    name: metadata.name,
    mimeType: metadata.mimeType,
    size: metadata.size,
    createdTime: metadata.createdTime,
    modifiedTime: metadata.modifiedTime,
    owners: metadata.owners?.map((o) => ({
      displayName: o.displayName,
      emailAddress: o.emailAddress,
    })),
    shared: metadata.shared,
    starred: metadata.starred,
    description: metadata.description,
    webViewLink: metadata.webViewLink,
    parents: metadata.parents,
  });
}

const EXPORT_MIME_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  csv: "text/csv",
  tsv: "text/tab-separated-values",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  odp: "application/vnd.oasis.opendocument.presentation",
};

const GOOGLE_DOC_FORMATS = ["pdf", "docx", "odt"];
const GOOGLE_SHEET_FORMATS = ["pdf", "xlsx", "csv", "tsv", "ods"];
const GOOGLE_SLIDES_FORMATS = ["pdf", "pptx", "odp"];

export async function handleExportFile(
  drive: drive_v3.Drive,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(ExportFileSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  // Get file metadata to determine type
  const file = await drive.files.get({
    fileId: data.fileId,
    fields: "name, mimeType",
    supportsAllDrives: true,
  });

  const mimeType = file.data.mimeType || "";
  const fileName = file.data.name || "export";

  // Validate format is compatible with file type
  let validFormats: string[];
  if (mimeType === "application/vnd.google-apps.document") {
    validFormats = GOOGLE_DOC_FORMATS;
  } else if (mimeType === "application/vnd.google-apps.spreadsheet") {
    validFormats = GOOGLE_SHEET_FORMATS;
  } else if (mimeType === "application/vnd.google-apps.presentation") {
    validFormats = GOOGLE_SLIDES_FORMATS;
  } else {
    return errorResponse(
      `File "${fileName}" is not a Google Doc, Sheet, or Slides. ` +
        `Cannot export ${mimeType} files. Use this tool only for Google Workspace files.`,
    );
  }

  if (!validFormats.includes(data.format)) {
    return errorResponse(
      `Cannot export Google ${mimeType.split(".").pop()} to ${data.format}. ` +
        `Valid formats: ${validFormats.join(", ")}`,
    );
  }

  const exportMimeType = EXPORT_MIME_TYPES[data.format];

  // Export the file
  const response = await drive.files.export(
    { fileId: data.fileId, mimeType: exportMimeType },
    { responseType: "arraybuffer" },
  );

  const buffer = Buffer.from(response.data as ArrayBuffer);

  // If outputPath is provided, save to file
  if (data.outputPath) {
    const fs = await import("fs/promises");
    const path = await import("path");

    const outputFileName = `${fileName}.${data.format}`;
    const fullPath = path.join(data.outputPath, outputFileName);

    await fs.writeFile(fullPath, buffer);

    log("File exported successfully", {
      fileId: data.fileId,
      outputPath: fullPath,
    });
    return successResponse(`Exported "${fileName}" to: ${fullPath}`);
  }

  // Otherwise return base64-encoded content
  const base64Content = buffer.toString("base64");

  log("File exported successfully", {
    fileId: data.fileId,
    format: data.format,
  });
  return successResponse(
    `Exported "${fileName}" as ${data.format}\n\n` +
      `Base64 content (${buffer.length} bytes):\n${base64Content}`,
  );
}

// -----------------------------------------------------------------------------
// SHARING HANDLERS
// -----------------------------------------------------------------------------

export async function handleShareFile(
  drive: drive_v3.Drive,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(ShareFileSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  // Validate emailAddress required for user/group
  if ((data.type === "user" || data.type === "group") && !data.emailAddress) {
    return errorResponse(
      `Email address is required when sharing with type "${data.type}"`,
    );
  }

  // Validate domain required for domain type
  if (data.type === "domain" && !data.domain) {
    return errorResponse('Domain is required when sharing with type "domain"');
  }

  // Get file name for response
  const file = await drive.files.get({
    fileId: data.fileId,
    fields: "name",
    supportsAllDrives: true,
  });

  const permissionBody: {
    role: string;
    type: string;
    emailAddress?: string;
    domain?: string;
  } = {
    role: data.role,
    type: data.type,
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
    supportsAllDrives: true,
  });

  log("File shared successfully", {
    fileId: data.fileId,
    permissionId: permission.data.id,
  });

  let targetDesc = "";
  if (data.type === "anyone") {
    targetDesc = "anyone with the link";
  } else if (data.type === "domain") {
    targetDesc = `anyone in ${data.domain}`;
  } else {
    targetDesc = data.emailAddress || "";
  }

  return successResponse(
    `Shared "${file.data.name}" with ${targetDesc} as ${data.role}\n` +
      `Permission ID: ${permission.data.id}`,
  );
}

export async function handleGetSharing(
  drive: drive_v3.Drive,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(GetSharingSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  // Get file name
  const file = await withTimeout(
    drive.files.get({
      fileId: data.fileId,
      fields: "name, webViewLink",
      supportsAllDrives: true,
    }),
    30000,
    "Get file info",
  );

  // Get permissions
  const permissions = await withTimeout(
    drive.permissions.list({
      fileId: data.fileId,
      fields: "permissions(id, role, type, emailAddress, domain, displayName)",
      supportsAllDrives: true,
    }),
    30000,
    "List permissions",
  );

  const permissionList = permissions.data.permissions || [];

  const formattedPermissions = permissionList
    .map((p) => {
      let target = "";
      if (p.type === "anyone") {
        target = "Anyone with the link";
      } else if (p.type === "domain") {
        target = `Anyone in ${p.domain}`;
      } else {
        target = p.emailAddress || p.displayName || "Unknown";
      }
      return `• ${target}: ${p.role} (ID: ${p.id})`;
    })
    .join("\n");

  const textResponse = `Sharing settings for "${file.data.name}":\n\n${formattedPermissions}\n\nLink: ${file.data.webViewLink}`;

  return structuredResponse(textResponse, {
    fileName: file.data.name,
    webViewLink: file.data.webViewLink,
    permissions: permissionList.map((p) => ({
      id: p.id,
      role: p.role,
      type: p.type,
      emailAddress: p.emailAddress,
      domain: p.domain,
      displayName: p.displayName,
    })),
  });
}

// -----------------------------------------------------------------------------
// REVISION HANDLERS
// -----------------------------------------------------------------------------

export async function handleListRevisions(
  drive: drive_v3.Drive,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(ListRevisionsSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  // Get file name
  const file = await withTimeout(
    drive.files.get({
      fileId: data.fileId,
      fields: "name, mimeType",
      supportsAllDrives: true,
    }),
    30000,
    "Get file info",
  );

  // Check if file supports revisions (Google Workspace files use different versioning)
  if (file.data.mimeType?.startsWith("application/vnd.google-apps")) {
    return errorResponse(
      `Google Workspace files (${file.data.mimeType}) do not support revision history through this API. ` +
        `Use the Google Docs/Sheets/Slides UI to view version history.`,
    );
  }

  const revisions = await withTimeout(
    drive.revisions.list({
      fileId: data.fileId,
      pageSize: data.pageSize || 100,
      fields:
        "revisions(id, modifiedTime, lastModifyingUser, size, keepForever)",
    }),
    30000,
    "List revisions",
  );

  const revisionList = revisions.data.revisions || [];

  if (revisionList.length === 0) {
    return successResponse(`No revisions found for "${file.data.name}".`);
  }

  const formattedRevisions = revisionList
    .map((r, idx) => {
      const author =
        r.lastModifyingUser?.displayName ||
        r.lastModifyingUser?.emailAddress ||
        "Unknown";
      const sizeStr = formatBytes(r.size);
      const keepForever = r.keepForever ? " (pinned)" : "";
      return `${idx + 1}. ID: ${r.id} | ${r.modifiedTime} | ${author} | ${sizeStr}${keepForever}`;
    })
    .join("\n");

  const textResponse = `Revisions for "${file.data.name}" (${revisionList.length} found):\n\n${formattedRevisions}`;

  return structuredResponse(textResponse, {
    fileName: file.data.name,
    revisions: revisionList.map((r) => ({
      id: r.id,
      modifiedTime: r.modifiedTime,
      size: r.size,
      keepForever: r.keepForever,
      lastModifyingUser: r.lastModifyingUser
        ? {
            displayName: r.lastModifyingUser.displayName,
            emailAddress: r.lastModifyingUser.emailAddress,
          }
        : undefined,
    })),
  });
}

export async function handleRestoreRevision(
  drive: drive_v3.Drive,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(RestoreRevisionSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  // Get file metadata
  const file = await drive.files.get({
    fileId: data.fileId,
    fields: "name, mimeType",
    supportsAllDrives: true,
  });

  // Check if file supports revisions
  if (file.data.mimeType?.startsWith("application/vnd.google-apps")) {
    return errorResponse(
      `Google Workspace files cannot be restored through this API. ` +
        `Use the Google Docs/Sheets/Slides UI to restore previous versions.`,
    );
  }

  // Get revision content
  const revisionContent = await drive.revisions.get(
    { fileId: data.fileId, revisionId: data.revisionId, alt: "media" },
    { responseType: "arraybuffer" },
  );

  // Update file with revision content
  const { Readable } = await import("stream");
  const stream = Readable.from(
    Buffer.from(revisionContent.data as ArrayBuffer),
  );

  await drive.files.update({
    fileId: data.fileId,
    media: {
      mimeType: file.data.mimeType || "application/octet-stream",
      body: stream,
    },
    supportsAllDrives: true,
  });

  log("Revision restored successfully", {
    fileId: data.fileId,
    revisionId: data.revisionId,
  });
  return successResponse(
    `Restored "${file.data.name}" to revision ${data.revisionId}`,
  );
}

// -----------------------------------------------------------------------------
// BINARY FILE HANDLERS
// -----------------------------------------------------------------------------

const COMMON_MIME_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  mp3: "audio/mpeg",
  zip: "application/zip",
  json: "application/json",
  xml: "application/xml",
  html: "text/html",
  css: "text/css",
  js: "application/javascript",
};

export async function handleDownloadFile(
  drive: drive_v3.Drive,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(DownloadFileSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  // Get file metadata
  const file = await drive.files.get({
    fileId: data.fileId,
    fields: "name, mimeType, size",
    supportsAllDrives: true,
  });

  const mimeType = file.data.mimeType || "";
  const fileName = file.data.name || "download";

  // Reject Google Workspace files
  if (mimeType.startsWith("application/vnd.google-apps")) {
    return errorResponse(
      `"${fileName}" is a Google Workspace file (${mimeType}). ` +
        `Use exportFile instead to convert it to a downloadable format.`,
    );
  }

  // Download file content
  const response = await drive.files.get(
    { fileId: data.fileId, alt: "media", supportsAllDrives: true },
    { responseType: "arraybuffer" },
  );

  const buffer = Buffer.from(response.data as ArrayBuffer);

  // If outputPath provided, save to file
  if (data.outputPath) {
    const fs = await import("fs/promises");
    const path = await import("path");

    const fullPath = path.join(data.outputPath, fileName);
    await fs.writeFile(fullPath, buffer);

    log("File downloaded successfully", {
      fileId: data.fileId,
      outputPath: fullPath,
    });
    return successResponse(
      `Downloaded "${fileName}" to: ${fullPath}\n` +
        `Size: ${buffer.length} bytes\n` +
        `Type: ${mimeType}`,
    );
  }

  // Otherwise return base64
  const base64Content = buffer.toString("base64");

  log("File downloaded successfully", {
    fileId: data.fileId,
    size: buffer.length,
  });
  return successResponse(
    `Downloaded "${fileName}"\n` +
      `Size: ${buffer.length} bytes\n` +
      `Type: ${mimeType}\n\n` +
      `Base64 content:\n${base64Content}`,
  );
}

export async function handleUploadFile(
  drive: drive_v3.Drive,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(UploadFileSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  // Require either sourcePath or base64Content
  if (!data.sourcePath && !data.base64Content) {
    return errorResponse("Either sourcePath or base64Content is required");
  }

  // Auto-detect mimeType from extension if not provided
  let mimeType = data.mimeType;
  if (!mimeType) {
    const ext = data.name.split(".").pop()?.toLowerCase() || "";
    mimeType = COMMON_MIME_TYPES[ext] || "application/octet-stream";
  }

  // Resolve folder ID (supports both folderId and folderPath)
  const folderId = await resolveOptionalFolderPath(
    drive,
    data.folderId,
    data.folderPath,
  );

  // Check if file already exists
  const existingFileId = await checkFileExists(drive, data.name, folderId);
  if (existingFileId) {
    return errorResponse(
      `A file named "${data.name}" already exists in this location. ` +
        `Existing file ID: ${existingFileId}`,
    );
  }

  // Prepare content stream
  let mediaBody: NodeJS.ReadableStream;
  if (data.sourcePath) {
    const fs = await import("fs");
    mediaBody = fs.createReadStream(data.sourcePath);
  } else {
    const { Readable } = await import("stream");
    const buffer = Buffer.from(data.base64Content!, "base64");
    mediaBody = Readable.from(buffer);
  }

  // Upload file
  const file = await drive.files.create({
    requestBody: {
      name: data.name,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: mediaBody,
    },
    fields: "id, name, webViewLink",
    supportsAllDrives: true,
  });

  log("File uploaded successfully", {
    fileId: file.data.id,
    name: file.data.name,
  });
  return successResponse(
    `Uploaded file: ${file.data.name}\n` +
      `ID: ${file.data.id}\n` +
      `Link: ${file.data.webViewLink}`,
  );
}

// -----------------------------------------------------------------------------
// METADATA HANDLERS
// -----------------------------------------------------------------------------

export async function handleGetStorageQuota(
  drive: drive_v3.Drive,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(GetStorageQuotaSchema, args);
  if (!validation.success) return validation.response;

  const about = await withTimeout(
    drive.about.get({
      fields: "storageQuota, user",
    }),
    30000,
    "Get storage quota",
  );

  const quota = about.data.storageQuota;
  const user = about.data.user;

  if (!quota) {
    return errorResponse("Unable to retrieve storage quota information");
  }

  const limit = quota.limit ? formatBytes(quota.limit) : "Unlimited";
  const usage = formatBytes(quota.usage);
  const usageInDrive = formatBytes(quota.usageInDrive);
  const usageInTrash = formatBytes(quota.usageInDriveTrash);

  let available = "Unlimited";
  if (quota.limit && quota.usage) {
    const availableBytes = parseInt(quota.limit) - parseInt(quota.usage);
    available = formatBytes(String(availableBytes));
  }

  const textResponse =
    `Google Drive Storage Quota\n` +
    `User: ${user?.emailAddress || "Unknown"}\n\n` +
    `Total limit: ${limit}\n` +
    `Total usage: ${usage}\n` +
    `Usage in Drive: ${usageInDrive}\n` +
    `Usage in Trash: ${usageInTrash}\n` +
    `Available: ${available}`;

  return structuredResponse(textResponse, {
    user: user
      ? {
          displayName: user.displayName,
          emailAddress: user.emailAddress,
        }
      : undefined,
    storageQuota: {
      limit: quota.limit,
      usage: quota.usage,
      usageInDrive: quota.usageInDrive,
      usageInDriveTrash: quota.usageInDriveTrash,
    },
  });
}

export async function handleStarFile(
  drive: drive_v3.Drive,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(StarFileSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  // Get file name
  const file = await drive.files.get({
    fileId: data.fileId,
    fields: "name",
    supportsAllDrives: true,
  });

  // Update starred status
  await drive.files.update({
    fileId: data.fileId,
    requestBody: { starred: data.starred },
    supportsAllDrives: true,
  });

  const action = data.starred ? "starred" : "unstarred";
  log(`File ${action} successfully`, { fileId: data.fileId });
  return successResponse(`Successfully ${action} "${file.data.name}"`);
}

// -----------------------------------------------------------------------------
// FILE PATH RESOLUTION
// -----------------------------------------------------------------------------

export async function handleResolveFilePath(
  drive: drive_v3.Drive,
  args: unknown,
  context?: HandlerContext,
): Promise<ToolResponse> {
  const validation = validateArgs(ResolveFilePathSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  if (!data.path || data.path === "/") {
    return structuredResponse("Resolved to root folder", {
      id: "root",
      name: "My Drive",
      path: "/",
      mimeType: FOLDER_MIME_TYPE,
      modifiedTime: null,
    });
  }

  const parts = data.path.replace(/^\/+|\/+$/g, "").split("/");
  let currentFolderId = "root";
  const resolvedPath: string[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;

    const isLastPart = i === parts.length - 1;
    const escapedPart = escapeQueryString(part);

    // Build query based on whether we're looking for the final item or a folder
    let query = combineQueries(
      `'${currentFolderId}' in parents`,
      `name = '${escapedPart}'`,
      "trashed = false",
    );

    if (isLastPart && data.type !== "any") {
      if (data.type === "folder") {
        query += ` and mimeType = '${FOLDER_MIME_TYPE}'`;
      } else if (data.type === "file") {
        query += ` and mimeType != '${FOLDER_MIME_TYPE}'`;
      }
    } else if (!isLastPart) {
      // For intermediate parts, must be a folder
      query += ` and mimeType = '${FOLDER_MIME_TYPE}'`;
    }

    const response = await drive.files.list({
      q: query,
      fields: "files(id, name, mimeType, modifiedTime)",
      pageSize: 10,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
    });

    const files = response.data.files || [];

    if (files.length === 0) {
      // Build helpful error message
      const pathSoFar = "/" + resolvedPath.join("/");
      const searchedIn =
        resolvedPath.length > 0
          ? `"${resolvedPath[resolvedPath.length - 1]}"`
          : "root";

      // List what's in the current folder for context
      const contentsResponse = await drive.files.list({
        q: `'${currentFolderId}' in parents and trashed = false`,
        fields: "files(name, mimeType)",
        pageSize: 20,
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
      });

      const contents = (contentsResponse.data.files || [])
        .map((f) =>
          f.mimeType === FOLDER_MIME_TYPE ? `📁 ${f.name}` : `📄 ${f.name}`,
        )
        .slice(0, 10);

      const contentsStr =
        contents.length > 0
          ? `\nContents of ${searchedIn}: ${contents.join(", ")}${contents.length >= 10 ? "..." : ""}`
          : `\n${searchedIn} appears to be empty.`;

      return errorResponse(
        `Path segment "${part}" not found at "${pathSoFar || "/"}".${contentsStr}`,
      );
    }

    if (files.length > 1) {
      // Multiple matches - try elicitation if context available
      if (context?.server) {
        const fileOptions = files.map((f) => ({
          id: f.id!,
          name: f.name!,
          mimeType: f.mimeType || undefined,
          modifiedTime: f.modifiedTime || undefined,
          path: "/" + [...resolvedPath, f.name!].join("/"),
        }));

        const result = await elicitFileSelection(
          context.server,
          fileOptions,
          `Multiple items named "${part}" found at "/${resolvedPath.join("/")}". Please select one:`,
        );

        if (result.cancelled) {
          return errorResponse("File selection cancelled");
        }

        if (result.error) {
          // Elicitation not supported or failed - return disambiguation message
          return errorResponse(result.error);
        }

        if (result.selectedFileId) {
          const selectedFile = files.find(
            (f) => f.id === result.selectedFileId,
          )!;
          resolvedPath.push(selectedFile.name!);

          if (isLastPart) {
            log("Path resolved via elicitation", {
              path: data.path,
              fileId: selectedFile.id,
            });
            return structuredResponse(
              `Resolved "${data.path}" to ${selectedFile.mimeType === FOLDER_MIME_TYPE ? "folder" : "file"} "${selectedFile.name}"`,
              {
                id: selectedFile.id,
                name: selectedFile.name,
                path: "/" + resolvedPath.join("/"),
                mimeType: selectedFile.mimeType,
                modifiedTime: selectedFile.modifiedTime,
              },
            );
          }

          currentFolderId = selectedFile.id!;
          continue;
        }
      }

      // Fall back to error with disambiguation options
      const disambiguationMessage = formatDisambiguationOptions(
        files.map((f) => ({
          id: f.id!,
          name: f.name!,
          mimeType: f.mimeType || undefined,
          modifiedTime: f.modifiedTime,
        })),
        `Multiple items named "${part}" found at "/${resolvedPath.join("/")}".`,
      );
      return errorResponse(disambiguationMessage);
    }

    const file = files[0];
    resolvedPath.push(file.name!);

    if (isLastPart) {
      // We found the target
      log("Path resolved successfully", { path: data.path, fileId: file.id });
      return structuredResponse(
        `Resolved "${data.path}" to ${file.mimeType === FOLDER_MIME_TYPE ? "folder" : "file"} "${file.name}"`,
        {
          id: file.id,
          name: file.name,
          path: "/" + resolvedPath.join("/"),
          mimeType: file.mimeType,
          modifiedTime: file.modifiedTime,
        },
      );
    }

    // Not the last part - must be a folder
    currentFolderId = file.id!;
  }

  // Should not reach here, but handle edge case
  return errorResponse("Unable to resolve path");
}

// -----------------------------------------------------------------------------
// BATCH OPERATIONS
// -----------------------------------------------------------------------------

export async function handleBatchDelete(
  drive: drive_v3.Drive,
  args: unknown,
  context?: HandlerContext,
): Promise<ToolResponse> {
  const validation = validateArgs(BatchDeleteSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  const { success: deleted, failed } = await processBatchOperation(
    data.fileIds,
    async (fileId) => {
      const file = await drive.files.get({
        fileId,
        fields: "name",
        supportsAllDrives: true,
      });

      await drive.files.update({
        fileId,
        requestBody: { trashed: true },
        supportsAllDrives: true,
      });

      return { fileId, name: file.data.name };
    },
    context,
    { operationName: "Deleting files" },
  );

  const summary = `Batch delete: ${deleted.length} succeeded, ${failed.length} failed`;
  log(summary, { deleted: deleted.length, failed: failed.length });

  return structuredResponse(
    summary +
      (deleted.length > 0
        ? `\n\nDeleted: ${deleted.map((d) => d.name || d.fileId).join(", ")}`
        : "") +
      (failed.length > 0
        ? `\n\nFailed: ${failed.map((f) => `${f.id}: ${f.error}`).join(", ")}`
        : ""),
    { deleted, failed },
  );
}

export async function handleBatchMove(
  drive: drive_v3.Drive,
  args: unknown,
  context?: HandlerContext,
): Promise<ToolResponse> {
  const validation = validateArgs(BatchMoveSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  // Resolve destination folder (supports both ID and path)
  const destinationFolderId = await resolveOptionalFolderPath(
    drive,
    data.destinationFolderId,
    data.destinationPath,
  );

  // Get destination folder name for better reporting
  let destName = "root";
  if (destinationFolderId !== "root") {
    try {
      const destFolder = await withRetry(
        () =>
          drive.files.get({
            fileId: destinationFolderId,
            fields: "name",
            supportsAllDrives: true,
          }),
        { operationName: "getDestinationFolder" },
      );
      destName = destFolder.data.name || destinationFolderId;
    } catch {
      return errorResponse(
        `Destination folder not found: ${destinationFolderId}`,
      );
    }
  }

  const { success: moved, failed } = await processBatchOperation(
    data.fileIds,
    async (fileId) => {
      const file = await drive.files.get({
        fileId,
        fields: "name, parents",
        supportsAllDrives: true,
      });

      const previousParents = (file.data.parents || []).join(",");

      await drive.files.update({
        fileId,
        addParents: destinationFolderId,
        removeParents: previousParents,
        supportsAllDrives: true,
      });

      return { fileId, name: file.data.name };
    },
    context,
    { operationName: `Moving files to "${destName}"` },
  );

  const summary = `Batch move to "${destName}": ${moved.length} succeeded, ${failed.length} failed`;
  log(summary, { moved: moved.length, failed: failed.length });

  return structuredResponse(
    summary +
      (moved.length > 0
        ? `\n\nMoved: ${moved.map((m) => m.name || m.fileId).join(", ")}`
        : "") +
      (failed.length > 0
        ? `\n\nFailed: ${failed.map((f) => `${f.id}: ${f.error}`).join(", ")}`
        : ""),
    {
      moved,
      failed,
      destinationFolder: { id: destinationFolderId, name: destName },
    },
  );
}

export async function handleBatchShare(
  drive: drive_v3.Drive,
  args: unknown,
  context?: HandlerContext,
): Promise<ToolResponse> {
  const validation = validateArgs(BatchShareSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  const { success: shared, failed } = await processBatchOperation(
    data.fileIds,
    async (fileId) => {
      const file = await drive.files.get({
        fileId,
        fields: "name",
        supportsAllDrives: true,
      });

      await drive.permissions.create({
        fileId,
        requestBody: {
          role: data.role,
          type: "user",
          emailAddress: data.email,
        },
        sendNotificationEmail: data.sendNotification,
        supportsAllDrives: true,
      });

      return { fileId, name: file.data.name };
    },
    context,
    { operationName: `Sharing files with ${data.email}` },
  );

  const summary = `Batch share with ${data.email} (${data.role}): ${shared.length} succeeded, ${failed.length} failed`;
  log(summary, { shared: shared.length, failed: failed.length });

  return structuredResponse(
    summary +
      (shared.length > 0
        ? `\n\nShared: ${shared.map((s) => s.name || s.fileId).join(", ")}`
        : "") +
      (failed.length > 0
        ? `\n\nFailed: ${failed.map((f) => `${f.id}: ${f.error}`).join(", ")}`
        : ""),
    { shared, failed, shareDetails: { email: data.email, role: data.role } },
  );
}

export async function handleBatchRestore(
  drive: drive_v3.Drive,
  args: unknown,
  context?: HandlerContext,
): Promise<ToolResponse> {
  const validation = validateArgs(BatchRestoreSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  const { success: restored, failed } = await processBatchOperation(
    data.fileIds,
    async (fileId) => {
      const file = await drive.files.get({
        fileId,
        fields: "name, trashed",
        supportsAllDrives: true,
      });

      if (!file.data.trashed) {
        throw new Error(`File "${file.data.name}" is not in trash`);
      }

      await drive.files.update({
        fileId,
        requestBody: { trashed: false },
        supportsAllDrives: true,
      });

      return { fileId, name: file.data.name };
    },
    context,
    { operationName: "Restoring files from trash" },
  );

  const summary = `Batch restore: ${restored.length} succeeded, ${failed.length} failed`;
  log(summary, { restored: restored.length, failed: failed.length });

  return structuredResponse(
    summary +
      (restored.length > 0
        ? `\n\nRestored: ${restored.map((r) => r.name || r.fileId).join(", ")}`
        : "") +
      (failed.length > 0
        ? `\n\nFailed: ${failed.map((f) => `${f.id}: ${f.error}`).join(", ")}`
        : ""),
    { restored, failed },
  );
}

// -----------------------------------------------------------------------------
// PERMISSION MANAGEMENT
// -----------------------------------------------------------------------------

export async function handleRemovePermission(
  drive: drive_v3.Drive,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(RemovePermissionSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  // Get file name for reporting
  const file = await drive.files.get({
    fileId: data.fileId,
    fields: "name",
    supportsAllDrives: true,
  });

  let permissionIdToRemove = data.permissionId;

  // If email provided, look up the permission ID
  if (data.email && !permissionIdToRemove) {
    const permissions = await drive.permissions.list({
      fileId: data.fileId,
      fields: "permissions(id, emailAddress, role)",
      supportsAllDrives: true,
    });

    const permission = (permissions.data.permissions || []).find(
      (p) => p.emailAddress?.toLowerCase() === data.email!.toLowerCase(),
    );

    if (!permission) {
      // List current permissions for context
      const currentPerms = (permissions.data.permissions || [])
        .map((p) => `${p.emailAddress || "anonymous"} (${p.role})`)
        .join(", ");

      return errorResponse(
        `No permission found for email "${data.email}" on file "${file.data.name}". ` +
          `Current permissions: ${currentPerms || "none"}`,
      );
    }

    // Check if this is the owner
    if (permission.role === "owner") {
      return errorResponse(
        `Cannot remove owner permission for "${data.email}". ` +
          `Transfer ownership first if you want to remove this user's access.`,
      );
    }

    permissionIdToRemove = permission.id!;
  }

  // Check if trying to remove owner by permissionId
  if (permissionIdToRemove) {
    const permDetails = await drive.permissions.get({
      fileId: data.fileId,
      permissionId: permissionIdToRemove,
      fields: "role, emailAddress",
      supportsAllDrives: true,
    });

    if (permDetails.data.role === "owner") {
      return errorResponse(
        `Cannot remove owner permission (${permDetails.data.emailAddress}). ` +
          `Transfer ownership first if you want to remove this user's access.`,
      );
    }
  }

  await drive.permissions.delete({
    fileId: data.fileId,
    permissionId: permissionIdToRemove!,
    supportsAllDrives: true,
  });

  log("Permission removed successfully", {
    fileId: data.fileId,
    permissionId: permissionIdToRemove,
  });
  return successResponse(
    `Removed permission from "${file.data.name}"` +
      (data.email
        ? ` for ${data.email}`
        : ` (permission ID: ${permissionIdToRemove})`),
  );
}

// -----------------------------------------------------------------------------
// TRASH MANAGEMENT
// -----------------------------------------------------------------------------

export async function handleListTrash(
  drive: drive_v3.Drive,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(ListTrashSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  const response = await withTimeout(
    drive.files.list({
      q: "trashed = true",
      pageSize: data.pageSize,
      pageToken: data.pageToken,
      fields:
        "nextPageToken, files(id, name, mimeType, modifiedTime, size, trashedTime)",
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
    }),
    30000,
    "List trash",
  );

  const files = response.data.files || [];

  if (files.length === 0) {
    return structuredResponse("Trash is empty", {
      files: [],
      nextPageToken: null,
    });
  }

  const fileList = files
    .map((f) => {
      const icon = f.mimeType === FOLDER_MIME_TYPE ? "📁" : "📄";
      const size =
        f.mimeType === FOLDER_MIME_TYPE
          ? ""
          : ` (${formatBytesCompact(f.size)})`;
      return `${icon} ${f.name}${size} - ID: ${f.id}`;
    })
    .join("\n");

  const textResponse =
    `Trash contents (${files.length} items):\n\n${fileList}` +
    (response.data.nextPageToken
      ? "\n\n(More items available - use nextPageToken to continue)"
      : "");

  return structuredResponse(textResponse, {
    files: files.map((f) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      size: f.size,
      trashedTime: f.trashedTime,
    })),
    nextPageToken: response.data.nextPageToken || null,
  });
}

export async function handleRestoreFromTrash(
  drive: drive_v3.Drive,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(RestoreFromTrashSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  // Get file info
  const file = await drive.files.get({
    fileId: data.fileId,
    fields: "name, trashed, parents",
    supportsAllDrives: true,
  });

  if (!file.data.trashed) {
    return errorResponse(`File "${file.data.name}" is not in trash`);
  }

  // First, restore from trash
  await drive.files.update({
    fileId: data.fileId,
    requestBody: { trashed: false },
    supportsAllDrives: true,
  });

  // If destination is specified, move to that folder
  let destinationInfo: { id: string; name: string } | undefined;
  if (data.destinationFolderId || data.destinationPath) {
    const destinationFolderId = await resolveOptionalFolderPath(
      drive,
      data.destinationFolderId,
      data.destinationPath,
    );

    // Get destination folder name
    let destName = "root";
    if (destinationFolderId !== "root") {
      const destFolder = await drive.files.get({
        fileId: destinationFolderId,
        fields: "name",
        supportsAllDrives: true,
      });
      destName = destFolder.data.name || destinationFolderId;
    }

    // Move to destination
    const currentParents = file.data.parents?.join(",") || "";
    await drive.files.update({
      fileId: data.fileId,
      addParents: destinationFolderId,
      removeParents: currentParents,
      supportsAllDrives: true,
    });

    destinationInfo = { id: destinationFolderId, name: destName };
    log("File restored from trash and moved", {
      fileId: data.fileId,
      destinationFolderId,
    });
    return structuredResponse(
      `Restored "${file.data.name}" from trash and moved to "${destName}"`,
      {
        fileName: file.data.name,
        restored: true,
        destinationFolder: destinationInfo,
      },
    );
  }

  log("File restored from trash", { fileId: data.fileId });
  return structuredResponse(`Restored "${file.data.name}" from trash`, {
    fileName: file.data.name,
    restored: true,
  });
}

export async function handleEmptyTrash(
  drive: drive_v3.Drive,
  args: unknown,
  context?: HandlerContext,
): Promise<ToolResponse> {
  const validation = validateArgs(EmptyTrashSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  // Count items in trash first
  const listParams: {
    q: string;
    fields: string;
    pageSize: number;
    driveId?: string;
    corpora?: string;
  } = {
    q: "trashed = true",
    fields: "files(id, name)",
    pageSize: 1000,
  };

  // If driveId is specified, query that shared drive's trash
  if (data.driveId) {
    listParams.driveId = data.driveId;
    listParams.corpora = "drive";
  }

  const trashContents = await drive.files.list(listParams);

  const itemCount = trashContents.data.files?.length || 0;

  if (itemCount === 0) {
    return successResponse(
      data.driveId
        ? "Shared drive trash is already empty"
        : "Trash is already empty",
    );
  }

  // Use elicitation for confirmation if context available
  if (context?.server) {
    const sampleFiles = (trashContents.data.files || [])
      .slice(0, 5)
      .map((f) => f.name)
      .join(", ");
    const moreText = itemCount > 5 ? ` and ${itemCount - 5} more` : "";

    const confirmResult = await elicitConfirmation(
      context.server,
      `Permanently delete ${itemCount} item(s) from ${data.driveId ? "shared drive " : ""}trash?`,
      `This action cannot be undone. Files: ${sampleFiles}${moreText}`,
    );

    if (confirmResult.cancelled) {
      return errorResponse("Empty trash operation cancelled");
    }

    if (!confirmResult.confirmed) {
      return errorResponse(
        `Empty trash requires confirmation. ${itemCount} item(s) will be permanently deleted. ` +
          `Files include: ${sampleFiles}${moreText}`,
      );
    }
  }

  // Empty trash - pass driveId if specified for shared drives
  await drive.files.emptyTrash(data.driveId ? { driveId: data.driveId } : {});

  log("Trash emptied", { itemCount, driveId: data.driveId });
  return successResponse(
    data.driveId
      ? `Permanently deleted ${itemCount} item(s) from shared drive trash`
      : `Permanently deleted ${itemCount} item(s) from trash`,
  );
}

// -----------------------------------------------------------------------------
// FOLDER TREE DISCOVERY
// -----------------------------------------------------------------------------

interface FolderTreeNode {
  id: string;
  name: string;
  type: "folder" | "file";
  mimeType?: string;
  children?: FolderTreeNode[];
  truncated?: boolean;
}

async function buildFolderTree(
  drive: drive_v3.Drive,
  folderId: string,
  folderName: string,
  currentDepth: number,
  maxDepth: number,
): Promise<FolderTreeNode> {
  const node: FolderTreeNode = {
    id: folderId,
    name: folderName,
    type: "folder",
  };

  if (currentDepth >= maxDepth) {
    return node;
  }

  // List contents of this folder
  const response = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id, name, mimeType)",
    pageSize: 100,
    orderBy: "folder,name",
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
  });

  const files = response.data.files || [];
  const children: FolderTreeNode[] = [];

  // Check if results were truncated (100 is pageSize limit)
  const truncated = files.length >= 100;

  for (const file of files) {
    if (file.mimeType === FOLDER_MIME_TYPE) {
      // Recursively build tree for subfolders
      const childNode = await buildFolderTree(
        drive,
        file.id!,
        file.name!,
        currentDepth + 1,
        maxDepth,
      );
      children.push(childNode);
    } else {
      // Add file node
      children.push({
        id: file.id!,
        name: file.name!,
        type: "file",
        mimeType: file.mimeType || undefined,
      });
    }
  }

  if (children.length > 0) {
    node.children = children;
  }

  if (truncated) {
    node.truncated = true;
  }

  return node;
}

function formatTreeAsText(
  node: FolderTreeNode,
  indent: string = "",
  isLast: boolean = true,
): string {
  const prefix = indent + (isLast ? "└── " : "├── ");
  const icon = node.type === "folder" ? "📁" : "📄";
  const truncatedIndicator = node.truncated ? " (100+ items, truncated)" : "";
  let result = prefix + icon + " " + node.name + truncatedIndicator + "\n";

  if (node.children) {
    const childIndent = indent + (isLast ? "    " : "│   ");
    node.children.forEach((child, index) => {
      const isLastChild = index === node.children!.length - 1;
      result += formatTreeAsText(child, childIndent, isLastChild);
    });
  }

  return result;
}

export async function handleGetFolderTree(
  drive: drive_v3.Drive,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(GetFolderTreeSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  // Resolve folder ID
  const folderId = await resolveOptionalFolderPath(
    drive,
    data.folderId,
    data.folderPath,
  );

  // Get folder name
  let folderName = "My Drive";
  let folderPath = "/";

  if (folderId !== "root") {
    const folder = await drive.files.get({
      fileId: folderId,
      fields: "name",
      supportsAllDrives: true,
    });
    folderName = folder.data.name || folderId;
    folderPath = data.folderPath || `/${folderName}`;
  }

  // Build tree structure
  const tree = await buildFolderTree(
    drive,
    folderId,
    folderName,
    0,
    data.depth || 2,
  );

  // Format as text
  const truncatedIndicator = tree.truncated ? " (100+ items, truncated)" : "";
  const treeText =
    "📁 " +
    folderName +
    truncatedIndicator +
    "\n" +
    (tree.children
      ? tree.children
          .map((child, index) =>
            formatTreeAsText(child, "", index === tree.children!.length - 1),
          )
          .join("")
      : "(empty)");

  return structuredResponse(treeText, {
    id: folderId,
    name: folderName,
    path: folderPath,
    children: tree.children || [],
    truncated: tree.truncated,
  });
}
