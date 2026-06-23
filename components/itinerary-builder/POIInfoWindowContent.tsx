"use client";

import { useTranslations } from "@/lib/i18n";
import type { MatchPoiRow } from "@/lib/itinerary-builder/types";

interface Props {
  poi: MatchPoiRow;
  inCart?: boolean;
  onAdd?: () => void;
  onRemove?: () => void;
}

/**
 * Content rendered inside a Google Maps InfoWindow.
 * Phase 4a: Add button enabled, toggles to "In itinerary — Remove" when in cart.
 */
export default function POIInfoWindowContent({ poi, inCart = false, onAdd, onRemove }: Props) {
  const t = useTranslations("itineraryBuilder.map");
  const summary = (() => {
    const desc = poi.poi_meta && typeof poi.poi_meta === "object" ? (poi.poi_meta as Record<string, unknown>) : null;
    const raw = desc && typeof desc.summary === "string" ? (desc.summary as string) : "";
    if (raw) return raw.slice(0, 90);
    if (poi.category) return poi.category;
    return "";
  })();

  const buttonLabel = inCart ? t("removeFromItinerary") : t("addCta");
  const buttonHandler = inCart ? onRemove : onAdd;
  // V5 amber discipline: Add = slate-900 ghost (quiet primary), Added/Remove
  // = emerald (success) hover→rose (destructive). The amber primary stays
  // reserved for the page-level Get-Quote CTA + photo-pin sequence badge.
  const buttonClass = inCart
    ? "mt-2 w-full rounded-md bg-emerald-50 px-3 py-1.5 text-micro font-semibold text-emerald-700 ring-1 ring-emerald-200 transition-colors hover:bg-rose-50 hover:text-rose-700 hover:ring-rose-200"
    : "mt-2 w-full rounded-md bg-white px-3 py-1.5 text-micro font-bold text-slate-900 shadow-sm ring-1 ring-slate-300 transition-colors hover:bg-slate-50 hover:ring-slate-400";

  // Compact card so it never overflows / clips on a short mobile map (40vh).
  // Image capped at a short fixed height (~88px) instead of a tall 16:10 crop
  // that, at the old 280px width, rendered ~175px tall and got cut by the map
  // edges (reported 2026-06-23).
  return (
    <div className="max-w-[208px] p-0.5 font-sans">
      {poi.default_image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={poi.default_image_url}
          alt={poi.name_en}
          className="mb-1.5 h-[88px] w-full rounded-md object-cover"
        />
      ) : null}
      <h3 className="text-caption font-bold leading-snug text-slate-900">{poi.name_en}</h3>
      {poi.name_ko ? (
        <p className="mt-0.5 text-micro text-slate-500">{poi.name_ko}</p>
      ) : null}
      {summary ? (
        <p className="mt-1 line-clamp-2 text-micro leading-snug text-slate-600">{summary}</p>
      ) : null}
      <div className="mt-1.5 flex items-center justify-between text-micro text-slate-500">
        {poi.default_stay_minutes ? (
          <span>{t("stayMinutesPattern", { minutes: poi.default_stay_minutes })}</span>
        ) : (
          <span>{poi.region}</span>
        )}
      </div>
      <button
        type="button"
        onClick={buttonHandler}
        disabled={!buttonHandler}
        className={buttonClass}
      >
        {buttonLabel}
      </button>
    </div>
  );
}
