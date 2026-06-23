import { NextResponse } from "next/server";
import { agentCatalog, siteOrigin } from "@/lib/agent-channel/site";

/**
 * GET /feed/tours.json — machine-readable tour catalogue for AI agents.
 *
 * A dense, token-efficient mirror of the catalogue so agentic crawlers can map
 * the full inventory without parsing dozens of HTML pages. Discovered via
 * /llms.txt and the MCP server. Read-only; booking happens at each tour's
 * detailUrl or via the custom-itinerary quote tool.
 */

export const revalidate = 3600; // 1h — catalogue changes ship via deploy

export async function GET() {
  const origin = siteOrigin();
  const tours = agentCatalog();

  return NextResponse.json(
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "AtoC Korea — Private & Small-Group Tour Catalogue",
      provider: {
        "@type": "TravelAgency",
        name: "AtoC Korea",
        url: origin,
        areaServed: "KR",
      },
      generatedAt: new Date().toISOString(),
      currency: "USD",
      priceNote:
        "priceFromUsd is an indicative 'from' price. Custom private-tour " +
        "pricing is computed server-side (KRW) via the getQuote MCP tool / " +
        "POST /api/itinerary/book, which is authoritative.",
      bookingEndpoints: {
        customItineraryQuoteAndBook: `${origin}/api/itinerary/book`,
        customItineraryBuilder: `${origin}/itinerary-builder`,
        mcp: `${origin}/api/mcp`,
        openapi: `${origin}/feed/openapi.json`,
      },
      count: tours.length,
      tours,
    },
    {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=3600, s-maxage=3600",
        "access-control-allow-origin": "*",
      },
    },
  );
}
