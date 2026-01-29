// Main authentication module that re-exports and orchestrates the modular components
import type { OAuth2Client } from "google-auth-library";
import { initializeOAuth2Client } from "./auth/client.js";
import { AuthServer } from "./auth/server.js";
import { TokenManager } from "./auth/tokenManager.js";
import { log } from "./utils/logging.js";

const AUTH_FLOW_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export { TokenManager } from "./auth/tokenManager.js";
export { initializeOAuth2Client } from "./auth/client.js";
export { AuthServer } from "./auth/server.js";

/**
 * Authenticate and return OAuth2 client
 * This is the main entry point for authentication in the MCP server
 */
export async function authenticate(): Promise<OAuth2Client> {
  log("Initializing authentication...");

  // Initialize OAuth2 client
  const oauth2Client = await initializeOAuth2Client();
  const tokenManager = new TokenManager(oauth2Client);

  // Try to validate existing tokens
  if (await tokenManager.validateTokens()) {
    log("Authentication successful - using existing tokens");
    return oauth2Client;
  }

  // No valid tokens, need to authenticate
  log("No valid authentication tokens found. Starting authentication flow...");

  const authServer = new AuthServer(oauth2Client);
  const authSuccess = await authServer.start(true);

  if (!authSuccess) {
    throw new Error("Authentication failed. Please check your credentials and try again.");
  }

  // Wait for authentication to complete with timeout
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error("Authentication timed out after 5 minutes. Please try again."));
    }, AUTH_FLOW_TIMEOUT_MS);
  });

  const completionPromise = new Promise<void>((resolve) => {
    const checkInterval = setInterval(() => {
      if (authServer.authCompletedSuccessfully) {
        clearInterval(checkInterval);
        resolve();
      }
    }, 1000);
  });

  try {
    await Promise.race([completionPromise, timeoutPromise]);
  } finally {
    await authServer.stop();
  }

  return oauth2Client;
}
