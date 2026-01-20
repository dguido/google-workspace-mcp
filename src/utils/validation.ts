import type { z } from 'zod';
import { errorResponse } from './responses.js';
import type { ToolResponse } from './responses.js';

/**
 * Result type for validation helper.
 * Either returns validated data or an error response.
 */
export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; response: ToolResponse };

/**
 * Validates arguments against a Zod schema.
 * Returns a discriminated union to allow clean early returns.
 *
 * @example
 * const validation = validateArgs(MySchema, args);
 * if (!validation.success) return validation.response;
 * const data = validation.data;
 */
export function validateArgs<T>(schema: z.ZodSchema<T>, args: unknown): ValidationResult<T> {
  const result = schema.safeParse(args);
  if (!result.success) {
    return {
      success: false,
      response: errorResponse(result.error.errors[0].message),
    };
  }
  return { success: true, data: result.data };
}
