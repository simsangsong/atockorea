/**
 * Single authorization gate for Tour Mode room APIs (§B D-2, ticket T0.5).
 *
 * The three kursoflow-ported routes (messages / events / spot-events) each
 * carried their own copy of booking lookup + role judgement + guest email
 * matching. This module unifies them (T0.8 swaps the routes onto it,
 * behaviour-preserving) and adds the two new authentication paths:
 *
 *   - signed invite tokens (lib/tour-room/token.ts), checked against the
 *     tour_room_invites revocation ledger, and
 *   - short-lived room-session signatures issued by the join API and sent as
 *     the `x-tour-room-auth` header on subsequent requests.
 *
 * Server authorization priority (§B D-2):
 *   admin > valid invite token > room session > booking owner
 *         > merchant guide > guest email match.
 *
 * The guest path stays rate-limited (PA-4): callers pass `guestGate`, which is
 * invoked only when no stronger credential authenticated the request — same
 * ordering as the pre-refactor routes.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import {
  hashToken,
  verifyRoomToken,
  type RoomTokenPayload,
} from '@/lib/tour-room/token';

/** Superset of the booking columns the three room routes selected. */
export const ROOM_BOOKING_COLUMNS =
  'id, user_id, tour_id, merchant_id, tour_date, contact_name, contact_email, contact_phone, preferred_language';

export interface RoomBooking {
  id: string;
  user_id: string | null;
  tour_id: string | null;
  merchant_id: string | null;
  tour_date: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  preferred_language: string | null;
}

export interface TourRoom {
  id: string;
  booking_id: string;
  tour_id: string | null;
  tour_date: string | null;
  status: string;
  [key: string]: unknown;
}

/**
 * Minimal shape of the Supabase client this module needs — keeps unit tests
 * free of the real client while routes pass createServerClient() directly.
 * The builder return type is deliberately `any`: SupabaseClient's generic
 * query builders don't structurally match a narrowed interface. Runtime usage
 * here is limited to select/eq/single/maybeSingle and upsert/select/single.
 */
export interface RoomDbClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
}

export type RoomActor =
  | { kind: 'admin'; role: 'admin'; userId: string }
  | { kind: 'token'; role: 'customer' | 'guide'; tokenPayload: RoomTokenPayload; displayName: string }
  | {
      kind: 'session';
      role: 'customer' | 'guide' | 'admin';
      sessionPayload: RoomSessionPayload;
      displayName: string;
    }
  | { kind: 'owner'; role: 'customer'; userId: string }
  | { kind: 'merchant-guide'; role: 'guide'; userId: string; merchantId: string }
  | { kind: 'guest'; role: 'customer' };

export type ResolveRoomActorResult =
  | {
      ok: true;
      booking: RoomBooking;
      actor: RoomActor;
      /** Supabase auth user id when the request carried a login session (any path). */
      authUserId: string | null;
    }
  | { ok: false; status: number; error: string; retryAfterMs?: number };

export interface ResolveRoomActorOptions {
  supabase: RoomDbClient;
  /**
   * Invite token, when the caller already extracted one (e.g. from a JSON
   * body). The `rt` query param and `x-tour-room-token` header are always
   * checked as well.
   */
  token?: string | null;
  /** Guest email/name credentials extracted from body or query by the caller. */
  guestEmail?: string | null;
  guestName?: string | null;
  /**
   * PA-4 rate-limit gate, invoked only when the request reaches the
   * unauthenticated guest path. Return allowed=false to answer 429.
   */
  guestGate?: () => Promise<{ allowed: boolean; retryAfterMs: number }>;
}

function normalized(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

export async function getBookingForRoom(
  supabase: RoomDbClient,
  bookingId: string,
): Promise<RoomBooking | null> {
  const { data, error } = await supabase
    .from('bookings')
    .select(ROOM_BOOKING_COLUMNS)
    .eq('id', bookingId)
    .single();
  if (error || !data) return null;
  return data as RoomBooking;
}

export async function ensureRoom(
  supabase: RoomDbClient,
  booking: { id: string; tour_id?: string | null; tour_date?: string | null },
): Promise<TourRoom> {
  const { data, error } = await supabase
    .from('tour_rooms')
    .upsert(
      {
        booking_id: booking.id,
        tour_id: booking.tour_id ?? null,
        tour_date: booking.tour_date ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'booking_id' },
    )
    .select()
    .single();
  if (error) throw error;
  return data as TourRoom;
}

export function isMerchantGuideForBooking(
  user: Awaited<ReturnType<typeof getAuthUser>>,
  booking: { merchant_id?: string | null },
): boolean {
  return Boolean(user?.role === 'merchant' && user.merchantId && booking.merchant_id === user.merchantId);
}

export function matchesGuestCredentials(
  booking: Pick<RoomBooking, 'contact_email' | 'contact_name'>,
  guestEmail: string | null | undefined,
  guestName?: string | null,
): boolean {
  if (!normalized(guestEmail)) return false;
  return (
    normalized(booking.contact_email) === normalized(guestEmail) &&
    (!guestName || normalized(booking.contact_name) === normalized(guestName))
  );
}

/** Does a verified token grant access to THIS booking? (scope check, §O-3) */
export function tokenMatchesBooking(payload: RoomTokenPayload, booking: RoomBooking): boolean {
  if (payload.scope === 'booking') return payload.bookingId === booking.id;
  return (
    Boolean(booking.tour_id) &&
    payload.tourId === booking.tour_id &&
    Boolean(booking.tour_date) &&
    payload.tourDate === booking.tour_date
  );
}

async function isTokenRevoked(supabase: RoomDbClient, token: string): Promise<boolean> {
  const { data } = await supabase
    .from('tour_room_invites')
    .select('id, revoked_at')
    .eq('token_hash', hashToken(token))
    .maybeSingle();
  // Unknown tokens are fine (only we can sign them); a ledger row with
  // revoked_at set means dispatch explicitly killed this link (§O-1 ⑧).
  return Boolean((data as { revoked_at?: string | null } | null)?.revoked_at);
}

function extractToken(req: NextRequest, explicit?: string | null): string | null {
  if (explicit) return explicit;
  const fromQuery = req.nextUrl?.searchParams?.get('rt');
  if (fromQuery) return fromQuery;
  return req.headers.get('x-tour-room-auth-token') ?? req.headers.get('x-tour-room-token');
}

/**
 * Resolve who is knocking on a room and whether they may enter.
 * See module doc for the priority order.
 */
export async function resolveRoomActor(
  req: NextRequest,
  bookingId: string,
  options: ResolveRoomActorOptions,
): Promise<ResolveRoomActorResult> {
  const { supabase } = options;
  const booking = await getBookingForRoom(supabase, bookingId);
  if (!booking) return { ok: false, status: 404, error: 'Booking not found' };

  const user = await getAuthUser(req);
  const authUserId = user?.id ?? null;

  // 1. Admin.
  if (user?.role === 'admin') {
    return { ok: true, booking, actor: { kind: 'admin', role: 'admin', userId: user.id }, authUserId };
  }

  // 2. Signed invite token (scope + revocation checked).
  const token = extractToken(req, options.token);
  if (token) {
    const payload = verifyRoomToken(token);
    if (payload && tokenMatchesBooking(payload, booking) && !(await isTokenRevoked(supabase, token))) {
      return {
        ok: true,
        booking,
        actor: { kind: 'token', role: payload.role, tokenPayload: payload, displayName: payload.displayName },
        authUserId,
      };
    }
    // An invalid/revoked/mismatched token falls through — weaker credentials
    // (login, guest match) may still legitimately authenticate the request.
  }

  // 3. Room session issued by the join API. EventSource (SSE fallback) cannot
  // set headers, so the signed session is also accepted as the `rs` query
  // param — short-lived, same-origin, never shown in the address bar.
  const sessionHeader = req.headers.get('x-tour-room-auth') ?? req.nextUrl?.searchParams?.get('rs');
  if (sessionHeader) {
    const session = verifyRoomSession(sessionHeader);
    if (session && session.bookingId === booking.id) {
      return {
        ok: true,
        booking,
        actor: { kind: 'session', role: session.role, sessionPayload: session, displayName: session.displayName },
        authUserId,
      };
    }
  }

  // 4. Logged-in booking owner.
  if (user?.id && user.id === booking.user_id) {
    return { ok: true, booking, actor: { kind: 'owner', role: 'customer', userId: user.id }, authUserId };
  }

  // 5. Merchant guide (merchant account owning this booking).
  if (isMerchantGuideForBooking(user, booking)) {
    return {
      ok: true,
      booking,
      actor: { kind: 'merchant-guide', role: 'guide', userId: user!.id, merchantId: user!.merchantId! },
      authUserId,
    };
  }

  // 6. Guest email match — rate-limited first (PA-4).
  if (options.guestGate) {
    const gate = await options.guestGate();
    if (!gate.allowed) {
      return { ok: false, status: 429, error: 'rate_limited', retryAfterMs: gate.retryAfterMs };
    }
  }
  if (matchesGuestCredentials(booking, options.guestEmail, options.guestName)) {
    return { ok: true, booking, actor: { kind: 'guest', role: 'customer' }, authUserId };
  }

  return { ok: false, status: 403, error: 'Access denied for this tour room' };
}

// ---------------------------------------------------------------------------
// Room sessions — issued by POST /join after any successful authentication,
// so follow-up requests don't re-run token/guest checks (§D join API).
// ---------------------------------------------------------------------------

const ROOM_SESSION_TTL_SECONDS = 12 * 60 * 60;

export interface RoomSessionPayload {
  v: 1;
  roomId: string;
  bookingId: string;
  participantId: string;
  role: 'customer' | 'guide' | 'admin';
  displayName: string;
  iat: number;
  exp: number;
}

function sessionSecret(): string {
  return (
    process.env.TOUR_ROOM_TOKEN_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'atoc-tour-room-dev-secret'
  );
}

function signSessionBody(body: string): string {
  return createHmac('sha256', sessionSecret()).update(`room-session:${body}`).digest('hex');
}

export function signRoomSession(
  input: Omit<RoomSessionPayload, 'v' | 'iat' | 'exp'>,
  ttlSeconds = ROOM_SESSION_TTL_SECONDS,
): { session: string; payload: RoomSessionPayload } {
  const iat = Math.floor(Date.now() / 1000);
  const payload: RoomSessionPayload = { v: 1, ...input, iat, exp: iat + ttlSeconds };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return { session: `${body}.${signSessionBody(body)}`, payload };
}

export function verifyRoomSession(session: unknown): RoomSessionPayload | null {
  if (typeof session !== 'string' || !session.includes('.')) return null;
  const dot = session.lastIndexOf('.');
  const body = session.slice(0, dot);
  const sig = session.slice(dot + 1);
  if (!body || !sig) return null;

  const expected = signSessionBody(body);
  try {
    const a = Buffer.from(sig, 'hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  let payload: RoomSessionPayload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (payload?.v !== 1) return null;
  if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null;
  if (!payload.roomId || !payload.bookingId || !payload.participantId) return null;
  if (!['customer', 'guide', 'admin'].includes(payload.role)) return null;
  return payload;
}
