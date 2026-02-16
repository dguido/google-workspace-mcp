/**
 * Keys that must never appear in log output.
 * Values are replaced with "[REDACTED]" during serialization.
 * Matching is case-insensitive.
 */
const SENSITIVE_KEYS = new Set([
  "access_token",
  "refresh_token",
  "client_secret",
  "client_email",
  "id_token",
  "private_key",
  "private_key_id",
  "authorization",
]);

const SENSITIVE_PATTERNS = [
  /ya29\.[A-Za-z0-9_-]{10,}/,
  /1\/\/[A-Za-z0-9_-]{20,}/,
  /eyJ[A-Za-z0-9_-]{10,}\.eyJ/,
  /GOCSPX-[A-Za-z0-9_-]+/,
  /-----BEGIN[A-Z ]*KEY-----/,
];

function redactSensitive(key: string, value: unknown): unknown {
  if (value instanceof Error) {
    const sanitized: Record<string, unknown> = {
      message: value.message,
      name: value.name,
      stack: value.stack,
    };
    if ("code" in value) {
      sanitized.code = (value as { code: unknown }).code;
    }
    if ("status" in value) {
      sanitized.status = (value as { status: unknown }).status;
    }
    if ("reason" in value) {
      sanitized.reason = (value as { reason: unknown }).reason;
    }
    return sanitized;
  }
  if (SENSITIVE_KEYS.has(key.toLowerCase())) {
    return "[REDACTED]";
  }
  if (typeof value === "string") {
    for (const pattern of SENSITIVE_PATTERNS) {
      if (pattern.test(value)) {
        return "[REDACTED]";
      }
    }
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
    serialized = "[unserializable data]";
  }
  const logMessage = data
    ? `[${timestamp}] ${message}: ${serialized}`
    : `[${timestamp}] ${message}`;
  console.error(logMessage);
}
