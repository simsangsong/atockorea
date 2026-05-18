import type { EastSignatureNatureCoreDetailViewModel } from "../eastSignatureNatureCoreDetailViewModel";

const MAX_LEVEL = 5;

function clampLevel(level: number | undefined): number {
  if (typeof level !== "number" || !Number.isFinite(level)) return 0;
  return Math.max(0, Math.min(MAX_LEVEL, Math.round(level)));
}

export type TourAtAGlanceProps = Pick<EastSignatureNatureCoreDetailViewModel, "glanceItems" | "sectionUi">;

/*
 * Sprint 3.1 / §B §2.5 binding: 6색 무지개 dots → text pill.
 *   pill 디자인: bg-slate-50 + text-slate-900 + ring-slate-200 + font-bold tracking-wide
 *   (Klook/Booking pattern — 즉시 이해 가능한 텍스트, decoration 색 0)
 *   role-based radius (§1.3): rounded-[26px] → rounded-2xl (body card 12-16)
 *   left 6-color cycle dot 제거 — typography weight + spacing이 row 시작점 신호.
 */
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

      <div className="relative overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_12px_-2px_rgba(0,0,0,0.055)]">
        <ul className="divide-y divide-slate-100 px-4">
          {glanceItems.map((item) => {
            const filled = clampLevel(item.level);
            const hasLevel = filled > 0;
            return (
              <li
                key={item.label}
                className="flex items-center justify-between gap-4 py-3"
              >
                <span className="text-[13.5px] font-medium tracking-[-0.005em] text-slate-900">
                  {item.label}
                </span>

                <span
                  className="inline-flex items-center rounded-full bg-slate-50 px-2.5 py-1 text-[11.5px] font-bold tracking-wide text-slate-900 ring-1 ring-slate-200"
                  role={hasLevel ? "img" : undefined}
                  aria-label={hasLevel ? `${item.value} (${filled}/${MAX_LEVEL})` : undefined}
                >
                  {item.value}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
