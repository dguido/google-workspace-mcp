import { OAuth2Client } from "google-auth-library";
import * as fs from "fs/promises";
import {
  getKeysFilePath,
  generateCredentialsErrorMessage,
  extractCredentials,
  getEnvVarCredentials,
  type OAuthCredentials,
} from "./utils.js";
import { validateOAuthConfig, GoogleAuthError } from "../errors/index.js";
import { log } from "../utils/logging.js";
import { parseCredentialsFile } from "../types/credentials.js";

async function loadCredentialsWithFallback(): Promise<OAuthCredentials> {
  // Highest priority: env var credentials (GOOGLE_CLIENT_ID)
  const envCredentials = getEnvVarCredentials();
  if (envCredentials) {
    log("Using credentials from GOOGLE_CLIENT_ID env var");
    return envCredentials;
  }

  // File-based credentials at the default/profile path
  const keysPath = getKeysFilePath();
  try {
    const content = await fs.readFile(keysPath, "utf-8");
    const keys = parseCredentialsFile(content);
    const credentials = extractCredentials(keys);
    if (!credentials) {
      throw new Error(`Invalid credentials format in ${keysPath}`);
    }
    return credentials;
  } catch (e) {
    const originalError = e instanceof Error ? e.message : String(e);
    const errorMessage = generateCredentialsErrorMessage();
    throw new Error(`${errorMessage}\n\nOriginal error: ${originalError}`);
  }
}

export async function initializeOAuth2Client(): Promise<OAuth2Client> {
  // Validate configuration first for better error messages
  const validation = await validateOAuthConfig();
  if (!validation.valid && validation.errors.length > 0) {
    throw validation.errors[0];
  }

  // Log any warnings
  if (validation.warnings.length > 0) {
    for (const warning of validation.warnings) {
      log(`Warning: ${warning}`);
    }
  }

  try {
    const credentials = await loadCredentialsWithFallback();

    // Use the first redirect URI as the default for the base client
    return new OAuth2Client({
      clientId: credentials.client_id,
      clientSecret: credentials.client_secret || undefined,
      redirectUri: credentials.redirect_uris?.[0] || "http://127.0.0.1/oauth2callback",
    });
  } catch (error) {
    if (error instanceof GoogleAuthError) {
      throw error;
    }
    throw new Error(
      `Error loading OAuth keys: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function loadCredentials(): Promise<{
  client_id: string;
  client_secret?: string;
}> {
  try {
    const credentials = await loadCredentialsWithFallback();

    if (!credentials.client_id) {
      throw new Error("Client ID missing in credentials.");
    }
    return {
      client_id: credentials.client_id,
      client_secret: credentials.client_secret,
    };
  } catch (error) {
    throw new Error(
      `Error loading credentials: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
