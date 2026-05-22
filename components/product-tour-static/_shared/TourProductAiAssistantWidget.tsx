"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Send, Sparkles, X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Custom chatbot avatar — refined customer-service vibe.
 * White rounded head + side headphone cups + dark face panel with cyan glowing
 * eyes + antenna with emerald "online" tip. Uses `currentColor` for the head so
 * it adapts to the surrounding theme (white on the dark launch button, primary
 * blue inside the drawer header avatar).
 */
function ChatBotAvatar({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      {/* Antenna stem */}
      <line
        x1="20"
        y1="3.5"
        x2="20"
        y2="8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.9"
      />
      {/* Antenna tip — emerald "online" indicator */}
      <circle cx="20" cy="3" r="1.9" fill="#34d399">
        <animate
          attributeName="r"
          values="1.6;2.1;1.6"
          dur="1.8s"
          repeatCount="indefinite"
        />
      </circle>
      <circle cx="20" cy="3" r="1.9" fill="#34d399" opacity="0.45">
        <animate
          attributeName="r"
          values="1.9;3.4;1.9"
          dur="1.8s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values="0.45;0;0.45"
          dur="1.8s"
          repeatCount="indefinite"
        />
      </circle>

      {/* Headphone cups — left & right */}
      <rect x="3.2" y="15.5" width="3.6" height="9" rx="1.8" fill="currentColor" opacity="0.95" />
      <rect x="33.2" y="15.5" width="3.6" height="9" rx="1.8" fill="currentColor" opacity="0.95" />

      {/* Head body — rounded rect (squircle) */}
      <rect x="6.8" y="9" width="26.4" height="22.5" rx="9" fill="currentColor" />

      {/* Face panel — recessed dark area for eyes */}
      <rect x="10.2" y="14.2" width="19.6" height="11.4" rx="5.7" fill="#0e2540" />

      {/* Eyes — cyan glow with white highlights */}
      <circle cx="16" cy="19.9" r="1.85" fill="#5eead4" />
      <circle cx="24" cy="19.9" r="1.85" fill="#5eead4" />
      <circle cx="16.55" cy="19.35" r="0.55" fill="#ffffff" />
      <circle cx="24.55" cy="19.35" r="0.55" fill="#ffffff" />

      {/* Subtle smile */}
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
};
type AssistantResponse = {
  reply?: string;
  error?: string;
  message?: string;
  ticket_id?: number | null;
  escalated?: boolean;
  escalation_reason?: string | null;
  handoff_offered?: boolean;
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

const STORAGE_PREFIX = "tour-product-assistant:";
const LIVE_TICKET_PREFIX = "tour-product-assistant-live-ticket:";

const MSG_EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Keep above `TourStickyBookingBar`’s reserved height:
 * — mobile: spacer `h-[calc(8.25rem+safe)]` + bottom tab row
 * — sm+: spacer `h-24` (no mobile nav)
 */
/* Taller launch button (~4.25rem) — stay fully above `TourStickyBookingBar` + spacer */
const ASSISTANT_BOTTOM_MOBILE = "bottom-[calc(9.5rem+env(safe-area-inset-bottom,0px))]";
const ASSISTANT_BOTTOM_SM = "sm:bottom-[calc(7.5rem+env(safe-area-inset-bottom,0px))]";

type TourProductAiAssistantWidgetProps = {
  tourProductSlug: string;
  productTitle: string;
  /** FAQ question lines for one-tap prompts (e.g. from `pickAssistantQuickChipsFromViewModel`). */
  supportQuickChips?: readonly string[];
};

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-0.5" aria-label="Loading" role="status">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--primary)]/55 [animation-duration:0.9s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--primary)]/55 [animation-delay:120ms] [animation-duration:0.9s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--primary)]/55 [animation-delay:240ms] [animation-duration:0.9s]" />
    </div>
  );
}

export function TourProductAiAssistantWidget({
  tourProductSlug,
  productTitle,
  supportQuickChips = [],
}: TourProductAiAssistantWidgetProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [handoffOffer, setHandoffOffer] = useState<{ question: string } | null>(null);
  const [activeTicketId, setActiveTicketId] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const raw = window.sessionStorage.getItem(`${LIVE_TICKET_PREFIX}${tourProductSlug}`);
    const parsed = raw ? Number(raw) : NaN;
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  });
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.sessionStorage.getItem(`${STORAGE_PREFIX}${tourProductSlug}`);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (m) =>
          m &&
          typeof m === "object" &&
          (m as ChatMessage).role &&
          typeof (m as ChatMessage).content === "string",
      ).map((m) => ({
        role: (m as ChatMessage).role,
        content: (m as ChatMessage).content,
        origin: (m as ChatMessage).origin,
        supportMessageId:
          typeof (m as ChatMessage).supportMessageId === "number"
            ? (m as ChatMessage).supportMessageId
            : undefined,
      })) as ChatMessage[];
    } catch {
      return [];
    }
  });
  const listRef = useRef<HTMLDivElement>(null);
  const inputId = useId();
  const lastSupportMessageIdRef = useRef(0);
  const liveSupportActive = activeTicketId !== null && liveStatus !== "resolved" && liveStatus !== "closed";

  const pageContext = useCallback(
    () =>
      typeof window !== "undefined"
        ? {
            url: window.location.href.slice(0, 2000),
            title: document.title?.slice(0, 400) ?? undefined,
            // best-effort current section: read [#fragment] or document scroll
            section: window.location.hash ? window.location.hash.replace(/^#/, "").slice(0, 80) : undefined,
          }
        : undefined,
    [],
  );

  const runAssistant = useCallback(
    async (next: ChatMessage[]) => {
      setLoading(true);
      try {
        const res = await fetch("/api/tour-product/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tourProductSlug,
            messages: next,
            pageContext: pageContext(),
          }),
        });
        const data = (await res.json()) as AssistantResponse;
        if (!res.ok) {
          const err = data.message || data.error || "Request failed";
          setHandoffOffer(null);
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content:
                res.status === 503
                  ? "The AI assistant is not available on this environment yet. Please use the FAQ on the page or contact us to book."
                  : `Sorry, something went wrong (${err}). Please try again or use the contact options on this page.`,
            },
          ]);
          return;
        }
        if (data.reply) {
          setMessages([...next, { role: "assistant", content: data.reply!, origin: "ai" }]);
          const lastUserQuestion = [...next].reverse().find((m) => m.role === "user")?.content ?? "";
          setHandoffOffer(data.handoff_offered ? { question: lastUserQuestion } : null);
          if (data.ticket_id && data.escalated) {
            setActiveTicketId(data.ticket_id);
            setLiveStatus("open");
          }
        }
      } catch {
        setHandoffOffer(null);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Network error. Check your connection and try again.",
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [pageContext, tourProductSlug],
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
            {
              role: "assistant",
              content: `담당자에게 메시지를 전달하지 못했습니다 (${err}). 잠시 후 다시 시도해 주세요.`,
              origin: "system",
            },
          ]);
          return;
        }
        if (data.ticket_id) setActiveTicketId(data.ticket_id);
        if (data.message) {
          setMessages((prev) => {
            let updated = false;
            const nextMessages = prev.map((m, idx) => {
              if (!updated && idx === prev.length - 1 && m.role === "user" && m.content === text && !m.supportMessageId) {
                updated = true;
                return { ...m, origin: "support_user" as const, supportMessageId: data.message!.id };
              }
              return m;
            });
            return updated ? nextMessages : nextMessages;
          });
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "네트워크 오류로 담당자에게 메시지를 전달하지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.",
            origin: "system",
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [activeTicketId],
  );

  const requestHumanSupport = useCallback(async () => {
    if (loading || !handoffOffer) return;
    const handoffMessage = "네, 담당자 고객센터로 연결해주세요.";
    const next: ChatMessage[] = [...messages, { role: "user", content: handoffMessage }];
    setHandoffOffer(null);
    setMessages(next);
    setLoading(true);

    try {
      const res = await fetch("/api/tour-product/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tourProductSlug,
          messages: next,
          handoffRequested: true,
          handoffQuestion: handoffOffer.question,
          pageContext: pageContext(),
        }),
      });
      const data = (await res.json()) as AssistantResponse;
      if (!res.ok) {
        const err = data.message || data.error || "Request failed";
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `고객센터 연결을 접수하지 못했습니다 (${err}). 잠시 후 다시 시도하거나 contact 페이지를 이용해 주세요.`,
          },
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
        {
          role: "assistant",
          content: "네트워크 오류로 고객센터 연결을 접수하지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [handoffOffer, loading, messages, pageContext, tourProductSlug]);

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
      const t = text.trim();
      if (!t || loading || liveSupportActive) return;
      setHandoffOffer(null);
      const next: ChatMessage[] = [...messages, { role: "user", content: t }];
      setMessages(next);
      await runAssistant(next);
    },
    [liveSupportActive, loading, messages, runAssistant],
  );

  useEffect(() => {
    try {
      window.sessionStorage.setItem(`${STORAGE_PREFIX}${tourProductSlug}`, JSON.stringify(messages));
    } catch {
      /* ignore */
    }
  }, [messages, tourProductSlug]);

  useEffect(() => {
    try {
      if (activeTicketId) {
        window.sessionStorage.setItem(`${LIVE_TICKET_PREFIX}${tourProductSlug}`, String(activeTicketId));
      } else {
        window.sessionStorage.removeItem(`${LIVE_TICKET_PREFIX}${tourProductSlug}`);
      }
    } catch {
      /* ignore */
    }
  }, [activeTicketId, tourProductSlug]);

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

  const showChips = supportQuickChips.length > 0;
  const chipsDisabled = loading || liveSupportActive;

  return (
    <div
      className={cn(
        "pointer-events-none fixed right-3 z-[65] flex flex-col items-end sm:right-5",
        ASSISTANT_BOTTOM_MOBILE,
        ASSISTANT_BOTTOM_SM,
      )}
      data-tour-assistant-root
    >
      {open && (
        <div
          className="tour-assistant-panel pointer-events-auto mb-3 flex max-h-[min(78vh,36rem)] w-[min(100vw-1.5rem,26rem)] origin-bottom-right flex-col overflow-hidden rounded-3xl border border-[var(--border)]/90 bg-[var(--card)] shadow-[0_24px_64px_-12px_rgba(26,35,50,0.2),0_0_0_1px_rgba(26,35,50,0.05)]"
          role="dialog"
          aria-label="Tour support chat"
        >
          {/* Header — support desk */}
          <div className="relative shrink-0 border-b border-[var(--primary)]/10 bg-gradient-to-r from-[#e8f0f8] via-[var(--mist-blue)] to-[#faf6f0] px-4 pb-3.5 pt-3.5">
            <div className="absolute right-2 top-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted-foreground)] transition hover:bg-white/90 hover:text-[var(--foreground)]"
                aria-label="Close"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
            <div className="flex items-start gap-3 pr-8">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--primary)] text-white shadow-md ring-2 ring-white/70">
                <ChatBotAvatar className="h-7 w-7 text-white" />
              </div>
              <div className="min-w-0 pt-0.5">
                <div className="inline-flex items-center gap-1 rounded-full border border-[var(--primary)]/15 bg-white/80 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--primary)]">
                  <Sparkles className="h-2.5 w-2.5" aria-hidden />
                  Help center
                </div>
                <h2 className="mt-1.5 text-sm font-bold leading-tight tracking-tight text-[var(--foreground)]">
                  Ask about this tour
                </h2>
                {liveSupportActive && (
                  <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                    담당자 상담 연결됨
                  </div>
                )}
                <p
                  className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-[var(--muted-foreground)]"
                  title={productTitle}
                >
                  {productTitle}
                </p>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div
            ref={listRef}
            className="tour-assistant-scroll min-h-0 flex-1 space-y-3 overflow-y-auto bg-gradient-to-b from-[#f5f2ec] to-[var(--soft-pearl)] px-3.5 py-3.5"
          >
            {messages.length === 0 && (
              <div className="rounded-2xl border border-dashed border-[var(--primary)]/20 bg-white/80 px-3.5 py-3.5 text-[12.5px] leading-relaxed text-[var(--muted-foreground)] shadow-sm">
                <p className="font-semibold text-[var(--foreground)]/90">How can we help?</p>
                <p className="mt-1.5 text-[12px] text-[var(--muted-foreground)]">
                  Get quick answers in your language. Tap a common question below or type your own—responses follow
                  this product page and general travel guidance.
                </p>
                {showChips && !liveSupportActive && (
                  <div className="mt-3 flex flex-col gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                      Popular questions
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {supportQuickChips.map((q) => (
                        <button
                          key={q}
                          type="button"
                          disabled={chipsDisabled}
                          onClick={() => void sendPreset(q)}
                          className="max-w-full rounded-full border border-[var(--primary)]/25 bg-white px-3 py-1.5 text-left text-[11px] font-medium leading-snug text-[var(--primary)] shadow-sm transition hover:border-[var(--primary)]/45 hover:bg-[var(--mist-blue)] disabled:cursor-not-allowed disabled:opacity-45"
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
                    <div className="max-w-[92%] rounded-2xl rounded-br-md bg-[var(--primary)] px-3.5 py-2.5 text-left text-[13px] font-medium leading-relaxed text-white shadow-md">
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
                    <div className="max-w-[96%] rounded-2xl rounded-bl-md border border-white/90 bg-white px-3.5 py-2.5 text-[13px] leading-[1.55] text-[var(--foreground)]/95 shadow-[var(--shadow-card)] ring-1 ring-[var(--border)]/45">
                      {(m.origin === "admin" || m.origin === "system") && (
                        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--primary)]/75">
                          {m.origin === "admin" ? "담당자" : "Support"}
                        </span>
                      )}
                      <span className="whitespace-pre-wrap break-words">{m.content}</span>
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
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-white/80 bg-white px-3 py-2 shadow-[var(--shadow-subtle)] ring-1 ring-[var(--border)]/40">
                  <TypingDots />
                </div>
              </motion.div>
            )}

            {handoffOffer && !loading && (
              <motion.div
                className="flex justify-start pr-2"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: MSG_EASE }}
              >
                <div className="max-w-[96%] rounded-2xl border border-[var(--primary)]/20 bg-white px-3.5 py-3 text-[12px] leading-relaxed text-[var(--foreground)] shadow-[var(--shadow-card)]">
                  <p className="font-semibold">담당자 고객센터로 연결해 드릴까요?</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void requestHumanSupport()}
                      className="rounded-full bg-[var(--primary)] px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:brightness-110"
                    >
                      네, 연결해주세요
                    </button>
                    <button
                      type="button"
                      onClick={() => setHandoffOffer(null)}
                      className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-[11px] font-semibold text-[var(--muted-foreground)] transition hover:bg-[var(--muted)]/60"
                    >
                      아니요
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Suggested questions — after chat started */}
          {messages.length > 0 && showChips && !liveSupportActive && (
            <div className="shrink-0 border-t border-[var(--border)]/50 bg-white/90 px-2.5 pb-1 pt-2">
              <p className="mb-1.5 px-1 text-[9px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                Suggested
              </p>
              <div className="tour-assistant-scroll flex max-w-full gap-2 overflow-x-auto pb-1.5 pt-0.5 [scrollbar-gutter:stable]">
                {supportQuickChips.map((q) => (
                  <button
                    key={q}
                    type="button"
                    disabled={chipsDisabled}
                    onClick={() => void sendPreset(q)}
                    className="shrink-0 max-w-[min(18rem,78vw)] rounded-full border border-[var(--primary)]/22 bg-[var(--mist-blue)]/80 px-3 py-1.5 text-left text-[10.5px] font-medium leading-snug text-[var(--primary)] transition hover:border-[var(--primary)]/35 hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Composer */}
          <div className="shrink-0 border-t border-[var(--border)]/80 bg-white p-2.5">
            <div className="flex items-end gap-2 rounded-2xl border border-[var(--border)]/90 bg-[var(--muted)]/35 p-1.5 pl-2.5 transition focus-within:border-[var(--primary)]/35 focus-within:bg-white focus-within:shadow-sm">
              <label htmlFor={inputId} className="sr-only">
                Message
              </label>
              <input
                id={inputId}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder={liveSupportActive ? "담당자에게 보낼 메시지…" : "Type your question…"}
                className="min-h-10 min-w-0 flex-1 border-0 bg-transparent py-1.5 text-[13px] text-[var(--foreground)] outline-none ring-0 placeholder:text-[var(--muted-foreground)]/85"
                disabled={loading}
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => void send()}
                disabled={loading || !input.trim()}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)] text-white shadow-sm transition enabled:hover:brightness-110 disabled:opacity-35"
                aria-label="Send"
              >
                <Send className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
            <p className="mt-1.5 text-center text-[10px] text-[var(--muted-foreground)]/90">
              {liveSupportActive
                ? "담당자 상담 중입니다. 입력한 메시지는 Telegram으로 전달됩니다."
                : "AI can make mistakes · confirm details on this page before booking"}
            </p>
          </div>
        </div>
      )}

      {/* Launch button — chatbot floating badge with custom avatar */}
      <div className="pointer-events-auto relative">
        {/* Pulse halo — subtle "available" cue when closed */}
        {!open && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-[var(--primary)]/35 motion-safe:animate-ping"
          />
        )}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "group relative flex items-center justify-center rounded-full text-white transition [transition-property:box-shadow,transform]",
            "h-[3.75rem] w-[3.75rem] sm:h-[4.25rem] sm:w-[4.25rem]",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]/50 focus-visible:ring-offset-2",
            "active:scale-[0.94]",
            open
              ? "bg-[var(--primary)] shadow-[0_4px_24px_rgba(30,60,100,0.4)]"
              : [
                  "bg-gradient-to-br from-[#0e2a48] via-[#1d4d7d] to-[#3578b5]",
                  "shadow-[0_10px_32px_rgba(20,50,90,0.5),inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-3px_8px_rgba(0,0,0,0.18)]",
                  "hover:shadow-[0_14px_40px_rgba(20,50,90,0.6)] hover:-translate-y-0.5",
                ],
          )}
          aria-expanded={open}
          aria-label={open ? "Close help center" : "Open help center — ask about this tour"}
        >
          {open ? (
            <X className="h-6 w-6" strokeWidth={2.2} />
          ) : (
            <ChatBotAvatar className="h-11 w-11 drop-shadow-[0_2px_3px_rgba(0,0,0,0.25)] sm:h-12 sm:w-12" />
          )}
        </button>
        {/* Speech-bubble tail — chat indicator, bottom-right */}
        {!open && (
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-1 right-2 h-3 w-3 rotate-45 rounded-sm bg-gradient-to-br from-[#1d4d7d] to-[#3578b5] shadow-[0_2px_4px_rgba(20,50,90,0.3)]"
          />
        )}
      </div>
    </div>
  );
}
