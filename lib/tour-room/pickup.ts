/**
 * T3.7 — pickup-morning board logic (pure; the component just renders it).
 *
 * "My pickup: Nth stop · ~X min" from the guide (bus) position × the
 * tour-day pickup sequence. v1 deliberately estimates with straight-line
 * distance (no Directions API — cost 0, §F T3.7); when the guide isn't
 * sharing, the board degrades to the static pickup-time notice.
 */

import { haversineM, pickupEtaMinutes, type LatLng } from '@/lib/tour-room/geo';
import { kstToday } from '@/lib/tour-room/time';
import type { PickupSequenceStop } from '@/lib/tour-room/snapshot';

/** Board disappears this long after my scheduled pickup time. */
const AFTER_PICKUP_GRACE_MS = 45 * 60 * 1000;
/** KST offset — pickup_time is a local Korean clock time. */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export interface PickupBoardState {
  visible: boolean;
  /** 'live' = bus position known; 'static' = schedule-only fallback. */
  mode: 'live' | 'static';
  /** 1-based position of my stop in the tour-day pickup order. */
  rank: number | null;
  totalStops: number;
  myStop: PickupSequenceStop | null;
  /** Straight-line ETA from the bus to my stop, minutes (live mode only). */
  etaMinutes: number | null;
  /** Meters from the bus to my stop (live mode only). */
  distanceM: number | null;
}

const HIDDEN: PickupBoardState = {
  visible: false,
  mode: 'static',
  rank: null,
  totalStops: 0,
  myStop: null,
  etaMinutes: null,
  distanceM: null,
};

function pickupTimeMs(tourDate: string, pickupTime: string): number | null {
  const match = /^(\d{2}):(\d{2})/.exec(pickupTime);
  if (!match) return null;
  const [y, m, d] = tourDate.split('-').map(Number);
  return Date.UTC(y, m - 1, d, Number(match[1]), Number(match[2])) - KST_OFFSET_MS;
}

export function pickupBoardState(input: {
  tourDate: string | null | undefined;
  myBookingId: string;
  pickupSequence: PickupSequenceStop[];
  guidePosition: LatLng | null;
  nowMs?: number;
}): PickupBoardState {
  const { tourDate, myBookingId, pickupSequence, guidePosition } = input;
  const nowMs = input.nowMs ?? Date.now();

  if (!tourDate || tourDate !== kstToday(nowMs)) return HIDDEN;

  const myIndex = pickupSequence.findIndex((stop) => stop.booking_id === myBookingId);
  const myStop = myIndex >= 0 ? pickupSequence[myIndex] : null;
  if (!myStop?.pickup_time) return HIDDEN;

  const scheduledMs = pickupTimeMs(tourDate, myStop.pickup_time);
  if (scheduledMs === null || nowMs > scheduledMs + AFTER_PICKUP_GRACE_MS) return HIDDEN;

  const canRange =
    guidePosition && typeof myStop.lat === 'number' && typeof myStop.lng === 'number';
  const distanceM = canRange
    ? haversineM(guidePosition!, { latitude: myStop.lat!, longitude: myStop.lng! })
    : null;

  return {
    visible: true,
    mode: distanceM === null ? 'static' : 'live',
    rank: myIndex + 1,
    totalStops: pickupSequence.length,
    myStop,
    etaMinutes: distanceM === null ? null : pickupEtaMinutes(distanceM),
    distanceM,
  };
}
