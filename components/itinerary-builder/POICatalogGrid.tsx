"use client";

import { useState } from "react";
import Image from "next/image";
import { Plus, Check, Clock, ImageIcon, MapPin } from "lucide-react";
import type { MatchPoiRow } from "@/lib/itinerary-builder/types";
import POIDetailModal from "./POIDetailModal";

interface Props {
  pois: MatchPoiRow[];
  cart: string[];
  onAdd: (key: string) => void;
  onRemove: (key: string) => void;
  onFocus: (key: string) => void;
}

const PHOTO_FALLBACK = "/images/destinations/busan-card.jpg";

/**
 * Detail-page-style POI card grid. Each card shows the photo + name +
 * highlights + Add/Remove + clickable area to focus the map + an
 * "Open details" button that opens a richer modal.
 */
export default function POICatalogGrid({ pois, cart, onAdd, onRemove, onFocus }: Props) {
  const cartSet = new Set(cart);
  const [detailPoi, setDetailPoi] = useState<MatchPoiRow | null>(null);

  // Show in-cart first, then by name_en for stable ordering
  const ordered = [...pois].sort((a, b) => {
    const ai = cartSet.has(a.poi_key) ? 0 : 1;
    const bi = cartSet.has(b.poi_key) ? 0 : 1;
    if (ai !== bi) return ai - bi;
    return a.name_en.localeCompare(b.name_en);
  });

  return (
    <section className="px-4 py-5 md:px-6 md:py-7">
      <div className="mx-auto max-w-7xl">
        <header className="mb-4 flex items-baseline justify-between md:mb-5">
          <h2 className="text-h3 text-slate-900">
            Curated stops
            <span className="ml-2 text-caption font-normal text-slate-500">
              ({ordered.length})
            </span>
          </h2>
          <p className="text-micro text-slate-500">Tap a card → preview on the map below.</p>
        </header>

        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {ordered.map((poi) => {
            const inCart = cartSet.has(poi.poi_key);
            const imgSrc = poi.default_image_url || poi.images?.[0] || null;
            return (
              <li
                key={poi.poi_key}
                className={`group relative overflow-hidden rounded-xl bg-white shadow-sm ring-1 transition-all ${
                  inCart ? "ring-amber-300 shadow-md" : "ring-slate-200 hover:shadow-md"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onFocus(poi.poi_key)}
                  className="block w-full text-left"
                  title="Preview on map"
                >
                  <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
                    {imgSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imgSrc}
                        alt={poi.name_en}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-400">
                        <ImageIcon className="h-8 w-8" aria-hidden />
                      </div>
                    )}
                    {inCart ? (
                      <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-micro font-bold text-white shadow">
                        <Check className="h-3 w-3" aria-hidden /> In cart
                      </span>
                    ) : null}
                    {poi.default_stay_minutes ? (
                      <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-slate-900/85 px-2 py-0.5 text-micro font-semibold text-white shadow">
                        <Clock className="h-3 w-3" aria-hidden />
                        {poi.default_stay_minutes}m
                      </span>
                    ) : null}
                  </div>
                  <div className="p-3 md:p-3.5">
                    <h3 className="text-caption font-bold leading-snug text-slate-900 line-clamp-2">
                      {poi.name_en}
                    </h3>
                    {poi.name_ko ? (
                      <p className="mt-0.5 truncate text-micro text-slate-500">{poi.name_ko}</p>
                    ) : null}
                    {poi.highlights && poi.highlights.length > 0 ? (
                      <ul className="mt-2 space-y-0.5 text-micro text-slate-600">
                        {poi.highlights.slice(0, 2).map((h, i) => (
                          <li key={i} className="line-clamp-1">
                            • {stripMd(h)}
                          </li>
                        ))}
                      </ul>
                    ) : poi.category ? (
                      <p className="mt-1.5 line-clamp-1 text-micro text-slate-500">{poi.category}</p>
                    ) : null}
                  </div>
                </button>
                <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 md:px-3.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDetailPoi(poi);
                    }}
                    className="text-micro font-semibold text-slate-500 underline-offset-2 hover:text-slate-900 hover:underline"
                  >
                    Details
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      inCart ? onRemove(poi.poi_key) : onAdd(poi.poi_key);
                    }}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-micro font-bold transition-colors ${
                      inCart
                        ? "bg-rose-50 text-rose-700 ring-1 ring-rose-100 hover:bg-rose-100"
                        : "bg-amber-500 text-white shadow-sm hover:bg-amber-600"
                    }`}
                  >
                    {inCart ? (
                      <>
                        <Check className="h-3 w-3" aria-hidden />
                        Added
                      </>
                    ) : (
                      <>
                        <Plus className="h-3 w-3" aria-hidden />
                        Add
                      </>
                    )}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {detailPoi ? (
        <POIDetailModal
          poi={detailPoi}
          inCart={cartSet.has(detailPoi.poi_key)}
          onClose={() => setDetailPoi(null)}
          onAdd={() => {
            onAdd(detailPoi.poi_key);
            setDetailPoi(null);
          }}
          onRemove={() => {
            onRemove(detailPoi.poi_key);
          }}
          onFocus={() => {
            onFocus(detailPoi.poi_key);
            setDetailPoi(null);
          }}
        />
      ) : null}
    </section>
  );
}

function stripMd(s: string): string {
  return s.replace(/\*\*/g, "").replace(/__/g, "").trim();
}
