/**
 * @jest-environment node
 *
 * §5.4 C-17 카드 세트 라우트 — 룸 오버라이드(rooms/[roomId]/card-set)와
 * 상품 기본값(card-sets).
 *
 * 여기서 지키는 것:
 *   ① 편집 가능한 것만 저장된다 — 문구를 보내도 무시된다(자유 텍스트 봉쇄);
 *   ② 빈 선택은 400으로 거부된다 (조용히 "브리핑 0장"이 되지 않는다);
 *   ③ 삭제는 상속으로 되돌리고, 응답이 그 결과(코드 기본 5장)를 알려준다;
 *   ④ GET은 미리보기를 함께 준다 — 운영자가 발사 전에 실물을 본다.
 */
import '@/test-utils/restoreWebPrimitives';
import {
  GET as roomGet,
  PUT as roomPut,
  DELETE as roomDelete,
} from '@/app/api/admin/tour-ops/rooms/[roomId]/card-set/route';
import { GET as tourGet, PUT as tourPut } from '@/app/api/admin/tour-ops/card-sets/route';
import { requireAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { previewTourStartBriefing } from '@/lib/ops/seating/startBriefing';
import { fakeNextRequest, makeFakeDb, filterArgs, type FakeQuery } from '@/test-utils/opsSeatingFakes';
import { DEFAULT_BRIEFING_CARD_IDS } from '@/lib/ops/seating/cards/stack';

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
jest.mock('@/lib/tour-room/events', () => ({
  recordRoomEvent: jest.fn(async () => ({ inserted: true, event: { id: 'evt-1' } })),
  listRoomEvents: jest.fn(async () => []),
}));
jest.mock('@/lib/ops/seating/startBriefing', () => ({
  previewTourStartBriefing: jest.fn(async () => ({ room_id: 'room-1', cards: [], tour_kind: 'join' })),
}));

const requireAdminMock = requireAdmin as jest.Mock;
const createServerClientMock = createServerClient as jest.Mock;
const previewMock = previewTourStartBriefing as jest.Mock;

const ROOM_ID = 'room-1';
const TOUR_ID = 'tour-1';

interface DbState {
  sets: Array<{ scope: string; scope_id: string; card_ids?: string[] | null; options?: Record<string, unknown> }>;
  upserts: Array<Record<string, unknown>>;
  deletes: FakeQuery[];
}

function makeDb(initial: DbState['sets'] = []) {
  const state: DbState = { sets: [...initial], upserts: [], deletes: [] };
  const log: FakeQuery[] = [];
  const client = makeFakeDb((q) => {
    if (q.table === 'tour_rooms') {
      return { data: { id: ROOM_ID, booking_id: 'b1', tour_id: TOUR_ID, tour_date: '2099-07-24', status: 'active' } };
    }
    if (q.table === 'tours') {
      if (q.terminal === 'maybeSingle') {
        return { data: { id: TOUR_ID, title: 'Jeju day tour', price_type: 'person', city: 'Jeju', lunch_included: false } };
      }
      return { data: [{ id: TOUR_ID, title: 'Jeju day tour', price_type: 'person', city: 'Jeju', lunch_included: false }] };
    }
    if (q.table === 'ops_briefing_card_sets') {
      if (q.op === 'upsert') {
        const payload = q.payload as Record<string, unknown>;
        state.upserts.push(payload);
        state.sets = [
          ...state.sets.filter(
            (row) => !(row.scope === payload.scope && row.scope_id === payload.scope_id),
          ),
          payload as never,
        ];
        return { data: { ...payload, updated_at: 'T' } };
      }
      if (q.op === 'delete') {
        state.deletes.push(q);
        const scope = filterArgs(q, 'eq', 0)?.[1];
        const scopeId = filterArgs(q, 'eq', 1)?.[1];
        state.sets = state.sets.filter((row) => !(row.scope === scope && row.scope_id === scopeId));
        return { data: null };
      }
      const scope = filterArgs(q, 'eq', 0)?.[1];
      const scopeId = filterArgs(q, 'eq', 1)?.[1];
      if (q.terminal === 'maybeSingle') {
        const row = state.sets.find((set) => set.scope === scope && set.scope_id === scopeId);
        return { data: row ? { options: {}, card_ids: null, ...row, updated_at: 'T' } : null };
      }
      return { data: state.sets.filter((set) => set.scope === scope) };
    }
    return { data: null };
  }, log);
  createServerClientMock.mockReturnValue(client);
  return state;
}

beforeEach(() => {
  jest.clearAllMocks();
  requireAdminMock.mockResolvedValue({ id: 'admin-1' });
  previewMock.mockResolvedValue({ room_id: ROOM_ID, cards: [], tour_kind: 'join' });
});

const roomParams = { params: Promise.resolve({ roomId: ROOM_ID }) };

describe('room card-set route', () => {
  it('GET reports the resolved set, where it came from, and a preview', async () => {
    makeDb([{ scope: 'tour', scope_id: TOUR_ID, card_ids: ['start', 'lunch'] }]);
    const res = await roomGet(fakeNextRequest({}), roomParams);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.resolved.card_ids).toEqual(['start', 'lunch']);
    expect(json.resolved.card_ids_source).toBe('tour');
    // "이 레벨(룸)을 빼면 무엇이 적용되나" — 에디터의 상속 판정 기준.
    expect(json.inherited.card_ids).toEqual(['start', 'lunch']);
    expect(json.levels.room).toBeNull();
    expect(json.preview).toBeTruthy();
    expect(previewMock).toHaveBeenCalledWith(expect.anything(), { roomId: ROOM_ID });
  });

  it('GET still answers with the code default when nothing is configured', async () => {
    makeDb();
    const json = await (await roomGet(fakeNextRequest({}), roomParams)).json();
    expect(json.resolved.card_ids).toEqual([...DEFAULT_BRIEFING_CARD_IDS]);
    expect(json.resolved.card_ids_source).toBe('default');
  });

  it('PUT stores only ids and the two known options — copy is not accepted', async () => {
    const state = makeDb();
    const res = await roomPut(
      fakeNextRequest({
        body: {
          card_ids: ['etiquette', 'start', 'nope'],
          options: { safety: { skip_repeat_boarding: false }, lunch: { lunch_included: true } },
          // 문구를 밀어넣으려는 시도 — 저장되면 안 된다.
          translations: { ko: '운영자가 직접 쓴 한국어' },
          source_text: 'hand-written',
        },
      }),
      roomParams,
    );
    expect(res.status).toBe(200);

    const stored = state.upserts[0];
    expect(stored.card_ids).toEqual(['etiquette', 'start']);
    expect(stored.options).toEqual({
      safety: { skip_repeat_boarding: false },
      lunch: { lunch_included: true },
    });
    expect(Object.keys(stored)).not.toContain('translations');
    expect(Object.keys(stored)).not.toContain('source_text');
  });

  it('PUT refuses an empty selection instead of storing "no briefing"', async () => {
    const state = makeDb();
    const res = await roomPut(fakeNextRequest({ body: { card_ids: [] } }), roomParams);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('empty_selection');
    expect(state.upserts).toHaveLength(0);
  });

  it('PUT with card_ids:null clears the id override but keeps options', async () => {
    const state = makeDb();
    await roomPut(
      fakeNextRequest({ body: { card_ids: null, options: { safety: { skip_repeat_boarding: false } } } }),
      roomParams,
    );
    expect(state.upserts[0].card_ids).toBeNull();
    expect(state.upserts[0].options).toEqual({ safety: { skip_repeat_boarding: false } });
  });

  it('DELETE drops the room override and reports what now applies', async () => {
    const state = makeDb([{ scope: 'room', scope_id: ROOM_ID, card_ids: ['lunch'] }]);
    const res = await roomDelete(fakeNextRequest({}), roomParams);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(state.sets.some((set) => set.scope === 'room')).toBe(false);
    expect(json.resolved.card_ids).toEqual([...DEFAULT_BRIEFING_CARD_IDS]);
    expect(json.resolved.card_ids_source).toBe('default');
  });

  it('requires an admin', async () => {
    makeDb();
    const { AdminAuthFailure } = jest.requireMock('@/lib/auth');
    requireAdminMock.mockRejectedValueOnce(new AdminAuthFailure(401, 'nope'));
    expect((await roomGet(fakeNextRequest({}), roomParams)).status).toBe(401);
  });
});

describe('tour-product default route', () => {
  it('GET lists products with their configured set', async () => {
    makeDb([{ scope: 'tour', scope_id: TOUR_ID, card_ids: ['start'] }]);
    const json = await (await tourGet(fakeNextRequest({}))).json();
    expect(json.tours).toHaveLength(1);
    expect(json.tours[0]).toMatchObject({ id: TOUR_ID, card_ids: ['start'], tour_kind: 'join' });
  });

  it('GET ?tour_id= resolves against the code default only', async () => {
    makeDb();
    const json = await (await tourGet(fakeNextRequest({ searchParams: { tour_id: TOUR_ID } }))).json();
    expect(json.resolved.card_ids_source).toBe('default');
    expect(json.inherited.card_ids).toEqual([...DEFAULT_BRIEFING_CARD_IDS]);
    expect(json.level).toBeNull();
  });

  it('PUT saves the product default', async () => {
    const state = makeDb();
    const res = await tourPut(
      fakeNextRequest({ body: { tour_id: TOUR_ID, card_ids: ['start', 'safety'] } }),
    );
    expect(res.status).toBe(200);
    expect(state.upserts[0]).toMatchObject({ scope: 'tour', scope_id: TOUR_ID, card_ids: ['start', 'safety'] });
  });

  it('PUT without a tour_id is a 400, not a stray row', async () => {
    const state = makeDb();
    expect((await tourPut(fakeNextRequest({ body: { card_ids: ['start'] } }))).status).toBe(400);
    expect(state.upserts).toHaveLength(0);
  });
});
