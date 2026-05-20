"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Check, Clock, ImageIcon } from "lucide-react";
import { SnapScrollDots } from "@/components/home/v2/ui/SnapScrollDots";
import {
  REVEAL_ITEM_VARIANTS,
  useRevealContainerProps,
} from "@/components/home/v2/ui/reveal";
import type { MatchPoiRow } from "@/lib/itinerary-builder/types";
import POIDetailModal from "./POIDetailModal";

interface Props {
  pois: MatchPoiRow[];
  cart: string[];
  onAdd: (key: string) => void;
  onRemove: (key: string) => void;
  onFocus: (key: string) => void;
}

/**
 * Detail-page-style POI card grid — Phase D restyle to mirror the home v2
 * `destinations-showcase` pattern: mobile snap rail with right-edge fade
 * + SnapScrollDots, desktop static auto-rows-fr grid. Each card gets
 * staggered entrance via REVEAL_ITEM_VARIANTS. In-cart state shows a
 * thicker amber ring + sequence ribbon (so users see "this is stop #3"
 * at a glance).
 */
export default function POICatalogGrid({ pois, cart, onAdd, onRemove, onFocus }: Props) {
  const reveal = useRevealContainerProps();
  const scrollRef = useRef<HTMLUListElement>(null);
  const [detailPoi, setDetailPoi] = useState<MatchPoiRow | null>(null);

  // Map poi_key → 1-indexed cart position; null when not in cart.
  const cartPosition = new Map(cart.map((k, i) => [k, i + 1]));

  // Show in-cart first (preserving cart order), then by name_en.
  const ordered = [...pois].sort((a, b) => {
    const ai = cartPosition.get(a.poi_key) ?? Infinity;
    const bi = cartPosition.get(b.poi_key) ?? Infinity;
    if (ai !== bi) return ai - bi;
    return a.name_en.localeCompare(b.name_en);
  });

  return (
    <section className="relative overflow-hidden px-4 py-5 md:px-6 md:py-7">
      <motion.div {...reveal} className="relative mx-auto max-w-7xl">
        <motion.header
          variants={REVEAL_ITEM_VARIANTS}
          className="mb-4 flex items-baseline justify-between md:mb-5"
        >
          <h2 className="text-h3 text-slate-900">
            Curated stops
            <span className="ml-2 text-caption font-normal text-slate-500">
              ({ordered.length})
            </span>
          </h2>
          <p className="text-micro text-slate-500">
            Tap a card → preview on the map below.
          </p>
        </motion.header>

        {/* Mobile snap rail + desktop responsive grid */}
        <div className="relative -mx-4 md:mx-0">
          <ul
            ref={scrollRef}
            className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 scrollbar-hide md:grid md:auto-rows-fr md:grid-cols-2 md:gap-4 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-3 xl:grid-cols-4"
          >
            {ordered.map((poi) => {
              const seq = cartPosition.get(poi.poi_key);
              const inCart = seq != null;
              const imgSrc = poi.default_image_url || poi.images?.[0] || null;
              return (
                <motion.li
                  key={poi.poi_key}
                  variants={REVEAL_ITEM_VARIANTS}
                  className="w-[72vw] flex-shrink-0 snap-start md:w-auto"
                >
                  <article
                    className={`group relative h-full overflow-hidden rounded-2xl border border-white/70 bg-white/85 shadow-[0_10px_28px_-18px_rgba(15,23,42,0.22)] backdrop-blur-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-22px_rgba(15,23,42,0.32)] ${
                      inCart
                        ? "ring-2 ring-slate-700 shadow-[0_0_0_3px_rgba(15,23,42,0.10)]"
                        : "ring-1 ring-slate-200/70"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onFocus(poi.poi_key)}
                      className="block w-full text-left"
                      title="Preview on map"
                    >
                      <div className="relative aspect-[4/3] overflow-hidden bg-slate-100 md:aspect-[16/10]">
                        {imgSrc ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={imgSrc}
                            alt={poi.name_en}
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-400">
                            <ImageIcon className="h-8 w-8" aria-hidden />
                          </div>
                        )}
                        {inCart ? (
                          <span className="absolute left-0 top-3 inline-flex items-center gap-1 rounded-r-full bg-amber-500 px-2.5 py-1 text-micro font-bold uppercase tracking-wide text-white shadow-md">
                            <Check className="h-3 w-3" aria-hidden /> In cart · #{seq}
                          </span>
                        ) : null}
                        {poi.default_stay_minutes ? (
                          <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-slate-900/65 px-2 py-0.5 text-micro font-semibold text-white backdrop-blur-sm">
                            <Clock className="h-3 w-3" aria-hidden />
                            {poi.default_stay_minutes}m
                          </span>
                        ) : null}
                      </div>
                      <div className="px-3 pt-3 pb-2 md:px-3.5 md:pt-3.5">
                        <h3 className="text-caption font-bold leading-snug text-slate-900 line-clamp-2">
                          {poi.name_en}
                        </h3>
                        {poi.name_ko ? (
                          <p className="mt-0.5 truncate text-micro text-slate-500">{poi.name_ko}</p>
                        ) : null}
                        {poi.highlights && poi.highlights.length > 0 ? (
                          <ul className="mt-2 space-y-0.5 text-micro text-slate-600">
                            {poi.highlights.slice(0, 2).map((h, i) => (
                              <li key={i} className="flex items-start gap-1.5 line-clamp-1">
                                <span aria-hidden className="mt-1 inline-block h-1 w-1 flex-shrink-0 rounded-full bg-amber-500" />
                                <span className="truncate">{stripMd(h)}</span>
                              </li>
                            ))}
                          </ul>
                        ) : poi.category ? (
                          <p className="mt-1.5 line-clamp-1 text-micro text-slate-500">{poi.category}</p>
                        ) : null}
                      </div>
                    </button>
                    <div className="flex items-center justify-between gap-2 px-3 py-2.5 md:px-3.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetailPoi(poi);
                        }}
                        className="text-micro font-semibold text-slate-500 underline-offset-2 transition-colors hover:text-slate-900 hover:underline"
                      >
                        Details
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          inCart ? onRemove(poi.poi_key) : onAdd(poi.poi_key);
                        }}
                        className={`group/btn inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-micro font-bold transition-colors duration-200 ease-out ${
                          inCart
                            ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-rose-50 hover:text-rose-700 hover:ring-rose-200"
                            : "bg-white text-slate-900 ring-1 ring-slate-300 hover:bg-slate-50 hover:ring-slate-400"
                        }`}
                      >
                        {inCart ? (
                          <>
                            <Check className="h-3.5 w-3.5" aria-hidden />
                            Added
                          </>
                        ) : (
                          <>
                            <Plus className="h-3.5 w-3.5" aria-hidden />
                            Add
                          </>
                        )}
                      </button>
                    </div>
                  </article>
                </motion.li>
              );
            })}
          </ul>
          {/* Right-edge fade (mobile only — signals "more cards →") */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-14 bg-gradient-to-l from-white via-white/80 to-transparent md:hidden"
          />
        </div>
        <SnapScrollDots containerRef={scrollRef} count={ordered.length} />
      </motion.div>

      {detailPoi ? (
        <POIDetailModal
          poi={detailPoi}
          inCart={cartPosition.has(detailPoi.poi_key)}
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
