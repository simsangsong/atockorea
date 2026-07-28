/**
 * Standing guard: route segment config must be statically analysable.
 *
 * On 2026-07-28 a route shipped `export const maxDuration = SSE_MAX_DURATION_S`.
 * Next.js reads these exports before the module graph exists, so an imported
 * identifier is not a value it can resolve, and every deploy failed with
 * "Unknown identifier … at maxDuration" → "Invalid segment configuration export
 * detected".
 *
 * Nothing in the repo objected. tsc is happy — the types are fine. jest is happy
 * — the module imports fine. And `next build` prints "Compiled successfully"
 * before failing later in page-data collection, so a build check that greps for
 * the success line reports green on a build that returned 1. Three green signals
 * and a broken deploy.
 *
 * This is the cheap thing that would have caught it in a second.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';

/** The exports Next.js parses statically. Their values must be literals. */
const CONFIG_KEYS = [
  'maxDuration',
  'revalidate',
  'dynamic',
  'dynamicParams',
  'fetchCache',
  'runtime',
  'preferredRegion',
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/^(route|page|layout)\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/**
 * Comment lines are dropped before matching. The route that caused this quotes
 * the broken form in its own doc comment, and a check that cannot tell code from
 * prose fails on its own explanation — which the first version of this guard did.
 */
function codeOf(source: string): string {
  return source
    .split('\n')
    .filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line))
    .join('\n');
}

function isLiteralValue(value: string): boolean {
  const v = value.trim();
  if (/^-?\d+(\.\d+)?$/.test(v)) return true;
  if (v === 'true' || v === 'false') return true;
  if (/^'[^']*'$/.test(v) || /^"[^"]*"$/.test(v)) return true;
  if (/^\[[^\]]*\]$/.test(v)) return true; // preferredRegion = ['icn1']
  return false;
}

describe('route segment config is statically analysable', () => {
  const files = walk(path.join(process.cwd(), 'app'));

  it('found route/page/layout files — an empty sweep proves nothing', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('🔴 every segment config export is a literal, not an identifier', () => {
    const failures: string[] = [];
    for (const file of files) {
      const code = codeOf(readFileSync(file, 'utf8'));
      const rel = path.relative(process.cwd(), file).split(path.sep).join('/');
      for (const key of CONFIG_KEYS) {
        const re = new RegExp('export\\s+const\\s+' + key + '\\s*=\\s*([^;\\n]+)', 'g');
        let m: RegExpExecArray | null;
        while ((m = re.exec(code))) {
          if (isLiteralValue(m[1])) continue;
          failures.push(
            rel +
              ': export const ' +
              key +
              ' = ' +
              m[1].trim() +
              ' — Next.js cannot resolve this at build time. Write the literal here, ' +
              'and keep the shared constant for tests with an assertion that they agree.',
          );
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('🔴 recognises the shape that broke the deploy', () => {
    // A guard nobody has seen fail is a guard nobody knows works.
    expect(isLiteralValue('SSE_MAX_DURATION_S')).toBe(false);
    expect(isLiteralValue('60')).toBe(true);
    expect(isLiteralValue("'force-dynamic'")).toBe(true);
    expect(isLiteralValue('3600')).toBe(true);
    expect(isLiteralValue('SOME_CONST * 2')).toBe(false);
  });
});
