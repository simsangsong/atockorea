/**
 * 🔴 FA-008 (full-app audit 2026-07-30) — the gate that did not run the gates.
 *
 * The smart-guiding track documented its gate as four directory-scoped jest
 * invocations:
 *
 *   npx jest __tests__/components/tour-mode __tests__/lib/tour-room \
 *            __tests__/audit __tests__/scripts
 *
 * `__tests__/hooks` and `__tests__/api` are not in that list, and that is where
 * the track's own new tests lived. So `driverOverviewTourId.test.ts` — a
 * STANDING guard, already red in the repo, already pointing at a real defect —
 * was green-by-omission through eight waves of work. The gate was alive. Nobody
 * was running it.
 *
 * A directory list is a thing you can forget to update. This suite replaces it
 * with two invariants that cannot drift:
 *
 *   1. `npm run gate` exists and runs the WHOLE suite plus tsc, so the default
 *      way to check work cannot skip a directory.
 *   2. Every `__tests__/*` top-level directory is reachable by that command —
 *      i.e. no directory is excluded by testPathIgnorePatterns. If someone adds
 *      `__tests__/newthing/`, it is covered the moment it exists.
 *
 * It also pins FA-002's fix, because the two failures are the same story: a
 * gate that silently measures less than it appears to.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

function pkg(): { scripts?: Record<string, string> } {
  return JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
}

/**
 * The ignore patterns as jest will actually receive them.
 *
 * ⚠ The obvious `\[([\s\S]*?)\]` stops at the first `]` — and these patterns
 * CONTAIN `]` (`[/\\]e2e[/\\]`), so that version silently returned an empty
 * list and every assertion below became vacuous. Depth-count the brackets. The
 * `length > 0` assertion in the first FA-002 case is the backstop: an extractor
 * that reads nothing must fail loudly rather than pass everything.
 */
function ignorePatterns(): string[] {
  const src = readFileSync(path.join(ROOT, 'jest.config.js'), 'utf8');
  const at = src.indexOf('testPathIgnorePatterns:');
  if (at < 0) throw new Error('jest.config.js no longer declares testPathIgnorePatterns');
  const open = src.indexOf('[', at);
  let depth = 0;
  let close = -1;
  for (let i = open; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '\\') {
      i += 1; // skip whatever is escaped, brackets included
      continue;
    }
    if (ch === '[') depth += 1;
    else if (ch === ']') {
      depth -= 1;
      if (depth === 0) {
        close = i;
        break;
      }
    }
  }
  if (close < 0) throw new Error('could not find the end of testPathIgnorePatterns');
  const body = src.slice(open + 1, close);
  // Each entry is a single-quoted JS string literal; eval it so escapes survive
  // exactly as jest sees them.
  return [...body.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((m) => JSON.parse(`"${m[1].replace(/"/g, '\\"')}"`));
}

describe('FA-008 — the gate command covers everything', () => {
  it('🔴 `npm run gate` exists and runs tsc plus the whole jest suite', () => {
    const scripts = pkg().scripts ?? {};
    expect(scripts.gate).toBeDefined();
    const gate = scripts.gate!;
    expect(gate).toContain('tsc --noEmit');
    // A directory argument here would reintroduce exactly the FA-008 hole.
    expect(gate).toMatch(/(^|&&\s*)(npx )?jest\s*$/);
    expect(gate).not.toContain('__tests__/');
  });

  it('🔴 no __tests__ top-level directory is excluded from the run', () => {
    const patterns = ignorePatterns().map((p) => new RegExp(p));
    const dirs = readdirSync(path.join(ROOT, '__tests__')).filter((name) =>
      statSync(path.join(ROOT, '__tests__', name)).isDirectory(),
    );
    expect(dirs.length).toBeGreaterThan(4); // sanity: we are really looking at them

    const excluded = dirs.filter((name) => {
      // What a suite path inside that directory looks like, both separators.
      const candidates = [
        `${ROOT}/__tests__/${name}/some.test.ts`,
        `${ROOT}\\__tests__\\${name}\\some.test.ts`,
      ];
      return candidates.some((c) => patterns.some((re) => re.test(c)));
    });
    expect(excluded).toEqual([]);
  });
});

describe('FA-002 — the ignore patterns work wherever the repo lives', () => {
  /**
   * `'<rootDir>/e2e/'` looks like a path but is a REGEX. On Windows rootDir
   * expands with backslashes, so a checkout under `…/.claude/worktrees/…` made
   * `\.claude` mean "any char + claude" and the pattern stopped matching. Four
   * suites that must not run under jest then ran, and their noise hid a real
   * red test. The patterns must not mention rootDir at all.
   */
  it('🔴 patterns are separator-neutral and rootDir-free', () => {
    const patterns = ignorePatterns();
    expect(patterns.length).toBeGreaterThan(0);
    for (const p of patterns) {
      expect(p).not.toContain('<rootDir>');
    }
  });

  it.each([
    // The three things that must stay out, at paths that broke the old patterns.
    ['C:\\Users\\x\\atockorea\\.claude\\worktrees\\wt\\e2e\\tour-room-chat.spec.ts'],
    ['C:\\Users\\x\\atockorea\\.claude\\worktrees\\wt\\lib\\ops\\parse\\__tests__\\fixtures\\active-rules.ts'],
    ['C:\\Users\\x\\atockorea\\.claude\\worktrees\\wt\\node_modules\\pkg\\thing.test.js'],
    ['/home/x/atockorea/e2e/tour-ops-sos.spec.ts'],
    ['/home/x/a.b.c/lib/ops/parse/__tests__/fixtures/cruise-smallgroup-corpus.ts'],
  ])('excludes %s', (candidate) => {
    const patterns = ignorePatterns().map((p) => new RegExp(p));
    expect(patterns.some((re) => re.test(candidate))).toBe(true);
  });

  it('does NOT exclude a real suite that merely lives under a dotted path', () => {
    const patterns = ignorePatterns().map((p) => new RegExp(p));
    const real = 'C:\\Users\\x\\atockorea\\.claude\\worktrees\\wt\\__tests__\\api\\driverOverviewTourId.test.ts';
    expect(patterns.some((re) => re.test(real))).toBe(false);
  });
});
