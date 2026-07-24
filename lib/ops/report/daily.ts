// AtoC 통합 §11.E — 매일 18:00 KST 자동 일일 보고서 (每日報表) 순수 집계.
//
// 이 모듈은 결정론이다 (LLM 0). 위 테이블들의 순수 SQL 집계만으로 5개 섹션을
// 만든다. 각 섹션은 독립 실패 허용 — 한 섹션의 쿼리가 실패해도 SectionResult.ok
// = false 로 표시되고 나머지 섹션은 그대로 생성된다 (보고서 전체가 막히지 않음).
//
// 데이터 소스 (plan §11.E 1~5):
//   ① 오늘 투어 실적 — tour_rooms(오늘 KST) + bookings + tours + tour_room_invites
//      (기사/가이드) + ops_seat_assignments(체크인/노쇼, 있으면) + tour_room_events
//      (시작/종료) + tour_room_extras(합계)
//   ② 오늘 신규 예약 — bookings(created_at 오늘 KST) + ops_email_parse_logs(commit_result)
//   ③ 내일 투어 예정 — tour_rooms(내일) + bookings + tour_room_invites(배정 여부)
//      + ops_room_vehicles(차량)
//   ④ 손님 연락 현황 — 내일 게스트 × ops_whatsapp_send_logs + tour_room_invites(이메일)
//   ⑤ 요주의 종합 — 미배정/연락누락/리뷰큐/파싱실패/좌석미지정 체크리스트
//
// ops_* 신규 테이블(seat_assignments, room_vehicles, whatsapp_send_logs,
// email_parse_logs, parse_failures)은 배포 시점에 따라 아직 미적용일 수 있으므로
// safeSelect 가 42P01(테이블 없음)을 조용히 빈 배열로 처리한다 — 미적용이어도
// 보고서는 동작(graceful degrade), 해당 지표는 0/생략으로 표시된다.

import type { SupabaseClient } from '@supabase/supabase-js'
import { kstToday, kstStartOfDayMs, kstEndOfDayMs } from '@/lib/tour-room/time'
import { dropSimBookings, simBookingIds } from '../sim/simScope'

export const DEFAULT_REPORT_TENANT = 'atockorea'

export interface SectionResult<T> {
  ok: boolean
  error?: string
  data: T
}

// ── ① 오늘 투어 실적 ────────────────────────────────────────────────────────
export interface TodayTourRoom {
  bookingId: string
  roomId: string | null
  guestName: string | null
  guests: number
  status: string | null
}
export interface TodayTour {
  tourId: string | null
  tourTitle: string
  city: string | null
  roomCount: number
  totalGuests: number
  guides: string[]
  drivers: string[]
  /** ops_seat_assignments 미적용/미사용이면 null (plan: 없으면 생략). */
  checkedIn: number | null
  noShow: number | null
  seatCount: number | null
  startedAt: string | null
  endedAt: string | null
  extrasKrw: number
  rooms: TodayTourRoom[]
}

// ── ② 오늘 신규 예약 ────────────────────────────────────────────────────────
export type CommitResult = 'auto' | 'review' | 'manual'
export interface NewBooking {
  id: string
  name: string | null
  guests: number
  source: string
  amount: number | null
  currency: string | null
  commit: CommitResult
}
export interface NewBookingsSummary {
  total: number
  byChannel: Array<{ channel: string; count: number; guests: number }>
  byCommit: Record<CommitResult, number>
  bookings: NewBooking[]
}

// ── ③ 내일 투어 예정 ────────────────────────────────────────────────────────
export interface TomorrowTour {
  tourId: string | null
  tourTitle: string
  city: string | null
  roomCount: number
  totalGuests: number
  pickups: Array<{ name: string; teams: number; pax: number; firstTime: string | null }>
  guideAssigned: boolean
  driverAssigned: boolean
  vehicles: string[]
}

// ── ④ 손님 연락 현황 ────────────────────────────────────────────────────────
export interface ContactRow {
  bookingId: string
  name: string | null
  guests: number
  tourTitle: string
  waOpenedAt: string | null
  waMarkedSentAt: string | null
  emailedAt: string | null
  /** wa 로그 0건 && 이메일 로그 0건 → 연락 누락 (최상단 빨간 행). */
  missing: boolean
}
export interface ContactStatus {
  rows: ContactRow[]
  missingCount: number
}

// ── ⑤ 요주의 종합 ──────────────────────────────────────────────────────────
export interface AttentionSummary {
  unassignedRooms: number // 내일 미배정(가이드 or 기사 없음) 투어 수
  uncontacted: number // 연락 누락 손님 수
  reviewQueued: number // ops_email_parse_logs review_queued 대기
  parseFailures: number // ops_parse_failures 오늘
  unseated: number // 차량 배정됐으나 좌석 미지정 게스트 수
  /** 위 5개가 전부 0이면 true → "이상 없음" 배너. */
  clean: boolean
}

export interface DailyReport {
  generatedAt: string
  todayKst: string
  tomorrowKst: string
  todayTours: SectionResult<TodayTour[]>
  newBookings: SectionResult<NewBookingsSummary>
  tomorrowTours: SectionResult<TomorrowTour[]>
  contactStatus: SectionResult<ContactStatus>
  attention: SectionResult<AttentionSummary>
}

// ── helpers ────────────────────────────────────────────────────────────────

function isMissingTable(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null
  return Boolean(e && (e.code === '42P01' || (typeof e.message === 'string' && /does not exist|42P01/i.test(e.message))))
}

/** SELECT that treats a missing table (42P01) as an empty result set — other
 *  errors propagate so the section catch marks ok:false. */
async function safeSelect<T = Record<string, unknown>>(
  query: PromiseLike<{ data: unknown; error: unknown }>,
): Promise<T[]> {
  const { data, error } = await query
  if (error) {
    if (isMissingTable(error)) return []
    throw error
  }
  return (data ?? []) as T[]
}

/** 내일(KST) 날짜 문자열 — KST는 DST 없음, +24h 안전. */
export function kstTomorrow(nowMs = Date.now()): string {
  return kstToday(nowMs + 24 * 60 * 60 * 1000)
}

const START_EVENT_TYPES = new Set(['tour_start', 'day_started', 'morning_briefing'])
const END_EVENT_TYPES = new Set(['tour_end', 'day_ended', 'settlement_summary'])

function pickupOf(row: BookingRow): { name: string | null; time: string | null } {
  const point = Array.isArray(row.pickup_points) ? row.pickup_points[0] : row.pickup_points
  const meta = (row.ota_raw_meta ?? {}) as Record<string, unknown>
  const name =
    (point?.name as string | undefined) ??
    (typeof meta.pickup_normalized === 'string' ? meta.pickup_normalized : null) ??
    (typeof meta.pickup_raw === 'string' ? meta.pickup_raw : null) ??
    null
  const time =
    (point?.pickup_time as string | undefined) ??
    (typeof meta.pickup_time === 'string' ? meta.pickup_time : null) ??
    null
  return { name: name ? String(name) : null, time: time ? String(time) : null }
}

interface BookingRow {
  id: string
  /** A0.1 — NULL이면 실 예약. 값이 있으면 집계에서 제외된다. */
  sim_tag?: string | null
  tour_id: string | null
  tour_date: string | null
  created_at?: string | null
  number_of_guests: number | null
  contact_name: string | null
  contact_email?: string | null
  status: string | null
  source: string | null
  external_booking_id?: string | null
  final_price?: number | null
  total_price?: number | null
  currency?: string | null
  ota_raw_meta?: Record<string, unknown> | null
  pickup_points?:
    | { name?: string | null; pickup_time?: string | null }
    | Array<{ name?: string | null; pickup_time?: string | null }>
    | null
}

interface RoomRow {
  id: string
  booking_id: string
  tour_id: string | null
  tour_date: string | null
  status: string | null
}

interface InviteRow {
  booking_id: string | null
  tour_id: string | null
  tour_date: string | null
  role: string
  display_name: string | null
  sent_to: string | null
  sent_via: string | null
  revoked_at: string | null
  created_at: string | null
}

// A0.1 — 시뮬 예약은 룸·명단에서는 보이되 집계에서는 세지 않는다.
// 이 보고서가 그 "집계"의 첫 번째 표면이다.
const BOOKING_COLS_SIM = ', sim_tag'

const BOOKING_COLS =
  'id, tour_id, tour_date, created_at, number_of_guests, contact_name, contact_email, status, source, external_booking_id, final_price, total_price, currency, ota_raw_meta, pickup_points ( name, pickup_time )' +
  BOOKING_COLS_SIM

/** 취소 예약 제외 (명단·집계 공통 규칙 — plan A-7d soft cancel). */
function isActiveBooking(status: string | null): boolean {
  return status !== 'cancelled'
}

function guestsOf(b: { number_of_guests: number | null }): number {
  return Math.max(1, b.number_of_guests || 1)
}

async function loadTourTitles(
  supabase: SupabaseClient,
  tourIds: string[],
): Promise<Map<string, { title: string; city: string | null }>> {
  const map = new Map<string, { title: string; city: string | null }>()
  const ids = [...new Set(tourIds.filter(Boolean))]
  if (ids.length === 0) return map
  const rows = await safeSelect<{ id: string; title: string | null; city: string | null }>(
    supabase.from('tours').select('id, title, city').in('id', ids),
  )
  for (const r of rows) map.set(r.id, { title: r.title ?? '(제목 없음)', city: r.city ?? null })
  return map
}

// ── ① 오늘 투어 실적 ────────────────────────────────────────────────────────
async function buildTodayTours(
  supabase: SupabaseClient,
  today: string,
): Promise<TodayTour[]> {
  const rooms = await safeSelect<RoomRow>(
    supabase.from('tour_rooms').select('id, booking_id, tour_id, tour_date, status').eq('tour_date', today),
  )
  if (rooms.length === 0) return []

  const bookingIds = rooms.map((r) => r.booking_id)
  const roomIds = rooms.map((r) => r.id)
  const tourIds = rooms.map((r) => r.tour_id).filter((v): v is string => Boolean(v))

  const [bookingsRaw, titles, invites, seats, events, extras] = await Promise.all([
    safeSelect<BookingRow>(supabase.from('bookings').select(BOOKING_COLS).in('id', bookingIds)),
    loadTourTitles(supabase, tourIds),
    safeSelect<InviteRow>(
      supabase
        .from('tour_room_invites')
        .select('booking_id, tour_id, tour_date, role, display_name, sent_to, sent_via, revoked_at, created_at')
        .eq('tour_date', today)
        .in('role', ['guide', 'driver']),
    ),
    safeSelect<{ booking_id: string; checked_in_at: string | null; absent_at: string | null }>(
      supabase.from('ops_seat_assignments').select('booking_id, checked_in_at, absent_at').in('booking_id', bookingIds),
    ),
    safeSelect<{ room_id: string; type: string; created_at: string }>(
      supabase.from('tour_room_events').select('room_id, type, created_at').in('room_id', roomIds),
    ),
    safeSelect<{ room_id: string; amount_krw: number | null; status: string | null }>(
      supabase.from('tour_room_extras').select('room_id, amount_krw, status').in('room_id', roomIds),
    ),
  ])

  // A0.1 — 시뮬 예약을 떨어뜨리고, **그 예약의 룸도 함께** 뺀다. 예약만 빼면
  // "예약 없는 룸"이라는 존재하지 않는 상태가 집계에 생긴다.
  const bookings = dropSimBookings(bookingsRaw)
  const simIds = simBookingIds(bookingsRaw)
  const bookingById = new Map(bookings.map((b) => [b.id, b]))

  // group rooms by tour_id (null → its own bucket keyed by booking to avoid merge)
  const groups = new Map<string, RoomRow[]>()
  for (const room of rooms) {
    if (simIds.has(room.booking_id)) continue
    const key = room.tour_id ?? `__notour__${room.booking_id}`
    const list = groups.get(key) ?? []
    list.push(room)
    groups.set(key, list)
  }

  const seatByBooking = new Map<string, { checkedIn: boolean; absent: boolean }[]>()
  for (const s of seats) {
    const list = seatByBooking.get(s.booking_id) ?? []
    list.push({ checkedIn: Boolean(s.checked_in_at), absent: Boolean(s.absent_at) })
    seatByBooking.set(s.booking_id, list)
  }

  const result: TodayTour[] = []
  for (const [key, groupRooms] of groups) {
    const tourId = key.startsWith('__notour__') ? null : key
    const meta = tourId ? titles.get(tourId) : undefined
    const groupBookingIds = new Set(groupRooms.map((r) => r.booking_id))
    const groupRoomIds = new Set(groupRooms.map((r) => r.id))

    const activeBookings = groupRooms
      .map((r) => bookingById.get(r.booking_id))
      .filter((b): b is BookingRow => Boolean(b) && isActiveBooking(b!.status))

    const totalGuests = activeBookings.reduce((s, b) => s + guestsOf(b), 0)

    const guides = new Set<string>()
    const drivers = new Set<string>()
    for (const inv of invites) {
      if (inv.revoked_at) continue
      if (inv.tour_id && inv.tour_id !== tourId) continue
      const label = (inv.display_name || inv.sent_to || '배정됨').trim()
      if (inv.role === 'guide') guides.add(label)
      else if (inv.role === 'driver') drivers.add(label)
    }

    // 체크인/노쇼 — 좌석 데이터가 있을 때만 (없으면 null → "생략")
    let checkedIn: number | null = null
    let noShow: number | null = null
    let seatCount: number | null = null
    for (const bid of groupBookingIds) {
      const list = seatByBooking.get(bid)
      if (!list) continue
      seatCount = (seatCount ?? 0) + list.length
      checkedIn = (checkedIn ?? 0) + list.filter((x) => x.checkedIn).length
      noShow = (noShow ?? 0) + list.filter((x) => x.absent).length
    }

    let startedAt: string | null = null
    let endedAt: string | null = null
    for (const ev of events) {
      if (!groupRoomIds.has(ev.room_id)) continue
      if (START_EVENT_TYPES.has(ev.type)) {
        if (!startedAt || ev.created_at < startedAt) startedAt = ev.created_at
      }
      if (END_EVENT_TYPES.has(ev.type)) {
        if (!endedAt || ev.created_at > endedAt) endedAt = ev.created_at
      }
    }

    let extrasKrw = 0
    for (const ex of extras) {
      if (!groupRoomIds.has(ex.room_id)) continue
      if (ex.status === 'voided') continue
      extrasKrw += Math.max(0, ex.amount_krw || 0)
    }

    result.push({
      tourId,
      tourTitle: meta?.title ?? '(단일 예약)',
      city: meta?.city ?? null,
      roomCount: groupRooms.length,
      totalGuests,
      guides: [...guides],
      drivers: [...drivers],
      checkedIn,
      noShow,
      seatCount,
      startedAt,
      endedAt,
      extrasKrw,
      rooms: activeBookings.map((b) => ({
        bookingId: b.id,
        roomId: groupRooms.find((r) => r.booking_id === b.id)?.id ?? null,
        guestName: b.contact_name,
        guests: guestsOf(b),
        status: b.status,
      })),
    })
  }

  result.sort((a, b) => a.tourTitle.localeCompare(b.tourTitle))
  return result
}

// ── ② 오늘 신규 예약 ────────────────────────────────────────────────────────
async function buildNewBookings(
  supabase: SupabaseClient,
  today: string,
  nowMs: number,
): Promise<NewBookingsSummary> {
  const startIso = new Date(kstStartOfDayMs(today)).toISOString()
  const endIso = new Date(kstEndOfDayMs(today)).toISOString()

  const rows = await safeSelect<BookingRow>(
    supabase
      .from('bookings')
      .select(BOOKING_COLS)
      .gte('created_at', startIso)
      .lte('created_at', endIso)
      // A0.1 — 예약에서 직접 출발하는 집계라 쿼리 레벨 배제로 충분하다
      // (룸만 남는 문제가 없다).
      .is('sim_tag', null)
      .order('created_at', { ascending: false }),
  )
  const active = rows.filter((b) => isActiveBooking(b.status))
  const bookingIds = active.map((b) => b.id)

  // commit_result: ops_email_parse_logs 조인 (auto/review/수동)
  const commitByBooking = new Map<string, CommitResult>()
  if (bookingIds.length > 0) {
    const logs = await safeSelect<{ booking_id: string | null; commit_result: string | null }>(
      supabase
        .from('ops_email_parse_logs')
        .select('booking_id, commit_result')
        .in('booking_id', bookingIds),
    )
    for (const log of logs) {
      if (!log.booking_id) continue
      const c: CommitResult = log.commit_result === 'auto_committed' ? 'auto' : 'review'
      // auto가 review를 이긴다 (자동 커밋 확정이 더 강한 신호)
      if (commitByBooking.get(log.booking_id) === 'auto') continue
      commitByBooking.set(log.booking_id, c)
    }
  }

  const bookings: NewBooking[] = active.map((b) => ({
    id: b.id,
    name: b.contact_name,
    guests: guestsOf(b),
    source: (b.source || 'atockorea').toLowerCase(),
    amount: typeof b.final_price === 'number' ? b.final_price : typeof b.total_price === 'number' ? b.total_price : null,
    currency: b.currency ?? null,
    commit: commitByBooking.get(b.id) ?? 'manual', // 파싱 로그 없음 = 수동/자체오더
  }))

  const byChannelMap = new Map<string, { count: number; guests: number }>()
  const byCommit: Record<CommitResult, number> = { auto: 0, review: 0, manual: 0 }
  for (const b of bookings) {
    const c = byChannelMap.get(b.source) ?? { count: 0, guests: 0 }
    c.count += 1
    c.guests += b.guests
    byChannelMap.set(b.source, c)
    byCommit[b.commit] += 1
  }

  return {
    total: bookings.length,
    byChannel: [...byChannelMap.entries()]
      .map(([channel, v]) => ({ channel, count: v.count, guests: v.guests }))
      .sort((a, b) => b.count - a.count),
    byCommit,
    bookings,
  }
}

// ── ③ 내일 투어 예정 (+ 배정/차량, 섹션⑤와 공유할 raw 반환) ──────────────────
interface TomorrowRaw {
  tours: TomorrowTour[]
  /** 내일 활성 예약 (섹션④/⑤ 재사용). */
  bookings: BookingRow[]
  roomByBooking: Map<string, string>
  titles: Map<string, { title: string; city: string | null }>
  /** 좌석 배정된 booking_id 집합 (섹션⑤ 좌석 미지정 판정용). */
  seatedBookingIds: Set<string>
  /** 차량 배정된 room_id 집합. */
  vehicledRoomIds: Set<string>
}

async function buildTomorrow(supabase: SupabaseClient, tomorrow: string): Promise<TomorrowRaw> {
  const rooms = await safeSelect<RoomRow>(
    supabase.from('tour_rooms').select('id, booking_id, tour_id, tour_date, status').eq('tour_date', tomorrow),
  )
  const empty: TomorrowRaw = {
    tours: [],
    bookings: [],
    roomByBooking: new Map(),
    titles: new Map(),
    seatedBookingIds: new Set(),
    vehicledRoomIds: new Set(),
  }
  if (rooms.length === 0) return empty

  const bookingIds = rooms.map((r) => r.booking_id)
  const roomIds = rooms.map((r) => r.id)
  const tourIds = rooms.map((r) => r.tour_id).filter((v): v is string => Boolean(v))

  const [bookingsRaw, titles, invites, vehicles, seats] = await Promise.all([
    safeSelect<BookingRow>(supabase.from('bookings').select(BOOKING_COLS).in('id', bookingIds)),
    loadTourTitles(supabase, tourIds),
    safeSelect<InviteRow>(
      supabase
        .from('tour_room_invites')
        .select('booking_id, tour_id, tour_date, role, display_name, sent_to, sent_via, revoked_at, created_at')
        .eq('tour_date', tomorrow)
        .in('role', ['guide', 'driver']),
    ),
    safeSelect<{ room_id: string; layout_id: string | null; plate_number: string | null }>(
      supabase.from('ops_room_vehicles').select('room_id, layout_id, plate_number').in('room_id', roomIds),
    ),
    safeSelect<{ booking_id: string }>(
      supabase.from('ops_seat_assignments').select('booking_id').in('booking_id', bookingIds),
    ),
  ])

  const layoutIds = vehicles.map((v) => v.layout_id).filter((v): v is string => Boolean(v))
  const layoutNames = new Map<string, string>()
  if (layoutIds.length > 0) {
    const layouts = await safeSelect<{ id: string; model: string; display_name: Record<string, string> | null }>(
      supabase.from('ops_vehicle_layouts').select('id, model, display_name').in('id', layoutIds),
    )
    for (const l of layouts) {
      const dn = l.display_name && (l.display_name.ko || l.display_name.en)
      layoutNames.set(l.id, (dn as string) || l.model)
    }
  }

  // A0.1 — 오늘 집계와 같은 규칙: 시뮬 예약과 그 룸을 함께 뺀다.
  const bookings = dropSimBookings(bookingsRaw)
  const simIds = simBookingIds(bookingsRaw)
  const bookingById = new Map(bookings.map((b) => [b.id, b]))
  const roomByBooking = new Map(rooms.map((r) => [r.booking_id, r.id]))
  const seatedBookingIds = new Set(seats.map((s) => s.booking_id))
  const vehicledRoomIds = new Set(vehicles.map((v) => v.room_id))

  // group by tour
  const groups = new Map<string, RoomRow[]>()
  for (const room of rooms) {
    if (simIds.has(room.booking_id)) continue
    const key = room.tour_id ?? `__notour__${room.booking_id}`
    const list = groups.get(key) ?? []
    list.push(room)
    groups.set(key, list)
  }

  const tours: TomorrowTour[] = []
  for (const [key, groupRooms] of groups) {
    const tourId = key.startsWith('__notour__') ? null : key
    const meta = tourId ? titles.get(tourId) : undefined
    const groupRoomIds = new Set(groupRooms.map((r) => r.id))
    const activeBookings = groupRooms
      .map((r) => bookingById.get(r.booking_id))
      .filter((b): b is BookingRow => Boolean(b) && isActiveBooking(b!.status))

    // 픽업지 요약
    const pickupMap = new Map<string, { name: string; teams: number; pax: number; firstTime: string | null }>()
    for (const b of activeBookings) {
      const { name, time } = pickupOf(b)
      const label = name ?? '픽업 미지정'
      const g = pickupMap.get(label) ?? { name: label, teams: 0, pax: 0, firstTime: null }
      g.teams += 1
      g.pax += guestsOf(b)
      if (time && /^\d{1,2}:\d{2}/.test(time)) {
        const hhmm = time.slice(0, 5).padStart(5, '0')
        if (!g.firstTime || hhmm < g.firstTime) g.firstTime = hhmm
      }
      pickupMap.set(label, g)
    }

    let guideAssigned = false
    let driverAssigned = false
    for (const inv of invites) {
      if (inv.revoked_at) continue
      if (inv.tour_id && inv.tour_id !== tourId) continue
      if (inv.role === 'guide') guideAssigned = true
      else if (inv.role === 'driver') driverAssigned = true
    }

    const vehicleLabels = vehicles
      .filter((v) => groupRoomIds.has(v.room_id))
      .map((v) => {
        const model = v.layout_id ? layoutNames.get(v.layout_id) ?? '차량' : '차량'
        return v.plate_number ? `${model} (${v.plate_number})` : model
      })

    tours.push({
      tourId,
      tourTitle: meta?.title ?? '(단일 예약)',
      city: meta?.city ?? null,
      roomCount: groupRooms.length,
      totalGuests: activeBookings.reduce((s, b) => s + guestsOf(b), 0),
      pickups: [...pickupMap.values()].sort((a, b) =>
        (a.firstTime ?? '99:99').localeCompare(b.firstTime ?? '99:99'),
      ),
      guideAssigned,
      driverAssigned,
      vehicles: vehicleLabels,
    })
  }

  tours.sort((a, b) => a.tourTitle.localeCompare(b.tourTitle))

  const activeAll = bookings.filter((b) => isActiveBooking(b.status))
  return { tours, bookings: activeAll, roomByBooking, titles, seatedBookingIds, vehicledRoomIds }
}

// ── ④ 손님 연락 현황 ────────────────────────────────────────────────────────
async function buildContactStatus(supabase: SupabaseClient, raw: TomorrowRaw): Promise<ContactStatus> {
  const bookings = raw.bookings
  if (bookings.length === 0) return { rows: [], missingCount: 0 }
  const bookingIds = bookings.map((b) => b.id)

  const [waLogs, custInvites] = await Promise.all([
    safeSelect<{ booking_id: string; opened_at: string | null; marked_sent_at: string | null; created_at: string }>(
      supabase
        .from('ops_whatsapp_send_logs')
        .select('booking_id, opened_at, marked_sent_at, created_at')
        .in('booking_id', bookingIds)
        .order('created_at', { ascending: false }),
    ),
    safeSelect<InviteRow>(
      supabase
        .from('tour_room_invites')
        .select('booking_id, tour_id, tour_date, role, display_name, sent_to, sent_via, revoked_at, created_at')
        .eq('role', 'customer')
        .in('booking_id', bookingIds),
    ),
  ])

  const waByBooking = new Map<string, { openedAt: string | null; markedSentAt: string | null }>()
  for (const log of waLogs) {
    const cur = waByBooking.get(log.booking_id)
    if (!cur) {
      waByBooking.set(log.booking_id, { openedAt: log.opened_at, markedSentAt: log.marked_sent_at })
    } else if (!cur.markedSentAt && log.marked_sent_at) {
      cur.markedSentAt = log.marked_sent_at
    }
  }
  // 이메일: 고객 초대 링크가 이메일로 발송된 기록 (기존 emails 로그 부재 → invites가
  // 유일한 outbound-to-guest 이메일 신호. sent_via='email' 또는 sent_to 존재).
  const emailByBooking = new Map<string, string>()
  for (const inv of custInvites) {
    if (!inv.booking_id) continue
    const emailed = inv.sent_via === 'email' || Boolean(inv.sent_to)
    if (!emailed) continue
    const prev = emailByBooking.get(inv.booking_id)
    if (!prev || (inv.created_at && inv.created_at < prev)) {
      emailByBooking.set(inv.booking_id, inv.created_at ?? prev ?? '')
    }
  }

  const titleFor = (b: BookingRow): string => (b.tour_id ? raw.titles.get(b.tour_id)?.title ?? '(단일 예약)' : '(단일 예약)')

  const rows: ContactRow[] = bookings.map((b) => {
    const wa = waByBooking.get(b.id)
    const emailedAt = emailByBooking.get(b.id) ?? null
    const missing = !wa && !emailedAt
    return {
      bookingId: b.id,
      name: b.contact_name,
      guests: guestsOf(b),
      tourTitle: titleFor(b),
      waOpenedAt: wa?.openedAt ?? null,
      waMarkedSentAt: wa?.markedSentAt ?? null,
      emailedAt,
      missing,
    }
  })

  // 연락 누락을 최상단으로 (빨간 행), 그다음 이름순
  rows.sort((a, b) => {
    if (a.missing !== b.missing) return a.missing ? -1 : 1
    return (a.name ?? '').localeCompare(b.name ?? '')
  })

  return { rows, missingCount: rows.filter((r) => r.missing).length }
}

// ── ⑤ 요주의 종합 ──────────────────────────────────────────────────────────
async function buildAttention(
  supabase: SupabaseClient,
  today: string,
  tomorrowRaw: TomorrowRaw,
  contact: ContactStatus | null,
): Promise<AttentionSummary> {
  // 미배정 룸: 내일 투어 중 가이드 또는 기사 미배정
  const unassignedRooms = tomorrowRaw.tours.filter((t) => !t.guideAssigned || !t.driverAssigned).length

  // 좌석 미지정: 차량 배정된 룸의 예약 중 좌석 배정 없는 게스트
  let unseated = 0
  for (const b of tomorrowRaw.bookings) {
    const roomId = tomorrowRaw.roomByBooking.get(b.id)
    if (roomId && tomorrowRaw.vehicledRoomIds.has(roomId) && !tomorrowRaw.seatedBookingIds.has(b.id)) {
      unseated += 1
    }
  }

  const startIso = new Date(kstStartOfDayMs(today)).toISOString()
  const endIso = new Date(kstEndOfDayMs(today)).toISOString()

  const [reviewLogs, failures] = await Promise.all([
    safeSelect<{ id: string }>(
      supabase.from('ops_email_parse_logs').select('id').eq('commit_result', 'review_queued'),
    ),
    safeSelect<{ id: string }>(
      supabase
        .from('ops_parse_failures')
        .select('id')
        .gte('created_at', startIso)
        .lte('created_at', endIso),
    ),
  ])

  const uncontacted = contact?.missingCount ?? 0
  const reviewQueued = reviewLogs.length
  const parseFailures = failures.length
  return {
    unassignedRooms,
    uncontacted,
    reviewQueued,
    parseFailures,
    unseated,
    clean:
      unassignedRooms === 0 &&
      uncontacted === 0 &&
      reviewQueued === 0 &&
      parseFailures === 0 &&
      unseated === 0,
  }
}

async function section<T>(fn: () => Promise<T>, fallback: T): Promise<SectionResult<T>> {
  try {
    return { ok: true, data: await fn() }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown', data: fallback }
  }
}

/**
 * 5개 섹션을 각각 독립 실패 허용으로 집계한다. 한 섹션 쿼리 실패는 그 섹션만
 * ok:false 로 두고 나머지는 정상 생성한다.
 */
export async function buildDailyReport(
  supabase: SupabaseClient,
  opts: { nowMs?: number } = {},
): Promise<DailyReport> {
  const nowMs = opts.nowMs ?? Date.now()
  const today = kstToday(nowMs)
  const tomorrow = kstTomorrow(nowMs)

  // ③ 내일 raw 를 먼저 만든다 (④/⑤가 공유). 실패해도 empty raw 로 진행.
  let tomorrowRaw: TomorrowRaw
  let tomorrowSection: SectionResult<TomorrowTour[]>
  try {
    tomorrowRaw = await buildTomorrow(supabase, tomorrow)
    tomorrowSection = { ok: true, data: tomorrowRaw.tours }
  } catch (e) {
    tomorrowRaw = {
      tours: [],
      bookings: [],
      roomByBooking: new Map(),
      titles: new Map(),
      seatedBookingIds: new Set(),
      vehicledRoomIds: new Set(),
    }
    tomorrowSection = { ok: false, error: e instanceof Error ? e.message : 'unknown', data: [] }
  }

  const contactSection = await section<ContactStatus>(
    () => buildContactStatus(supabase, tomorrowRaw),
    { rows: [], missingCount: 0 },
  )

  const [todaySection, newBookingsSection, attentionSection] = await Promise.all([
    section<TodayTour[]>(() => buildTodayTours(supabase, today), []),
    section<NewBookingsSummary>(() => buildNewBookings(supabase, today, nowMs), {
      total: 0,
      byChannel: [],
      byCommit: { auto: 0, review: 0, manual: 0 },
      bookings: [],
    }),
    section<AttentionSummary>(
      () => buildAttention(supabase, today, tomorrowRaw, contactSection.ok ? contactSection.data : null),
      {
        unassignedRooms: 0,
        uncontacted: 0,
        reviewQueued: 0,
        parseFailures: 0,
        unseated: 0,
        clean: true,
      },
    ),
  ])

  return {
    generatedAt: new Date(nowMs).toISOString(),
    todayKst: today,
    tomorrowKst: tomorrow,
    todayTours: todaySection,
    newBookings: newBookingsSection,
    tomorrowTours: tomorrowSection,
    contactStatus: contactSection,
    attention: attentionSection,
  }
}
