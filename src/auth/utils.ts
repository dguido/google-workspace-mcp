import * as path from "path";
import * as os from "os";

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

// Returns the absolute path for the GCP OAuth keys file with priority:
// 1. Environment variable GOOGLE_DRIVE_OAUTH_CREDENTIALS (highest priority)
// 2. Current working directory (works for both local dev and npx)
export function getKeysFilePath(): string {
  // Priority 1: Environment variable
  const envCredentialsPath = process.env.GOOGLE_DRIVE_OAUTH_CREDENTIALS;
  if (envCredentialsPath) {
    return path.resolve(envCredentialsPath);
  }

  // Priority 2: Current working directory
  // For local dev: user runs from project root, so cwd has the keys
  // For npx: user runs from a directory where they've placed their keys
  return path.join(process.cwd(), "gcp-oauth.keys.json");
}

// Interface for OAuth credentials
export interface OAuthCredentials {
  client_id: string;
  client_secret?: string;
  redirect_uris?: string[];
}

// Generate helpful error message for missing credentials
export function generateCredentialsErrorMessage(): string {
  return `
OAuth credentials not found. Please provide credentials using one of these methods:

1. Environment variable:
   Set GOOGLE_DRIVE_OAUTH_CREDENTIALS to the path of your credentials file:
   export GOOGLE_DRIVE_OAUTH_CREDENTIALS="/path/to/gcp-oauth.keys.json"

2. Default file path:
   Place your gcp-oauth.keys.json file in the package root directory.

Token storage:
- Tokens are saved to: ${getSecureTokenPath()}
- To use a custom token location, set GOOGLE_WORKSPACE_MCP_TOKEN_PATH environment variable

To get OAuth credentials:
1. Go to the Google Cloud Console (https://console.cloud.google.com/)
2. Create or select a project
3. Enable the Google Drive, Docs, Sheets, and Slides APIs
4. Create OAuth 2.0 credentials (Desktop app type)
5. Download the credentials file as gcp-oauth.keys.json
`.trim();
}
