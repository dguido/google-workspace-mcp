/**
 * Pre-flight validation for OAuth configuration.
 * Validates credentials before attempting OAuth flow.
 */

import * as fs from "fs/promises";
import { getKeysFilePath, getSecureTokenPath } from "../auth/utils.js";
import { GoogleAuthError } from "./google-auth-error.js";

const CONSOLE_URL = "https://console.cloud.google.com";

export interface ValidationResult {
  valid: boolean;
  errors: GoogleAuthError[];
  warnings: string[];
}

interface CredentialsFile {
  installed?: {
    client_id?: string;
    client_secret?: string;
    redirect_uris?: string[];
  };
  web?: {
    client_id?: string;
    client_secret?: string;
    redirect_uris?: string[];
  };
  client_id?: string;
  client_secret?: string;
  redirect_uris?: string[];
}

/**
 * Validate OAuth configuration before attempting auth flow.
 */
export async function validateOAuthConfig(): Promise<ValidationResult> {
  const errors: GoogleAuthError[] = [];
  const warnings: string[] = [];

  const keysPath = getKeysFilePath();
  const tokenPath = getSecureTokenPath();

  // Check if credentials file exists
  try {
    await fs.access(keysPath);
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
            url: "https://github.com/dguido/google-workspace-mcp#getting-started",
          },
        ],
      }),
    );
    return { valid: false, errors, warnings };
  }

  // Read and parse credentials file
  let credentials: CredentialsFile;
  try {
    const content = await fs.readFile(keysPath, "utf-8");
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
    return { valid: false, errors, warnings };
  }

  // Extract client_id from various credential formats
  const clientId =
    credentials.installed?.client_id || credentials.web?.client_id || credentials.client_id;

  const clientSecret =
    credentials.installed?.client_secret ||
    credentials.web?.client_secret ||
    credentials.client_secret;

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
  };
}

/**
 * Check if OAuth is configured (credentials file exists).
 */
export async function isOAuthConfigured(): Promise<boolean> {
  try {
    await fs.access(getKeysFilePath());
    return true;
  } catch {
    return false;
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
