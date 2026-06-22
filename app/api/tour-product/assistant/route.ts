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
import {
  bookingSpecificReply,
  classifyChatbotQuery,
  policyFallbackReply,
  replyLooksMisrouted,
} from "@/lib/chatbot/queryIntent";
import { buildSiteKnowledgeContextText } from "@/lib/chatbot/siteKnowledge";
import { buildTourCatalogContextText } from "@/lib/chatbot/tourCatalogKnowledge";
import { retrieveKnowledge, buildRagContextText } from "@/lib/rag/retrieve";
import { buildTourProductAssistantContextText } from "@/lib/tour-product/tourProductAssistantContext";
import type { TourProductPageLocale } from "@/lib/tour-product/resolveTourProductDbLocale";
import { logChatTurn, type ChatLogContext } from "@/lib/support/chat-logger";
import { detectEscalation, buildAdminSummary } from "@/lib/support/escalation";
import {
  assistantReplyShouldOfferHandoff,
  ensureHandoffPrompt,
  handoffRequestText,
  humanHandoffAcknowledgement,
  userMessageRequestsHumanHandoff,
} from "@/lib/support/handoff";
import { notifyTelegramNewTicket } from "@/lib/support/telegram-webhook";

const bodySchema = z.object({
  tourProductSlug: z.string().min(1).max(120),
  assistantScope: z.enum(["tour", "site"]).optional(),
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
  debugNoSideEffects: z.boolean().optional(),
});

const SESSION_COOKIE = "atc_chat_sid";
const SITE_ASSISTANT_SLUG = "__site__";

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

type CatalogueReplyEntry = {
  title: string;
  region: string;
  duration: string;
  price: string;
  summary: string;
  url: string;
};

function truncateSentence(value: string, maxChars: number): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, maxChars - 1).trim()}...`;
}

function parseCatalogueReplyEntry(line: string): CatalogueReplyEntry | null {
  if (!line.startsWith("- ")) return null;
  const parts = line.slice(2).split(" | ");
  const titlePart = parts[0] ?? "";
  const title = titlePart.replace(/\s+\([^()]+\)$/, "").trim();
  const field = (label: string) => parts.find((part) => part.startsWith(`${label}: `))?.slice(label.length + 2).trim() ?? "";
  const url = field("URL");
  if (!title || !url) return null;
  return {
    title,
    region: field("Region"),
    duration: field("Duration"),
    price: field("Price"),
    summary: field("Summary"),
    url,
  };
}

function buildCatalogueRecommendationReply(context: string, locale: TourProductPageLocale): string | null {
  const entries = context
    .split("\n")
    .map(parseCatalogueReplyEntry)
    .filter((entry): entry is CatalogueReplyEntry => entry !== null)
    .slice(0, 3);
  if (entries.length === 0) return null;

  if (locale === "ko") {
    return [
      "조건에 가장 맞는 공개 상품은 아래예요.",
      ...entries.map((entry, index) =>
        [
          `${index + 1}. ${entry.title}`,
          entry.region ? `지역: ${entry.region}` : "",
          entry.duration ? `소요 시간: ${entry.duration}` : "",
          entry.price ? `가격: ${entry.price}` : "",
          entry.summary ? truncateSentence(entry.summary, 180) : "",
          entry.url,
        ]
          .filter(Boolean)
          .join(" · "),
      ),
      "정확한 이동 난이도나 동행자 상황에 맞춘 선택이 필요하면 이 채팅에서 담당자에게 바로 연결해 드릴 수 있어요.",
    ].join("\n");
  }

  return [
    "These listed AtoC Korea tours best match your request:",
    ...entries.map((entry, index) =>
      [
        `${index + 1}. ${entry.title}`,
        entry.region ? `Region: ${entry.region}` : "",
        entry.duration ? `Duration: ${entry.duration}` : "",
        entry.price ? `Price: ${entry.price}` : "",
        entry.summary ? truncateSentence(entry.summary, 180) : "",
        entry.url,
      ]
        .filter(Boolean)
        .join(" · "),
    ),
    "If you need a staff-confirmed fit for mobility, timing, or pickup details, I can connect you with support in this chat.",
  ].join("\n");
}

function isPrivacyRequestQuestion(message: string): boolean {
  return /privacy request|personal data|delete my data|data deletion|개인정보.*(?:요청|삭제|정정|열람)|프라이버시.*요청/i.test(
    message,
  );
}

function privacyRequestReply(locale: TourProductPageLocale): string {
  if (locale === "ko") {
    return '개인정보 열람, 정정, 삭제 같은 공식 privacy request는 legal@atockorea.com 으로 보내시면 됩니다. 제목에 "Privacy Request"라고 적고, 본인 확인과 요청 범위를 함께 남겨 주세요. 예약이나 결제 건과 연결된 요청이면 support@atockorea.com 또는 이 채팅에서 담당자 연결로도 이어서 도와드릴 수 있어요.';
  }
  return 'Formal privacy requests such as access, correction, or deletion can be sent to legal@atockorea.com. Use "Privacy Request" in the subject and include enough information to verify your identity and the scope of the request. For booking- or payment-linked requests, I can also connect you with support in this chat.';
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
  const isSiteAssistant = parsed.data.assistantScope === "site" || tourProductSlug === SITE_ASSISTANT_SLUG;
  if (messages[0]?.role !== "user") {
    return NextResponse.json({ error: "first_message_must_be_user" }, { status: 400 });
  }
  if (!isSiteAssistant && !isStaticTourProductBundleRegistered(tourProductSlug)) {
    return NextResponse.json({ error: "unknown_tour" }, { status: 404 });
  }

  const locale = localeFromRequest(req);
  let doc = isSiteAssistant ? null : getStaticTourProductFullPageJson(tourProductSlug, locale);
  if (!doc && !isSiteAssistant && locale !== "en") {
    doc = getStaticTourProductFullPageJson(tourProductSlug, "en");
  }
  if (!doc && !isSiteAssistant) {
    return NextResponse.json({ error: "bundle_missing" }, { status: 500 });
  }

  const session = getOrCreateSessionToken(req);
  const ctx: ChatLogContext = {
    sessionToken: session.token,
    userLocale: locale,
    userAgent: req.headers.get("user-agent"),
    ip: bestEffortIp(req),
    tourSlug: isSiteAssistant ? null : tourProductSlug,
    pageUrl: pageContext?.url ?? null,
    pageTitle: pageContext?.title ?? null,
    pageSection: pageContext?.section ?? null,
  };

  const latestUserMessage =
    [...messages].reverse().find((m) => m.role === "user")?.content ?? handoffRequestText(locale);
  const detectedIntent = classifyChatbotQuery(latestUserMessage);
  const directHandoffRequested =
    parsed.data.handoffRequested ||
    detectedIntent.intent === "support" ||
    userMessageRequestsHumanHandoff(latestUserMessage);
  const debugNoSideEffects =
    parsed.data.debugNoSideEffects === true && process.env.NODE_ENV !== "production";

  if (directHandoffRequested) {
    if (debugNoSideEffects) {
      const handoffLocale = inferLocaleFromText(parsed.data.handoffQuestion ?? latestUserMessage) ?? locale;
      return applySessionCookie(
        NextResponse.json({
          reply: humanHandoffAcknowledgement(handoffLocale, null),
          ticket_id: null,
          escalated: false,
          escalation_reason: "user_requested_human",
          handoff_offered: false,
          debug_intent: detectedIntent,
        }),
        session,
      );
    }

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

    const originalQuestion =
      parsed.data.handoffQuestion?.trim() ||
      [...messages]
        .reverse()
        .find((m) => m.role === "user" && m.content !== latestUserMessage)
        ?.content ||
      latestUserMessage;
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

  if (detectedIntent.intent === "booking_specific") {
    return applySessionCookie(
      NextResponse.json({
        reply: bookingSpecificReply(inferLocaleFromText(latestUserMessage) ?? locale),
        ticket_id: null,
        escalated: false,
        escalation_reason: "booking_specific_requires_human",
        handoff_offered: true,
        debug_intent: debugNoSideEffects ? detectedIntent : undefined,
      }),
      session,
    );
  }

  if (detectedIntent.intent === "legal" && isPrivacyRequestQuestion(latestUserMessage)) {
    return applySessionCookie(
      NextResponse.json({
        reply: privacyRequestReply(inferLocaleFromText(latestUserMessage) ?? locale),
        ticket_id: null,
        escalated: false,
        escalation_reason: null,
        handoff_offered: true,
        debug_intent: debugNoSideEffects ? detectedIntent : undefined,
      }),
      session,
    );
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

  const productContext =
    !isSiteAssistant && doc
      ? buildTourProductAssistantContextText(buildTourProductViewModelFromFullPageJson(doc, locale), locale)
      : "No single tour page is active. Answer as the sitewide AtoC Korea assistant using the tour catalogue, approved Q&A, and site knowledge.";
  const last = messages[messages.length - 1];
  if (last?.role !== "user") {
    return NextResponse.json({ error: "last_message_must_be_user" }, { status: 400 });
  }
  const answerLocale = inferLocaleFromText(last.content) ?? locale;
  const activeIntent = classifyChatbotQuery(last.content);
  const useTourCatalog = activeIntent.useTourCatalog || (!isSiteAssistant && activeIntent.intent === "tour_recommendation");
  const useSiteKnowledge = activeIntent.useSiteKnowledge;
  const tourCatalogContext = useTourCatalog
    ? buildTourCatalogContextText({
        locale: answerLocale,
        query: last.content,
        limit: isSiteAssistant ? 10 : 6,
        maxChars: isSiteAssistant ? 5200 : 3600,
      })
    : "Tour catalogue intentionally omitted for this query intent to avoid unrelated product recommendations.";
  const siteKnowledgeQuery =
    activeIntent.intent === "legal"
      ? `${last.content} privacy personal data data deletion privacy request legal legal@atockorea.com support@atockorea.com`
      : activeIntent.intent === "company"
        ? `${last.content} company address email contact intermediary operator provider support atockorea`
        : last.content;
  const siteKnowledgeContext = useSiteKnowledge
    ? buildSiteKnowledgeContextText({
        locale: answerLocale,
        query: siteKnowledgeQuery,
        maxChunks: activeIntent.intent === "policy" || activeIntent.intent === "legal" ? 10 : 7,
        maxChars: activeIntent.intent === "policy" || activeIntent.intent === "legal" ? 8500 : 6200,
      })
    : "Site knowledge intentionally omitted for this query intent.";
  const qaSb = makeServiceRoleClient();

  // ── RAG: semantic + keyword hybrid retrieval over the whole knowledge index.
  // Falls back to the legacy keyword builders (siteKnowledge + approved Q&A) on
  // any failure or when disabled (CHAT_RAG=0 / no OPENAI_API_KEY).
  let ragContext = "";
  // On whenever an OpenAI key is present; set CHAT_RAG=0 as a kill switch to
  // instantly fall back to the legacy keyword builders.
  const ragEnabled = process.env.CHAT_RAG !== "0" && Boolean(process.env.OPENAI_API_KEY?.trim());
  if (ragEnabled && qaSb) {
    try {
      const chunks = await retrieveKnowledge(qaSb, {
        query: last.content,
        locale: answerLocale,
        sourceTypes: ["poi", "tour_product", "site", "policy", "qa"],
        limit: 8,
      });
      ragContext = buildRagContextText(chunks, { maxChars: 8000 });
    } catch (ragErr) {
      console.error("[tour-product/assistant] RAG retrieval error:", (ragErr as Error).message);
    }
  }

  // Legacy fallback context (also used to complement RAG misses).
  let learnedQaContext = "";
  if (!ragContext && qaSb) {
    try {
      learnedQaContext = await buildApprovedQaContextText(qaSb, {
        locale: answerLocale,
        query: last.content,
        tourSlug: isSiteAssistant ? null : tourProductSlug,
        limit: 5,
        maxChars: 3500,
      });
    } catch (qaErr) {
      console.error("[tour-product/assistant] approved QA lookup error:", (qaErr as Error).message);
    }
  }

  const knowledgeSections = ragContext
    ? [
        "\n--- VERIFIED KNOWLEDGE (semantic search over POI, tours, policies, site, and approved Q&A) ---\n",
        ragContext,
      ]
    : [
        "\n--- APPROVED ADMIN Q&A ---\n",
        learnedQaContext || "No approved learned Q&A matched this question.",
        "\n--- SITE KNOWLEDGE ---\n",
        siteKnowledgeContext || "No additional sitewide knowledge matched this question.",
      ];

  const systemInstruction = [
    isSiteAssistant
      ? "You are the sitewide master customer assistant for AtoC Korea (atockorea.com)."
      : "You are a helpful customer assistant for a specific tour on AtoC Korea (atockorea.com).",
    `Detected user intent: ${activeIntent.intent} (confidence ${activeIntent.confidence.toFixed(2)}; reasons: ${activeIntent.reasons.join(", ")}).`,
    isSiteAssistant
      ? "For product availability and recommendations, answer using the TOUR CATALOGUE first. For policy, company, legal, footer, support, and POI questions, answer using APPROVED ADMIN Q&A and SITE KNOWLEDGE first."
      : "For this product, answer using the PRODUCT CONTEXT first. Use TOUR CATALOGUE only for explicit cross-product recommendations, then APPROVED ADMIN Q&A and SITE KNOWLEDGE when relevant.",
    "Context routing is deliberate. If TOUR CATALOGUE says it was intentionally omitted, do not compensate by recommending tours from memory.",
    "Do not pivot to tour recommendations unless the intent is tour_recommendation or tour_catalog, or unless the user explicitly asks for products, tours, itineraries, or recommendations.",
    "For policy, legal, company, booking-specific, POI, and unknown questions, answer the exact question first. Do not list tours unless the user asked for tours.",
    "For tour recommendations, recommend only listed tours that match the requested region, traveler profile, date/season, port, accessibility, or theme. Include the product URL from the context for each recommended tour. If there is no matching listed tour, say that clearly and offer to connect support in this chat.",
    "For Jeju questions, do not recommend Busan, Gyeongju, Seoul, or other regions unless the user explicitly asks for alternatives.",
    "Approved Admin Q&A is curated from previous human support conversations. Use it only when it clearly matches the user's question and does not conflict with the product or site context.",
    "Do not invent policies, prices, included items, operating hours, or POI facts that are not in the context.",
    "When answering legal or policy questions, summarize the site policy plainly; do not give legal advice.",
    "If the verified context does not answer the user's question, say that clearly and ask whether to connect them to customer support inside this chat. Do not send the user to the contact page as the primary next step.",
    "If the user asks to contact support, talk to a person, or get a definitive answer from staff, say you can connect them in this chat.",
    "For personal booking details such as exact pickup time, driver contact, payment status, booking changes, or booking-specific refund progress, staff must check the booking record; offer support inside this chat.",
    "Keep replies under about 12 sentences unless the user asks for detail.",
    "\n--- PRODUCT CONTEXT ---\n",
    productContext,
    "\n--- TOUR CATALOGUE ---\n",
    tourCatalogContext || "No tour catalogue entries matched this question.",
    ...knowledgeSections,
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

  const isRecommendationIntent =
    activeIntent.intent === "tour_recommendation" || activeIntent.intent === "tour_catalog";
  if (isRecommendationIntent && (replyText.length < 180 || !/\/tour-product\/[a-z0-9-]+/i.test(replyText))) {
    const catalogueReply = buildCatalogueRecommendationReply(tourCatalogContext, answerLocale);
    if (catalogueReply) {
      replyText = catalogueReply;
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // Side-effects: chat log + escalation + ticket + telegram. Failures NEVER
  // break the user-facing reply (try/catch each; log and move on).
  // ──────────────────────────────────────────────────────────────────────
  let ticketCreated: number | null = null;
  let escalationReason: string | null = null;
  let forceHandoffOffer = false;
  if (replyLooksMisrouted(activeIntent.intent, replyText)) {
    escalationReason = "low_confidence";
    forceHandoffOffer = true;
    if (activeIntent.intent === "policy") {
      replyText = policyFallbackReply(answerLocale);
    } else if (activeIntent.intent === "booking_specific") {
      replyText = bookingSpecificReply(answerLocale);
    } else {
      replyText = ensureHandoffPrompt(
        "I could not find a verified answer for that in the current site context.",
        answerLocale,
      );
    }
  }

  let handoffOffered = forceHandoffOffer || assistantReplyShouldOfferHandoff(replyText);
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
                tour_slug: isSiteAssistant ? null : tourProductSlug,
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
                tourSlug: isSiteAssistant ? null : tourProductSlug,
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
    debug_intent: debugNoSideEffects ? activeIntent : undefined,
  });
  return applySessionCookie(resp, session);
}
