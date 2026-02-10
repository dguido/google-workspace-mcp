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
  authErrorResponse,
  isConfigurationError,
  DIAGNOSTIC_HINT,
  getDocsService,
  getSheetsService,
  getSlidesService,
  getCalendarService,
  getGmailService,
  getPeopleService,
} from "./utils/index.js";

// Import service configuration
import {
  isServiceEnabled,
  areUnifiedToolsEnabled,
  getEnabledServices,
  isReadOnlyMode,
} from "./config/index.js";

// Import auth utilities for startup logging
import {
  getSecureTokenPath,
  getKeysFilePath,
  getConfigDirectory,
  getActiveProfile,
  getEnvVarCredentials,
} from "./auth/utils.js";

// Import all tool definitions
import { getAllTools } from "./tools/index.js";

// Import error utilities
import { mapGoogleError, isGoogleApiError, GoogleAuthError } from "./errors/index.js";

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
  handleSheetTabs,
  // Slides handlers
  handleCreateGoogleSlides,
  handleUpdateGoogleSlides,
  handleGetGoogleSlidesContent,
  handleCreateGoogleSlidesTextBox,
  handleCreateGoogleSlidesShape,
  handleSlidesSpeakerNotes,
  handleFormatSlidesText,
  handleFormatSlidesShape,
  handleFormatSlideBackground,
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
  // Gmail handlers
  handleSendEmail,
  handleDraftEmail,
  handleReadEmail,
  handleSearchEmails,
  handleDeleteEmail,
  handleModifyEmail,
  handleDownloadAttachment,
  handleCreateLabel,
  handleUpdateLabel,
  handleDeleteLabel,
  handleListLabels,
  handleGetOrCreateLabel,
  handleCreateFilter,
  handleListFilters,
  handleDeleteFilter,
  // Contacts handlers
  handleListContacts,
  handleGetContact,
  handleSearchContacts,
  handleCreateContact,
  handleUpdateContact,
  handleDeleteContact,
  // Discovery handlers
  handleListTools,
  // Status handler
  handleGetStatus,
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
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Package.json structure is known
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as { version: string };
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
    const email = response.data.user?.emailAddress;
    log("Auth verification successful", {
      user: email ? `${email.split("@")[0].slice(0, 2)}***@${email.split("@")[1]}` : "unknown",
    });
    lastAuthError = null;
    return true;
  } catch (error: unknown) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Accessing error properties
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
    instructions:
      "On any tool error, call get_status for diagnostics " + "before asking the user to debug.",
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
      const hasCredentials = !!authClient?.credentials;
      const hasAccessToken = !!authClient?.credentials?.access_token;
      log("Authentication complete", {
        authClientType: authClient?.constructor?.name,
        hasCredentials,
        hasAccessToken,
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
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Google API response data
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
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Google API response data
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
import type { docs_v1, sheets_v4, slides_v1, calendar_v3, gmail_v1, people_v1 } from "googleapis";

interface ToolServices {
  drive: drive_v3.Drive;
  docs: docs_v1.Docs;
  sheets: sheets_v4.Sheets;
  slides: slides_v1.Slides;
  calendar: calendar_v3.Calendar;
  gmail: gmail_v1.Gmail;
  people: people_v1.People;
  context: HandlerContext;
}

type ToolHandler = (services: ToolServices, args: unknown) => Promise<ToolResponse>;

function createToolRegistry(): Record<string, ToolHandler> {
  const registry: Record<string, ToolHandler> = {};

  // Discovery and status tools (always available, no auth required for status)
  Object.assign(registry, {
    list_tools: (_services, args) => handleListTools(args),
    get_status: ({ drive }, args) => handleGetStatus(authClient, drive, VERSION, args),
  } satisfies Record<string, ToolHandler>);

  // Drive tools
  if (isServiceEnabled("drive")) {
    Object.assign(registry, {
      search: ({ drive }, args) => handleSearch(drive, args),
      create_text_file: ({ drive }, args) => handleCreateTextFile(drive, args),
      update_text_file: ({ drive }, args) => handleUpdateTextFile(drive, args),
      create_folder: ({ drive }, args) => handleCreateFolder(drive, args),
      list_folder: ({ drive }, args) => handleListFolder(drive, args),
      delete_item: ({ drive }, args) => handleDeleteItem(drive, args),
      rename_item: ({ drive }, args) => handleRenameItem(drive, args),
      move_item: ({ drive }, args) => handleMoveItem(drive, args),
      copy_file: ({ drive }, args) => handleCopyFile(drive, args),
      get_file_metadata: ({ drive }, args) => handleGetFileMetadata(drive, args),
      export_file: ({ drive }, args) => handleExportFile(drive, args),
      share_file: ({ drive }, args) => handleShareFile(drive, args),
      get_sharing: ({ drive }, args) => handleGetSharing(drive, args),
      list_revisions: ({ drive }, args) => handleListRevisions(drive, args),
      restore_revision: ({ drive }, args) => handleRestoreRevision(drive, args),
      download_file: ({ drive }, args) => handleDownloadFile(drive, args),
      upload_file: ({ drive }, args) => handleUploadFile(drive, args),
      get_storage_quota: ({ drive }, args) => handleGetStorageQuota(drive, args),
      star_file: ({ drive }, args) => handleStarFile(drive, args),
      resolve_file_path: ({ drive, context }, args) => handleResolveFilePath(drive, args, context),
      batch_delete: ({ drive, context }, args) => handleBatchDelete(drive, args, context),
      batch_restore: ({ drive, context }, args) => handleBatchRestore(drive, args, context),
      batch_move: ({ drive, context }, args) => handleBatchMove(drive, args, context),
      batch_share: ({ drive, context }, args) => handleBatchShare(drive, args, context),
      remove_permission: ({ drive }, args) => handleRemovePermission(drive, args),
      list_trash: ({ drive }, args) => handleListTrash(drive, args),
      restore_from_trash: ({ drive }, args) => handleRestoreFromTrash(drive, args),
      empty_trash: ({ drive, context }, args) => handleEmptyTrash(drive, args, context),
      get_folder_tree: ({ drive }, args) => handleGetFolderTree(drive, args),
    } satisfies Record<string, ToolHandler>);
  }

  // Docs tools
  if (isServiceEnabled("docs")) {
    Object.assign(registry, {
      create_google_doc: ({ drive, docs }, args) => handleCreateGoogleDoc(drive, docs, args),
      update_google_doc: ({ docs }, args) => handleUpdateGoogleDoc(docs, args),
      get_google_doc_content: ({ drive, docs }, args) =>
        handleGetGoogleDocContent(drive, docs, args),
      append_to_doc: ({ docs }, args) => handleAppendToDoc(docs, args),
      insert_text_in_doc: ({ docs }, args) => handleInsertTextInDoc(docs, args),
      delete_text_in_doc: ({ docs }, args) => handleDeleteTextInDoc(docs, args),
      replace_text_in_doc: ({ docs }, args) => handleReplaceTextInDoc(docs, args),
      format_google_doc_range: ({ docs }, args) => handleFormatGoogleDocRange(docs, args),
    } satisfies Record<string, ToolHandler>);
  }

  // Sheets tools
  if (isServiceEnabled("sheets")) {
    Object.assign(registry, {
      create_google_sheet: ({ drive, sheets }, args) =>
        handleCreateGoogleSheet(drive, sheets, args),
      update_google_sheet: ({ sheets }, args) => handleUpdateGoogleSheet(sheets, args),
      get_google_sheet_content: ({ drive, sheets }, args) =>
        handleGetGoogleSheetContent(drive, sheets, args),
      format_google_sheet_cells: ({ sheets }, args) => handleFormatGoogleSheetCells(sheets, args),
      merge_google_sheet_cells: ({ sheets }, args) => handleMergeGoogleSheetCells(sheets, args),
      add_google_sheet_conditional_format: ({ sheets }, args) =>
        handleAddGoogleSheetConditionalFormat(sheets, args),
      sheet_tabs: ({ sheets }, args) => handleSheetTabs(sheets, args),
    } satisfies Record<string, ToolHandler>);
  }

  // Slides tools
  if (isServiceEnabled("slides")) {
    Object.assign(registry, {
      create_google_slides: ({ drive, slides }, args) =>
        handleCreateGoogleSlides(drive, slides, args),
      update_google_slides: ({ slides }, args) => handleUpdateGoogleSlides(slides, args),
      get_google_slides_content: ({ drive, slides }, args) =>
        handleGetGoogleSlidesContent(drive, slides, args),
      create_google_slides_text_box: ({ slides }, args) =>
        handleCreateGoogleSlidesTextBox(slides, args),
      create_google_slides_shape: ({ slides }, args) => handleCreateGoogleSlidesShape(slides, args),
      slides_speaker_notes: ({ slides }, args) => handleSlidesSpeakerNotes(slides, args),
      format_slides_text: ({ slides }, args) => handleFormatSlidesText(slides, args),
      format_slides_shape: ({ slides }, args) => handleFormatSlidesShape(slides, args),
      format_slide_background: ({ slides }, args) => handleFormatSlideBackground(slides, args),
      list_slide_pages: ({ slides }, args) => handleListSlidePages(slides, args),
    } satisfies Record<string, ToolHandler>);
  }

  // Unified smart tools (require drive+docs+sheets+slides)
  if (areUnifiedToolsEnabled()) {
    Object.assign(registry, {
      create_file: ({ drive, docs, sheets, slides }, args) =>
        handleCreateFile(drive, docs, sheets, slides, args),
      update_file: ({ drive, docs, sheets, slides }, args) =>
        handleUpdateFile(drive, docs, sheets, slides, args),
      get_file_content: ({ drive, docs, sheets, slides }, args) =>
        handleGetFileContent(drive, docs, sheets, slides, args),
    } satisfies Record<string, ToolHandler>);
  }

  // Calendar tools
  if (isServiceEnabled("calendar")) {
    Object.assign(registry, {
      list_calendars: ({ calendar }, args) => handleListCalendars(calendar, args),
      list_events: ({ calendar }, args) => handleListEvents(calendar, args),
      get_event: ({ calendar }, args) => handleGetEvent(calendar, args),
      create_event: ({ calendar }, args) => handleCreateEvent(calendar, args),
      update_event: ({ calendar }, args) => handleUpdateEvent(calendar, args),
      delete_event: ({ calendar }, args) => handleDeleteEvent(calendar, args),
      find_free_time: ({ calendar }, args) => handleFindFreeTime(calendar, args),
    } satisfies Record<string, ToolHandler>);
  }

  // Gmail tools
  if (isServiceEnabled("gmail")) {
    Object.assign(registry, {
      send_email: ({ gmail }, args) => handleSendEmail(gmail, args),
      draft_email: ({ gmail }, args) => handleDraftEmail(gmail, args),
      read_email: ({ gmail }, args) => handleReadEmail(gmail, args),
      search_emails: ({ gmail }, args) => handleSearchEmails(gmail, args),
      delete_email: ({ gmail }, args) => handleDeleteEmail(gmail, args),
      modify_email: ({ gmail }, args) => handleModifyEmail(gmail, args),
      download_attachment: ({ gmail }, args) => handleDownloadAttachment(gmail, args),
      create_label: ({ gmail }, args) => handleCreateLabel(gmail, args),
      update_label: ({ gmail }, args) => handleUpdateLabel(gmail, args),
      delete_label: ({ gmail }, args) => handleDeleteLabel(gmail, args),
      list_labels: ({ gmail }, args) => handleListLabels(gmail, args),
      get_or_create_label: ({ gmail }, args) => handleGetOrCreateLabel(gmail, args),
      create_filter: ({ gmail }, args) => handleCreateFilter(gmail, args),
      list_filters: ({ gmail }, args) => handleListFilters(gmail, args),
      delete_filter: ({ gmail }, args) => handleDeleteFilter(gmail, args),
    } satisfies Record<string, ToolHandler>);
  }

  // Contacts tools
  if (isServiceEnabled("contacts")) {
    Object.assign(registry, {
      list_contacts: ({ people }, args) => handleListContacts(people, args),
      get_contact: ({ people }, args) => handleGetContact(people, args),
      search_contacts: ({ people }, args) => handleSearchContacts(people, args),
      create_contact: ({ people }, args) => handleCreateContact(people, args),
      update_contact: ({ people }, args) => handleUpdateContact(people, args),
      delete_contact: ({ people }, args) => handleDeleteContact(people, args),
    } satisfies Record<string, ToolHandler>);
  }

  // In read-only mode, remove write tools from the registry
  if (isReadOnlyMode()) {
    const readOnlyTools = new Set(getAllTools().map((t) => t.name));
    for (const name of Object.keys(registry)) {
      if (!readOnlyTools.has(name)) {
        delete registry[name];
      }
    }
  }

  return registry;
}

const toolRegistry = createToolRegistry();

// -----------------------------------------------------------------------------
// TOOL CALL REQUEST HANDLER
// -----------------------------------------------------------------------------

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;
  const args = request.params.arguments;

  // Status/discovery tools work without auth
  if (toolName === "get_status") {
    return handleGetStatus(authClient, drive, VERSION, args);
  }
  if (toolName === "list_tools") {
    return handleListTools(args);
  }

  await ensureAuthenticated();
  log("Handling tool request", { tool: toolName });

  try {
    const meta = (request.params as { _meta?: { progressToken?: string | number } })._meta;

    const services: ToolServices = {
      drive: drive!,
      docs: getDocsService(authClient!),
      sheets: getSheetsService(authClient!),
      slides: getSlidesService(authClient!),
      calendar: getCalendarService(authClient!),
      gmail: getGmailService(authClient!),
      people: getPeopleService(authClient!),
      context: { server, progressToken: meta?.progressToken },
    };

    const handler = toolRegistry[toolName];
    if (!handler) {
      return errorResponse(`Unknown tool: ${toolName}`);
    }

    return handler(services, args);
  } catch (error: unknown) {
    // Check if it's a GoogleAuthError (already mapped)
    if (error instanceof GoogleAuthError) {
      return authErrorResponse(error);
    }

    // Check if it's a Google API error and map it
    if (isGoogleApiError(error)) {
      const authError = mapGoogleError(error);
      return authErrorResponse(authError);
    }

    // Generic error handling
    const message = error instanceof Error ? error.message : String(error);
    log("Tool error", { error: message });

    const hint = isConfigurationError(message) ? DIAGNOSTIC_HINT : "";
    return errorResponse(message + hint);
  }
});

// -----------------------------------------------------------------------------
// CLI HELPER FUNCTIONS
// -----------------------------------------------------------------------------

function showHelp(): void {
  const configDir = getConfigDirectory();
  console.log(`
Google Workspace MCP Server v${VERSION}

Usage:
  npx @dguido/google-workspace-mcp [command] [options]

Commands:
  auth     Run the authentication flow
  start    Start the MCP server (default)
  version  Show version information
  help     Show this help message

Options:
  --profile <name>           Use a named profile for credentials and tokens
  --token-path <path>        Save tokens to custom path (overrides profile)

Default Paths:
  Credentials: ${configDir}/credentials.json
  Tokens:      ${configDir}/tokens.json

Profile Paths (when --profile or GOOGLE_WORKSPACE_MCP_PROFILE is set):
  Credentials: ${configDir}/profiles/<name>/credentials.json
  Tokens:      ${configDir}/profiles/<name>/tokens.json

Examples:
  npx @dguido/google-workspace-mcp auth
  npx @dguido/google-workspace-mcp auth --profile personal
  npx @dguido/google-workspace-mcp auth --profile work
  npx @dguido/google-workspace-mcp start
  npx @dguido/google-workspace-mcp

Environment Variables:
  GOOGLE_CLIENT_ID                 OAuth Client ID (simplest setup)
  GOOGLE_CLIENT_SECRET             OAuth Client Secret (used with GOOGLE_CLIENT_ID)
  GOOGLE_WORKSPACE_MCP_PROFILE     Named profile for credential isolation
  GOOGLE_WORKSPACE_MCP_TOKEN_PATH  Path to store authentication tokens (overrides profile)
  GOOGLE_WORKSPACE_READ_ONLY       Restrict to read-only operations (true/false)

Multi-Account Setup:
  Use named profiles to isolate credentials per project:
  1. Auth each profile: npx @dguido/google-workspace-mcp auth --profile personal
  2. Set profile in your project's MCP config:
     { "env": { "GOOGLE_WORKSPACE_MCP_PROFILE": "personal" } }
`);
}

function showVersion(): void {
  console.log(`Google Workspace MCP Server v${VERSION}`);
}

async function runAuthServer(tokenPath?: string): Promise<void> {
  try {
    // Set env vars from CLI flags (CLI takes precedence over existing env vars)
    if (tokenPath) {
      process.env.GOOGLE_WORKSPACE_MCP_TOKEN_PATH = tokenPath;
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
  profile?: string;
}

function parseCliArgs(): CliArgs {
  const args = process.argv.slice(2);
  let command: string | undefined;
  let tokenPath: string | undefined;
  let profile: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // Handle --token-path flag
    if (arg === "--token-path" && i + 1 < args.length) {
      tokenPath = args[++i];
      continue;
    }

    // Handle --profile flag
    if (arg === "--profile" && i + 1 < args.length) {
      profile = args[++i];
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

  return { command, tokenPath, profile };
}

async function main() {
  const { command, tokenPath, profile } = parseCliArgs();

  // Set profile env var early so all path resolution sees it
  if (profile) {
    process.env.GOOGLE_WORKSPACE_MCP_PROFILE = profile;
  }

  switch (command) {
    case "auth":
      await runAuthServer(tokenPath);
      break;
    case "start":
    case undefined:
      try {
        // Start the MCP server
        log("Starting Google Workspace MCP server...");
        const transport = new StdioServerTransport();
        await server.connect(transport);

        // Enhanced startup logging
        const enabledServices = Array.from(getEnabledServices());
        const configDir = getConfigDirectory();
        log("Server started", {
          version: VERSION,
          node: process.version,
          profile: getActiveProfile(),
          services: enabledServices,
          read_only: isReadOnlyMode(),
          config_dir: configDir,
          token_path: getSecureTokenPath(),
        });

        // Log OAuth config status (warning if missing)
        if (getEnvVarCredentials()) {
          log("Using credentials from GOOGLE_CLIENT_ID env var");
        } else {
          const credPath = getKeysFilePath();
          try {
            await import("fs").then((m) => m.promises.access(credPath));
          } catch {
            log("Warning: OAuth credentials not configured", {
              hint:
                "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET env vars " +
                `or save credentials to ${credPath}`,
              credentials_path: credPath,
            });
          }
        }

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
