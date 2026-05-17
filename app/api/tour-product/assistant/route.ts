import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { randomUUID } from "crypto";

import { buildTourProductViewModelFromFullPageJson } from "@/components/product-tour-static/_shared/buildTourProductViewModelFromJson";
import {
  getStaticTourProductFullPageJson,
  isStaticTourProductBundleRegistered,
} from "@/components/product-tour-static/_shared/tourProductBundleRegistry";
import { buildTourProductAssistantContextText } from "@/lib/tour-product/tourProductAssistantContext";
import type { TourProductPageLocale } from "@/lib/tour-product/resolveTourProductDbLocale";
import { logChatTurn, type ChatLogContext } from "@/lib/support/chat-logger";
import { detectEscalation, buildAdminSummary } from "@/lib/support/escalation";
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

/** Override with `GEMINI_TOUR_PRODUCT_ASSISTANT_MODEL` when needed. */
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

export async function POST(req: NextRequest) {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    return NextResponse.json(
      { error: "assistant_unconfigured", message: "AI assistant is not configured." },
      { status: 503 },
    );
  }

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

  const vm = buildTourProductViewModelFromFullPageJson(doc, locale);
  const productContext = buildTourProductAssistantContextText(vm, locale);

  const systemInstruction = [
    "You are a helpful customer assistant for a specific tour on AtoC Korea (atockorea.com).",
    "Answer only using the PRODUCT CONTEXT and polite general travel logic.",
    "Do not invent policies, prices, or included items that are not in the context.",
    "If the user should book or get a definitive answer from staff, say so clearly.",
    "Keep replies under about 12 sentences unless the user asks for detail.",
    "\n--- PRODUCT CONTEXT ---\n",
    productContext,
  ].join("\n");

  const modelName = process.env.GEMINI_TOUR_PRODUCT_ASSISTANT_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction,
  });

  const last = messages[messages.length - 1];
  if (last?.role !== "user") {
    return NextResponse.json({ error: "last_message_must_be_user" }, { status: 400 });
  }
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
  const session = getOrCreateSessionToken(req);
  let ticketCreated: number | null = null;
  let escalationReason: string | null = null;

  if (process.env.TOUR_MATCH_AUDIT_LOG === "1" || process.env.CHAT_AUDIT_LOG === "1") {
    const sb = makeServiceRoleClient();
    if (sb) {
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
      try {
        const log = await logChatTurn(sb, ctx, {
          userMessage: last.content,
          assistantReply: replyText,
          model: modelName,
          elapsedMs,
        });

        // Escalation detection
        const decision = await detectEscalation(sb, last.content, replyText, locale);
        if (decision.escalate) {
          escalationReason = decision.reason;
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
              escalation_reason: decision.reason ?? "unknown",
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
            // Mark the triggering chat message as escalated and link to ticket
            await sb
              .from("chat_messages")
              .update({
                escalated: true,
                escalation_reason: decision.reason ?? "unknown",
                ticket_id: ticketCreated,
              })
              .eq("id", log.assistantMessageId);

            // Fire Telegram notification (no-op if env missing)
            await notifyTelegramNewTicket(sb, {
              ticketId: ticketCreated,
              reason: decision.reason ?? "unknown",
              initialUserMessage: last.content,
              tourSlug: tourProductSlug,
              pageUrl: pageContext?.url ?? null,
              pageTitle: pageContext?.title ?? null,
              userLocale: locale,
            });
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
  });
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
