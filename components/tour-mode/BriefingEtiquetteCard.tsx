'use client';

/**
 * C-16 card ⑤ — manners, punctuality, and talking to the driver (guest-facing).
 *
 * Plain text card by design: six short rules read faster as a list than as a
 * grid of icons, and every line is already pre-translated. The one affordance
 * is the closing pointer at the composer's one-tap presets — the card tells the
 * guest where the phrasebook already is instead of duplicating it.
 */

import { Landmark } from 'lucide-react';
import { ETIQUETTE_COPY, type BriefingEtiquetteMeta } from '@/lib/ops/seating/cards/etiquette';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

export default function BriefingEtiquetteCard({
  meta,
  text,
  locale,
}: {
  meta: BriefingEtiquetteMeta;
  /** The capsule's translated body (already locale-picked by the feed). */
  text: string;
  locale: RoomLocale;
}) {
  const copy = ETIQUETTE_COPY[locale] ?? ETIQUETTE_COPY.en;

  return (
    <div
      className="overflow-hidden rounded-[var(--tr-radius-card)] border border-[var(--tr-hairline)] bg-[var(--tr-surface)]"
      data-testid="briefing-etiquette-card"
    >
      <div className="flex items-center gap-2.5 px-3.5 pb-1.5 pt-3">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--tr-accent-soft)] text-[var(--tr-accent-deep)]"
          aria-hidden
        >
          <Landmark size={15} strokeWidth={2} />
        </span>
        <p className="min-w-0 flex-1 text-sm font-semibold text-[var(--tr-ink)]">{copy.title}</p>
      </div>

      <p
        className="tr-card-text whitespace-pre-line px-3.5 pb-2.5 leading-relaxed text-[var(--tr-ink)]"
        data-testid="briefing-etiquette-body"
      >
        {text}
      </p>

      {meta.preset_hint === false ? null : (
        <p
          className="tr-meta border-t border-[var(--tr-hairline)] bg-[var(--tr-surface-2)] px-3.5 py-2 leading-relaxed text-[var(--tr-ink-2)]"
          data-testid="briefing-etiquette-preset-hint"
        >
          {copy.presetHint}
        </p>
      )}
    </div>
  );
}
