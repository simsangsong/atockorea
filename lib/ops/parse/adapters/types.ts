// Phase 0-bis — Platform adapter interface
// Master plan §6.2

import type { ParsedBooking } from '@/lib/ops/parse/types'

export interface AdapterResult {
  /** Bookings the adapter extracted with confidence ≥ 0.85 each. */
  bookings: ParsedBooking[]
  /** Lines the adapter could not confidently handle. Passed downstream to L2/L3/L4. */
  leftover: string[]
}

export interface PlatformAdapter {
  /** Stable identifier — used in metrics, logs, and the model router. */
  readonly id: string
  /** Human-readable name shown in wizard chips. */
  readonly label: string
  /**
   * Confidence (0..1) that this raw paste came from this platform.
   * The router picks the adapter with the highest score IF ≥ 0.8.
   * Below that the paste is treated as `mixed` and split for per-line retry.
   */
  detect(raw: string): number
  /**
   * Extract bookings. MUST NOT throw on malformed input.
   * Return `{ bookings: [], leftover: [raw] }` instead.
   */
  parse(raw: string): AdapterResult
}

export const ADAPTER_DETECT_THRESHOLD = 0.8

// AtoC Korea is NOT in the adapter list — it uses direct Supabase-to-Supabase
// join via /api/admin/courses/import-atockorea/ and bypasses the L0–L4 funnel.
// Adapters here are only for OTA *text/CSV exports* a user pastes into the wizard.
