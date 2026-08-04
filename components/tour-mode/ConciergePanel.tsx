'use client';

/**
 * V2.2 — the Smart Guide panel (concierge-uiux-v2 plan §D-1), rendered inside
 * the RoomShell concierge sheet.
 *
 * Tier 0 runs entirely on the client: the four quick chips and any free-text
 * question whose keywords match answer instantly from data the room already
 * holds (latest arrival content + schedule + active notice) — zero network,
 * zero LLM. Guardrailed asks that need no server side effect (emergency
 * pointer, venue refusal) also answer locally; operational requests and
 * unmatched free text go to POST /concierge (escalation / Tier 1).
 *
 * The Q&A thread is session-local by design (vision-ask's private-by-default
 * precedent): the room feed stays a human channel.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  answerTier0,
  classifyConciergeGuardrail,
  latestArrivalContext,
  matchConciergeIntent,
  renderConciergeAnswer,
  CONCIERGE_CHIPS,
  CONCIERGE_COPY,
  CONCIERGE_RETRY_COPY,
  type ScheduleItemLike,
  type Tier0Context,
} from '@/lib/tour-room/concierge';
import { activeNotice } from '@/lib/tour-room/notices';
import { roomLifecycle } from '@/lib/tour-room/time';
import { IconCamera, IconConcierge, IconConciergeSend, IconRetry, TR_ICON, TR_STROKE } from '@/components/tour-mode/icons';
import FacilityMapCard from '@/components/tour-mode/FacilityMapCard';
import DiningCard from '@/components/tour-mode/DiningCard';
import type { DiningCardMeta } from '@/lib/ops/dining/card';
import type { ConciergeMapCard } from '@/lib/tour-room/concierge';
import type { RoomMessage } from '@/hooks/useTourRoomChannel';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

interface ThreadEntry {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  mapCard?: ConciergeMapCard;
  /** §5.7 R-5 — the dining RAG's answer (list + Kakao deep links, no tile). */
  diningCard?: DiningCardMeta;
  /**
   * UX-002 / UX-008 — a failure needs to be more than a sentence in an
   * assistant bubble. Without somewhere to record WHY it failed and WHAT was
   * asked, the panel could not offer to retry, and it could not tell a rate
   * limit apart from anything else — so it told the guest to try again while
   * trying again was the one thing blocked.
   */
  failure?: {
    kind: 'error' | 'rate_limited';
    /** From the route's Retry-After. The server always knew; nobody read it. */
    retryAfterSec?: number;
    /** Wall-clock moment the retry becomes possible; drives the countdown. */
    retryAtMs?: number;
    /** Kept so retry means one tap, not retyping. */
    question: string;
  };
}

export default function ConciergePanel({
  bookingId,
  roomSession,
  locale,
  schedule,
  messages,
  tourDate,
  onVisionAsk,
}: {
  bookingId: string;
  roomSession: string;
  locale: RoomLocale;
  schedule: ScheduleItemLike[];
  messages: RoomMessage[];
  tourDate: string | null;
  /**
   * R7 — photo questions inside the Smart Guide sheet. The manual promises
   * "send a photo of a sign or a dish"; until now that lived only in the chat
   * composer, so the sheet quietly lacked the button guests were told about.
   * Absent (read-only / ended rooms) hides the camera button.
   */
  onVisionAsk?: (
    file: File,
    options: { question: string; share: boolean },
  ) => Promise<{ answer: string } | { reason: string } | null>;
}) {
  const copy = CONCIERGE_COPY[locale];
  const retryCopy = CONCIERGE_RETRY_COPY[locale];
  const [thread, setThread] = useState<ThreadEntry[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  // A photo round trip is visibly slower than a text one, so it says so.
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const idRef = useRef(0);
  const threadRef = useRef<HTMLDivElement | null>(null);

  const ctx: Tier0Context = useMemo(() => {
    const nowMs = Date.now();
    const arrival = latestArrivalContext(messages, locale);
    const notice = activeNotice(messages, tourDate, nowMs);
    return {
      spotTitle: arrival.spotTitle,
      content: arrival.content,
      facilityPins: arrival.facilityPins,
      schedule,
      freeTime:
        notice && !notice.cancelled && notice.remainingMs !== null
          ? { remainingMs: notice.remainingMs, point: notice.point }
          : null,
      nowMs,
      lifecycle: roomLifecycle(tourDate, nowMs),
    };
  }, [messages, schedule, tourDate]);

  useEffect(() => {
    threadRef.current?.scrollTo?.({ top: threadRef.current.scrollHeight });
  }, [thread, busy]);

  const push = (
    role: ThreadEntry['role'],
    text: string,
    mapCard?: ConciergeMapCard,
    diningCard?: DiningCardMeta,
  ) => {
    // Snapshot the id now — the updater runs later, and a batched user+
    // assistant pair would otherwise both read the final counter value.
    idRef.current += 1;
    const id = idRef.current;
    setThread((prev) => [...prev, { id, role, text, mapCard, diningCard }]);
  };

  /** A failure that remembers what was asked, so retrying costs one tap. */
  const pushFailure = (question: string, kind: 'error' | 'rate_limited', retryAfterSec?: number) => {
    idRef.current += 1;
    const id = idRef.current;
    const text = kind === 'rate_limited' && retryAfterSec ? retryCopy.wait(retryAfterSec) : copy.error;
    const retryAtMs = kind === 'rate_limited' && retryAfterSec ? Date.now() + retryAfterSec * 1000 : undefined;
    setThread((prev) => [
      ...prev,
      { id, role: 'assistant', text, failure: { kind, retryAfterSec, retryAtMs, question } },
    ]);
  };

  /**
   * 🔴 A retry button that is guaranteed to fail is the defect UX-008 named,
   * wearing a button instead of a sentence: it invites the tap at the one
   * moment the tap cannot work. While a rate limit is still counting down the
   * button stays disabled and shows what is left, and the tick only runs while
   * such a failure is actually pending.
   */
  const [nowMs, setNowMs] = useState(() => Date.now());
  const waiting = thread.some((e) => e.failure?.retryAtMs && e.failure.retryAtMs > nowMs);
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [waiting]);

  const askServer = async (question: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/tour-rooms/${encodeURIComponent(bookingId)}/concierge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tour-room-auth': roomSession },
        body: JSON.stringify({ question, locale }),
      });
      /**
       * UX-008 — the dining route answers 429 with a Retry-After, computed from
       * a three-per-minute participant gate. Choosing a restaurant is a
       * browsing action, so a guest hits that wall on their third look, and
       * until now the header was dropped and the generic "please try again"
       * shown at the exact moment trying again was blocked.
       */
      if (res.status === 429) {
        const header = Number(res.headers.get('Retry-After'));
        pushFailure(question, 'rate_limited', Number.isFinite(header) && header > 0 ? Math.ceil(header) : undefined);
        return;
      }
      const json = (await res.json().catch(() => ({}))) as {
        text?: string;
        mapCard?: ConciergeMapCard;
        card?: DiningCardMeta;
      };
      if (!res.ok || !json.text) {
        pushFailure(question, 'error');
        return;
      }
      push(
        'assistant',
        json.text,
        json.mapCard,
        json.card?.kind === 'dining_card' ? json.card : undefined,
      );
    } catch {
      pushFailure(question, 'error');
    } finally {
      setBusy(false);
    }
  };

  // R7 — photo questions inside the sheet: same vision-ask route the composer
  // uses, and the answer lands in this thread via the existing push().
  const askPhoto = async (file: File) => {
    if (!onVisionAsk || busy) return;
    const question = input.trim();
    push('user', question || copy.photoAsk);
    setInput('');
    setBusyLabel(copy.photoAsking);
    setBusy(true);
    try {
      const result = await onVisionAsk(file, { question, share: false });
      // The sheet keeps its single generic sentence on purpose — it is a
      // conversation, and 'that photo is too large' reads oddly as a reply from
      // a guide. The composer panel, which shows a form, names the cause.
      const answer = result && 'answer' in result ? result.answer : null;
      push('assistant', answer ?? copy.error);
    } catch {
      push('assistant', copy.error);
    } finally {
      setBusy(false);
      setBusyLabel(null);
    }
  };

  const askChip = (intent: (typeof CONCIERGE_CHIPS)[number]['intent'], label: string) => {
    if (busy) return;
    push('user', label);
    // Food asks live server-side now (§5.7 R-2 ③): the Kakao/Google picks are
    // cached in the DB, not in the message feed, so this one chip pays for a
    // round trip. Everything else still answers with zero network.
    if (intent === 'restaurant') {
      void askServer(label);
      return;
    }
    const answer = answerTier0(intent, { ...ctx, nowMs: Date.now() }, locale);
    push('assistant', answer.text, answer.mapCard);
  };

  const submit = () => {
    const question = input.trim();
    if (!question || busy) return;
    setInput('');
    push('user', question);

    // Food asks go to the server's dining RAG (§5.7 R-2 ③) — checked before
    // the venue guardrail so a data-backed answer wins over the blanket
    // refusal. The endpoint falls back to this spot's curated pins, and then to
    // the honest refusal, on its own.
    const intentEarly = matchConciergeIntent(question);
    if (intentEarly === 'restaurant') {
      void askServer(question);
      return;
    }

    // Local guardrails that need no server side effect answer instantly;
    // ops requests must reach the server (it posts the escalation message).
    const guardrail = classifyConciergeGuardrail(question);
    if (guardrail === 'emergency') {
      push('assistant', renderConciergeAnswer('emergency', locale));
      return;
    }
    if (guardrail === 'venue_recommendation') {
      push('assistant', renderConciergeAnswer('venue_refusal', locale));
      return;
    }
    if (guardrail === 'ops_request') {
      void askServer(question);
      return;
    }

    const intent = matchConciergeIntent(question);
    if (intent) {
      const answer = answerTier0(intent, { ...ctx, nowMs: Date.now() }, locale);
      push('assistant', answer.text, answer.mapCard);
      return;
    }
    void askServer(question);
  };

  return (
    <div className="flex flex-col gap-3" data-testid="concierge-panel">
      <p className="tr-card-text text-[var(--tr-ink-2)]">{copy.intro}</p>

      <div className="flex flex-wrap gap-1.5" data-testid="concierge-chips">
        {CONCIERGE_CHIPS.map((chip) => (
          <button
            key={chip.intent}
            type="button"
            onClick={() => askChip(chip.intent, chip.label[locale])}
            className="tr-label flex min-h-[44px] items-center rounded-full bg-[var(--tr-accent-soft)] px-4 font-medium text-[var(--tr-accent-deep)] tr-press"
            data-testid={`concierge-chip-${chip.intent}`}
          >
            {chip.label[locale]}
          </button>
        ))}
      </div>

      {thread.length > 0 && (
        <div
          ref={threadRef}
          className="flex max-h-[38dvh] flex-col gap-2 overflow-y-auto rounded-[var(--tr-radius-card)] bg-[var(--tr-canvas)] p-3"
          data-testid="concierge-thread"
        >
          {thread.map((entry) =>
            entry.role === 'user' ? (
              <div key={entry.id} className="flex justify-end pl-10">
                <div className="tr-card-text rounded-[var(--tr-radius-bubble)] bg-[var(--tr-bubble-me)] px-3.5 py-2 text-[var(--tr-bubble-me-ink)]">
                  {entry.text}
                </div>
              </div>
            ) : (
              <div key={entry.id} className="flex items-start gap-2 pr-6">
                <span
                  className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--tr-accent-soft)] text-[var(--tr-accent-deep)]"
                  aria-hidden
                >
                  <IconConcierge size={TR_ICON.meta} strokeWidth={TR_STROKE.small} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="tr-card-text inline-block whitespace-pre-line rounded-[var(--tr-radius-bubble)] bg-[var(--tr-surface)] px-3.5 py-2 leading-relaxed text-[var(--tr-ink)]">
                    {entry.text}
                  </div>
                  {entry.mapCard && (
                    <FacilityMapCard kind={entry.mapCard.kind} pins={entry.mapCard.pins} locale={locale} />
                  )}
                  {entry.diningCard && (
                    <div className="mt-2">
                      <DiningCard
                        meta={entry.diningCard}
                        locale={locale}
                        auth={{ bookingId, roomSession }}
                      />
                    </div>
                  )}
                  {/* UX-002 — the copy has always said "try again". This is the
                      first time there is something to press. One tap resends
                      the question the guest already typed. */}
                  {entry.failure &&
                    (() => {
                      const leftSec = entry.failure.retryAtMs
                        ? Math.ceil((entry.failure.retryAtMs - nowMs) / 1000)
                        : 0;
                      const blocked = leftSec > 0;
                      return (
                        <button
                          type="button"
                          onClick={() => void askServer(entry.failure!.question)}
                          disabled={busy || blocked}
                          className="tr-label tr-chip-tap mt-1.5 inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-[var(--tr-accent-soft)] px-3.5 font-semibold text-[var(--tr-accent-deep)] disabled:opacity-50"
                          data-testid="concierge-retry"
                        >
                          <IconRetry size={TR_ICON.meta} aria-hidden />
                          {blocked ? `${retryCopy.retry} · ${leftSec}s` : retryCopy.retry}
                        </button>
                      );
                    })()}
                </div>
              </div>
            ),
          )}
          {busy && (
            <div className="flex items-center gap-2 pl-8" data-testid="concierge-thinking">
              <span className="tr-meta text-[var(--tr-ink-3)]">{busyLabel ?? copy.thinking}</span>
            </div>
          )}
        </div>
      )}

      <div className="flex items-end gap-2">
        {onVisionAsk && (
          <>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              data-testid="concierge-photo-input"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                event.target.value = '';
                if (file) void askPhoto(file);
              }}
            />
            {/* Same accent-soft pair as the quick chips above, not neutral grey:
                the owner's report was that this capability looked absent, so it
                has to read as an offered action. */}
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={busy}
              aria-label={copy.photoAsk}
              title={copy.photoAsk}
              className="tr-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--tr-accent-soft)] text-[var(--tr-accent-deep)] disabled:opacity-40"
              data-testid="concierge-photo"
            >
              <IconCamera size={TR_ICON.action} strokeWidth={TR_STROKE.default} aria-hidden />
            </button>
          </>
        )}
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={copy.placeholder}
          className="tr-body min-h-[44px] w-full rounded-[var(--tr-radius-input)] bg-[var(--tr-surface-2)] px-4 text-[var(--tr-ink)] outline-none placeholder:text-[var(--tr-ink-3)]"
          data-testid="concierge-input"
        />
        <button
          type="button"
          onClick={submit}
          disabled={busy || !input.trim()}
          aria-label={copy.send}
          className="flex h-11 w-11 shrink-0 items-center justify-center tr-btn-raised rounded-full bg-[var(--tr-accent)] text-[var(--tr-bubble-me-ink)] disabled:opacity-40"
          data-testid="concierge-send"
        >
          <IconConciergeSend size={TR_ICON.action} strokeWidth={TR_STROKE.default} />
        </button>
      </div>
    </div>
  );
}
