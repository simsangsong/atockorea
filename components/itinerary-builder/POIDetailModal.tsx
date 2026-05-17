"use client";

import { useEffect, useState } from "react";
import { X, Plus, Check, MapPin, Clock, Footprints, Ticket } from "lucide-react";
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
export default function POIDetailModal({ poi, inCart, onClose, onAdd, onRemove, onFocus }: Props) {
  const allImages = poi.images && poi.images.length > 0
    ? poi.images
    : poi.default_image_url
    ? [poi.default_image_url]
    : [];
  const [activeIdx, setActiveIdx] = useState(0);

  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const smartTip = get(poi.smart_notes, "tip");
  const smartPhoto = get(poi.smart_notes, "photo");
  const smartFacilities = get(poi.smart_notes, "facilities");

  const vbHours = get(poi.visit_basics, "hours");
  const vbClosed = get(poi.visit_basics, "closed");
  const vbAdmission = get(poi.visit_basics, "admission");
  const vbWalking = get(poi.visit_basics, "walking");

  const cvParking = get(poi.convenience, "parking");
  const cvRestroom = get(poi.convenience, "restroom");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative z-10 max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-t-2xl bg-white shadow-2xl md:rounded-2xl">
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
            className="ml-3 flex-shrink-0 rounded p-1 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>

        <div className="max-h-[calc(92vh-180px)] overflow-y-auto">
          {/* Gallery */}
          {allImages.length > 0 ? (
            <div className="bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={allImages[activeIdx]}
                alt={poi.name_en}
                className="aspect-[16/10] w-full object-cover"
              />
              {allImages.length > 1 ? (
                <div className="flex gap-1.5 overflow-x-auto p-2">
                  {allImages.map((img, i) => (
                    <button
                      key={img}
                      type="button"
                      onClick={() => setActiveIdx(i)}
                      className={`relative flex-shrink-0 overflow-hidden rounded-md ring-2 ${
                        i === activeIdx ? "ring-amber-500" : "ring-transparent hover:ring-slate-200"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img} alt="" className="h-12 w-16 object-cover md:h-14 md:w-20" />
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
            {poi.highlights && poi.highlights.length > 0 ? (
              <section>
                <h3 className="mb-2 text-eyebrow">Highlights</h3>
                <ul className="space-y-1.5 text-body text-slate-700">
                  {poi.highlights.slice(0, 8).map((h, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span aria-hidden className="mt-1 flex-shrink-0 text-amber-600">
                        •
                      </span>
                      <span>{stripMd(h)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {/* Description */}
            {poi.description ? (
              <section>
                <h3 className="mb-2 text-eyebrow !text-slate-500">About this stop</h3>
                <div className="space-y-3 text-body leading-relaxed text-slate-700">
                  {poi.description.split(/\n+/).map((p, i) => (
                    <p key={i}>{stripMd(p)}</p>
                  ))}
                </div>
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
        <footer className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3">
          <button
            type="button"
            onClick={onFocus}
            className="text-caption font-semibold text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
          >
            Show on map
          </button>
          <button
            type="button"
            onClick={inCart ? onRemove : onAdd}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-caption font-bold transition-colors ${
              inCart
                ? "bg-rose-50 text-rose-700 ring-1 ring-rose-100 hover:bg-rose-100"
                : "bg-amber-500 text-white shadow hover:bg-amber-600"
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
      </div>
    </div>
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
