import crypto from "crypto";
import { CodeChallengeMethod, OAuth2Client } from "google-auth-library";
import { TokenManager, getLastTokenAuthError } from "./tokenManager.js";
import http from "http";
import os from "os";
import path from "path";
import { URL } from "url";
import open from "open";
import { loadCredentials } from "./client.js";
import { log } from "../utils/logging.js";
import { mapGoogleError } from "../errors/index.js";
import { getScopesForEnabledServices } from "../config/scopes.js";
import { getActiveProfile } from "./utils.js";
import {
  renderSuccessPage,
  renderErrorPage,
  renderCsrfErrorPage,
  buildGitignoreWarning,
} from "./templates.js";

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export class AuthServer {
  private flowOAuth2Client: OAuth2Client | null = null; // Used specifically for the auth code flow
  private server: http.Server | null = null;
  private tokenManager: TokenManager;
  private codeVerifier: string | null = null;
  private codeChallenge: string | null = null;
  private expectedState: string | null = null;
  public authCompletedSuccessfully = false; // Flag for standalone script

  constructor(oauth2Client: OAuth2Client) {
    this.tokenManager = new TokenManager(oauth2Client);
  }

  private isClientInvalidError(): boolean {
    const lastError = getLastTokenAuthError();
    return lastError?.isClientInvalid() ?? false;
  }

  /** Handle root request - show auth link page */
  private handleRootRequest(res: http.ServerResponse): void {
    if (!this.flowOAuth2Client) {
      res.writeHead(503, { "Content-Type": "text/plain" });
      res.end("Authentication server is starting. Please wait and refresh.");
      return;
    }
    if (!this.codeChallenge || !this.expectedState) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("PKCE not initialized - call start() first");
      return;
    }
    const authUrl = this.flowOAuth2Client.generateAuthUrl({
      access_type: "offline",
      scope: getScopesForEnabledServices(),
      prompt: "consent",
      code_challenge_method: CodeChallengeMethod.S256,
      code_challenge: this.codeChallenge,
      state: this.expectedState,
    });
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(
      `<h1>Google Drive Authentication</h1><a href="${authUrl}">Authenticate with Google</a>`,
    );
  }

  /** Handle OAuth callback - exchange code for tokens */
  private async handleOAuthCallback(url: URL, res: http.ServerResponse): Promise<void> {
    // Validate state parameter (CSRF protection per RFC 8252 section 8.9)
    const receivedState = url.searchParams.get("state");
    if (
      !this.expectedState ||
      !receivedState ||
      !timingSafeEqual(receivedState, this.expectedState)
    ) {
      res.writeHead(400, { "Content-Type": "text/html" });
      res.end(renderCsrfErrorPage());
      return;
    }

    const code = url.searchParams.get("code");
    if (!code) {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end("Authorization code missing");
      return;
    }

    if (!this.flowOAuth2Client) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Authentication flow not properly initiated.");
      return;
    }

    try {
      const { tokens } = await this.flowOAuth2Client.getToken({
        code,
        codeVerifier: this.codeVerifier || undefined,
      });
      await this.tokenManager.saveTokens(tokens);
      this.authCompletedSuccessfully = true;
      this.clearPkceState();

      // Schedule server shutdown after response completes
      setTimeout(() => {
        this.stop().catch((err) => log("Auth server shutdown error:", err));
      }, 2000);

      // Build success response with gitignore warning if needed
      const tokenPath = this.tokenManager.getTokenPath();
      const homeConfig = path.join(os.homedir(), ".config");
      const isProjectLevel = !tokenPath.startsWith(homeConfig);
      const credentialsDir = path.basename(path.dirname(tokenPath));
      const gitignoreWarning = isProjectLevel ? buildGitignoreWarning(credentialsDir) : "";

      const activeProfile = getActiveProfile();
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(renderSuccessPage(tokenPath, gitignoreWarning, activeProfile));
    } catch (error: unknown) {
      this.authCompletedSuccessfully = false;
      this.clearPkceState();

      const authError = mapGoogleError(error);
      log("OAuth callback error:", authError.toToolResponse());

      res.writeHead(500, { "Content-Type": "text/html" });
      res.end(renderErrorPage(authError));
    }
  }

  /** Clear sensitive PKCE/state values */
  private clearPkceState(): void {
    this.codeVerifier = null;
    this.codeChallenge = null;
    this.expectedState = null;
  }

  private createServer(): http.Server {
    return http.createServer(async (req, res) => {
      const url = new URL(req.url || "/", `http://127.0.0.1`);

      if (url.pathname === "/") {
        this.handleRootRequest(res);
      } else if (url.pathname === "/oauth2callback") {
        await this.handleOAuthCallback(url, res);
      } else {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not Found");
      }
    });
  }

  async start(openBrowser = true): Promise<boolean> {
    if (await this.tokenManager.validateTokens()) {
      this.authCompletedSuccessfully = true;
      return true;
    }

    // Try to start the server and get the port
    const port = await this.startServerOnAvailablePort();
    if (port === null) {
      this.authCompletedSuccessfully = false;
      return false;
    }

    // Successfully started server on `port`. Now create the flow-specific OAuth client.
    try {
      const { client_id, client_secret } = await loadCredentials();
      // Use 127.0.0.1 loopback only (RFC 8252 section 7.3)
      this.flowOAuth2Client = new OAuth2Client(
        client_id,
        client_secret || undefined,
        `http://127.0.0.1:${port}/oauth2callback`,
      );

      // Generate PKCE parameters (RFC 7636)
      const { codeVerifier, codeChallenge } =
        await this.flowOAuth2Client.generateCodeVerifierAsync();
      this.codeVerifier = codeVerifier ?? null;
      this.codeChallenge = codeChallenge ?? null;

      // Generate state for CSRF protection (RFC 8252 section 8.9)
      this.expectedState = crypto.randomBytes(32).toString("base64url");
    } catch (error) {
      // Could not load credentials, cannot proceed with auth flow
      log("Failed to load credentials for auth flow:", error);
      this.authCompletedSuccessfully = false;
      await this.stop(); // Stop the server we just started
      return false;
    }

    if (openBrowser) {
      // Check if the last auth error indicates a deleted/invalid client
      if (this.isClientInvalidError()) {
        const lastError = getLastTokenAuthError();
        console.error("\n❌ AUTHENTICATION BLOCKED");
        console.error("══════════════════════════════════════════");
        console.error(`\nError: ${lastError?.reason}`);
        console.error("\nHow to fix:");
        lastError?.fix.forEach((step, i) => console.error(`  ${i + 1}. ${step}`));
        if (lastError?.links && lastError.links.length > 0) {
          console.error("\nHelpful links:");
          lastError.links.forEach((link) => console.error(`  - ${link.label}: ${link.url}`));
        }
        console.error("");
        this.authCompletedSuccessfully = false;
        await this.stop();
        return false;
      }

      // PKCE was just generated above, so these should always be set
      if (!this.codeChallenge || !this.expectedState) {
        throw new Error("PKCE not initialized - internal error");
      }
      // Generate Auth URL using the newly created flow client with PKCE and state
      const authorizeUrl = this.flowOAuth2Client.generateAuthUrl({
        access_type: "offline",
        scope: getScopesForEnabledServices(),
        prompt: "consent",
        code_challenge_method: CodeChallengeMethod.S256,
        code_challenge: this.codeChallenge,
        state: this.expectedState,
      });

      console.error("\n🔐 AUTHENTICATION REQUIRED");
      console.error("══════════════════════════════════════════");
      console.error("\nOpening your browser to authenticate...");
      console.error(`If the browser doesn't open, visit:\n${authorizeUrl}\n`);

      await open(authorizeUrl);
    }

    return true; // Auth flow initiated
  }

  private async startServerOnAvailablePort(): Promise<number | null> {
    return new Promise<number>((resolve, reject) => {
      const server = this.createServer();

      // Bind to port 0 on 127.0.0.1 only (RFC 8252 section 7.3)
      // Port 0 tells the OS to assign an available ephemeral port
      server.listen(0, "127.0.0.1", () => {
        this.server = server;
        const address = server.address();
        if (typeof address === "object" && address !== null) {
          console.error(`Authentication server listening on http://127.0.0.1:${address.port}`);
          resolve(address.port);
        } else {
          reject(new Error("Failed to get server address"));
        }
      });

      server.on("error", (err) => {
        log("Failed to start auth server:", err);
        reject(err);
      });
    }).catch((err) => {
      log("Failed to start auth server:", err);
      return null;
    });
  }

  public getRunningPort(): number | null {
    if (this.server) {
      const address = this.server.address();
      if (typeof address === "object" && address !== null) {
        return address.port;
      }
    }
    return null;
  }

  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        this.server.close((err) => {
          if (err) {
            reject(err);
          } else {
            this.server = null;
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }
}
