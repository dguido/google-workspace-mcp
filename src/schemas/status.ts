import { z } from "zod";

/**
 * Schema for get_status tool - returns full health, auth, and diagnostics.
 */
export const GetStatusSchema = z.object({});

export type GetStatusInput = z.infer<typeof GetStatusSchema>;
