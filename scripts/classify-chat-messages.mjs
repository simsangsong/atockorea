#!/usr/bin/env node
/**
 * Nightly batch — classify unclassified user chat messages with Haiku.
 *
 * Runs idempotently:
 *   - SELECT chat_messages WHERE category IS NULL AND role='user' (limit 200)
 *   - For each: call Haiku with a small classification prompt (cached system block)
 *   - UPDATE chat_messages SET category=..., classification_confidence=..., classified_at=NOW()
 *
 * Categories (kept short, English snake_case for matching with QA tags):
 *   pricing | pickup_dropoff | cancellation | itinerary_question | weather_seasonal
 *   booking_process | accessibility | dietary | safety | refund | meeting_point
 *   group_size | language_guide | duration | k_drama | other
 *
 * Usage:
 *   node scripts/classify-chat-messages.mjs
 *   node scripts/classify-chat-messages.mjs --limit 50 --dry-run
 *
 * Env: ANTHROPIC_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function loadEnv() {
  const envPath = join(ROOT, ".env.local");
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const m = trimmed.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const CATEGORIES = [
  "pricing", "pickup_dropoff", "cancellation", "itinerary_question",
  "weather_seasonal", "booking_process", "accessibility", "dietary",
  "safety", "refund", "meeting_point", "group_size", "language_guide",
  "duration", "k_drama", "other",
];

const SYSTEM_PROMPT = `You classify customer chatbot questions for atockorea.com (a Korea inbound day-tour marketplace).

Return ONLY valid JSON (no fences). Schema:
{
  "category": "<one of: ${CATEGORIES.join(" | ")}>",
  "confidence": 0.0-1.0,
  "rationale": "<one short English sentence>"
}

Category rules:
- pricing            : how much / discount / 가격 / 할인
- pickup_dropoff     : pickup, drop-off, hotel, address, 픽업, 드랍
- cancellation       : cancel, change date, 취소, 변경
- refund             : refund, money back, 환불
- itinerary_question : what stops, what to see, 코스, 일정
- weather_seasonal   : rain, season, cherry blossom, 날씨, 시즌
- booking_process    : how to book, payment, 예약 방법, 결제
- accessibility      : wheelchair, stairs, elderly, 휠체어, 어르신
- dietary            : halal, vegetarian, allergy, 할랄, 비건, 알레르기
- safety             : safety, injury, insurance, 안전, 보험
- meeting_point      : where to meet, exact location, 만나는 곳
- group_size         : how many people, max pax, 인원
- language_guide     : English, Chinese, Japanese guide, 영어/중국어 가이드
- duration           : how long, hours, 시간
- k_drama            : K-drama filming, specific drama name
- other              : everything else (use sparingly)

If ambiguous, pick the closest single category and lower confidence.`;

async function classifyOne(client, text) {
  const t0 = Date.now();
  const resp = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 200,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: `Classify: ${text}` }],
  });
  const elapsedMs = Date.now() - t0;
  let raw = "";
  for (const b of resp.content) if (b.type === "text") raw += b.text;
  raw = raw.replace(/^```(?:json)?\s*|\s*```$/gm, "").trim();
  let out;
  try { out = JSON.parse(raw); } catch { return null; }
  if (!CATEGORIES.includes(out.category)) out.category = "other";
  if (typeof out.confidence !== "number") out.confidence = 0.5;
  out.confidence = Math.max(0, Math.min(1, out.confidence));
  return { ...out, elapsedMs, usage: resp.usage };
}

async function main() {
  loadEnv();
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1] ?? "200", 10) : 200;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sk = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anthKey = process.env.ANTHROPIC_API_KEY;
  if (!url || !sk) { console.error("Missing Supabase env."); process.exit(1); }
  if (!anthKey) { console.error("Missing ANTHROPIC_API_KEY."); process.exit(1); }

  const sb = createClient(url, sk, { auth: { persistSession: false } });
  const client = new Anthropic({ apiKey: anthKey });

  const { data: rows, error } = await sb
    .from("chat_messages")
    .select("id, content, user_locale")
    .eq("role", "user")
    .is("category", null)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) { console.error(error); process.exit(1); }
  console.log(`[classify-chat-messages] ${rows?.length ?? 0} unclassified messages`);

  let ok = 0, fail = 0;
  for (const row of rows ?? []) {
    try {
      const r = await classifyOne(client, row.content);
      if (!r) { fail++; continue; }
      console.log(`  #${row.id} ← ${r.category} (${r.confidence.toFixed(2)}) ${r.rationale ?? ""}`);
      if (!dryRun) {
        await sb.from("chat_messages").update({
          category: r.category,
          classification_confidence: r.confidence,
          classified_at: new Date().toISOString(),
          classifier_model: "claude-haiku-4-5",
        }).eq("id", row.id);
      }
      ok++;
    } catch (e) {
      fail++;
      console.error(`  #${row.id} FAIL: ${e.message}`);
    }
  }
  console.log(`[classify-chat-messages] OK=${ok} FAIL=${fail}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
