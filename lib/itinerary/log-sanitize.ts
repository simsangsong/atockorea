import type { GeneratedItineraryResponse } from './types';

/**
 * Strip obvious PII from itinerary pipeline DB logs (itinerary_generation_logs.final_result).
 * API responses to clients remain unchanged.
 */
export function sanitizeItineraryForPipelineLog(
  response: GeneratedItineraryResponse,
): Record<string, unknown> {
  const stops = response.stops.map((s) => ({
    ...s,
    tel: s.tel != null ? '[redacted]' : null,
    addr1: s.addr1 != null ? '[redacted]' : null,
    addr2: s.addr2 != null ? '[redacted]' : null,
    reservationInfo: s.reservationInfo != null ? '[redacted]' : null,
  }));
  return { ...response, stops } as Record<string, unknown>;
}
