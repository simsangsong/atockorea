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
})
