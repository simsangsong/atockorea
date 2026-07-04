import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { harvestQaCandidates } from "@/lib/rag/harvest";

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
async function notifyTelegramDrafts(created: number): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = (process.env.TELEGRAM_ADMIN_CHAT_ID || process.env.TELEGRAM_BOOKING_CHAT_ID)?.trim();
  if (!token || !chatId) return;
  const text = [
    `🧠 <b>챗봇 Q&A 하베스트</b>`,
    ``,
    `새 Q&A 초안 <b>${created}건</b>이 검토를 기다립니다.`,
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
  try {
    const summary = await harvestQaCandidates(sb, {
      limit: 40,
      log: (line) => {
        lines.push(line);
        console.log(`[cron/rag-harvest] ${line}`);
      },
    });
    if (summary.created > 0) await notifyTelegramDrafts(summary.created);
    return NextResponse.json({ ok: true, summary, log: lines });
  } catch (e) {
    console.error("[cron/rag-harvest] failed:", e);
    return NextResponse.json({ ok: false, error: (e as Error).message, log: lines }, { status: 500 });
  }
}
