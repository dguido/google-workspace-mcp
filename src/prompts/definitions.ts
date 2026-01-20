/**
 * MCP Prompt definitions for common Google Drive workflows
 */

export interface PromptDefinition {
  name: string;
  description: string;
  arguments?: Array<{
    name: string;
    description: string;
    required?: boolean;
  }>;
}

export interface PromptMessage {
  role: "user" | "assistant";
  content: {
    type: "text";
    text: string;
  };
}

export const PROMPTS: PromptDefinition[] = [
  {
    name: "organize-folder",
    description:
      "Organize files in a folder by type or date. Creates subfolders and moves files accordingly.",
    arguments: [
      {
        name: "folderId",
        description:
          'The ID of the folder to organize (use "root" for My Drive)',
        required: true,
      },
      {
        name: "organizeBy",
        description:
          'How to organize: "type" (by file type) or "date" (by creation date)',
        required: true,
      },
    ],
  },
  {
    name: "backup-folder",
    description:
      "Export all files in a folder to a local directory. Google Docs are exported as their native formats.",
    arguments: [
      {
        name: "folderId",
        description: "The ID of the folder to backup",
        required: true,
      },
      {
        name: "localPath",
        description: "Local directory path to save the backup",
        required: true,
      },
    ],
  },
  {
    name: "share-with-team",
    description:
      "Share multiple files with a list of email addresses with specified permissions.",
    arguments: [
      {
        name: "fileIds",
        description: "Comma-separated list of file IDs to share",
        required: true,
      },
      {
        name: "emails",
        description: "Comma-separated list of email addresses",
        required: true,
      },
      {
        name: "role",
        description: "Permission role: reader, commenter, or writer",
        required: false,
      },
    ],
  },
  {
    name: "cleanup-old-files",
    description:
      "Find and optionally delete files older than a specified number of days.",
    arguments: [
      {
        name: "folderId",
        description:
          'The folder to search (use "root" for My Drive, or omit for all files)',
        required: false,
      },
      {
        name: "daysOld",
        description: "Minimum age in days for files to be considered old",
        required: true,
      },
      {
        name: "action",
        description:
          'Action to take: "list" (just show files) or "trash" (move to trash)',
        required: false,
      },
    ],
  },
  {
    name: "migrate-format",
    description:
      "Convert legacy Microsoft Office files (.doc, .xls, .ppt) to Google Workspace formats.",
    arguments: [
      {
        name: "folderId",
        description:
          'The folder to search for files to convert (use "root" for My Drive)',
        required: false,
      },
      {
        name: "fileTypes",
        description:
          'Comma-separated file types to convert: doc, xls, ppt (or "all" for all types)',
        required: false,
      },
    ],
  },
];

/**
 * Generate prompt messages for a given prompt name and arguments
 */
export function generatePromptMessages(
  promptName: string,
  args: Record<string, string>,
): PromptMessage[] {
  switch (promptName) {
    case "organize-folder":
      return generateOrganizeFolderPrompt(args);
    case "backup-folder":
      return generateBackupFolderPrompt(args);
    case "share-with-team":
      return generateShareWithTeamPrompt(args);
    case "cleanup-old-files":
      return generateCleanupOldFilesPrompt(args);
    case "migrate-format":
      return generateMigrateFormatPrompt(args);
    default:
      throw new Error(`Unknown prompt: ${promptName}`);
  }
}

function generateOrganizeFolderPrompt(
  args: Record<string, string>,
): PromptMessage[] {
  const folderId = args.folderId || "root";
  const organizeBy = args.organizeBy || "type";

  const instructions =
    organizeBy === "type"
      ? `Please organize the files in folder "${folderId}" by their file type:

1. First, use listFolder to get all files in the folder
2. Create subfolders for each file type found (e.g., "Documents", "Spreadsheets", "Images", "Videos", "Other")
3. Move each file to its appropriate subfolder using moveItem
4. Report the results showing how many files were moved to each category

File type mappings:
- Documents: .doc, .docx, .pdf, .txt, Google Docs
- Spreadsheets: .xls, .xlsx, .csv, Google Sheets
- Presentations: .ppt, .pptx, Google Slides
- Images: .jpg, .jpeg, .png, .gif, .svg
- Videos: .mp4, .mov, .avi
- Audio: .mp3, .wav
- Other: everything else`
      : `Please organize the files in folder "${folderId}" by their creation date:

1. First, use listFolder to get all files in the folder
2. For each file, check its creation date using getFileMetadata
3. Create subfolders by year and month (e.g., "2024/January", "2024/February")
4. Move each file to its appropriate date-based subfolder using moveItem
5. Report the results showing how many files were organized`;

  return [
    {
      role: "user",
      content: {
        type: "text",
        text: instructions,
      },
    },
  ];
}

function generateBackupFolderPrompt(
  args: Record<string, string>,
): PromptMessage[] {
  const folderId = args.folderId;
  const localPath = args.localPath;

  return [
    {
      role: "user",
      content: {
        type: "text",
        text: `Please backup all files from Google Drive folder "${folderId}" to the local directory "${localPath}":

1. Use listFolder to get all files in the folder (including subfolders recursively)
2. For each file:
   - For Google Docs: export as .docx using exportFile
   - For Google Sheets: export as .xlsx using exportFile
   - For Google Slides: export as .pptx using exportFile
   - For other files: download using downloadFile
3. Preserve the folder structure in the local directory
4. Report progress and any errors encountered
5. At the end, provide a summary of:
   - Total files backed up
   - Total size
   - Any files that failed to backup`,
      },
    },
  ];
}

function generateShareWithTeamPrompt(
  args: Record<string, string>,
): PromptMessage[] {
  const fileIds = args.fileIds;
  const emails = args.emails;
  const role = args.role || "reader";

  return [
    {
      role: "user",
      content: {
        type: "text",
        text: `Please share the following files with the team:

Files to share: ${fileIds}
Team members: ${emails}
Permission level: ${role}

Steps:
1. For each file ID in the list, use shareFile to share with each email address
2. Use role "${role}" for all shares
3. Report the results showing:
   - Which files were successfully shared
   - Which email addresses received access
   - Any errors or files that couldn't be shared

Note: If any file is already shared with a user, you may need to update their permission level.`,
      },
    },
  ];
}

function generateCleanupOldFilesPrompt(
  args: Record<string, string>,
): PromptMessage[] {
  const folderId = args.folderId || "";
  const daysOld = args.daysOld;
  const action = args.action || "list";

  const folderClause = folderId
    ? `in folder "${folderId}"`
    : "across your entire Google Drive";

  const actionInstructions =
    action === "trash"
      ? `4. For each file older than ${daysOld} days, use deleteItem to move it to trash
5. Report the files that were trashed`
      : `4. Do NOT delete any files - only report what was found`;

  return [
    {
      role: "user",
      content: {
        type: "text",
        text: `Please find files ${folderClause} that are older than ${daysOld} days:

1. Use search to find files with modifiedTime older than ${daysOld} days ago
2. For each file found, get its metadata to show name, size, and last modified date
3. Sort results by date (oldest first)
${actionInstructions}

Report format:
- File name
- Size
- Last modified date
- Location (parent folder)

Total count and size of old files found.`,
      },
    },
  ];
}

function generateMigrateFormatPrompt(
  args: Record<string, string>,
): PromptMessage[] {
  const folderId = args.folderId || "root";
  const fileTypes = args.fileTypes || "all";

  const typeFilter =
    fileTypes === "all"
      ? "Microsoft Office files (.doc, .docx, .xls, .xlsx, .ppt, .pptx)"
      : fileTypes
          .split(",")
          .map((t) => `.${t.trim()}`)
          .join(", ");

  return [
    {
      role: "user",
      content: {
        type: "text",
        text: `Please find and convert legacy Office files to Google Workspace formats in folder "${folderId}":

Target file types: ${typeFilter}

Steps:
1. Use search to find files matching the target types in the specified folder
2. For each file found, report:
   - Current file name and type
   - File size
   - Last modified date
3. Ask for confirmation before proceeding with conversion
4. To convert a file:
   - Upload it with convert=true option to create a Google Docs/Sheets/Slides version
   - The original file will remain (user can delete it later if desired)
5. Report conversion results:
   - Successfully converted files
   - Any files that failed to convert
   - Total storage impact (Google Workspace files don't count against quota)

Note: This creates NEW Google Workspace files alongside the originals. Original files are preserved.`,
      },
    },
  ];
}
