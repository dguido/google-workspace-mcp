/**
 * Timeout wrapper for async operations.
 * Wraps a promise with a timeout to prevent hanging requests.
 */

/** Default timeout for Google API calls (30 seconds) */
export const DEFAULT_API_TIMEOUT_MS = 30000;

/**
 * Wraps a promise with a timeout.
 * If the promise doesn't resolve within the specified time, it rejects with a timeout error.
 *
 * @param promise - The promise to wrap
 * @param ms - Timeout in milliseconds (default: 30000)
 * @param operation - Description of the operation for error messages
 * @returns The result of the promise if it resolves in time
 * @throws Error if the operation times out
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number = DEFAULT_API_TIMEOUT_MS,
  operation: string = 'Operation'
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${operation} timed out after ${ms}ms`));
    }, ms);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}
