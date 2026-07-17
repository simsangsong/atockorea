/**
 * W2.5 — the Tier-0 card priority resolver (P-D8), pure.
 *
 * The floating banner zone shows ONE card. The ladder:
 *   SOS (own surface) > rally/free-time (activeNotice → NoticeBanner)
 *   > delay ETA > vehicle find (fresh pin) > settlement (pending extras).
 * This module resolves the sub-rally tail from the message stream; the
 * banner component suppresses it while a rally notice is up, keeping the
 * "top 1 card" invariant without refactoring NoticeBanner.
 */

import type { RoomMessage } from '@/hooks/useTourRoomChannel';

export type SecondaryCard =
  | { kind: 'delay'; minutes: number; sinceMs: number }
  | { kind: 'vehicle'; pin: 'parking' | 'vehicle_arrived'; lat: number; lng: number; mapsUrl: string }
  | { kind: 'settlement'; count: number; totalKrw: number };

const DELAY_TTL_MS = 45 * 60 * 1000;
const VEHICLE_TTL_MS = 60 * 60 * 1000;

function createdMs(message: RoomMessage): number {
  const at = new Date(message.created_at).getTime();
  return Number.isFinite(at) ? at : 0;
}

/** The top non-rally card for the banner zone, or null. */
export function secondaryCard(messages: RoomMessage[], nowMs = Date.now()): SecondaryCard | null {
  // newest-first single pass state
  let delay: SecondaryCard | null = null;
  let vehicle: SecondaryCard | null = null;
  const extraStatus = new Map<string, { status: string; amount: number }>();

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    const meta = message.metadata as
      | {
          kind?: string;
          minutes?: number;
          lat?: number;
          lng?: number;
          extra_id?: string;
          status?: string;
          amount_krw?: number;
        }
      | null
      | undefined;
    if (!meta?.kind) continue;
    const at = createdMs(message);

    if (!delay && meta.kind === 'driver_delay' && typeof meta.minutes === 'number') {
      if (nowMs - at <= DELAY_TTL_MS) delay = { kind: 'delay', minutes: meta.minutes, sinceMs: at };
    }
    if (
      !vehicle &&
      (meta.kind === 'driver_parking_pin' || meta.kind === 'driver_vehicle_arrived') &&
      typeof meta.lat === 'number' &&
      typeof meta.lng === 'number'
    ) {
      if (nowMs - at <= VEHICLE_TTL_MS) {
        vehicle = {
          kind: 'vehicle',
          pin: meta.kind === 'driver_parking_pin' ? 'parking' : 'vehicle_arrived',
          lat: meta.lat,
          lng: meta.lng,
          mapsUrl: `https://maps.google.com/?q=${meta.lat.toFixed(6)},${meta.lng.toFixed(6)}`,
        };
      }
    }
    // Newest capsule per extra wins (we iterate newest-first: first seen = newest).
    if (meta.kind === 'extra_ledger' && typeof meta.extra_id === 'string' && !extraStatus.has(meta.extra_id)) {
      extraStatus.set(meta.extra_id, {
        status: meta.status ?? 'logged',
        amount: typeof meta.amount_krw === 'number' ? meta.amount_krw : 0,
      });
    }
  }

  if (delay) return delay;
  if (vehicle) return vehicle;

  const pending = [...extraStatus.values()].filter((e) => e.status === 'logged');
  if (pending.length > 0) {
    return {
      kind: 'settlement',
      count: pending.length,
      totalKrw: pending.reduce((sum, e) => sum + e.amount, 0),
    };
  }
  return null;
}
