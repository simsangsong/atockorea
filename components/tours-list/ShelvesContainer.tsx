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
};

export function ShelvesContainer({ now }: ShelvesContainerProps) {
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

  if (shelves.length === 0) return null;

  return (
    <div className="space-y-10 sm:space-y-12">
      {shelves.map((shelf) => (
        <TourShelf
          key={`${shelf.key}:${shelf.labelI18nKey}`}
          shelf={shelf}
        />
      ))}
    </div>
  );
}
