"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { EastSignatureNatureCoreDetailViewModel } from "../eastSignatureNatureCoreDetailViewModel";
import { observeSpyTarget } from "@/components/product-tour-static/_shared/sectionScrollSpy";

export type TourDayFlowSectionProps = Pick<
  EastSignatureNatureCoreDetailViewModel,
  "routeFlowStops" | "routePhases" | "routeShapeIntro" | "sectionUi" | "itineraryStops"
>;

type FlexFlowStop = { id?: string; type?: string; name: string; theme?: string };

/**
 * W2.3 — the day-flow strip is a photo-thumbnail SCRUBBER (non-sticky,
 * inline): tapping a stop jumps to its timeline card (§F-8 grammar ④), and
 * the active ring tracks reading position via the page-wide shared scroll-spy
 * (sectionScrollSpy — observer count +0). Only this ribbon re-renders on an
 * active-stop change.
 */
export function TourDayFlowSection({ routeFlowStops, routeShapeIntro, itineraryStops }: TourDayFlowSectionProps) {
  const flexStops = routeFlowStops as readonly FlexFlowStop[];
  const [activeIdx, setActiveIdx] = useState<number>(-1);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const stopCount = flexStops.length;

  // Spy the timeline stop cards (ids stamped by TourTimelineSection). The
  // numbered cards can be fewer than flexStops when pickup/drop-off pseudo
  // stops were stripped — indexes map 1:1 from the front of the strip.
  useEffect(() => {
    const unsubs: (() => void)[] = [];
    for (let i = 0; i < stopCount; i++) {
      const el = document.getElementById(`tour-stop-${i + 1}`);
      if (!el) continue;
      const idx = i;
      unsubs.push(observeSpyTarget(el, () => setActiveIdx(idx)));
    }
    return () => unsubs.forEach((u) => u());
  }, [stopCount]);

  // Keep the active thumb visible inside the strip (container-only scroll —
  // never scrolls the page).
  useEffect(() => {
    if (activeIdx < 0) return;
    const scroller = scrollerRef.current;
    const thumb = scroller?.querySelector<HTMLElement>(`[data-scrub-idx="${activeIdx}"]`);
    if (!scroller || !thumb) return;
    const target = thumb.offsetLeft - scroller.clientWidth / 2 + thumb.clientWidth / 2;
    scroller.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [activeIdx]);

  const jumpToStop = (i: number) => {
    const el = document.getElementById(`tour-stop-${i + 1}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Hide section when no stop has a photo — grey circles with type labels look confusing.
  const hasAnyPhoto = flexStops.some(
    (_, i) => itineraryStops?.[i]?.images?.[0] ?? itineraryStops?.[i]?.image,
  );
  if (!hasAnyPhoto) return null;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground tracking-tight">{routeShapeIntro.title}</h2>
      </div>

      {/* Premium-minimal flow card — same shell as TourAtAGlance / TourTimelineSection. */}
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl",
          "bg-white",
          "ring-1 ring-slate-900/[0.07]",
          "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_10px_-2px_rgba(15,23,42,0.06),0_18px_36px_-14px_rgba(15,23,42,0.16)]",
        )}
      >
        <div ref={scrollerRef} className="relative overflow-x-auto scrollbar-hide">
          <div className="flex items-start gap-0.5 min-w-max px-4 py-5">
            {flexStops.map((stop, i) => {
              const photoUrl = itineraryStops?.[i]?.images?.[0] ?? itineraryStops?.[i]?.image ?? null;
              const fallbackLabel = String(i + 1).padStart(2, "0");
              const isActive = i === activeIdx;
              return (
                <div key={`${stop.name}-${i}`} className="flex items-start">
                  <button
                    type="button"
                    data-scrub-idx={i}
                    onClick={() => jumpToStop(i)}
                    aria-label={stop.name}
                    aria-current={isActive ? "true" : undefined}
                    className="flex w-[72px] cursor-pointer flex-col items-center px-1 outline-none"
                  >
                    <span className="relative">
                      <span
                        className={cn(
                          "block h-12 w-12 overflow-hidden rounded-full bg-slate-50 ring-offset-2 ring-offset-white transition-shadow duration-200",
                          isActive
                            ? "ring-2 ring-amber-700 shadow-[0_2px_6px_rgba(180,83,9,0.18),0_8px_18px_-6px_rgba(180,83,9,0.28)]"
                            : "ring-1 ring-slate-900/[0.08] shadow-[0_1px_2px_rgba(15,23,42,0.06),0_4px_10px_-3px_rgba(15,23,42,0.14),0_10px_20px_-8px_rgba(15,23,42,0.10)]",
                        )}
                      >
                        {photoUrl ? (
                          <Image
                            src={photoUrl}
                            alt=""
                            width={48}
                            height={48}
                            sizes="48px"
                            loading="lazy"
                            draggable={false}
                            onContextMenu={(e) => e.preventDefault()}
                            className="h-full w-full object-cover tour-photo-protected"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-muted-foreground">
                            {fallbackLabel}
                          </span>
                        )}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "mt-2 w-full text-center text-[11.5px] tracking-[-0.005em] leading-tight line-clamp-2 break-words",
                        isActive ? "font-bold text-amber-900" : "font-semibold text-slate-900",
                      )}
                    >
                      {stop.name}
                    </span>
                    {stop.theme ? (
                      <span className="mt-0.5 w-full text-[10.5px] text-slate-500 text-center leading-tight line-clamp-1 break-words">{stop.theme}</span>
                    ) : null}
                  </button>
                  {i < flexStops.length - 1 ? (
                    <div className="flex h-12 items-center pt-2 gap-[3px] px-0.5">
                      <span aria-hidden className="h-[3px] w-[3px] rounded-full bg-slate-300" />
                      <span aria-hidden className="h-[3px] w-[3px] rounded-full bg-slate-300" />
                      <span aria-hidden className="h-[3px] w-[3px] rounded-full bg-slate-300" />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>

    </div>
  );
}
