/**
 * Live smoke test for the welcome-coupon grant lifecycle against the real
 * Supabase project (service role). Creates ONLY synthetic rows (its own promo
 * code + auth user + bookings) and removes them in a finally block — it never
 * touches WELCOME10 or real customers.
 *
 * Usage:  npx tsx scripts/coupon-live-smoke.ts
 * Env:    NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *         (falls back to reading ../.env.local relative to repo root)
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  claimCouponForBooking,
  attachCouponClaimToBooking,
  revertCouponClaim,
} from '../lib/coupons/grants';
import {
  getPendingCouponRedemption,
  redeemCouponForBooking,
  releaseCouponForBooking,
} from '../lib/coupons/settlement';

// @ts-expect-error import.meta.url under tsx
const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  for (const candidate of [
    join(__dirname, '..', '.env.local'),
    join(__dirname, '..', '..', '..', '..', '.env.local'), // worktree → main repo
  ]) {
    if (!existsSync(candidate)) continue;
    for (const line of readFileSync(candidate, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^"|"$/g, '');
    }
  }
}

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    console.log(`  ✅ ${name}`);
  } else {
    failures += 1;
    console.error(`  ❌ ${name}`, detail ?? '');
  }
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  const supabase = createClient(url, key, { auth: { persistSession: false } }) as any;

  const stamp = Date.now().toString(36);
  const smokeCode = `SMOKE_${stamp}`.toUpperCase();
  const email = `coupon-smoke-${stamp}@example.com`;

  let promoCodeId: string | null = null;
  let userId: string | null = null;
  const bookingIds: string[] = [];

  try {
    /* ── setup ─────────────────────────────────────────────────────────── */
    const { data: pc, error: pcErr } = await supabase
      .from('promo_codes')
      .insert({
        code: smokeCode,
        description: 'coupon-live-smoke (safe to delete)',
        discount_type: 'percentage',
        discount_value: 10,
        is_active: true,
        requires_login: true,
        first_purchase_only: true,
        usage_limit_per_user: 1,
        auto_grant_on_email_confirm: false, // never auto-granted to real signups
        grant_validity_days: 30,
      })
      .select('id')
      .single();
    if (pcErr) throw pcErr;
    promoCodeId = pc.id;

    const { data: created, error: userErr } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (userErr) throw userErr;
    userId = created.user.id;

    async function grantFresh() {
      await supabase.from('coupon_grants').delete().eq('user_id', userId);
      const { error } = await supabase.from('coupon_grants').insert({
        promo_code_id: promoCodeId,
        user_id: userId,
        status: 'active',
        expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
      });
      if (error) throw error;
    }
    async function grantStatus() {
      const { data } = await supabase
        .from('coupon_grants')
        .select('status, locked_booking_id')
        .eq('user_id', userId)
        .single();
      return data;
    }
    async function insertBooking(finalPrice: number) {
      const { data, error } = await supabase
        .from('bookings')
        .insert({
          user_id: userId,
          tour_date: '2026-12-01',
          number_of_guests: 2,
          unit_price: 60,
          total_price: 120,
          final_price: finalPrice,
          status: 'pending',
          payment_status: 'pending',
          contact_email: email,
        })
        .select('id')
        .single();
      if (error) throw error;
      bookingIds.push(data.id);
      return data.id as string;
    }

    /* ── 1. claim + double-claim race ──────────────────────────────────── */
    console.log('\n[1] claim + atomic double-use block');
    await grantFresh();
    const claim = await claimCouponForBooking(supabase, {
      userId: userId!,
      currency: 'usd',
      subtotalMajor: 120,
    });
    check('claim returns 10% breakdown (12 off 120 → 108)',
      !!claim && claim.breakdown.discountMajor === 12 && claim.breakdown.finalMajor === 108, claim);
    check('grant is locked', (await grantStatus())?.status === 'locked');
    const secondClaim = await claimCouponForBooking(supabase, {
      userId: userId!,
      currency: 'usd',
      subtotalMajor: 120,
    });
    check('second concurrent claim is refused', secondClaim === null, secondClaim);

    /* ── 2. attach → redemption ledger + joined-code read ──────────────── */
    console.log('\n[2] attach + ledger read (embed join)');
    const booking1 = await insertBooking(108);
    const attached = await attachCouponClaimToBooking(supabase, claim!, {
      bookingId: booking1,
      userId: userId!,
    });
    check('attach succeeds', attached === true);
    const pending = await getPendingCouponRedemption(supabase, booking1);
    check('pending redemption readable with joined code',
      pending?.code === smokeCode && pending?.discount_minor === 1200, pending);
    check('grant points at booking', (await grantStatus())?.locked_booking_id === booking1);

    /* ── 3. capture → redeem (and late release is a no-op) ─────────────── */
    console.log('\n[3] redeem on capture');
    await redeemCouponForBooking(supabase, booking1);
    check('grant redeemed', (await grantStatus())?.status === 'redeemed');
    await releaseCouponForBooking(supabase, booking1, 'late-cancel-after-capture');
    check('late release cannot un-redeem', (await grantStatus())?.status === 'redeemed');
    check('redemption no longer pending', (await getPendingCouponRedemption(supabase, booking1)) === null);

    /* ── 4. first_purchase_only blocks the next claim ──────────────────── */
    console.log('\n[4] first-purchase rule');
    await supabase.from('bookings').update({ payment_status: 'paid' }).eq('id', booking1);
    await supabase.from('coupon_redemptions').delete().eq('booking_id', booking1);
    await grantFresh();
    const blockedClaim = await claimCouponForBooking(supabase, {
      userId: userId!,
      currency: 'usd',
      subtotalMajor: 120,
    });
    check('claim refused once a paid booking exists', blockedClaim === null, blockedClaim);
    await supabase.from('bookings').update({ payment_status: 'pending' }).eq('id', booking1);

    /* ── 5. release restores the grant ─────────────────────────────────── */
    console.log('\n[5] cancel → release → grant restored');
    await grantFresh();
    const claim2 = await claimCouponForBooking(supabase, {
      userId: userId!,
      currency: 'usd',
      subtotalMajor: 250,
    });
    check('claim 2 returns 25 off 250', claim2?.breakdown.discountMajor === 25, claim2);
    const booking2 = await insertBooking(225);
    await attachCouponClaimToBooking(supabase, claim2!, { bookingId: booking2, userId: userId! });
    await releaseCouponForBooking(supabase, booking2, 'smoke-cancel');
    const g5 = await grantStatus();
    check('grant restored to active with no booking', g5?.status === 'active' && g5?.locked_booking_id === null, g5);

    /* ── 6. revert (booking insert failed) ─────────────────────────────── */
    console.log('\n[6] revert claim');
    const claim3 = await claimCouponForBooking(supabase, {
      userId: userId!,
      currency: 'usd',
      subtotalMajor: 99,
    });
    check('claim 3 succeeds after restore', !!claim3, claim3);
    await revertCouponClaim(supabase, claim3!.grantId);
    check('revert restores active', (await grantStatus())?.status === 'active');

    /* ── 7. KRW rounding path ──────────────────────────────────────────── */
    console.log('\n[7] KRW claim');
    const claimKrw = await claimCouponForBooking(supabase, {
      userId: userId!,
      currency: 'krw',
      subtotalMajor: 735000,
    });
    check('KRW claim: ₩73,500 off ₩735,000 (whole won)',
      claimKrw?.breakdown.discountMajor === 73500 && claimKrw?.breakdown.discountMinor === 73500, claimKrw);
    await revertCouponClaim(supabase, claimKrw!.grantId);
  } finally {
    /* ── cleanup (order respects FKs) ──────────────────────────────────── */
    console.log('\n[cleanup]');
    if (userId) {
      await supabase.from('coupon_redemptions').delete().eq('user_id', userId);
      await supabase.from('coupon_grants').delete().eq('user_id', userId);
      for (const id of bookingIds) await supabase.from('bookings').delete().eq('id', id);
      await supabase.from('user_profiles').delete().eq('id', userId);
      await supabase.auth.admin.deleteUser(userId);
    }
    if (promoCodeId) await supabase.from('promo_codes').delete().eq('id', promoCodeId);
    console.log('  cleanup done');
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log('\nAll live smoke checks passed ✅');
}

main().catch((err) => {
  console.error('coupon-live-smoke crashed:', err);
  process.exit(1);
});
