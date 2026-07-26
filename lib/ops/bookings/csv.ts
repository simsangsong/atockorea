/**
 * §K B1.6 — 통합 통계 CSV 내보내기. 순수부.
 *
 * 기존 세무 서식 패턴(`lib/ops/tax/forms.ts`)의 `aoaToCsv` + UTF-8 BOM을
 * 그대로 재사용한다 — BOM이 없으면 엑셀이 한글을 깨뜨린다. 같은 규칙을 두 번
 * 구현하면 한쪽만 고쳐지는 날이 온다(§H-4).
 *
 * 🔴 B1-D1 — 여기서도 티어를 합치지 않는다. `tier` 컬럼이 첫 번째이고,
 * 합계 행을 만들지 않는다. 스프레드시트에서 오너가 필터를 걸면 그게 곧
 * 티어별 뷰다 — 우리가 미리 더해 줄 이유가 없고, 더하면 거짓말이 된다.
 *
 * 🔴 B1-D5 — 화면은 이름을 마스킹하지만 **CSV는 마스킹하지 않는다.**
 * 내보내기는 오너가 명시적으로 누른 행동이고, 마스킹된 CSV는 연락·대조라는
 * 목적 자체를 잃는다. 대신 파일이 PII를 담는다는 사실을 헤더 주석에 적는다.
 */

import { aoaToCsv, UTF8_BOM } from '@/lib/ops/tax/forms';
import type { UnifiedRecord, UnifiedSummary } from './unified';

const TIER_LABEL: Record<UnifiedRecord['tier'], string> = {
  confirmed: '확정',
  pending_review: '확인대기',
  unparsed: '예약실패',
};

const GAP_LABEL: Record<string, string> = {
  no_room: '투어룸 없음',
  no_participant: '미입장',
  no_seat: '좌석 미배정',
};

export const UNIFIED_CSV_HEADERS = [
  '티어',
  '채널',
  '투어일',
  '유입일시',
  '이름',
  '인원',
  '룸상태',
  '비고',
] as const;

const META_NOTES = [
  ['※ 이 파일은 손님 이름을 포함합니다 — 취급에 주의하세요.'],
  ['※ 확정·확인대기·예약실패를 더한 숫자는 넣지 않았습니다 — 서로 다른 것이라 더하면 의미가 없습니다.'],
];

/** 상세 표(AoA). CSV와 xlsx가 같은 행을 쓴다 — 두 벌이면 반드시 어긋난다(§H-4). */
export function unifiedDetailAoa(records: UnifiedRecord[]): Array<Array<string | number>> {
  return [
    [...UNIFIED_CSV_HEADERS],
    ...records.map((r) => [
      TIER_LABEL[r.tier],
      r.channel,
      r.tourDate ?? '',
      r.createdAt ?? '',
      r.guestName ?? '',
      r.partySize > 0 ? r.partySize : '',
      r.roomGap ? GAP_LABEL[r.roomGap] ?? r.roomGap : '',
      r.reason ?? '',
    ]),
  ];
}

export function unifiedCsv(records: UnifiedRecord[], range: { from: string; to: string }): string {
  const meta = [
    ['AtoC 예약 통합 내역'],
    ['대상 기간', `${range.from} ~ ${range.to}`],
    ...META_NOTES,
    [],
  ];
  return UTF8_BOM + aoaToCsv([...meta, ...unifiedDetailAoa(records)]);
}

/**
 * §2-8 — 요약 시트(AoA).
 *
 * 🔴 B1-D1을 여기서도 지킨다: **합계 행을 만들지 않는다.** 확정·확인대기·
 * 예약실패는 서로 다른 것이라 더한 숫자는 아무 질문에도 답하지 못하고, 한 번
 * 스프레드시트에 찍히면 그 숫자가 인용되기 시작한다.
 */
export function unifiedSummaryAoa(
  summary: UnifiedSummary,
  range: { from: string; to: string },
): Array<Array<string | number>> {
  const rows: Array<Array<string | number>> = [
    ['항목', '값'],
    ['대상 기간', `${range.from} ~ ${range.to}`],
    [TIER_LABEL.confirmed, summary.counts.confirmed],
    [TIER_LABEL.pending_review, summary.counts.pending_review],
    [TIER_LABEL.unparsed, summary.counts.unparsed],
    ['확정 예약 인원', summary.confirmedGuests],
    [GAP_LABEL.no_room, summary.roomGaps.no_room],
    [GAP_LABEL.no_participant, summary.roomGaps.no_participant],
    [GAP_LABEL.no_seat, summary.roomGaps.no_seat],
    [],
    ['채널', '티어', '건수'],
  ];
  for (const row of summary.byChannel) {
    rows.push([row.channel, TIER_LABEL[row.tier], row.count]);
  }
  rows.push([], ...META_NOTES);
  return rows;
}

/** ASCII 파일명 — 한글 파일명은 Content-Disposition 인코딩이 번거롭다. */
export function unifiedCsvFilename(range: { from: string; to: string }): string {
  return `atockorea-bookings-${range.from}_${range.to}.csv`;
}

export function unifiedXlsxFilename(range: { from: string; to: string }): string {
  return `atockorea-bookings-${range.from}_${range.to}.xlsx`;
}
