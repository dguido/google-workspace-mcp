/**
 * Pre-flight validation for OAuth configuration.
 * Validates credentials before attempting OAuth flow.
 */

import * as fs from "fs/promises";
import * as path from "path";
import {
  getKeysFilePath,
  getSecureTokenPath,
  extractCredentials,
  resolveCredentialsPath,
  getEnvVarCredentials,
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

/** Ensure token directory exists and is writable. */
async function ensureTokenDirWritable(warnings: string[]): Promise<void> {
  const tokenPath = getSecureTokenPath();
  const tokenDir = path.dirname(tokenPath);
  try {
    await fs.access(tokenDir, fs.constants.W_OK);
  } catch {
    try {
      await fs.mkdir(tokenDir, { recursive: true });
    } catch {
      warnings.push(`Token directory may not be writable: ${tokenPath}`);
    }
  }
}

/** Validate client_id/secret values and push errors/warnings. */
function validateCredentialValues(
  clientId: string,
  clientSecret: string | undefined,
  errors: GoogleAuthError[],
  warnings: string[],
): void {
  if (!clientId.endsWith(".apps.googleusercontent.com")) {
    errors.push(
      new GoogleAuthError({
        code: "INVALID_CLIENT",
        reason: "Invalid client_id format. " + "Expected to end with .apps.googleusercontent.com",
        fix: [
          "Verify you downloaded OAuth 2.0 Client credentials " +
            "(not Service Account or API Key)",
          "The client_id should look like: " + "123456789.apps.googleusercontent.com",
          "Download fresh credentials from Google Cloud Console",
        ],
        links: [
          {
            label: "OAuth Credentials",
            url: `${CONSOLE_URL}/apis/credentials`,
          },
        ],
      }),
    );
  }

  if (clientId !== clientId.trim()) {
    warnings.push("client_id contains leading or trailing whitespace");
  }

  if (clientId.length < 50) {
    warnings.push("client_id appears unusually short - may be truncated");
  }

  if (!clientSecret) {
    warnings.push("No client_secret found - some auth flows may not work");
  } else if (clientSecret !== clientSecret.trim()) {
    warnings.push("client_secret contains leading or trailing whitespace");
  }
}

/**
 * Validate OAuth configuration before attempting auth flow.
 */
export async function validateOAuthConfig(): Promise<ValidationResult> {
  const errors: GoogleAuthError[] = [];
  const warnings: string[] = [];

  // Highest priority: env var credentials (GOOGLE_CLIENT_ID)
  const envCreds = getEnvVarCredentials();
  if (envCreds) {
    validateCredentialValues(envCreds.client_id, envCreds.client_secret, errors, warnings);
    await ensureTokenDirWritable(warnings);
    return { valid: errors.length === 0, errors, warnings };
  }

  const keysPath = getKeysFilePath();

  // Check if credentials file exists (try new then legacy)
  const resolved = await resolveCredentialsPath();
  const resolvedCredentialsPath = resolved.path;

  if (!resolved.exists) {
    errors.push(
      new GoogleAuthError({
        code: "OAUTH_NOT_CONFIGURED",
        reason: `OAuth credentials file not found at: ${keysPath}`,
        fix: [
          "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET env vars " +
            "in your MCP config (simplest)",
          "Or go to Google Cloud Console > APIs & Services " + "> Credentials",
          'Create OAuth 2.0 Client ID (choose "Desktop app" type)',
          "Download the credentials JSON file",
          `Save it as: ${keysPath}`,
        ],
        links: [
          {
            label: "Create OAuth Credentials",
            url: `${CONSOLE_URL}/apis/credentials`,
          },
          { label: "Setup Guide", url: GITHUB_SETUP_GUIDE },
        ],
      }),
    );
    return { valid: false, errors, warnings };
  }

  if (resolved.isLegacy) {
    warnings.push(
      `Using legacy credentials location: ${resolved.path}. ` + `Please move to: ${keysPath}`,
    );
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
        links: [
          {
            label: "Download Credentials",
            url: `${CONSOLE_URL}/apis/credentials`,
          },
        ],
      }),
    );
    return { valid: false, errors, warnings, resolvedCredentialsPath };
  }

  // Extract credentials using shared helper
  const extracted = extractCredentials(credentials);
  const clientId = extracted?.client_id;

  if (!clientId) {
    errors.push(
      new GoogleAuthError({
        code: "OAUTH_NOT_CONFIGURED",
        reason: "Missing client_id in credentials file",
        fix: [
          "Download fresh credentials from Google Cloud Console",
          "Ensure you're downloading OAuth 2.0 Client ID " + "credentials (not API Key)",
          "The file should contain 'client_id' field",
        ],
        links: [
          {
            label: "OAuth Credentials",
            url: `${CONSOLE_URL}/apis/credentials`,
          },
        ],
      }),
    );
  } else {
    validateCredentialValues(clientId, extracted?.client_secret, errors, warnings);
  }

  await ensureTokenDirWritable(warnings);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    resolvedCredentialsPath,
  };
}

/**
 * Check if OAuth is configured (env vars or credentials file).
 */
export async function isOAuthConfigured(): Promise<boolean> {
  if (getEnvVarCredentials()) return true;
  const resolved = await resolveCredentialsPath();
  return resolved.exists;
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
