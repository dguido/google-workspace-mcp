/**
 * Keys that must never appear in log output.
 * Values are replaced with "[REDACTED]" during serialization.
 */
const SENSITIVE_KEYS = new Set([
  "access_token",
  "refresh_token",
  "client_secret",
  "id_token",
  "private_key",
  "private_key_id",
]);

function redactSensitive(_key: string, value: unknown): unknown {
  if (typeof _key === "string" && SENSITIVE_KEYS.has(_key)) {
    return "[REDACTED]";
  }
  return value;
}

/**
 * Logging utility for the Google Workspace MCP server.
 * Outputs timestamped messages to stderr to avoid interfering
 * with MCP communication. Automatically redacts sensitive fields.
 */
export function log(message: string, data?: unknown): void {
  const timestamp = new Date().toISOString();
  let serialized: string;
  try {
    serialized = JSON.stringify(data, redactSensitive);
  } catch {
    serialized = String(data);
  }
  const logMessage = data
    ? `[${timestamp}] ${message}: ${serialized}`
    : `[${timestamp}] ${message}`;
  console.error(logMessage);
}
