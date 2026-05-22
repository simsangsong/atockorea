import type { SupabaseClient } from "@supabase/supabase-js";

export const ACTIVE_SUPPORT_STATUSES = ["open", "admin_reading", "awaiting_admin", "awaiting_user"] as const;

export type SupportTicketStatus =
  | "open"
  | "admin_reading"
  | "awaiting_admin"
  | "awaiting_user"
  | "resolved"
  | "closed";

export type SupportTicketSummary = {
  id: number;
  session_id: string;
  status: SupportTicketStatus;
  tour_slug: string | null;
  page_url: string | null;
  page_title: string | null;
  user_locale: string | null;
};

export type SupportLiveMessage = {
  id: number;
  ticket_id: number;
  message_index: number;
  sender: "user" | "admin" | "system";
  content: string;
  created_at: string;
};

export async function getSessionIdByToken(sb: SupabaseClient, sessionToken: string): Promise<string | null> {
  const { data, error } = await sb
    .from("chat_sessions")
    .select("id")
    .eq("session_token", sessionToken)
    .maybeSingle();
  if (error) throw new Error(`[live-chat] session lookup failed: ${error.message}`);
  return (data?.id as string | undefined) ?? null;
}

export async function findTicketForSession(
  sb: SupabaseClient,
  sessionId: string,
  ticketId?: number | null,
): Promise<SupportTicketSummary | null> {
  let query = sb
    .from("support_tickets")
    .select("id, session_id, status, tour_slug, page_url, page_title, user_locale")
    .eq("session_id", sessionId);

  if (ticketId) {
    query = query.eq("id", ticketId);
  } else {
    query = query.in("status", [...ACTIVE_SUPPORT_STATUSES]);
  }

  const { data, error } = await query.order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(`[live-chat] ticket lookup failed: ${error.message}`);
  return (data as SupportTicketSummary | null) ?? null;
}

export async function listSupportMessages(
  sb: SupabaseClient,
  ticketId: number,
  afterId = 0,
): Promise<SupportLiveMessage[]> {
  let query = sb
    .from("support_messages")
    .select("id, ticket_id, message_index, sender, content, created_at")
    .eq("ticket_id", ticketId)
    .order("message_index", { ascending: true })
    .limit(100);

  if (afterId > 0) query = query.gt("id", afterId);

  const { data, error } = await query;
  if (error) throw new Error(`[live-chat] message list failed: ${error.message}`);
  return (data as SupportLiveMessage[] | null) ?? [];
}

export async function insertSupportMessage(
  sb: SupabaseClient,
  input: {
    ticketId: number;
    sender: "user" | "admin" | "system";
    content: string;
    senderUserId?: string | null;
    telegramMessageId?: number | null;
    telegramChatId?: string | null;
    telegramFrom?: unknown;
  },
): Promise<SupportLiveMessage> {
  let lastError: string | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { data: existing, error: idxErr } = await sb
      .from("support_messages")
      .select("message_index")
      .eq("ticket_id", input.ticketId)
      .order("message_index", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (idxErr) throw new Error(`[live-chat] message index lookup failed: ${idxErr.message}`);

    const nextIdx = ((existing?.message_index as number | undefined) ?? 0) + 1;
    const { data, error } = await sb
      .from("support_messages")
      .insert({
        ticket_id: input.ticketId,
        message_index: nextIdx,
        sender: input.sender,
        sender_user_id: input.senderUserId ?? null,
        content: input.content,
        telegram_message_id: input.telegramMessageId ?? null,
        telegram_chat_id: input.telegramChatId ?? null,
        telegram_from: input.telegramFrom ?? null,
      })
      .select("id, ticket_id, message_index, sender, content, created_at")
      .single();

    if (!error && data) return data as SupportLiveMessage;
    lastError = error?.message ?? "unknown";
    if (error?.code !== "23505") break;
  }

  throw new Error(`[live-chat] message insert failed: ${lastError}`);
}

export async function markTicketAfterUserMessage(sb: SupabaseClient, ticketId: number): Promise<void> {
  const { error } = await sb
    .from("support_tickets")
    .update({
      status: "awaiting_admin",
      unread_for_admin: true,
      unread_for_user: false,
    })
    .eq("id", ticketId);
  if (error) throw new Error(`[live-chat] ticket user update failed: ${error.message}`);
}

export async function markTicketAfterAdminMessage(
  sb: SupabaseClient,
  ticketId: number,
  status: "awaiting_user" | "resolved" = "awaiting_user",
): Promise<void> {
  const update: Record<string, unknown> = {
    status,
    unread_for_user: true,
    unread_for_admin: false,
  };
  if (status === "resolved") update.resolved_at = new Date().toISOString();

  const { error } = await sb.from("support_tickets").update(update).eq("id", ticketId);
  if (error) throw new Error(`[live-chat] ticket admin update failed: ${error.message}`);
}
