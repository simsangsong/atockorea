/**
 * GET  /api/admin/qa-pairs?status=draft&limit=50  — list Q&A pairs for review
 * POST /api/admin/qa-pairs                         — create a new draft pair
 *
 * Auth: Supabase admin session (Authorization: Bearer <access_token> or sb-* cookies).
 * Legacy x-admin-token / ADMIN_SUPPORT_API_TOKEN auth has been removed because
 * the previous `if (!t) return true` fallback opened the route to anyone when
 * the env var was missing.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";
import { syncQaPairToIndex } from "@/lib/rag/qa-index";
import { QA_REVIEW_ACTIONS, parseBulkIds, resolveReviewStatus } from "@/lib/admin/qa-review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") ?? "draft";
    const limit = Math.min(Number(searchParams.get("limit") ?? 50), 200);
    const tour = searchParams.get("tour");

    const sb = createServerClient();
    let q = sb
      .from("qa_pairs")
      .select(
        "id, source, question, answer, question_locale, answer_locale, category, tour_slug, tags, review_status, is_active, updated_at"
      )
      .order("updated_at", { ascending: true })
      .limit(limit);
    if (status !== "all") q = q.eq("review_status", status);
    if (tour) q = q.eq("tour_slug", tour);

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // D-14: count the semantic review states only. 'true'/'false' are a legacy
    // boolean-migration artifact still permitted by the CHECK constraint but
    // never set by the app (0 rows live), so they don't belong as filter tabs.
    const counts: Record<string, number> = {};
    for (const s of ["draft", "needs_edit", "approved", "rejected"]) {
      const { count } = await sb
        .from("qa_pairs")
        .select("id", { count: "exact", head: true })
        .eq("review_status", s);
      counts[s] = count ?? 0;
    }

    return NextResponse.json({ pairs: data ?? [], counts });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    console.error("[GET /api/admin/qa-pairs] error:", e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

const createBody = z.object({
  question: z.string().min(2).max(2000),
  answer: z.string().min(2).max(8000),
  question_locale: z.string().default("ko"),
  answer_locale: z.string().default("ko"),
  category: z.string().optional(),
  tour_slug: z.string().optional(),
  tags: z.array(z.string()).default([]),
  source: z.enum(["manual", "chat_message", "support_ticket", "imported"]).default("manual"),
  source_message_id: z.number().int().optional(),
  source_ticket_id: z.number().int().optional(),
});

const bulkBody = z.object({
  ids: z.array(z.number()),
  action: z.enum(QA_REVIEW_ACTIONS),
});

/**
 * PATCH /api/admin/qa-pairs — bulk review (U-7). Body: { ids:number[], action }.
 * One authoritative status update for every id, then a per-id RAG index sync
 * (approve -> embed, otherwise remove). Index sync is non-fatal and sequential
 * (avoids an embedding burst); the status update is the source of truth, so a
 * later `rag:index` reconciles anything that fails here.
 */
export async function PATCH(req: NextRequest) {
  try {
    const adminUser = await requireAdmin(req);

    const json = await req.json().catch(() => null);
    const parsed = bulkBody.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

    const { ids, error: idError } = parseBulkIds(parsed.data.ids);
    if (idError) return NextResponse.json({ error: idError }, { status: 400 });

    const sb = createServerClient();
    const statusPatch = resolveReviewStatus(parsed.data.action);
    const { error } = await sb
      .from("qa_pairs")
      .update({
        ...statusPatch,
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminUser.id,
      })
      .in("id", ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    let indexed = 0;
    let removed = 0;
    let failed = 0;
    for (const id of ids) {
      try {
        const result = await syncQaPairToIndex(sb, id);
        if (result === "indexed") indexed += 1;
        else removed += 1;
      } catch (indexErr) {
        failed += 1;
        console.error("[PATCH /api/admin/qa-pairs] RAG index sync error:", (indexErr as Error).message);
      }
    }

    return NextResponse.json({ ok: true, updated: ids.length, indexed, removed, failed });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    console.error("[PATCH /api/admin/qa-pairs] error:", e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);

    const json = await req.json().catch(() => null);
    const parsed = createBody.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

    const sb = createServerClient();
    const { data, error } = await sb
      .from("qa_pairs")
      .insert({ ...parsed.data, review_status: "draft", is_active: false })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ id: data?.id });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    console.error("[POST /api/admin/qa-pairs] error:", e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
