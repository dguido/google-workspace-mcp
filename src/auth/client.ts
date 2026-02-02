import { OAuth2Client } from "google-auth-library";
import * as fs from "fs/promises";
import {
  getKeysFilePath,
  getLegacyKeysFilePath,
  generateCredentialsErrorMessage,
  extractCredentials,
  type OAuthCredentials,
} from "./utils.js";
import { validateOAuthConfig, GoogleAuthError } from "../errors/index.js";
import { log } from "../utils/logging.js";
import { parseCredentialsFile } from "../types/credentials.js";

async function loadCredentialsFromFile(): Promise<OAuthCredentials> {
  const keysContent = await fs.readFile(getKeysFilePath(), "utf-8");
  const keys = parseCredentialsFile(keysContent);
  const credentials = extractCredentials(keys);

  if (!credentials) {
    throw new Error(
      'Invalid credentials file format. Expected either "installed", "web" object or direct client_id field.',
    );
  }

  return credentials;
}

async function loadCredentialsWithFallback(): Promise<OAuthCredentials> {
  try {
    return await loadCredentialsFromFile();
  } catch (newPathError) {
    // Check legacy location: ./gcp-oauth.keys.json (pre-3.x behavior)
    const legacyPath = getLegacyKeysFilePath();
    try {
      const content = await fs.readFile(legacyPath, "utf-8");
      const keys = parseCredentialsFile(content);

      log("MIGRATION NOTICE: Found credentials at legacy location");
      log(`  Current: ${legacyPath}`);
      log(`  Recommended: ${getKeysFilePath()}`);
      log("  Move credentials to the recommended location to silence this warning.");

      const credentials = extractCredentials(keys);
      if (!credentials) {
        throw new Error("Invalid credentials format in legacy file");
      }
      return credentials;
    } catch {
      // Also check for very old legacy client_secret.json
      const veryOldLegacyPath = process.env.GOOGLE_CLIENT_SECRET_PATH || "client_secret.json";
      try {
        const legacyContent = await fs.readFile(veryOldLegacyPath, "utf-8");
        const legacyKeys = parseCredentialsFile(legacyContent);
        log("Warning: Using legacy client_secret.json. Please migrate to new location.");
        log(`  Recommended: ${getKeysFilePath()}`);

        const credentials = extractCredentials(legacyKeys);
        if (!credentials) {
          throw new Error("Invalid legacy credentials format");
        }
        return credentials;
      } catch {
        // Generate helpful error message
        const errorMessage = generateCredentialsErrorMessage();
        throw new Error(
          `${errorMessage}\n\nOriginal error: ${newPathError instanceof Error ? newPathError.message : String(newPathError)}`,
        );
      }
    }
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
