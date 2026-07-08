/**
 * State-machine tests for lib/coupons/settlement.ts against an in-memory fake
 * of the supabase-js query builder (only the call shapes the module uses:
 * from().select/update().eq/is/lt/maybeSingle/select). Verifies the
 * booking-lifecycle transitions and their idempotency guards.
 */

import {
  redeemCouponForBooking,
  releaseCouponForBooking,
  sweepAbandonedCouponLocks,
  attachPaymentIntentToCouponRedemption,
  getPendingCouponRedemption,
} from '@/lib/coupons/settlement';

type Row = Record<string, any>;

class FakeQuery {
  private filters: Array<(r: Row) => boolean> = [];
  private updatePatch: Row | null = null;
  private selectCols: string | null = null;

  constructor(private table: Row[], private db: FakeDb) {}

  select(cols: string) {
    this.selectCols = cols;
    return this;
  }
  update(patch: Row) {
    this.updatePatch = patch;
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push((r) => r[col] === val);
    return this;
  }
  is(col: string, val: unknown) {
    this.filters.push((r) => r[col] === val);
    return this;
  }
  lt(col: string, val: string) {
    this.filters.push((r) => String(r[col]) < String(val));
    return this;
  }
  maybeSingle() {
    const rows = this.materialize();
    return Promise.resolve({ data: rows[0] ?? null, error: null });
  }
  then(resolve: (v: { data: Row[]; error: null }) => void) {
    resolve({ data: this.materialize(), error: null });
  }
  private materialize(): Row[] {
    const matched = this.table.filter((r) => this.filters.every((f) => f(r)));
    if (this.updatePatch) {
      for (const r of matched) Object.assign(r, this.updatePatch);
    }
    // Join expansion for the two embed shapes the module selects.
    return matched.map((r) => {
      const out: Row = { ...r };
      if (this.selectCols?.includes('promo_codes')) {
        out.promo_codes = this.db.promoCodes.find((p) => p.id === r.promo_code_id) ?? null;
      }
      if (this.selectCols?.includes('bookings!inner')) {
        out.bookings = this.db.bookings.find((b) => b.id === r.booking_id) ?? null;
      }
      return out;
    });
  }
}

class FakeDb {
  grants: Row[] = [];
  redemptions: Row[] = [];
  bookings: Row[] = [];
  promoCodes: Row[] = [];

  from(table: string) {
    const t =
      table === 'coupon_grants'
        ? this.grants
        : table === 'coupon_redemptions'
          ? this.redemptions
          : table === 'bookings'
            ? this.bookings
            : this.promoCodes;
    return new FakeQuery(t, this);
  }
}

const FUTURE = new Date(Date.now() + 10 * 86400000).toISOString();
const PAST = new Date(Date.now() - 86400000).toISOString();
const OLD = new Date(Date.now() - 48 * 3600 * 1000).toISOString();

function seed(db: FakeDb, opts: { grantExpires?: string | null } = {}) {
  db.promoCodes.push({ id: 'pc1', code: 'WELCOME10' });
  db.grants.push({
    id: 'g1',
    promo_code_id: 'pc1',
    user_id: 'u1',
    status: 'locked',
    expires_at: opts.grantExpires === undefined ? FUTURE : opts.grantExpires,
    locked_booking_id: 'b1',
  });
  db.redemptions.push({
    id: 'r1',
    grant_id: 'g1',
    promo_code_id: 'pc1',
    user_id: 'u1',
    booking_id: 'b1',
    payment_intent_id: null,
    subtotal_minor: 12000,
    discount_minor: 1200,
    final_minor: 10800,
    currency: 'usd',
    status: 'pending',
    created_at: new Date().toISOString(),
  });
  db.bookings.push({ id: 'b1', status: 'pending', payment_status: 'pending' });
}

describe('redeemCouponForBooking', () => {
  it('captures the redemption and redeems the locked grant', async () => {
    const db = new FakeDb();
    seed(db);
    await redeemCouponForBooking(db as any, 'b1');
    expect(db.redemptions[0].status).toBe('captured');
    expect(db.redemptions[0].settled_at).toBeTruthy();
    expect(db.grants[0].status).toBe('redeemed');
    expect(db.grants[0].redeemed_at).toBeTruthy();
  });

  it('is idempotent — a second call is a no-op', async () => {
    const db = new FakeDb();
    seed(db);
    await redeemCouponForBooking(db as any, 'b1');
    const settledAt = db.redemptions[0].settled_at;
    await redeemCouponForBooking(db as any, 'b1');
    expect(db.redemptions[0].settled_at).toBe(settledAt);
    expect(db.grants[0].status).toBe('redeemed');
  });

  it('does nothing for a booking without a coupon', async () => {
    const db = new FakeDb();
    seed(db);
    await redeemCouponForBooking(db as any, 'b-other');
    expect(db.redemptions[0].status).toBe('pending');
    expect(db.grants[0].status).toBe('locked');
  });
});

describe('releaseCouponForBooking', () => {
  it('releases the redemption and restores the grant to active (inside validity)', async () => {
    const db = new FakeDb();
    seed(db);
    await releaseCouponForBooking(db as any, 'b1', 'test');
    expect(db.redemptions[0].status).toBe('released');
    expect(db.grants[0].status).toBe('active');
    expect(db.grants[0].locked_booking_id).toBeNull();
  });

  it('expires the grant instead when its validity window has passed', async () => {
    const db = new FakeDb();
    seed(db, { grantExpires: PAST });
    await releaseCouponForBooking(db as any, 'b1', 'test');
    expect(db.grants[0].status).toBe('expired');
  });

  it('never releases an already-redeemed coupon (capture wins)', async () => {
    const db = new FakeDb();
    seed(db);
    await redeemCouponForBooking(db as any, 'b1');
    await releaseCouponForBooking(db as any, 'b1', 'late-cancel');
    expect(db.redemptions[0].status).toBe('captured');
    expect(db.grants[0].status).toBe('redeemed');
  });
});

describe('attach / read helpers', () => {
  it('attachPaymentIntentToCouponRedemption stamps the PI id on the pending row', async () => {
    const db = new FakeDb();
    seed(db);
    await attachPaymentIntentToCouponRedemption(db as any, 'b1', 'pi_123');
    expect(db.redemptions[0].payment_intent_id).toBe('pi_123');
  });

  it('getPendingCouponRedemption returns the row with the joined code', async () => {
    const db = new FakeDb();
    seed(db);
    const red = await getPendingCouponRedemption(db as any, 'b1');
    expect(red?.code).toBe('WELCOME10');
    expect(red?.discount_minor).toBe(1200);
  });

  it('getPendingCouponRedemption returns null once settled', async () => {
    const db = new FakeDb();
    seed(db);
    await redeemCouponForBooking(db as any, 'b1');
    expect(await getPendingCouponRedemption(db as any, 'b1')).toBeNull();
  });
});

describe('sweepAbandonedCouponLocks', () => {
  it('releases coupons on >24h-old bookings still pending/pending', async () => {
    const db = new FakeDb();
    seed(db);
    db.redemptions[0].created_at = OLD;
    const summary = await sweepAbandonedCouponLocks(db as any);
    expect(summary.released).toBe(1);
    expect(db.redemptions[0].status).toBe('released');
    expect(db.grants[0].status).toBe('active');
  });

  it('does NOT sweep a confirmed >7-day booking waiting on the re-auth cron', async () => {
    const db = new FakeDb();
    seed(db);
    db.redemptions[0].created_at = OLD;
    db.bookings[0].status = 'confirmed'; // setup_intent succeeded, PI comes later
    const summary = await sweepAbandonedCouponLocks(db as any);
    expect(summary.released).toBe(0);
    expect(db.redemptions[0].status).toBe('pending');
    expect(db.grants[0].status).toBe('locked');
  });

  it('does not sweep fresh (<24h) pending bookings', async () => {
    const db = new FakeDb();
    seed(db);
    const summary = await sweepAbandonedCouponLocks(db as any);
    expect(summary.released).toBe(0);
    expect(db.redemptions[0].status).toBe('pending');
  });

  it('sweeps dead (cancelled) bookings regardless of payment fields', async () => {
    const db = new FakeDb();
    seed(db);
    db.redemptions[0].created_at = OLD;
    db.bookings[0].status = 'cancelled';
    db.bookings[0].payment_status = 'authorized';
    const summary = await sweepAbandonedCouponLocks(db as any);
    expect(summary.released).toBe(1);
    expect(db.grants[0].status).toBe('active');
  });

  it('restores orphaned locks (claimed, no booking attached, revert failed)', async () => {
    const db = new FakeDb();
    db.grants.push({
      id: 'g9',
      promo_code_id: 'pc1',
      user_id: 'u9',
      status: 'locked',
      expires_at: FUTURE,
      locked_booking_id: null,
      updated_at: OLD,
    });
    const summary = await sweepAbandonedCouponLocks(db as any);
    expect(summary.orphansRestored).toBe(1);
    expect(db.grants[0].status).toBe('active');
  });
});
