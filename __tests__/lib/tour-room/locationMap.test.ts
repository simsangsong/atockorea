/**
 * Wave T3 pure logic — location frame merging (T3.1/T3.3), bearing/ETA
 * helpers (T3.3/T3.7), pickup sequence + board state (T3.7).
 */
import { applyLocationFrame, type RoomLocation } from '@/hooks/useTourRoomChannel';
import { bearingDeg, pickupEtaMinutes } from '@/lib/tour-room/geo';
import { buildPickupSequence } from '@/lib/tour-room/snapshot';
import { pickupBoardState } from '@/lib/tour-room/pickup';
import { kstToday, kstStartOfDayMs } from '@/lib/tour-room/time';
import { arrowForBearing, formatDistance } from '@/components/tour-mode/map/FindGuideCard';

const frame = (over: Partial<RoomLocation>): RoomLocation => ({
  participant_id: 'p1',
  role: 'customer',
  latitude: 35,
  longitude: 129,
  recorded_at: '2026-07-14T10:00:00Z',
  ...over,
});

describe('applyLocationFrame (T3.1)', () => {
  it('adds, updates and never regresses to an older frame', () => {
    let state = applyLocationFrame({}, frame({}));
    expect(state.p1.latitude).toBe(35);
    state = applyLocationFrame(state, frame({ latitude: 36, recorded_at: '2026-07-14T10:01:00Z' }));
    expect(state.p1.latitude).toBe(36);
    // Out-of-order older frame is ignored.
    state = applyLocationFrame(state, frame({ latitude: 30, recorded_at: '2026-07-14T09:59:00Z' }));
    expect(state.p1.latitude).toBe(36);
  });

  it('removes on a removal frame and tolerates unknown ids', () => {
    let state = applyLocationFrame({}, frame({}));
    state = applyLocationFrame(state, { participant_id: 'p1', removed: true });
    expect(state.p1).toBeUndefined();
    expect(applyLocationFrame(state, { participant_id: 'ghost', removed: true })).toBe(state);
  });
});

describe('bearing / distance / ETA helpers', () => {
  const seoul = { latitude: 37.5665, longitude: 126.978 };

  it('bearingDeg points north/east/south/west correctly', () => {
    expect(Math.round(bearingDeg(seoul, { ...seoul, latitude: 38 }))).toBe(0); // north
    expect(Math.round(bearingDeg(seoul, { ...seoul, longitude: 128 }))).toBeGreaterThanOrEqual(89); // ~east
    expect(Math.round(bearingDeg(seoul, { ...seoul, latitude: 37 }))).toBe(180); // south
  });

  it('arrowForBearing maps sectors to compass arrows', () => {
    expect(arrowForBearing(0)).toBe('⬆️');
    expect(arrowForBearing(90)).toBe('➡️');
    expect(arrowForBearing(181)).toBe('⬇️');
    expect(arrowForBearing(315)).toBe('↖️');
    expect(arrowForBearing(359)).toBe('⬆️');
  });

  it('formatDistance switches to km at 1000m', () => {
    expect(formatDistance(230)).toBe('230m');
    expect(formatDistance(1440)).toBe('1.4km');
  });

  it('pickupEtaMinutes floors at 1 minute', () => {
    expect(pickupEtaMinutes(0)).toBe(1);
    expect(pickupEtaMinutes(3300)).toBe(10); // 3.3km @ ~20km/h
  });
});

describe('buildPickupSequence (T3.7)', () => {
  it('flattens object/array joins and orders by pickup_time, nulls last', () => {
    const seq = buildPickupSequence([
      { id: 'b2', pickup_points: { id: 'pp2', name: 'Stop B', lat: 1, lng: 2, pickup_time: '09:10:00' } },
      { id: 'b3', pickup_points: null },
      { id: 'b1', pickup_points: [{ id: 'pp1', name: 'Stop A', lat: 3, lng: 4, pickup_time: '08:50:00' }] },
      { id: 'b4', pickup_points: { id: 'pp4', name: 'No time' } },
    ]);
    expect(seq.map((s) => s.booking_id)).toEqual(['b1', 'b2', 'b4']);
  });
});

describe('pickupBoardState (T3.7)', () => {
  const today = kstToday();
  // 08:00 KST today — before any pickup below.
  const morningMs = kstStartOfDayMs(today) + 8 * 60 * 60 * 1000;
  const sequence = buildPickupSequence([
    { id: 'other', pickup_points: { id: 'pp1', name: 'Stop A', lat: 35.1, lng: 129.0, pickup_time: '08:40:00' } },
    { id: 'mine', pickup_points: { id: 'pp2', name: 'Stop B', lat: 35.2, lng: 129.1, pickup_time: '09:00:00' } },
  ]);

  it('live mode: rank + straight-line ETA from the bus position', () => {
    const state = pickupBoardState({
      tourDate: today,
      myBookingId: 'mine',
      pickupSequence: sequence,
      guidePosition: { latitude: 35.15, longitude: 129.05 },
      nowMs: morningMs,
    });
    expect(state.visible).toBe(true);
    expect(state.mode).toBe('live');
    expect(state.rank).toBe(2);
    expect(state.totalStops).toBe(2);
    expect(state.etaMinutes).toBeGreaterThan(0);
  });

  it('degrades to static when the guide is not sharing (AC)', () => {
    const state = pickupBoardState({
      tourDate: today,
      myBookingId: 'mine',
      pickupSequence: sequence,
      guidePosition: null,
      nowMs: morningMs,
    });
    expect(state.visible).toBe(true);
    expect(state.mode).toBe('static');
    expect(state.etaMinutes).toBeNull();
  });

  it('hides off-day, after the grace window, and without my pickup', () => {
    expect(
      pickupBoardState({ tourDate: '2020-01-01', myBookingId: 'mine', pickupSequence: sequence, guidePosition: null, nowMs: morningMs })
        .visible,
    ).toBe(false);
    const afterMs = kstStartOfDayMs(today) + (9 * 60 + 46) * 60 * 1000; // 09:46 — past 09:00+45m
    expect(
      pickupBoardState({ tourDate: today, myBookingId: 'mine', pickupSequence: sequence, guidePosition: null, nowMs: afterMs }).visible,
    ).toBe(false);
    expect(
      pickupBoardState({ tourDate: today, myBookingId: 'stranger', pickupSequence: sequence, guidePosition: null, nowMs: morningMs })
        .visible,
    ).toBe(false);
  });
});
