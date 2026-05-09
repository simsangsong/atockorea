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
        <div className="relative overflow-x-auto scrollbar-hide">
          <div className="flex items-start gap-0.5 min-w-max px-4 py-5">
            {flexStops.map((stop, i) => {
              const photoUrl = itineraryStops?.[i]?.images?.[0] ?? itineraryStops?.[i]?.image ?? null;
              const fallbackLabel = String(i + 1).padStart(2, "0");
              return (
                <div key={`${stop.name}-${i}`} className="flex items-start">
                  <div className="flex w-[72px] flex-col items-center px-1">
                    <div className="relative">
                      <div
                        className={cn(
                          "h-12 w-12 rounded-full ring-1 ring-offset-2 ring-offset-white overflow-hidden bg-slate-50",
                          "ring-slate-900/[0.08]",
                          "shadow-[0_1px_2px_rgba(15,23,42,0.06),0_4px_10px_-3px_rgba(15,23,42,0.14),0_10px_20px_-8px_rgba(15,23,42,0.10)]",
                        )}
                      >
                        {photoUrl ? (
                          <img
                            src={photoUrl}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-muted-foreground">
                            {fallbackLabel}
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="mt-2 w-full text-[11.5px] font-semibold text-slate-900 tracking-[-0.005em] text-center leading-tight line-clamp-2 break-words">
                      {stop.name}
                    </span>
                    {stop.theme ? (
                      <span className="mt-0.5 w-full text-[10.5px] text-slate-500 text-center leading-tight line-clamp-1 break-words">{stop.theme}</span>
                    ) : null}
                  </div>
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
