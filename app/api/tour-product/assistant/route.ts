import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { randomUUID } from "crypto";

import { buildTourProductViewModelFromFullPageJson } from "@/components/product-tour-static/_shared/buildTourProductViewModelFromJson";
import {
  getStaticTourProductFullPageJson,
  isStaticTourProductBundleRegistered,
} from "@/components/product-tour-static/_shared/tourProductBundleRegistry";
import { buildApprovedQaContextText } from "@/lib/chatbot/qaKnowledge";
import { buildSiteKnowledgeContextText } from "@/lib/chatbot/siteKnowledge";
import { buildTourProductAssistantContextText } from "@/lib/tour-product/tourProductAssistantContext";
import type { TourProductPageLocale } from "@/lib/tour-product/resolveTourProductDbLocale";
import { logChatTurn, type ChatLogContext } from "@/lib/support/chat-logger";
import { detectEscalation, buildAdminSummary } from "@/lib/support/escalation";
import {
  assistantReplyShouldOfferHandoff,
  ensureHandoffPrompt,
  handoffRequestText,
  humanHandoffAcknowledgement,
} from "@/lib/support/handoff";
import { notifyTelegramNewTicket } from "@/lib/support/telegram-webhook";

const bodySchema = z.object({
  tourProductSlug: z.string().min(1).max(120),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(8000),
      }),
    )
    .min(1)
    .max(24),
  /** Optional client-supplied page context. Best-effort; nothing breaks if absent. */
  pageContext: z
    .object({
      url: z.string().max(2000).optional(),
      title: z.string().max(400).optional(),
      section: z.string().max(80).optional(),
    })
    .optional(),
  handoffRequested: z.boolean().optional(),
  handoffQuestion: z.string().max(8000).optional(),
});

const SESSION_COOKIE = "atc_chat_sid";

function makeServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sk = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !sk) return null;
  return createClient(url, sk, { auth: { persistSession: false } });
}

function getOrCreateSessionToken(req: NextRequest): { token: string; setCookie: boolean } {
  const existing = req.cookies.get(SESSION_COOKIE)?.value;
  if (existing && existing.length >= 16) return { token: existing, setCookie: false };
  return { token: randomUUID(), setCookie: true };
}

function bestEffortIp(req: NextRequest): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null
  );
}

const ALLOWED_LOCALES = new Set<TourProductPageLocale>(["en", "ko", "zh", "zh-TW", "es", "ja"]);

function localeFromRequest(req: NextRequest): TourProductPageLocale {
  const raw = req.cookies.get("NEXT_LOCALE")?.value?.trim();
  if (raw === "zh-CN") return "zh";
  if (raw && ALLOWED_LOCALES.has(raw as TourProductPageLocale)) {
    return raw as TourProductPageLocale;
  }
  return "en";
}

function inferLocaleFromText(text: string): TourProductPageLocale | null {
  if (/\p{Script=Hangul}/u.test(text)) return "ko";
  if (/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text)) return "ja";
  if (/\p{Script=Han}/u.test(text)) return "zh";
  if (/[¿¡ñáéíóúü]/i.test(text)) return "es";
  return null;
}

/** Override with `GEMINI_TOUR_PRODUCT_ASSISTANT_MODEL` when needed. */
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

function applySessionCookie(resp: NextResponse, session: { token: string; setCookie: boolean }): NextResponse {
  if (session.setCookie) {
    resp.cookies.set(SESSION_COOKIE, session.token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return resp;
}

async function createSupportTicketAndNotify(
  sb: SupabaseClient,
  ctx: ChatLogContext,
  input: {
    userMessage: string;
    assistantReply: string;
    reason: "user_requested_human" | "sensitive_topic" | "keyword_match";
    priority?: "normal" | "high";
    model?: string;
    elapsedMs?: number;
  },
): Promise<number | null> {
  const log = await logChatTurn(sb, ctx, {
    userMessage: input.userMessage,
    assistantReply: input.assistantReply,
    model: input.model,
    elapsedMs: input.elapsedMs,
  });

  const summary = buildAdminSummary(input.userMessage, {
    escalate: true,
    reason: input.reason,
    category: input.reason === "user_requested_human" ? "human_handoff" : null,
  });

  const { data: ticket } = await sb
    .from("support_tickets")
    .insert({
      session_id: log.sessionId,
      trigger_message_id: log.assistantMessageId,
      user_locale: ctx.userLocale ?? null,
      tour_slug: ctx.tourSlug ?? null,
      page_url: ctx.pageUrl ?? null,
      page_title: ctx.pageTitle ?? null,
      escalation_reason: input.reason,
      initial_user_message: input.userMessage,
      initial_summary: summary,
      status: "open",
      priority: input.priority ?? "normal",
      unread_for_admin: true,
    })
    .select("id")
    .single();

  if (!ticket) return null;
  const ticketId = ticket.id as number;

  await sb
    .from("chat_messages")
    .update({
      escalated: true,
      escalation_reason: input.reason,
      ticket_id: ticketId,
    })
    .eq("id", log.assistantMessageId);

  await notifyTelegramNewTicket(sb, {
    ticketId,
    reason: input.reason,
    initialUserMessage: input.userMessage,
    tourSlug: ctx.tourSlug ?? null,
    pageUrl: ctx.pageUrl ?? null,
    pageTitle: ctx.pageTitle ?? null,
    userLocale: ctx.userLocale ?? null,
  });

  return ticketId;
}

export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", details: parsed.error.flatten() }, { status: 400 });
  }

  const { tourProductSlug, messages, pageContext } = parsed.data;
  if (messages[0]?.role !== "user") {
    return NextResponse.json({ error: "first_message_must_be_user" }, { status: 400 });
  }
  if (!isStaticTourProductBundleRegistered(tourProductSlug)) {
    return NextResponse.json({ error: "unknown_tour" }, { status: 404 });
  }

  const locale = localeFromRequest(req);
  let doc = getStaticTourProductFullPageJson(tourProductSlug, locale);
  if (!doc && locale !== "en") {
    doc = getStaticTourProductFullPageJson(tourProductSlug, "en");
  }
  if (!doc) {
    return NextResponse.json({ error: "bundle_missing" }, { status: 500 });
  }

  const session = getOrCreateSessionToken(req);
  const ctx: ChatLogContext = {
    sessionToken: session.token,
    userLocale: locale,
    userAgent: req.headers.get("user-agent"),
    ip: bestEffortIp(req),
    tourSlug: tourProductSlug,
    pageUrl: pageContext?.url ?? null,
    pageTitle: pageContext?.title ?? null,
    pageSection: pageContext?.section ?? null,
  };

  if (parsed.data.handoffRequested) {
    const sb = makeServiceRoleClient();
    if (!sb) {
      return applySessionCookie(
        NextResponse.json(
          { error: "support_unconfigured", message: "Customer support handoff is not configured." },
          { status: 503 },
        ),
        session,
      );
    }

    const lastUserMessage =
      [...messages].reverse().find((m) => m.role === "user")?.content ?? handoffRequestText(locale);
    const originalQuestion =
      parsed.data.handoffQuestion?.trim() ||
      [...messages]
        .reverse()
        .find((m) => m.role === "user" && m.content !== lastUserMessage)
        ?.content ||
      lastUserMessage;
    const handoffLocale = inferLocaleFromText(originalQuestion) ?? locale;

    try {
      const ticketId = await createSupportTicketAndNotify(sb, ctx, {
        userMessage: originalQuestion,
        assistantReply: humanHandoffAcknowledgement(handoffLocale, null),
        reason: "user_requested_human",
      });

      return applySessionCookie(
        NextResponse.json({
          reply: humanHandoffAcknowledgement(handoffLocale, ticketId),
          ticket_id: ticketId,
          escalated: ticketId !== null,
          escalation_reason: "user_requested_human",
          handoff_offered: false,
        }),
        session,
      );
    } catch (handoffErr) {
      console.error("[tour-product/assistant] handoff error:", (handoffErr as Error).message);
      return applySessionCookie(
        NextResponse.json({ error: "support_handoff_failed" }, { status: 500 }),
        session,
      );
    }
  }

  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    return applySessionCookie(
      NextResponse.json(
        { error: "assistant_unconfigured", message: "AI assistant is not configured." },
        { status: 503 },
      ),
      session,
    );
  }

  const vm = buildTourProductViewModelFromFullPageJson(doc, locale);
  const productContext = buildTourProductAssistantContextText(vm, locale);
  const last = messages[messages.length - 1];
  if (last?.role !== "user") {
    return NextResponse.json({ error: "last_message_must_be_user" }, { status: 400 });
  }
  const answerLocale = inferLocaleFromText(last.content) ?? locale;
  const siteKnowledgeContext = buildSiteKnowledgeContextText({
    locale: answerLocale,
    query: last.content,
    maxChunks: 8,
    maxChars: 7000,
  });
  let learnedQaContext = "";
  const qaSb = makeServiceRoleClient();
  if (qaSb) {
    try {
      learnedQaContext = await buildApprovedQaContextText(qaSb, {
        locale: answerLocale,
        query: last.content,
        tourSlug: tourProductSlug,
        limit: 5,
        maxChars: 3500,
      });
    } catch (qaErr) {
      console.error("[tour-product/assistant] approved QA lookup error:", (qaErr as Error).message);
    }
  }

  const systemInstruction = [
    "You are a helpful customer assistant for a specific tour on AtoC Korea (atockorea.com).",
    "Answer using the PRODUCT CONTEXT first for this tour, then APPROVED ADMIN Q&A if directly relevant, then SITE KNOWLEDGE for company, legal, footer, policy, and POI questions.",
    "Approved Admin Q&A is curated from previous human support conversations. Use it only when it clearly matches the user's question and does not conflict with the product or site context.",
    "Do not invent policies, prices, included items, operating hours, or POI facts that are not in the context.",
    "When answering legal or policy questions, summarize the site policy plainly; do not give legal advice.",
    "If the verified context does not answer the user's question, say that clearly and ask whether to connect them to customer support. Do not guess.",
    "If the user should book or get a definitive answer from staff, say so clearly.",
    "Keep replies under about 12 sentences unless the user asks for detail.",
    "\n--- PRODUCT CONTEXT ---\n",
    productContext,
    "\n--- APPROVED ADMIN Q&A ---\n",
    learnedQaContext || "No approved learned Q&A matched this question.",
    "\n--- SITE KNOWLEDGE ---\n",
    siteKnowledgeContext || "No additional sitewide knowledge matched this question.",
  ].join("\n");

  const modelName = process.env.GEMINI_TOUR_PRODUCT_ASSISTANT_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction,
  });

  const prior = messages.slice(0, -1);
  const history = prior.map((m) => ({
    role: m.role === "user" ? ("user" as const) : ("model" as const),
    parts: [{ text: m.content }],
  }));

  const t0 = Date.now();
  let replyText = "";
  try {
    const chat = model.startChat({
      history,
      generationConfig: { maxOutputTokens: 1200, temperature: 0.6 },
    });
    const res = await chat.sendMessage(last.content);
    replyText = res.response.text()?.trim() ?? "";
  } catch (e) {
    console.error("[tour-product/assistant]", e);
    return NextResponse.json({ error: "assistant_failed" }, { status: 502 });
  }
  if (!replyText) {
    return NextResponse.json({ error: "empty_response" }, { status: 502 });
  }
  const elapsedMs = Date.now() - t0;

  // ──────────────────────────────────────────────────────────────────────
  // Side-effects: chat log + escalation + ticket + telegram. Failures NEVER
  // break the user-facing reply (try/catch each; log and move on).
  // ──────────────────────────────────────────────────────────────────────
  let ticketCreated: number | null = null;
  let escalationReason: string | null = null;
  let handoffOffered = assistantReplyShouldOfferHandoff(replyText);
  if (handoffOffered) {
    replyText = ensureHandoffPrompt(replyText, answerLocale);
  }

  if (process.env.TOUR_MATCH_AUDIT_LOG === "1" || process.env.CHAT_AUDIT_LOG === "1") {
    const sb = makeServiceRoleClient();
    if (sb) {
      try {
        const log = await logChatTurn(sb, ctx, {
          userMessage: last.content,
          assistantReply: replyText,
          model: modelName,
          elapsedMs,
        });

        // Escalation detection
        const decision = await detectEscalation(sb, last.content, replyText, answerLocale);
        if (decision.escalate) {
          escalationReason = decision.reason;
          if (decision.reason === "low_confidence") {
            handoffOffered = true;
            replyText = ensureHandoffPrompt(replyText, answerLocale);
          } else if (
            decision.reason === "user_requested_human" ||
            decision.reason === "sensitive_topic" ||
            decision.reason === "keyword_match"
          ) {
            const summary = buildAdminSummary(last.content, decision);
            const { data: ticket } = await sb
              .from("support_tickets")
              .insert({
                session_id: log.sessionId,
                trigger_message_id: log.assistantMessageId,
                user_locale: locale,
                tour_slug: tourProductSlug,
                page_url: pageContext?.url ?? null,
                page_title: pageContext?.title ?? null,
                escalation_reason: decision.reason,
                initial_user_message: last.content,
                initial_summary: summary,
                status: "open",
                priority: decision.reason === "sensitive_topic" ? "high" : "normal",
                unread_for_admin: true,
              })
              .select("id")
              .single();

            if (ticket) {
              ticketCreated = ticket.id as number;
              handoffOffered = false;
              // Mark the triggering chat message as escalated and link to ticket
              await sb
                .from("chat_messages")
                .update({
                  escalated: true,
                  escalation_reason: decision.reason,
                  ticket_id: ticketCreated,
                })
                .eq("id", log.assistantMessageId);

              // Fire Telegram notification (no-op if env missing)
              await notifyTelegramNewTicket(sb, {
                ticketId: ticketCreated,
                reason: decision.reason,
                initialUserMessage: last.content,
                tourSlug: tourProductSlug,
                pageUrl: pageContext?.url ?? null,
                pageTitle: pageContext?.title ?? null,
                userLocale: locale,
              });
            }
          }
        }
      } catch (logErr) {
        console.error("[tour-product/assistant] log/escalate error:", (logErr as Error).message);
      }
    }
  }

  const resp = NextResponse.json({
    reply: replyText,
    ticket_id: ticketCreated,
    escalated: ticketCreated !== null,
    escalation_reason: escalationReason,
    handoff_offered: handoffOffered && ticketCreated === null,
  });
  return applySessionCookie(resp, session);
}
