/**
 * DE8 (사장님 확정 2026-07-28) — "현재는 전부 호텔픽업이라 픽업지 묶음은 없어도 돼,
 * 다만 각 픽업 디테일은 나와줘야돼."
 *
 * 값이 두 군데에 산다: 구조화된 `pickup_points` 조인(라이브 0건, 링크도 전부 null)과
 * OTA 파서가 뽑은 `ota_raw_meta.pickup_*`(라이브 예약이 실제로 갖고 있는 것).
 * 관제 명단 라우트는 후자를 폴백으로 읽었지만 **손님 스냅샷은 전자만 읽었다.**
 * 그래서 같은 예약을 가이드는 보고 손님은 못 봤다.
 *
 * 이 스위트가 고정하는 것: 두 소비처가 같은 함수를 쓰고, 구조화된 지점이 우선이며,
 * 값이 없으면 빈 줄 대신 null 이 나온다.
 */
import { pickupDetailAsJoin, resolvePickupDetail } from '@/lib/bookings/pickupDetail';
import { buildPickupSequence } from '@/lib/tour-room/snapshot';

describe('🔴 DE8 — 예약별 픽업 디테일', () => {
  it('구조화된 지점이 있으면 그것이 이긴다', () => {
    const out = resolvePickupDetail({
      pickup_points: { id: 'p1', name: 'Lotte City Hotel Jeju', address: '도령로 83', lat: 33.4, lng: 126.5, pickup_time: '08:30' },
      ota_raw_meta: { pickup_raw: '다른 값', pickup_time: '09:00' },
    });
    expect(out).toMatchObject({ pickup_point_id: 'p1', name: 'Lotte City Hotel Jeju', pickup_time: '08:30' });
  });

  it('지점이 없으면 OTA 원문으로 채운다 — 라이브 예약의 실제 모습', () => {
    const out = resolvePickupDetail({
      pickup_points: null,
      ota_raw_meta: {
        pickup_normalized: 'Ocean Suites Jeju Hotel',
        pickup_raw: 'Ocean Suites Jeju Hotel, Tapdonghaean-ro, Samdo 2(i)-dong, Jeju-si',
        pickup_time: '08:00',
      },
    });
    expect(out).toMatchObject({ name: 'Ocean Suites Jeju Hotel', pickup_time: '08:00' });
    // 정규화된 이름을 썼으면 원문은 주소로 남긴다 — 기사가 찾아갈 정보다.
    expect(out!.address).toContain('Tapdonghaean-ro');
    expect(out!.pickup_point_id).toBeNull();
  });

  it('정규화 없이 원문만 있으면 원문이 이름이 되고 주소는 중복하지 않는다', () => {
    const out = resolvePickupDetail({ ota_raw_meta: { pickup_raw: '서부두2길', pickup_time: '08:00' } });
    expect(out).toMatchObject({ name: '서부두2길', address: null });
  });

  it('시각만 있어도 보여준다 — 시각은 손님이 제일 먼저 찾는 값이다', () => {
    expect(resolvePickupDetail({ ota_raw_meta: { pickup_time: '07:45' } })).toMatchObject({
      name: null,
      pickup_time: '07:45',
    });
  });

  it('아무 값도 없으면 null — 빈 줄을 만들지 않는다', () => {
    expect(resolvePickupDetail({ pickup_points: null, ota_raw_meta: {} })).toBeNull();
    expect(resolvePickupDetail({})).toBeNull();
  });

  it('조인 임베드가 1원소 배열로 와도 읽는다 (PostgREST 계약)', () => {
    const out = resolvePickupDetail({ pickup_points: [{ name: 'Shilla', pickup_time: '08:10' }] });
    expect(out).toMatchObject({ name: 'Shilla', pickup_time: '08:10' });
  });

  it('손님 화면이 읽는 조인 모양으로 되돌린다 — 소비처는 무변경', () => {
    const join = pickupDetailAsJoin(resolvePickupDetail({ ota_raw_meta: { pickup_raw: 'Hotel A', pickup_time: '08:00' } }));
    expect(join).toMatchObject({ name: 'Hotel A', pickup_time: '08:00' });
    expect(pickupDetailAsJoin(null)).toBeNull();
  });
});

describe('🔴 DE8 — 픽업 순서가 OTA 값만 있는 예약을 빠뜨리지 않는다', () => {
  it('구조화된 지점이 없어도 순서에 들어가고 시각순으로 정렬된다', () => {
    const stops = buildPickupSequence([
      { id: 'b2', pickup_points: null, ota_raw_meta: { pickup_raw: 'Hotel B', pickup_time: '08:30' } },
      { id: 'b1', pickup_points: null, ota_raw_meta: { pickup_raw: 'Hotel A', pickup_time: '08:00' } },
      { id: 'b3', pickup_points: null, ota_raw_meta: {} },
    ]);
    // 값이 없는 b3 는 정류지가 아니다 — 빈 칸을 만들지 않는다.
    expect(stops.map((s) => s.booking_id)).toEqual(['b1', 'b2']);
    expect(stops[0]).toMatchObject({ name: 'Hotel A', pickup_time: '08:00' });
  });
});
