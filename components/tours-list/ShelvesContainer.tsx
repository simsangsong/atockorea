"use client";

/**
 * Drives the curated shelf layout on `/tours/list` when no filter is active
 * (Phase 7.3, B33). When any filter is active the page renders the
 * Phase 4 flat grid instead — that switch lives in `page.tsx`.
 *
 * Decides which shelves render today (Editor's Pick + seasonal Now / Coming
 * Soon + format-based) by delegating to `getShelvesForDate`. Empty shelves
 * are dropped by the lib, so an empty render here means "nothing in season,
 * no curated picks" — a true blank state we surface to the caller.
 */

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { listStaticTourProducts } from "@/components/product-tour-static/catalog/staticTourCatalogCards";
import { getShelvesForDate } from "@/lib/tours-shelves";
import { useTourProductCardMedia } from "@/hooks/useTourProductCardMedia";
import type { TourProductCardMediaMap } from "@/lib/tour-product/cardMediaTypes";
import { TourShelf } from "./TourShelf";

/**
 * Read the date from a stable source so test fixtures can override it.
 * Defaults to the wall clock.
 */
function readNow(): Date {
  return new Date();
}

export type ShelvesContainerProps = {
  /** Override `now` for testing — production sites read the system clock. */
  now?: Date;
  /**
   * Server-resolved admin-media map for the catalog slugs (PR #92). Seeded into
   * `useTourProductCardMedia` so the very first render already shows the
   * admin-saved thumbnail instead of the build-time static catalog image —
   * eliminates the visible flash users reported on 2026-05-25.
   */
  initialMediaBySlug?: TourProductCardMediaMap;
};

export function ShelvesContainer({ now, initialMediaBySlug }: ShelvesContainerProps) {
  const { locale } = useI18n();

  // Lazy-evaluate "today" so SSR and CSR match on initial paint, then the
  // effect can swap in the real clock if it differs from the SSR date.
  // For Phase 7 we keep it simple: `useState` initializer is the source.
  const [renderDate, setRenderDate] = useState<Date>(() => now ?? readNow());

  useEffect(() => {
    if (now != null) return;
    // Refresh once on mount so the date matches the user's actual day even if
    // SSR happened in a different timezone / yesterday. Cheap; runs once.
    const wall = readNow();
    if (
      wall.getUTCFullYear() !== renderDate.getUTCFullYear() ||
      wall.getUTCMonth() !== renderDate.getUTCMonth() ||
      wall.getUTCDate() !== renderDate.getUTCDate()
    ) {
      setRenderDate(wall);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shelves = useMemo(() => {
    const tours = listStaticTourProducts(locale);
    return getShelvesForDate(renderDate, tours);
  }, [renderDate, locale]);
  const shelfSlugs = useMemo(
    () => Array.from(new Set(shelves.flatMap((shelf) => shelf.tours.map((tour) => tour.slug)))),
    [shelves],
  );
  const mediaBySlug = useTourProductCardMedia(shelfSlugs, locale, initialMediaBySlug);

  if (shelves.length === 0) return null;

  return (
    <div className="space-y-24 pt-4 sm:space-y-32 lg:space-y-40">
      {shelves.map((shelf, index) => (
        <div key={`${shelf.key}:${shelf.labelI18nKey}`}>
          {/* Hairline divider above every shelf after the first, giving an
              extra visual rest before the next eyebrow + headline. */}
          {index > 0 ? (
            <div className="mb-12 flex justify-center sm:mb-16">
              <span
                aria-hidden
                className="block h-px w-12 bg-stone-300/70 sm:w-16"
              />
            </div>
          ) : null}
          <TourShelf shelf={shelf} mediaBySlug={mediaBySlug} />
        </div>
      ))}
    </div>
  );
}
