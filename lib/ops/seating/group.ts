/**
 * §K B0.2 — 마스터 룸(그룹) 리졸버.
 *
 * 그룹은 `(tour_id, tour_date)` 1행이고 **파생 생성**된다(B0-D4). 수동 생성 UI를
 * 두지 않는 이유는 단순하다: 사람이 만들어야 하는 엔티티는 반드시 빠뜨려지고,
 * 빠뜨려진 그날은 차량도 정원도 시작 게이트도 앵커를 잃는다.
 *
 * 순수부(키 계산·정합 판정)와 I/O부(`ensureTourGroup`)를 한 파일에 두되
 * export를 나눠 둔다 — 순수부는 테스트가 DB 없이 돌린다.
 */

import type { RoomDbClient } from '@/lib/tour-room/access';

// ---------------------------------------------------------------------------
// 순수부
// ---------------------------------------------------------------------------

export interface TourGroupKey {
  tourId: string;
  tourDate: string;
}

export interface GroupResolvable {
  tour_id?: string | null;
  tour_date?: string | null;
}

/**
 * 룸/예약에서 그룹 키를 뽑는다. 둘 중 하나라도 없으면 **그룹을 만들 수 없다** —
 * null을 돌려주고, 호출부는 그룹 없이 진행한다(차량 배정 같은 그룹 필수 동작은
 * 거기서 거부된다). 임의의 기본값을 지어내지 않는다: "언제 어느 투어"를 모르는
 * 그룹은 정원도 좌석도 의미가 없다.
 */
export function tourGroupKey(row: GroupResolvable | null | undefined): TourGroupKey | null {
  const tourId = typeof row?.tour_id === 'string' ? row.tour_id.trim() : '';
  const tourDate = typeof row?.tour_date === 'string' ? row.tour_date.trim() : '';
  if (!tourId || !tourDate) return null;
  return { tourId, tourDate };
}

/** 두 룸이 같은 조인투어인가. 그룹 키가 같으면 같다 — 그게 조인투어의 정의다. */
export function sameTourGroup(a: GroupResolvable | null, b: GroupResolvable | null): boolean {
  const ka = tourGroupKey(a);
  const kb = tourGroupKey(b);
  if (!ka || !kb) return false;
  return ka.tourId === kb.tourId && ka.tourDate === kb.tourDate;
}

/**
 * 그룹 인원 = 그 그룹에 속한 **활성** 예약의 게스트 수 합.
 *
 * 취소는 세지 않는다(명단·집계 공통 규칙, A-7d soft cancel). 시뮬 예약도
 * 세지 않는다 — 호출부가 `dropSimBookings`를 먼저 태운 배열을 준다(A0.1).
 */
export function groupHeadcount(
  bookings: Array<{ number_of_guests?: number | null; status?: string | null }>,
): number {
  return bookings.reduce((sum, b) => {
    const status = (b.status ?? '').toLowerCase();
    if (status === 'cancelled' || status === 'canceled' || status === 'refunded') return sum;
    const n = typeof b.number_of_guests === 'number' && b.number_of_guests > 0 ? b.number_of_guests : 0;
    return sum + n;
  }, 0);
}

export type TourGroupStatus = 'planned' | 'started' | 'ended' | 'cancelled';

export interface TourGroupRow {
  id: string;
  tour_id: string;
  tour_date: string;
  capacity: number | null;
  status: TourGroupStatus;
  started_at: string | null;
  ended_at: string | null;
}

// ---------------------------------------------------------------------------
// I/O부
// ---------------------------------------------------------------------------

const GROUP_COLS = 'id, tour_id, tour_date, capacity, status, started_at, ended_at';

/**
 * 그룹을 보장한다 — 없으면 만들고, 있으면 그대로 돌려준다.
 *
 * upsert가 아니라 **select → insert → 경합 시 재select**인 이유: upsert는
 * capacity·status 같은 운영자가 넣은 값을 덮어쓸 위험이 있고, 이 함수는
 * "존재를 보장"할 뿐 내용을 정하지 않는다. 동시에 두 예약이 커밋되면 UNIQUE
 * (tour_id, tour_date)가 하나를 23505로 튕기고, 그때 다시 읽는다.
 *
 * 그룹 키를 만들 수 없으면(투어나 날짜가 없는 룸) null. 호출부가 판단한다.
 */
export async function ensureTourGroup(
  supabase: RoomDbClient,
  row: GroupResolvable,
): Promise<TourGroupRow | null> {
  const key = tourGroupKey(row);
  if (!key) return null;

  const existing = await readTourGroup(supabase, key);
  if (existing) return existing;

  const { data, error } = await supabase
    .from('ops_tour_groups')
    .insert({ tour_id: key.tourId, tour_date: key.tourDate })
    .select(GROUP_COLS)
    .single();

  if (!error && data) return data as TourGroupRow;

  // 23505 = 같은 순간 다른 예약이 먼저 만들었다. 경합은 정상 경로다.
  return readTourGroup(supabase, key);
}

/** 있으면 읽고 없으면 null — 만들지 않는다. */
export async function readTourGroup(
  supabase: RoomDbClient,
  key: TourGroupKey,
): Promise<TourGroupRow | null> {
  const { data, error } = await supabase
    .from('ops_tour_groups')
    .select(GROUP_COLS)
    .eq('tour_id', key.tourId)
    .eq('tour_date', key.tourDate)
    .maybeSingle();
  if (error || !data) return null;
  return data as TourGroupRow;
}

/**
 * 그룹에 속한 룸 전부. 조인투어의 "전체 명단"이 이 위에 선다.
 *
 * 🔴 룸은 예약당 1개이므로(`tour_rooms.booking_id` NOT NULL UNIQUE) 이 목록의
 * 길이가 곧 그 그룹의 예약 수다. 그룹 = 룸이라고 착각하면 정원 계산이 12배
 * 틀린다(B2-D2).
 */
export async function loadGroupRooms(
  supabase: RoomDbClient,
  key: TourGroupKey,
): Promise<Array<{ id: string; booking_id: string }>> {
  const { data, error } = await supabase
    .from('tour_rooms')
    .select('id, booking_id')
    .eq('tour_id', key.tourId)
    .eq('tour_date', key.tourDate);
  if (error || !data) return [];
  return data as Array<{ id: string; booking_id: string }>;
}
