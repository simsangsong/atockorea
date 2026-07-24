/**
 * "Build the dining card, post it, fan it out" — the ONE code path every
 * trigger uses (§5.7 R-2).
 *
 * Four triggers exist: the approach hook, the arrival bundle's next-leg hook,
 * the operator's one-tap, and the manual /dining route. Each of them assembling
 * its own message row is exactly how "the lunch card fanned out on one path and
 * not the other" bugs happen, so all four call `postDiningCard` and the two
 * existing tour-room routes keep their edit to a ~10-line best-effort tail.
 *
 * Guarantees:
 *   • never throws — a dining failure must never fail an arrival;
 *   • at most ONE card per (room, cell, KST day), claimed through the same
 *     `tour_room_events` UNIQUE(room_id, subject_key, type) pattern the
 *     approach route uses (§11.C C2);
 *   • shared tours (price_type person/group) fan out to every booking of the
 *     tour date — the arrival-bundle Model B, copied so the two stay identical;
 *   • realtime only, NO web push: a restaurant list is never rally-critical and
 *     pushes stay reserved for meeting times (same reasoning as the approach
 *     preview).
 *
 * Server-only: supabase + recommend.server.
 */

import type { RoomBooking, RoomDbClient } from '@/lib/tour-room/access';
import { ensureRoom } from '@/lib/tour-room/access';
import { recordRoomEvent, type RoomEventActorRole } from '@/lib/tour-room/events';
import { broadcastToRoom } from '@/lib/tour-room/realtime';
import { kstToday } from '@/lib/tour-room/time';
import { composeDiningTranslations, type DiningCardMeta, type MealKind } from '@/lib/ops/dining/card';
import { isMealStop, type MealStopLike } from '@/lib/ops/dining/mealStop';
import { recommendDining, recordShown, type ShownRow } from '@/lib/ops/dining/recommend.server';

/** The booking columns the fan-out needs (a full RoomBooking satisfies it). */
export interface DiningTargetBooking {
  id: string;
  tour_id?: string | null;
  tour_date?: string | null;
  preferred_language?: string | null;
}

export interface PostDiningArgs {
  booking: RoomBooking | DiningTargetBooking;
  poiKey?: string | null;
  spotTitle: string;
  lat: number;
  lng: number;
  meal: MealKind;
  /** Pre-resolved filters; omit to let the R-1 intake ladder resolve them. */
  dietary?: readonly string[];
  actorRole: RoomEventActorRole;
  actorParticipantId?: string | null;
  authUserId?: string | null;
  nowMs?: number;
  radiusM?: number;
}

export type PostDiningSkip = 'no_card' | 'duplicate' | 'delivery_failed' | 'not_meal' | 'no_coords';

export interface PostDiningResult {
  posted: boolean;
  skipped?: PostDiningSkip;
  meta: DiningCardMeta | null;
  /** Rooms that actually received a card. */
  delivered: number;
  /** The sender booking's own message row, when it got one. */
  message: unknown;
}

const NOTHING: PostDiningResult = { posted: false, skipped: 'no_card', meta: null, delivered: 0, message: null };

/** Shared tour? (arrival-bundle's Model B test, verbatim.) */
async function resolveTargets(
  supabase: RoomDbClient,
  booking: DiningTargetBooking,
): Promise<DiningTargetBooking[]> {
  if (!booking.tour_id || !booking.tour_date) return [booking];
  try {
    const { data: tourRow } = await supabase
      .from('tours')
      .select('price_type')
      .eq('id', booking.tour_id)
      .maybeSingle();
    const priceType = (tourRow as { price_type?: string } | null)?.price_type;
    if (priceType !== 'person' && priceType !== 'group') return [booking];

    const { data: dayBookings } = await supabase
      .from('bookings')
      .select('id, tour_id, tour_date, preferred_language')
      .eq('tour_id', booking.tour_id)
      .eq('tour_date', booking.tour_date)
      .neq('status', 'cancelled');
    return Array.isArray(dayBookings) && dayBookings.length > 0
      ? (dayBookings as DiningTargetBooking[])
      : [booking];
  } catch {
    return [booking];
  }
}

/**
 * Build + post. Returns `posted: false` (never throws) when there is nothing
 * worth showing, when today's card for this cell already went out, or when
 * every room delivery failed.
 */
export async function postDiningCard(
  supabase: RoomDbClient,
  args: PostDiningArgs,
): Promise<PostDiningResult> {
  try {
    const booking = args.booking;
    if (!booking?.id) return NOTHING;

    // Recommend BEFORE claiming the day slot. The reverse order would burn the
    // (room, cell, day) slot on a transient collection failure and silence the
    // card for the rest of the day — a duplicate risk window of a few seconds
    // is the cheaper mistake, and the collection itself is idempotent (upsert).
    const built = await recommendDining(supabase, {
      bookingId: booking.id,
      poiKey: args.poiKey ?? null,
      spotTitle: args.spotTitle,
      lat: args.lat,
      lng: args.lng,
      meal: args.meal,
      dietary: args.dietary,
      nowMs: args.nowMs,
      radiusM: args.radiusM,
      triggeredByRole: args.actorRole,
    });
    if (!built) return NOTHING;

    const meta = built.meta;
    const dayKey = booking.tour_date ?? kstToday();
    const subjectKey = `${meta.cell}:${dayKey}`;
    const text = composeDiningTranslations(meta);
    const targets = await resolveTargets(supabase, booking);
    const fanout = targets.length > 1;

    let delivered = 0;
    let duplicates = 0;
    let primaryMessage: unknown = null;

    for (const target of targets) {
      try {
        const room = await ensureRoom(supabase, target);
        const isSender = target.id === booking.id;

        // Per-ROOM claim: a room that already saw this cell's card today is
        // skipped while its neighbours on a shared tour still get theirs.
        const claim = await recordRoomEvent(supabase, {
          roomId: room.id,
          bookingId: target.id,
          type: 'dining_card',
          actorRole: args.actorRole,
          actorParticipantId: isSender ? (args.actorParticipantId ?? null) : null,
          subjectKey,
          payload: {
            cell: meta.cell,
            poi_key: meta.poi_key,
            meal: meta.meal,
            places: meta.places.length,
            source: meta.source,
          },
        }).catch(() => ({ inserted: false, event: null }));
        if (!claim.inserted) {
          duplicates += 1;
          continue;
        }

        const { data: message, error: messageError } = await supabase
          .from('tour_room_messages')
          .insert({
            room_id: room.id,
            booking_id: target.id,
            sender_user_id: args.authUserId ?? null,
            sender_role: 'system',
            input_kind: 'text',
            source_text: text.source_text,
            source_locale: text.source_locale,
            translations: text.translations,
            target_locales: Object.keys(text.translations),
            metadata: fanout ? { ...meta, fanout: true } : meta,
          })
          .select()
          .single();
        if (messageError) throw messageError;

        await broadcastToRoom(room, 'message', { message });

        // Exposure ledger per room (R-6) — the ranking's feedback source.
        const rows: ShownRow[] = built.shown.map((row) => ({ ...row, booking_id: target.id }));
        await recordShown(supabase, rows, {
          roomId: room.id,
          participantId: isSender ? (args.actorParticipantId ?? null) : null,
        });

        if (isSender) primaryMessage = message;
        delivered += 1;
      } catch (roomFailure) {
        console.warn('[ops-dining] room delivery failed:', target.id, roomFailure);
      }
    }

    if (delivered === 0) {
      return {
        posted: false,
        skipped: duplicates > 0 ? 'duplicate' : 'delivery_failed',
        meta,
        delivered: 0,
        message: null,
      };
    }
    return { posted: true, meta, delivered, message: primaryMessage };
  } catch (error) {
    console.warn('[ops-dining] postDiningCard failed:', error);
    return NOTHING;
  }
}

/** match_pois coordinates for a poi_key. Null-safe, never throws. */
export async function diningPoiCoords(
  supabase: RoomDbClient,
  poiKey: string | null | undefined,
): Promise<{ lat: number; lng: number } | null> {
  if (!poiKey) return null;
  try {
    const { data } = await supabase.from('match_pois').select('lat, lng').eq('poi_key', poiKey).maybeSingle();
    const row = data as { lat?: number | null; lng?: number | null } | null;
    return typeof row?.lat === 'number' && typeof row?.lng === 'number' ? { lat: row.lat, lng: row.lng } : null;
  } catch {
    return null;
  }
}

export interface MealStopTriggerArgs extends Omit<PostDiningArgs, 'meal' | 'lat' | 'lng' | 'spotTitle'> {
  /** The schedule item / POI being judged (stop_type > its own time > title). */
  stop: MealStopLike;
  spotTitle?: string | null;
  /** Known coordinates; falls back to match_pois for `poiKey`. */
  lat?: number | null;
  lng?: number | null;
}

/**
 * The auto-trigger entry point (§5.7 R-2 triggers 1 & 2): fire ONLY when the
 * stop really is a meal stop. An unprompted restaurant list at a waterfall is
 * noise, and noise is what makes guests stop reading the room.
 *
 * Best-effort by contract — the two calling routes `void` this so a dining
 * failure can never fail an approach or an arrival.
 */
export async function maybePostDiningForStop(
  supabase: RoomDbClient,
  args: MealStopTriggerArgs,
): Promise<PostDiningResult> {
  try {
    const nowMs = args.nowMs ?? Date.now();
    const verdict = isMealStop(args.stop, nowMs);
    if (!verdict.isMeal) return { ...NOTHING, skipped: 'not_meal' };

    const coords =
      typeof args.lat === 'number' && typeof args.lng === 'number' && Number.isFinite(args.lat) && Number.isFinite(args.lng)
        ? { lat: args.lat, lng: args.lng }
        : await diningPoiCoords(supabase, args.poiKey);
    if (!coords) return { ...NOTHING, skipped: 'no_coords' };

    const title =
      (typeof args.spotTitle === 'string' && args.spotTitle.trim()) ||
      (typeof args.stop?.title === 'string' && args.stop.title.trim()) ||
      (typeof args.stop?.name === 'string' && args.stop.name.trim()) ||
      '';

    return await postDiningCard(supabase, {
      ...args,
      spotTitle: title,
      lat: coords.lat,
      lng: coords.lng,
      meal: verdict.meal,
      nowMs,
    });
  } catch (error) {
    console.warn('[ops-dining] maybePostDiningForStop failed:', error);
    return NOTHING;
  }
}
