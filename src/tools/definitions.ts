/**
 * Tool definitions for the Google Drive MCP server.
 * Each tool definition includes name, description, inputSchema, and optionally outputSchema.
 */

// JSON Schema conditional keywords for machine-parseable requirements
interface JsonSchemaConditional {
  if?: { properties: Record<string, unknown> };
  then?: { required: string[] };
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    // JSON Schema conditional keywords for action-based requirements
    if?: { properties: Record<string, unknown> };
    then?: { required: string[] };
    allOf?: JsonSchemaConditional[];
  };
  outputSchema?: {
    type: "object";
    properties: Record<string, unknown>;
  };
}

// Drive tools
export const driveTools: ToolDefinition[] = [
  {
    name: "search",
    description: "Search files and folders in Drive (max 100 results per page)",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        searchType: {
          type: "string",
          enum: ["fulltext", "name", "name_exact"],
          description:
            "Search type: 'fulltext' (default, searches file content), 'name' (filename contains query), 'name_exact' (exact filename match)",
        },
        pageSize: {
          type: "number",
          description: "(optional, default: 50) Results per page (max 100)",
        },
        pageToken: {
          type: "string",
          description: "(optional) Token for next page of results",
        },
      },
      required: ["query"],
    },
    outputSchema: {
      type: "object",
      properties: {
        files: {
          type: "array",
          description: "List of matching files",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "File ID" },
              name: { type: "string", description: "File name" },
              mimeType: { type: "string", description: "MIME type" },
              modifiedTime: {
                type: "string",
                description: "Last modified timestamp",
              },
              size: { type: "string", description: "File size in bytes" },
            },
          },
        },
        nextPageToken: {
          type: "string",
          description: "Token for fetching next page, if more results exist",
        },
      },
    },
  },
  {
    name: "create_text_file",
    description: "Create a text or markdown file",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "File name (.txt or .md)" },
        content: { type: "string", description: "File content" },
        parentFolderId: {
          type: "string",
          description: "Parent folder ID (mutually exclusive with parentPath)",
        },
        parentPath: {
          type: "string",
          description:
            "Parent folder path like '/Documents/Projects' (creates folders if needed, mutually exclusive with parentFolderId)",
        },
      },
      required: ["name", "content"],
    },
    outputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Created file ID" },
        name: { type: "string", description: "Created file name" },
      },
    },
  },
  {
    name: "update_text_file",
    description: "Update content of a text or markdown file in Google Drive",
    inputSchema: {
      type: "object",
      properties: {
        fileId: { type: "string", description: "ID of the file to update" },
        content: { type: "string", description: "New file content" },
        name: {
          type: "string",
          description: "Optional new name (.txt or .md)",
        },
      },
      required: ["fileId", "content"],
    },
    outputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Updated file name" },
        modifiedTime: {
          type: "string",
          description: "Last modified timestamp (ISO 8601)",
        },
      },
    },
  },
  {
    name: "create_folder",
    description: "Create a new folder in Google Drive",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Folder name" },
        parent: {
          type: "string",
          description: "Parent folder ID (mutually exclusive with parentPath)",
        },
        parentPath: {
          type: "string",
          description:
            "Parent folder path like '/Documents/Projects' (creates folders if needed, mutually exclusive with parent)",
        },
      },
      required: ["name"],
    },
    outputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Created folder ID" },
        name: { type: "string", description: "Created folder name" },
      },
    },
  },
  {
    name: "list_folder",
    description: "List folder contents (max 100 items per page)",
    inputSchema: {
      type: "object",
      properties: {
        folderId: { type: "string", description: "(optional) Folder ID (defaults to root)" },
        pageSize: {
          type: "number",
          description: "(optional, default: 50) Items to return (max 100)",
        },
        pageToken: { type: "string", description: "(optional) Token for next page" },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          description: "List of files and folders",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "Item ID" },
              name: { type: "string", description: "Item name" },
              mimeType: { type: "string", description: "MIME type" },
              modifiedTime: {
                type: "string",
                description: "Last modified timestamp",
              },
              size: {
                type: "string",
                description: "File size in bytes (folders have no size)",
              },
            },
          },
        },
        nextPageToken: {
          type: "string",
          description: "Token for fetching next page, if more items exist",
        },
      },
    },
  },
  {
    name: "delete_item",
    description: "Move items to trash",
    inputSchema: {
      type: "object",
      properties: {
        itemId: { type: "string", description: "ID of the item to delete" },
      },
      required: ["itemId"],
    },
    outputSchema: {
      type: "object",
      properties: {
        success: { type: "boolean", description: "Whether the deletion succeeded" },
        itemId: { type: "string", description: "ID of the deleted item" },
      },
    },
  },
  {
    name: "rename_item",
    description: "Rename a file or folder",
    inputSchema: {
      type: "object",
      properties: {
        itemId: { type: "string", description: "ID of the item to rename" },
        newName: { type: "string", description: "New name" },
      },
      required: ["itemId", "newName"],
    },
    outputSchema: {
      type: "object",
      properties: {
        success: { type: "boolean", description: "Whether the rename succeeded" },
        id: { type: "string", description: "Item ID" },
        name: { type: "string", description: "New name" },
      },
    },
  },
  {
    name: "move_item",
    description: "Move items to a new folder",
    inputSchema: {
      type: "object",
      properties: {
        itemId: { type: "string", description: "ID of the item to move" },
        destinationFolderId: {
          type: "string",
          description: "Destination folder ID (mutually exclusive with destinationPath)",
        },
        destinationPath: {
          type: "string",
          description:
            "Destination folder path like '/Archive/2024' (creates folders if needed, mutually exclusive with destinationFolderId)",
        },
      },
      required: ["itemId"],
    },
    outputSchema: {
      type: "object",
      properties: {
        itemName: { type: "string", description: "Name of the moved item" },
        destinationName: {
          type: "string",
          description: "Destination folder name",
        },
      },
    },
  },
  {
    name: "copy_file",
    description: "Copy a file with optional new name",
    inputSchema: {
      type: "object",
      properties: {
        sourceFileId: { type: "string", description: "ID of the file to copy" },
        destinationName: {
          type: "string",
          description: "Name for the copied file (defaults to 'Copy of <original>')",
        },
        destinationFolderId: {
          type: "string",
          description: "Destination folder ID (defaults to same folder as source)",
        },
      },
      required: ["sourceFileId"],
    },
    outputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "New file ID" },
        name: { type: "string", description: "New file name" },
        webViewLink: {
          type: "string",
          description: "Link to view the new file",
        },
      },
    },
  },
  {
    name: "get_file_metadata",
    description: "Get file or folder metadata",
    inputSchema: {
      type: "object",
      properties: {
        fileId: { type: "string", description: "ID of the file or folder" },
      },
      required: ["fileId"],
    },
    outputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "File ID" },
        name: { type: "string", description: "File name" },
        mimeType: { type: "string", description: "MIME type" },
        size: { type: "string", description: "File size in bytes" },
        createdTime: {
          type: "string",
          description: "Creation timestamp (ISO 8601)",
        },
        modifiedTime: {
          type: "string",
          description: "Last modified timestamp (ISO 8601)",
        },
        owners: {
          type: "array",
          description: "List of file owners",
          items: {
            type: "object",
            properties: {
              displayName: { type: "string" },
              emailAddress: { type: "string" },
            },
          },
        },
        shared: { type: "boolean", description: "Whether the file is shared" },
        starred: {
          type: "boolean",
          description: "Whether the file is starred",
        },
        description: { type: "string", description: "File description" },
        webViewLink: {
          type: "string",
          description: "Link to view file in browser",
        },
        parents: {
          type: "array",
          description: "IDs of parent folders",
          items: { type: "string" },
        },
      },
    },
  },
  {
    name: "export_file",
    description: "Export Workspace files to other formats",
    inputSchema: {
      type: "object",
      properties: {
        fileId: {
          type: "string",
          description: "ID of the Google Doc, Sheet, or Slides to export",
        },
        format: {
          type: "string",
          description: "Export format: pdf, docx (Docs), xlsx/csv/tsv (Sheets), pptx (Slides)",
          enum: ["pdf", "docx", "xlsx", "pptx", "csv", "tsv", "odt", "ods", "odp"],
        },
        outputPath: {
          type: "string",
          description: "Optional directory path to save the file (returns base64 if not provided)",
        },
      },
      required: ["fileId", "format"],
    },
    outputSchema: {
      type: "object",
      properties: {
        fileName: { type: "string", description: "Original file name" },
        format: { type: "string", description: "Export format used" },
        outputPath: {
          type: "string",
          description: "Path where file was saved (if outputPath provided)",
        },
        size: { type: "number", description: "File size in bytes" },
        base64Content: {
          type: "string",
          description: "Base64-encoded content (if no outputPath)",
        },
      },
    },
  },
  // Sharing tools
  {
    name: "share_file",
    description: "Share a file with a user, group, domain, or make public",
    inputSchema: {
      type: "object",
      properties: {
        fileId: { type: "string", description: "File ID to share" },
        role: {
          type: "string",
          enum: ["reader", "commenter", "writer", "organizer"],
          description: "Permission role",
        },
        type: {
          type: "string",
          enum: ["user", "group", "domain", "anyone"],
          description: "Permission type",
        },
        emailAddress: {
          type: "string",
          description: "Email (required for user/group)",
        },
        domain: {
          type: "string",
          description: "Domain (required for domain type)",
        },
        sendNotificationEmail: {
          type: "boolean",
          description: "Send notification email (default: true)",
        },
        emailMessage: {
          type: "string",
          description: "Custom message for notification",
        },
      },
      required: ["fileId", "role", "type"],
    },
    outputSchema: {
      type: "object",
      properties: {
        fileName: { type: "string", description: "Name of the shared file" },
        permissionId: { type: "string", description: "Created permission ID" },
        role: { type: "string", description: "Permission role granted" },
        target: { type: "string", description: "Who the file was shared with" },
      },
    },
  },
  {
    name: "get_sharing",
    description: "Get sharing settings and permissions for a file",
    inputSchema: {
      type: "object",
      properties: {
        fileId: { type: "string", description: "File ID" },
      },
      required: ["fileId"],
    },
    outputSchema: {
      type: "object",
      properties: {
        fileName: { type: "string", description: "Name of the file" },
        webViewLink: {
          type: "string",
          description: "Link to view file in browser",
        },
        permissions: {
          type: "array",
          description: "List of permissions on the file",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "Permission ID" },
              role: {
                type: "string",
                description: "Permission role",
                enum: ["owner", "organizer", "fileOrganizer", "writer", "commenter", "reader"],
              },
              type: {
                type: "string",
                description: "Permission type",
                enum: ["user", "group", "domain", "anyone"],
              },
              emailAddress: {
                type: "string",
                description: "Email address (for user/group)",
              },
              domain: {
                type: "string",
                description: "Domain (for domain type)",
              },
              displayName: {
                type: "string",
                description: "Display name of the user/group",
              },
            },
          },
        },
      },
    },
  },
  // Revision tools
  {
    name: "list_revisions",
    description: "List file version history",
    inputSchema: {
      type: "object",
      properties: {
        fileId: { type: "string", description: "File ID" },
        pageSize: {
          type: "number",
          description: "Max revisions to return (default 100, max 1000)",
        },
      },
      required: ["fileId"],
    },
    outputSchema: {
      type: "object",
      properties: {
        fileName: { type: "string", description: "Name of the file" },
        revisions: {
          type: "array",
          description: "List of file revisions",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "Revision ID" },
              modifiedTime: {
                type: "string",
                description: "When revision was created (ISO 8601)",
              },
              size: {
                type: "string",
                description: "Size of revision in bytes",
              },
              keepForever: {
                type: "boolean",
                description: "Whether revision is pinned",
              },
              lastModifyingUser: {
                type: "object",
                description: "User who created this revision",
                properties: {
                  displayName: { type: "string" },
                  emailAddress: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
  },
  {
    name: "restore_revision",
    description: "Restore file to previous revision",
    inputSchema: {
      type: "object",
      properties: {
        fileId: { type: "string", description: "File ID" },
        revisionId: { type: "string", description: "Revision ID to restore" },
      },
      required: ["fileId", "revisionId"],
    },
    outputSchema: {
      type: "object",
      properties: {
        fileName: { type: "string", description: "Name of the restored file" },
        revisionId: {
          type: "string",
          description: "Revision that was restored",
        },
      },
    },
  },
  // Binary file tools
  {
    name: "download_file",
    description: "Download a file as base64 or to disk",
    inputSchema: {
      type: "object",
      properties: {
        fileId: { type: "string", description: "File ID" },
        outputPath: {
          type: "string",
          description: "Directory to save file (optional, returns base64 if not provided)",
        },
      },
      required: ["fileId"],
    },
    outputSchema: {
      type: "object",
      properties: {
        fileName: {
          type: "string",
          description: "Name of the downloaded file",
        },
        mimeType: { type: "string", description: "MIME type of the file" },
        size: { type: "number", description: "File size in bytes" },
        outputPath: {
          type: "string",
          description: "Path where file was saved (if outputPath provided)",
        },
        base64Content: {
          type: "string",
          description: "Base64-encoded content (if no outputPath)",
        },
      },
    },
  },
  {
    name: "upload_file",
    description: "Upload file from disk or base64",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "File name with extension" },
        sourcePath: { type: "string", description: "Path to source file" },
        base64Content: {
          type: "string",
          description: "Base64-encoded content",
        },
        mimeType: {
          type: "string",
          description: "MIME type (auto-detected from extension if omitted)",
        },
        folderId: {
          type: "string",
          description: "Destination folder ID (mutually exclusive with folderPath)",
        },
        folderPath: {
          type: "string",
          description:
            "Destination folder path like '/Documents/Uploads' (creates folders if needed, mutually exclusive with folderId)",
        },
      },
      required: ["name"],
    },
    outputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Uploaded file ID" },
        name: { type: "string", description: "Uploaded file name" },
        webViewLink: { type: "string", description: "Link to view the file" },
      },
    },
  },
  // Metadata tools
  {
    name: "get_storage_quota",
    description: "Get Google Drive storage quota and usage",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    outputSchema: {
      type: "object",
      properties: {
        user: {
          type: "object",
          description: "User information",
          properties: {
            displayName: { type: "string" },
            emailAddress: { type: "string" },
          },
        },
        storageQuota: {
          type: "object",
          description: "Storage quota details",
          properties: {
            limit: {
              type: "string",
              description: "Total storage limit in bytes (null if unlimited)",
            },
            usage: { type: "string", description: "Total bytes used" },
            usageInDrive: {
              type: "string",
              description: "Bytes used in Drive",
            },
            usageInDriveTrash: {
              type: "string",
              description: "Bytes used in Drive trash",
            },
          },
        },
      },
    },
  },
  {
    name: "star_file",
    description: "Star or unstar a file in Google Drive",
    inputSchema: {
      type: "object",
      properties: {
        fileId: { type: "string", description: "File ID" },
        starred: {
          type: "boolean",
          description: "true to star, false to unstar",
        },
      },
      required: ["fileId", "starred"],
    },
    outputSchema: {
      type: "object",
      properties: {
        success: { type: "boolean", description: "Whether the operation succeeded" },
        fileId: { type: "string", description: "File ID" },
        starred: { type: "boolean", description: "Current starred status" },
      },
    },
  },
  // File path resolution
  {
    name: "resolve_file_path",
    description: "Resolve file path to ID",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description:
            "File path to resolve (e.g., 'Documents/Projects/Budget.xlsx' or '/My Folder/report.pdf')",
        },
        type: {
          type: "string",
          description: "Type of item to find: 'file', 'folder', or 'any' (default)",
          enum: ["file", "folder", "any"],
        },
      },
      required: ["path"],
    },
    outputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "File ID" },
        name: { type: "string", description: "File name" },
        path: { type: "string", description: "Full resolved path" },
        mimeType: { type: "string", description: "MIME type" },
        modifiedTime: {
          type: "string",
          description: "Last modified timestamp",
        },
      },
    },
  },
  // Batch operations
  {
    name: "batch_delete",
    description: "Batch move files to trash (max 100 per batch)",
    inputSchema: {
      type: "object",
      properties: {
        fileIds: {
          type: "array",
          description: "Array of file IDs to delete (max 100)",
          items: { type: "string" },
        },
      },
      required: ["fileIds"],
    },
    outputSchema: {
      type: "object",
      properties: {
        succeeded: { type: "number", description: "Number of files successfully deleted" },
        failed: { type: "number", description: "Number of files that failed" },
        errors: {
          type: "array",
          description: "List of errors for failed operations",
          items: {
            type: "object",
            properties: {
              fileId: { type: "string" },
              error: { type: "string" },
            },
          },
        },
      },
    },
  },
  {
    name: "batch_restore",
    description: "Batch restore files from trash (max 100 per batch)",
    inputSchema: {
      type: "object",
      properties: {
        fileIds: {
          type: "array",
          description: "Array of file IDs to restore from trash (max 100)",
          items: { type: "string" },
        },
      },
      required: ["fileIds"],
    },
    outputSchema: {
      type: "object",
      properties: {
        succeeded: { type: "number", description: "Number of files successfully restored" },
        failed: { type: "number", description: "Number of files that failed" },
        errors: {
          type: "array",
          description: "List of errors for failed operations",
          items: {
            type: "object",
            properties: {
              fileId: { type: "string" },
              error: { type: "string" },
            },
          },
        },
      },
    },
  },
  {
    name: "batch_move",
    description: "Batch move files to folder (max 100 per batch)",
    inputSchema: {
      type: "object",
      properties: {
        fileIds: {
          type: "array",
          description: "Array of file IDs to move (max 100)",
          items: { type: "string" },
        },
        destinationFolderId: {
          type: "string",
          description: "Destination folder ID (mutually exclusive with destinationPath)",
        },
        destinationPath: {
          type: "string",
          description:
            "Destination folder path like '/Archive/2024' (creates folders if needed, mutually exclusive with destinationFolderId)",
        },
      },
      required: ["fileIds"],
    },
    outputSchema: {
      type: "object",
      properties: {
        succeeded: { type: "number", description: "Number of files successfully moved" },
        failed: { type: "number", description: "Number of files that failed" },
        destinationFolder: {
          type: "object",
          description: "Destination folder info",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
          },
        },
        errors: {
          type: "array",
          description: "List of errors for failed operations",
          items: {
            type: "object",
            properties: {
              fileId: { type: "string" },
              error: { type: "string" },
            },
          },
        },
      },
    },
  },
  {
    name: "batch_share",
    description: "Batch share files with a user (max 100 per batch)",
    inputSchema: {
      type: "object",
      properties: {
        fileIds: {
          type: "array",
          description: "Array of file IDs to share (max 100)",
          items: { type: "string" },
        },
        email: { type: "string", description: "Email address to share with" },
        role: {
          type: "string",
          description: "Permission role",
          enum: ["reader", "writer", "commenter"],
        },
        sendNotification: {
          type: "boolean",
          description: "(optional, default: true) Send email notification",
        },
      },
      required: ["fileIds", "email", "role"],
    },
    outputSchema: {
      type: "object",
      properties: {
        succeeded: { type: "number", description: "Number of files successfully shared" },
        failed: { type: "number", description: "Number of files that failed" },
        sharedWith: { type: "string", description: "Email address files were shared with" },
        role: { type: "string", description: "Permission role granted" },
        errors: {
          type: "array",
          description: "List of errors for failed operations",
          items: {
            type: "object",
            properties: {
              fileId: { type: "string" },
              error: { type: "string" },
            },
          },
        },
      },
    },
  },
  // Permission management
  {
    name: "remove_permission",
    description: "Remove sharing permission from a file",
    inputSchema: {
      type: "object",
      properties: {
        fileId: { type: "string", description: "File ID" },
        permissionId: {
          type: "string",
          description: "Permission ID (from getSharing)",
        },
        email: {
          type: "string",
          description: "Email address to remove (alternative to permissionId)",
        },
      },
      required: ["fileId"],
    },
    outputSchema: {
      type: "object",
      properties: {
        fileName: { type: "string", description: "Name of the file" },
        removedTarget: {
          type: "string",
          description: "Email or permission ID that was removed",
        },
      },
    },
  },
  // Trash management
  {
    name: "list_trash",
    description: "List files in trash",
    inputSchema: {
      type: "object",
      properties: {
        pageSize: {
          type: "number",
          description: "Items per page (default 50, max 100)",
        },
        pageToken: { type: "string", description: "Token for next page" },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        files: {
          type: "array",
          description: "Files in trash",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              mimeType: { type: "string" },
              size: { type: "string" },
              trashedTime: { type: "string" },
            },
          },
        },
        nextPageToken: { type: "string", description: "Token for next page" },
      },
    },
  },
  {
    name: "restore_from_trash",
    description: "Restore a file from trash",
    inputSchema: {
      type: "object",
      properties: {
        fileId: { type: "string", description: "File ID to restore" },
        destinationFolderId: {
          type: "string",
          description:
            "Optional destination folder ID (mutually exclusive with destinationPath). If not provided, restores to original location.",
        },
        destinationPath: {
          type: "string",
          description:
            "Optional destination folder path like '/Documents/Restored' (mutually exclusive with destinationFolderId). If not provided, restores to original location.",
        },
      },
      required: ["fileId"],
    },
    outputSchema: {
      type: "object",
      properties: {
        fileName: { type: "string", description: "Name of the restored file" },
        restored: {
          type: "boolean",
          description: "Whether the file was restored",
        },
        destinationFolder: {
          type: "object",
          description: "Destination folder info (if moved)",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
          },
        },
      },
    },
  },
  {
    name: "empty_trash",
    description: "Permanently delete all files in trash",
    inputSchema: {
      type: "object",
      properties: {
        confirm: {
          type: "boolean",
          description: "Must be true to confirm permanent deletion",
        },
        driveId: {
          type: "string",
          description:
            "Optional shared drive ID. If provided, empties trash of that shared drive instead of personal drive.",
        },
      },
      required: ["confirm"],
    },
    outputSchema: {
      type: "object",
      properties: {
        itemsDeleted: {
          type: "number",
          description: "Number of items permanently deleted",
        },
        driveId: {
          type: "string",
          description: "Shared drive ID if specified",
        },
      },
    },
  },
  {
    name: "get_folder_tree",
    description: "Get folder tree structure (max depth 5, truncates at 100 items per folder)",
    inputSchema: {
      type: "object",
      properties: {
        folderId: {
          type: "string",
          description:
            "(optional) Folder ID to start from (defaults to root, mutually exclusive with folderPath)",
        },
        folderPath: {
          type: "string",
          description:
            "(optional) Folder path like '/Documents/Projects' (mutually exclusive with folderId)",
        },
        depth: {
          type: "number",
          description:
            "(optional, default: 2) Maximum depth to traverse (1-5). Higher values make more API calls.",
        },
      },
      required: [],
    },
    outputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Folder ID" },
        name: { type: "string", description: "Folder name" },
        path: { type: "string", description: "Folder path" },
        children: {
          type: "array",
          description: "Recursive array of files and folders",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "Item ID" },
              name: { type: "string", description: "Item name" },
              type: { type: "string", description: "'folder' or 'file'" },
              mimeType: { type: "string", description: "MIME type for files" },
              children: {
                type: "array",
                description: "Children (for folders only)",
              },
              truncated: {
                type: "boolean",
                description: "True if folder contents were truncated at 100 items",
              },
            },
          },
        },
        truncated: {
          type: "boolean",
          description: "True if root folder contents were truncated at 100 items",
        },
      },
    },
  },
];

// Docs tools
export const docsTools: ToolDefinition[] = [
  {
    name: "create_google_doc",
    description: "Create a new Google Doc",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Doc name" },
        content: { type: "string", description: "Doc content" },
        parentFolderId: {
          type: "string",
          description: "Parent folder ID (mutually exclusive with parentPath)",
        },
        parentPath: {
          type: "string",
          description:
            "Parent folder path like '/Documents/Reports' (creates folders if needed, mutually exclusive with parentFolderId)",
        },
      },
      required: ["name", "content"],
    },
    outputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Created document ID" },
        name: { type: "string", description: "Created document name" },
        webViewLink: {
          type: "string",
          description: "Link to view the document",
        },
      },
    },
  },
  {
    name: "update_google_doc",
    description: "Replace content in a Google Doc",
    inputSchema: {
      type: "object",
      properties: {
        documentId: { type: "string", description: "Doc ID" },
        content: { type: "string", description: "New content" },
      },
      required: ["documentId", "content"],
    },
    outputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Document title" },
        updated: {
          type: "boolean",
          description: "Whether the update succeeded",
        },
      },
    },
  },
  {
    name: "get_google_doc_content",
    description: "Read content from a Google Doc",
    inputSchema: {
      type: "object",
      properties: {
        documentId: { type: "string", description: "Document ID" },
      },
      required: ["documentId"],
    },
    outputSchema: {
      type: "object",
      properties: {
        documentId: { type: "string", description: "Document ID" },
        title: { type: "string", description: "Document title" },
        content: {
          type: "array",
          description: "Document content segments with indices",
          items: {
            type: "object",
            properties: {
              startIndex: {
                type: "number",
                description: "Start character index",
              },
              endIndex: { type: "number", description: "End character index" },
              text: { type: "string", description: "Text content" },
            },
          },
        },
        totalLength: { type: "number", description: "Total character count" },
      },
    },
  },
  {
    name: "append_to_doc",
    description: "Append text to the end of a Google Doc",
    inputSchema: {
      type: "object",
      properties: {
        documentId: { type: "string", description: "Document ID" },
        text: { type: "string", description: "Text to append" },
        insertNewline: {
          type: "boolean",
          description: "Insert newline before text (default: true)",
        },
      },
      required: ["documentId", "text"],
    },
    outputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Document title" },
        charactersAdded: {
          type: "number",
          description: "Number of characters added",
        },
      },
    },
  },
  {
    name: "insert_text_in_doc",
    description: "Insert text at a position in a Doc",
    inputSchema: {
      type: "object",
      properties: {
        documentId: { type: "string", description: "Document ID" },
        text: { type: "string", description: "Text to insert" },
        index: {
          type: "number",
          description:
            "Character index to insert at (1 = beginning of document content). Get indices from getGoogleDocContent.",
        },
      },
      required: ["documentId", "text", "index"],
    },
    outputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Document title" },
        index: { type: "number", description: "Index where text was inserted" },
        charactersInserted: {
          type: "number",
          description: "Number of characters inserted",
        },
      },
    },
  },
  {
    name: "delete_text_in_doc",
    description: "Delete text range from a Google Doc",
    inputSchema: {
      type: "object",
      properties: {
        documentId: { type: "string", description: "Document ID" },
        startIndex: {
          type: "number",
          description: "Start index of range to delete (inclusive, 1-based)",
        },
        endIndex: {
          type: "number",
          description: "End index of range to delete (exclusive, 1-based)",
        },
      },
      required: ["documentId", "startIndex", "endIndex"],
    },
    outputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Document title" },
        startIndex: { type: "number", description: "Start of deleted range" },
        endIndex: { type: "number", description: "End of deleted range" },
        charactersDeleted: {
          type: "number",
          description: "Number of characters deleted",
        },
      },
    },
  },
  {
    name: "replace_text_in_doc",
    description: "Find and replace text in a Doc",
    inputSchema: {
      type: "object",
      properties: {
        documentId: { type: "string", description: "Document ID" },
        searchText: { type: "string", description: "Text to search for" },
        replaceText: {
          type: "string",
          description: "Text to replace with (use empty string to delete)",
        },
        matchCase: {
          type: "boolean",
          description: "Match case (default: true)",
        },
      },
      required: ["documentId", "searchText", "replaceText"],
    },
    outputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Document title" },
        occurrencesChanged: {
          type: "number",
          description: "Number of occurrences replaced",
        },
      },
    },
  },
  {
    name: "format_google_doc_range",
    description: "Format text and paragraphs in a Doc",
    inputSchema: {
      type: "object",
      properties: {
        documentId: { type: "string", description: "Document ID" },
        startIndex: {
          type: "number",
          description: "Start index (1-based, optional - defaults to document start)",
        },
        endIndex: {
          type: "number",
          description: "End index (1-based, optional - defaults to document end)",
        },
        // Text formatting
        bold: { type: "boolean", description: "Make text bold" },
        italic: { type: "boolean", description: "Make text italic" },
        underline: { type: "boolean", description: "Underline text" },
        strikethrough: { type: "boolean", description: "Strikethrough text" },
        fontSize: { type: "number", description: "Font size in points" },
        fontFamily: { type: "string", description: "Font family name" },
        foregroundColor: {
          type: "object",
          description: "Text color (RGB values 0-1)",
          properties: {
            red: { type: "number" },
            green: { type: "number" },
            blue: { type: "number" },
          },
        },
        // Paragraph formatting
        alignment: {
          type: "string",
          description: "Text alignment",
          enum: ["START", "CENTER", "END", "JUSTIFIED"],
        },
        lineSpacing: { type: "number", description: "Line spacing multiplier" },
        spaceAbove: {
          type: "number",
          description: "Space above paragraph in points",
        },
        spaceBelow: {
          type: "number",
          description: "Space below paragraph in points",
        },
        namedStyleType: {
          type: "string",
          description: "Paragraph style",
          enum: [
            "NORMAL_TEXT",
            "TITLE",
            "SUBTITLE",
            "HEADING_1",
            "HEADING_2",
            "HEADING_3",
            "HEADING_4",
            "HEADING_5",
            "HEADING_6",
          ],
        },
      },
      required: ["documentId"],
    },
    outputSchema: {
      type: "object",
      properties: {
        startIndex: { type: "number", description: "Start of formatted range" },
        endIndex: { type: "number", description: "End of formatted range" },
        formatsApplied: {
          type: "array",
          items: { type: "string" },
          description: "List of formats applied",
        },
      },
    },
  },
];

// Sheets tools
export const sheetsTools: ToolDefinition[] = [
  {
    name: "create_google_sheet",
    description: "Create a new Google Sheet",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Sheet name" },
        data: {
          type: "array",
          description: "Data as array of arrays",
          items: { type: "array", items: { type: "string" } },
        },
        parentFolderId: {
          type: "string",
          description: "Parent folder ID (mutually exclusive with parentPath)",
        },
        parentPath: {
          type: "string",
          description:
            "Parent folder path like '/Data/Spreadsheets' (creates folders if needed, mutually exclusive with parentFolderId)",
        },
        valueInputOption: {
          type: "string",
          enum: ["RAW", "USER_ENTERED"],
          description:
            "RAW (default): Values stored exactly as provided - formulas stored as text strings. Safe for untrusted data. USER_ENTERED: Values parsed like spreadsheet UI - formulas (=SUM, =IF, etc.) are evaluated. SECURITY WARNING: USER_ENTERED can execute formulas, only use with trusted data, never with user-provided input that could contain malicious formulas like =IMPORTDATA() or =IMPORTRANGE().",
        },
      },
      required: ["name", "data"],
    },
    outputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Created spreadsheet ID" },
        name: { type: "string", description: "Created spreadsheet name" },
      },
    },
  },
  {
    name: "update_google_sheet",
    description: "Update a Google Sheet range",
    inputSchema: {
      type: "object",
      properties: {
        spreadsheetId: { type: "string", description: "Sheet ID" },
        range: {
          type: "string",
          description: "Range to update (e.g., 'Sheet1!A1:C10')",
        },
        data: {
          type: "array",
          description: "2D array of values to write",
          items: { type: "array", items: { type: "string" } },
        },
        valueInputOption: {
          type: "string",
          enum: ["RAW", "USER_ENTERED"],
          description:
            "RAW (default): Values stored exactly as provided - formulas stored as text strings. Safe for untrusted data. USER_ENTERED: Values parsed like spreadsheet UI - formulas (=SUM, =IF, etc.) are evaluated. SECURITY WARNING: USER_ENTERED can execute formulas, only use with trusted data, never with user-provided input that could contain malicious formulas like =IMPORTDATA() or =IMPORTRANGE().",
        },
      },
      required: ["spreadsheetId", "range", "data"],
    },
    outputSchema: {
      type: "object",
      properties: {
        range: { type: "string", description: "Range that was updated" },
        updated: {
          type: "boolean",
          description: "Whether the update succeeded",
        },
      },
    },
  },
  {
    name: "get_google_sheet_content",
    description: "Read content from a Google Sheet",
    inputSchema: {
      type: "object",
      properties: {
        spreadsheetId: { type: "string", description: "Spreadsheet ID" },
        range: {
          type: "string",
          description:
            "Range in A1 notation (e.g., 'Sheet1!A1:C10'). Optional - if omitted, returns all data from the first sheet.",
        },
      },
      required: ["spreadsheetId"],
    },
    outputSchema: {
      type: "object",
      properties: {
        spreadsheetId: { type: "string", description: "Spreadsheet ID" },
        range: { type: "string", description: "Range that was retrieved" },
        values: {
          type: "array",
          description: "2D array of cell values (rows x columns)",
          items: {
            type: "array",
            items: { type: "string", description: "Cell value" },
          },
        },
        rowCount: { type: "number", description: "Number of rows returned" },
        columnCount: {
          type: "number",
          description: "Number of columns returned",
        },
      },
    },
  },
  {
    name: "format_google_sheet_cells",
    description: "Format cells in a Google Sheet",
    inputSchema: {
      type: "object",
      properties: {
        spreadsheetId: { type: "string", description: "Spreadsheet ID" },
        range: {
          type: "string",
          description: "Range to format (e.g., 'Sheet1!A1:C10' or 'A1:C10')",
        },
        // Cell formatting
        backgroundColor: {
          type: "object",
          description: "Background color (RGB values 0-1)",
          properties: {
            red: { type: "number" },
            green: { type: "number" },
            blue: { type: "number" },
          },
        },
        horizontalAlignment: {
          type: "string",
          description: "Horizontal alignment",
          enum: ["LEFT", "CENTER", "RIGHT"],
        },
        verticalAlignment: {
          type: "string",
          description: "Vertical alignment",
          enum: ["TOP", "MIDDLE", "BOTTOM"],
        },
        wrapStrategy: {
          type: "string",
          description: "Text wrapping",
          enum: ["OVERFLOW_CELL", "CLIP", "WRAP"],
        },
        // Text formatting
        bold: { type: "boolean", description: "Make text bold" },
        italic: { type: "boolean", description: "Make text italic" },
        strikethrough: { type: "boolean", description: "Strikethrough text" },
        underline: { type: "boolean", description: "Underline text" },
        fontSize: { type: "number", description: "Font size in points" },
        fontFamily: { type: "string", description: "Font family name" },
        foregroundColor: {
          type: "object",
          description: "Text color (RGB values 0-1)",
          properties: {
            red: { type: "number" },
            green: { type: "number" },
            blue: { type: "number" },
          },
        },
        // Number formatting
        numberFormat: {
          type: "object",
          description: "Number format settings",
          properties: {
            pattern: {
              type: "string",
              description: "Format pattern (e.g., '#,##0.00', 'yyyy-mm-dd', '$#,##0.00', '0.00%')",
            },
            type: {
              type: "string",
              description: "Format type",
              enum: ["NUMBER", "CURRENCY", "PERCENT", "DATE", "TIME", "DATE_TIME", "SCIENTIFIC"],
            },
          },
        },
        // Border formatting
        borders: {
          type: "object",
          description: "Border settings",
          properties: {
            style: {
              type: "string",
              description: "Border style",
              enum: ["SOLID", "DASHED", "DOTTED", "DOUBLE"],
            },
            width: { type: "number", description: "Border width (1-3)" },
            color: {
              type: "object",
              description: "Border color (RGB values 0-1)",
              properties: {
                red: { type: "number" },
                green: { type: "number" },
                blue: { type: "number" },
              },
            },
            top: {
              type: "boolean",
              description: "Apply to top border (default: true)",
            },
            bottom: {
              type: "boolean",
              description: "Apply to bottom border (default: true)",
            },
            left: {
              type: "boolean",
              description: "Apply to left border (default: true)",
            },
            right: {
              type: "boolean",
              description: "Apply to right border (default: true)",
            },
            innerHorizontal: {
              type: "boolean",
              description: "Apply to inner horizontal borders",
            },
            innerVertical: {
              type: "boolean",
              description: "Apply to inner vertical borders",
            },
          },
        },
      },
      required: ["spreadsheetId", "range"],
    },
    outputSchema: {
      type: "object",
      properties: {
        range: { type: "string", description: "Range that was formatted" },
        applied: {
          type: "boolean",
          description: "Whether formatting was applied",
        },
      },
    },
  },
  {
    name: "merge_google_sheet_cells",
    description: "Merge cells in a Google Sheet",
    inputSchema: {
      type: "object",
      properties: {
        spreadsheetId: { type: "string", description: "Spreadsheet ID" },
        range: {
          type: "string",
          description: "Range to merge (e.g., 'A1:C3')",
        },
        mergeType: {
          type: "string",
          description: "Merge type",
          enum: ["MERGE_ALL", "MERGE_COLUMNS", "MERGE_ROWS"],
        },
      },
      required: ["spreadsheetId", "range", "mergeType"],
    },
    outputSchema: {
      type: "object",
      properties: {
        range: { type: "string", description: "Range that was merged" },
        mergeType: { type: "string", description: "Type of merge performed" },
      },
    },
  },
  {
    name: "add_google_sheet_conditional_format",
    description: "Add conditional formatting to a Sheet",
    inputSchema: {
      type: "object",
      properties: {
        spreadsheetId: { type: "string", description: "Spreadsheet ID" },
        range: {
          type: "string",
          description: "Range to apply formatting (e.g., 'A1:C10')",
        },
        condition: {
          type: "object",
          description: "Condition configuration",
          properties: {
            type: {
              type: "string",
              description: "Condition type",
              enum: [
                "NUMBER_GREATER",
                "NUMBER_LESS",
                "TEXT_CONTAINS",
                "TEXT_STARTS_WITH",
                "TEXT_ENDS_WITH",
                "CUSTOM_FORMULA",
              ],
            },
            value: {
              type: "string",
              description: "Value to compare or formula",
            },
          },
        },
        format: {
          type: "object",
          description: "Format to apply when condition is true",
          properties: {
            backgroundColor: {
              type: "object",
              properties: {
                red: { type: "number" },
                green: { type: "number" },
                blue: { type: "number" },
              },
            },
            textFormat: {
              type: "object",
              properties: {
                bold: { type: "boolean" },
                foregroundColor: {
                  type: "object",
                  properties: {
                    red: { type: "number" },
                    green: { type: "number" },
                    blue: { type: "number" },
                  },
                },
              },
            },
          },
        },
      },
      required: ["spreadsheetId", "range", "condition", "format"],
    },
    outputSchema: {
      type: "object",
      properties: {
        range: {
          type: "string",
          description: "Range where conditional format was applied",
        },
        conditionType: {
          type: "string",
          description: "Type of condition applied",
        },
      },
    },
  },
  {
    name: "sheet_tabs",
    description: "Manage tabs in a spreadsheet: list, create, delete, or rename",
    inputSchema: {
      type: "object",
      properties: {
        spreadsheetId: { type: "string", description: "Spreadsheet ID" },
        action: {
          type: "string",
          enum: ["list", "create", "delete", "rename"],
          description: "Action to perform",
        },
        title: { type: "string", description: "Tab title (required for create/delete)" },
        index: { type: "number", description: "(optional) Position for new tab (create only)" },
        currentTitle: { type: "string", description: "Current title (required for rename)" },
        newTitle: { type: "string", description: "New title (required for rename)" },
      },
      required: ["spreadsheetId", "action"],
    },
    outputSchema: {
      type: "object",
      properties: {
        action: { type: "string", description: "Action performed" },
        tabs: {
          type: "array",
          description: "List of tabs (for list action)",
          items: {
            type: "object",
            properties: {
              sheetId: { type: "number", description: "Sheet ID" },
              title: { type: "string", description: "Tab title" },
              index: { type: "number", description: "Tab position" },
            },
          },
        },
        sheetId: { type: "number", description: "Sheet ID (for create/delete/rename)" },
        title: { type: "string", description: "Tab title" },
      },
    },
  },
];

// Slides tools
export const slidesTools: ToolDefinition[] = [
  {
    name: "create_google_slides",
    description: "Create a new Google Slides presentation",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Presentation name" },
        slides: {
          type: "array",
          description: "Array of slide objects",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              content: { type: "string" },
            },
          },
        },
        parentFolderId: {
          type: "string",
          description: "Parent folder ID (mutually exclusive with parentPath)",
        },
        parentPath: {
          type: "string",
          description:
            "Parent folder path like '/Presentations/2024' (creates folders if needed, mutually exclusive with parentFolderId)",
        },
      },
      required: ["name", "slides"],
    },
    outputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Created presentation ID" },
        name: { type: "string", description: "Created presentation name" },
        webViewLink: {
          type: "string",
          description: "Link to view the presentation",
        },
      },
    },
  },
  {
    name: "update_google_slides",
    description: "Update a Google Slides presentation",
    inputSchema: {
      type: "object",
      properties: {
        presentationId: { type: "string", description: "Presentation ID" },
        slides: {
          type: "array",
          description: "Array of slide objects to replace existing slides",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              content: { type: "string" },
            },
          },
        },
      },
      required: ["presentationId", "slides"],
    },
    outputSchema: {
      type: "object",
      properties: {
        slideCount: {
          type: "number",
          description: "Number of slides after update",
        },
        webViewLink: {
          type: "string",
          description: "Link to view the presentation",
        },
      },
    },
  },
  {
    name: "get_google_slides_content",
    description: "Read content from Google Slides",
    inputSchema: {
      type: "object",
      properties: {
        presentationId: { type: "string", description: "Presentation ID" },
        slideIndex: {
          type: "number",
          description: "Specific slide index (optional)",
        },
      },
      required: ["presentationId"],
    },
    outputSchema: {
      type: "object",
      properties: {
        presentationId: { type: "string", description: "Presentation ID" },
        title: { type: "string", description: "Presentation title" },
        slideCount: { type: "number", description: "Total number of slides" },
        slides: {
          type: "array",
          description: "List of slides with their elements",
          items: {
            type: "object",
            properties: {
              index: { type: "number", description: "Slide index (0-based)" },
              objectId: { type: "string", description: "Slide object ID" },
              elements: {
                type: "array",
                description: "Elements on the slide",
                items: {
                  type: "object",
                  properties: {
                    objectId: {
                      type: "string",
                      description: "Element object ID",
                    },
                    type: {
                      type: "string",
                      description: "Element type",
                      enum: ["textBox", "shape", "image", "video", "table"],
                    },
                    text: {
                      type: "string",
                      description: "Text content (for text elements)",
                    },
                    shapeType: {
                      type: "string",
                      description: "Shape type (for shapes)",
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  {
    name: "format_slides_text",
    description: "Format text styling in Google Slides",
    inputSchema: {
      type: "object",
      properties: {
        presentationId: { type: "string", description: "Presentation ID" },
        objectId: { type: "string", description: "Text element object ID" },
        startIndex: { type: "number", description: "Start index (0-based, optional)" },
        endIndex: { type: "number", description: "End index (0-based, optional)" },
        bold: { type: "boolean", description: "Make text bold" },
        italic: { type: "boolean", description: "Make text italic" },
        underline: { type: "boolean", description: "Underline text" },
        strikethrough: { type: "boolean", description: "Strikethrough text" },
        fontSize: { type: "number", description: "Font size in points" },
        fontFamily: { type: "string", description: "Font family name" },
        foregroundColor: {
          type: "object",
          description: "Text color RGB (values 0-1)",
          properties: {
            red: { type: "number" },
            green: { type: "number" },
            blue: { type: "number" },
          },
        },
        alignment: {
          type: "string",
          description: "Text alignment",
          enum: ["START", "CENTER", "END", "JUSTIFIED"],
        },
        lineSpacing: { type: "number", description: "Line spacing multiplier" },
        bulletStyle: {
          type: "string",
          description: "Bullet style",
          enum: ["NONE", "DISC", "ARROW", "SQUARE", "DIAMOND", "STAR", "NUMBERED"],
        },
      },
      required: ["presentationId", "objectId"],
    },
    outputSchema: {
      type: "object",
      properties: {
        objectId: { type: "string", description: "Formatted text object ID" },
        formatsApplied: {
          type: "array",
          items: { type: "string" },
          description: "List of formats applied",
        },
      },
    },
  },
  {
    name: "format_slides_shape",
    description: "Format shape fill and outline in Google Slides",
    inputSchema: {
      type: "object",
      properties: {
        presentationId: { type: "string", description: "Presentation ID" },
        objectId: { type: "string", description: "Shape object ID" },
        backgroundColor: {
          type: "object",
          description: "Shape fill color RGBA (values 0-1)",
          properties: {
            red: { type: "number" },
            green: { type: "number" },
            blue: { type: "number" },
            alpha: { type: "number" },
          },
        },
        outlineColor: {
          type: "object",
          description: "Outline color RGB (values 0-1)",
          properties: {
            red: { type: "number" },
            green: { type: "number" },
            blue: { type: "number" },
          },
        },
        outlineWeight: { type: "number", description: "Outline thickness in points" },
        outlineDashStyle: {
          type: "string",
          description: "Outline dash style",
          enum: ["SOLID", "DOT", "DASH", "DASH_DOT", "LONG_DASH", "LONG_DASH_DOT"],
        },
      },
      required: ["presentationId", "objectId"],
    },
    outputSchema: {
      type: "object",
      properties: {
        objectId: { type: "string", description: "Formatted shape object ID" },
        formatsApplied: {
          type: "array",
          items: { type: "string" },
          description: "List of formats applied",
        },
      },
    },
  },
  {
    name: "format_slide_background",
    description: "Set slide background color in Google Slides",
    inputSchema: {
      type: "object",
      properties: {
        presentationId: { type: "string", description: "Presentation ID" },
        pageObjectIds: {
          type: "array",
          description: "Array of slide IDs to format",
          items: { type: "string" },
        },
        backgroundColor: {
          type: "object",
          description: "Background color RGBA (values 0-1)",
          properties: {
            red: { type: "number" },
            green: { type: "number" },
            blue: { type: "number" },
            alpha: { type: "number" },
          },
        },
      },
      required: ["presentationId", "pageObjectIds", "backgroundColor"],
    },
    outputSchema: {
      type: "object",
      properties: {
        slidesFormatted: { type: "number", description: "Number of slides formatted" },
      },
    },
  },
  {
    name: "create_google_slides_text_box",
    description: "Create a text box in Google Slides",
    inputSchema: {
      type: "object",
      properties: {
        presentationId: { type: "string", description: "Presentation ID" },
        pageObjectId: { type: "string", description: "Slide ID" },
        text: { type: "string", description: "Text content" },
        x: {
          type: "number",
          description: "X position in EMU (1 inch = 914400 EMU)",
        },
        y: { type: "number", description: "Y position in EMU" },
        width: { type: "number", description: "Width in EMU" },
        height: { type: "number", description: "Height in EMU" },
        fontSize: { type: "number", description: "Font size in points" },
        bold: { type: "boolean", description: "Make text bold" },
        italic: { type: "boolean", description: "Make text italic" },
      },
      required: ["presentationId", "pageObjectId", "text", "x", "y", "width", "height"],
    },
    outputSchema: {
      type: "object",
      properties: {
        objectId: { type: "string", description: "Created text box object ID" },
        pageObjectId: {
          type: "string",
          description: "Slide where text box was created",
        },
      },
    },
  },
  {
    name: "create_google_slides_shape",
    description: "Create a shape in Google Slides",
    inputSchema: {
      type: "object",
      properties: {
        presentationId: { type: "string", description: "Presentation ID" },
        pageObjectId: { type: "string", description: "Slide ID" },
        shapeType: {
          type: "string",
          description: "Shape type",
          enum: ["RECTANGLE", "ELLIPSE", "DIAMOND", "TRIANGLE", "STAR", "ROUND_RECTANGLE", "ARROW"],
        },
        x: {
          type: "number",
          description: "X position in EMU (1 inch = 914400 EMU)",
        },
        y: { type: "number", description: "Y position in EMU" },
        width: { type: "number", description: "Width in EMU" },
        height: { type: "number", description: "Height in EMU" },
        backgroundColor: {
          type: "object",
          description: "Fill color (RGBA values 0-1)",
          properties: {
            red: { type: "number" },
            green: { type: "number" },
            blue: { type: "number" },
            alpha: { type: "number" },
          },
        },
      },
      required: ["presentationId", "pageObjectId", "shapeType", "x", "y", "width", "height"],
    },
    outputSchema: {
      type: "object",
      properties: {
        objectId: { type: "string", description: "Created shape object ID" },
        pageObjectId: {
          type: "string",
          description: "Slide where shape was created",
        },
        shapeType: { type: "string", description: "Type of shape created" },
      },
    },
  },
  {
    name: "slides_speaker_notes",
    description: "Get or update speaker notes for a slide",
    inputSchema: {
      type: "object",
      properties: {
        presentationId: { type: "string", description: "Presentation ID" },
        slideIndex: { type: "number", description: "Slide index (0-based)" },
        action: {
          type: "string",
          enum: ["get", "update"],
          description: "Action to perform",
        },
        notes: { type: "string", description: "Notes content (required for update)" },
      },
      required: ["presentationId", "slideIndex", "action"],
    },
    outputSchema: {
      type: "object",
      properties: {
        action: { type: "string", description: "Action performed" },
        slideIndex: { type: "number", description: "Slide index" },
        notes: { type: "string", description: "Speaker notes content" },
        updated: { type: "boolean", description: "Whether notes were updated (for update action)" },
      },
    },
  },
  {
    name: "list_slide_pages",
    description: "List slides in a presentation",
    inputSchema: {
      type: "object",
      properties: {
        presentationId: { type: "string", description: "Presentation ID" },
      },
      required: ["presentationId"],
    },
    outputSchema: {
      type: "object",
      properties: {
        presentationId: { type: "string", description: "Presentation ID" },
        pages: {
          type: "array",
          description: "List of slide pages with metadata",
          items: {
            type: "object",
            properties: {
              objectId: {
                type: "string",
                description: "Page object ID (used for slide operations)",
              },
              index: {
                type: "number",
                description: "Slide position (0-indexed)",
              },
              pageType: {
                type: "string",
                description: "Page type: SLIDE, MASTER, or LAYOUT",
              },
              title: {
                type: "string",
                description: "Slide title if available",
              },
            },
          },
        },
      },
    },
  },
];

// Unified smart tools
export const unifiedTools: ToolDefinition[] = [
  {
    name: "create_file",
    description: "Create file (auto-detects type from name)",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description:
            "File name with extension (e.g., 'report.docx', 'data.xlsx', 'deck.pptx', 'notes.txt')",
        },
        content: {
          description:
            "File content: string for docs/text, 2D array for sheets, array of {title, content} for slides",
          oneOf: [
            {
              type: "string",
              description: "Text content for docs or text files",
            },
            {
              type: "array",
              description: "2D array for sheets",
              items: { type: "array", items: { type: "string" } },
            },
            {
              type: "array",
              description: "Slides array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  content: { type: "string" },
                },
                required: ["title", "content"],
              },
            },
          ],
        },
        parentFolderId: {
          type: "string",
          description: "Parent folder ID (mutually exclusive with parentPath)",
        },
        parentPath: {
          type: "string",
          description:
            "Parent folder path like '/Documents/Reports' (creates folders if needed, mutually exclusive with parentFolderId)",
        },
        type: {
          type: "string",
          description: "Optional explicit type override",
          enum: ["doc", "sheet", "slides", "text"],
        },
      },
      required: ["name", "content"],
    },
    outputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Created file ID" },
        name: { type: "string", description: "Created file name" },
        type: {
          type: "string",
          description: "File type (doc, sheet, slides, or text)",
        },
        mimeType: { type: "string", description: "Google MIME type" },
        webViewLink: { type: "string", description: "Link to view the file" },
      },
    },
  },
  {
    name: "update_file",
    description: "Update file (auto-detects type)",
    inputSchema: {
      type: "object",
      properties: {
        fileId: {
          type: "string",
          description: "File ID to update (mutually exclusive with filePath)",
        },
        filePath: {
          type: "string",
          description: "File path like '/Documents/report.docx' (mutually exclusive with fileId)",
        },
        content: {
          description: "New content: string for docs/text, 2D array for sheets",
          oneOf: [
            { type: "string", description: "Text content" },
            {
              type: "array",
              description: "2D array for sheets",
              items: { type: "array", items: { type: "string" } },
            },
          ],
        },
        range: {
          type: "string",
          description:
            "For sheets only: range to update (e.g., 'Sheet1!A1:C10'). Defaults to Sheet1!A1",
        },
      },
      required: ["content"],
    },
    outputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Updated file ID" },
        name: { type: "string", description: "File name" },
        type: { type: "string", description: "File type" },
        updated: { type: "boolean", description: "Whether update succeeded" },
      },
    },
  },
  {
    name: "get_file_content",
    description: "Get file content (auto-detects type)",
    inputSchema: {
      type: "object",
      properties: {
        fileId: {
          type: "string",
          description: "File ID to read (mutually exclusive with filePath)",
        },
        filePath: {
          type: "string",
          description: "File path like '/Documents/report.docx' (mutually exclusive with fileId)",
        },
        range: {
          type: "string",
          description:
            "For sheets only: range to read (e.g., 'Sheet1!A1:C10'). Defaults to all data",
        },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        fileId: { type: "string", description: "File ID" },
        name: { type: "string", description: "File name" },
        type: {
          type: "string",
          description: "File type (doc, sheet, slides, text, or binary)",
        },
        mimeType: { type: "string", description: "MIME type" },
        content: {
          description:
            "File content: string for docs/text, 2D array for sheets, slides array for presentations",
        },
        metadata: {
          type: "object",
          description: "Additional metadata",
          properties: {
            modifiedTime: { type: "string" },
            title: { type: "string" },
            size: { type: "string" },
            rowCount: { type: "number" },
            columnCount: { type: "number" },
            slideCount: { type: "number" },
          },
        },
      },
    },
  },
];

// Calendar tools
export const calendarTools: ToolDefinition[] = [
  {
    name: "list_calendars",
    description: "List all calendars accessible to the user",
    inputSchema: {
      type: "object",
      properties: {
        showHidden: {
          type: "boolean",
          description: "Include hidden calendars (default: false)",
        },
        showDeleted: {
          type: "boolean",
          description: "Include deleted calendars (default: false)",
        },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        calendars: {
          type: "array",
          description: "List of calendars",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "Calendar ID" },
              summary: { type: "string", description: "Calendar name" },
              description: { type: "string", description: "Calendar description" },
              primary: { type: "boolean", description: "Whether this is the primary calendar" },
              accessRole: {
                type: "string",
                description: "Access role (owner, writer, reader, freeBusyReader)",
              },
              timeZone: { type: "string", description: "Calendar timezone" },
            },
          },
        },
      },
    },
  },
  {
    name: "list_events",
    description: "List calendar events (max 2500 per request)",
    inputSchema: {
      type: "object",
      properties: {
        calendarId: {
          type: "string",
          description: "(optional, default: 'primary') Calendar ID",
        },
        timeMin: {
          type: "string",
          description:
            "(optional) Start of time range (RFC3339 timestamp, e.g., 2024-01-15T00:00:00Z)",
        },
        timeMax: {
          type: "string",
          description: "(optional) End of time range (RFC3339 timestamp)",
        },
        query: {
          type: "string",
          description: "(optional) Free text search terms to filter events",
        },
        maxResults: {
          type: "number",
          description: "(optional, default: 250) Maximum events to return (max 2500)",
        },
        pageToken: {
          type: "string",
          description: "(optional) Token for pagination",
        },
        singleEvents: {
          type: "boolean",
          description: "(optional, default: true) Expand recurring events into instances",
        },
        orderBy: {
          type: "string",
          enum: ["startTime", "updated"],
          description: "(optional) Sort order (startTime requires singleEvents=true)",
        },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        events: {
          type: "array",
          description: "List of events",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "Event ID" },
              summary: { type: "string", description: "Event title" },
              description: { type: "string", description: "Event description" },
              location: { type: "string", description: "Event location" },
              start: {
                type: "object",
                description: "Start time",
                properties: {
                  dateTime: { type: "string", description: "RFC3339 timestamp (timed events)" },
                  date: { type: "string", description: "YYYY-MM-DD (all-day events)" },
                  timeZone: { type: "string", description: "IANA timezone" },
                },
              },
              end: {
                type: "object",
                description: "End time",
                properties: {
                  dateTime: { type: "string", description: "RFC3339 timestamp (timed events)" },
                  date: { type: "string", description: "YYYY-MM-DD (all-day events)" },
                  timeZone: { type: "string", description: "IANA timezone" },
                },
              },
              status: { type: "string", description: "Event status" },
              htmlLink: { type: "string", description: "Link to event in Google Calendar" },
              hangoutLink: { type: "string", description: "Google Meet link if present" },
            },
          },
        },
        nextPageToken: {
          type: "string",
          description: "Token for fetching next page",
        },
      },
    },
  },
  {
    name: "get_event",
    description: "Get details of a calendar event",
    inputSchema: {
      type: "object",
      properties: {
        calendarId: {
          type: "string",
          description: "Calendar ID (defaults to 'primary')",
        },
        eventId: {
          type: "string",
          description: "Event ID",
        },
      },
      required: ["eventId"],
    },
    outputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Event ID" },
        summary: { type: "string", description: "Event title" },
        description: { type: "string", description: "Event description" },
        location: { type: "string", description: "Event location" },
        start: {
          type: "object",
          description: "Start time",
          properties: {
            dateTime: { type: "string", description: "RFC3339 timestamp (timed events)" },
            date: { type: "string", description: "YYYY-MM-DD (all-day events)" },
            timeZone: { type: "string", description: "IANA timezone" },
          },
        },
        end: {
          type: "object",
          description: "End time",
          properties: {
            dateTime: { type: "string", description: "RFC3339 timestamp (timed events)" },
            date: { type: "string", description: "YYYY-MM-DD (all-day events)" },
            timeZone: { type: "string", description: "IANA timezone" },
          },
        },
        status: { type: "string", description: "Event status" },
        htmlLink: { type: "string", description: "Link to event" },
        hangoutLink: { type: "string", description: "Google Meet link" },
        attendees: {
          type: "array",
          description: "Event attendees",
          items: {
            type: "object",
            properties: {
              email: { type: "string" },
              displayName: { type: "string" },
              responseStatus: { type: "string" },
            },
          },
        },
        organizer: {
          type: "object",
          description: "Event organizer",
          properties: {
            email: { type: "string", description: "Organizer email" },
            displayName: { type: "string", description: "Organizer name" },
            self: { type: "boolean", description: "Whether you are the organizer" },
          },
        },
        recurrence: {
          type: "array",
          description: "Recurrence rules (RRULE format)",
          items: { type: "string" },
        },
      },
    },
  },
  {
    name: "create_event",
    description: "Create a new calendar event",
    inputSchema: {
      type: "object",
      properties: {
        calendarId: {
          type: "string",
          description: "Calendar ID (defaults to 'primary')",
        },
        summary: {
          type: "string",
          description: "Event title",
        },
        description: {
          type: "string",
          description: "Event description",
        },
        location: {
          type: "string",
          description: "Event location",
        },
        start: {
          type: "object",
          description:
            "Start time. Use dateTime for timed events (RFC3339) or date for all-day (YYYY-MM-DD)",
          properties: {
            dateTime: {
              type: "string",
              description: "RFC3339 timestamp (e.g., 2024-01-15T09:00:00-05:00)",
            },
            date: { type: "string", description: "All-day date (YYYY-MM-DD)" },
            timeZone: { type: "string", description: "IANA timezone" },
          },
        },
        end: {
          type: "object",
          description: "End time (same format as start)",
          properties: {
            dateTime: { type: "string" },
            date: { type: "string" },
            timeZone: { type: "string" },
          },
        },
        attendees: {
          type: "array",
          description: "List of attendee email addresses",
          items: {
            type: "object",
            properties: {
              email: { type: "string" },
              displayName: { type: "string" },
              optional: { type: "boolean" },
            },
            required: ["email"],
          },
        },
        addGoogleMeet: {
          type: "boolean",
          description: "Add Google Meet video conference (default: false)",
        },
        reminders: {
          type: "array",
          description: "Custom reminders (overrides calendar defaults)",
          items: {
            type: "object",
            properties: {
              method: { type: "string", enum: ["email", "popup"] },
              minutes: { type: "number", description: "Minutes before event" },
            },
          },
        },
        colorId: {
          type: "string",
          description: "Event color ID (1-11)",
        },
        recurrence: {
          type: "array",
          description: "RRULE strings for recurring events",
          items: { type: "string" },
        },
        sendUpdates: {
          type: "string",
          enum: ["all", "externalOnly", "none"],
          description: "Who to send notifications to (default: all)",
        },
      },
      required: ["summary", "start", "end"],
    },
    outputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Created event ID" },
        summary: { type: "string", description: "Event title" },
        htmlLink: { type: "string", description: "Link to event" },
        hangoutLink: { type: "string", description: "Google Meet link if created" },
      },
    },
  },
  {
    name: "update_event",
    description: "Update an existing calendar event",
    inputSchema: {
      type: "object",
      properties: {
        calendarId: {
          type: "string",
          description: "Calendar ID (defaults to 'primary')",
        },
        eventId: {
          type: "string",
          description: "Event ID to update",
        },
        summary: { type: "string", description: "New event title" },
        description: { type: "string", description: "New description" },
        location: { type: "string", description: "New location" },
        start: {
          type: "object",
          description: "New start time",
          properties: {
            dateTime: { type: "string" },
            date: { type: "string" },
            timeZone: { type: "string" },
          },
        },
        end: {
          type: "object",
          description: "New end time",
          properties: {
            dateTime: { type: "string" },
            date: { type: "string" },
            timeZone: { type: "string" },
          },
        },
        attendees: {
          type: "array",
          description: "Replace attendee list",
          items: {
            type: "object",
            properties: {
              email: { type: "string" },
              displayName: { type: "string" },
              optional: { type: "boolean" },
            },
          },
        },
        addGoogleMeet: {
          type: "boolean",
          description: "Add Google Meet if not present",
        },
        reminders: {
          type: "array",
          description: "New custom reminders",
          items: {
            type: "object",
            properties: {
              method: { type: "string", enum: ["email", "popup"] },
              minutes: { type: "number" },
            },
          },
        },
        colorId: { type: "string", description: "New color ID (1-11)" },
        sendUpdates: {
          type: "string",
          enum: ["all", "externalOnly", "none"],
          description: "Who to notify of changes",
        },
      },
      required: ["eventId"],
    },
    outputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Updated event ID" },
        summary: { type: "string", description: "Event title" },
        htmlLink: { type: "string", description: "Link to event" },
        hangoutLink: { type: "string", description: "Google Meet link" },
      },
    },
  },
  {
    name: "delete_event",
    description: "Delete a calendar event",
    inputSchema: {
      type: "object",
      properties: {
        calendarId: {
          type: "string",
          description: "Calendar ID (defaults to 'primary')",
        },
        eventId: {
          type: "string",
          description: "Event ID to delete",
        },
        sendUpdates: {
          type: "string",
          enum: ["all", "externalOnly", "none"],
          description: "Who to send cancellation notices to (default: all)",
        },
      },
      required: ["eventId"],
    },
    outputSchema: {
      type: "object",
      properties: {
        deleted: { type: "number", description: "Number of events deleted" },
        eventId: { type: "string", description: "Deleted event ID" },
      },
    },
  },
  {
    name: "find_free_time",
    description: "Find free time slots across calendars (max 50 calendars)",
    inputSchema: {
      type: "object",
      properties: {
        calendarIds: {
          type: "array",
          description:
            "Calendar IDs to check (e.g., ['primary', 'user@example.com']). Max 50 calendars.",
          items: { type: "string" },
        },
        timeMin: {
          type: "string",
          description: "Start of search range (RFC3339 timestamp)",
        },
        timeMax: {
          type: "string",
          description: "End of search range (RFC3339 timestamp)",
        },
        duration: {
          type: "number",
          description: "Minimum free slot duration in minutes",
        },
        timeZone: {
          type: "string",
          description: "(optional, default: UTC) Timezone for results",
        },
      },
      required: ["calendarIds", "timeMin", "timeMax", "duration"],
    },
    outputSchema: {
      type: "object",
      properties: {
        freeSlots: {
          type: "array",
          description: "Available time slots",
          items: {
            type: "object",
            properties: {
              start: { type: "string", description: "Slot start (ISO 8601)" },
              end: { type: "string", description: "Slot end (ISO 8601)" },
              durationMinutes: { type: "number", description: "Slot duration in minutes" },
            },
          },
        },
        busyPeriods: {
          type: "array",
          description: "Busy periods found",
          items: {
            type: "object",
            properties: {
              start: { type: "string" },
              end: { type: "string" },
            },
          },
        },
      },
    },
  },
];

// Gmail tools
export const gmailTools: ToolDefinition[] = [
  // Core Email Operations
  {
    name: "send_email",
    description: "Send an email",
    inputSchema: {
      type: "object",
      properties: {
        to: {
          type: "array",
          items: { type: "string" },
          description: "Recipient email addresses",
        },
        subject: { type: "string", description: "Email subject" },
        body: { type: "string", description: "Plain text email body" },
        html: { type: "string", description: "HTML email body (optional)" },
        cc: {
          type: "array",
          items: { type: "string" },
          description: "CC recipients",
        },
        bcc: {
          type: "array",
          items: { type: "string" },
          description: "BCC recipients",
        },
        replyTo: { type: "string", description: "Reply-to address" },
        attachments: {
          type: "array",
          description: "File attachments",
          items: {
            type: "object",
            properties: {
              filename: { type: "string" },
              content: { type: "string", description: "Base64-encoded content" },
              mimeType: { type: "string" },
            },
            required: ["filename", "content"],
          },
        },
        threadId: { type: "string", description: "Thread ID to reply to" },
        inReplyTo: { type: "string", description: "Message-ID for threading" },
      },
      required: ["to", "subject", "body"],
    },
    outputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Sent message ID" },
        threadId: { type: "string", description: "Thread ID" },
        labelIds: { type: "array", items: { type: "string" } },
      },
    },
  },
  {
    name: "draft_email",
    description: "Create a draft email (can be completed later)",
    inputSchema: {
      type: "object",
      properties: {
        to: { type: "array", items: { type: "string" }, description: "Recipients" },
        subject: { type: "string", description: "Subject" },
        body: { type: "string", description: "Plain text body" },
        html: { type: "string", description: "HTML body" },
        cc: { type: "array", items: { type: "string" } },
        bcc: { type: "array", items: { type: "string" } },
        replyTo: { type: "string" },
        attachments: { type: "array" },
        threadId: { type: "string" },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Draft ID" },
        messageId: { type: "string", description: "Message ID" },
        threadId: { type: "string" },
      },
    },
  },
  {
    name: "read_email",
    description: "Read email content and metadata",
    inputSchema: {
      type: "object",
      properties: {
        messageId: { type: "string", description: "Email message ID" },
        format: {
          type: "string",
          enum: ["full", "metadata", "minimal", "raw"],
          description: "Response format (default: full)",
        },
        contentFormat: {
          type: "string",
          enum: ["full", "text", "headers"],
          description:
            "Content format: 'full' (default, includes HTML), 'text' (plain text only, smaller), 'headers' (metadata only, no body)",
        },
      },
      required: ["messageId"],
    },
    outputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        threadId: { type: "string" },
        labelIds: { type: "array", items: { type: "string" } },
        headers: {
          type: "object",
          description: "Email headers",
          properties: {
            from: { type: "string", description: "Sender email address" },
            to: { type: "string", description: "Recipient(s) email addresses" },
            cc: { type: "string", description: "CC recipients" },
            subject: { type: "string", description: "Email subject line" },
            date: { type: "string", description: "Send date (RFC 2822 format)" },
            messageId: { type: "string", description: "Email Message-ID header" },
          },
        },
        body: {
          type: "object",
          properties: {
            text: { type: "string" },
            html: { type: "string" },
          },
        },
        attachments: { type: "array" },
      },
    },
  },
  {
    name: "search_emails",
    description: "Search emails using Gmail query syntax (max 500 per request)",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Gmail search query" },
        maxResults: {
          type: "number",
          description: "(optional, default: 50) Maximum results (max 500)",
        },
        pageToken: { type: "string", description: "(optional) Pagination token" },
        labelIds: {
          type: "array",
          items: { type: "string" },
          description: "(optional) Filter by label IDs",
        },
        includeSpamTrash: {
          type: "boolean",
          description: "(optional, default: false) Include spam and trash",
        },
      },
      required: ["query"],
    },
    outputSchema: {
      type: "object",
      properties: {
        messages: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              threadId: { type: "string" },
              from: { type: "string" },
              subject: { type: "string" },
              date: { type: "string" },
              snippet: { type: "string" },
            },
          },
        },
        nextPageToken: { type: "string" },
        resultSizeEstimate: { type: "number" },
      },
    },
  },
  {
    name: "delete_email",
    description: "Delete emails permanently (max 1000 IDs per request)",
    inputSchema: {
      type: "object",
      properties: {
        messageId: {
          oneOf: [{ type: "string" }, { type: "array", items: { type: "string" }, maxItems: 1000 }],
          description: "Message ID or array of IDs (max 1000)",
        },
      },
      required: ["messageId"],
    },
    outputSchema: {
      type: "object",
      properties: {
        deleted: { type: "number", description: "Number of messages deleted" },
        messageIds: {
          type: "array",
          items: { type: "string" },
          description: "IDs of deleted messages",
        },
      },
    },
  },
  {
    name: "modify_email",
    description: "Add/remove labels on threads (max 1000 IDs per request)",
    inputSchema: {
      type: "object",
      properties: {
        threadId: {
          oneOf: [{ type: "string" }, { type: "array", items: { type: "string" }, maxItems: 1000 }],
          description: "Thread ID or array of IDs (max 1000)",
        },
        addLabelIds: {
          type: "array",
          items: { type: "string" },
          description: "(optional) Label IDs to add",
        },
        removeLabelIds: {
          type: "array",
          items: { type: "string" },
          description: "(optional) Label IDs to remove",
        },
      },
      required: ["threadId"],
    },
    outputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "First modified thread ID (for batch: first in list)" },
        messageCount: { type: "number", description: "Number of threads modified" },
        labelIds: {
          type: "array",
          items: { type: "string" },
          description: "Labels that were added",
        },
      },
    },
  },
  {
    name: "download_attachment",
    description: "Download an email attachment to disk",
    inputSchema: {
      type: "object",
      properties: {
        messageId: { type: "string", description: "Email message ID" },
        attachmentId: { type: "string", description: "Attachment ID from readEmail" },
        filename: { type: "string", description: "Save filename (optional)" },
        outputPath: { type: "string", description: "Output directory (optional)" },
      },
      required: ["messageId", "attachmentId"],
    },
    outputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Saved file path" },
        size: { type: "number", description: "File size in bytes" },
      },
    },
  },
  // Label Management
  {
    name: "update_label",
    description: "Update an existing Gmail label",
    inputSchema: {
      type: "object",
      properties: {
        labelId: { type: "string", description: "Label ID to update" },
        name: { type: "string", description: "(optional) New name" },
        messageListVisibility: {
          type: "string",
          enum: ["show", "hide"],
          description: "(optional) Show/hide in message list",
        },
        labelListVisibility: {
          type: "string",
          enum: ["labelShow", "labelShowIfUnread", "labelHide"],
          description: "(optional) Label list visibility",
        },
        backgroundColor: { type: "string", description: "(optional) Background color" },
        textColor: { type: "string", description: "(optional) Text color" },
      },
      required: ["labelId"],
    },
    outputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Label ID" },
        name: { type: "string", description: "Label name" },
        updated: { type: "boolean", description: "Whether the update succeeded" },
      },
    },
  },
  {
    name: "delete_label",
    description: "Delete a user-created label",
    inputSchema: {
      type: "object",
      properties: {
        labelId: { type: "string", description: "Label ID to delete" },
      },
      required: ["labelId"],
    },
    outputSchema: {
      type: "object",
      properties: {
        deleted: { type: "number", description: "Number of labels deleted" },
        labelId: { type: "string", description: "Deleted label ID" },
      },
    },
  },
  {
    name: "list_labels",
    description: "List all Gmail labels (system and user-created)",
    inputSchema: {
      type: "object",
      properties: {
        includeSystemLabels: {
          type: "boolean",
          description: "Include INBOX, SENT, etc. (default: true)",
        },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        labels: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              type: { type: "string" },
              messagesTotal: { type: "number" },
              messagesUnread: { type: "number" },
            },
          },
        },
      },
    },
  },
  {
    name: "get_or_create_label",
    description: "Get or create a Gmail label",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Label name" },
        messageListVisibility: { type: "string", enum: ["show", "hide"] },
        labelListVisibility: {
          type: "string",
          enum: ["labelShow", "labelShowIfUnread", "labelHide"],
        },
        backgroundColor: { type: "string" },
        textColor: { type: "string" },
      },
      required: ["name"],
    },
    outputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        created: { type: "boolean", description: "True if newly created" },
      },
    },
  },
  // Filter Management
  {
    name: "create_filter",
    description: "Create an email filter",
    inputSchema: {
      type: "object",
      properties: {
        // Direct mode
        criteria: {
          type: "object",
          description: "Filter criteria (direct mode)",
          properties: {
            from: { type: "string" },
            to: { type: "string" },
            subject: { type: "string" },
            query: { type: "string" },
            hasAttachment: { type: "boolean" },
            excludeChats: { type: "boolean" },
            size: { type: "number" },
            sizeComparison: { type: "string", enum: ["larger", "smaller"] },
          },
        },
        action: {
          type: "object",
          description: "Actions (direct mode)",
          properties: {
            addLabelIds: { type: "array", items: { type: "string" } },
            removeLabelIds: { type: "array", items: { type: "string" } },
            forward: { type: "string" },
          },
        },
        // Template mode
        template: {
          type: "string",
          enum: ["fromSender", "withSubject", "withAttachments", "largeEmails", "mailingList"],
          description: "Use pre-built template instead of criteria/action",
        },
        labelIds: {
          type: "array",
          items: { type: "string" },
          description: "Labels (template mode)",
        },
        archive: { type: "boolean", description: "Archive matching emails (template mode)" },
        email: { type: "string", description: "Email for fromSender/mailingList template" },
        subject: { type: "string", description: "Subject for withSubject template" },
        sizeBytes: { type: "number", description: "Size for largeEmails template" },
        listAddress: { type: "string", description: "List address for mailingList template" },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        template: { type: "string" },
        criteria: { type: "object" },
        action: { type: "object" },
      },
    },
  },
  {
    name: "list_filters",
    description: "List filters or get specific filter details",
    inputSchema: {
      type: "object",
      properties: {
        filterId: { type: "string", description: "Optional: get specific filter" },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        filters: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              criteria: { type: "object" },
              action: { type: "object" },
            },
          },
        },
      },
    },
  },
  {
    name: "delete_filter",
    description: "Delete an email filter",
    inputSchema: {
      type: "object",
      properties: {
        filterId: { type: "string", description: "Filter ID to delete" },
      },
      required: ["filterId"],
    },
    outputSchema: {
      type: "object",
      properties: {
        deleted: { type: "number", description: "Number of filters deleted" },
        filterId: { type: "string", description: "Deleted filter ID" },
      },
    },
  },
];

// Contacts tools
export const contactsTools: ToolDefinition[] = [
  {
    name: "list_contacts",
    description: "List contacts from Google Contacts (max 1000 per page)",
    inputSchema: {
      type: "object",
      properties: {
        pageSize: {
          type: "number",
          description: "(optional, default: 100) Number of contacts to return (max 1000)",
        },
        pageToken: {
          type: "string",
          description: "(optional) Token for pagination",
        },
        sortOrder: {
          type: "string",
          enum: [
            "LAST_MODIFIED_ASCENDING",
            "LAST_MODIFIED_DESCENDING",
            "FIRST_NAME_ASCENDING",
            "LAST_NAME_ASCENDING",
          ],
          description: "(optional) Sort order for results",
        },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        contacts: {
          type: "array",
          description: "List of contacts",
          items: {
            type: "object",
            properties: {
              resourceName: { type: "string", description: "Contact resource name" },
              names: { type: "array", description: "Contact names" },
              emailAddresses: { type: "array", description: "Email addresses" },
              phoneNumbers: { type: "array", description: "Phone numbers" },
              organizations: { type: "array", description: "Organizations" },
              addresses: { type: "array", description: "Physical addresses" },
            },
          },
        },
        nextPageToken: { type: "string", description: "Token for next page" },
        totalPeople: { type: "number", description: "Total number of contacts" },
      },
    },
  },
  {
    name: "get_contact",
    description: "Get a single contact by resource name",
    inputSchema: {
      type: "object",
      properties: {
        resourceName: {
          type: "string",
          description: "Contact resource name or ID (e.g., people/c1234567890 or c1234567890)",
        },
      },
      required: ["resourceName"],
    },
    outputSchema: {
      type: "object",
      properties: {
        resourceName: { type: "string", description: "Contact resource name" },
        etag: { type: "string", description: "Contact etag for updates" },
        names: { type: "array", description: "Contact names" },
        emailAddresses: { type: "array", description: "Email addresses" },
        phoneNumbers: { type: "array", description: "Phone numbers" },
        organizations: { type: "array", description: "Organizations" },
        addresses: { type: "array", description: "Physical addresses" },
      },
    },
  },
  {
    name: "search_contacts",
    description: "Search contacts by name, email, or phone number",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query (matches name, email, or phone)",
        },
        pageSize: {
          type: "number",
          description: "(optional, default: 10) Number of results to return (max 30)",
        },
      },
      required: ["query"],
    },
    outputSchema: {
      type: "object",
      properties: {
        contacts: {
          type: "array",
          description: "Matching contacts",
          items: {
            type: "object",
            properties: {
              resourceName: { type: "string", description: "Contact resource name" },
              names: { type: "array", description: "Contact names" },
              emailAddresses: { type: "array", description: "Email addresses" },
              phoneNumbers: { type: "array", description: "Phone numbers" },
              organizations: {
                type: "array",
                description: "Organizations",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    title: { type: "string" },
                    department: { type: "string" },
                  },
                },
              },
              addresses: {
                type: "array",
                description: "Physical addresses",
                items: {
                  type: "object",
                  properties: {
                    streetAddress: { type: "string" },
                    city: { type: "string" },
                    region: { type: "string" },
                    postalCode: { type: "string" },
                    country: { type: "string" },
                    type: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  {
    name: "create_contact",
    description: "Create a new contact",
    inputSchema: {
      type: "object",
      properties: {
        givenName: {
          type: "string",
          description: "Given name (first name)",
        },
        familyName: {
          type: "string",
          description: "(optional) Family name (last name)",
        },
        emailAddresses: {
          type: "array",
          description: "(optional) Email addresses",
          items: {
            type: "object",
            properties: {
              value: { type: "string", description: "Email address" },
              type: {
                type: "string",
                enum: ["home", "work", "other"],
                description: "Email type",
              },
            },
            required: ["value"],
          },
        },
        phoneNumbers: {
          type: "array",
          description: "(optional) Phone numbers",
          items: {
            type: "object",
            properties: {
              value: { type: "string", description: "Phone number" },
              type: {
                type: "string",
                enum: ["home", "work", "mobile", "other"],
                description: "Phone type",
              },
            },
            required: ["value"],
          },
        },
        organizations: {
          type: "array",
          description: "(optional) Organizations/companies",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Company name" },
              title: { type: "string", description: "Job title" },
              department: { type: "string", description: "Department" },
            },
          },
        },
        addresses: {
          type: "array",
          description: "(optional) Physical addresses",
          items: {
            type: "object",
            properties: {
              streetAddress: { type: "string", description: "Street address" },
              city: { type: "string", description: "City" },
              region: { type: "string", description: "State/Province" },
              postalCode: { type: "string", description: "Postal code" },
              country: { type: "string", description: "Country" },
              type: {
                type: "string",
                enum: ["home", "work", "other"],
                description: "Address type",
              },
            },
          },
        },
      },
      required: ["givenName"],
    },
    outputSchema: {
      type: "object",
      properties: {
        resourceName: { type: "string", description: "Created contact resource name" },
        names: { type: "array", description: "Contact names" },
        emailAddresses: { type: "array", description: "Email addresses" },
        phoneNumbers: { type: "array", description: "Phone numbers" },
      },
    },
  },
  {
    name: "update_contact",
    description: "Update an existing contact",
    inputSchema: {
      type: "object",
      properties: {
        resourceName: {
          type: "string",
          description: "Contact resource name or ID (e.g., people/c1234567890 or c1234567890)",
        },
        givenName: {
          type: "string",
          description: "(optional) Given name (first name)",
        },
        familyName: {
          type: "string",
          description: "(optional) Family name (last name)",
        },
        emailAddresses: {
          type: "array",
          description: "(optional) Email addresses (replaces existing)",
          items: {
            type: "object",
            properties: {
              value: { type: "string", description: "Email address" },
              type: {
                type: "string",
                enum: ["home", "work", "other"],
                description: "Email type",
              },
            },
            required: ["value"],
          },
        },
        phoneNumbers: {
          type: "array",
          description: "(optional) Phone numbers (replaces existing)",
          items: {
            type: "object",
            properties: {
              value: { type: "string", description: "Phone number" },
              type: {
                type: "string",
                enum: ["home", "work", "mobile", "other"],
                description: "Phone type",
              },
            },
            required: ["value"],
          },
        },
        organizations: {
          type: "array",
          description: "(optional) Organizations (replaces existing)",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Company name" },
              title: { type: "string", description: "Job title" },
              department: { type: "string", description: "Department" },
            },
          },
        },
        addresses: {
          type: "array",
          description: "(optional) Addresses (replaces existing)",
          items: {
            type: "object",
            properties: {
              streetAddress: { type: "string", description: "Street address" },
              city: { type: "string", description: "City" },
              region: { type: "string", description: "State/Province" },
              postalCode: { type: "string", description: "Postal code" },
              country: { type: "string", description: "Country" },
              type: {
                type: "string",
                enum: ["home", "work", "other"],
                description: "Address type",
              },
            },
          },
        },
      },
      required: ["resourceName"],
    },
    outputSchema: {
      type: "object",
      properties: {
        resourceName: { type: "string", description: "Updated contact resource name" },
        names: { type: "array", description: "Contact names" },
        emailAddresses: { type: "array", description: "Email addresses" },
        phoneNumbers: { type: "array", description: "Phone numbers" },
      },
    },
  },
  {
    name: "delete_contact",
    description: "Delete a contact",
    inputSchema: {
      type: "object",
      properties: {
        resourceName: {
          type: "string",
          description: "Contact resource name or ID (e.g., people/c1234567890 or c1234567890)",
        },
      },
      required: ["resourceName"],
    },
  },
];

import { isServiceEnabled, areUnifiedToolsEnabled, type ServiceName } from "../config/index.js";

/** Map of service names to their tool definitions */
export const SERVICE_TOOL_MAP: Record<ServiceName, ToolDefinition[]> = {
  drive: driveTools,
  docs: docsTools,
  sheets: sheetsTools,
  slides: slidesTools,
  calendar: calendarTools,
  gmail: gmailTools,
  contacts: contactsTools,
};

/** Discovery tool for listing available tools */
export const discoveryTools: ToolDefinition[] = [
  {
    name: "list_tools",
    description: "List available tools, optionally filtered by service or keyword",
    inputSchema: {
      type: "object",
      properties: {
        service: {
          type: "string",
          enum: ["drive", "docs", "sheets", "slides", "calendar", "gmail", "contacts", "unified"],
          description: "(optional) Filter by service name",
        },
        keyword: {
          type: "string",
          description: "(optional) Filter by keyword in tool name or description",
        },
        includeSchemas: {
          type: "boolean",
          description: "(optional, default: false) Include full input/output schemas in response",
        },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        tools: {
          type: "array",
          description: "List of matching tools",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Tool name" },
              description: { type: "string", description: "Tool description" },
              service: { type: "string", description: "Service the tool belongs to" },
              inputSchema: {
                type: "object",
                description: "Input schema (if includeSchemas=true)",
              },
              outputSchema: {
                type: "object",
                description: "Output schema (if includeSchemas=true)",
              },
            },
          },
        },
        totalCount: { type: "number", description: "Total number of matching tools" },
        services: {
          type: "array",
          items: { type: "string" },
          description: "Available services",
        },
      },
    },
  },
  {
    name: "get_status",
    description:
      "Get server health, authentication status, connected account, " +
      "and diagnostics with actionable recommendations.",
    inputSchema: {
      type: "object",
      properties: {},
    },
    outputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["ok", "warning", "error"],
          description: "Overall status",
        },
        version: { type: "string", description: "Server version" },
        uptime_seconds: { type: "number", description: "Server uptime in seconds" },
        timestamp: { type: "string", description: "ISO 8601 timestamp" },
        profile: {
          type: ["string", "null"],
          description: "Active named profile, or null if using default",
        },
        auth: {
          type: "object",
          description: "Authentication status",
          properties: {
            configured: {
              type: "boolean",
              description: "Whether OAuth credentials are configured",
            },
            token_status: {
              type: "string",
              enum: ["valid", "expired", "missing", "invalid"],
              description: "Token status",
            },
            token_expires_at: {
              type: "string",
              description: "ISO 8601 timestamp when token expires (null if not available)",
            },
            has_refresh_token: { type: "boolean", description: "Whether a refresh token exists" },
            scopes: {
              type: "array",
              items: { type: "string" },
              description: "OAuth scopes granted",
            },
          },
        },
        enabled_services: {
          type: "array",
          items: { type: "string" },
          description: "List of enabled Google Workspace services",
        },
        config_checks: {
          type: "array",
          description: "Configuration checks with fix steps",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Check name" },
              status: { type: "string", enum: ["ok", "warning", "error"] },
              message: { type: "string", description: "Status message" },
              fix: {
                type: "array",
                items: { type: "string" },
                description: "Fix steps if status is not ok",
              },
            },
          },
        },
        token_check: {
          type: "object",
          description: "Detailed token info",
          properties: {
            has_access_token: { type: "boolean" },
            has_refresh_token: { type: "boolean" },
            is_expired: { type: "boolean" },
            expires_at: { type: "string", description: "ISO 8601 timestamp or null" },
            scopes: { type: "array", items: { type: "string" } },
          },
        },
        last_error: {
          type: "object",
          description: "Last auth error, if any",
          properties: {
            code: { type: "string", description: "Error code" },
            reason: { type: "string", description: "Error reason" },
            fix: { type: "array", items: { type: "string" }, description: "Fix steps" },
          },
        },
        api_validation: {
          type: "object",
          description: "API validation result",
          properties: {
            success: { type: "boolean" },
            user_email: { type: "string", description: "Authenticated user email if successful" },
            error: { type: "string", description: "Error message if failed" },
          },
        },
        recommendations: {
          type: "array",
          description: "Actionable recommendations",
          items: { type: "string" },
        },
      },
    },
  },
];

/**
 * Get all tool definitions combined into a single array.
 * Filters by enabled services (GOOGLE_WORKSPACE_SERVICES env var).
 * If not set, all services are enabled (backward compatible).
 */
export function getAllTools(): ToolDefinition[] {
  const tools: ToolDefinition[] = [];

  // Always include discovery tools
  tools.push(...discoveryTools);

  for (const [service, serviceTools] of Object.entries(SERVICE_TOOL_MAP)) {
    if (isServiceEnabled(service as ServiceName)) {
      tools.push(...serviceTools);
    }
  }

  // Unified tools require drive+docs+sheets+slides to all be enabled
  if (areUnifiedToolsEnabled()) {
    tools.push(...unifiedTools);
  }

  return tools;
}
