import { NextResponse } from 'next/server';
import { listAgentCatalog, agentSiteUrl } from '@/lib/agent/catalog';

/**
 * GET /feed/acp-products.json — the product feed agentic-commerce crawlers read.
 *
 * The AI-agent channel itself already shipped (`/llms.txt`,
 * `/.well-known/agent.json`, `/api/agent/v1/*`, `/for-agents`). What was
 * missing is the FEED shape: discovery agents and commerce protocols look for a
 * flat product list at a conventional path, not an API they have to learn
 * first. A channel nobody can find is not a channel.
 *
 * Deliberately a projection of `lib/agent/catalog`, not a second source of
 * truth — an older branch carried a parallel `lib/agent-channel/site.ts` and
 * that is exactly the drift this avoids. One catalogue, many envelopes.
 *
 * 🔴 The price here is a LIST price per traveller, and it says so. The
 * authoritative number is the signed quote from `/api/agent/v1/quote`; agents
 * never charge cards (see `.well-known/agent.json` → payment). A feed that
 * implied a chargeable total would be lying about how this business works.
 */

export const revalidate = 3600;

export async function GET() {
  const base = agentSiteUrl();
  const items = listAgentCatalog();

  return NextResponse.json(
    {
      version: '1.0',
      generated_at: new Date().toISOString(),
      merchant: {
        name: 'AtoC Korea',
        url: base,
        contact_email: 'contact@atockorea.com',
      },
      /** How a purchase actually completes — mirrors .well-known/agent.json. */
      fulfillment: {
        model: 'human_confirms_at_hosted_checkout',
        agent_charges_card: false,
        quote_endpoint: `${base}/api/agent/v1/quote`,
      },
      products: items.map((t) => ({
        id: t.slug,
        title: t.title,
        description: t.summary,
        link: t.url,
        detail_link: t.detail_url,
        image_link: t.hero_image,
        additional_image_link: t.thumbnail,
        availability: 'in_stock',
        condition: 'new',
        brand: 'AtoC Korea',
        product_type: 'Travel > Tours & Activities',
        // Per-traveller list price. Totals depend on party size and options and
        // are only final in a signed quote.
        price: { value: t.price_usd, currency: 'USD', unit: 'per_traveller' },
        ...(t.compare_at_price_usd
          ? { compare_at_price: { value: t.compare_at_price_usd, currency: 'USD' } }
          : {}),
        rating: { value: t.rating, count: t.review_count },
        attributes: {
          region: t.region,
          duration: t.duration,
          stops: t.stops,
          max_group_size: t.max_group_size,
          badges: [...t.badges],
        },
      })),
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        // Feeds are meant to be fetched cross-origin by crawlers.
        'Access-Control-Allow-Origin': '*',
      },
    },
  );
}
