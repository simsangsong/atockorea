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
          "relative overflow-hidden rounded-2xl ring-1",
          "bg-gradient-to-br from-[#fcf9f4] via-[#fefcf8] to-[#f8f4ec]",
          "ring-amber-100/40",
          "shadow-[0_2px_4px_rgba(26,35,50,0.05),0_6px_14px_-4px_rgba(26,35,50,0.08),0_22px_44px_-18px_rgba(26,35,50,0.22),0_12px_24px_-12px_rgba(26,35,50,0.14)]",
        )}
      >
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/65 to-transparent" />
        <ul className="relative divide-y divide-border/35 px-4 sm:px-5">
          {glanceItems.map((item, idx) => {
            const filled = clampLevel(item.level);
            const hasLevel = filled > 0;
            const accentBg = ROW_ACCENT_COLORS[idx % ROW_ACCENT_COLORS.length];
            return (
              <li
                key={item.label}
                className="flex items-center justify-between gap-4 py-3 sm:py-3.5"
              >
                <span className="flex items-center gap-2.5">
                  <span aria-hidden className={cn("h-1.5 w-1.5 flex-shrink-0 rounded-full", accentBg)} />
                  <span className="text-[14px] font-medium tracking-[-0.005em] text-foreground sm:text-[14.5px]">
                    {item.label}
                  </span>
                </span>

                {hasLevel ? (
                  <span
                    className="flex items-center gap-1.5"
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
                              ? cn("h-[7px] w-[7px] rounded-full", accentBg)
                              : "h-[7px] w-[7px] rounded-full border border-foreground/25 bg-transparent"
                          }
                        />
                      );
                    })}
                  </span>
                ) : (
                  <span className="text-[12px] font-medium tracking-[0.02em] text-muted-foreground">
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
