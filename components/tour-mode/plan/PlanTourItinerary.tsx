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

import { Plus, Sparkles } from 'lucide-react';
import PlanStopCards from '@/components/tour-mode/plan/PlanStopCards';
import type { ItineraryStop } from '@/components/product-tour-static/_shared/tourProductDetailSectionTypes';
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

      <PlanStopCards
        stops={stops}
        locale={locale}
        canEdit={canEdit}
        addedKeys={addedKeys}
        labels={{ add: labels.add, added: labels.added, details: labels.details }}
        onAddStop={onAddStop}
      />
    </section>
  );
}
