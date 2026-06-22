/**
 * GET /api/admin/chatbot-analytics
 *
 * Aggregate health + learning metrics for the chatbot:
 *   - volume (sessions / messages), escalation rate
 *   - feedback helpful %
 *   - intent/category distribution
 *   - Q&A pipeline health (drafts / approved / active)
 *   - RAG index size by source_type + last refresh
 *   - coverage gaps (recent 👎 / escalated / low-confidence questions)
 *
 * Auth: Supabase admin session via requireAdmin().
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Sb = ReturnType<typeof createServerClient>;

async function count(sb: Sb, table: string, build?: (q: any) => any): Promise<number> {
  let q = sb.from(table).select("id", { count: "exact", head: true });
  if (build) q = build(q);
  const { count: c } = await q;
  return c ?? 0;
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const sb = createServerClient();
    const sinceDays = Math.min(Number(new URL(req.url).searchParams.get("days") ?? 30), 365);
    const since = new Date(Date.now() - sinceDays * 86400_000).toISOString();

    const [
      sessions,
      messages,
      userMessages,
      escalatedMessages,
      tickets,
    ] = await Promise.all([
      count(sb, "chat_sessions"),
      count(sb, "chat_messages"),
      count(sb, "chat_messages", (q) => q.eq("role", "user")),
      count(sb, "chat_messages", (q) => q.eq("escalated", true)),
      count(sb, "support_tickets"),
    ]);

    // Feedback.
    const [posFb, negFb] = await Promise.all([
      count(sb, "chat_feedback", (q) => q.eq("rating", 1)),
      count(sb, "chat_feedback", (q) => q.eq("rating", -1)),
    ]);
    const totalFb = posFb + negFb;

    // Q&A pipeline health.
    const qaCounts: Record<string, number> = {};
    for (const s of ["draft", "approved", "rejected", "needs_edit"]) {
      qaCounts[s] = await count(sb, "qa_pairs", (q) => q.eq("review_status", s));
    }
    const qaActive = await count(sb, "qa_pairs", (q) => q.eq("is_active", true));

    // RAG index size by source_type (count per type — avoids the 1000-row
    // PostgREST select cap that would undercount a fetch-and-tally) + last refresh.
    const ragBySource: Record<string, number> = {};
    await Promise.all(
      (["poi", "tour_product", "site", "policy", "qa"] as const).map(async (t) => {
        ragBySource[t] = await count(sb, "knowledge_chunks", (q) => q.eq("source_type", t));
      }),
    );
    const { data: lastRow } = await sb
      .from("knowledge_chunks")
      .select("updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Intent / category distribution (classified turns).
    const { data: catRows } = await sb
      .from("chat_messages")
      .select("category")
      .not("category", "is", null)
      .gte("created_at", since)
      .limit(5000);
    const categories: Record<string, number> = {};
    for (const r of (catRows as Array<{ category: string }> | null) ?? []) {
      categories[r.category] = (categories[r.category] ?? 0) + 1;
    }

    // Coverage gaps.
    const { data: negFeedback } = await sb
      .from("chat_feedback")
      .select("question, answer, locale, tour_slug, created_at")
      .eq("rating", -1)
      .order("created_at", { ascending: false })
      .limit(25);

    const { data: escalatedQs } = await sb
      .from("chat_messages")
      .select("content, escalation_reason, user_locale, tour_slug, created_at")
      .eq("role", "user")
      .eq("escalated", true)
      .order("created_at", { ascending: false })
      .limit(25);

    return NextResponse.json({
      window_days: sinceDays,
      volume: { sessions, messages, userMessages, escalatedMessages, tickets },
      escalationRate: userMessages ? escalatedMessages / userMessages : 0,
      feedback: { positive: posFb, negative: negFb, total: totalFb, helpfulRate: totalFb ? posFb / totalFb : null },
      qa: { ...qaCounts, active: qaActive },
      rag: { bySource: ragBySource, total: Object.values(ragBySource).reduce((a, b) => a + b, 0), lastRefresh: lastRow?.updated_at ?? null },
      categories,
      gaps: {
        negativeFeedback: negFeedback ?? [],
        escalatedQuestions: escalatedQs ?? [],
      },
    });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    console.error("[GET /api/admin/chatbot-analytics] error:", e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
