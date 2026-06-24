import { NextRequest, NextResponse } from "next/server";
import { getAgentCatalogItem, agentSiteUrl } from "@/lib/agent/catalog";

/**
 * GET /api/agent/v1/tours/[slug] — full machine-readable record for one tour.
 *
 * Returns the catalogue fields plus the canonical human checkout URL and the
 * quote endpoint an agent should call next. No auth, edge-cacheable.
 */
export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const item = getAgentCatalogItem(slug);

  if (!item) {
    return NextResponse.json(
      { object: "error", error: "tour_not_found", slug },
      { status: 404, headers: { "Access-Control-Allow-Origin": "*" } },
    );
  }

  const base = agentSiteUrl();
  return NextResponse.json(
    {
      object: "tour",
      provider: "AtoC Korea",
      currency: "USD",
      tour: item,
      booking: {
        // Agents do not charge cards. They price, then hand the traveller a
        // hosted checkout URL where the human confirms and pays.
        flow: "human_confirms_at_hosted_checkout",
        quote_endpoint: `${base}/api/agent/v1/quote`,
        book_endpoint: `${base}/api/agent/v1/book`,
        checkout_url: item.url,
      },
      links: {
        openapi: `${base}/api/agent/openapi.json`,
        docs: `${base}/for-agents`,
      },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=900, stale-while-revalidate=86400",
        "Access-Control-Allow-Origin": "*",
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
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
