/**
 * Quote-engine shared types for the manual-escalation precedent path.
 *
 * The authoritative pricing model now lives in `pricing-policy.ts` (D14).
 * What remains here is the small surface that `fingerprint` + `memory-lookup`
 * use to find a precedent price for requests that fall out of auto-quote scope
 * (14+ pax, DMZ >28, etc.).
 *
 * Phase 9 — see docs/itinerary-builder-plan.md §F Phase 9 + §B D13/D14.
 */

import type { PricingTrack } from "./pricing-policy";

export type Track = PricingTrack;

/** Snapshot the precedent path consumes (NOT the pricing engine's input). */
export interface QuoteIntake {
  region: string;
  track: Track;
  /** Party size; null if unknown. */
  pax: number | null;
  /** Customer-chosen tour duration in hours; null if unknown. */
  hours: number | null;
  /** Language code: en / ko / ja / zh / zh-TW / es. */
  language: string;
  poi_keys: string[];
}

/** Precedent result from quote_memory. */
export interface PrecedentMatch {
  /** Best estimate from precedent rows (median when exact, mean when loose). */
  amount_krw: number;
  /** "exact" = same fingerprint match; "loose" = region+track only. */
  confidence: "exact" | "loose";
  /** Number of precedent rows consulted. */
  sample_size: number;
  /** Most recent referenced memory row id, for FK on the new quote request. */
  precedent_id: string;
}
