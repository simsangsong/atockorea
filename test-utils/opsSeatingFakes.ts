/**
 * ops seating 라우트 테스트용 fake Supabase 빌더 — 네트워크 0.
 *
 * 기존 스위트들의 per-file 체인 fake와 같은 원리를 재사용 가능한 형태로 뽑은
 * 것: from(table) 체인은 어떤 필터 메서드도 수용하고, 종결(single/maybeSingle/
 * await)에서 테스트가 준 handler(q)로 결과를 결정한다. handler는 테이블·op·
 * 필터를 보고 {data, error}를 돌려준다. 모든 쿼리는 log에 순서대로 쌓인다.
 */

export interface FakeQueryFilter {
  method: string;
  args: unknown[];
}

export interface FakeQuery {
  table: string;
  op: 'select' | 'insert' | 'update' | 'upsert' | 'delete';
  payload?: unknown;
  filters: FakeQueryFilter[];
  terminal: 'list' | 'single' | 'maybeSingle';
}

export interface FakeResult {
  data?: unknown;
  error?: unknown;
}

export type FakeDbHandler = (q: FakeQuery) => FakeResult;

export function makeFakeDb(handler: FakeDbHandler, log: FakeQuery[] = []) {
  const db = {
    log,
    from(table: string) {
      const q: FakeQuery = { table, op: 'select', filters: [], terminal: 'list' };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chain: any = {};
      for (const m of ['select', 'eq', 'neq', 'in', 'is', 'order', 'limit', 'gt', 'lt', 'gte', 'lte', 'not']) {
        chain[m] = (...args: unknown[]) => {
          q.filters.push({ method: m, args });
          return chain;
        };
      }
      for (const m of ['insert', 'update', 'upsert', 'delete'] as const) {
        chain[m] = (payload?: unknown, ...args: unknown[]) => {
          q.op = m;
          q.payload = payload;
          if (args.length) q.filters.push({ method: `${m}_options`, args });
          return chain;
        };
      }
      chain.single = async () => {
        q.terminal = 'single';
        log.push(q);
        return handler(q);
      };
      chain.maybeSingle = async () => {
        q.terminal = 'maybeSingle';
        log.push(q);
        return handler(q);
      };
      chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
        q.terminal = 'list';
        log.push(q);
        return Promise.resolve(handler(q)).then(resolve, reject);
      };
      return chain;
    },
  };
  return db;
}

/** q.filters에서 특정 메서드의 n번째 호출 args. */
export function filterArgs(q: FakeQuery, method: string, index = 0): unknown[] | undefined {
  return q.filters.filter((f) => f.method === method)[index]?.args;
}

/** log에서 조건에 맞는 쿼리들. */
export function queriesFor(log: FakeQuery[], table: string, op?: FakeQuery['op']): FakeQuery[] {
  return log.filter((q) => q.table === table && (!op || q.op === op));
}

/**
 * 라우트 핸들러용 fake NextRequest (headers + nextUrl + json body).
 *
 * multipart 라우트(노쇼 증거 업로드 등)는 `formData`를 넘기면 된다 —
 * content-type 헤더는 테스트가 직접 지정한다(실제 브라우저처럼).
 */
export function fakeNextRequest(input: {
  headers?: Record<string, string>;
  searchParams?: Record<string, string>;
  body?: unknown;
  formData?: FormData;
  origin?: string;
}) {
  const headers = new Headers(input.headers ?? {});
  const searchParams = new URLSearchParams(input.searchParams ?? {});
  return {
    headers,
    nextUrl: { searchParams, origin: input.origin ?? 'http://localhost:3000' },
    json: async () => input.body ?? {},
    formData: async () => input.formData ?? new FormData(),
  } as unknown as import('next/server').NextRequest;
}
