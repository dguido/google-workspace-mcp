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

interface CredentialsSource {
  path: string;
  isLegacy: boolean;
  name: string;
}

async function loadCredentialsWithFallback(): Promise<OAuthCredentials> {
  const sources: CredentialsSource[] = [
    { path: getKeysFilePath(), isLegacy: false, name: "default" },
    { path: getLegacyKeysFilePath(), isLegacy: true, name: "gcp-oauth.keys.json" },
    {
      path: process.env.GOOGLE_CLIENT_SECRET_PATH || "client_secret.json",
      isLegacy: true,
      name: "client_secret.json",
    },
  ];

  let lastError: Error | null = null;

  for (const source of sources) {
    try {
      const content = await fs.readFile(source.path, "utf-8");
      const keys = parseCredentialsFile(content);

      if (source.isLegacy) {
        log(`MIGRATION NOTICE: Found credentials at legacy location (${source.name})`);
        log(`  Current: ${source.path}`);
        log(`  Recommended: ${getKeysFilePath()}`);
        log("  Move credentials to the recommended location to silence this warning.");
      }

      const credentials = extractCredentials(keys);
      if (!credentials) {
        throw new Error(`Invalid credentials format in ${source.name}`);
      }
      return credentials;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }

  const errorMessage = generateCredentialsErrorMessage();
  throw new Error(`${errorMessage}\n\nOriginal error: ${lastError?.message || "Unknown"}`);
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
