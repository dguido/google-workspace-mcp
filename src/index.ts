#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { google } from "googleapis";
import type { drive_v3 } from "googleapis";
import { authenticate, AuthServer, initializeOAuth2Client } from "./auth.js";
import type { OAuth2Client } from "google-auth-library";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";
import { join, dirname } from "path";

// Import utilities
import {
  log,
  errorResponse,
  getDocsService,
  getSheetsService,
  getSlidesService,
  getCalendarService,
} from "./utils/index.js";

// Import all tool definitions
import { getAllTools } from "./tools/index.js";

// Import prompts
import { PROMPTS, generatePromptMessages } from "./prompts/index.js";

// Import all handlers
import {
  // Drive handlers
  handleSearch,
  handleCreateTextFile,
  handleUpdateTextFile,
  handleCreateFolder,
  handleListFolder,
  handleDeleteItem,
  handleRenameItem,
  handleMoveItem,
  handleCopyFile,
  handleGetFileMetadata,
  handleExportFile,
  handleShareFile,
  handleGetSharing,
  handleListRevisions,
  handleRestoreRevision,
  handleDownloadFile,
  handleUploadFile,
  handleGetStorageQuota,
  handleStarFile,
  handleResolveFilePath,
  handleBatchDelete,
  handleBatchRestore,
  handleBatchMove,
  handleBatchShare,
  handleRemovePermission,
  handleListTrash,
  handleRestoreFromTrash,
  handleEmptyTrash,
  handleGetFolderTree,
  // Docs handlers
  handleCreateGoogleDoc,
  handleUpdateGoogleDoc,
  handleGetGoogleDocContent,
  handleAppendToDoc,
  handleInsertTextInDoc,
  handleDeleteTextInDoc,
  handleReplaceTextInDoc,
  handleFormatGoogleDocRange,
  // Sheets handlers
  handleCreateGoogleSheet,
  handleUpdateGoogleSheet,
  handleGetGoogleSheetContent,
  handleFormatGoogleSheetCells,
  handleMergeGoogleSheetCells,
  handleAddGoogleSheetConditionalFormat,
  handleCreateSheetTab,
  handleDeleteSheetTab,
  handleRenameSheetTab,
  handleListSheetTabs,
  // Slides handlers
  handleCreateGoogleSlides,
  handleUpdateGoogleSlides,
  handleGetGoogleSlidesContent,
  handleCreateGoogleSlidesTextBox,
  handleCreateGoogleSlidesShape,
  handleGetGoogleSlidesSpeakerNotes,
  handleUpdateGoogleSlidesSpeakerNotes,
  handleFormatGoogleSlidesElement,
  handleListSlidePages,
  // Unified handlers
  handleCreateFile,
  handleUpdateFile,
  handleGetFileContent,
  // Calendar handlers
  handleListCalendars,
  handleListEvents,
  handleGetEvent,
  handleCreateEvent,
  handleUpdateEvent,
  handleDeleteEvent,
  handleFindFreeTime,
} from "./handlers/index.js";
import type { HandlerContext } from "./handlers/index.js";

// -----------------------------------------------------------------------------
// CONSTANTS & GLOBAL STATE
// -----------------------------------------------------------------------------

// Drive service - will be created with auth when needed
let drive: drive_v3.Drive | null = null;

// Global auth client - will be initialized on first use
let authClient: OAuth2Client | null = null;
let authenticationPromise: Promise<OAuth2Client> | null = null;

// Get package version
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJsonPath = join(__dirname, "..", "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
const VERSION = packageJson.version;

// -----------------------------------------------------------------------------
// DRIVE SERVICE HELPER
// -----------------------------------------------------------------------------

function ensureDriveService() {
  if (!authClient) {
    throw new Error("Authentication required");
  }

  log("About to create drive service", {
    authClientType: authClient?.constructor?.name,
    hasCredentials: !!authClient.credentials,
    hasAccessToken: !!authClient.credentials?.access_token,
    expiryDate: authClient.credentials?.expiry_date,
    isExpired: authClient.credentials?.expiry_date
      ? Date.now() > authClient.credentials.expiry_date
      : "no expiry",
  });

  // Create drive service with auth parameter directly
  drive = google.drive({ version: "v3", auth: authClient });

  log("Drive service created/updated", {
    hasAuth: !!authClient,
    hasCredentials: !!authClient.credentials,
    hasAccessToken: !!authClient.credentials?.access_token,
  });
}

// Track auth health for debugging
let lastAuthError: string | null = null;

async function verifyAuthHealth(): Promise<boolean> {
  if (!drive) {
    lastAuthError = "Drive service not initialized";
    return false;
  }

  try {
    const response = await drive.about.get({ fields: "user" });
    log("Auth verification successful, user:", response.data.user?.emailAddress);
    lastAuthError = null;
    return true;
  } catch (error: unknown) {
    const err = error as {
      message?: string;
      response?: { status: number; statusText: string };
    };
    lastAuthError = err.message || String(error);
    log("WARNING: Auth verification failed:", lastAuthError);
    if (err.response) {
      log("Auth error details:", {
        status: err.response.status,
        statusText: err.response.statusText,
      });
    }
    return false;
  }
}

// Export for testing - allows checking last auth error
export function getLastAuthError(): string | null {
  return lastAuthError;
}

// -----------------------------------------------------------------------------
// SERVER SETUP
// -----------------------------------------------------------------------------

const server = new Server(
  {
    name: "google-workspace-mcp",
    version: VERSION,
  },
  {
    capabilities: {
      resources: {},
      tools: {
        listChanged: true,
      },
      prompts: {
        listChanged: true,
      },
    },
  },
);

// -----------------------------------------------------------------------------
// AUTHENTICATION HELPER
// -----------------------------------------------------------------------------

async function ensureAuthenticated() {
  if (!authClient) {
    // If authentication is already in progress, wait for it
    if (authenticationPromise) {
      log("Authentication already in progress, waiting...");
      authClient = await authenticationPromise;
      return;
    }

    log("Initializing authentication");
    // Store the promise to prevent concurrent authentication attempts
    authenticationPromise = authenticate();

    try {
      authClient = await authenticationPromise;
      log("Authentication complete", {
        authClientType: authClient?.constructor?.name,
        hasCredentials: !!authClient?.credentials,
        hasAccessToken: !!authClient?.credentials?.access_token,
      });
      // Ensure drive service is created with auth
      ensureDriveService();

      // Verify auth works by making a test API call (blocking on first auth)
      const healthy = await verifyAuthHealth();
      if (!healthy) {
        log("WARNING: Authentication may be broken. Tool calls may fail.");
      }
    } finally {
      // Clear the promise after completion (success or failure)
      authenticationPromise = null;
    }
  }

  // If we already have authClient, ensure drive is up to date
  ensureDriveService();
}

// -----------------------------------------------------------------------------
// MCP REQUEST HANDLERS
// -----------------------------------------------------------------------------

server.setRequestHandler(ListResourcesRequestSchema, async (request) => {
  await ensureAuthenticated();
  log("Handling ListResources request", { params: request.params });
  const pageSize = 10;
  const params: {
    pageSize: number;
    fields: string;
    pageToken?: string;
    q: string;
    includeItemsFromAllDrives: boolean;
    supportsAllDrives: boolean;
  } = {
    pageSize,
    fields: "nextPageToken, files(id, name, mimeType)",
    q: `trashed = false`,
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
  };

  if (request.params?.cursor) {
    params.pageToken = request.params.cursor;
  }

  const res = await drive!.files.list(params);
  log("Listed files", { count: res.data.files?.length });
  const files = res.data.files || [];

  return {
    resources: files.map((file: drive_v3.Schema$File) => ({
      uri: `gdrive:///${file.id}`,
      mimeType: file.mimeType || "application/octet-stream",
      name: file.name || "Untitled",
    })),
    nextCursor: res.data.nextPageToken,
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  await ensureAuthenticated();
  log("Handling ReadResource request", { uri: request.params.uri });
  const fileId = request.params.uri.replace("gdrive:///", "");

  const file = await drive!.files.get({
    fileId,
    fields: "mimeType",
    supportsAllDrives: true,
  });
  const mimeType = file.data.mimeType;

  if (!mimeType) {
    throw new Error("File has no MIME type.");
  }

  if (mimeType.startsWith("application/vnd.google-apps")) {
    // Export logic for Google Docs/Sheets/Slides
    let exportMimeType;
    switch (mimeType) {
      case "application/vnd.google-apps.document":
        exportMimeType = "text/markdown";
        break;
      case "application/vnd.google-apps.spreadsheet":
        exportMimeType = "text/csv";
        break;
      case "application/vnd.google-apps.presentation":
        exportMimeType = "text/plain";
        break;
      case "application/vnd.google-apps.drawing":
        exportMimeType = "image/png";
        break;
      default:
        exportMimeType = "text/plain";
        break;
    }

    const res = await drive!.files.export(
      { fileId, mimeType: exportMimeType },
      { responseType: "text" },
    );

    log("Successfully read resource", { fileId, mimeType });
    return {
      contents: [
        {
          uri: request.params.uri,
          mimeType: exportMimeType,
          text: res.data,
        },
      ],
    };
  } else {
    // Regular file download
    const res = await drive!.files.get(
      { fileId, alt: "media", supportsAllDrives: true },
      { responseType: "arraybuffer" },
    );
    const contentMime = mimeType || "application/octet-stream";

    if (contentMime.startsWith("text/") || contentMime === "application/json") {
      return {
        contents: [
          {
            uri: request.params.uri,
            mimeType: contentMime,
            text: Buffer.from(res.data as ArrayBuffer).toString("utf-8"),
          },
        ],
      };
    } else {
      return {
        contents: [
          {
            uri: request.params.uri,
            mimeType: contentMime,
            blob: Buffer.from(res.data as ArrayBuffer).toString("base64"),
          },
        ],
      };
    }
  }
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: getAllTools() };
});

// -----------------------------------------------------------------------------
// PROMPT REQUEST HANDLERS
// -----------------------------------------------------------------------------

server.setRequestHandler(ListPromptsRequestSchema, async () => {
  log("Handling ListPrompts request");
  return {
    prompts: PROMPTS.map((prompt) => ({
      name: prompt.name,
      description: prompt.description,
      arguments: prompt.arguments,
    })),
  };
});

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  log("Handling GetPrompt request", { name: request.params.name });

  const promptName = request.params.name;
  const promptDef = PROMPTS.find((p) => p.name === promptName);

  if (!promptDef) {
    throw new Error(`Unknown prompt: ${promptName}`);
  }

  const args = request.params.arguments || {};
  const messages = generatePromptMessages(promptName, args);

  return {
    description: promptDef.description,
    messages,
  };
});

// -----------------------------------------------------------------------------
// TOOL REGISTRY
// -----------------------------------------------------------------------------

import type { ToolResponse } from "./utils/index.js";
import type { docs_v1, sheets_v4, slides_v1, calendar_v3 } from "googleapis";

interface ToolServices {
  drive: drive_v3.Drive;
  docs: docs_v1.Docs;
  sheets: sheets_v4.Sheets;
  slides: slides_v1.Slides;
  calendar: calendar_v3.Calendar;
  context: HandlerContext;
}

type ToolHandler = (services: ToolServices, args: unknown) => Promise<ToolResponse>;

function createToolRegistry(): Record<string, ToolHandler> {
  return {
    // Drive tools
    search: ({ drive }, args) => handleSearch(drive, args),
    createTextFile: ({ drive }, args) => handleCreateTextFile(drive, args),
    updateTextFile: ({ drive }, args) => handleUpdateTextFile(drive, args),
    createFolder: ({ drive }, args) => handleCreateFolder(drive, args),
    listFolder: ({ drive }, args) => handleListFolder(drive, args),
    deleteItem: ({ drive }, args) => handleDeleteItem(drive, args),
    renameItem: ({ drive }, args) => handleRenameItem(drive, args),
    moveItem: ({ drive }, args) => handleMoveItem(drive, args),
    copyFile: ({ drive }, args) => handleCopyFile(drive, args),
    getFileMetadata: ({ drive }, args) => handleGetFileMetadata(drive, args),
    exportFile: ({ drive }, args) => handleExportFile(drive, args),
    shareFile: ({ drive }, args) => handleShareFile(drive, args),
    getSharing: ({ drive }, args) => handleGetSharing(drive, args),
    listRevisions: ({ drive }, args) => handleListRevisions(drive, args),
    restoreRevision: ({ drive }, args) => handleRestoreRevision(drive, args),
    downloadFile: ({ drive }, args) => handleDownloadFile(drive, args),
    uploadFile: ({ drive }, args) => handleUploadFile(drive, args),
    getStorageQuota: ({ drive }, args) => handleGetStorageQuota(drive, args),
    starFile: ({ drive }, args) => handleStarFile(drive, args),
    resolveFilePath: ({ drive, context }, args) => handleResolveFilePath(drive, args, context),
    batchDelete: ({ drive, context }, args) => handleBatchDelete(drive, args, context),
    batchRestore: ({ drive, context }, args) => handleBatchRestore(drive, args, context),
    batchMove: ({ drive, context }, args) => handleBatchMove(drive, args, context),
    batchShare: ({ drive, context }, args) => handleBatchShare(drive, args, context),
    removePermission: ({ drive }, args) => handleRemovePermission(drive, args),
    listTrash: ({ drive }, args) => handleListTrash(drive, args),
    restoreFromTrash: ({ drive }, args) => handleRestoreFromTrash(drive, args),
    emptyTrash: ({ drive, context }, args) => handleEmptyTrash(drive, args, context),
    getFolderTree: ({ drive }, args) => handleGetFolderTree(drive, args),

    // Docs tools
    createGoogleDoc: ({ drive, docs }, args) => handleCreateGoogleDoc(drive, docs, args),
    updateGoogleDoc: ({ docs }, args) => handleUpdateGoogleDoc(docs, args),
    getGoogleDocContent: ({ drive, docs }, args) => handleGetGoogleDocContent(drive, docs, args),
    appendToDoc: ({ docs }, args) => handleAppendToDoc(docs, args),
    insertTextInDoc: ({ docs }, args) => handleInsertTextInDoc(docs, args),
    deleteTextInDoc: ({ docs }, args) => handleDeleteTextInDoc(docs, args),
    replaceTextInDoc: ({ docs }, args) => handleReplaceTextInDoc(docs, args),
    formatGoogleDocRange: ({ docs }, args) => handleFormatGoogleDocRange(docs, args),

    // Sheets tools
    createGoogleSheet: ({ drive, sheets }, args) => handleCreateGoogleSheet(drive, sheets, args),
    updateGoogleSheet: ({ sheets }, args) => handleUpdateGoogleSheet(sheets, args),
    getGoogleSheetContent: ({ drive, sheets }, args) =>
      handleGetGoogleSheetContent(drive, sheets, args),
    formatGoogleSheetCells: ({ sheets }, args) => handleFormatGoogleSheetCells(sheets, args),
    mergeGoogleSheetCells: ({ sheets }, args) => handleMergeGoogleSheetCells(sheets, args),
    addGoogleSheetConditionalFormat: ({ sheets }, args) =>
      handleAddGoogleSheetConditionalFormat(sheets, args),
    createSheetTab: ({ sheets }, args) => handleCreateSheetTab(sheets, args),
    deleteSheetTab: ({ sheets }, args) => handleDeleteSheetTab(sheets, args),
    renameSheetTab: ({ sheets }, args) => handleRenameSheetTab(sheets, args),
    listSheetTabs: ({ sheets }, args) => handleListSheetTabs(sheets, args),

    // Slides tools
    createGoogleSlides: ({ drive, slides }, args) => handleCreateGoogleSlides(drive, slides, args),
    updateGoogleSlides: ({ slides }, args) => handleUpdateGoogleSlides(slides, args),
    getGoogleSlidesContent: ({ drive, slides }, args) =>
      handleGetGoogleSlidesContent(drive, slides, args),
    createGoogleSlidesTextBox: ({ slides }, args) => handleCreateGoogleSlidesTextBox(slides, args),
    createGoogleSlidesShape: ({ slides }, args) => handleCreateGoogleSlidesShape(slides, args),
    getGoogleSlidesSpeakerNotes: ({ slides }, args) =>
      handleGetGoogleSlidesSpeakerNotes(slides, args),
    updateGoogleSlidesSpeakerNotes: ({ slides }, args) =>
      handleUpdateGoogleSlidesSpeakerNotes(slides, args),
    formatGoogleSlidesElement: ({ slides }, args) => handleFormatGoogleSlidesElement(slides, args),
    listSlidePages: ({ slides }, args) => handleListSlidePages(slides, args),

    // Unified smart tools
    createFile: ({ drive, docs, sheets, slides }, args) =>
      handleCreateFile(drive, docs, sheets, slides, args),
    updateFile: ({ drive, docs, sheets, slides }, args) =>
      handleUpdateFile(drive, docs, sheets, slides, args),
    getFileContent: ({ drive, docs, sheets, slides }, args) =>
      handleGetFileContent(drive, docs, sheets, slides, args),

    // Calendar tools
    listCalendars: ({ calendar }, args) => handleListCalendars(calendar, args),
    listEvents: ({ calendar }, args) => handleListEvents(calendar, args),
    getEvent: ({ calendar }, args) => handleGetEvent(calendar, args),
    createEvent: ({ calendar }, args) => handleCreateEvent(calendar, args),
    updateEvent: ({ calendar }, args) => handleUpdateEvent(calendar, args),
    deleteEvent: ({ calendar }, args) => handleDeleteEvent(calendar, args),
    findFreeTime: ({ calendar }, args) => handleFindFreeTime(calendar, args),
  };
}

const toolRegistry = createToolRegistry();

// -----------------------------------------------------------------------------
// TOOL CALL REQUEST HANDLER
// -----------------------------------------------------------------------------

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  await ensureAuthenticated();
  log("Handling tool request", { tool: request.params.name });

  try {
    const args = request.params.arguments;
    const meta = (request.params as { _meta?: { progressToken?: string | number } })._meta;

    const services: ToolServices = {
      drive: drive!,
      docs: getDocsService(authClient!),
      sheets: getSheetsService(authClient!),
      slides: getSlidesService(authClient!),
      calendar: getCalendarService(authClient!),
      context: { server, progressToken: meta?.progressToken },
    };

    const handler = toolRegistry[request.params.name];
    if (!handler) {
      return errorResponse(`Unknown tool: ${request.params.name}`);
    }

    return handler(services, args);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    log("Tool error", { error: message });
    return errorResponse(message);
  }
});

// -----------------------------------------------------------------------------
// CLI HELPER FUNCTIONS
// -----------------------------------------------------------------------------

function showHelp(): void {
  console.log(`
Google Workspace MCP Server v${VERSION}

Usage:
  npx @dguido/google-workspace-mcp [command] [options]

Commands:
  auth     Run the authentication flow
  start    Start the MCP server (default)
  version  Show version information
  help     Show this help message

Auth Options:
  --token-path <path>        Save tokens to custom path (e.g., .credentials/tokens.json)
  --credentials-path <path>  Use custom OAuth credentials file

Examples:
  npx @dguido/google-workspace-mcp auth
  npx @dguido/google-workspace-mcp auth --token-path .credentials/tokens.json
  npx @dguido/google-workspace-mcp auth \\
    --credentials-path .credentials/gcp-oauth.keys.json \\
    --token-path .credentials/tokens.json
  npx @dguido/google-workspace-mcp start
  npx @dguido/google-workspace-mcp

Environment Variables:
  GOOGLE_DRIVE_OAUTH_CREDENTIALS   Path to OAuth credentials file
  GOOGLE_WORKSPACE_MCP_TOKEN_PATH  Path to store authentication tokens

Multi-Account Setup:
  For project-level credential storage (useful with multiple Google accounts):
  1. Create a .credentials directory in your project
  2. Use CLI flags or env vars to point to project-level paths
  3. Add .credentials/ to your .gitignore
`);
}

function showVersion(): void {
  console.log(`Google Workspace MCP Server v${VERSION}`);
}

async function runAuthServer(tokenPath?: string, credentialsPath?: string): Promise<void> {
  try {
    // Set env vars from CLI flags (CLI takes precedence over existing env vars)
    if (tokenPath) {
      process.env.GOOGLE_WORKSPACE_MCP_TOKEN_PATH = tokenPath;
    }
    if (credentialsPath) {
      process.env.GOOGLE_DRIVE_OAUTH_CREDENTIALS = credentialsPath;
    }

    // Initialize OAuth client
    const oauth2Client = await initializeOAuth2Client();

    // Create and start auth server
    const authServer = new AuthServer(oauth2Client);
    await authServer.start();

    // Wait for completion
    const checkInterval = setInterval(() => {
      if (authServer.authCompletedSuccessfully) {
        clearInterval(checkInterval);
        process.exit(0);
      }
    }, 1000);
  } catch (error) {
    console.error("Authentication failed:", error);
    process.exit(1);
  }
}

// -----------------------------------------------------------------------------
// MAIN EXECUTION
// -----------------------------------------------------------------------------

interface CliArgs {
  command: string | undefined;
  tokenPath?: string;
  credentialsPath?: string;
}

function parseCliArgs(): CliArgs {
  const args = process.argv.slice(2);
  let command: string | undefined;
  let tokenPath: string | undefined;
  let credentialsPath: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // Handle --token-path flag
    if (arg === "--token-path" && i + 1 < args.length) {
      tokenPath = args[++i];
      continue;
    }

    // Handle --credentials-path flag
    if (arg === "--credentials-path" && i + 1 < args.length) {
      credentialsPath = args[++i];
      continue;
    }

    // Handle special version/help flags as commands
    if (arg === "--version" || arg === "-v" || arg === "--help" || arg === "-h") {
      command = arg;
      continue;
    }

    // Check for command (first non-option argument)
    if (!command && !arg.startsWith("--")) {
      command = arg;
      continue;
    }
  }

  return { command, tokenPath, credentialsPath };
}

async function main() {
  const { command, tokenPath, credentialsPath } = parseCliArgs();

  switch (command) {
    case "auth":
      await runAuthServer(tokenPath, credentialsPath);
      break;
    case "start":
    case undefined:
      try {
        // Start the MCP server
        log("Starting Google Workspace MCP server...");
        const transport = new StdioServerTransport();
        await server.connect(transport);
        log("Server started successfully");

        // Set up graceful shutdown
        process.on("SIGINT", async () => {
          await server.close();
          process.exit(0);
        });
        process.on("SIGTERM", async () => {
          await server.close();
          process.exit(0);
        });
      } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
      }
      break;
    case "version":
    case "--version":
    case "-v":
      showVersion();
      break;
    case "help":
    case "--help":
    case "-h":
      showHelp();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      showHelp();
      process.exit(1);
  }
}

// Export server and main for testing or potential programmatic use
export { main, server };

// Run the CLI
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
