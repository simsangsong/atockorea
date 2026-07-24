'use client';

/**
 * C-16 card ② — safety briefing (guest-facing).
 *
 * Two shapes from one metadata flag:
 *   - full      → the four safety lines plus the 30 s video when one is approved;
 *   - collapsed → the re-boarding variant: a one-line reminder and a [다시 보기]
 *     that reveals the full text. It is dismissable, so a guest on day 3 of the
 *     same booking is not made to scroll past the same card again.
 *
 * tr-* tokens only, 44px touch targets — light/dark and the cockpit alike.
 */

import { useState } from 'react';
import { ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';
import SafetyVideoCard from '@/components/tour-mode/SafetyVideoCard';
import { SAFETY_COPY, safetyFullTranslations, type BriefingSafetyMeta } from '@/lib/ops/seating/cards/safety';
import { isSafetyVideoMeta } from '@/lib/tour-room/safetyVideo';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

export default function BriefingSafetyCard({
  meta,
  text,
  locale,
  preferredLocale = null,
}: {
  meta: BriefingSafetyMeta;
  /** The capsule's translated body (already locale-picked by the feed). */
  text: string;
  locale: RoomLocale;
  preferredLocale?: string | null;
}) {
  const copy = SAFETY_COPY[locale] ?? SAFETY_COPY.en;
  const collapsed = meta.collapsed === true;
  const [open, setOpen] = useState(!collapsed);
  const video = isSafetyVideoMeta(meta.video_card) ? meta.video_card : null;
  // §11.D D3 — the expansion must repeat the SAME shape the capsule was sent
  // in; `meta.tour_kind` is stamped at compose time (older rows have none → the
  // shipped join wording, which is what they were sent with).
  const body = collapsed && open ? safetyFullTranslations(meta.tour_kind ?? 'join')[locale] : text;

  return (
    <div className="flex flex-col gap-2" data-testid="briefing-safety-card">
      <div className="overflow-hidden rounded-[var(--tr-radius-card)] border border-[var(--tr-hairline)] bg-[var(--tr-surface)]">
        <div className="flex items-center gap-2.5 px-3.5 pb-1.5 pt-3">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--tr-accent-soft)] text-[var(--tr-accent-deep)]"
            aria-hidden
          >
            <ShieldCheck size={15} strokeWidth={2} />
          </span>
          <p className="min-w-0 flex-1 text-sm font-semibold text-[var(--tr-ink)]" data-testid="briefing-safety-title">
            {collapsed ? copy.collapsedTitle : copy.title}
          </p>
          {collapsed ? (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="tr-pill tr-press inline-flex min-h-[44px] shrink-0 items-center gap-1 px-3 text-sm font-semibold text-[var(--tr-ink)]"
              data-testid="briefing-safety-toggle"
            >
              {open ? copy.collapse : copy.expand}
              {open ? (
                <ChevronUp size={14} strokeWidth={2} aria-hidden />
              ) : (
                <ChevronDown size={14} strokeWidth={2} aria-hidden />
              )}
            </button>
          ) : null}
        </div>

        <p
          className="tr-card-text whitespace-pre-line px-3.5 pb-3 leading-relaxed text-[var(--tr-ink)]"
          data-testid="briefing-safety-body"
        >
          {collapsed && !open ? text : body}
        </p>
      </div>

      {/* the 30 s multi-track film — present only once an admin approves one */}
      {video && (!collapsed || open) ? (
        <SafetyVideoCard
          meta={video}
          locale={locale}
          preferredLocale={preferredLocale}
          label={copy.video}
        />
      ) : null}
    </div>
  );
}
