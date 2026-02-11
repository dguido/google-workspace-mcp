import crypto from "crypto";
import readline from "readline";
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

/**
 * Parse an authorization code from user input.
 * Accepts three formats:
 *   1. Full redirect URL: http://127.0.0.1:PORT/oauth2callback?code=X&state=Y
 *   2. Query string: ?code=X&state=Y
 *   3. Bare authorization code (length > 10, no whitespace)
 */
export function extractCodeFromInput(input: string): { code: string; state?: string } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Try parsing as a full URL or localhost redirect
  try {
    const url = new URL(trimmed);
    const code = url.searchParams.get("code");
    if (code) {
      const state = url.searchParams.get("state") ?? undefined;
      return { code, state };
    }
  } catch {
    // Not a valid URL — fall through
  }

  // Try parsing as a query string (?code=...&state=...)
  if (trimmed.startsWith("?")) {
    try {
      const params = new URLSearchParams(trimmed.slice(1));
      const code = params.get("code");
      if (code) {
        const state = params.get("state") ?? undefined;
        return { code, state };
      }
    } catch {
      // Not a valid query string — fall through
    }
  }

  // Bare code fallback: long enough, no spaces, not a URL
  if (trimmed.length > 10 && !trimmed.includes(" ") && !trimmed.includes("://")) {
    return { code: trimmed };
  }

  return null;
}

export class AuthServer {
  private flowOAuth2Client: OAuth2Client | null = null;
  private server: http.Server | null = null;
  private tokenManager: TokenManager;
  private codeVerifier: string | null = null;
  private codeChallenge: string | null = null;
  private expectedState: string | null = null;
  private rl: readline.Interface | null = null;
  private resolved = false;
  public authCompletedSuccessfully = false;

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
      `<h1>Google Drive Authentication</h1>` + `<a href="${authUrl}">Authenticate with Google</a>`,
    );
  }

  /**
   * Exchange an authorization code for tokens and persist them.
   * Shared by both the HTTP callback and the stdin prompt paths.
   * Returns true on success, false on failure.
   */
  private async exchangeCodeForTokens(code: string): Promise<boolean> {
    if (!this.flowOAuth2Client) return false;
    try {
      const { tokens } = await this.flowOAuth2Client.getToken({
        code,
        codeVerifier: this.codeVerifier || undefined,
      });
      await this.tokenManager.saveTokens(tokens);
      this.authCompletedSuccessfully = true;
      this.clearPkceState();
      return true;
    } catch (error: unknown) {
      this.authCompletedSuccessfully = false;
      this.clearPkceState();
      const authError = mapGoogleError(error);
      log("Token exchange error:", authError.toToolResponse());
      return false;
    }
  }

  /** Handle OAuth callback - exchange code for tokens */
  private async handleOAuthCallback(url: URL, res: http.ServerResponse): Promise<void> {
    // Validate state parameter (CSRF protection per RFC 8252 §8.9)
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

    // If stdin already completed the flow, just return success
    if (this.resolved) {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(renderSuccessPage(this.tokenManager.getTokenPath(), "", getActiveProfile()));
      return;
    }

    const success = await this.exchangeCodeForTokens(code);
    if (success) {
      this.resolved = true;
      this.closeReadline();

      // Schedule server shutdown after response completes
      setTimeout(() => {
        this.stop().catch((err) => log("Auth server shutdown error:", err));
      }, 2000);

      const tokenPath = this.tokenManager.getTokenPath();
      const homeConfig = path.join(os.homedir(), ".config");
      const isProjectLevel = !tokenPath.startsWith(homeConfig);
      const credentialsDir = path.basename(path.dirname(tokenPath));
      const gitignoreWarning = isProjectLevel ? buildGitignoreWarning(credentialsDir) : "";

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(renderSuccessPage(tokenPath, gitignoreWarning, getActiveProfile()));
    } else {
      res.writeHead(500, { "Content-Type": "text/html" });
      res.end(renderErrorPage(mapGoogleError(new Error("Token exchange failed"))));
    }
  }

  /** Clear sensitive PKCE/state values */
  private clearPkceState(): void {
    this.codeVerifier = null;
    this.codeChallenge = null;
    this.expectedState = null;
  }

  private closeReadline(): void {
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
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

  /**
   * Start a readline prompt on stdin for pasting the redirect
   * URL or bare authorization code. Races against the HTTP
   * callback — whichever completes first wins.
   */
  private startStdinPrompt(): void {
    if (!process.stdin.isTTY) return;

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stderr,
    });

    const promptUser = (): void => {
      if (this.resolved || !this.rl) return;
      this.rl.question("\nPaste redirect URL or auth code: ", async (answer) => {
        if (this.resolved) return;

        const parsed = extractCodeFromInput(answer);
        if (!parsed) {
          console.error(
            "Could not extract authorization code from input." +
              " Please paste the full redirect URL.",
          );
          promptUser();
          return;
        }

        // Validate state when present in pasted URL
        if (parsed.state && this.expectedState) {
          if (!timingSafeEqual(parsed.state, this.expectedState)) {
            console.error("State parameter mismatch — possible CSRF." + " Please try again.");
            promptUser();
            return;
          }
        }

        const success = await this.exchangeCodeForTokens(parsed.code);
        if (success) {
          this.resolved = true;
          this.closeReadline();
          console.error("\nAuthentication successful! Tokens saved.");
        } else {
          console.error("Token exchange failed." + " Please check the code and try again.");
          promptUser();
        }
      });
    };

    promptUser();
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

    // Create the flow-specific OAuth client
    try {
      const { client_id, client_secret } = await loadCredentials();
      // Use 127.0.0.1 loopback only (RFC 8252 §7.3)
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

      // Generate state for CSRF protection (RFC 8252 §8.9)
      this.expectedState = crypto.randomBytes(32).toString("base64url");
    } catch (error) {
      log("Failed to load credentials for auth flow:", error);
      this.authCompletedSuccessfully = false;
      await this.stop();
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

      if (!this.codeChallenge || !this.expectedState) {
        throw new Error("PKCE not initialized - internal error");
      }

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
      console.error(`\nAuth URL (copy if browser doesn't open):\n  ${authorizeUrl}`);
      console.error(
        "\nIf running remotely: open the URL in your local" +
          " browser.\nThe redirect page won't load — copy the" +
          " URL from your address bar\nand paste it below.",
      );

      await open(authorizeUrl);

      // Start stdin prompt for headless/remote environments
      this.startStdinPrompt();
    }

    return true;
  }

  private async startServerOnAvailablePort(): Promise<number | null> {
    return new Promise<number>((resolve, reject) => {
      const server = this.createServer();

      // Bind to port 0 on 127.0.0.1 only (RFC 8252 §7.3)
      server.listen(0, "127.0.0.1", () => {
        this.server = server;
        const address = server.address();
        if (typeof address === "object" && address !== null) {
          console.error("Authentication server listening on" + ` http://127.0.0.1:${address.port}`);
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
    this.closeReadline();
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
