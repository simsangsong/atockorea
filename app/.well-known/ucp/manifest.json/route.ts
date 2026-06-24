import { siteOrigin } from "@/lib/agent-channel/site";

/**
 * GET /.well-known/ucp/manifest.json — Universal Commerce Protocol manifest.
 *
 * The discovery layer Google AI Mode / Gemini (and other UCP agents) fetch to
 * learn which commerce capabilities AtoC Korea supports and how to reach them.
 * Public, unauthenticated, application/json.
 *
 * Honesty posture: we declare catalog + authoritative quoting + a HOLD-style
 * checkout. We explicitly do NOT support agent auto-charge (no delegated
 * payment / AP2 mandate yet) — a human confirms the Stripe charge. The
 * declared capabilities match what /api/mcp and /api/itinerary/book actually do.
 */

export const revalidate = 3600;

export async function GET() {
  const origin = siteOrigin();

  return Response.json(
    {
      ucp_version: "2026-01",
      provider: {
        name: "AtoC Korea",
        type: "TravelAgency",
        url: origin,
        area_served: "KR",
        contact: "contact@atockorea.com",
      },
      capabilities: {
        catalog_search: {
          enabled: true,
          transports: ["mcp"],
          tool: "searchTours",
          feed: `${origin}/feed/tours.json`,
        },
        catalog_lookup: {
          enabled: true,
          transports: ["mcp"],
          tool: "getTour",
        },
        quote: {
          enabled: true,
          transports: ["mcp"],
          tool: "getQuote",
          currency: "KRW",
          authoritative: true,
        },
        cart: { enabled: false },
        checkout: {
          enabled: true,
          mode: "hold_then_human_confirm",
          auto_charge: false,
          confirmation: "human",
          transports: ["mcp", "rest"],
          tool: "createBookingHold",
          endpoint: `${origin}/api/itinerary/book`,
          note:
            "Agents create a pending booking + Stripe payment hold; a human " +
            "authorizes the actual charge. No agent auto-charge.",
        },
        order_management: { enabled: false },
      },
      transports: [
        {
          type: "mcp",
          protocol: "streamable-http",
          url: `${origin}/api/mcp`,
          discovery: `${origin}/.well-known/mcp/server-card.json`,
        },
        { type: "rest", openapi: `${origin}/feed/openapi.json` },
      ],
      payments: {
        provider: "stripe",
        agent_payment_protocols: [], // none yet — AP2 mandate support is future work
        agent_auto_charge: false,
        confirmation: "human",
      },
      feeds: {
        ucp_catalog: `${origin}/feed/tours.json`,
        acp_products: `${origin}/feed/acp-products.json`,
      },
      documentation: `${origin}/llms.txt`,
      signatures: null, // feed signing not enabled yet
    },
    {
      headers: {
        "cache-control": "public, max-age=3600, s-maxage=3600",
        "access-control-allow-origin": "*",
      },
    },
  );
}
