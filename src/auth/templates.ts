/**
 * HTML templates for OAuth authentication pages.
 * Consolidates all HTML rendering to eliminate duplication.
 */

import type { GoogleAuthError } from "../errors/index.js";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const BASE_STYLES = `
  body {
    font-family: sans-serif;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    background-color: #f4f4f4;
    margin: 0;
    padding: 1em;
  }
  .container {
    text-align: center;
    padding: 2em;
    background-color: #fff;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    max-width: 600px;
  }
`;

const SUCCESS_STYLES = `
  ${BASE_STYLES}
  h1 { color: #4CAF50; }
  p { color: #333; margin-bottom: 0.5em; }
  code {
    background-color: #eee;
    padding: 0.2em 0.4em;
    border-radius: 3px;
    font-size: 0.9em;
  }
  .warning {
    background-color: #fff3cd;
    border: 1px solid #ffc107;
    border-radius: 4px;
    padding: 1em;
    margin-top: 1em;
  }
  .warning p { color: #856404; margin: 0.3em 0; }
`;

const ERROR_STYLES = `
  ${BASE_STYLES}
  .container { text-align: left; }
  h1 { color: #F44336; text-align: center; }
  .error-code {
    background-color: #ffebee;
    color: #c62828;
    padding: 0.5em 1em;
    border-radius: 4px;
    font-family: monospace;
    margin: 1em 0;
  }
  .reason { color: #333; margin-bottom: 1.5em; }
  h2 { color: #1976d2; font-size: 1.1em; margin-top: 1.5em; }
  ol { padding-left: 1.5em; }
  li { margin-bottom: 0.5em; color: #555; }
  ul { padding-left: 1em; list-style: none; }
  ul li { margin-bottom: 0.3em; }
  a { color: #1976d2; }
`;

const CSRF_ERROR_STYLES = `
  ${BASE_STYLES}
  h1 { color: #F44336; }
`;

/**
 * Render the success page after OAuth completion.
 */
export function renderSuccessPage(tokenPath: string, gitignoreWarning: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Authentication Successful</title>
      <style>${SUCCESS_STYLES}</style>
    </head>
    <body>
      <div class="container">
        <h1>Authentication Successful!</h1>
        <p>Your authentication tokens have been saved successfully to:</p>
        <p><code>${escapeHtml(tokenPath)}</code></p>${gitignoreWarning}
        <p style="margin-top: 1em;">You can now close this browser window.</p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Build the gitignore warning HTML if tokens are stored at project level.
 */
export function buildGitignoreWarning(credentialsDir: string): string {
  return `
    <div class="warning">
      <p><strong>⚠️ Security:</strong> Add your credentials directory to .gitignore:</p>
      <p><code>${escapeHtml(credentialsDir)}/</code></p>
    </div>`;
}

/**
 * Render the error page with actionable guidance.
 */
export function renderErrorPage(authError: GoogleAuthError): string {
  const fixStepsHtml = authError.fix
    .map((step, i) => `<li>${i + 1}. ${escapeHtml(step)}</li>`)
    .join("");

  const linksHtml = authError.links
    ? authError.links
        .map(
          (link) =>
            `<li><a href="${escapeHtml(link.url)}" target="_blank">${escapeHtml(link.label)}</a></li>`,
        )
        .join("")
    : "";

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Authentication Failed</title>
      <style>${ERROR_STYLES}</style>
    </head>
    <body>
      <div class="container">
        <h1>Authentication Failed</h1>
        <div class="error-code">${escapeHtml(authError.code)}</div>
        <p class="reason">${escapeHtml(authError.reason)}</p>
        <h2>How to fix:</h2>
        <ol>${fixStepsHtml}</ol>
        ${linksHtml ? `<h2>Helpful links:</h2><ul>${linksHtml}</ul>` : ""}
      </div>
    </body>
    </html>
  `;
}

/**
 * Render the CSRF error page (invalid state parameter).
 */
export function renderCsrfErrorPage(): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <title>Authentication Failed</title>
      <style>${CSRF_ERROR_STYLES}</style>
    </head>
    <body>
      <div class="container">
        <h1>Authentication Failed</h1>
        <p>Invalid state parameter. This may indicate a CSRF attack.</p>
        <p>Please close this window and try again.</p>
      </div>
    </body>
    </html>
  `;
}
