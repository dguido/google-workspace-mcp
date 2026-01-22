/**
 * Service configuration for enabling/disabling Google Workspace services.
 *
 * Users can set GOOGLE_WORKSPACE_SERVICES env var to a comma-separated list
 * of services to enable (e.g., "drive,gmail"). If not set, all services are enabled.
 */

export const SERVICE_NAMES = ["drive", "docs", "sheets", "slides", "calendar", "gmail"] as const;
export type ServiceName = (typeof SERVICE_NAMES)[number];

/** Unified tools require all these services to function */
const UNIFIED_REQUIRED_SERVICES: ServiceName[] = ["drive", "docs", "sheets", "slides"];

/** Cached set of enabled services (null = not yet parsed) */
let enabledServices: Set<ServiceName> | null = null;

/**
 * Parse and return the set of enabled services from GOOGLE_WORKSPACE_SERVICES env var.
 *
 * - Not set → all services enabled (backward compatible)
 * - Empty → no services enabled
 * - "drive,gmail" → only those services enabled
 * - Unknown services → warning logged, valid services still work
 */
export function getEnabledServices(): Set<ServiceName> {
  if (enabledServices !== null) return enabledServices;

  const envValue = process.env.GOOGLE_WORKSPACE_SERVICES;

  // Not set = all enabled (backward compatible)
  if (envValue === undefined) {
    enabledServices = new Set(SERVICE_NAMES);
    return enabledServices;
  }

  // Empty = none enabled
  if (envValue.trim() === "") {
    enabledServices = new Set();
    return enabledServices;
  }

  // Parse comma-separated list
  const requested = envValue
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const valid = new Set<ServiceName>();
  const unknown: string[] = [];

  for (const service of requested) {
    if (SERVICE_NAMES.includes(service as ServiceName)) {
      valid.add(service as ServiceName);
    } else {
      unknown.push(service);
    }
  }

  if (unknown.length > 0) {
    console.warn(
      `[google-workspace-mcp] Unknown services: ${unknown.join(", ")}. ` +
        `Valid: ${SERVICE_NAMES.join(", ")}`,
    );
  }

  enabledServices = valid;
  return enabledServices;
}

/**
 * Check if a specific service is enabled.
 */
export function isServiceEnabled(service: ServiceName): boolean {
  return getEnabledServices().has(service);
}

/**
 * Check if unified tools (create_file, update_file, get_file_content) are enabled.
 * Unified tools require drive, docs, sheets, and slides to all be enabled.
 */
export function areUnifiedToolsEnabled(): boolean {
  const enabled = getEnabledServices();
  return UNIFIED_REQUIRED_SERVICES.every((s) => enabled.has(s));
}

/**
 * Reset cached service config (for testing).
 */
export function resetServiceConfig(): void {
  enabledServices = null;
}
