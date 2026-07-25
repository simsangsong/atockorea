/**
 * W0.2 — 4-stage day-schedule resolver (smart-guide private-mode plan §C-4).
 * The regression gate: with no day plan and no itinerary poi_keys the chain
 * must reproduce the legacy `tours.schedule ?? []` output exactly.
 */
import {
  dayPlanStopsToSchedule,
  humanizePoiKey,
  pickLocalizedName,
  productStopsToSchedule,
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

// P0-5 — the resolver used to read name_i18n.en with no locale in scope, so a
// Chinese guest got an English itinerary while the Chinese name sat unused in
// the same jsonb. English must be the LAST resort, not the first.
describe('P0-5 locale-aware stop titles', () => {
  const NAMES = {
    en: 'Gamcheon Culture Village',
    ko: '감천문화마을',
    zh: '甘川文化村',
    'zh-TW': '甘川文化村',
    ja: '甘川文化村',
  };

  it('serves the stop title in the reader locale', () => {
    const stops = [{ seq: 1, poi_key: 'gamcheon_culture_village', name_i18n: NAMES }];
    expect(dayPlanStopsToSchedule(stops, 'zh')[0].title).toBe('甘川文化村');
    expect(dayPlanStopsToSchedule(stops, 'ko')[0].title).toBe('감천문화마을');
    expect(dayPlanStopsToSchedule(stops, 'ja')[0].title).toBe('甘川文化村');
  });

  it('falls back base-language → English, and keeps English for en readers', () => {
    const stops = [{ seq: 1, name_i18n: NAMES }];
    // zh-CN has no exact key; the base language 'zh' answers it.
    expect(dayPlanStopsToSchedule(stops, 'zh-CN')[0].title).toBe('甘川文化村');
    // A locale with no translation at all degrades to English, not to blank.
    expect(dayPlanStopsToSchedule(stops, 'fr')[0].title).toBe('Gamcheon Culture Village');
    expect(dayPlanStopsToSchedule(stops, 'en')[0].title).toBe('Gamcheon Culture Village');
  });

  it('omitting locale keeps the legacy English-first behaviour (ops/driver callers)', () => {
    expect(dayPlanStopsToSchedule([{ seq: 1, name_i18n: NAMES }])[0].title).toBe('Gamcheon Culture Village');
  });

  it('pickLocalizedName finds a regional sibling when only zh-TW is stored', () => {
    expect(pickLocalizedName({ en: 'Jagalchi Market', 'zh-TW': '札嘎其市場' }, 'zh')).toBe('札嘎其市場');
    expect(pickLocalizedName(null, 'zh')).toBe('');
    expect(pickLocalizedName({}, 'zh')).toBe('');
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

/**
 * P0-5 stage ②.5 — the product page already stores this tour's itinerary in all
 * six content locales. Live rooms were hitting stage ③ (tours.schedule), a
 * single-language English blob, which is why a Chinese guest read an English
 * itinerary while the Chinese one sat in tour_product_pages unused.
 */
describe('P0-5 product-page itinerary (stage ②.5)', () => {
  const stops = [
    {
      number: 2,
      name: '유엔기념공원 (한국전쟁)',
      time: '≈ 09:30',
      duration: '45분',
      category: '관람',
      _poi_meta: { poi_key: 'un_memorial_cemetery' },
    },
    { number: 1, name: '부산 크루즈 터미널에서 픽업', time: 'Cruise arrival + 30 min' },
  ];

  it('orders by the stop number and carries title/time/poi_key through', () => {
    const items = productStopsToSchedule(stops);
    expect(items.map((item) => item.title)).toEqual([
      '부산 크루즈 터미널에서 픽업',
      '유엔기념공원 (한국전쟁)',
    ]);
    expect(items[1]).toMatchObject({
      time: '≈ 09:30',
      duration: '45분',
      category: '관람',
      poi_key: 'un_memorial_cemetery',
      source: 'product_page',
    });
  });

  it('drops nameless stops and tolerates junk', () => {
    expect(productStopsToSchedule(null)).toEqual([]);
    expect(productStopsToSchedule('nope')).toEqual([]);
    expect(productStopsToSchedule([null, 42, {}, { number: 1, name: '   ' }])).toEqual([]);
  });
});
