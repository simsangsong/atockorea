/**
 * 예약 한 건의 픽업 디테일 — **하나의 리졸버**.
 *
 * 사장님 확정(2026-07-28): "현재는 전부 호텔픽업이라 픽업지 묶음은 없어도 돼,
 * 다만 각 픽업 디테일은 나와줘야돼." 즉 표준지점으로 모으는 일은 지금 필요 없고,
 * **예약마다 어느 호텔 몇 시인지가 보여야 한다.**
 *
 * 그런데 그 값이 두 군데에 산다:
 *   ① `bookings.pickup_point_id → pickup_points` — 구조화된 지점(라이브 0건, 링크도 전부 null)
 *   ② `bookings.ota_raw_meta.pickup_{raw,normalized,time}` — OTA 파서가 뽑은 실제 값
 *
 * 라이브 예약이 실제로 갖고 있는 것은 ②다("Ocean Suites Jeju Hotel, Tapdonghaean-ro,
 * … / 08:00"). 관제 명단 라우트는 ②를 폴백으로 읽고 있었지만 **손님 앱 스냅샷은
 * ①만 읽었다.** 그래서 손님은 자기 픽업 디테일을 볼 수 없었고, 가이드는 볼 수
 * 있었다 — 같은 예약을 두 화면이 다르게 본 것이다.
 *
 * 그 드리프트가 재발하지 않도록 두 소비처가 이 함수 하나를 쓴다.
 */

export interface PickupDetail {
  /** `pickup_points.id` — ②에서 온 값이면 null(지점 행이 없으므로). */
  pickup_point_id: string | null;
  name: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  /** 'HH:MM'. */
  pickup_time: string | null;
}

interface PickupJoin {
  id?: string | null;
  name?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  pickup_time?: string | null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** PostgREST 임베드는 객체 또는 1원소 배열로 온다. */
function firstJoin(value: unknown): PickupJoin | null {
  const point = Array.isArray(value) ? value[0] : value;
  return point && typeof point === 'object' ? (point as PickupJoin) : null;
}

/**
 * 구조화된 지점이 있으면 그것이 이긴다(운영자가 명시적으로 붙인 것이므로).
 * 없을 때만 OTA 원문으로 채운다. 둘 다 없으면 null — 빈 줄을 만들지 않는다.
 */
export function resolvePickupDetail(row: {
  pickup_points?: unknown;
  ota_raw_meta?: unknown;
}): PickupDetail | null {
  const point = firstJoin(row?.pickup_points);
  const meta = (row?.ota_raw_meta && typeof row.ota_raw_meta === 'object'
    ? (row.ota_raw_meta as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  // 이름은 정규화된 값을 먼저 쓴다 — 원문은 주소가 통째로 붙어 있어 길다.
  const name = text(point?.name) ?? text(meta.pickup_normalized) ?? text(meta.pickup_raw);
  const time = text(point?.pickup_time) ?? text(meta.pickup_time);
  if (!name && !time) return null;

  return {
    pickup_point_id: text(point?.id),
    name,
    // 정규화된 이름을 쓴 경우 원문에 주소 상세가 남아 있으면 그것을 주소로 보여준다.
    address:
      text(point?.address) ??
      (name && text(meta.pickup_raw) && text(meta.pickup_raw) !== name ? text(meta.pickup_raw) : null),
    lat: num(point?.lat),
    lng: num(point?.lng),
    pickup_time: time,
  };
}

/**
 * 손님 화면이 이미 읽고 있는 조인 모양으로 되돌린다. 소비처(`firstPickup` →
 * `LobbyCard`/`HomeTab`)를 건드리지 않고 값만 채우기 위한 어댑터다.
 */
export function pickupDetailAsJoin(detail: PickupDetail | null): PickupJoin | null {
  if (!detail) return null;
  return {
    id: detail.pickup_point_id,
    name: detail.name,
    address: detail.address,
    lat: detail.lat,
    lng: detail.lng,
    pickup_time: detail.pickup_time,
  };
}
