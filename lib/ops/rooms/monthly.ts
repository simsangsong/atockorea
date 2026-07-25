/**
 * 투어룸 월간 집계 — 관제 W3.
 *
 * 라우트가 읽어온 원시 행들을 화면이 그대로 쓰는 모양으로 접는다. 순수 함수라
 * 네트워크 없이 테스트한다.
 *
 * 이 집계가 답해야 하는 질문은 "이번 달에 방이 몇 개 열렸나"가 아니라
 * **"열어놓고 아무도 안 들어온 방이 몇 개인가"**다. 초대는 나갔는데 손님이
 * 한 번도 접속하지 않은 방은 투어 당일에야 발견되고, 그때는 늦다. 그래서
 * `health` 판정이 이 모듈의 본체다.
 */

/**
 * 한 번에 스캔하는 하위 행의 상한. 닿으면 잘라내지 않고 **truncated로 보고한다** —
 * 조용히 자른 집계는 그럴듯하게 틀린 숫자가 되고, 사람은 그 숫자를 믿는다.
 */
export const MONTHLY_ROOM_SCAN_LIMIT = 5000;

export interface RoomMonthInputs {
  period: string;
  rooms: Array<{
    id: string;
    booking_id: string;
    tour_id: string | null;
    tour_date: string | null;
    status: string;
    created_at: string | null;
    updated_at?: string | null;
  }>;
  bookings: Array<{
    id: string;
    contact_name: string | null;
    number_of_guests: number | null;
    preferred_language: string | null;
    status: string | null;
    booking_reference: string | null;
    source: string | null;
  }>;
  tours: Array<{ id: string; title: string | null; city: string | null }>;
  participants: Array<{ room_id: string; role: string | null; last_seen_at: string | null }>;
  messages: Array<{ room_id: string; sender_role: string | null; created_at: string }>;
  /**
   * 초대는 **room_id가 아니라 booking_id로 걸린다**(tour_room_invites 실스키마).
   * 수락 시각 컬럼도 없다 — 링크를 썼는지는 참가자 행이 생겼는지로만 알 수 있다.
   * 그래서 여기서는 "몇 장 발급했고 몇 장이 아직 살아 있나"까지만 센다.
   */
  invites: Array<{ booking_id: string; revoked_at: string | null; expires_at: string | null }>;
  /** 만료 판정 기준 시각. 테스트가 고정할 수 있게 주입받는다. */
  now?: string;
}

/**
 * 방의 상태 한 줄.
 *   · `dead`   — 초대는 나갔는데 손님이 한 번도 들어오지 않았다. 손을 써야 한다.
 *   · `quiet`  — 손님은 있는데 대화가 없다. 정상일 수도 있다(당일 전).
 *   · `active` — 손님이 들어왔고 대화가 있었다.
 *   · `closed` — 방이 닫혔다.
 */
export type RoomHealth = 'dead' | 'quiet' | 'active' | 'closed';

export interface RoomMonthRow {
  id: string;
  bookingId: string;
  bookingReference: string | null;
  tourDate: string | null;
  status: string;
  createdAt: string | null;
  tourTitle: string | null;
  city: string | null;
  contactName: string | null;
  guests: number | null;
  language: string | null;
  channel: string | null;
  /** 손님 참가자 수(가이드·기사·운영자 제외). */
  guestCount: number;
  /** 전체 참가자 수. */
  participantCount: number;
  inviteCount: number;
  /** 아직 유효한 초대 링크 수(만료·회수되지 않은 것). */
  liveInviteCount: number;
  messageCount: number;
  /** 손님이 보낸 메시지 수 — "대화가 있었는가"의 진짜 신호. */
  guestMessageCount: number;
  lastActivityAt: string | null;
  health: RoomHealth;
}

export interface RoomMonthResult {
  period: string;
  rows: RoomMonthRow[];
  summary: {
    roomCount: number;
    guestTotal: number;
    activeCount: number;
    quietCount: number;
    deadCount: number;
    closedCount: number;
    messageTotal: number;
  };
  /** 하위 행 스캔이 상한에 닿았는가 — 닿았다면 집계는 하한이다. */
  truncated: boolean;
}

/** 손님이 아닌 역할. 이 목록에 없는 역할은 손님으로 센다(모르는 역할을 빠뜨리지 않게). */
const STAFF_ROLES = new Set(['guide', 'driver', 'ops', 'admin', 'system']);

function isStaff(role: string | null | undefined): boolean {
  return role != null && STAFF_ROLES.has(role);
}

/** 두 ISO 시각 중 더 나중. null 안전. */
function laterOf(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

export function buildRoomMonth(input: RoomMonthInputs): RoomMonthResult {
  const bookingById = new Map(input.bookings.map((b) => [b.id, b]));
  const tourById = new Map(input.tours.map((t) => [t.id, t]));

  const participantsByRoom = new Map<string, { total: number; guests: number; lastSeen: string | null }>();
  for (const p of input.participants) {
    const bucket = participantsByRoom.get(p.room_id) ?? { total: 0, guests: 0, lastSeen: null };
    bucket.total += 1;
    if (!isStaff(p.role)) bucket.guests += 1;
    bucket.lastSeen = laterOf(bucket.lastSeen, p.last_seen_at);
    participantsByRoom.set(p.room_id, bucket);
  }

  const messagesByRoom = new Map<string, { total: number; guest: number; last: string | null }>();
  for (const m of input.messages) {
    const bucket = messagesByRoom.get(m.room_id) ?? { total: 0, guest: 0, last: null };
    bucket.total += 1;
    if (!isStaff(m.sender_role)) bucket.guest += 1;
    bucket.last = laterOf(bucket.last, m.created_at);
    messagesByRoom.set(m.room_id, bucket);
  }

  // 초대는 booking_id로 걸리므로 방이 아니라 예약 단위로 접는다.
  const now = input.now ?? new Date().toISOString();
  const invitesByBooking = new Map<string, { total: number; live: number }>();
  for (const i of input.invites) {
    const bucket = invitesByBooking.get(i.booking_id) ?? { total: 0, live: 0 };
    bucket.total += 1;
    const expired = i.expires_at != null && i.expires_at <= now;
    if (!i.revoked_at && !expired) bucket.live += 1;
    invitesByBooking.set(i.booking_id, bucket);
  }

  const rows: RoomMonthRow[] = input.rooms.map((room) => {
    const booking = bookingById.get(room.booking_id);
    const tour = room.tour_id ? tourById.get(room.tour_id) : undefined;
    const people = participantsByRoom.get(room.id) ?? { total: 0, guests: 0, lastSeen: null };
    const msgs = messagesByRoom.get(room.id) ?? { total: 0, guest: 0, last: null };
    const invites = invitesByBooking.get(room.booking_id) ?? { total: 0, live: 0 };

    const lastActivityAt = laterOf(people.lastSeen, msgs.last);

    let health: RoomHealth;
    if (room.status !== 'active') health = 'closed';
    else if (people.guests === 0) health = 'dead';
    else if (msgs.guest === 0) health = 'quiet';
    else health = 'active';

    return {
      id: room.id,
      bookingId: room.booking_id,
      bookingReference: booking?.booking_reference ?? null,
      tourDate: room.tour_date,
      status: room.status,
      createdAt: room.created_at,
      tourTitle: tour?.title ?? null,
      city: tour?.city ?? null,
      contactName: booking?.contact_name ?? null,
      guests: booking?.number_of_guests ?? null,
      language: booking?.preferred_language ?? null,
      channel: booking?.source ?? null,
      guestCount: people.guests,
      participantCount: people.total,
      inviteCount: invites.total,
      liveInviteCount: invites.live,
      messageCount: msgs.total,
      guestMessageCount: msgs.guest,
      lastActivityAt,
      health,
    };
  });

  const summary = {
    roomCount: rows.length,
    guestTotal: rows.reduce((sum, r) => sum + (r.guests ?? 0), 0),
    activeCount: rows.filter((r) => r.health === 'active').length,
    quietCount: rows.filter((r) => r.health === 'quiet').length,
    deadCount: rows.filter((r) => r.health === 'dead').length,
    closedCount: rows.filter((r) => r.health === 'closed').length,
    messageTotal: rows.reduce((sum, r) => sum + r.messageCount, 0),
  };

  const truncated =
    input.participants.length >= MONTHLY_ROOM_SCAN_LIMIT ||
    input.messages.length >= MONTHLY_ROOM_SCAN_LIMIT ||
    input.invites.length >= MONTHLY_ROOM_SCAN_LIMIT;

  return { period: input.period, rows, summary, truncated };
}

export const ROOM_HEALTH_LABEL: Record<RoomHealth, string> = {
  active: '대화 중',
  quiet: '입장만',
  dead: '미입장',
  closed: '종료',
};

/** 내보내기용 표(AoA). W6의 xlsx·csv 엔진이 그대로 받는다. */
export function roomMonthToAoa(result: RoomMonthResult): Array<Array<string | number>> {
  const header = [
    '투어일', '예약번호', '상품', '도시', '대표자', '인원', '언어', '채널',
    '상태', '손님 입장', '초대(유효)', '메시지(손님)', '마지막 활동',
  ];
  const rows = result.rows.map((r) => [
    r.tourDate ?? '',
    r.bookingReference ?? '',
    r.tourTitle ?? '',
    r.city ?? '',
    r.contactName ?? '',
    r.guests ?? 0,
    r.language ?? '',
    r.channel ?? '',
    ROOM_HEALTH_LABEL[r.health],
    r.guestCount,
    `${r.inviteCount}(${r.liveInviteCount})`,
    `${r.guestMessageCount}/${r.messageCount}`,
    r.lastActivityAt ? r.lastActivityAt.slice(0, 16).replace('T', ' ') : '',
  ]);
  return [header, ...rows];
}
