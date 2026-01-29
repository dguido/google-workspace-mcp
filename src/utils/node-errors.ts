/** Type guard for NodeJS errors with a `code` property (e.g., ENOENT, EEXIST) */
export function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
