// Self-built analytics ingestion endpoint (Phase 1 Foundation).
// Master plan: docs/atockorea-analytics-master-plan-2026-05-17.md §5 Phase 1.3
//
// POST /api/analytics/events
//   body: { events: ClientEvent[] }   (1..500 events per call)
//
// - Anonymous-accessible (the SDK runs in the browser without an auth token)
// - Zod-validates each event against an allowlist shape (PII guard)
// - Rejects obvious bot UAs
// - Upserts session rows + batch-inserts events using the service-role client
// - Returns 202 Accepted with a count so the client knows server received them
//
// Hot path: keep insert lean. No per-event awaits.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_EVENTS_PER_BATCH = 500;

const PayloadValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const PayloadSchema = z.record(PayloadValueSchema);

const ClientContextSchema = z.object({
  page_path: z.string().max(1024).default(""),
  page_query: z.record(z.string()).nullable().optional(),
  referrer: z.string().max(2048).nullable().optional(),
  locale: z.string().max(16).nullable().optional(),
  viewport_width: z.number().int().nullable().optional(),
  viewport_height: z.number().int().nullable().optional(),
  device_class: z.enum(["mobile", "tablet", "desktop", "unknown"]).default("unknown"),
  user_agent_family: z.string().max(32).nullable().optional(),
  utm_source: z.string().max(128).nullable().optional(),
  utm_medium: z.string().max(128).nullable().optional(),
  utm_campaign: z.string().max(128).nullable().optional(),
  utm_term: z.string().max(128).nullable().optional(),
  utm_content: z.string().max(128).nullable().optional(),
});

const ClientEventSchema = z.object({
  event_name: z.string().min(1).max(128),
  payload: PayloadSchema.default({}),
  client_ts: z.string().datetime({ offset: true }),
  context: ClientContextSchema,
  anonymous_id: z.string().min(8).max(128),
  session_id: z.string().min(8).max(128),
});

const RequestSchema = z.object({
  events: z.array(ClientEventSchema).min(1).max(MAX_EVENTS_PER_BATCH),
});

type ClientEvent = z.infer<typeof ClientEventSchema>;

// Server-side payload sanitization (defence-in-depth — the SDK already runs
// `sanitizePayload`, but we never trust the client).
const PAYLOAD_DROPLIST = new Set([
  "hotelName",
  "hotelRaw",
  "lat",
  "lng",
  "coordinates",
  "email",
  "password",
  "token",
  "card",
  "creditCard",
  "ssn",
]);

function scrubPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (PAYLOAD_DROPLIST.has(k)) continue;
    out[k] = v;
  }
  return out;
}

const BOT_UA_PATTERNS = [
  /bot/i,
  /spider/i,
  /crawl/i,
  /facebookexternalhit/i,
  /slackbot/i,
  /headless/i,
  /lighthouse/i,
  /pingdom/i,
];

function isLikelyBot(req: NextRequest): boolean {
  const ua = req.headers.get("user-agent") ?? "";
  return BOT_UA_PATTERNS.some((rx) => rx.test(ua));
}

function pickCountryCode(req: NextRequest): string | null {
  // Vercel adds `x-vercel-ip-country` (ISO 3166-1 alpha-2). Cloudflare uses
  // `cf-ipcountry`. Fall back to null when running locally.
  return (
    req.headers.get("x-vercel-ip-country") ??
    req.headers.get("cf-ipcountry") ??
    null
  );
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (isLikelyBot(req)) {
    return NextResponse.json({ accepted: 0, reason: "bot_filter" }, { status: 202 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_schema", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const country = pickCountryCode(req);
  const events = parsed.data.events;
  const serverTs = new Date().toISOString();

  const supabase = createServerClient();

  // Session upserts — one row per unique session_id in this batch.
  // We accumulate counts in-batch then issue a single upsert per session so
  // hot batches don't trigger N round-trips.
  const sessionAccumulators = new Map<string, SessionAccumulator>();
  for (const ev of events) accumulateSession(sessionAccumulators, ev, country);

  // Convert into insert rows in parallel with sessions — both are independent.
  const eventRows = events.map((ev) => buildEventRow(ev, serverTs, country));

  const [{ error: eventsErr }, { error: sessionsErr }] = await Promise.all([
    supabase.from("analytics_events").insert(eventRows),
    upsertSessions(supabase, sessionAccumulators),
  ]);

  if (eventsErr) {
    return NextResponse.json(
      { error: "insert_failed", scope: "events", message: eventsErr.message },
      { status: 500 },
    );
  }
  if (sessionsErr) {
    // events landed already — session upsert is best-effort, return 202 with hint
    return NextResponse.json(
      {
        accepted: eventRows.length,
        warning: "sessions_upsert_partial",
        message: sessionsErr.message,
      },
      { status: 202 },
    );
  }

  return NextResponse.json({ accepted: eventRows.length }, { status: 202 });
}

function buildEventRow(ev: ClientEvent, serverTs: string, country: string | null) {
  const c = ev.context;
  return {
    event_name: ev.event_name,
    payload: scrubPayload(ev.payload),
    anonymous_id: ev.anonymous_id,
    session_id: ev.session_id,
    page_path: c.page_path || null,
    page_query: c.page_query ?? null,
    referrer: c.referrer ?? null,
    locale: c.locale ?? null,
    viewport_width: c.viewport_width ?? null,
    viewport_height: c.viewport_height ?? null,
    device_class: c.device_class,
    user_agent_family: c.user_agent_family ?? null,
    country_code: country,
    utm_source: c.utm_source ?? null,
    utm_medium: c.utm_medium ?? null,
    utm_campaign: c.utm_campaign ?? null,
    utm_term: c.utm_term ?? null,
    utm_content: c.utm_content ?? null,
    client_ts: ev.client_ts,
    server_ts: serverTs,
  };
}

type SessionAccumulator = {
  session_id: string;
  anonymous_id: string;
  first_event_ts: string;
  last_event_ts: string;
  event_count: number;
  page_view_count: number;
  entry_path: string | null;
  entry_referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  device_class: string;
  viewport_width: number | null;
  locale: string | null;
  country_code: string | null;
};

function accumulateSession(
  acc: Map<string, SessionAccumulator>,
  ev: ClientEvent,
  country: string | null,
) {
  const existing = acc.get(ev.session_id);
  const isPageView = ev.event_name === "page_view";
  if (!existing) {
    acc.set(ev.session_id, {
      session_id: ev.session_id,
      anonymous_id: ev.anonymous_id,
      first_event_ts: ev.client_ts,
      last_event_ts: ev.client_ts,
      event_count: 1,
      page_view_count: isPageView ? 1 : 0,
      entry_path: ev.context.page_path || null,
      entry_referrer: ev.context.referrer ?? null,
      utm_source: ev.context.utm_source ?? null,
      utm_medium: ev.context.utm_medium ?? null,
      utm_campaign: ev.context.utm_campaign ?? null,
      device_class: ev.context.device_class,
      viewport_width: ev.context.viewport_width ?? null,
      locale: ev.context.locale ?? null,
      country_code: country,
    });
    return;
  }
  existing.event_count += 1;
  if (isPageView) existing.page_view_count += 1;
  if (ev.client_ts > existing.last_event_ts) existing.last_event_ts = ev.client_ts;
  if (ev.client_ts < existing.first_event_ts) {
    existing.first_event_ts = ev.client_ts;
    existing.entry_path = ev.context.page_path || existing.entry_path;
    existing.entry_referrer = ev.context.referrer ?? existing.entry_referrer;
  }
}

async function upsertSessions(
  supabase: ReturnType<typeof createServerClient>,
  acc: Map<string, SessionAccumulator>,
) {
  if (acc.size === 0) return { error: null } as const;

  const ids = Array.from(acc.keys());
  // Pull existing rows so we can sum counts atomically (avoid clobbering).
  const { data: existing, error: selErr } = await supabase
    .from("analytics_sessions")
    .select("id, started_at, last_event_at, event_count, page_view_count")
    .in("id", ids);
  if (selErr) return { error: selErr } as const;

  const existingById = new Map<string, NonNullable<typeof existing>[number]>();
  for (const row of existing ?? []) existingById.set(row.id, row);

  const upsertRows = ids.map((id) => {
    const a = acc.get(id)!;
    const prev = existingById.get(id);
    return {
      id: a.session_id,
      anonymous_id: a.anonymous_id,
      started_at:
        prev && prev.started_at < a.first_event_ts ? prev.started_at : a.first_event_ts,
      last_event_at:
        prev && prev.last_event_at > a.last_event_ts ? prev.last_event_at : a.last_event_ts,
      event_count: (prev?.event_count ?? 0) + a.event_count,
      page_view_count: (prev?.page_view_count ?? 0) + a.page_view_count,
      entry_path: prev ? undefined : a.entry_path,
      entry_referrer: prev ? undefined : a.entry_referrer,
      utm_source: prev ? undefined : a.utm_source,
      utm_medium: prev ? undefined : a.utm_medium,
      utm_campaign: prev ? undefined : a.utm_campaign,
      device_class: prev ? undefined : a.device_class,
      viewport_width: prev ? undefined : a.viewport_width,
      locale: prev ? undefined : a.locale,
      country_code: prev ? undefined : a.country_code,
    };
  });

  const { error } = await supabase
    .from("analytics_sessions")
    .upsert(upsertRows, { onConflict: "id" });
  return { error } as const;
}
