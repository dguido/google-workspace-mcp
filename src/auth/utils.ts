import * as path from "path";
import * as os from "os";
import * as fs from "fs/promises";

/**
 * Get the config directory following XDG Base Directory spec.
 * XDG_CONFIG_HOME must be absolute path per spec; falls back to ~/.config if invalid.
 */
export function getConfigDirectory(): string {
  const xdgConfigHome = process.env.XDG_CONFIG_HOME;
  const configHome =
    xdgConfigHome && path.isAbsolute(xdgConfigHome)
      ? xdgConfigHome
      : path.join(os.homedir(), ".config");
  return path.join(configHome, "google-workspace-mcp");
}

const PROFILE_NAME_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

/** Get active profile name from env var, or null. */
export function getActiveProfile(): string | null {
  const profile = process.env.GOOGLE_WORKSPACE_MCP_PROFILE;
  if (!profile) return null;
  if (!PROFILE_NAME_PATTERN.test(profile)) {
    throw new Error(
      `Invalid profile name "${profile}". ` +
        "Must be 1-64 chars: letters, digits, " +
        "hyphens, underscores.",
    );
  }
  return profile;
}

/** Get directory for a named profile. */
export function getProfileDirectory(name: string): string {
  if (!PROFILE_NAME_PATTERN.test(name)) {
    throw new Error(
      `Invalid profile name "${name}". ` +
        "Must be 1-64 chars: letters, digits, " +
        "hyphens, underscores.",
    );
  }
  return path.join(getConfigDirectory(), "profiles", name);
}

// Returns the absolute path for the saved token file.
// Uses XDG Base Directory spec with fallback to home directory
export function getSecureTokenPath(): string {
  // Check for custom token path environment variable
  const customTokenPath = process.env.GOOGLE_WORKSPACE_MCP_TOKEN_PATH;
  if (customTokenPath) {
    return path.resolve(customTokenPath);
  }

  // Named profile
  const profile = getActiveProfile();
  if (profile) {
    return path.join(getProfileDirectory(profile), "tokens.json");
  }

  // Default: XDG config directory
  return path.join(getConfigDirectory(), "tokens.json");
}

/**
 * Returns the absolute path for the OAuth credentials file.
 * Priority: named profile → XDG config directory default.
 */
export function getKeysFilePath(): string {
  // Named profile
  const profile = getActiveProfile();
  if (profile) {
    return path.join(getProfileDirectory(profile), "credentials.json");
  }

  // Default in config directory
  return path.join(getConfigDirectory(), "credentials.json");
}

// Interface for OAuth credentials
export interface OAuthCredentials {
  client_id: string;
  client_secret?: string;
  redirect_uris?: string[];
}

const CLIENT_ID_SUFFIX = ".apps.googleusercontent.com";

export function isValidClientIdFormat(clientId: string): boolean {
  return clientId.endsWith(CLIENT_ID_SUFFIX);
}

/**
 * Get OAuth credentials from environment variables.
 * Returns null if GOOGLE_CLIENT_ID is not set or empty.
 */
export function getEnvVarCredentials(): OAuthCredentials | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!clientId) return null;
  return {
    client_id: clientId,
    client_secret: process.env.GOOGLE_CLIENT_SECRET?.trim() || undefined,
    redirect_uris: ["http://127.0.0.1/oauth2callback"],
  };
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
  const profile = getActiveProfile();
  const profileNote = profile
    ? `\nActive profile: "${profile}"\n` +
      `Profile directory: ` +
      `${getProfileDirectory(profile)}\n`
    : "";
  const batchApiUrl =
    "https://console.cloud.google.com/flows/enableapi" +
    "?apiid=drive.googleapis.com,docs.googleapis.com," +
    "sheets.googleapis.com,slides.googleapis.com," +
    "calendar-json.googleapis.com,gmail.googleapis.com," +
    "people.googleapis.com";

  return `
OAuth credentials not found. Please provide credentials using one of these methods:

1. Environment variables (simplest):
   Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your MCP config:
   { "env": { "GOOGLE_CLIENT_ID": "YOUR_ID", "GOOGLE_CLIENT_SECRET": "YOUR_SECRET" } }

2. Credentials file (default location):
   Save your credentials file to: ${defaultPath}
${profileNote}
Token storage:
- Tokens are saved to: ${getSecureTokenPath()}
- To use a custom token location, set GOOGLE_WORKSPACE_MCP_TOKEN_PATH environment variable

To get OAuth credentials:
1. Go to the Google Cloud Console (https://console.cloud.google.com/)
2. Create or select a project
3. Enable APIs: ${batchApiUrl}
4. Create OAuth 2.0 credentials (Desktop app type)
5. Copy the Client ID and Client Secret into your MCP config env vars
`.trim();
}

/**
 * Check if the credentials file exists at getKeysFilePath().
 */
export async function credentialsFileExists(): Promise<boolean> {
  try {
    await fs.access(getKeysFilePath());
    return true;
  } catch {
    return false;
  }
}
