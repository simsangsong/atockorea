/**
 * @jest-environment node
 *
 * 가이드 셀프 스케줄 API (§11.F) — 토큰이 권한의 전부인 라우트.
 *
 * 핵심 검사: **토큰의 guideId 말고는 어떤 입력도 대상 가이드를 바꾸지 못한다.**
 * body에 남의 guide_id를 실어도, query에 실어도 쿼리는 자기 것만 향해야 한다.
 */
import '@/test-utils/restoreWebPrimitives';
import { GET, POST, DELETE } from '@/app/api/guide-schedule/[token]/route';
import { createServerClient } from '@/lib/supabase';
import { signGuideScheduleToken } from '@/lib/ops/guides/selfToken';
import { signGuideRoomToken } from '@/lib/tour-room/token';
import { kstToday } from '@/lib/ops/guides/availability';
import { makeFakeDb, queriesFor, filterArgs, fakeNextRequest, type FakeQuery } from '@/test-utils/opsSeatingFakes';

jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));

const createServerClientMock = createServerClient as jest.Mock;

const SECRET_ENV = 'OPS_GUIDE_SCHEDULE_TOKEN_SECRET';
const PREV_SECRET = process.env[SECRET_ENV];

const MINE = 'guide-mine';
const OTHER = 'guide-other';

/** 내일 — 지난 날짜 잠금에 걸리지 않는 안전한 미래 날짜. */
function future(days = 1): string {
  const today = kstToday();
  const [y, m, d] = today.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function past(days = 1): string {
  return future(-days);
}

function db(rows: unknown[] = []) {
  const log: FakeQuery[] = [];
  const client = makeFakeDb((q) => {
    if (q.table === 'ops_guide_unavailable_dates') return { data: rows };
    return { data: [] };
  }, log);
  return { client, log };
}

function token(guideId = MINE, name = '김가이드') {
  return signGuideScheduleToken({ guideId, name }).token;
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env[SECRET_ENV] = 'schedule-secret-test';
});

afterAll(() => {
  if (PREV_SECRET === undefined) delete process.env[SECRET_ENV];
  else process.env[SECRET_ENV] = PREV_SECRET;
});

describe('guide self-schedule — 토큰 게이트', () => {
  it('rejects a missing, garbage or expired token with 401', async () => {
    createServerClientMock.mockReturnValue(db().client);
    const expired = signGuideScheduleToken({ guideId: MINE, ttlSeconds: 1 }).token;
    jest.useFakeTimers().setSystemTime(new Date(Date.now() + 5000));
    const expiredRes = await GET(fakeNextRequest({}), { params: Promise.resolve({ token: expired }) });
    jest.useRealTimers();

    const garbage = await GET(fakeNextRequest({}), { params: Promise.resolve({ token: 'nonsense' }) });
    const empty = await GET(fakeNextRequest({}), { params: Promise.resolve({ token: '' }) });

    expect(expiredRes.status).toBe(401);
    expect(garbage.status).toBe(401);
    expect(empty.status).toBe(401);
  });

  // 바인딩 결정 5 — 룸 토큰으로는 이 표면에 들어올 수 없다.
  it('rejects a tour-room token', async () => {
    process.env.TOUR_ROOM_TOKEN_SECRET = 'room-secret';
    createServerClientMock.mockReturnValue(db().client);
    const roomToken = signGuideRoomToken({ tourId: 't-1', tourDate: future(30), displayName: '가이드' }).token;
    const res = await GET(fakeNextRequest({}), { params: Promise.resolve({ token: roomToken }) });
    expect(res.status).toBe(401);
  });

  it('does not touch the database when the token fails', async () => {
    const { client, log } = db();
    createServerClientMock.mockReturnValue(client);
    await POST(fakeNextRequest({ body: { date: future() } }), { params: Promise.resolve({ token: 'bad' }) });
    expect(log).toHaveLength(0);
  });
});

describe('guide self-schedule — 남의 데이터에 닿지 않는다', () => {
  it('reads only the token holder rest days', async () => {
    const { client, log } = db([{ date: future(), reason: null, source: 'self' }]);
    createServerClientMock.mockReturnValue(client);

    const res = await GET(fakeNextRequest({ searchParams: { year: '2026', month: '8' } }), {
      params: Promise.resolve({ token: token() }),
    });
    expect(res.status).toBe(200);
    const q = queriesFor(log, 'ops_guide_unavailable_dates')[0];
    expect(filterArgs(q, 'eq', 1)).toEqual(['guide_id', MINE]);
  });

  // 남의 id를 body에 실어도 쓰기 대상은 토큰의 guideId다.
  it('ignores a guide_id supplied in the request body', async () => {
    const { client, log } = db();
    createServerClientMock.mockReturnValue(client);

    const date = future();
    const res = await POST(
      fakeNextRequest({ body: { date, guide_id: OTHER, guideId: OTHER, tenant_id: 'evil' } }),
      { params: Promise.resolve({ token: token() }) },
    );
    expect(res.status).toBe(201);

    const rows = queriesFor(log, 'ops_guide_unavailable_dates', 'upsert')[0].payload as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(1);
    expect(rows[0].guide_id).toBe(MINE);
    expect(rows[0].tenant_id).toBe('atockorea');
    expect(JSON.stringify(rows)).not.toContain(OTHER);
  });

  it('scopes deletes to the token holder', async () => {
    const { client, log } = db();
    createServerClientMock.mockReturnValue(client);
    const date = future();
    const res = await DELETE(fakeNextRequest({ searchParams: { date, guide_id: OTHER } }), {
      params: Promise.resolve({ token: token() }),
    });
    expect(res.status).toBe(200);
    const q = queriesFor(log, 'ops_guide_unavailable_dates', 'delete')[0];
    expect(filterArgs(q, 'eq', 1)).toEqual(['guide_id', MINE]);
  });

  it('exposes nothing but the name and the dates', async () => {
    const { client } = db([{ date: future(), reason: '개인 사정', source: 'self' }]);
    createServerClientMock.mockReturnValue(client);
    const res = await GET(fakeNextRequest({}), { params: Promise.resolve({ token: token() }) });
    const json = await res.json();
    expect(json.guide).toEqual({ name: '김가이드' });
    const text = JSON.stringify(json);
    expect(text).not.toContain(MINE); // guideId조차 내려주지 않는다
    expect(text).not.toContain('rrn');
    expect(text).not.toContain('bank');
    expect(text).not.toContain('phone');
  });
});

describe('guide self-schedule — 등록 규칙', () => {
  it('marks self-registered rows with source=self', async () => {
    const { client, log } = db();
    createServerClientMock.mockReturnValue(client);
    await POST(fakeNextRequest({ body: { date: future() } }), { params: Promise.resolve({ token: token() }) });
    const rows = queriesFor(log, 'ops_guide_unavailable_dates', 'upsert')[0].payload as Array<Record<string, unknown>>;
    expect(rows[0].source).toBe('self');
  });

  it('registers a range as one row per day', async () => {
    const { client, log } = db();
    createServerClientMock.mockReturnValue(client);
    const res = await POST(fakeNextRequest({ body: { from: future(2), to: future(4) } }), {
      params: Promise.resolve({ token: token() }),
    });
    expect((await res.json()).count).toBe(3);
    const rows = queriesFor(log, 'ops_guide_unavailable_dates', 'upsert')[0].payload as unknown[];
    expect(rows).toHaveLength(3);
  });

  // 지난 날의 휴무를 소급해 바꾸면 정산 근거가 흔들린다.
  it('refuses to change past dates', async () => {
    const { client, log } = db();
    createServerClientMock.mockReturnValue(client);

    const postRes = await POST(fakeNextRequest({ body: { date: past() } }), {
      params: Promise.resolve({ token: token() }),
    });
    const delRes = await DELETE(fakeNextRequest({ searchParams: { date: past() } }), {
      params: Promise.resolve({ token: token() }),
    });

    expect(postRes.status).toBe(400);
    expect(delRes.status).toBe(400);
    expect(log).toHaveLength(0);
  });

  it('refuses a range that reaches into the past', async () => {
    const { client, log } = db();
    createServerClientMock.mockReturnValue(client);
    const res = await POST(fakeNextRequest({ body: { from: past(2), to: future(2) } }), {
      params: Promise.resolve({ token: token() }),
    });
    expect(res.status).toBe(400);
    expect(log).toHaveLength(0);
  });

  it('rejects an invalid date rather than writing something odd', async () => {
    const { client, log } = db();
    createServerClientMock.mockReturnValue(client);
    const res = await POST(fakeNextRequest({ body: { date: '2026-02-30' } }), {
      params: Promise.resolve({ token: token() }),
    });
    expect(res.status).toBe(400);
    expect(log).toHaveLength(0);
  });
});
