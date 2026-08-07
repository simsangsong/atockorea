/**
 * Planner-side of the imported-course connection: a private-charter booking's
 * /plan templates must include the charter's signature courses with
 * origin_tour_slug wired (that field is what switches the planner preview to
 * the rich photo cards + product drawer).
 */
import { buildImportedCourseTemplates } from '@/lib/tour-room/importedCourseTemplates';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase';

type MatchStop = { tour_slug: string; stop_index: number; poi_key: string | null; title: string | null };
type MatchPoi = Record<string, unknown>;

function supabaseMock(stops: MatchStop[], pois: MatchPoi[]): SupabaseClient<Database> {
  return {
    from: (table: string) => {
      if (table === 'match_itinerary_stops') {
        return {
          select: () => ({
            in: () => ({
              order: () => Promise.resolve({ data: stops, error: null }),
            }),
          }),
        };
      }
      if (table === 'match_pois') {
        return {
          select: () => ({
            in: () => Promise.resolve({ data: pois, error: null }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as unknown as SupabaseClient<Database>;
}

describe('buildImportedCourseTemplates', () => {
  it('returns [] for bookings on non-charter tours (zero-cost path)', async () => {
    const templates = await buildImportedCourseTemplates(
      supabaseMock([], []),
      'east-signature-nature-core',
      'jeju',
      new Set(),
    );
    expect(templates).toEqual([]);
  });

  it('synthesizes all Jeju courses from static bundles when match data is absent', async () => {
    const templates = await buildImportedCourseTemplates(
      supabaseMock([], []),
      'jeju-island-private-car-charter-tour',
      'jeju',
      new Set(),
    );
    expect(templates.map((t) => t.origin_tour_slug)).toEqual([
      'jeju-southern-top-unesco-spots-tour',
      'southwest-hallasan-osulloc-aewol',
      'east-signature-nature-core',
    ]);
    for (const t of templates) {
      expect(t.id).toBe(`imported-${t.origin_tour_slug}`);
      expect(t.region).toBe('jeju');
      expect(t.title_i18n.en?.length).toBeGreaterThan(0);
      expect(t.title_i18n.ko?.length).toBeGreaterThan(0);
      expect(t.stops.length).toBeGreaterThanOrEqual(3);
      for (const stop of t.stops) {
        expect(stop.source).toBe('free');
        const names = stop.name_i18n as Record<string, string>;
        expect(names.en?.length).toBeGreaterThan(0);
      }
    }
  });

  it('prefers poi-linked match stops when the course has match data', async () => {
    const stops: MatchStop[] = [
      { tour_slug: 'east-signature-nature-core', stop_index: 1, poi_key: 'seongsan', title: 'Seongsan' },
      { tour_slug: 'east-signature-nature-core', stop_index: 2, poi_key: null, title: 'Free stop' },
    ];
    const pois: MatchPoi[] = [
      {
        poi_key: 'seongsan',
        name_en: 'Seongsan Ilchulbong',
        name_ko: '성산일출봉',
        lat: 33.458,
        lng: 126.942,
        default_stay_minutes: 90,
        category: 'nature',
      },
    ];
    const templates = await buildImportedCourseTemplates(
      supabaseMock(stops, pois),
      'jeju-island-private-car-charter-tour',
      'jeju',
      // Focus the assertion on the east course; the other two are DB-served.
      new Set(['jeju-southern-top-unesco-spots-tour', 'southwest-hallasan-osulloc-aewol']),
    );
    expect(templates).toHaveLength(1);
    const east = templates[0];
    expect(east.origin_tour_slug).toBe('east-signature-nature-core');
    expect(east.stops).toHaveLength(2);
    expect(east.stops[0]).toMatchObject({
      source: 'poi',
      poi_key: 'seongsan',
      duration_min: 90,
      lat: 33.458,
      lng: 126.942,
      category: 'nature',
    });
    expect((east.stops[0].name_i18n as Record<string, string>).ko).toBe('성산일출봉');
    expect(east.stops[1]).toMatchObject({ source: 'free', duration_min: 60 });
  });

  it('never duplicates a course the DB already serves', async () => {
    const templates = await buildImportedCourseTemplates(
      supabaseMock([], []),
      'seoul-suburbs-private-chartered-car-10hr',
      'seoul',
      new Set([
        'seoul-private-nami-morning-calm-petite-france',
        'seoul-dmz-private-3rd-tunnel-suspension-bridge',
        'seoul-suwon-hwaseong-folk-village-starfield-library',
        'pocheon-sanjeong-lake-herb-island-art-valley',
      ]),
    );
    expect(templates).toEqual([]);
  });
});
