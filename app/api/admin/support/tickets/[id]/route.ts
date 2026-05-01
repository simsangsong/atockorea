/**
 * GET   /api/admin/support/tickets/[id] — ticket detail with chatbot history + admin replies
 * POST  /api/admin/support/tickets/[id] — admin posts a reply (creates support_messages row)
 * PATCH /api/admin/support/tickets/[id] — update status / priority / assigned_admin_id
 *
 * Auth: Supabase admin session via requireAdmin().
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    await requireAdmin(req);

    const { id: idStr } = await params;
    const id = Number(idStr);
    if (!Number.isFinite(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

    const sb = createServerClient();

    const { data: ticket, error: tErr } = await sb
      .from("support_tickets")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });
    if (!ticket) return NextResponse.json({ error: "not_found" }, { status: 404 });

    if (ticket.unread_for_admin) {
      await sb
        .from("support_tickets")
        .update({
          unread_for_admin: false,
          status: ticket.status === "open" ? "admin_reading" : ticket.status,
        })
        .eq("id", id);
    }

    const { data: chatHistory } = await sb
      .from("chat_messages")
      .select(
        "id, message_index, role, content, tour_slug, page_url, page_title, page_section, model, created_at, escalated, escalation_reason"
      )
      .eq("session_id", ticket.session_id)
      .order("message_index", { ascending: true });

    const { data: supportThread } = await sb
      .from("support_messages")
      .select("id, message_index, sender, content, attachments, read_at, created_at")
      .eq("ticket_id", id)
      .order("message_index", { ascending: true });

    const { data: session } = await sb
      .from("chat_sessions")
      .select("session_token, user_locale, first_seen_at, last_seen_at, message_count")
      .eq("id", ticket.session_id)
      .maybeSingle();

    return NextResponse.json({
      ticket,
      session,
      chat_history: chatHistory ?? [],
      support_thread: supportThread ?? [],
    });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    console.error("[GET /api/admin/support/tickets/[id]] error:", e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

const replyBody = z.object({
  content: z.string().min(1).max(8000),
  status: z.enum(["awaiting_user", "resolved"]).optional(),
});

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const adminUser = await requireAdmin(req);

    const { id: idStr } = await params;
    const id = Number(idStr);
    if (!Number.isFinite(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

    const json = await req.json().catch(() => null);
    const parsed = replyBody.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

    const sb = createServerClient();

    const { data: existing } = await sb
      .from("support_messages")
      .select("message_index")
      .eq("ticket_id", id)
      .order("message_index", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextIdx = ((existing?.message_index as number) ?? 0) + 1;

    const { error: insErr } = await sb.from("support_messages").insert({
      ticket_id: id,
      message_index: nextIdx,
      sender: "admin",
      sender_user_id: adminUser.id,
      content: parsed.data.content,
    });
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

    await sb
      .from("support_tickets")
      .update({
        status: parsed.data.status ?? "awaiting_user",
        unread_for_user: true,
        unread_for_admin: false,
        resolved_at: parsed.data.status === "resolved" ? new Date().toISOString() : null,
      })
      .eq("id", id);

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    console.error("[POST /api/admin/support/tickets/[id]] error:", e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

const patchBody = z.object({
  status: z
    .enum(["open", "admin_reading", "awaiting_admin", "awaiting_user", "resolved", "closed"])
    .optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  assigned_admin_id: z.string().uuid().optional(),
});

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    await requireAdmin(req);

    const { id: idStr } = await params;
    const id = Number(idStr);
    if (!Number.isFinite(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

    const json = await req.json().catch(() => null);
    const parsed = patchBody.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

    const sb = createServerClient();
    const update: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.status === "resolved") update.resolved_at = new Date().toISOString();

    const { error } = await sb.from("support_tickets").update(update).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    console.error("[PATCH /api/admin/support/tickets/[id]] error:", e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
