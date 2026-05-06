import { cn } from "@/lib/utils";
import type { EastSignatureNatureCoreDetailViewModel } from "../eastSignatureNatureCoreDetailViewModel";

const MAX_LEVEL = 5;

const ROW_ACCENT_COLORS = [
  "bg-emerald-500",
  "bg-amber-500",
  "bg-orange-500",
  "bg-rose-500",
  "bg-violet-500",
  "bg-sky-500",
];

function clampLevel(level: number | undefined): number {
  if (typeof level !== "number" || !Number.isFinite(level)) return 0;
  return Math.max(0, Math.min(MAX_LEVEL, Math.round(level)));
}

export type TourAtAGlanceProps = Pick<EastSignatureNatureCoreDetailViewModel, "glanceItems" | "sectionUi">;

export function TourAtAGlance({ glanceItems, sectionUi }: TourAtAGlanceProps) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[17px] font-semibold text-foreground tracking-[-0.02em]">
          {sectionUi.atAGlanceTitle}
        </h2>
        <p className="mt-1.5 text-[13px] text-muted-foreground leading-relaxed">
          {sectionUi.atAGlanceSubtitle}
        </p>
      </div>

      <div
        className={cn(
          "relative overflow-hidden rounded-2xl",
          "bg-white",
          "ring-1 ring-slate-900/[0.06]",
          "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.10)]",
        )}
      >
        <ul className="divide-y divide-slate-100 px-4">
          {glanceItems.map((item, idx) => {
            const filled = clampLevel(item.level);
            const hasLevel = filled > 0;
            const accentBg = ROW_ACCENT_COLORS[idx % ROW_ACCENT_COLORS.length];
            return (
              <li
                key={item.label}
                className="flex items-center justify-between gap-4 py-2.5"
              >
                <span className="flex items-center gap-2.5">
                  <span aria-hidden className={cn("h-1.5 w-1.5 flex-shrink-0 rounded-full", accentBg)} />
                  <span className="text-[13.5px] font-medium tracking-[-0.005em] text-slate-900">
                    {item.label}
                  </span>
                </span>

                {hasLevel ? (
                  <span
                    className="flex items-center gap-1"
                    role="img"
                    aria-label={`${item.value} (${filled}/${MAX_LEVEL})`}
                  >
                    {Array.from({ length: MAX_LEVEL }, (_, i) => {
                      const isFilled = i < filled;
                      return (
                        <span
                          key={i}
                          aria-hidden
                          className={
                            isFilled
                              ? cn("h-[6px] w-[6px] rounded-full", accentBg)
                              : "h-[6px] w-[6px] rounded-full bg-slate-200"
                          }
                        />
                      );
                    })}
                  </span>
                ) : (
                  <span className="text-[12px] font-medium tracking-[0.02em] text-slate-500">
                    {item.value}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
