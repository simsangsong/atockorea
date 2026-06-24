import { NextRequest, NextResponse } from "next/server";
import { getAgentCatalogItem, agentSiteUrl } from "@/lib/agent/catalog";
import { signQuote, AGENT_QUOTE_TTL_SECONDS } from "@/lib/agent/quoteToken";
import { rateLimit, rateLimitHeaders } from "@/lib/agent/rateLimit";
import { logAgentEvent, userAgentOf } from "@/lib/agent/events";

/**
 * POST /api/agent/v1/quote — issue a signed, time-boxed price quote.
 *
 * Body: { slug, date (YYYY-MM-DD), guests }
 *
 * Returns a per-unit USD price, an estimated total, and a `quote_token` the
 * agent passes to POST /api/agent/v1/book. The token is HMAC-signed so the
 * booking step can prove the price came from us and is unexpired — the agent
 * cannot invent a number. The *final* charge is reconfirmed at hosted
 * checkout, so the estimate here is honest about being an estimate.
 */
export const runtime = "nodejs";

const CORS = { "Access-Control-Allow-Origin": "*" };

function isYmd(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime());
}

export async function POST(req: NextRequest) {
  const rl = rateLimit(req);
  if (!rl.ok) {
    return NextResponse.json(
      { object: "error", error: "rate_limited", detail: `Retry in ${rl.retryAfterSeconds}s.` },
      { status: 429, headers: { ...CORS, ...rateLimitHeaders(rl) } },
    );
  }

  let body: { slug?: unknown; date?: unknown; guests?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { object: "error", error: "invalid_json" },
      { status: 400, headers: CORS },
    );
  }

  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  const item = slug ? getAgentCatalogItem(slug) : null;
  if (!item) {
    return NextResponse.json(
      { object: "error", error: "tour_not_found", slug },
      { status: 404, headers: CORS },
    );
  }

  const date = typeof body.date === "string" ? body.date.trim() : "";
  if (!isYmd(date)) {
    return NextResponse.json(
      { object: "error", error: "invalid_date", detail: "date must be YYYY-MM-DD" },
      { status: 400, headers: CORS },
    );
  }
  const todayUtc = new Date().toISOString().slice(0, 10);
  if (date < todayUtc) {
    return NextResponse.json(
      { object: "error", error: "date_in_past", detail: `date must be on or after ${todayUtc}` },
      { status: 400, headers: CORS },
    );
  }

  const guestsNum =
    typeof body.guests === "number" ? body.guests : Number(body.guests);
  if (!Number.isFinite(guestsNum) || guestsNum < 1) {
    return NextResponse.json(
      { object: "error", error: "invalid_guests", detail: "guests must be a positive integer" },
      { status: 400, headers: CORS },
    );
  }
  const guests = Math.round(guestsNum);
  if (item.max_group_size != null && guests > item.max_group_size) {
    return NextResponse.json(
      {
        object: "error",
        error: "party_too_large",
        max_group_size: item.max_group_size,
        detail: `This tour seats up to ${item.max_group_size}. For larger groups, contact contact@atockorea.com.`,
      },
      { status: 422, headers: CORS },
    );
  }

  const unitPriceUsd = item.price_usd;
  const estimatedTotalUsd = Math.round(unitPriceUsd * guests * 100) / 100;

  const { token, payload } = signQuote({
    slug: item.slug,
    date,
    guests,
    unitPriceUsd,
    estimatedTotalUsd,
  });

  void logAgentEvent({
    eventType: "quote_issued",
    channel: "rest",
    slug: item.slug,
    tourDate: date,
    guests,
    apiKeyLabel: rl.apiKeyLabel,
    userAgent: userAgentOf(req),
    props: { estimated_total_usd: estimatedTotalUsd },
  });

  return NextResponse.json(
    {
      object: "quote",
      provider: "AtoC Korea",
      slug: item.slug,
      title: item.title,
      date,
      guests,
      currency: "USD",
      unit_price_usd: unitPriceUsd,
      estimated_total_usd: estimatedTotalUsd,
      pricing_basis: "per_person_estimate",
      final_price_confirmed_at_checkout: true,
      quote_token: token,
      expires_at: new Date(payload.exp * 1000).toISOString(),
      ttl_seconds: AGENT_QUOTE_TTL_SECONDS,
      next: {
        book_endpoint: `${agentSiteUrl()}/api/agent/v1/book`,
        note: "POST the quote_token plus traveller contact to receive a hosted checkout URL. No card is charged by the agent.",
      },
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
