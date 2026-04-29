/**
 * GET  /api/admin/support/tickets/[id] — ticket detail w/ chatbot history + page context + admin replies
 * POST /api/admin/support/tickets/[id] — admin posts a reply (creates support_messages row)
 * PATCH /api/admin/support/tickets/[id] — update status / priority / resolved_at
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
  const requiredToken = process.env.ADMIN_SUPPORT_API_TOKEN;
  if (!requiredToken) return true;
  return req.headers.get("x-admin-token") === requiredToken;
}

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  if (!authorize(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const sb = adminClient();

  const { data: ticket, error: tErr } = await sb
    .from("support_tickets")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });
  if (!ticket) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Mark read by admin
  if (ticket.unread_for_admin) {
    await sb.from("support_tickets").update({ unread_for_admin: false, status: ticket.status === "open" ? "admin_reading" : ticket.status }).eq("id", id);
  }

  // Chatbot history for this session (full thread leading up to escalation)
  const { data: chatHistory } = await sb
    .from("chat_messages")
    .select("id, message_index, role, content, tour_slug, page_url, page_title, page_section, model, created_at, escalated, escalation_reason")
    .eq("session_id", ticket.session_id)
    .order("message_index", { ascending: true });

  // Admin↔user thread within this ticket
  const { data: supportThread } = await sb
    .from("support_messages")
    .select("id, message_index, sender, content, attachments, read_at, created_at")
    .eq("ticket_id", id)
    .order("message_index", { ascending: true });

  // Session context
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
}

const replyBody = z.object({
  content: z.string().min(1).max(8000),
  status: z.enum(["awaiting_user", "resolved"]).optional(),
});

export async function POST(req: NextRequest, { params }: RouteParams) {
  if (!authorize(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const json = await req.json().catch(() => null);
  const parsed = replyBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const sb = adminClient();

  // Compute next message_index
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
}

const patchBody = z.object({
  status: z.enum(["open", "admin_reading", "awaiting_admin", "awaiting_user", "resolved", "closed"]).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  assigned_admin_id: z.string().uuid().optional(),
});

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  if (!authorize(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const json = await req.json().catch(() => null);
  const parsed = patchBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const sb = adminClient();
  const update: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.status === "resolved") update.resolved_at = new Date().toISOString();

  const { error } = await sb.from("support_tickets").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
