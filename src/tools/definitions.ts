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
    description: "Search for files in Google Drive",
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
    description: "Create a new text or markdown file",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "File name (.txt or .md)" },
        content: { type: "string", description: "File content" },
        parentFolderId: { type: "string", description: "Optional parent folder ID" }
      },
      required: ["name", "content"]
    }
  },
  {
    name: "updateTextFile",
    description: "Update an existing text or markdown file",
    inputSchema: {
      type: "object",
      properties: {
        fileId: { type: "string", description: "ID of the file to update" },
        content: { type: "string", description: "New file content" },
        name: { type: "string", description: "Optional new name (.txt or .md)" }
      },
      required: ["fileId", "content"]
    }
  },
  {
    name: "createFolder",
    description: "Create a new folder in Google Drive",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Folder name" },
        parent: { type: "string", description: "Optional parent folder ID or path" }
      },
      required: ["name"]
    }
  },
  {
    name: "listFolder",
    description: "List contents of a folder (defaults to root)",
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
    }
  },
  {
    name: "renameItem",
    description: "Rename a file or folder",
    inputSchema: {
      type: "object",
      properties: {
        itemId: { type: "string", description: "ID of the item to rename" },
        newName: { type: "string", description: "New name" }
      },
      required: ["itemId", "newName"]
    }
  },
  {
    name: "moveItem",
    description: "Move a file or folder",
    inputSchema: {
      type: "object",
      properties: {
        itemId: { type: "string", description: "ID of the item to move" },
        destinationFolderId: { type: "string", description: "Destination folder ID" }
      },
      required: ["itemId"]
    }
  },
  {
    name: "copyFile",
    description: "Copy a file to a new location with optional new name",
    inputSchema: {
      type: "object",
      properties: {
        sourceFileId: { type: "string", description: "ID of the file to copy" },
        destinationName: { type: "string", description: "Name for the copied file (defaults to 'Copy of <original>')" },
        destinationFolderId: { type: "string", description: "Destination folder ID (defaults to same folder as source)" }
      },
      required: ["sourceFileId"]
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
    }
  },
  // Revision tools
  {
    name: "listRevisions",
    description: "List version history of a file (binary files only, not Google Workspace files)",
    inputSchema: {
      type: "object",
      properties: {
        fileId: { type: "string", description: "File ID" },
        pageSize: { type: "number", description: "Max revisions to return (default 100, max 1000)" }
      },
      required: ["fileId"]
    }
  },
  {
    name: "restoreRevision",
    description: "Restore a file to a previous revision (binary files only)",
    inputSchema: {
      type: "object",
      properties: {
        fileId: { type: "string", description: "File ID" },
        revisionId: { type: "string", description: "Revision ID to restore" }
      },
      required: ["fileId", "revisionId"]
    }
  },
  // Binary file tools
  {
    name: "downloadFile",
    description: "Download a binary file (images, PDFs, etc.) as base64 or to disk. For Google Workspace files, use exportFile instead.",
    inputSchema: {
      type: "object",
      properties: {
        fileId: { type: "string", description: "File ID" },
        outputPath: { type: "string", description: "Directory to save file (optional, returns base64 if not provided)" }
      },
      required: ["fileId"]
    }
  },
  {
    name: "uploadFile",
    description: "Upload a binary file from disk or base64 content",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "File name with extension" },
        sourcePath: { type: "string", description: "Path to source file" },
        base64Content: { type: "string", description: "Base64-encoded content" },
        mimeType: { type: "string", description: "MIME type (auto-detected from extension if omitted)" },
        folderId: { type: "string", description: "Destination folder ID" }
      },
      required: ["name"]
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
    }
  },
  {
    name: "starFile",
    description: "Star or unstar a file",
    inputSchema: {
      type: "object",
      properties: {
        fileId: { type: "string", description: "File ID" },
        starred: { type: "boolean", description: "true to star, false to unstar" }
      },
      required: ["fileId", "starred"]
    }
  }
];

// Docs tools
export const docsTools: ToolDefinition[] = [
  {
    name: "createGoogleDoc",
    description: "Create a new Google Doc",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Doc name" },
        content: { type: "string", description: "Doc content" },
        parentFolderId: { type: "string", description: "Parent folder ID" }
      },
      required: ["name", "content"]
    }
  },
  {
    name: "updateGoogleDoc",
    description: "Update an existing Google Doc",
    inputSchema: {
      type: "object",
      properties: {
        documentId: { type: "string", description: "Doc ID" },
        content: { type: "string", description: "New content" }
      },
      required: ["documentId", "content"]
    }
  },
  {
    name: "formatGoogleDocText",
    description: "Apply text formatting to a range in a Google Doc",
    inputSchema: {
      type: "object",
      properties: {
        documentId: { type: "string", description: "Document ID" },
        startIndex: { type: "number", description: "Start index (1-based)" },
        endIndex: { type: "number", description: "End index (1-based)" },
        bold: { type: "boolean", description: "Make text bold" },
        italic: { type: "boolean", description: "Make text italic" },
        underline: { type: "boolean", description: "Underline text" },
        strikethrough: { type: "boolean", description: "Strikethrough text" },
        fontSize: { type: "number", description: "Font size in points" },
        foregroundColor: {
          type: "object",
          description: "Text color (RGB values 0-1)",
          properties: {
            red: { type: "number" },
            green: { type: "number" },
            blue: { type: "number" }
          },
        }
      },
      required: ["documentId", "startIndex", "endIndex"]
    }
  },
  {
    name: "formatGoogleDocParagraph",
    description: "Apply paragraph formatting to a range in a Google Doc",
    inputSchema: {
      type: "object",
      properties: {
        documentId: { type: "string", description: "Document ID" },
        startIndex: { type: "number", description: "Start index (1-based)" },
        endIndex: { type: "number", description: "End index (1-based)" },
        namedStyleType: {
          type: "string",
          description: "Paragraph style",
          enum: ["NORMAL_TEXT", "TITLE", "SUBTITLE", "HEADING_1", "HEADING_2", "HEADING_3", "HEADING_4", "HEADING_5", "HEADING_6"],
        },
        alignment: {
          type: "string",
          description: "Text alignment",
          enum: ["START", "CENTER", "END", "JUSTIFIED"],
        },
        lineSpacing: { type: "number", description: "Line spacing multiplier" },
        spaceAbove: { type: "number", description: "Space above paragraph in points" },
        spaceBelow: { type: "number", description: "Space below paragraph in points" }
      },
      required: ["documentId", "startIndex", "endIndex"]
    }
  },
  {
    name: "getGoogleDocContent",
    description: "Get content of a Google Doc with text indices for formatting",
    inputSchema: {
      type: "object",
      properties: {
        documentId: { type: "string", description: "Document ID" }
      },
      required: ["documentId"]
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
        parentFolderId: { type: "string", description: "Parent folder ID (defaults to root)" },
        valueInputOption: {
          type: "string",
          enum: ["RAW", "USER_ENTERED"],
          description: "RAW (default): Values stored exactly as provided - formulas stored as text strings. Safe for untrusted data. USER_ENTERED: Values parsed like spreadsheet UI - formulas (=SUM, =IF, etc.) are evaluated. SECURITY WARNING: USER_ENTERED can execute formulas, only use with trusted data, never with user-provided input that could contain malicious formulas like =IMPORTDATA() or =IMPORTRANGE()."
        }
      },
      required: ["name", "data"]
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
    }
  },
  {
    name: "formatGoogleSheetCells",
    description: "Format cells in a Google Sheet (background, borders, alignment)",
    inputSchema: {
      type: "object",
      properties: {
        spreadsheetId: { type: "string", description: "Spreadsheet ID" },
        range: { type: "string", description: "Range to format (e.g., 'A1:C10')" },
        backgroundColor: {
          type: "object",
          description: "Background color (RGB values 0-1)",
          properties: {
            red: { type: "number" },
            green: { type: "number" },
            blue: { type: "number" }
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
        }
      },
      required: ["spreadsheetId", "range"]
    }
  },
  {
    name: "formatGoogleSheetText",
    description: "Apply text formatting to cells in a Google Sheet",
    inputSchema: {
      type: "object",
      properties: {
        spreadsheetId: { type: "string", description: "Spreadsheet ID" },
        range: { type: "string", description: "Range to format (e.g., 'A1:C10')" },
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
          },
        }
      },
      required: ["spreadsheetId", "range"]
    }
  },
  {
    name: "formatGoogleSheetNumbers",
    description: "Apply number formatting to cells in a Google Sheet",
    inputSchema: {
      type: "object",
      properties: {
        spreadsheetId: { type: "string", description: "Spreadsheet ID" },
        range: { type: "string", description: "Range to format (e.g., 'A1:C10')" },
        pattern: {
          type: "string",
          description: "Number format pattern (e.g., '#,##0.00', 'yyyy-mm-dd', '$#,##0.00', '0.00%')"
        },
        type: {
          type: "string",
          description: "Format type",
          enum: ["NUMBER", "CURRENCY", "PERCENT", "DATE", "TIME", "DATE_TIME", "SCIENTIFIC"],
        }
      },
      required: ["spreadsheetId", "range", "pattern"]
    }
  },
  {
    name: "setGoogleSheetBorders",
    description: "Set borders for cells in a Google Sheet",
    inputSchema: {
      type: "object",
      properties: {
        spreadsheetId: { type: "string", description: "Spreadsheet ID" },
        range: { type: "string", description: "Range to format (e.g., 'A1:C10')" },
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
          },
        },
        top: { type: "boolean", description: "Apply to top border" },
        bottom: { type: "boolean", description: "Apply to bottom border" },
        left: { type: "boolean", description: "Apply to left border" },
        right: { type: "boolean", description: "Apply to right border" },
        innerHorizontal: { type: "boolean", description: "Apply to inner horizontal borders" },
        innerVertical: { type: "boolean", description: "Apply to inner vertical borders" }
      },
      required: ["spreadsheetId", "range", "style"]
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
    }
  }
];

// Slides tools
export const slidesTools: ToolDefinition[] = [
  {
    name: "createGoogleSlides",
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
              content: { type: "string" }
            }
          }
        },
        parentFolderId: { type: "string", description: "Parent folder ID (defaults to root)" }
      },
      required: ["name", "slides"]
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
    }
  },
  {
    name: "formatGoogleSlidesText",
    description: "Apply text formatting to elements in Google Slides",
    inputSchema: {
      type: "object",
      properties: {
        presentationId: { type: "string", description: "Presentation ID" },
        objectId: { type: "string", description: "Object ID of the text element" },
        startIndex: { type: "number", description: "Start index (0-based)" },
        endIndex: { type: "number", description: "End index (0-based)" },
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
          },
        }
      },
      required: ["presentationId", "objectId"]
    }
  },
  {
    name: "formatGoogleSlidesParagraph",
    description: "Apply paragraph formatting to text in Google Slides",
    inputSchema: {
      type: "object",
      properties: {
        presentationId: { type: "string", description: "Presentation ID" },
        objectId: { type: "string", description: "Object ID of the text element" },
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
        }
      },
      required: ["presentationId", "objectId"]
    }
  },
  {
    name: "styleGoogleSlidesShape",
    description: "Style shapes in Google Slides",
    inputSchema: {
      type: "object",
      properties: {
        presentationId: { type: "string", description: "Presentation ID" },
        objectId: { type: "string", description: "Shape object ID" },
        backgroundColor: {
          type: "object",
          description: "Background color (RGBA values 0-1)",
          properties: {
            red: { type: "number" },
            green: { type: "number" },
            blue: { type: "number" },
            alpha: { type: "number" }
          },
        },
        outlineColor: {
          type: "object",
          description: "Outline color (RGB values 0-1)",
          properties: {
            red: { type: "number" },
            green: { type: "number" },
            blue: { type: "number" }
          },
        },
        outlineWeight: { type: "number", description: "Outline thickness in points" },
        outlineDashStyle: {
          type: "string",
          description: "Outline dash style",
          enum: ["SOLID", "DOT", "DASH", "DASH_DOT", "LONG_DASH", "LONG_DASH_DOT"],
        }
      },
      required: ["presentationId", "objectId"]
    }
  },
  {
    name: "setGoogleSlidesBackground",
    description: "Set background color for slides",
    inputSchema: {
      type: "object",
      properties: {
        presentationId: { type: "string", description: "Presentation ID" },
        pageObjectIds: {
          type: "array",
          description: "Array of slide IDs to update",
          items: { type: "string" }
        },
        backgroundColor: {
          type: "object",
          description: "Background color (RGBA values 0-1)",
          properties: {
            red: { type: "number" },
            green: { type: "number" },
            blue: { type: "number" },
            alpha: { type: "number" }
          }
        }
      },
      required: ["presentationId", "pageObjectIds", "backgroundColor"]
    }
  },
  {
    name: "createGoogleSlidesTextBox",
    description: "Create a text box in Google Slides",
    inputSchema: {
      type: "object",
      properties: {
        presentationId: { type: "string", description: "Presentation ID" },
        pageObjectId: { type: "string", description: "Slide ID" },
        text: { type: "string", description: "Text content" },
        x: { type: "number", description: "X position in EMU (1/360000 cm)" },
        y: { type: "number", description: "Y position in EMU" },
        width: { type: "number", description: "Width in EMU" },
        height: { type: "number", description: "Height in EMU" },
        fontSize: { type: "number", description: "Font size in points" },
        bold: { type: "boolean", description: "Make text bold" },
        italic: { type: "boolean", description: "Make text italic" }
      },
      required: ["presentationId", "pageObjectId", "text", "x", "y", "width", "height"]
    }
  },
  {
    name: "createGoogleSlidesShape",
    description: "Create a shape in Google Slides",
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
        x: { type: "number", description: "X position in EMU" },
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
    }
  }
];

/**
 * Get all tool definitions combined into a single array.
 */
export function getAllTools(): ToolDefinition[] {
  return [...driveTools, ...docsTools, ...sheetsTools, ...slidesTools];
}
