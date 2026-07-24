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
  type ScheduleItemLike,
  type Tier0Context,
} from '@/lib/tour-room/concierge';
import { activeNotice } from '@/lib/tour-room/notices';
import { roomLifecycle } from '@/lib/tour-room/time';
import { IconConcierge, IconConciergeSend } from '@/components/tour-mode/icons';
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
}

export default function ConciergePanel({
  bookingId,
  roomSession,
  locale,
  schedule,
  messages,
  tourDate,
}: {
  bookingId: string;
  roomSession: string;
  locale: RoomLocale;
  schedule: ScheduleItemLike[];
  messages: RoomMessage[];
  tourDate: string | null;
}) {
  const copy = CONCIERGE_COPY[locale];
  const [thread, setThread] = useState<ThreadEntry[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const idRef = useRef(0);
  const threadRef = useRef<HTMLDivElement | null>(null);

  const ctx: Tier0Context = useMemo(() => {
    const nowMs = Date.now();
    const arrival = latestArrivalContext(messages);
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

  const askServer = async (question: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/tour-rooms/${encodeURIComponent(bookingId)}/concierge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tour-room-auth': roomSession },
        body: JSON.stringify({ question, locale }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        text?: string;
        mapCard?: ConciergeMapCard;
        card?: DiningCardMeta;
      };
      push(
        'assistant',
        res.ok && json.text ? json.text : copy.error,
        res.ok ? json.mapCard : undefined,
        res.ok && json.card?.kind === 'dining_card' ? json.card : undefined,
      );
    } catch {
      push('assistant', copy.error);
    } finally {
      setBusy(false);
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
            className="tr-label flex min-h-[40px] items-center rounded-full bg-[var(--tr-accent-soft)] px-4 font-medium text-[var(--tr-accent-deep)] tr-press"
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
                  <IconConcierge size={13} strokeWidth={2.25} />
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
                </div>
              </div>
            ),
          )}
          {busy && (
            <div className="flex items-center gap-2 pl-8" data-testid="concierge-thinking">
              <span className="tr-meta text-[var(--tr-ink-3)]">{copy.thinking}</span>
            </div>
          )}
        </div>
      )}

      <div className="flex items-end gap-2">
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
          <IconConciergeSend size={19} strokeWidth={2.25} />
        </button>
      </div>
    </div>
  );
}
