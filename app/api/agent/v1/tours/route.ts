import { NextRequest, NextResponse } from "next/server";
import { listAgentCatalog, agentSiteUrl } from "@/lib/agent/catalog";

/**
 * GET /api/agent/v1/tours — machine-readable tour catalogue for AI agents.
 *
 * Stable, deterministic, no auth. Sourced from the static product registry
 * (same set the sitemap advertises). Supports `?region=` and `?search=`
 * filters and `?limit=` / `?offset=` paging.
 *
 * This is the discovery + browse surface of the agent channel. To price a
 * specific date/party, call POST /api/agent/v1/quote; to hand off to checkout,
 * call POST /api/agent/v1/book.
 */
export const runtime = "nodejs";

export function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const region = searchParams.get("region");
  const search = searchParams.get("search") ?? searchParams.get("q");
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "50", 10) || 50, 1), 100);
  const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10) || 0, 0);

  const all = listAgentCatalog({ region, search });
  const page = all.slice(offset, offset + limit);

  return NextResponse.json(
    {
      object: "tour_catalog",
      provider: "AtoC Korea",
      currency: "USD",
      total: all.length,
      limit,
      offset,
      tours: page,
      links: {
        self: `${agentSiteUrl()}/api/agent/v1/tours`,
        openapi: `${agentSiteUrl()}/api/agent/openapi.json`,
        docs: `${agentSiteUrl()}/for-agents`,
      },
    },
    {
      headers: {
        // Public, cacheable at the edge — the static catalogue changes rarely.
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
