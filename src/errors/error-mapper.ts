/**
 * Maps raw Google API errors to actionable GoogleAuthError instances.
 */

import { GaxiosError } from "gaxios";
import { GoogleAuthError } from "./google-auth-error.js";

const CONSOLE_URL = "https://console.cloud.google.com";
const ACCOUNT_URL = "https://myaccount.google.com";
const STATUS_URL = "https://status.cloud.google.com";
const GOOGLE_OAUTH_DOCS = "https://developers.google.com/identity/protocols/oauth2";
const GOOGLE_OAUTH_SCOPES = "https://developers.google.com/identity/protocols/oauth2/scopes";

interface MapperContext {
  account?: string;
  authUrl?: string;
  scope?: string;
}

interface GoogleApiErrorData {
  error?: string;
  error_description?: string;
}

/**
 * Type guard to check if an error is a Google API error (GaxiosError).
 */
export function isGoogleApiError(error: unknown): error is GaxiosError {
  return error instanceof GaxiosError;
}

/**
 * Extract error code and description from GaxiosError response.
 */
function extractErrorInfo(error: GaxiosError): { code: string; description: string } {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- GaxiosError.response.data is typed as any
  const data = error.response?.data as GoogleApiErrorData | undefined;
  const code = data?.error || error.code || "unknown";
  const description = data?.error_description || error.message || "Unknown error";
  return { code: String(code), description };
}

/**
 * Map a Google API error to a GoogleAuthError with actionable guidance.
 */
export function mapGoogleError(error: unknown, context: MapperContext = {}): GoogleAuthError {
  if (!isGoogleApiError(error)) {
    // Handle non-GaxiosError (network errors, etc.)
    if (error instanceof Error) {
      if (error.message.includes("ENOTFOUND") || error.message.includes("ECONNREFUSED")) {
        return createNetworkError(error, context);
      }
      return createUnknownError(error, context);
    }
    return createUnknownError(new Error(String(error)), context);
  }

  const { code, description } = extractErrorInfo(error);
  const status = error.response?.status;

  // Map by error code first (OAuth errors)
  switch (code) {
    case "redirect_uri_mismatch":
      return createRedirectUriMismatchError(description, error, context);
    case "invalid_client":
      return createInvalidClientError(description, error, context);
    case "deleted_client":
      return createDeletedClientError(description, error, context);
    case "invalid_grant":
      return createInvalidGrantError(description, error, context);
    case "access_denied":
      return createAccessDeniedError(description, error, context);
    case "insufficient_scope":
      return createInsufficientScopeError(description, error, context);
  }

  // Map by HTTP status code
  if (status === 401) {
    return createTokenExpiredError(description, error, context);
  }
  if (status === 403) {
    // Check for specific 403 reasons
    if (description.includes("API has not been used") || description.includes("not enabled")) {
      return createApiNotEnabledError(description, error, context);
    }
    if (description.includes("scope") || description.includes("permission")) {
      return createInsufficientScopeError(description, error, context);
    }
    return createAccessDeniedError(description, error, context);
  }
  if (status === 429) {
    return createQuotaExceededError(description, error, context);
  }

  // Check for network-related errors
  if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT") {
    return createNetworkError(error, context);
  }

  return createUnknownError(error, context);
}

function createRedirectUriMismatchError(
  description: string,
  originalError: Error,
  context: MapperContext,
): GoogleAuthError {
  return new GoogleAuthError({
    code: "REDIRECT_URI_MISMATCH",
    reason: `OAuth redirect URI mismatch: ${description}`,
    fix: [
      "Go to Google Cloud Console > APIs & Services > Credentials",
      "Edit your OAuth 2.0 Client ID",
      "If using Desktop App: Change application type to 'Desktop app'",
      "If using Web App: Add http://127.0.0.1/oauth2callback to authorized redirect URIs",
      "Save changes and try again",
    ],
    links: [
      { label: "Google Cloud Credentials", url: `${CONSOLE_URL}/apis/credentials` },
      {
        label: "OAuth Setup Guide",
        url: GOOGLE_OAUTH_DOCS,
      },
    ],
    originalError,
    ...context,
  });
}

function createInvalidClientError(
  description: string,
  originalError: Error,
  context: MapperContext,
): GoogleAuthError {
  return new GoogleAuthError({
    code: "INVALID_CLIENT",
    reason: `OAuth client credentials are invalid: ${description}`,
    fix: [
      "Verify your client_id ends with .apps.googleusercontent.com",
      "Check that client_secret matches the one in Google Cloud Console",
      "If credentials were recently regenerated, download fresh credentials",
      "Ensure the credentials file is valid JSON",
    ],
    links: [
      { label: "Google Cloud Credentials", url: `${CONSOLE_URL}/apis/credentials` },
      { label: "Download Credentials Help", url: `${CONSOLE_URL}/apis/credentials` },
    ],
    originalError,
    ...context,
  });
}

function createDeletedClientError(
  description: string,
  originalError: Error,
  context: MapperContext,
): GoogleAuthError {
  return new GoogleAuthError({
    code: "DELETED_CLIENT",
    reason: `OAuth client has been deleted from Google Cloud: ${description}`,
    fix: [
      "The OAuth client in your credentials file no longer exists in Google Cloud",
      "Go to Google Cloud Console > APIs & Services > Credentials",
      "Create a new OAuth 2.0 Client ID (Desktop app type)",
      "Download and save as gcp-oauth.keys.json",
      "Delete existing tokens and re-authenticate",
    ],
    links: [{ label: "Create OAuth Credentials", url: `${CONSOLE_URL}/apis/credentials` }],
    originalError,
    ...context,
  });
}

function createInvalidGrantError(
  description: string,
  originalError: Error,
  context: MapperContext,
): GoogleAuthError {
  return new GoogleAuthError({
    code: "INVALID_GRANT",
    reason: `Your authentication token has been revoked or expired: ${description}`,
    fix: [
      "Run the authentication flow again: npx @dguido/google-workspace-mcp auth",
      "When prompted, click 'Allow' to grant permissions",
      "If the issue persists, check if the app was removed from your Google Account",
    ],
    links: [
      {
        label: "Third-party apps in your account",
        url: `${ACCOUNT_URL}/connections`,
      },
    ],
    authUrl: context.authUrl,
    originalError,
    account: context.account,
  });
}

function createAccessDeniedError(
  description: string,
  originalError: Error,
  context: MapperContext,
): GoogleAuthError {
  return new GoogleAuthError({
    code: "ACCESS_DENIED",
    reason: `Access was denied: ${description}`,
    fix: [
      "Re-run authentication and click 'Allow' when prompted",
      "If OAuth consent screen says app is unverified, click 'Advanced' then 'Go to [app]'",
      "Check that you're authenticating with the correct Google account",
    ],
    links: [{ label: "OAuth Consent Screen", url: `${CONSOLE_URL}/apis/credentials/consent` }],
    authUrl: context.authUrl,
    originalError,
    ...context,
  });
}

function createTokenExpiredError(
  description: string,
  originalError: Error,
  context: MapperContext,
): GoogleAuthError {
  return new GoogleAuthError({
    code: "TOKEN_EXPIRED",
    reason: `Your access token has expired and could not be refreshed: ${description}`,
    fix: [
      "Run authentication again: npx @dguido/google-workspace-mcp auth",
      "Ensure you have a stable internet connection",
      "Check that your refresh token has not been revoked",
    ],
    authUrl: context.authUrl,
    originalError,
    ...context,
  });
}

function createInsufficientScopeError(
  description: string,
  originalError: Error,
  context: MapperContext,
): GoogleAuthError {
  return new GoogleAuthError({
    code: "INSUFFICIENT_SCOPE",
    reason: `Missing required permissions: ${description}`,
    fix: [
      "Re-authenticate to grant all required permissions",
      "Run: npx @dguido/google-workspace-mcp auth",
      "When prompted, ensure all permission checkboxes are selected",
    ],
    links: [
      {
        label: "OAuth Scopes Reference",
        url: GOOGLE_OAUTH_SCOPES,
      },
    ],
    authUrl: context.authUrl,
    originalError,
    scope: context.scope,
    ...context,
  });
}

function createApiNotEnabledError(
  description: string,
  originalError: Error,
  context: MapperContext,
): GoogleAuthError {
  // Try to extract API name from error message
  const apiMatch = description.match(/(\w+)\s+API/i);
  const apiName = apiMatch ? apiMatch[1] : "the required";

  return new GoogleAuthError({
    code: "API_NOT_ENABLED",
    reason: `${apiName} API is not enabled for your project`,
    fix: [
      "Go to Google Cloud Console > APIs & Services > Library",
      `Search for "${apiName} API" and enable it`,
      "Wait a few minutes for the change to propagate",
      "Try your request again",
    ],
    links: [
      { label: "API Library", url: `${CONSOLE_URL}/apis/library` },
      { label: "Enable Drive API", url: `${CONSOLE_URL}/apis/library/drive.googleapis.com` },
      { label: "Enable Docs API", url: `${CONSOLE_URL}/apis/library/docs.googleapis.com` },
      { label: "Enable Sheets API", url: `${CONSOLE_URL}/apis/library/sheets.googleapis.com` },
      { label: "Enable Slides API", url: `${CONSOLE_URL}/apis/library/slides.googleapis.com` },
      {
        label: "Enable Calendar API",
        url: `${CONSOLE_URL}/apis/library/calendar-json.googleapis.com`,
      },
      { label: "Enable Gmail API", url: `${CONSOLE_URL}/apis/library/gmail.googleapis.com` },
    ],
    originalError,
    ...context,
  });
}

function createQuotaExceededError(
  description: string,
  originalError: Error,
  context: MapperContext,
): GoogleAuthError {
  return new GoogleAuthError({
    code: "QUOTA_EXCEEDED",
    reason: `API quota has been exceeded: ${description}`,
    fix: [
      "Wait a few minutes and try again",
      "Check your API quota usage in Google Cloud Console",
      "Consider requesting a quota increase if needed",
    ],
    links: [
      { label: "API Quotas", url: `${CONSOLE_URL}/apis/api/drive.googleapis.com/quotas` },
      { label: "Request Quota Increase", url: `${CONSOLE_URL}/iam-admin/quotas` },
    ],
    originalError,
    ...context,
  });
}

function createNetworkError(originalError: Error, context: MapperContext): GoogleAuthError {
  return new GoogleAuthError({
    code: "NETWORK_ERROR",
    reason: "Unable to connect to Google APIs",
    fix: [
      "Check your internet connection",
      "Verify that googleapis.com is accessible from your network",
      "Check if there are any firewall or proxy restrictions",
      "Check Google Cloud status for any outages",
    ],
    links: [{ label: "Google Cloud Status", url: STATUS_URL }],
    originalError,
    ...context,
  });
}

function createUnknownError(originalError: Error, context: MapperContext): GoogleAuthError {
  return new GoogleAuthError({
    code: "UNKNOWN",
    reason: originalError.message || "An unknown error occurred",
    fix: [
      "Check the error message above for details",
      "Verify your OAuth credentials are configured correctly",
      "Try re-authenticating: npx @dguido/google-workspace-mcp auth",
      "Check Google Cloud Console for any project issues",
    ],
    links: [{ label: "Google Cloud Console", url: CONSOLE_URL }],
    originalError,
    ...context,
  });
}
