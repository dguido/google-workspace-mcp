/**
 * Pre-flight validation for OAuth configuration.
 * Validates credentials before attempting OAuth flow.
 */

import * as fs from "fs/promises";
import {
  getKeysFilePath,
  getLegacyKeysFilePath,
  getSecureTokenPath,
  extractCredentials,
} from "../auth/utils.js";
import { GoogleAuthError } from "./google-auth-error.js";
import type { CredentialsFile } from "../types/credentials.js";

const CONSOLE_URL = "https://console.cloud.google.com";
const GITHUB_SETUP_GUIDE = "https://github.com/dguido/google-workspace-mcp#getting-started";

export interface ValidationResult {
  valid: boolean;
  errors: GoogleAuthError[];
  warnings: string[];
  /** The path where credentials were actually found (may differ from getKeysFilePath() if using legacy) */
  resolvedCredentialsPath?: string;
}

/**
 * Validate OAuth configuration before attempting auth flow.
 */
export async function validateOAuthConfig(): Promise<ValidationResult> {
  const errors: GoogleAuthError[] = [];
  const warnings: string[] = [];

  const keysPath = getKeysFilePath();
  const legacyPath = getLegacyKeysFilePath();
  const tokenPath = getSecureTokenPath();

  // Check if credentials file exists (try new location first, then legacy)
  let resolvedCredentialsPath = keysPath;

  try {
    await fs.access(keysPath);
  } catch {
    // Try legacy location
    try {
      await fs.access(legacyPath);
      resolvedCredentialsPath = legacyPath;
      warnings.push(
        `Using legacy credentials location: ${legacyPath}. ` + `Please move to: ${keysPath}`,
      );
    } catch {
      errors.push(
        new GoogleAuthError({
          code: "OAUTH_NOT_CONFIGURED",
          reason: `OAuth credentials file not found at: ${keysPath}`,
          fix: [
            "Go to Google Cloud Console > APIs & Services > Credentials",
            'Create OAuth 2.0 Client ID (choose "Desktop app" type)',
            "Download the credentials JSON file",
            `Save it as: ${keysPath}`,
            "Or set GOOGLE_DRIVE_OAUTH_CREDENTIALS env var to point to your credentials file",
          ],
          links: [
            { label: "Create OAuth Credentials", url: `${CONSOLE_URL}/apis/credentials` },
            {
              label: "Setup Guide",
              url: GITHUB_SETUP_GUIDE,
            },
          ],
        }),
      );
      return { valid: false, errors, warnings };
    }
  }

  // Read and parse credentials file
  let credentials: CredentialsFile;
  try {
    const content = await fs.readFile(resolvedCredentialsPath, "utf-8");
    credentials = JSON.parse(content) as CredentialsFile;
  } catch (parseError) {
    errors.push(
      new GoogleAuthError({
        code: "OAUTH_NOT_CONFIGURED",
        reason: `Failed to parse credentials file: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
        fix: [
          "Ensure the credentials file is valid JSON",
          "Download a fresh credentials file from Google Cloud Console",
          "Make sure the file is not corrupted or truncated",
        ],
        links: [{ label: "Download Credentials", url: `${CONSOLE_URL}/apis/credentials` }],
      }),
    );
    return { valid: false, errors, warnings, resolvedCredentialsPath };
  }

  // Extract credentials using shared helper
  const extracted = extractCredentials(credentials);
  const clientId = extracted?.client_id;
  const clientSecret = extracted?.client_secret;

  // Validate client_id exists
  if (!clientId) {
    errors.push(
      new GoogleAuthError({
        code: "OAUTH_NOT_CONFIGURED",
        reason: "Missing client_id in credentials file",
        fix: [
          "Download fresh credentials from Google Cloud Console",
          "Ensure you're downloading OAuth 2.0 Client ID credentials (not API Key)",
          "The file should contain 'client_id' field",
        ],
        links: [{ label: "OAuth Credentials", url: `${CONSOLE_URL}/apis/credentials` }],
      }),
    );
  } else {
    // Validate client_id format
    if (!clientId.endsWith(".apps.googleusercontent.com")) {
      errors.push(
        new GoogleAuthError({
          code: "INVALID_CLIENT",
          reason: `Invalid client_id format. Expected to end with .apps.googleusercontent.com`,
          fix: [
            "Verify you downloaded OAuth 2.0 Client credentials (not Service Account or API Key)",
            "The client_id should look like: 123456789.apps.googleusercontent.com",
            "Download fresh credentials from Google Cloud Console",
          ],
          links: [{ label: "OAuth Credentials", url: `${CONSOLE_URL}/apis/credentials` }],
        }),
      );
    }

    // Check for whitespace issues
    if (clientId !== clientId.trim()) {
      warnings.push("client_id contains leading or trailing whitespace");
    }

    // Check for obviously truncated client_id
    if (clientId.length < 50) {
      warnings.push("client_id appears unusually short - may be truncated");
    }
  }

  // Validate client_secret exists (optional for some flows but recommended)
  if (!clientSecret) {
    warnings.push("No client_secret found - some auth flows may not work");
  } else if (clientSecret !== clientSecret.trim()) {
    warnings.push("client_secret contains leading or trailing whitespace");
  }

  // Check token path is writable
  try {
    const tokenDir = tokenPath.substring(0, tokenPath.lastIndexOf("/"));
    await fs.access(tokenDir, fs.constants.W_OK);
  } catch {
    // Directory might not exist yet - try to create it
    try {
      const tokenDir = tokenPath.substring(0, tokenPath.lastIndexOf("/"));
      await fs.mkdir(tokenDir, { recursive: true });
    } catch {
      warnings.push(`Token directory may not be writable: ${tokenPath}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    resolvedCredentialsPath,
  };
}

/**
 * Check if OAuth is configured (credentials file exists).
 * Checks both new default location and legacy location.
 */
export async function isOAuthConfigured(): Promise<boolean> {
  try {
    await fs.access(getKeysFilePath());
    return true;
  } catch {
    // Check legacy location
    try {
      await fs.access(getLegacyKeysFilePath());
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Check if tokens exist.
 */
export async function hasTokens(): Promise<boolean> {
  try {
    await fs.access(getSecureTokenPath());
    return true;
  } catch {
    return false;
  }
}
