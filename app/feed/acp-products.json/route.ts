import { agentCatalog, siteOrigin } from "@/lib/agent-channel/site";

/**
 * GET /feed/acp-products.json — Agentic Commerce Protocol (ACP) product feed.
 *
 * ACP-shaped product feed (the schema OpenAI/ChatGPT ingests for discovery).
 * We expose it so AtoC Korea is searchable in ACP surfaces. enable_checkout is
 * false: ACP "Instant Checkout" relies on delegated payment (agent auto-charge),
 * which we deliberately do not do — bookings go through a hold that a human
 * confirms (see /llms.txt, /.well-known/ucp/manifest.json). enable_search is
 * true so the catalogue is discoverable.
 *
 * Note: production ACP onboarding pushes this feed (gzipped JSONL) to an
 * OpenAI-provided endpoint; this route is the canonical source to push.
 */

export const revalidate = 3600;

function clip(s: string, max: number): string {
  const t = (s ?? "").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

export async function GET() {
  const origin = siteOrigin();

  const products = agentCatalog().map((t) => ({
    id: t.slug,
    title: clip(t.title, 150),
    description: clip(t.summary || t.subtitle || t.title, 5000),
    link: t.detailUrl,
    image_link: t.image,
    price: t.priceFromUsd.toFixed(2),
    currency: "USD", // ISO 4217
    availability: "in_stock",
    product_category: "Tours & Activities",
    brand: "AtoC Korea",
    seller_name: "AtoC Korea",
    item_group: t.region,
    rating: t.rating,
    review_count: t.reviewCount,
    max_group_size: t.maxGroupSize,
    enable_search: true,
    enable_checkout: false, // no agent auto-charge; booking hold is human-confirmed
  }));

  return Response.json(
    {
      version: "2026-04-17",
      merchant: { name: "AtoC Korea", url: origin, payment_provider: "stripe" },
      checkout_enabled: false,
      checkout_note:
        "Discovery only. Booking is via a human-confirmed hold (createBookingHold / " +
        "POST /api/itinerary/book), not ACP delegated-payment instant checkout.",
      product_count: products.length,
      products,
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
