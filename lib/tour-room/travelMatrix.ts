/**
 * X18 — how an arrival becomes a learned drive time.
 *
 * The flywheel turns consecutive arrivals in one room into
 * `(from_key, to_key, daypart, minutes)` legs, and a running mean of those legs
 * is what `poi_travel_matrix` holds. Until this module the logic lived inline
 * in the cron route, which meant the one interesting decision in it — WHICH
 * arrivals count — could only be tested by running a cron.
 *
 * ## 🔴 The reason X18 was still an empty table
 *
 * Measured on live data (2026-07-31): `poi_travel_matrix` **0 rows**, and
 * `tour_room_events` where `type='manual_arrival'` **0 rows, all time**. So the
 * learner was not broken; it had never been given an arrival.
 *
 * But there are TWO ways this app records an arrival, and they land in
 * different tables:
 *
 *   guide taps 도착        → `tour_room_events`      type='manual_arrival'
 *   geofence trips         → `tour_room_spot_events` event_type='arrived'
 *
 * The learner only ever read the first. X15 has just connected the geofence to
 * the staff device — which is now the path most arrivals will come from,
 * because it fires by itself — and every one of those would have been invisible
 * here. Reading one of two sources is the same defect shape as the planner
 * reading one of two photo columns: the data existed and nobody looked at it.
 *
 * Both sources are normalised into `ArrivalPoint` and merged before legs are
 * built, so a room that produced some arrivals each way still yields correct
 * consecutive legs.
 */

export type Daypart = 'am' | 'midday' | 'pm' | 'evening';

export interface ArrivalPoint {
  roomId: string;
  /** ISO timestamp. */
  at: string;
  poiKey: string;
  /** Which table this came from — carried for the report, not for the maths. */
  source: 'manual' | 'geofence';
}

export interface LegSample {
  from: string;
  to: string;
  daypart: Daypart;
  minutes: number;
}

/** KST dayparts; the matrix is keyed by them because traffic is. */
export function daypartOf(iso: string): Daypart {
  const kstHour = (new Date(iso).getUTCHours() + 9) % 24;
  if (kstHour < 11) return 'am';
  if (kstHour < 14) return 'midday';
  if (kstHour < 18) return 'pm';
  return 'evening';
}

/** Legs outside this band are noise, not drives (traffic jam vs. forgotten tap). */
export const MIN_DRIVE_MIN = 5;
export const MAX_DRIVE_MIN = 240;
/** Used when the day plan does not say how long the stop was meant to take. */
export const DEFAULT_STAY_MIN = 60;

/**
 * Merge arrivals from every source into one per-room timeline.
 *
 * Sorting is by time, then by source, so a run is reproducible when a geofence
 * arrival and a manual tap share a timestamp to the millisecond.
 */
export function mergeArrivals(...sources: ArrivalPoint[][]): Map<string, ArrivalPoint[]> {
  const byRoom = new Map<string, ArrivalPoint[]>();
  for (const list of sources) {
    for (const point of list) {
      if (!point.roomId || !point.poiKey || !point.at) continue;
      const bucket = byRoom.get(point.roomId) ?? [];
      bucket.push(point);
      byRoom.set(point.roomId, bucket);
    }
  }
  for (const bucket of byRoom.values()) {
    bucket.sort((a, b) => {
      const delta = new Date(a.at).getTime() - new Date(b.at).getTime();
      return delta !== 0 ? delta : a.source.localeCompare(b.source);
    });
  }
  return byRoom;
}

/**
 * Consecutive arrivals → drive legs.
 *
 * `arrival-to-arrival gap − the from-stop's planned stay ≈ drive time`. The
 * `from === to` skip is doing real work now that there are two sources: when a
 * geofence fires at a stop and the guide taps 도착 for the SAME stop minutes
 * later, that pair collapses instead of being learned as a zero-distance drive.
 */
export function buildLegSamples(
  arrivalsByRoom: Map<string, ArrivalPoint[]>,
  stayByKey: Map<string, number>,
): LegSample[] {
  const legs: LegSample[] = [];
  for (const arrivals of arrivalsByRoom.values()) {
    for (let i = 1; i < arrivals.length; i += 1) {
      const from = arrivals[i - 1].poiKey;
      const to = arrivals[i].poiKey;
      if (from === to) continue;
      const gapMin =
        (new Date(arrivals[i].at).getTime() - new Date(arrivals[i - 1].at).getTime()) / 60_000;
      if (!Number.isFinite(gapMin)) continue;
      const stay = stayByKey.get(from) ?? DEFAULT_STAY_MIN;
      const drive = Math.round(gapMin - stay);
      if (drive < MIN_DRIVE_MIN || drive > MAX_DRIVE_MIN) continue;
      legs.push({ from, to, daypart: daypartOf(arrivals[i - 1].at), minutes: drive });
    }
  }
  return legs;
}

/** Running mean, so a re-run of the same week does not distort the matrix. */
export function nextRunningMean(
  previous: { minutes_p50: number; samples: number } | null,
  minutes: number,
): { minutes_p50: number; samples: number } {
  const samples = (previous?.samples ?? 0) + 1;
  const mean = previous
    ? (Number(previous.minutes_p50) * previous.samples + minutes) / samples
    : minutes;
  return { minutes_p50: Math.round(mean * 10) / 10, samples };
}
