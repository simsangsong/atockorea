"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Headset, Send, Sparkles, X } from "lucide-react";

import { cn } from "@/lib/utils";

type ChatMessage = { role: "user" | "assistant"; content: string };

const STORAGE_PREFIX = "tour-product-assistant:";

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
      ) as ChatMessage[];
    } catch {
      return [];
    }
  });
  const listRef = useRef<HTMLDivElement>(null);
  const inputId = useId();

  const runAssistant = useCallback(
    async (next: ChatMessage[]) => {
      setLoading(true);
      try {
        const res = await fetch("/api/tour-product/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tourProductSlug, messages: next }),
        });
        const data = (await res.json()) as { reply?: string; error?: string; message?: string };
        if (!res.ok) {
          const err = data.message || data.error || "Request failed";
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
          setMessages([...next, { role: "assistant", content: data.reply! }]);
        }
      } catch {
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
    [tourProductSlug],
  );

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    await runAssistant(next);
  }, [input, loading, messages, runAssistant]);

  const sendPreset = useCallback(
    async (text: string) => {
      const t = text.trim();
      if (!t || loading) return;
      const next: ChatMessage[] = [...messages, { role: "user", content: t }];
      setMessages(next);
      await runAssistant(next);
    },
    [loading, messages, runAssistant],
  );

  useEffect(() => {
    try {
      window.sessionStorage.setItem(`${STORAGE_PREFIX}${tourProductSlug}`, JSON.stringify(messages));
    } catch {
      /* ignore */
    }
  }, [messages, tourProductSlug]);

  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [open, messages, loading]);

  const showChips = supportQuickChips.length > 0;
  const chipsDisabled = loading;

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
                <Headset className="h-5 w-5" strokeWidth={1.9} aria-hidden />
              </div>
              <div className="min-w-0 pt-0.5">
                <div className="inline-flex items-center gap-1 rounded-full border border-[var(--primary)]/15 bg-white/80 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--primary)]">
                  <Sparkles className="h-2.5 w-2.5" aria-hidden />
                  Help center
                </div>
                <h2 className="mt-1.5 text-sm font-bold leading-tight tracking-tight text-[var(--foreground)]">
                  Ask about this tour
                </h2>
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
                {showChips && (
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
          </div>

          {/* Suggested questions — after chat started */}
          {messages.length > 0 && showChips && (
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
                placeholder="Type your question…"
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
              AI can make mistakes · confirm details on this page before booking
            </p>
          </div>
        </div>
      )}

      {/* Launch button — high contrast, “support desk” */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "pointer-events-auto group relative flex flex-col items-center justify-center gap-0.5 rounded-2xl border-2 text-white transition [transition-property:box-shadow,transform,border-color]",
          "h-[4.25rem] w-[4.25rem] min-h-[4.25rem] min-w-[4.25rem] sm:h-[4.5rem] sm:w-[4.5rem]",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]/50 focus-visible:ring-offset-2",
          "active:scale-[0.95]",
          open
            ? "border-white/30 bg-[var(--primary)] shadow-[0_4px_24px_rgba(30,60,100,0.4)]"
            : [
                "border-white/25 bg-gradient-to-br from-[#153a5c] via-[var(--primary)] to-[#2a6aa8]",
                "shadow-[0_6px_28px_rgba(20,50,90,0.45),0_0_0_1px_rgba(255,255,255,0.12)]",
                "hover:shadow-[0_10px_36px_rgba(20,50,90,0.5)]",
              ],
        )}
        aria-expanded={open}
        aria-label={open ? "Close help center" : "Open help center — ask about this tour"}
      >
        {open ? (
          <X className="h-6 w-6" strokeWidth={2.2} />
        ) : (
          <>
            <Headset className="h-7 w-7 drop-shadow-sm" strokeWidth={1.9} />
            <span className="text-[9px] font-bold uppercase tracking-wider text-white/95">Help</span>
          </>
        )}
      </button>
    </div>
  );
}
