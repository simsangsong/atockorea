import { NextResponse } from 'next/server';
import { agentSiteUrl } from '@/lib/agent/catalog';

/**
 * GET /.well-known/mcp/server-card.json — how an MCP client DISCOVERS this
 * server without being told the URL first.
 *
 * The MCP endpoint itself already exists at `/api/agent/mcp`. Discovery did
 * not: a client that has only the domain had no conventional place to look, so
 * the endpoint was reachable only by someone who had already read our docs.
 * That is the difference between "we have an agent channel" and "agents find
 * our agent channel".
 *
 * The card restates the payment posture on purpose. An MCP client deciding
 * whether to engage should learn "this merchant hands off to hosted checkout
 * and never lets an agent charge a card" from the card, not after a failed
 * booking attempt.
 */

export const revalidate = 3600;

export async function GET() {
  const base = agentSiteUrl();

  return NextResponse.json(
    {
      schema_version: '2024-11-05',
      name: 'atockorea',
      display_name: 'AtoC Korea',
      description:
        'Private & small-group Korea day tours. Discover tours, get signed price quotes, and hand the traveller to hosted checkout.',
      website: base,
      contact_email: 'contact@atockorea.com',
      transport: {
        type: 'http',
        url: `${base}/api/agent/mcp`,
      },
      auth: { type: 'none', note: 'Read and quote are open; booking is a hosted-checkout handoff.' },
      payment: {
        model: 'human_confirms_at_hosted_checkout',
        agent_charges_card: false,
        currency: 'USD',
      },
      related: {
        openapi: `${base}/api/agent/openapi.json`,
        agent_manifest: `${base}/.well-known/agent.json`,
        product_feed: `${base}/feed/acp-products.json`,
        human_docs: `${base}/for-agents`,
        llms_txt: `${base}/llms.txt`,
      },
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        'Access-Control-Allow-Origin': '*',
      },
    },
  );
}
