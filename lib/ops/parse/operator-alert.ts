// Parser Autopilot — REAL-TIME operator alert (the live-screen anti-churn lever).
//
// The agent loop hardens FUTURE imports; it cannot save the tenant's current
// screen (patch→CI→deploy is tens of minutes). What saves the deal in the live
// sitting is a human reaching out within minutes. So when an import LARGELY
// fails (more signal-present bookings dropped than parsed — the "new tenant
// pasted their sheet and saw mostly nothing" case), email the platform operator
// immediately so they can personally help before the tenant churns.
//
// Best-effort + fire-and-forget: never throws, never blocks the import. Masked
// content ONLY (raw_line_masked = maskLine output) — no raw guest PII, ever.

import { Resend } from 'resend'
import type { SupabaseClient } from '@supabase/supabase-js'

/** Fire only on a genuinely bad import: enough signal-present leftover AND more
 *  dropped than parsed. Avoids alert fatigue on normal partial imports. Pure. */
export function shouldAlertOperator(input: {
  signalPresentLeftovers: number
  totalBookings: number
  floor?: number
}): boolean {
  const floor = input.floor ?? 3
  if (input.signalPresentLeftovers < floor) return false
  // "Largely failed" = at least as many extractable rows dropped as parsed.
  return input.signalPresentLeftovers >= input.totalBookings
}

export interface OperatorAlertInput {
  supabase: SupabaseClient
  tenantId: string
  shape: string
  formatFingerprint: string
  signalPresentLeftovers: number
  totalBookings: number
  /** Already-masked excerpts (maskLine output). */
  maskedSamples: string[]
  autopilotTriggered: boolean
}

/** Send the operator a masked failure alert. No-op (false) until RESEND_API_KEY
 *  is configured. Recipient = PLATFORM_OPERATOR_EMAIL (default the owner). */
export async function sendOperatorParseFailureAlert(input: OperatorAlertInput): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return false
  const to = process.env.PLATFORM_OPERATOR_EMAIL ?? 'simsangsong@gmail.com'
  const fromDomain = process.env.RESEND_FROM_DOMAIN ?? 'atockorea.com'
  const appOrigin = (process.env.NEXT_PUBLIC_APP_ORIGIN ?? `https://${fromDomain}`).replace(/\/$/, '')

  // atockorea port: single-tenant — no tenants table lookup (kursoflow queried
  // tenants.name here). tenantId defaults to 'atockorea' throughout the funnel.
  const tenantName = input.tenantId

  const samples = input.maskedSamples
    .slice(0, 10)
    .map(s => `<li><code>${escapeHtml(s.slice(0, 240))}</code></li>`)
    .join('')

  const subject = `[AtoC] ⚠ 임포트 대량 파싱 실패 — ${tenantName} (${input.signalPresentLeftovers}건 누락)`
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:640px">
      <h2 style="margin:0 0 8px">임포트가 대부분 실패했습니다</h2>
      <p>한 테넌트의 임포트에서 <b>추출 가능한 ${input.signalPresentLeftovers}건이 누락</b>되고
         ${input.totalBookings}건만 파싱됐습니다. 첫인상 이탈 위험이 있어 즉시 연락이 필요할 수 있습니다.</p>
      <ul style="line-height:1.6">
        <li>테넌트: <b>${escapeHtml(tenantName)}</b> (<code>${input.tenantId}</code>)</li>
        <li>입력 형태(shape): <code>${escapeHtml(input.shape)}</code></li>
        <li>포맷 지문: <code>${escapeHtml(input.formatFingerprint.slice(0, 16))}</code></li>
        <li>파서 자동개선(autopilot) 트리거됨: <b>${input.autopilotTriggered ? '예' : '아니오'}</b></li>
      </ul>
      <p style="margin:12px 0 4px"><b>누락 샘플 (마스킹됨 — 실제 PII 아님):</b></p>
      <ul style="line-height:1.5;font-size:13px">${samples}</ul>
      <p style="margin-top:16px">
        <a href="${appOrigin}/admin/platform" style="background:#e8572a;color:#fff;padding:8px 14px;border-radius:6px;text-decoration:none">플랫폼 콘솔 열기</a>
      </p>
      <p style="color:#888;font-size:12px;margin-top:16px">
        자동 발송 — 본문은 maskLine() 마스킹본만 포함합니다(생 PII 없음). 파서는 이 형태를 자동으로 학습/개선 중입니다.
      </p>
    </div>`

  try {
    const { error } = await new Resend(apiKey).emails.send({
      from: `AtoC Ops Alerts <alerts@${fromDomain}>`,
      to,
      subject,
      html,
    })
    return !error
  } catch {
    return false
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
