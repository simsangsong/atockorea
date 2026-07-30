/**
 * @jest-environment node
 *
 * §11.E 렌더 (render.ts) — 순수 함수, 모바일 HTML. 이상없음 배너 / 연락누락
 * 빨간 행 / 섹션 실패 배너. 네트워크 0.
 */
import { buildDailyReport } from '../daily'
import { renderDailyReport, attentionCount, attentionItems } from '../render'
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

  /**
   * 🔴 사장님이 보내주신 2026-07-30 18:00 보고서 캡처에서 나온 결함.
   *
   * 상단 배지와 제목은 "이상 없음"인데 같은 메일 ⑤번 목록에는 **오토파일럿
   * 미처리 제안 23건이 빨갛게, 체크 안 된 채로** 있었다. 헤드라인이 본문과
   * 반대를 말한 것이다 — 폰으로 배지만 보는 사람에게는 23건이 없는 것과 같다.
   *
   * 원인은 같은 숫자를 두 곳에서 센 것: 배지·제목의 합계는 필드를 손으로
   * 더하면서 `autopilotOpen` 을 빠뜨렸고, ⑤번의 판단은 그걸 포함했다.
   * 이제 다섯 곳이 `attentionItems()` 하나를 읽는다.
   */
  describe('🔴 헤드라인은 목록과 반대를 말할 수 없다', () => {
    const withAutopilot = { ...EMPTY }

    it('오토파일럿 미처리가 있으면 배지·제목·목록이 모두 요주의다', async () => {
      const report = await buildDailyReport(mockSupabase(withAutopilot), { nowMs: NOW })
      // 데이터층을 직접 흔든다 — 이 테이블은 mock 레지스트리에 없을 수 있다.
      report.attention.data.autopilotOpen = 23
      const { subject, html } = renderDailyReport(report)

      expect(attentionCount(report.attention.data)).toBe(23)
      expect(subject).toContain('요주의')
      expect(subject).not.toContain('이상 없음')
      expect(html).toContain('오토파일럿 미처리 제안')
      // 배지가 초록 "이상 없음" 이면 안 된다.
      expect(html).not.toMatch(/border-radius:999px;">이상 없음</)
    })

    it('합계는 목록의 합과 정확히 같다 — 손으로 더한 값이 아니다', async () => {
      const report = await buildDailyReport(mockSupabase(EMPTY), { nowMs: NOW })
      const a = report.attention.data
      a.autopilotOpen = 3
      a.unassignedRooms = 2
      a.arrivals = { toursToday: 1, recorded: 0, sources: { manual: 0, geofence: 0 } }

      const items = attentionItems(a)
      expect(attentionCount(a)).toBe(items.reduce((n, it) => n + it.n, 0))
      // 새로 들어온 두 항목이 실제로 목록에 있다.
      expect(items.map((it) => it.label)).toEqual(
        expect.arrayContaining(['오토파일럿 미처리 제안', expect.stringContaining('도착 기록 0건')]),
      )
    })

    it('데이터층의 clean 플래그와 렌더 판단이 어긋나지 않는다', async () => {
      const report = await buildDailyReport(mockSupabase(EMPTY), { nowMs: NOW })
      const a = report.attention.data
      for (const mutate of [
        () => { a.autopilotOpen = 5 },
        () => { a.autopilotOpen = 0; a.unseated = 1 },
        () => { a.unseated = 0; a.arrivals = { toursToday: 2, recorded: 0, sources: { manual: 0, geofence: 0 } } },
        () => { a.arrivals = { toursToday: 2, recorded: 4, sources: { manual: 3, geofence: 1 } } },
      ]) {
        mutate()
        // buildAttention 이 계산한 clean 과 렌더가 쓰는 합계는 같은 뜻이어야 한다.
        const cleanByData =
          a.unassignedRooms === 0 && a.uncontacted === 0 && a.reviewQueued === 0 &&
          a.parseFailures === 0 && a.unseated === 0 && (a.overCapacity ?? []).length === 0 &&
          (a.autopilotOpen ?? 0) === 0 && (a.llm?.overBudgetTours ?? []).length === 0 &&
          !(a.arrivals !== null && a.arrivals.recorded === 0)
        expect(attentionCount(a) === 0).toBe(cleanByData)
      }
    })
  })

  /**
   * 🔴 사장님 캡처의 나머지 절반: 23건이 **전부 지난 투어일**(7/26~7/30)이었다.
   *
   * 제안은 날짜가 지나도 스스로 닫히지 않으므로 이 숫자는 자라기만 하고,
   * 자라기만 하는 숫자는 며칠 만에 안 읽힌다. 이 큐의 값은 설계 주석이 직접
   * 적어놨다 — "내일·모레 투어인데 안내가 안 나갔다". 지난 날짜 제안은 정의상
   * 사후 보고이고, 그게 이 크론이 피하려던 것이다.
   *
   * 그래서 요주의는 **오늘 이후만** 세고, 지난 것은 지우지 않고 따로 보고한다.
   */
  describe('🔴 지난 날짜 제안은 요주의가 아니라 큐 위생이다', () => {
    const SUGGESTIONS = (dates: Array<string | null>) =>
      dates.map((d, i) => ({ id: `s${i}`, status: 'suggested', tour_date: d }))

    it('오늘 이후만 요주의로 세고, 지난 것은 따로 보고한다', async () => {
      const reg: TableRegistry = {
        ...EMPTY,
        // NOW는 2026-07-24. 지난 것 3 · 오늘 1 · 미래 1 · 날짜 없음 1.
        ops_autopilot_suggestions: SUGGESTIONS([
          '2026-07-21', '2026-07-22', '2026-07-23',
          '2026-07-24', '2026-07-26', null,
        ]),
      }
      const report = await buildDailyReport(mockSupabase(reg), { nowMs: NOW })
      const a = report.attention.data
      expect(a.autopilotOpen).toBe(3) // 오늘 + 미래 + 날짜없음
      expect(a.autopilotStale).toBe(3)

      const { html, subject } = renderDailyReport(report)
      expect(subject).toContain('요주의 3건')
      expect(html).toContain('지난 날짜 오토파일럿 제안 3건')
    })

    it('전부 지난 날짜면 요주의는 0이지만 사실은 숨기지 않는다', async () => {
      const reg: TableRegistry = {
        ...EMPTY,
        ops_autopilot_suggestions: SUGGESTIONS(['2026-07-20', '2026-07-21']),
      }
      const report = await buildDailyReport(mockSupabase(reg), { nowMs: NOW })
      expect(report.attention.data.autopilotOpen).toBe(0)

      const { html, subject } = renderDailyReport(report)
      expect(subject).toContain('이상 없음')
      // 깨끗한 날 배너 옆에도 큐 상태는 남는다 — 안 보이면 영영 안 치운다.
      expect(html).toContain('지난 날짜 오토파일럿 제안 2건')
    })
  })
})
