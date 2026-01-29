import { z } from "zod";

/**
 * Schema for get_status tool - consolidated health, auth status, and diagnostics.
 */
export const GetStatusSchema = z
  .object({
    diagnose: z
      .boolean()
      .optional()
      .default(false)
      .describe("Run full diagnostic with API validation and recommendations"),
    validate_with_api: z
      .boolean()
      .optional()
      .default(false)
      .describe("Validate tokens with actual API call (requires diagnose: true)"),
  })
  .refine((data) => !data.validate_with_api || data.diagnose, {
    message: "validate_with_api requires diagnose to be true",
    path: ["validate_with_api"],
  });

export type GetStatusInput = z.infer<typeof GetStatusSchema>;
