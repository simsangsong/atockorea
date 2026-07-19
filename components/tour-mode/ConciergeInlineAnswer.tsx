'use client';

/**
 * C — inline Smart Guide answer.
 *
 * When a customer types an answerable info question into the MAIN chat (a
 * Tier-0 intent: restroom / photo spot / next stop / time left), the AI answers
 * instantly — but only on the asker's own screen, as this dismissible banner
 * above the composer. It is never persisted or broadcast, so the shared feed
 * stays a human channel and the guide's own reply is never talked over.
 */

import { CONCIERGE_COPY } from '@/lib/tour-room/concierge';
import { IconConcierge } from '@/components/tour-mode/icons';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

export interface InlineConciergeAnswer {
  id: number;
  question: string;
  text: string;
}

const MORE_LABEL: Record<RoomLocale, string> = {
  en: 'Ask more',
  ko: '이어서 물어보기',
  ja: 'さらに質問',
  es: 'Preguntar más',
  zh: '继续提问',
};

const DISMISS_LABEL: Record<RoomLocale, string> = {
  en: 'Dismiss',
  ko: '닫기',
  ja: '閉じる',
  es: 'Cerrar',
  zh: '关闭',
};

export default function ConciergeInlineAnswer({
  answer,
  locale,
  onOpen,
  onDismiss,
}: {
  answer: InlineConciergeAnswer;
  locale: RoomLocale;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  const copy = CONCIERGE_COPY[locale];
  return (
    <div
      className="tr-anim-bubble-in mb-2 rounded-[var(--tr-radius-card)] border border-[var(--tr-accent)] bg-[var(--tr-accent-soft)] p-3"
      role="status"
      data-testid="concierge-inline-answer"
    >
      <div className="flex items-start gap-2.5">
        <span
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--tr-accent)] text-[var(--tr-bubble-me-ink)]"
          aria-hidden
        >
          <IconConcierge size={13} strokeWidth={2.25} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="tr-meta font-semibold text-[var(--tr-accent-deep)]">{copy.aiLabel}</p>
          <p className="tr-card-text mt-1 whitespace-pre-line leading-relaxed text-[var(--tr-ink)]">{answer.text}</p>
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={onOpen}
              className="tr-label font-semibold text-[var(--tr-accent-deep)] underline-offset-2 active:underline"
              data-testid="concierge-inline-more"
            >
              {MORE_LABEL[locale]}
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="tr-label text-[var(--tr-ink-3)]"
              data-testid="concierge-inline-dismiss"
            >
              {DISMISS_LABEL[locale]}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
