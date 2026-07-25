// support 인박스 저장 로직 — 웹훅 라우트와 백필 스크립트의 단일 구현.
//
// 왜 분리했나: 2026-05-21 이후 Resend가 받은 메일이 DB에 한 건도 없다
// (웹훅이 apex 도메인 307에 막혀 라우트에 닿지 못했다). 놓친 메일을
// Received API에서 다시 끌어와 넣으려면 라우트 밖에서도 같은 저장 규칙을
// 쓸 수 있어야 한다 — 규칙이 두 벌이면 백필본과 실시간분이 서로 달라진다.
//
// 멱등: received_emails.message_id UNIQUE. 재실행/재전송은 duplicate로 끝난다.

import type { SupabaseClient } from '@supabase/supabase-js'
import { collectRecipients, parseAddressList } from '@/lib/email/inbound-recipients'

const DEFAULT_SUPPORT_INBOUND_ADDRESSES = 'support@atockorea.com,support@atcokorea.com'

export function supportInboundAddresses(): Set<string> {
  return parseAddressList(process.env.SUPPORT_INBOUND_ADDRESSES || DEFAULT_SUPPORT_INBOUND_ADDRESSES)
}

// 자기 발신 루프백 (2026-07-25 라이브 확인):
// ADMIN_BOOKING_NOTIFICATION_EMAILS에 support@atockorea.com이 들어 있고
// support@는 Resend 인바운드 catch-all이다. 그래서 예약 알림·SOS 알림 등
// 우리가 보낸 메일이 그대로 수신 인박스로 되돌아온다 — 수신분 34건 중 15건이
// 이것이었다. contact_inquiries(고객 문의 큐)에 넣으면 예약이 들어올 때마다
// 가짜 "새 문의"가 쌓이므로, 기록(received_emails)은 남기되 문의는 만들지 않는다.
const DEFAULT_SELF_SEND_ADDRESSES =
  'support@atockorea.com,noreply@atockorea.com,alerts@atockorea.com,support@atcokorea.com'

export function selfSendAddresses(): Set<string> {
  return parseAddressList(process.env.SUPPORT_SELF_SEND_ADDRESSES || DEFAULT_SELF_SEND_ADDRESSES)
}

type ParsedEmailAddress = { email: string; name: string | null }

/** "Name <a@b.com>" / 객체 / 배열에서 첫 주소와 표시이름을 뽑는다. */
export function firstEmailAddress(...values: unknown[]): ParsedEmailAddress {
  for (const value of values) {
    const found = pickAddress(value)
    if (found.email) return found
  }
  return { email: '', name: null }
}

function pickAddress(value: unknown, depth = 0): ParsedEmailAddress {
  if (!value || depth > 3) return { email: '', name: null }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = pickAddress(item, depth + 1)
      if (found.email) return found
    }
    return { email: '', name: null }
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    const inner = pickAddress(record.email ?? record.address ?? record.value ?? '', depth + 1)
    const name = typeof record.name === 'string' && record.name.trim() ? record.name.trim() : inner.name
    return inner.email ? { email: inner.email, name } : { email: '', name: null }
  }
  if (typeof value !== 'string') return { email: '', name: null }
  const first = value.split(',')[0]?.trim() ?? ''
  const angle = first.match(/^(.+?)\s*<([^>]+)>$/)
  if (angle) {
    const name = angle[1].trim().replace(/^["']|["']$/g, '') || null
    return { email: angle[2].trim().toLowerCase(), name }
  }
  return first.includes('@') ? { email: first.toLowerCase(), name: null } : { email: '', name: null }
}

function stringField(data: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = data[key]
    if (typeof value === 'string' && value) return value
  }
  return ''
}

/** 제목·본문 키워드로 자동 분류 (기존 라우트 규칙 그대로). */
export function categorizeEmail(subject: string, content: string): string {
  const s = subject.toLowerCase()
  const c = content.toLowerCase()
  if (s.includes('support') || c.includes('help') || c.includes('assistance')) return 'support'
  if (s.includes('inquiry') || s.includes('question') || s.includes('ask')) return 'inquiry'
  if (s.includes('complaint') || s.includes('refund') || s.includes('cancel')) return 'complaint'
  if (s.includes('booking') || s.includes('reservation') || s.includes('tour')) return 'booking'
  return 'other'
}

export type StoreOutcome =
  | { result: 'stored'; emailId: string; toEmail: string }
  /** 자기 발신 루프백 — received_emails에는 남기고 고객 문의는 만들지 않았다. */
  | { result: 'stored_self'; emailId: string; toEmail: string }
  | { result: 'duplicate'; toEmail: string }
  | { result: 'not_support'; recipients: string[] }
  | { result: 'error'; stage: 'received_emails' | 'contact_inquiries'; message: string }

export interface StoreReceivedEmailInput {
  supabase: SupabaseClient
  /** Resend `email.received` data 또는 Received API 응답 본문. */
  data: Record<string, unknown>
  /** 기본 message_id (payload에 없을 때). */
  fallbackMessageId?: string
  /** true면 DB에 쓰지 않고 판정만 반환 (백필 --dry-run). */
  dryRun?: boolean
}

export async function storeReceivedEmail(input: StoreReceivedEmailInput): Promise<StoreOutcome> {
  const { supabase, data, dryRun = false } = input

  // 수신자 판정은 공유 구현으로 — to/cc/bcc/recipients + Delivered-To/
  // X-Forwarded-To 까지 본다. bcc 누락이 이 라우트가 메일을 버리던 원인이었다.
  const recipients = collectRecipients(data)
  const allowed = supportInboundAddresses()
  const toEmail = recipients.find((email) => allowed.has(email)) ?? ''
  if (!toEmail) return { result: 'not_support', recipients }

  const messageIdRaw = data.message_id ?? data.email_id ?? data.id ?? input.fallbackMessageId
  const messageId = typeof messageIdRaw === 'string' && messageIdRaw.trim() ? messageIdRaw.trim() : ''
  if (!messageId) return { result: 'error', stage: 'received_emails', message: 'missing message id' }

  const from = firstEmailAddress(data.from, data.from_email)
  const fromEmail = from.email || 'unknown@unknown'
  const fromName = from.name ?? (typeof data.from_name === 'string' ? data.from_name : null)

  const subject = typeof data.subject === 'string' && data.subject ? data.subject : '(No Subject)'
  const textContent = stringField(data, 'text', 'text_content')
  const htmlContent = stringField(data, 'html', 'html_content')
  const attachments = Array.isArray(data.attachments) ? data.attachments : []

  const isSelfSend = selfSendAddresses().has(fromEmail)

  if (dryRun) {
    // dry-run도 중복은 실제로 조회한다 — 안 그러면 "저장 N건"이 이미 들어있는
    // 행까지 세어 실행 전 예측이 틀린다(백필 판단의 근거가 되는 숫자다).
    const { data: existing } = await supabase
      .from('received_emails')
      .select('id')
      .eq('message_id', messageId)
      .maybeSingle()
    if (existing) return { result: 'duplicate', toEmail }
    return { result: isSelfSend ? 'stored_self' : 'stored', emailId: '(dry-run)', toEmail }
  }

  const insertPayload = {
    message_id: messageId,
    from_email: fromEmail,
    from_name: fromName,
    to_email: toEmail,
    subject,
    text_content: textContent || null,
    html_content: htmlContent || null,
    attachments: attachments.map(
      (att: { filename?: string; name?: string; content_type?: string; type?: string; size?: number }) => ({
        filename: att.filename ?? att.name,
        content_type: att.content_type ?? att.type,
        size: att.size ?? 0,
      }),
    ),
    category: isSelfSend ? 'self_notification' : categorizeEmail(subject, textContent),
  }

  const { data: row, error } = await supabase.from('received_emails').insert(insertPayload).select().single()
  if (error) {
    if ((error as { code?: string }).code === '23505') return { result: 'duplicate', toEmail }
    return { result: 'error', stage: 'received_emails', message: error.message }
  }

  // 자기 발신 루프백은 고객 문의가 아니다 — 기록만 남기고 큐는 건드리지 않는다.
  if (isSelfSend) return { result: 'stored_self', emailId: (row as { id: string }).id, toEmail }

  const { error: inquiryErr } = await supabase.from('contact_inquiries').insert({
    full_name: fromName || fromEmail.split('@')[0] || 'Unknown',
    email: fromEmail,
    subject,
    message: (textContent || htmlContent || '').slice(0, 50000),
    privacy_consent: true,
    status: 'new',
    is_read: false,
  })
  if (inquiryErr) return { result: 'error', stage: 'contact_inquiries', message: inquiryErr.message }

  return { result: 'stored', emailId: (row as { id: string }).id, toEmail }
}
