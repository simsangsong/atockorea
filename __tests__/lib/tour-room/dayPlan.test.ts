/**
 * W0.2 — 4-stage day-schedule resolver (smart-guide private-mode plan §C-4).
 * The regression gate: with no day plan and no itinerary poi_keys the chain
 * must reproduce the legacy `tours.schedule ?? []` output exactly.
 */
import {
  dayPlanStopsToSchedule,
  humanizePoiKey,
  poiKeysToSchedule,
  resolveDaySchedule,
  type DayPlanRow,
} from '@/lib/tour-room/dayPlan';
import type { RoomDbClient } from '@/lib/tour-room/access';

// ---------------------------------------------------------------------------
// Fake supabase client — table → canned result (or thrower).
// ---------------------------------------------------------------------------
type Canned = { data: unknown; error: unknown } | (() => never);

function fakeDb(tables: Record<string, Canned>): RoomDbClient {
  function resolve(table: string) {
    const canned = tables[table];
    if (typeof canned === 'function') return canned();
    return canned ?? { data: null, error: null };
  }
  function builder(table: string): Record<string, unknown> {
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: () => chain,
      in: () => chain,
      order: () => chain,
      limit: () => chain,
      gt: () => chain,
      maybeSingle: async () => resolve(table),
      single: async () => resolve(table),
      then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
        Promise.resolve()
          .then(() => resolve(table))
          .then(onFulfilled, onRejected),
    };
    return chain;
  }
  return { from: (table: string) => builder(table) } as unknown as RoomDbClient;
}

const PLAN: DayPlanRow = {
  id: 'plan-1',
  booking_id: 'booking-1',
  room_id: 'room-1',
  tour_date: '2026-07-20',
  status: 'guide_confirmed',
  stops: [
    { id: 's2', seq: 2, source: 'poi', poi_key: 'gyeongbokgung_palace', arrival_planned: '10:30', stop_type: 'sight', status: 'pending' },
    { id: 's1', seq: 1, source: 'poi', poi_key: 'bukchon_hanok_village', name_i18n: { en: 'Bukchon Hanok Village' }, arrival_planned: '09:00', stop_type: 'sight', status: 'pending' },
    { id: 's3', seq: 3, source: 'free', name_i18n: { en: 'Lunch — guide pick' }, arrival_planned: '12:00', stop_type: 'meal', status: 'skipped', skip_reason: 'closed' },
  ],
  needs: null,
  feasibility: null,
  version: 3,
  updated_by: 'guide',
  updated_at: '2026-07-19T12:00:00Z',
};

const LEGACY_SCHEDULE = [
  { time: '09:00', title: 'Hotel pickup' },
  { time: '10:00', title: 'Gyeongbokgung Palace' },
];

describe('dayPlanStopsToSchedule (stage ① transform)', () => {
  it('orders by seq, maps arrival_planned→time, excludes skipped stops', () => {
    const items = dayPlanStopsToSchedule(PLAN.stops);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ time: '09:00', title: 'Bukchon Hanok Village', poi_key: 'bukchon_hanok_village' });
    expect(items[1]).toMatchObject({ time: '10:30', title: 'Gyeongbokgung Palace' });
  });

  it('humanizes poi_key when name_i18n is absent', () => {
    const items = dayPlanStopsToSchedule([{ seq: 1, poi_key: 'haedong_yonggungsa', arrival_planned: '14:00' }]);
    expect(items[0].title).toBe('Haedong Yonggungsa');
  });

  it('tolerates junk input (non-array, malformed stops)', () => {
    expect(dayPlanStopsToSchedule(null)).toEqual([]);
    expect(dayPlanStopsToSchedule('nope')).toEqual([]);
    expect(dayPlanStopsToSchedule([null, 42, {}])).toEqual([]);
  });
});

describe('poiKeysToSchedule (stage ② transform)', () => {
  it('uses match_pois names when available, humanized key otherwise', () => {
    const items = poiKeysToSchedule(['gamcheon_culture_village', 'unknown_poi'], {
      gamcheon_culture_village: 'Gamcheon Culture Village',
    });
    expect(items[0]).toMatchObject({ title: 'Gamcheon Culture Village', poi_key: 'gamcheon_culture_village' });
    expect(items[1]).toMatchObject({ title: 'Unknown Poi' });
  });

  it('drops empty keys', () => {
    expect(poiKeysToSchedule(['', '  ', 'seongsan_ilchulbong'])).toHaveLength(1);
  });
});

describe('humanizePoiKey', () => {
  it('title-cases snake_case', () => {
    expect(humanizePoiKey('n_seoul_tower')).toBe('N Seoul Tower');
  });
});

describe('resolveDaySchedule — the 4-stage chain', () => {
  it('stage ①: an active day plan owns the schedule', async () => {
    const db = fakeDb({ tour_day_plans: { data: PLAN, error: null } });
    const result = await resolveDaySchedule(db, {
      bookingId: 'booking-1',
      tourDate: '2026-07-20',
      itinerary: null,
      tourSchedule: LEGACY_SCHEDULE,
    });
    expect(result.source).toBe('day_plan');
    expect(result.dayPlan?.id).toBe('plan-1');
    expect(result.schedule[0].title).toBe('Bukchon Hanok Village');
  });

  it('stage ②: itinerary poi_keys win over tours.schedule when no plan exists', async () => {
    const db = fakeDb({
      tour_day_plans: { data: null, error: null },
      match_pois: { data: [{ poi_key: 'seongsan_ilchulbong', name_en: 'Seongsan Ilchulbong' }], error: null },
    });
    const result = await resolveDaySchedule(db, {
      bookingId: 'booking-1',
      tourDate: '2026-07-20',
      itinerary: { poi_keys: ['seongsan_ilchulbong', 'udo_island'] },
      tourSchedule: LEGACY_SCHEDULE,
    });
    expect(result.source).toBe('booking_itinerary');
    expect(result.schedule).toEqual([
      expect.objectContaining({ title: 'Seongsan Ilchulbong' }),
      expect.objectContaining({ title: 'Udo Island' }),
    ]);
    expect(result.dayPlan).toBeNull();
  });

  it('stage ③: legacy tours.schedule passes through untouched (regression gate)', async () => {
    const db = fakeDb({ tour_day_plans: { data: null, error: null } });
    const result = await resolveDaySchedule(db, {
      bookingId: 'booking-1',
      tourDate: '2026-07-20',
      itinerary: null,
      tourSchedule: LEGACY_SCHEDULE,
    });
    expect(result.source).toBe('tour_schedule');
    // Same array reference — the resolver must not transform legacy data.
    expect(result.schedule).toBe(LEGACY_SCHEDULE);
  });

  it('stage ④: empty everything → honest none/[]', async () => {
    const db = fakeDb({ tour_day_plans: { data: null, error: null } });
    const result = await resolveDaySchedule(db, {
      bookingId: 'booking-1',
      tourDate: '2026-07-20',
      itinerary: { poi_keys: [] },
      tourSchedule: [],
    });
    expect(result).toEqual({ source: 'none', schedule: [], dayPlan: null });
  });

  it('draft plans do NOT own the schedule (status filter is the query, not code)', async () => {
    // The fake returns null for the filtered query, as the real .in() filter would.
    const db = fakeDb({ tour_day_plans: { data: null, error: null } });
    const result = await resolveDaySchedule(db, {
      bookingId: 'booking-1',
      tourDate: '2026-07-20',
      itinerary: null,
      tourSchedule: LEGACY_SCHEDULE,
    });
    expect(result.source).toBe('tour_schedule');
  });

  it('degrades: a day_plans query failure falls through to later stages', async () => {
    const db = fakeDb({
      tour_day_plans: () => {
        throw new Error('relation does not exist');
      },
    });
    const result = await resolveDaySchedule(db, {
      bookingId: 'booking-1',
      tourDate: '2026-07-20',
      itinerary: null,
      tourSchedule: LEGACY_SCHEDULE,
    });
    expect(result.source).toBe('tour_schedule');
    expect(result.schedule).toBe(LEGACY_SCHEDULE);
  });

  it('skips stage ① entirely when the booking has no tour_date', async () => {
    const db = fakeDb({
      tour_day_plans: () => {
        throw new Error('must not be queried');
      },
    });
    const result = await resolveDaySchedule(db, {
      bookingId: 'booking-1',
      tourDate: null,
      itinerary: null,
      tourSchedule: LEGACY_SCHEDULE,
    });
    expect(result.source).toBe('tour_schedule');
  });

  it('fetches bookings.itinerary itself when the caller passes undefined', async () => {
    const db = fakeDb({
      tour_day_plans: { data: null, error: null },
      bookings: { data: { itinerary: { poi_keys: ['jagalchi_market'] } }, error: null },
      match_pois: { data: [], error: null },
    });
    const result = await resolveDaySchedule(db, {
      bookingId: 'booking-1',
      tourDate: '2026-07-20',
      tourSchedule: [],
    });
    expect(result.source).toBe('booking_itinerary');
    expect(result.schedule[0].title).toBe('Jagalchi Market');
  });

  it('match_pois lookup failure degrades to humanized keys, not an error', async () => {
    const db = fakeDb({
      tour_day_plans: { data: null, error: null },
      match_pois: () => {
        throw new Error('boom');
      },
    });
    const result = await resolveDaySchedule(db, {
      bookingId: 'booking-1',
      tourDate: '2026-07-20',
      itinerary: { poi_keys: ['gwangalli_beach'] },
      tourSchedule: [],
    });
    expect(result.schedule[0].title).toBe('Gwangalli Beach');
  });
});
