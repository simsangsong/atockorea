/**
 * @jest-environment node
 *
 * §2-5 — 배정 안내 메일에 셀프 스케줄 링크가 실제로 붙는가.
 *
 * `noticeBody`는 `scheduleLink`를 받을 준비가 돼 있었지만 라우트가 채우지 않았다.
 * 순수 함수 테스트만으로는 이런 종류의 결함이 절대 잡히지 않는다 — 계약은
 * 지켜지고 호출부가 비어 있는 상태이기 때문이다. 그래서 라우트를 통과시켜 본다.
 */
import '@/test-utils/restoreWebPrimitives';
import { POST } from '@/app/api/admin/guides/assignments/notify/route';
import { createServerClient } from '@/lib/supabase';
import { sendEmail } from '@/lib/email';
import { verifyGuideScheduleToken } from '@/lib/ops/guides/selfToken';

jest.mock('@/lib/auth', () => ({
  requireAdmin: jest.fn(async () => ({ id: 'admin-1', email: 'ops@atockorea.com' })),
  AdminAuthFailure: class extends Error {},
  adminAuthJsonResponse: jest.fn(),
}));
jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));
jest.mock('@/lib/email', () => ({ sendEmail: jest.fn(async () => ({ success: true })) }));

const createServerClientMock = createServerClient as jest.Mock;
const sendEmailMock = sendEmail as jest.Mock;

const ASSIGNMENT = {
  id: 'as-1',
  guide_id: 'guide-1',
  tour_date: '2026-08-17',
  tour_type: 'private',
  role: 'guide',
  start_time: '08:00:00',
  end_time: '17:00:00',
  amount_krw: 150000,
  note: null,
  status: 'planned',
  booking_id: null,
};

function makeDb() {
  const updated: Array<Record<string, unknown>> = [];
  return {
    updated,
    from(table: string) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chain: any = {};
      let mode = 'select';
      let values: unknown = null;
      for (const name of ['select', 'eq', 'in', 'limit', 'order']) chain[name] = () => chain;
      chain.update = (v: Record<string, unknown>) => {
        mode = 'update';
        values = v;
        return chain;
      };
      const resolve = async () => {
        if (mode === 'update') {
          updated.push({ table, values });
          return { data: null, error: null };
        }
        if (table === 'ops_guide_assignments') return { data: [ASSIGNMENT], error: null };
        if (table === 'ops_guides') {
          return { data: [{ id: 'guide-1', name: '박가이드', email: 'park@example.com' }], error: null };
        }
        return { data: [], error: null };
      };
      chain.maybeSingle = async () => {
        const res = await resolve();
        return { data: Array.isArray(res.data) ? res.data[0] ?? null : res.data, error: res.error };
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      chain.then = (ok: any, err: any) => resolve().then(ok, err);
      return chain;
    },
  };
}

const req = () =>
  ({
    nextUrl: { origin: 'https://atockorea.com', searchParams: new URLSearchParams() },
    json: async () => ({ ids: ['as-1'] }),
  }) as never;

beforeEach(() => {
  jest.clearAllMocks();
  sendEmailMock.mockResolvedValue({ success: true });
  createServerClientMock.mockReturnValue(makeDb());
});

it('puts a working self-schedule link in the notice', async () => {
  const res = await POST(req());
  expect(res.status).toBe(200);
  expect((await res.json()).sent).toBe(1);

  const body = sendEmailMock.mock.calls[0][0].text as string;
  const match = body.match(/https:\/\/atockorea\.com\/g\/schedule\/(\S+)/);
  expect(match).not.toBeNull();
  // 링크가 붙었다는 것만으로는 부족하다 — 실제로 열리는 토큰이어야 한다.
  expect(verifyGuideScheduleToken(match![1])).toMatchObject({ guideId: 'guide-1' });
});

it('marks only what actually went out', async () => {
  const db = makeDb();
  createServerClientMock.mockReturnValue(db);
  await POST(req());
  expect(db.updated.find((u) => u.table === 'ops_guide_assignments')).toBeTruthy();
});

it('does not mark the assignment when the send fails', async () => {
  const db = makeDb();
  createServerClientMock.mockReturnValue(db);
  sendEmailMock.mockResolvedValue({ success: false, error: 'smtp down' });
  const res = await POST(req());
  const json = await res.json();
  expect(json.sent).toBe(0);
  expect(json.failures[0].reason).toMatch(/smtp down/);
  expect(db.updated).toHaveLength(0);
});
