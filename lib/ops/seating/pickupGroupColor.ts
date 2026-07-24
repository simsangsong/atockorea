/**
 * Pickup-group colour overlay for the guide seat board — plan §5.4b
 * ("픽업 순서 운영의 핵심 뷰": at a glance, who boards at the next stop).
 *
 * DB/React-free pure functions. The dashboard builds a legend from the pickup
 * groups it already renders and a seat-number → accent map from the seat
 * assignments, then hands the accent map to SeatMap.
 *
 * ── Colour source ──────────────────────────────────────────────────────────
 * Deliberately NOT a second palette: this reuses lib/tour-room/avatarColor.ts
 * (the app's existing deterministic identity-colour scheme) — the same djb2
 * hash, the same 8 literal pairs that already clear 4.5:1 in both themes.
 * The seed is the CANONICAL pickup key (normalizePickupKey), so:
 *   · the same pickup point keeps its colour on every render and every device,
 *   · adding or removing another group never re-shuffles anyone's colour
 *     (the index depends on that group's key alone, not on the group set).
 *
 * The price of pure per-key derivation is that two pickup points can land on
 * the same palette slot (8 slots; a room usually has 2–5 groups). That is
 * accepted rather than "fixed" by probing, because probing would make a
 * colour depend on which other groups exist — exactly the instability the
 * plan forbids. Collisions are covered by the second signal below.
 *
 * ── Accessibility ──────────────────────────────────────────────────────────
 * Colour is never the only signal (§5.4b): every accent carries the group's
 * ordinal (1-based, matching the legend row) rendered inside the seat, and a
 * text description that goes into the seat's aria-label. A colour-blind guide
 * reads the number; a screen reader hears the pickup name.
 *
 * ── "픽업 미지정" ──────────────────────────────────────────────────────────
 * The unassigned bucket gets NO accent. It is the absence of a pickup point,
 * not a pickup point, and a grey border would collide with the empty-seat
 * border. The legend says so in words.
 */

import { avatarColorFor } from '@/lib/tour-room/avatarColor';
import { UNASSIGNED_GROUP_KEY, type ManifestGroup } from '@/lib/ops/manifest/group';
import type { DashboardAssignment } from './dashboard';

export interface PickupGroupLegendEntry {
  /** Canonical pickup key (normalizePickupKey). */
  key: string;
  /** 1-based position in the rendered legend — the badge printed on the seat. */
  index: number;
  displayName: string;
  firstPickupTime: string | null;
  teamCount: number;
  paxCount: number;
  bookingIds: string[];
  /** Border colour, or null for the unassigned bucket (no colour by design). */
  color: string | null;
}

/** What SeatMap needs to paint one seat's group membership. */
export interface SeatAccent {
  /** Border colour (never a fill — see the precedence note in SeatMap). */
  color: string;
  /** Short in-seat marker, paired with the colour so colour is not alone. */
  label: string;
  /** Appended to the seat's aria-label. */
  description: string;
}

/**
 * Deterministic border colour for a canonical pickup key.
 * Returns null for the unassigned bucket (and for an empty key).
 */
export function pickupGroupColor(groupKey: string): string | null {
  if (!groupKey || groupKey === UNASSIGNED_GROUP_KEY) return null;
  // `ink` (not `bg`): a border needs the saturated end of the pair to stay
  // visible against both the light ivory and the dark room surface.
  return avatarColorFor(groupKey).ink;
}

/**
 * Pickup groups (already ordered by the dashboard) → legend rows.
 * Order in = order out; the 1-based index is the badge the seats carry.
 */
export function buildPickupGroupLegend(groups: ManifestGroup[]): PickupGroupLegendEntry[] {
  return (groups ?? []).map((group, i) => ({
    key: group.key,
    index: i + 1,
    displayName: group.displayName || (group.key === UNASSIGNED_GROUP_KEY ? '픽업 미지정' : group.key),
    firstPickupTime: group.firstPickupTime ?? null,
    teamCount: group.teamCount,
    paxCount: group.paxCount,
    bookingIds: (group.bookings ?? []).map((b) => b.id),
    color: pickupGroupColor(group.key),
  }));
}

/**
 * Legend + seat assignments → seat number → accent, for ONE vehicle.
 *
 * Seats whose booking is not in any coloured group (unassigned bucket, or a
 * booking that vanished from the roster) simply get no accent — the seat then
 * renders exactly as it did before the overlay existed.
 */
export function buildPickupSeatAccents(
  legend: PickupGroupLegendEntry[],
  assignments: DashboardAssignment[],
): Record<number, SeatAccent> {
  const byBooking = new Map<string, PickupGroupLegendEntry>();
  for (const entry of legend ?? []) {
    for (const bookingId of entry.bookingIds) byBooking.set(bookingId, entry);
  }

  const accents: Record<number, SeatAccent> = {};
  for (const a of assignments ?? []) {
    const entry = byBooking.get(a.booking_id);
    if (!entry || !entry.color) continue;
    accents[a.seat_number] = {
      color: entry.color,
      label: String(entry.index),
      description: `픽업 ${entry.index} ${entry.displayName}`,
    };
  }
  return accents;
}
