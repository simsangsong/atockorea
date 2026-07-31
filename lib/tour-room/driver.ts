/**
 * W3 — driver-bridge helpers (smart-guide private-mode plan P-D3/P-D15).
 *
 * PIN gate: the signed driver token is the primary secret; the vehicle-plate
 * PIN is defense-in-depth for a forwarded/leaked link. The expected PIN is
 * the last 4 digits of a plate ops recorded for this (tour, date).
 * No plate on file → the gate reports required:false (never lock a tour
 * out because ops skipped a form field).
 *
 * 🔴 Where the plate lives moved and the gate did not follow it. Dispatch
 * writes to `ops_room_vehicles`; `tour_bus_details` is the old sheet and holds
 * two rows in production. Reading only the latter meant `expected` was null
 * for essentially every tour, so the gate answered required:false and any
 * holder of a forwarded driver link walked in. The dispatch is now the first
 * source and the sheet is the fallback.
 *
 * Under the rental model (#460) the plate is often unknown until the day, so
 * the gate stays open until ops types one and closes the moment they do. That
 * progression is deliberate: a driver locked out by a stale plate is a
 * five-second fix in the dispatch panel, and the console already prompts for
 * the four digits rather than dead-ending.
 */

import type { RoomDbClient } from '@/lib/tour-room/access';

/** Payload keys ops have historically used for the vehicle/plate number. */
const VEHICLE_FIELD_KEYS = [
  'vehicle_number',
  'vehicleNumber',
  'plate',
  'plate_number',
  'bus_number',
  'busNumber',
  'vehicle',
];

/** Last 4 digits of a plate-ish string ('제주 79바 1234' → '1234'). */
export function pinFromVehicleValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const digits = value.replace(/\D+/g, '');
  if (digits.length < 4) return null;
  return digits.slice(-4);
}

export function pinFromBusPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  for (const key of VEHICLE_FIELD_KEYS) {
    const pin = pinFromVehicleValue((payload as Record<string, unknown>)[key]);
    if (pin) return pin;
  }
  return null;
}

export interface DriverPinCheck {
  /** true when a vehicle number is on file for this (tour, date). */
  required: boolean;
  /** true when no PIN is required, or the supplied PIN matches. */
  ok: boolean;
  /**
   * Set when the plate lookup itself failed (FA-018). The caller answers the
   * same 403 either way; this only exists so logs can tell "wrong PIN" from
   * "we could not check", which are very different pages to be on at 7am.
   */
  lookupFailed?: boolean;
}

/** Plates found, and whether the looking succeeded — the two are not the same. */
interface PinLookup {
  pins: Set<string>;
  failed: boolean;
}

/**
 * Every plate ops recorded against this (tour, date), via the dispatch panel.
 *
 * A driver token is scoped to the tour DAY, and a day can run more than one
 * vehicle, so any dispatched plate is a valid answer — the driver knows the
 * one they are sitting in, and a second bus must not lock out the first.
 */
async function dispatchedPins(
  supabase: RoomDbClient,
  tourId: string,
  tourDate: string,
): Promise<PinLookup> {
  const pins = new Set<string>();
  try {
    const { data: rooms, error: roomsError } = await supabase
      .from('tour_rooms')
      .select('id')
      .eq('tour_id', tourId)
      .eq('tour_date', tourDate);
    if (roomsError) return { pins, failed: true };
    const roomIds = (Array.isArray(rooms) ? rooms : [])
      .map((row) => (row as { id?: unknown }).id)
      .filter((id): id is string => typeof id === 'string');
    if (roomIds.length === 0) return { pins, failed: false };

    const { data: dispatches, error: dispatchError } = await supabase
      .from('ops_room_vehicles')
      .select('plate_number, vehicle:ops_vehicles(plate_number)')
      .in('room_id', roomIds);
    if (dispatchError) return { pins, failed: true };
    for (const row of Array.isArray(dispatches) ? dispatches : []) {
      const dispatch = row as { plate_number?: unknown; vehicle?: { plate_number?: unknown } | null };
      // The dispatch's own plate wins: picking a registered vehicle prefills
      // it rather than locking it (#460), so it is the value ops last saw.
      for (const candidate of [dispatch.plate_number, dispatch.vehicle?.plate_number]) {
        const pin = pinFromVehicleValue(candidate);
        if (pin) pins.add(pin);
      }
    }
  } catch {
    return { pins, failed: true };
  }
  return { pins, failed: false };
}

export async function checkDriverPin(
  supabase: RoomDbClient,
  tourId: string | null,
  tourDate: string | null,
  suppliedPin: unknown,
): Promise<DriverPinCheck> {
  if (!tourId || !tourDate) return { required: false, ok: true };

  const dispatched = await dispatchedPins(supabase, tourId, tourDate);
  const expected = dispatched.pins;
  let lookupFailed = dispatched.failed;

  if (expected.size === 0) {
    try {
      const { data, error } = await supabase
        .from('tour_bus_details')
        .select('payload')
        .eq('tour_id', tourId)
        .eq('tour_date', tourDate)
        .maybeSingle();
      if (error) lookupFailed = true;
      const legacy = pinFromBusPayload((data as { payload?: unknown } | null)?.payload);
      if (legacy) expected.add(legacy);
    } catch {
      lookupFailed = true;
    }
  }

  if (expected.size === 0) {
    /**
     * 🔴 FA-018 (full-app audit 2026-07-30). "No plate on file" and "the query
     * that would have found the plate failed" used to arrive here as the same
     * empty set, and the same empty set opened the gate. So a transient
     * `ops_room_vehicles` failure removed the PIN check entirely — the exact
     * shape of the gate that was found open in production once already.
     *
     * An empty set is only permission to enter when we actually looked. Ops
     * genuinely may not know the plate until the morning (#460, rental fleet),
     * so absence still means "no PIN" — but a failed look means "ask for one
     * we cannot verify", which closes the door instead of removing it.
     */
    if (lookupFailed) return { required: true, ok: false, lookupFailed: true };
    return { required: false, ok: true };
  }
  const supplied = typeof suppliedPin === 'string' ? suppliedPin.replace(/\D+/g, '') : '';
  return { required: true, ok: expected.has(supplied) };
}
