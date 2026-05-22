import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  insertSupportMessage,
  markTicketAfterAdminMessage,
} from "@/lib/support/live-chat";
import {
  parseTelegramAdminIntent,
  telegramChatId,
  type TelegramInboundMessage,
} from "@/lib/support/telegram-inbound";
import { createQaDraftFromSupportReply } from "@/lib/support/qa-learning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TelegramUpdate = {
  message?: TelegramInboundMessage;
  edited_message?: TelegramInboundMessage;
};

function makeServiceRoleClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sk = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !sk) return null;
  return createClient(url, sk, { auth: { persistSession: false } });
}

function configuredAdminChatId(): string | null {
  return (process.env.TELEGRAM_ADMIN_CHAT_ID || process.env.TELEGRAM_BOOKING_CHAT_ID || "").trim() || null;
}

function configuredWebhookSecret(): string | null {
  return (process.env.TELEGRAM_SUPPORT_WEBHOOK_SECRET || process.env.TELEGRAM_WEBHOOK_SECRET || "").trim() || null;
}

async function findTicketIdByTelegramReplyMessage(sb: SupabaseClient, telegramMessageId: number) {
  const { data: supportMessage } = await sb
    .from("support_messages")
    .select("ticket_id")
    .eq("telegram_message_id", telegramMessageId)
    .maybeSingle();
  const supportMessageRow = supportMessage as { ticket_id?: number } | null;
  if (supportMessageRow?.ticket_id) return supportMessageRow.ticket_id;

  const { data: ticket } = await sb
    .from("support_tickets")
    .select("id")
    .eq("telegram_message_id", telegramMessageId)
    .maybeSingle();
  return ((ticket as { id?: number } | null)?.id as number | undefined) ?? null;
}

export async function POST(req: NextRequest) {
  const webhookSecret = configuredWebhookSecret();
  if (!webhookSecret) {
    return NextResponse.json({ ok: false, error: "telegram_webhook_secret_unconfigured" }, { status: 503 });
  }
  if (req.headers.get("x-telegram-bot-api-secret-token") !== webhookSecret) {
    return NextResponse.json({ ok: false, error: "invalid_telegram_secret" }, { status: 401 });
  }

  const sb = makeServiceRoleClient();
  if (!sb) {
    return NextResponse.json({ ok: false, error: "support_unconfigured" }, { status: 503 });
  }

  const update = (await req.json().catch(() => null)) as TelegramUpdate | null;
  const message = update?.message ?? update?.edited_message ?? null;
  if (!message) {
    return NextResponse.json({ ok: true, ignored: "no_message" });
  }

  const expectedChatId = configuredAdminChatId();
  const chatId = telegramChatId(message);
  if (expectedChatId && chatId !== expectedChatId) {
    return NextResponse.json({ ok: true, ignored: "unauthorized_chat" });
  }

  const intent = parseTelegramAdminIntent(message);
  if (intent.kind === "empty") {
    return NextResponse.json({ ok: true, ignored: "empty_message" });
  }

  let ticketId = intent.ticketId;
  if (!ticketId && intent.replyToMessageId) {
    ticketId = await findTicketIdByTelegramReplyMessage(sb, intent.replyToMessageId);
  }
  if (!ticketId) {
    return NextResponse.json({ ok: true, ignored: "ticket_not_found" });
  }

  try {
    if (intent.kind === "resolve") {
      const content = intent.content || "Customer support marked this conversation as resolved.";
      const supportMessage = await insertSupportMessage(sb, {
        ticketId,
        sender: "system",
        content,
        telegramMessageId: message.message_id ?? null,
        telegramChatId: chatId,
        telegramFrom: message.from ?? null,
      });
      await markTicketAfterAdminMessage(sb, ticketId, "resolved");
      return NextResponse.json({ ok: true, ticket_id: ticketId, message: supportMessage });
    }

    const supportMessage = await insertSupportMessage(sb, {
      ticketId,
      sender: "admin",
      content: intent.content,
      telegramMessageId: message.message_id ?? null,
      telegramChatId: chatId,
      telegramFrom: message.from ?? null,
    });
    await markTicketAfterAdminMessage(sb, ticketId, "awaiting_user");
    let qaDraftId: number | null = null;
    try {
      const qaDraft = await createQaDraftFromSupportReply(sb, {
        ticketId,
        supportMessageId: supportMessage.id,
        adminAnswer: intent.content,
      });
      qaDraftId = qaDraft.qaId ?? null;
    } catch (qaErr) {
      console.error("[POST /api/telegram/support-webhook] qa draft error:", (qaErr as Error).message);
    }

    return NextResponse.json({ ok: true, ticket_id: ticketId, message: supportMessage, qa_draft_id: qaDraftId });
  } catch (e) {
    console.error("[POST /api/telegram/support-webhook] error:", e);
    return NextResponse.json({ ok: false, error: "telegram_support_webhook_failed" }, { status: 500 });
  }
}
