/**
 * §D A1.0 — 커버리지 원장의 판정부.
 *
 * 🔴 A-plan-review R6이 잡은 것: A1은 "하나도 빠짐없이 소진"이라고 적어 놓고
 * 62개 중 **34개만 호명**하고 있었다. 이름 나열은 소진을 보증하지 못한다 —
 * 나열에서 빠지면 조용히 사라진다.
 *
 * 그래서 원장이 필요하고, **원장이 낡지 않는다는 보증**이 더 필요하다.
 * 문서는 지켜지지 않아도 아무 일이 없지만 테스트는 운다.
 *
 * 이 모듈은 두 가지를 본다:
 *   ① 파일은 있는데 원장에 행이 없다 → **누락**. A1은 미완이다.
 *   ② 원장에 행은 있는데 파일이 없다 → **유령**. 지워진 컴포넌트를 감사했다고 적혀 있다.
 */

export interface LedgerRow {
  path: string;
  ticket: string;
  verdict: string;
}

/**
 * 원장 마크다운에서 행을 읽는다.
 *
 * 형식: `| \`경로\` | 티켓 | 판정 |`
 * 헤더·구분선·표 밖 텍스트는 무시한다.
 */
export function parseLedger(markdown: string): LedgerRow[] {
  const rows: LedgerRow[] = [];
  for (const line of markdown.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) continue;
    const cells = trimmed.split('|').map((c) => c.trim());
    // ['', path, ticket, verdict, '']
    if (cells.length < 5) continue;
    const raw = cells[1];
    const m = /^`([^`]+)`$/.exec(raw);
    if (!m) continue; // 헤더/구분선
    rows.push({ path: m[1], ticket: cells[2], verdict: cells[3] });
  }
  return rows;
}

export interface CoverageResult {
  /** 파일은 있는데 원장에 없다 — A1 미완. */
  missing: string[];
  /** 원장에 있는데 파일이 없다 — 유령 행. */
  ghosts: string[];
  /** 티켓이 비어 있는 행 — 담당이 정해지지 않았다. */
  unassigned: string[];
  /** 판정이 비어 있는 행 — 아직 안 본 것. */
  unjudged: string[];
}

/**
 * 🔴 `⬜`가 여기 없으면 진행률이 거짓말을 한다.
 * 첫 구현에서 실제로 그랬다 — 69행이 미감사인데 "75/75 판정 완료"라고 찍혔다.
 * 미감사 표기가 "채워진 칸"으로 세어지는 순간, 이 원장은 자기가 막으려던
 * 바로 그 착시(전수라고 적혀 있지만 아닌 것)를 스스로 만든다.
 */
const EMPTY_MARKS = new Set(['', '—', '-', 'TBD', 'tbd', '⬜']);

export function checkCoverage(files: string[], rows: LedgerRow[]): CoverageResult {
  const byPath = new Map(rows.map((r) => [r.path, r]));
  const fileSet = new Set(files);

  return {
    missing: files.filter((f) => !byPath.has(f)).sort(),
    ghosts: rows.filter((r) => !fileSet.has(r.path)).map((r) => r.path).sort(),
    unassigned: rows.filter((r) => EMPTY_MARKS.has(r.ticket)).map((r) => r.path).sort(),
    unjudged: rows.filter((r) => EMPTY_MARKS.has(r.verdict)).map((r) => r.path).sort(),
  };
}

/** 원장이 완전한가 — 누락·유령·미배정이 하나도 없어야 한다. */
export function isComplete(result: CoverageResult): boolean {
  return result.missing.length === 0 && result.ghosts.length === 0 && result.unassigned.length === 0;
}
