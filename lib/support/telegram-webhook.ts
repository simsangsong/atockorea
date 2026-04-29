/**
 * Telegram bot notification — fires when a new support_ticket is created.
 *
 * Activation:
 *   - Set TELEGRAM_BOT_TOKEN (from BotFather) and TELEGRAM_ADMIN_CHAT_ID
 *     (admin's user chat id; get via @userinfobot or via /start the bot
 *     and read updates).
 *   - When either env var is missing, this module is a no-op (safe stub).
 *
 * Production-ready behaviour:
 *   - Logs every attempt to telegram_webhook_log (success or failure).
 *   - Never throws — chat reply path must not break on notification errors.
 *
 * Future hook for KakaoTalk 알림톡: same interface, different
 * provider implementation (requires NHN/Aligo/etc. business channel).
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

function adminInboxUrl(ticketId: number): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://atockorea.com";
  return `${base.replace(/\/+$/, "")}/admin/support/${ticketId}`;
}

function buildMessage(p: TicketNotificationPayload): string {
  const lines: string[] = [];
  lines.push(`🆘 *새 고객 문의 #${p.ticketId}*`);
  lines.push(`*Reason:* ${p.reason}`);
  if (p.tourSlug) lines.push(`*Tour:* \`${p.tourSlug}\``);
  if (p.pageTitle) lines.push(`*Page:* ${p.pageTitle}`);
  if (p.userLocale) lines.push(`*Locale:* ${p.userLocale}`);
  lines.push("");
  const trimmed = p.initialUserMessage.length > 500
    ? p.initialUserMessage.slice(0, 497) + "…"
    : p.initialUserMessage;
  lines.push(`💬 ${trimmed}`);
  lines.push("");
  lines.push(`👉 [Open in admin inbox](${adminInboxUrl(p.ticketId)})`);
  return lines.join("\n");
}

/** Sends a Telegram message; auto-no-op when env is unset. */
export async function notifyTelegramNewTicket(
  sb: SupabaseClient,
  payload: TicketNotificationPayload,
): Promise<{ delivered: boolean; reason: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId) {
    return { delivered: false, reason: "telegram_env_unset" };
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const body = {
    chat_id: chatId,
    text: buildMessage(payload),
    parse_mode: "Markdown",
    disable_web_page_preview: false,
  };

  let status = 0;
  let respBody: unknown = null;
  let error: string | null = null;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    status = r.status;
    respBody = await r.json().catch(() => null);
  } catch (e) {
    error = (e as Error).message;
  }

  // Audit log
  try {
    await sb.from("telegram_webhook_log").insert({
      ticket_id: payload.ticketId,
      endpoint: "telegram",
      request_payload: body,
      response_status: status,
      response_body: respBody as object,
      error_message: error,
    });
  } catch {
    // never break delivery on audit failure
  }

  if (status >= 200 && status < 300) {
    const messageId = (respBody as any)?.result?.message_id;
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
