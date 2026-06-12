"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n";
import type { MatchPoiRow } from "@/lib/itinerary-builder/types";
import {
  resolveBuilderPoiMeta,
  type PoiCategoryGroup,
} from "@/lib/itinerary-match-engine/poi-taxonomy";

interface Props {
  /** The region's full POI set — used to derive which groups actually exist. */
  pois: MatchPoiRow[];
  /** Currently active group filters. Empty = show everything. */
  selected: Set<PoiCategoryGroup>;
  onToggle: (group: PoiCategoryGroup) => void;
  onClear: () => void;
}

/**
 * Category filter chips — a deterministic, zero-token replacement for the AI
 * matcher (decision: de-AI the builder surface; recommendation accuracy + LLM
 * token cost both traced to the matcher's free-text parse). Each POI's
 * `categoryGroup` comes from the existing `BUILDER_POI_META` taxonomy
 * (`resolveBuilderPoiMeta`), so the chips are an honest "filter the list by
 * what it is" rather than an opaque AI guess. Multi-select; empty = all.
 *
 * The raw `match_pois.category` column is free-text marketing copy (one unique
 * string per POI), so it is NOT usable as a facet — the taxonomy enum is.
 */

// Display order — roughly "iconic → nature → coast → culture → food → misc".
// Only groups present in the region's POIs render (see `available`).
const GROUP_ORDER: PoiCategoryGroup[] = [
  "temple",
  "heritage",
  "landmark",
  "nature",
  "waterfall",
  "beach",
  "coastal",
  "village",
  "food_market",
  "cafe",
  "indoor_culture",
  "theme_park",
  "other",
];

export function poiGroup(poi: MatchPoiRow): PoiCategoryGroup {
  return resolveBuilderPoiMeta({ poi_key: poi.poi_key, poi_meta: poi.poi_meta }).categoryGroup;
}

export default function CategoryFilterBar({ pois, selected, onToggle, onClear }: Props) {
  const t = useTranslations("itineraryBuilder.filter");

  // Count POIs per group; keep only groups that actually appear, in GROUP_ORDER.
  const available = useMemo(() => {
    const counts = new Map<PoiCategoryGroup, number>();
    for (const poi of pois) {
      const g = poiGroup(poi);
      counts.set(g, (counts.get(g) ?? 0) + 1);
    }
    return GROUP_ORDER.filter((g) => counts.has(g)).map((g) => ({ group: g, count: counts.get(g)! }));
  }, [pois]);

  if (available.length <= 1) return null;

  const allActive = selected.size === 0;

  return (
    <div className="mb-4 md:mb-5">
      <p className="mb-2 text-micro font-semibold uppercase tracking-wider text-slate-500">
        {t("label")}
      </p>
      <div className="-mx-1 flex flex-wrap gap-1.5 px-1">
        <button
          type="button"
          onClick={onClear}
          aria-pressed={allActive}
          className={chipClass(allActive)}
        >
          {t("all")}
        </button>
        {available.map(({ group, count }) => {
          const active = selected.has(group);
          return (
            <button
              key={group}
              type="button"
              onClick={() => onToggle(group)}
              aria-pressed={active}
              className={chipClass(active)}
            >
              {t(`groups.${group}`)}
              <span className={cn("tabular-nums", active ? "text-white/70" : "text-slate-400")}>
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function chipClass(active: boolean): string {
  return cn(
    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-caption font-semibold transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400",
    active
      ? "border-slate-900 bg-slate-900 text-white shadow-1"
      : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100",
  );
}
