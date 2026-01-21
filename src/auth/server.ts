import { OAuth2Client } from "google-auth-library";
import { TokenManager } from "./tokenManager.js";
import http from "http";
import os from "os";
import path from "path";
import { URL } from "url";
import open from "open";
import { loadCredentials } from "./client.js";
import { log } from "../utils/logging.js";

// OAuth scopes for Google Drive, Docs, Sheets, Slides, and Calendar
const SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/presentations",
  "https://www.googleapis.com/auth/calendar.events",
];

export class AuthServer {
  private baseOAuth2Client: OAuth2Client; // Used by TokenManager for validation/refresh
  private flowOAuth2Client: OAuth2Client | null = null; // Used specifically for the auth code flow
  private server: http.Server | null = null;
  private tokenManager: TokenManager;
  private portRange: { start: number; end: number };
  public authCompletedSuccessfully = false; // Flag for standalone script

  constructor(oauth2Client: OAuth2Client) {
    this.baseOAuth2Client = oauth2Client;
    this.tokenManager = new TokenManager(oauth2Client);
    this.portRange = { start: 3000, end: 3004 };
  }

  private createServer(): http.Server {
    return http.createServer(async (req, res) => {
      const url = new URL(req.url || "/", `http://localhost`);

      if (url.pathname === "/") {
        // Handle root - show auth link
        const clientForUrl = this.flowOAuth2Client || this.baseOAuth2Client;
        const authUrl = clientForUrl.generateAuthUrl({
          access_type: "offline",
          scope: SCOPES,
          prompt: "consent",
        });
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(
          `<h1>Google Drive Authentication</h1><a href="${authUrl}">Authenticate with Google</a>`,
        );
      } else if (url.pathname === "/oauth2callback") {
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
          const { tokens } = await this.flowOAuth2Client.getToken(code);
          // Save tokens using the TokenManager (which uses the base client)
          await this.tokenManager.saveTokens(tokens);
          this.authCompletedSuccessfully = true;

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
          const message = error instanceof Error ? error.message : "Unknown error";
          // Send an HTML error response
          res.writeHead(500, { "Content-Type": "text/html" });
          res.end(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Authentication Failed</title>
                <style>
                    body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background-color: #f4f4f4; margin: 0; }
                    .container { text-align: center; padding: 2em; background-color: #fff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                    h1 { color: #F44336; }
                    p { color: #333; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Authentication Failed</h1>
                    <p>An error occurred during authentication:</p>
                    <p><code>${message}</code></p>
                    <p>Please try again or check the server logs.</p>
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
      this.flowOAuth2Client = new OAuth2Client(
        client_id,
        client_secret || undefined,
        `http://localhost:${port}/oauth2callback`,
      );
    } catch (error) {
      // Could not load credentials, cannot proceed with auth flow
      log("Failed to load credentials for auth flow:", error);
      this.authCompletedSuccessfully = false;
      await this.stop(); // Stop the server we just started
      return false;
    }

    if (openBrowser) {
      // Generate Auth URL using the newly created flow client
      const authorizeUrl = this.flowOAuth2Client.generateAuthUrl({
        access_type: "offline",
        scope: SCOPES,
        prompt: "consent",
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
    for (let port = this.portRange.start; port <= this.portRange.end; port++) {
      try {
        await new Promise<void>((resolve, reject) => {
          // Create a new server instance for this port attempt
          const testServer = this.createServer();
          testServer.listen(port, () => {
            this.server = testServer; // Assign to class property *only* if successful
            console.error(`Authentication server listening on http://localhost:${port}`);
            resolve();
          });
          testServer.on("error", (err: NodeJS.ErrnoException) => {
            if (err.code === "EADDRINUSE") {
              // Port is in use, close the test server and reject
              testServer.close(() => reject(err));
            } else {
              // Other error, reject
              reject(err);
            }
          });
        });
        return port; // Port successfully bound
      } catch (error: unknown) {
        // Check if it's EADDRINUSE, otherwise rethrow or handle
        const nodeErr = error as NodeJS.ErrnoException;
        if (nodeErr.code !== "EADDRINUSE") {
          // An unexpected error occurred during server start
          log("Failed to start auth server:", error);
          return null;
        }
        // EADDRINUSE occurred, loop continues
      }
    }
    console.error(
      "No available ports for authentication server (tried ports",
      this.portRange.start,
      "-",
      this.portRange.end,
      ")",
    );
    return null; // No port found
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
