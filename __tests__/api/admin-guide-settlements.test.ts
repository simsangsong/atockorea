/**
 * @jest-environment node
 *
 * 가이드 배정 · 월 정산 · 세무 서식 admin API (§6.9).
 *
 * 이 스위트의 중심은 네 가지 회귀 방지다:
 *   1. **비admin은 전부 403** — 소득 정보와 주민번호가 걸린 라우트다.
 *   2. **멱등** — 같은 달을 두 번 정산해도 정산행·원장행이 늘지 않는다.
 *   3. **paid 전이가 금액을 바꾸지 않는다** — 지급 증빙과 장부가 어긋나면 끝이다.
 *   4. **PII**: JSON 응답에는 마스크만, CSV/HTML 산출물에만 평문. 그리고 복호화가
 *      일어나면 ops_guide_pii_access_log에 반드시 행이 남는다(없으면 복호화 금지).
 */
import '@/test-utils/restoreWebPrimitives';
import { GET as listGET, POST as listPOST } from '@/app/api/admin/guides/assignments/route';
import { PATCH as assignPATCH, DELETE as assignDELETE } from '@/app/api/admin/guides/assignments/[id]/route';
import {
  GET as settlementsGET,
  POST as settlementsPOST,
} from '@/app/api/admin/guide-settlements/route';
import { PATCH as settlementPATCH } from '@/app/api/admin/guide-settlements/[key]/route';
import { GET as formsGET } from '@/app/api/admin/guide-settlements/[key]/forms/[form]/route';
import { requireAdmin, AdminAuthFailure } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { encryptGuidePii } from '@/lib/ops/guides/pii';
import { makeFakeDb, queriesFor, fakeNextRequest, type FakeQuery } from '@/test-utils/opsSeatingFakes';

jest.mock('@/lib/auth', () => {
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

const KEY_ENV = 'OPS_GUIDE_PII_ENC_KEY';
const PREV_KEY = process.env[KEY_ENV];
const PLAIN_RRN = '900101-1234567';

const ASSIGNMENT = {
  id: 'as-1',
  guide_id: 'g-1',
  booking_id: null,
  room_id: null,
  tour_date: '2026-08-03',
  tour_type: 'private',
  role: 'guide',
  amount_krw: 200_000,
  status: 'worked',
  note: null,
};

const SETTLEMENT = {
  id: 's-1',
  tenant_id: 'atockorea',
  guide_id: 'g-1',
  period: '2026-08',
  gross_krw: 1_000_000,
  income_tax_krw: 30_000,
  local_tax_krw: 3_000,
  withheld_krw: 33_000,
  net_krw: 967_000,
  reimbursement_krw: 0,
  payout_krw: 967_000,
  assignment_count: 5,
  status: 'draft',
  paid_at: null,
  paid_note: null,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
};

interface Over {
  assignments?: unknown[];
  settlements?: unknown[];
  guideRow?: Record<string, unknown>;
  ledgerRow?: unknown;
  logError?: unknown;
  config?: Record<string, unknown> | null;
  updated?: Record<string, unknown>;
}

function db(over: Over = {}) {
  const log: FakeQuery[] = [];
  const ledger: Array<Record<string, unknown>> = [];
  const guideRow = over.guideRow ?? {
    id: 'g-1',
    name: '김가이드',
    guide_type: 'both',
    rrn_masked: '900101-1******',
    rrn_enc: encryptGuidePii(PLAIN_RRN),
  };

  const client = makeFakeDb((q) => {
    if (q.table === 'ops_guide_assignments') {
      if (q.op === 'insert') return { data: { ...ASSIGNMENT, ...(q.payload as object) } };
      if (q.op === 'update') return { data: { ...ASSIGNMENT, ...(q.payload as object) } };
      if (q.op === 'delete') return { data: null };
      return { data: over.assignments ?? [ASSIGNMENT] };
    }
    if (q.table === 'ops_guide_rates') return { data: [] };
    if (q.table === 'ops_guide_settlements') {
      if (q.op === 'upsert') {
        const payloads = (Array.isArray(q.payload) ? q.payload : [q.payload]) as Record<string, unknown>[];
        return { data: payloads.map((p, i) => ({ ...SETTLEMENT, id: `s-${i + 1}`, ...p })) };
      }
      if (q.op === 'update') return { data: { ...SETTLEMENT, ...(over.updated ?? {}), ...(q.payload as object) } };
      if (q.terminal !== 'list') return { data: (over.settlements ?? [SETTLEMENT])[0] ?? null };
      return { data: over.settlements ?? [SETTLEMENT] };
    }
    if (q.table === 'ops_guides') {
      if (q.terminal === 'list') return { data: [guideRow] };
      return { data: guideRow };
    }
    if (q.table === 'ops_guide_pii_access_log') return { error: over.logError ?? null, data: null };
    if (q.table === 'ops_finance_config') {
      return {
        data:
          over.config === undefined
            ? { id: 1, kr_legal_name: '에이투씨코리아', kr_biz_reg_no: '277-01-03977', expert_reviewed: false }
            : over.config,
      };
    }
    if (q.table === 'ops_entity_ledger') {
      if (q.op === 'insert') {
        ledger.push(q.payload as Record<string, unknown>);
        return { data: null };
      }
      if (q.op === 'update') return { data: null };
      return { data: over.ledgerRow ?? null };
    }
    return { data: [] };
  }, log);

  return { client, log, ledger };
}

beforeEach(() => {
  jest.clearAllMocks();
  requireAdminMock.mockResolvedValue({ id: 'admin-1', email: 'admin@atockorea.com', role: 'admin' });
  process.env[KEY_ENV] = 'test-key-for-routes';
});

afterAll(() => {
  if (PREV_KEY === undefined) delete process.env[KEY_ENV];
  else process.env[KEY_ENV] = PREV_KEY;
});

describe('인증 게이트', () => {
  it('returns 403 for a non-admin on every route', async () => {
    requireAdminMock.mockRejectedValue(new AdminAuthFailure(403, 'Forbidden: Insufficient permissions', 'FORBIDDEN'));
    createServerClientMock.mockReturnValue(db().client);

    const responses = await Promise.all([
      listGET(fakeNextRequest({ searchParams: { period: '2026-08' } })),
      listPOST(fakeNextRequest({ body: { guideId: 'g-1', tourDate: '2026-08-03', tourType: 'private' } })),
      assignPATCH(fakeNextRequest({ body: { status: 'worked' } }), { params: Promise.resolve({ id: 'as-1' }) }),
      assignDELETE(fakeNextRequest({}), { params: Promise.resolve({ id: 'as-1' }) }),
      settlementsGET(fakeNextRequest({ searchParams: { period: '2026-08' } })),
      settlementsPOST(fakeNextRequest({ body: { period: '2026-08' } })),
      settlementPATCH(fakeNextRequest({ body: { status: 'paid' } }), { params: Promise.resolve({ key: 's-1' }) }),
      formsGET(fakeNextRequest({}), { params: Promise.resolve({ key: '2026-08', form: 'simplified' }) }),
    ]);

    for (const res of responses) expect(res.status).toBe(403);
  });

  it('returns 401 when unauthenticated', async () => {
    requireAdminMock.mockRejectedValue(new AdminAuthFailure(401, 'Unauthorized', 'UNAUTHORIZED'));
    createServerClientMock.mockReturnValue(db().client);
    expect((await settlementsGET(fakeNextRequest({ searchParams: { period: '2026-08' } }))).status).toBe(401);
  });
});

describe('배정 원장', () => {
  it('creates an assignment with the tenant stamped in', async () => {
    const { client, log } = db();
    createServerClientMock.mockReturnValue(client);
    const res = await listPOST(
      fakeNextRequest({ body: { guideId: 'g-1', tourDate: '2026-08-03', tourType: 'private', role: 'both' } }),
    );
    expect(res.status).toBe(201);
    const payload = queriesFor(log, 'ops_guide_assignments', 'insert')[0].payload as Record<string, unknown>;
    expect(payload).toMatchObject({ tenant_id: 'atockorea', guide_id: 'g-1', tour_date: '2026-08-03', role: 'both' });
    // 기본 상태는 planned — 만들자마자 정산 대상이 되면 안 된다.
    expect(payload).not.toHaveProperty('status');
  });

  it('rejects an impossible date and an unknown role without writing', async () => {
    const { client, log } = db();
    createServerClientMock.mockReturnValue(client);
    expect(
      (await listPOST(fakeNextRequest({ body: { guideId: 'g-1', tourDate: '2026-02-30', tourType: 'private' } }))).status,
    ).toBe(400);
    expect(
      (await listPOST(fakeNextRequest({ body: { guideId: 'g-1', tourDate: '2026-08-03', tourType: 'private', role: 'pilot' } })))
        .status,
    ).toBe(400);
    expect(queriesFor(log, 'ops_guide_assignments', 'insert')).toHaveLength(0);
  });

  it('marks worked via PATCH — the only transition that turns work into money', async () => {
    const { client, log } = db();
    createServerClientMock.mockReturnValue(client);
    const res = await assignPATCH(fakeNextRequest({ body: { status: 'worked' } }), {
      params: Promise.resolve({ id: 'as-1' }),
    });
    expect(res.status).toBe(200);
    expect((queriesFor(log, 'ops_guide_assignments', 'update')[0].payload as Record<string, unknown>).status).toBe('worked');
  });

  it('scopes the month query to the requested period', async () => {
    const { client, log } = db();
    createServerClientMock.mockReturnValue(client);
    await listGET(fakeNextRequest({ searchParams: { period: '2026-08' } }));
    const q = queriesFor(log, 'ops_guide_assignments')[0];
    expect(q.filters.find((f) => f.method === 'gte')?.args).toEqual(['tour_date', '2026-08-01']);
    expect(q.filters.find((f) => f.method === 'lte')?.args).toEqual(['tour_date', '2026-08-31']);
  });

  it('never exposes guide PII in the assignment list', async () => {
    const { client } = db();
    createServerClientMock.mockReturnValue(client);
    const res = await listGET(fakeNextRequest({ searchParams: { period: '2026-08' } }));
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain('rrn');
    expect(text).not.toContain(PLAIN_RRN);
    expect(text).not.toContain('v1.');
  });
});

describe('월 정산 배치', () => {
  it('runs the batch and reports the summary', async () => {
    const { client } = db();
    createServerClientMock.mockReturnValue(client);
    const res = await settlementsPOST(fakeNextRequest({ body: { period: '2026-08' } }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.summary.withheldKrw).toBe(33_000);
    expect(json.summary.grossKrw).toBe(1_000_000);
  });

  it('rejects a malformed period', async () => {
    createServerClientMock.mockReturnValue(db().client);
    expect((await settlementsPOST(fakeNextRequest({ body: { period: '2026-8' } }))).status).toBe(400);
    expect((await settlementsGET(fakeNextRequest({ searchParams: {} }))).status).toBe(400);
  });

  it('is idempotent — the second run upserts, never inserts a duplicate', async () => {
    const { client, log } = db();
    createServerClientMock.mockReturnValue(client);
    await settlementsPOST(fakeNextRequest({ body: { period: '2026-08' } }));
    await settlementsPOST(fakeNextRequest({ body: { period: '2026-08' } }));

    const writes = queriesFor(log, 'ops_guide_settlements').filter((q) => q.op !== 'select');
    expect(writes.every((q) => q.op === 'upsert')).toBe(true);
    for (const w of writes) {
      const opts = w.filters.find((f) => f.method === 'upsert_options')?.args?.[0] as { onConflict?: string };
      expect(opts?.onConflict).toBe('tenant_id,guide_id,period');
    }
  });

  it('books the kr-side expense once per settlement (external_ref dedup)', async () => {
    const { client, ledger } = db();
    createServerClientMock.mockReturnValue(client);
    await settlementsPOST(fakeNextRequest({ body: { period: '2026-08' } }));
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ entity: 'kr', type: 'expense', source: 'guide_settlement', currency: 'KRW' });
    expect(Number(ledger[0].amount_minor)).toBeLessThan(0);
  });

  it('never puts a resident number in the settlement list response', async () => {
    const { client } = db();
    createServerClientMock.mockReturnValue(client);
    const res = await settlementsGET(fakeNextRequest({ searchParams: { period: '2026-08' } }));
    const text = JSON.stringify(await res.json());
    expect(text).toContain('김가이드');
    expect(text).not.toContain(PLAIN_RRN);
    expect(text).not.toContain('rrn');
  });
});

describe('상태 전이 — paid는 사후 기록이지 이체가 아니다', () => {
  it('marks paid without touching any amount column', async () => {
    const { client, log } = db();
    createServerClientMock.mockReturnValue(client);
    const res = await settlementPATCH(fakeNextRequest({ body: { status: 'paid', paidNote: '국민은행 이체' } }), {
      params: Promise.resolve({ key: 's-1' }),
    });
    expect(res.status).toBe(200);

    const payload = queriesFor(log, 'ops_guide_settlements', 'update')[0].payload as Record<string, unknown>;
    expect(payload.status).toBe('paid');
    expect(payload.paid_at).toBeTruthy();
    for (const column of ['gross_krw', 'withheld_krw', 'net_krw', 'payout_krw', 'reimbursement_krw', 'income_tax_krw']) {
      expect(payload).not.toHaveProperty(column);
    }
  });

  it('refuses to edit a settlement already recorded as paid', async () => {
    const { client, log } = db({ settlements: [{ ...SETTLEMENT, status: 'paid' }] });
    createServerClientMock.mockReturnValue(client);
    const res = await settlementPATCH(fakeNextRequest({ body: { reimbursementKrw: 10_000 } }), {
      params: Promise.resolve({ key: 's-1' }),
    });
    expect(res.status).toBe(409);
    expect(queriesFor(log, 'ops_guide_settlements', 'update')).toHaveLength(0);
  });

  it('refuses to walk the status backwards', async () => {
    const { client } = db({ settlements: [{ ...SETTLEMENT, status: 'confirmed' }] });
    createServerClientMock.mockReturnValue(client);
    const res = await settlementPATCH(fakeNextRequest({ body: { status: 'draft' } }), {
      params: Promise.resolve({ key: 's-1' }),
    });
    expect(res.status).toBe(400);
  });

  it('applies 실비 to payout only — gross and the tax columns stay put', async () => {
    const { client, log } = db();
    createServerClientMock.mockReturnValue(client);
    const res = await settlementPATCH(fakeNextRequest({ body: { reimbursementKrw: 47_000 } }), {
      params: Promise.resolve({ key: 's-1' }),
    });
    expect(res.status).toBe(200);
    const payload = queriesFor(log, 'ops_guide_settlements', 'update')[0].payload as Record<string, unknown>;
    expect(payload.reimbursement_krw).toBe(47_000);
    expect(payload.payout_krw).toBe(967_000 + 47_000);
    expect(payload).not.toHaveProperty('gross_krw');
    expect(payload).not.toHaveProperty('withheld_krw');
  });

  it('rejects a fractional or negative 실비', async () => {
    const { client } = db();
    createServerClientMock.mockReturnValue(client);
    for (const value of [-1, 1.5, 'abc']) {
      const res = await settlementPATCH(fakeNextRequest({ body: { reimbursementKrw: value } }), {
        params: Promise.resolve({ key: 's-1' }),
      });
      expect(res.status).toBe(400);
    }
  });
});

describe('세무 서식', () => {
  it('JSON response carries the mask, never the plaintext, and logs nothing', async () => {
    const { client, log } = db();
    createServerClientMock.mockReturnValue(client);
    const res = await formsGET(fakeNextRequest({}), {
      params: Promise.resolve({ key: '2026-08', form: 'simplified' }),
    });
    const json = await res.json();
    const text = JSON.stringify(json);

    expect(res.status).toBe(200);
    expect(text).toContain('900101-1******');
    expect(text).not.toContain(PLAIN_RRN);
    // 아무것도 복호화하지 않았으므로 감사로그도 남지 않는다.
    expect(queriesFor(log, 'ops_guide_pii_access_log', 'insert')).toHaveLength(0);
    expect(json.draft).toBe(true); // expert_reviewed=false → DRAFT
  });

  it('CSV carries a UTF-8 BOM, the plaintext RRN and 업종코드 940927 — and logs the access', async () => {
    const { client, log } = db();
    createServerClientMock.mockReturnValue(client);
    const res = await formsGET(fakeNextRequest({ searchParams: { format: 'csv' } }), {
      params: Promise.resolve({ key: '2026-08', form: 'simplified' }),
    });
    // 바이트로 확인한다 — Response.text()의 UTF-8 디코더가 선두 BOM을 먹어버려서
    // 문자열로 보면 항상 사라진 것처럼 보인다. 엑셀이 읽는 것은 바이트다.
    const bytes = new Uint8Array(await res.clone().arrayBuffer());
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    expect(res.headers.get('content-disposition')).toContain('attachment');
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf]); // 엑셀 한글 깨짐 방지
    expect(body).toContain('940927');
    expect(body).toContain(PLAIN_RRN);
    expect(body).toContain('DRAFT');

    const audit = queriesFor(log, 'ops_guide_pii_access_log', 'insert');
    expect(audit).toHaveLength(1);
    expect(audit[0].payload).toMatchObject({
      guide_id: 'g-1',
      field: 'rrn',
      actor: 'admin@atockorea.com',
      purpose: '2026-08 지급명세서 생성',
    });
  });

  it('does not decrypt when the audit insert fails (fail-closed)', async () => {
    const { client } = db({ logError: { message: 'log table missing' } });
    createServerClientMock.mockReturnValue(client);
    const res = await formsGET(fakeNextRequest({ searchParams: { format: 'csv' } }), {
      params: Promise.resolve({ key: '2026-08', form: 'simplified' }),
    });
    expect(res.status).toBe(503);
    expect(await res.text()).not.toContain(PLAIN_RRN);
  });

  it('the aggregate 원천징수이행상황신고서 never decrypts anything', async () => {
    const { client, log } = db();
    createServerClientMock.mockReturnValue(client);
    const res = await formsGET(fakeNextRequest({ searchParams: { format: 'csv' } }), {
      params: Promise.resolve({ key: '2026-08', form: 'withholding-report' }),
    });
    const body = await res.text();
    expect(body).toContain('A25');
    expect(body).not.toContain(PLAIN_RRN);
    expect(queriesFor(log, 'ops_guide_pii_access_log', 'insert')).toHaveLength(0);
  });

  it('leaves the RRN blank (with a warning) when the encryption key is absent', async () => {
    delete process.env[KEY_ENV];
    const { client, log } = db({ guideRow: { id: 'g-1', name: '김가이드', rrn_masked: null, rrn_enc: null } });
    createServerClientMock.mockReturnValue(client);
    const res = await formsGET(fakeNextRequest({ searchParams: { format: 'csv' } }), {
      params: Promise.resolve({ key: '2026-08', form: 'simplified' }),
    });
    expect(res.status).toBe(200);
    expect(await res.text()).not.toContain(PLAIN_RRN);
    expect(queriesFor(log, 'ops_guide_pii_access_log', 'insert')).toHaveLength(0);
  });

  it('serves an escaped HTML fragment for the print view', async () => {
    const { client } = db();
    createServerClientMock.mockReturnValue(client);
    const res = await formsGET(fakeNextRequest({ searchParams: { format: 'html' } }), {
      params: Promise.resolve({ key: '2026-08', form: 'receipt' }),
    });
    const body = await res.text();
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(body).toContain('<table class="tf-table">');
    expect(body).toContain(PLAIN_RRN); // 서식 렌더 결과이므로 평문이 맞다
  });

  it('rejects an unknown form key and a malformed period', async () => {
    createServerClientMock.mockReturnValue(db().client);
    expect(
      (await formsGET(fakeNextRequest({}), { params: Promise.resolve({ key: '2026-08', form: 'w2' }) })).status,
    ).toBe(400);
    expect(
      (await formsGET(fakeNextRequest({}), { params: Promise.resolve({ key: '2026', form: 'simplified' }) })).status,
    ).toBe(400);
  });

  it('accepts YYYY (and YYYY-MM) for the annual statement', async () => {
    const { client } = db();
    createServerClientMock.mockReturnValue(client);
    const res = await formsGET(fakeNextRequest({}), {
      params: Promise.resolve({ key: '2026', form: 'annual' }),
    });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.period).toBe('2026');
  });
});
