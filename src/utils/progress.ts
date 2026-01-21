/**
 * Progress notification utilities for long-running operations
 *
 * MCP supports out-of-band progress notifications that allow servers
 * to report progress on long-running operations back to the client.
 *
 * Progress notifications require:
 * 1. The client to include a progressToken in their request
 * 2. The server to send notifications/progress with that token
 */

import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { log } from "./logging.js";

export interface ProgressReporter {
  /**
   * Report progress to the client
   * @param progress - Current progress count
   * @param total - Optional total count (if known)
   * @param message - Optional status message
   */
  report(progress: number, total?: number, message?: string): Promise<void>;

  /**
   * Check if progress reporting is available
   */
  isAvailable(): boolean;
}

/**
 * Create a progress reporter for a given operation
 *
 * @param server - The MCP server instance
 * @param progressToken - The progress token from the client request (if any)
 * @returns A ProgressReporter that can be used to send progress updates
 *
 * @example
 * ```typescript
 * const reporter = createProgressReporter(server, request.params._meta?.progressToken);
 *
 * for (let i = 0; i < items.length; i++) {
 *   await processItem(items[i]);
 *   await reporter.report(i + 1, items.length, `Processing ${items[i].name}`);
 * }
 * ```
 */
export function createProgressReporter(
  server: Server,
  progressToken?: string | number,
): ProgressReporter {
  // Access the notification method on the server
  // The Server class has a notification method inherited from Protocol
  const serverAny = server as unknown as {
    notification(notification: { method: string; params: unknown }): Promise<void>;
  };

  const canReport = !!progressToken;

  return {
    isAvailable(): boolean {
      return canReport;
    },

    async report(progress: number, total?: number, message?: string): Promise<void> {
      if (!canReport) {
        return;
      }

      try {
        await serverAny.notification({
          method: "notifications/progress",
          params: {
            progressToken,
            progress,
            ...(total !== undefined && { total }),
            ...(message !== undefined && { message }),
          },
        });
      } catch (error) {
        // Log but don't fail the operation if progress notification fails
        log("Failed to send progress notification", {
          error: error instanceof Error ? error.message : String(error),
          progress,
          total,
          message,
        });
      }
    },
  };
}

/**
 * Options for batch processing with progress
 */
export interface BatchWithProgressOptions<T, R> {
  /** The MCP server instance */
  server: Server;
  /** Progress token from the client request */
  progressToken?: string | number;
  /** Items to process */
  items: T[];
  /** Function to process each item */
  processor: (item: T, index: number) => Promise<R>;
  /** Maximum concurrent operations (default: 5) */
  concurrency?: number;
  /** Operation name for progress messages */
  operationName?: string;
}

/**
 * Process items in batches with progress reporting
 *
 * @returns Results for each item with success/error status
 *
 * @example
 * ```typescript
 * const results = await processBatchWithProgress({
 *   server,
 *   progressToken: request.params._meta?.progressToken,
 *   items: fileIds,
 *   processor: async (fileId) => {
 *     await drive.files.trash({ fileId });
 *     return { fileId };
 *   },
 *   operationName: 'Deleting files'
 * });
 * ```
 */
export async function processBatchWithProgress<T, R>(
  options: BatchWithProgressOptions<T, R>,
): Promise<Array<{ success: true; result: R } | { success: false; error: string; item: T }>> {
  const {
    server,
    progressToken,
    items,
    processor,
    concurrency = 5,
    operationName = "Processing",
  } = options;

  const reporter = createProgressReporter(server, progressToken);
  const results: Array<{ success: true; result: R } | { success: false; error: string; item: T }> =
    [];
  let completed = 0;

  // Report initial progress
  if (reporter.isAvailable()) {
    await reporter.report(0, items.length, `Starting ${operationName}...`);
  }

  // Process in batches
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);

    const batchResults = await Promise.all(
      batch.map(
        async (
          item,
          batchIndex,
        ): Promise<{ success: true; result: R } | { success: false; error: string; item: T }> => {
          const index = i + batchIndex;
          try {
            const result = await processor(item, index);
            return { success: true, result };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : String(error),
              item,
            };
          }
        },
      ),
    );

    results.push(...batchResults);
    completed += batch.length;

    // Report progress after each batch
    if (reporter.isAvailable()) {
      await reporter.report(
        completed,
        items.length,
        `${operationName}: ${completed}/${items.length} complete`,
      );
    }
  }

  // Report completion
  if (reporter.isAvailable()) {
    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;
    await reporter.report(
      items.length,
      items.length,
      `${operationName} complete: ${successCount} succeeded, ${failCount} failed`,
    );
  }

  return results;
}

/**
 * Wrap a long-running operation with progress reporting
 *
 * Useful for operations that have intermediate steps you want to report on
 *
 * @example
 * ```typescript
 * const result = await withProgressReporting(
 *   server,
 *   progressToken,
 *   async (report) => {
 *     await report(1, 3, 'Step 1: Preparing...');
 *     // ... do step 1
 *
 *     await report(2, 3, 'Step 2: Processing...');
 *     // ... do step 2
 *
 *     await report(3, 3, 'Step 3: Finalizing...');
 *     // ... do step 3
 *
 *     return finalResult;
 *   }
 * );
 * ```
 */
export async function withProgressReporting<T>(
  server: Server,
  progressToken: string | number | undefined,
  operation: (
    report: (progress: number, total?: number, message?: string) => Promise<void>,
  ) => Promise<T>,
): Promise<T> {
  const reporter = createProgressReporter(server, progressToken);
  return operation((progress, total, message) => reporter.report(progress, total, message));
}
