/**
 * @jest-environment node
 *
 * §11.E 일일 보고서 순수 집계 (daily.ts) — 섹션별 빈 데이터/정상/부분 실패,
 * 연락 누락 판정. 네트워크 0 (mockSupabase 인메모리).
 */
import { buildDailyReport, kstTomorrow } from '../daily'
import { mockSupabase, missingTable, type TableRegistry } from '../test-support/supabase-mock'

type Row = Record<string, unknown>

// 18:00 KST 2026-07-24 (=09:00 UTC). today=2026-07-24, tomorrow=2026-07-25.
const NOW = Date.parse('2026-07-24T09:00:00Z')

function normalRegistry(): TableRegistry {
  return {
    tour_rooms: [
      { id: 'R1', booking_id: 'B1', tour_id: 'T1', tour_date: '2026-07-24', status: 'active' },
      { id: 'R2', booking_id: 'B2', tour_id: 'T1', tour_date: '2026-07-24', status: 'active' },
      { id: 'R3', booking_id: 'B3', tour_id: 'T1', tour_date: '2026-07-25', status: 'active' },
      { id: 'R6', booking_id: 'B6', tour_id: 'T1', tour_date: '2026-07-25', status: 'active' },
    ],
    bookings: [
      {
        id: 'B1', tour_id: 'T1', tour_date: '2026-07-24', created_at: '2026-07-24T02:00:00Z',
        number_of_guests: 2, contact_name: 'Massimo Cassina', status: 'confirmed', source: 'gyg',
        final_price: 144, currency: 'USD', ota_raw_meta: null,
        pickup_points: { name: 'Lotte Hotel', pickup_time: '08:00' },
      },
      {
        id: 'B2', tour_id: 'T1', tour_date: '2026-07-24', created_at: '2026-07-24T03:00:00Z',
        number_of_guests: 3, contact_name: 'Tanaka Yuki', status: 'confirmed', source: 'klook',
        final_price: 200, currency: 'USD', ota_raw_meta: null, pickup_points: null,
      },
      {
        id: 'B4', tour_id: 'T1', tour_date: '2026-07-24', created_at: '2026-07-24T05:00:00Z',
        number_of_guests: 1, contact_name: 'Kim', status: 'confirmed', source: 'direct',
        final_price: null, currency: null, ota_raw_meta: null, pickup_points: null,
      },
      {
        id: 'B3', tour_id: 'T1', tour_date: '2026-07-25', created_at: '2026-07-20T02:00:00Z',
        number_of_guests: 2, contact_name: 'Nicoletta Airoldi', status: 'confirmed', source: 'viator',
        final_price: 144, currency: 'USD', ota_raw_meta: null,
        pickup_points: { name: 'Jeju Airport', pickup_time: '09:00' },
      },
      {
        id: 'B6', tour_id: 'T1', tour_date: '2026-07-25', created_at: '2026-07-20T02:00:00Z',
        number_of_guests: 4, contact_name: 'Chen Wei', status: 'confirmed', source: 'klook',
        final_price: 288, currency: 'USD', ota_raw_meta: null,
        pickup_points: { name: 'Jeju Airport', pickup_time: '09:00' },
      },
    ],
    tours: [{ id: 'T1', title: 'Jeju Grand Highlights', city: 'Jeju' }],
    tour_room_invites: [
      { booking_id: null, tour_id: 'T1', tour_date: '2026-07-24', role: 'guide', display_name: 'Guide Park', sent_to: null, sent_via: 'email', revoked_at: null, created_at: '2026-07-23T00:00:00Z' },
      { booking_id: null, tour_id: 'T1', tour_date: '2026-07-24', role: 'driver', display_name: 'Driver Lee', sent_to: null, sent_via: 'email', revoked_at: null, created_at: '2026-07-23T00:00:00Z' },
      // 내일: 가이드만 배정, 기사 없음 → 미배정
      { booking_id: null, tour_id: 'T1', tour_date: '2026-07-25', role: 'guide', display_name: 'Guide Park', sent_to: null, sent_via: 'email', revoked_at: null, created_at: '2026-07-24T00:00:00Z' },
      // B6 고객 초대(이메일 발송) → 연락됨
      { booking_id: 'B6', tour_id: null, tour_date: null, role: 'customer', display_name: 'Chen Wei', sent_to: 'chen@example.com', sent_via: 'email', revoked_at: null, created_at: '2026-07-24T01:00:00Z' },
    ],
    ops_seat_assignments: [
      { booking_id: 'B1', checked_in_at: '2026-07-24T08:12:00Z', absent_at: null },
      { booking_id: 'B1', checked_in_at: null, absent_at: null },
      { booking_id: 'B2', checked_in_at: '2026-07-24T08:14:00Z', absent_at: null },
      { booking_id: 'B2', checked_in_at: '2026-07-24T08:15:00Z', absent_at: null },
      { booking_id: 'B2', checked_in_at: null, absent_at: '2026-07-24T08:30:00Z' },
    ],
    tour_room_events: [
      { room_id: 'R1', type: 'morning_briefing', created_at: '2026-07-24T00:30:00Z' },
      { room_id: 'R2', type: 'settlement_summary', created_at: '2026-07-24T09:00:00Z' },
    ],
    tour_room_extras: [
      { room_id: 'R1', amount_krw: 30000, status: 'confirmed' },
      { room_id: 'R2', amount_krw: 40000, status: 'voided' },
    ],
    ops_room_vehicles: [{ room_id: 'R3', layout_id: 'L1', plate_number: '12가3456' }],
    ops_vehicle_layouts: [{ id: 'L1', model: 'county_20', display_name: { ko: '카운티 20인승' } }],
    ops_whatsapp_send_logs: [
      { booking_id: 'B6', opened_at: '2026-07-24T10:00:00Z', marked_sent_at: '2026-07-24T10:05:00Z', created_at: '2026-07-24T10:00:00Z' },
    ],
    ops_email_parse_logs: [
      { booking_id: 'B1', commit_result: 'auto_committed' },
      { booking_id: 'B2', commit_result: 'review_queued' },
    ],
    ops_parse_failures: [{ id: 'F1', created_at: '2026-07-24T03:00:00Z' }],
  }
}

describe('buildDailyReport — 정상 데이터', () => {
  it('① 오늘 투어 실적: 투어 그룹핑·총원·배정·체크인/노쇼·시작종료·extras', async () => {
    const report = await buildDailyReport(mockSupabase(normalRegistry()), { nowMs: NOW })
    expect(report.todayTours.ok).toBe(true)
    expect(report.todayTours.data).toHaveLength(1)
    const t = report.todayTours.data[0]
    expect(t.tourTitle).toBe('Jeju Grand Highlights')
    expect(t.totalGuests).toBe(5) // B1(2)+B2(3)
    expect(t.roomCount).toBe(2)
    expect(t.guides).toEqual(['Guide Park'])
    expect(t.drivers).toEqual(['Driver Lee'])
    expect(t.seatCount).toBe(5)
    expect(t.checkedIn).toBe(3)
    expect(t.noShow).toBe(1)
    expect(t.startedAt).toBe('2026-07-24T00:30:00Z')
    expect(t.endedAt).toBe('2026-07-24T09:00:00Z')
    expect(t.extrasKrw).toBe(30000) // voided 제외
  })

  it('② 오늘 신규 예약: created_at 오늘만·채널별·commit 분류(auto/review/수동)', async () => {
    const report = await buildDailyReport(mockSupabase(normalRegistry()), { nowMs: NOW })
    const s = report.newBookings.data
    expect(report.newBookings.ok).toBe(true)
    expect(s.total).toBe(3) // B1,B2,B4 (B3/B6은 07-20 생성 → 제외)
    expect(s.byCommit).toEqual({ auto: 1, review: 1, manual: 1 })
    const bySource = Object.fromEntries(s.byChannel.map((c) => [c.channel, c.count]))
    expect(bySource).toEqual({ gyg: 1, klook: 1, direct: 1 })
    expect(s.bookings.find((b) => b.id === 'B1')?.commit).toBe('auto')
    expect(s.bookings.find((b) => b.id === 'B2')?.commit).toBe('review')
    expect(s.bookings.find((b) => b.id === 'B4')?.commit).toBe('manual')
  })

  it('③ 내일 투어 예정: 인원·픽업요약·가이드/기사 배정 여부·차량', async () => {
    const report = await buildDailyReport(mockSupabase(normalRegistry()), { nowMs: NOW })
    expect(report.tomorrowTours.ok).toBe(true)
    const t = report.tomorrowTours.data[0]
    expect(t.totalGuests).toBe(6) // B3(2)+B6(4)
    expect(t.guideAssigned).toBe(true)
    expect(t.driverAssigned).toBe(false) // 기사 미배정
    expect(t.vehicles).toEqual(['카운티 20인승 (12가3456)'])
    expect(t.pickups[0].name).toBe('Jeju Airport')
    expect(t.pickups[0].pax).toBe(6)
  })

  it('④ 손님 연락 현황: 연락 누락(로그 0건) 손님 최상단·missingCount', async () => {
    const report = await buildDailyReport(mockSupabase(normalRegistry()), { nowMs: NOW })
    const s = report.contactStatus.data
    expect(report.contactStatus.ok).toBe(true)
    expect(s.rows).toHaveLength(2)
    expect(s.missingCount).toBe(1) // B3 (wa 0 + email 0)
    // 누락이 최상단
    expect(s.rows[0].bookingId).toBe('B3')
    expect(s.rows[0].missing).toBe(true)
    // B6은 wa marked_sent → 연락됨
    const b6 = s.rows.find((r) => r.bookingId === 'B6')!
    expect(b6.missing).toBe(false)
    expect(b6.waMarkedSentAt).toBeTruthy()
    expect(b6.emailedAt).toBeTruthy()
  })

  it('⑤ 요주의 종합: 미배정/연락누락/리뷰큐/파싱실패/좌석미지정 집계, clean=false', async () => {
    const report = await buildDailyReport(mockSupabase(normalRegistry()), { nowMs: NOW })
    const a = report.attention.data
    expect(report.attention.ok).toBe(true)
    expect(a.unassignedRooms).toBe(1) // 내일 기사 미배정
    expect(a.uncontacted).toBe(1) // B3
    expect(a.reviewQueued).toBe(1) // B2 로그
    expect(a.parseFailures).toBe(1) // F1 오늘
    expect(a.unseated).toBe(1) // B3 (차량 배정된 R3, 좌석 없음)
    expect(a.clean).toBe(false)
  })
})

describe('buildDailyReport — 빈 데이터', () => {
  it('모든 테이블 빈 배열: 전 섹션 ok, 요주의 clean=true', async () => {
    const empty: TableRegistry = {
      tour_rooms: [], bookings: [], tours: [], tour_room_invites: [],
      ops_seat_assignments: [], tour_room_events: [], tour_room_extras: [],
      ops_room_vehicles: [], ops_vehicle_layouts: [], ops_whatsapp_send_logs: [],
      ops_email_parse_logs: [], ops_parse_failures: [],
    }
    const report = await buildDailyReport(mockSupabase(empty), { nowMs: NOW })
    expect(report.todayTours.data).toEqual([])
    expect(report.newBookings.data.total).toBe(0)
    expect(report.tomorrowTours.data).toEqual([])
    expect(report.contactStatus.data.rows).toEqual([])
    expect(report.attention.data.clean).toBe(true)
    for (const s of [report.todayTours, report.newBookings, report.tomorrowTours, report.contactStatus, report.attention]) {
      expect(s.ok).toBe(true)
    }
  })
})

describe('buildDailyReport — 부분 실패 (독립 실패 허용)', () => {
  it('한 섹션의 테이블이 (42P01 아닌) 에러여도 다른 섹션은 정상', async () => {
    const reg = normalRegistry()
    // ops_parse_failures 는 ⑤ 요주의만 사용 → 이 섹션만 ok:false
    reg.ops_parse_failures = new Error('boom: connection reset')
    const report = await buildDailyReport(mockSupabase(reg), { nowMs: NOW })
    expect(report.attention.ok).toBe(false)
    expect(report.attention.error).toMatch(/boom/)
    // 나머지 섹션은 그대로 생성됨
    expect(report.todayTours.ok).toBe(true)
    expect(report.todayTours.data).toHaveLength(1)
    expect(report.newBookings.ok).toBe(true)
    expect(report.tomorrowTours.ok).toBe(true)
    expect(report.contactStatus.ok).toBe(true)
  })

  it('ops_seat_assignments 미적용(42P01): 체크인/노쇼 생략(null), 섹션은 ok', async () => {
    const reg = normalRegistry()
    reg.ops_seat_assignments = missingTable()
    const report = await buildDailyReport(mockSupabase(reg), { nowMs: NOW })
    expect(report.todayTours.ok).toBe(true)
    const t = report.todayTours.data[0]
    expect(t.seatCount).toBeNull()
    expect(t.checkedIn).toBeNull()
    expect(t.noShow).toBeNull()
  })
})

describe('buildDailyReport — B2.3 정원 초과 요주의', () => {
  // 내일(2026-07-25) T1에 B3(2명) + B6(4명) = 6명이 이미 있다.
  // 정원 12를 넘기려면 7명 이상을 더 얹으면 된다.
  function overloaded(): TableRegistry {
    const reg = normalRegistry()
    ;(reg.tours as Row[])[0] = { id: 'T1', title: 'Jeju Grand Highlights', city: 'Jeju', max_room_guests: 12, price_type: 'person' }
    ;(reg.tour_rooms as Row[]).push({ id: 'R7', booking_id: 'B7', tour_id: 'T1', tour_date: '2026-07-25', status: 'active' })
    ;(reg.bookings as Row[]).push({
      id: 'B7', tour_id: 'T1', tour_date: '2026-07-25', created_at: '2026-07-20T02:00:00Z',
      number_of_guests: 9, contact_name: 'Big Party', status: 'confirmed', source: 'direct',
      final_price: 900, currency: 'USD', ota_raw_meta: null, pickup_points: null, sim_tag: null,
    })
    return reg
  }

  it('정원 이내면 요주의가 아니다', async () => {
    const reg = normalRegistry()
    ;(reg.tours as Row[])[0] = { id: 'T1', title: 'Jeju Grand Highlights', city: 'Jeju', max_room_guests: 12, price_type: 'person' }
    const report = await buildDailyReport(mockSupabase(reg), { nowMs: NOW })
    expect(report.attention.data.overCapacity).toEqual([])
  })

  it('초과하면 어느 투어가 몇 명 초과인지 문구로 나온다 — 숫자만으로는 조치가 안 된다', async () => {
    const report = await buildDailyReport(mockSupabase(overloaded()), { nowMs: NOW })
    const lines = report.attention.data.overCapacity
    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain('15명')
    expect(lines[0]).toContain('정원 12 초과')
    expect(lines[0]).toContain('2호차')
    expect(report.attention.data.clean).toBe(false)
  })

  it('🔴 B2-D1 — 요주의 문구 어디에도 매진·잔여가 없다', async () => {
    const report = await buildDailyReport(mockSupabase(overloaded()), { nowMs: NOW })
    for (const line of report.attention.data.overCapacity) {
      expect(line).not.toContain('매진')
      expect(line).not.toContain('잔여')
    }
  })

  it('정원 컬럼이 아직 없는 환경에서도 보고서가 죽지 않는다 (price_type 기본값으로 판정)', async () => {
    const reg = overloaded()
    for (const t of reg.tours as Row[]) {
      delete t.max_room_guests
    }
    const report = await buildDailyReport(mockSupabase(reg), { nowMs: NOW })
    expect(report.attention.ok).toBe(true)
    // price_type='person' 코드 기본값 12가 적용된다.
    expect(report.attention.data.overCapacity).toHaveLength(1)
  })

  it('시뮬 예약은 정원 카운트에 들어가지 않는다 — 빈 투어가 초과로 뜨면 안 된다', async () => {
    const reg = normalRegistry()
    ;(reg.tours as Row[])[0] = { id: 'T1', title: 'Jeju Grand Highlights', city: 'Jeju', max_room_guests: 12, price_type: 'person' }
    ;(reg.tour_rooms as Row[]).push({ id: 'RS9', booking_id: 'BS9', tour_id: 'T1', tour_date: '2026-07-25', status: 'active' })
    ;(reg.bookings as Row[]).push({
      id: 'BS9', tour_id: 'T1', tour_date: '2026-07-25', created_at: '2026-07-20T02:00:00Z',
      number_of_guests: 99, contact_name: 'Sim Crowd', contact_email: 'sim-tour-mode@atockorea.test',
      status: 'confirmed', source: 'direct', final_price: 0, currency: 'USD',
      ota_raw_meta: null, pickup_points: null, sim_tag: 'sim',
    })
    const report = await buildDailyReport(mockSupabase(reg), { nowMs: NOW })
    expect(report.attention.data.overCapacity).toEqual([])
  })
})

describe('buildDailyReport — A0.1 시뮬 격리', () => {
  // 시뮬 예약은 라이브 DB에 산다(룸·좌석·명단에서 보여야 시뮬이 성립한다).
  // 이 보고서가 그것을 세면 오너는 매일 아침 존재하지 않는 투어를 본다.
  function withSim(): TableRegistry {
    const reg = normalRegistry()
    ;(reg.tour_rooms as Row[]).push(
      { id: 'RS', booking_id: 'BS', tour_id: 'T1', tour_date: '2026-07-24', status: 'active' },
      { id: 'RS2', booking_id: 'BS2', tour_id: 'T1', tour_date: '2026-07-25', status: 'active' },
    )
    ;(reg.bookings as Row[]).push(
      {
        id: 'BS', tour_id: 'T1', tour_date: '2026-07-24', created_at: '2026-07-24T04:00:00Z',
        number_of_guests: 9, contact_name: 'Sim Alex', contact_email: 'sim-tour-mode@atockorea.test',
        status: 'confirmed', source: 'direct', final_price: 999, currency: 'USD',
        ota_raw_meta: null, pickup_points: null, sim_tag: 'sim',
      },
      {
        id: 'BS2', tour_id: 'T1', tour_date: '2026-07-25', created_at: '2026-07-24T04:30:00Z',
        number_of_guests: 7, contact_name: 'Sim Yuki', contact_email: 'sim-tour-mode@atockorea.test',
        status: 'confirmed', source: 'direct', final_price: 777, currency: 'USD',
        ota_raw_meta: null, pickup_points: null, sim_tag: 'sim',
      },
    )
    return reg
  }

  it('① 오늘 투어에서 시뮬 예약과 그 룸이 함께 빠진다 — 룸만 남으면 "예약 없는 룸"이 생긴다', async () => {
    const report = await buildDailyReport(mockSupabase(withSim()), { nowMs: NOW })
    const t = report.todayTours.data[0]
    expect(t.totalGuests).toBe(5) // 시뮬 9명이 더해지지 않는다
    expect(t.roomCount).toBe(2) // RS가 세어지지 않는다
  })

  it('② 신규 예약 집계에서 시뮬이 빠진다', async () => {
    const withoutSim = await buildDailyReport(mockSupabase(normalRegistry()), { nowMs: NOW })
    const withSimReport = await buildDailyReport(mockSupabase(withSim()), { nowMs: NOW })
    expect(withSimReport.newBookings.data.total).toBe(withoutSim.newBookings.data.total)
  })

  it('③ 내일 예정에서도 시뮬이 빠진다', async () => {
    const withoutSim = await buildDailyReport(mockSupabase(normalRegistry()), { nowMs: NOW })
    const withSimReport = await buildDailyReport(mockSupabase(withSim()), { nowMs: NOW })
    expect(JSON.stringify(withSimReport.tomorrowTours.data)).toBe(
      JSON.stringify(withoutSim.tomorrowTours.data),
    )
  })

  it('④ sim_tag 컬럼이 아직 없는 환경(전 필드 undefined)에서도 실 예약은 전부 남는다', async () => {
    // 마이그레이션 적용 전 배포 순간을 모사한다. 여기서 실 예약이 사라지면
    // 보고서가 통째로 빈다 — 격리보다 훨씬 나쁜 실패다.
    const reg = normalRegistry()
    for (const b of reg.bookings as Row[]) delete b.sim_tag
    const report = await buildDailyReport(mockSupabase(reg), { nowMs: NOW })
    expect(report.todayTours.data[0].totalGuests).toBe(5)
    expect(report.newBookings.data.total).toBeGreaterThan(0)
  })
})

describe('kstTomorrow', () => {
  it('KST 다음날 (DST 없음)', () => {
    expect(kstTomorrow(NOW)).toBe('2026-07-25')
    // 15:00 UTC = 자정 KST 경계 다음날
    expect(kstTomorrow(Date.parse('2026-07-24T15:30:00Z'))).toBe('2026-07-26')
  })
})
