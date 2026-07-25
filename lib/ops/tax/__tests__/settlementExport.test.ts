/**
 * 정산 내보내기 표 + 세무 서식의 xlsx 시트 — 관제 W6.
 *
 * 두 가지를 지킨다:
 *   1. **이체용 표에는 주민번호가 없다.** 은행 화면 옆에 놓는 파일에 평문 주민번호가
 *      들어가면, 그 파일은 메신저·메일·USB로 돌아다니는 순간 사고가 된다.
 *   2. **서식 시트의 헤더 위치가 표제 행 수와 함께 움직인다.** 어긋나면 굵은
 *      헤더가 엉뚱한 줄에 붙어 세무사 검수에서 되돌아온다.
 */

import { settlementSheets, SETTLEMENT_STATUS_LABEL, type GuideIdentityLite } from '../settlementExport';
import type { GuideSettlementRow } from '../settlement';
import { buildMonthlyForm, taxFormSheets, XLSX_TITLE_ROWS, TOURISM_GUIDE_BUSINESS_CODE } from '../forms';

function row(over: Partial<GuideSettlementRow> = {}): GuideSettlementRow {
  return {
    id: 's-1',
    tenant_id: 'atockorea',
    guide_id: 'g-1',
    period: '2026-08',
    gross_krw: 1_000_000,
    income_tax_krw: 30_000,
    local_tax_krw: 3_000,
    withheld_krw: 33_000,
    net_krw: 967_000,
    reimbursement_krw: 50_000,
    payout_krw: 1_017_000,
    assignment_count: 5,
    status: 'draft',
    paid_at: null,
    paid_note: null,
    ...over,
  };
}

const identities = new Map<string, GuideIdentityLite>([
  ['g-1', { name: '김가이드', bankName: '국민', bankHolder: '김가이드', bankAccountMasked: '••••1234' }],
  ['g-2', { name: '박가이드', bankName: '신한', bankHolder: '박가이드', bankAccountMasked: '••••5678' }],
]);

describe('settlementSheets', () => {
  it('has no resident-number column and no resident-number-shaped value', () => {
    const sheets = settlementSheets('2026-08', [row()], identities);
    // 헤더에 그 칸이 아예 없어야 한다. (합계 시트의 "주민등록번호는 포함하지
    // 않습니다" 안내문은 사람에게 주는 말이므로 문자열 검색으로 잡으면 안 된다.)
    expect(sheets[0].rows[0]).not.toContain('주민등록번호');
    expect(JSON.stringify(sheets)).not.toMatch(/\d{6}-\d{7}/);
  });

  it('keeps the totals on their own sheet so sorting the detail cannot break them', () => {
    const sheets = settlementSheets('2026-08', [row(), row({ id: 's-2', guide_id: 'g-2' })], identities);
    expect(sheets).toHaveLength(2);
    expect(sheets[1].name).toBe('합계');
    const totals = new Map(sheets[1].rows.map((r) => [r[0], r[1]]));
    expect(totals.get('지급액 합계(용역대가)')).toBe(2_000_000);
    expect(totals.get('원천징수 합계')).toBe(66_000);
    expect(totals.get('실지급액 합계')).toBe(2_034_000);
    expect(totals.get('대상 인원')).toBe(2);
  });

  it('sorts guides by name so two exports of the same month line up', () => {
    const sheets = settlementSheets(
      '2026-08',
      [row({ id: 's-2', guide_id: 'g-2' }), row()],
      identities,
    );
    expect(sheets[0].rows[1][0]).toBe('김가이드');
    expect(sheets[0].rows[2][0]).toBe('박가이드');
  });

  it('emits amounts as numbers so Excel can sum them', () => {
    const sheets = settlementSheets('2026-08', [row()], identities);
    const detail = sheets[0].rows[1];
    expect(typeof detail[5]).toBe('number');
    expect(typeof detail[11]).toBe('number');
  });

  it('falls back to a short id when the guide row is missing rather than showing blank', () => {
    const sheets = settlementSheets('2026-08', [row({ guide_id: 'deadbeef-0000' })], new Map());
    expect(sheets[0].rows[1][0]).toBe('deadbeef');
  });

  it('translates the status into Korean', () => {
    const sheets = settlementSheets('2026-08', [row({ status: 'paid', paid_at: '2026-09-05T02:00:00Z' })], identities);
    expect(sheets[0].rows[1][12]).toBe(SETTLEMENT_STATUS_LABEL.paid);
    expect(sheets[0].rows[1][13]).toBe('2026-09-05');
  });

  it('produces rectangular detail rows', () => {
    const sheets = settlementSheets('2026-08', [row(), row({ id: 's-2', guide_id: 'g-2' })], identities);
    expect(new Set(sheets[0].rows.map((r) => r.length)).size).toBe(1);
  });
});

describe('taxFormSheets', () => {
  const doc = buildMonthlyForm('simplified', {
    year: 2026,
    month: 8,
    payer: {
      businessRegistrationNumber: '277-01-03977',
      businessName: '에이투씨코리아',
      representativeName: null,
      businessAddress: null,
      businessContact: null,
      businessTypeCode: TOURISM_GUIDE_BUSINESS_CODE,
    },
    people: [{ name: '김가이드', residentNumber: '900101-1234567', gross: 1_000_000 }],
  });

  it('shifts the header index by exactly the number of title rows it added', () => {
    const sheets = taxFormSheets(doc);
    expect(sheets[0].headerRowIndex).toBe(doc.headerRowIndex + XLSX_TITLE_ROWS);
    // 그 자리에 실제로 헤더가 있어야 한다 — 인덱스만 맞고 내용이 어긋나면 소용없다.
    expect(sheets[0].rows[sheets[0].headerRowIndex][0]).toBe(doc.aoa[doc.headerRowIndex][0]);
  });

  it('moves the notices onto their own sheet so the table stays uploadable', () => {
    const sheets = taxFormSheets(doc);
    expect(sheets[1].name).toBe('안내');
    // 표 시트에는 ※ 고지 줄이 없어야 홈택스 업로드에 쓰레기 행이 섞이지 않는다.
    expect(JSON.stringify(sheets[0].rows)).not.toContain('제출기한');
    expect(JSON.stringify(sheets[1].rows)).toContain('제출기한');
  });

  it('marks the draft state inside the file, not only on screen', () => {
    const sheets = taxFormSheets(doc, { draft: true });
    expect(JSON.stringify(sheets[1].rows)).toContain('DRAFT');
    expect(JSON.stringify(taxFormSheets(doc, { draft: false }))).not.toContain('DRAFT');
  });

  it('keeps -1 when the form has no header row, rather than shifting it into a real row', () => {
    const headerless = { ...doc, headerRowIndex: -1 };
    expect(taxFormSheets(headerless)[0].headerRowIndex).toBe(-1);
  });
});
