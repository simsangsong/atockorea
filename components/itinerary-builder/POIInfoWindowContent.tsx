"use client";

import type { MatchPoiRow } from "@/lib/itinerary-builder/types";

interface Props {
  poi: MatchPoiRow;
}

/**
 * Content rendered inside a Google Maps InfoWindow.
 * Phase 3: read-only preview with disabled "Add to itinerary" CTA.
 * Phase 4 will enable the Add button and wire to cart state.
 */
export default function POIInfoWindowContent({ poi }: Props) {
  const summary = (() => {
    const desc = poi.poi_meta && typeof poi.poi_meta === "object" ? (poi.poi_meta as Record<string, unknown>) : null;
    const raw = desc && typeof desc.summary === "string" ? (desc.summary as string) : "";
    if (raw) return raw.slice(0, 140);
    if (poi.category) return poi.category;
    return "";
  })();

  return (
    <div className="max-w-[280px] p-1 font-sans">
      {poi.default_image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={poi.default_image_url}
          alt={poi.name_en}
          className="mb-2 aspect-[16/10] w-full rounded-md object-cover"
        />
      ) : null}
      <h3 className="text-sm font-bold leading-snug text-slate-900">{poi.name_en}</h3>
      {poi.name_ko ? (
        <p className="mt-0.5 text-[11px] text-slate-500">{poi.name_ko}</p>
      ) : null}
      {summary ? (
        <p className="mt-1.5 text-[12px] leading-snug text-slate-700">{summary}</p>
      ) : null}
      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
        {poi.default_stay_minutes ? (
          <span>~{poi.default_stay_minutes} min suggested</span>
        ) : (
          <span>{poi.region}</span>
        )}
      </div>
      <button
        type="button"
        disabled
        title="Coming in Phase 4 (cart + manual quote)"
        className="mt-3 w-full cursor-not-allowed rounded-md bg-slate-200 px-3 py-2 text-xs font-semibold text-slate-500"
      >
        Add to itinerary — coming soon
      </button>
    </div>
  );
}
