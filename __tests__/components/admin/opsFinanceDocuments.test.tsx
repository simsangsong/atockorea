/**
 * 인쇄 문서 2종 렌더 (Phase 3 §6.4).
 *
 * PDF 라이브러리가 없으므로 이 컴포넌트들이 곧 문서다 — 그래서 "DRAFT 표시가
 * 실제로 화면에 나오는가"와 "부가세 고지 문구가 빠지지 않는가"를 렌더로 확인한다.
 * 둘 다 회계 문서가 확정본으로 오인되는 것을 막는 장치라 단위 테스트만으로는 부족하다.
 */
import { render, screen } from '@testing-library/react';
import { IntercompanyInvoiceDoc } from '@/components/admin/ops-finance/IntercompanyInvoiceDoc';
import { SettlementStatementDoc } from '@/components/admin/ops-finance/SettlementStatementDoc';
import {
  buildInvoiceDoc,
  buildStatementDoc,
  VAT_NOTICE,
  PLACEHOLDER,
} from '@/lib/ops/finance/documents';
import type { FinanceConfig } from '@/lib/ops/finance/config';
import type { IntercompanyInvoiceRow, SettlementPeriodRow } from '@/lib/ops/finance/settlement';

const config: FinanceConfig = {
  marginRate: 0.05,
  llcLegalName: null,
  llcAddress: null,
  llcEin: null,
  krLegalName: null,
  krAddress: null,
  krBizRegNo: null,
  intercompanyPrefix: 'AK-IC',
  intercompanySeq: 0,
  expertReviewed: false,
};

const period: SettlementPeriodRow = {
  id: 'per-1',
  tenant_id: 'atockorea',
  period: '2026-08',
  status: 'invoiced',
  gross_minor: 34400,
  commission_minor: 1720,
  remit_minor: 32680,
  margin_rate: 0.05,
  order_count: 2,
  stripe_fee_minor: null,
  currency: 'USD',
  note: null,
  closed_at: '2026-09-01T00:00:00.000Z',
  created_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-01T00:00:00.000Z',
};

const invoice: IntercompanyInvoiceRow = {
  id: 'inv-1',
  tenant_id: 'atockorea',
  period_id: 'per-1',
  invoice_no: 'AK-IC-2026-001',
  issue_date: '2026-09-01',
  amount_minor: 32680,
  currency: 'USD',
  fx_rate: null,
  fx_rate_date: null,
  status: 'draft',
  pdf_url: null,
  notes: null,
  created_at: '2026-09-01T00:00:00.000Z',
};

const ledgerRows = [
  { entity: 'us', booking_id: 'bk-1', period: '2026-08', type: 'revenue', amount_minor: 14400, currency: 'USD' },
  { entity: 'us', booking_id: 'bk-1', period: '2026-08', type: 'commission', amount_minor: 720, currency: 'USD' },
];
const bookingMeta = [{ bookingId: 'bk-1', bookingReference: 'A2C-11112222', tourDate: '2026-08-17' }];

describe('월 정산서 인쇄 뷰', () => {
  it('stamps DRAFT while expert review is pending and carries the §6.2 VAT notice', () => {
    const doc = buildStatementDoc({ period, config, ledgerRows, bookingMeta });
    render(<SettlementStatementDoc doc={doc} />);

    expect(screen.getByTestId('draft-watermark')).toBeInTheDocument();
    expect(screen.getByTestId('draft-notice')).toBeInTheDocument();
    expect(screen.getByTestId('vat-notice')).toHaveTextContent(VAT_NOTICE);
    expect(screen.getByText('2026년 8월 정산서')).toBeInTheDocument();
    // 총매출 · 커미션 · 송금분이 보인다.
    expect(screen.getByText('$344.00')).toBeInTheDocument();
    expect(screen.getByText('$326.80')).toBeInTheDocument();
  });

  it('drops the watermark once expert_reviewed is true', () => {
    const doc = buildStatementDoc({ period, config: { ...config, expertReviewed: true }, ledgerRows, bookingMeta });
    render(<SettlementStatementDoc doc={doc} />);
    expect(screen.queryByTestId('draft-watermark')).not.toBeInTheDocument();
    // 고지 문구는 워터마크와 무관하게 §6.2가 열려 있는 한 항상 남는다.
    expect(screen.getByTestId('vat-notice')).toHaveTextContent(VAT_NOTICE);
  });

  it('shows the legal-entity placeholder instead of inventing company details', () => {
    const doc = buildStatementDoc({ period, config, ledgerRows, bookingMeta });
    render(<SettlementStatementDoc doc={doc} />);
    expect(screen.getAllByText(PLACEHOLDER).length).toBeGreaterThan(0);
  });
});

describe('인터컴퍼니 인보이스 인쇄 뷰', () => {
  it('renders every §6.4 required block with a DRAFT stamp', () => {
    const doc = buildInvoiceDoc({ period, config, ledgerRows, bookingMeta, invoice });
    render(<IntercompanyInvoiceDoc doc={doc} />);

    expect(screen.getByTestId('draft-watermark')).toBeInTheDocument();
    expect(screen.getByTestId('invoice-no')).toHaveTextContent('AK-IC-2026-001');
    expect(screen.getByTestId('invoice-amount')).toHaveTextContent('$326.80');
    expect(screen.getByText('Tour operation services')).toBeInTheDocument();
    expect(screen.getByText(/Intercompany Services Agreement/)).toBeInTheDocument();
    expect(screen.getByText('지급조건')).toBeInTheDocument();
    expect(screen.getByText('수취계좌')).toBeInTheDocument();
    expect(screen.getByTestId('vat-notice')).toHaveTextContent(VAT_NOTICE);
    // 대상 주문번호 + 투어일자
    expect(screen.getByText('A2C-11112222')).toBeInTheDocument();
    expect(screen.getByText('2026-08-17')).toBeInTheDocument();
  });

  it('says the fx rate is missing rather than printing an invented one', () => {
    const doc = buildInvoiceDoc({ period, config, ledgerRows, bookingMeta, invoice });
    render(<IntercompanyInvoiceDoc doc={doc} />);
    expect(screen.getByText(/적용환율 미기재/)).toBeInTheDocument();
  });

  it('prints the recorded fx rate and its reference date when present', () => {
    const doc = buildInvoiceDoc({
      period,
      config,
      ledgerRows,
      bookingMeta,
      invoice: { ...invoice, fx_rate: 1352.4, fx_rate_date: '2026-09-01' },
    });
    render(<IntercompanyInvoiceDoc doc={doc} />);
    expect(screen.getByText(/적용환율 1352.4 \(기준일 2026-09-01\)/)).toBeInTheDocument();
  });
});
