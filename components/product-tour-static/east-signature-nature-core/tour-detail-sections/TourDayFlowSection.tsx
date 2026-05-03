import { cn } from "@/lib/utils";
import type { EastSignatureNatureCoreDetailViewModel } from "../eastSignatureNatureCoreDetailViewModel";

export type TourDayFlowSectionProps = Pick<
  EastSignatureNatureCoreDetailViewModel,
  "routeFlowStops" | "routePhases" | "routeShapeIntro" | "sectionUi" | "itineraryStops"
>;

/** Stop circle ring — muted stone tone for a quiet, premium look (no per-phase rainbow). */
const STOP_RING_COLOR = "ring-stone-200/70";

type FlexFlowStop = { id?: string; type?: string; name: string; theme?: string };

export function TourDayFlowSection({ routeFlowStops, routeShapeIntro, itineraryStops }: TourDayFlowSectionProps) {
  const flexStops = routeFlowStops as readonly FlexFlowStop[];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground tracking-tight">{routeShapeIntro.title}</h2>
      </div>

      {/* Quiet premium flow card — soft ivory wash, hairline ring, low-key shadow. */}
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl ring-1",
          "bg-gradient-to-br from-[#fdfbf6] via-[#fefdfa] to-[#f9f6ef]",
          "ring-stone-200/45",
          "shadow-[0_1px_2px_rgba(26,35,50,0.03),0_3px_8px_-3px_rgba(26,35,50,0.06)]",
        )}
      >
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/4 bg-gradient-to-b from-white/40 to-transparent" />
        <div className="relative overflow-x-auto scrollbar-hide">
          <div className="flex items-start gap-1 min-w-max px-4 py-5">
            {flexStops.map((stop, i) => {
              const stopId = stop.id ?? stop.type ?? String(i + 1).padStart(2, "0");
              const ring = STOP_RING_COLOR;
              const photoUrl = itineraryStops?.[i]?.image;
              return (
                <div key={`${stopId}-${i}`} className="flex items-start">
                  <div className="flex w-[72px] flex-col items-center px-1">
                    <div className="relative">
                      <div
                        className={cn(
                          "h-12 w-12 rounded-full ring-2 ring-offset-2 ring-offset-white overflow-hidden bg-muted",
                          "shadow-[0_1px_2px_rgba(26,35,50,0.06),0_4px_12px_-4px_rgba(26,35,50,0.18)]",
                          ring,
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
                            {stopId}
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="mt-2 w-full text-[11px] font-semibold text-foreground tracking-tight text-center leading-tight line-clamp-2 break-words">
                      {stop.name}
                    </span>
                    {stop.theme ? (
                      <span className="w-full text-[10px] text-muted-foreground text-center leading-tight line-clamp-1 break-words">{stop.theme}</span>
                    ) : null}
                  </div>
                  {i < flexStops.length - 1 ? (
                    <div className="flex h-12 items-center pt-2">
                      <div className="h-px w-5 bg-gradient-to-r from-border/70 via-border to-border/70" />
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
