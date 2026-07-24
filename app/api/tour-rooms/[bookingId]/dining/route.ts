import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requestGate, clientIpKey } from '@/lib/durable-rate-limit';
import { resolveRoomActor } from '@/lib/tour-room/access';
import { humanizePoiKey } from '@/lib/tour-room/dayPlan';
import { isDietaryFilterTag } from '@/lib/ops/dining/dietary';
import { isMealStop, type MealKind } from '@/lib/ops/dining/mealStop';
import { diningPoiCoords, postDiningCard } from '@/lib/ops/dining/post.server';
import { recommendDining, recordShown } from '@/lib/ops/dining/recommend.server';

export const dynamic = 'force-dynamic';

/**
 * §5.7 R-2 trigger 3/4 — the dining card on request.
 *
 * POST /api/tour-rooms/[bookingId]/dining
 *   { poiKey?, spotTitle?, lat?, lng?, meal?, dietary?: string[], post?: boolean }
 *
 *   post: false (default) — a GUEST asking on demand. The card comes back in
 *     the response for inline rendering only; the room feed stays untouched so
 *     one hungry traveller does not spam everyone else. The exposure is still
 *     logged (R-6) because the ranking learns from it either way.
 *
 *   post: true — an OPERATOR one-tap (guide/driver/admin only). Inserts a
 *     `dining_card` system message, broadcasts it, claims the (room, cell, KST
 *     day) slot, and fans out to every booking of a shared tour date.
 *
 * 🔴 The rate limit matters more here than on most routes: a cache MISS costs
 * real Kakao + Google calls, so an unthrottled loop would burn a paid quota.
 * A `null` recommendation is a 200 with `card: null`, never an error — no card
 * is an acceptable outcome and must not surface as a failure to the guest.
 */

const MEALS: readonly MealKind[] = ['lunch', 'dinner', 'snack'];

function numberOrNull(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

/** Client-supplied filter chips → the known vocabulary only (max 8). */
function sanitizeDietary(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: string[] = [];
  for (const entry of value) {
    if (isDietaryFilterTag(entry) && !out.includes(entry)) out.push(entry);
    if (out.length >= 8) break;
  }
  return out;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  try {
    const { bookingId } = await params;
    const supabase = createServerClient();
    const body = (await req.json().catch(() => ({}))) as {
      poiKey?: unknown;
      poi_key?: unknown;
      spotTitle?: unknown;
      lat?: unknown;
      lng?: unknown;
      meal?: unknown;
      dietary?: unknown;
      post?: unknown;
      token?: unknown;
    };

    const rawKey = typeof body.poiKey === 'string' ? body.poiKey : body.poi_key;
    const poiKey = typeof rawKey === 'string' && rawKey.trim() ? rawKey.trim().slice(0, 120) : null;

    // B — guide/driver consoles drive this with an invite token (no per-room
    // session header), same as the concierge route.
    const resolved = await resolveRoomActor(req, bookingId, {
      supabase,
      token: typeof body.token === 'string' ? body.token : null,
    });
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const { booking, actor, authUserId } = resolved;
    const actorParticipantId = actor.kind === 'session' ? actor.sessionPayload.participantId : null;
    const isOperator = actor.role === 'guide' || actor.role === 'driver' || actor.role === 'admin';

    const post = body.post === true;
    if (post && !isOperator) {
      return NextResponse.json({ error: 'Guide, driver, or admin only' }, { status: 403 });
    }

    // Per-participant AND per-room gates — a MISS costs external API calls.
    const gateKey = actorParticipantId ? `participant:${actorParticipantId}` : clientIpKey(req.headers);
    const [participantGate, roomGate] = await Promise.all([
      requestGate({ namespace: 'tour_room_dining', key: gateKey, perMinute: 3, perHour: 20 }),
      requestGate({ namespace: 'tour_room_dining_room', key: `booking:${booking.id}`, perMinute: 6, perHour: 40 }),
    ]);
    if (!participantGate.allowed || !roomGate.allowed) {
      const retryAfterMs = Math.max(participantGate.retryAfterMs ?? 0, roomGate.retryAfterMs ?? 0);
      return NextResponse.json(
        { error: 'rate_limited' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } },
      );
    }

    // Coordinates: explicit → match_pois for the poi_key → 400.
    const bodyLat = numberOrNull(body.lat);
    const bodyLng = numberOrNull(body.lng);
    const explicit =
      bodyLat !== null && bodyLng !== null && Math.abs(bodyLat) <= 90 && Math.abs(bodyLng) <= 180
        ? { lat: bodyLat, lng: bodyLng }
        : null;
    const coords = explicit ?? (await diningPoiCoords(supabase, poiKey));
    if (!coords) {
      return NextResponse.json({ error: 'lat/lng or a known poiKey is required' }, { status: 400 });
    }

    const spotTitle =
      (typeof body.spotTitle === 'string' && body.spotTitle.trim().slice(0, 120)) ||
      (poiKey ? humanizePoiKey(poiKey) : '');

    // Meal: an explicit value wins; otherwise the stop/KST clock decides.
    const nowMs = Date.now();
    const meal = MEALS.includes(body.meal as MealKind)
      ? (body.meal as MealKind)
      : isMealStop({ poi_key: poiKey, title: spotTitle }, nowMs).meal;

    const dietary = sanitizeDietary(body.dietary);

    if (post) {
      const result = await postDiningCard(supabase, {
        booking,
        poiKey,
        spotTitle,
        lat: coords.lat,
        lng: coords.lng,
        meal,
        dietary,
        actorRole: actor.role,
        actorParticipantId,
        authUserId,
        nowMs,
      });
      if (!result.posted) {
        return NextResponse.json({ card: result.meta, posted: false, skipped: result.skipped ?? null }, { status: 200 });
      }
      return NextResponse.json(
        { card: result.meta, posted: true, delivered: result.delivered, message: result.message },
        { status: 201 },
      );
    }

    const built = await recommendDining(supabase, {
      bookingId: booking.id,
      poiKey,
      spotTitle,
      lat: coords.lat,
      lng: coords.lng,
      meal,
      dietary,
      nowMs,
      triggeredByRole: actor.role,
    });
    if (!built) return NextResponse.json({ card: null }, { status: 200 });

    // Inline answers are exposures too — the ranking's feedback loop only works
    // if every shown place has a row to hang tapped_at/visited_at on (R-6).
    await recordShown(supabase, built.shown, { participantId: actorParticipantId });

    return NextResponse.json({ card: built.meta, posted: false }, { status: 200 });
  } catch (error) {
    console.error('POST /api/tour-rooms/[bookingId]/dining error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
