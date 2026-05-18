import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EastSignatureNatureCoreDetailViewModel } from "../eastSignatureNatureCoreDetailViewModel";

export type TourDayFlowSectionProps = Pick<
  EastSignatureNatureCoreDetailViewModel,
  "routeFlowStops" | "routePhases" | "routeShapeIntro" | "sectionUi" | "itineraryStops"
>;

type FlexFlowStop = { id?: string; type?: string; name: string; theme?: string };

export function TourDayFlowSection({ routeFlowStops, routeShapeIntro, itineraryStops }: TourDayFlowSectionProps) {
  const flexStops = routeFlowStops as readonly FlexFlowStop[];

  // Hide section when no stop has a photo — grey circles with type labels look confusing.
  const hasAnyPhoto = flexStops.some(
    (_, i) => itineraryStops?.[i]?.images?.[0] ?? itineraryStops?.[i]?.image,
  );
  if (!hasAnyPhoto) return null;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-title text-foreground">{routeShapeIntro.title}</h2>
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
        <div className="relative overflow-x-auto scrollbar-hide">
          <div className="flex items-start gap-0.5 min-w-max px-4 py-5">
            {flexStops.map((stop, i) => {
              const photoUrl = itineraryStops?.[i]?.images?.[0] ?? itineraryStops?.[i]?.image ?? null;
              const fallbackLabel = String(i + 1).padStart(2, "0");
              return (
                <div key={`${stop.name}-${i}`} className="flex items-start">
                  {/* Sprint 4.11: 48 → 80px photo + single elevation shadow (§8.4 Klook/Apple 표준) */}
                  <div className="flex w-[104px] flex-col items-center px-1">
                    <div className="relative">
                      <div
                        className={cn(
                          "h-20 w-20 rounded-full overflow-hidden bg-slate-50",
                          "shadow-[0_4px_12px_-4px_rgba(15,23,42,0.18)]",
                        )}
                      >
                        {photoUrl ? (
                          <img
                            src={photoUrl}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            draggable={false}
                            onContextMenu={(e) => e.preventDefault()}
                            className="h-full w-full object-cover tour-photo-protected"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[13px] font-semibold text-muted-foreground">
                            {fallbackLabel}
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="mt-2.5 w-full text-[13px] font-bold tracking-tight text-foreground text-center leading-tight line-clamp-2 break-words">
                      {stop.name}
                    </span>
                    {stop.theme ? (
                      <span className="mt-0.5 w-full text-[11px] text-muted-foreground text-center leading-tight line-clamp-1 break-words">{stop.theme}</span>
                    ) : null}
                  </div>
                  {i < flexStops.length - 1 ? (
                    /* Sprint 4.11: 3-dot connector → ArrowRight (방향성 명확, §8.4 권고) */
                    <div className="flex h-20 items-center px-1">
                      <ArrowRight
                        className="h-4 w-4 text-muted-foreground/45"
                        strokeWidth={1.5}
                        aria-hidden
                      />
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
