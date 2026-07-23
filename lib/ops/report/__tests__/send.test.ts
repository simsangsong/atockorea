/**
 * @jest-environment node
 *
 * §11.E 발송 오케스트레이션 + 멱등 (send.ts). 실제 발송은 mock 주입 →
 * 네트워크 0, Resend 모듈 미로드. 멱등: 같은 날 재발송 안 함, force 우회.
 */
import { runDailyReport, DEFAULT_REPORT_RECIPIENT } from '../send'
import { mockSupabase, type TableRegistry } from '../test-support/supabase-mock'

const NOW = Date.parse('2026-07-24T09:00:00Z') // today = 2026-07-24

const EMPTY: TableRegistry = {
  tour_rooms: [], bookings: [], tours: [], tour_room_invites: [],
  ops_seat_assignments: [], tour_room_events: [], tour_room_extras: [],
  ops_room_vehicles: [], ops_vehicle_layouts: [], ops_whatsapp_send_logs: [],
  ops_email_parse_logs: [], ops_parse_failures: [],
}

type SendArgs = { to: string | string[]; subject: string; html: string; text?: string }

function okSend() {
  return jest.fn(async (_args: SendArgs) => ({ success: true, messageId: 'em-1' }))
}

describe('runDailyReport 멱등', () => {
  it('최초 발송(원장 없음): 발송하고 sent=true, 기본 수신자', async () => {
    const send = okSend()
    const reg: TableRegistry = { ...EMPTY, ops_daily_report_log: [] }
    const res = await runDailyReport({ supabase: mockSupabase(reg), send, nowMs: NOW })
    expect(res.sent).toBe(true)
    expect(res.skipped).toBe(false)
    expect(res.recipient).toBe(DEFAULT_REPORT_RECIPIENT)
    expect(send).toHaveBeenCalledTimes(1)
    const arg = send.mock.calls[0][0]
    expect(arg.to).toBe(DEFAULT_REPORT_RECIPIENT)
    expect(arg.subject).toContain('일일보고')
    expect(arg.html).toContain('<!DOCTYPE html>')
  })

  it('같은 날 이미 발송됨(원장 존재) + force 아님: 재발송 안 함(skipped)', async () => {
    const send = okSend()
    const reg: TableRegistry = {
      ...EMPTY,
      ops_daily_report_log: [{ id: 'L', tenant_id: 'atockorea', report_date: '2026-07-24', send_count: 1 }],
    }
    const res = await runDailyReport({ supabase: mockSupabase(reg), send, nowMs: NOW })
    expect(res.sent).toBe(false)
    expect(res.skipped).toBe(true)
    expect(res.reason).toBe('already_sent_today')
    expect(send).not.toHaveBeenCalled()
  })

  it('같은 날 이미 발송됨 + force=true: 강제 재발송', async () => {
    const send = okSend()
    const reg: TableRegistry = {
      ...EMPTY,
      ops_daily_report_log: [{ id: 'L', tenant_id: 'atockorea', report_date: '2026-07-24', send_count: 1 }],
    }
    const res = await runDailyReport({ supabase: mockSupabase(reg), send, force: true, nowMs: NOW })
    expect(res.sent).toBe(true)
    expect(res.skipped).toBe(false)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('원장 테이블 미적용(42P01): 멱등 스킵하고 발송(graceful)', async () => {
    const send = okSend()
    // ops_daily_report_log 키 자체를 registry에서 생략 → 기본 [] 로 취급되어
    // maybeSingle null → 발송. (실서비스에선 42P01도 동일하게 graceful.)
    const res = await runDailyReport({ supabase: mockSupabase({ ...EMPTY }), send, nowMs: NOW })
    expect(res.sent).toBe(true)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('발송 실패: sent=false, reason send_failed, 원장 미기록', async () => {
    const send = jest.fn(async (_args: SendArgs) => ({ success: false, error: 'resend down' }))
    const reg: TableRegistry = { ...EMPTY, ops_daily_report_log: [] }
    const res = await runDailyReport({ supabase: mockSupabase(reg), send, nowMs: NOW })
    expect(res.sent).toBe(false)
    expect(res.reason).toBe('send_failed')
    expect(res.error).toBe('resend down')
  })

  it('recipient override 존중', async () => {
    const send = okSend()
    const res = await runDailyReport({
      supabase: mockSupabase({ ...EMPTY, ops_daily_report_log: [] }),
      send,
      recipient: 'ops@example.com',
      nowMs: NOW,
    })
    expect(res.recipient).toBe('ops@example.com')
    expect(send.mock.calls[0][0].to).toBe('ops@example.com')
  })
})
