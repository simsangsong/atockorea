/**
 * §11.C C1/C3 — vehicle pick / freshness bands / pickup window / ETA safety.
 */
import {
  isPickupWindow,
  pickVehicleLocation,
  PICKUP_WINDOW_AFTER_MS,
  PICKUP_WINDOW_BEFORE_MS,
  renderVehicleAgeLine,
  renderVehicleEtaLine,
  vehicleEtaFrom,
  vehicleFreshness,
  VEHICLE_LIVE_MS,
  VEHICLE_RECENT_MS,
} from '@/lib/tour-room/vehicleEta';
import { kstStartOfDayMs } from '@/lib/tour-room/time';

const NOW = Date.parse('2099-07-24T02:00:00Z');
const iso = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

describe('pickVehicleLocation (driver > guide, then freshest)', () => {
  it('prefers the driver even when a guide pinged more recently', () => {
    const picked = pickVehicleLocation([
      { participant_id: 'g', role: 'guide', latitude: 33.5, longitude: 126.5, recorded_at: iso(0) },
      { participant_id: 'd', role: 'driver', latitude: 33.4, longitude: 126.4, recorded_at: iso(-300_000) },
    ]);
    expect(picked?.participant_id).toBe('d');
  });

  it('falls back to the guide when no driver is sharing', () => {
    const picked = pickVehicleLocation([
      { participant_id: 'c1', role: 'customer', latitude: 33.1, longitude: 126.1, recorded_at: iso(0) },
      { participant_id: 'g', role: 'guide', latitude: 33.5, longitude: 126.5, recorded_at: iso(-10_000) },
    ]);
    expect(picked?.participant_id).toBe('g');
  });

  it('breaks a same-role tie on the newest recorded_at', () => {
    const picked = pickVehicleLocation({
      a: { participant_id: 'a', role: 'driver', latitude: 33.1, longitude: 126.1, recorded_at: iso(-60_000) },
      b: { participant_id: 'b', role: 'driver', latitude: 33.2, longitude: 126.2, recorded_at: iso(-1_000) },
    });
    expect(picked?.participant_id).toBe('b');
  });

  it('null for empty input, customer-only rooms, and broken coordinates', () => {
    expect(pickVehicleLocation(null)).toBeNull();
    expect(pickVehicleLocation([])).toBeNull();
    expect(
      pickVehicleLocation([{ participant_id: 'c', role: 'customer', latitude: 33, longitude: 126 }]),
    ).toBeNull();
    expect(
      pickVehicleLocation([
        { participant_id: 'd', role: 'driver', latitude: Number.NaN, longitude: 126 },
      ]),
    ).toBeNull();
  });
});

describe('vehicleFreshness bands', () => {
  it('live at the 2-minute edge, recent just past it', () => {
    expect(vehicleFreshness(iso(-VEHICLE_LIVE_MS), NOW).state).toBe('live');
    expect(vehicleFreshness(iso(-VEHICLE_LIVE_MS - 1_000), NOW).state).toBe('recent');
  });

  it('recent at the 10-minute edge, stale past it', () => {
    expect(vehicleFreshness(iso(-VEHICLE_RECENT_MS), NOW).state).toBe('recent');
    expect(vehicleFreshness(iso(-VEHICLE_RECENT_MS - 1_000), NOW).state).toBe('stale');
  });

  it('missing/unparseable timestamps are stale with an infinite age', () => {
    expect(vehicleFreshness(null, NOW)).toEqual({ ageMs: Number.POSITIVE_INFINITY, state: 'stale' });
    expect(vehicleFreshness('not-a-date', NOW).state).toBe('stale');
  });

  it('clock skew (future ping) clamps to age 0', () => {
    expect(vehicleFreshness(iso(60_000), NOW)).toEqual({ ageMs: 0, state: 'live' });
  });
});

describe('vehicleEtaFrom (delegates to syntheticLeg, null-safe)', () => {
  const seongsan = { lat: 33.458, lng: 126.9425 };
  const udo = { lat: 33.5045, lng: 126.9523 };

  it('returns the shared synthetic estimate', () => {
    const leg = vehicleEtaFrom(seongsan, udo);
    expect(leg?.source).toBe('synthetic');
    expect(leg!.minutes).toBeGreaterThan(0);
    expect(leg!.distanceM).toBeGreaterThan(4000);
  });

  it('null whenever either end is missing or out of range', () => {
    expect(vehicleEtaFrom(null, udo)).toBeNull();
    expect(vehicleEtaFrom(seongsan, null)).toBeNull();
    expect(vehicleEtaFrom({ lat: 999, lng: 126 }, udo)).toBeNull();
    expect(vehicleEtaFrom({ lat: 33 }, udo)).toBeNull();
  });
});

describe('isPickupWindow (KST, −60min … +30min)', () => {
  const tourDate = '2099-07-24';
  const pickupMs = kstStartOfDayMs(tourDate) + 9 * 60 * 60 * 1000; // 09:00 KST

  it('open exactly 60 minutes before and 30 minutes after', () => {
    expect(isPickupWindow(pickupMs - PICKUP_WINDOW_BEFORE_MS, tourDate, '09:00')).toBe(true);
    expect(isPickupWindow(pickupMs, tourDate, '09:00')).toBe(true);
    expect(isPickupWindow(pickupMs + PICKUP_WINDOW_AFTER_MS, tourDate, '09:00')).toBe(true);
  });

  it('closed one minute outside either edge', () => {
    expect(isPickupWindow(pickupMs - PICKUP_WINDOW_BEFORE_MS - 60_000, tourDate, '09:00')).toBe(false);
    expect(isPickupWindow(pickupMs + PICKUP_WINDOW_AFTER_MS + 60_000, tourDate, '09:00')).toBe(false);
  });

  it('a different tour date never matches', () => {
    expect(isPickupWindow(pickupMs, '2099-07-25', '09:00')).toBe(false);
  });

  it('accepts HH:MM:SS and rejects missing/malformed inputs', () => {
    expect(isPickupWindow(pickupMs, tourDate, '09:00:00')).toBe(true);
    expect(isPickupWindow(pickupMs, tourDate, null)).toBe(false);
    expect(isPickupWindow(pickupMs, null, '09:00')).toBe(false);
    expect(isPickupWindow(pickupMs, tourDate, 'morning')).toBe(false);
    expect(isPickupWindow(pickupMs, '24-07-99', '09:00')).toBe(false);
    expect(isPickupWindow(pickupMs, tourDate, '99:99')).toBe(false);
  });
});

describe('5-locale copy rendering', () => {
  it('interpolates minutes + the shared distance format', () => {
    expect(renderVehicleEtaLine('ko', { minutes: 23, distanceM: 20400 })).toBe('약 23분 · 20 km');
    expect(renderVehicleEtaLine('en', { minutes: 8, distanceM: 480 })).toBe('About 8 min · 480 m');
  });

  it('age line collapses under a minute and degrades on unknown timestamps', () => {
    expect(renderVehicleAgeLine('ko', 30_000)).toBe('방금 위치');
    expect(renderVehicleAgeLine('ko', 5 * 60_000)).toBe('5분 전 위치');
    expect(renderVehicleAgeLine('ko', Number.POSITIVE_INFINITY)).toBe('아직 위치 공유 전이에요');
  });
});
