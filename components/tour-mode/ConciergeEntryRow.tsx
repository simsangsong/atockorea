'use client';

/**
 * A1 — Smart Guide entry row for the chat tab.
 *
 * A slim, tappable row that sits just above the composer so a guest discovers
 * the AI concierge right where they'd otherwise type a question to the guide.
 * Tapping opens the (shell-owned) concierge sheet — the Q&A stays session-local
 * there, so this never posts into the human chat feed.
 */

import { CONCIERGE_CHIPS, CONCIERGE_COPY } from '@/lib/tour-room/concierge';
import { IconConcierge } from '@/components/tour-mode/icons';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

export default function ConciergeEntryRow({
  locale,
  onOpen,
}: {
  locale: RoomLocale;
  onOpen: () => void;
}) {
  const copy = CONCIERGE_COPY[locale];
  // First two chips double as a preview of what a tap can answer.
  const preview = CONCIERGE_CHIPS.slice(0, 2)
    .map((chip) => chip.label[locale])
    .join(' · ');

  return (
    <button
      type="button"
      onClick={onOpen}
      className="mb-2 flex w-full items-center gap-2.5 rounded-full border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-3.5 py-2 text-left transition-transform active:scale-[0.99]"
      data-testid="concierge-entry-row"
    >
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--tr-accent-soft)] text-[var(--tr-accent-deep)]"
        aria-hidden
      >
        <IconConcierge size={15} strokeWidth={2.25} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="tr-card-text block truncate font-semibold text-[var(--tr-ink)]">{copy.entryRow}</span>
        <span className="tr-meta block truncate text-[var(--tr-ink-3)]">{preview}</span>
      </span>
      <span className="tr-meta shrink-0 rounded-full bg-[var(--tr-accent-soft)] px-2 py-0.5 font-medium text-[var(--tr-accent-deep)]">
        AI
      </span>
    </button>
  );
}
