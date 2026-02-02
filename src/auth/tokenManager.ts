import { OAuth2Client, Credentials } from "google-auth-library";
import * as fs from "fs/promises";
import * as path from "path";
import { Mutex } from "async-mutex";
import { getSecureTokenPath } from "./utils.js";
import { log, isNodeError } from "../utils/index.js";
import { mapGoogleError, type GoogleAuthError } from "../errors/index.js";
import { parseStoredCredentials, type StoredCredentials } from "../types/credentials.js";

export type { StoredCredentials };

/** Singleton TokenManager instance for module-level error access */
let activeTokenManager: TokenManager | null = null;

/** Get the last auth error that occurred (from active TokenManager) */
export function getLastTokenAuthError(): GoogleAuthError | null {
  return activeTokenManager?.getLastError() ?? null;
}

/** Clear the last auth error (from active TokenManager) */
export function clearLastTokenAuthError(): void {
  activeTokenManager?.clearLastError();
}

export class TokenManager {
  private oauth2Client: OAuth2Client;
  private tokenPath: string;
  private accountEmail?: string;
  private refreshInProgress: Promise<boolean> | null = null;
  private lastAuthError: GoogleAuthError | null = null;
  private tokenFileMutex = new Mutex();

  constructor(oauth2Client: OAuth2Client, accountEmail?: string) {
    this.oauth2Client = oauth2Client;
    this.tokenPath = getSecureTokenPath();
    this.accountEmail = accountEmail;
    this.setupTokenRefresh();
    // Register as active manager for module-level error access
    activeTokenManager = this;
  }

  /** Get the last auth error that occurred */
  public getLastError(): GoogleAuthError | null {
    return this.lastAuthError;
  }

  /** Clear the last auth error */
  public clearLastError(): void {
    this.lastAuthError = null;
  }

  /** Method to expose the token path */
  public getTokenPath(): string {
    return this.tokenPath;
  }

  /** Set the account email for error context */
  public setAccountEmail(email: string): void {
    this.accountEmail = email;
  }

  /**
   * Atomically write token content using temp file + rename pattern.
   * This prevents corrupted token files if the process crashes mid-write.
   */
  private async atomicWriteTokens(content: string): Promise<void> {
    const tempPath = `${this.tokenPath}.${Date.now()}.tmp`;
    try {
      await fs.writeFile(tempPath, content, { mode: 0o600 });
      await fs.rename(tempPath, this.tokenPath);
    } catch (error) {
      // Clean up temp file on failure
      await fs.unlink(tempPath).catch(() => {});
      throw error;
    }
  }

  private async ensureTokenDirectoryExists(): Promise<void> {
    try {
      const dir = path.dirname(this.tokenPath);
      await fs.mkdir(dir, { recursive: true, mode: 0o700 });
    } catch (error: unknown) {
      // Ignore errors if directory already exists, re-throw others
      if (isNodeError(error) && error.code !== "EEXIST") {
        log("Failed to create token directory:", error);
        throw error;
      }
    }
  }

  /**
   * Sets up automatic token persistence when OAuth2Client emits 'tokens' events.
   * Uses a mutex to prevent race conditions when multiple refresh events fire rapidly.
   */
  private setupTokenRefresh(): void {
    this.oauth2Client.on("tokens", (newTokens) => {
      void this.updateTokensFile(newTokens);
    });
  }

  /**
   * Safely update the token file with new tokens, using mutex to prevent races.
   * Merges new tokens with existing ones, preserving refresh_token and created_at.
   */
  private async updateTokensFile(newTokens: Credentials): Promise<void> {
    await this.tokenFileMutex.runExclusive(async () => {
      try {
        await this.ensureTokenDirectoryExists();
        const content = await fs.readFile(this.tokenPath, "utf-8");
        const currentTokens = parseStoredCredentials(content);
        if (!currentTokens) {
          throw new Error("Invalid token file format");
        }
        const updatedTokens: StoredCredentials = {
          ...currentTokens,
          ...newTokens,
          refresh_token: newTokens.refresh_token || currentTokens.refresh_token,
          // Preserve original created_at from when tokens were first obtained
          created_at: currentTokens.created_at,
        };
        await this.atomicWriteTokens(JSON.stringify(updatedTokens, null, 2));
        log("Tokens updated and saved");
      } catch (error: unknown) {
        // Handle case where currentTokens might not exist yet
        if (isNodeError(error) && error.code === "ENOENT") {
          try {
            const tokensWithTimestamp: StoredCredentials = {
              ...newTokens,
              created_at: new Date().toISOString(),
            };
            await this.atomicWriteTokens(JSON.stringify(tokensWithTimestamp, null, 2));
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

  async loadSavedTokens(): Promise<boolean> {
    try {
      await this.ensureTokenDirectoryExists();

      // Check if token file exists
      const tokenExists = await fs
        .access(this.tokenPath)
        .then(() => true)
        .catch(() => false);

      if (!tokenExists) {
        log("No token file found at:", this.tokenPath);
        return false;
      }

      const content = await fs.readFile(this.tokenPath, "utf-8");
      const tokens = parseStoredCredentials(content);

      if (!tokens) {
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
    // If refresh already in progress, wait for it
    if (this.refreshInProgress) {
      return this.refreshInProgress;
    }

    // Start refresh and store promise
    this.refreshInProgress = this._doRefreshTokens();
    try {
      return await this.refreshInProgress;
    } finally {
      this.refreshInProgress = null;
    }
  }

  private async _doRefreshTokens(): Promise<boolean> {
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
        const authError = mapGoogleError(refreshError, { account: this.accountEmail });
        this.lastAuthError = authError;
        log("Token refresh failed:", authError.toToolResponse());

        if (authError.requiresTokenClear()) {
          await this.clearTokens();
        }

        return false;
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
    if (!this.oauth2Client.credentials || !this.oauth2Client.credentials.access_token) {
      // Try loading first if no credentials set
      if (!(await this.loadSavedTokens())) {
        return false; // No saved tokens to load
      }
      // Check again after loading
      if (!this.oauth2Client.credentials || !this.oauth2Client.credentials.access_token) {
        return false; // Still no token after loading
      }
    }
    return this.refreshTokensIfNeeded();
  }

  async saveTokens(tokens: Credentials): Promise<void> {
    try {
      await this.ensureTokenDirectoryExists();
      const tokensWithTimestamp: StoredCredentials = {
        ...tokens,
        created_at: new Date().toISOString(),
      };
      await this.atomicWriteTokens(JSON.stringify(tokensWithTimestamp, null, 2));
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
