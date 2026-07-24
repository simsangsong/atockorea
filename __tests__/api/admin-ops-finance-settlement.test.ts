/**
 * @jest-environment node
 *
 * 월 정산 사이클 admin API (Phase 3 §6.1 F-2~F-4, §6.4).
 *
 * 이 스위트가 지키는 계약 세 가지:
 *   ① 멱등 — 같은 달을 두 번 마감해도 기간 1행, 인보이스 1장.
 *   ② 대사는 하드 게이트 — 3자 금액이 어긋나면 400이고 status가 바뀌지 않는다.
 *   ③ 순서 — 마감 없이 인보이스 없고, 인보이스 없이 대사 통과 없다.
 *
 * 인메모리 대역(test-utils/fakeFinanceDb)이 실제 UNIQUE 제약을 흉내 내므로
 * "두 번째 insert가 튕기고 기존 행으로 수렴하는가"를 스파이가 아니라 저장소 상태로 본다.
 */
import '@/test-utils/restoreWebPrimitives';
import { GET as periodsGET, POST as periodsPOST } from '@/app/api/admin/ops-finance/periods/route';
import { GET as detailGET } from '@/app/api/admin/ops-finance/periods/[period]/route';
import { POST as invoicePOST } from '@/app/api/admin/ops-finance/periods/[period]/invoice/route';
import {
  GET as remittancesGET,
  POST as remittancesPOST,
} from '@/app/api/admin/ops-finance/periods/[period]/remittances/route';
import { POST as reconcilePOST } from '@/app/api/admin/ops-finance/periods/[period]/reconcile/route';
import { GET as filingsGET } from '@/app/api/admin/ops-finance/filings/route';
import { requireAdmin, AdminAuthFailure } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { makeFakeFinanceDb, ledgerPair, type FakeFinanceDb } from '@/test-utils/fakeFinanceDb';

jest.mock('@/lib/auth', () => {
  // jest.mock 팩토리는 import보다 먼저 호이스팅되므로 top-level 바인딩을 참조할 수
  // 없다 — require가 이 자리의 유일한 방법이다(기존 admin 라우트 테스트와 동일 패턴).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { NextResponse } = require('next/server');
  class AdminAuthFailure extends Error {
    status: number;
    code: string;
    constructor(status: number, message: string, code = 'AUTH') {
      super(message);
      this.status = status;
      this.code = code;
    }
  }
  return {
    requireAdmin: jest.fn(),
    AdminAuthFailure,
    adminAuthJsonResponse: (e: { code: string; message: string; status: number }) =>
      NextResponse.json({ ok: false, code: e.code, message: e.message }, { status: e.status }),
  };
});
jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));

const requireAdminMock = requireAdmin as jest.Mock;
const createServerClientMock = createServerClient as jest.Mock;

const PERIOD = '2026-08';

/** us 원장 2건($144.00 + $200.00) + 5% 설정 + 예약 메타. */
function seededDb(): FakeFinanceDb {
  return makeFakeFinanceDb({
    ops_entity_ledger: [...ledgerPair('bk-1', PERIOD, 14400), ...ledgerPair('bk-2', PERIOD, 20000)],
    ops_finance_config: [{ id: 1, margin_rate: 0.05, intercompany_prefix: 'AK-IC', expert_reviewed: false }],
    bookings: [
      { id: 'bk-1', booking_reference: 'A2C-11112222', tour_date: '2026-08-17' },
      { id: 'bk-2', booking_reference: 'A2C-33334444', tour_date: '2026-08-03' },
    ],
  });
}

function req(body?: unknown) {
  return {
    url: 'http://localhost/api/admin/ops-finance/periods',
    json: async () => body ?? {},
  } as never;
}

const ctx = (period: string) => ({ params: Promise.resolve({ period }) });

let db: FakeFinanceDb;

beforeEach(() => {
  jest.clearAllMocks();
  db = seededDb();
  requireAdminMock.mockResolvedValue({ id: 'admin-1' });
  createServerClientMock.mockReturnValue(db);
});

describe('auth', () => {
  it('refuses every verb for non-admin callers', async () => {
    requireAdminMock.mockRejectedValue(new AdminAuthFailure(403, 'Forbidden', 'FORBIDDEN'));
    expect((await periodsGET(req())).status).toBe(403);
    expect((await periodsPOST(req({ period: PERIOD }))).status).toBe(403);
    expect((await detailGET(req(), ctx(PERIOD))).status).toBe(403);
    expect((await invoicePOST(req(), ctx(PERIOD))).status).toBe(403);
    expect((await remittancesGET(req(), ctx(PERIOD))).status).toBe(403);
    expect((await remittancesPOST(req({}), ctx(PERIOD))).status).toBe(403);
    expect((await reconcilePOST(req(), ctx(PERIOD))).status).toBe(403);
    expect((await filingsGET(req())).status).toBe(403);
  });
});

describe('POST /periods — 마감', () => {
  it('aggregates the ledger and snapshots the configured rate', async () => {
    const res = await periodsPOST(req({ period: PERIOD }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.created).toBe(true);
    expect(json.period.gross_minor).toBe(34400);
    expect(json.period.commission_minor).toBe(1720);
    expect(json.period.remit_minor).toBe(32680);
    expect(json.period.order_count).toBe(2);
    expect(json.period.margin_rate).toBe(0.05);
    expect(json.period.status).toBe('closed');
    // 커미션 + 송금분 = 총매출 (스키마 CHECK와 같은 불변식)
    expect(json.period.commission_minor + json.period.remit_minor).toBe(json.period.gross_minor);
  });

  it('is idempotent — closing the same month twice leaves exactly one row', async () => {
    await periodsPOST(req({ period: PERIOD }));
    const second = await periodsPOST(req({ period: PERIOD }));
    expect(second.status).toBe(200);
    expect((await second.json()).created).toBe(false);
    expect(db.tables.ops_settlement_periods).toHaveLength(1);
  });

  it('re-aggregates on a second close so a late capture is picked up', async () => {
    await periodsPOST(req({ period: PERIOD }));
    db.tables.ops_entity_ledger.push(...ledgerPair('bk-3', PERIOD, 10000));
    const again = await periodsPOST(req({ period: PERIOD }));
    const json = await again.json();
    expect(json.period.gross_minor).toBe(44400);
    expect(json.period.order_count).toBe(3);
    expect(db.tables.ops_settlement_periods).toHaveLength(1);
  });

  it('never rewrites amounts once an invoice exists', async () => {
    await periodsPOST(req({ period: PERIOD }));
    await invoicePOST(req(), ctx(PERIOD));
    db.tables.ops_entity_ledger.push(...ledgerPair('bk-9', PERIOD, 50000));

    const res = await periodsPOST(req({ period: PERIOD }));
    const json = await res.json();
    expect(json.locked).toBe(true);
    // 발행된 인보이스가 참조하는 숫자는 소리 없이 바뀌지 않는다.
    expect(json.period.gross_minor).toBe(34400);
    expect(db.tables.ops_settlement_periods[0].gross_minor).toBe(34400);
  });

  it('rejects a malformed period', async () => {
    expect((await periodsPOST(req({ period: '2026-8' }))).status).toBe(400);
    expect((await periodsPOST(req({}))).status).toBe(400);
    expect(db.tables.ops_settlement_periods).toHaveLength(0);
  });

  it('lists closed periods newest first', async () => {
    await periodsPOST(req({ period: '2026-07' }));
    await periodsPOST(req({ period: PERIOD }));
    const json = await (await periodsGET(req())).json();
    expect(json.periods.map((p: { period: string }) => p.period)).toEqual(['2026-08', '2026-07']);
  });
});

describe('POST /periods/[period]/invoice — 인보이스 발행', () => {
  it('refuses to issue before the period is closed', async () => {
    const res = await invoicePOST(req(), ctx(PERIOD));
    expect(res.status).toBe(400);
    expect(db.tables.ops_intercompany_invoices).toHaveLength(0);
  });

  it('issues one invoice for the remit amount and advances the status', async () => {
    await periodsPOST(req({ period: PERIOD }));
    const res = await invoicePOST(req(), ctx(PERIOD));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.invoice.invoice_no).toBe('AK-IC-2026-001');
    expect(json.invoice.amount_minor).toBe(32680);
    expect(json.existed).toBe(false);
    expect(db.tables.ops_settlement_periods[0].status).toBe('invoiced');
  });

  it('is idempotent — a second issue returns the same invoice_no, not a second document', async () => {
    await periodsPOST(req({ period: PERIOD }));
    const first = await (await invoicePOST(req(), ctx(PERIOD))).json();
    const second = await (await invoicePOST(req(), ctx(PERIOD))).json();
    expect(second.existed).toBe(true);
    expect(second.invoice.invoice_no).toBe(first.invoice.invoice_no);
    expect(db.tables.ops_intercompany_invoices).toHaveLength(1);
  });

  it('continues the yearly sequence across periods', async () => {
    await periodsPOST(req({ period: '2026-07' }));
    await invoicePOST(req(), ctx('2026-07'));
    await periodsPOST(req({ period: PERIOD }));
    const json = await (await invoicePOST(req(), ctx(PERIOD))).json();
    expect(json.invoice.invoice_no).toBe('AK-IC-2026-002');
  });
});

describe('POST /periods/[period]/remittances — 송금 기록', () => {
  beforeEach(async () => {
    await periodsPOST(req({ period: PERIOD }));
  });

  it('records a wire and moves the status forward', async () => {
    const res = await remittancesPOST(
      req({ wireDate: '2026-09-05', amountUsd: '326.80', bankRef: 'SWIFT-1' }),
      ctx(PERIOD),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.remittance.amount_usd_minor).toBe(32680);
    expect(db.tables.ops_settlement_periods[0].status).toBe('remitted');
  });

  it('validates the wire date and the amount', async () => {
    expect((await remittancesPOST(req({ wireDate: '2026-9-5', amountUsd: '10' }), ctx(PERIOD))).status).toBe(400);
    expect((await remittancesPOST(req({ wireDate: '2026-09-05', amountUsd: '0' }), ctx(PERIOD))).status).toBe(400);
    expect(db.tables.ops_remittances).toHaveLength(0);
  });

  it('lists what has been recorded', async () => {
    await remittancesPOST(req({ wireDate: '2026-09-05', amountUsd: '100.00' }), ctx(PERIOD));
    await remittancesPOST(req({ wireDate: '2026-09-06', amountUsd: '226.80' }), ctx(PERIOD));
    const json = await (await remittancesGET(req(), ctx(PERIOD))).json();
    expect(json.remittances).toHaveLength(2);
  });
});

describe('POST /periods/[period]/reconcile — 3자 대사 (하드 게이트)', () => {
  it('refuses when no invoice has been issued', async () => {
    await periodsPOST(req({ period: PERIOD }));
    const res = await reconcilePOST(req(), ctx(PERIOD));
    expect(res.status).toBe(400);
    expect(db.tables.ops_settlement_periods[0].status).toBe('closed');
  });

  it('refuses when the wires are missing, and leaves the status untouched', async () => {
    await periodsPOST(req({ period: PERIOD }));
    await invoicePOST(req(), ctx(PERIOD));
    const res = await reconcilePOST(req(), ctx(PERIOD));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.reconcile.ok).toBe(false);
    expect(db.tables.ops_settlement_periods[0].status).toBe('invoiced');
  });

  it('refuses a short wire and reports the signed difference', async () => {
    await periodsPOST(req({ period: PERIOD }));
    await invoicePOST(req(), ctx(PERIOD));
    await remittancesPOST(req({ wireDate: '2026-09-05', amountUsd: '320.00' }), ctx(PERIOD));

    const res = await reconcilePOST(req(), ctx(PERIOD));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.reconcile.diffs.remitVsInvoice).toBe(-680);
    expect(json.expected.periodRemitMinor).toBe(32680);
    // 상태는 remitted에 머무른다 — 대사는 통과하지 않았다.
    expect(db.tables.ops_settlement_periods[0].status).toBe('remitted');
  });

  it('passes and marks reconciled when all three agree exactly', async () => {
    await periodsPOST(req({ period: PERIOD }));
    await invoicePOST(req(), ctx(PERIOD));
    await remittancesPOST(req({ wireDate: '2026-09-05', amountUsd: '200.00' }), ctx(PERIOD));
    await remittancesPOST(req({ wireDate: '2026-09-06', amountUsd: '126.80' }), ctx(PERIOD));

    const res = await reconcilePOST(req(), ctx(PERIOD));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.reconcile.ok).toBe(true);
    expect(json.reconcile.remittedMinor).toBe(32680);
    expect(db.tables.ops_settlement_periods[0].status).toBe('reconciled');
  });

  it('refuses an unclosed period outright', async () => {
    expect((await reconcilePOST(req(), ctx(PERIOD))).status).toBe(400);
    expect((await reconcilePOST(req(), ctx('2026-8'))).status).toBe(400);
  });
});

describe('GET /periods/[period] — 상세 번들', () => {
  it('builds both documents as DRAFT while expert review is pending', async () => {
    await periodsPOST(req({ period: PERIOD }));
    await invoicePOST(req(), ctx(PERIOD));

    const json = await (await detailGET(req(), ctx(PERIOD))).json();
    expect(json.statement.draft).toBe(true);
    expect(json.invoiceDoc.draft).toBe(true);
    expect(json.statement.vatNotice).toContain('부가세');
    expect(json.expertReviewed).toBe(false);
    // 주문 명세가 예약번호·투어일자와 함께 실린다(§6.4 필수 항목).
    expect(json.statement.lines.map((l: { bookingReference: string }) => l.bookingReference)).toEqual([
      'A2C-33334444',
      'A2C-11112222',
    ]);
  });

  it('clears DRAFT once expert_reviewed is true', async () => {
    db.tables.ops_finance_config[0].expert_reviewed = true;
    await periodsPOST(req({ period: PERIOD }));
    const json = await (await detailGET(req(), ctx(PERIOD))).json();
    expect(json.statement.draft).toBe(false);
  });

  it('returns a null statement for a period that was never closed', async () => {
    const json = await (await detailGET(req(), ctx('2026-05'))).json();
    expect(json.period).toBeNull();
    expect(json.statement).toBeNull();
    expect(json.invoiceDoc).toBeNull();
  });
});

describe('GET /filings — 신고기한', () => {
  it('lists the calendar by due date without sending anything', async () => {
    db.tables.ops_filing_calendar = [
      { id: 'f2', tenant_id: 'atockorea', entity: 'kr', due_date: '2027-03-31', title: '법인세', status: 'pending' },
      { id: 'f1', tenant_id: 'atockorea', entity: 'kr', due_date: '2026-07-25', title: '부가세 1기', status: 'na' },
    ];
    const json = await (await filingsGET(req())).json();
    expect(json.filings.map((f: { id: string }) => f.id)).toEqual(['f1', 'f2']);
    // VAT는 §6.2가 확정될 때까지 보류 상태로만 존재한다.
    expect(json.filings[0].status).toBe('na');
  });
});
