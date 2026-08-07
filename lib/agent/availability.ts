/**
 * Read-only availability check for the agent channel.
 *
 * Mirrors the inventory math in POST /api/bookings (product_inventory minus
 * active bookings, default capacity when no inventory row exists) but is
 * strictly read-only — no writes, no holds, no charge. This lets an agent tell
 * a traveller "that date looks open" before handing off to checkout.
 *
 * Resolves the live `tours` row by slug. When the slug isn't in the DB (some
 * static catalogue products may not have a live inventory row), we return
 * `unknown` rather than guessing — the agent should still proceed to checkout,
 * where availability is authoritatively enforced.
 */

import { createServerClient } from "@/lib/supabase";
import { ACTIVE_BOOKING_STATUSES } from "@/lib/constants/booking-status";
import { isDateOffDepartureDay } from "@/lib/tour-departure-days";
import { isDateOutsideSeasonalWindow } from "@/lib/tour-seasonal-windows";

const DEFAULT_CAPACITY = 50;

export interface AvailabilityResult {
  slug: string;
  date: string;
  status: "available" | "sold_out" | "unknown";
  available_spots: number | null;
  max_capacity: number | null;
  /** Authoritative answer only happens at checkout — this is a best-effort read. */
  authoritative: false;
}

export async function checkAvailability(
  slug: string,
  date: string,
): Promise<AvailabilityResult> {
  const unknown: AvailabilityResult = {
    slug,
    date,
    status: "unknown",
    available_spots: null,
    max_capacity: null,
    authoritative: false,
  };

  // Fixed-schedule products do not run off their departure weekdays. This is a
  // property of the slug, so it answers without a DB round-trip — and unlike
  // the capacity read below, "sold_out" here is a certainty, not best-effort.
  if (isDateOffDepartureDay(slug, date)) {
    return { slug, date, status: "sold_out", available_spots: 0, max_capacity: null, authoritative: false };
  }

  // Same for a season-locked tour asked about out of season: a property of the
  // slug and the date, certain without a DB read. Added 2026-08-07 — the
  // chatbot had the weekday rule but not this one, so it would happily quote a
  // winter-only tour for a July date the booking route then refuses.
  if (isDateOutsideSeasonalWindow(slug, date)) {
    return { slug, date, status: "sold_out", available_spots: 0, max_capacity: null, authoritative: false };
  }

  try {
    const supabase = createServerClient();

    const { data: tour } = await supabase
      .from("tours")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!tour?.id) return unknown;

    const tourId = tour.id as string;

    const [{ data: inventory }, { data: existing }] = await Promise.all([
      supabase
        .from("product_inventory")
        .select("max_capacity, available_spots, is_available")
        .eq("tour_id", tourId)
        .eq("tour_date", date)
        // 🔴 Do NOT filter on is_available — a closed row filtered out here
        // reads below as "no inventory row" and reopens the date at the
        // default capacity. The branch reads the flag instead.
        .maybeSingle(),
      supabase
        .from("bookings")
        .select("number_of_guests")
        .eq("tour_id", tourId)
        .eq("booking_date", date)
        .in("status", [...ACTIVE_BOOKING_STATUSES]),
    ]);

    const bookedGuests =
      (existing ?? []).reduce(
        (sum, b) => sum + (Number((b as { number_of_guests?: unknown }).number_of_guests) || 1),
        0,
      ) || 0;

    let availableSpots: number;
    let maxCapacity: number | null;
    if (inventory && (inventory as { is_available?: boolean | null }).is_available === false) {
      // Explicitly closed by an operator — no capacity makes it bookable.
      return { slug, date, status: "sold_out", available_spots: 0, max_capacity: null, authoritative: false };
    } else if (inventory) {
      const max = (inventory as { max_capacity?: number | null }).max_capacity ?? null;
      if (max != null) {
        maxCapacity = max;
        availableSpots = Math.max(0, max - bookedGuests);
      } else {
        const open = Number((inventory as { available_spots?: unknown }).available_spots) || 0;
        maxCapacity = null;
        availableSpots = Math.max(0, open - bookedGuests);
      }
    } else {
      maxCapacity = DEFAULT_CAPACITY;
      availableSpots = Math.max(0, DEFAULT_CAPACITY - bookedGuests);
    }

    return {
      slug,
      date,
      status: availableSpots > 0 ? "available" : "sold_out",
      available_spots: availableSpots,
      max_capacity: maxCapacity,
      authoritative: false,
    };
  } catch {
    return unknown;
  }
}
