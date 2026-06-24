import { NextResponse } from "next/server";
import { agentSiteUrl } from "@/lib/agent/catalog";

/**
 * GET /.well-known/ai-plugin.json — plugin-style manifest.
 *
 * Follows the widely-recognised ai-plugin.json shape so tools that still probe
 * for it can auto-discover our OpenAPI contract. The model-facing description
 * tells an assistant exactly how to use the channel and that it must not charge.
 */
export const runtime = "nodejs";

export function GET() {
  const base = agentSiteUrl();

  return NextResponse.json(
    {
      schema_version: "v1",
      name_for_human: "AtoC Korea Tours",
      name_for_model: "atoc_korea",
      description_for_human: "Discover and book private & small-group Korea day tours.",
      description_for_model:
        "Use to search AtoC Korea's Korea tour catalogue, get a signed price quote for a date and party size, and create a booking handoff. The booking step returns a hosted checkout URL where the human traveller confirms and pays — never attempt to charge a card yourself. Prices are server-authoritative; pass the quote_token from quote to book.",
      auth: { type: "none" },
      api: { type: "openapi", url: `${base}/api/agent/openapi.json` },
      logo_url: `${base}/atoc-oauth-logo-240.png`,
      contact_email: "contact@atockorea.com",
      legal_info_url: `${base}/terms`,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=600, s-maxage=3600",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}
