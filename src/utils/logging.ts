/**
 * Logging utility for the Google Drive MCP server.
 * Outputs timestamped messages to stderr to avoid interfering with MCP communication.
 */
export function log(message: string, data?: unknown): void {
  const timestamp = new Date().toISOString();
  const logMessage = data
    ? `[${timestamp}] ${message}: ${JSON.stringify(data)}`
    : `[${timestamp}] ${message}`;
  console.error(logMessage);
}
