"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Plus, Check, Clock, ImageIcon } from "lucide-react";
import {
  REVEAL_ITEM_VARIANTS,
  useRevealContainerProps,
} from "@/components/home/v2/ui/reveal";
import { useTranslations } from "@/lib/i18n";
import type { MatchPoiRow } from "@/lib/itinerary-builder/types";

interface Props {
  pois: MatchPoiRow[];
  cart: string[];
  onAdd: (key: string) => void;
  onRemove: (key: string) => void;
  onFocus: (key: string) => void;
  /** R1 — open the shared detail drawer lifted to BuilderShell (RR2/RR-R3). */
  onOpenDetail: (poi: MatchPoiRow) => void;
  /** Optional filter UI (category chips) rendered under the header, above the
   *  grid. Passed from BuilderShell so the grid stays presentation-only. */
  filterSlot?: React.ReactNode;
  /** Phase C — poi_keys that can't join the current cart (different day-trip
   *  cluster). Their Add button is disabled. */
  blockedKeys?: Set<string>;
}

/**
 * POI card grid — R3 tone pass (2026-05-21).
 *
 * Changed from the Phase D restyle:
 *   • Mobile horizontal snap rail removed — now a 2-col grid at all
 *     breakpoints (same grid language as tours-list / home v2). 20-25 POIs
 *     benefit from browse density, not carousel scrolling (§C R3 decision).
 *   • SnapScrollDots + scrollRef removed (no longer a carousel).
 *   • Section border-top separates catalog visually from map+rail band.
 *   • All user-facing strings i18n'd via `itineraryBuilder.grid.*` (RR6).
 *   • Amber highlight bullet → slate (V5 amber = sequence only).
 *
 * Preserved: staggered REVEAL_ITEM_VARIANTS entrance, in-cart amber ribbon
 * (V5 — sequence identity), Details button → onOpenDetail drawer (R1/RR2),
 * Add/Remove cart wiring, h-full card stretch.
 */
export default function POICatalogGrid({ pois, cart, onAdd, onRemove, onFocus, onOpenDetail, filterSlot, blockedKeys }: Props) {
  const reveal = useRevealContainerProps();
  // The POI list is primary content that MUST always be visible — it cannot be
  // gated behind a scroll-reveal. On mobile the grid sits below the sticky map,
  // so the shared `whileInView` (trigger once at 15% visibility) could leave the
  // cards stuck at opacity:0 ("no POIs"). Animate on MOUNT instead (same fix
  // pattern as IntakeForm): keep the staggered fade-in, drop the scroll gate.
  const revealMount = {
    initial: reveal.initial,
    animate: "visible" as const,
    variants: reveal.variants,
  };
  const t = useTranslations("itineraryBuilder.grid");

  // Map poi_key → 1-indexed cart position; null when not in cart.
  // D4: memoize so an unrelated parent re-render doesn't rebuild the map +
  // re-sort the whole POI list (a new array ref on every render churned the
  // framer-motion grid). Recomputes only when pois or cart actually change.
  const cartPosition = useMemo(
    () => new Map(cart.map((k, i) => [k, i + 1])),
    [cart],
  );

  // Show in-cart first (preserving cart order), then by name_en.
  const ordered = useMemo(
    () =>
      [...pois].sort((a, b) => {
        const ai = cartPosition.get(a.poi_key) ?? Infinity;
        const bi = cartPosition.get(b.poi_key) ?? Infinity;
        if (ai !== bi) return ai - bi;
        return a.name_en.localeCompare(b.name_en);
      }),
    [pois, cartPosition],
  );

  return (
    <section className="relative overflow-hidden border-t border-slate-200/60 px-4 py-6 md:px-6 md:py-8">
      <motion.div {...revealMount} className="relative mx-auto max-w-7xl">
        <motion.header
          variants={REVEAL_ITEM_VARIANTS}
          className="mb-4 flex items-baseline justify-between md:mb-5"
        >
          <h2 className="text-h3 text-slate-900">
            {t("title")}
            <span className="ml-2 text-caption font-normal text-slate-500">
              ({ordered.length})
            </span>
          </h2>
          <p className="hidden text-micro text-slate-500 sm:block">
            {t("hint")}
          </p>
        </motion.header>

        {/* Category filter chips (deterministic facet) — sits between the
            header and the grid so it reads as "filter this list". */}
        {filterSlot ? (
          <motion.div variants={REVEAL_ITEM_VARIANTS}>{filterSlot}</motion.div>
        ) : null}

        {ordered.length === 0 ? (
          <motion.p
            variants={REVEAL_ITEM_VARIANTS}
            className="rounded-card bg-slate-50 px-4 py-8 text-center text-caption text-slate-500 ring-1 ring-slate-200/70"
          >
            {t("noneInFilter")}
          </motion.p>
        ) : null}

        {/* Responsive grid — 2-col mobile, 2/3/4-col at md/lg/xl.
            Replaces the Phase D horizontal snap rail: a browse grid for
            20-25 POIs is more legible than a carousel that hides most cards. */}
        <ul className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {ordered.map((poi) => {
            const seq = cartPosition.get(poi.poi_key);
            const inCart = seq != null;
            const blocked = !inCart && (blockedKeys?.has(poi.poi_key) ?? false);
            const imgSrc = poi.default_image_url || poi.images?.[0] || null;
            return (
              <motion.li
                key={poi.poi_key}
                variants={REVEAL_ITEM_VARIANTS}
              >
                <article
                  className={`group relative h-full overflow-hidden rounded-2xl border border-white/70 bg-white/85 shadow-[0_10px_28px_-18px_rgba(15,23,42,0.22)] backdrop-blur-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-22px_rgba(15,23,42,0.32)] motion-reduce:transition-none ${
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
                          className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-105 motion-reduce:transition-none"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-400">
                          <ImageIcon className="h-8 w-8" aria-hidden />
                        </div>
                      )}
                      {inCart ? (
                        <span className="absolute left-0 top-3 inline-flex items-center gap-1 rounded-r-full bg-amber-500 px-2.5 py-1 text-micro font-bold uppercase tracking-wide text-white shadow-md">
                          <Check className="h-3 w-3" aria-hidden />
                          {t("inCartBadge", { number: String(seq) })}
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
                              {/* Slate dot — V5: amber reserved for sequence only */}
                              <span aria-hidden className="mt-1 inline-block h-1 w-1 flex-shrink-0 rounded-full bg-slate-400" />
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
                        onOpenDetail(poi);
                      }}
                      className="text-micro font-semibold text-slate-500 underline-offset-2 transition-colors hover:text-slate-900 hover:underline"
                    >
                      {t("details")}
                    </button>
                    <button
                      type="button"
                      disabled={blocked}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (blocked) return;
                        if (inCart) onRemove(poi.poi_key);
                        else onAdd(poi.poi_key);
                      }}
                      className={`group/btn inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-micro font-bold transition-colors duration-200 ease-out ${
                        blocked
                          ? "cursor-not-allowed bg-slate-50 text-slate-400 ring-1 ring-slate-200"
                          : inCart
                            ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-rose-50 hover:text-rose-700 hover:ring-rose-200"
                            : "bg-white text-slate-900 ring-1 ring-slate-300 hover:bg-slate-50 hover:ring-slate-400"
                      }`}
                      title={blocked ? t("blockedRegion") : undefined}
                    >
                      {blocked ? (
                        t("blockedRegion")
                      ) : inCart ? (
                        <>
                          <Check className="h-3.5 w-3.5" aria-hidden />
                          {t("added")}
                        </>
                      ) : (
                        <>
                          <Plus className="h-3.5 w-3.5" aria-hidden />
                          {t("add")}
                        </>
                      )}
                    </button>
                  </div>
                </article>
              </motion.li>
            );
          })}
        </ul>
      </motion.div>
    </section>
  );
}

function stripMd(s: string): string {
  return s.replace(/\*\*/g, "").replace(/__/g, "").trim();
}
