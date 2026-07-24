/**
 * 정산 사이클(Phase 3) 라우트 테스트용 인메모리 Supabase 대역.
 *
 * 멱등성이 이 슬라이스의 핵심 계약이라(같은 달을 두 번 마감해도 기간 1행·인보이스
 * 1장) 호출 횟수를 세는 스파이로는 검증이 안 된다 — 실제 UNIQUE 제약을 흉내 내는
 * 저장소가 있어야 "두 번째 insert가 23505로 튕기고 코드가 기존 행으로 수렴하는가"를
 * 볼 수 있다. 그래서 select/insert/update + 유니크 위반까지 지원하는 최소 대역이다.
 *
 * (Lives outside __tests__/ so jest's testMatch doesn't treat it as a suite.)
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

type Row = Record<string, any>

/** 테이블별 유니크 제약 — 마이그레이션과 같은 조합을 흉내 낸다. */
const UNIQUES: Record<string, string[][]> = {
  ops_settlement_periods: [['tenant_id', 'period']],
  ops_intercompany_invoices: [['invoice_no'], ['period_id']],
  ops_filing_calendar: [['tenant_id', 'entity', 'filing_key', 'due_date']],
}

/** insert 시 DB DEFAULT를 대신 채우는 값. */
const DEFAULTS: Record<string, Row> = {
  ops_settlement_periods: { status: 'open', currency: 'USD', order_count: 0, stripe_fee_minor: null, note: null },
  ops_intercompany_invoices: {
    issue_date: '2026-09-01',
    currency: 'USD',
    status: 'draft',
    fx_rate: null,
    fx_rate_date: null,
    pdf_url: null,
    notes: null,
  },
  ops_remittances: { amount_krw: null, fx_rate: null, swift_doc_url: null, bank_ref: null, note: null },
}

function likeToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.')
  return new RegExp(`^${escaped}$`)
}

export interface FakeFinanceDb {
  tables: Record<string, Row[]>
  from: (table: string) => any
}

export function makeFakeFinanceDb(seed: Record<string, Row[]> = {}): FakeFinanceDb {
  const tables: Record<string, Row[]> = {
    ops_entity_ledger: [],
    ops_settlement_periods: [],
    ops_intercompany_invoices: [],
    ops_remittances: [],
    ops_filing_calendar: [],
    ops_finance_config: [],
    bookings: [],
  }
  for (const [k, v] of Object.entries(seed)) tables[k] = v.map((r) => ({ ...r }))

  let idSeq = 0

  function from(table: string) {
    const state: {
      table: string
      mode: 'select' | 'insert' | 'update'
      filters: [string, string, any][]
      values: Row | Row[] | null
      patch: Row | null
      order: [string, boolean] | null
    } = { table, mode: 'select', filters: [], values: null, patch: null, order: null }

    const rowsOf = () => (tables[state.table] ??= [])

    function matches(row: Row): boolean {
      return state.filters.every(([op, col, val]) => {
        if (op === 'eq') return row[col] === val
        if (op === 'in') return Array.isArray(val) && val.includes(row[col])
        if (op === 'like') return likeToRegex(String(val)).test(String(row[col] ?? ''))
        return true
      })
    }

    function run(): { rows: Row[]; error: any } {
      const rows = rowsOf()

      if (state.mode === 'insert') {
        const list = Array.isArray(state.values) ? state.values : [state.values as Row]
        const inserted: Row[] = []
        for (const v of list) {
          const row: Row = {
            id: `${state.table}-${++idSeq}`,
            created_at: '2026-09-01T00:00:00.000Z',
            updated_at: '2026-09-01T00:00:00.000Z',
            ...(DEFAULTS[state.table] ?? {}),
            ...v,
          }
          for (const cols of UNIQUES[state.table] ?? []) {
            if (rows.some((r) => cols.every((c) => r[c] === row[c]))) {
              return {
                rows: [],
                error: {
                  code: '23505',
                  message: `duplicate key value violates unique constraint on (${cols.join(',')})`,
                },
              }
            }
          }
          rows.push(row)
          inserted.push(row)
        }
        return { rows: inserted, error: null }
      }

      const matched = rows.filter(matches)

      if (state.mode === 'update') {
        matched.forEach((r) => Object.assign(r, state.patch))
        return { rows: matched, error: null }
      }

      let out = matched
      if (state.order) {
        const [col, asc] = state.order
        out = [...matched].sort((a, b) => {
          const av = String(a[col] ?? '')
          const bv = String(b[col] ?? '')
          return (av < bv ? -1 : av > bv ? 1 : 0) * (asc ? 1 : -1)
        })
      }
      return { rows: out, error: null }
    }

    const b: any = {}
    b.select = () => b
    b.eq = (c: string, v: any) => {
      state.filters.push(['eq', c, v])
      return b
    }
    b.in = (c: string, v: any) => {
      state.filters.push(['in', c, v])
      return b
    }
    b.like = (c: string, v: any) => {
      state.filters.push(['like', c, v])
      return b
    }
    b.order = (c: string, o?: { ascending?: boolean }) => {
      state.order = [c, o?.ascending !== false]
      return b
    }
    b.limit = () => b
    b.insert = (values: Row | Row[]) => {
      state.mode = 'insert'
      state.values = values
      return b
    }
    b.update = (patch: Row) => {
      state.mode = 'update'
      state.patch = patch
      return b
    }
    b.maybeSingle = async () => {
      const r = run()
      return r.error ? { data: null, error: r.error } : { data: r.rows[0] ?? null, error: null }
    }
    b.single = async () => {
      const r = run()
      if (r.error) return { data: null, error: r.error }
      if (!r.rows[0]) return { data: null, error: { code: 'PGRST116', message: 'no rows returned' } }
      return { data: r.rows[0], error: null }
    }
    b.then = (res: (v: any) => any, rej?: (e: any) => any) => {
      const r = run()
      return Promise.resolve(r.error ? { data: null, error: r.error } : { data: r.rows, error: null }).then(res, rej)
    }
    return b
  }

  return { tables, from }
}

/** us 원장 2행(revenue + commission) — 캡처 1건이 남기는 모양 그대로. */
export function ledgerPair(bookingId: string, period: string, grossMinor: number, rate = 0.05): Row[] {
  const commission = Math.round(grossMinor * rate)
  return [
    {
      id: `led-${bookingId}-r`,
      tenant_id: 'atockorea',
      entity: 'us',
      booking_id: bookingId,
      period,
      type: 'revenue',
      amount_minor: grossMinor,
      currency: 'USD',
      source: 'stripe_capture',
      external_ref: `pi_${bookingId}`,
    },
    {
      id: `led-${bookingId}-c`,
      tenant_id: 'atockorea',
      entity: 'us',
      booking_id: bookingId,
      period,
      type: 'commission',
      amount_minor: commission,
      currency: 'USD',
      source: 'stripe_capture',
      external_ref: `pi_${bookingId}`,
    },
  ]
}
