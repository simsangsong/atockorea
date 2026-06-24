import { agentCatalog, siteOrigin } from "@/lib/agent-channel/site";

/**
 * GET /llms.txt — the agent "front door".
 *
 * A dense, token-efficient summary of what AtoC Korea sells and how an AI
 * agent can discover, price, and book it. Generated from the live catalogue so
 * it never drifts. Companion files: /agents.md (rules), /feed/tours.json
 * (machine catalogue), /api/mcp (MCP server), /feed/openapi.json (REST spec).
 */

export const revalidate = 3600;

export async function GET() {
  const origin = siteOrigin();
  const tours = agentCatalog();
  const byRegion = new Map<string, number>();
  for (const t of tours) {
    const key = t.region || "Korea";
    byRegion.set(key, (byRegion.get(key) ?? 0) + 1);
  }
  const regionLines = [...byRegion.entries()]
    .map(([r, n]) => `- ${r}: ${n} tours`)
    .join("\n");

  const topTours = tours
    .slice(0, 25)
    .map((t) => `- [${t.title}](${t.detailUrl}) — ${t.region}, ${t.duration}, from $${t.priceFromUsd}`)
    .join("\n");

  const body = `# AtoC Korea

> Private and small-group guided tours across South Korea (Jeju, Busan, Seoul/Gyeonggi,
> DMZ, and cruise shore excursions). Local licensed guides, private vehicles, multi-language
> (English, Korean, Chinese, Japanese, Spanish). Build a fixed catalogue tour or a fully
> custom day itinerary, get an instant authoritative quote, and book online.

This file helps AI agents discover and transact with AtoC Korea efficiently.
Prefer the structured endpoints below over scraping HTML.

## For AI agents — start here

- Machine catalogue (all bookable tours): ${origin}/feed/tours.json
- REST API spec (OpenAPI 3.1): ${origin}/feed/openapi.json
- MCP server (search / detail / quote / book-hold tools): ${origin}/api/mcp
- MCP discovery card: ${origin}/.well-known/mcp/server-card.json
- UCP manifest (Universal Commerce Protocol): ${origin}/.well-known/ucp/manifest.json
- ACP product feed (Agentic Commerce Protocol): ${origin}/feed/acp-products.json
- Agent rules & policies: ${origin}/agents.md
- Sitemap: ${origin}/sitemap.xml

## What you can do programmatically (MCP tools)

- searchTours(query, region?) — find tours in the fixed catalogue.
- getTour(slug) — full details + booking URL for one tour.
- getQuote(region, track, durationHours, pax, guideLanguage, date?, ...) —
  authoritative custom private-tour price in KRW, itemized. This is the real
  pricing engine, not an estimate.
- createBookingHold(region, pax, requestedDate, contactEmail, ...) — create a
  PENDING booking + payment hold and get a checkout URL. Never charges a card.

## How booking works (human-confirmed payment)

1. Discover a tour (catalogue) or design a custom itinerary.
2. Price it: getQuote (custom) or the listed 'from' price (catalogue).
3. Create a pending booking + Stripe payment hold: createBookingHold (MCP) or
   POST ${origin}/api/itinerary/book (server recomputes the price; mismatches
   are rejected — quotes cannot be spoofed). Returns a checkout URL.
4. Final payment is confirmed by a human via Stripe checkout. Agents create the
   hold; people authorize the charge. We do not auto-charge cards from an agent.

## Trust signals

- Prices are computed server-side and re-validated at booking. An agent-supplied
  total that disagrees with the engine is rejected (HTTP 409).
- Out-of-scope requests (e.g. 14+ pax private, 28+ pax DMZ) return HTTP 422 with a
  contact path instead of a false promise.
- Operated by AtoC Korea, a licensed Korea-based travel agency.

## Regions

${regionLines}

## Selected tours

${topTours}

## Contact / escalation

- Support: ${origin}/support
- Contact: ${origin}/contact
`;

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600, s-maxage=3600",
      "access-control-allow-origin": "*",
    },
  });
}
