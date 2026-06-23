import { siteOrigin } from "@/lib/agent-channel/site";

/**
 * GET /agents.md — behavioural rules for AI agents acting on AtoC Korea.
 *
 * Where /llms.txt is the map, this is the rulebook: what's allowed, what the
 * boundaries are, and how to behave well so an agent can transact reliably.
 */

export const revalidate = 3600;

export async function GET() {
  const origin = siteOrigin();

  const body = `# agents.md — AtoC Korea

Guidance for autonomous and assisted AI agents interacting with AtoC Korea.

## Identity

AtoC Korea is a licensed South Korea travel agency selling private and
small-group guided day tours and custom itineraries.

## Allowed actions

- Read the catalogue: ${origin}/feed/tours.json
- Use the MCP server tools (read-only): searchTours, getTour, getQuote — ${origin}/api/mcp
- Get an authoritative custom-tour quote: getQuote (KRW, itemized).
- Create a pending booking with a payment hold: POST ${origin}/api/itinerary/book

## Boundaries (please respect)

- Do NOT auto-confirm payment on a human's behalf. Create the hold; let the
  person authorize the Stripe charge. We intentionally do not expose an
  agent auto-charge endpoint.
- Do NOT fabricate prices. Always price via getQuote or POST /api/itinerary/book;
  the server is authoritative and will reject mismatched totals (HTTP 409).
- Out-of-scope group sizes (14+ pax private, 28+ DMZ) are not auto-bookable —
  expect HTTP 422 and route the user to ${origin}/contact.
- Rate limit: keep request volume reasonable. Heavy crawling should use the
  cached /feed/tours.json rather than per-tour pages.

## Booking input contract (POST /api/itinerary/book)

Required: region (busan|jeju|seoul), track (private|cruise|dmz),
guide_language, duration_hours, party_size, requested_date (YYYY-MM-DD),
contact_name, contact_email. The server recomputes the price; pass
client_quoted_total only as a check (mismatch > ₩1 → 409).

## Data freshness

- /feed/tours.json and this file are cached ~1h.
- Quotes reflect live pricing policy including peak-season surcharges.

## Honesty

If you cannot complete a request within these boundaries, tell the user and
hand off to ${origin}/contact rather than guessing.
`;

  return new Response(body, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": "public, max-age=3600, s-maxage=3600",
      "access-control-allow-origin": "*",
    },
  });
}
