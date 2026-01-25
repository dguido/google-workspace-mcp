import { encode } from "@toon-format/toon";
import { isToonEnabled } from "../config/services.js";

/**
 * Encode data as TOON for token-efficient LLM consumption.
 * Returns JSON if TOON is disabled or encoding fails.
 *
 * TOON (Token-Oriented Object Notation) reduces token consumption by 30-60%
 * compared to JSON for uniform arrays by eliminating field name repetition.
 */
export function toToon(data: Record<string, unknown>): string {
  if (!isToonEnabled()) {
    return JSON.stringify(data, null, 2);
  }
  try {
    return encode(data);
  } catch {
    return JSON.stringify(data, null, 2);
  }
}
