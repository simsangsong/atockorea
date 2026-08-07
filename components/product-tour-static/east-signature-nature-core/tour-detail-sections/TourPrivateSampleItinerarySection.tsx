"use client";

import { useState } from "react";
import Image from "next/image";
import { Building2, Info, Navigation } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  pickLocalized,
  type PrivateLocale,
  type PrivateSampleItineraryConfig,
  type SampleSlot,
} from "@/components/product-tour-static/_shared/privateSampleItinerary";

export type TourPrivateSampleItinerarySectionProps = {
  config: PrivateSampleItineraryConfig;
  locale?: PrivateLocale;
};

/**
 * Sample-itinerary section for private charters.
 *
 * The stop rows carry a photo instead of a bullet: a text-only list read as
 * unfinished next to the rest of the page, and the sample day is the one place
 * a charter buyer can picture what they are actually booking. Pickup and
 * drop-off stay as slim icon rows so the photographs mark the day's shape.
 *
 * Course switching reuses the shared `SegmentedToggle` grammar (white pill on a
 * stone track) rather than a second amber button — the amber CTA stays the only
 * amber-filled control on the page.
 */
export function TourPrivateSampleItinerarySection({
  config,
  locale = "en",
}: TourPrivateSampleItinerarySectionProps) {
  const [activeId, setActiveId] = useState(config.samples[0]?.id ?? "");
  const active =
    config.samples.find((s) => s.id === activeId) ?? config.samples[0];
  if (!active) return null;

  const stops = active.slots.filter((s) => s.kind === "stop");

  return (
    <div className="space-y-5">
      {/* Heading */}
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground text-cjk-body">
          {pickLocalized(config.title, locale)}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground text-cjk-body">
          {pickLocalized(config.subtitle, locale)}
        </p>
      </div>

      {/* Course switch — segmented track, horizontally scrollable on narrow phones */}
      {config.samples.length > 1 && (
        <div className="-mx-1 overflow-x-auto scrollbar-hide px-1">
          <div
            role="tablist"
            aria-label={pickLocalized(config.title, locale)}
            className="inline-flex items-center gap-0.5 rounded-full bg-stone-100/90 p-1 ring-1 ring-slate-900/[0.05]"
          >
            {config.samples.map((s) => {
              const isActive = s.id === active.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveId(s.id)}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors duration-200 text-cjk-safe",
                    isActive
                      ? "bg-white text-foreground shadow-[0_1px_2px_rgba(15,23,42,0.08),0_2px_6px_-2px_rgba(15,23,42,0.12)]"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {pickLocalized(s.label, locale)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Active course */}
      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-900/[0.07] shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_10px_-2px_rgba(15,23,42,0.06),0_18px_36px_-14px_rgba(15,23,42,0.16)]">
        {active.blurb && (
          <div className="border-b border-stone-200/60 bg-[#faf7f3] px-4 py-3 sm:px-5">
            <p className="text-[12.5px] leading-relaxed text-foreground/75 text-cjk-body">
              {pickLocalized(active.blurb, locale)}
            </p>
          </div>
        )}

        <ol className="px-4 py-3 sm:px-5">
          {active.slots.map((slot, idx) => {
            if (slot.kind === "stop") {
              const n = stops.indexOf(slot) + 1;
              return (
                <StopRow
                  key={`${active.id}-${idx}`}
                  slot={slot}
                  index={n}
                  locale={locale}
                />
              );
            }
            return <BookendRow key={`${active.id}-${idx}`} slot={slot} locale={locale} />;
          })}
        </ol>
      </div>

      {/* Private-tour rules block */}
      <div className="overflow-hidden rounded-2xl border border-stone-200/70 bg-white">
        <div className="flex items-center gap-2 border-b border-stone-200/60 bg-[#faf7f3] px-4 py-3 sm:px-5">
          <Info className="h-4 w-4 flex-shrink-0 text-[#c8956c]" strokeWidth={2} />
          <p className="text-[13.5px] font-semibold tracking-tight text-foreground text-cjk-safe">
            {pickLocalized(config.rulesTitle, locale)}
          </p>
        </div>
        <ul className="divide-y divide-stone-200/45">
          {config.rules.map((rule, idx) => (
            <li
              key={idx}
              className={cn(
                "flex items-start gap-2.5 px-4 py-2.5 sm:px-5",
                rule.emphasis && "bg-[#c8956c]/[0.06]",
              )}
            >
              <span
                className={cn(
                  "mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full",
                  rule.emphasis ? "bg-[#c8956c]" : "bg-stone-300",
                )}
              />
              <p
                className={cn(
                  "text-[12.5px] leading-relaxed text-cjk-body",
                  rule.emphasis
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {pickLocalized(rule.text, locale)}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Pickup / drop-off — slim icon row, deliberately quieter than a stop. */
function BookendRow({ slot, locale }: { slot: SampleSlot; locale: PrivateLocale }) {
  const Icon = slot.kind === "pickup" ? Building2 : Navigation;
  return (
    <li className="flex items-start gap-3 py-2.5">
      <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-stone-100 ring-1 ring-stone-200/80">
        <Icon className="h-3.5 w-3.5 text-foreground/60" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1 pt-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[13px] font-semibold text-foreground/80 text-cjk-body">
            {pickLocalized(slot.title, locale)}
          </p>
          {slot.time && (
            <span className="flex-shrink-0 text-[12.5px] font-semibold tabular-nums text-foreground/70">
              {slot.time}
            </span>
          )}
        </div>
        {slot.note && (
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground text-cjk-body">
            {pickLocalized(slot.note, locale)}
          </p>
        )}
      </div>
    </li>
  );
}

/** A real stop — photo tile carries the row. */
function StopRow({
  slot,
  index,
  locale,
}: {
  slot: SampleSlot;
  index: number;
  locale: PrivateLocale;
}) {
  const title = pickLocalized(slot.title, locale);
  return (
    <li className="flex items-start gap-3 border-t border-stone-200/50 py-3 first:border-t-0">
      <span className="relative h-[72px] w-[72px] flex-shrink-0 overflow-hidden rounded-xl bg-stone-100 ring-1 ring-slate-900/[0.07] shadow-[0_1px_2px_rgba(15,23,42,0.06),0_6px_14px_-6px_rgba(15,23,42,0.18)]">
        {slot.image ? (
          <>
            <Image
              src={slot.image}
              alt=""
              width={72}
              height={72}
              sizes="72px"
              loading="lazy"
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
              className="h-full w-full object-cover tour-photo-protected"
            />
            <span className="absolute left-1 top-1 rounded-md bg-black/45 px-1.5 py-px text-[10px] font-semibold tabular-nums text-white backdrop-blur-[2px]">
              {String(index).padStart(2, "0")}
            </span>
          </>
        ) : (
          /* No photograph of this spot on the site yet — a numbered tile rather
             than another place's picture. The number IS the tile here, so the
             corner badge would just repeat it. */
          <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-stone-100 to-stone-200/70 text-[17px] font-semibold tabular-nums text-foreground/40">
            {String(index).padStart(2, "0")}
          </span>
        )}
      </span>

      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-[14px] font-semibold leading-snug tracking-tight text-foreground text-cjk-body">
          {title}
        </p>
        {slot.note && (
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground text-cjk-body">
            {pickLocalized(slot.note, locale)}
          </p>
        )}
        {slot.stay && (
          <span className="mt-1.5 inline-flex items-center rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-foreground/60 text-cjk-safe">
            {pickLocalized(slot.stay, locale)}
          </span>
        )}
      </div>
    </li>
  );
}
