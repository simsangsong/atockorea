import { NextRequest, NextResponse } from "next/server";
import {
  listAgentCatalog,
  getAgentCatalogItem,
  agentSiteUrl,
} from "@/lib/agent/catalog";
import { signQuote, verifyQuote, AGENT_QUOTE_TTL_SECONDS } from "@/lib/agent/quoteToken";
import { buildCheckoutUrl } from "@/lib/agent/checkoutUrl";
import { rateLimit, rateLimitHeaders } from "@/lib/agent/rateLimit";
import { recordReservation } from "@/lib/agent/reservation";

/**
 * POST /api/agent/mcp — Model Context Protocol server (Streamable HTTP).
 *
 * The AI-native channel: instead of reading docs and crafting REST calls, an
 * MCP-capable assistant (Claude, etc.) connects here and calls tools directly —
 * search_tours, get_tour, quote_price, create_booking. Same trust model as the
 * REST channel: deterministic signed quotes, and create_booking returns a
 * hosted checkout URL where the human pays (the agent never charges a card).
 *
 * Stateless JSON-RPC 2.0 over HTTP. We respond with `application/json` (the
 * Streamable HTTP transport permits this in place of an SSE stream for servers
 * that don't push server-initiated messages). No session is required for a
 * tools-only server.
 */
export const runtime = "nodejs";

const PROTOCOL_VERSION = "2025-06-18";
const SERVER_INFO = { name: "atoc-korea-agent", version: "1.0.0" };
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Mcp-Session-Id, MCP-Protocol-Version",
};

// ── Tool catalogue ──────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "search_tours",
    description:
      "Search AtoC Korea's catalogue of private & small-group Korea day tours. Filter by region (jeju, busan, seoul) and/or free-text. Returns title, region, duration, USD price, rating, and the checkout URL.",
    inputSchema: {
      type: "object",
      properties: {
        region: { type: "string", description: "Region filter, e.g. jeju / busan / seoul" },
        search: { type: "string", description: "Free-text over title, summary, badges" },
        limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
      },
    },
  },
  {
    name: "get_tour",
    description: "Get the full record for one tour by its slug.",
    inputSchema: {
      type: "object",
      properties: { slug: { type: "string" } },
      required: ["slug"],
    },
  },
  {
    name: "quote_price",
    description:
      "Get a signed price quote for a tour on a date and party size. Returns a quote_token (valid 15 minutes) to pass to create_booking. Prices are server-authoritative — they cannot be invented.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD, today or later" },
        guests: { type: "integer", minimum: 1 },
      },
      required: ["slug", "date", "guests"],
    },
  },
  {
    name: "create_booking",
    description:
      "Exchange a quote_token for a hosted checkout URL. The agent does NOT charge — share the returned checkout_url with the traveller, who confirms and pays on AtoC Korea's checkout.",
    inputSchema: {
      type: "object",
      properties: {
        quote_token: { type: "string", description: "From quote_price" },
        contact: {
          type: "object",
          properties: {
            name: { type: "string" },
            email: { type: "string" },
            phone: { type: "string" },
          },
        },
        idempotency_key: {
          type: "string",
          description: "Optional. Reuse to make retries return the same reservation.",
        },
      },
      required: ["quote_token"],
    },
  },
] as const;

// ── Tool implementations (return a JSON-serialisable result object) ──────────

function isYmd(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime());
}
function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

type ToolError = { error: string; detail?: string; [k: string]: unknown };

async function runTool(
  name: string,
  args: Record<string, unknown>,
  ctx: { apiKeyLabel: string | null },
): Promise<unknown | ToolError> {
  switch (name) {
    case "search_tours": {
      const region = typeof args.region === "string" ? args.region : null;
      const search = typeof args.search === "string" ? args.search : null;
      const limit = Math.min(Math.max(Number(args.limit) || 20, 1), 100);
      const tours = listAgentCatalog({ region, search }).slice(0, limit);
      return { count: tours.length, currency: "USD", tours };
    }
    case "get_tour": {
      const slug = typeof args.slug === "string" ? args.slug : "";
      const item = slug ? getAgentCatalogItem(slug) : null;
      if (!item) return { error: "tour_not_found", slug };
      return { tour: item };
    }
    case "quote_price": {
      const slug = typeof args.slug === "string" ? args.slug.trim() : "";
      const item = slug ? getAgentCatalogItem(slug) : null;
      if (!item) return { error: "tour_not_found", slug };
      const date = typeof args.date === "string" ? args.date.trim() : "";
      if (!isYmd(date)) return { error: "invalid_date", detail: "date must be YYYY-MM-DD" };
      const todayUtc = new Date().toISOString().slice(0, 10);
      if (date < todayUtc) return { error: "date_in_past", detail: `date must be on or after ${todayUtc}` };
      const guestsNum = Number(args.guests);
      if (!Number.isFinite(guestsNum) || guestsNum < 1) {
        return { error: "invalid_guests", detail: "guests must be a positive integer" };
      }
      const guests = Math.round(guestsNum);
      if (item.max_group_size != null && guests > item.max_group_size) {
        return {
          error: "party_too_large",
          max_group_size: item.max_group_size,
          detail: `This tour seats up to ${item.max_group_size}. For larger groups, contact contact@atockorea.com.`,
        };
      }
      const unitPriceUsd = item.price_usd;
      const estimatedTotalUsd = Math.round(unitPriceUsd * guests * 100) / 100;
      const { token, payload } = signQuote({ slug: item.slug, date, guests, unitPriceUsd, estimatedTotalUsd });
      return {
        slug: item.slug,
        title: item.title,
        date,
        guests,
        currency: "USD",
        unit_price_usd: unitPriceUsd,
        estimated_total_usd: estimatedTotalUsd,
        pricing_basis: "per_person_estimate",
        final_price_confirmed_at_checkout: true,
        quote_token: token,
        expires_at: new Date(payload.exp * 1000).toISOString(),
        ttl_seconds: AGENT_QUOTE_TTL_SECONDS,
      };
    }
    case "create_booking": {
      const payload = verifyQuote(args.quote_token);
      if (!payload) {
        return { error: "invalid_or_expired_quote", detail: "Re-fetch a price with quote_price and retry." };
      }
      const item = getAgentCatalogItem(payload.slug);
      if (!item) return { error: "tour_not_found", slug: payload.slug };
      const contact =
        args.contact && typeof args.contact === "object" ? (args.contact as Record<string, unknown>) : null;
      const email = typeof contact?.email === "string" ? contact.email.trim() : "";
      if (email && !isEmail(email)) return { error: "invalid_contact_email" };
      const name = typeof contact?.name === "string" ? contact.name.trim() : "";
      const phone = typeof contact?.phone === "string" ? contact.phone.trim() : "";
      const checkoutUrl = buildCheckoutUrl(item, { date: payload.date, guests: payload.guests, name, email, phone });
      const idempotencyKey =
        typeof args.idempotency_key === "string" && args.idempotency_key.trim()
          ? args.idempotency_key.trim()
          : null;
      const reservation = await recordReservation({
        idempotencyKey,
        channel: "mcp",
        slug: item.slug,
        date: payload.date,
        guests: payload.guests,
        unitPriceUsd: payload.unitPriceUsd,
        estimatedTotalUsd: payload.estimatedTotalUsd,
        checkoutUrl,
        contact: { name, email, phone },
        apiKeyLabel: ctx.apiKeyLabel,
      });
      return {
        reservation_id: reservation.reservationId,
        idempotent_replay: reservation.replayed,
        status: "awaiting_traveller_confirmation",
        payment: "customer_confirms_and_pays_at_hosted_checkout",
        tour: { slug: item.slug, title: item.title, url: item.url },
        date: payload.date,
        guests: payload.guests,
        currency: "USD",
        unit_price_usd: payload.unitPriceUsd,
        estimated_total_usd: payload.estimatedTotalUsd,
        final_price_confirmed_at_checkout: true,
        checkout_url: reservation.checkoutUrl,
        message:
          "Share checkout_url with the traveller. They review and pay on AtoC Korea's hosted checkout — no card is charged by the agent.",
      };
    }
    default:
      return { error: "unknown_tool", detail: name };
  }
}

// ── JSON-RPC plumbing ────────────────────────────────────────────────────────

type JsonRpcId = string | number | null;
function rpcResult(id: JsonRpcId, result: unknown) {
  return { jsonrpc: "2.0" as const, id, result };
}
function rpcError(id: JsonRpcId, code: number, message: string, data?: unknown) {
  return { jsonrpc: "2.0" as const, id, error: { code, message, ...(data ? { data } : {}) } };
}

async function handleRpc(
  msg: Record<string, unknown>,
  ctx: { apiKeyLabel: string | null },
): Promise<object | null> {
  const id = (msg.id ?? null) as JsonRpcId;
  const method = typeof msg.method === "string" ? msg.method : "";
  const params = (msg.params ?? {}) as Record<string, unknown>;

  // Notifications (no id) — acknowledge with no response body.
  if (msg.id === undefined || msg.id === null) {
    if (method.startsWith("notifications/")) return null;
    // initialized handshake notification variants
    if (method === "initialized") return null;
  }

  switch (method) {
    case "initialize": {
      const clientProtocol =
        typeof params.protocolVersion === "string" ? params.protocolVersion : PROTOCOL_VERSION;
      return rpcResult(id, {
        protocolVersion: clientProtocol,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions:
          "AtoC Korea tours. Use search_tours / get_tour to browse, quote_price for a signed price, create_booking to get a hosted checkout URL for the traveller to pay. Agents never charge cards.",
      });
    }
    case "ping":
      return rpcResult(id, {});
    case "tools/list":
      return rpcResult(id, { tools: TOOLS });
    case "tools/call": {
      const toolName = typeof params.name === "string" ? params.name : "";
      const args = (params.arguments ?? {}) as Record<string, unknown>;
      if (!TOOLS.some((t) => t.name === toolName)) {
        return rpcError(id, -32602, `Unknown tool: ${toolName}`);
      }
      const out = await runTool(toolName, args, ctx);
      const isError = !!out && typeof out === "object" && "error" in (out as object);
      return rpcResult(id, {
        content: [{ type: "text", text: JSON.stringify(out, null, 2) }],
        structuredContent: out,
        isError,
      });
    }
    default:
      if (msg.id === undefined || msg.id === null) return null; // unknown notification
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

export async function POST(req: NextRequest) {
  const rl = rateLimit(req);
  if (!rl.ok) {
    return NextResponse.json(rpcError(null, -32000, "Rate limited"), {
      status: 429,
      headers: { ...CORS, ...rateLimitHeaders(rl) },
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(rpcError(null, -32700, "Parse error"), { status: 400, headers: CORS });
  }

  const ctx = { apiKeyLabel: rl.apiKeyLabel };

  // Batch or single.
  if (Array.isArray(body)) {
    const settled = await Promise.all(
      body.map((m) =>
        m && typeof m === "object" ? handleRpc(m as Record<string, unknown>, ctx) : Promise.resolve(null),
      ),
    );
    const responses = settled.filter((r): r is object => r !== null);
    if (responses.length === 0) return new NextResponse(null, { status: 202, headers: CORS });
    return NextResponse.json(responses, { headers: CORS });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json(rpcError(null, -32600, "Invalid Request"), { status: 400, headers: CORS });
  }

  const response = await handleRpc(body as Record<string, unknown>, ctx);
  if (response === null) return new NextResponse(null, { status: 202, headers: CORS });
  return NextResponse.json(response, { headers: CORS });
}

export function GET() {
  // Streamable HTTP GET opens an SSE stream for server-initiated messages.
  // This server is stateless/tools-only, so advertise capability info instead.
  return NextResponse.json(
    {
      object: "mcp_server",
      ...SERVER_INFO,
      protocolVersion: PROTOCOL_VERSION,
      transport: "streamable-http",
      tools: TOOLS.map((t) => t.name),
      note: "POST JSON-RPC 2.0 to this endpoint. See /for-agents and /api/agent/openapi.json.",
      docs: `${agentSiteUrl()}/for-agents`,
    },
    { headers: { ...CORS, "Cache-Control": "public, max-age=600" } },
  );
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
