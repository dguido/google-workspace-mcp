/**
 * Formatting utilities for file sizes and other values.
 */

/**
 * Unit labels for byte formatting.
 */
const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

/**
 * Format bytes into human-readable string.
 *
 * @param bytes - The byte count (string, number, null, or undefined)
 * @param options - Formatting options
 * @param options.precision - Number of decimal places (default: 2)
 * @param options.nullValue - Value to return for null/undefined/NaN input (default: 'N/A')
 * @returns Formatted string like "1.25 MB" or "N/A"
 */
export function formatBytes(
  bytes: string | number | null | undefined,
  options: { precision?: number; nullValue?: string } = {},
): string {
  const { precision = 2, nullValue = "N/A" } = options;

  // Handle null/undefined
  if (bytes === null || bytes === undefined) {
    return nullValue;
  }

  // Parse to number
  const num = typeof bytes === "string" ? parseInt(bytes, 10) : bytes;

  // Handle NaN or invalid
  if (isNaN(num)) {
    return nullValue;
  }

  // Handle zero
  if (num === 0) {
    return "0 B";
  }

  // Find appropriate unit
  let unitIndex = 0;
  let value = Math.abs(num);

  while (value >= 1024 && unitIndex < BYTE_UNITS.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  // Preserve sign
  if (num < 0) {
    value = -value;
  }

  // Format with precision, but strip trailing zeros for whole numbers
  const formatted = value.toFixed(precision);
  return `${formatted} ${BYTE_UNITS[unitIndex]}`;
}

/**
 * Format bytes with a compact style (1 decimal place, B instead of bytes).
 * Useful for condensed displays like tables.
 *
 * @param bytes - The byte count
 * @param nullValue - Value to return for null/undefined input
 * @returns Formatted string like "1.2 MB" or "N/A"
 */
export function formatBytesCompact(
  bytes: string | number | null | undefined,
  nullValue = "N/A",
): string {
  return formatBytes(bytes, { precision: 1, nullValue });
}
