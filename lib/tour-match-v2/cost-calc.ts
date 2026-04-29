/**
 * Haiku 4.5 token cost calculator.
 *
 * Per-million-token pricing (claude-haiku-4-5 as of 2026-04):
 *   input:        $1.00
 *   cache_create: $1.25
 *   cache_read:   $0.10
 *   output:       $5.00
 */

import type { ParsedQueryV2 } from "./types";

const HAIKU_PRICING_PER_M = {
  input: 1.0,
  cache_create: 1.25,
  cache_read: 0.1,
  output: 5.0,
} as const;

export function computeHaikuCost(t: NonNullable<ParsedQueryV2["_telemetry"]>): number {
  return (
    (t.input_tokens * HAIKU_PRICING_PER_M.input) / 1_000_000 +
    (t.cache_create_input_tokens * HAIKU_PRICING_PER_M.cache_create) / 1_000_000 +
    (t.cache_read_input_tokens * HAIKU_PRICING_PER_M.cache_read) / 1_000_000 +
    (t.output_tokens * HAIKU_PRICING_PER_M.output) / 1_000_000
  );
}
