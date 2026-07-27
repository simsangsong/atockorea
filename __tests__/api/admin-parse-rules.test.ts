/**
 * @jest-environment node
 *
 * DE5 — 파서 학습 루프의 쓰기 쪽.
 *
 * `ops_parse_rules`를 만지는 라우트가 하나도 없었다. 규칙을 읽는 코드도,
 * 실패 뭉치를 규칙으로 바꾸는 함수도 있었지만 아무도 부르지 않았고,
 * `rule-governance.ts` 주석이 말하는 "the status route"는 존재하지 않았다.
 * 그래서 실패 38건이 쌓이는 동안 규칙은 0건이었다.
 *
 * 이 스위트가 고정하는 계약:
 *   1. 생성은 **shadow 로만** — 어드민 클릭 한 번이 파싱을 바꾸면 안 된다.
 *   2. 패턴은 **서버가 다시 계산한다** — 클라이언트가 보낸 정규식을 저장하면
 *      이 화면이 파서에 임의 패턴을 주입하는 통로가 된다.
 *   3. 활성화는 거버넌스를 통과해야 한다(Hard Rule #20) — 근거 없으면 422.
 */
import '@/test-utils/restoreWebPrimitives';
import { POST } from '@/app/api/admin/parse-rules/route';
import { PATCH } from '@/app/api/admin/parse-rules/[id]/route';
import { createServerClient } from '@/lib/supabase';

jest.mock('@/lib/auth', () => ({
  requireAdmin: jest.fn(async () => ({ id: 'admin-uuid-1' })),
  AdminAuthFailure: class extends Error {},
  adminAuthJsonResponse: jest.fn(),
}));
jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));
jest.mock('@/lib/ops/parse/health', () => ({ getLearningHealth: jest.fn(async () => null) }));

const createServerClientMock = createServerClient as jest.Mock;

/** {{NAME}} 이 있고 30자를 넘는 템플릿이어야 마이닝된다. */
const TEMPLATE = 'Guest: {{NAME}} / Date: {{DATE}} / Pax: {{N}} / Pickup: {{LOCATION}}';

let inserted: Record<string, unknown> | null = null;
let updated: Record<string, unknown> | null = null;
let ruleRow: Record<string, unknown> = {};

function client() {
  return {
    from(table: string) {
      if (table === 'ops_parse_observations') {
        // 같은 template_hash 3건 = 최소 뭉치 크기 충족.
        const rows = Array.from({ length: 3 }, () => ({
          template_hash: 'hash-a',
          raw_line_template: TEMPLATE,
        }));
        return {
          select: () => ({ eq: () => ({ limit: async () => ({ data: rows }) }) }),
        };
      }
      if (table === 'ops_parse_rules') {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: ruleRow }) }),
            order: () => ({ limit: async () => ({ data: [] }) }),
          }),
          insert: (payload: Record<string, unknown>) => {
            inserted = payload;
            return { select: () => ({ single: async () => ({ data: { id: 'rule-1', ...payload } }) }) };
          },
          update: (payload: Record<string, unknown>) => {
            updated = payload;
            return { eq: async () => ({ error: null }) };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

const post = (body: unknown) => ({ json: async () => body }) as never;
const patch = (body: unknown) => ({ json: async () => body }) as never;

beforeEach(() => {
  jest.clearAllMocks();
  inserted = null;
  updated = null;
  createServerClientMock.mockReturnValue(client());
});

describe('🔴 DE5 — 규칙 생성은 섀도로만', () => {
  it('관찰 뭉치에서 규칙을 만들고 status 는 shadow 다', async () => {
    const res = await POST(post({ template_hash: 'hash-a' }));
    expect(res.status).toBe(201);
    expect(inserted).toMatchObject({ status: 'shadow', source: 'auto_mined' });
  });

  it('패턴을 서버가 다시 계산한다 — 클라이언트가 보낸 것을 쓰지 않는다', async () => {
    await POST(post({ template_hash: 'hash-a', template_pattern: '.*', slot_map: { name: 0 } }));
    expect(inserted!.template_pattern).not.toBe('.*');
    // 리터럴은 이스케이프되고 {{TOKEN}} 만 캡처가 된다.
    expect(String(inserted!.template_pattern)).toContain('{{NAME}}');
    expect(Object.keys(inserted!.slot_map as object)).toContain('name');
  });

  it('출처 해시를 남긴다 — 같은 템플릿이 후보로 또 뜨면 안 된다', async () => {
    await POST(post({ template_hash: 'hash-a' }));
    expect(String(inserted!.notes)).toContain('template_hash=hash-a');
  });

  it('관찰이 부족한 템플릿은 404', async () => {
    const res = await POST(post({ template_hash: 'never-seen' }));
    expect(res.status).toBe(404);
  });
});

describe('🔴 DE5 — 활성화는 근거 없이는 안 된다 (Hard Rule #20)', () => {
  const params = Promise.resolve({ id: 'rule-1' });

  it('통계도 못 넘고 사유도 없으면 422', async () => {
    ruleRow = { match_count: 3, success_count: 3, promotion_reason: null, validated_fixture: null, promoted_by: null };
    const res = await PATCH(patch({ action: 'promote' }), { params });
    expect(res.status).toBe(422);
    expect(updated).toBeNull();
  });

  it('사유를 적으면 활성화되고 누가 올렸는지 남는다', async () => {
    ruleRow = { match_count: 3, success_count: 3, promotion_reason: null, validated_fixture: null, promoted_by: null };
    const res = await PATCH(patch({ action: 'promote', promotion_reason: '실제 메일 2건으로 확인' }), { params });
    expect(res.status).toBe(200);
    expect(updated).toMatchObject({ status: 'active', promoted_by: 'admin-uuid-1' });
    expect(updated!.promoted_at).toBeTruthy();
  });

  it('통계 임계를 넘으면 사유 없이도 활성화된다', async () => {
    ruleRow = { match_count: 120, success_count: 119, promotion_reason: null, validated_fixture: null, promoted_by: null };
    const res = await PATCH(patch({ action: 'promote' }), { params });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ via: 'threshold' });
  });

  it('되돌리기(섀도)에는 마찰이 없다 — 켜는 쪽만 근거가 필요하다', async () => {
    ruleRow = { match_count: 0, success_count: 0, promotion_reason: null, validated_fixture: null, promoted_by: null };
    const res = await PATCH(patch({ action: 'shadow' }), { params });
    expect(res.status).toBe(200);
    expect(updated).toMatchObject({ status: 'shadow' });
  });
});
