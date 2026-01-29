/**
 * OAuth scope configuration per Google Workspace service.
 *
 * Only requests scopes for services enabled via GOOGLE_WORKSPACE_SERVICES env var.
 * This provides cleaner consent screens and follows principle of least privilege.
 */

import { getEnabledServices, type ServiceName } from "./services.js";

/**
 * OAuth scopes required for each service.
 * Map of service name to array of scope suffixes (without googleapis.com prefix).
 */
const SERVICE_SCOPES: Record<ServiceName, string[]> = {
  drive: ["drive", "drive.file", "drive.readonly"],
  docs: ["documents"],
  sheets: ["spreadsheets"],
  slides: ["presentations"],
  calendar: ["calendar"],
  gmail: ["gmail.modify", "mail.google.com", "gmail.settings.basic"],
  contacts: ["contacts"],
};

/** Scopes that don't use the standard googleapis.com/auth/ prefix */
const FULL_URL_SCOPES = new Set(["mail.google.com"]);

/**
 * Convert a scope suffix to a full OAuth scope URL.
 */
function toScopeUrl(scope: string): string {
  if (FULL_URL_SCOPES.has(scope)) {
    return `https://${scope}/`;
  }
  return `https://www.googleapis.com/auth/${scope}`;
}

/**
 * Get OAuth scopes for all enabled services.
 *
 * Uses GOOGLE_WORKSPACE_SERVICES env var to determine which services are enabled.
 * If not set, returns scopes for all services (backward compatible).
 *
 * @returns Array of full OAuth scope URLs
 */
export function getScopesForEnabledServices(): string[] {
  const enabled = getEnabledServices();
  const scopes = new Set<string>();

  for (const service of enabled) {
    const serviceScopes = SERVICE_SCOPES[service];
    if (serviceScopes) {
      for (const scope of serviceScopes) {
        scopes.add(toScopeUrl(scope));
      }
    }
  }

  return [...scopes];
}

/**
 * Get all possible OAuth scopes (for documentation/debugging).
 */
export function getAllScopes(): string[] {
  const scopes = new Set<string>();

  for (const serviceScopes of Object.values(SERVICE_SCOPES)) {
    for (const scope of serviceScopes) {
      scopes.add(toScopeUrl(scope));
    }
  }

  return [...scopes];
}
