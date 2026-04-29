/**
 * PATCH /api/admin/qa-pairs/[id] — review action: true / false / needs_edit / approved / rejected
 *                                  also accepts an inline answer edit before approving.
 *
 * The 3-second-per-item review UI just calls this with the pressed action.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export const runtime = "nodejs";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sk = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !sk) throw new Error("Supabase admin env missing");
  return createClient(url, sk, { auth: { persistSession: false } });
}

function authorize(req: NextRequest): boolean {
  const t = process.env.ADMIN_SUPPORT_API_TOKEN;
  if (!t) return true;
  return req.headers.get("x-admin-token") === t;
}

const patchBody = z.object({
  action: z.enum(["true", "false", "needs_edit", "approve", "reject", "reset"]),
  answer: z.string().max(8000).optional(),
  question: z.string().max(2000).optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  if (!authorize(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const json = await req.json().catch(() => null);
  const parsed = patchBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const sb = adminClient();
  const { data: existing } = await sb
    .from("qa_pairs")
    .select("id, answer, edit_history")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Map action → review_status / is_active
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
  };

  // Apply optional edits and append to edit_history
  if (parsed.data.answer || parsed.data.question || parsed.data.category || parsed.data.tags) {
    const history = (existing.edit_history as any[] | null) ?? [];
    history.push({
      at: new Date().toISOString(),
      prev_answer: existing.answer,
      action: parsed.data.action,
    });
    update.edit_history = history;
    if (parsed.data.answer) update.answer = parsed.data.answer;
    if (parsed.data.question) update.question = parsed.data.question;
    if (parsed.data.category) update.category = parsed.data.category;
    if (parsed.data.tags) update.tags = parsed.data.tags;
  }

  const { error } = await sb.from("qa_pairs").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, status: STATUS_MAP[parsed.data.action] });
}
