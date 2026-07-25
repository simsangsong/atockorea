// Resend 인바운드 페이로드에서 수신자를 읽어내는 단일 구현.
//
// 왜 공유 모듈인가: 같은 버그가 두 라우트에서 각각 났다.
//   - /api/webhooks/resend (support)  : bcc를 안 봐서 수신 메일을 조용히 버림
//   - /api/inbound/email   (OTA 파서) : 같은 누락으로 게이트가 정상 메일을 거부
// "Resend 페이로드에서 수신자를 어떻게 읽는가"는 한 곳에만 있어야 한다.
//
// 커버하는 형태 (라이브 페이로드로 확인, 2026-07-25):
//   - 문자열 / "Name <a@b.com>" / 콤마로 이어붙인 다중 주소
//   - 배열, {email|address|value} 객체
//   - 봉투 필드 to / to_email / recipients / cc / bcc
//     ※ Resend는 헤더에 없는 봉투 수신자를 bcc 배열에 싣는다 — 실제 실패
//       이벤트가 To:는 다른 주소이고 bcc에 support@atockorea.com 인 형태였다.
//   - 헤더 To / Cc / Delivered-To / X-Forwarded-To
//     ※ Gmail 자동전달은 To: 헤더에 원래 수신자를 남기고 X-Forwarded-To를 붙인다.
//   - headers가 {name,value}[] 인 경우와 {name: value} 맵인 경우 모두

function addressesFrom(value: unknown, depth = 0): string[] {
  if (!value || depth > 3) return []
  if (Array.isArray(value)) return value.flatMap((v) => addressesFrom(v, depth + 1))
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    return addressesFrom(record.email ?? record.address ?? record.value ?? '', depth + 1)
  }
  if (typeof value !== 'string') return []
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

/** 페이로드에 등장하는 모든 수신자 주소(소문자, 중복 제거). */
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

/** 허용 목록에 처음으로 걸리는 수신자 (없으면 null). */
export function matchRecipient(data: Record<string, unknown>, allowed: Set<string>): string | null {
  return collectRecipients(data).find((email) => allowed.has(email)) ?? null
}

/** "a@b.com , C@D.com" → Set(['a@b.com','c@d.com']) */
export function parseAddressList(raw: string): Set<string> {
  return new Set(
    raw
      .split(',')
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean),
  )
}
