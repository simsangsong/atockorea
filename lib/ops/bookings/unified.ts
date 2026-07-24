/**
 * §K B1.1 — 전 채널 예약 통합 리졸버. 순수부.
 *
 * 세 개의 평면을 **하나의 레코드 형태**로 정규화하되, **하나의 숫자로 합치지
 * 않는다**(B1-D1):
 *
 *   ① confirmed      `bookings` 행 — 실제 예약
 *   ② pending_review `ops_email_parse_logs.commit_result='review_queued'`
 *                    — 파싱은 됐고 사람 확정 대기
 *   ③ unparsed       `commit_result='failed'` + `ops_parse_failures`
 *                    — 예약이 되지 못한 메일
 *
 * 🔴 셋을 더한 하나의 숫자는 거짓말이다. 이 화면의 가치는 총합이 아니라
 * **틈** — 자동으로 커밋되지 못한 수요 — 에 있다.
 *
 * 🔴 B1-D2 — "투어룸에 포함 안 된 손님"도 한 개가 아니라 **세 개의 다른 실패**다:
 *   ⓐ `tour_rooms` 행 자체가 없는 booking
 *   ⓑ 룸은 있으나 참가자 0건 (아무도 안 들어옴)
 *   ⓒ 조인투어인데 좌석 미배정
 * 원인이 다르면 조치도 다르다. 합쳐 놓으면 "12명 누락"만 보이고 무엇을 해야
 * 하는지는 안 보인다.
 *
 * 🔴 A0.1 — 시뮬 예약은 호출부가 `dropSimBookings`로 먼저 떨어뜨린 배열을 준다.
 */

export type BookingTier = 'confirmed' | 'pending_review' | 'unparsed';

/** B1-D2 — 룸 누락의 세 가지 서로 다른 실패. */
export type RoomGap = 'no_room' | 'no_participant' | 'no_seat' | null;

export interface UnifiedRecord {
  tier: BookingTier;
  /** 티어 ①은 booking id, ②③은 로그/실패 행 id. 화면 키로만 쓴다. */
  id: string;
  /** 채널(OTA 또는 자체). 미상은 'unknown' — 빈 문자열로 두면 그룹이 사라진다. */
  channel: string;
  /** 투어일. ②③은 대개 없다(파싱 전이거나 실패했으므로). */
  tourDate: string | null;
  /** 유입 시각. 주간 카드의 "이번 주에 얼마나 들어왔나" 토글이 이걸 쓴다. */
  createdAt: string | null;
  guestName: string | null;
  partySize: number;
  /** 티어 ①에서만 의미가 있다. ②③은 항상 null. */
  roomGap: RoomGap;
  /** 화면에서 "왜 여기 있나"를 한 줄로 설명한다. */
  reason: string | null;
}

export interface UnifiedTierCounts {
  confirmed: number;
  pending_review: number;
  unparsed: number;
}

export interface UnifiedSummary {
  /** 🔴 티어별로만 센다. 총합 필드를 의도적으로 두지 않는다(B1-D1). */
  counts: UnifiedTierCounts;
  /** B1-D2 — 세 실패를 따로 센다. */
  roomGaps: { no_room: number; no_participant: number; no_seat: number };
  /** 확정 예약의 총 인원(운영 준비에 쓰는 숫자). */
  confirmedGuests: number;
  byChannel: Array<{ channel: string; tier: BookingTier; count: number }>;
}

// ── 입력 형태 (DB 행을 그대로 받는다) ────────────────────────────────────────

export interface BookingInput {
  id: string;
  tour_id?: string | null;
  tour_date?: string | null;
  created_at?: string | null;
  contact_name?: string | null;
  number_of_guests?: number | null;
  status?: string | null;
  source?: string | null;
}

export interface ParseLogInput {
  id: string;
  channel?: string | null;
  commit_result?: string | null;
  created_at?: string | null;
  booking_id?: string | null;
  error?: string | null;
  masked_summary?: Record<string, unknown> | null;
}

export interface ParseFailureInput {
  id: string;
  source_platform?: string | null;
  reason?: string | null;
  created_at?: string | null;
}

export interface RoomInput {
  booking_id: string;
  id: string;
}

export interface ParticipantInput {
  room_id: string;
}

export interface SeatInput {
  booking_id: string;
}

function normalizeChannel(raw: unknown): string {
  const value = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  return value || 'unknown';
}

function isActive(status: string | null | undefined): boolean {
  const s = (status ?? '').toLowerCase();
  return s !== 'cancelled' && s !== 'canceled' && s !== 'refunded';
}

function partyOf(n: unknown): number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/**
 * B1-D2 — 룸 누락 판정. **조인투어일 때만** 좌석 미배정을 실패로 본다:
 * 프라이빗은 좌석판 자체가 없는 경우가 정상이므로, 거기에 no_seat를 붙이면
 * 요주의 목록이 전부 프라이빗으로 채워져 진짜 누락이 묻힌다.
 */
export function roomGapFor(
  booking: BookingInput,
  ctx: { roomByBooking: Map<string, string>; participantsByRoom: Map<string, number>; seatedBookings: Set<string>; joinBookings: Set<string> },
): RoomGap {
  const roomId = ctx.roomByBooking.get(booking.id);
  if (!roomId) return 'no_room';
  if ((ctx.participantsByRoom.get(roomId) ?? 0) === 0) return 'no_participant';
  if (ctx.joinBookings.has(booking.id) && !ctx.seatedBookings.has(booking.id)) return 'no_seat';
  return null;
}

const GAP_REASON: Record<Exclude<RoomGap, null>, string> = {
  no_room: '투어룸이 아직 없음 — 링크 발급 필요',
  no_participant: '룸은 있으나 아무도 입장하지 않음 — 재발송 검토',
  no_seat: '조인투어인데 좌석 미배정 — 좌석판에서 배정',
};

/**
 * 세 평면을 정규화 레코드 배열로. 같은 입력 → 같은 출력(정렬 포함).
 *
 * 조인 여부는 호출부가 `joinBookings`로 알려준다 — 여기서 tourKind를 다시
 * 계산하면 판정이 두 곳에 살게 된다.
 */
export function buildUnifiedRecords(input: {
  bookings: BookingInput[];
  parseLogs?: ParseLogInput[];
  parseFailures?: ParseFailureInput[];
  rooms?: RoomInput[];
  participants?: ParticipantInput[];
  seats?: SeatInput[];
  joinBookingIds?: Iterable<string>;
}): UnifiedRecord[] {
  const roomByBooking = new Map<string, string>();
  for (const r of input.rooms ?? []) roomByBooking.set(r.booking_id, r.id);

  const participantsByRoom = new Map<string, number>();
  for (const p of input.participants ?? []) {
    participantsByRoom.set(p.room_id, (participantsByRoom.get(p.room_id) ?? 0) + 1);
  }

  const seatedBookings = new Set((input.seats ?? []).map((s) => s.booking_id));
  const joinBookings = new Set(input.joinBookingIds ?? []);
  const ctx = { roomByBooking, participantsByRoom, seatedBookings, joinBookings };

  const records: UnifiedRecord[] = [];

  // ① confirmed
  for (const b of input.bookings) {
    if (!isActive(b.status)) continue;
    const gap = roomGapFor(b, ctx);
    records.push({
      tier: 'confirmed',
      id: b.id,
      channel: normalizeChannel(b.source),
      tourDate: b.tour_date ?? null,
      createdAt: b.created_at ?? null,
      guestName: b.contact_name ?? null,
      partySize: partyOf(b.number_of_guests),
      roomGap: gap,
      reason: gap ? GAP_REASON[gap] : null,
    });
  }

  // ② pending_review — 사람 확정 대기. 이미 예약이 된 로그는 여기 오지 않는다.
  for (const log of input.parseLogs ?? []) {
    if (log.commit_result !== 'review_queued') continue;
    records.push({
      tier: 'pending_review',
      id: log.id,
      channel: normalizeChannel(log.channel),
      tourDate: readSummaryDate(log.masked_summary),
      createdAt: log.created_at ?? null,
      guestName: readSummaryName(log.masked_summary),
      partySize: 0, // 확정 전이라 인원을 주장하지 않는다
      roomGap: null,
      reason: '파싱됨 — 사람 확인 대기',
    });
  }

  // ③ unparsed — 예약이 되지 못한 메일. 두 소스가 같은 실패를 다르게 기록한다.
  for (const log of input.parseLogs ?? []) {
    if (log.commit_result !== 'failed') continue;
    records.push({
      tier: 'unparsed',
      id: log.id,
      channel: normalizeChannel(log.channel),
      tourDate: null,
      createdAt: log.created_at ?? null,
      guestName: null,
      partySize: 0,
      roomGap: null,
      reason: log.error?.trim() || '파싱 실패',
    });
  }
  for (const failure of input.parseFailures ?? []) {
    records.push({
      tier: 'unparsed',
      id: failure.id,
      channel: normalizeChannel(failure.source_platform),
      tourDate: null,
      createdAt: failure.created_at ?? null,
      guestName: null,
      partySize: 0,
      roomGap: null,
      reason: failure.reason?.trim() || '파싱 실패',
    });
  }

  // 최신 유입 우선. 같으면 id로 안정 정렬(같은 입력 → 같은 출력).
  records.sort((a, b) => {
    const ta = a.createdAt ?? '';
    const tb = b.createdAt ?? '';
    if (ta !== tb) return tb.localeCompare(ta);
    return a.id.localeCompare(b.id);
  });
  return records;
}

function readSummaryName(summary: Record<string, unknown> | null | undefined): string | null {
  const name = summary?.guest_name ?? summary?.name;
  return typeof name === 'string' && name.trim() ? name.trim() : null;
}

function readSummaryDate(summary: Record<string, unknown> | null | undefined): string | null {
  const date = summary?.tour_date ?? summary?.date;
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

/** 🔴 티어를 섞지 않는 집계. 총합 필드를 두지 않는 것이 이 함수의 계약이다. */
export function summarize(records: UnifiedRecord[]): UnifiedSummary {
  const counts: UnifiedTierCounts = { confirmed: 0, pending_review: 0, unparsed: 0 };
  const roomGaps = { no_room: 0, no_participant: 0, no_seat: 0 };
  let confirmedGuests = 0;
  const channelMap = new Map<string, number>();

  for (const r of records) {
    counts[r.tier] += 1;
    if (r.tier === 'confirmed') {
      confirmedGuests += r.partySize;
      if (r.roomGap) roomGaps[r.roomGap] += 1;
    }
    const key = `${r.channel} ${r.tier}`;
    channelMap.set(key, (channelMap.get(key) ?? 0) + 1);
  }

  const byChannel = [...channelMap.entries()]
    .map(([key, count]) => {
      const [channel, tier] = key.split(' ');
      return { channel, tier: tier as BookingTier, count };
    })
    .sort((a, b) => b.count - a.count || a.channel.localeCompare(b.channel));

  return { counts, roomGaps, confirmedGuests, byChannel };
}

/** B1-D4 — 주간/월간 축. 투어일 기준과 예약 생성일 기준은 다른 질문이다. */
export type DateAxis = 'tour_date' | 'created_at';

export function recordDate(record: UnifiedRecord, axis: DateAxis): string | null {
  if (axis === 'tour_date') return record.tourDate;
  return record.createdAt ? record.createdAt.slice(0, 10) : null;
}

/** 날짜(YYYY-MM-DD)별로 묶는다. 축에 해당 날짜가 없는 레코드는 빠진다. */
export function groupByDate(records: UnifiedRecord[], axis: DateAxis): Map<string, UnifiedRecord[]> {
  const map = new Map<string, UnifiedRecord[]>();
  for (const r of records) {
    const key = recordDate(r, axis);
    if (!key) continue;
    const list = map.get(key) ?? [];
    list.push(r);
    map.set(key, list);
  }
  return map;
}

/**
 * 🔴 B1-D6 — "틈이 없다"와 "파이프라인이 아직 안 켜졌다"를 구분한다.
 *
 * 티어 ②③이 0인 것은 **인박스가 도는데 실패가 없다**는 뜻일 수도 있고,
 * **인박스가 아예 안 켜져 있다**는 뜻일 수도 있다. 전자는 안심이고 후자는
 * 액션이다. 후자를 침묵시키면 오너는 인박스가 도는 줄 알고 OTA 메일을 놓친다.
 */
export type PipelineState = 'active' | 'never_ran';

export function inboxState(input: { anyParseLogEver: boolean }): PipelineState {
  return input.anyParseLogEver ? 'active' : 'never_ran';
}

export function tierEmptyLabel(tier: Exclude<BookingTier, 'confirmed'>, state: PipelineState): string {
  if (state === 'never_ran') return '인박스 미연결 — 설정 필요';
  return tier === 'pending_review' ? '확인 대기 없음' : '파싱 실패 없음';
}
