"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Plus, Check, MapPin, Clock, Footprints, Ticket, ChevronDown, ChevronUp } from "lucide-react";
import type { MatchPoiRow } from "@/lib/itinerary-builder/types";

interface Props {
  poi: MatchPoiRow;
  inCart: boolean;
  onClose: () => void;
  onAdd: () => void;
  onRemove: () => void;
  onFocus: () => void;
}

function stripMd(s: string): string {
  return s.replace(/\*\*/g, "").replace(/__/g, "").trim();
}

function get(obj: Record<string, unknown> | null | undefined, key: string): string | null {
  if (!obj) return null;
  const v = obj[key];
  return typeof v === "string" && v.trim() ? v : null;
}

/**
 * Rich POI detail modal — mirrors the tour-product detail page's
 * itineraryStop card. Image gallery, highlights, description, smartNotes,
 * visitBasics, convenience.
 */
const HIGHLIGHTS_VISIBLE = 6;

export default function POIDetailModal({ poi, inCart, onClose, onAdd, onRemove, onFocus }: Props) {
  const allImages = poi.images && poi.images.length > 0
    ? poi.images
    : poi.default_image_url
    ? [poi.default_image_url]
    : [];
  const [activeIdx, setActiveIdx] = useState(0);
  const [showAllHighlights, setShowAllHighlights] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);

  // Lock body scroll while open + close on Esc
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const smartTip = get(poi.smart_notes, "tip");
  const smartPhoto = get(poi.smart_notes, "photo");
  const smartFacilities = get(poi.smart_notes, "facilities");

  const vbHours = get(poi.visit_basics, "hours");
  const vbClosed = get(poi.visit_basics, "closed");
  const vbAdmission = get(poi.visit_basics, "admission");
  const vbWalking = get(poi.visit_basics, "walking");

  const cvParking = get(poi.convenience, "parking");
  const cvRestroom = get(poi.convenience, "restroom");

  const highlights = poi.highlights ?? [];
  const visibleHighlights = showAllHighlights ? highlights : highlights.slice(0, HIGHLIGHTS_VISIBLE);
  const hasMoreHighlights = highlights.length > HIGHLIGHTS_VISIBLE;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6" role="dialog" aria-modal="true">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden
        />
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.97 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-t-2xl bg-white shadow-2xl md:rounded-2xl"
        >
          <header className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
            <div className="min-w-0">
              <h2 className="truncate text-h3 text-slate-900">{poi.name_en}</h2>
              {poi.name_ko ? (
                <p className="truncate text-caption text-slate-500">{poi.name_ko}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="ml-3 flex-shrink-0 rounded-full p-1.5 text-slate-500 transition-colors hover:bg-slate-100"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </header>

          <div className="max-h-[calc(92vh-180px)] overflow-y-auto">
          {/* Hero gallery — 16:10 on mobile, 2:1 on desktop with bottom fade */}
          {allImages.length > 0 ? (
            <div className="bg-slate-100">
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={allImages[activeIdx]}
                  src={allImages[activeIdx]}
                  alt={poi.name_en}
                  className="aspect-[16/10] w-full object-cover md:aspect-[2/1]"
                />
                {/* Bottom fade so dark text on white card below reads cleanly */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-b from-transparent to-white"
                />
              </div>
              {allImages.length > 1 ? (
                <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto px-3 py-2 scrollbar-hide">
                  {allImages.map((img, i) => (
                    <button
                      key={img}
                      type="button"
                      onClick={() => setActiveIdx(i)}
                      aria-label={`Image ${i + 1} of ${allImages.length}`}
                      className={`relative h-12 w-16 flex-shrink-0 snap-start overflow-hidden rounded-md ring-2 transition-all duration-200 ease-out ${
                        i === activeIdx ? "ring-amber-500" : "ring-transparent opacity-70 hover:opacity-100 hover:ring-slate-200"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-4 px-5 py-4">
            {/* Pills row */}
            <div className="flex flex-wrap gap-2 text-micro">
              {poi.category ? (
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 font-semibold text-slate-700">
                  {poi.category}
                </span>
              ) : null}
              {poi.default_stay_minutes ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 font-semibold text-slate-700">
                  <Clock className="h-3 w-3" aria-hidden />~{poi.default_stay_minutes} min
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 font-semibold capitalize text-slate-700">
                <MapPin className="h-3 w-3" aria-hidden />
                {poi.region}
              </span>
            </div>

            {/* Highlights */}
            {highlights.length > 0 ? (
              <section>
                <h3 className="mb-2 text-eyebrow">Highlights</h3>
                <ul className="space-y-1.5 text-body text-slate-700">
                  {visibleHighlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="mt-1 h-3.5 w-3.5 flex-shrink-0 text-amber-600" aria-hidden />
                      <span>{stripMd(h)}</span>
                    </li>
                  ))}
                </ul>
                {hasMoreHighlights ? (
                  <button
                    type="button"
                    onClick={() => setShowAllHighlights((v) => !v)}
                    className="mt-2 inline-flex items-center gap-1 text-caption font-semibold text-amber-700 underline-offset-2 hover:text-amber-800 hover:underline"
                  >
                    {showAllHighlights ? (
                      <>
                        Show less <ChevronUp className="h-3 w-3" aria-hidden />
                      </>
                    ) : (
                      <>
                        Show all {highlights.length} highlights <ChevronDown className="h-3 w-3" aria-hidden />
                      </>
                    )}
                  </button>
                ) : null}
              </section>
            ) : null}

            {/* Description */}
            {poi.description ? (
              <section>
                <h3 className="mb-2 text-eyebrow !text-slate-500">About this stop</h3>
                <div
                  className={`space-y-3 text-body leading-relaxed text-slate-700 ${
                    !descExpanded ? "line-clamp-5 [&>*]:contents" : ""
                  }`}
                >
                  {poi.description.split(/\n+/).map((p, i) => (
                    <p key={i}>{stripMd(p)}</p>
                  ))}
                </div>
                {poi.description.length > 320 ? (
                  <button
                    type="button"
                    onClick={() => setDescExpanded((v) => !v)}
                    className="mt-1 inline-flex items-center gap-1 text-caption font-semibold text-amber-700 underline-offset-2 hover:text-amber-800 hover:underline"
                  >
                    {descExpanded ? (
                      <>
                        Read less <ChevronUp className="h-3 w-3" aria-hidden />
                      </>
                    ) : (
                      <>
                        Read more <ChevronDown className="h-3 w-3" aria-hidden />
                      </>
                    )}
                  </button>
                ) : null}
              </section>
            ) : null}

            {/* Smart notes */}
            {(smartTip || smartPhoto || smartFacilities) && (
              <section>
                <h3 className="mb-2 text-eyebrow !text-slate-500">Insider notes</h3>
                <dl className="space-y-2 text-body text-slate-700">
                  {smartTip ? (
                    <div>
                      <dt className="text-eyebrow">Tip</dt>
                      <dd>{smartTip}</dd>
                    </div>
                  ) : null}
                  {smartPhoto ? (
                    <div>
                      <dt className="text-eyebrow">Photo</dt>
                      <dd>{smartPhoto}</dd>
                    </div>
                  ) : null}
                  {smartFacilities ? (
                    <div>
                      <dt className="text-eyebrow">Facilities</dt>
                      <dd>{smartFacilities}</dd>
                    </div>
                  ) : null}
                </dl>
              </section>
            )}

            {/* Visit basics + convenience */}
            {(vbHours || vbClosed || vbAdmission || vbWalking || cvParking || cvRestroom) && (
              <section>
                <h3 className="mb-2 text-eyebrow !text-slate-500">Practical</h3>
                <dl className="grid grid-cols-1 gap-2 text-caption sm:grid-cols-2">
                  {vbHours ? <Row icon={<Clock className="h-3.5 w-3.5" aria-hidden />} label="Hours" value={vbHours} /> : null}
                  {vbClosed ? <Row icon={<Clock className="h-3.5 w-3.5" aria-hidden />} label="Closed" value={vbClosed} /> : null}
                  {vbAdmission ? <Row icon={<Ticket className="h-3.5 w-3.5" aria-hidden />} label="Admission" value={vbAdmission} /> : null}
                  {vbWalking ? <Row icon={<Footprints className="h-3.5 w-3.5" aria-hidden />} label="Walking" value={vbWalking} /> : null}
                  {cvParking ? <Row label="Parking" value={cvParking} /> : null}
                  {cvRestroom ? <Row label="Restroom" value={cvRestroom} /> : null}
                </dl>
              </section>
            )}

            {/* Why on route */}
            {poi.why_on_route ? (
              <section>
                <h3 className="mb-2 text-eyebrow !text-slate-500">Why this stop?</h3>
                <p className="text-body leading-relaxed text-slate-700">{stripMd(poi.why_on_route)}</p>
              </section>
            ) : null}
          </div>
        </div>

          {/* Footer actions */}
          <footer className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3">
            <button
              type="button"
              onClick={onFocus}
              className="flex-shrink-0 text-caption font-semibold text-slate-600 underline-offset-2 transition-colors hover:text-slate-900 hover:underline"
            >
              Show on map
            </button>
            <button
              type="button"
              onClick={inCart ? onRemove : onAdd}
              className={`inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-2.5 text-caption font-bold transition-all duration-200 ease-out ${
                inCart
                  ? "bg-rose-50 text-rose-700 ring-1 ring-rose-100 hover:bg-rose-100"
                  : "bg-slate-900 text-white shadow hover:bg-slate-800"
              }`}
            >
              {inCart ? (
                <>
                  <Check className="h-4 w-4" aria-hidden />
                  Remove from itinerary
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" aria-hidden />
                  Add to itinerary
                </>
              )}
            </button>
          </footer>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function Row({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2 rounded-md bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
      <span className="mt-0.5 flex-shrink-0 text-slate-500">{icon}</span>
      <div className="min-w-0 flex-1">
        <dt className="text-eyebrow !text-slate-500">{label}</dt>
        <dd className="text-slate-800">{value}</dd>
      </div>
    </div>
  );
}
