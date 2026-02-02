import * as path from "path";
import * as os from "os";

/**
 * Get the config directory following XDG Base Directory spec.
 * Returns ~/.config/google-workspace-mcp by default, or uses XDG_CONFIG_HOME if set.
 */
export function getConfigDirectory(): string {
  const configHome = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  return path.join(configHome, "google-workspace-mcp");
}

/**
 * Get the legacy keys file path (cwd-based, pre-3.x behavior).
 * Used for migration fallback to maintain backwards compatibility.
 */
export function getLegacyKeysFilePath(): string {
  return path.join(process.cwd(), "gcp-oauth.keys.json");
}

// Returns the absolute path for the saved token file.
// Uses XDG Base Directory spec with fallback to home directory
export function getSecureTokenPath(): string {
  // Check for custom token path environment variable first (new name)
  const customTokenPath = process.env.GOOGLE_WORKSPACE_MCP_TOKEN_PATH;
  if (customTokenPath) {
    return path.resolve(customTokenPath);
  }

  // Legacy environment variable support
  const legacyTokenPath = process.env.GOOGLE_DRIVE_MCP_TOKEN_PATH;
  if (legacyTokenPath) {
    return path.resolve(legacyTokenPath);
  }

  // Use XDG Base Directory spec or fallback to ~/.config
  const configHome = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");

  const tokenDir = path.join(configHome, "google-workspace-mcp");
  return path.join(tokenDir, "tokens.json");
}

/**
 * Returns the absolute path for the GCP OAuth keys file with priority:
 * 1. Environment variable GOOGLE_DRIVE_OAUTH_CREDENTIALS (highest priority, for power users)
 * 2. New default in config directory: ~/.config/google-workspace-mcp/credentials.json
 *
 * Legacy fallback to ./gcp-oauth.keys.json is handled in loadCredentialsWithFallback().
 */
export function getKeysFilePath(): string {
  // Priority 1: Environment variable (power users)
  const envCredentialsPath = process.env.GOOGLE_DRIVE_OAUTH_CREDENTIALS;
  if (envCredentialsPath) {
    return path.resolve(envCredentialsPath);
  }

  // Priority 2: New default in config directory
  return path.join(getConfigDirectory(), "credentials.json");
}

// Interface for OAuth credentials
export interface OAuthCredentials {
  client_id: string;
  client_secret?: string;
  redirect_uris?: string[];
}

// Credentials file format (supports installed, web, and flat formats)
export interface CredentialsFileInput {
  installed?: { client_id?: string; client_secret?: string; redirect_uris?: string[] };
  web?: { client_id?: string; client_secret?: string; redirect_uris?: string[] };
  client_id?: string;
  client_secret?: string;
  redirect_uris?: string[];
}

/**
 * Extract OAuth credentials from various credential file formats.
 * Supports: installed (Desktop app), web (Web app), and flat (simplified) formats.
 * @returns OAuthCredentials if extraction succeeds, null if no client_id found
 */
export function extractCredentials(keys: CredentialsFileInput): OAuthCredentials | null {
  // Try installed format first (most common for desktop apps)
  if (keys.installed?.client_id) {
    return {
      client_id: keys.installed.client_id,
      client_secret: keys.installed.client_secret,
      redirect_uris: keys.installed.redirect_uris,
    };
  }

  // Try web format
  if (keys.web?.client_id) {
    return {
      client_id: keys.web.client_id,
      client_secret: keys.web.client_secret,
      redirect_uris: keys.web.redirect_uris,
    };
  }

  // Try flat format (direct client_id at root)
  if (keys.client_id) {
    return {
      client_id: keys.client_id,
      client_secret: keys.client_secret,
      redirect_uris: keys.redirect_uris || ["http://127.0.0.1/oauth2callback"],
    };
  }

  return null;
}

// Generate helpful error message for missing credentials
export function generateCredentialsErrorMessage(): string {
  const configDir = getConfigDirectory();
  const defaultPath = path.join(configDir, "credentials.json");

  return `
OAuth credentials not found. Please provide credentials using one of these methods:

1. Default location (recommended):
   Save your credentials file to: ${defaultPath}

2. Environment variable (for custom paths):
   Set GOOGLE_DRIVE_OAUTH_CREDENTIALS to the path of your credentials file:
   export GOOGLE_DRIVE_OAUTH_CREDENTIALS="/path/to/credentials.json"

Token storage:
- Tokens are saved to: ${getSecureTokenPath()}
- To use a custom token location, set GOOGLE_WORKSPACE_MCP_TOKEN_PATH environment variable

To get OAuth credentials:
1. Go to the Google Cloud Console (https://console.cloud.google.com/)
2. Create or select a project
3. Enable the Google Drive, Docs, Sheets, and Slides APIs
4. Create OAuth 2.0 credentials (Desktop app type)
5. Download the credentials file and save to: ${defaultPath}
`.trim();
}
