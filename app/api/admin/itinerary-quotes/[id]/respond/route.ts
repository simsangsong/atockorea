import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";
import { handleApiError, ErrorResponses } from "@/lib/error-handler";
import { sendEmail } from "@/lib/email";
import { buildQuoteConfirmationHtml } from "@/lib/email-templates/quote-confirmation";
import { fingerprint } from "@/lib/quote-engine/fingerprint";
import type { QuoteIntake, Track } from "@/lib/quote-engine/types";

/**
 * POST /api/admin/itinerary-quotes/[id]/respond
 *
 * Ops endpoint that closes out a `pending_manual` quote request. Writes:
 *   - tour_quote_requests.manual_quote_amount_krw / manual_quote_response /
 *     manual_responded_at, status = 'responded'
 *   - quote_memory row (fingerprint + amount) so future similar requests
 *     can reference this precedent
 *   - sends a follow-up email to the customer with the manual quote
 *
 * Admin auth via `requireAdmin` (cookie-based, existing pattern).
 */

interface RespondBody {
  manual_amount_krw?: unknown;
  notes?: unknown;
  /** Optional richer breakdown the ops member typed (not required). */
  response?: Record<string, unknown> | null;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAdmin(request);
    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return ErrorResponses.validationError("invalid quote id");
    }

    const body = (await request.json().catch(() => null)) as RespondBody | null;
    const amount = typeof body?.manual_amount_krw === "number" ? Math.round(body.manual_amount_krw) : NaN;
    if (!Number.isFinite(amount) || amount <= 0) {
      return ErrorResponses.validationError("manual_amount_krw must be a positive integer (KRW)");
    }
    const notes = typeof body?.notes === "string" ? body.notes.trim().slice(0, 2000) : null;
    const response = body?.response && typeof body.response === "object" ? body.response : null;

    const supabase = createServerClient();

    // Load the quote
    const { data: quote, error: loadErr } = await supabase
      .from("tour_quote_requests")
      .select(
        "id, status, region, track, party_size, language, poi_keys, intake, contact_email, contact_name, requested_date, source_url"
      )
      .eq("id", id)
      .maybeSingle();
    if (loadErr || !quote) {
      return ErrorResponses.notFound("Quote not found");
    }
    if (quote.status === "responded" || quote.status === "closed" || quote.status === "cancelled") {
      return NextResponse.json(
        { ok: false, error: `quote already ${quote.status}` },
        { status: 409 }
      );
    }

    // Re-derive engine intake (for fingerprint stability) using stored
    // intake.hours / intake.distance_km if present, else 0 fallbacks.
    const intakeJson = (quote.intake as Record<string, unknown>) ?? {};
    const engineIntake: QuoteIntake = {
      region: quote.region as string,
      track: quote.track as Track,
      pax: typeof quote.party_size === "number" ? quote.party_size : null,
      hours: typeof intakeJson.hours === "number" ? (intakeJson.hours as number) : null,
      distance_km:
        typeof intakeJson.distance_km === "number" ? (intakeJson.distance_km as number) : null,
      language: (quote.language as string) || "en",
      poi_keys: (quote.poi_keys as string[]) ?? [],
    };
    const fp = fingerprint(engineIntake);

    // Write quote_memory precedent (idempotency by content not enforced —
    // a re-response to the same quote will create a 2nd memory row,
    // intentional as it records ops's latest opinion).
    const { data: memRow, error: memErr } = await supabase
      .from("quote_memory")
      .insert({
        condition_fingerprint: fp,
        region: quote.region,
        track: quote.track,
        intake: intakeJson,
        cart_poi_keys: quote.poi_keys,
        manual_amount_krw: amount,
        notes,
        source_quote_request_id: id,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (memErr || !memRow) {
      console.error("[respond] quote_memory insert err", memErr);
      return ErrorResponses.internalError("memory insert failed");
    }

    // Update tour_quote_requests
    const { error: updErr } = await supabase
      .from("tour_quote_requests")
      .update({
        manual_quote_amount_krw: amount,
        manual_quote_response: response,
        manual_responded_at: new Date().toISOString(),
        status: "responded",
        precedent_quote_id: memRow.id,
      })
      .eq("id", id);
    if (updErr) {
      console.error("[respond] update err", updErr);
      return ErrorResponses.internalError("quote update failed");
    }

    // Look up POI names for email body
    const { data: poiRows } = await supabase
      .from("match_pois")
      .select("poi_key, name_en")
      .in("poi_key", (quote.poi_keys as string[]) ?? []);
    const nameByKey = new Map((poiRows ?? []).map((r) => [r.poi_key as string, r.name_en as string]));
    const poiNames = ((quote.poi_keys as string[]) ?? []).map((k) => nameByKey.get(k) ?? k);

    // Send the manual quote email (renders the same breakdown layout as auto-quote
    // but with the ops-typed amount in the header — synthetic breakdown to fit
    // the template).
    void sendEmail({
      to: quote.contact_email as string,
      subject: `Your AtoC Korea itinerary quote — ₩${amount.toLocaleString()}`,
      html: buildQuoteConfirmationHtml({
        contactName: (quote.contact_name as string) ?? null,
        region: quote.region as string,
        track: quote.track as Track,
        partySize: (quote.party_size as number) ?? null,
        requestedDate: (quote.requested_date as string) ?? null,
        poiNames,
        sourceUrl: (quote.source_url as string) ?? null,
        responseWindowHours: 24,
        autoQuoteAmountKrw: amount,
        autoQuoteBreakdown: response ?? { base_krw: amount, total_krw: amount, language: engineIntake.language },
      }),
    });

    return NextResponse.json({ ok: true, status: "responded", memory_id: memRow.id });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") return ErrorResponses.unauthorized("Authentication required");
    if (msg.includes("Forbidden")) return ErrorResponses.forbidden("Admin access required");
    return handleApiError(e);
  }
}
