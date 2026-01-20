import { OAuth2Client, Credentials } from "google-auth-library";
import * as fs from "fs/promises";
import * as path from "path";
import {
  getSecureTokenPath,
  getLegacyTokenPath,
  getAdditionalLegacyPaths,
} from "./utils.js";
import { GaxiosError } from "gaxios";
import { log } from "../utils/logging.js";

/** Type guard for NodeJS errors with a `code` property (e.g., ENOENT, EEXIST) */
function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

export class TokenManager {
  private oauth2Client: OAuth2Client;
  private tokenPath: string;

  constructor(oauth2Client: OAuth2Client) {
    this.oauth2Client = oauth2Client;
    this.tokenPath = getSecureTokenPath();
    this.setupTokenRefresh();
  }

  // Method to expose the token path
  public getTokenPath(): string {
    return this.tokenPath;
  }

  private async ensureTokenDirectoryExists(): Promise<void> {
    try {
      const dir = path.dirname(this.tokenPath);
      await fs.mkdir(dir, { recursive: true });
    } catch (error: unknown) {
      // Ignore errors if directory already exists, re-throw others
      if (isNodeError(error) && error.code !== "EEXIST") {
        log("Failed to create token directory:", error);
        throw error;
      }
    }
  }

  private setupTokenRefresh(): void {
    this.oauth2Client.on("tokens", async (newTokens) => {
      try {
        await this.ensureTokenDirectoryExists();
        const currentTokens = JSON.parse(
          await fs.readFile(this.tokenPath, "utf-8"),
        );
        const updatedTokens = {
          ...currentTokens,
          ...newTokens,
          refresh_token: newTokens.refresh_token || currentTokens.refresh_token,
        };
        await fs.writeFile(
          this.tokenPath,
          JSON.stringify(updatedTokens, null, 2),
          {
            mode: 0o600,
          },
        );
        log("Tokens updated and saved");
      } catch (error: unknown) {
        // Handle case where currentTokens might not exist yet
        if (isNodeError(error) && error.code === "ENOENT") {
          try {
            await fs.writeFile(
              this.tokenPath,
              JSON.stringify(newTokens, null, 2),
              { mode: 0o600 },
            );
            log("New tokens saved");
          } catch (writeError) {
            log("Error saving initial tokens:", writeError);
          }
        } else {
          log("Error saving updated tokens:", error);
        }
      }
    });
  }

  private async migrateLegacyTokens(): Promise<boolean> {
    // Check all possible legacy locations
    const legacyPaths = [getLegacyTokenPath(), ...getAdditionalLegacyPaths()];

    for (const legacyPath of legacyPaths) {
      try {
        // Check if legacy tokens exist
        if (
          !(await fs
            .access(legacyPath)
            .then(() => true)
            .catch(() => false))
        ) {
          continue; // Try next location
        }

        // Read legacy tokens
        const legacyTokens = JSON.parse(await fs.readFile(legacyPath, "utf-8"));

        if (!legacyTokens || typeof legacyTokens !== "object") {
          log(`Invalid legacy token format at ${legacyPath}, skipping`);
          continue;
        }

        // Ensure new token directory exists
        await this.ensureTokenDirectoryExists();

        // Copy to new location
        await fs.writeFile(
          this.tokenPath,
          JSON.stringify(legacyTokens, null, 2),
          {
            mode: 0o600,
          },
        );

        log(
          `Migrated tokens from legacy location: ${legacyPath} to: ${this.tokenPath}`,
        );

        // Optionally remove legacy file after successful migration
        try {
          await fs.unlink(legacyPath);
          log("Removed legacy token file");
        } catch (unlinkErr) {
          log("Warning: Could not remove legacy token file:", unlinkErr);
        }

        return true;
      } catch (error) {
        log(`Error migrating legacy tokens from ${legacyPath}`, error);
        // Continue to next location
      }
    }

    return false; // No legacy tokens found or migrated
  }

  async loadSavedTokens(): Promise<boolean> {
    try {
      await this.ensureTokenDirectoryExists();

      // Check if current token file exists
      const tokenExists = await fs
        .access(this.tokenPath)
        .then(() => true)
        .catch(() => false);

      // If no current tokens, try to migrate from legacy location
      if (!tokenExists) {
        const migrated = await this.migrateLegacyTokens();
        if (!migrated) {
          log("No token file found at:", this.tokenPath);
          return false;
        }
      }

      const tokens = JSON.parse(await fs.readFile(this.tokenPath, "utf-8"));

      if (!tokens || typeof tokens !== "object") {
        log("Invalid token format in file:", this.tokenPath);
        return false;
      }

      this.oauth2Client.setCredentials(tokens);
      log("Tokens loaded successfully");
      return true;
    } catch (error: unknown) {
      log("Error loading tokens:", error);
      // Attempt to delete potentially corrupted token file
      if (isNodeError(error) && error.code !== "ENOENT") {
        try {
          await fs.unlink(this.tokenPath);
          log("Removed potentially corrupted token file");
        } catch {
          /* ignore */
        }
      }
      return false;
    }
  }

  async refreshTokensIfNeeded(): Promise<boolean> {
    const expiryDate = this.oauth2Client.credentials.expiry_date;
    const isExpired = expiryDate
      ? Date.now() >= expiryDate - 5 * 60 * 1000 // 5 minute buffer
      : !this.oauth2Client.credentials.access_token; // No token means we need one

    if (isExpired && this.oauth2Client.credentials.refresh_token) {
      log("Auth token expired or nearing expiry, refreshing...");
      try {
        const response = await this.oauth2Client.refreshAccessToken();
        const newTokens = response.credentials;

        if (!newTokens.access_token) {
          throw new Error("Received invalid tokens during refresh");
        }
        // The 'tokens' event listener should handle saving
        this.oauth2Client.setCredentials(newTokens);
        log("Token refreshed successfully");
        return true;
      } catch (refreshError) {
        if (
          refreshError instanceof GaxiosError &&
          refreshError.response?.data?.error === "invalid_grant"
        ) {
          log(
            "Error refreshing auth token: Invalid grant. Token likely expired or revoked. Please re-authenticate.",
          );
          // Optionally clear the potentially invalid tokens here
          await this.clearTokens();
          return false; // Indicate failure due to invalid grant
        } else {
          // Handle other refresh errors
          log("Error refreshing auth token:", refreshError);
          return false;
        }
      }
    } else if (
      !this.oauth2Client.credentials.access_token &&
      !this.oauth2Client.credentials.refresh_token
    ) {
      log("No access or refresh token available. Please re-authenticate.");
      return false;
    } else {
      // Token is valid or no refresh token available
      return true;
    }
  }

  async validateTokens(): Promise<boolean> {
    if (
      !this.oauth2Client.credentials ||
      !this.oauth2Client.credentials.access_token
    ) {
      // Try loading first if no credentials set
      if (!(await this.loadSavedTokens())) {
        return false; // No saved tokens to load
      }
      // Check again after loading
      if (
        !this.oauth2Client.credentials ||
        !this.oauth2Client.credentials.access_token
      ) {
        return false; // Still no token after loading
      }
    }
    return this.refreshTokensIfNeeded();
  }

  async saveTokens(tokens: Credentials): Promise<void> {
    try {
      await this.ensureTokenDirectoryExists();
      await fs.writeFile(this.tokenPath, JSON.stringify(tokens, null, 2), {
        mode: 0o600,
      });
      this.oauth2Client.setCredentials(tokens);
      log("Tokens saved successfully to:", this.tokenPath);
    } catch (error: unknown) {
      log("Error saving tokens:", error);
      throw error;
    }
  }

  async clearTokens(): Promise<void> {
    try {
      this.oauth2Client.setCredentials({}); // Clear in memory
      await fs.unlink(this.tokenPath);
      log("Tokens cleared successfully");
    } catch (error: unknown) {
      if (isNodeError(error) && error.code === "ENOENT") {
        // File already gone, which is fine
        log("Token file already deleted");
      } else {
        log("Error clearing tokens:", error);
        // Don't re-throw, clearing is best-effort
      }
    }
  }
}
