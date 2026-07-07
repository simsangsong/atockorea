import { NextRequest, NextResponse } from "next/server";
import { getAgentCatalogItem } from "@/lib/agent/catalog";
import { checkAvailability } from "@/lib/agent/availability";
import { rateLimit, rateLimitHeaders } from "@/lib/agent/rateLimit";
import { logAgentEvent, userAgentOf } from "@/lib/agent/events";

/**
 * GET /api/agent/v1/tours/[slug]/availability?date=YYYY-MM-DD
 *
 * Best-effort, read-only availability for a date. Lets an agent sanity-check a
 * date before quoting/handing off. Never holds inventory or charges — the
 * authoritative check happens at hosted checkout.
 */
export const runtime = "nodejs";

const CORS = { "Access-Control-Allow-Origin": "*" };

function isYmd(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime());
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const rl = rateLimit(req);
  const headers = { ...CORS, ...rateLimitHeaders(rl) };
  if (!rl.ok) {
    return NextResponse.json(
      { object: "error", error: "rate_limited", detail: `Retry in ${rl.retryAfterSeconds}s.` },
      { status: 429, headers },
    );
  }

  const { slug } = await params;
  const item = getAgentCatalogItem(slug);
  if (!item) {
    return NextResponse.json(
      { object: "error", error: "tour_not_found", slug },
      { status: 404, headers },
    );
  }

  const date = req.nextUrl.searchParams.get("date")?.trim() || "";
  if (!isYmd(date)) {
    return NextResponse.json(
      { object: "error", error: "invalid_date", detail: "date query param must be YYYY-MM-DD" },
      { status: 400, headers },
    );
  }
  const todayUtc = new Date().toISOString().slice(0, 10);
  if (date < todayUtc) {
    return NextResponse.json(
      { object: "error", error: "date_in_past", detail: `date must be on or after ${todayUtc}` },
      { status: 400, headers },
    );
  }

  const availability = await checkAvailability(item.slug, date);

  void logAgentEvent({
    eventType: "availability_checked",
    channel: "rest",
    slug: item.slug,
    tourDate: date,
    apiKeyLabel: rl.apiKeyLabel,
    userAgent: userAgentOf(req),
    props: { status: availability.status },
  });

  return NextResponse.json(
    { object: "availability", provider: "AtoC Korea", ...availability },
    {
      headers: {
        ...headers,
        // Read-only, per slug+date in the URL — short edge cache smooths repeat checks.
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    },
  );
}

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-api-key",
    },
  });
}
