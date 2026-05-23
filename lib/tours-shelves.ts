/**
 * Curated themed shelves for `/tours/list` default entry (Phase 7, B33).
 *
 * The page enters in "shelf mode" when no filter is active and switches to the
 * Phase 4 flat grid the moment a filter is applied. This module decides which
 * shelves render in shelf mode and which tours belong in each.
 *
 * Same tour may appear in multiple shelves (B34) — that is the design's
 * inventory-camouflage mechanic. A small-group cruise excursion lives on both
 * the "Cruise Shore Excursion" and "Small Group" shelves; readers see breadth,
 * even though the underlying catalog has ~30 tours.
 *
 * Season windows are MM-DD literals (B35) and recur annually — no DB schema
 * cost, no admin UI yet. To shift a window, edit the constants here and ship
 * a new PR.
 */
"use client";

import type { StaticTourProductRegistration } from "@/components/product-tour-static/catalog/staticTourCatalogCards";

// ---------------------------------------------------------------------------
// Shelves
// ---------------------------------------------------------------------------

export type ShelfKey =
  | "editors-pick"
  | "now-seasonal"
  | "coming-soon"
  | "cruise-shore-excursion"
  | "small-group"
  | "private"
  | "classic-bus";

export type Shelf = {
  key: ShelfKey;
  /** i18n key suffix under `toursList.shelves` (e.g. `editorsPick.title`). */
  labelI18nKey: string;
  /** Optional one-liner i18n key suffix for the shelf subtitle. */
  subtitleI18nKey?: string;
  /** Tours that fall into this shelf, in catalog SLUG_ORDER. */
  tours: readonly StaticTourProductRegistration[];
  /** Set only for the `now-seasonal` and `coming-soon` shelves. */
  season?: SeasonShelfMeta;
};

export type SeasonShelfMeta = {
  seasonKey: SeasonKey;
  /** ISO date (YYYY-MM-DD) at which the operating window opens this cycle. */
  startDate: string;
  /** ISO date at which the operating window closes this cycle. */
  endDate: string;
  /**
   * For `coming-soon` shelves: positive number of days until `startDate`.
   * For `now-seasonal`: 0 (already open).
   */
  daysUntilStart: number;
};

// ---------------------------------------------------------------------------
// Season windows (MM-DD, annual)
// ---------------------------------------------------------------------------

export type SeasonKey = "camellia" | "plum" | "cherry" | "hydrangea" | "maple" | "pink-muhly";

type MonthDay = `${string}-${string}`; // "MM-DD"

type SeasonWindow = {
  startMonthDay: MonthDay;
  endMonthDay: MonthDay;
  /** True if a slug belongs to this seasonal product family. */
  matchesTour: (slug: string, badges: readonly string[]) => boolean;
};

const SEASON_WINDOWS: Record<SeasonKey, SeasonWindow> = {
  camellia: {
    startMonthDay: "12-15",
    endMonthDay: "02-15",
    matchesTour: (slug, badges) =>
      slug.includes("camellia") ||
      slug.includes("winter-southwest") ||
      badges.some((b) => /camellia/i.test(b)),
  },
  plum: {
    startMonthDay: "02-25",
    endMonthDay: "03-20",
    matchesTour: (slug, badges) =>
      slug.includes("plum") || badges.some((b) => /plum/i.test(b)),
  },
  cherry: {
    startMonthDay: "03-28",
    endMonthDay: "04-12",
    matchesTour: (slug, badges) =>
      slug.includes("cherry-blossom") ||
      slug.includes("plum-cherry") ||
      badges.some((b) => /cherry blossom/i.test(b)),
  },
  hydrangea: {
    startMonthDay: "05-15",
    endMonthDay: "07-15",
    matchesTour: (slug, badges) =>
      slug.includes("hydrangea") || badges.some((b) => /hydrangea/i.test(b)),
  },
  maple: {
    startMonthDay: "10-15",
    endMonthDay: "11-15",
    matchesTour: (slug, badges) =>
      slug.includes("seoraksan") ||
      badges.some((b) => /autumn foliage|maple/i.test(b)),
  },
  "pink-muhly": {
    startMonthDay: "09-30",
    endMonthDay: "10-30",
    matchesTour: (slug, badges) =>
      slug.includes("pink-muhly") || badges.some((b) => /pink muhly/i.test(b)),
  },
};

const SEASON_KEYS = Object.keys(SEASON_WINDOWS) as SeasonKey[];

/** Days from `today` to the next occurrence of a given MM-DD anchor (>= 0). */
function daysUntilNextOccurrence(today: Date, monthDay: MonthDay): { days: number; year: number } {
  const [m, d] = monthDay.split("-").map(Number);
  const tYear = today.getUTCFullYear();
  let target = Date.UTC(tYear, m - 1, d);
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  if (target < todayUtc) target = Date.UTC(tYear + 1, m - 1, d);
  return {
    days: Math.round((target - todayUtc) / 86_400_000),
    year: new Date(target).getUTCFullYear(),
  };
}

/** "MM-DD" of the given date, UTC. */
function monthDayOfUtc(d: Date): MonthDay {
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${mm}-${dd}` as MonthDay;
}

/** True if `mmdd` is inside `[start, end]`. Handles wrap-around (e.g. camellia 12-15 → 02-15). */
function isMonthDayInWindow(mmdd: MonthDay, start: MonthDay, end: MonthDay): boolean {
  if (start <= end) return mmdd >= start && mmdd <= end;
  // wrap-around window — e.g. start=12-15, end=02-15
  return mmdd >= start || mmdd <= end;
}

function isoDate(y: number, monthDay: MonthDay): string {
  return `${y}-${monthDay}`;
}

// ---------------------------------------------------------------------------
// Non-seasonal shelf matchers
// ---------------------------------------------------------------------------

function isCruise(t: StaticTourProductRegistration): boolean {
  const s = t.slug;
  if (s.includes("cruise") || s.includes("shore-excursion")) return true;
  return t.badges.some((b) => /cruise/i.test(b));
}

function isPrivate(t: StaticTourProductRegistration): boolean {
  if (t.slug.includes("private")) return true;
  if (t.slug.includes("private-car-charter") || t.slug.includes("chartered-car")) return true;
  return t.badges.some((b) => /private\s*tour|private(?!\s*group)/i.test(b));
}

/**
 * Classic-bus shelf — large-coach + cruise-bus tours.
 *
 * Slug rule: ends with `-bus-tour` (e.g. `*-cruise-shore-excursion-bus-tour`,
 * `*-classic-bus-tour`) catches the explicit naming.
 *
 * Badge rule: covers wider authoring variants observed in the catalog —
 * `Large coach`, `Bus tour`, `Classic bus`, and `Air-conditioned coach`
 * (the Seoraksan→Naksansa day trip uses the last one).
 */
function isClassicBus(t: StaticTourProductRegistration): boolean {
  if (t.slug.endsWith("-bus-tour") || t.slug.includes("classic-bus")) return true;
  return t.badges.some((b) => /large coach|bus tour|classic bus|air[- ]?conditioned coach/i.test(b));
}

/**
 * Small-group shelf — every join-format day tour that isn't a Private charter
 * or a Classic Bus / Large-coach tour.
 *
 * Why three signals (badge OR maxGroupSize OR catch-all join default): badges
 * are authored inconsistently across the catalog (e.g. `east-signature-nature-
 * core` and `jeju-grand-highlights-loop` carry `maxGroupSize=8` but no
 * explicit `Small group` badge), so a badge-only matcher silently drops the
 * majority of the small-group inventory. The fallback to `maxGroupSize ≤ 12`
 * + the explicit private/bus exclusion catches every join-format day tour
 * the user expects to find under "Small Group" without leaking private
 * charters or coach tours.
 */
function isSmallGroup(t: StaticTourProductRegistration): boolean {
  if (isPrivate(t)) return false;
  if (isClassicBus(t)) return false;
  if (t.badges.some((b) => /small\s*group|small shared van/i.test(b))) return true;
  if (t.maxGroupSize != null && t.maxGroupSize <= 12) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Editor's Pick
// ---------------------------------------------------------------------------

/**
 * Curator-selected slug list. Shipped as a constant — editing the list
 * requires a code change, which keeps the "Editor's Pick" promise honest
 * (no silent auto-curation by sales rank). Order here is the rendered order.
 */
const EDITORS_PICK_SLUGS: readonly string[] = [
  "east-signature-nature-core",
  "jeju-grand-highlights-loop",
  "jeju-cruise-shore-excursion-small-group-tour",
  "seoul-private-nami-morning-calm-petite-france",
  "busan-top-attractions-day-tour",
  "pocheon-sanjeong-lake-herb-island-art-valley",
] as const;

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Build the shelf list for the given date + catalog.
 *
 * Shelves are returned in display order. Empty shelves are dropped so the page
 * never renders a heading with no cards. The same tour can appear in more than
 * one shelf (B34).
 */
export function getShelvesForDate(
  today: Date,
  tours: readonly StaticTourProductRegistration[],
): Shelf[] {
  const out: Shelf[] = [];

  // 1. Editor's Pick — explicit curator list, in declared order
  const bySlug = new Map(tours.map((t) => [t.slug, t]));
  const editorsPickTours = EDITORS_PICK_SLUGS
    .map((s) => bySlug.get(s))
    .filter((t): t is StaticTourProductRegistration => t != null);
  if (editorsPickTours.length > 0) {
    out.push({
      key: "editors-pick",
      labelI18nKey: "editorsPick.title",
      subtitleI18nKey: "editorsPick.subtitle",
      tours: editorsPickTours,
    });
  }

  // 2 + 3. Seasonal — split into Now / Coming Soon
  const mmddToday = monthDayOfUtc(today);
  for (const seasonKey of SEASON_KEYS) {
    const w = SEASON_WINDOWS[seasonKey];
    const matching = tours.filter((t) => w.matchesTour(t.slug, t.badges));
    if (matching.length === 0) continue;

    if (isMonthDayInWindow(mmddToday, w.startMonthDay, w.endMonthDay)) {
      // Now seasonal — currently inside the window
      const { year: endYear } = daysUntilNextOccurrence(today, w.endMonthDay);
      out.push({
        key: "now-seasonal",
        labelI18nKey: `nowSeasonal.${seasonKey}.title`,
        subtitleI18nKey: `nowSeasonal.${seasonKey}.subtitle`,
        tours: matching,
        season: {
          seasonKey,
          startDate: isoDate(endYear === today.getUTCFullYear() ? endYear : endYear - 1, w.startMonthDay),
          endDate: isoDate(endYear, w.endMonthDay),
          daysUntilStart: 0,
        },
      });
      continue;
    }

    // Outside window — show as Coming Soon iff start is within next 90 days
    const { days, year } = daysUntilNextOccurrence(today, w.startMonthDay);
    if (days > 0 && days <= 90) {
      out.push({
        key: "coming-soon",
        labelI18nKey: `comingSoon.${seasonKey}.title`,
        subtitleI18nKey: `comingSoon.${seasonKey}.subtitle`,
        tours: matching,
        season: {
          seasonKey,
          startDate: isoDate(year, w.startMonthDay),
          endDate: isoDate(year, w.endMonthDay),
          daysUntilStart: days,
        },
      });
    }
  }

  // 4 - 7. Format-based shelves — same tour may appear in multiple (B34)
  const cruise = tours.filter(isCruise);
  if (cruise.length > 0) {
    out.push({
      key: "cruise-shore-excursion",
      labelI18nKey: "cruiseShoreExcursion.title",
      subtitleI18nKey: "cruiseShoreExcursion.subtitle",
      tours: cruise,
    });
  }

  const smallGroup = tours.filter(isSmallGroup);
  if (smallGroup.length > 0) {
    out.push({
      key: "small-group",
      labelI18nKey: "smallGroup.title",
      subtitleI18nKey: "smallGroup.subtitle",
      tours: smallGroup,
    });
  }

  const privateCharter = tours.filter(isPrivate);
  if (privateCharter.length > 0) {
    out.push({
      key: "private",
      labelI18nKey: "private.title",
      subtitleI18nKey: "private.subtitle",
      tours: privateCharter,
    });
  }

  const bus = tours.filter(isClassicBus);
  if (bus.length > 0) {
    out.push({
      key: "classic-bus",
      labelI18nKey: "classicBus.title",
      subtitleI18nKey: "classicBus.subtitle",
      tours: bus,
    });
  }

  return out;
}

// Re-exports for test + future consumer use
export const __INTERNAL__ = {
  SEASON_WINDOWS,
  EDITORS_PICK_SLUGS,
  daysUntilNextOccurrence,
  monthDayOfUtc,
  isMonthDayInWindow,
  isCruise,
  isSmallGroup,
  isPrivate,
  isClassicBus,
};
