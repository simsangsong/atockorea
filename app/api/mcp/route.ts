import { agentCatalog, siteOrigin } from "@/lib/agent-channel/site";
import {
  quote,
  tierForLocale,
  type GuideLanguageTier,
  type PriceInput,
  type PricingRegion,
  type PricingTrack,
} from "@/lib/quote-engine/pricing-policy";

/**
 * POST /api/mcp — Model Context Protocol server (stateless).
 *
 * A dependency-free JSON-RPC 2.0 endpoint over HTTP that exposes four tools
 * AI agents can call to transact with AtoC Korea:
 *   - searchTours:       find catalogue tours
 *   - getTour:           full details + booking URL for one tour
 *   - getQuote:          authoritative custom private-tour price (KRW, itemized)
 *   - createBookingHold: create a PENDING booking + Stripe payment hold
 *
 * createBookingHold deliberately stops at a hold — it never charges a card.
 * It reuses POST /api/itinerary/book (server-authoritative price recompute,
 * out-of-scope gate, DB write) and returns a checkout URL where a HUMAN
 * confirms payment. There is no agent auto-charge path by design.
 *
 * Discovery: /.well-known/mcp/server-card.json, advertised in /llms.txt.
 */

export const runtime = "nodejs";

const PROTOCOL_VERSION = "2025-06-18";
const SERVER_INFO = { name: "atockorea", version: "1.0.0" };

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type, mcp-protocol-version, authorization",
};

// ── Tool definitions (JSON Schema) ──────────────────────────────────────────

const TOOLS = [
  {
    name: "searchTours",
    description:
      "Search AtoC Korea's fixed tour catalogue by free-text query and optional region. " +
      "Returns matching tours with slug, region, duration, 'from' price (USD), rating, and booking URL.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Free-text intent, e.g. 'jeju nature day tour'." },
        region: { type: "string", description: "Optional region filter, e.g. 'jeju', 'busan', 'seoul'." },
        limit: { type: "integer", description: "Max results (1-20, default 8).", minimum: 1, maximum: 20 },
      },
      required: ["query"],
    },
  },
  {
    name: "getTour",
    description: "Get full details and the booking URL for one catalogue tour by its slug.",
    inputSchema: {
      type: "object",
      properties: { slug: { type: "string", description: "Tour slug from searchTours." } },
      required: ["slug"],
    },
  },
  {
    name: "getQuote",
    description:
      "Authoritative custom private-tour quote in KRW, computed by the live pricing engine " +
      "(not an estimate). Returns an itemized breakdown and whether it is auto-bookable.",
    inputSchema: {
      type: "object",
      properties: {
        region: { type: "string", enum: ["busan", "jeju", "seoul"] },
        track: { type: "string", enum: ["private", "cruise", "dmz"], description: "Tour track (default private)." },
        durationHours: { type: "integer", description: "Whole hours, 4-12+ (ignored for dmz).", minimum: 1 },
        pax: { type: "integer", description: "Number of travellers.", minimum: 1 },
        guideLanguage: {
          type: "string",
          description: "Guide language/locale: en, ko, zh, zh-TW, ja, es (or 'english'/'chinese').",
        },
        date: { type: "string", description: "Tour date YYYY-MM-DD (drives peak-season surcharges)." },
        jejuPickupZone: { type: "string", enum: ["city", "out_west", "out_east", "out_south"] },
        cruisePort: { type: "string", enum: ["gangjeong", "jeju_port"] },
      },
      required: ["region", "pax"],
    },
  },
  {
    name: "createBookingHold",
    description:
      "Create a PENDING custom-tour booking with a payment hold (no charge). The server " +
      "recomputes the price and rejects mismatches/out-of-scope requests. Returns a checkout " +
      "URL where a HUMAN confirms payment — agents never auto-charge a card.",
    inputSchema: {
      type: "object",
      properties: {
        region: { type: "string", enum: ["busan", "jeju", "seoul"] },
        track: { type: "string", enum: ["private", "cruise", "dmz"] },
        guideLanguage: { type: "string", description: "en, ko, zh, zh-TW, ja, es." },
        durationHours: { type: "integer", minimum: 1 },
        pax: { type: "integer", minimum: 1 },
        requestedDate: { type: "string", description: "Tour date YYYY-MM-DD." },
        contactName: { type: "string" },
        contactEmail: { type: "string", description: "Required — booking confirmation goes here." },
        contactPhone: { type: "string" },
        notes: { type: "string" },
        poiKeys: { type: "array", items: { type: "string" }, description: "Optional itinerary stops; empty = guide-curated." },
        jejuPickupZone: { type: "string", enum: ["city", "out_west", "out_east", "out_south"] },
        cruisePort: { type: "string", enum: ["gangjeong", "jeju_port"] },
        clientQuotedTotal: { type: "integer", description: "Optional KRW price check; mismatch > ₩1 is rejected (409)." },
      },
      required: ["region", "pax", "requestedDate", "contactEmail"],
    },
  },
] as const;

// ── Tool implementations ────────────────────────────────────────────────────

interface ToolResult {
  text: string;
  structured: unknown;
}

function toolSearchTours(args: Record<string, unknown>): ToolResult {
  const query = String(args.query ?? "").trim().toLowerCase();
  const region = typeof args.region === "string" ? args.region.trim().toLowerCase() : "";
  const limit = clampInt(args.limit, 8, 1, 20);
  const tokens = query.split(/\s+/).filter(Boolean);

  let results = agentCatalog();
  if (region) {
    results = results.filter((t) => t.region.toLowerCase().includes(region));
  }
  if (tokens.length > 0) {
    results = results
      .map((t) => {
        const hay = `${t.title} ${t.subtitle} ${t.region} ${t.summary}`.toLowerCase();
        const score = tokens.reduce((s, tok) => (hay.includes(tok) ? s + 1 : s), 0);
        return { t, score };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score || b.t.rating - a.t.rating)
      .map((r) => r.t);
  }
  results = results.slice(0, limit);

  return {
    text: results.length
      ? results
          .map((t) => `• ${t.title} (${t.slug}) — ${t.region}, ${t.duration}, from $${t.priceFromUsd}\n  ${t.detailUrl}`)
          .join("\n")
      : "No catalogue tours matched. Try a broader query or use getQuote for a custom itinerary.",
    structured: { count: results.length, tours: results },
  };
}

function toolGetTour(args: Record<string, unknown>): ToolResult {
  const slug = String(args.slug ?? "").trim();
  const tour = agentCatalog().find((t) => t.slug === slug);
  if (!tour) {
    return { text: `No tour found with slug '${slug}'.`, structured: { found: false } };
  }
  const bookHint = `${siteOrigin()}/itinerary-builder`;
  return {
    text:
      `${tour.title}\n${tour.subtitle}\nRegion: ${tour.region} | Duration: ${tour.duration} | ` +
      `Stops: ${tour.stops} | Rating: ${tour.rating} (${tour.reviewCount})\n` +
      `From $${tour.priceFromUsd}${tour.compareAtUsd ? ` (was $${tour.compareAtUsd})` : ""}` +
      `${tour.maxGroupSize ? ` | Max group: ${tour.maxGroupSize}` : ""}\n` +
      `${tour.summary}\nBook / view: ${tour.detailUrl}\nCustom itinerary: ${bookHint}`,
    structured: { found: true, tour, bookingUrl: tour.detailUrl, customItineraryUrl: bookHint },
  };
}

function toolGetQuote(args: Record<string, unknown>): ToolResult {
  const region = String(args.region ?? "") as PricingRegion;
  if (!["busan", "jeju", "seoul"].includes(region)) {
    return { text: "Invalid region. Use busan, jeju, or seoul.", structured: { error: "region_invalid" } };
  }
  const trackRaw = String(args.track ?? "private");
  const track: PricingTrack = ["private", "cruise", "dmz"].includes(trackRaw)
    ? (trackRaw as PricingTrack)
    : "private";

  const tier = resolveTier(args.guideLanguage);
  const input: PriceInput = {
    region,
    track,
    guideLanguageTier: tier,
    durationHours: clampInt(args.durationHours, 8, 1, 24),
    pax: clampInt(args.pax, 1, 1, 60),
    requestedDate: typeof args.date === "string" ? args.date : null,
    jejuPickupZone: isJejuZone(args.jejuPickupZone) ? (args.jejuPickupZone as PriceInput["jejuPickupZone"]) : null,
    cruisePort: args.cruisePort === "gangjeong" || args.cruisePort === "jeju_port" ? (args.cruisePort as PriceInput["cruisePort"]) : null,
  };

  const r = quote(input);
  const origin = siteOrigin();
  const fmt = (n: number) => `₩${n.toLocaleString("en-US")}`;
  const linesText = r.lines.map((l) => `  • ${l.code}: ${fmt(l.amount)}`).join("\n");

  return {
    text:
      `${r.autoQuotable ? "Auto-quotable" : "Manual quote required"} — ${track} tour in ${region}, ` +
      `${input.pax} pax, ${r.inputs.durationHours}h${r.peakSeason ? " (peak season)" : ""}.\n` +
      `${linesText}\nTotal: ${fmt(r.total)} (${r.vehicle})\n` +
      (r.autoQuotable
        ? `Book a hold: POST ${origin}/api/itinerary/book`
        : `Out of auto-scope (${r.violations.join(", ")}). Contact ${origin}/contact.`),
    structured: {
      autoQuotable: r.autoQuotable,
      total: r.total,
      currency: r.currency,
      lines: r.lines,
      vehicle: r.vehicle,
      tier: r.tier,
      peakSeason: r.peakSeason,
      violations: r.violations,
      bookingEndpoint: `${origin}/api/itinerary/book`,
    },
  };
}

async function toolCreateBookingHold(
  args: Record<string, unknown>,
  baseUrl: string,
): Promise<ToolResult> {
  const body: Record<string, unknown> = {
    region: args.region,
    track: typeof args.track === "string" ? args.track : "private",
    guide_language: typeof args.guideLanguage === "string" ? args.guideLanguage : "en",
    duration_hours: clampInt(args.durationHours, 8, 1, 24),
    party_size: clampInt(args.pax, 1, 1, 60),
    requested_date: typeof args.requestedDate === "string" ? args.requestedDate : args.date,
    contact_name: typeof args.contactName === "string" ? args.contactName : undefined,
    contact_email: typeof args.contactEmail === "string" ? args.contactEmail : undefined,
    contact_phone: typeof args.contactPhone === "string" ? args.contactPhone : undefined,
    notes: typeof args.notes === "string" ? args.notes : undefined,
    poi_keys: Array.isArray(args.poiKeys) ? args.poiKeys : undefined,
    jeju_pickup_zone: isJejuZone(args.jejuPickupZone) ? args.jejuPickupZone : undefined,
    cruise_port: args.cruisePort === "gangjeong" || args.cruisePort === "jeju_port" ? args.cruisePort : undefined,
    client_quoted_total: typeof args.clientQuotedTotal === "number" ? args.clientQuotedTotal : undefined,
    source_url: `${baseUrl}/api/mcp`,
  };

  let res: Response;
  let data: Record<string, unknown>;
  try {
    res = await fetch(new URL("/api/itinerary/book", baseUrl), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  } catch (e) {
    return {
      text: `Could not reach the booking service: ${e instanceof Error ? e.message : "unknown"}`,
      structured: { ok: false, error: "booking_unreachable" },
    };
  }

  if (res.ok && data.ok) {
    const bookingId = String(data.booking_id ?? "");
    const total = Number(data.total_krw ?? 0);
    const checkoutUrl = `${baseUrl}/itinerary-builder/checkout?bookingId=${bookingId}`;
    return {
      text:
        `Pending booking created (hold, not charged). Total ₩${total.toLocaleString("en-US")}.\n` +
        `A human must confirm payment here: ${checkoutUrl}\n` +
        `Booking id: ${bookingId}. Do not auto-charge — hand this URL to the traveller.`,
      structured: {
        ok: true,
        status: "pending_payment_confirmation",
        bookingId,
        totalKrw: total,
        currency: "krw",
        breakdown: data.breakdown,
        checkoutUrl,
      },
    };
  }

  // Map the documented failure modes to clear agent guidance.
  if (res.status === 409) {
    return {
      text: `Price changed since the quote: server total ₩${Number(data.server_total ?? 0).toLocaleString("en-US")}. Re-fetch getQuote and retry.`,
      structured: { ok: false, error: "price_changed", serverTotalKrw: data.server_total },
    };
  }
  if (res.status === 422) {
    return {
      text: `Out of auto-bookable scope (${Array.isArray(data.violations) ? data.violations.join(", ") : "unknown"}). Route the traveller to ${baseUrl}/contact.`,
      structured: { ok: false, error: "out_of_scope", violations: data.violations, contactUrl: `${baseUrl}/contact` },
    };
  }
  return {
    text: `Could not create hold: ${String(data.error ?? `HTTP ${res.status}`)}`,
    structured: { ok: false, error: data.error ?? `http_${res.status}` },
  };
}

async function dispatchTool(
  name: string,
  args: Record<string, unknown>,
  baseUrl: string,
): Promise<ToolResult> {
  switch (name) {
    case "searchTours":
      return toolSearchTours(args);
    case "getTour":
      return toolGetTour(args);
    case "getQuote":
      return toolGetQuote(args);
    case "createBookingHold":
      return toolCreateBookingHold(args, baseUrl);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ── JSON-RPC plumbing ───────────────────────────────────────────────────────

interface RpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

function rpcResult(id: string | number | null, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}
function rpcError(id: string | number | null, code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

async function handleRpc(req: RpcRequest, baseUrl: string): Promise<object | null> {
  const id = req.id ?? null;
  const method = req.method ?? "";

  switch (method) {
    case "initialize":
      return rpcResult(id, {
        protocolVersion:
          typeof req.params?.protocolVersion === "string" ? req.params.protocolVersion : PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
        instructions:
          "AtoC Korea tours. Use searchTours/getTour to browse, getQuote for authoritative custom pricing. " +
          "Booking holds are created via POST /api/itinerary/book; a human confirms payment.",
      });
    case "notifications/initialized":
    case "notifications/cancelled":
      return null; // notification — no response
    case "ping":
      return rpcResult(id, {});
    case "tools/list":
      return rpcResult(id, { tools: TOOLS });
    case "tools/call": {
      const name = String(req.params?.name ?? "");
      const args = (req.params?.arguments as Record<string, unknown>) ?? {};
      try {
        const out = await dispatchTool(name, args, baseUrl);
        return rpcResult(id, {
          content: [{ type: "text", text: out.text }],
          structuredContent: out.structured,
        });
      } catch (e) {
        return rpcResult(id, {
          content: [{ type: "text", text: `Tool error: ${e instanceof Error ? e.message : "unknown"}` }],
          isError: true,
        });
      }
    }
    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json(rpcError(null, -32700, "Parse error"), { status: 400, headers: CORS });
  }

  const baseUrl = new URL(request.url).origin;

  if (Array.isArray(payload)) {
    const settled = await Promise.all(payload.map((r) => handleRpc(r as RpcRequest, baseUrl)));
    const responses = settled.filter((r): r is object => r !== null);
    return Response.json(responses, { headers: CORS });
  }

  const response = await handleRpc(payload as RpcRequest, baseUrl);
  if (response === null) {
    return new Response(null, { status: 202, headers: CORS });
  }
  return Response.json(response, { headers: CORS });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET() {
  return Response.json(
    { error: "Use POST with JSON-RPC 2.0. Discovery: /.well-known/mcp/server-card.json" },
    { status: 405, headers: { ...CORS, allow: "POST, OPTIONS" } },
  );
}

// ── helpers ─────────────────────────────────────────────────────────────────

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function resolveTier(value: unknown): GuideLanguageTier {
  const v = String(value ?? "").trim().toLowerCase();
  if (v === "english" || v === "chinese" || v === "smart_guide") return v as GuideLanguageTier;
  return tierForLocale(v || "en");
}

function isJejuZone(v: unknown): boolean {
  return v === "city" || v === "out_west" || v === "out_east" || v === "out_south";
}
