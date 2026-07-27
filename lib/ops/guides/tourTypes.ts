/**
 * 배정·단가가 공유하는 투어 유형 값 (N2 후속, 2026-07-27).
 *
 * 이 문자열은 **정확 일치**로 단가를 찾는다(`resolveRate`: `r.tour_type ===
 * a.tour_type`). 즉 배정에 적은 값과 단가표에 적은 값이 한 글자라도 다르면
 * 단가가 안 잡히고 그 배정은 미해석(0원 + 보고)으로 정산에 올라간다.
 *
 * 그래서 목록이 두 벌이면 안 된다 — 배정 패널과 단가 패널이 각자 프리셋을
 * 들고 있었고, 한쪽에만 새 유형을 추가하면 다른 쪽 사람이 그 값을 직접 타야
 * 했다. 자동완성이 있는 자유 입력은 오타를 **막지 못한다.**
 *
 * 값 자체는 여전히 자유 입력이다(단가표와 같기만 하면 된다). 여기 있는 것은
 * 자동완성 목록이고, 새 상품이 생기면 여기 한 줄이다.
 */
export const TOUR_TYPE_PRESETS = [
  'private',
  'jeju_grand_highlights',
  'bus',
  'cruise',
  'walking',
] as const;

export type TourTypePreset = (typeof TOUR_TYPE_PRESETS)[number];

/** 운영자가 읽는 이름. 목록에 없으면 값을 그대로 보여준다(자유 입력이므로). */
export const TOUR_TYPE_LABELS: Record<string, string> = {
  private: '일반 프라이빗',
  jeju_grand_highlights: '제주 그랜드 하이라이트',
  bus: '버스',
  cruise: '크루즈',
  walking: '워킹',
};

export function tourTypeLabel(value: string): string {
  return TOUR_TYPE_LABELS[value] ?? value;
}
