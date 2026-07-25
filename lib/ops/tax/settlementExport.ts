/**
 * 가이드 월 정산 내보내기 표 — 관제 W6/W7.
 *
 * 순수 함수. 세무 서식(`forms.ts`)이 **세무서에 내는 것**이라면 여기는 **회사가
 * 이체할 때 보는 것**이다. 그래서 컬럼이 다르다:
 *   · 서식에는 있고 여기엔 없는 것: 주민등록번호(이체에 불필요한 평문은 만들지 않는다)
 *   · 여기에만 있는 것: 은행·계좌 마스크·실지급액·상태 (실제로 돈을 보낼 때 보는 값)
 *
 * 두 장으로 나눈다. [지급 명세]는 사람이 은행 화면 옆에 놓고 보는 표이고,
 * [합계]는 그 표를 요약해 대사에 쓴다. 한 장에 합계 행을 섞으면 정렬·필터를
 * 걸 때마다 합계가 따라다니며 표를 망가뜨린다.
 */

import type { Aoa } from './forms';
import type { GuideSettlementRow } from './settlement';

export interface GuideIdentityLite {
  name: string;
  bankName: string | null;
  bankHolder: string | null;
  bankAccountMasked: string | null;
}

export const SETTLEMENT_STATUS_LABEL: Record<string, string> = {
  draft: '초안',
  confirmed: '확정',
  paid: '지급완료',
};

export interface SettlementSheetSpec {
  name: string;
  rows: Aoa;
  headerRowIndex: number;
}

export function settlementSheets(
  period: string,
  rows: GuideSettlementRow[],
  guideById: Map<string, GuideIdentityLite>,
): SettlementSheetSpec[] {
  const sorted = [...rows].sort((a, b) => {
    const an = guideById.get(a.guide_id)?.name ?? a.guide_id;
    const bn = guideById.get(b.guide_id)?.name ?? b.guide_id;
    return an.localeCompare(bn, 'ko');
  });

  const detail: Aoa = [
    [
      '성명', '은행', '예금주', '계좌(마스크)', '건수',
      '지급액(용역대가)', '소득세', '지방소득세', '원천징수 계', '차감후 지급액',
      '실비변상', '실지급액', '상태', '지급일',
    ],
    ...sorted.map((r) => {
      const g = guideById.get(r.guide_id);
      return [
        g?.name ?? r.guide_id.slice(0, 8),
        g?.bankName ?? '',
        g?.bankHolder ?? '',
        g?.bankAccountMasked ?? '',
        r.assignment_count,
        r.gross_krw,
        r.income_tax_krw,
        r.local_tax_krw,
        r.withheld_krw,
        r.net_krw,
        r.reimbursement_krw,
        r.payout_krw,
        SETTLEMENT_STATUS_LABEL[r.status] ?? r.status,
        r.paid_at ? r.paid_at.slice(0, 10) : '',
      ];
    }),
  ];

  const sum = (pick: (r: GuideSettlementRow) => number) => rows.reduce((s, r) => s + pick(r), 0);
  const summary: Aoa = [
    ['항목', '값'],
    ['대상 기간', period],
    ['대상 인원', rows.length],
    ['지급액 합계(용역대가)', sum((r) => r.gross_krw)],
    ['소득세 합계', sum((r) => r.income_tax_krw)],
    ['지방소득세 합계', sum((r) => r.local_tax_krw)],
    ['원천징수 합계', sum((r) => r.withheld_krw)],
    ['실비변상 합계', sum((r) => r.reimbursement_krw)],
    ['실지급액 합계', sum((r) => r.payout_krw)],
    [],
    ['납부처 안내', '소득세는 홈택스, 지방소득세는 위택스로 각각 신고·납부합니다.'],
    [
      '제출기한 안내',
      '원천세 신고·납부는 지급월의 다음 달 10일, 간이지급명세서는 다음 달 말일입니다.',
    ],
    ['⚠ 이 파일은', '이체·대사용 내부 자료입니다. 주민등록번호는 포함하지 않습니다.'],
  ];

  return [
    { name: `지급 명세 ${period}`, rows: detail, headerRowIndex: 0 },
    { name: '합계', rows: summary, headerRowIndex: 0 },
  ];
}
