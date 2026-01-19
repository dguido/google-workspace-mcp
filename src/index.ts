#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { google } from "googleapis";
import type { drive_v3 } from "googleapis";
import { authenticate, runAuthCommand, AuthServer, initializeOAuth2Client } from './auth.js';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';

// Import utilities
import { log, successResponse, errorResponse, getDocsService, getSheetsService, getSlidesService } from './utils/index.js';

// Import all tool definitions
import { getAllTools } from './tools/index.js';

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
  // Docs handlers
  handleCreateGoogleDoc,
  handleUpdateGoogleDoc,
  handleFormatGoogleDocText,
  handleFormatGoogleDocParagraph,
  handleGetGoogleDocContent,
  handleAppendToDoc,
  // Sheets handlers
  handleCreateGoogleSheet,
  handleUpdateGoogleSheet,
  handleGetGoogleSheetContent,
  handleFormatGoogleSheetCells,
  handleFormatGoogleSheetText,
  handleFormatGoogleSheetNumbers,
  handleSetGoogleSheetBorders,
  handleMergeGoogleSheetCells,
  handleAddGoogleSheetConditionalFormat,
  handleCreateSheetTab,
  handleDeleteSheetTab,
  handleRenameSheetTab,
  // Slides handlers
  handleCreateGoogleSlides,
  handleUpdateGoogleSlides,
  handleGetGoogleSlidesContent,
  handleFormatGoogleSlidesText,
  handleFormatGoogleSlidesParagraph,
  handleStyleGoogleSlidesShape,
  handleSetGoogleSlidesBackground,
  handleCreateGoogleSlidesTextBox,
  handleCreateGoogleSlidesShape,
  handleGetGoogleSlidesSpeakerNotes,
  handleUpdateGoogleSlidesSpeakerNotes
} from './handlers/index.js';

// -----------------------------------------------------------------------------
// CONSTANTS & GLOBAL STATE
// -----------------------------------------------------------------------------

// Drive service - will be created with auth when needed
let drive: drive_v3.Drive | null = null;

// Global auth client - will be initialized on first use
let authClient: any = null;
let authenticationPromise: Promise<any> | null = null;

// Get package version
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJsonPath = join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
const VERSION = packageJson.version;

// -----------------------------------------------------------------------------
// DRIVE SERVICE HELPER
// -----------------------------------------------------------------------------

function ensureDriveService() {
  if (!authClient) {
    throw new Error('Authentication required');
  }

  log('About to create drive service', {
    authClientType: authClient?.constructor?.name,
    hasCredentials: !!authClient.credentials,
    hasAccessToken: !!authClient.credentials?.access_token,
    expiryDate: authClient.credentials?.expiry_date,
    isExpired: authClient.credentials?.expiry_date ? Date.now() > authClient.credentials.expiry_date : 'no expiry'
  });

  // Create drive service with auth parameter directly
  drive = google.drive({ version: 'v3', auth: authClient });

  log('Drive service created/updated', {
    hasAuth: !!authClient,
    hasCredentials: !!authClient.credentials,
    hasAccessToken: !!authClient.credentials?.access_token
  });

  // Test the auth by making a simple API call
  drive.about.get({ fields: 'user' })
    .then((response: any) => {
      log('Auth test successful, user:', response.data.user?.emailAddress);
    })
    .catch((error: any) => {
      log('Auth test failed:', error.message || error);
      if (error.response) {
        log('Auth test error details:', {
          status: error.response.status,
          statusText: error.response.statusText,
          headers: error.response.headers,
          data: error.response.data
        });
      }
    });
}

// -----------------------------------------------------------------------------
// SERVER SETUP
// -----------------------------------------------------------------------------

const server = new Server(
  {
    name: "google-drive-mcp",
    version: VERSION,
  },
  {
    capabilities: {
      resources: {},
      tools: {},
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
      log('Authentication already in progress, waiting...');
      authClient = await authenticationPromise;
      return;
    }

    log('Initializing authentication');
    // Store the promise to prevent concurrent authentication attempts
    authenticationPromise = authenticate();

    try {
      authClient = await authenticationPromise;
      log('Authentication complete', {
        authClientType: authClient?.constructor?.name,
        hasCredentials: !!authClient?.credentials,
        hasAccessToken: !!authClient?.credentials?.access_token
      });
      // Ensure drive service is created with auth
      ensureDriveService();
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
  log('Handling ListResources request', { params: request.params });
  const pageSize = 10;
  const params: {
    pageSize: number,
    fields: string,
    pageToken?: string,
    q: string,
    includeItemsFromAllDrives: boolean,
    supportsAllDrives: boolean
  } = {
    pageSize,
    fields: "nextPageToken, files(id, name, mimeType)",
    q: `trashed = false`,
    includeItemsFromAllDrives: true,
    supportsAllDrives: true
  };

  if (request.params?.cursor) {
    params.pageToken = request.params.cursor;
  }

  const res = await drive!.files.list(params);
  log('Listed files', { count: res.data.files?.length });
  const files = res.data.files || [];

  return {
    resources: files.map((file: drive_v3.Schema$File) => ({
      uri: `gdrive:///${file.id}`,
      mimeType: file.mimeType || 'application/octet-stream',
      name: file.name || 'Untitled',
    })),
    nextCursor: res.data.nextPageToken,
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  await ensureAuthenticated();
  log('Handling ReadResource request', { uri: request.params.uri });
  const fileId = request.params.uri.replace("gdrive:///", "");

  const file = await drive!.files.get({
    fileId,
    fields: "mimeType",
    supportsAllDrives: true
  });
  const mimeType = file.data.mimeType;

  if (!mimeType) {
    throw new Error("File has no MIME type.");
  }

  if (mimeType.startsWith("application/vnd.google-apps")) {
    // Export logic for Google Docs/Sheets/Slides
    let exportMimeType;
    switch (mimeType) {
      case "application/vnd.google-apps.document": exportMimeType = "text/markdown"; break;
      case "application/vnd.google-apps.spreadsheet": exportMimeType = "text/csv"; break;
      case "application/vnd.google-apps.presentation": exportMimeType = "text/plain"; break;
      case "application/vnd.google-apps.drawing": exportMimeType = "image/png"; break;
      default: exportMimeType = "text/plain"; break;
    }

    const res = await drive!.files.export(
      { fileId, mimeType: exportMimeType },
      { responseType: "text" },
    );

    log('Successfully read resource', { fileId, mimeType });
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
// TOOL CALL REQUEST HANDLER
// -----------------------------------------------------------------------------

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  console.error(`[DEBUG] CallTool handler called for tool: ${request.params.name}`);
  await ensureAuthenticated();
  console.error(`[DEBUG] After ensureAuthenticated - authClient exists: ${!!authClient}, drive exists: ${!!drive}`);
  log('Handling tool request', { tool: request.params.name });

  try {
    const args = request.params.arguments;

    // Get Google API services
    const docs = getDocsService(authClient);
    const sheets = getSheetsService(authClient);
    const slides = getSlidesService(authClient);

    switch (request.params.name) {
      // Drive tools
      case "search":
        return handleSearch(drive!, args);
      case "createTextFile":
        return handleCreateTextFile(drive!, args);
      case "updateTextFile":
        return handleUpdateTextFile(drive!, args);
      case "createFolder":
        return handleCreateFolder(drive!, args);
      case "listFolder":
        return handleListFolder(drive!, args);
      case "deleteItem":
        return handleDeleteItem(drive!, args);
      case "renameItem":
        return handleRenameItem(drive!, args);
      case "moveItem":
        return handleMoveItem(drive!, args);
      case "copyFile":
        return handleCopyFile(drive!, args);
      case "getFileMetadata":
        return handleGetFileMetadata(drive!, args);
      case "exportFile":
        return handleExportFile(drive!, args);
      case "shareFile":
        return handleShareFile(drive!, args);
      case "getSharing":
        return handleGetSharing(drive!, args);
      case "listRevisions":
        return handleListRevisions(drive!, args);
      case "restoreRevision":
        return handleRestoreRevision(drive!, args);
      case "downloadFile":
        return handleDownloadFile(drive!, args);
      case "uploadFile":
        return handleUploadFile(drive!, args);
      case "getStorageQuota":
        return handleGetStorageQuota(drive!, args);
      case "starFile":
        return handleStarFile(drive!, args);

      // Docs tools
      case "createGoogleDoc":
        return handleCreateGoogleDoc(drive!, docs, args);
      case "updateGoogleDoc":
        return handleUpdateGoogleDoc(docs, args);
      case "formatGoogleDocText":
        return handleFormatGoogleDocText(docs, args);
      case "formatGoogleDocParagraph":
        return handleFormatGoogleDocParagraph(docs, args);
      case "getGoogleDocContent":
        return handleGetGoogleDocContent(docs, args);
      case "appendToDoc":
        return handleAppendToDoc(docs, args);

      // Sheets tools
      case "createGoogleSheet":
        return handleCreateGoogleSheet(drive!, sheets, args);
      case "updateGoogleSheet":
        return handleUpdateGoogleSheet(sheets, args);
      case "getGoogleSheetContent":
        return handleGetGoogleSheetContent(sheets, args);
      case "formatGoogleSheetCells":
        return handleFormatGoogleSheetCells(sheets, args);
      case "formatGoogleSheetText":
        return handleFormatGoogleSheetText(sheets, args);
      case "formatGoogleSheetNumbers":
        return handleFormatGoogleSheetNumbers(sheets, args);
      case "setGoogleSheetBorders":
        return handleSetGoogleSheetBorders(sheets, args);
      case "mergeGoogleSheetCells":
        return handleMergeGoogleSheetCells(sheets, args);
      case "addGoogleSheetConditionalFormat":
        return handleAddGoogleSheetConditionalFormat(sheets, args);
      case "createSheetTab":
        return handleCreateSheetTab(sheets, args);
      case "deleteSheetTab":
        return handleDeleteSheetTab(sheets, args);
      case "renameSheetTab":
        return handleRenameSheetTab(sheets, args);

      // Slides tools
      case "createGoogleSlides":
        return handleCreateGoogleSlides(drive!, slides, args);
      case "updateGoogleSlides":
        return handleUpdateGoogleSlides(slides, args);
      case "getGoogleSlidesContent":
        return handleGetGoogleSlidesContent(slides, args);
      case "formatGoogleSlidesText":
        return handleFormatGoogleSlidesText(slides, args);
      case "formatGoogleSlidesParagraph":
        return handleFormatGoogleSlidesParagraph(slides, args);
      case "styleGoogleSlidesShape":
        return handleStyleGoogleSlidesShape(slides, args);
      case "setGoogleSlidesBackground":
        return handleSetGoogleSlidesBackground(slides, args);
      case "createGoogleSlidesTextBox":
        return handleCreateGoogleSlidesTextBox(slides, args);
      case "createGoogleSlidesShape":
        return handleCreateGoogleSlidesShape(slides, args);
      case "getGoogleSlidesSpeakerNotes":
        return handleGetGoogleSlidesSpeakerNotes(slides, args);
      case "updateGoogleSlidesSpeakerNotes":
        return handleUpdateGoogleSlidesSpeakerNotes(slides, args);

      default:
        return errorResponse(`Unknown tool: ${request.params.name}`);
    }
  } catch (error: any) {
    log('Tool error', { error: error.message || error });
    return errorResponse(error.message || String(error));
  }
});

// -----------------------------------------------------------------------------
// CLI HELPER FUNCTIONS
// -----------------------------------------------------------------------------

function showHelp(): void {
  console.log(`
Google Drive MCP Server v${VERSION}

Usage:
  npx @yourusername/google-drive-mcp [command]

Commands:
  auth     Run the authentication flow
  start    Start the MCP server (default)
  version  Show version information
  help     Show this help message

Examples:
  npx @yourusername/google-drive-mcp auth
  npx @yourusername/google-drive-mcp start
  npx @yourusername/google-drive-mcp version
  npx @yourusername/google-drive-mcp

Environment Variables:
  GOOGLE_DRIVE_OAUTH_CREDENTIALS   Path to OAuth credentials file
  GOOGLE_DRIVE_MCP_TOKEN_PATH      Path to store authentication tokens
`);
}

function showVersion(): void {
  console.log(`Google Drive MCP Server v${VERSION}`);
}

async function runAuthServer(): Promise<void> {
  try {
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

function parseCliArgs(): { command: string | undefined } {
  const args = process.argv.slice(2);
  let command: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // Handle special version/help flags as commands
    if (arg === '--version' || arg === '-v' || arg === '--help' || arg === '-h') {
      command = arg;
      continue;
    }

    // Check for command (first non-option argument)
    if (!command && !arg.startsWith('--')) {
      command = arg;
      continue;
    }
  }

  return { command };
}

async function main() {
  const { command } = parseCliArgs();

  switch (command) {
    case "auth":
      await runAuthServer();
      break;
    case "start":
    case undefined:
      try {
        // Start the MCP server
        console.error("Starting Google Drive MCP server...");
        const transport = new StdioServerTransport();
        await server.connect(transport);
        log('Server started successfully');

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
        console.error('Failed to start server:', error);
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
