/**
 * DE3 (진입점 감사 2026-07-27) — 손님 화면의 차량 안내 줄은 살아 있는 배차를 봐야 한다.
 *
 * `tour_bus_details`는 손님 홈의 차량 줄 · 로비 카드 · 스냅샷 · 기사 PIN 폴백
 * 네 곳에서 **읽히는데**, 쓰는 경로는 어떤 UI도 부르지 않는 API 라우트 하나뿐이었다.
 * 즉 관제에서 아무리 정상적으로 배차해도 손님에게는 차량 줄이 영원히 비어 있었다.
 * (`lib/tour-room/driver.ts`의 주석이 이미 "the old sheet"라고 적어 두었다.)
 *
 * 여기서 고정하는 계약:
 *   1. 옛 시트에 값이 있으면 그것이 이긴다 — 운영자가 손으로 적은 것을 덮지 않는다.
 *   2. 옛 시트가 비면 배차에서 만든다 — 그래야 배차가 손님에게 보인다.
 *   3. 배차 행은 있는데 내용이 전부 비면 없는 것으로 둔다 — 빈 줄을 만들지 않는다.
 */
import { resolveBusDetail } from '@/lib/tour-room/snapshot';
import { vehicleLineFromPayload } from '@/components/tour-mode/LobbyCard';

const DISPATCH = {
  plate_number: '12가 3456',
  driver_name: '김기사',
  vehicle_layouts: { model: 'county_20', display_name: { ko: '카운티 20인승' } },
};

describe('🔴 DE3 — 차량 줄은 살아 있는 배차에서 나온다', () => {
  it('옛 시트에 값이 있으면 그것이 이긴다', () => {
    const legacy = { payload: { bus_number: '99바9999' } };
    expect(resolveBusDetail(legacy, DISPATCH)).toBe(legacy);
  });

  it('옛 시트가 비어 있으면 배차에서 만든다', () => {
    const out = resolveBusDetail(null, DISPATCH);
    expect(out).toEqual({
      payload: { vehicle_model: '카운티 20인승', plate_number: '12가 3456', driver_name: '김기사' },
      source: 'ops_room_vehicles',
    });
  });

  it('만들어진 payload가 실제 표시 함수를 통과한다 — 모양이 어긋나면 줄이 안 나온다', () => {
    const out = resolveBusDetail(null, DISPATCH);
    expect(vehicleLineFromPayload((out as { payload: unknown }).payload)).toBe(
      '카운티 20인승 · 12가 3456 · 김기사',
    );
  });

  it('번호판이 아직 없어도(렌트 당일 확정) 차종만으로 줄이 선다', () => {
    const out = resolveBusDetail(null, { plate_number: null, driver_name: null, vehicle_layouts: DISPATCH.vehicle_layouts });
    expect(vehicleLineFromPayload((out as { payload: unknown }).payload)).toBe('카운티 20인승');
  });

  it('배차 행이 전부 비면 빈 줄을 만들지 않는다', () => {
    expect(resolveBusDetail(null, { plate_number: null, driver_name: null, vehicle_layouts: null })).toBeNull();
  });

  it('배차도 옛 시트도 없으면 null', () => {
    expect(resolveBusDetail(null, null)).toBeNull();
  });

  it('옛 시트 행은 있는데 payload가 비었으면 배차가 채운다', () => {
    const out = resolveBusDetail({ payload: {} }, DISPATCH);
    expect((out as { source?: string }).source).toBe('ops_room_vehicles');
  });
});
