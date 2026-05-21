/**
 * Telegram bot notification for escalated customer support tickets.
 *
 * Required env:
 * - TELEGRAM_BOT_TOKEN
 * - TELEGRAM_ADMIN_CHAT_ID, with TELEGRAM_BOOKING_CHAT_ID as a fallback
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type TicketNotificationPayload = {
  ticketId: number;
  reason: string;
  initialUserMessage: string;
  tourSlug: string | null;
  pageUrl: string | null;
  pageTitle: string | null;
  userLocale: string | null;
};

function publicBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL || "https://atockorea.com";
  if (/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/i.test(configured)) {
    return "https://atockorea.com";
  }
  return configured.replace(/\/+$/, "");
}

function adminInboxUrl(ticketId: number): string {
  return `${publicBaseUrl()}/admin/support/${ticketId}`;
}

function escapeTelegramHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildMessage(p: TicketNotificationPayload): string {
  const trimmed =
    p.initialUserMessage.length > 500
      ? `${p.initialUserMessage.slice(0, 497)}...`
      : p.initialUserMessage;

  const lines = [
    `<b>New customer inquiry #${escapeTelegramHtml(p.ticketId)}</b>`,
    "",
    `<b>Reason:</b> ${escapeTelegramHtml(p.reason)}`,
  ];

  if (p.tourSlug) lines.push(`<b>Tour:</b> ${escapeTelegramHtml(p.tourSlug)}`);
  if (p.pageTitle) lines.push(`<b>Page:</b> ${escapeTelegramHtml(p.pageTitle)}`);
  if (p.userLocale) lines.push(`<b>Locale:</b> ${escapeTelegramHtml(p.userLocale)}`);

  lines.push("");
  lines.push(escapeTelegramHtml(trimmed));
  lines.push("");
  lines.push(`<a href="${adminInboxUrl(p.ticketId)}">Open support ticket in admin</a>`);

  return lines.join("\n");
}

/** Sends a Telegram message; auto-no-op when env is unset. */
export async function notifyTelegramNewTicket(
  sb: SupabaseClient,
  payload: TicketNotificationPayload,
): Promise<{ delivered: boolean; reason: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = (process.env.TELEGRAM_ADMIN_CHAT_ID || process.env.TELEGRAM_BOOKING_CHAT_ID)?.trim();
  if (!token || !chatId) {
    return { delivered: false, reason: "telegram_env_unset" };
  }

  const body = {
    chat_id: chatId,
    text: buildMessage(payload),
    parse_mode: "HTML",
    disable_web_page_preview: true,
  };

  let status = 0;
  let respBody: unknown = null;
  let error: string | null = null;
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    status = response.status;
    respBody = await response.json().catch(() => null);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  try {
    await sb.from("telegram_webhook_log").insert({
      ticket_id: payload.ticketId,
      endpoint: "telegram",
      request_payload: body,
      response_status: status,
      response_body: respBody as object | null,
      error_message: error,
    });
  } catch {
    // Never break chat escalation because audit logging failed.
  }

  if (status >= 200 && status < 300) {
    const messageId = (respBody as { result?: { message_id?: number } } | null)?.result?.message_id;
    await sb
      .from("support_tickets")
      .update({
        telegram_notified: true,
        telegram_message_id: messageId ?? null,
        telegram_notified_at: new Date().toISOString(),
      })
      .eq("id", payload.ticketId);
    return { delivered: true, reason: "ok" };
  }

  return { delivered: false, reason: error ?? `status_${status}` };
}
