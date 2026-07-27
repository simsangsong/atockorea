/**
 * @jest-environment node
 *
 * OTA 심사 대비 (2026-07-28) — 타임라인 완주 쿠폰 라우트의 채널 게이트.
 *
 * 이 스위트가 지키는 것은 UI가 아니라 **원장**이다. 화면에서 보상 블록을 감추는
 * 것(TravelTimeline)만으로는 부족하다 — 라우트가 그대로 열려 있으면 Klook/GYG로
 * 들어온 손님 앞으로 발급된 자사 쿠폰이 `coupon_grants`에 남고, 그게 심사에서
 * 걸리는 것보다 무거운 계약 실체가 된다. 그래서 여기서 발급 자체를 막는다.
 */
import '@/test-utils/restoreWebPrimitives';
import { POST as couponPOST } from '@/app/api/tour-rooms/[bookingId]/timeline-coupon/route';
import { createServerClient } from '@/lib/supabase';
import { requestGate } from '@/lib/durable-rate-limit';
import { resolveRoomActor } from '@/lib/tour-room/access';

jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));
jest.mock('@/lib/durable-rate-limit', () => ({
  requestGate: jest.fn(),
  clientIpKey: jest.fn(() => 'ip:test'),
}));
jest.mock('@/lib/tour-room/access', () => ({
  resolveRoomActor: jest.fn(),
  ensureRoom: jest.fn(async () => ({ id: 'room-b1' })),
}));

const createServerClientMock = createServerClient as jest.Mock;
const requestGateMock = requestGate as jest.Mock;
const resolveRoomActorMock = resolveRoomActor as jest.Mock;

/** 완주한 타임라인 — 도착 스팟 하나 + 사진 하나. */
const COMPLETE_ROWS = [
  {
    id: 'a1',
    source_text: 'arrived',
    created_at: '2099-07-20T03:00:00Z',
    metadata: { kind: 'spot_arrival', spot_title: 'Jusangjeolli' },
  },
  {
    id: 'p1',
    source_text: 'photo',
    created_at: '2099-07-20T04:00:00Z',
    metadata: { kind: 'vision_answer', image_url: 'https://cdn/x.jpg' },
  },
];

function fakeDb() {
  const inserts: Record<string, Array<Record<string, unknown>>> = {};
  const client = {
    inserts,
    from(table: string) {
      const chain: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'order', 'limit']) {
        chain[m] = jest.fn(() => chain);
      }
      // 피드 재집계 (await 되는 종점)
      if (table === 'tour_room_messages') {
        chain.limit = jest.fn(async () => ({ data: COMPLETE_ROWS, error: null }));
      }
      chain.maybeSingle = jest.fn(async () => {
        if (table === 'promo_codes') {
          return { data: { id: 'promo-1', code: 'TIMELINE10', is_active: true, grant_validity_days: 90 }, error: null };
        }
        return { data: null, error: null };
      });
      chain.insert = jest.fn(async (values: Record<string, unknown>) => {
        (inserts[table] ??= []).push(values);
        return { error: null };
      });
      return chain;
    },
  };
  return client;
}

const params = () => ({ params: Promise.resolve({ bookingId: 'b1' }) });
const req = () => ({ headers: { get: () => 'session' } }) as never;

function actorFor(source: string | null) {
  return {
    ok: true,
    booking: { id: 'b1', tour_date: '2099-07-20', source },
    actor: { kind: 'session', sessionPayload: { participantId: 'p-cust' } },
    authUserId: 'user-1',
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  requestGateMock.mockResolvedValue({ allowed: true, retryAfterMs: 0 });
});

describe('POST /timeline-coupon — 예약 채널 게이트', () => {
  it('직접 예약에는 지금까지처럼 발급한다', async () => {
    const db = fakeDb();
    createServerClientMock.mockReturnValue(db);
    resolveRoomActorMock.mockResolvedValue(actorFor('tour_product'));

    const res = await couponPOST(req(), params());
    const json = await res.json();

    expect(json.granted).toBe(true);
    expect(json.code).toBe('TIMELINE10');
    expect(db.inserts.coupon_grants).toHaveLength(1);
  });

  it('🔴 OTA 예약에는 쿠폰 원장을 만들지 않는다', async () => {
    for (const source of ['klook', 'gyg', 'getyourguide', 'viator', 'kkday', 'tripadvisor']) {
      const db = fakeDb();
      createServerClientMock.mockReturnValue(db);
      resolveRoomActorMock.mockResolvedValue(actorFor(source));

      const res = await couponPOST(req(), params());
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.granted).toBe(false);
      expect(json.reason).toBe('not_available');
      // 원장에 아무것도 남지 않는 것이 이 테스트의 전부다.
      expect(db.inserts.coupon_grants).toBeUndefined();
    }
  });

  it('🔴 모르는 채널도 OTA로 보고 막는다 (실패 방향 고정)', async () => {
    const db = fakeDb();
    createServerClientMock.mockReturnValue(db);
    resolveRoomActorMock.mockResolvedValue(actorFor('some_new_reseller'));

    const json = await (await couponPOST(req(), params())).json();
    expect(json.granted).toBe(false);
    expect(db.inserts.coupon_grants).toBeUndefined();
  });

  it('게이트가 레이트리밋보다 앞이라 OTA 요청은 조회조차 하지 않는다', async () => {
    createServerClientMock.mockReturnValue(fakeDb());

    resolveRoomActorMock.mockResolvedValue(actorFor('klook'));
    await couponPOST(req(), params());
    expect(requestGateMock).not.toHaveBeenCalled();

    resolveRoomActorMock.mockResolvedValue(actorFor('tour_product'));
    await couponPOST(req(), params());
    expect(requestGateMock).toHaveBeenCalled();
  });
});
