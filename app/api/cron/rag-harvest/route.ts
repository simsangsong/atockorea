import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { harvestQaCandidates } from "@/lib/rag/harvest";
import { harvestRoomQaCandidates } from "@/lib/rag/roomHarvest.server";

/**
 * GET /api/cron/rag-harvest — weekly Q&A harvest (W5.1 / C-5).
 *
 * The learning loop (harvest → admin review → approve → embed) never turned
 * because harvesting was a manual CLI. This cron drafts new qa_pairs weekly
 * and pings the admin Telegram channel when there is something to review.
 *
 * Auth: Vercel Cron sets `Authorization: Bearer ${CRON_SECRET}` — header only.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return (req.headers.get("authorization") ?? "") === `Bearer ${expected}`;
}

/** Best-effort admin ping — review is the human half of the loop (G-3). */
async function notifyTelegramDrafts(counts: { chat: number; room: number }): Promise<void> {
  const created = counts.chat + counts.room;
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = (process.env.TELEGRAM_ADMIN_CHAT_ID || process.env.TELEGRAM_BOOKING_CHAT_ID)?.trim();
  if (!token || !chatId) return;
  const text = [
    `🧠 <b>챗봇 Q&A 하베스트</b>`,
    ``,
    `새 Q&A 초안 <b>${created}건</b>이 검토를 기다립니다.`,
    // X20: two sources feed one queue now, and they need different eyes —
    // a chat draft is a marketing answer, a room draft is what a guide
    // actually told a guest standing somewhere.
    `· 챗봇 대화 ${counts.chat}건 · 투어룸(손님 질문 → 가이드 답변) ${counts.room}건`,
    `승인하면 즉시 RAG 지식으로 반영됩니다.`,
    ``,
    `<a href="https://www.atockorea.com/admin/qa-review">/admin/qa-review 열기</a>`,
  ].join("\n");
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
    });
  } catch {
    /* notification is best-effort */
  }
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "supabase_unconfigured" }, { status: 503 });
  }

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const lines: string[] = [];
  const log = (line: string) => {
    lines.push(line);
    console.log(`[cron/rag-harvest] ${line}`);
  };
  try {
    /**
     * 🔴 X20 — the SECOND source joins this flywheel, it does not get its own.
     *
     * The owner's decision was explicit: "the existing rag:harvest flywheel
     * already harvests concierge Q&A — do not build a second one. Widening it
     * to guest questions and GUIDE answers is the ticket."
     *
     * `roomHarvest` was written and unit-tested and then called by nothing but
     * its own tests, so the corpus it exists to grow was never growing. It runs
     * here, on the same weekly schedule, feeding the same review queue — one
     * loop, two sources.
     *
     * Room pairs are harvested FIRST and deliberately without an LLM: a guide
     * answering a real guest in a real place is operational by construction,
     * and the admin review queue is the judge that already exists.
     */
    const room = await harvestRoomQaCandidates(sb, { limit: 40, log });
    const summary = await harvestQaCandidates(sb, { limit: 40, log });
    const created = summary.created + room.created;
    if (created > 0) await notifyTelegramDrafts({ chat: summary.created, room: room.created });
    return NextResponse.json({ ok: true, summary, room, created, log: lines });
  } catch (e) {
    console.error("[cron/rag-harvest] failed:", e);
    return NextResponse.json({ ok: false, error: (e as Error).message, log: lines }, { status: 500 });
  }
}
