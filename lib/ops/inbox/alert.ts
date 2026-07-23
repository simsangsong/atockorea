// AtoC 통합 Phase 1 slice 2 — low-confidence parse alert (plan §3 A-6 <0.60).
//
// Mirrors lib/ops/parse/operator-alert.ts (masked content ONLY, best-effort,
// never throws) but is gated on OPS_ALERT_EMAIL: when the env var is absent the
// send is SKIPPED entirely — no Resend call is ever attempted (slice-2 spec:
// code exists, sending stays off until Jason sets the address).

import { Resend } from 'resend'

export interface LowConfidenceAlertInput {
  channel: string
  intent: string
  messageId: string | null
  /** maskLine() output only — never raw PII. */
  maskedSamples: string[]
  failedCount: number
  totalCount: number
}

export interface LowConfidenceAlertResult {
  sent: boolean
  skipped: boolean
  error?: string
}

export async function sendLowConfidenceAlert(input: LowConfidenceAlertInput): Promise<LowConfidenceAlertResult> {
  const to = process.env.OPS_ALERT_EMAIL
  if (!to) return { sent: false, skipped: true }
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { sent: false, skipped: true, error: 'RESEND_API_KEY not configured' }

  const fromDomain = process.env.RESEND_FROM_DOMAIN ?? 'atockorea.com'
  const samples = input.maskedSamples
    .slice(0, 10)
    .map((s) => `<li><code>${escapeHtml(s.slice(0, 240))}</code></li>`)
    .join('')

  const subject = `[AtoC 인박스] ⚠ 파싱 실패 ${input.failedCount}건 — ${input.channel}/${input.intent}`
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:640px">
      <h2 style="margin:0 0 8px">인박스 자동 파싱 실패</h2>
      <p>수신 이메일 파싱 결과 <b>${input.failedCount}건이 신뢰도 0.60 미만</b>으로 실패했습니다
         (총 ${input.totalCount}건). 수동 붙여넣기 폴백이 필요할 수 있습니다.</p>
      <ul style="line-height:1.6">
        <li>채널: <code>${escapeHtml(input.channel)}</code> / 의도: <code>${escapeHtml(input.intent)}</code></li>
        <li>메시지 ID: <code>${escapeHtml(input.messageId ?? '-')}</code></li>
      </ul>
      <p style="margin:12px 0 4px"><b>실패 샘플 (마스킹됨 — 실제 PII 아님):</b></p>
      <ul style="line-height:1.5;font-size:13px">${samples}</ul>
      <p style="color:#888;font-size:12px;margin-top:16px">
        자동 발송 — 본문은 maskLine() 마스킹본만 포함합니다(생 PII 없음). 원문 이메일은 저장되지 않았습니다.
      </p>
    </div>`

  try {
    const { error } = await new Resend(apiKey).emails.send({
      from: `AtoC Ops Alerts <alerts@${fromDomain}>`,
      to,
      subject,
      html,
    })
    return error ? { sent: false, skipped: false, error: String((error as { message?: string }).message ?? error) } : { sent: true, skipped: false }
  } catch (e) {
    return { sent: false, skipped: false, error: e instanceof Error ? e.message : 'unknown' }
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
