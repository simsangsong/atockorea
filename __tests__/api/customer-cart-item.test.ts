/**
 * @jest-environment node
 *
 * X7 — `PUT`/`DELETE /api/cart/[id]`, which nothing had ever called.
 *
 * Two things are worth locking here and they fail in different directions:
 *
 *   ① Ownership. Both verbs read the row, compare `user_id`, and only then
 *      write. Every negative case therefore asserts that NO write was issued —
 *      a 403 that had already deleted the row would be a catastrophic pass.
 *
 *   ② The price rule. `PUT` recomputes `total_price` itself, and it multiplies
 *      by guest count ONLY for `price_type: 'person'`. Charter and group
 *      products are flat per booking, so a change here silently multiplies a
 *      vehicle charter by the number of passengers — money, in a route with no
 *      test. (This is the same rule as `lib/quote-engine/pricing-policy.ts`;
 *      the assertion below is about this route not drifting from it.)
 */
import '@/test-utils/restoreWebPrimitives';
import { PUT, DELETE } from '@/app/api/cart/[id]/route';
import { createServerClient } from '@/lib/supabase';

jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));

const createServerClientMock = createServerClient as jest.Mock;

const OWNER = 'user-owner';
const OTHER = 'user-other';
const ITEM = 'cart-item-1';

interface Existing {
  user_id: string;
  unit_price: number;
  number_of_guests: number;
  tours: { price_type: 'person' | 'group' | 'vehicle' } | null;
}

let updates: Record<string, unknown>[];
let deletes: number;

function mockSupabase(opts: { tokenUser?: { id: string } | null; existing?: Existing | null }) {
  updates = [];
  deletes = 0;
  const single = async () =>
    opts.existing
      ? { data: opts.existing, error: null }
      : { data: null, error: { message: 'no rows' } };

  createServerClientMock.mockReturnValue({
    auth: {
      getUser: jest.fn(async () => ({
        data: { user: opts.tokenUser ?? null },
        error: opts.tokenUser ? null : { message: 'bad token' },
      })),
    },
    from: jest.fn(() => {
      const q: Record<string, unknown> = {};
      q.select = jest.fn(() => q);
      q.eq = jest.fn(() => q);
      q.single = jest.fn(single);
      q.update = jest.fn((data: Record<string, unknown>) => {
        updates.push(data);
        const u: Record<string, unknown> = {};
        u.eq = jest.fn(() => u);
        u.select = jest.fn(() => u);
        u.single = jest.fn(async () => ({ data: { id: ITEM, ...data }, error: null }));
        return u;
      });
      q.delete = jest.fn(() => {
        deletes += 1;
        return { eq: jest.fn(async () => ({ error: null })) };
      });
      return q;
    }),
  });
}

const req = (opts: { auth?: string; body?: unknown }) =>
  ({
    headers: new Headers(opts.auth ? { authorization: opts.auth } : {}),
    json: async () => opts.body ?? {},
  }) as unknown as import('next/server').NextRequest;

const ctx = { params: Promise.resolve({ id: ITEM }) };

const ownedByOwner = (price_type: 'person' | 'group' | 'vehicle'): Existing => ({
  user_id: OWNER,
  unit_price: 100,
  number_of_guests: 1,
  tours: { price_type },
});

beforeEach(() => jest.clearAllMocks());

describe('PUT /api/cart/[id]', () => {
  it('requires a bearer token', async () => {
    mockSupabase({ tokenUser: null, existing: ownedByOwner('person') });
    const res = await PUT(req({ body: { numberOfGuests: 3 } }), ctx);
    expect(res.status).toBe(401);
    expect(updates).toEqual([]);
  });

  it('treats a malformed Authorization header as unauthenticated', async () => {
    mockSupabase({ tokenUser: { id: OWNER }, existing: ownedByOwner('person') });
    const res = await PUT(req({ auth: 'token abc', body: { numberOfGuests: 3 } }), ctx);
    expect(res.status).toBe(401);
    expect(updates).toEqual([]);
  });

  it('404s on a missing item', async () => {
    mockSupabase({ tokenUser: { id: OWNER }, existing: null });
    const res = await PUT(req({ auth: 'Bearer t', body: { numberOfGuests: 3 } }), ctx);
    expect(res.status).toBe(404);
    expect(updates).toEqual([]);
  });

  it('🔴 refuses to update somebody else’s cart item, and writes nothing', async () => {
    mockSupabase({
      tokenUser: { id: OTHER },
      existing: ownedByOwner('person'),
    });
    const res = await PUT(req({ auth: 'Bearer t', body: { numberOfGuests: 9 } }), ctx);
    expect(res.status).toBe(403);
    expect(updates).toEqual([]);
  });

  it('multiplies by guests for per-person products', async () => {
    mockSupabase({ tokenUser: { id: OWNER }, existing: ownedByOwner('person') });
    const res = await PUT(req({ auth: 'Bearer t', body: { numberOfGuests: 4 } }), ctx);
    expect(res.status).toBe(200);
    expect(updates[0]).toMatchObject({ total_price: 400, number_of_guests: 4 });
  });

  /**
   * 🔴 The one that would cost money. A charter is one vehicle whatever the
   * party size; multiplying it by guests quadruples the customer's total.
   */
  it('🔴 keeps charter and group products flat, whatever the guest count', async () => {
    for (const priceType of ['vehicle', 'group'] as const) {
      mockSupabase({ tokenUser: { id: OWNER }, existing: ownedByOwner(priceType) });
      const res = await PUT(req({ auth: 'Bearer t', body: { numberOfGuests: 4 } }), ctx);
      expect(res.status).toBe(200);
      expect(updates[0]).toMatchObject({ total_price: 100, number_of_guests: 4 });
    }
  });

  it('falls back to the stored guest count when the body omits it', async () => {
    mockSupabase({
      tokenUser: { id: OWNER },
      existing: { ...ownedByOwner('person'), number_of_guests: 3 },
    });
    const res = await PUT(req({ auth: 'Bearer t', body: { bookingDate: '2026-08-01' } }), ctx);
    expect(res.status).toBe(200);
    expect(updates[0]).toMatchObject({ total_price: 300, booking_date: '2026-08-01' });
    expect(updates[0]).not.toHaveProperty('number_of_guests');
  });

  it('normalises an empty pickup point to null rather than an empty string', async () => {
    mockSupabase({ tokenUser: { id: OWNER }, existing: ownedByOwner('person') });
    await PUT(req({ auth: 'Bearer t', body: { pickupPointId: '' } }), ctx);
    expect(updates[0]).toMatchObject({ pickup_point_id: null });
  });
});

describe('DELETE /api/cart/[id]', () => {
  it('requires a bearer token', async () => {
    mockSupabase({ tokenUser: null, existing: ownedByOwner('person') });
    const res = await DELETE(req({}), ctx);
    expect(res.status).toBe(401);
    expect(deletes).toBe(0);
  });

  it('404s on a missing item', async () => {
    mockSupabase({ tokenUser: { id: OWNER }, existing: null });
    const res = await DELETE(req({ auth: 'Bearer t' }), ctx);
    expect(res.status).toBe(404);
    expect(deletes).toBe(0);
  });

  it('🔴 refuses to delete somebody else’s cart item, and deletes nothing', async () => {
    mockSupabase({ tokenUser: { id: OTHER }, existing: ownedByOwner('person') });
    const res = await DELETE(req({ auth: 'Bearer t' }), ctx);
    expect(res.status).toBe(403);
    expect(deletes).toBe(0);
  });

  it('deletes the caller’s own item', async () => {
    mockSupabase({ tokenUser: { id: OWNER }, existing: ownedByOwner('person') });
    const res = await DELETE(req({ auth: 'Bearer t' }), ctx);
    expect(res.status).toBe(200);
    expect(deletes).toBe(1);
  });
});
