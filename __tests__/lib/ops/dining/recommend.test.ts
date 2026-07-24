/**
 * The entry point slice B calls (§5.7 R-1 → R-5).
 *
 * Focus: the intake ladder (needs beat the booking text, and the booking text
 * only speaks when needs are silent) and the RankedPlace → wire-shape mapping,
 * both of which slice B depends on without being able to see inside.
 */

import { recommendDining, resolveDietary, toDiningPlace } from '@/lib/ops/dining/recommend.server';
import type { RankedPlace } from '@/lib/ops/dining/places';
import type { RoomDbClient } from '@/lib/tour-room/access';

interface StubResult {
  data: unknown;
}

type Resolver = (table: string) => StubResult;

function stubClient(resolver: Resolver): { client: RoomDbClient; tables: string[] } {
  const tables: string[] = [];
  function builder(table: string) {
    const chain: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'in', 'lt', 'gt', 'limit', 'order', 'update', 'upsert']) {
      chain[method] = () => chain;
    }
    chain.maybeSingle = () => Promise.resolve(resolver(table));
    chain.single = () => Promise.resolve(resolver(table));
    chain.then = (onFulfilled: (value: StubResult) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(resolver(table)).then(onFulfilled, onRejected);
    return chain;
  }
  return {
    client: {
      from(table: string) {
        tables.push(table);
        return builder(table);
      },
    } as RoomDbClient,
    tables,
  };
}

describe('resolveDietary — the R-1 ladder', () => {
  it('takes tour_day_plans.needs when it carries a restriction', async () => {
    const { client, tables } = stubClient((table) =>
      table === 'tour_day_plans'
        ? { data: [{ needs: { dietary: ['no_pork'], children: 1 } }] }
        : { data: { special_requests: 'gluten free please' } },
    );
    const result = await resolveDietary(client, 'booking-1');
    expect(result.tags).toEqual(['no_pork', 'kids']);
    // 🔴 The booking text must not be consulted at all — a guest who unticked a
    // chip in /plan is not overruled by an old note.
    expect(tables).toEqual(['tour_day_plans']);
  });

  it('falls back to the booking text when needs carry nothing', async () => {
    const { client } = stubClient((table) =>
      table === 'tour_day_plans'
        ? { data: [{ needs: { dietary: [] } }] }
        : { data: { special_requests: 'No pork please', notes: null } },
    );
    expect((await resolveDietary(client, 'booking-1')).tags).toEqual(['no_pork']);
  });

  it('still consults the booking text when the plan only says "children"', async () => {
    const { client } = stubClient((table) =>
      table === 'tour_day_plans'
        ? { data: [{ needs: { children: 2 } }] }
        : { data: { special_requests: 'nut allergy!' } },
    );
    const result = await resolveDietary(client, 'booking-1');
    expect(result.tags).toEqual(expect.arrayContaining(['kids', 'no_nuts']));
  });

  it('carries the free-text allergy note through', async () => {
    const { client } = stubClient((table) =>
      table === 'tour_day_plans' ? { data: [{ needs: { dietary: ['vegan'], allergy_note: '땅콩' } }] } : { data: null },
    );
    expect((await resolveDietary(client, 'booking-1')).allergyNote).toBe('땅콩');
  });

  it('returns empty rather than throwing when both lookups fail', async () => {
    const client = {
      from() {
        throw new Error('db down');
      },
    } as unknown as RoomDbClient;
    expect(await resolveDietary(client, 'booking-1')).toEqual({ tags: [], allergyNote: null });
  });
});

describe('toDiningPlace', () => {
  const ranked: RankedPlace = {
    place_key: 'kakao:1',
    cell: 'wvfq2du',
    name: '올레국수',
    name_i18n: { en: 'Olle Guksu' },
    category_group: 'FD6',
    category_name: '음식점 > 한식 > 국수',
    cuisine: '국수',
    place_url: 'http://place.map.kakao.com/1',
    lat: 33.4586,
    lng: 126.9425,
    rating: 4.4,
    review_count: 312,
    price_band: 2,
    tags: ['dine_in'],
    signature_menus: [{ name: '고기국수' }],
    score: 12.3,
    distance_m: 240,
    walk_min: 3,
    open_today: true,
    closes_at: '21:00',
  };

  it('projects exactly the spec §R-5 wire shape', () => {
    const place = toDiningPlace(ranked);
    expect(Object.keys(place).sort()).toEqual(
      [
        'category_name',
        'closes_at',
        'cuisine',
        'distance_m',
        'lat',
        'lng',
        'name',
        'name_i18n',
        'open_today',
        'place_key',
        'place_url',
        'price_band',
        'rating',
        'review_count',
        'signature_menus',
        'tags',
        'walk_min',
      ].sort(),
    );
    // The internal ranking score never ships to the client.
    expect('score' in place).toBe(false);
  });

  it('nulls the optional fields instead of dropping them, and carries `unrated`', () => {
    const bare = toDiningPlace({ ...ranked, rating: null, review_count: null, price_band: null, tags: undefined });
    expect(bare.rating).toBeNull();
    expect(bare.tags).toEqual([]);
    expect('unrated' in bare).toBe(false);
    expect(toDiningPlace({ ...ranked, unrated: true }).unrated).toBe(true);
  });
});

describe('recommendDining', () => {
  it('returns null for unusable arguments instead of throwing', async () => {
    const { client } = stubClient(() => ({ data: null }));
    await expect(recommendDining(client, { bookingId: '', spotTitle: 'x', lat: 1, lng: 1, meal: 'lunch' })).resolves.toBeNull();
    await expect(
      recommendDining(client, { bookingId: 'b', spotTitle: 'x', lat: Number.NaN, lng: 1, meal: 'lunch' }),
    ).resolves.toBeNull();
  });

  it('returns null (no empty card) when the cell yields nothing', async () => {
    const originalKey = process.env.KAKAO_REST_API_KEY;
    delete process.env.KAKAO_REST_API_KEY; // collectCell short-circuits
    try {
      const { client } = stubClient((table) => (table === 'ops_kakao_cell_index' ? { data: null } : { data: [] }));
      await expect(
        recommendDining(client, {
          bookingId: 'b',
          spotTitle: 'Seongsan',
          lat: 33.4586,
          lng: 126.9425,
          meal: 'lunch',
          dietary: [],
        }),
      ).resolves.toBeNull();
    } finally {
      if (originalKey !== undefined) process.env.KAKAO_REST_API_KEY = originalKey;
    }
  });

  it('builds the card meta from a cache HIT, ranked and logged', async () => {
    const future = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
    const { client } = stubClient((table) => {
      if (table === 'ops_kakao_cell_index') return { data: { cell: 'wvfq2du', expires_at: future } };
      if (table === 'ops_kakao_place_cache') {
        return {
          data: [
            {
              place_key: 'kakao:pork',
              cell: 'wvfq2du',
              name: '흑돼지 맛집',
              category_group: 'FD6',
              place_url: 'http://place.map.kakao.com/2',
              lat: 33.4586,
              lng: 126.9425,
              rating: 4.9,
              review_count: 900,
              tags: [],
              expires_at: future,
            },
            {
              place_key: 'kakao:noodle',
              cell: 'wvfq2du',
              name: '올레국수',
              category_group: 'FD6',
              category_name: '음식점 > 한식 > 국수',
              cuisine: '국수',
              place_url: 'http://place.map.kakao.com/1',
              lat: 33.4586,
              lng: 126.9425,
              rating: 4.2,
              review_count: 300,
              tags: [],
              expires_at: future,
            },
          ],
        };
      }
      return { data: [] };
    });

    const result = await recommendDining(client, {
      bookingId: 'booking-1',
      poiKey: 'seongsan_ilchulbong',
      spotTitle: 'Seongsan Ilchulbong',
      lat: 33.4586,
      lng: 126.9425,
      meal: 'lunch',
      dietary: ['no_pork'],
      nowMs: Date.parse('2026-07-26T03:00:00Z'),
      triggeredByRole: 'guide',
    });

    expect(result).not.toBeNull();
    expect(result?.meta.kind).toBe('dining_card');
    expect(result?.meta.source).toBe('cache');
    expect(result?.meta.meal).toBe('lunch');
    expect(result?.meta.cell).toHaveLength(7);
    expect(result?.meta.triggered_by_role).toBe('guide');
    // 🔴 the higher-rated pork house is excluded, not merely down-ranked.
    expect(result?.meta.places.map((p) => p.place_key)).toEqual(['kakao:noodle']);
    expect(result?.shown).toEqual([
      expect.objectContaining({ booking_id: 'booking-1', place_key: 'kakao:noodle', rank: 1, dietary_tags: ['no_pork'] }),
    ]);
  });
});
