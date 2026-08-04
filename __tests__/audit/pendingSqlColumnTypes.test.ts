/**
 * 상설 게이트 — 생성된 SQL 의 캐스트가 라이브 컬럼 타입과 맞아야 한다.
 *
 * 🔴 왜 있는가: 같은 버그가 **두 번** 라이브 적용을 깨뜨렸다.
 *   `tour_product_pages.badges` 는 `text[]` 인데 `tours.badges` 는 `jsonb` 다.
 *   4개 생성기가 두 곳에 같은 `jsonb()` 헬퍼를 썼고, 페이지 쪽만 틀렸다:
 *     column "badges" is of type text[] but expression is of type jsonb
 *   2026-06-24 배치는 **적용 시점에 SQL 을 손으로 고쳐서** 넘어갔다 —
 *   생성기는 안 고쳤다. 그래서 2026-08-04 배치가 똑같이 죽었다.
 *
 * 기존 `schemaDrift` 게이트는 **테이블 이름만** 본다. 컬럼 타입은 아무도 안 봤다.
 *
 * 판정: 스냅샷(`data/db-column-types.json`)과 `supabase/pending-db-apply/**.sql`
 * 의 컬럼↔값 짝을 대조해 jsonb↔text[] 가 뒤집힌 곳을 찾는다.
 *
 * ⚠ 이 게이트가 조용해지는 법(다른 게이트에서 이미 겪었다): 파서가 아무 짝도
 * 못 찾으면 위반 0 으로 초록이 된다. 그래서 아래에 **비-공허 단정**과
 * **뮤테이션 테스트**를 같이 둔다 — 검사기가 진짜 나쁜 캐스트를 잡는지 증명한다.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SNAPSHOT = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data', 'db-column-types.json'), 'utf8'),
) as { tables: Record<string, Record<string, string>> };

const SQL_DIRS = [
  path.join(ROOT, 'supabase', 'pending-db-apply'),
  path.join(ROOT, 'supabase', 'pending-db-apply', 'applied'),
];

/**
 * 적용 시점에 손으로 고쳐서 넘어간 과거 파일. 파일은 틀린 채로 남아 있지만
 * 라이브 DB 는 올바르다 — 다시 돌릴 일이 없으므로 재생성하지 않는다.
 * 🔴 줄을 **추가하려면** 그건 새 회귀라는 뜻이다. 목록은 줄어드는 방향으로만.
 */
const KNOWN_LEGACY = new Set<string>([
  // 이 게이트를 처음 돌렸을 때 나온 유일한 레거시 — 그리고 이 게이트가 존재하는
  // 이유 그 자체다. 2026-06-24 배치는 이 파일의 badges 6줄(6로케일)을 **적용
  // 스크립트가 메모리에서 text[] 로 고쳐서** 넣었고 파일은 틀린 채로 아카이브했다.
  // 라이브 DB 는 올바르며, 같은 슬러그는 2026-08-04-02 가 올바른 캐스트로
  // 덮어썼다. 재실행할 일이 없어 다시 만들지 않는다.
  '2026-06-24-07-jeju-eastern-unesco-spots-day-tour.sql',
]);

// ---------------------------------------------------------------------------
// 인용부호를 아는 SQL 스캐너. '…'(''escape, standard_conforming_strings=on 이라
// 백슬래시는 이스케이프가 아니다) · "…" · $tag$…$tag$ · -- 및 /* */ 주석.
// ---------------------------------------------------------------------------
type Span = { text: string };

function scan(sql: string, onTopLevel: (ch: string, i: number) => void): void {
  let i = 0;
  const n = sql.length;
  while (i < n) {
    const ch = sql[i];
    if (ch === '-' && sql[i + 1] === '-') {
      const nl = sql.indexOf('\n', i);
      i = nl === -1 ? n : nl + 1;
      continue;
    }
    if (ch === '/' && sql[i + 1] === '*') {
      const close = sql.indexOf('*/', i + 2);
      i = close === -1 ? n : close + 2;
      continue;
    }
    if (ch === "'" || (/[eE]/.test(ch) && sql[i + 1] === "'")) {
      const escaped = ch !== "'";
      let j = ch === "'" ? i + 1 : i + 2;
      while (j < n) {
        if (escaped && sql[j] === '\\') {
          j += 2;
          continue;
        }
        if (sql[j] === "'") {
          if (sql[j + 1] === "'") {
            j += 2;
            continue;
          }
          j += 1;
          break;
        }
        j += 1;
      }
      i = j;
      continue;
    }
    if (ch === '"') {
      let j = i + 1;
      while (j < n) {
        if (sql[j] === '"') {
          if (sql[j + 1] === '"') {
            j += 2;
            continue;
          }
          j += 1;
          break;
        }
        j += 1;
      }
      i = j;
      continue;
    }
    if (ch === '$') {
      const m = /^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/.exec(sql.slice(i));
      if (m) {
        const close = sql.indexOf(m[0], i + m[0].length);
        i = close === -1 ? n : close + m[0].length;
        continue;
      }
    }
    onTopLevel(ch, i);
    i += 1;
  }
}

/** 최상위(괄호 밖) 세미콜론으로 문장을 나눈다. */
function splitStatements(sql: string): string[] {
  const cuts: number[] = [];
  let depth = 0;
  scan(sql, (ch, i) => {
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    else if (ch === ';' && depth === 0) cuts.push(i);
  });
  const out: string[] = [];
  let start = 0;
  for (const c of cuts) {
    out.push(sql.slice(start, c));
    start = c + 1;
  }
  if (sql.slice(start).trim()) out.push(sql.slice(start));
  return out;
}

/** 괄호 깊이 0 의 콤마로 나눈다 (INSERT 의 컬럼 목록 / VALUES 튜플용). */
function splitTopLevelCommas(inner: string): Span[] {
  const cuts: number[] = [];
  let depth = 0;
  scan(inner, (ch, i) => {
    if (ch === '(' || ch === '[') depth += 1;
    else if (ch === ')' || ch === ']') depth -= 1;
    else if (ch === ',' && depth === 0) cuts.push(i);
  });
  const out: Span[] = [];
  let start = 0;
  for (const c of cuts) {
    out.push({ text: inner.slice(start, c) });
    start = c + 1;
  }
  out.push({ text: inner.slice(start) });
  return out;
}

/** i 위치의 여는 괄호에 대응하는 닫는 괄호. 못 찾으면 -1. */
function matchParen(sql: string, open: number): number {
  let depth = 0;
  let close = -1;
  scan(sql.slice(open), (ch, i) => {
    if (close !== -1) return;
    if (ch === '(') depth += 1;
    else if (ch === ')') {
      depth -= 1;
      if (depth === 0) close = open + i;
    }
  });
  return close;
}

const strip = (s: string) =>
  s
    .replace(/--[^\n]*\n?/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .trim();

type Pair = { table: string; column: string; expr: string; file: string };

function pairsIn(sql: string, file: string): Pair[] {
  const pairs: Pair[] = [];
  for (const stmt of splitStatements(sql)) {
    const body = strip(stmt);

    const ins = /^INSERT\s+INTO\s+(?:public\.)?([a-z0-9_]+)\s*\(/i.exec(body);
    if (ins) {
      const table = ins[1];
      const colOpen = body.indexOf('(', ins[0].length - 1);
      const colClose = matchParen(body, colOpen);
      if (colClose === -1) continue;
      const cols = splitTopLevelCommas(body.slice(colOpen + 1, colClose)).map((s) =>
        strip(s.text).replace(/"/g, ''),
      );
      // VALUES (…) 만 위치 대응이 가능하다. INSERT … SELECT 는 건너뛴다.
      const rest = body.slice(colClose + 1);
      const vm = /^\s*VALUES\s*\(/i.exec(rest);
      if (!vm) continue;
      const valOpen = colClose + 1 + rest.indexOf('(', vm[0].length - 1);
      const valClose = matchParen(body, valOpen);
      if (valClose === -1) continue;
      const vals = splitTopLevelCommas(body.slice(valOpen + 1, valClose)).map((s) => strip(s.text));
      if (vals.length !== cols.length) continue; // 짝이 안 맞으면 판정하지 않는다
      cols.forEach((c, k) => pairs.push({ table, column: c, expr: vals[k], file }));
      continue;
    }

    const upd = /^UPDATE\s+(?:public\.)?([a-z0-9_]+)\s+SET\s/i.exec(body);
    if (upd) {
      const table = upd[1];
      const after = body.slice(upd[0].length);
      const whereAt = /\sWHERE\s/i.exec(after);
      const setBlock = whereAt ? after.slice(0, whereAt.index) : after;
      for (const seg of splitTopLevelCommas(setBlock)) {
        const m = /^\s*"?([a-z0-9_]+)"?\s*=\s*([\s\S]+)$/i.exec(seg.text);
        if (m) pairs.push({ table, column: m[1], expr: strip(m[2]), file });
      }
    }
  }
  return pairs;
}

/** 값 표현식이 어떤 모양인지. 판정 불가는 null (EXCLUDED.x, 서브쿼리, NOW() 등). */
function shapeOf(expr: string): 'jsonb' | 'text[]' | null {
  if (/::\s*jsonb\s*$/i.test(expr)) return 'jsonb';
  if (/::\s*text\s*\[\s*\]\s*$/i.test(expr)) return 'text[]';
  if (/^ARRAY\s*\[/i.test(expr)) return 'text[]';
  return null;
}

const EXPECT: Record<string, 'jsonb' | 'text[]'> = { jsonb: 'jsonb', _text: 'text[]' };

function violationsIn(sql: string, file: string) {
  const bad: string[] = [];
  for (const p of pairsIn(sql, file)) {
    const udt = SNAPSHOT.tables[p.table]?.[p.column];
    if (!udt) continue;
    const want = EXPECT[udt];
    if (!want) continue; // 배열/JSON 이 아닌 컬럼은 이 게이트의 관심사가 아니다
    const got = shapeOf(p.expr);
    if (got && got !== want) {
      bad.push(
        `${p.file}: ${p.table}.${p.column} is ${udt} (${want}) but the value is ${got} — ` +
          `${p.expr.slice(0, 60).replace(/\s+/g, ' ')}…`,
      );
    }
  }
  return bad;
}

function sqlFiles(): string[] {
  const out: string[] = [];
  for (const dir of SQL_DIRS) {
    if (!fs.existsSync(dir)) continue;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isFile() && e.name.endsWith('.sql')) out.push(path.join(dir, e.name));
    }
  }
  return out;
}

describe('🔴 생성 SQL 의 캐스트는 라이브 컬럼 타입과 맞아야 한다', () => {
  const files = sqlFiles();
  const allPairs = files.flatMap((f) =>
    pairsIn(fs.readFileSync(f, 'utf8'), path.basename(f)),
  );

  it('스냅샷과 SQL 을 실제로 읽었다 (비-공허)', () => {
    expect(files.length).toBeGreaterThan(5);
    expect(Object.keys(SNAPSHOT.tables).length).toBeGreaterThanOrEqual(3);
    // 파서가 죽으면 짝이 0 이 되고 게이트는 조용히 초록이 된다.
    expect(allPairs.length).toBeGreaterThan(200);
  });

  it('문제의 그 컬럼을 실제로 훑었다 — tour_product_pages.badges', () => {
    const seen = allPairs.filter(
      (p) => p.table === 'tour_product_pages' && p.column === 'badges',
    );
    expect(seen.length).toBeGreaterThan(10);
    // 이 컬럼은 text[] 다. jsonb 로 들어간 값이 하나도 없어야 한다(레거시 제외).
    expect(
      seen
        .filter((p) => !KNOWN_LEGACY.has(p.file))
        .filter((p) => shapeOf(p.expr) === 'jsonb')
        .map((p) => p.file),
    ).toEqual([]);
    // 레거시 파일도 실제로 스캔 범위 안에 있어야 한다 — 아니면 KNOWN_LEGACY 는
    // 아무것도 면제하지 않으면서 있는 척하는 장식이 된다.
    expect(seen.some((p) => KNOWN_LEGACY.has(p.file))).toBe(true);
  });

  it('jsonb ↔ text[] 가 뒤집힌 곳이 없다', () => {
    const bad = files
      .filter((f) => !KNOWN_LEGACY.has(path.basename(f)))
      .flatMap((f) => violationsIn(fs.readFileSync(f, 'utf8'), path.basename(f)));
    expect(bad).toEqual([]);
  });

  it('KNOWN_LEGACY 는 실제로 아직 틀린 파일만 담는다 — 고쳐졌으면 지워라', () => {
    const stale = [...KNOWN_LEGACY].filter((name) => {
      const f = files.find((x) => path.basename(x) === name);
      return !f || violationsIn(fs.readFileSync(f, 'utf8'), name).length === 0;
    });
    expect(stale).toEqual([]);
  });

  it('뮤테이션 — 검사기가 나쁜 캐스트를 실제로 잡는다', () => {
    const good = `INSERT INTO public.tour_product_pages (
  slug, locale, badges, detail_payload
) VALUES (
  'x', 'en', ARRAY['a', 'b']::text[], '{"k":1}'::jsonb
);`;
    expect(violationsIn(good, 'synthetic-good.sql')).toEqual([]);

    // ① text[] 컬럼에 jsonb — 두 번 라이브를 깨뜨린 바로 그 모양
    const badPages = good.replace(`ARRAY['a', 'b']::text[]`, `'["a","b"]'::jsonb`);
    expect(violationsIn(badPages, 'synthetic-bad.sql')).toHaveLength(1);
    expect(violationsIn(badPages, 'synthetic-bad.sql')[0]).toContain('tour_product_pages.badges');

    // ② 반대 방향 — jsonb 컬럼에 text[]
    const badTours = `UPDATE public.tours SET badges = ARRAY['a']::text[] WHERE slug = 'x';`;
    expect(violationsIn(badTours, 'synthetic-bad2.sql')).toHaveLength(1);
    expect(violationsIn(badTours, 'synthetic-bad2.sql')[0]).toContain('tours.badges');
  });
});
