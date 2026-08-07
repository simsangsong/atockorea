/**
 * @jest-environment node
 *
 * `GET /api/admin/tour-ops/rooms?room_id=` — **한 룸을, 날짜와 무관하게.**
 *
 * 🔴 왜 이 파라미터가 생겼나 (사장님 신고, 2026-08-07: "차량배정 눌러도 아무 반응 없어").
 *
 * 관제 콘솔은 자기 `date` 하루치 룸만 들고 있고, 룸 드로어는
 * `rooms.find(id)` 로 찾아질 때만 렌더된다. 그런데 룸·링크 관리 시트는 ◀ ▶ 로
 * 다른 날짜를 본다 — **내일 배차를 미리 잡는 정상 업무**를 하는 순간 그 룸은
 * 콘솔의 목록에 없고, [차량 배정]은 `openRoomId` 만 세팅한 채 아무것도 안 열었다.
 * 오류도, 토스트도 없이 완전 무반응. 눌러도 반응 없는 버튼의 정체가 이것이다.
 *
 * 그래서 콘솔이 목록 밖 룸을 정확히 한 개 집어올 수 있어야 한다. 날짜 필터가
 * 다시 room_id 를 덮으면 그 버튼은 조용히 죽는다 — 이 파일이 그걸 막는다.
 */
import '@/test-utils/restoreWebPrimitives';
import { GET } from '@/app/api/admin/tour-ops/rooms/route';
import { requireAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';

jest.mock('@/lib/auth', () => ({ requireAdmin: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));

const requireAdminMock = requireAdmin as jest.Mock;
const createServerClientMock = createServerClient as jest.Mock;

const TOMORROW_ROOM = {
  id: 'room-tomorrow',
  booking_id: 'b-tomorrow',
  tour_id: 'tour-1',
  tour_date: '2026-08-08',
  status: 'active',
  created_at: '2026-08-01T00:00:00Z',
};

/** 어떤 필터가 실제로 걸렸는지 기록한다 — 그게 이 테스트의 관심사다. */
function fakeDb() {
  const filters: Array<{ method: string; column: string; value: unknown }> = [];
  createServerClientMock.mockReturnValue({
    filters,
    from(table: string) {
      const chain: Record<string, unknown> = {};
      chain.select = jest.fn(() => chain);
      chain.eq = jest.fn((column: string, value: unknown) => {
        if (table === 'tour_rooms') filters.push({ method: 'eq', column, value });
        return chain;
      });
      chain.in = jest.fn(() => chain);
      chain.order = jest.fn(() => chain);
      // 라우트는 메시지 조회에서 `.limit(300)` 까지 이어 붙인다 — 체인에 없으면
      // 500 이 나고, 그러면 이 파일은 room_id 가 아니라 픽스처를 재게 된다.
      chain.limit = jest.fn(() => chain);
      chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => {
        const data = table === 'tour_rooms' ? [TOMORROW_ROOM] : [];
        return Promise.resolve({ data, error: null }).then(res, rej);
      };
      return chain;
    },
  });
  return filters;
}

const req = (qs: string) =>
  ({ nextUrl: { searchParams: new URLSearchParams(qs) }, headers: { get: () => null } }) as never;

beforeEach(() => {
  jest.clearAllMocks();
  requireAdminMock.mockResolvedValue({ id: 'admin-1', role: 'admin' });
});

describe('GET /api/admin/tour-ops/rooms', () => {
  it('🔴 finds a room on ANOTHER day when asked by id — no date filter', async () => {
    const filters = fakeDb();
    const res = await GET(req('room_id=room-tomorrow'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { rooms: Array<{ id: string }> };
    expect(body.rooms.map((r) => r.id)).toEqual(['room-tomorrow']);
    // 날짜로 좁히면 오늘이 아닌 룸은 못 찾는다 — 그게 원래 버그였다.
    expect(filters).toContainEqual({ method: 'eq', column: 'id', value: 'room-tomorrow' });
    expect(filters.some((f) => f.column === 'tour_date')).toBe(false);
  });

  it('still lists by date when no room_id is given', async () => {
    const filters = fakeDb();
    const res = await GET(req('date=2026-08-08'));
    expect(res.status).toBe(200);
    expect(filters).toContainEqual({ method: 'eq', column: 'tour_date', value: '2026-08-08' });
    expect(filters.some((f) => f.column === 'id')).toBe(false);
  });

  it('rejects a malformed date, but only when the date is what it is going by', async () => {
    fakeDb();
    expect((await GET(req('date=nope'))).status).toBe(400);
    // room_id 로 부를 때는 date 를 아예 안 보므로 400 이 나면 안 된다.
    fakeDb();
    expect((await GET(req('room_id=room-tomorrow&date=nope'))).status).toBe(200);
  });
});
