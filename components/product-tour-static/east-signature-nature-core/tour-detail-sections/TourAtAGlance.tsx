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
        <h2 className="text-title text-foreground">
          {sectionUi.atAGlanceTitle}
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
          {sectionUi.atAGlanceSubtitle}
        </p>
      </div>

      {/*
       * 사용자 요청 (2026-05-18): spring seasonal rose gradient base + 메탈 느낌 추가.
       *   §B-P7 (Weather/Seasonal 4색 baseline) 정신 확장 — AtAGlance도 "첫인상 카드"로 같은 premium 색 다양성 적용.
       *   메탈 레이어 4중: (1) inner top white sheen (polished edge), (2) diagonal soft sheen (reflection),
       *   (3) bottom subtle rose darken (curve illusion), (4) hairline top edge highlight (polished metal edge).
       *   Shadow에 rose-pink tint 추가 (메탈 카드 floating feel).
       */}
      <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-50 via-white to-rose-100/50 ring-1 ring-rose-100/70 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_12px_-4px_rgba(15,23,42,0.10),0_10px_28px_-12px_rgba(244,114,182,0.22)] transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-[1px] hover:shadow-[0_2px_6px_rgba(15,23,42,0.06),0_10px_24px_-4px_rgba(15,23,42,0.12),0_18px_36px_-14px_rgba(244,114,182,0.32)]">
        {/* (1) Inner top white sheen — polished top edge */}
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/75 to-transparent" />
        {/* (2) Diagonal metallic sheen — soft reflection across surface */}
        <span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/35 via-transparent to-rose-200/12" />
        {/* (3) Bottom subtle rose shading — metal curve illusion */}
        <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-rose-200/18 to-transparent" />
        {/* (4) Top edge hairline highlight — polished metal edge */}
        <span aria-hidden className="pointer-events-none absolute top-0 inset-x-[8%] h-px bg-gradient-to-r from-transparent via-white/85 to-transparent" />
        <ul className="relative divide-y divide-rose-100/60 px-4">
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

                {/* metal chip — translucent white over rose bg + inner top highlight */}
                <span
                  className="inline-flex items-center rounded-full bg-white/85 px-2.5 py-1 text-[11.5px] font-bold tracking-wide text-slate-900 ring-1 ring-rose-200/60 shadow-[0_1px_1.5px_rgba(244,114,182,0.10),inset_0_1px_0_rgba(255,255,255,0.85)]"
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
