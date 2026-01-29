/**
 * Shared credential types for token storage and status reporting.
 */

import { z } from "zod";
import type { Credentials } from "google-auth-library";

/** Extended credentials with our metadata (creation time and scope) */
export interface StoredCredentials extends Credentials {
  created_at?: string;
  scope?: string;
}

/** OAuth credentials file structure (supports installed, web, and flat formats) */
export interface CredentialsFile {
  installed?: {
    client_id?: string;
    client_secret?: string;
    redirect_uris?: string[];
  };
  web?: {
    client_id?: string;
    client_secret?: string;
    redirect_uris?: string[];
  };
  client_id?: string;
  client_secret?: string;
  redirect_uris?: string[];
}

// Zod schemas for runtime validation

const OAuthClientConfigSchema = z.object({
  client_id: z.string().optional(),
  client_secret: z.string().optional(),
  redirect_uris: z.array(z.string()).optional(),
});

/** Schema for OAuth credentials file (supports installed, web, and flat formats) */
export const CredentialsFileSchema = z.object({
  installed: OAuthClientConfigSchema.optional(),
  web: OAuthClientConfigSchema.optional(),
  client_id: z.string().optional(),
  client_secret: z.string().optional(),
  redirect_uris: z.array(z.string()).optional(),
});

/** Schema for stored tokens with our metadata */
export const StoredCredentialsSchema = z.object({
  access_token: z.string().optional(),
  refresh_token: z.string().optional(),
  expiry_date: z.number().optional(),
  token_type: z.string().optional(),
  scope: z.string().optional(),
  created_at: z.string().optional(),
});

/**
 * Parse and validate a credentials file.
 * @throws Error if JSON is invalid or doesn't match expected structure
 */
export function parseCredentialsFile(content: string): CredentialsFile {
  const parsed = JSON.parse(content);
  const result = CredentialsFileSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Invalid credentials file: ${result.error.message}`);
  }
  return result.data;
}

/**
 * Parse and validate stored credentials.
 * @returns Parsed credentials or null if invalid
 */
export function parseStoredCredentials(content: string): StoredCredentials | null {
  try {
    const parsed = JSON.parse(content);
    const result = StoredCredentialsSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
