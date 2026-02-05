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

/**
 * Get the legacy keys file path (cwd-based, pre-3.x behavior).
 * Used for migration fallback to maintain backwards compatibility.
 */
export function getLegacyKeysFilePath(): string {
  return path.join(process.cwd(), "gcp-oauth.keys.json");
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

  // Named profile
  const profile = getActiveProfile();
  if (profile) {
    return path.join(getProfileDirectory(profile), "tokens.json");
  }

  // Default: XDG config directory
  return path.join(getConfigDirectory(), "tokens.json");
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

  // Priority 2: Named profile
  const profile = getActiveProfile();
  if (profile) {
    return path.join(getProfileDirectory(profile), "credentials.json");
  }

  // Priority 3: Default in config directory
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
  const profile = getActiveProfile();
  const profileNote = profile
    ? `\nActive profile: "${profile}"\n` +
      `Profile directory: ` +
      `${getProfileDirectory(profile)}\n`
    : "";

  return `
OAuth credentials not found. Please provide credentials using one of these methods:

1. Default location (recommended):
   Save your credentials file to: ${defaultPath}
${profileNote}
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

export interface ResolvedCredentialsPath {
  path: string;
  isLegacy: boolean;
  exists: boolean;
}

/**
 * Resolve the actual credentials path, checking new default then legacy locations.
 * Returns the path that exists (preferring new location), whether it's legacy, and if it exists.
 */
export async function resolveCredentialsPath(): Promise<ResolvedCredentialsPath> {
  const keysPath = getKeysFilePath();
  const legacyPath = getLegacyKeysFilePath();

  try {
    await fs.access(keysPath);
    return { path: keysPath, isLegacy: false, exists: true };
  } catch {
    try {
      await fs.access(legacyPath);
      return { path: legacyPath, isLegacy: true, exists: true };
    } catch {
      return { path: keysPath, isLegacy: false, exists: false };
    }
  }
}
