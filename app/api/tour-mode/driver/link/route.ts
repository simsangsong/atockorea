import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getAuthUser } from '@/lib/auth';
import { hashToken, signDriverRoomToken, verifyRoomToken } from '@/lib/tour-room/token';

export const dynamic = 'force-dynamic';

/**
 * W3 (P-D15) — mint a driver link for one tour day.
 *
 * POST /api/tour-mode/driver/link  { tourId, tourDate, displayName? }
 * Auth: admin login, or a GUIDE tour-date token for the same (tourId,
 * tourDate) — the guide forwarding the day's driver link (KakaoTalk etc.)
 * is the expected operational path; driver-only tours use the admin path.
 *
 * The token is recorded in tour_room_invites (role 'driver', sha256 hash)
 * so dispatch-side revocation applies to driver links too.
 */

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const body = await req.json().catch(() => ({}));
    const tourId = String(body.tourId || '');
    const tourDate = String(body.tourDate || '');
    if (!tourId || !/^\d{4}-\d{2}-\d{2}$/.test(tourDate)) {
      return NextResponse.json({ error: 'tourId and tourDate (YYYY-MM-DD) are required' }, { status: 400 });
    }

    const user = await getAuthUser(req);
    let authorized = user?.role === 'admin';
    if (!authorized) {
      const token =
        (typeof body.token === 'string' ? body.token : null) ??
        req.nextUrl.searchParams.get('rt') ??
        req.headers.get('x-tour-room-token');
      const payload = token ? verifyRoomToken(token) : null;
      authorized =
        payload?.scope === 'tour-date' &&
        payload.role === 'guide' &&
        payload.tourId === tourId &&
        payload.tourDate === tourDate;
    }
    if (!authorized) {
      return NextResponse.json(
        { error: 'Admin login or a guide tour-date token for this tour day is required' },
        { status: 403 },
      );
    }

    const displayName = String(body.displayName || '').trim().slice(0, 80) || '기사님';
    const { token: driverToken, payload } = signDriverRoomToken({ tourId, tourDate, displayName });

    // Ledger row — revocation + audit, same as customer/guide invites.
    await supabase.from('tour_room_invites').insert({
      tour_id: tourId,
      tour_date: tourDate,
      role: 'driver',
      token_hash: hashToken(driverToken),
      display_name: displayName,
      sent_via: 'manual',
      expires_at: new Date(payload.exp * 1000).toISOString(),
      created_by: user?.id ?? null,
    });

    const origin = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
    return NextResponse.json(
      { url: `${origin}/tour-mode/driver?rt=${encodeURIComponent(driverToken)}`, expires_at: payload.exp },
      { status: 201 },
    );
  } catch (error) {
    console.error('POST /api/tour-mode/driver/link error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
