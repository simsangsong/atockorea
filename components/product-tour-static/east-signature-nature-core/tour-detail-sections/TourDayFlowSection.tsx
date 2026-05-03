import { cn } from "@/lib/utils";
import type { EastSignatureNatureCoreDetailViewModel } from "../eastSignatureNatureCoreDetailViewModel";

export type TourDayFlowSectionProps = Pick<
  EastSignatureNatureCoreDetailViewModel,
  "routeFlowStops" | "routePhases" | "routeShapeIntro" | "sectionUi" | "itineraryStops"
>;

/** Stop circle ring — muted stone tone for a quiet, premium look (no per-phase rainbow). */
const STOP_RING_COLOR = "ring-stone-200/70";

/** Map stop index → phase index using routePhases ranges (e.g. "1-2", "3-4", "5-6"). */
function phaseIndexForStop(
  stopIdx1Based: number,
  ranges: readonly string[],
): number {
  for (let i = 0; i < ranges.length; i++) {
    const r = ranges[i] ?? "";
    const m = r.match(/(\d+)\s*-\s*(\d+)/);
    if (m) {
      const lo = parseInt(m[1], 10);
      const hi = parseInt(m[2], 10);
      if (stopIdx1Based >= lo && stopIdx1Based <= hi) return i;
    }
  }
  return 0;
}

const PHASE_THEMES = [
  {
    card: "bg-gradient-to-br from-amber-50 via-white to-amber-100/40 ring-amber-100/70",
    dot: "bg-amber-500",
    label: "text-amber-700",
  },
  {
    card: "bg-gradient-to-br from-rose-50 via-white to-rose-100/40 ring-rose-100/70",
    dot: "bg-rose-500",
    label: "text-rose-700",
  },
  {
    card: "bg-gradient-to-br from-sky-50 via-white to-sky-100/40 ring-sky-100/70",
    dot: "bg-sky-500",
    label: "text-sky-700",
  },
  {
    card: "bg-gradient-to-br from-emerald-50 via-white to-emerald-100/40 ring-emerald-100/70",
    dot: "bg-emerald-500",
    label: "text-emerald-700",
  },
];

type FlexFlowStop = { id?: string; type?: string; name: string; theme?: string };
type FlexPhase = {
  label?: string;
  phase?: string;
  range?: string;
  duration?: string;
  theme?: string;
  description?: string;
};

export function TourDayFlowSection({ routeFlowStops, routePhases, routeShapeIntro, sectionUi, itineraryStops }: TourDayFlowSectionProps) {
  const flexStops = routeFlowStops as readonly FlexFlowStop[];
  const flexPhases = routePhases as readonly FlexPhase[];
  const phaseRanges = flexPhases.map((p) => p.range ?? p.duration ?? "");

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
                      <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[9.5px] font-bold tabular-nums text-foreground ring-1 ring-border/70 shadow-sm">
                        {stopId}
                      </span>
                    </div>
                    <span className="mt-2 text-[11px] font-semibold text-foreground tracking-tight whitespace-nowrap">
                      {stop.name}
                    </span>
                    {stop.theme ? (
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">{stop.theme}</span>
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

      {/* Phase summary cards — gradient bg, phase dot, range + theme */}
      <div className="grid grid-cols-3 gap-2.5">
        {flexPhases.map((phase, i) => {
          const theme = PHASE_THEMES[i % PHASE_THEMES.length];
          const label = phase.label ?? phase.phase ?? "";
          const range = phase.range ?? phase.duration ?? "";
          const themeText = phase.theme ?? phase.description ?? "";
          return (
            <div
              key={`${label}-${i}`}
              className={cn(
                "relative overflow-hidden rounded-xl px-3 py-3 text-center ring-1 transition-all duration-200",
                "shadow-[0_1px_2px_rgba(26,35,50,0.03),0_6px_18px_-10px_rgba(26,35,50,0.14)]",
                "hover:shadow-[0_2px_4px_rgba(26,35,50,0.04),0_10px_22px_-10px_rgba(26,35,50,0.20)]",
                theme.card,
              )}
            >
              <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/55 to-transparent" />
              <div className="relative flex items-center justify-center gap-1.5 mb-1.5">
                <span className={cn("w-1.5 h-1.5 rounded-full", theme.dot)} />
                <p className={cn("text-[10px] font-semibold uppercase tracking-[0.12em]", theme.label)}>{label}</p>
              </div>
              <p className="relative text-[12px] font-medium text-foreground tabular-nums">
                {sectionUi.dayFlowStopsPrefix} {range}
              </p>
              {themeText ? (
                <p className="relative text-[10.5px] text-muted-foreground mt-0.5">{themeText}</p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
