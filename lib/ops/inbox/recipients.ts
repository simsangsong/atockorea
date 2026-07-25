// AtoC 통합 — 인박스 수신자 게이트 (plan §3 A-1 보강).
//
// 왜 필요한가: Resend 인바운드는 도메인 catch-all이고, 웹훅은 계정 단위라
// 주소별 라우팅이 없다. 즉 `/api/inbound/email`을 등록하면 support@ 로 오는
// 고객 문의까지 전부 OTA 파서로 들어온다. classify.ts는 인용문에 남은
// "AtoC Korea"/A2C-######## 만으로 channel='atoc'를 잡고, "cancel"/"취소"
// 한 단어로 intent='cancel'을 잡는다 — 고객이 확정메일에 "취소하고 싶어요"
// 라고 답장하면 실제 예약이 soft-cancel 될 수 있다. 그래서 파서는 전용
// 주소로 온 메일만 처리한다.
//
// 대비되는 기존 동작: support 라우트(app/api/webhooks/resend)는 이미
// SUPPORT_INBOUND_ADDRESSES 필터가 있어 bookings@ 메일을 무시한다 —
// 두 라우트가 같은 웹훅 이벤트를 받아도 서로 침범하지 않는다.
//
// 이 모듈은 PURE — I/O 없음, 전량 단위 테스트 가능.

/** OPS_INBOUND_ADDRESSES 미설정 시의 기본 수신 주소 (plan §3 A-1). */
export const DEFAULT_OPS_INBOUND_ADDRESSES = ['bookings@atockorea.com']

/** 명시적 오프스위치: OPS_INBOUND_ADDRESSES='*' 면 게이트를 통과시킨다. */
const WILDCARD = '*'

/** null = 와일드카드(모든 수신자 허용). */
export function opsInboundAddresses(): Set<string> | null {
  const configured = process.env.OPS_INBOUND_ADDRESSES
  const source = configured ? configured.split(',') : DEFAULT_OPS_INBOUND_ADDRESSES
  const normalized = source.map((v) => v.trim().toLowerCase()).filter(Boolean)
  if (normalized.includes(WILDCARD)) return null
  return new Set(normalized)
}

function addressesFrom(value: unknown, depth = 0): string[] {
  if (!value || depth > 3) return []
  if (Array.isArray(value)) return value.flatMap((v) => addressesFrom(v, depth + 1))
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    return addressesFrom(record.email ?? record.address ?? record.value ?? '', depth + 1)
  }
  if (typeof value !== 'string') return []
  // "Name <a@b.com>, c@d.com" — 콤마 구분 다중 주소까지 분해한다.
  return value
    .split(',')
    .map((part) => {
      const angle = part.trim().match(/<([^>]+)>/)
      return (angle ? angle[1] : part).trim().toLowerCase()
    })
    .filter((email) => email.includes('@'))
}

/** headers를 {name,value}[] / {name:value} 두 형태 모두에서 조회한다. */
function headerValue(headers: unknown, name: string): unknown {
  if (!headers) return null
  const target = name.toLowerCase()
  if (Array.isArray(headers)) {
    const hit = headers.find((h) => {
      const record = h as Record<string, unknown> | null
      return typeof record?.name === 'string' && record.name.toLowerCase() === target
    })
    return (hit as Record<string, unknown> | undefined)?.value ?? null
  }
  if (typeof headers === 'object') {
    const record = headers as Record<string, unknown>
    const key = Object.keys(record).find((k) => k.toLowerCase() === target)
    return key ? record[key] : null
  }
  return null
}

/**
 * 페이로드에서 수신자 후보를 전부 긁어모은다.
 *
 * Gmail 자동전달을 쓰면 To: 헤더는 원래 OTA 수신자(운영자 Gmail)로 남고
 * 전용 주소는 봉투 수신자에만 나타난다. Gmail은 전달 시 `X-Forwarded-To`를
 * 덧붙이고, 다수 MTA는 `Delivered-To`를 남긴다 — 그래서 봉투 필드
 * (to/recipients)와 이 두 헤더까지 모두 본다.
 *
 * bcc를 반드시 포함해야 하는 이유(라이브 페이로드로 확인, 2026-07-25):
 * Resend는 헤더에 없는 봉투 수신자를 `bcc` 배열에 싣는다 — 실제 실패 이벤트가
 * `"bcc": ["support@atockorea.com"]`, To:는 다른 주소인 형태였다. bcc를 빼면
 * 숨은 수신자로 도착한 정상 메일이 통째로 거부된다.
 */
export function collectRecipients(data: Record<string, unknown>): string[] {
  const headers = data.headers
  const candidates = [
    data.to,
    data.to_email,
    data.recipients,
    data.cc,
    data.bcc,
    headerValue(headers, 'to'),
    headerValue(headers, 'cc'),
    headerValue(headers, 'delivered-to'),
    headerValue(headers, 'x-forwarded-to'),
  ]
  return Array.from(new Set(candidates.flatMap((v) => addressesFrom(v))))
}

export interface RecipientGateResult {
  accepted: boolean
  /** 관측된 수신자 전체 — 게이트가 오작동할 때 응답으로 되돌려 진단에 쓴다. */
  recipients: string[]
  /** 매치된 전용 주소 (accepted일 때만). */
  matched: string | null
}

/**
 * fail-closed: 허용 목록에 매치되는 수신자가 하나도 없으면 거부한다.
 * 수신자를 아예 못 읽어낸 경우도 거부 — 파서가 도는 것보다 안 도는 쪽이
 * 안전하다(예약 오취소 > 미처리). 진단은 recipients 배열로 노출된다.
 */
export function checkOpsInboundRecipient(data: Record<string, unknown>): RecipientGateResult {
  const recipients = collectRecipients(data)
  const allowed = opsInboundAddresses()
  if (allowed === null) return { accepted: true, recipients, matched: WILDCARD }
  const matched = recipients.find((email) => allowed.has(email)) ?? null
  return { accepted: matched !== null, recipients, matched }
}
