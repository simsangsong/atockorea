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

export type LiveChatTelegramPayload = {
  ticketId: number;
  supportMessageId: number;
  content: string;
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

// C-33: Telegram rejects sendMessage text over 4096 chars with a 400 — and we
// only logged it, so an oversized customer message (HTML-escaping can triple
// "&"-heavy text) silently dropped the admin notification. Rebuild with a
// smaller content budget until the FINAL message fits.
const TELEGRAM_TEXT_LIMIT = 4096;

export function fitTelegramMessage(build: (contentMax: number) => string, initialMax: number): string {
  let max = initialMax;
  for (let i = 0; i < 4; i++) {
    const msg = build(max);
    if (msg.length <= TELEGRAM_TEXT_LIMIT) return msg;
    // Content is trimmed BEFORE escaping, so cutting raw chars removes at
    // least as many escaped chars — overflow plus a margin always converges.
    max = Math.max(80, max - (msg.length - TELEGRAM_TEXT_LIMIT) - 64);
  }
  return build(80).slice(0, TELEGRAM_TEXT_LIMIT);
}

export function buildMessage(p: TicketNotificationPayload, contentMax = 500): string {
  const trimmed =
    p.initialUserMessage.length > contentMax
      ? `${p.initialUserMessage.slice(0, Math.max(0, contentMax - 3))}...`
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
  lines.push(
    `Reply to this Telegram message to send an answer back to the site chat, or send <code>/reply #${escapeTelegramHtml(
      p.ticketId,
    )} your message</code>.`,
  );
  lines.push("");
  lines.push(`<a href="${adminInboxUrl(p.ticketId)}">Open support ticket in admin</a>`);

  return lines.join("\n");
}

export function buildLiveChatMessage(p: LiveChatTelegramPayload, contentMax = 1500): string {
  const trimmed =
    p.content.length > contentMax ? `${p.content.slice(0, Math.max(0, contentMax - 3))}...` : p.content;
  const lines = [
    `<b>Customer live chat #${escapeTelegramHtml(p.ticketId)}</b>`,
    "",
    `<b>Message:</b>`,
    escapeTelegramHtml(trimmed),
  ];

  if (p.tourSlug) lines.push("", `<b>Tour:</b> ${escapeTelegramHtml(p.tourSlug)}`);
  if (p.pageTitle) lines.push(`<b>Page:</b> ${escapeTelegramHtml(p.pageTitle)}`);
  if (p.userLocale) lines.push(`<b>Locale:</b> ${escapeTelegramHtml(p.userLocale)}`);

  lines.push("");
  lines.push(
    `Reply to this Telegram message to send your answer back to the customer, or send <code>/reply #${escapeTelegramHtml(
      p.ticketId,
    )} your message</code>.`,
  );

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
    text: fitTelegramMessage((max) => buildMessage(payload, max), 500),
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

export async function notifyTelegramLiveChatMessage(
  sb: SupabaseClient,
  payload: LiveChatTelegramPayload,
): Promise<{ delivered: boolean; reason: string; messageId: number | null }> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = (process.env.TELEGRAM_ADMIN_CHAT_ID || process.env.TELEGRAM_BOOKING_CHAT_ID)?.trim();
  if (!token || !chatId) {
    return { delivered: false, reason: "telegram_env_unset", messageId: null };
  }

  const body = {
    chat_id: chatId,
    text: fitTelegramMessage((max) => buildLiveChatMessage(payload, max), 1500),
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
      endpoint: "telegram_live_chat",
      request_payload: body,
      response_status: status,
      response_body: respBody as object | null,
      error_message: error,
    });
  } catch {
    // Do not fail the customer chat because telemetry could not be recorded.
  }

  if (status >= 200 && status < 300) {
    const messageId = (respBody as { result?: { message_id?: number } } | null)?.result?.message_id ?? null;
    if (messageId) {
      try {
        await sb
          .from("support_messages")
          .update({
            telegram_message_id: messageId,
            telegram_chat_id: chatId,
          })
          .eq("id", payload.supportMessageId);
      } catch {
        // Older databases may not have the bridge metadata columns yet.
      }
    }
    return { delivered: true, reason: "ok", messageId };
  }

  return { delivered: false, reason: error ?? `status_${status}`, messageId: null };
}
