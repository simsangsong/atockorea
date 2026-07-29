/**
 * @jest-environment node
 *
 * SG-6 — the say queue resolver. Pinned: required-before-suggested, the
 * four-item ceiling (제로베이스: "4개를 넘으면 실패다"), TYPE-derived fired
 * dedupe, the per-STOP return ask (a stop-A timer must not silence stop
 * B's), and the durable-arrived rule — no geofence opt-in required.
 */
import { firedSubjectsFromMessages, sayQueue } from '@/lib/tour-room/sayQueue';
import type { RoomMessage } from '@/hooks/useTourRoomChannel';

const TOUR_DATE = '2026-07-28';
const NOW = Date.UTC(2026, 6, 28, 0, 30, 0); // 09:30 KST — morning
const MIN = 60_000;

const base = {
  nowMs: NOW,
  tourDate: TOUR_DATE,
  schedule: [
    { title: 'Seongsan', time: '10:00', poi_key: 'seongsan' },
    { title: 'Udo', time: '13:00', poi_key: 'udo' },
  ],
  notice: null,
  geofenceArrival: null,
  lastArrivalAtMs: null,
  lastArrivalPoiKey: null,
  lastTimerAtMs: null,
  firedSubjects: new Set<string>(),
};

describe('sayQueue', () => {
  it('a geofence hit is the top REQUIRED item; firing subjects dedupe it', () => {
    const items = sayQueue({
      ...base,
      geofenceArrival: { spotId: 's1', title: 'Seongsan', poiKey: 'seongsan' },
    });
    expect(items[0]).toMatchObject({ kind: 'arrival_bundle', urgency: 'required', subject: 'arrival:seongsan' });
    const deduped = sayQueue({
      ...base,
      geofenceArrival: { spotId: 's1', title: 'Seongsan', poiKey: 'seongsan' },
      firedSubjects: new Set(['arrival:seongsan']),
    });
    expect(deduped.some((i) => i.kind === 'arrival_bundle')).toBe(false);
  });

  it('durably arrived with no live timer → the return ask, WITHOUT geofence', () => {
    const items = sayQueue({ ...base, lastArrivalAtMs: NOW - 3 * MIN, lastArrivalPoiKey: 'seongsan' });
    expect(items.some((i) => i.kind === 'return_time' && i.urgency === 'required')).toBe(true);
  });

  it('a stop-A timer silences stop A only — stop B re-asks', () => {
    // Timer went out BEFORE the newest arrival → ask again.
    const again = sayQueue({
      ...base,
      lastArrivalAtMs: NOW - 3 * MIN,
      lastArrivalPoiKey: 'udo',
      lastTimerAtMs: NOW - 60 * MIN,
    });
    expect(again.some((i) => i.kind === 'return_time')).toBe(true);
    // Timer newer than the arrival → covered.
    const covered = sayQueue({
      ...base,
      lastArrivalAtMs: NOW - 10 * MIN,
      lastArrivalPoiKey: 'udo',
      lastTimerAtMs: NOW - 3 * MIN,
    });
    expect(covered.some((i) => i.kind === 'return_time')).toBe(false);
  });

  it('the briefing suggests itself in the morning and never after', () => {
    expect(sayQueue(base).some((i) => i.kind === 'briefing')).toBe(true);
    const afternoon = sayQueue({ ...base, nowMs: Date.UTC(2026, 6, 28, 5, 0, 0) }); // 14:00 KST
    expect(afternoon.some((i) => i.kind === 'briefing')).toBe(false);
  });

  it('never exceeds four items', () => {
    const flooded = sayQueue({
      ...base,
      nowMs: Date.UTC(2026, 6, 28, 0, 52, 0), // 09:52 — departing_soon window for 10:00
      geofenceArrival: { spotId: 's1', title: 'Seongsan', poiKey: 'seongsan' },
      lastArrivalAtMs: NOW - 100 * MIN,
    });
    expect(flooded.length).toBeLessThanOrEqual(4);
  });
});

describe('firedSubjectsFromMessages', () => {
  const msg = (metadata: Record<string, unknown>, atMs: number): RoomMessage =>
    ({ id: `${atMs}`, created_at: new Date(atMs).toISOString(), metadata }) as unknown as RoomMessage;

  it('derives arrival/briefing subjects and the last timer instant from TODAY only', () => {
    const dayStart = NOW - 90 * MIN;
    const { fired, lastTimerAtMs } = firedSubjectsFromMessages(
      [
        msg({ kind: 'arrival_bundle', poi_key: 'seongsan' }, NOW - 30 * MIN),
        msg({ kind: 'briefing_schedule' }, NOW - 80 * MIN),
        msg({ kind: 'free_time_timer', until_time: '10:30' }, NOW - 20 * MIN),
        msg({ kind: 'arrival_bundle', poi_key: 'yesterday' }, dayStart - 60 * MIN),
      ],
      dayStart,
    );
    expect(fired.has('arrival:seongsan')).toBe(true);
    expect(fired.has('briefing')).toBe(true);
    expect(fired.has('arrival:yesterday')).toBe(false);
    expect(lastTimerAtMs).toBe(NOW - 20 * MIN);
  });
});
