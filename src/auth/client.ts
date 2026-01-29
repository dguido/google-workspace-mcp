import { OAuth2Client } from "google-auth-library";
import * as fs from "fs/promises";
import { getKeysFilePath, generateCredentialsErrorMessage, OAuthCredentials } from "./utils.js";
import { validateOAuthConfig, GoogleAuthError } from "../errors/index.js";
import { log } from "../utils/logging.js";

/** Raw structure of Google OAuth credentials JSON file */
interface RawCredentialsFile {
  installed?: OAuthCredentials;
  web?: OAuthCredentials;
  client_id?: string;
  client_secret?: string;
  redirect_uris?: string[];
}

async function loadCredentialsFromFile(): Promise<OAuthCredentials> {
  const keysContent = await fs.readFile(getKeysFilePath(), "utf-8");
  const keys = JSON.parse(keysContent) as RawCredentialsFile;

  if (keys.installed) {
    // Standard OAuth credentials file format
    return {
      client_id: keys.installed.client_id,
      client_secret: keys.installed.client_secret,
      redirect_uris: keys.installed.redirect_uris,
    };
  } else if (keys.web) {
    // Web application credentials format
    return {
      client_id: keys.web.client_id,
      client_secret: keys.web.client_secret,
      redirect_uris: keys.web.redirect_uris,
    };
  } else if (keys.client_id) {
    // Direct format (simplified)
    return {
      client_id: keys.client_id,
      client_secret: keys.client_secret,
      redirect_uris: keys.redirect_uris || ["http://127.0.0.1/oauth2callback"],
    };
  } else {
    throw new Error(
      'Invalid credentials file format. Expected either "installed", "web" object or direct client_id field.',
    );
  }
}

async function loadCredentialsWithFallback(): Promise<OAuthCredentials> {
  try {
    return await loadCredentialsFromFile();
  } catch (fileError) {
    // Check for legacy client_secret.json
    const legacyPath = process.env.GOOGLE_CLIENT_SECRET_PATH || "client_secret.json";
    try {
      const legacyContent = await fs.readFile(legacyPath, "utf-8");
      const legacyKeys = JSON.parse(legacyContent) as RawCredentialsFile;
      log("Warning: Using legacy client_secret.json. Please migrate to gcp-oauth.keys.json");

      if (legacyKeys.installed) {
        return {
          client_id: legacyKeys.installed.client_id,
          client_secret: legacyKeys.installed.client_secret,
          redirect_uris: legacyKeys.installed.redirect_uris,
        };
      } else if (legacyKeys.web) {
        return {
          client_id: legacyKeys.web.client_id,
          client_secret: legacyKeys.web.client_secret,
          redirect_uris: legacyKeys.web.redirect_uris,
        };
      } else {
        throw new Error("Invalid legacy credentials format");
      }
    } catch {
      // Generate helpful error message
      const errorMessage = generateCredentialsErrorMessage();
      throw new Error(
        `${errorMessage}\n\nOriginal error: ${fileError instanceof Error ? fileError.message : String(fileError)}`,
      );
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
