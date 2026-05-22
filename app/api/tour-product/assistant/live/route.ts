import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  findTicketForSession,
  getSessionIdByToken,
  insertSupportMessage,
  listSupportMessages,
  markTicketAfterUserMessage,
} from "@/lib/support/live-chat";
import { notifyTelegramLiveChatMessage } from "@/lib/support/telegram-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_COOKIE = "atc_chat_sid";

const postBodySchema = z.object({
  ticketId: z.number().int().positive().optional(),
  content: z.string().min(1).max(8000),
});

function makeServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sk = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !sk) return null;
  return createClient(url, sk, { auth: { persistSession: false } });
}

function sessionTokenFromRequest(req: NextRequest): string | null {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  return token && token.length >= 16 ? token : null;
}

function parsePositiveInt(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function GET(req: NextRequest) {
  const sb = makeServiceRoleClient();
  if (!sb) {
    return NextResponse.json({ error: "support_unconfigured" }, { status: 503 });
  }

  const sessionToken = sessionTokenFromRequest(req);
  if (!sessionToken) {
    return NextResponse.json({ ticket: null, messages: [] });
  }

  try {
    const sessionId = await getSessionIdByToken(sb, sessionToken);
    if (!sessionId) {
      return NextResponse.json({ ticket: null, messages: [] });
    }

    const { searchParams } = new URL(req.url);
    const ticketId = parsePositiveInt(searchParams.get("ticketId"));
    const afterId = parsePositiveInt(searchParams.get("afterId")) ?? 0;
    const ticket = await findTicketForSession(sb, sessionId, ticketId);
    if (!ticket) {
      return NextResponse.json({ ticket: null, messages: [] });
    }

    const messages = await listSupportMessages(sb, ticket.id, afterId);
    if (messages.some((m) => m.sender === "admin" || m.sender === "system")) {
      await sb.from("support_tickets").update({ unread_for_user: false }).eq("id", ticket.id);
    }

    return NextResponse.json({
      ticket: {
        id: ticket.id,
        status: ticket.status,
      },
      messages,
    });
  } catch (e) {
    console.error("[GET /api/tour-product/assistant/live] error:", e);
    return NextResponse.json({ error: "live_chat_failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const sb = makeServiceRoleClient();
  if (!sb) {
    return NextResponse.json({ error: "support_unconfigured" }, { status: 503 });
  }

  const sessionToken = sessionTokenFromRequest(req);
  if (!sessionToken) {
    return NextResponse.json({ error: "missing_chat_session" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = postBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const sessionId = await getSessionIdByToken(sb, sessionToken);
    if (!sessionId) {
      return NextResponse.json({ error: "chat_session_not_found" }, { status: 404 });
    }

    const ticket = await findTicketForSession(sb, sessionId, parsed.data.ticketId ?? null);
    if (!ticket) {
      return NextResponse.json({ error: "support_ticket_not_found" }, { status: 404 });
    }
    if (ticket.status === "resolved" || ticket.status === "closed") {
      return NextResponse.json({ error: "support_ticket_closed" }, { status: 409 });
    }

    const message = await insertSupportMessage(sb, {
      ticketId: ticket.id,
      sender: "user",
      content: parsed.data.content.trim(),
    });

    await markTicketAfterUserMessage(sb, ticket.id);
    await notifyTelegramLiveChatMessage(sb, {
      ticketId: ticket.id,
      supportMessageId: message.id,
      content: message.content,
      tourSlug: ticket.tour_slug,
      pageUrl: ticket.page_url,
      pageTitle: ticket.page_title,
      userLocale: ticket.user_locale,
    });

    return NextResponse.json({
      ok: true,
      ticket_id: ticket.id,
      message,
    });
  } catch (e) {
    console.error("[POST /api/tour-product/assistant/live] error:", e);
    return NextResponse.json({ error: "live_chat_failed" }, { status: 500 });
  }
}
