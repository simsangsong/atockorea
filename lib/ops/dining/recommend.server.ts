/**
 * `recommendDining` — the single entry point slice B calls (§5.7 R-1 → R-5).
 *
 * One function so every trigger (approach hook, arrival bundle, concierge
 * restaurant intent, operator one-tap) produces the SAME card from the SAME
 * rules. The alternative — each route assembling its own — is how "the lunch
 * card ignored the vegetarian filter on one path only" bugs happen.
 *
 * Flow:
 *   ① intake  — tour_day_plans.needs.dietary, else a conservative scan of the
 *               booking's special_requests/notes (R-1).
 *   ② cache   — read the cell; collect once on a miss (R-3). Both never throw.
 *   ③ rank    — hard exclusions then the weighted score, top 5 (R-4).
 *   ④ card    — a fully built DiningCardMeta, or null when nothing survives.
 *
 * Returns null rather than an empty card when there is nothing worth showing:
 * an empty "here are 0 restaurants" message is worse than silence.
 */

import type { RoomDbClient } from '@/lib/tour-room/access';
import { dietaryFromSpecialRequests, needsToDietary, type DietaryFilterTag } from '@/lib/ops/dining/dietary';
import { cellFor, collectCell, loadFeedback, readCellCache } from '@/lib/ops/dining/cache.server';
import { rankPlaces, type CachedPlace, type RankedPlace } from '@/lib/ops/dining/places';
import type { DiningCardMeta, DiningPlace, MealKind } from '@/lib/ops/dining/card';

export interface RecommendArgs {
  bookingId: string;
  poiKey?: string | null;
  spotTitle: string;
  lat: number;
  lng: number;
  meal: MealKind;
  /** Guest room locale — only used for logging/telemetry; the card ships all 5. */
  locale?: string;
  nowMs?: number;
  radiusM?: number;
  /** Skip the intake query when the caller already resolved the filters. */
  dietary?: readonly string[];
  triggeredByRole?: string;
}

export interface RecommendResult {
  meta: DiningCardMeta;
  /** Rows for `ops_restaurant_recommendations` — slice B writes them, or call
   *  `recordShown` below. */
  shown: ShownRow[];
}

export interface ShownRow {
  booking_id: string;
  room_id?: string | null;
  participant_id?: string | null;
  poi_key: string | null;
  cell: string;
  place_key: string;
  rank: number;
  dietary_tags: string[];
}

/**
 * R-1 intake ladder. `tour_day_plans.needs` wins outright; the free-text scan
 * only runs when needs carry nothing, so a guest who deliberately unticked a
 * chip is never overruled by an old booking note.
 */
export async function resolveDietary(
  supabase: RoomDbClient,
  bookingId: string,
): Promise<{ tags: DietaryFilterTag[]; allergyNote: string | null }> {
  let fromNeeds: ReturnType<typeof needsToDietary> = { tags: [], allergyNote: null, kids: false, children: 0 };

  try {
    const { data } = await supabase
      .from('tour_day_plans')
      .select('needs, updated_at')
      .eq('booking_id', bookingId)
      .order('updated_at', { ascending: false })
      .limit(1);
    const row = Array.isArray(data) ? (data[0] as { needs?: unknown } | undefined) : undefined;
    fromNeeds = needsToDietary((row?.needs ?? null) as Parameters<typeof needsToDietary>[0]);
  } catch {
    // fall through to the booking text
  }

  // `kids` alone is a preference, not a declaration — a plan that only says
  // "2 children" should still let the booking note contribute restrictions.
  const hasRestriction = fromNeeds.tags.some((tag) => tag !== 'kids');
  if (hasRestriction) return { tags: fromNeeds.tags, allergyNote: fromNeeds.allergyNote };

  try {
    const { data } = await supabase
      .from('bookings')
      .select('special_requests, notes')
      .eq('id', bookingId)
      .maybeSingle();
    const booking = (data ?? null) as { special_requests?: unknown; notes?: unknown } | null;
    const text = [booking?.special_requests, booking?.notes]
      .filter((part): part is string => typeof part === 'string' && part.trim() !== '')
      .join('\n');
    const scanned = dietaryFromSpecialRequests(text);
    const merged = [...new Set<DietaryFilterTag>([...fromNeeds.tags, ...scanned])];
    return { tags: merged, allergyNote: fromNeeds.allergyNote };
  } catch {
    return { tags: fromNeeds.tags, allergyNote: fromNeeds.allergyNote };
  }
}

/** RankedPlace → the wire shape the card renders (spec §R-5). */
export function toDiningPlace(place: RankedPlace): DiningPlace {
  return {
    place_key: place.place_key,
    name: place.name,
    name_i18n: place.name_i18n ?? null,
    cuisine: place.cuisine ?? null,
    category_name: place.category_name ?? null,
    lat: place.lat,
    lng: place.lng,
    distance_m: place.distance_m,
    walk_min: place.walk_min,
    price_band: place.price_band ?? null,
    rating: place.rating ?? null,
    review_count: place.review_count ?? null,
    tags: Array.isArray(place.tags) ? place.tags : [],
    signature_menus: Array.isArray(place.signature_menus) ? place.signature_menus : [],
    place_url: place.place_url,
    open_today: place.open_today,
    closes_at: place.closes_at,
    ...(place.unrated ? { unrated: true } : {}),
  };
}

/**
 * Build the card for one spot. Never throws — every failure path returns null
 * and the caller simply does not post a dining card.
 */
export async function recommendDining(
  supabase: RoomDbClient,
  args: RecommendArgs,
): Promise<RecommendResult | null> {
  if (!args?.bookingId) return null;
  if (!Number.isFinite(args.lat) || !Number.isFinite(args.lng)) return null;

  const nowMs = args.nowMs ?? Date.now();
  const cell = cellFor(args.lat, args.lng);
  if (!cell) return null;

  try {
    const dietary =
      args.dietary !== undefined
        ? [...args.dietary]
        : (await resolveDietary(supabase, args.bookingId)).tags;

    let source: 'cache' | 'fresh' = 'cache';
    let result = await readCellCache(supabase, { lat: args.lat, lng: args.lng, radiusM: args.radiusM });
    if (!result.hit) {
      result = await collectCell(supabase, { lat: args.lat, lng: args.lng, radiusM: args.radiusM });
      source = 'fresh';
    }

    const candidates: CachedPlace[] = result.places ?? [];
    if (candidates.length === 0) return null;

    const feedback = await loadFeedback(supabase, candidates.map((place) => place.place_key));
    const ranked = rankPlaces(candidates, {
      dietary,
      centerLat: args.lat,
      centerLng: args.lng,
      nowMs,
      feedback,
    });
    if (ranked.length === 0) return null;

    const places = ranked.map(toDiningPlace);
    const meta: DiningCardMeta = {
      kind: 'dining_card',
      poi_key: args.poiKey ?? null,
      spot_title: args.spotTitle,
      cell,
      meal: args.meal,
      dietary,
      places,
      source,
      ...(args.triggeredByRole ? { triggered_by_role: args.triggeredByRole } : {}),
    };

    const shown: ShownRow[] = places.map((place, index) => ({
      booking_id: args.bookingId,
      poi_key: args.poiKey ?? null,
      cell,
      place_key: place.place_key,
      rank: index + 1,
      dietary_tags: [...dietary],
    }));

    return { meta, shown };
  } catch (error) {
    console.warn('[ops-dining] recommendDining failed:', error);
    return null;
  }
}

/**
 * Log the exposure (R-6). Idempotent per (booking, place, cell) via the table's
 * UNIQUE constraint, so re-showing the same card updates the rank instead of
 * piling up rows. Best-effort: a failed log must never break the card.
 */
export async function recordShown(
  supabase: RoomDbClient,
  rows: ShownRow[],
  extra: { roomId?: string | null; participantId?: string | null } = {},
): Promise<boolean> {
  if (!Array.isArray(rows) || rows.length === 0) return false;
  try {
    const nowIso = new Date().toISOString();
    await supabase.from('ops_restaurant_recommendations').upsert(
      rows.map((row) => ({
        ...row,
        room_id: extra.roomId ?? row.room_id ?? null,
        participant_id: extra.participantId ?? row.participant_id ?? null,
        shown_at: nowIso,
      })),
      { onConflict: 'booking_id,place_key,cell' },
    );
    return true;
  } catch (error) {
    console.warn('[ops-dining] recordShown failed:', error);
    return false;
  }
}
