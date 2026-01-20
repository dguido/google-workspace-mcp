// Main authentication module that re-exports and orchestrates the modular components
import type { OAuth2Client } from "google-auth-library";
import { initializeOAuth2Client } from "./auth/client.js";
import { AuthServer } from "./auth/server.js";
import { TokenManager } from "./auth/tokenManager.js";
import { log } from "./utils/logging.js";

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
    log("OAuth2Client credentials:", {
      hasAccessToken: !!oauth2Client.credentials?.access_token,
      hasRefreshToken: !!oauth2Client.credentials?.refresh_token,
      expiryDate: oauth2Client.credentials?.expiry_date,
    });
    return oauth2Client;
  }

  // No valid tokens, need to authenticate
  log("No valid authentication tokens found. Starting authentication flow...");

  const authServer = new AuthServer(oauth2Client);
  const authSuccess = await authServer.start(true);

  if (!authSuccess) {
    throw new Error(
      "Authentication failed. Please check your credentials and try again.",
    );
  }

  // Wait for authentication to complete
  await new Promise<void>((resolve) => {
    const checkInterval = setInterval(async () => {
      if (authServer.authCompletedSuccessfully) {
        clearInterval(checkInterval);
        await authServer.stop();
        resolve();
      }
    }, 1000);
  });

  return oauth2Client;
}
