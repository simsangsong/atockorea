"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Headphones, Send, Sparkles, ThumbsDown, ThumbsUp, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { parseSseBuffer } from "@/lib/chatbot/clientSse";
import { ChatMarkdown, safeCheckoutUrl } from "./chatMarkdown";

function ChatBotAvatar({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <line x1="20" y1="3.5" x2="20" y2="8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="20" cy="3" r="1.9" fill="#34d399">
        <animate attributeName="r" values="1.6;2.1;1.6" dur="1.8s" repeatCount="indefinite" />
      </circle>
      <circle cx="20" cy="3" r="1.9" fill="#34d399" opacity="0.45">
        <animate attributeName="r" values="1.9;3.4;1.9" dur="1.8s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.45;0;0.45" dur="1.8s" repeatCount="indefinite" />
      </circle>
      <rect x="3.2" y="15.5" width="3.6" height="9" rx="1.8" fill="currentColor" opacity="0.95" />
      <rect x="33.2" y="15.5" width="3.6" height="9" rx="1.8" fill="currentColor" opacity="0.95" />
      <rect x="6.8" y="9" width="26.4" height="22.5" rx="9" fill="currentColor" />
      <rect x="10.2" y="14.2" width="19.6" height="11.4" rx="5.7" fill="#0e2540" />
      <circle cx="16" cy="19.9" r="1.85" fill="#5eead4" />
      <circle cx="24" cy="19.9" r="1.85" fill="#5eead4" />
      <circle cx="16.55" cy="19.35" r="0.55" fill="#ffffff" />
      <circle cx="24.55" cy="19.35" r="0.55" fill="#ffffff" />
      <path
        d="M16.5 28.5 Q20 30.6 23.5 28.5"
        stroke="#0e2540"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
      />
    </svg>
  );
}

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  origin?: "ai" | "admin" | "support_user" | "system";
  supportMessageId?: number;
  /** Quote funnel (Q3) — renders a "go to checkout" button under the message. */
  checkoutUrl?: string;
};

// Quote-funnel checkout CTA, keyed on the widget locale (avoids threading a
// label through every localized labels object).
const CHECKOUT_CTA: Record<string, string> = {
  ko: "결제하러 가기 →",
  en: "Go to checkout →",
  ja: "決済に進む →",
  zh: "前往结账 →",
  "zh-TW": "前往結帳 →",
  es: "Ir al pago →",
};

// The server caps the history at 24 messages (zod). Trim to the most recent
// window before sending so long conversations don't 400 and break the chat;
// drop any leading assistant turn so the window still starts with a user message.
function trimChatHistory(messages: ChatMessage[], max = 24): ChatMessage[] {
  let window = messages.slice(-max);
  while (window.length > 1 && window[0].role !== "user") window = window.slice(1);
  return window;
}

type AssistantResponse = {
  reply?: string;
  error?: string;
  message?: string;
  ticket_id?: number | null;
  escalated?: boolean;
  escalation_reason?: string | null;
  handoff_offered?: boolean;
  /** Quote funnel (Q3) — present when the bot created a booking; the widget
   *  renders a "go to checkout" button. */
  checkout_url?: string | null;
};

type LiveSupportMessage = {
  id: number;
  ticket_id: number;
  message_index: number;
  sender: "user" | "admin" | "system";
  content: string;
  created_at: string;
};

type LiveSupportResponse = {
  ticket?: { id: number; status: string } | null;
  messages?: LiveSupportMessage[];
  message?: LiveSupportMessage;
  ticket_id?: number;
  error?: string;
};

type AssistantScope = "tour" | "site";

type TourProductAiAssistantWidgetProps = {
  tourProductSlug?: string;
  productTitle?: string;
  supportQuickChips?: readonly string[];
  assistantScope?: AssistantScope;
  placement?: "tour" | "global";
};

type UiLabels = {
  badge: string;
  title: string;
  siteTitle: string;
  introTitle: string;
  introBody: string;
  popular: string;
  suggested: string;
  contactSupport: string;
  contactPromptTitle: string;
  connectNow: string;
  notNow: string;
  close: string;
  send: string;
  message: string;
  activeSupport: string;
  supportMessagePlaceholder: string;
  questionPlaceholder: string;
  aiNotice: string;
  liveNotice: string;
  aiUnavailable: string;
  requestFailed: (error: string) => string;
  networkError: string;
  liveSendFailed: (error: string) => string;
  handoffFailed: (error: string) => string;
  handoffNetworkError: string;
  handoffRequest: string;
  directSupportQuestion: string;
  defaultQuickChips: string[];
  // L1 (chatbot promo) — idle teaser bubble copy shown on the global/landing
  // placement to advertise that this is a full-funnel agent, not a FAQ bot.
  teaserTitle: string;
  teaserBody: string;
  teaserCta: string;
};

const SITE_ASSISTANT_SLUG = "__site__";
const STORAGE_PREFIX = "tour-product-assistant:";
const LIVE_TICKET_PREFIX = "tour-product-assistant-live-ticket:";
// L1 — the teaser shows at most ONCE per session: the key is written the
// moment it appears (not only on dismiss), so navigating to another page
// doesn't re-trigger it. It also auto-hides after a few seconds if ignored.
const TEASER_DISMISS_KEY = "atc-assistant-teaser-dismissed";
const TEASER_SHOW_DELAY_MS = 6000;
const TEASER_AUTO_HIDE_MS = 12_000;
// L3 — any surface can open the assistant by dispatching this CustomEvent:
//   window.dispatchEvent(new CustomEvent("atc:open-assistant", { detail: { source } }))
const OPEN_ASSISTANT_EVENT = "atc:open-assistant";
const MSG_EASE = [0.22, 1, 0.36, 1] as const;
// W0.10 (C-36): abort a stream that goes silent — a connection that dies
// without FIN used to leave `reader.read()` pending forever, freezing the
// widget in permanent loading. Long enough for slow first tokens (~7s) plus
// the server-side finalize before `done`.
const STREAM_STALL_TIMEOUT_MS = 45_000;
// W0.10 (C-38): cap the PERSISTED history too — trimChatHistory only trims
// what is sent, while sessionStorage grew without bound until a silent
// QuotaExceeded dropped the whole conversation.
const STORED_HISTORY_MAX = 80;

type FeedbackLabels = { helpful: string; notHelpful: string; thanks: string; noted: string };

function feedbackLabels(lang: string): FeedbackLabels {
  if (lang.startsWith("ko"))
    return { helpful: "도움이 됐어요", notHelpful: "도움이 안 됐어요", thanks: "고마워요!", noted: "알려줘서 고마워요" };
  if (lang.startsWith("ja"))
    return { helpful: "役に立った", notHelpful: "役に立たなかった", thanks: "ありがとうございます！", noted: "フィードバックに感謝します" };
  if (lang.startsWith("es"))
    return { helpful: "Útil", notHelpful: "No fue útil", thanks: "¡Gracias!", noted: "Gracias por tu comentario" };
  if (lang.startsWith("zh"))
    return { helpful: "有帮助", notHelpful: "没帮助", thanks: "谢谢！", noted: "感谢反馈" };
  return { helpful: "Helpful", notHelpful: "Not helpful", thanks: "Thanks!", noted: "Thanks for the feedback" };
}

function labelsFor(lang: string, scope: AssistantScope): UiLabels {
  if (lang.startsWith("ko")) {
    return {
      badge: "Help center",
      title: scope === "site" ? "AtoC 마스터 챗봇" : "이 투어에 대해 물어보기",
      siteTitle: "AtoC Korea 전체 사이트",
      introTitle: "무엇을 도와드릴까요?",
      introBody:
        scope === "site"
          ? "전체 투어, 환불/취소, 회사 정보, 여행지 정보를 사이트 지식으로 답변합니다. 답을 확정하기 어려우면 바로 담당자에게 연결할 수 있어요."
          : "이 상품 페이지와 사이트 정책을 기준으로 답변합니다. 답이 애매하면 바로 담당자에게 연결할 수 있어요.",
      popular: "자주 묻는 질문",
      suggested: "추천 질문",
      contactSupport: "상담 연결",
      contactPromptTitle: "담당자에게 바로 연결해 드릴까요?",
      connectNow: "네, 연결해 주세요",
      notNow: "아니요",
      close: "닫기",
      send: "보내기",
      message: "메시지",
      activeSupport: "담당자 상담 연결됨",
      supportMessagePlaceholder: "담당자에게 보낼 메시지",
      questionPlaceholder: "질문을 입력하세요",
      aiNotice: "AI 답변은 실수할 수 있으니 예약 전 상세 정보를 한 번 더 확인해 주세요.",
      liveNotice: "담당자 상담 중입니다. 입력한 메시지는 Telegram으로 전달됩니다.",
      aiUnavailable: "현재 AI 챗봇 설정이 완료되지 않았습니다. 상담 연결 버튼으로 담당자에게 문의해 주세요.",
      requestFailed: (error) => `요청 처리 중 문제가 생겼습니다 (${error}). 잠시 후 다시 시도해 주세요.`,
      networkError: "네트워크 오류가 발생했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.",
      liveSendFailed: (error) => `담당자에게 메시지를 전달하지 못했습니다 (${error}). 잠시 후 다시 시도해 주세요.`,
      handoffFailed: (error) => `상담 연결을 접수하지 못했습니다 (${error}). 잠시 후 다시 시도해 주세요.`,
      handoffNetworkError: "네트워크 오류로 상담 연결을 접수하지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.",
      handoffRequest: "담당자에게 연결해 주세요.",
      directSupportQuestion: "고객이 챗봇에서 상담 연결을 요청했습니다.",
      defaultQuickChips: ["어떤 투어가 있나요?", "환불 규정이 궁금해요", "제주/부산/서울 투어를 추천해 주세요"],
      teaserTitle: "AI 여행 에이전트",
      teaserBody: "투어 추천 · 견적 · 예약 조회 — 물어보세요",
      teaserCta: "대화 시작",
    };
  }

  return {
    badge: "Help center",
    title: scope === "site" ? "AtoC master assistant" : "Ask about this tour",
    siteTitle: "AtoC Korea sitewide support",
    introTitle: "How can we help?",
    introBody:
      scope === "site"
        ? "Ask about tours, refunds, company details, and Korea travel spots. If the answer needs staff confirmation, we can connect you here."
        : "Ask about this product page and site policies. If the answer needs staff confirmation, we can connect you here.",
    popular: "Popular questions",
    suggested: "Suggested",
    contactSupport: "Contact support",
    contactPromptTitle: "Would you like me to connect you with customer support?",
    connectNow: "Yes, connect me",
    notNow: "Not now",
    close: "Close",
    send: "Send",
    message: "Message",
    activeSupport: "Human support connected",
    supportMessagePlaceholder: "Message support",
    questionPlaceholder: "Type your question",
    aiNotice: "AI can make mistakes. Confirm details on the page before booking.",
    liveNotice: "Human support is active. Your messages are forwarded to Telegram.",
    aiUnavailable: "The AI assistant is not configured yet. Use Contact support to reach the team.",
    requestFailed: (error) => `Sorry, something went wrong (${error}). Please try again.`,
    networkError: "Network error. Check your connection and try again.",
    liveSendFailed: (error) => `Could not send your message to support (${error}). Please try again.`,
    handoffFailed: (error) => `Could not create a support request (${error}). Please try again.`,
    handoffNetworkError: "Network error. Could not create a support request. Please try again.",
    handoffRequest: "Please connect me with customer support.",
    directSupportQuestion: "The customer requested support from the chatbot.",
    defaultQuickChips: [
      "Which tours do you offer?",
      "What is the refund policy?",
      "Recommend a tour for Seoul, Busan, or Jeju",
    ],
    teaserTitle: "Your Korea travel agent",
    teaserBody: "Tour picks · quotes · booking lookup — ask anything",
    teaserCta: "Start chatting",
  };
}

function inferClientLanguage(): string {
  if (typeof window === "undefined" || typeof document === "undefined") return "en";
  const firstSegment = window.location.pathname.split("/").filter(Boolean)[0];
  if (firstSegment === "ko" || firstSegment === "ja" || firstSegment === "es") return firstSegment;
  if (firstSegment === "zh-CN") return "zh";
  if (firstSegment === "zh-TW") return "zh-TW";
  return document.documentElement.lang || navigator.language || "en";
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-0.5" aria-label="Loading" role="status">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-sky-700/55 [animation-duration:0.9s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-sky-700/55 [animation-delay:120ms] [animation-duration:0.9s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-sky-700/55 [animation-delay:240ms] [animation-duration:0.9s]" />
    </div>
  );
}

function readStoredMessages(storageKey: string): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(`${STORAGE_PREFIX}${storageKey}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((m) => m && typeof m === "object" && typeof (m as ChatMessage).content === "string")
      .slice(-STORED_HISTORY_MAX)
      .map((m) => ({
        role: (m as ChatMessage).role === "assistant" ? "assistant" : "user",
        content: (m as ChatMessage).content,
        origin: (m as ChatMessage).origin,
        supportMessageId:
          typeof (m as ChatMessage).supportMessageId === "number" ? (m as ChatMessage).supportMessageId : undefined,
      }));
  } catch {
    return [];
  }
}

function readStoredTicketId(storageKey: string): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(`${LIVE_TICKET_PREFIX}${storageKey}`);
  const parsed = raw ? Number(raw) : NaN;
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function TourProductAiAssistantWidget({
  tourProductSlug,
  productTitle,
  supportQuickChips,
  assistantScope,
  placement = "tour",
}: TourProductAiAssistantWidgetProps) {
  const scope: AssistantScope = assistantScope ?? (tourProductSlug ? "tour" : "site");
  const storageKey = tourProductSlug || SITE_ASSISTANT_SLUG;
  const [uiLang, setUiLang] = useState("en");
  const labels = useMemo(() => labelsFor(uiLang, scope), [scope, uiLang]);
  const fb = useMemo(() => feedbackLabels(uiLang), [uiLang]);
  const quickChips = useMemo(
    () => (supportQuickChips && supportQuickChips.length > 0 ? supportQuickChips : labels.defaultQuickChips),
    [labels.defaultQuickChips, supportQuickChips],
  );

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [handoffOffer, setHandoffOffer] = useState<{ question: string } | null>(null);
  const [activeTicketId, setActiveTicketId] = useState<number | null>(() => readStoredTicketId(storageKey));
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(() => readStoredMessages(storageKey));
  const [feedback, setFeedback] = useState<Record<number, 1 | -1>>({});
  const listRef = useRef<HTMLDivElement>(null);
  const inputId = useId();
  const lastSupportMessageIdRef = useRef(0);
  // W0.10 (C-15/C-36): the in-flight assistant request. Aborted when a new
  // request starts, when the panel closes, and on unmount — the server stops
  // generating (req.signal.aborted) instead of burning tokens for nobody.
  const abortRef = useRef<AbortController | null>(null);
  const liveSupportActive = activeTicketId !== null && liveStatus !== "resolved" && liveStatus !== "closed";
  const title = productTitle?.trim() || labels.siteTitle;

  // L1 (chatbot promo) — idle teaser bubble state. Only ever shown on the
  // global/landing placement (see effect below).
  const [teaserVisible, setTeaserVisible] = useState(false);

  useEffect(() => {
    setUiLang(inferClientLanguage());
  }, []);

  // W0.10 — abort the in-flight stream when the panel closes or the widget
  // unmounts; the visitor left, so stop the server-side generation too.
  useEffect(() => {
    if (!open) abortRef.current?.abort();
  }, [open]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const dismissTeaser = useCallback(() => {
    setTeaserVisible(false);
    try {
      window.sessionStorage.setItem(TEASER_DISMISS_KEY, "1");
    } catch {
      /* private mode / storage blocked — fine, teaser just won't persist */
    }
  }, []);

  // L1 — surface the teaser after a short idle so it reads as an invitation,
  // not a load-time pop-up. Global placement only; never while the panel is
  // open; at most once per session (marked shown on appear, not on dismiss);
  // auto-hides after a few seconds so it never lingers over content.
  useEffect(() => {
    if (placement !== "global" || typeof window === "undefined") return;
    if (open) return;
    try {
      if (window.sessionStorage.getItem(TEASER_DISMISS_KEY) === "1") return;
    } catch {
      /* storage blocked — still allow the teaser */
    }
    let hideId: number | null = null;
    const showId = window.setTimeout(() => {
      setTeaserVisible(true);
      try {
        window.sessionStorage.setItem(TEASER_DISMISS_KEY, "1");
      } catch {
        /* storage blocked — worst case it shows again on the next page */
      }
      hideId = window.setTimeout(() => setTeaserVisible(false), TEASER_AUTO_HIDE_MS);
    }, TEASER_SHOW_DELAY_MS);
    return () => {
      window.clearTimeout(showId);
      if (hideId) window.clearTimeout(hideId);
    };
  }, [placement, open]);

  // L3 — let any surface (hero CTA, "추천받기" card, sticky CTA) open the
  // assistant by dispatching `atc:open-assistant`. The widget otherwise has no
  // external open affordance besides its own FAB.
  useEffect(() => {
    function onExternalOpen() {
      setOpen(true);
      setTeaserVisible(false);
    }
    window.addEventListener(OPEN_ASSISTANT_EVENT, onExternalOpen as EventListener);
    return () => window.removeEventListener(OPEN_ASSISTANT_EVENT, onExternalOpen as EventListener);
  }, []);

  const pageContext = useCallback(
    () =>
      typeof window !== "undefined"
        ? {
            url: window.location.href.slice(0, 2000),
            title: document.title?.slice(0, 400) ?? undefined,
            section: window.location.hash ? window.location.hash.replace(/^#/, "").slice(0, 80) : undefined,
          }
        : undefined,
    [],
  );

  const sendFeedback = useCallback(
    (index: number, rating: 1 | -1) => {
      if (feedback[index]) return; // one vote per message
      const answer = messages[index]?.content ?? "";
      if (!answer) return;
      const question = index > 0 && messages[index - 1]?.role === "user" ? messages[index - 1].content : undefined;
      setFeedback((prev) => ({ ...prev, [index]: rating }));
      void fetch("/api/tour-product/assistant/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          answer,
          question,
          tourProductSlug: storageKey,
          pageUrl: typeof window !== "undefined" ? window.location.href.slice(0, 2000) : undefined,
        }),
      }).catch(() => {
        /* best-effort; keep the optimistic UI */
      });
    },
    [feedback, messages, storageKey],
  );

  const runAssistant = useCallback(
    async (next: ChatMessage[]) => {
      // W0.10: one in-flight request at a time; a stalled stream self-aborts.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      let timedOut = false;
      let watchdog: number | null = null;
      const kickWatchdog = () => {
        if (watchdog) window.clearTimeout(watchdog);
        watchdog = window.setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, STREAM_STALL_TIMEOUT_MS);
      };

      setLoading(true);
      try {
        kickWatchdog();
        const res = await fetch("/api/tour-product/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            assistantScope: scope,
            tourProductSlug: storageKey,
            messages: trimChatHistory(next),
            pageContext: pageContext(),
            stream: true,
          }),
        });

        // Content negotiation (D-T2-1): the server streams SSE only for a
        // free-form model answer. Deterministic gates, fallbacks, and older
        // servers reply with JSON — fall through to the buffered path below.
        const contentType = res.headers.get("content-type") || "";
        if (res.ok && contentType.includes("text/event-stream") && res.body) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          const lastUserQuestion =
            [...next].reverse().find((m) => m.role === "user")?.content ?? "";
          // Rebuild the tail each update so deltas grow a single bubble rather
          // than appending many.
          const renderAssistant = (content: string, extra?: Partial<ChatMessage>) =>
            setMessages(() => [...next, { role: "assistant", content, origin: "ai", ...extra }]);

          let buffer = "";
          let streamed = "";
          let started = false;
          let settled = false;
          try {
            for (;;) {
              const { done, value } = await reader.read();
              kickWatchdog(); // any progress resets the stall timer
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const { events, rest } = parseSseBuffer(buffer);
              buffer = rest;
              for (const ev of events) {
                // W0.8 (C-34): a single malformed SSE payload used to throw an
                // uncaught SyntaxError here and freeze the widget in a
                // permanent loading state. Broken chunks are skipped; a broken
                // `done` falls back to the streamed buffer.
                if (ev.event === "delta") {
                  let text = "";
                  try {
                    text = (JSON.parse(ev.data) as { text?: string }).text ?? "";
                  } catch {
                    continue;
                  }
                  if (!text) continue;
                  streamed += text;
                  // First token: drop the typing indicator, show the bubble.
                  if (!started) {
                    started = true;
                    setLoading(false);
                  }
                  renderAssistant(streamed);
                } else if (ev.event === "done") {
                  // done.reply is authoritative (D-T2-4): snap the bubble to it.
                  let payload: AssistantResponse = {};
                  try {
                    payload = JSON.parse(ev.data) as AssistantResponse;
                  } catch {
                    payload = {};
                  }
                  const finalText = payload.reply ?? streamed;
                  if (!finalText) continue; // broken done + nothing streamed → dropped-connection guard below
                  settled = true;
                  renderAssistant(finalText, {
                    checkoutUrl: safeCheckoutUrl(payload.checkout_url) ?? undefined,
                  });
                  setHandoffOffer(payload.handoff_offered ? { question: lastUserQuestion } : null);
                  if (payload.ticket_id && payload.escalated) {
                    setActiveTicketId(payload.ticket_id);
                    setLiveStatus("open");
                  }
                } else if (ev.event === "error") {
                  settled = true;
                  setHandoffOffer(null);
                  renderAssistant(labels.requestFailed("assistant_failed"), { origin: "system" });
                }
              }
            }
          } finally {
            reader.releaseLock();
          }

          // Stream ended with neither done nor error and nothing rendered
          // (dropped connection): surface a network error.
          if (!settled && !started) {
            setHandoffOffer(null);
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: labels.networkError, origin: "system" },
            ]);
          }
          return;
        }

        const data = (await res.json()) as AssistantResponse;
        if (!res.ok) {
          const err = data.message || data.error || "Request failed";
          setHandoffOffer(null);
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: res.status === 503 ? labels.aiUnavailable : labels.requestFailed(err),
              origin: "system",
            },
          ]);
          return;
        }
        if (data.reply) {
          setMessages([
            ...next,
            {
              role: "assistant",
              content: data.reply,
              origin: "ai",
              checkoutUrl: safeCheckoutUrl(data.checkout_url) ?? undefined,
            },
          ]);
          const lastUserQuestion = [...next].reverse().find((m) => m.role === "user")?.content ?? "";
          setHandoffOffer(data.handoff_offered ? { question: lastUserQuestion } : null);
          if (data.ticket_id && data.escalated) {
            setActiveTicketId(data.ticket_id);
            setLiveStatus("open");
          }
        }
      } catch (err) {
        // User-initiated abort (panel closed / superseded request) is silent;
        // a watchdog timeout surfaces the network-error bubble.
        if ((err as Error)?.name === "AbortError" && !timedOut) return;
        setHandoffOffer(null);
        setMessages((prev) => [...prev, { role: "assistant", content: labels.networkError, origin: "system" }]);
      } finally {
        if (watchdog) window.clearTimeout(watchdog);
        if (abortRef.current === controller) abortRef.current = null;
        setLoading(false);
      }
    },
    [labels, pageContext, scope, storageKey],
  );

  const applyLiveSupportMessages = useCallback((incoming: LiveSupportMessage[]) => {
    if (incoming.length === 0) return;
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.supportMessageId).filter((id): id is number => typeof id === "number"));
      const nextMessages = incoming
        .filter((m) => !seen.has(m.id))
        .map<ChatMessage>((m) => ({
          role: m.sender === "user" ? "user" : "assistant",
          content: m.content,
          origin: m.sender === "admin" ? "admin" : m.sender === "system" ? "system" : "support_user",
          supportMessageId: m.id,
        }));
      return nextMessages.length > 0 ? [...prev, ...nextMessages] : prev;
    });
  }, []);

  const sendLiveSupportMessage = useCallback(
    async (text: string) => {
      if (!activeTicketId) return;
      setLoading(true);
      try {
        const res = await fetch("/api/tour-product/assistant/live", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ticketId: activeTicketId,
            content: text,
          }),
        });
        const data = (await res.json()) as LiveSupportResponse;
        if (!res.ok) {
          const err = data.error || "Request failed";
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: labels.liveSendFailed(err), origin: "system" },
          ]);
          return;
        }
        if (data.ticket_id) setActiveTicketId(data.ticket_id);
        if (data.message) {
          setMessages((prev) =>
            prev.map((m, idx) =>
              idx === prev.length - 1 && m.role === "user" && m.content === text && !m.supportMessageId
                ? { ...m, origin: "support_user" as const, supportMessageId: data.message!.id }
                : m,
            ),
          );
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: labels.liveSendFailed("network_error"), origin: "system" },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [activeTicketId, labels],
  );

  const requestHumanSupport = useCallback(
    async (question?: string) => {
      if (loading || liveSupportActive) return;
      const latestUserQuestion =
        question?.trim() ||
        [...messages].reverse().find((m) => m.role === "user" && m.content.trim())?.content ||
        labels.directSupportQuestion;
      const next: ChatMessage[] = [...messages, { role: "user", content: labels.handoffRequest }];

      setHandoffOffer(null);
      setMessages(next);
      setLoading(true);

      try {
        const res = await fetch("/api/tour-product/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assistantScope: scope,
            tourProductSlug: storageKey,
            messages: next,
            handoffRequested: true,
            handoffQuestion: latestUserQuestion,
            pageContext: pageContext(),
          }),
        });
        const data = (await res.json()) as AssistantResponse;
        if (!res.ok) {
          const err = data.message || data.error || "Request failed";
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: labels.handoffFailed(err), origin: "system" },
          ]);
          return;
        }
        if (data.reply) {
          setMessages([...next, { role: "assistant", content: data.reply, origin: "system" }]);
        }
        if (data.ticket_id) {
          setActiveTicketId(data.ticket_id);
          setLiveStatus("open");
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: labels.handoffNetworkError, origin: "system" },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [labels, liveSupportActive, loading, messages, pageContext, scope, storageKey],
  );

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setHandoffOffer(null);
    const next: ChatMessage[] = [
      ...messages,
      { role: "user", content: text, origin: liveSupportActive ? "support_user" : undefined },
    ];
    setMessages(next);
    if (liveSupportActive) {
      await sendLiveSupportMessage(text);
      return;
    }
    await runAssistant(next);
  }, [input, liveSupportActive, loading, messages, runAssistant, sendLiveSupportMessage]);

  const sendPreset = useCallback(
    async (text: string) => {
      const preset = text.trim();
      if (!preset || loading || liveSupportActive) return;
      setHandoffOffer(null);
      const next: ChatMessage[] = [...messages, { role: "user", content: preset }];
      setMessages(next);
      await runAssistant(next);
    },
    [liveSupportActive, loading, messages, runAssistant],
  );

  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        `${STORAGE_PREFIX}${storageKey}`,
        JSON.stringify(messages.slice(-STORED_HISTORY_MAX)),
      );
    } catch {
      // Ignore unavailable sessionStorage.
    }
  }, [messages, storageKey]);

  useEffect(() => {
    try {
      if (activeTicketId) {
        window.sessionStorage.setItem(`${LIVE_TICKET_PREFIX}${storageKey}`, String(activeTicketId));
      } else {
        window.sessionStorage.removeItem(`${LIVE_TICKET_PREFIX}${storageKey}`);
      }
    } catch {
      // Ignore unavailable sessionStorage.
    }
  }, [activeTicketId, storageKey]);

  useEffect(() => {
    lastSupportMessageIdRef.current = messages.reduce(
      (max, m) => Math.max(max, typeof m.supportMessageId === "number" ? m.supportMessageId : 0),
      0,
    );
  }, [messages]);

  useEffect(() => {
    if (!activeTicketId) return;
    let cancelled = false;
    let timer: number | null = null;

    const poll = async () => {
      try {
        const params = new URLSearchParams({
          ticketId: String(activeTicketId),
          afterId: String(lastSupportMessageIdRef.current),
        });
        const res = await fetch(`/api/tour-product/assistant/live?${params.toString()}`, {
          credentials: "same-origin",
        });
        const data = (await res.json()) as LiveSupportResponse;
        if (cancelled || !res.ok) return;
        if (data.ticket === null) {
          setActiveTicketId(null);
          setLiveStatus(null);
          return;
        }
        if (data.messages) applyLiveSupportMessages(data.messages);
        if (data.ticket?.status) {
          setLiveStatus(data.ticket.status);
          if (data.ticket.status === "resolved" || data.ticket.status === "closed") {
            setActiveTicketId(null);
          }
        }
      } catch {
        // Keep polling; transient network drops should not end the chat.
      }
    };

    void poll();
    timer = window.setInterval(() => void poll(), 1500);
    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
    };
  }, [activeTicketId, applyLiveSupportMessages]);

  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [open, messages, loading, handoffOffer, activeTicketId]);

  const chipsDisabled = loading || liveSupportActive;
  const bottomClass =
    placement === "tour"
      ? "bottom-[calc(9.5rem+env(safe-area-inset-bottom,0px))] sm:bottom-[calc(7.5rem+env(safe-area-inset-bottom,0px))]"
      : // Mobile: stack ABOVE FloatingLanguageToggle (which sits at
        // bottom+80px and is ~44px tall) — 8.5rem clears it with a
        // 12px breathing gap. Desktop keeps bottom-5 since the lang
        // toggle is md:hidden and never competes.
        "bottom-[calc(8.5rem+env(safe-area-inset-bottom,0px))] sm:bottom-5";

  return (
    <div
      className={cn("pointer-events-none fixed right-3 z-[65] flex flex-col items-end sm:right-5", bottomClass)}
      data-tour-assistant-root
    >
      <AnimatePresence mode="wait">
        {open && (
        <motion.div
          // framer-motion v12 requires a stable `key` on the direct child
          // of AnimatePresence for exit detection to fire reliably. With
          // no key, the exit animation was being skipped on the unmount.
          key="chatbot-panel"
          // Emerges from the button's bottom-right corner — small scale +
          // soft slide + fade, eased with MSG_EASE so it feels intentional
          // rather than abrupt. Exit is slightly faster (panel disappears
          // first, button stays). reduce-motion respected via the
          // motion-reduce check on the parent root.
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{
            opacity: 1,
            scale: 1,
            y: 0,
            transition: { duration: 0.22, ease: MSG_EASE },
          }}
          exit={{
            opacity: 0,
            scale: 0.96,
            y: 6,
            transition: { duration: 0.16, ease: MSG_EASE },
          }}
          className="pointer-events-auto mb-3 flex max-h-[min(78vh,36rem)] w-[min(100vw-1.5rem,26rem)] origin-bottom-right flex-col overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-[0_24px_64px_-12px_rgba(26,35,50,0.22),0_0_0_1px_rgba(26,35,50,0.05)]"
          role="dialog"
          aria-label={labels.title}
        >
          <div className="relative shrink-0 border-b border-sky-900/10 bg-gradient-to-r from-sky-50 via-white to-amber-50 px-4 pb-3.5 pt-3.5">
            <div className="absolute right-2 top-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-white/90 hover:text-slate-950"
                aria-label={labels.close}
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
            <div className="flex items-start gap-3 pr-8">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-950 text-white shadow-md ring-2 ring-white/70">
                <ChatBotAvatar className="h-7 w-7 text-white" />
              </div>
              <div className="min-w-0 pt-0.5">
                <div className="inline-flex items-center gap-1 rounded-full border border-sky-900/15 bg-white/80 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-sky-900">
                  <Sparkles className="h-2.5 w-2.5" aria-hidden />
                  {labels.badge}
                </div>
                <h2 className="mt-1.5 text-sm font-bold leading-tight tracking-tight text-slate-950">
                  {labels.title}
                </h2>
                {liveSupportActive && (
                  <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                    {labels.activeSupport}
                  </div>
                )}
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-500" title={title}>
                  {title}
                </p>
              </div>
            </div>
          </div>

          <div
            ref={listRef}
            className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-gradient-to-b from-slate-50 to-white px-3.5 py-3.5 [scrollbar-gutter:stable]"
          >
            {messages.length === 0 && (
              <div className="rounded-2xl border border-dashed border-sky-900/20 bg-white/90 px-3.5 py-3.5 text-[12.5px] leading-relaxed text-slate-600 shadow-sm">
                <p className="font-semibold text-slate-950">{labels.introTitle}</p>
                <p className="mt-1.5 text-[12px] text-slate-600">{labels.introBody}</p>
                {!liveSupportActive && (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void requestHumanSupport()}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-sky-950 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-sky-900 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <Headphones className="h-3.5 w-3.5" aria-hidden />
                    {labels.contactSupport}
                  </button>
                )}
                {quickChips.length > 0 && !liveSupportActive && (
                  <div className="mt-3 flex flex-col gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      {labels.popular}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {quickChips.map((q) => (
                        <button
                          key={q}
                          type="button"
                          disabled={chipsDisabled}
                          onClick={() => void sendPreset(q)}
                          className="max-w-full rounded-full border border-sky-900/20 bg-white px-3 py-1.5 text-left text-[11px] font-medium leading-snug text-sky-900 shadow-sm transition hover:border-sky-900/40 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <AnimatePresence initial={false}>
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <motion.div
                    key={`u-${i}-${m.content.slice(0, 64)}`}
                    className="flex justify-end pl-6"
                    initial={{ opacity: 0, y: 14, filter: "blur(2px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    transition={{ duration: 0.55, ease: MSG_EASE }}
                  >
                    <div className="max-w-[92%] rounded-2xl rounded-br-md bg-sky-950 px-3.5 py-2.5 text-left text-[13px] font-medium leading-relaxed text-white shadow-md">
                      <span className="whitespace-pre-wrap break-words">{m.content}</span>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key={`a-${i}-${m.content.slice(0, 64)}`}
                    className="flex justify-start pr-2"
                    initial={{ opacity: 0, y: 16, filter: "blur(3px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    transition={{ duration: 0.62, ease: MSG_EASE }}
                  >
                    <div className="max-w-[96%] rounded-2xl rounded-bl-md border border-white/90 bg-white px-3.5 py-2.5 text-[13px] leading-[1.55] text-slate-900 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.35)] ring-1 ring-slate-200/70">
                      {(m.origin === "admin" || m.origin === "system") && (
                        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-sky-800/75">
                          {m.origin === "admin" ? labels.contactSupport : "Support"}
                        </span>
                      )}
                      <ChatMarkdown text={m.content} />
                      {safeCheckoutUrl(m.checkoutUrl) ? (
                        <a
                          href={safeCheckoutUrl(m.checkoutUrl)!}
                          className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-[12.5px] font-bold text-white transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                        >
                          {CHECKOUT_CTA[uiLang] ?? CHECKOUT_CTA.en}
                        </a>
                      ) : null}
                      {(!m.origin || m.origin === "ai") && (
                        <div className="mt-1.5 flex items-center gap-1.5 border-t border-slate-100 pt-1.5">
                          {feedback[i] ? (
                            <span className="text-[10px] font-medium text-slate-400">
                              {feedback[i] === 1 ? fb.thanks : fb.noted}
                            </span>
                          ) : (
                            <>
                              <button
                                type="button"
                                aria-label={fb.helpful}
                                title={fb.helpful}
                                onClick={() => sendFeedback(i, 1)}
                                className="rounded-full p-1 text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-600"
                              >
                                <ThumbsUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                aria-label={fb.notHelpful}
                                title={fb.notHelpful}
                                onClick={() => sendFeedback(i, -1)}
                                className="rounded-full p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                              >
                                <ThumbsDown className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ),
              )}
            </AnimatePresence>

            {loading && (
              <motion.div
                className="flex justify-start pr-2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: MSG_EASE }}
              >
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-white/80 bg-white px-3 py-2 shadow-sm ring-1 ring-slate-200/60">
                  <TypingDots />
                </div>
              </motion.div>
            )}

            {handoffOffer && !loading && !liveSupportActive && (
              <motion.div
                className="flex justify-start pr-2"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: MSG_EASE }}
              >
                <div className="max-w-[96%] rounded-2xl border border-sky-900/20 bg-white px-3.5 py-3 text-[12px] leading-relaxed text-slate-900 shadow-sm">
                  <p className="font-semibold">{labels.contactPromptTitle}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void requestHumanSupport(handoffOffer.question)}
                      className="rounded-full bg-sky-950 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-sky-900"
                    >
                      {labels.connectNow}
                    </button>
                    <button
                      type="button"
                      onClick={() => setHandoffOffer(null)}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-50"
                    >
                      {labels.notNow}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {messages.length > 0 && quickChips.length > 0 && !liveSupportActive && (
            <div className="shrink-0 border-t border-slate-200/70 bg-white/95 px-2.5 pb-1 pt-2">
              <div className="mb-1.5 flex items-center justify-between gap-2 px-1">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">{labels.suggested}</p>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void requestHumanSupport()}
                  className="inline-flex items-center gap-1 rounded-full border border-sky-900/15 bg-white px-2.5 py-1 text-[10px] font-semibold text-sky-900 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Headphones className="h-3 w-3" aria-hidden />
                  {labels.contactSupport}
                </button>
              </div>
              <div className="flex max-w-full gap-2 overflow-x-auto pb-1.5 pt-0.5 [scrollbar-gutter:stable]">
                {quickChips.map((q) => (
                  <button
                    key={q}
                    type="button"
                    disabled={chipsDisabled}
                    onClick={() => void sendPreset(q)}
                    className="shrink-0 max-w-[min(18rem,78vw)] rounded-full border border-sky-900/20 bg-sky-50 px-3 py-1.5 text-left text-[10.5px] font-medium leading-snug text-sky-950 transition hover:border-sky-900/35 hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="shrink-0 border-t border-slate-200 bg-white p-2.5">
            <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1.5 pl-2.5 transition focus-within:border-sky-900/30 focus-within:bg-white focus-within:shadow-sm">
              <label htmlFor={inputId} className="sr-only">
                {labels.message}
              </label>
              <input
                id={inputId}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  // W0.10 (C-37): during Korean/Japanese IME composition Enter
                  // commits the composition, not the message — sending here
                  // used to fire half-composed text.
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder={liveSupportActive ? labels.supportMessagePlaceholder : labels.questionPlaceholder}
                className="min-h-10 min-w-0 flex-1 border-0 bg-transparent py-1.5 text-[13px] text-slate-950 outline-none ring-0 placeholder:text-slate-400"
                disabled={loading}
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => void send()}
                disabled={loading || !input.trim()}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-950 text-white shadow-sm transition enabled:hover:bg-sky-900 disabled:opacity-35"
                aria-label={labels.send}
              >
                <Send className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
            <p className="mt-1.5 text-center text-[10px] text-slate-500">
              {liveSupportActive ? labels.liveNotice : labels.aiNotice}
            </p>
          </div>
        </motion.div>
        )}
      </AnimatePresence>

      {/* L1 — idle teaser pill. A compact one-glance nudge (title + short
          feature line) instead of a card: shows once per session, auto-hides,
          and stays small enough to never cover page content. Tapping it opens
          the chat; the × dismisses immediately. */}
      <AnimatePresence>
        {teaserVisible && !open && (
          <motion.div
            key="assistant-teaser"
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.24, ease: MSG_EASE } }}
            exit={{ opacity: 0, y: 6, scale: 0.98, transition: { duration: 0.16, ease: MSG_EASE } }}
            className="pointer-events-auto mb-2.5 max-w-[min(100vw-5.5rem,16rem)] origin-bottom-right"
          >
            <div className="flex items-center gap-1 rounded-2xl border border-slate-200/90 bg-white/95 py-2 pl-3 pr-1.5 shadow-[0_10px_28px_-10px_rgba(26,35,50,0.3)] backdrop-blur-sm">
              <button
                type="button"
                onClick={() => {
                  setOpen(true);
                  dismissTeaser();
                }}
                className="block min-w-0 text-left"
              >
                <p className="flex items-center gap-1.5 text-[12px] font-bold leading-tight text-slate-900">
                  <Sparkles className="h-3.5 w-3.5 flex-shrink-0 text-amber-500" strokeWidth={2.2} />
                  <span className="truncate">{labels.teaserTitle}</span>
                  <ArrowRight className="h-3 w-3 flex-shrink-0 text-sky-700" strokeWidth={2.2} />
                </p>
                <p className="mt-0.5 truncate text-[11px] leading-snug text-slate-500">{labels.teaserBody}</p>
              </button>
              <button
                type="button"
                onClick={dismissTeaser}
                aria-label={labels.close}
                className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center self-start rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="pointer-events-auto relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "group relative flex items-center justify-center overflow-hidden rounded-full text-white transition-[box-shadow,transform] duration-200 ease-out",
            "h-[3.75rem] w-[3.75rem] sm:h-[4.25rem] sm:w-[4.25rem]",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2",
            "active:scale-[0.94]",
            "backdrop-blur-xl backdrop-saturate-150",
            "ring-1 ring-white/15",
            open
              ? "bg-black/80 shadow-[0_4px_18px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.18)]"
              : [
                  // True black-glass orb — translucent dark gradient picks
                  // up the page behind it via backdrop-blur, so the button
                  // reads as a polished glass pebble rather than a solid
                  // chip.
                  "bg-gradient-to-br from-slate-900/65 via-black/72 to-black/85",
                  // Floating drop shadow + curved rim light (inset top
                  // highlight) + inner bottom darken for sphere depth.
                  "shadow-[0_2px_6px_rgba(0,0,0,0.35),0_10px_26px_-6px_rgba(0,0,0,0.55),0_24px_50px_-12px_rgba(0,0,0,0.45),inset_0_1.5px_0_rgba(255,255,255,0.3),inset_0_-2px_6px_rgba(0,0,0,0.45)]",
                  // Hover: brighter glass rim + a touch more lift.
                  "hover:-translate-y-0.5 hover:ring-white/25 hover:shadow-[0_3px_8px_rgba(0,0,0,0.4),0_14px_32px_-6px_rgba(0,0,0,0.6),0_30px_60px_-12px_rgba(0,0,0,0.55),inset_0_1.5px_0_rgba(255,255,255,0.36),inset_0_-2px_6px_rgba(0,0,0,0.48)]",
                ],
          )}
          aria-expanded={open}
          aria-label={open ? labels.close : labels.title}
        >
          {/* Specular gloss arc — the wet "glass" highlight that hugs the
              top edge. Sits behind the icon so the robot still reads
              cleanly. */}
          {!open && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-2.5 top-1.5 h-3.5 rounded-full bg-gradient-to-b from-white/35 via-white/12 to-transparent blur-[1.5px]"
            />
          )}
          {/* Subtle bottom under-glow for a "floating-on-glass" sit. */}
          {!open && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-4 bottom-1.5 h-2 rounded-full bg-white/[0.06] blur-[3px]"
            />
          )}
          {open ? (
            <X className="relative h-6 w-6" strokeWidth={2.2} />
          ) : (
            <ChatBotAvatar className="relative h-11 w-11 drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)] sm:h-12 sm:w-12" />
          )}
        </button>
        {!open && (
          // Amber sparkle accent at top-right — the brand's signature warm
          // accent showing up on the concierge button. Stationary, not
          // pulsing (per user feedback that motion read as flashing).
          <span
            aria-hidden
            className="pointer-events-none absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_0_2px_rgba(255,255,255,0.95),0_1px_3px_rgba(180,83,9,0.4)]"
          />
        )}
      </div>
    </div>
  );
}
