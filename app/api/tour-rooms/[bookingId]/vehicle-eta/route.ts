import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requestGate } from '@/lib/durable-rate-limit';
import { ensureRoom, resolveRoomActor } from '@/lib/tour-room/access';
import { syntheticLeg } from '@/lib/tour-room/eta';
import { pickVehicleLocation, VEHICLE_ROLES, type VehicleLocationLike } from '@/lib/tour-room/vehicleEta';

export const dynamic = 'force-dynamic';

/**
 * §11.C C3 — GET /api/tour-rooms/[bookingId]/vehicle-eta
 *
 * "How long until the van gets here?" for whoever is in the room (guest
 * session, invite token, guide, admin). The customer card already computes a
 * synthetic ETA locally with zero network; this route is the OPTIONAL upgrade
 * that swaps in a real road estimate when a routing key is configured.
 *
 *   ?toLat=&toLng=   destination (defaults to the booking's pickup point)
 *   → { vehicle: {latitude, longitude, role, recorded_at} | null,
 *       eta:     {minutes, distanceM, source: 'kakao'|'synthetic'} | null }
 *
 * Ladder: ① Kakao Mobility directions (only with KAKAO_REST_API_KEY, hard 2.5s
 * abort, every failure silently null) ② the shared synthetic model. Nothing
 * here is load-bearing — no vehicle, no destination, or a dead routing API all
 * degrade to a 200 with nulls rather than an error the guest would see.
 */

/** Reads within a minute of each other are pointless — the card polls at 60s. */
const RATE_PER_MINUTE = 20;
const RATE_PER_HOUR = 300;
/** A driving guest UI must never hang on a third-party router. */
const KAKAO_TIMEOUT_MS = 2_500;

interface CoordPair {
  lat: number;
  lng: number;
}

function parseCoord(raw: string | null, limit: number): number | null {
  if (raw === null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || Math.abs(value) > limit) return null;
  return value;
}

/**
 * Kakao Mobility car directions. Returns null on missing key, timeout,
 * non-200, unparseable body, or a route without a summary — the caller then
 * falls through to the synthetic estimate.
 */
async function kakaoEta(from: CoordPair, to: CoordPair): Promise<{ minutes: number; distanceM: number } | null> {
  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), KAKAO_TIMEOUT_MS);
  try {
    const url =
      'https://apis-navi.kakaomobility.com/v1/directions' +
      `?origin=${from.lng},${from.lat}&destination=${to.lng},${to.lat}&priority=RECOMMEND`;
    const res = await fetch(url, {
      headers: { Authorization: `KakaoAK ${key}` },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      routes?: Array<{ summary?: { duration?: unknown; distance?: unknown } }>;
    };
    const summary = data?.routes?.[0]?.summary;
    const durationS = Number(summary?.duration);
    const distanceM = Number(summary?.distance);
    if (!Number.isFinite(durationS) || !Number.isFinite(distanceM) || durationS <= 0) return null;
    return { minutes: Math.max(1, Math.round(durationS / 60)), distanceM: Math.round(distanceM) };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** The booking's own pickup point — the default destination for C3. */
async function pickupDestination(
  supabase: ReturnType<typeof createServerClient>,
  bookingId: string,
): Promise<CoordPair | null> {
  try {
    const { data } = await supabase
      .from('bookings')
      .select('pickup_points ( lat, lng )')
      .eq('id', bookingId)
      .maybeSingle();
    const raw = (data as { pickup_points?: unknown } | null)?.pickup_points;
    const point = (Array.isArray(raw) ? raw[0] : raw) as { lat?: unknown; lng?: unknown } | null;
    const lat = typeof point?.lat === 'number' ? point.lat : null;
    const lng = typeof point?.lng === 'number' ? point.lng : null;
    if (lat === null || lng === null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  try {
    const { bookingId } = await params;
    const supabase = createServerClient();

    const resolved = await resolveRoomActor(req, bookingId, { supabase });
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const { booking } = resolved;

    const gate = await requestGate({
      namespace: 'tour_room_vehicle_eta',
      key: `booking:${booking.id}`,
      perMinute: RATE_PER_MINUTE,
      perHour: RATE_PER_HOUR,
    });
    if (!gate.allowed) {
      return NextResponse.json(
        { error: 'rate_limited' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((gate.retryAfterMs ?? 0) / 1000)) } },
      );
    }

    // Explicit destination wins; a partial/malformed pair is a client bug, not
    // something to silently reinterpret as the pickup point.
    const search = req.nextUrl?.searchParams;
    const toLatRaw = search?.get('toLat') ?? null;
    const toLngRaw = search?.get('toLng') ?? null;
    let destination: CoordPair | null = null;
    if (toLatRaw !== null || toLngRaw !== null) {
      const lat = parseCoord(toLatRaw, 90);
      const lng = parseCoord(toLngRaw, 180);
      if (lat === null || lng === null) {
        return NextResponse.json({ error: 'toLat/toLng must be valid coordinates' }, { status: 400 });
      }
      destination = { lat, lng };
    }

    const room = await ensureRoom(supabase, booking);
    const { data: locationRows } = await supabase
      .from('tour_room_locations')
      .select('participant_id, role, latitude, longitude, recorded_at')
      .eq('room_id', room.id)
      .in('role', VEHICLE_ROLES as unknown as string[]);

    const vehicle = pickVehicleLocation((locationRows ?? []) as VehicleLocationLike[]);
    if (!vehicle) {
      return NextResponse.json({ vehicle: null, eta: null });
    }

    if (!destination) destination = await pickupDestination(supabase, booking.id);

    const origin: CoordPair = { lat: vehicle.latitude, lng: vehicle.longitude };
    let eta: { minutes: number; distanceM: number; source: 'kakao' | 'synthetic' } | null = null;
    if (destination) {
      const measured = await kakaoEta(origin, destination);
      if (measured) {
        eta = { ...measured, source: 'kakao' };
      } else {
        const leg = syntheticLeg(origin, destination);
        eta = { minutes: leg.minutes, distanceM: leg.distanceM, source: 'synthetic' };
      }
    }

    return NextResponse.json({
      vehicle: {
        latitude: vehicle.latitude,
        longitude: vehicle.longitude,
        role: vehicle.role ?? null,
        recorded_at: vehicle.recorded_at ?? null,
      },
      eta,
    });
  } catch (error) {
    console.error('GET /api/tour-rooms/[bookingId]/vehicle-eta error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
