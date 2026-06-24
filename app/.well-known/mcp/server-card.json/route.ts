import { siteOrigin } from "@/lib/agent-channel/site";

/**
 * GET /.well-known/mcp/server-card.json — MCP discovery card (SEP-1649).
 *
 * Lets MCP-aware clients (Claude, ChatGPT, Cursor, …) auto-discover the AtoC
 * Korea MCP server, its transport, and its tools without manual config.
 */

export const revalidate = 3600;

export async function GET() {
  const origin = siteOrigin();
  return Response.json(
    {
      schemaVersion: "2025-06-18",
      name: "atockorea",
      description:
        "AtoC Korea — search private/small-group Korea tours, get authoritative custom-tour quotes, and start bookings.",
      version: "1.0.0",
      provider: { name: "AtoC Korea", url: origin },
      transport: { type: "streamable-http", url: `${origin}/api/mcp` },
      capabilities: { tools: true },
      tools: [
        { name: "searchTours", description: "Search the tour catalogue." },
        { name: "getTour", description: "Get one tour's details + booking URL." },
        { name: "getQuote", description: "Authoritative custom private-tour price (KRW)." },
        { name: "createBookingHold", description: "Create a pending booking + payment hold (human confirms payment)." },
      ],
      documentation: `${origin}/llms.txt`,
    },
    {
      headers: {
        "cache-control": "public, max-age=3600, s-maxage=3600",
        "access-control-allow-origin": "*",
      },
    },
  );
}
