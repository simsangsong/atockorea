/**
 * @jest-environment node
 *
 * §11.E 렌더 (render.ts) — 순수 함수, 모바일 HTML. 이상없음 배너 / 연락누락
 * 빨간 행 / 섹션 실패 배너. 네트워크 0.
 */
import { buildDailyReport } from '../daily'
import { renderDailyReport } from '../render'
import { mockSupabase, type TableRegistry } from '../test-support/supabase-mock'

const NOW = Date.parse('2026-07-24T09:00:00Z')

const EMPTY: TableRegistry = {
  tour_rooms: [], bookings: [], tours: [], tour_room_invites: [],
  ops_seat_assignments: [], tour_room_events: [], tour_room_extras: [],
  ops_room_vehicles: [], ops_vehicle_layouts: [], ops_whatsapp_send_logs: [],
  ops_email_parse_logs: [], ops_parse_failures: [],
}

describe('renderDailyReport', () => {
  it('빈 데이터: 제목·본문에 "이상 없음"', async () => {
    const report = await buildDailyReport(mockSupabase(EMPTY), { nowMs: NOW })
    const { subject, html } = renderDailyReport(report)
    expect(subject).toContain('이상 없음')
    expect(html).toContain('이상 없음')
    expect(html).toContain('오늘 진행된 투어가 없습니다')
    // 유효한 단일 HTML 문서
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true)
    expect(html).toContain('viewport') // 모바일 우선
  })

  it('정상 데이터: 연락 누락 빨간 행(🔴)·노쇼·미배정 뱃지·요주의 건수', async () => {
    const reg: TableRegistry = {
      ...EMPTY,
      tour_rooms: [
        { id: 'R1', booking_id: 'B1', tour_id: 'T1', tour_date: '2026-07-24', status: 'active' },
        { id: 'R3', booking_id: 'B3', tour_id: 'T1', tour_date: '2026-07-25', status: 'active' },
      ],
      bookings: [
        { id: 'B1', tour_id: 'T1', tour_date: '2026-07-24', created_at: '2026-07-24T02:00:00Z', number_of_guests: 2, contact_name: 'Massimo', status: 'confirmed', source: 'gyg', final_price: 144, currency: 'USD' },
        { id: 'B3', tour_id: 'T1', tour_date: '2026-07-25', created_at: '2026-07-20T02:00:00Z', number_of_guests: 2, contact_name: 'Nicoletta', status: 'confirmed', source: 'viator', final_price: 144, currency: 'USD', pickup_points: { name: 'Jeju Airport', pickup_time: '09:00' } },
      ],
      tours: [{ id: 'T1', title: 'Jeju Grand Highlights', city: 'Jeju' }],
      ops_seat_assignments: [{ booking_id: 'B1', checked_in_at: null, absent_at: '2026-07-24T08:30:00Z' }],
    }
    const report = await buildDailyReport(mockSupabase(reg), { nowMs: NOW })
    const { subject, html } = renderDailyReport(report)
    expect(html).toContain('🔴') // 연락 누락 행 (B3)
    expect(html).toContain('노쇼')
    expect(html).toContain('미배정') // 내일 가이드/기사 미배정 뱃지
    expect(subject).toContain('요주의')
  })

  it('섹션 집계 실패: 해당 섹션 카드에 실패 배너', async () => {
    const reg: TableRegistry = { ...EMPTY, ops_parse_failures: new Error('boom: reset') }
    const report = await buildDailyReport(mockSupabase(reg), { nowMs: NOW })
    expect(report.attention.ok).toBe(false)
    const { html } = renderDailyReport(report)
    expect(html).toContain('이 섹션 집계에 실패')
  })

  /**
   * 🔴 FA-014 (풀 오디트 2026-07-30) — 도착 해설이 전 기간 실발동 0이었다.
   * 코드는 정상이고(감사가 라우트를 주행하니 이벤트가 남았다) 커버리지도 122/124다.
   * 보이지 않은 이유는 **아무도 매일 세지 않았다**는 것뿐이다.
   *
   * 세 경우를 고정한다: 투어가 돌았는데 0 → 요주의 · 도착이 있으면 요주의 아님 ·
   * 투어가 없는 날은 0이 정상이라 아무 말도 하지 않음.
   */
  const ONE_TOUR_TODAY: TableRegistry = {
    ...EMPTY,
    tour_rooms: [{ id: 'R1', booking_id: 'B1', tour_id: 'T1', tour_date: '2026-07-24', status: 'active' }],
    bookings: [
      { id: 'B1', tour_id: 'T1', tour_date: '2026-07-24', created_at: '2026-07-24T02:00:00Z', number_of_guests: 2, contact_name: 'Massimo', status: 'confirmed', source: 'gyg', final_price: 144, currency: 'USD', pickup_points: { name: 'Jeju Airport', pickup_time: '09:00' } },
    ],
    tours: [{ id: 'T1', title: 'Jeju Grand Highlights', city: 'Jeju' }],
  }

  it('🔴 FA-014: 투어가 돌았는데 도착 기록 0 → 요주의 항목이 된다', async () => {
    const report = await buildDailyReport(mockSupabase(ONE_TOUR_TODAY), { nowMs: NOW })
    expect(report.attention.data.arrivals).toEqual({
      toursToday: 1,
      recorded: 0,
      sources: { manual: 0, geofence: 0 },
    })
    expect(report.attention.data.clean).toBe(false)
    const { html } = renderDailyReport(report)
    expect(html).toContain('도착 기록 0건')
  })

  it('🔴 FA-014: 두 소스를 모두 센다 — 수동 [도착]과 지오펜스', async () => {
    const reg: TableRegistry = {
      ...ONE_TOUR_TODAY,
      tour_room_events: [
        { id: 'E1', room_id: 'R1', type: 'manual_arrival', created_at: '2026-07-24T03:00:00Z', payload: {} },
      ],
      // 지오펜스는 다른 테이블에 떨어진다 — 하나만 읽는 것이 이 레포의 반복 결함이다.
      tour_room_spot_events: [
        { id: 'S1', room_id: 'R1', event_type: 'arrived', created_at: '2026-07-24T04:00:00Z' },
      ],
    }
    const report = await buildDailyReport(mockSupabase(reg), { nowMs: NOW })
    expect(report.attention.data.arrivals).toEqual({
      toursToday: 1,
      recorded: 2,
      sources: { manual: 1, geofence: 1 },
    })
    const { html } = renderDailyReport(report)
    // 도착이 있으면 요주의 목록에는 안 들어가고, 계측 한 줄로만 남는다.
    expect(html).not.toContain('도착 기록 0건 (오늘 투어')
    expect(html).toContain('도착 기록 2건')
  })

  it('🔴 FA-014: 투어가 없는 날은 0이 정상이라 아무 말도 하지 않는다', async () => {
    const report = await buildDailyReport(mockSupabase(EMPTY), { nowMs: NOW })
    expect(report.attention.data.arrivals).toBeNull()
    const { html } = renderDailyReport(report)
    expect(html).not.toContain('도착 기록')
    expect(html).toContain('이상 없음')
  })
})
