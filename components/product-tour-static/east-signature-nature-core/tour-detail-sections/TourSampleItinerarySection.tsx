"use client";

import { useState } from "react";
import { Ban, Clock, Hotel, Info, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SampleItinerarySection } from "@/components/product-tour-static/_shared/tourProductDetailSectionTypes";

export type TourSampleItinerarySectionProps = {
  sampleItineraries: SampleItinerarySection;
};

/**
 * Sample-itinerary section — private/charter products only.
 *
 * Replaces the route-flow + numbered timeline used by fixed-route tours. A
 * private charter has no fixed route, so we surface a few *sample* day plans
 * (e.g. Pocheon / Seoul City / Suwon Hwaseong) the guest can adapt with their
 * driver-guide. Each variant is a stack of slots that authoring fills in later;
 * pickup/drop-off default to the guest's hotel. The private-tour rules block
 * renders directly below the variants.
 */
export function TourSampleItinerarySection({ sampleItineraries }: TourSampleItinerarySectionProps) {
  const variants = sampleItineraries.variants ?? [];
  const [activeId, setActiveId] = useState(variants[0]?.id ?? "");
  const active = variants.find((v) => v.id === activeId) ?? variants[0];

  const pickupLabel = sampleItineraries.pickupDefaultLabel ?? "Pickup — your hotel (door-to-door)";
  const dropoffLabel = sampleItineraries.dropoffDefaultLabel ?? "Drop-off — your hotel";
  const slotPlaceholder = sampleItineraries.slotPlaceholder ?? "To be confirmed with your driver-guide";

  return (
    <div className="space-y-7">
      <div>
        <h2 className="text-lg font-semibold text-foreground tracking-tight">
          {sampleItineraries.title ?? "Sample itineraries"}
        </h2>
        {sampleItineraries.subtitle && (
          <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{sampleItineraries.subtitle}</p>
        )}
      </div>

      {/* Variant tab strip */}
      {variants.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {variants.map((v) => {
            const selected = v.id === active?.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setActiveId(v.id)}
                aria-pressed={selected}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors",
                  selected
                    ? "bg-primary text-white shadow-[0_1px_2px_rgba(15,23,42,0.12)]"
                    : "bg-slate-50 text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100",
                )}
              >
                {v.label}
              </button>
            );
          })}
        </div>
      )}

      {active && (
        <div>
          {(active.summary || active.durationLabel) && (
            <div className="mb-4">
              {active.summary && (
                <p className="text-sm text-foreground leading-relaxed">{active.summary}</p>
              )}
              {active.durationLabel && (
                <p className="mt-1 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" strokeWidth={1.75} />
                  {active.durationLabel}
                </p>
              )}
            </div>
          )}

          {/* Timeline — hotel pickup bookend, slots, hotel drop-off bookend */}
          <ol className="relative space-y-0">
            <BookendRow label={pickupLabel} />

            {active.stops.map((slot, i) => (
              <li key={i} className="relative pl-9">
                <span className="absolute left-[16px] top-9 bottom-0 w-px bg-gradient-to-b from-slate-200/50 to-transparent" />
                <span
                  className="absolute left-0 top-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-white text-[12px] font-medium tabular-nums tracking-[0.04em] text-slate-600 ring-1 ring-white"
                  style={{
                    boxShadow:
                      "0 1px 2px rgba(15,23,42,0.06), 0 4px 12px -4px rgba(15,23,42,0.10), inset 0 0.5px 0 rgba(255,255,255,0.9)",
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="pb-5">
                  <div className="rounded-2xl border border-slate-200/70 bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_12px_-2px_rgba(0,0,0,0.055)]">
                    {slot.time && (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                        <Clock className="h-3 w-3" />
                        <span className="font-medium text-slate-700 tabular-nums">{slot.time}</span>
                      </div>
                    )}
                    {slot.title ? (
                      <h3 className="mt-1 text-[15px] font-semibold text-slate-900 tracking-tight leading-snug">
                        {slot.title}
                      </h3>
                    ) : (
                      <p className="mt-1 text-[13.5px] italic text-slate-400">{slotPlaceholder}</p>
                    )}
                    {slot.note && <p className="mt-1 text-[12.5px] text-muted-foreground leading-relaxed">{slot.note}</p>}
                  </div>
                </div>
              </li>
            ))}

            <BookendRow label={dropoffLabel} last />
          </ol>
        </div>
      )}

      {/* Not included */}
      {sampleItineraries.notIncluded && sampleItineraries.notIncluded.length > 0 && (
        <div className="rounded-2xl border border-slate-200/70 bg-slate-50/60 px-4 py-3.5">
          <div className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-slate-500">
            <Ban className="h-3.5 w-3.5" strokeWidth={1.75} />
            {sampleItineraries.notIncludedLabel ?? "Not included"}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {sampleItineraries.notIncluded.map((item) => (
              <span
                key={item}
                className="rounded-md bg-white px-2.5 py-1 text-[12px] font-medium text-slate-600 ring-1 ring-slate-200"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Private-tour rules — detailed explanation below the itinerary */}
      {sampleItineraries.rules && sampleItineraries.rules.length > 0 && (
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_12px_-2px_rgba(0,0,0,0.055)]">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 flex-shrink-0 text-primary" strokeWidth={1.75} />
            <h3 className="text-[15px] font-semibold tracking-tight text-foreground">
              {sampleItineraries.rulesTitle ?? "Private tour — how it works"}
            </h3>
          </div>
          {sampleItineraries.rulesSubtitle && (
            <p className="mt-1.5 text-[13px] text-muted-foreground leading-relaxed">{sampleItineraries.rulesSubtitle}</p>
          )}
          <div className="mt-3 space-y-4">
            {sampleItineraries.rules.map((group) => (
              <div key={group.heading}>
                <h4 className="text-[12.5px] font-semibold uppercase tracking-wide text-slate-500">{group.heading}</h4>
                <ul className="mt-1.5 space-y-1.5">
                  {group.items.map((item, i) => (
                    <li key={i} className="flex gap-2 text-[13px] text-slate-700 leading-relaxed">
                      <span aria-hidden className="mt-[7px] h-1 w-1 flex-shrink-0 rounded-full bg-slate-300" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BookendRow({ label, last }: { label: string; last?: boolean }) {
  return (
    <li className="relative pl-9">
      {!last && <span className="absolute left-[16px] top-9 bottom-0 w-px bg-gradient-to-b from-slate-200/50 to-transparent" />}
      <span className="absolute left-0 top-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-primary/[0.06] text-primary ring-1 ring-primary/15">
        {last ? <MapPin className="h-4 w-4" strokeWidth={1.75} /> : <Hotel className="h-4 w-4" strokeWidth={1.75} />}
      </span>
      <div className="pb-5 pt-1.5">
        <p className="text-[13.5px] font-medium text-slate-700">{label}</p>
      </div>
    </li>
  );
}
