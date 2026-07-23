// AtoC 통합 §11.E — 일일 보고서 발송 오케스트레이션 + 멱등.
//
// runDailyReport: 집계(daily.ts) → 렌더(render.ts) → 멱등 검사 → 발송 → 마커 기록.
// cron(GET, force=?)과 수동 원버튼(POST, force=true)이 공유하는 단일 진입점.
//
// 멱등 (plan §11.E): 같은 날(KST) 이미 발송했으면 재발송 안 함. force=true면
// 게이트 우회(수동 재발송) + send_count/last_forced_at 갱신. 멱등 원장
// (ops_daily_report_log) 테이블이 아직 미적용이면 graceful — 멱등 스킵(항상 발송),
// 마커 기록만 건너뜀. 원문 발송은 mock 불가한 실제 Resend이므로 테스트는 send
// 주입으로 네트워크 0 유지.

import type { SupabaseClient } from '@supabase/supabase-js'
import { buildDailyReport } from './daily'
import { renderDailyReport } from './render'
import { kstToday } from '@/lib/tour-room/time'

export const DEFAULT_REPORT_RECIPIENT = 'simsangsong@gmail.com'

export type ReportSendFn = (args: {
  to: string | string[]
  subject: string
  html: string
  text?: string
}) => Promise<{ success: boolean; error?: string; messageId?: string }>

export interface RunDailyReportInput {
  supabase: SupabaseClient
  /** 기본 실제 Resend(lib/email.sendEmail). 테스트는 mock 주입(네트워크 0). */
  send?: ReportSendFn
  force?: boolean
  nowMs?: number
  recipient?: string
  tenantId?: string
}

export interface RunDailyReportResult {
  sent: boolean
  skipped: boolean
  reason?: string
  reportDate: string
  recipient: string
  subject?: string
  attentionTotal: number | null
  messageId?: string
  error?: string
}

function isMissingTable(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null
  return Boolean(e && (e.code === '42P01' || (typeof e.message === 'string' && /does not exist|42P01/i.test(e.message))))
}

/** 오늘(KST) 이미 발송됐는지 — 원장 테이블 부재 시 false(멱등 스킵). */
async function alreadySentToday(
  supabase: SupabaseClient,
  tenantId: string,
  reportDate: string,
): Promise<{ sent: boolean; row: { id: string; send_count: number | null } | null }> {
  try {
    const { data, error } = await supabase
      .from('ops_daily_report_log')
      .select('id, send_count')
      .eq('tenant_id', tenantId)
      .eq('report_date', reportDate)
      .maybeSingle()
    if (error) {
      if (isMissingTable(error)) return { sent: false, row: null }
      throw error
    }
    return { sent: Boolean(data), row: (data as { id: string; send_count: number | null } | null) ?? null }
  } catch (e) {
    if (isMissingTable(e)) return { sent: false, row: null }
    throw e
  }
}

/** 발송 후 마커 기록/갱신 (best-effort — 테이블 부재/오류는 발송을 되돌리지 않음). */
async function recordSent(
  supabase: SupabaseClient,
  args: {
    tenantId: string
    reportDate: string
    recipient: string
    subject: string
    attentionTotal: number | null
    existing: { id: string; send_count: number | null } | null
    forced: boolean
  },
): Promise<void> {
  try {
    if (args.existing) {
      await supabase
        .from('ops_daily_report_log')
        .update({
          subject: args.subject,
          attention_total: args.attentionTotal,
          last_forced_at: args.forced ? new Date().toISOString() : undefined,
          send_count: (args.existing.send_count ?? 1) + 1,
        })
        .eq('id', args.existing.id)
    } else {
      await supabase.from('ops_daily_report_log').insert({
        tenant_id: args.tenantId,
        report_date: args.reportDate,
        recipient: args.recipient,
        subject: args.subject,
        attention_total: args.attentionTotal,
      })
    }
  } catch (e) {
    if (isMissingTable(e)) return // 원장 미적용 — 멱등 없이 발송만 (문서화됨)
    // 마커 실패는 발송을 되돌리지 않는다 — 로그만.
    console.warn('[daily-report] recordSent failed:', e)
  }
}

export async function runDailyReport(input: RunDailyReportInput): Promise<RunDailyReportResult> {
  const nowMs = input.nowMs ?? Date.now()
  const tenantId = input.tenantId ?? 'atockorea'
  const reportDate = kstToday(nowMs)
  const recipient = input.recipient ?? process.env.OPS_REPORT_EMAIL ?? DEFAULT_REPORT_RECIPIENT
  const force = Boolean(input.force)

  // 멱등 게이트 (force면 우회).
  const prior = await alreadySentToday(supabase(input), tenantId, reportDate)
  if (prior.sent && !force) {
    return {
      sent: false,
      skipped: true,
      reason: 'already_sent_today',
      reportDate,
      recipient,
      attentionTotal: null,
    }
  }

  const report = await buildDailyReport(input.supabase, { nowMs })
  const { subject, html } = renderDailyReport(report)
  const a = report.attention.data
  const attentionTotal = report.attention.ok
    ? a.unassignedRooms + a.uncontacted + a.reviewQueued + a.parseFailures + a.unseated
    : null

  const send = input.send ?? (await defaultSend())
  const result = await send({ to: recipient, subject, html })

  if (!result.success) {
    return {
      sent: false,
      skipped: false,
      reason: 'send_failed',
      reportDate,
      recipient,
      subject,
      attentionTotal,
      error: result.error,
    }
  }

  await recordSent(input.supabase, {
    tenantId,
    reportDate,
    recipient,
    subject,
    attentionTotal,
    existing: prior.row,
    forced: force,
  })

  return {
    sent: true,
    skipped: false,
    reportDate,
    recipient,
    subject,
    attentionTotal,
    messageId: result.messageId,
  }
}

function supabase(input: RunDailyReportInput): SupabaseClient {
  return input.supabase
}

/** 실제 발송 경로 — lib/email.sendEmail (기존 Resend 경로 재사용). 지연 import로
 *  테스트가 send를 주입하면 Resend 모듈 체인을 아예 로드하지 않는다. */
async function defaultSend(): Promise<ReportSendFn> {
  const mod = await import('@/lib/email')
  return mod.sendEmail
}
