/**
 * SG-0a — the numeral rung is enforced, not advisory.
 *
 * SG-D1: `.tr-numeral` is the ONE rung above tr-display, and it must stay
 * one — hierarchy between numbers is carried by tone, never by a second
 * size. typeDiscipline already blocks raw Tailwind text utilities, but a
 * `tr-numeral--sm` variant would sail through it, so this suite pins the
 * class itself: exactly one declaration, scaled by --tr-font-scale like
 * every other step, weight via :where() so call-site font-* wins.
 */
import fs from 'fs';
import path from 'path';

const css = fs.readFileSync(
  path.join(process.cwd(), 'app', 'tour-room-theme.css'),
  'utf8',
);

describe('tr-numeral scale discipline (SG-D1)', () => {
  it('declares .tr-numeral once, on the shared font-scale variable', () => {
    const declarations = css.match(/^\.tr-numeral\s*\{/gm) ?? [];
    expect(declarations).toHaveLength(1);
    const block = css.slice(css.indexOf('.tr-numeral'));
    expect(block).toContain('calc(34px * var(--tr-font-scale, 1))');
    expect(block).toContain('font-variant-numeric: tabular-nums');
  });

  it('has NO size variants — one rung, forever', () => {
    expect(css).not.toMatch(/tr-numeral--/);
  });

  it('sets weight at zero specificity so call-site font-* utilities win', () => {
    expect(css).toMatch(/:where\(\.tr-numeral\)\s*\{\s*font-weight:\s*700;\s*\}/);
  });
});
