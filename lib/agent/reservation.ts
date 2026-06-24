/**
 * Best-effort persistence for agent-channel reservation leads.
 *
 * Writes to `public.agent_reservations` (see
 * supabase/pending-db-apply/2026-06-24-08-agent-reservations.sql). The
 * table is decoupled from the live bookings pipeline — a row here is just "a
 * traveller is about to pay at hosted checkout", keyed by an idempotency key so
 * a retrying agent gets the same handoff back.
 *
 * Degrades gracefully: if the table doesn't exist yet (SQL not applied) or any
 * write fails, we still return a reservation id and let the booking handoff
 * proceed. Persistence is a durability/idempotency bonus, never a hard gate.
 */

import { createServerClient } from "@/lib/supabase";

export interface ReservationInput {
  idempotencyKey: string | null;
  channel: "rest" | "mcp";
  slug: string;
  date: string;
  guests: number;
  unitPriceUsd: number;
  estimatedTotalUsd: number;
  checkoutUrl: string;
  contact?: { name?: string; email?: string; phone?: string } | null;
  apiKeyLabel?: string | null;
}

export interface ReservationResult {
  reservationId: string;
  persisted: boolean;
  /** True when an existing row was returned for a repeated idempotency key. */
  replayed: boolean;
  /** Checkout URL of the canonical (possibly pre-existing) reservation. */
  checkoutUrl: string;
}

export async function recordReservation(input: ReservationInput): Promise<ReservationResult> {
  const fallback: ReservationResult = {
    reservationId: crypto.randomUUID(),
    persisted: false,
    replayed: false,
    checkoutUrl: input.checkoutUrl,
  };

  try {
    const supabase = createServerClient();

    // Idempotency replay: return the original handoff for a repeated key.
    if (input.idempotencyKey) {
      const { data: existing } = await supabase
        .from("agent_reservations")
        .select("id, checkout_url")
        .eq("idempotency_key", input.idempotencyKey)
        .maybeSingle();
      if (existing?.id) {
        return {
          reservationId: existing.id as string,
          persisted: true,
          replayed: true,
          checkoutUrl: (existing.checkout_url as string) || input.checkoutUrl,
        };
      }
    }

    const { data, error } = await supabase
      .from("agent_reservations")
      .insert({
        idempotency_key: input.idempotencyKey,
        channel: input.channel,
        slug: input.slug,
        tour_date: input.date,
        guests: input.guests,
        unit_price_usd: input.unitPriceUsd,
        estimated_total_usd: input.estimatedTotalUsd,
        contact_name: input.contact?.name || null,
        contact_email: input.contact?.email || null,
        contact_phone: input.contact?.phone || null,
        checkout_url: input.checkoutUrl,
        api_key_label: input.apiKeyLabel || null,
      })
      .select("id, checkout_url")
      .single();

    if (error || !data) {
      // Unique-violation race on idempotency key → fetch the winner.
      if (input.idempotencyKey) {
        const { data: raced } = await supabase
          .from("agent_reservations")
          .select("id, checkout_url")
          .eq("idempotency_key", input.idempotencyKey)
          .maybeSingle();
        if (raced?.id) {
          return {
            reservationId: raced.id as string,
            persisted: true,
            replayed: true,
            checkoutUrl: (raced.checkout_url as string) || input.checkoutUrl,
          };
        }
      }
      return fallback;
    }

    return {
      reservationId: data.id as string,
      persisted: true,
      replayed: false,
      checkoutUrl: (data.checkout_url as string) || input.checkoutUrl,
    };
  } catch {
    // Table missing / client unavailable — proceed without persistence.
    return fallback;
  }
}
