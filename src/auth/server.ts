import crypto from "crypto";
import { CodeChallengeMethod, OAuth2Client } from "google-auth-library";
import { TokenManager } from "./tokenManager.js";
import http from "http";
import os from "os";
import path from "path";
import { URL } from "url";
import open from "open";
import { loadCredentials } from "./client.js";
import { log } from "../utils/logging.js";
import { mapGoogleError } from "../errors/index.js";
import { getScopesForEnabledServices } from "../config/scopes.js";

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

  private createServer(): http.Server {
    return http.createServer(async (req, res) => {
      const url = new URL(req.url || "/", `http://127.0.0.1`);

      if (url.pathname === "/") {
        // Handle root - show auth link (only if auth flow is properly initialized)
        if (!this.flowOAuth2Client) {
          res.writeHead(503, { "Content-Type": "text/plain" });
          res.end("Authentication server is starting. Please wait and refresh.");
          return;
        }
        const authUrl = this.flowOAuth2Client.generateAuthUrl({
          access_type: "offline",
          scope: getScopesForEnabledServices(),
          prompt: "consent",
          code_challenge_method: CodeChallengeMethod.S256,
          code_challenge: this.codeChallenge!,
          state: this.expectedState!,
        });
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(
          `<h1>Google Drive Authentication</h1><a href="${authUrl}">Authenticate with Google</a>`,
        );
      } else if (url.pathname === "/oauth2callback") {
        // Validate state parameter (CSRF protection per RFC 8252 section 8.9)
        const receivedState = url.searchParams.get("state");
        if (!this.expectedState || receivedState !== this.expectedState) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end(`
            <!DOCTYPE html>
            <html lang="en">
            <head><title>Authentication Failed</title>
            <style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;background:#f4f4f4;margin:0}.container{text-align:center;padding:2em;background:#fff;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1)}h1{color:#F44336}</style>
            </head>
            <body><div class="container"><h1>Authentication Failed</h1><p>Invalid state parameter. This may indicate a CSRF attack.</p><p>Please close this window and try again.</p></div></body>
            </html>
          `);
          return;
        }

        // Handle OAuth callback
        const code = url.searchParams.get("code");
        if (!code) {
          res.writeHead(400, { "Content-Type": "text/plain" });
          res.end("Authorization code missing");
          return;
        }
        // IMPORTANT: Use the flowOAuth2Client to exchange the code
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
          // Save tokens using the TokenManager (which uses the base client)
          await this.tokenManager.saveTokens(tokens);
          this.authCompletedSuccessfully = true;

          // Clear sensitive PKCE/state values after use
          this.codeVerifier = null;
          this.codeChallenge = null;
          this.expectedState = null;

          // Schedule server shutdown after response completes
          setTimeout(() => {
            this.stop().catch(() => {});
          }, 2000);

          // Get the path where tokens were saved
          const tokenPath = this.tokenManager.getTokenPath();

          // Detect if tokens are stored in a project directory (not ~/.config)
          const homeConfig = path.join(os.homedir(), ".config");
          const isProjectLevel = !tokenPath.startsWith(homeConfig);
          const credentialsDir = path.basename(path.dirname(tokenPath));
          const gitignoreWarning = isProjectLevel
            ? `
                    <div class="warning">
                        <p><strong>⚠️ Security:</strong> Add your credentials directory to .gitignore:</p>
                        <p><code>${credentialsDir}/</code></p>
                    </div>`
            : "";

          // Send a more informative HTML response including the path
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Authentication Successful</title>
                <style>
                    body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background-color: #f4f4f4; margin: 0; }
                    .container { text-align: center; padding: 2em; background-color: #fff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); max-width: 500px; }
                    h1 { color: #4CAF50; }
                    p { color: #333; margin-bottom: 0.5em; }
                    code { background-color: #eee; padding: 0.2em 0.4em; border-radius: 3px; font-size: 0.9em; }
                    .warning { background-color: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; padding: 1em; margin-top: 1em; }
                    .warning p { color: #856404; margin: 0.3em 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Authentication Successful!</h1>
                    <p>Your authentication tokens have been saved successfully to:</p>
                    <p><code>${tokenPath}</code></p>${gitignoreWarning}
                    <p style="margin-top: 1em;">You can now close this browser window.</p>
                </div>
            </body>
            </html>
          `);
        } catch (error: unknown) {
          this.authCompletedSuccessfully = false;
          // Clear sensitive PKCE/state values on error as well
          this.codeVerifier = null;
          this.codeChallenge = null;
          this.expectedState = null;

          // Map the error to get actionable guidance
          const authError = mapGoogleError(error);
          log("OAuth callback error:", authError.toToolResponse());

          // Build fix steps HTML
          const fixStepsHtml = authError.fix
            .map((step, i) => `<li>${i + 1}. ${step}</li>`)
            .join("");
          const linksHtml = authError.links
            ? authError.links
                .map((link) => `<li><a href="${link.url}" target="_blank">${link.label}</a></li>`)
                .join("")
            : "";

          // Send an HTML error response with actionable guidance
          res.writeHead(500, { "Content-Type": "text/html" });
          res.end(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Authentication Failed</title>
                <style>
                    body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; background-color: #f4f4f4; margin: 0; padding: 1em; }
                    .container { text-align: left; padding: 2em; background-color: #fff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); max-width: 600px; }
                    h1 { color: #F44336; text-align: center; }
                    .error-code { background-color: #ffebee; color: #c62828; padding: 0.5em 1em; border-radius: 4px; font-family: monospace; margin: 1em 0; }
                    .reason { color: #333; margin-bottom: 1.5em; }
                    h2 { color: #1976d2; font-size: 1.1em; margin-top: 1.5em; }
                    ol { padding-left: 1.5em; }
                    li { margin-bottom: 0.5em; color: #555; }
                    ul { padding-left: 1em; list-style: none; }
                    ul li { margin-bottom: 0.3em; }
                    a { color: #1976d2; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Authentication Failed</h1>
                    <div class="error-code">${authError.code}</div>
                    <p class="reason">${authError.reason}</p>
                    <h2>How to fix:</h2>
                    <ol>${fixStepsHtml}</ol>
                    ${linksHtml ? `<h2>Helpful links:</h2><ul>${linksHtml}</ul>` : ""}
                </div>
            </body>
            </html>
          `);
        }
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
      // Generate Auth URL using the newly created flow client with PKCE and state
      const authorizeUrl = this.flowOAuth2Client.generateAuthUrl({
        access_type: "offline",
        scope: getScopesForEnabledServices(),
        prompt: "consent",
        code_challenge_method: CodeChallengeMethod.S256,
        code_challenge: this.codeChallenge!,
        state: this.expectedState!,
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
