/**
 * @jest-environment node
 *
 * DE7 — 픽업 표준지점 사전의 쓰기 표면.
 *
 * DE6에서 테이블과 RPC를 만들었지만 행을 만들 길이 없었다. 사전이 비어 있으면
 * `canonicalizePickup` 은 모든 표기에 대해 계속 null 을 돌려주므로, 테이블만
 * 있는 것은 없는 것과 같다.
 *
 * 이 스위트가 고정하는 계약:
 *   1. `alias_normalized` 는 **서버가 조회와 같은 방식으로** 계산한다 —
 *      직접 넣게 두면 조회 정규화와 어긋나 영원히 안 잡히는 별칭이 생긴다.
 *   2. 큐 승인은 **별칭을 실제로 만든다** — 상태만 approved 로 바꾸면
 *      화면은 처리된 것처럼 보이는데 다음 예약에서 또 똑같이 실패한다.
 *   3. 이미 있는 별칭은 실패가 아니다(같은 결론이므로).
 */
import '@/test-utils/restoreWebPrimitives';
import { POST, PATCH } from '@/app/api/admin/pickup-dictionary/route';
import { createServerClient } from '@/lib/supabase';
import { normalizeForLookup } from '@/lib/ops/pickup/canonicalize';

jest.mock('@/lib/auth', () => ({
  requireAdmin: jest.fn(async () => ({ id: 'admin-1' })),
  AdminAuthFailure: class extends Error {},
  adminAuthJsonResponse: jest.fn(),
}));
jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));

const createServerClientMock = createServerClient as jest.Mock;

let aliasInsert: Record<string, unknown> | null = null;
let queueUpdate: Record<string, unknown> | null = null;
let aliasError: { code?: string } | null = null;
let queueRow: Record<string, unknown> | null = null;

function client() {
  return {
    from(table: string) {
      if (table === 'ops_pickup_aliases') {
        return {
          insert: (payload: Record<string, unknown>) => {
            aliasInsert = payload;
            const result = { data: { id: 'a1', ...payload }, error: aliasError };
            return {
              select: () => ({ single: async () => result }),
              then: (res: (v: unknown) => unknown) => Promise.resolve(result).then(res),
            };
          },
        };
      }
      if (table === 'ops_pickup_locations') {
        return {
          insert: (payload: Record<string, unknown>) => ({
            select: () => ({ single: async () => ({ data: { id: 'loc-1', ...payload }, error: null }) }),
          }),
        };
      }
      if (table === 'ops_pickup_learning_queue') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: queueRow }) }) }),
          update: (payload: Record<string, unknown>) => {
            queueUpdate = payload;
            return { eq: async () => ({ error: null }) };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

const request = (body: unknown) => ({ json: async () => body }) as never;

beforeEach(() => {
  jest.clearAllMocks();
  aliasInsert = null;
  queueUpdate = null;
  aliasError = null;
  queueRow = { id: 'q1', raw_value: '  LOTTE City Hotel Jeju ', proposed_canonical_id: 'loc-1', status: 'pending' };
  createServerClientMock.mockReturnValue(client());
});

describe('🔴 DE7 — 별칭 정규화는 조회와 같은 함수여야 한다', () => {
  it('별칭 추가 시 alias_normalized 를 서버가 계산한다', async () => {
    const res = await POST(request({ location_id: 'loc-1', alias: 'Lotte City Hotel Jeju' }));
    expect(res.status).toBe(201);
    expect(aliasInsert).toMatchObject({
      alias: 'Lotte City Hotel Jeju',
      alias_normalized: normalizeForLookup('Lotte City Hotel Jeju'),
    });
    // 띄어쓰기·하이픈이 제거된 형태여야 조회가 잡는다.
    expect(aliasInsert!.alias_normalized).toBe('lottecityhoteljeju');
  });

  it('클라이언트가 보낸 alias_normalized 는 무시한다', async () => {
    await POST(request({ location_id: 'loc-1', alias: 'Shilla Duty Free', alias_normalized: '엉뚱한값' }));
    expect(aliasInsert!.alias_normalized).toBe(normalizeForLookup('Shilla Duty Free'));
  });

  it('중복 별칭은 실패가 아니다 — 결론이 같다', async () => {
    aliasError = { code: '23505' };
    const res = await POST(request({ location_id: 'loc-1', alias: 'Lotte City Hotel Jeju' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ duplicate: true });
  });
});

describe('🔴 DE7 — 큐 승인은 사전에 실제로 반영돼야 한다', () => {
  it('승인하면 별칭이 만들어지고 큐가 approved 가 된다', async () => {
    const res = await PATCH(request({ queue_id: 'q1', decision: 'approve' }));
    expect(res.status).toBe(200);
    // 상태만 바꾸고 별칭을 안 만들면 다음 예약에서 또 실패한다.
    expect(aliasInsert).toMatchObject({ pickup_location_id: 'loc-1' });
    expect(aliasInsert!.alias_normalized).toBe(normalizeForLookup('LOTTE City Hotel Jeju'));
    expect(queueUpdate).toMatchObject({ status: 'approved' });
  });

  it('거절은 별칭을 만들지 않는다', async () => {
    const res = await PATCH(request({ queue_id: 'q1', decision: 'reject' }));
    expect(res.status).toBe(200);
    expect(aliasInsert).toBeNull();
    expect(queueUpdate).toMatchObject({ status: 'rejected' });
  });

  it('보낼 지점이 정해지지 않으면 400 — 조용히 승인하지 않는다', async () => {
    queueRow = { id: 'q1', raw_value: 'somewhere', proposed_canonical_id: null, status: 'pending' };
    const res = await PATCH(request({ queue_id: 'q1', decision: 'approve' }));
    expect(res.status).toBe(400);
    expect(queueUpdate).toBeNull();
  });
});
