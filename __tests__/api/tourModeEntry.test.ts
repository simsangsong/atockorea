/**
 * @jest-environment node
 *
 * POST /api/tour-mode/entry — 입장 코드 문(entry-code plan §C-2)의 라우트 계약.
 *
 * 이 문은 무크레덴셜이다(코드가 곧 자격) — 그래서 라우트 계약이 곧 보안 계약이다:
 *   · 성공: 기존 토큰 기계로 발급된 ?rt= 상대 URL + 원장 1행(sent_via 'entry-code')
 *   · 실패: 균일한 404(모르는 코드·취소), 한때 유효했던 것만 410(expired/revoked)
 *   · 과속: 429 + Retry-After
 */
import '@/test-utils/restoreWebPrimitives';
import { POST } from '@/app/api/tour-mode/entry/route';
import { verifyRoomToken } from '@/lib/tour-room/token';
import { createServerClient } from '@/lib/supabase';
import { __resetRequestGateMemory } from '@/lib/durable-rate-limit';
import { fakeNextRequest } from '@/test-utils/opsSeatingFakes';

jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));

const createServerClientMock = createServerClient as jest.Mock;

const FUTURE = '2999-07-20';

const BOOKING = {
  id: 'booking-1',
  tour_id: 'tour-1',
  tour_date: FUTURE,
  status: 'confirmed',
  contact_name: 'Emily Johnson',
  preferred_language: 'en',
  booking_reference: 'A2C-12AB34CD',
};

interface FakeState {
  inviteInserts: Array<Record<string, unknown>>;
  booking?: Record<string, unknown> | null;
  invite?: Record<string, unknown> | null;
}

function fakeDb(state: FakeState) {
  return {
    from(table: string) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chain: any = {};
      const resolve = async () => {
        if (table === 'bookings') return { data: state.booking ?? null, error: null };
        if (table === 'tour_room_invites') return { data: state.invite ?? null, error: null };
        if (table === 'tour_rooms') {
          return {
            data: { id: 'room-1', booking_id: 'booking-1', tour_id: 'tour-1', tour_date: FUTURE, status: 'active' },
            error: null,
          };
        }
        if (table === 'tours') return { data: { title: 'Busan Top Attractions' }, error: null };
        return { data: null, error: null };
      };
      for (const m of ['select', 'eq', 'is', 'ilike', 'limit', 'order', 'update']) {
        chain[m] = jest.fn(() => chain);
      }
      chain.single = jest.fn(resolve);
      chain.maybeSingle = jest.fn(resolve);
      chain.then = (r: (v: unknown) => unknown) => resolve().then(r);
      chain.insert = jest.fn((values: Record<string, unknown>) => {
        if (table === 'tour_room_invites') state.inviteInserts.push(values);
        return { then: (r: (v: unknown) => unknown) => r({ data: null, error: null }), error: null };
      });
      return chain;
    },
  };
}

const req = (body: unknown, ip = '203.0.113.7') =>
  fakeNextRequest({ headers: { 'x-forwarded-for': ip }, body });

beforeEach(() => {
  jest.clearAllMocks();
  __resetRequestGateMemory();
  process.env.TOUR_ROOM_TOKEN_SECRET = 'unit-test-secret';
});

describe('POST /api/tour-mode/entry', () => {
  it('상설 코드 → 상대 URL + 검증 가능한 토큰 + entry-code 원장', async () => {
    const state: FakeState = { inviteInserts: [], booking: BOOKING };
    createServerClientMock.mockReturnValue(fakeDb(state));

    const res = await POST(req({ code: 'a2c 12ab34cd' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.kind).toBe('customer');
    // 절대 URL 이면 dev 브라우저가 프로덕션으로 튄다 — 상대 경로 계약.
    expect(json.url).toMatch(/^\/tour-mode\/room\/booking-1\?rt=/);
    expect(json.tourTitle).toBe('Busan Top Attractions');
    expect(json.guestName).toBe('Emily J.');

    const rt = decodeURIComponent(json.url.split('?rt=')[1]);
    expect(verifyRoomToken(rt)).toMatchObject({ scope: 'booking', bookingId: 'booking-1' });

    expect(state.inviteInserts).toHaveLength(1);
    expect(state.inviteInserts[0]).toMatchObject({
      booking_id: 'booking-1',
      role: 'customer',
      sent_via: 'entry-code',
    });
  });

  it('?to=plan 은 /plan 착지를 준다 (프라이빗 초대 CTA 경로)', async () => {
    const state: FakeState = { inviteInserts: [], booking: BOOKING };
    createServerClientMock.mockReturnValue(fakeDb(state));
    const res = await POST(req({ code: 'A2C-12AB34CD', to: 'plan' }));
    const json = await res.json();
    expect(json.url).toMatch(/^\/tour-mode\/plan\/booking-1\?rt=/);
  });

  it('모르는 코드는 균일한 404', async () => {
    const state: FakeState = { inviteInserts: [], booking: null };
    createServerClientMock.mockReturnValue(fakeDb(state));
    const res = await POST(req({ code: 'A2C-00000000' }));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('not_found');
    expect(state.inviteInserts).toHaveLength(0);
  });

  it('revoke 된 발송 별칭은 410 revoked — 재발송이 옛 링크를 죽였다는 뜻', async () => {
    const state: FakeState = {
      inviteInserts: [],
      invite: {
        id: 'inv-1',
        role: 'customer',
        booking_id: 'booking-1',
        tour_id: 'tour-1',
        tour_date: FUTURE,
        display_name: 'Emily Johnson',
        expires_at: '2999-07-21T00:00:00Z',
        revoked_at: '2026-08-08T00:00:00Z',
        short_code: 'K7M2P9QX22',
      },
    };
    createServerClientMock.mockReturnValue(fakeDb(state));
    const res = await POST(req({ code: 'K7M2P9QX22' }));
    expect(res.status).toBe(410);
    expect((await res.json()).error).toBe('revoked');
  });

  it('driver 별칭 → 기사 콘솔 URL (PIN 게이트는 join 이 그대로 요구)', async () => {
    const state: FakeState = {
      inviteInserts: [],
      invite: {
        id: 'inv-2',
        role: 'driver',
        booking_id: null,
        tour_id: 'tour-1',
        tour_date: FUTURE,
        display_name: '기사님',
        expires_at: '2999-07-21T00:00:00Z',
        revoked_at: null,
        short_code: 'DRVR2PQX22',
      },
    };
    createServerClientMock.mockReturnValue(fakeDb(state));
    const res = await POST(req({ code: 'DRVR2PQX22' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.kind).toBe('driver');
    expect(json.url).toMatch(/^\/tour-mode\/driver\?rt=/);
    expect(state.inviteInserts[0]).toMatchObject({ role: 'driver', sent_via: 'entry-code' });
  });

  it('분당 12회를 넘기면 429 + Retry-After', async () => {
    const state: FakeState = { inviteInserts: [], booking: null };
    createServerClientMock.mockReturnValue(fakeDb(state));
    let last: Response | null = null;
    for (let i = 0; i < 13; i += 1) {
      last = await POST(req({ code: 'A2C-00000000' }, '198.51.100.9'));
    }
    expect(last!.status).toBe(429);
    expect(last!.headers.get('Retry-After')).toBeTruthy();
  });
});
