/**
 * POST /api/tour-product/assistant/feedback
 *
 * Records a thumbs up/down on an assistant answer. Keyed by the answer/question
 * text (+ optional session cookie) so it works regardless of whether chat audit
 * logging is enabled. Feeds quality-weighted harvest + coverage-gap analytics.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { allowRequestDurable } from "@/lib/chatbot/requestRateLimit";

export const runtime = "nodejs";

const SESSION_COOKIE = "atc_chat_sid";

function bestEffortIp(req: NextRequest): string | null {
  // x-real-ip first — the platform sets it, while x-forwarded-for is
  // client-appendable and would let a caller rotate throttle keys
  // (mirrors the assistant route's ordering; audit 2026-07-14 B4).
  return req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

const bodySchema = z.object({
  rating: z.union([z.literal(1), z.literal(-1)]),
  answer: z.string().min(1).max(8000),
  question: z.string().max(8000).optional(),
  reason: z.string().max(2000).optional(),
  tourProductSlug: z.string().max(120).optional(),
  pageUrl: z.string().max(2000).optional(),
});

function inferLocale(text: string): string {
  if (/\p{Script=Hangul}/u.test(text)) return "ko";
  if (/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text)) return "ja";
  if (/\p{Script=Han}/u.test(text)) return "zh";
  if (/[¿¡ñáéíóúü]/i.test(text)) return "es";
  return "en";
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sk = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !sk) return null;
  return createClient(url, sk, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  // Require a chat session (real users always have one after the first reply)
  // and throttle by IP so the unauthenticated endpoint can't be spammed to
  // poison harvest/analytics.
  const sessionToken = req.cookies.get(SESSION_COOKIE)?.value ?? null;
  if (!sessionToken || sessionToken.length < 16) {
    return NextResponse.json({ ok: false, error: "missing_chat_session" }, { status: 401 });
  }
  const ip = bestEffortIp(req);
  // fb-02 (pressure-test): durable (Upstash-backed) limiter so the throttle
  // holds across serverless instances instead of per-instance in-memory only.
  const gate = await allowRequestDurable("feedback", ip ? `ip:${ip}` : `sess:${sessionToken}`, {
    perMinute: 12,
    perHour: 100,
  });
  if (!gate.allowed) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(gate.retryAfterMs / 1000)) } },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const sb = serviceClient();
  if (!sb) return NextResponse.json({ ok: false }, { status: 503 });

  const { rating, answer, question, reason, tourProductSlug, pageUrl } = parsed.data;

  // fb-01 — one vote per (session, answer): a repeat vote UPDATES the existing
  // row instead of inserting, so replaying the endpoint can't inflate
  // harvest/coverage analytics. (App-level check; the select→insert race can
  // yield at most one duplicate, not unbounded rows.)
  const { data: existing } = await sb
    .from("chat_feedback")
    .select("id")
    .eq("session_token", sessionToken)
    .eq("answer", answer)
    .limit(1)
    .maybeSingle();

  const row = {
    session_token: sessionToken,
    tour_slug: tourProductSlug && tourProductSlug !== "__site__" ? tourProductSlug : null,
    locale: inferLocale(question || answer),
    rating,
    question: question ?? null,
    answer,
    reason: reason ?? null,
    page_url: pageUrl ?? null,
  };
  const { error } = existing
    ? await sb.from("chat_feedback").update(row).eq("id", existing.id)
    : await sb.from("chat_feedback").insert(row);
  if (error) {
    console.error("[assistant/feedback] write error:", error.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
