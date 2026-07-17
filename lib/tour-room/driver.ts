/**
 * W3 — driver-bridge helpers (smart-guide private-mode plan P-D3/P-D15).
 *
 * PIN gate: the signed driver token is the primary secret; the vehicle-plate
 * PIN is defense-in-depth for a forwarded/leaked link. The expected PIN is
 * the last 4 digits found in the tour_bus_details payload's vehicle field.
 * No vehicle on file → the gate reports required:false (never lock a tour
 * out because ops skipped a form field).
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
}

export async function checkDriverPin(
  supabase: RoomDbClient,
  tourId: string | null,
  tourDate: string | null,
  suppliedPin: unknown,
): Promise<DriverPinCheck> {
  if (!tourId || !tourDate) return { required: false, ok: true };
  let expected: string | null = null;
  try {
    const { data } = await supabase
      .from('tour_bus_details')
      .select('payload')
      .eq('tour_id', tourId)
      .eq('tour_date', tourDate)
      .maybeSingle();
    expected = pinFromBusPayload((data as { payload?: unknown } | null)?.payload);
  } catch {
    expected = null;
  }
  if (!expected) return { required: false, ok: true };
  const supplied = typeof suppliedPin === 'string' ? suppliedPin.replace(/\D+/g, '') : '';
  return { required: true, ok: supplied === expected };
}
