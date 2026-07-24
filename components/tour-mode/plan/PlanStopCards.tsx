'use client';

/**
 * Shared rich itinerary stop list for the D-1 planner: big-photo cards
 * (photo + number + title + time/duration/category) that tap open the SHARED
 * product-detail drawer (TourStopDetailDrawer), matching the tour-product
 * page's presentation inside the tr-themed planner.
 *
 * Used by both PlanTourItinerary ("이 투어 추천 일정", canEdit → per-stop 담기)
 * and the course-preview sheet (canEdit=false → view-only, adopt via the
 * sheet's own "이 코스로 시작" button).
 */

import { useMemo, useState } from 'react';
import { Check, ChevronRight, Clock3, Plus, Sparkles } from 'lucide-react';
import { TourStopDetailDrawer } from '@/components/product-tour-static/_shared/TourStopDetailDrawer';
import type { ItineraryStop } from '@/components/product-tour-static/_shared/tourProductDetailSectionTypes';
import { mergeTourProductSectionUi } from '@/lib/tour-product/tourProductSectionUi';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

export interface PlanStopCardsLabels {
  add: string;
  added: string;
  details: string;
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

export default function PlanStopCards({
  stops,
  locale,
  canEdit,
  addedKeys,
  labels,
  onAddStop,
}: {
  stops: ItineraryStop[];
  locale: RoomLocale;
  /** When true, each card grows a "담기" footer that maps the stop into the plan. */
  canEdit: boolean;
  /** poi_keys already in the plan → the card shows "담김" instead of "담기". */
  addedKeys?: Set<string>;
  labels: PlanStopCardsLabels;
  onAddStop?: (stop: ItineraryStop) => void;
}) {
  const [drawerStop, setDrawerStop] = useState<ItineraryStop | null>(null);
  // A1.5 — dead asset URLs degrade to the Sparkles swatch below, not the
  // browser's broken-image glyph. The POI picker in PlanEditorClient already
  // does this; these cards, which show a far bigger photo, did not.
  const [brokenPhotos, setBrokenPhotos] = useState<Set<string>>(() => new Set());
  // Locale-aware default drawer copy (the planner has no per-tour sectionUi).
  const sectionUi = useMemo(() => mergeTourProductSectionUi(undefined, locale), [locale]);

  return (
    <>
      <div className="flex flex-col gap-2.5">
        {stops.map((stop) => {
          const rawPhoto = stopPhoto(stop);
          const photo = rawPhoto && !brokenPhotos.has(rawPhoto) ? rawPhoto : null;
          const time = stopTime(stop);
          const poiKey = stop._poi_meta?.poi_key ?? null;
          const added = poiKey ? Boolean(addedKeys?.has(poiKey)) : false;
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
                    <img
                      src={photo}
                      alt={stop.name}
                      loading="lazy"
                      className="h-full w-full object-cover"
                      onError={() =>
                        setBrokenPhotos((prev) => (prev.has(photo) ? prev : new Set(prev).add(photo)))
                      }
                    />
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
                    onClick={() => onAddStop?.(stop)}
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
    </>
  );
}
