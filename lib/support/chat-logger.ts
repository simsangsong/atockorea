/**
 * Persist chatbot turns to `chat_sessions` + `chat_messages`.
 *
 * - Idempotent on (session_token) — looks up or creates a session row.
 * - Captures page_context (tour_slug + url + section) so the support inbox
 *   can show "where the user was when they asked".
 * - Hashes IP for privacy. Cookie session_token is the stable identifier.
 */

import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ChatLogContext = {
  sessionToken: string;
  userLocale?: string | null;
  userAgent?: string | null;
  ip?: string | null;
  tourSlug?: string | null;
  pageUrl?: string | null;
  pageTitle?: string | null;
  pageSection?: string | null;
};

export type ChatTurn = {
  userMessage: string;
  assistantReply: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  elapsedMs?: number;
};

function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return createHash("sha256")
    .update(ip + (process.env.IP_HASH_SALT ?? "atockorea-default-salt"))
    .digest("hex")
    .slice(0, 32);
}

/**
 * Find-or-create the chat_sessions row for this browser session.
 * Returns the session UUID + the next message_index counter.
 */
async function ensureSession(
  sb: SupabaseClient,
  ctx: ChatLogContext,
): Promise<{ sessionId: string; nextMessageIndex: number }> {
  const { data: existing } = await sb
    .from("chat_sessions")
    .select("id, message_count")
    .eq("session_token", ctx.sessionToken)
    .maybeSingle();

  if (existing) {
    await sb
      .from("chat_sessions")
      .update({ last_seen_at: new Date().toISOString(), user_locale: ctx.userLocale ?? undefined })
      .eq("id", existing.id);
    return { sessionId: existing.id as string, nextMessageIndex: (existing.message_count as number) + 1 };
  }

  const { data: created, error } = await sb
    .from("chat_sessions")
    .insert({
      session_token: ctx.sessionToken,
      user_locale: ctx.userLocale ?? null,
      user_agent: ctx.userAgent ?? null,
      ip_hash: hashIp(ctx.ip),
    })
    .select("id")
    .single();

  if (error || !created) {
    throw new Error(`[chat-logger] failed to create session: ${error?.message ?? "unknown"}`);
  }
  return { sessionId: created.id as string, nextMessageIndex: 1 };
}

/**
 * Insert one user-message + one assistant-reply pair (two rows).
 * Returns the assistant message id (used downstream for ticket linkage).
 */
export async function logChatTurn(
  sb: SupabaseClient,
  ctx: ChatLogContext,
  turn: ChatTurn,
): Promise<{ sessionId: string; userMessageId: number; assistantMessageId: number }> {
  const { sessionId, nextMessageIndex } = await ensureSession(sb, ctx);

  const baseRow = {
    session_id: sessionId,
    user_locale: ctx.userLocale ?? null,
    tour_slug: ctx.tourSlug ?? null,
    page_url: ctx.pageUrl ?? null,
    page_title: ctx.pageTitle ?? null,
    page_section: ctx.pageSection ?? null,
  };

  const { data: userRow, error: userErr } = await sb
    .from("chat_messages")
    .insert({
      ...baseRow,
      message_index: nextMessageIndex,
      role: "user",
      content: turn.userMessage,
    })
    .select("id")
    .single();
  if (userErr || !userRow) throw new Error(`[chat-logger] user insert: ${userErr?.message}`);

  const { data: asstRow, error: asstErr } = await sb
    .from("chat_messages")
    .insert({
      ...baseRow,
      message_index: nextMessageIndex + 1,
      role: "assistant",
      content: turn.assistantReply,
      model: turn.model ?? null,
      input_tokens: turn.inputTokens ?? null,
      output_tokens: turn.outputTokens ?? null,
      cost_usd: turn.costUsd ?? null,
      elapsed_ms: turn.elapsedMs ?? null,
    })
    .select("id")
    .single();
  if (asstErr || !asstRow) throw new Error(`[chat-logger] assistant insert: ${asstErr?.message}`);

  await sb
    .from("chat_sessions")
    .update({
      message_count: nextMessageIndex + 1,
      last_seen_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  return {
    sessionId,
    userMessageId: userRow.id as number,
    assistantMessageId: asstRow.id as number,
  };
}
