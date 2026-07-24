/**
 * @jest-environment node
 *
 * 3.3% 원천징수 + 서식 빌더 — kursoflow(`src/lib/tax/__tests__/withholding.test.ts`)
 * 테스트 벡터를 **그대로** 가져온 것이다(vitest → jest 어댑트 + xlsx 케이스 제외).
 *
 * 이 벡터들이 초록인 한 두 시스템은 같은 지급건에 대해 원 단위까지 같은 세액을
 * 낸다. 산식을 "정리"하고 싶어질 때 여기가 막는다.
 */
import { computeWithholding, sumWithholdings } from '../withholding';
import {
  aoaToCsv,
  buildAnnualStatementAoa,
  buildSimplifiedStatementAoa,
  buildWithholdingReportAoa,
  buildIncomeReceiptAoa,
  buildMonthlyForm,
  csvWithBom,
  renderFormHtml,
  UTF8_BOM,
  TOURISM_GUIDE_BUSINESS_CODE,
  type WithholdingFormInput,
} from '../forms';

describe('computeWithholding (사업소득 3.3%)', () => {
  it('round number: 1,000,000 → 30,000 / 3,000 / net 967,000', () => {
    expect(computeWithholding(1_000_000)).toEqual({
      gross: 1_000_000, incomeTax: 30_000, localIncomeTax: 3_000, totalWithheld: 33_000, net: 967_000,
    });
  });

  it('절사: 1,234,567 → 37,037 / 3,703 / net 1,193,827 (원단위 버림)', () => {
    expect(computeWithholding(1_234_567)).toEqual({
      gross: 1_234_567, incomeTax: 37_037, localIncomeTax: 3_703, totalWithheld: 40_740, net: 1_193_827,
    });
  });

  it('지방소득세는 소득세의 10%를 절사 (지급액×0.3%가 아님)', () => {
    // 333,333 × 3% = 9,999.99 → 9,999 소득세; × 10% = 999.9 → 999 지방세
    const w = computeWithholding(333_333);
    expect(w.incomeTax).toBe(9_999);
    expect(w.localIncomeTax).toBe(999);
  });

  it('handles 0, negative, and NaN as zero', () => {
    expect(computeWithholding(0).totalWithheld).toBe(0);
    expect(computeWithholding(-500).gross).toBe(0);
    expect(computeWithholding(Number.NaN).gross).toBe(0);
  });

  it('sumWithholdings aggregates counts and amounts', () => {
    const s = sumWithholdings([computeWithholding(1_000_000), computeWithholding(500_000)]);
    expect(s).toMatchObject({ count: 2, gross: 1_500_000, incomeTax: 45_000, localIncomeTax: 4_500 });
  });
});

describe('computeWithholding — 경계값 (이 저장소 추가분)', () => {
  it('1원은 세액 0이지만 소액부징수 예외가 아니라 그냥 절사 결과다', () => {
    // 사업소득은 소액부징수(§86) 대상이 아니므로 "면제"가 아니라 floor(0.03) = 0.
    expect(computeWithholding(1)).toEqual({
      gross: 1, incomeTax: 0, localIncomeTax: 0, totalWithheld: 0, net: 1,
    });
  });

  it('34원부터 소득세 1원이 붙고 지방세는 여전히 0이다', () => {
    expect(computeWithholding(33).incomeTax).toBe(0);
    expect(computeWithholding(34).incomeTax).toBe(1);
    expect(computeWithholding(34).localIncomeTax).toBe(0);
  });

  it('소수 입력은 내림으로 정규화된다 (0.5원짜리 지급은 없다)', () => {
    expect(computeWithholding(1_000_000.99).gross).toBe(1_000_000);
    expect(computeWithholding(1_000_000.99).incomeTax).toBe(30_000);
  });

  it('항등식이 항상 성립한다 — DB CHECK와 같은 식', () => {
    for (const gross of [0, 1, 34, 999, 100_000, 333_333, 1_234_567, 9_999_999]) {
      const w = computeWithholding(gross);
      expect(w.incomeTax + w.localIncomeTax).toBe(w.totalWithheld);
      expect(w.gross - w.totalWithheld).toBe(w.net);
    }
  });

  it('빈 배열 합계는 전부 0이다', () => {
    expect(sumWithholdings([])).toEqual({
      count: 0, gross: 0, incomeTax: 0, localIncomeTax: 0, totalWithheld: 0, net: 0,
    });
  });
});

const SAMPLE: WithholdingFormInput = {
  year: 2026,
  month: 5,
  payer: {
    businessRegistrationNumber: '123-45-67890',
    businessName: 'AtoC Korea',
    representativeName: '홍길동',
    businessAddress: '서울시',
    businessContact: '02-000-0000',
    businessTypeCode: TOURISM_GUIDE_BUSINESS_CODE,
  },
  people: [
    { name: '김가이드', residentNumber: '900101-1234567', gross: 1_000_000 },
    { name: '이가이드', residentNumber: null, gross: 500_000 },
  ],
};

describe('간이지급명세서 form (Form B — 지급액만, spec §3)', () => {
  const aoa = buildSimplifiedStatementAoa(SAMPLE);

  it('has 지급액 but NO 세액 columns (간이지급명세서 reports 지급액 only)', () => {
    expect(aoa[0]).toContain('성명');
    expect(aoa[0]).toContain('주민등록번호');
    expect(aoa[0]).toContain('지급액');
    expect(aoa[0]).not.toContain('소득세(3%)');
    expect(aoa[0]).not.toContain('지방소득세(0.3%)');
    expect(aoa[0]).not.toContain('실지급액');
  });

  it('fills a per-person row with 지급액 (no tax)', () => {
    expect(aoa[1]).toEqual([1, '김가이드', '900101-1234567', '202605', '202605', '사업소득', '940927', 1_000_000]);
  });

  it('leaves 주민번호 blank when not on file', () => {
    expect(aoa[2][2]).toBe('');
  });

  it('appends a 합계 row with the total 지급액', () => {
    const last = aoa[aoa.length - 1];
    expect(last[0]).toBe('합계');
    expect(last[7]).toBe(1_500_000); // 총지급액
  });
});

describe('원천징수이행상황신고서 form (Form A — 소득세만, spec §2)', () => {
  const aoa = buildWithholdingReportAoa(SAMPLE);
  const flat = aoa.map((r) => r.join('|'));

  it('includes the payer business registration number', () => {
    expect(flat.some((r) => r.includes('123-45-67890'))).toBe(true);
  });

  it('has the A25 line with 인원/총지급액/소득세(국세, no 지방소득세 column)', () => {
    const a25 = aoa.find((r) => String(r[0]).startsWith('A25'));
    // 코드 · ④인원 · ⑤총지급액 · ⑥소득세 · ⑦농특 · ⑧가산 · ⑨조정 · ⑩납부(소득세)
    expect(a25).toEqual(['A25 사업소득(매월징수)', 2, 1_500_000, 45_000, 0, 0, 0, 45_000]);
  });

  it('has A30 가감계 and A99 총합계 rows', () => {
    expect(aoa.some((r) => String(r[0]).startsWith('A30'))).toBe(true);
    expect(aoa.some((r) => String(r[0]).startsWith('A99'))).toBe(true);
  });

  it('files 지방소득세 separately (위택스), not inside the 명세 table', () => {
    expect(flat.some((r) => r.includes('위택스'))).toBe(true);
  });

  it('carries no 주민등록번호 at all (집계 서식이라 소득자 행이 없다)', () => {
    expect(flat.join('\n')).not.toContain('900101');
    expect(buildMonthlyForm('withholding-report', SAMPLE).carriesPii).toBe(false);
  });
});

describe('사업소득 지급명세서/원천징수영수증 (Form C — 별지 제23호서식(3), spec §4)', () => {
  const aoa = buildIncomeReceiptAoa(SAMPLE);
  const flat = aoa.map((r) => r.join('|'));

  it('carries the 업종코드 and tax columns', () => {
    const header = aoa.find((r) => r.includes('⑫지급총액'));
    expect(header).toBeTruthy();
    expect(header).toContain('⑭소득세');
    expect(header).toContain('⑮지방소득세');
  });

  it('a per-person row has gross + component-floor tax', () => {
    const row = aoa.find((r) => r[0] === '김가이드');
    expect(row).toEqual(['김가이드', '900101-1234567', '940927', '202605', '202605', 1_000_000, '3%', 30_000, 3_000, 33_000]);
  });

  it('총합계 equals the sum of per-person 지급총액 (작성원칙 일치)', () => {
    const total = aoa.find((r) => r[0] === '합계');
    expect(total?.[5]).toBe(1_500_000);
    expect(flat.some((r) => r.includes('123-45-67890'))).toBe(true);
  });
});

describe('연간 지급명세서 (Form D)', () => {
  const aoa = buildAnnualStatementAoa({
    year: 2026,
    payer: SAMPLE.payer,
    people: [
      {
        name: '김가이드',
        residentNumber: '900101-1234567',
        months: [
          { period: '2026-05', gross: 333_333 },
          { period: '2026-06', gross: 333_333 },
        ],
      },
    ],
  });

  it('sums the per-month floored tax instead of re-applying 3% to the annual total', () => {
    // 월별: floor(333,333×3%) = 9,999 × 2 = 19,998.
    // 연 총액 666,666에 3%를 다시 곱하면 19,999 → 매월 신고분과 1원 어긋난다.
    const row = aoa.find((r) => r[1] === '김가이드');
    expect(row?.[7]).toBe(666_666); // 연간 총지급액
    expect(row?.[8]).toBe(19_998); // 소득세(월별 절사 합)
    expect(row?.[9]).toBe(1_998); // 지방소득세
    expect(Math.floor((666_666 * 3) / 100)).toBe(19_999); // ← 쓰면 안 되는 값
  });

  it('총계 row matches the per-person rows (작성원칙)', () => {
    const total = aoa[aoa.length - 1];
    expect(total[0]).toBe('합계');
    expect(total[7]).toBe(666_666);
    expect(total[6]).toBe(2); // 연간 지급건수
  });
});

describe('출력 — CSV / HTML', () => {
  it('csv quotes cells containing commas', () => {
    const csv = aoaToCsv([['a,b', 'c'], [1, 2]]);
    expect(csv.split('\r\n')[0]).toBe('"a,b",c');
  });

  it('prepends a UTF-8 BOM so Excel does not mangle Korean names', () => {
    const csv = csvWithBom(buildMonthlyForm('simplified', SAMPLE));
    expect(csv.startsWith(UTF8_BOM)).toBe(true);
    expect(csv.codePointAt(0)).toBe(0xfeff);
    expect(csv).toContain('김가이드');
    expect(csv).toContain('940927');
  });

  it('renders an escaped HTML table with the right header row', () => {
    const doc = buildMonthlyForm('withholding-report', SAMPLE);
    const html = renderFormHtml(doc);
    // Form A의 헤더는 '코드' 행이다 — ①귀속연월 행이 아니다(휴리스틱 오인 방지).
    expect(html).toContain('<th>코드</th>');
    expect(html).not.toContain('<th>①귀속연월</th>');
  });

  it('escapes user-supplied names before they reach dangerouslySetInnerHTML', () => {
    const html = renderFormHtml(
      buildMonthlyForm('simplified', {
        ...SAMPLE,
        people: [{ name: '<script>alert(1)</script>', residentNumber: null, gross: 1 }],
      }),
    );
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
