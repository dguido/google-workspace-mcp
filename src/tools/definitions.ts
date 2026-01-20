/**
 * Tool definitions for the Google Drive MCP server.
 * Each tool definition includes name, description, inputSchema, and optionally outputSchema.
 */

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
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
    description: "Search and find files and folders in Google Drive by name, type, or content",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        pageSize: { type: "number", description: "Results per page (default 50, max 100)" },
        pageToken: { type: "string", description: "Token for next page of results" }
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
              modifiedTime: { type: "string", description: "Last modified timestamp" },
              size: { type: "string", description: "File size in bytes" }
            }
          }
        },
        nextPageToken: { type: "string", description: "Token for fetching next page, if more results exist" }
      }
    }
  },
  {
    name: "createTextFile",
    description: "Create a plain text (.txt) or markdown (.md) file in Google Drive",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "File name (.txt or .md)" },
        content: { type: "string", description: "File content" },
        parentFolderId: { type: "string", description: "Parent folder ID (mutually exclusive with parentPath)" },
        parentPath: { type: "string", description: "Parent folder path like '/Documents/Projects' (creates folders if needed, mutually exclusive with parentFolderId)" }
      },
      required: ["name", "content"]
    },
    outputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Created file ID" },
        name: { type: "string", description: "Created file name" }
      }
    }
  },
  {
    name: "updateTextFile",
    description: "Update content of a text or markdown file in Google Drive",
    inputSchema: {
      type: "object",
      properties: {
        fileId: { type: "string", description: "ID of the file to update" },
        content: { type: "string", description: "New file content" },
        name: { type: "string", description: "Optional new name (.txt or .md)" }
      },
      required: ["fileId", "content"]
    },
    outputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Updated file name" },
        modifiedTime: { type: "string", description: "Last modified timestamp (ISO 8601)" }
      }
    }
  },
  {
    name: "createFolder",
    description: "Create a new folder in Google Drive",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Folder name" },
        parent: { type: "string", description: "Parent folder ID (mutually exclusive with parentPath)" },
        parentPath: { type: "string", description: "Parent folder path like '/Documents/Projects' (creates folders if needed, mutually exclusive with parent)" }
      },
      required: ["name"]
    },
    outputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Created folder ID" },
        name: { type: "string", description: "Created folder name" }
      }
    }
  },
  {
    name: "listFolder",
    description: "List files and subfolders in a Google Drive folder (defaults to root)",
    inputSchema: {
      type: "object",
      properties: {
        folderId: { type: "string", description: "Folder ID" },
        pageSize: { type: "number", description: "Items to return (default 50, max 100)" },
        pageToken: { type: "string", description: "Token for next page" }
      }
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
              modifiedTime: { type: "string", description: "Last modified timestamp" },
              size: { type: "string", description: "File size in bytes (folders have no size)" }
            }
          }
        },
        nextPageToken: { type: "string", description: "Token for fetching next page, if more items exist" }
      }
    }
  },
  {
    name: "deleteItem",
    description: "Move a file or folder to trash (can be restored from Google Drive trash)",
    inputSchema: {
      type: "object",
      properties: {
        itemId: { type: "string", description: "ID of the item to delete" }
      },
      required: ["itemId"]
    },
    outputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Name of the trashed item" },
        success: { type: "boolean", description: "Whether the operation succeeded" }
      }
    }
  },
  {
    name: "renameItem",
    description: "Rename a file or folder in Google Drive by ID",
    inputSchema: {
      type: "object",
      properties: {
        itemId: { type: "string", description: "ID of the item to rename" },
        newName: { type: "string", description: "New name" }
      },
      required: ["itemId", "newName"]
    },
    outputSchema: {
      type: "object",
      properties: {
        oldName: { type: "string", description: "Previous name" },
        newName: { type: "string", description: "New name" }
      }
    }
  },
  {
    name: "moveItem",
    description: "Move a file or folder to a different Google Drive location",
    inputSchema: {
      type: "object",
      properties: {
        itemId: { type: "string", description: "ID of the item to move" },
        destinationFolderId: { type: "string", description: "Destination folder ID (mutually exclusive with destinationPath)" },
        destinationPath: { type: "string", description: "Destination folder path like '/Archive/2024' (creates folders if needed, mutually exclusive with destinationFolderId)" }
      },
      required: ["itemId"]
    },
    outputSchema: {
      type: "object",
      properties: {
        itemName: { type: "string", description: "Name of the moved item" },
        destinationName: { type: "string", description: "Destination folder name" }
      }
    }
  },
  {
    name: "copyFile",
    description: "Copy a file to a new Google Drive location with optional new name",
    inputSchema: {
      type: "object",
      properties: {
        sourceFileId: { type: "string", description: "ID of the file to copy" },
        destinationName: { type: "string", description: "Name for the copied file (defaults to 'Copy of <original>')" },
        destinationFolderId: { type: "string", description: "Destination folder ID (defaults to same folder as source)" }
      },
      required: ["sourceFileId"]
    },
    outputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "New file ID" },
        name: { type: "string", description: "New file name" },
        webViewLink: { type: "string", description: "Link to view the new file" }
      }
    }
  },
  {
    name: "getFileMetadata",
    description: "Get detailed metadata for a file or folder (size, owner, dates, etc.)",
    inputSchema: {
      type: "object",
      properties: {
        fileId: { type: "string", description: "ID of the file or folder" }
      },
      required: ["fileId"]
    },
    outputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "File ID" },
        name: { type: "string", description: "File name" },
        mimeType: { type: "string", description: "MIME type" },
        size: { type: "string", description: "File size in bytes" },
        createdTime: { type: "string", description: "Creation timestamp (ISO 8601)" },
        modifiedTime: { type: "string", description: "Last modified timestamp (ISO 8601)" },
        owners: {
          type: "array",
          description: "List of file owners",
          items: {
            type: "object",
            properties: {
              displayName: { type: "string" },
              emailAddress: { type: "string" }
            }
          }
        },
        shared: { type: "boolean", description: "Whether the file is shared" },
        starred: { type: "boolean", description: "Whether the file is starred" },
        description: { type: "string", description: "File description" },
        webViewLink: { type: "string", description: "Link to view file in browser" },
        parents: {
          type: "array",
          description: "IDs of parent folders",
          items: { type: "string" }
        }
      }
    }
  },
  {
    name: "exportFile",
    description: "Export a Google Doc/Sheet/Slides to PDF, DOCX, XLSX, PPTX, CSV, or other formats",
    inputSchema: {
      type: "object",
      properties: {
        fileId: { type: "string", description: "ID of the Google Doc, Sheet, or Slides to export" },
        format: {
          type: "string",
          description: "Export format: pdf, docx (Docs), xlsx/csv/tsv (Sheets), pptx (Slides)",
          enum: ["pdf", "docx", "xlsx", "pptx", "csv", "tsv", "odt", "ods", "odp"]
        },
        outputPath: { type: "string", description: "Optional directory path to save the file (returns base64 if not provided)" }
      },
      required: ["fileId", "format"]
    },
    outputSchema: {
      type: "object",
      properties: {
        fileName: { type: "string", description: "Original file name" },
        format: { type: "string", description: "Export format used" },
        outputPath: { type: "string", description: "Path where file was saved (if outputPath provided)" },
        size: { type: "number", description: "File size in bytes" },
        base64Content: { type: "string", description: "Base64-encoded content (if no outputPath)" }
      }
    }
  },
  // Sharing tools
  {
    name: "shareFile",
    description: "Share a file with a user, group, domain, or make public",
    inputSchema: {
      type: "object",
      properties: {
        fileId: { type: "string", description: "File ID to share" },
        role: {
          type: "string",
          enum: ["reader", "commenter", "writer", "organizer"],
          description: "Permission role"
        },
        type: {
          type: "string",
          enum: ["user", "group", "domain", "anyone"],
          description: "Permission type"
        },
        emailAddress: { type: "string", description: "Email (required for user/group)" },
        domain: { type: "string", description: "Domain (required for domain type)" },
        sendNotificationEmail: { type: "boolean", description: "Send notification email (default: true)" },
        emailMessage: { type: "string", description: "Custom message for notification" }
      },
      required: ["fileId", "role", "type"]
    },
    outputSchema: {
      type: "object",
      properties: {
        fileName: { type: "string", description: "Name of the shared file" },
        permissionId: { type: "string", description: "Created permission ID" },
        role: { type: "string", description: "Permission role granted" },
        target: { type: "string", description: "Who the file was shared with" }
      }
    }
  },
  {
    name: "getSharing",
    description: "Get sharing settings and permissions for a file",
    inputSchema: {
      type: "object",
      properties: {
        fileId: { type: "string", description: "File ID" }
      },
      required: ["fileId"]
    },
    outputSchema: {
      type: "object",
      properties: {
        fileName: { type: "string", description: "Name of the file" },
        webViewLink: { type: "string", description: "Link to view file in browser" },
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
                enum: ["owner", "organizer", "fileOrganizer", "writer", "commenter", "reader"]
              },
              type: {
                type: "string",
                description: "Permission type",
                enum: ["user", "group", "domain", "anyone"]
              },
              emailAddress: { type: "string", description: "Email address (for user/group)" },
              domain: { type: "string", description: "Domain (for domain type)" },
              displayName: { type: "string", description: "Display name of the user/group" }
            }
          }
        }
      }
    }
  },
  // Revision tools
  {
    name: "listRevisions",
    description: "List version history of a Google Drive file (binary files only, not Workspace files)",
    inputSchema: {
      type: "object",
      properties: {
        fileId: { type: "string", description: "File ID" },
        pageSize: { type: "number", description: "Max revisions to return (default 100, max 1000)" }
      },
      required: ["fileId"]
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
              modifiedTime: { type: "string", description: "When revision was created (ISO 8601)" },
              size: { type: "string", description: "Size of revision in bytes" },
              keepForever: { type: "boolean", description: "Whether revision is pinned" },
              lastModifyingUser: {
                type: "object",
                description: "User who created this revision",
                properties: {
                  displayName: { type: "string" },
                  emailAddress: { type: "string" }
                }
              }
            }
          }
        }
      }
    }
  },
  {
    name: "restoreRevision",
    description: "Restore a Google Drive file to a previous revision (binary files only)",
    inputSchema: {
      type: "object",
      properties: {
        fileId: { type: "string", description: "File ID" },
        revisionId: { type: "string", description: "Revision ID to restore" }
      },
      required: ["fileId", "revisionId"]
    },
    outputSchema: {
      type: "object",
      properties: {
        fileName: { type: "string", description: "Name of the restored file" },
        revisionId: { type: "string", description: "Revision that was restored" }
      }
    }
  },
  // Binary file tools
  {
    name: "downloadFile",
    description: "Download a Google Drive file (images, PDFs, etc.) as base64 or to disk. For Workspace files, use exportFile",
    inputSchema: {
      type: "object",
      properties: {
        fileId: { type: "string", description: "File ID" },
        outputPath: { type: "string", description: "Directory to save file (optional, returns base64 if not provided)" }
      },
      required: ["fileId"]
    },
    outputSchema: {
      type: "object",
      properties: {
        fileName: { type: "string", description: "Name of the downloaded file" },
        mimeType: { type: "string", description: "MIME type of the file" },
        size: { type: "number", description: "File size in bytes" },
        outputPath: { type: "string", description: "Path where file was saved (if outputPath provided)" },
        base64Content: { type: "string", description: "Base64-encoded content (if no outputPath)" }
      }
    }
  },
  {
    name: "uploadFile",
    description: "Upload a file to Google Drive from disk or base64 content",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "File name with extension" },
        sourcePath: { type: "string", description: "Path to source file" },
        base64Content: { type: "string", description: "Base64-encoded content" },
        mimeType: { type: "string", description: "MIME type (auto-detected from extension if omitted)" },
        folderId: { type: "string", description: "Destination folder ID (mutually exclusive with folderPath)" },
        folderPath: { type: "string", description: "Destination folder path like '/Documents/Uploads' (creates folders if needed, mutually exclusive with folderId)" }
      },
      required: ["name"]
    },
    outputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Uploaded file ID" },
        name: { type: "string", description: "Uploaded file name" },
        webViewLink: { type: "string", description: "Link to view the file" }
      }
    }
  },
  // Metadata tools
  {
    name: "getStorageQuota",
    description: "Get Google Drive storage quota and usage",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    },
    outputSchema: {
      type: "object",
      properties: {
        user: {
          type: "object",
          description: "User information",
          properties: {
            displayName: { type: "string" },
            emailAddress: { type: "string" }
          }
        },
        storageQuota: {
          type: "object",
          description: "Storage quota details",
          properties: {
            limit: { type: "string", description: "Total storage limit in bytes (null if unlimited)" },
            usage: { type: "string", description: "Total bytes used" },
            usageInDrive: { type: "string", description: "Bytes used in Drive" },
            usageInDriveTrash: { type: "string", description: "Bytes used in Drive trash" }
          }
        }
      }
    }
  },
  {
    name: "starFile",
    description: "Star or unstar a file in Google Drive",
    inputSchema: {
      type: "object",
      properties: {
        fileId: { type: "string", description: "File ID" },
        starred: { type: "boolean", description: "true to star, false to unstar" }
      },
      required: ["fileId", "starred"]
    },
    outputSchema: {
      type: "object",
      properties: {
        fileName: { type: "string", description: "Name of the file" },
        starred: { type: "boolean", description: "New starred status" }
      }
    }
  },
  // File path resolution
  {
    name: "resolveFilePath",
    description: "Resolve a file path like 'Documents/Projects/Budget.xlsx' to a file ID. Returns the file ID and metadata. Use this before operations when you have a path but need an ID.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path to resolve (e.g., 'Documents/Projects/Budget.xlsx' or '/My Folder/report.pdf')" },
        type: {
          type: "string",
          description: "Type of item to find: 'file', 'folder', or 'any' (default)",
          enum: ["file", "folder", "any"]
        }
      },
      required: ["path"]
    },
    outputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "File ID" },
        name: { type: "string", description: "File name" },
        path: { type: "string", description: "Full resolved path" },
        mimeType: { type: "string", description: "MIME type" },
        modifiedTime: { type: "string", description: "Last modified timestamp" }
      }
    }
  },
  // Batch operations
  {
    name: "batchDelete",
    description: "Move multiple files to trash in a single operation. More efficient than calling deleteItem multiple times.",
    inputSchema: {
      type: "object",
      properties: {
        fileIds: {
          type: "array",
          description: "Array of file IDs to delete (max 100)",
          items: { type: "string" }
        }
      },
      required: ["fileIds"]
    },
    outputSchema: {
      type: "object",
      properties: {
        deleted: {
          type: "array",
          description: "Successfully deleted files",
          items: {
            type: "object",
            properties: {
              fileId: { type: "string" },
              name: { type: "string" }
            }
          }
        },
        failed: {
          type: "array",
          description: "Files that failed to delete",
          items: {
            type: "object",
            properties: {
              fileId: { type: "string" },
              error: { type: "string" }
            }
          }
        }
      }
    }
  },
  {
    name: "batchMove",
    description: "Move multiple files to a folder in a single operation. More efficient than calling moveItem multiple times.",
    inputSchema: {
      type: "object",
      properties: {
        fileIds: {
          type: "array",
          description: "Array of file IDs to move (max 100)",
          items: { type: "string" }
        },
        destinationFolderId: { type: "string", description: "Destination folder ID (mutually exclusive with destinationPath)" },
        destinationPath: { type: "string", description: "Destination folder path like '/Archive/2024' (creates folders if needed, mutually exclusive with destinationFolderId)" }
      },
      required: ["fileIds"]
    },
    outputSchema: {
      type: "object",
      properties: {
        moved: {
          type: "array",
          description: "Successfully moved files",
          items: {
            type: "object",
            properties: {
              fileId: { type: "string" },
              name: { type: "string" }
            }
          }
        },
        failed: {
          type: "array",
          description: "Files that failed to move",
          items: {
            type: "object",
            properties: {
              fileId: { type: "string" },
              error: { type: "string" }
            }
          }
        },
        destinationFolder: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" }
          }
        }
      }
    }
  },
  {
    name: "batchShare",
    description: "Share multiple files with a user in a single operation. More efficient than calling shareFile multiple times.",
    inputSchema: {
      type: "object",
      properties: {
        fileIds: {
          type: "array",
          description: "Array of file IDs to share (max 100)",
          items: { type: "string" }
        },
        email: { type: "string", description: "Email address to share with" },
        role: {
          type: "string",
          description: "Permission role",
          enum: ["reader", "writer", "commenter"]
        },
        sendNotification: { type: "boolean", description: "Send email notification (default: true)" }
      },
      required: ["fileIds", "email", "role"]
    },
    outputSchema: {
      type: "object",
      properties: {
        shared: {
          type: "array",
          description: "Successfully shared files",
          items: {
            type: "object",
            properties: {
              fileId: { type: "string" },
              name: { type: "string" }
            }
          }
        },
        failed: {
          type: "array",
          description: "Files that failed to share",
          items: {
            type: "object",
            properties: {
              fileId: { type: "string" },
              error: { type: "string" }
            }
          }
        },
        shareDetails: {
          type: "object",
          properties: {
            email: { type: "string" },
            role: { type: "string" }
          }
        }
      }
    }
  },
  // Permission management
  {
    name: "removePermission",
    description: "Remove sharing permission from a file. Can specify either permissionId or email address.",
    inputSchema: {
      type: "object",
      properties: {
        fileId: { type: "string", description: "File ID" },
        permissionId: { type: "string", description: "Permission ID (from getSharing)" },
        email: { type: "string", description: "Email address to remove (alternative to permissionId)" }
      },
      required: ["fileId"]
    },
    outputSchema: {
      type: "object",
      properties: {
        fileName: { type: "string", description: "Name of the file" },
        removedTarget: { type: "string", description: "Email or permission ID that was removed" }
      }
    }
  },
  // Trash management
  {
    name: "listTrash",
    description: "List files in the trash. Use restoreFromTrash to recover files or emptyTrash to permanently delete all.",
    inputSchema: {
      type: "object",
      properties: {
        pageSize: { type: "number", description: "Items per page (default 50, max 100)" },
        pageToken: { type: "string", description: "Token for next page" }
      }
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
              trashedTime: { type: "string" }
            }
          }
        },
        nextPageToken: { type: "string", description: "Token for next page" }
      }
    }
  },
  {
    name: "restoreFromTrash",
    description: "Restore a file from trash back to its original location.",
    inputSchema: {
      type: "object",
      properties: {
        fileId: { type: "string", description: "File ID to restore" }
      },
      required: ["fileId"]
    },
    outputSchema: {
      type: "object",
      properties: {
        fileName: { type: "string", description: "Name of the restored file" },
        restored: { type: "boolean", description: "Whether the file was restored" }
      }
    }
  },
  {
    name: "emptyTrash",
    description: "Permanently delete all files in trash. This action cannot be undone. Use driveId for shared drives.",
    inputSchema: {
      type: "object",
      properties: {
        confirm: { type: "boolean", description: "Must be true to confirm permanent deletion" },
        driveId: { type: "string", description: "Optional shared drive ID. If provided, empties trash of that shared drive instead of personal drive." }
      },
      required: ["confirm"]
    },
    outputSchema: {
      type: "object",
      properties: {
        itemsDeleted: { type: "number", description: "Number of items permanently deleted" },
        driveId: { type: "string", description: "Shared drive ID if specified" }
      }
    }
  },
  {
    name: "getFolderTree",
    description: "Get a hierarchical tree view of a folder's contents. Useful for discovering folder structure without making multiple listFolder calls. Returns files and subfolders up to the specified depth.",
    inputSchema: {
      type: "object",
      properties: {
        folderId: { type: "string", description: "Folder ID to start from (defaults to root, mutually exclusive with folderPath)" },
        folderPath: { type: "string", description: "Folder path like '/Documents/Projects' (mutually exclusive with folderId)" },
        depth: { type: "number", description: "Maximum depth to traverse (1-5, default: 2). Higher values make more API calls." }
      },
      required: []
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
              children: { type: "array", description: "Children (for folders only)" }
            }
          }
        }
      }
    }
  }
];

// Docs tools
export const docsTools: ToolDefinition[] = [
  {
    name: "createGoogleDoc",
    description: "Create a new Google Document with optional initial text content",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Doc name" },
        content: { type: "string", description: "Doc content" },
        parentFolderId: { type: "string", description: "Parent folder ID (mutually exclusive with parentPath)" },
        parentPath: { type: "string", description: "Parent folder path like '/Documents/Reports' (creates folders if needed, mutually exclusive with parentFolderId)" }
      },
      required: ["name", "content"]
    },
    outputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Created document ID" },
        name: { type: "string", description: "Created document name" },
        webViewLink: { type: "string", description: "Link to view the document" }
      }
    }
  },
  {
    name: "updateGoogleDoc",
    description: "Replace or overwrite content in an existing Google Document",
    inputSchema: {
      type: "object",
      properties: {
        documentId: { type: "string", description: "Doc ID" },
        content: { type: "string", description: "New content" }
      },
      required: ["documentId", "content"]
    },
    outputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Document title" },
        updated: { type: "boolean", description: "Whether the update succeeded" }
      }
    }
  },
  {
    name: "getGoogleDocContent",
    description: "Read and retrieve text content from a Google Document including character positions for formatting",
    inputSchema: {
      type: "object",
      properties: {
        documentId: { type: "string", description: "Document ID" }
      },
      required: ["documentId"]
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
              startIndex: { type: "number", description: "Start character index" },
              endIndex: { type: "number", description: "End character index" },
              text: { type: "string", description: "Text content" }
            }
          }
        },
        totalLength: { type: "number", description: "Total character count" }
      }
    }
  },
  {
    name: "appendToDoc",
    description: "Append text to the end of a Google Doc",
    inputSchema: {
      type: "object",
      properties: {
        documentId: { type: "string", description: "Document ID" },
        text: { type: "string", description: "Text to append" },
        insertNewline: { type: "boolean", description: "Insert newline before text (default: true)" }
      },
      required: ["documentId", "text"]
    },
    outputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Document title" },
        charactersAdded: { type: "number", description: "Number of characters added" }
      }
    }
  },
  {
    name: "insertTextInDoc",
    description: "Insert text at a specific position in a Google Doc. Use getGoogleDocContent to find the correct index. Index 1 is the beginning of document content.",
    inputSchema: {
      type: "object",
      properties: {
        documentId: { type: "string", description: "Document ID" },
        text: { type: "string", description: "Text to insert" },
        index: { type: "number", description: "Character index to insert at (1 = beginning of document content). Get indices from getGoogleDocContent." }
      },
      required: ["documentId", "text", "index"]
    },
    outputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Document title" },
        index: { type: "number", description: "Index where text was inserted" },
        charactersInserted: { type: "number", description: "Number of characters inserted" }
      }
    }
  },
  {
    name: "deleteTextInDoc",
    description: "Delete text in a range from a Google Doc. Use getGoogleDocContent to find the correct indices.",
    inputSchema: {
      type: "object",
      properties: {
        documentId: { type: "string", description: "Document ID" },
        startIndex: { type: "number", description: "Start index of range to delete (inclusive, 1-based)" },
        endIndex: { type: "number", description: "End index of range to delete (exclusive, 1-based)" }
      },
      required: ["documentId", "startIndex", "endIndex"]
    },
    outputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Document title" },
        startIndex: { type: "number", description: "Start of deleted range" },
        endIndex: { type: "number", description: "End of deleted range" },
        charactersDeleted: { type: "number", description: "Number of characters deleted" }
      }
    }
  },
  {
    name: "replaceTextInDoc",
    description: "Find and replace all occurrences of text in a Google Doc",
    inputSchema: {
      type: "object",
      properties: {
        documentId: { type: "string", description: "Document ID" },
        searchText: { type: "string", description: "Text to search for" },
        replaceText: { type: "string", description: "Text to replace with (use empty string to delete)" },
        matchCase: { type: "boolean", description: "Match case (default: true)" }
      },
      required: ["documentId", "searchText", "replaceText"]
    },
    outputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Document title" },
        occurrencesChanged: { type: "number", description: "Number of occurrences replaced" }
      }
    }
  },
  {
    name: "formatGoogleDocRange",
    description: "Unified formatting tool for Google Docs. Apply text styling (bold, italic, font, color) and paragraph formatting (alignment, spacing, headings) in a single call. If no range is specified, applies to entire document.",
    inputSchema: {
      type: "object",
      properties: {
        documentId: { type: "string", description: "Document ID" },
        startIndex: { type: "number", description: "Start index (1-based, optional - defaults to document start)" },
        endIndex: { type: "number", description: "End index (1-based, optional - defaults to document end)" },
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
            blue: { type: "number" }
          }
        },
        // Paragraph formatting
        alignment: {
          type: "string",
          description: "Text alignment",
          enum: ["START", "CENTER", "END", "JUSTIFIED"]
        },
        lineSpacing: { type: "number", description: "Line spacing multiplier" },
        spaceAbove: { type: "number", description: "Space above paragraph in points" },
        spaceBelow: { type: "number", description: "Space below paragraph in points" },
        namedStyleType: {
          type: "string",
          description: "Paragraph style",
          enum: ["NORMAL_TEXT", "TITLE", "SUBTITLE", "HEADING_1", "HEADING_2", "HEADING_3", "HEADING_4", "HEADING_5", "HEADING_6"]
        }
      },
      required: ["documentId"]
    },
    outputSchema: {
      type: "object",
      properties: {
        startIndex: { type: "number", description: "Start of formatted range" },
        endIndex: { type: "number", description: "End of formatted range" },
        formatsApplied: {
          type: "array",
          items: { type: "string" },
          description: "List of formats applied"
        }
      }
    }
  }
];

// Sheets tools
export const sheetsTools: ToolDefinition[] = [
  {
    name: "createGoogleSheet",
    description: "Create a new Google Sheet. By default uses RAW mode which stores values as-is. Set valueInputOption to 'USER_ENTERED' only when you need formulas to be evaluated.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Sheet name" },
        data: {
          type: "array",
          description: "Data as array of arrays",
          items: { type: "array", items: { type: "string" } }
        },
        parentFolderId: { type: "string", description: "Parent folder ID (mutually exclusive with parentPath)" },
        parentPath: { type: "string", description: "Parent folder path like '/Data/Spreadsheets' (creates folders if needed, mutually exclusive with parentFolderId)" },
        valueInputOption: {
          type: "string",
          enum: ["RAW", "USER_ENTERED"],
          description: "RAW (default): Values stored exactly as provided - formulas stored as text strings. Safe for untrusted data. USER_ENTERED: Values parsed like spreadsheet UI - formulas (=SUM, =IF, etc.) are evaluated. SECURITY WARNING: USER_ENTERED can execute formulas, only use with trusted data, never with user-provided input that could contain malicious formulas like =IMPORTDATA() or =IMPORTRANGE()."
        }
      },
      required: ["name", "data"]
    },
    outputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Created spreadsheet ID" },
        name: { type: "string", description: "Created spreadsheet name" }
      }
    }
  },
  {
    name: "updateGoogleSheet",
    description: "Update an existing Google Sheet. By default uses RAW mode which stores values as-is. Set valueInputOption to 'USER_ENTERED' only when you need formulas to be evaluated.",
    inputSchema: {
      type: "object",
      properties: {
        spreadsheetId: { type: "string", description: "Sheet ID" },
        range: { type: "string", description: "Range to update (e.g., 'Sheet1!A1:C10')" },
        data: {
          type: "array",
          description: "2D array of values to write",
          items: { type: "array", items: { type: "string" } }
        },
        valueInputOption: {
          type: "string",
          enum: ["RAW", "USER_ENTERED"],
          description: "RAW (default): Values stored exactly as provided - formulas stored as text strings. Safe for untrusted data. USER_ENTERED: Values parsed like spreadsheet UI - formulas (=SUM, =IF, etc.) are evaluated. SECURITY WARNING: USER_ENTERED can execute formulas, only use with trusted data, never with user-provided input that could contain malicious formulas like =IMPORTDATA() or =IMPORTRANGE()."
        }
      },
      required: ["spreadsheetId", "range", "data"]
    },
    outputSchema: {
      type: "object",
      properties: {
        range: { type: "string", description: "Range that was updated" },
        updated: { type: "boolean", description: "Whether the update succeeded" }
      }
    }
  },
  {
    name: "getGoogleSheetContent",
    description: "Get content of a Google Sheet with cell information",
    inputSchema: {
      type: "object",
      properties: {
        spreadsheetId: { type: "string", description: "Spreadsheet ID" },
        range: { type: "string", description: "Range to get (e.g., 'Sheet1!A1:C10')" }
      },
      required: ["spreadsheetId", "range"]
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
            items: { type: "string", description: "Cell value" }
          }
        },
        rowCount: { type: "number", description: "Number of rows returned" },
        columnCount: { type: "number", description: "Number of columns returned" }
      }
    }
  },
  {
    name: "formatGoogleSheetCells",
    description: "Format cells in a Google Sheet. Combines all formatting in a single call: background color, alignment, text styling (bold/italic/font), number formatting, and borders.",
    inputSchema: {
      type: "object",
      properties: {
        spreadsheetId: { type: "string", description: "Spreadsheet ID" },
        range: { type: "string", description: "Range to format (e.g., 'Sheet1!A1:C10' or 'A1:C10')" },
        // Cell formatting
        backgroundColor: {
          type: "object",
          description: "Background color (RGB values 0-1)",
          properties: {
            red: { type: "number" },
            green: { type: "number" },
            blue: { type: "number" }
          }
        },
        horizontalAlignment: {
          type: "string",
          description: "Horizontal alignment",
          enum: ["LEFT", "CENTER", "RIGHT"]
        },
        verticalAlignment: {
          type: "string",
          description: "Vertical alignment",
          enum: ["TOP", "MIDDLE", "BOTTOM"]
        },
        wrapStrategy: {
          type: "string",
          description: "Text wrapping",
          enum: ["OVERFLOW_CELL", "CLIP", "WRAP"]
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
            blue: { type: "number" }
          }
        },
        // Number formatting
        numberFormat: {
          type: "object",
          description: "Number format settings",
          properties: {
            pattern: { type: "string", description: "Format pattern (e.g., '#,##0.00', 'yyyy-mm-dd', '$#,##0.00', '0.00%')" },
            type: {
              type: "string",
              description: "Format type",
              enum: ["NUMBER", "CURRENCY", "PERCENT", "DATE", "TIME", "DATE_TIME", "SCIENTIFIC"]
            }
          }
        },
        // Border formatting
        borders: {
          type: "object",
          description: "Border settings",
          properties: {
            style: {
              type: "string",
              description: "Border style",
              enum: ["SOLID", "DASHED", "DOTTED", "DOUBLE"]
            },
            width: { type: "number", description: "Border width (1-3)" },
            color: {
              type: "object",
              description: "Border color (RGB values 0-1)",
              properties: {
                red: { type: "number" },
                green: { type: "number" },
                blue: { type: "number" }
              }
            },
            top: { type: "boolean", description: "Apply to top border (default: true)" },
            bottom: { type: "boolean", description: "Apply to bottom border (default: true)" },
            left: { type: "boolean", description: "Apply to left border (default: true)" },
            right: { type: "boolean", description: "Apply to right border (default: true)" },
            innerHorizontal: { type: "boolean", description: "Apply to inner horizontal borders" },
            innerVertical: { type: "boolean", description: "Apply to inner vertical borders" }
          }
        }
      },
      required: ["spreadsheetId", "range"]
    },
    outputSchema: {
      type: "object",
      properties: {
        range: { type: "string", description: "Range that was formatted" },
        applied: { type: "boolean", description: "Whether formatting was applied" }
      }
    }
  },
  {
    name: "mergeGoogleSheetCells",
    description: "Merge cells in a Google Sheet",
    inputSchema: {
      type: "object",
      properties: {
        spreadsheetId: { type: "string", description: "Spreadsheet ID" },
        range: { type: "string", description: "Range to merge (e.g., 'A1:C3')" },
        mergeType: {
          type: "string",
          description: "Merge type",
          enum: ["MERGE_ALL", "MERGE_COLUMNS", "MERGE_ROWS"]
        }
      },
      required: ["spreadsheetId", "range", "mergeType"]
    },
    outputSchema: {
      type: "object",
      properties: {
        range: { type: "string", description: "Range that was merged" },
        mergeType: { type: "string", description: "Type of merge performed" }
      }
    }
  },
  {
    name: "addGoogleSheetConditionalFormat",
    description: "Add conditional formatting to a Google Sheet",
    inputSchema: {
      type: "object",
      properties: {
        spreadsheetId: { type: "string", description: "Spreadsheet ID" },
        range: { type: "string", description: "Range to apply formatting (e.g., 'A1:C10')" },
        condition: {
          type: "object",
          description: "Condition configuration",
          properties: {
            type: {
              type: "string",
              description: "Condition type",
              enum: ["NUMBER_GREATER", "NUMBER_LESS", "TEXT_CONTAINS", "TEXT_STARTS_WITH", "TEXT_ENDS_WITH", "CUSTOM_FORMULA"]
            },
            value: { type: "string", description: "Value to compare or formula" }
          }
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
                blue: { type: "number" }
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
                    blue: { type: "number" }
                  },
                }
              },
            }
          }
        }
      },
      required: ["spreadsheetId", "range", "condition", "format"]
    },
    outputSchema: {
      type: "object",
      properties: {
        range: { type: "string", description: "Range where conditional format was applied" },
        conditionType: { type: "string", description: "Type of condition applied" }
      }
    }
  },
  {
    name: "createSheetTab",
    description: "Create a new tab (sheet) in a Google Sheets spreadsheet",
    inputSchema: {
      type: "object",
      properties: {
        spreadsheetId: { type: "string", description: "Spreadsheet ID" },
        title: { type: "string", description: "Name for the new tab" },
        index: { type: "number", description: "Position for the new tab (0-based, optional)" }
      },
      required: ["spreadsheetId", "title"]
    },
    outputSchema: {
      type: "object",
      properties: {
        spreadsheetId: { type: "string", description: "Spreadsheet ID" },
        title: { type: "string", description: "Created tab name" },
        sheetId: { type: "number", description: "Created sheet ID" }
      }
    }
  },
  {
    name: "deleteSheetTab",
    description: "Delete a tab (sheet) from a Google Sheets spreadsheet",
    inputSchema: {
      type: "object",
      properties: {
        spreadsheetId: { type: "string", description: "Spreadsheet ID" },
        sheetTitle: { type: "string", description: "Name of the tab to delete" }
      },
      required: ["spreadsheetId", "sheetTitle"]
    },
    outputSchema: {
      type: "object",
      properties: {
        spreadsheetId: { type: "string", description: "Spreadsheet ID" },
        deletedTitle: { type: "string", description: "Name of the deleted tab" }
      }
    }
  },
  {
    name: "renameSheetTab",
    description: "Rename a tab (sheet) in a Google Sheets spreadsheet",
    inputSchema: {
      type: "object",
      properties: {
        spreadsheetId: { type: "string", description: "Spreadsheet ID" },
        currentTitle: { type: "string", description: "Current name of the tab" },
        newTitle: { type: "string", description: "New name for the tab" }
      },
      required: ["spreadsheetId", "currentTitle", "newTitle"]
    },
    outputSchema: {
      type: "object",
      properties: {
        spreadsheetId: { type: "string", description: "Spreadsheet ID" },
        oldTitle: { type: "string", description: "Previous tab name" },
        newTitle: { type: "string", description: "New tab name" }
      }
    }
  },
  {
    name: "listSheetTabs",
    description: "List all tabs (sheets) in a Google Sheets spreadsheet with their metadata. Use this to discover available sheets before reading or formatting data.",
    inputSchema: {
      type: "object",
      properties: {
        spreadsheetId: { type: "string", description: "Spreadsheet ID" }
      },
      required: ["spreadsheetId"]
    },
    outputSchema: {
      type: "object",
      properties: {
        spreadsheetId: { type: "string", description: "Spreadsheet ID" },
        tabs: {
          type: "array",
          description: "List of sheet tabs with metadata",
          items: {
            type: "object",
            properties: {
              sheetId: { type: "number", description: "Numeric sheet ID (used for formatting operations)" },
              title: { type: "string", description: "Sheet tab name (used in A1 notation like 'Sheet1!A1:C10')" },
              index: { type: "number", description: "Tab position (0-indexed)" },
              rowCount: { type: "number", description: "Number of rows in the sheet" },
              columnCount: { type: "number", description: "Number of columns in the sheet" }
            }
          }
        }
      }
    }
  }
];

// Slides tools
export const slidesTools: ToolDefinition[] = [
  {
    name: "createGoogleSlides",
    description: "Create a new Google Slides presentation with initial slides",
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
              content: { type: "string" }
            }
          }
        },
        parentFolderId: { type: "string", description: "Parent folder ID (mutually exclusive with parentPath)" },
        parentPath: { type: "string", description: "Parent folder path like '/Presentations/2024' (creates folders if needed, mutually exclusive with parentFolderId)" }
      },
      required: ["name", "slides"]
    },
    outputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Created presentation ID" },
        name: { type: "string", description: "Created presentation name" },
        webViewLink: { type: "string", description: "Link to view the presentation" }
      }
    }
  },
  {
    name: "updateGoogleSlides",
    description: "Update an existing Google Slides presentation",
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
              content: { type: "string" }
            }
          }
        }
      },
      required: ["presentationId", "slides"]
    },
    outputSchema: {
      type: "object",
      properties: {
        slideCount: { type: "number", description: "Number of slides after update" },
        webViewLink: { type: "string", description: "Link to view the presentation" }
      }
    }
  },
  {
    name: "getGoogleSlidesContent",
    description: "Get content of Google Slides with element IDs for formatting",
    inputSchema: {
      type: "object",
      properties: {
        presentationId: { type: "string", description: "Presentation ID" },
        slideIndex: { type: "number", description: "Specific slide index (optional)" }
      },
      required: ["presentationId"]
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
                    objectId: { type: "string", description: "Element object ID" },
                    type: {
                      type: "string",
                      description: "Element type",
                      enum: ["textBox", "shape", "image", "video", "table"]
                    },
                    text: { type: "string", description: "Text content (for text elements)" },
                    shapeType: { type: "string", description: "Shape type (for shapes)" }
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  {
    name: "formatGoogleSlidesElement",
    description: "Unified formatting tool for Google Slides. Format text (styling + paragraph), shapes (background + outline), or slide backgrounds in a single call. Use targetType to specify what you're formatting.",
    inputSchema: {
      type: "object",
      properties: {
        presentationId: { type: "string", description: "Presentation ID" },
        targetType: {
          type: "string",
          description: "What to format: 'text' for text styling/paragraphs, 'shape' for shape styling, 'slide' for slide background",
          enum: ["text", "shape", "slide"]
        },
        objectId: { type: "string", description: "Object ID (required for text/shape targetType)" },
        pageObjectIds: {
          type: "array",
          description: "Array of slide IDs (required for slide targetType)",
          items: { type: "string" }
        },
        // Text range
        startIndex: { type: "number", description: "Start index for text range (0-based)" },
        endIndex: { type: "number", description: "End index for text range (0-based)" },
        // Text formatting
        bold: { type: "boolean", description: "Make text bold (text targetType)" },
        italic: { type: "boolean", description: "Make text italic (text targetType)" },
        underline: { type: "boolean", description: "Underline text (text targetType)" },
        strikethrough: { type: "boolean", description: "Strikethrough text (text targetType)" },
        fontSize: { type: "number", description: "Font size in points (text targetType)" },
        fontFamily: { type: "string", description: "Font family name (text targetType)" },
        foregroundColor: {
          type: "object",
          description: "Text color RGB (0-1) (text targetType)",
          properties: {
            red: { type: "number" },
            green: { type: "number" },
            blue: { type: "number" }
          }
        },
        // Paragraph formatting
        alignment: {
          type: "string",
          description: "Text alignment (text targetType)",
          enum: ["START", "CENTER", "END", "JUSTIFIED"]
        },
        lineSpacing: { type: "number", description: "Line spacing multiplier (text targetType)" },
        bulletStyle: {
          type: "string",
          description: "Bullet style (text targetType)",
          enum: ["NONE", "DISC", "ARROW", "SQUARE", "DIAMOND", "STAR", "NUMBERED"]
        },
        // Shape styling
        backgroundColor: {
          type: "object",
          description: "Shape background color RGBA (0-1) (shape targetType)",
          properties: {
            red: { type: "number" },
            green: { type: "number" },
            blue: { type: "number" },
            alpha: { type: "number" }
          }
        },
        outlineColor: {
          type: "object",
          description: "Shape outline color RGB (0-1) (shape targetType)",
          properties: {
            red: { type: "number" },
            green: { type: "number" },
            blue: { type: "number" }
          }
        },
        outlineWeight: { type: "number", description: "Outline thickness in points (shape targetType)" },
        outlineDashStyle: {
          type: "string",
          description: "Outline dash style (shape targetType)",
          enum: ["SOLID", "DOT", "DASH", "DASH_DOT", "LONG_DASH", "LONG_DASH_DOT"]
        },
        // Slide background
        slideBackgroundColor: {
          type: "object",
          description: "Slide background color RGBA (0-1) (slide targetType)",
          properties: {
            red: { type: "number" },
            green: { type: "number" },
            blue: { type: "number" },
            alpha: { type: "number" }
          }
        }
      },
      required: ["presentationId", "targetType"]
    },
    outputSchema: {
      type: "object",
      properties: {
        targetType: { type: "string", description: "Type of element formatted" },
        formatsApplied: { type: "array", items: { type: "string" }, description: "List of formats applied" }
      }
    }
  },
  {
    name: "createGoogleSlidesTextBox",
    description: "Create a text box in Google Slides. Position values (x, y, width, height) are in EMU units. Conversion: 1 inch = 914400 EMU, 1 point = 12700 EMU. Example: 2 inches = 1828800 EMU. Standard slide is 9144000 x 5143500 EMU (10\" x 5.625\").",
    inputSchema: {
      type: "object",
      properties: {
        presentationId: { type: "string", description: "Presentation ID" },
        pageObjectId: { type: "string", description: "Slide ID" },
        text: { type: "string", description: "Text content" },
        x: { type: "number", description: "X position in EMU (1 inch = 914400 EMU)" },
        y: { type: "number", description: "Y position in EMU" },
        width: { type: "number", description: "Width in EMU" },
        height: { type: "number", description: "Height in EMU" },
        fontSize: { type: "number", description: "Font size in points" },
        bold: { type: "boolean", description: "Make text bold" },
        italic: { type: "boolean", description: "Make text italic" }
      },
      required: ["presentationId", "pageObjectId", "text", "x", "y", "width", "height"]
    },
    outputSchema: {
      type: "object",
      properties: {
        objectId: { type: "string", description: "Created text box object ID" },
        pageObjectId: { type: "string", description: "Slide where text box was created" }
      }
    }
  },
  {
    name: "createGoogleSlidesShape",
    description: "Create a shape in Google Slides. Position values (x, y, width, height) are in EMU units. Conversion: 1 inch = 914400 EMU, 1 point = 12700 EMU. Standard slide is 9144000 x 5143500 EMU (10\" x 5.625\").",
    inputSchema: {
      type: "object",
      properties: {
        presentationId: { type: "string", description: "Presentation ID" },
        pageObjectId: { type: "string", description: "Slide ID" },
        shapeType: {
          type: "string",
          description: "Shape type",
          enum: ["RECTANGLE", "ELLIPSE", "DIAMOND", "TRIANGLE", "STAR", "ROUND_RECTANGLE", "ARROW"]
        },
        x: { type: "number", description: "X position in EMU (1 inch = 914400 EMU)" },
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
            alpha: { type: "number" }
          },
        }
      },
      required: ["presentationId", "pageObjectId", "shapeType", "x", "y", "width", "height"]
    },
    outputSchema: {
      type: "object",
      properties: {
        objectId: { type: "string", description: "Created shape object ID" },
        pageObjectId: { type: "string", description: "Slide where shape was created" },
        shapeType: { type: "string", description: "Type of shape created" }
      }
    }
  },
  {
    name: "getGoogleSlidesSpeakerNotes",
    description: "Get speaker notes from a specific slide in Google Slides",
    inputSchema: {
      type: "object",
      properties: {
        presentationId: { type: "string", description: "Presentation ID" },
        slideIndex: { type: "number", description: "Slide index (0-based)" }
      },
      required: ["presentationId", "slideIndex"]
    },
    outputSchema: {
      type: "object",
      properties: {
        slideIndex: { type: "number", description: "Slide index" },
        notes: { type: "string", description: "Speaker notes content" }
      }
    }
  },
  {
    name: "updateGoogleSlidesSpeakerNotes",
    description: "Update speaker notes for a specific slide in Google Slides",
    inputSchema: {
      type: "object",
      properties: {
        presentationId: { type: "string", description: "Presentation ID" },
        slideIndex: { type: "number", description: "Slide index (0-based)" },
        notes: { type: "string", description: "Speaker notes content" }
      },
      required: ["presentationId", "slideIndex", "notes"]
    },
    outputSchema: {
      type: "object",
      properties: {
        slideIndex: { type: "number", description: "Slide index" },
        updated: { type: "boolean", description: "Whether notes were updated" }
      }
    }
  },
  {
    name: "listSlidePages",
    description: "List all pages (slides) in a Google Slides presentation with their metadata. Use this to discover available slides and their object IDs before formatting or updating.",
    inputSchema: {
      type: "object",
      properties: {
        presentationId: { type: "string", description: "Presentation ID" }
      },
      required: ["presentationId"]
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
              objectId: { type: "string", description: "Page object ID (used for slide operations)" },
              index: { type: "number", description: "Slide position (0-indexed)" },
              pageType: { type: "string", description: "Page type: SLIDE, MASTER, or LAYOUT" },
              title: { type: "string", description: "Slide title if available" }
            }
          }
        }
      }
    }
  }
];

// Unified smart tools
export const unifiedTools: ToolDefinition[] = [
  {
    name: "createFile",
    description: "Smart file creation that infers type from name or content. Creates Google Docs, Sheets, Slides, or text files automatically. Routes based on extension (.docx→Doc, .xlsx→Sheet, .pptx→Slides, .txt/.md→text) or content structure (2D array→Sheet, slides array→Slides).",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "File name with extension (e.g., 'report.docx', 'data.xlsx', 'deck.pptx', 'notes.txt')" },
        content: {
          description: "File content: string for docs/text, 2D array for sheets, array of {title, content} for slides",
          oneOf: [
            { type: "string", description: "Text content for docs or text files" },
            {
              type: "array",
              description: "2D array for sheets",
              items: { type: "array", items: { type: "string" } }
            },
            {
              type: "array",
              description: "Slides array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  content: { type: "string" }
                },
                required: ["title", "content"]
              }
            }
          ]
        },
        parentFolderId: { type: "string", description: "Parent folder ID (mutually exclusive with parentPath)" },
        parentPath: { type: "string", description: "Parent folder path like '/Documents/Reports' (creates folders if needed, mutually exclusive with parentFolderId)" },
        type: {
          type: "string",
          description: "Optional explicit type override",
          enum: ["doc", "sheet", "slides", "text"]
        }
      },
      required: ["name", "content"]
    },
    outputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Created file ID" },
        name: { type: "string", description: "Created file name" },
        type: { type: "string", description: "File type (doc, sheet, slides, or text)" },
        mimeType: { type: "string", description: "Google MIME type" },
        webViewLink: { type: "string", description: "Link to view the file" }
      }
    }
  },
  {
    name: "updateFile",
    description: "Smart file update that detects file type and routes accordingly. Works with Google Docs, Sheets, and text files. For Slides, use updateGoogleSlides directly.",
    inputSchema: {
      type: "object",
      properties: {
        fileId: { type: "string", description: "File ID to update (mutually exclusive with filePath)" },
        filePath: { type: "string", description: "File path like '/Documents/report.docx' (mutually exclusive with fileId)" },
        content: {
          description: "New content: string for docs/text, 2D array for sheets",
          oneOf: [
            { type: "string", description: "Text content" },
            {
              type: "array",
              description: "2D array for sheets",
              items: { type: "array", items: { type: "string" } }
            }
          ]
        },
        range: { type: "string", description: "For sheets only: range to update (e.g., 'Sheet1!A1:C10'). Defaults to Sheet1!A1" }
      },
      required: ["content"]
    },
    outputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Updated file ID" },
        name: { type: "string", description: "File name" },
        type: { type: "string", description: "File type" },
        updated: { type: "boolean", description: "Whether update succeeded" }
      }
    }
  },
  {
    name: "getFileContent",
    description: "Smart content retrieval that returns appropriate format based on file type. Returns structured data for Sheets/Slides, plain text for Docs/text files.",
    inputSchema: {
      type: "object",
      properties: {
        fileId: { type: "string", description: "File ID to read (mutually exclusive with filePath)" },
        filePath: { type: "string", description: "File path like '/Documents/report.docx' (mutually exclusive with fileId)" },
        range: { type: "string", description: "For sheets only: range to read (e.g., 'Sheet1!A1:C10'). Defaults to all data" }
      }
    },
    outputSchema: {
      type: "object",
      properties: {
        fileId: { type: "string", description: "File ID" },
        name: { type: "string", description: "File name" },
        type: { type: "string", description: "File type (doc, sheet, slides, text, or binary)" },
        mimeType: { type: "string", description: "MIME type" },
        content: { description: "File content: string for docs/text, 2D array for sheets, slides array for presentations" },
        metadata: {
          type: "object",
          description: "Additional metadata",
          properties: {
            modifiedTime: { type: "string" },
            title: { type: "string" },
            size: { type: "string" },
            rowCount: { type: "number" },
            columnCount: { type: "number" },
            slideCount: { type: "number" }
          }
        }
      }
    }
  }
];

/**
 * Get all tool definitions combined into a single array.
 */
export function getAllTools(): ToolDefinition[] {
  return [...driveTools, ...docsTools, ...sheetsTools, ...slidesTools, ...unifiedTools];
}
