'use client';

/**
 * B — operator AI assist (guide/driver).
 *
 * A staff-facing Smart Guide: the guide asks the same room-aware AI as the
 * traveller, but in operator framing ("draft a reply", "what's the next stop",
 * "restroom near here?"). Answers come back Korean-first and are never posted
 * to the room — this is the guide's private scratchpad.
 *
 * Auth is flexible: a guide console drives with an invite `token` (sent in the
 * body); a cockpit that has already joined passes its `roomSession` header.
 */

import { useEffect, useRef, useState } from 'react';
import { IconConcierge, IconConciergeSend } from '@/components/tour-mode/icons';

interface Turn {
  id: number;
  role: 'user' | 'assistant';
  text: string;
}

const SUGGESTIONS = ['다음 스팟이 어디죠?', '지금 위치 근처 화장실', '집합 시간 안내 문구 초안', '남은 자유시간 얼마죠?'];

export default function OperatorAssist({
  bookingId,
  token,
  roomSession,
}: {
  bookingId: string;
  /** Guide/driver invite token (guide console). */
  token?: string | null;
  /** Signed room session header (cockpit that already joined). */
  roomSession?: string | null;
}) {
  const [thread, setThread] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const idRef = useRef(0);
  const threadRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    threadRef.current?.scrollTo?.({ top: threadRef.current.scrollHeight });
  }, [thread, busy]);

  const push = (role: Turn['role'], text: string) => {
    idRef.current += 1;
    const id = idRef.current;
    setThread((prev) => [...prev, { id, role, text }]);
  };

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    setInput('');
    push('user', q);
    setBusy(true);
    try {
      const res = await fetch(`/api/tour-rooms/${encodeURIComponent(bookingId)}/concierge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(roomSession ? { 'x-tour-room-auth': roomSession } : {}),
        },
        // Korean-first: the guide reads answers in Korean regardless of the
        // room's guest language.
        body: JSON.stringify({ question: q, locale: 'ko', ...(token ? { token } : {}) }),
      });
      const json = (await res.json().catch(() => ({}))) as { text?: string };
      push('assistant', res.ok && json.text ? json.text : '답변을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
    } catch {
      push('assistant', '네트워크 오류로 답변을 불러오지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3" data-testid="operator-assist">
      <p className="tr-card-text text-[var(--tr-ink-2)]">
        손님에게 답하거나 오늘 동선을 확인할 때 물어보세요. 답변은 손님에게 전송되지 않아요.
      </p>

      {thread.length === 0 && (
        <div className="flex flex-wrap gap-1.5" data-testid="operator-assist-suggestions">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => void ask(s)}
              className="tr-label flex min-h-[40px] items-center rounded-full bg-[var(--tr-accent-soft)] px-4 font-medium text-[var(--tr-accent-deep)] active:scale-95"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {thread.length > 0 && (
        <div
          ref={threadRef}
          className="flex max-h-[42dvh] flex-col gap-2 overflow-y-auto rounded-[var(--tr-radius-card)] bg-[var(--tr-canvas)] p-3"
          data-testid="operator-assist-thread"
        >
          {thread.map((t) =>
            t.role === 'user' ? (
              <div key={t.id} className="flex justify-end pl-10">
                <div className="tr-card-text rounded-[var(--tr-radius-bubble)] bg-[var(--tr-bubble-me)] px-3.5 py-2 text-[var(--tr-bubble-me-ink)]">
                  {t.text}
                </div>
              </div>
            ) : (
              <div key={t.id} className="flex items-start gap-2 pr-6">
                <span
                  className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--tr-accent-soft)] text-[var(--tr-accent-deep)]"
                  aria-hidden
                >
                  <IconConcierge size={13} strokeWidth={2.25} />
                </span>
                <div className="tr-card-text whitespace-pre-line rounded-[var(--tr-radius-bubble)] bg-[var(--tr-surface)] px-3.5 py-2 leading-relaxed text-[var(--tr-ink)]">
                  {t.text}
                </div>
              </div>
            ),
          )}
          {busy && (
            <div className="flex items-center gap-2 pl-8" data-testid="operator-assist-thinking">
              <span className="tr-meta text-[var(--tr-ink-3)]">확인 중…</span>
            </div>
          )}
        </div>
      )}

      <div className="flex items-end gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void ask(input);
            }
          }}
          placeholder="AI 도우미에게 물어보기…"
          className="tr-body min-h-[44px] w-full rounded-[var(--tr-radius-input)] bg-[var(--tr-surface-2)] px-4 text-[var(--tr-ink)] outline-none placeholder:text-[var(--tr-ink-3)]"
          data-testid="operator-assist-input"
        />
        <button
          type="button"
          onClick={() => void ask(input)}
          disabled={busy || !input.trim()}
          aria-label="물어보기"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--tr-accent)] text-[var(--tr-bubble-me-ink)] active:scale-95 disabled:opacity-40"
          data-testid="operator-assist-send"
        >
          <IconConciergeSend size={19} strokeWidth={2.25} />
        </button>
      </div>
    </div>
  );
}
