import { Fragment } from "react";
import { ChevronRight, CornerDownLeft, MapPin, Sparkles, Utensils } from "lucide-react";

import { cn } from "@/lib/utils";
import type { EastSignatureNatureCoreDetailViewModel } from "../eastSignatureNatureCoreDetailViewModel";

export type TourDayFlowSectionProps = Pick<
  EastSignatureNatureCoreDetailViewModel,
  "routeFlowStops" | "routePhases" | "routeShapeIntro" | "sectionUi" | "itineraryStops"
>;

type FlexFlowStop = { id?: string; type?: string; name: string; theme?: string };

const TYPE_ICON: Record<string, typeof MapPin> = {
  origin: MapPin,
  meal: Utensils,
  return: CornerDownLeft,
  primary: Sparkles,
};

function StopMiniCard({ stop, index }: { stop: FlexFlowStop; index: number }) {
  const Icon = (stop.type && TYPE_ICON[stop.type]) || Sparkles;
  const isAccent = stop.type === "origin" || stop.type === "meal" || stop.type === "return";

  return (
    <div
      className={cn(
        "group flex w-[148px] flex-shrink-0 flex-col gap-1.5 rounded-xl bg-white px-3 py-3",
        "ring-1 ring-slate-900/[0.06]",
        "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_3px_8px_-2px_rgba(15,23,42,0.07)]",
        "transition-all duration-200 ease-out",
        "hover:-translate-y-[1px] hover:ring-slate-900/[0.10]",
        "hover:shadow-[0_2px_4px_rgba(15,23,42,0.05),0_5px_12px_-2px_rgba(15,23,42,0.10)]",
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-slate-50 px-1 text-[10px] font-semibold tabular-nums text-slate-600 ring-1 ring-slate-900/[0.04]">
          {String(index + 1).padStart(2, "0")}
        </span>
        <Icon
          className={cn(
            "h-3.5 w-3.5",
            isAccent ? "text-slate-700" : "text-slate-300",
          )}
          strokeWidth={2.25}
          aria-hidden
        />
      </div>
      <h3 className="text-[13px] font-semibold text-slate-900 leading-snug tracking-tight line-clamp-2">
        {stop.name}
      </h3>
      {stop.theme ? (
        <p className="text-[11px] text-slate-500 leading-snug line-clamp-1">{stop.theme}</p>
      ) : null}
    </div>
  );
}

export function TourDayFlowSection({ routeFlowStops, routeShapeIntro }: TourDayFlowSectionProps) {
  const flexStops = routeFlowStops as readonly FlexFlowStop[];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground tracking-tight">{routeShapeIntro.title}</h2>
      </div>

      <div
        className={cn(
          "relative overflow-hidden rounded-2xl bg-white",
          "ring-1 ring-slate-900/[0.06]",
          "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_10px_-2px_rgba(15,23,42,0.06),0_18px_36px_-14px_rgba(15,23,42,0.14)]",
        )}
      >
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex items-stretch gap-2 min-w-max px-4 py-4">
            {flexStops.map((stop, i) => (
              <Fragment key={`${stop.id ?? stop.type ?? "stop"}-${i}`}>
                <StopMiniCard stop={stop} index={i} />
                {i < flexStops.length - 1 ? (
                  <div className="flex items-center self-center px-0.5" aria-hidden>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-300" strokeWidth={2.25} />
                  </div>
                ) : null}
              </Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
