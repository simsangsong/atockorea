// Ops parse stack — shared types (ported from kursoflow src/types/index.ts).
// Consolidation plan §2/§3: only the parser-facing types come across; the rest
// of kursoflow's type surface stays behind. Multi-tenancy is simplified to a
// tenantId string parameter with DEFAULT_TENANT_ID ('atockorea').

export const DEFAULT_TENANT_ID = 'atockorea'

export type OTASource = 'klook' | 'gyg' | 'viator' | 'kkday' | 'tripcom' | 'csv' | 'manual'

/** Wizard/API mode: `mixed` = paste several OTA formats at once; model sets each row's `sourcePlatform`. */
export type ImportRequestSource = OTASource | 'mixed'

export interface ParsedBooking {
  sourcePlatform: OTASource
  /** Raw platform label exactly as it appeared in the source (e.g. a sheet's
   *  platform column). Preserved so operator-written platform names survive even
   *  when they aren't one of the OTASource enum values — written to
   *  external_source in preference to the collapsed enum. */
  sourcePlatformLabel?: string | null
  externalBookingId: string
  leadName: string
  partySize: number
  tourDate?: string
  productName?: string
  pickupPointRaw?: string
  pickupPointNormalized?: string
  pickupTime?: string
  email?: string
  phone?: string
  whatsapp?: string
  language?: string
  notes?: string
  guideName?: string
  confidenceScore: number
  issues: string[]
  // Cruise integration. `cruiseShipText` is the raw ship name as it appeared in
  // the source (e.g. "Norwegian Spirit", "NCL Spirit"). The cruise-ship-backstop
  // resolves it to `cruiseShipId` via ops_cruise_ships + ops_cruise_ship_aliases
  // lookup. `cruiseShipId === null` means "we tried and failed"; undefined means
  // "never had a ship marker to resolve".
  cruiseShipText?: string
  cruiseShipId?: string | null
  // Port-call attach. Filled by cruise-port-call-backstop using
  // (cruiseShipId, tourDate) → ops_cruise_port_calls row lookup. The
  // `cruisePortCallMultiple` flag signals same-ship-same-day-multiple-ports,
  // which detectors use to raise a review alert.
  cruisePortCallId?: string | null
  cruisePortCallMultiple?: boolean
}
