"use client";

/**
 * Imported-course itinerary section for private-charter product pages.
 *
 * A SegmentedToggle (the §F-8 shared in-section switch) picks one of the
 * configured courses (`privateImportedCourses.ts`); the selected course's
 * static bundle is lazy-loaded per locale and rendered through the SAME
 * `TourTimelineSection` (photo stop cards + TourStopDetailDrawer) that the
 * course's own product page uses — the itinerary is imported, not copied.
 *
 * The course's pickup/drop-off pseudo-stops are stripped: the charter has its
 * own hotel-pickup rules (rendered separately in the private-tour rules
 * block), so the imported timeline shows places only.
 */

import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";

import { SegmentedToggle } from "./SegmentedToggle";
import { getStaticTourProductFullPageJson } from "./tourProductBundleRegistry";
import type { ItineraryStop } from "./tourProductDetailSectionTypes";
import type { PrivateLocale } from "./privateSampleItinerary";
import type { ImportedCourse } from "./privateImportedCourses";
import { mergeTourProductSectionUi, type TourProductSectionUiV1 } from "@/lib/tour-product/tourProductSectionUi";
import { TourTimelineSection } from "@/components/product-tour-static/east-signature-nature-core/tour-detail-sections";

type LoadedCourse = {
  stops: ItineraryStop[];
  sectionUi: TourProductSectionUiV1;
};

type CourseLoadState =
  | { state: "loading" }
  | { state: "error" }
  | ({ state: "ready" } & LoadedCourse);

/**
 * Places only — the charter page renders its own pickup/drop-off rules.
 * `visitBasics.admission` is dropped: on the source tours admission is often
 * included ("Tickets included" badge), but charter guests pay their own
 * entrance fees (private-tour rules right below), so the imported cards must
 * not carry that claim.
 */
function toPlaceStops(raw: unknown): ItineraryStop[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (s): s is ItineraryStop =>
        s != null &&
        typeof s === "object" &&
        (s as ItineraryStop)._role !== "pickup" &&
        (s as ItineraryStop)._role !== "dropoff",
    )
    .map((s, i) => ({
      ...s,
      number: i + 1,
      ...(s.visitBasics ? { visitBasics: { ...s.visitBasics, admission: undefined } } : {}),
    }));
}

export function TourImportedCoursesSection({
  courses,
  locale = "en",
}: {
  courses: readonly ImportedCourse[];
  locale?: PrivateLocale;
}) {
  const [courseId, setCourseId] = useState<string>(courses[0]?.id ?? "");
  const [loaded, setLoaded] = useState<Partial<Record<string, CourseLoadState>>>({});
  // Bumping retriggers the load effect for a course whose chunk failed.
  const [retryTick, setRetryTick] = useState(0);

  const course = useMemo(
    () => courses.find((c) => c.id === courseId) ?? courses[0],
    [courses, courseId],
  );
  const slug = course?.slug;

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    const put = (next: CourseLoadState) => {
      if (!cancelled) setLoaded((prev) => ({ ...prev, [slug]: next }));
    };
    setLoaded((prev) => {
      const existing = prev[slug];
      if (existing && existing.state === "ready") return prev;
      return { ...prev, [slug]: { state: "loading" } };
    });
    void (async () => {
      try {
        const json = await getStaticTourProductFullPageJson(slug, locale);
        const stops = toPlaceStops(json?.itineraryStops);
        if (!json || stops.length === 0) {
          put({ state: "error" });
          return;
        }
        const headline = [json.headlineLine1, json.headlineLine2]
          .filter(Boolean)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        const merged = mergeTourProductSectionUi(json.sectionUi, locale);
        put({
          state: "ready",
          stops,
          // The imported timeline keeps the drawer/labels of the course's own
          // page, but its heading becomes the course headline so the switch
          // reads as "which day", not a duplicated generic "Itinerary".
          sectionUi: headline ? { ...merged, itineraryTitle: headline } : merged,
        });
      } catch {
        put({ state: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
    // retryTick re-runs the effect after a failed chunk load.
  }, [slug, locale, retryTick]);

  if (!course) return null;
  const current = slug ? loaded[slug] : undefined;

  return (
    <div className="space-y-5" data-testid="imported-courses-section">
      {/* 4 pills can outgrow narrow phones — scroll the row, never wrap/shrink. */}
      <div className="max-w-full overflow-x-auto scrollbar-hide">
        <SegmentedToggle
          ariaLabel="Course"
          value={course.id}
          onChange={setCourseId}
          className="whitespace-nowrap"
          options={courses.map((c) => ({ value: c.id, label: c.chipLabel[locale] ?? c.chipLabel.en }))}
        />
      </div>

      {current?.state === "ready" ? (
        <TourTimelineSection
          itineraryStops={current.stops}
          sectionUi={current.sectionUi}
          locale={locale}
        />
      ) : current?.state === "error" ? (
        <button
          type="button"
          onClick={() => setRetryTick((t) => t + 1)}
          className="flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-slate-200/70 bg-white px-4 py-6 text-[13px] font-medium text-muted-foreground shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition hover:border-slate-300 hover:text-foreground"
        >
          <RefreshCw className="h-4 w-4" strokeWidth={2} />
          {course.chipLabel[locale] ?? course.chipLabel.en}
        </button>
      ) : (
        <div aria-hidden className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl bg-slate-100/80 ring-1 ring-slate-900/[0.04]"
            />
          ))}
        </div>
      )}
    </div>
  );
}
