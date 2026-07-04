import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { reindexKnowledge } from "@/lib/rag/reindex";

/**
 * GET /api/cron/rag-reindex — daily RAG index refresh (W1.1 / C-4).
 *
 * The knowledge index used to be refreshed only by a manual CLI run, so
 * catalog changes (price updates, tour deactivations) silently never reached
 * the chatbot — it kept recommending tours that no longer exist. This cron
 * runs the same incremental reindex daily: changed chunks are re-embedded,
 * chunks whose source disappeared (deactivated tours) are deleted.
 *
 * Typical steady-state run embeds nothing (pure hash diff, a few seconds).
 * Auth: Vercel Cron sets `Authorization: Bearer ${CRON_SECRET}` — header only,
 * no query fallback.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${expected}`;
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
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return NextResponse.json({ error: "openai_unconfigured" }, { status: 503 });
  }

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const lines: string[] = [];
  try {
    const summary = await reindexKnowledge(sb, {
      log: (line) => {
        lines.push(line);
        console.log(`[cron/rag-reindex] ${line}`);
      },
    });
    return NextResponse.json({ ok: true, summary, log: lines });
  } catch (e) {
    console.error("[cron/rag-reindex] failed:", e);
    return NextResponse.json(
      { ok: false, error: (e as Error).message, log: lines },
      { status: 500 },
    );
  }
}
