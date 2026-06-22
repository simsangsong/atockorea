/**
 * PATCH /api/admin/qa-pairs/[id] — review action: true / false / needs_edit / approve / reject / reset
 *
 * Auth: Supabase admin session via requireAdmin().
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";
import { syncQaPairToIndex } from "@/lib/rag/qa-index";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchBody = z.object({
  action: z.enum(["true", "false", "needs_edit", "approve", "reject", "reset"]),
  answer: z.string().max(8000).optional(),
  question: z.string().max(2000).optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const adminUser = await requireAdmin(req);

    const { id: idStr } = await params;
    const id = Number(idStr);
    if (!Number.isFinite(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

    const json = await req.json().catch(() => null);
    const parsed = patchBody.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

    const sb = createServerClient();
    const { data: existing } = await sb
      .from("qa_pairs")
      .select("id, answer, edit_history")
      .eq("id", id)
      .maybeSingle();
    if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const STATUS_MAP: Record<string, { review_status: string; is_active: boolean }> = {
      true: { review_status: "approved", is_active: true },
      false: { review_status: "rejected", is_active: false },
      needs_edit: { review_status: "needs_edit", is_active: false },
      approve: { review_status: "approved", is_active: true },
      reject: { review_status: "rejected", is_active: false },
      reset: { review_status: "draft", is_active: false },
    };
    const update: Record<string, unknown> = {
      ...STATUS_MAP[parsed.data.action],
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminUser.id,
    };

    if (parsed.data.answer || parsed.data.question || parsed.data.category || parsed.data.tags) {
      const history = (existing.edit_history as any[] | null) ?? [];
      history.push({
        at: new Date().toISOString(),
        prev_answer: existing.answer,
        action: parsed.data.action,
        admin_id: adminUser.id,
      });
      update.edit_history = history;
      if (parsed.data.answer) update.answer = parsed.data.answer;
      if (parsed.data.question) update.question = parsed.data.question;
      if (parsed.data.category) update.category = parsed.data.category;
      if (parsed.data.tags) update.tags = parsed.data.tags;
    }

    const { error } = await sb.from("qa_pairs").update(update).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Close the learning loop: approved -> embed into RAG; otherwise remove.
    // Non-fatal — a retrieval-index hiccup must not fail the review action.
    let indexed: "indexed" | "removed" | "skipped" = "skipped";
    try {
      indexed = await syncQaPairToIndex(sb, id);
    } catch (indexErr) {
      console.error("[PATCH /api/admin/qa-pairs/[id]] RAG index sync error:", (indexErr as Error).message);
    }

    return NextResponse.json({ ok: true, status: STATUS_MAP[parsed.data.action], indexed });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    console.error("[PATCH /api/admin/qa-pairs/[id]] error:", e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
