/**
 * Status handler for health, auth status, and diagnostics - consolidated into a single tool.
 */

import * as fs from "fs/promises";
import { structuredResponse, type ToolResponse } from "../utils/responses.js";
import { validateArgs, isNodeError } from "../utils/index.js";
import {
  getEnabledServices,
  SERVICE_NAMES,
  isReadOnlyMode,
  type ServiceName,
} from "../config/services.js";
import {
  getSecureTokenPath,
  getKeysFilePath,
  credentialsFileExists,
  getActiveProfile,
  getEnvVarCredentials,
  isValidClientIdFormat,
} from "../auth/utils.js";
import { validateOAuthConfig, GoogleAuthError, type AuthErrorCode } from "../errors/index.js";
import { getLastTokenAuthError } from "../auth/tokenManager.js";
import { GetStatusSchema } from "../schemas/status.js";
import type { StoredCredentials, CredentialsFile } from "../types/credentials.js";
import type { OAuth2Client } from "google-auth-library";
import type { drive_v3 } from "googleapis";

/** Days after which testing OAuth apps expire tokens */
const TESTING_APP_EXPIRY_DAYS = 7;

/**
 * Days before expiry to start warning users.
 * Set to 6 days to give 1 day buffer before 7-day testing app token expiry.
 */
const WARNING_THRESHOLD_DAYS = TESTING_APP_EXPIRY_DAYS - 1;

/**
 * Captures time when this module is first loaded.
 * For MCP servers, this effectively equals server start time since
 * the module is loaded during server initialization.
 */
const SERVER_START_TIME = Date.now();

/** Get server uptime in seconds */
export function getUptimeSeconds(): number {
  return Math.floor((Date.now() - SERVER_START_TIME) / 1000);
}

export type OverallStatus = "ok" | "warning" | "error";
export type TokenStatus = "valid" | "expired" | "missing" | "invalid";

export interface ConfigCheck {
  name: string;
  status: OverallStatus;
  message: string;
  fix?: string[];
}

export interface TokenCheck {
  has_access_token: boolean;
  has_refresh_token: boolean;
  is_expired: boolean;
  expires_at: string | null;
  scopes: string[];
  created_at: string | null;
  age_days: number | null;
  approaching_expiry: boolean;
}

export interface StatusData extends Record<string, unknown> {
  status: OverallStatus;
  version: string;
  uptime_seconds: number;
  timestamp: string;
  profile: string | null;
  auth: {
    configured: boolean;
    credential_source: "env_var" | "file" | "none";
    token_status: TokenStatus;
    token_expires_at: string | null;
    has_refresh_token: boolean;
    scopes: string[];
  };
  enabled_services: string[];
  read_only_mode: boolean;
  config_checks: ConfigCheck[];
  token_check: TokenCheck | null;
  last_error: {
    code: AuthErrorCode;
    reason: string;
    fix: string[];
  } | null;
  api_validation: {
    success: boolean;
    user_email?: string;
    error?: string;
  } | null;
  recommendations: string[];
}

/**
 * Check if OAuth credentials are available (env vars or file).
 */
async function credentialsAvailable(): Promise<boolean> {
  if (getEnvVarCredentials()) return true;
  return credentialsFileExists();
}

/**
 * Load and parse the token file to get status info.
 */
async function getTokenInfo(): Promise<{
  status: TokenStatus;
  expires_at: string | null;
  has_refresh: boolean;
  scopes: string[];
  has_access_token: boolean;
  is_expired: boolean;
}> {
  const tokenPath = getSecureTokenPath();

  try {
    const content = await fs.readFile(tokenPath, "utf-8");
    const tokens = JSON.parse(content) as StoredCredentials | null;

    if (!tokens || typeof tokens !== "object") {
      return {
        status: "invalid",
        expires_at: null,
        has_refresh: false,
        scopes: [],
        has_access_token: false,
        is_expired: false,
      };
    }

    const hasAccessToken = !!tokens.access_token;
    const hasRefreshToken = !!tokens.refresh_token;
    const expiryDate = tokens.expiry_date;
    const scopes = tokens.scope?.split(" ") || [];

    let status: TokenStatus;
    let expiresAt: string | null = null;
    let isExpired = false;

    if (!hasAccessToken) {
      status = "invalid";
    } else if (expiryDate && Date.now() > expiryDate) {
      status = "expired";
      expiresAt = new Date(expiryDate).toISOString();
      isExpired = true;
    } else {
      status = "valid";
      if (expiryDate) {
        expiresAt = new Date(expiryDate).toISOString();
      }
    }

    return {
      status,
      expires_at: expiresAt,
      has_refresh: hasRefreshToken,
      scopes,
      has_access_token: hasAccessToken,
      is_expired: isExpired,
    };
  } catch (error: unknown) {
    // File doesn't exist or can't be parsed
    if (isNodeError(error) && error.code === "ENOENT") {
      return {
        status: "missing",
        expires_at: null,
        has_refresh: false,
        scopes: [],
        has_access_token: false,
        is_expired: false,
      };
    }
    return {
      status: "invalid",
      expires_at: null,
      has_refresh: false,
      scopes: [],
      has_access_token: false,
      is_expired: false,
    };
  }
}

/**
 * Check if credentials are available and valid (for diagnostic mode).
 * Checks env vars first, then the credentials file.
 */
async function checkCredentials(): Promise<ConfigCheck> {
  // Check env var credentials first
  const envCreds = getEnvVarCredentials();
  if (envCreds) {
    if (!isValidClientIdFormat(envCreds.client_id)) {
      return {
        name: "credentials",
        status: "error",
        message: "Invalid GOOGLE_CLIENT_ID format",
        fix: [
          "client_id should end with " + ".apps.googleusercontent.com",
          "Verify you copied the OAuth 2.0 Client ID " + "(not API Key)",
        ],
      };
    }
    return {
      name: "credentials",
      status: "ok",
      message: "Using credentials from GOOGLE_CLIENT_ID env var",
    };
  }

  const keysPath = getKeysFilePath();
  const exists = await credentialsFileExists();

  if (!exists) {
    return {
      name: "credentials",
      status: "error",
      message: `Credentials not found at: ${keysPath}`,
      fix: [
        "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET " + "env vars (simplest)",
        "Or download credentials from Google Cloud Console",
        `Save as: ${keysPath}`,
      ],
    };
  }

  try {
    const content = await fs.readFile(keysPath, "utf-8");
    const parsed = JSON.parse(content) as CredentialsFile;
    const clientId = parsed.installed?.client_id || parsed.web?.client_id || parsed.client_id;

    if (!clientId) {
      return {
        name: "credentials",
        status: "error",
        message: "Credentials file missing client_id",
        fix: ["Download fresh credentials from Google Cloud Console"],
      };
    }

    if (!isValidClientIdFormat(clientId)) {
      return {
        name: "credentials",
        status: "error",
        message: "Invalid client_id format",
        fix: [
          "Ensure you downloaded OAuth 2.0 Client credentials",
          "client_id should end with " + ".apps.googleusercontent.com",
        ],
      };
    }

    return {
      name: "credentials",
      status: "ok",
      message: `Valid credentials file at: ${keysPath}`,
    };
  } catch (parseError) {
    return {
      name: "credentials",
      status: "error",
      message: `Failed to parse credentials file: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
      fix: ["Ensure the file is valid JSON", "Download fresh credentials"],
    };
  }
}

/**
 * Check token file status (for diagnostic mode).
 */
async function checkTokenFile(): Promise<{ check: ConfigCheck; tokenInfo: TokenCheck | null }> {
  const tokenPath = getSecureTokenPath();

  try {
    await fs.access(tokenPath);
  } catch {
    return {
      check: {
        name: "token_file",
        status: "warning",
        message: `No token file at: ${tokenPath}`,
        fix: ["Run authentication: npx @dguido/google-workspace-mcp auth"],
      },
      tokenInfo: null,
    };
  }

  try {
    const content = await fs.readFile(tokenPath, "utf-8");
    const tokens = JSON.parse(content) as StoredCredentials;

    const hasAccessToken = !!tokens.access_token;
    const hasRefreshToken = !!tokens.refresh_token;
    const expiryDate = tokens.expiry_date;
    const isExpired = expiryDate ? Date.now() > expiryDate : false;
    const scopes = tokens.scope?.split(" ") || [];

    // Calculate token age
    const createdAt = tokens.created_at || null;
    let ageDays: number | null = null;
    let approachingExpiry = false;

    if (createdAt) {
      const createdDate = new Date(createdAt);
      const now = new Date();
      ageDays = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
      approachingExpiry = ageDays >= WARNING_THRESHOLD_DAYS;
    }

    const tokenInfo: TokenCheck = {
      has_access_token: hasAccessToken,
      has_refresh_token: hasRefreshToken,
      is_expired: isExpired,
      expires_at: expiryDate ? new Date(expiryDate).toISOString() : null,
      scopes,
      created_at: createdAt,
      age_days: ageDays,
      approaching_expiry: approachingExpiry,
    };

    if (!hasAccessToken && !hasRefreshToken) {
      return {
        check: {
          name: "token_file",
          status: "error",
          message: "Token file exists but contains no valid tokens",
          fix: ["Re-authenticate: npx @dguido/google-workspace-mcp auth"],
        },
        tokenInfo,
      };
    }

    if (isExpired && !hasRefreshToken) {
      return {
        check: {
          name: "token_file",
          status: "error",
          message: "Access token expired and no refresh token available",
          fix: ["Re-authenticate: npx @dguido/google-workspace-mcp auth"],
        },
        tokenInfo,
      };
    }

    if (isExpired) {
      return {
        check: {
          name: "token_file",
          status: "warning",
          message: "Access token expired but refresh token available",
        },
        tokenInfo,
      };
    }

    // Warn if token is approaching 7-day expiry for testing apps
    if (approachingExpiry) {
      const daysLeft = TESTING_APP_EXPIRY_DAYS - (ageDays ?? 0);
      return {
        check: {
          name: "token_file",
          status: "warning",
          message: `Token is ${ageDays} days old (${daysLeft} days until testing app expiry)`,
          fix: [
            "Publish your OAuth app to avoid 7-day token expiry",
            "Or re-authenticate soon: npx @dguido/google-workspace-mcp auth",
          ],
        },
        tokenInfo,
      };
    }

    return {
      check: {
        name: "token_file",
        status: "ok",
        message: `Valid tokens at: ${tokenPath}`,
      },
      tokenInfo,
    };
  } catch (parseError) {
    return {
      check: {
        name: "token_file",
        status: "error",
        message: `Failed to parse token file: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
        fix: ["Delete token file and re-authenticate"],
      },
      tokenInfo: null,
    };
  }
}

/**
 * Validate tokens by making a test API call.
 */
async function validateWithApi(
  drive: drive_v3.Drive | null,
): Promise<{ success: boolean; user_email?: string; error?: string }> {
  if (!drive) {
    return { success: false, error: "Drive service not initialized" };
  }

  try {
    const response = await drive.about.get({ fields: "user" });
    return {
      success: true,
      user_email: response.data.user?.emailAddress || undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Generate recommendations based on diagnostic checks.
 */
function generateRecommendations(
  configChecks: ConfigCheck[],
  tokenCheck: TokenCheck | null,
  lastError: GoogleAuthError | null,
  apiValidation: { success: boolean; error?: string } | null,
): string[] {
  const recommendations: string[] = [];

  // Check for credential issues
  const credCheck = configChecks.find((c) => c.name === "credentials");
  if (credCheck?.status === "error") {
    recommendations.push("Set up OAuth credentials first - this is required for authentication");
  }

  // Check for token issues
  const tokenFileCheck = configChecks.find((c) => c.name === "token_file");
  if (tokenFileCheck?.status === "error" || tokenFileCheck?.status === "warning") {
    recommendations.push("Run 'npx @dguido/google-workspace-mcp auth' to authenticate");
  }

  // Check for expired tokens
  if (tokenCheck?.is_expired && !tokenCheck.has_refresh_token) {
    recommendations.push("Your session has expired - re-authenticate to continue");
  }

  // Check for token approaching 7-day expiry
  if (tokenCheck?.approaching_expiry && tokenCheck.age_days !== null) {
    const daysLeft = TESTING_APP_EXPIRY_DAYS - tokenCheck.age_days;
    if (daysLeft <= 0) {
      recommendations.push(
        "Token may have expired (7-day limit for testing apps). Re-authenticate or publish your OAuth app.",
      );
    } else {
      recommendations.push(
        `Token expires in ~${daysLeft} day(s) (testing app limit). Publish your OAuth app to avoid weekly re-auth.`,
      );
    }
  }

  // Check for last error
  if (lastError) {
    recommendations.push(
      `Recent auth error (${lastError.code}): ${lastError.fix[0] || "Check logs for details"}`,
    );
  }

  // Check for API validation failure
  if (apiValidation && !apiValidation.success) {
    recommendations.push(`API validation failed: ${apiValidation.error}`);
  }

  // Check for scope mismatch in read-only mode
  if (
    isReadOnlyMode() &&
    tokenCheck &&
    tokenCheck.scopes.length > 0 &&
    tokenCheck.scopes.some((s) => !s.includes("readonly"))
  ) {
    recommendations.push(
      "Read-only mode is active but token has write scopes. " +
        "Re-authenticate for restricted scopes: " +
        "npx @dguido/google-workspace-mcp auth",
    );
  }

  // Check for missing scopes
  if (tokenCheck && tokenCheck.scopes.length === 0) {
    recommendations.push("No scopes found - re-authenticate to grant required permissions");
  }

  if (recommendations.length === 0) {
    recommendations.push("Authentication appears to be configured correctly");
  }

  return recommendations;
}

/**
 * Get server status including health, authentication, and full diagnostics.
 *
 * @param authClient - OAuth2 client (may be null if not initialized)
 * @param drive - Drive service (may be null if not initialized)
 * @param version - Server version string
 * @param args - Tool arguments
 */
export async function handleGetStatus(
  authClient: OAuth2Client | null,
  drive: drive_v3.Drive | null,
  version: string,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(GetStatusSchema, args);
  if (!validation.success) {
    return validation.response;
  }

  // Basic status info
  const configured = await credentialsAvailable();
  const tokenInfo = await getTokenInfo();
  const timestamp = new Date().toISOString();
  const uptime_seconds = getUptimeSeconds();

  // Check live token status if authClient is available
  let tokenStatus = tokenInfo.status;
  let expiresAt = tokenInfo.expires_at;

  if (authClient?.credentials) {
    const creds = authClient.credentials;
    if (creds.access_token) {
      if (creds.expiry_date && Date.now() > creds.expiry_date) {
        tokenStatus = "expired";
      } else {
        tokenStatus = "valid";
      }
      if (creds.expiry_date) {
        expiresAt = new Date(creds.expiry_date).toISOString();
      }
    }
  }

  // Get enabled services
  const enabledServicesSet = getEnabledServices();
  const enabledServices = SERVICE_NAMES.filter((s) => enabledServicesSet.has(s as ServiceName));

  // Run diagnostic checks
  const configChecks: ConfigCheck[] = [];

  configChecks.push(await checkCredentials());

  const configValidation = await validateOAuthConfig();
  if (!configValidation.valid) {
    for (const err of configValidation.errors) {
      configChecks.push({
        name: "config_validation",
        status: "error",
        message: err.reason,
        fix: err.fix,
      });
    }
  }
  for (const warning of configValidation.warnings) {
    configChecks.push({
      name: "config_validation",
      status: "warning",
      message: warning,
    });
  }

  const { check: tokenFileCheck, tokenInfo: tokenCheckData } = await checkTokenFile();
  configChecks.push(tokenFileCheck);

  const lastError = getLastTokenAuthError();

  // Validate with API
  const apiValidation = await validateWithApi(drive);
  configChecks.push({
    name: "api_validation",
    status: apiValidation.success ? "ok" : "error",
    message: apiValidation.success
      ? `API access confirmed for: ${apiValidation.user_email}`
      : `API validation failed: ${apiValidation.error}`,
  });

  // Determine overall status from config checks
  const hasError = configChecks.some((c) => c.status === "error");
  const hasWarning = configChecks.some((c) => c.status === "warning");
  const overallStatus: OverallStatus = hasError ? "error" : hasWarning ? "warning" : "ok";

  const recommendations = generateRecommendations(
    configChecks,
    tokenCheckData,
    lastError,
    apiValidation,
  );

  const activeProfile = getActiveProfile();

  const data: StatusData = {
    status: overallStatus,
    version,
    uptime_seconds,
    timestamp,
    profile: activeProfile,
    auth: {
      configured,
      credential_source: getEnvVarCredentials() ? "env_var" : configured ? "file" : "none",
      token_status: tokenStatus,
      token_expires_at: expiresAt,
      has_refresh_token: tokenInfo.has_refresh,
      scopes: tokenInfo.scopes,
    },
    enabled_services: enabledServices,
    read_only_mode: isReadOnlyMode(),
    config_checks: configChecks,
    token_check: tokenCheckData,
    last_error: lastError
      ? {
          code: lastError.code,
          reason: lastError.reason,
          fix: lastError.fix,
        }
      : null,
    api_validation: apiValidation,
    recommendations,
  };

  // Build summary
  const statusEmoji =
    overallStatus === "ok" ? "OK" : overallStatus === "warning" ? "WARN" : "ERROR";
  const profileInfo = activeProfile ? ` [${activeProfile}]` : "";
  const issues = configChecks.filter((c) => c.status !== "ok");
  const issuesSummary =
    issues.length > 0 ? `Issues: ${issues.map((i) => i.name).join(", ")}` : "No issues detected";
  const rec = recommendations[0] || "";
  const summary =
    `[${statusEmoji}] v${version}${profileInfo}, ` +
    `uptime ${uptime_seconds}s. ${issuesSummary}. ${rec}`;

  return structuredResponse(summary, data);
}
