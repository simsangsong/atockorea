import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getAuthUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/mypage/coupons — the signed-in user's coupon grants (§7).
 *
 * Joins `coupon_grants` with the `promo_codes` definition and derives display
 * fields (daysLeft / isExpiringSoon). Grants whose `expires_at` has passed but
 * whose row still says `active` are lazily flipped to `expired` here so the
 * list (and the claim path, which checks expires_at anyway) stay consistent.
 *
 * Ordering (§7.2): active → locked → redeemed → expired/revoked, soonest
 * expiry first within a group.
 */

const STATUS_ORDER: Record<string, number> = {
  active: 0,
  locked: 1,
  redeemed: 2,
  expired: 3,
  revoked: 4,
};

const EXPIRING_SOON_DAYS = 3;

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req, { skipRoleLookup: true });
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const supabase = createServerClient();
    const nowMs = Date.now();

    // Lazy expiry sweep for this user (cheap, idempotent).
    await supabase
      .from('coupon_grants')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('status', 'active')
      .lt('expires_at', new Date().toISOString());

    const { data: grants, error } = await supabase
      .from('coupon_grants')
      .select(
        `
        id, status, expires_at, granted_at, redeemed_at,
        promo_codes (
          code, description, discount_type, discount_value,
          max_discount_amount, min_purchase_amount, first_purchase_only
        )
      `,
      )
      .eq('user_id', user.id);

    if (error) {
      console.error('[mypage/coupons] query failed:', error);
      return NextResponse.json({ error: 'Failed to load coupons' }, { status: 500 });
    }

    const coupons = (grants ?? [])
      .map((g) => {
        const code = Array.isArray(g.promo_codes) ? g.promo_codes[0] : g.promo_codes;
        // `revoked` grants are hidden entirely (§7.2).
        if (!code || g.status === 'revoked') return null;
        const expiresMs = g.expires_at ? new Date(g.expires_at).getTime() : null;
        const daysLeft =
          expiresMs != null ? Math.max(0, Math.ceil((expiresMs - nowMs) / 86400000)) : null;
        return {
          id: g.id,
          status: g.status,
          code: code.code,
          description: code.description ?? null,
          discountType: code.discount_type,
          discountValue: Number(code.discount_value),
          firstPurchaseOnly: !!code.first_purchase_only,
          grantedAt: g.granted_at,
          redeemedAt: g.redeemed_at,
          expiresAt: g.expires_at,
          daysLeft,
          isExpiringSoon:
            g.status === 'active' && daysLeft != null && daysLeft <= EXPIRING_SOON_DAYS,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .sort((a, b) => {
        const byStatus = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
        if (byStatus !== 0) return byStatus;
        const ax = a.expiresAt ? new Date(a.expiresAt).getTime() : Number.MAX_SAFE_INTEGER;
        const bx = b.expiresAt ? new Date(b.expiresAt).getTime() : Number.MAX_SAFE_INTEGER;
        return ax - bx;
      });

    return NextResponse.json(
      { coupons },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (err) {
    console.error('[mypage/coupons] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
