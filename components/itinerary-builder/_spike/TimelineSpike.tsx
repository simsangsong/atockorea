"use client";

import { Clock, ImageIcon } from "lucide-react";
import type { MatchPoiRow } from "@/lib/itinerary-builder/types";

/**
 * V2 redesign Phase 0 spike — throwaway vertical timeline that renders
 * below the existing map+cart section IFF `?spike=1`. Mimics the
 * tour-product detail page's `itineraryStop` card shape: thumbnail (left)
 * + content (name, name_ko, stay-min chip) with a dashed amber connector
 * between cards and a numbered amber node at each card's left edge.
 *
 * NO interactivity. No drag. No remove. Phase 3 builds the real
 * `<ResultTimeline />` with dnd-kit + drive-time chips + sync.
 *
 * Entire `components/itinerary-builder/_spike/` directory is deleted at
 * Phase 0 close-out — code under `_spike/` is throwaway by convention.
 */
interface Props {
  cart: string[];
  pois: MatchPoiRow[];
}

export default function TimelineSpike({ cart, pois }: Props) {
  const byKey = new Map(pois.map((p) => [p.poi_key, p]));
  const cartPois = cart.map((k) => byKey.get(k)).filter((p): p is MatchPoiRow => !!p);

  if (cartPois.length === 0) {
    return (
      <section className="bg-slate-50 px-4 pb-10 pt-6 md:px-6">
        <div className="mx-auto max-w-2xl rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <p className="text-eyebrow text-amber-700">Spike preview</p>
          <p className="mt-2 text-body text-slate-600">
            Add a few stops to see the timeline spike. Tap any pin's <em>Add to itinerary</em> button.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-slate-50 px-4 pb-12 pt-6 md:px-6">
      <div className="mx-auto max-w-2xl">
        <header className="mb-5">
          <p className="text-eyebrow text-amber-700">Spike preview · timeline</p>
          <p className="mt-1 text-caption text-slate-500">
            {cartPois.length} stop{cartPois.length === 1 ? "" : "s"} · throwaway visual to validate Phase 0
          </p>
        </header>
        <ol className="relative space-y-3 pl-7">
          {/* Vertical dashed connector running the full height (under the nodes) */}
          <span
            aria-hidden
            className="absolute left-[10px] top-3 bottom-3 w-px border-l-2 border-dashed border-amber-300"
          />
          {cartPois.map((poi, idx) => {
            const seq = idx + 1;
            const img = poi.default_image_url || poi.images?.[0] || null;
            return (
              <li
                key={poi.poi_key}
                className="relative flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200"
              >
                {/* Sequence node on the connector (left edge, overlapping the dashed line) */}
                <span
                  aria-hidden
                  className="absolute -left-7 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-amber-500 text-[11px] font-bold text-white shadow-[0_0_0_3px_rgba(251,191,36,0.20)] ring-2 ring-white"
                >
                  {seq}
                </span>

                {/* Thumbnail */}
                <span className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100 md:h-24 md:w-24">
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={img}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="absolute inset-0 m-auto h-6 w-6 text-slate-400" aria-hidden />
                  )}
                </span>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-caption font-bold leading-snug text-slate-900">
                    {poi.name_en}
                  </p>
                  {poi.name_ko ? (
                    <p className="mt-0.5 truncate text-micro text-slate-500">{poi.name_ko}</p>
                  ) : null}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {poi.default_stay_minutes ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-micro font-semibold text-slate-700">
                        <Clock className="h-3 w-3" aria-hidden />
                        {poi.default_stay_minutes}m
                      </span>
                    ) : null}
                    {poi.category ? (
                      <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-micro font-semibold text-amber-800 ring-1 ring-amber-100">
                        {poi.category}
                      </span>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
        <p className="mt-5 text-center text-micro text-slate-400">
          Phase 3 will replace this with the real drag-and-drop timeline + drive-time chips between
          stops + bi-directional map sync.
        </p>
      </div>
    </section>
  );
}
