'use client';

/**
 * Plan §G tab ① — "이 투어 추천 일정".
 *
 * Renders the BOOKED tour's own itinerary as rich photo cards (big photo +
 * number + title + time), tap → the SHARED product-detail drawer
 * (TourStopDetailDrawer), matching the tour-product page's presentation inside
 * the tr-themed planner. "담기" maps a stop into the wish-list plan; the whole
 * course can be adopted at once. Renders nothing when the tour has no rich
 * itinerary (the planner then shows generic course templates).
 */

import { useMemo, useState } from 'react';
import { Check, ChevronRight, Clock3, Plus, Sparkles } from 'lucide-react';
import {
  TourStopDetailDrawer,
} from '@/components/product-tour-static/_shared/TourStopDetailDrawer';
import type { ItineraryStop } from '@/components/product-tour-static/_shared/tourProductDetailSectionTypes';
import { mergeTourProductSectionUi } from '@/lib/tour-product/tourProductSectionUi';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

export interface PlanTourItineraryLabels {
  sectionTitle: string;
  sectionSub: string;
  applyAll: string;
  add: string;
  added: string;
  details: string;
  stopsCount: (n: number) => string;
}

function stopPhoto(stop: ItineraryStop): string | null {
  if (stop.image) return stop.image;
  if (stop.images && stop.images.length > 0) return stop.images[0];
  return null;
}

/** HH:MM only when the time is a strict clock (ops sometimes write "≈ 08:30"). */
function stopTime(stop: ItineraryStop): string | null {
  const raw = (stop.time ?? '').trim();
  const m = /^(\d{1,2}:\d{2})/.exec(raw);
  return m ? m[1] : null;
}

export default function PlanTourItinerary({
  stops,
  locale,
  tourTitle,
  canEdit,
  addedKeys,
  labels,
  onApplyAll,
  onAddStop,
}: {
  stops: ItineraryStop[];
  locale: RoomLocale;
  tourTitle: string | null;
  canEdit: boolean;
  /** poi_keys already in the plan → the card shows "담김" instead of "담기". */
  addedKeys: Set<string>;
  labels: PlanTourItineraryLabels;
  onApplyAll: () => void;
  onAddStop: (stop: ItineraryStop) => void;
}) {
  const [drawerStop, setDrawerStop] = useState<ItineraryStop | null>(null);
  // Locale-aware default drawer copy (the planner has no per-tour sectionUi).
  const sectionUi = useMemo(() => mergeTourProductSectionUi(undefined, locale), [locale]);
  if (stops.length === 0) return null;

  return (
    <section className="flex flex-col gap-3" data-testid="plan-tour-itinerary">
      <div className="tr-card px-4 py-4">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--tr-accent-soft)] text-[var(--tr-accent-deep)]">
            <Sparkles size={19} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <span className="tr-meta font-semibold uppercase text-[var(--tr-accent-deep)]">{labels.sectionTitle}</span>
            <h2 className="mt-0.5 text-[16px] font-bold leading-snug text-[var(--tr-ink)]">
              {tourTitle || labels.sectionTitle}
            </h2>
            <p className="tr-label mt-1 leading-relaxed text-[var(--tr-ink-2)]">{labels.sectionSub}</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="tr-label inline-flex min-h-8 items-center rounded-full bg-[var(--tr-surface-2)] px-3 text-[var(--tr-ink-2)]">
            {labels.stopsCount(stops.length)}
          </span>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={onApplyAll}
            className="tr-body mt-3 flex min-h-[46px] w-full items-center justify-center gap-2 rounded-2xl bg-[var(--tr-accent)] px-4 font-bold text-[var(--tr-bubble-me-ink)] shadow-[var(--tr-plan-shadow-button)] transition active:scale-[0.99]"
            data-testid="plan-tour-apply-all"
          >
            <Plus size={17} aria-hidden />
            {labels.applyAll}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2.5">
        {stops.map((stop) => {
          const photo = stopPhoto(stop);
          const time = stopTime(stop);
          const poiKey = stop._poi_meta?.poi_key ?? null;
          const added = poiKey ? addedKeys.has(poiKey) : false;
          return (
            <article
              key={`${stop.number}-${stop.name}`}
              className="tr-card overflow-hidden"
              data-testid="plan-tour-stop-card"
            >
              <button
                type="button"
                onClick={() => setDrawerStop(stop)}
                className="flex w-full items-stretch gap-0 text-left active:opacity-95"
                aria-label={`${stop.name} — ${labels.details}`}
              >
                <div className="relative h-[92px] w-[92px] shrink-0 bg-[var(--tr-surface-2)]">
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo} alt={stop.name} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-[var(--tr-ink-3)]">
                      <Sparkles size={22} aria-hidden />
                    </span>
                  )}
                  <span className="tr-meta absolute left-1.5 top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--tr-ink)]/85 px-1.5 font-bold tabular-nums text-[var(--tr-canvas)]">
                    {String(stop.number).padStart(2, '0')}
                  </span>
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-center px-3 py-2">
                  <h3 className="tr-card-text truncate font-bold text-[var(--tr-ink)]">{stop.name}</h3>
                  <div className="tr-meta mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[var(--tr-ink-2)]">
                    {time && (
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Clock3 size={12} aria-hidden />
                        {time}
                      </span>
                    )}
                    {stop.duration && <span>{stop.duration}</span>}
                    {stop.category && <span className="truncate">{stop.category}</span>}
                  </div>
                  <span className="tr-meta mt-1 inline-flex items-center gap-0.5 font-semibold text-[var(--tr-accent-deep)]">
                    {labels.details}
                    <ChevronRight size={13} aria-hidden />
                  </span>
                </div>
              </button>
              {canEdit && (
                <div className="border-t border-[var(--tr-hairline)] px-3 py-2">
                  <button
                    type="button"
                    onClick={() => onAddStop(stop)}
                    disabled={added}
                    className={`tr-label flex min-h-[38px] w-full items-center justify-center gap-1.5 rounded-xl px-3 font-bold transition active:scale-[0.99] ${
                      added
                        ? 'bg-[var(--tr-surface-2)] text-[var(--tr-ink-3)]'
                        : 'bg-[var(--tr-accent-soft)] text-[var(--tr-accent-deep)]'
                    }`}
                    data-testid="plan-tour-add-stop"
                  >
                    {added ? <Check size={14} aria-hidden /> : <Plus size={14} aria-hidden />}
                    {added ? labels.added : labels.add}
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>

      <TourStopDetailDrawer
        stop={drawerStop}
        open={Boolean(drawerStop)}
        onClose={() => setDrawerStop(null)}
        sectionUi={sectionUi}
        locale={locale}
      />
    </section>
  );
}
