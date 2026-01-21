/**
 * Retry utility with exponential backoff for Google API rate limiting
 */

import { log } from "./logging.js";

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 5) */
  maxRetries?: number;
  /** Initial delay in milliseconds (default: 1000) */
  initialDelayMs?: number;
  /** Maximum delay in milliseconds (default: 60000) */
  maxDelayMs?: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number;
  /** Jitter factor to add randomness (0-1, default: 0.1) */
  jitterFactor?: number;
  /** Operation name for logging */
  operationName?: string;
}

export interface GoogleApiError {
  code?: number;
  status?: number;
  message?: string;
  errors?: Array<{ reason?: string; domain?: string; message?: string }>;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 5,
  initialDelayMs: 1000,
  maxDelayMs: 60000,
  backoffMultiplier: 2,
  jitterFactor: 0.1,
  operationName: "API call",
};

/**
 * HTTP status codes that indicate a retryable error
 */
const RETRYABLE_STATUS_CODES = [
  429, // Too Many Requests (rate limited)
  500, // Internal Server Error
  502, // Bad Gateway
  503, // Service Unavailable
  504, // Gateway Timeout
];

/**
 * Google API error reasons that indicate a retryable error
 */
const RETRYABLE_REASONS = [
  "rateLimitExceeded",
  "userRateLimitExceeded",
  "quotaExceeded",
  "internalError",
  "backendError",
];

/**
 * Determines if an error is retryable
 */
function isRetryableError(error: unknown): boolean {
  const apiError = error as GoogleApiError;

  // Check HTTP status code
  const statusCode = apiError.code || apiError.status;
  if (statusCode && RETRYABLE_STATUS_CODES.includes(statusCode)) {
    return true;
  }

  // Check Google API error reasons
  if (apiError.errors?.length) {
    for (const err of apiError.errors) {
      if (err.reason && RETRYABLE_REASONS.includes(err.reason)) {
        return true;
      }
    }
  }

  // Check error message for rate limit indicators
  const message = apiError.message?.toLowerCase() || "";
  if (
    message.includes("rate limit") ||
    message.includes("quota") ||
    message.includes("too many requests")
  ) {
    return true;
  }

  return false;
}

/**
 * Calculates the delay for the next retry attempt with exponential backoff and jitter
 */
function calculateDelay(attempt: number, options: Required<RetryOptions>): number {
  // Exponential backoff: initialDelay * (multiplier ^ attempt)
  const exponentialDelay = options.initialDelayMs * Math.pow(options.backoffMultiplier, attempt);

  // Cap at max delay
  const cappedDelay = Math.min(exponentialDelay, options.maxDelayMs);

  // Add jitter to prevent thundering herd
  const jitter = cappedDelay * options.jitterFactor * Math.random();
  const finalDelay = cappedDelay + jitter;

  return Math.floor(finalDelay);
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Executes an async operation with automatic retry and exponential backoff
 *
 * @param operation - The async operation to execute
 * @param options - Retry configuration options
 * @returns The result of the operation
 * @throws The last error if all retries are exhausted
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => drive.files.list({ pageSize: 100 }),
 *   { operationName: 'listFiles', maxRetries: 3 }
 * );
 * ```
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const config = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (attempt >= config.maxRetries) {
        log(`${config.operationName} failed after ${config.maxRetries + 1} attempts`, {
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }

      if (!isRetryableError(error)) {
        log(`${config.operationName} failed with non-retryable error`, {
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }

      // Calculate delay and wait
      const delayMs = calculateDelay(attempt, config);
      log(`${config.operationName} failed, retrying in ${delayMs}ms`, {
        attempt: attempt + 1,
        maxRetries: config.maxRetries,
        error: error instanceof Error ? error.message : String(error),
      });

      await sleep(delayMs);
    }
  }

  throw lastError;
}

/**
 * Creates a retry wrapper with preset options
 *
 * @param defaultOptions - Default options for all retry operations
 * @returns A retry function with preset options
 *
 * @example
 * ```typescript
 * const retryWithDefaults = createRetryWrapper({ maxRetries: 3 });
 * const result = await retryWithDefaults(
 *   () => drive.files.get({ fileId: '123' }),
 *   { operationName: 'getFile' }
 * );
 * ```
 */
export function createRetryWrapper(defaultOptions: RetryOptions) {
  return async function <T>(operation: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
    return withRetry(operation, { ...defaultOptions, ...options });
  };
}

/**
 * Batch operation processor with rate limiting
 *
 * Processes items in parallel with a configurable concurrency limit
 * to avoid overwhelming the Google API.
 *
 * @param items - Items to process
 * @param processor - Function to process each item
 * @param options - Configuration options
 * @returns Results for each item (success or error)
 */
export async function withRateLimitedBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  options: {
    /** Maximum concurrent operations (default: 5) */
    concurrency?: number;
    /** Delay between batches in ms (default: 100) */
    batchDelayMs?: number;
    /** Operation name for logging */
    operationName?: string;
  } = {},
): Promise<Array<{ success: true; result: R } | { success: false; error: string }>> {
  const { concurrency = 5, batchDelayMs = 100, operationName = "batch operation" } = options;

  const results: Array<{ success: true; result: R } | { success: false; error: string }> = [];

  // Process in batches
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);

    log(`Processing ${operationName} batch`, {
      batchStart: i,
      batchSize: batch.length,
      totalItems: items.length,
    });

    const batchResults = await Promise.all(
      batch.map(
        async (item): Promise<{ success: true; result: R } | { success: false; error: string }> => {
          try {
            const result = await withRetry(() => processor(item), {
              operationName,
              maxRetries: 3,
            });
            return { success: true, result };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        },
      ),
    );

    results.push(...batchResults);

    // Add delay between batches to avoid rate limits
    if (i + concurrency < items.length) {
      await sleep(batchDelayMs);
    }
  }

  return results;
}
