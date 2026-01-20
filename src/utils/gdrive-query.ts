/**
 * Google Drive query building utilities.
 *
 * Google Drive's query syntax requires escaping special characters
 * in query strings. These utilities provide consistent escaping and
 * query construction for searching files and folders.
 */

/**
 * Escape special characters for Google Drive query strings.
 * Escapes backslashes and single quotes which have special meaning in queries.
 */
export function escapeQueryString(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Build a name query for exact or partial match.
 *
 * @param name - The file/folder name to search for
 * @param exact - If true, uses exact match (=). If false, uses contains.
 * @returns Query string like "name = 'escaped-name'" or "name contains 'escaped-name'"
 */
export function buildNameQuery(name: string, exact = true): string {
  const escaped = escapeQueryString(name);
  return exact ? `name = '${escaped}'` : `name contains '${escaped}'`;
}

/**
 * Build a parent folder query.
 *
 * @param folderId - The parent folder ID
 * @returns Query string like "'folderId' in parents"
 */
export function buildParentQuery(folderId: string): string {
  return `'${folderId}' in parents`;
}

/**
 * Build a full text search query.
 *
 * @param searchText - The text to search for in file contents
 * @returns Query string like "fullText contains 'escaped-text'"
 */
export function buildFullTextQuery(searchText: string): string {
  const escaped = escapeQueryString(searchText);
  return `fullText contains '${escaped}'`;
}

/**
 * Build a MIME type filter query.
 *
 * @param mimeType - The MIME type to filter for
 * @returns Query string like "mimeType = 'application/vnd.google-apps.folder'"
 */
export function buildMimeTypeQuery(mimeType: string): string {
  return `mimeType = '${mimeType}'`;
}

/**
 * Combine multiple query conditions with AND.
 *
 * @param conditions - Array of query conditions
 * @returns Combined query string with " and " between conditions
 */
export function combineQueries(...conditions: string[]): string {
  return conditions.filter(Boolean).join(' and ');
}
