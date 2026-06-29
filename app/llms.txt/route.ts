import { listAgentCatalog, agentSiteUrl } from "@/lib/agent/catalog";

/**
 * GET /llms.txt — the front door for LLMs and AI agents.
 *
 * Follows the emerging llms.txt convention: a concise, link-rich Markdown
 * index an LLM reads first to understand what the site is and where the
 * machine-readable surfaces live. Lists the agent API, the OpenAPI contract,
 * and the live tour catalogue.
 */
export const runtime = "nodejs";
export const revalidate = 3600;

export function GET() {
  const base = agentSiteUrl();
  const tours = listAgentCatalog().slice(0, 40);

  const tourLines = tours
    .map((t) => `- [${t.title}](${t.url}): ${t.region} · ${t.duration} · from $${t.price_usd} — ${t.summary}`)
    .join("\n");

  const body = `# AtoC Korea

> Private and small-group day tours across Korea (Jeju, Busan, Seoul, DMZ and more), run by local guides. AtoC Korea offers an open AI-agent channel so assistants can discover tours, get signed price quotes, and hand travellers to a hosted checkout. Agents never charge cards — the traveller confirms and pays.

## For AI agents

- [Agent API (OpenAPI 3.1)](${base}/api/agent/openapi.json): the machine contract for the agent channel.
- [Agent developer guide](${base}/for-agents): how to discover, quote, and book.
- [Tour catalogue (JSON)](${base}/api/agent/v1/tours): list every bookable tour.
- Availability: \`GET ${base}/api/agent/v1/tours/{slug}/availability?date=YYYY-MM-DD\` → best-effort open/sold-out.
- Quote: \`POST ${base}/api/agent/v1/quote\` with \`{ slug, date, guests }\` → signed quote_token.
- Book: \`POST ${base}/api/agent/v1/book\` with \`{ quote_token, contact? }\` → hosted checkout_url for the human to pay.
- MCP server (Model Context Protocol, Streamable HTTP): \`${base}/api/agent/mcp\` — tools: search_tours, get_tour, check_availability, quote_price, create_booking.
- Discovery manifests: [\`/.well-known/agent.json\`](${base}/.well-known/agent.json), [\`/.well-known/ai-plugin.json\`](${base}/.well-known/ai-plugin.json).

## Site

- [Tours](${base}/tours/list): browse all tours.
- [Sitemap](${base}/sitemap.xml)
- [Contact](${base}/contact): contact@atockorea.com

## Tours

${tourLines}
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
