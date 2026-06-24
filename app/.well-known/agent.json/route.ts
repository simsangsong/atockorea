import { NextResponse } from "next/server";
import { agentSiteUrl } from "@/lib/agent/catalog";

/**
 * GET /.well-known/agent.json — discovery manifest for AI agents.
 *
 * A single well-known document an agent (or its platform) can fetch to learn,
 * without scraping, that this site offers a machine channel: where the catalog,
 * quote, book, MCP, and OpenAPI surfaces live, and crucially the payment model
 * (the human pays at hosted checkout — the agent never charges a card).
 *
 * Mirrors the posture of emerging agentic-commerce discovery conventions
 * without committing to any single in-flux delegated-payment standard.
 */
export const runtime = "nodejs";

export function GET() {
  const base = agentSiteUrl();

  return NextResponse.json(
    {
      schema_version: "0.1",
      name: "AtoC Korea",
      description:
        "Private & small-group Korea day tours. Open AI-agent channel: discover tours, get signed price quotes, and hand the traveller to hosted checkout. Agents never charge cards.",
      url: base,
      contact_email: "contact@atockorea.com",
      payment: {
        model: "human_confirms_at_hosted_checkout",
        agent_charges_card: false,
        currency: "USD",
      },
      pricing: {
        deterministic: true,
        signed_quotes: true,
        quote_ttl_seconds: 900,
      },
      auth: {
        read: "none",
        quote: "none",
        book: "none (hosted-checkout handoff)",
        api_key_header: "x-api-key",
        api_key_note: "Optional. Raises rate limits; request a key at contact@atockorea.com.",
      },
      endpoints: {
        catalog: `${base}/api/agent/v1/tours`,
        tour: `${base}/api/agent/v1/tours/{slug}`,
        quote: `${base}/api/agent/v1/quote`,
        book: `${base}/api/agent/v1/book`,
        openapi: `${base}/api/agent/openapi.json`,
        llms_txt: `${base}/llms.txt`,
        docs: `${base}/for-agents`,
      },
      mcp: {
        url: `${base}/api/agent/mcp`,
        transport: "streamable-http",
        protocol: "Model Context Protocol",
        tools: ["search_tours", "get_tour", "quote_price", "create_booking"],
      },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=600, s-maxage=3600",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}
