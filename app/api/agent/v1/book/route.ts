import { NextRequest, NextResponse } from "next/server";
import { getAgentCatalogItem, agentSiteUrl } from "@/lib/agent/catalog";
import { verifyQuote } from "@/lib/agent/quoteToken";

/**
 * POST /api/agent/v1/book — turn a signed quote into a hosted-checkout handoff.
 *
 * Body: { quote_token, contact?: { name, email, phone } }
 *
 * The agent does NOT charge a card. This endpoint verifies the quote token
 * (price integrity + not expired), then returns a `checkout_url` — a deep link
 * into the human checkout where the traveller reviews and pays. This is the
 * deliberate human-in-the-loop boundary: agents can carry a booking right up
 * to payment, and the person presses the final button.
 *
 * Why a handoff rather than a silent DB write: the live booking pipeline
 * ( /api/bookings ) is origin-locked and inventory-coupled by design. v1 keeps
 * the agent on the safe side of that boundary; direct reservation records with
 * idempotency keys are a Phase-3 hardening item.
 */
export const runtime = "nodejs";

const CORS = { "Access-Control-Allow-Origin": "*" };

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export async function POST(req: NextRequest) {
  let body: {
    quote_token?: unknown;
    contact?: { name?: unknown; email?: unknown; phone?: unknown } | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { object: "error", error: "invalid_json" },
      { status: 400, headers: CORS },
    );
  }

  const payload = verifyQuote(body.quote_token);
  if (!payload) {
    return NextResponse.json(
      {
        object: "error",
        error: "invalid_or_expired_quote",
        detail: "Re-fetch a price from POST /api/agent/v1/quote and retry.",
      },
      { status: 409, headers: CORS },
    );
  }

  const item = getAgentCatalogItem(payload.slug);
  if (!item) {
    return NextResponse.json(
      { object: "error", error: "tour_not_found", slug: payload.slug },
      { status: 404, headers: CORS },
    );
  }

  // Optional traveller contact — validated when present so a malformed email
  // doesn't ride along to checkout. Not required: the human can fill it in.
  const contactIn = body.contact && typeof body.contact === "object" ? body.contact : null;
  const email = typeof contactIn?.email === "string" ? contactIn.email.trim() : "";
  if (email && !isEmail(email)) {
    return NextResponse.json(
      { object: "error", error: "invalid_contact_email" },
      { status: 400, headers: CORS },
    );
  }
  const name = typeof contactIn?.name === "string" ? contactIn.name.trim() : "";
  const phone = typeof contactIn?.phone === "string" ? contactIn.phone.trim() : "";

  const base = agentSiteUrl();
  const url = new URL(item.url);
  url.searchParams.set("date", payload.date);
  url.searchParams.set("guests", String(payload.guests));
  if (name) url.searchParams.set("name", name);
  if (email) url.searchParams.set("email", email);
  if (phone) url.searchParams.set("phone", phone);
  url.searchParams.set("utm_source", "ai_agent");
  url.searchParams.set("utm_medium", "agent_channel");

  return NextResponse.json(
    {
      object: "booking_handoff",
      provider: "AtoC Korea",
      status: "awaiting_traveller_confirmation",
      payment: "customer_confirms_and_pays_at_hosted_checkout",
      tour: { slug: item.slug, title: item.title, url: item.url },
      date: payload.date,
      guests: payload.guests,
      currency: "USD",
      unit_price_usd: payload.unitPriceUsd,
      estimated_total_usd: payload.estimatedTotalUsd,
      final_price_confirmed_at_checkout: true,
      checkout_url: url.toString(),
      message:
        "Share this checkout_url with the traveller. They review the itinerary and pay on AtoC Korea's hosted checkout — no card is charged by the agent.",
      links: { docs: `${base}/for-agents` },
    },
    { headers: CORS },
  );
}

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
