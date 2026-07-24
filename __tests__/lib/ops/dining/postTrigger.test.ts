/**
 * §5.7 R-2 — the auto-trigger predicate: `maybePostDiningForStop` fires ONLY
 * at a meal stop, resolves coordinates from match_pois when the caller has
 * none, and swallows every failure (the approach / arrival routes `void` it).
 */
import { maybePostDiningForStop, postDiningCard } from '@/lib/ops/dining/post.server';
import { recommendDining } from '@/lib/ops/dining/recommend.server';
import type { DiningCardMeta } from '@/lib/ops/dining/card';

jest.mock('@/lib/ops/dining/recommend.server', () => ({
  recommendDining: jest.fn(),
  recordShown: jest.fn(async () => true),
}));
jest.mock('@/lib/tour-room/events', () => ({ recordRoomEvent: jest.fn(async () => ({ inserted: true, event: null })) }));
jest.mock('@/lib/tour-room/realtime', () => ({ broadcastToRoom: jest.fn(async () => ({ ok: true })) }));

const recommendMock = recommendDining as jest.Mock;

const BOOKING = { id: 'b1', tour_id: 'tour-1', tour_date: '2099-07-24', preferred_language: 'en' };

const META: DiningCardMeta = {
  kind: 'dining_card',
  poi_key: 'dongmun_market',
  spot_title: 'Dongmun Market',
  cell: 'wydm9q1',
  meal: 'lunch',
  dietary: [],
  places: [],
  source: 'cache',
};

function fakeDb(poi: Record<string, { lat: number; lng: number }> = {}) {
  const inserts: Record<string, Array<Record<string, unknown>>> = {};
  return {
    inserts,
    from(table: string) {
      const chain: Record<string, unknown> = {};
      const filters: Record<string, unknown> = {};
      for (const m of ['select', 'neq', 'in', 'gte', 'order', 'limit']) chain[m] = jest.fn(() => chain);
      chain.eq = jest.fn((col: string, value: unknown) => {
        filters[col] = value;
        return chain;
      });
      const single = async () => {
        if (table === 'match_pois') return { data: poi[String(filters.poi_key)] ?? null, error: null };
        if (table === 'tours') return { data: { price_type: 'private' }, error: null };
        return { data: null, error: null };
      };
      chain.single = jest.fn(single);
      chain.maybeSingle = jest.fn(single);
      chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => single().then(res, rej);
      chain.upsert = jest.fn((values: Record<string, unknown>) => ({
        select: () => ({
          single: async () => ({ data: { id: `room-${values.booking_id}`, booking_id: values.booking_id }, error: null }),
        }),
      }));
      chain.insert = jest.fn((values: Record<string, unknown>) => {
        (inserts[table] ??= []).push(values);
        return { select: () => ({ single: async () => ({ data: { id: 'm1', ...values }, error: null }) }) };
      });
      return chain;
    },
  };
}

const args = (extra: Record<string, unknown>) =>
  ({ booking: BOOKING, actorRole: 'guide' as const, ...extra }) as Parameters<typeof maybePostDiningForStop>[1];

beforeEach(() => {
  jest.clearAllMocks();
  recommendMock.mockResolvedValue({ meta: { ...META }, shown: [] });
});

describe('maybePostDiningForStop — the meal gate', () => {
  it('stays silent at a non-meal stop', async () => {
    const db = fakeDb({ seongsan: { lat: 33.458, lng: 126.9425 } });
    const result = await maybePostDiningForStop(db, args({ stop: { title: 'Seongsan Ilchulbong' }, poiKey: 'seongsan' }));
    expect(result.posted).toBe(false);
    expect(result.skipped).toBe('not_meal');
    expect(recommendMock).not.toHaveBeenCalled();
    expect(db.inserts.tour_room_messages).toBeUndefined();
  });

  it("fires on the planner's explicit stop_type", async () => {
    const db = fakeDb({ anywhere: { lat: 33.5, lng: 126.5 } });
    const result = await maybePostDiningForStop(
      db,
      args({ stop: { title: 'Lunch break', stop_type: 'lunch' }, poiKey: 'anywhere' }),
    );
    expect(result.posted).toBe(true);
    expect(recommendMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ meal: 'lunch' }));
    expect(db.inserts.tour_room_messages).toHaveLength(1);
  });

  it("fires on the stop's own time window, and labels dinner correctly", async () => {
    const db = fakeDb({ anywhere: { lat: 33.5, lng: 126.5 } });
    const result = await maybePostDiningForStop(
      db,
      args({ stop: { title: 'Seaside stop', time: '18:30' }, poiKey: 'anywhere' }),
    );
    expect(result.posted).toBe(true);
    expect(recommendMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ meal: 'dinner' }));
  });

  it('fires on a meal-ish title (the legacy market stop)', async () => {
    const db = fakeDb({ dongmun_market: { lat: 33.51, lng: 126.53 } });
    const result = await maybePostDiningForStop(
      db,
      args({ stop: { title: 'Dongmun Market' }, poiKey: 'dongmun_market' }),
    );
    expect(result.posted).toBe(true);
  });
});

describe('maybePostDiningForStop — coordinates', () => {
  it('falls back to match_pois when the caller has none', async () => {
    const db = fakeDb({ dongmun_market: { lat: 33.51, lng: 126.53 } });
    await maybePostDiningForStop(db, args({ stop: { title: '동문시장' }, poiKey: 'dongmun_market' }));
    expect(recommendMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ lat: 33.51, lng: 126.53 }),
    );
  });

  it('skips silently when nothing can resolve a position', async () => {
    const db = fakeDb({});
    const result = await maybePostDiningForStop(db, args({ stop: { title: '맛집 거리' }, poiKey: 'unknown_key' }));
    expect(result.posted).toBe(false);
    expect(result.skipped).toBe('no_coords');
    expect(recommendMock).not.toHaveBeenCalled();
  });

  it('explicit coordinates win over the lookup', async () => {
    const db = fakeDb({ dongmun_market: { lat: 33.51, lng: 126.53 } });
    await maybePostDiningForStop(
      db,
      args({ stop: { title: '동문시장' }, poiKey: 'dongmun_market', lat: 35.1, lng: 129.0 }),
    );
    expect(recommendMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ lat: 35.1, lng: 129.0 }));
  });
});

describe('postDiningCard — failure containment', () => {
  it('never throws when the recommendation blows up', async () => {
    recommendMock.mockRejectedValue(new Error('kakao 500'));
    const db = fakeDb({});
    const result = await postDiningCard(
      db,
      { booking: BOOKING, spotTitle: 'X', lat: 33.5, lng: 126.5, meal: 'lunch', actorRole: 'guide' },
    );
    expect(result).toMatchObject({ posted: false, skipped: 'no_card' });
    expect(db.inserts.tour_room_messages).toBeUndefined();
  });

  it('never throws when the message insert fails', async () => {
    const db = fakeDb({});
    db.from = ((table: string) => {
      const chain: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'neq', 'in', 'gte', 'order', 'limit']) chain[m] = jest.fn(() => chain);
      const single = async () => ({ data: table === 'tours' ? { price_type: 'private' } : null, error: null });
      chain.single = jest.fn(single);
      chain.maybeSingle = jest.fn(single);
      chain.then = (res: (v: unknown) => unknown) => single().then(res);
      chain.upsert = jest.fn(() => ({
        select: () => ({ single: async () => ({ data: { id: 'room-b1', booking_id: 'b1' }, error: null }) }),
      }));
      chain.insert = jest.fn(() => ({
        select: () => ({ single: async () => ({ data: null, error: { message: 'boom' } }) }),
      }));
      return chain;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;
    const result = await postDiningCard(
      db,
      { booking: BOOKING, spotTitle: 'X', lat: 33.5, lng: 126.5, meal: 'lunch', actorRole: 'guide' },
    );
    expect(result.posted).toBe(false);
    expect(result.skipped).toBe('delivery_failed');
  });
});
