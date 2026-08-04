/**
 * @jest-environment node
 *
 * X10 — the 44px floor, and the one pattern that keeps it from making blobs.
 *
 * `app/globals.css` sets `button, a { min-height: 44px; min-width: 44px }` for
 * both route groups. §E lists 44px touch as invariant, so the rule stays. What
 * X10 asked was what it does to a control whose label is smaller than that: the
 * owner photographed the cockpit's nav-app chips rendering as pale 44×44 blocks
 * with an 11px label stuck in a corner.
 *
 * 🔴 Measured before writing this, with `scripts/qa-touch-target.mjs`:
 * **236 controls across five surfaces, zero blobs.** The feared app-wide spread
 * is not there. Every 44px control the sweep found centres its label, and the
 * `display: inline` anchors are untouched by the floor in the first place
 * (CSS 2.1 §10.4 — min-width/min-height do not apply to non-replaced inline
 * boxes), which is why the footer links render with box exactly equal to text.
 *
 * So there is nothing to sweep, and this suite guards the two things that would
 * bring it back: deleting the floor (the wrong fix — it is the accessibility
 * invariant, not the bug), and undoing the separation that fixed the one real
 * instance. `NavBrandButton` is that pattern: the anchor is a transparent 44px
 * centring box, the coloured pill is an inner span sized to its own text.
 * Shrink the visual, keep the hit area.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8');

describe('X10 — the touch floor stays', () => {
  const css = read('app/globals.css');

  it('🔴 44px is still the floor for every control', () => {
    // If a future round "fixes" blobs by deleting this, it has traded a
    // cosmetic complaint for an accessibility regression on every button in
    // both route groups. §E calls the 44px touch target invariant.
    expect(css).toMatch(/button,\s*a\s*\{[^}]*min-height:\s*44px/);
    expect(css).toMatch(/button,\s*a\s*\{[^}]*min-width:\s*44px/);
  });

  it('reaches the app, not just marketing — both roots load it', () => {
    // X13 split the route groups into separate root layouts. A floor that only
    // one of them imports is a floor with a hole in it.
    expect(read('app/(app)/layout.tsx')).toMatch(/globals\.css/);
    expect(read('app/(marketing)/layout.tsx')).toMatch(/globals\.css/);
  });
});

describe('X10 — visual and hit area stay separate where it mattered', () => {
  const source = read('components/tour-mode/NavBrandButton.tsx');

  it('🔴 the anchor is a centring box, not a padded label', () => {
    // `flex items-center justify-center` on the anchor is what turns the
    // inherited 44px from "empty space with the text in the corner" into
    // "empty space around a centred pill". Removing either half restores the
    // photographed defect exactly.
    expect(source).toMatch(/className="[^"]*\bflex\b[^"]*items-center[^"]*justify-center/);
  });

  it('🔴 the coloured pill is an inner element sized to its own text', () => {
    // If the brand colour moves onto the anchor, the 44px box becomes the
    // visual and the chip is a blob again — the same defect wearing the fix's
    // clothes.
    const anchorStart = source.indexOf('<a');
    const spanStart = source.indexOf('<span', anchorStart);
    expect(spanStart).toBeGreaterThan(anchorStart);
    expect(source.slice(spanStart, spanStart + 400)).toMatch(/backgroundColor: bg/);
    // …and NOT on the anchor itself.
    expect(source.slice(anchorStart, spanStart)).not.toMatch(/backgroundColor/);
  });

  it('the pattern is actually rendered somewhere', () => {
    // A pattern nobody uses is documentation, not protection.
    const walk = (dir: string, out: string[] = []): string[] => {
      for (const entry of readdirSync(path.join(ROOT, dir))) {
        if (entry.startsWith('.') || entry === '__tests__' || entry === 'node_modules') continue;
        const rel = path.join(dir, entry);
        if (statSync(path.join(ROOT, rel)).isDirectory()) walk(rel, out);
        else if (/\.tsx$/.test(entry)) out.push(rel);
      }
      return out;
    };
    const users = walk('components')
      .concat(walk('app'))
      .filter((f) => !f.endsWith('NavBrandButton.tsx'))
      .filter((f) => read(f).includes('NavBrandButton'));
    expect(users.length).toBeGreaterThan(1);
  });
});

describe('X10 — the sweep that answered it is re-runnable', () => {
  it('🔴 the harness proves its own detector before reporting zero', () => {
    // The reason this suite can assert "nothing to sweep" is a measurement, and
    // that measurement is only worth its zero if the ruler can produce a one.
    // The harness renders a synthetic blob first and refuses to continue if it
    // does not catch it. Losing that canary turns a green run into an unread
    // one, which is how three checkers in this repo went quiet.
    const harness = read('scripts/qa-touch-target.mjs');
    expect(harness).toMatch(/async function canary\(/);
    expect(harness).toMatch(/if \(!\(await canary\(\)\)\) \{/);
    // And it refuses to speak at all when it measured too little.
    expect(harness).toMatch(/controls < MIN_CONTROLS/);
  });
});
