/**
 * 상설 게이트 — `.map()` 안의 **모든 분기**가 key 를 달아야 한다.
 *
 * 🔴 왜 있는가: `ChatFeed` 의 `items.map()` 은 분기가 셋이다 — 날짜 구분자,
 * unsend 툼스톤, 일반 메시지. 셋 중 **툼스톤만 `key` 가 없었다**(PR #715).
 * 손님 채팅에 툼스톤이 하나라도 있으면 매 방문마다 콘솔에 찍혔다:
 *   `Each child in a list should have a unique "key" prop. … from ChatFeed`
 *
 * 경고 이상의 위험이다. key 가 없으면 React 는 그 행을 **정체성이 아니라 위치로**
 * 재조정한다. 채팅 피드는 계속 위아래로 밀리므로, 툼스톤 위로 메시지가 하나 들어오면
 * 그 DOM 이 엉뚱한 행으로 넘어갈 수 있다.
 *
 * 🔴 **먼저 만든 스캐너가 이걸 못 잡았다.** 그 스캐너는
 * `.map((x) => (` 처럼 **화살표가 곧바로 JSX 를 반환하는 모양**만 봤다. 문제의 코드는
 * `.map((item) => {` 블록 본문 안에서 `if (…) return ( <div …> )` 로 일찍 반환한다.
 * 첫 분기에 key 가 있으면 파일 전체가 통과했다 — **"한 군데 확인했으니 됐다"** 가
 * 이 레포에서 또 나온 실패다.
 *
 * 그리고 진단을 더 어렵게 만든 것도 같은 줄이었다: 그 툼스톤 div 는 `data-msg-id` 도
 * 없어서, DOM 의 중복 id 를 세는 검사가 **그 행을 아예 보지 못했다**(30/30 유일로 초록).
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DIRS = ['components', 'app'].map((d) => path.join(ROOT, d));

function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (/(^|[\\/])(node_modules|\.next)$/.test(full)) continue;
        walk(full);
      } else if (/\.tsx$/.test(e.name) && !/\.test\.tsx$/.test(e.name)) out.push(full);
    }
  };
  DIRS.forEach(walk);
  return out;
}

type Finding = { file: string; line: number; text: string };

/**
 * Inside a `.map(… => {` block, every `return (` that opens a JSX element must
 * carry a `key`. The block is bounded by brace depth from the `.map(` line.
 */
export function keylessBranches(src: string): { line: number; text: string }[] {
  const lines = src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length))
    .split('\n');
  const out: { line: number; text: string }[] = [];

  const MAP_OPEN = /\.map\(\s*(?:\([^)]*\)|\w+)\s*(?::\s*[^=]+)?=>\s*\{\s*$/;
  /** A nested function body opening on this line (arrow or `function`). */
  const NESTED_FN = /(=>\s*\{|function\s*\w*\s*\([^)]*\)\s*\{)/;

  for (let i = 0; i < lines.length; i++) {
    if (!MAP_OPEN.test(lines[i])) continue;
    let depth = 0;
    let started = false;
    /**
     * 🔴 Brace depth alone is not enough. `ChatFeed`'s map callback holds a
     * `const body = (() => { … })()` whose branches return rows that are later
     * placed inside the ONE keyed wrapper — those returns need no key of their
     * own, and counting them flagged twelve false positives on the first run.
     * So track where nested function bodies open and ignore returns inside them.
     */
    const fnStack: number[] = [];
    for (let j = i; j < lines.length; j++) {
      const isMapLine = j === i;
      if (!isMapLine && NESTED_FN.test(lines[j])) fnStack.push(depth);

      if (!isMapLine && fnStack.length === 0 && /^\s*return\s*\(\s*$/.test(lines[j])) {
        let tag = '';
        for (let k = j + 1; k < Math.min(j + 14, lines.length); k++) {
          tag += lines[k];
          if (/>/.test(lines[k])) break;
        }
        // Only JSX elements matter; a returned expression or fragment does not.
        if (/^\s*<[A-Za-z]/.test(lines[j + 1] ?? '') && !/\bkey=/.test(tag)) {
          out.push({ line: j + 2, text: (lines[j + 1] ?? '').trim().slice(0, 90) });
        }
      }

      for (const ch of lines[j]) {
        if (ch === '{') { depth += 1; started = true; }
        else if (ch === '}') {
          depth -= 1;
          while (fnStack.length && depth <= fnStack[fnStack.length - 1]) fnStack.pop();
        }
      }
      if (started && depth === 0) break;
    }
  }
  return out;
}

/**
 * Branches that are known-safe: the returned element is not a list child (the
 * `.map` result is joined, reduced, or fed to something that is not React).
 * 🔴 Additions here are claims. Each one must say why.
 */
const ALLOWED = new Set<string>([
  // (empty — every branch in the tree carries a key as of 2026-08-05)
]);

describe('🔴 `.map()` 의 모든 분기가 key 를 달아야 한다', () => {
  const files = sourceFiles();
  const findings: Finding[] = files.flatMap((f) =>
    keylessBranches(fs.readFileSync(f, 'utf8')).map((h) => ({
      file: path.relative(ROOT, f).split(path.sep).join('/'),
      ...h,
    })),
  );

  it('소스를 실제로 읽었다 (비-공허)', () => {
    expect(files.length).toBeGreaterThan(100);
    // 블록 본문 `.map` 자체가 이 레포에 실제로 있다. 0 이면 정규식이 죽은 것이다.
    const blockMaps = files.filter((f) =>
      /\.map\(\s*(?:\([^)]*\)|\w+)\s*(?::\s*[^=]+)?=>\s*\{\s*$/m.test(fs.readFileSync(f, 'utf8')),
    );
    expect(blockMaps.length).toBeGreaterThan(5);
  });

  it('key 없는 분기가 없다', () => {
    expect(findings.filter((f) => !ALLOWED.has(`${f.file}:${f.line}`)).map((f) => `${f.file}:${f.line}  ${f.text}`)).toEqual([]);
  });

  it('뮤테이션 — 검사기가 이 버그의 실제 모양을 잡는다', () => {
    // ChatFeed 가 실제로 가지고 있던 모양: 첫 분기는 key 가 있고, 두 번째만 없다.
    const buggy = `
        {items.map((item) => {
          if (item.type === 'date') {
            return (
              <div key={item.key} className="sep">
                {item.label}
              </div>
            );
          }
          if (item.deleted) {
            return (
              <div className="flex min-w-0">
                <span>deleted</span>
              </div>
            );
          }
          return (
            <div key={item.key} data-msg-id={item.id}>
              {item.body}
            </div>
          );
        })}`;
    const hits = keylessBranches(buggy);
    expect(hits).toHaveLength(1);
    expect(hits[0].text).toContain('flex min-w-0');

    // key 를 채우면 조용해져야 한다.
    expect(keylessBranches(buggy.replace('<div className="flex min-w-0">', '<div key={item.key} className="flex min-w-0">'))).toEqual([]);
  });
});
