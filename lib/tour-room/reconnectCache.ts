/**
 * K1a — the reconnect tax.
 *
 * The SSE fallback is not a long-lived process. The platform kills the function
 * at its duration limit and `EventSource` reconnects automatically, so the real
 * shape of the fallback is a **reconnect cycle**, and every turn of it re-runs
 * the whole authorisation path before the first poll: booking lookup, auth user,
 * token-revocation check, room lookup. Part M put it plainly — the cost per
 * guest is not "one query every 2s", it is "one query every 2s PLUS a full set
 * of auth queries per function lifetime".
 *
 * Two of those four are not credential-specific at all. The booking row and the
 * room row are the same for every caller, so they can be memoised per instance
 * for a few seconds without weakening anything: they are still only *returned*
 * after the caller's credentials pass, and nothing here decides who may see
 * them.
 *
 * 🔴 What is deliberately NOT cached: `getAuthUser` and the token-revocation
 * check. Those are the parts that answer "may this request proceed", and a
 * revoked invite link has to stop working the moment it is revoked — that is the
 * whole point of the revocation ledger. Caching an authorisation decision to
 * save a query would trade a leaked link for a round trip.
 *
 * Scope: serverless instances are reused across requests, so a short TTL is
 * enough to absorb a reconnect storm from one room without holding data long
 * enough to serve a stale tour date to a new visitor.
 */
import {
  ensureRoom,
  getBookingForRoom,
  type RoomBooking,
  type RoomDbClient,
  type TourRoom,
} from '@/lib/tour-room/access';

/** Short enough that an ops date change lands within seconds. */
export const RECONNECT_CACHE_TTL_MS = 15_000;
/** A bound so a busy instance cannot grow this without limit. */
const MAX_ENTRIES = 200;

interface Entry<T> {
  value: T;
  expiresAt: number;
}

const bookings = new Map<string, Entry<RoomBooking>>();
const rooms = new Map<string, Entry<TourRoom>>();

function read<T>(store: Map<string, Entry<T>>, key: string, now: number): T | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= now) {
    store.delete(key);
    return null;
  }
  return hit.value;
}

function write<T>(store: Map<string, Entry<T>>, key: string, value: T, now: number): void {
  if (store.size >= MAX_ENTRIES) {
    // Insertion-ordered Map: dropping the oldest key is a one-liner and this is
    // a cost cache, not a correctness one — an eviction only costs a query.
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.set(key, { value, expiresAt: now + RECONNECT_CACHE_TTL_MS });
}

/** Booking row for a room, memoised per instance for a few seconds. */
export async function cachedBookingForRoom(
  supabase: RoomDbClient,
  bookingId: string,
  now: number = Date.now(),
): Promise<RoomBooking | null> {
  const hit = read(bookings, bookingId, now);
  if (hit) return hit;
  const fresh = await getBookingForRoom(supabase, bookingId);
  // A miss is not cached: a booking that does not exist yet is exactly the case
  // where a stale "no" would be most annoying, and it costs nothing to re-ask.
  if (fresh) write(bookings, bookingId, fresh, now);
  return fresh;
}

/**
 * Room row for a booking, memoised the same way. `ensureRoom` reads first and
 * only writes when the room is missing or has drifted, so a cache hit here also
 * skips the read that proved no write was needed.
 */
export async function cachedEnsureRoom(
  supabase: RoomDbClient,
  booking: { id: string; tour_id?: string | null; tour_date?: string | null },
  now: number = Date.now(),
): Promise<TourRoom> {
  const key = `${booking.id}:${booking.tour_id ?? ''}:${booking.tour_date ?? ''}`;
  const hit = read(rooms, key, now);
  if (hit) return hit;
  const fresh = await ensureRoom(supabase, booking);
  write(rooms, key, fresh, now);
  return fresh;
}

/** Test seam. Production never calls this. */
export function __resetReconnectCache(): void {
  bookings.clear();
  rooms.clear();
}
