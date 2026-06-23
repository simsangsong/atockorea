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

import { allowRequest } from "@/lib/chatbot/requestRateLimit";

export const runtime = "nodejs";

const SESSION_COOKIE = "atc_chat_sid";

function bestEffortIp(req: NextRequest): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? null;
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
  const gate = allowRequest("feedback", ip ? `ip:${ip}` : `sess:${sessionToken}`, { perMinute: 12, perHour: 100 });
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

  const { error } = await sb.from("chat_feedback").insert({
    session_token: sessionToken,
    tour_slug: tourProductSlug && tourProductSlug !== "__site__" ? tourProductSlug : null,
    locale: inferLocale(question || answer),
    rating,
    question: question ?? null,
    answer,
    reason: reason ?? null,
    page_url: pageUrl ?? null,
  });
  if (error) {
    console.error("[assistant/feedback] insert error:", error.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
