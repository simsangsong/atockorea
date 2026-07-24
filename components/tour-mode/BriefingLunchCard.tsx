'use client';

/**
 * C-16 card ④ — lunch notice + dietary intake (guest-facing).
 *
 * 🔴 This chip row is §5.7 R-1 intake path ①. Unlike the DiningCard chips
 * (which only re-filter an already-loaded payload in the browser), tapping here
 * PERSISTS to `tour_day_plans.needs.dietary` via PUT /dietary — the first thing
 * `resolveDietary()` reads. So a guest who taps 비건 before lunch changes every
 * restaurant list they get for the rest of the day, with no further action.
 *
 * Optimistic + reconciled: the chip flips immediately, the request follows, and
 * a failure rolls the chip back and says so. A dietary restriction that
 * silently failed to save is worse than one that visibly did.
 *
 * 🔴 CLIENT-SAFE IMPORTS ONLY (cards/lunch.ts + dining/dietary.ts are pure).
 */

import { useState } from 'react';
import { Utensils, Check } from 'lucide-react';
import { LUNCH_COPY, LUNCH_INTAKE_TAGS, type BriefingLunchMeta } from '@/lib/ops/seating/cards/lunch';
import { DIETARY_LABELS } from '@/lib/ops/dining/dietary';
import type { DietaryTag } from '@/lib/ops/dining/dietary';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

export default function BriefingLunchCard({
  meta,
  text,
  locale,
  auth,
}: {
  meta: BriefingLunchMeta;
  /** The capsule's translated body (already locale-picked by the feed). */
  text: string;
  locale: RoomLocale;
  /** Room credentials for the dietary PUT. Omitted = read-only card. */
  auth?: { bookingId: string; roomSession: string } | null;
}) {
  const copy = LUNCH_COPY[locale] ?? LUNCH_COPY.en;
  const initial = (Array.isArray(meta.dietary) ? meta.dietary : []).filter((tag): tag is DietaryTag =>
    (LUNCH_INTAKE_TAGS as readonly string[]).includes(tag),
  );
  const [tags, setTags] = useState<DietaryTag[]>(initial);
  const [state, setState] = useState<'idle' | 'saved' | 'failed'>('idle');
  const editable = Boolean(auth?.bookingId && auth?.roomSession);

  const toggle = (tag: DietaryTag) => {
    if (!editable) return;
    const before = tags;
    const next = tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag];
    setTags(next);
    setState('idle');
    void fetch(`/api/tour-rooms/${encodeURIComponent(auth!.bookingId)}/dietary`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-tour-room-auth': auth!.roomSession },
      body: JSON.stringify({ dietary: next }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        setState('saved');
      })
      .catch(() => {
        setTags(before);
        setState('failed');
      });
  };

  return (
    <div
      className="overflow-hidden rounded-[var(--tr-radius-card)] border border-[var(--tr-hairline)] bg-[var(--tr-surface)]"
      data-testid="briefing-lunch-card"
    >
      <div className="flex items-center gap-2.5 px-3.5 pb-1.5 pt-3">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--tr-accent-soft)] text-[var(--tr-accent-deep)]"
          aria-hidden
        >
          <Utensils size={15} strokeWidth={2} />
        </span>
        <p className="min-w-0 flex-1 text-sm font-semibold text-[var(--tr-ink)]">{copy.title}</p>
      </div>

      <p
        className="tr-card-text whitespace-pre-line px-3.5 pb-2.5 leading-relaxed text-[var(--tr-ink)]"
        data-testid="briefing-lunch-body"
      >
        {text}
      </p>

      <div className="border-t border-[var(--tr-hairline)] px-3.5 pb-3 pt-2.5">
        <p className="tr-meta pb-1.5 font-medium text-[var(--tr-ink-2)]">{copy.intake}</p>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={copy.intake} data-testid="briefing-lunch-chips">
          {LUNCH_INTAKE_TAGS.map((tag) => {
            const active = tags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggle(tag)}
                disabled={!editable}
                aria-pressed={active}
                className={`tr-label tr-press inline-flex min-h-[44px] items-center gap-1 rounded-full border px-3 font-medium disabled:opacity-60 ${
                  active
                    ? 'border-[var(--tr-accent)] bg-[var(--tr-accent)] text-[var(--tr-bubble-me-ink)]'
                    : 'border-[var(--tr-hairline)] bg-[var(--tr-surface)] text-[var(--tr-ink-2)]'
                }`}
                data-testid={`briefing-lunch-chip-${tag}`}
              >
                {active ? <Check size={13} strokeWidth={2.5} aria-hidden /> : null}
                {DIETARY_LABELS[tag][locale]}
              </button>
            );
          })}
        </div>

        <p
          className={`tr-meta pt-1.5 ${state === 'failed' ? 'text-[var(--tr-danger)]' : 'text-[var(--tr-ink-3)]'}`}
          data-testid="briefing-lunch-status"
          aria-live="polite"
        >
          {state === 'saved' ? copy.saved : state === 'failed' ? copy.failed : copy.hint}
        </p>
      </div>
    </div>
  );
}
