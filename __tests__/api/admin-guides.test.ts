/**
 * @jest-environment node
 *
 * 가이드 원장 admin API (§6.9).
 *
 * 이 스위트의 중심은 두 가지 회귀 방지다:
 *   1. **응답에 봉투(*_enc)나 평문 PII가 절대 실리지 않는다** — 목록·상세·수정
 *      어디에서도. select 컬럼 목록이 바뀌어 봉투가 새어 나오는 순간 깨지도록
 *      실제 응답 JSON을 문자열로 훑는다.
 *   2. **키가 없으면 민감 필드 저장을 거부하되 나머지는 저장된다**(fail-closed
 *      이면서 도입을 막지 않는다).
 */
import '@/test-utils/restoreWebPrimitives';
import { GET as listGET, POST as listPOST } from '@/app/api/admin/guides/route';
import { GET as detailGET, PATCH as detailPATCH, DELETE as detailDELETE } from '@/app/api/admin/guides/[id]/route';
import { POST as revealPOST } from '@/app/api/admin/guides/[id]/reveal/route';
import { POST as unavailablePOST, DELETE as unavailableDELETE } from '@/app/api/admin/guides/[id]/unavailable/route';
import { GET as recommendGET } from '@/app/api/admin/guides/recommend/route';
import { requireAdmin, AdminAuthFailure } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { GUIDE_SELECT_COLUMNS, toGuideResponse } from '@/lib/ops/guides/registry';
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

/** 마스킹된 행 — API가 실제로 돌려주는 모양(봉투 컬럼 없음). */
const GUIDE_ROW = {
  id: 'g-1',
  name: '김가이드',
  phone: '010-1111-2222',
  email: 'kim@example.com',
  languages: ['ko', 'en'],
  guide_type: 'both',
  rrn_masked: '900101-1******',
  bank_name: '신한은행',
  bank_holder: '김가이드',
  bank_account_masked: '••••1234',
  certified: true,
  active: true,
  note: null,
  created_at: '2026-07-01T00:00:00Z',
  updated_at: '2026-07-01T00:00:00Z',
};

const PLAIN_RRN = '900101-1234567';
const PLAIN_ACCOUNT = '110-123-456789';

function db(over: { guideRow?: unknown; offRows?: unknown[]; revealRow?: unknown; logError?: unknown } = {}) {
  const log: FakeQuery[] = [];
  const client = makeFakeDb((q) => {
    if (q.table === 'ops_guides' && q.terminal !== 'list') {
      // reveal 라우트는 봉투 컬럼을 명시적으로 select한다.
      const selectArgs = q.filters.find((f) => f.method === 'select')?.args?.[0];
      if (typeof selectArgs === 'string' && selectArgs.includes('_enc')) {
        return { data: over.revealRow ?? null };
      }
      return { data: over.guideRow ?? GUIDE_ROW };
    }
    if (q.table === 'ops_guides') return { data: [over.guideRow ?? GUIDE_ROW] };
    if (q.table === 'ops_guide_unavailable_dates') return { data: over.offRows ?? [] };
    if (q.table === 'ops_guide_pii_access_log') return { error: over.logError ?? null, data: null };
    return { data: [] };
  }, log);
  return { client, log };
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

describe('admin guide routes — 인증 게이트', () => {
  it('returns 403 for a non-admin on every route', async () => {
    requireAdminMock.mockRejectedValue(new AdminAuthFailure(403, 'Forbidden: Insufficient permissions', 'FORBIDDEN'));
    createServerClientMock.mockReturnValue(db().client);

    const params = Promise.resolve({ id: 'g-1' });
    const responses = await Promise.all([
      listGET(fakeNextRequest({})),
      listPOST(fakeNextRequest({ body: { name: '박가이드' } })),
      detailGET(fakeNextRequest({}), { params }),
      detailPATCH(fakeNextRequest({ body: { name: 'x' } }), { params }),
      detailDELETE(fakeNextRequest({}), { params }),
      revealPOST(fakeNextRequest({ body: { field: 'rrn', purpose: '지급명세서' } }), { params }),
      unavailablePOST(fakeNextRequest({ body: { date: '2026-08-01' } }), { params }),
      recommendGET(fakeNextRequest({ searchParams: { date: '2026-08-01' } })),
    ]);

    for (const res of responses) expect(res.status).toBe(403);
  });

  it('returns 401 when unauthenticated', async () => {
    requireAdminMock.mockRejectedValue(new AdminAuthFailure(401, 'Unauthorized', 'UNAUTHORIZED'));
    createServerClientMock.mockReturnValue(db().client);
    const res = await listGET(fakeNextRequest({}));
    expect(res.status).toBe(401);
  });
});

describe('admin guide routes — PII가 응답에 실리지 않는다 (회귀 방지)', () => {
  // 저장된 컬럼 목록 자체에 봉투가 없어야 한다 — 방어의 1차선.
  it('never selects the envelope columns', () => {
    expect(GUIDE_SELECT_COLUMNS).not.toContain('rrn_enc');
    expect(GUIDE_SELECT_COLUMNS).not.toContain('bank_account_enc');
    expect(GUIDE_SELECT_COLUMNS).toContain('rrn_masked');
    expect(GUIDE_SELECT_COLUMNS).toContain('bank_account_masked');
  });

  // 2차선: select가 잘못돼도 투영이 걸러낸다.
  it('projects unknown columns away, whatever the query returned', () => {
    const projected = toGuideResponse({
      ...GUIDE_ROW,
      rrn_enc: 'v1.aa.bb.cc',
      bank_account_enc: 'v1.dd.ee.ff',
      some_future_secret: 'nope',
    }) as unknown as Record<string, unknown>;
    expect(projected).not.toHaveProperty('rrn_enc');
    expect(projected).not.toHaveProperty('bank_account_enc');
    expect(projected).not.toHaveProperty('some_future_secret');
    expect(projected.rrn_masked).toBe('900101-1******');
  });

  it('list/detail responses contain masks only — no _enc, no plaintext', async () => {
    // DB가 봉투를 흘려도(잘못된 select 등) 라우트 응답에는 나오면 안 된다.
    const leaky = { ...GUIDE_ROW, rrn_enc: 'v1.aa.bb.cc', bank_account_enc: 'v1.dd.ee.ff' };
    createServerClientMock.mockReturnValue(db({ guideRow: leaky }).client);

    const listRes = await listGET(fakeNextRequest({}));
    const listBody = await listRes.json();
    const listText = JSON.stringify(listBody);
    expect(listRes.status).toBe(200);
    expect(listBody.data[0].rrn_masked).toBe('900101-1******');

    const detailRes = await detailGET(fakeNextRequest({}), { params: Promise.resolve({ id: 'g-1' }) });
    const detailText = JSON.stringify(await detailRes.json());

    for (const text of [listText, detailText]) {
      expect(text).not.toContain('rrn_enc');
      expect(text).not.toContain('bank_account_enc');
      expect(text).not.toContain('v1.aa.bb.cc');
      expect(text).not.toContain(PLAIN_RRN);
      expect(text).not.toContain('1234567');
    }
  });

  it('does not echo the plaintext back after saving it', async () => {
    const { client, log } = db();
    createServerClientMock.mockReturnValue(client);

    const res = await listPOST(
      fakeNextRequest({
        body: { name: '박가이드', residentNumber: PLAIN_RRN, bankAccount: PLAIN_ACCOUNT },
      }),
    );
    expect(res.status).toBe(201);
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain(PLAIN_RRN);
    expect(text).not.toContain(PLAIN_ACCOUNT);

    // 저장된 값은 봉투 + 마스크지 평문이 아니다.
    const insert = queriesFor(log, 'ops_guides', 'insert')[0];
    const payload = insert.payload as Record<string, unknown>;
    expect(payload.rrn_enc).toMatch(/^v1\./);
    expect(payload.rrn_masked).toBe('900101-1******');
    expect(payload.bank_account_enc).toMatch(/^v1\./);
    expect(payload.bank_account_masked).toBe('••••6789');
    expect(JSON.stringify(payload)).not.toContain(PLAIN_RRN);
    expect(JSON.stringify(payload)).not.toContain(PLAIN_ACCOUNT);
  });
});

describe('admin guide routes — fail-closed without an encryption key', () => {
  it('rejects sensitive fields with 400 pii_key_missing', async () => {
    delete process.env[KEY_ENV];
    const { client, log } = db();
    createServerClientMock.mockReturnValue(client);

    const res = await listPOST(fakeNextRequest({ body: { name: '박가이드', residentNumber: PLAIN_RRN } }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('pii_key_missing');
    // 평문이 DB로 향하는 쿼리 자체가 없어야 한다.
    expect(queriesFor(log, 'ops_guides', 'insert')).toHaveLength(0);
  });

  it('still saves the non-sensitive profile without a key', async () => {
    delete process.env[KEY_ENV];
    const { client, log } = db();
    createServerClientMock.mockReturnValue(client);

    const res = await listPOST(
      fakeNextRequest({ body: { name: '박가이드', languages: ['ko', 'JA'], guideType: 'driver' } }),
    );
    expect(res.status).toBe(201);
    const payload = queriesFor(log, 'ops_guides', 'insert')[0].payload as Record<string, unknown>;
    expect(payload.name).toBe('박가이드');
    expect(payload.languages).toEqual(['ko', 'ja']); // 소문자 정규화
    expect(payload).not.toHaveProperty('rrn_enc');
  });

  it('reports key availability so the UI can lock the fields up front', async () => {
    delete process.env[KEY_ENV];
    createServerClientMock.mockReturnValue(db().client);
    const res = await listGET(fakeNextRequest({}));
    expect((await res.json()).piiKeyConfigured).toBe(false);
  });
});

describe('admin guide routes — validation', () => {
  beforeEach(() => createServerClientMock.mockReturnValue(db().client));

  it('requires a name on create and rejects an unknown guide_type', async () => {
    expect((await listPOST(fakeNextRequest({ body: { name: '  ' } }))).status).toBe(400);
    expect((await listPOST(fakeNextRequest({ body: { name: 'x', guideType: 'pilot' } }))).status).toBe(400);
  });

  it('rejects an empty PATCH instead of writing an empty update', async () => {
    const res = await detailPATCH(fakeNextRequest({ body: {} }), { params: Promise.resolve({ id: 'g-1' }) });
    expect(res.status).toBe(400);
  });

  it('deactivates by default and hard-deletes only when asked', async () => {
    const soft = db();
    createServerClientMock.mockReturnValue(soft.client);
    const softRes = await detailDELETE(fakeNextRequest({}), { params: Promise.resolve({ id: 'g-1' }) });
    expect((await softRes.json()).deleted).toBe('soft');
    expect((queriesFor(soft.log, 'ops_guides', 'update')[0].payload as Record<string, unknown>).active).toBe(false);
    expect(queriesFor(soft.log, 'ops_guides', 'delete')).toHaveLength(0);

    const hard = db();
    createServerClientMock.mockReturnValue(hard.client);
    const hardRes = await detailDELETE(fakeNextRequest({ searchParams: { hard: '1' } }), {
      params: Promise.resolve({ id: 'g-1' }),
    });
    expect((await hardRes.json()).deleted).toBe('hard');
    expect(queriesFor(hard.log, 'ops_guides', 'delete')).toHaveLength(1);
  });
});

describe('admin guide routes — 휴무 등록', () => {
  it('expands a range into one row per day (idempotent upsert)', async () => {
    const { client, log } = db();
    createServerClientMock.mockReturnValue(client);
    const res = await unavailablePOST(
      fakeNextRequest({ body: { from: '2026-08-01', to: '2026-08-03', reason: '개인 사정' } }),
      { params: Promise.resolve({ id: 'g-1' }) },
    );
    expect(res.status).toBe(201);
    expect((await res.json()).count).toBe(3);
    const rows = queriesFor(log, 'ops_guide_unavailable_dates', 'upsert')[0].payload as Array<Record<string, unknown>>;
    expect(rows.map((r) => r.date)).toEqual(['2026-08-01', '2026-08-02', '2026-08-03']);
    expect(rows.every((r) => r.source === 'admin' && r.guide_id === 'g-1')).toBe(true);
  });

  it('rejects a reversed or oversized range rather than truncating it', async () => {
    const { client, log } = db();
    createServerClientMock.mockReturnValue(client);
    const res = await unavailablePOST(fakeNextRequest({ body: { from: '2026-08-05', to: '2026-08-01' } }), {
      params: Promise.resolve({ id: 'g-1' }),
    });
    expect(res.status).toBe(400);
    expect(queriesFor(log, 'ops_guide_unavailable_dates', 'upsert')).toHaveLength(0);
  });

  it('clears a single date', async () => {
    const { client, log } = db();
    createServerClientMock.mockReturnValue(client);
    const res = await unavailableDELETE(fakeNextRequest({ searchParams: { date: '2026-08-02' } }), {
      params: Promise.resolve({ id: 'g-1' }),
    });
    expect(res.status).toBe(200);
    expect(queriesFor(log, 'ops_guide_unavailable_dates', 'delete')).toHaveLength(1);
  });
});

describe('admin guide routes — reveal는 감사로그를 남긴다', () => {
  /** 평문을 실제로 복호화할 수 있는 봉투를 만들어 둔다. */
  function envelopeRow() {
    process.env[KEY_ENV] = 'test-key-for-routes';
    return { id: 'g-1', name: '김가이드', rrn_enc: encryptGuidePii(PLAIN_RRN) };
  }

  it('writes an audit row with actor + purpose, then returns the plaintext', async () => {
    const { client, log } = db({ revealRow: envelopeRow() });
    createServerClientMock.mockReturnValue(client);

    const res = await revealPOST(
      fakeNextRequest({ body: { field: 'rrn', purpose: '2026-07 지급명세서 작성' } }),
      { params: Promise.resolve({ id: 'g-1' }) },
    );
    expect(res.status).toBe(200);
    expect((await res.json()).value).toBe(PLAIN_RRN);

    const audit = queriesFor(log, 'ops_guide_pii_access_log', 'insert');
    expect(audit).toHaveLength(1);
    expect(audit[0].payload).toMatchObject({
      guide_id: 'g-1',
      field: 'rrn',
      actor: 'admin@atockorea.com',
      purpose: '2026-07 지급명세서 작성',
    });
  });

  it('refuses without a purpose — and logs nothing', async () => {
    const { client, log } = db({ revealRow: envelopeRow() });
    createServerClientMock.mockReturnValue(client);
    const res = await revealPOST(fakeNextRequest({ body: { field: 'rrn', purpose: ' ' } }), {
      params: Promise.resolve({ id: 'g-1' }),
    });
    expect(res.status).toBe(400);
    expect(queriesFor(log, 'ops_guide_pii_access_log', 'insert')).toHaveLength(0);
    expect(queriesFor(log, 'ops_guides')).toHaveLength(0);
  });

  // 흔적 없는 열람이 가능한 순간 이 라우트의 존재 의의가 사라진다.
  it('does not decrypt when the audit insert fails (fail-closed)', async () => {
    const { client, log } = db({ revealRow: envelopeRow(), logError: { message: 'log table missing' } });
    createServerClientMock.mockReturnValue(client);
    const res = await revealPOST(fakeNextRequest({ body: { field: 'rrn', purpose: '정산 확인' } }), {
      params: Promise.resolve({ id: 'g-1' }),
    });
    expect(res.status).toBe(503);
    expect(JSON.stringify(await res.json())).not.toContain(PLAIN_RRN);
    // 봉투 조회조차 하지 않는다.
    expect(queriesFor(log, 'ops_guides')).toHaveLength(0);
  });

  it('rejects an unknown field', async () => {
    createServerClientMock.mockReturnValue(db().client);
    const res = await revealPOST(fakeNextRequest({ body: { field: 'password', purpose: '왜' } }), {
      params: Promise.resolve({ id: 'g-1' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('admin guide routes — recommend', () => {
  it('flags rest-day guides without dropping them', async () => {
    const { client } = db({ offRows: [{ guide_id: 'g-1' }] });
    createServerClientMock.mockReturnValue(client);
    const res = await recommendGET(fakeNextRequest({ searchParams: { date: '2026-08-01', language: 'en' } }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data).toHaveLength(1);
    expect(json.data[0].unavailable).toBe(true);
    expect(json.unavailableCount).toBe(1);
  });

  it('requires a valid date', async () => {
    createServerClientMock.mockReturnValue(db().client);
    expect((await recommendGET(fakeNextRequest({ searchParams: { date: '2026-02-30' } }))).status).toBe(400);
    expect((await recommendGET(fakeNextRequest({}))).status).toBe(400);
  });

  it('exposes no PII in the recommendation payload', async () => {
    const { client } = db();
    createServerClientMock.mockReturnValue(client);
    const res = await recommendGET(fakeNextRequest({ searchParams: { date: '2026-08-01' } }));
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain('rrn');
    expect(text).not.toContain('bank');
    expect(text).not.toContain('010-1111-2222');
  });
});
