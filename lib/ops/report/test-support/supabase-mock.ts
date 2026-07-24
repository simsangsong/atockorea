// Test-only in-memory Supabase stub for the daily-report suites. Lives OUTSIDE
// __tests__ so jest's testMatch (**/__tests__/**) does not treat it as a suite.
// Network 0: every query resolves from a per-table registry. A registry value
// that is an Error resolves as { data:null, error } (an Error carrying
// code:'42P01' simulates a missing table → safeSelect swallows it).

type Row = Record<string, unknown>
export type TableRegistry = Record<string, Row[] | Error>

function applyPreds(rows: Row[], preds: Array<(r: Row) => boolean>): Row[] {
  return rows.filter((r) => preds.every((p) => p(r)))
}

class Builder {
  private preds: Array<(r: Row) => boolean> = []
  constructor(private source: Row[] | Error) {}

  select(): this {
    return this
  }
  order(): this {
    return this
  }
  eq(col: string, val: unknown): this {
    this.preds.push((r) => r[col] === val)
    return this
  }
  neq(col: string, val: unknown): this {
    this.preds.push((r) => r[col] !== val)
    return this
  }
  in(col: string, vals: unknown[]): this {
    this.preds.push((r) => vals.includes(r[col]))
    return this
  }
  // PostgREST `.is(col, null)` — used by A0.1 to keep simulated bookings out of
  // aggregates. `is` is not `eq`: undefined (column absent from a fixture row)
  // has to read as NULL, or every existing fixture would suddenly look
  // simulated.
  is(col: string, val: unknown): this {
    if (val === null) {
      this.preds.push((r) => r[col] === null || r[col] === undefined)
    } else {
      this.preds.push((r) => r[col] === val)
    }
    return this
  }
  gte(col: string, val: unknown): this {
    this.preds.push((r) => r[col] != null && (r[col] as never) >= (val as never))
    return this
  }
  lte(col: string, val: unknown): this {
    this.preds.push((r) => r[col] != null && (r[col] as never) <= (val as never))
    return this
  }

  private resolveList(): { data: Row[] | null; error: Error | null } {
    if (this.source instanceof Error) return { data: null, error: this.source }
    return { data: applyPreds(this.source, this.preds), error: null }
  }

  maybeSingle(): Promise<{ data: Row | null; error: Error | null }> {
    const { data, error } = this.resolveList()
    return Promise.resolve({ data: error ? null : data?.[0] ?? null, error })
  }
  single(): Promise<{ data: Row | null; error: Error | null }> {
    return this.maybeSingle()
  }

  // writes — resolve success (results not inspected by report code).
  insert(): Promise<{ data: null; error: null }> {
    return Promise.resolve({ data: null, error: null })
  }
  update(): this {
    return this
  }
  delete(): this {
    return this
  }

  then<T>(
    onFulfilled?: (v: { data: Row[] | null; error: Error | null }) => T,
    onRejected?: (e: unknown) => T,
  ): Promise<T> {
    return Promise.resolve(this.resolveList()).then(onFulfilled, onRejected)
  }
}

export function mockSupabase(registry: TableRegistry) {
  return {
    from(table: string) {
      const src = registry[table] ?? []
      return new Builder(src)
    },
  } as never
}

/** Error carrying code:'42P01' — simulates a not-yet-applied table. */
export function missingTable(): Error {
  return Object.assign(new Error('relation "x" does not exist'), { code: '42P01' })
}
