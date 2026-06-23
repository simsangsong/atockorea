import { siteOrigin } from "@/lib/agent-channel/site";

/**
 * GET /feed/openapi.json — OpenAPI 3.1 spec for agents that don't speak MCP.
 *
 * Documents the read-only catalogue feed and the booking-hold endpoint so a
 * plain HTTP agent can transact. The MCP server (/api/mcp) is the richer path.
 */

export const revalidate = 3600;

export async function GET() {
  const origin = siteOrigin();
  return Response.json(
    {
      openapi: "3.1.0",
      info: {
        title: "AtoC Korea — Agent API",
        version: "1.0.0",
        description:
          "Discover tours and create booking holds. Pricing is server-authoritative; " +
          "final payment is confirmed by a human via Stripe.",
      },
      servers: [{ url: origin }],
      paths: {
        "/feed/tours.json": {
          get: {
            operationId: "listTours",
            summary: "Machine-readable catalogue of all bookable tours.",
            responses: { "200": { description: "Tour catalogue (ItemList)." } },
          },
        },
        "/api/itinerary/book": {
          post: {
            operationId: "createBookingHold",
            summary: "Create a pending custom-tour booking with a Stripe payment hold.",
            description:
              "Server recomputes the price; a client_quoted_total mismatch (> ₩1) returns 409. " +
              "Out-of-scope group sizes return 422. Final payment is confirmed by a human.",
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: [
                      "region",
                      "track",
                      "guide_language",
                      "duration_hours",
                      "party_size",
                      "requested_date",
                      "contact_name",
                      "contact_email",
                    ],
                    properties: {
                      region: { type: "string", enum: ["busan", "jeju", "seoul"] },
                      track: { type: "string", enum: ["private", "cruise", "dmz"] },
                      guide_language: { type: "string", example: "en" },
                      duration_hours: { type: "integer", example: 8 },
                      party_size: { type: "integer", example: 2 },
                      requested_date: { type: "string", format: "date" },
                      poi_keys: { type: "array", items: { type: "string" } },
                      jejuPickupZone: { type: "string", enum: ["city", "out_west", "out_east", "out_south"] },
                      cruisePort: { type: "string", enum: ["gangjeong", "jeju_port"] },
                      contact_name: { type: "string" },
                      contact_email: { type: "string", format: "email" },
                      contact_phone: { type: "string" },
                      notes: { type: "string" },
                      client_quoted_total: { type: "integer", description: "Optional price check (KRW)." },
                    },
                  },
                },
              },
            },
            responses: {
              "200": { description: "Pending booking created; proceed to Stripe checkout." },
              "409": { description: "Quoted total mismatch — re-fetch the quote." },
              "422": { description: "Out of auto-bookable scope — route to /contact." },
            },
          },
        },
      },
    },
    {
      headers: {
        "cache-control": "public, max-age=3600, s-maxage=3600",
        "access-control-allow-origin": "*",
      },
    },
  );
}
