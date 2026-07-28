/**
 * N5 — standing gate: a chip row's buttons must carry a visible boundary.
 *
 * N1 measured the guest chip rows at 1.04–1.36 against WCAG 1.4.11's 3.0 and
 * fixed them with `.tr-chip-tap`. Its ticket also promised "비텍스트 대비를
 * 상설 게이트에" — and that half never shipped. So on 2026-07-28 the cockpit's
 * quick-reply row measured 1.16 (light) / 1.45 (dark), the guide announce
 * presets drew their edge from `--tr-hairline` (10% ink), and the seat strip had
 * no border at all. Three surfaces with the same defect the gate was supposed to
 * prevent, found only because someone happened to point a walk at them.
 *
 * `skinContrast` cannot catch this: it reads token PAIRS out of the CSS and has
 * no idea which classes a component actually puts on a button. So this gate
 * works from the source instead — the same reasoning as O5's Esc guard, which
 * caught an overlay the walk never opened.
 *
 * What it deliberately does NOT do: measure a ratio. The ratio lives in
 * `.tr-chip-tap` (border: 1px solid currentColor) and is verified in the browser
 * by qa-cockpit-walk's material probe. This gate only enforces that new chip rows
 * opt into that primitive rather than inventing a fainter edge.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';

const ROOTS = ['components/tour-mode', 'components/tour-ops'];

/**
 * Rows whose children are not text chips. Each needs a reason, because an
 * allowlist without one becomes a place to hide a regression.
 */
const ALLOWED: Record<string, string> = {
  'components/tour-mode/RoomDrawer.tsx':
    'drawer-images — photo thumbnails. An image carries its own edge; a 1px ink ' +
    'border around a picture is chrome, not affordance.',
};

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.tsx$/.test(entry)) out.push(full);
  }
  return out;
}

/**
 * Slice out one JSX element by counting its opening/closing tags from `start`.
 * A window of N characters was rejected on purpose: G1 records that fixed-window
 * guessing is how a scanner starts reporting on the wrong block.
 */
function elementSlice(source: string, start: number, tag = 'div'): string {
  const open = new RegExp(`<${tag}(\\s|>)`, 'g');
  const close = new RegExp(`</${tag}>`, 'g');
  let depth = 0;
  let i = start;
  while (i < source.length) {
    open.lastIndex = i;
    close.lastIndex = i;
    const o = open.exec(source);
    const c = close.exec(source);
    if (!o && !c) break;
    const nextOpen = o ? o.index : Infinity;
    const nextClose = c ? c.index : Infinity;
    if (nextOpen < nextClose) {
      depth += 1;
      i = nextOpen + 1;
    } else {
      depth -= 1;
      i = nextClose + 1;
      if (depth <= 0) return source.slice(start, nextClose);
    }
  }
  return source.slice(start);
}

describe('chip rows declare a visible boundary (N1/N5, WCAG 1.4.11)', () => {
  const files = ROOTS.flatMap((root) => walk(path.join(process.cwd(), root)));

  it('finds chip rows at all — a gate that matches nothing is not a gate', () => {
    const rows = files.filter((f) => readFileSync(f, 'utf8').includes('tr-chiprow'));
    // Guards against the failure mode G-b describes: a scanner whose pattern has
    // rotted reports zero problems and looks exactly like a clean codebase.
    expect(rows.length).toBeGreaterThanOrEqual(5);
  });

  it('every tappable chip row uses .tr-chip-tap', () => {
    const failures: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      if (!source.includes('tr-chiprow')) continue;
      const rel = path.relative(process.cwd(), file).replace(/\\/g, '/');

      const re = /<div[^>]*tr-chiprow/g;
      let m: RegExpExecArray | null;
      let index = 0;
      while ((m = re.exec(source))) {
        index += 1;
        const slice = elementSlice(source, m.index);
        if (!/<button/.test(slice)) continue; // a display-only row needs no affordance
        if (/tr-chip-tap/.test(slice)) continue;
        if (ALLOWED[rel]) continue;
        failures.push(
          `${rel} — chip row #${index} has <button> children but no .tr-chip-tap ` +
            '(add tr-chip-tap[--quiet|--urgent], or allowlist it with a reason)',
        );
      }
    }
    expect(failures).toEqual([]);
  });

  it('allowlist entries still exist and still contain a chip row', () => {
    for (const [rel, reason] of Object.entries(ALLOWED)) {
      const full = path.join(process.cwd(), rel);
      const source = readFileSync(full, 'utf8');
      // A stale allowlist silently exempts whatever moves into that path next.
      expect(source).toContain('tr-chiprow');
      expect(reason.length).toBeGreaterThan(20);
    }
  });
});
