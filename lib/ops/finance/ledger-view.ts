// AtoC 통합 F-슬라이스 — 원장 조회 화면(§6.8)의 순수 헬퍼.
//
// Next 서버 의존성(next/server·auth·supabase) 없이 단위 테스트 가능하도록
// 순수 함수만 분리한다. API 라우트(app/api/admin/ops-finance/ledger)가 이걸 사용.

export interface LedgerViewRow {
  entity: string
  booking_id: string | null
  type: string
  amount_minor: number
  currency: string
}

export interface LedgerTotals {
  currency: string
  grossMinor: number
  commissionMinor: number
  remitMinor: number
  bookingCount: number
}

export function emptyLedgerTotals(): LedgerTotals {
  return { currency: 'USD', grossMinor: 0, commissionMinor: 0, remitMinor: 0, bookingCount: 0 }
}

/**
 * 기간 합계. gross = Σ(us revenue), commission = Σ(us commission),
 * remit(95%) = gross − commission (송금분은 캡처 시 원장에 별도 행으로 남기지
 * 않고 여기서 파생 — 실제 송금은 별도 슬라이스에서 remit 행으로 기입).
 * currency는 원장 us 행에서 관측된 첫 통화(현 구조상 단일 USD).
 */
export function computeLedgerTotals(rows: LedgerViewRow[]): LedgerTotals {
  let grossMinor = 0
  let commissionMinor = 0
  let currency = 'USD'
  const bookingIds = new Set<string>()

  for (const r of rows) {
    if (r.entity !== 'us') continue
    if (r.currency) currency = r.currency.toUpperCase()
    if (r.booking_id) bookingIds.add(r.booking_id)
    if (r.type === 'revenue') grossMinor += r.amount_minor
    else if (r.type === 'commission') commissionMinor += r.amount_minor
  }

  return {
    currency,
    grossMinor,
    commissionMinor,
    remitMinor: grossMinor - commissionMinor,
    bookingCount: bookingIds.size,
  }
}

/** PostgREST가 미존재 테이블에 내는 코드(스키마 캐시에 릴레이션 없음 / undefined_table). */
export function isMissingTableError(code: string | undefined | null): boolean {
  return code === 'PGRST205' || code === 'PGRST200' || code === '42P01'
}

/**
 * 같은 판정을 '메시지'로 해야 할 때. settlement.ts의 IO 헬퍼는 PostgREST 오류를
 * Error(message)로 감싸 던지므로 코드가 남지 않는다 — 마이그레이션 적용 전에도
 * 화면이 500 대신 "테이블 미적용" 안내를 띄우게 하려면 문자열로 알아봐야 한다.
 */
export function isMissingTableMessage(message: string | undefined | null): boolean {
  if (!message) return false
  return /schema cache|does not exist|PGRST205|PGRST200|42P01/i.test(message)
}

/** 'YYYY-MM' 형식만 통과, 아니면 null. */
export function normalizeLedgerPeriod(raw: string | null): string | null {
  if (raw && /^\d{4}-\d{2}$/.test(raw)) return raw
  return null
}
