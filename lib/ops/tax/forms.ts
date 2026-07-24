/**
 * 한국 사업소득 원천징수 서식 데이터 빌더 — AtoC 통합 플랜 §6.9.
 *
 * kursoflow(`src/lib/tax/forms.ts` + `docs/tax-forms-spec.md`)의 검증된 서식
 * 구조를 포팅했다. 바뀐 것은 두 가지뿐이다:
 *   1. **xlsx 의존성을 뺐다**(신규 npm 의존성 금지). 출력은 ①인쇄 뷰용 HTML
 *      조각과 ②홈택스 업로드/세무사 검수용 CSV(UTF-8 BOM) 두 가지다.
 *   2. 연간 지급명세서(Form D)를 추가했다 — 월 서식만으로는 다음 해 3월 10일
 *      제출 항목을 만들 수 없다.
 *
 * 여기 있는 함수는 전부 **순수**하다. 복호화·조회·감사로그는 라우트가 하고,
 * 이 파일은 이미 평문이 된 값을 표로 조립할 뿐이다.
 *
 * 🔴 D10: 어떤 함수도 제출하지 않는다. 서식은 생성·검증·보관까지다.
 *
 * 서식 4종 (spec §2~§5):
 *   A. 원천징수이행상황신고서 (별지 제21호서식, 코드 A25/A30/A99) — 월, 세액 집계
 *   B. 간이지급명세서(거주자의 사업소득) (별지 제24호의4(2)) — 월, **지급액만**
 *   C. 거주자의 사업소득 지급명세서 / 원천징수영수증 (별지 제23호서식(3)) — 세액 포함
 *   D. 지급명세서(연간) — 홈택스 업로드용 CSV
 */

import { computeWithholding, sumWithholdings } from './withholding';

/**
 * 업종코드 — 관광통역안내사. **940916이 아니다**(940916 ≠ 관광통역, kursoflow
 * 확정 사항). 940909(기타자영업)는 무자격 프리랜서용 폴백이고, 우리 가이드는
 * 940927이 맞다.
 */
export const TOURISM_GUIDE_BUSINESS_CODE = '940927';

/** Excel이 한글 CSV를 깨뜨리지 않게 하는 유일한 장치. 항상 선두에 붙인다. */
export const UTF8_BOM = '\uFEFF';

export const TAX_FORM_KEYS = ['withholding-report', 'simplified', 'receipt', 'annual'] as const;
export type TaxFormKey = (typeof TAX_FORM_KEYS)[number];

export const TAX_FORM_LABELS: Record<TaxFormKey, string> = {
  'withholding-report': '원천징수이행상황신고서',
  simplified: '간이지급명세서(거주자 사업소득)',
  receipt: '사업소득 원천징수영수증 · 지급명세서',
  annual: '사업소득 지급명세서(연간)',
};

/** 소득자 행에 주민등록번호가 실리는 서식 = 복호화가 필요한 서식. */
export const TAX_FORMS_WITH_PII: TaxFormKey[] = ['simplified', 'receipt', 'annual'];

export function isTaxFormKey(value: unknown): value is TaxFormKey {
  return typeof value === 'string' && (TAX_FORM_KEYS as readonly string[]).includes(value);
}

export interface PayerInfo {
  businessRegistrationNumber: string | null;
  businessName: string | null;
  representativeName: string | null;
  businessAddress: string | null;
  businessContact: string | null;
  businessTypeCode: string | null;
}

export interface WithholdingPerson {
  name: string;
  /** 복호화된 주민등록번호, 또는 미보유/키 부재 시 null. */
  residentNumber: string | null;
  gross: number;
}

export interface WithholdingFormInput {
  year: number;
  month: number;
  payer: PayerInfo;
  people: WithholdingPerson[];
}

/** 연간 서식 입력 — 소득자별 월 내역이 필요하다(작성원칙: 합계 일치). */
export interface AnnualPerson {
  name: string;
  residentNumber: string | null;
  /** 'YYYY-MM' → 그 달의 지급액(용역대가). */
  months: Array<{ period: string; gross: number }>;
}

export interface AnnualFormInput {
  year: number;
  payer: PayerInfo;
  people: AnnualPerson[];
}

export type Cell = string | number;
export type Aoa = Cell[][];

function periodYm(year: number, month: number): string {
  return `${year}${String(month).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Form B — 간이지급명세서(거주자의 사업소득)
// ---------------------------------------------------------------------------

/**
 * 지급액 중심: **세액 컬럼이 없다**(소득세/지방소득세는 Form A 집계 + Form C·D에만;
 * spec §3). 컬럼을 더 넣고 싶은 유혹이 있지만 서식에 없는 칸을 만들면 검수에서
 * 되돌아온다.
 */
export function buildSimplifiedStatementAoa(input: WithholdingFormInput): Aoa {
  const ym = periodYm(input.year, input.month);
  const code = input.payer.businessTypeCode ?? '';
  const header: Cell[] = [
    '일련번호', '성명', '주민등록번호', '귀속연월', '지급월', '소득구분', '업종코드', '지급액',
  ];
  const rows: Aoa = input.people.map((p, i) => [
    i + 1, p.name, p.residentNumber ?? '', ym, ym, '사업소득', code, p.gross,
  ]);
  const totalGross = input.people.reduce((s, p) => s + p.gross, 0);
  rows.push(['합계', `${input.people.length}명`, '', '', '', '', '', totalGross]);
  return [header, ...rows];
}

// ---------------------------------------------------------------------------
// Form A — 원천징수이행상황신고서
// ---------------------------------------------------------------------------

/**
 * ⑥소득세 등은 **소득세(국세)만**이다. 지방소득세는 위택스 특별징수분으로 별도
 * 납부하므로 명세 테이블에 넣지 않고 하단에 분리 표기한다(spec §2).
 * 코드 A25(매월징수) / A30(가감계) / A99(총합계).
 */
export function buildWithholdingReportAoa(input: WithholdingFormInput): Aoa {
  const totals = sumWithholdings(input.people.map((p) => computeWithholding(p.gross)));
  const ym = periodYm(input.year, input.month);
  // 명세 행: 코드 · ④인원 · ⑤총지급액 · ⑥소득세 등(국세) · ⑦농특세 · ⑧가산세 · ⑨당월조정환급 · ⑩납부세액(소득세)
  const detailRow = (code: string): Cell[] => [
    code, totals.count, totals.gross, totals.incomeTax, 0, 0, 0, totals.incomeTax,
  ];
  return [
    ['원천징수이행상황신고서 (별지 제21호서식)'],
    ['①귀속연월', ym, '②지급연월', ym],
    [],
    ['[원천징수의무자]'],
    ['사업자등록번호', input.payer.businessRegistrationNumber ?? ''],
    ['상호(법인명)', input.payer.businessName ?? ''],
    ['대표자', input.payer.representativeName ?? ''],
    ['소재지', input.payer.businessAddress ?? ''],
    ['전화', input.payer.businessContact ?? ''],
    [],
    ['[원천징수 명세 및 납부세액] — ⑥소득세는 국세(소득세)만'],
    ['코드', '④인원', '⑤총지급액', '⑥소득세 등', '⑦농어촌특별세', '⑧가산세', '⑨당월조정환급', '⑩납부세액(소득세)'],
    detailRow('A25 사업소득(매월징수)'),
    detailRow('A30 사업소득(가감계)'),
    detailRow('A99 총합계'),
    [],
    ['납부할 소득세 (국세 · 홈택스)', totals.incomeTax],
    ['납부할 지방소득세 (위택스 특별징수 · 별도신고)', totals.localIncomeTax],
    ['※ 지방소득세는 본 서식에 포함하지 않고 위택스로 별도 신고·납부합니다.'],
  ];
}

// ---------------------------------------------------------------------------
// Form C — 거주자의 사업소득 지급명세서 / 원천징수영수증
// ---------------------------------------------------------------------------

/**
 * 별지 제23호서식(3). 지급명세서는 연간(다음 해 3.10) 제출이고 원천징수영수증은
 * 소득자 교부용이다 — 같은 서식의 용도별 이본이라 여기서는 해당 귀속월 데이터를
 * 소득자별로 출력한다(연간 누적은 Form D). 세액 컬럼 포함(spec §4).
 */
export function buildIncomeReceiptAoa(input: WithholdingFormInput): Aoa {
  const ym = periodYm(input.year, input.month);
  const code = input.payer.businessTypeCode ?? '';
  const totals = sumWithholdings(input.people.map((p) => computeWithholding(p.gross)));
  const header: Cell[] = [
    '⑥성명', '⑦주민등록번호', '⑪업종코드', '귀속연월', '지급연월',
    '⑫지급총액', '⑬세율', '⑭소득세', '⑮지방소득세', '계(원천징수)',
  ];
  const rows: Aoa = input.people.map((p) => {
    const w = computeWithholding(p.gross);
    return [
      p.name, p.residentNumber ?? '', code, ym, ym,
      w.gross, '3%', w.incomeTax, w.localIncomeTax, w.incomeTax + w.localIncomeTax,
    ];
  });
  rows.push([
    '합계', `${input.people.length}명`, '', '', '',
    totals.gross, '', totals.incomeTax, totals.localIncomeTax, totals.incomeTax + totals.localIncomeTax,
  ]);
  return [
    ['거주자의 사업소득 지급명세서 · 원천징수영수증 (별지 제23호서식(3))'],
    ['용도', '발행자 보고용(지급명세서) / 소득자 보관용(원천징수영수증)'],
    [],
    ['[징수의무자]'],
    ['①사업자등록번호', input.payer.businessRegistrationNumber ?? '', '②법인명(상호)', input.payer.businessName ?? ''],
    ['③대표자', input.payer.representativeName ?? '', '④소재지', input.payer.businessAddress ?? ''],
    ['⑤전화', input.payer.businessContact ?? ''],
    [],
    ['[소득자별 지급 및 원천징수 명세] — 거주자 / 내국인'],
    header,
    ...rows,
  ];
}

// ---------------------------------------------------------------------------
// Form D — 지급명세서(연간). 홈택스 업로드용 평문 데이터.
// ---------------------------------------------------------------------------

/**
 * 소득자 1명 = 1행(연간 합계) + 월별 지급건수. 작성원칙(spec §4)이 요구하는
 * "연간 총지급액 계 = 소득자별 연간소득내용 합계" 일치를 구조적으로 보장하려고
 * 합계를 다시 곱하지 않고 월 값의 합으로만 만든다.
 */
export function buildAnnualStatementAoa(input: AnnualFormInput): Aoa {
  const code = input.payer.businessTypeCode ?? '';
  const header: Cell[] = [
    '일련번호', '성명', '주민등록번호', '귀속연도', '업종코드', '소득구분',
    '연간 지급건수', '연간 총지급액', '소득세', '지방소득세', '원천징수 계',
  ];

  let sumGross = 0;
  let sumIncomeTax = 0;
  let sumLocalTax = 0;
  const rows: Aoa = input.people.map((p, i) => {
    // 월별로 절사한 세액의 합 — 연간 총액에 3%를 다시 곱하면 매월 신고한 값과
    // 원 단위로 어긋난다(절사 지점이 다르다). 월 세액을 더하는 것이 정답이다.
    const monthly = p.months.map((m) => computeWithholding(m.gross));
    const totals = sumWithholdings(monthly);
    sumGross += totals.gross;
    sumIncomeTax += totals.incomeTax;
    sumLocalTax += totals.localIncomeTax;
    return [
      i + 1, p.name, p.residentNumber ?? '', String(input.year), code, '사업소득',
      p.months.length, totals.gross, totals.incomeTax, totals.localIncomeTax,
      totals.incomeTax + totals.localIncomeTax,
    ];
  });

  rows.push([
    '합계', `${input.people.length}명`, '', String(input.year), '', '',
    input.people.reduce((s, p) => s + p.months.length, 0),
    sumGross, sumIncomeTax, sumLocalTax, sumIncomeTax + sumLocalTax,
  ]);

  return [header, ...rows];
}

// ---------------------------------------------------------------------------
// 문서 조립 (라우트 · 인쇄 뷰의 단일 진입점)
// ---------------------------------------------------------------------------

export interface TaxFormDoc {
  key: TaxFormKey;
  title: string;
  /** 'YYYY-MM' 또는 연간 서식의 'YYYY'. */
  period: string;
  aoa: Aoa;
  /**
   * 표 헤더 행의 인덱스. 휴리스틱(“전부 문자열이면 헤더”)으로 찾으면 Form A의
   * `['①귀속연월', ym, '②지급연월', ym]`이 헤더로 오인된다 — 그래서 빌더가
   * 명시적으로 알려준다. 헤더가 없는 서식은 -1.
   */
  headerRowIndex: number;
  /** 서식 하단 고지 — 제출기한·가산세·업종코드 같은 사람이 알아야 할 사실. */
  notes: string[];
  /** 소득자 행에 주민번호 평문이 들어 있는가(응답 처리 분기용). */
  carriesPii: boolean;
}

const NOTES: Record<TaxFormKey, string[]> = {
  'withholding-report': [
    '제출기한: 지급일이 속하는 달의 다음 달 10일 (반기납부자는 반기 다음 달 10일).',
    '⑥소득세 등은 국세(소득세)만입니다. 지방소득세는 위택스 특별징수분으로 별도 신고·납부합니다.',
  ],
  simplified: [
    '제출기한: 지급일이 속하는 달의 다음 달 말일 (인적용역 사업소득은 매월 제출).',
    '미제출·불분명 가산세: 미제출금액 × 0.25% (기한 경과 후 1개월 이내 제출 시 0.125%).',
    '간이지급명세서에는 세액 컬럼이 없습니다 — 지급액만 보고합니다.',
  ],
  receipt: [
    '원천징수영수증은 소득자(가이드) 교부용, 지급명세서는 발행자 보고용입니다.',
    '지급명세서(연간) 제출기한: 지급연도 다음 해 3월 10일.',
  ],
  annual: [
    '제출기한: 지급연도 다음 해 3월 10일. 홈택스 업로드용 CSV(UTF-8 BOM)입니다.',
    '연간 총지급액은 월별 절사 세액의 합입니다 — 연 총액에 3%를 다시 곱하지 않습니다.',
  ],
};

const BUSINESS_CODE_NOTE = `업종코드 ${TOURISM_GUIDE_BUSINESS_CODE} = 관광통역안내사 (940916 아님).`;

/** AoA에서 특정 라벨로 시작하는 행의 인덱스. 없으면 -1. */
function rowIndexStartingWith(aoa: Aoa, label: string): number {
  return aoa.findIndex((row) => row[0] === label);
}

/** 월 서식 3종. */
export function buildMonthlyForm(key: Exclude<TaxFormKey, 'annual'>, input: WithholdingFormInput): TaxFormDoc {
  const aoa =
    key === 'withholding-report'
      ? buildWithholdingReportAoa(input)
      : key === 'simplified'
        ? buildSimplifiedStatementAoa(input)
        : buildIncomeReceiptAoa(input);
  const headerRowIndex =
    key === 'withholding-report'
      ? rowIndexStartingWith(aoa, '코드')
      : key === 'simplified'
        ? 0
        : rowIndexStartingWith(aoa, '⑥성명');
  return {
    key,
    title: TAX_FORM_LABELS[key],
    period: `${input.year}-${String(input.month).padStart(2, '0')}`,
    aoa,
    headerRowIndex,
    notes: [...NOTES[key], BUSINESS_CODE_NOTE],
    carriesPii: TAX_FORMS_WITH_PII.includes(key),
  };
}

/** 연간 서식. */
export function buildAnnualForm(input: AnnualFormInput): TaxFormDoc {
  return {
    key: 'annual',
    title: TAX_FORM_LABELS.annual,
    period: String(input.year),
    aoa: buildAnnualStatementAoa(input),
    headerRowIndex: 0,
    notes: [...NOTES.annual, BUSINESS_CODE_NOTE],
    carriesPii: true,
  };
}

// ---------------------------------------------------------------------------
// 출력 — CSV / HTML
// ---------------------------------------------------------------------------

/** RFC-4180-ish CSV. BOM은 `csvWithBom`이 붙인다. */
export function aoaToCsv(aoa: Aoa): string {
  return aoa
    .map((row) =>
      row
        .map((cell) => {
          const s = String(cell ?? '');
          return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(','),
    )
    .join('\r\n');
}

/**
 * 홈택스 업로드·엑셀 열람용 CSV. BOM이 없으면 엑셀이 한글을 깨뜨리고, 그 파일을
 * 그대로 업로드하면 소득자 이름이 전부 깨진 채 제출된다 — 그래서 옵션이 아니다.
 */
export function csvWithBom(doc: TaxFormDoc): string {
  const meta: Aoa = [[doc.title], [`대상 기간`, doc.period], []];
  const footer: Aoa = [[], ...doc.notes.map((n) => [`※ ${n}`] as Cell[])];
  return UTF8_BOM + aoaToCsv([...meta, ...doc.aoa, ...footer]);
}

/** 다운로드 파일명 — 한글 파일명은 헤더 인코딩이 번거로워 ASCII로 만든다. */
export function csvFilename(doc: TaxFormDoc): string {
  return `atockorea-${doc.key}-${doc.period}.csv`;
}

function escapeHtml(value: Cell): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 인쇄 뷰에 꽂을 HTML 조각(<table> 한 덩어리). 문서 크롬(DRAFT 워터마크·인쇄
 * 버튼·A4 조판)은 `components/admin/ops-finance/DocumentChrome`이 이미 갖고 있어서
 * 여기서는 표만 만든다.
 *
 * 모든 셀을 이스케이프한다 — 소득자 이름은 사람이 입력한 값이고, 이 조각은
 * dangerouslySetInnerHTML로 들어간다.
 */
export function renderFormHtml(doc: TaxFormDoc): string {
  const rows = doc.aoa;
  const width = rows.reduce((max, r) => Math.max(max, r.length), 1);
  const headerIndex = doc.headerRowIndex;

  const body = rows
    .map((row, i) => {
      if (row.length === 0) return '<tr class="tf-spacer"><td colspan="' + width + '">&nbsp;</td></tr>';
      const isHeader = i === headerIndex;
      const tag = isHeader ? 'th' : 'td';
      const cells = row
        .map((cell, j) => {
          const numeric = typeof cell === 'number';
          const span = row.length === 1 ? ` colspan="${width}"` : '';
          const cls = numeric ? ' class="tf-num"' : j === 0 && !isHeader ? ' class="tf-label"' : '';
          const text = numeric ? cell.toLocaleString('ko-KR') : escapeHtml(cell);
          return `<${tag}${span}${cls}>${text}</${tag}>`;
        })
        .join('');
      return `<tr${isHeader ? ' class="tf-head"' : ''}>${cells}</tr>`;
    })
    .join('');

  const notes = doc.notes.map((n) => `<li>${escapeHtml(n)}</li>`).join('');

  return [
    '<div class="tf-doc">',
    `<h2 class="tf-title">${escapeHtml(doc.title)}</h2>`,
    `<p class="tf-period">대상 기간 ${escapeHtml(doc.period)}</p>`,
    `<table class="tf-table"><tbody>${body}</tbody></table>`,
    notes ? `<ul class="tf-notes">${notes}</ul>` : '',
    '</div>',
  ].join('');
}

/** 인쇄 뷰가 주입하는 표 스타일. DocumentChrome의 @media print와 함께 쓰인다. */
export const TAX_FORM_CSS = `
.tf-doc { font-size: 12px; color: #171717; }
.tf-title { font-size: 15px; font-weight: 700; margin: 0 0 2px; }
.tf-period { font-size: 11px; color: #737373; margin: 0 0 12px; font-variant-numeric: tabular-nums; }
.tf-table { width: 100%; border-collapse: collapse; }
.tf-table td, .tf-table th { border: 1px solid #e5e5e5; padding: 4px 6px; text-align: left; vertical-align: top; }
.tf-table th { background: #fafafa; font-weight: 700; font-size: 11px; }
.tf-table .tf-num { text-align: right; font-variant-numeric: tabular-nums; }
.tf-table .tf-label { font-weight: 600; }
.tf-table .tf-spacer td { border: 0; padding: 3px 0; }
.tf-notes { margin: 12px 0 0; padding-left: 16px; font-size: 10px; color: #737373; line-height: 1.6; }
`;
