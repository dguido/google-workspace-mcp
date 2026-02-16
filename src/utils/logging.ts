/**
 * Keys that must never appear in log output.
 * Values are replaced with "[REDACTED]" during serialization.
 */
const SENSITIVE_KEYS = new Set([
  "access_token",
  "refresh_token",
  "client_secret",
  "client_email",
  "id_token",
  "private_key",
  "private_key_id",
]);

const SENSITIVE_PATTERNS = [
  /ya29\.[A-Za-z0-9_-]{10,}/,
  /1\/\/[A-Za-z0-9_-]{20,}/,
  /eyJ[A-Za-z0-9_-]{10,}\.eyJ/,
  /GOCSPX-[A-Za-z0-9_-]+/,
  /-----BEGIN[A-Z ]*KEY-----/,
];

function redactSensitive(key: string, value: unknown): unknown {
  if (SENSITIVE_KEYS.has(key)) {
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

function sanitizeForLog(data: unknown): unknown {
  if (data instanceof Error) {
    return {
      message: data.message,
      name: data.name,
      ...("code" in data && {
        code: (data as { code: unknown }).code,
      }),
      ...("status" in data && {
        status: (data as { status: unknown }).status,
      }),
    };
  }
  return data;
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
    serialized = JSON.stringify(sanitizeForLog(data), redactSensitive);
  } catch {
    serialized = "[unserializable data]";
  }
  const logMessage = data
    ? `[${timestamp}] ${message}: ${serialized}`
    : `[${timestamp}] ${message}`;
  console.error(logMessage);
}
