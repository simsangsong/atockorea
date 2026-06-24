import { NextResponse } from "next/server";
import { agentSiteUrl } from "@/lib/agent/catalog";

/**
 * GET /api/agent/openapi.json — the machine contract for the agent channel.
 *
 * An OpenAPI 3.1 description of /api/agent/v1/*. Agents (and the platforms that
 * onboard them) read this to learn how to discover, price, and hand off
 * bookings without scraping HTML. A documented, versioned contract is the
 * single biggest trust signal we can offer an automated buyer.
 */
export const runtime = "nodejs";

export function GET() {
  const base = agentSiteUrl();

  const spec = {
    openapi: "3.1.0",
    info: {
      title: "AtoC Korea — AI Agent Channel",
      version: "1.0.0",
      description:
        "Machine-readable channel for AI agents to discover Korea private/small-group tours, get signed price quotes, and hand a traveller to hosted checkout. Agents never charge cards — payment is confirmed by the human at checkout.",
      contact: { name: "AtoC Korea", email: "contact@atockorea.com", url: base },
    },
    servers: [{ url: base }],
    paths: {
      "/api/agent/v1/tours": {
        get: {
          operationId: "listTours",
          summary: "List the tour catalogue",
          parameters: [
            { name: "region", in: "query", schema: { type: "string" }, description: "Filter by region (e.g. jeju, busan, seoul)" },
            { name: "search", in: "query", schema: { type: "string" }, description: "Free-text search over title/summary/badges" },
            { name: "limit", in: "query", schema: { type: "integer", default: 50, maximum: 100 } },
            { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
          ],
          responses: { "200": { description: "Tour catalogue page" } },
        },
      },
      "/api/agent/v1/tours/{slug}": {
        get: {
          operationId: "getTour",
          summary: "Get one tour's full record",
          parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Tour record" }, "404": { description: "Not found" } },
        },
      },
      "/api/agent/v1/quote": {
        post: {
          operationId: "createQuote",
          summary: "Issue a signed price quote for a date and party size",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["slug", "date", "guests"],
                  properties: {
                    slug: { type: "string" },
                    date: { type: "string", format: "date", description: "YYYY-MM-DD, today or later" },
                    guests: { type: "integer", minimum: 1 },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Quote with a signed quote_token (valid 15 minutes)" },
            "404": { description: "Tour not found" },
            "422": { description: "Party larger than the tour allows" },
          },
        },
      },
      "/api/agent/v1/book": {
        post: {
          operationId: "bookFromQuote",
          summary: "Exchange a quote_token for a hosted-checkout URL (human pays)",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["quote_token"],
                  properties: {
                    quote_token: { type: "string", description: "From POST /api/agent/v1/quote" },
                    contact: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        email: { type: "string", format: "email" },
                        phone: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Booking handoff with checkout_url" },
            "409": { description: "Quote token invalid or expired — re-quote" },
          },
        },
      },
    },
    "x-agent-channel": {
      payment_model: "human_confirms_at_hosted_checkout",
      pricing: "deterministic, server-authoritative, signed quote tokens",
      auth: "none required for read/quote; bookings hand off to hosted checkout",
      llms_txt: `${base}/llms.txt`,
      docs: `${base}/for-agents`,
      well_known: {
        agent: `${base}/.well-known/agent.json`,
        ai_plugin: `${base}/.well-known/ai-plugin.json`,
      },
      mcp: {
        url: `${base}/api/agent/mcp`,
        transport: "streamable-http",
        protocol: "Model Context Protocol",
        tools: ["search_tours", "get_tour", "quote_price", "create_booking"],
      },
    },
  };

  return NextResponse.json(spec, {
    headers: {
      "Cache-Control": "public, max-age=600, s-maxage=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
