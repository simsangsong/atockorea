"use client";

import { useState } from "react";
import { Building2, Info, MapPin, Navigation } from "lucide-react";
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

function slotAccent(kind: SampleSlot["kind"]): {
  Icon: typeof MapPin;
  ring: string;
  dot: string;
} {
  if (kind === "pickup") {
    return { Icon: Building2, ring: "ring-[#c8956c]/30", dot: "bg-[#c8956c]" };
  }
  if (kind === "dropoff") {
    return { Icon: Navigation, ring: "ring-slate-300", dot: "bg-slate-700" };
  }
  return { Icon: MapPin, ring: "ring-slate-200", dot: "bg-slate-300" };
}

export function TourPrivateSampleItinerarySection({
  config,
  locale = "en",
}: TourPrivateSampleItinerarySectionProps) {
  const [activeId, setActiveId] = useState(config.samples[0]?.id ?? "");
  const active =
    config.samples.find((s) => s.id === activeId) ?? config.samples[0];
  if (!active) return null;

  return (
    <div className="space-y-5">
      {/* Heading */}
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          {pickLocalized(config.title, locale)}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {pickLocalized(config.subtitle, locale)}
        </p>
      </div>

      {/* Sample tabs */}
      {config.samples.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {config.samples.map((s) => {
            const isActive = s.id === active.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveId(s.id)}
                aria-pressed={isActive}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors",
                  isActive
                    ? "bg-[#c8956c] text-white shadow-[0_4px_12px_-4px_rgba(200,149,108,0.5)]"
                    : "bg-stone-100 text-foreground/70 hover:bg-stone-200/70",
                )}
              >
                {pickLocalized(s.label, locale)}
              </button>
            );
          })}
        </div>
      )}

      {/* Active sample timeline */}
      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-900/[0.07] shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_10px_-2px_rgba(15,23,42,0.06),0_18px_36px_-14px_rgba(15,23,42,0.16)]">
        {active.blurb && (
          <div className="border-b border-stone-200/50 bg-stone-50/50 px-4 py-2.5 sm:px-5">
            <p className="text-[12.5px] leading-relaxed text-muted-foreground">
              {pickLocalized(active.blurb, locale)}
            </p>
          </div>
        )}

        <ol className="relative px-4 py-4 sm:px-5">
          {/* Vertical connector line */}
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-7 left-[27px] top-7 w-px bg-stone-200 sm:left-[31px]"
          />
          {active.slots.map((slot, idx) => {
            const { Icon, ring, dot } = slotAccent(slot.kind);
            const isPlaceholder = slot.kind === "stop";
            return (
              <li
                key={`${active.id}-${idx}`}
                className="relative flex items-start gap-3 py-2.5"
              >
                <span
                  className={cn(
                    "relative z-10 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-white ring-1",
                    ring,
                  )}
                >
                  {isPlaceholder ? (
                    <span className={cn("h-2 w-2 rounded-full", dot)} />
                  ) : (
                    <Icon className="h-3.5 w-3.5 text-foreground/70" strokeWidth={2} />
                  )}
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <p
                      className={cn(
                        "text-[13.5px] font-medium",
                        isPlaceholder ? "text-foreground/55" : "text-foreground",
                      )}
                    >
                      {pickLocalized(slot.title, locale)}
                    </p>
                    {slot.time && (
                      <span className="flex-shrink-0 text-[12.5px] font-semibold tabular-nums text-foreground">
                        {slot.time}
                      </span>
                    )}
                  </div>
                  {slot.note && (
                    <p
                      className={cn(
                        "mt-0.5 text-[11.5px] leading-relaxed",
                        isPlaceholder
                          ? "italic text-muted-foreground/70"
                          : "text-muted-foreground",
                      )}
                    >
                      {pickLocalized(slot.note, locale)}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Private-tour rules block */}
      <div className="overflow-hidden rounded-2xl border border-stone-200/70 bg-stone-50/40">
        <div className="flex items-center gap-2 border-b border-stone-200/60 px-4 py-3 sm:px-5">
          <Info className="h-4 w-4 flex-shrink-0 text-[#c8956c]" strokeWidth={2} />
          <p className="text-[13.5px] font-semibold tracking-tight text-foreground">
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
                  "text-[12.5px] leading-relaxed",
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
