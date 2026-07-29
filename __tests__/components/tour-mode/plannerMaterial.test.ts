/**
 * P7.2 (§I) — the three standing gates for the planner's material system.
 *
 * All three exist because the same failure happened three different ways: the
 * CSS said the right thing and something else disagreed with it.
 *
 *   plannerButtonHierarchy — the stylesheet rationed a loud tier to "real
 *     commits", and the call site put `--sm` on the biggest commit there is.
 *     The comment was right; the class list was not.
 *   plannerRadiusScale — nobody chose 20/16/14/13/11. Each value was locally
 *     reasonable and the set was not a set.
 *   plannerElevation — dark mode set the shadows to `none`, which is a
 *     defensible thing to write and an indefensible thing to ship, because the
 *     room had already solved dark separation with the rim.
 *
 * These read the SHIPPED CSS and the SHIPPED call sites, not a fixture, so they
 * cannot go green about a stylesheet nobody serves.
 */
import { readFileSync } from 'fs';
import path from 'path';

const CSS_RAW = readFileSync(path.join(process.cwd(), 'app', 'tour-room-theme.css'), 'utf8');
/**
 * 🔴 Strip comments before any brace scan. A `{` inside a comment desynchronises
 * a brace-splitting parser and silently blinds every rule after it — which is
 * exactly what a P7.2 comment (`--tr-plan-shadow-{soft,card,button}`) did to the
 * sibling contrast gate. Assertions that read raw text keep CSS_RAW on purpose.
 */
const CSS = CSS_RAW.replace(/\/\*[\s\S]*?\*\//g, '');
const PLANNER = readFileSync(
  path.join(process.cwd(), 'components', 'tour-mode', 'plan', 'PlanEditorClient.tsx'),
  'utf8',
);

interface Rule {
  parts: string[];
  body: string;
}

/**
 * Every top-level rule, selector list split out. Parsed once rather than
 * regex-hunted per lookup: a `\b` boundary does not work against a leading `.`,
 * which made the first version of this file report "no CSS rule for
 * .tr-plan-hero" about a rule that was plainly there.
 */
const RULES: Rule[] = (() => {
  const out: Rule[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(CSS))) {
    const selector = m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim();
    out.push({ parts: selector.split(',').map((s) => s.replace(/\s+/g, ' ').trim()), body: m[2] });
  }
  return out;
})();

/** Body of the first rule whose selector list contains `selector` exactly. */
function ruleBody(selector: string): string {
  const rule = RULES.find((r) => r.parts.includes(selector));
  if (!rule) throw new Error(`no CSS rule for ${selector}`);
  return rule.body;
}

function pxOf(selector: string, prop: string): number | null {
  const m = new RegExp(`${prop}\\s*:\\s*([0-9.]+)px`).exec(ruleBody(selector));
  return m ? Number(m[1]) : null;
}

/** `font-size: calc(15px * var(--tr-font-scale, 1))` → 15 */
function fontPxOf(selector: string): number | null {
  const m = /font-size\s*:\s*calc\(\s*([0-9.]+)px/.exec(ruleBody(selector));
  return m ? Number(m[1]) : null;
}

describe('plannerButtonHierarchy (P7.2 H-3)', () => {
  const TIERS = {
    hero: '.tr-plan-btn--hero',
    primary: '.tr-plan-btn--primary',
    base: '.tr-plan-btn',
    sm: '.tr-plan-btn--sm',
  };

  it('the tier ladder is hero > primary > default >= compact, in height and in type', () => {
    const h = {
      hero: pxOf(TIERS.hero, 'min-height'),
      primary: pxOf(TIERS.primary, 'min-height'),
      base: pxOf(TIERS.base, 'min-height'),
      sm: pxOf(TIERS.sm, 'min-height'),
    };
    expect(h).toEqual({ hero: 56, primary: 48, base: 44, sm: 36 });

    const f = {
      hero: fontPxOf(TIERS.hero),
      primary: fontPxOf(TIERS.primary),
      base: fontPxOf(TIERS.base),
      sm: fontPxOf(TIERS.sm),
    };
    expect(f).toEqual({ hero: 15, primary: 14, base: 13, sm: 12 });
  });

  it('every tier is thumb-legal except the explicitly compact one', () => {
    for (const tier of ['hero', 'primary', 'base'] as const) {
      expect(pxOf(TIERS[tier], 'min-height')).toBeGreaterThanOrEqual(44);
    }
  });

  /**
   * 🔴 The measured defect: 「Use this route」 was 36px while 「Add」 was 44px.
   * A commit that fills the guest's whole day cannot be the smallest control on
   * the screen, so the compact modifier is forbidden on commit call sites.
   */
  it('no commit button carries the compact modifier', () => {
    const offenders = PLANNER.split('\n')
      .map((line, i) => ({ line: line.trim(), no: i + 1 }))
      .filter(
        ({ line }) =>
          line.includes('tr-plan-btn--sm') &&
          (line.includes('tr-plan-btn--primary') || line.includes('tr-plan-btn--hero')),
      );
    expect(offenders.map((o) => `${o.no}: ${o.line}`)).toEqual([]);
  });

  /**
   * The two day-defining commits — adopt a course, send to the guide — take the
   * hero tier. Pinned by testid so renaming a class cannot quietly demote them.
   */
  it('the course commit and the submit commit are both hero tier', () => {
    for (const testid of ['plan-course-apply-', 'plan-submit']) {
      const idx = PLANNER.indexOf(testid);
      expect(idx).toBeGreaterThan(-1);
      // The className sits within the same JSX element as the testid.
      const around = PLANNER.slice(Math.max(0, idx - 700), idx + 200);
      expect(around).toContain('tr-plan-btn--hero');
    }
  });
});

describe('plannerRadiusScale (P7.2 H-2)', () => {
  /**
   * Four values, and each has a reason: 20 is the room's card; 14 and 10 fall
   * out of "child radius = parent radius − parent padding"; 9999 is a pill.
   */
  const ALLOWED = new Set([20, 14, 10, 9999]);

  it('every planner rule uses one of the four radii', () => {
    const offenders: string[] = [];
    const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
    let m: RegExpExecArray | null;
    while ((m = ruleRe.exec(CSS))) {
      const selector = m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim();
      if (!/\.tr-plan-/.test(selector)) continue;
      const radius = /border-radius\s*:\s*([0-9.]+)px/.exec(m[2]);
      if (!radius) continue;
      if (!ALLOWED.has(Number(radius[1]))) {
        offenders.push(`${selector.split('\n')[0].trim()} → ${radius[1]}px`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the planner card radius equals the room card radius', () => {
    const roomCard = /\.tr-root\s*\{[^}]*--tr-radius-card:\s*([0-9.]+)px/.exec(CSS);
    const planCard = /\.tr-plan-root\s*\{[^}]*--tr-radius-card:\s*([0-9.]+)px/.exec(CSS);
    expect(roomCard?.[1]).toBe('20');
    expect(planCard?.[1]).toBe('20');
  });

  /** Nesting rule: a 14px track with 3px padding gives a 10px thumb, not 11. */
  it('the segment thumb follows the nesting rule', () => {
    expect(pxOf('.tr-plan-seg', 'border-radius')).toBe(14);
    expect(pxOf('.tr-plan-seg', 'padding')).toBe(3);
    expect(pxOf('.tr-plan-seg-item', 'border-radius')).toBe(10);
  });
});

describe('plannerElevation (P7.2 H-1)', () => {
  it('the planner-only shadow scale is gone from CSS and from call sites', () => {
    // The token names may survive inside comments explaining the removal; a
    // DECLARATION or a var() read is what must not.
    expect(CSS).not.toMatch(/--tr-plan-shadow-[a-z]+\s*:/);
    expect(CSS).not.toMatch(/var\(--tr-plan-shadow-/);
    expect(PLANNER).not.toContain('--tr-plan-shadow');
  });

  /**
   * 🔴 Measured before this ticket, in dark: card NONE, hero NONE, primary
   * button NONE. A button that casts nothing does not read as pressable.
   */
  it('the planner dark block never switches elevation off', () => {
    const darkBlock = /\.dark \.tr-plan-root,\s*\.tr-plan-root\.dark\s*\{([^}]*)\}/.exec(CSS);
    expect(darkBlock).not.toBeNull();
    expect(darkBlock![1]).not.toMatch(/shadow[a-z-]*\s*:\s*none/i);
    expect(darkBlock![1]).not.toMatch(/--tr-plan-btn-lift\s*:\s*none/);
  });

  it('the planner does not re-skin the room card out of its rim', () => {
    // The override existed only to replace `--tr-rim, --tr-elev-1` with a
    // rimless drop shadow — i.e. to opt this screen out of the app's material.
    expect(CSS).not.toMatch(/\.tr-plan-root\s+\.tr-card\s*\{/);
  });

  it('the hero header and the hero button both ride the shared elevation scale', () => {
    expect(ruleBody('.tr-plan-hero')).toContain('var(--tr-rim)');
    expect(ruleBody('.tr-plan-hero')).toContain('var(--tr-elev-2)');
    expect(ruleBody('.tr-plan-btn--hero')).toContain('var(--tr-elev-1)');
  });

  /** M-D4 press physics: a 0.9px-per-side nudge is not a press. */
  it('press physics move enough to be seen', () => {
    for (const tier of ['--hero', '--primary', '--soft', '--quiet']) {
      const body = ruleBody(`.tr-plan-btn${tier}:active:not(:disabled)`);
      expect(body).toMatch(/scale\(0\.9[0-8]\)/);
    }
  });
});

/**
 * P7.3 (H-4) — the planner has a protagonist, and the place names are legible.
 *
 * §G-7 measured the real shape of "조잡함": 112 type-class uses, 69 of them in
 * the two SMALLEST steps (tr-label 12px, tr-meta 11px), and the largest step
 * used twice. Hierarchy does not come from shrinking the small things; it comes
 * from something being big. Shrinking further — which the earlier prescription
 * did, and which measured 44px rows — makes everything uniformly small, and
 * uniform is exactly what "조잡하다" describes.
 *
 * So this gate does not cap small type. It requires the two elements that carry
 * the screen's meaning to be above it.
 */
describe('plannerTypeHierarchy (P7.3 H-4)', () => {
  const cls = (name: string) => new RegExp(`className="[^"]*\\b${name}\\b[^"]*"`);

  it('「내 하루」 is the largest heading on the screen', () => {
    const idx = PLANNER.indexOf('copy.yourDay');
    expect(idx).toBeGreaterThan(-1);
    const heading = PLANNER.slice(Math.max(0, idx - 500), idx);
    expect(heading).toMatch(cls('tr-body-lg'));
    // 18px vs the 15px every other section heading uses.
    expect(heading).not.toMatch(cls('tr-card-text'));
    expect(heading).not.toMatch(cls('tr-label'));
  });

  it('a stop name is not smaller than the body text around it', () => {
    const idx = PLANNER.indexOf('data-testid={`plan-stop-row-${index + 1}`}');
    expect(idx).toBeGreaterThan(-1);
    // Wide enough to clear the explanatory comment that sits between the
    // testid and the heading it describes.
    const row = PLANNER.slice(idx, idx + 1200);
    expect(row).toMatch(cls('tr-title'));
    expect(row).not.toMatch(cls('tr-card-text'));
  });

  /**
   * The ladder must actually be a ladder. Read from the shipped CSS so a future
   * edit to the scale cannot silently collapse two steps into one.
   */
  it('the type steps this screen leans on are strictly ordered', () => {
    const size = (name: string) => {
      const m = new RegExp(`\\.${name}\\s*\\{[^}]*font-size:\\s*calc\\(\\s*([0-9.]+)px`).exec(CSS);
      if (!m) throw new Error(`no font-size for .${name}`);
      return Number(m[1]);
    };
    const ladder = ['tr-meta', 'tr-label', 'tr-card-text', 'tr-title', 'tr-body-lg', 'tr-display'];
    const sizes = ladder.map(size);
    expect(sizes).toEqual([11, 12, 13, 15, 18, 20]);
    for (let i = 1; i < sizes.length; i++) expect(sizes[i]).toBeGreaterThan(sizes[i - 1]);
  });
});

/**
 * P7.4 (H-6) — what the guest is making comes before the tools for making it.
 */
describe('plannerLayoutOrder (P7.4 H-6)', () => {
  it('「내 하루」 is rendered before the tab strip, not after it', () => {
    const day = PLANNER.indexOf('the day (shared stop editor');
    const tabs = PLANNER.indexOf('{/* tabs */}');
    expect(day).toBeGreaterThan(-1);
    expect(tabs).toBeGreaterThan(-1);
    expect(day).toBeLessThan(tabs);
  });

  it('it is the screen’s only hero card', () => {
    const heroes = PLANNER.split('\n').filter((l) => /className="[^"]*\btr-card-hero\b/.test(l));
    expect(heroes.length).toBe(1);
  });

  it('it keeps its place when empty', () => {
    // Rendered on `stops.length > 0 || canEdit` — an editor with no stops still
    // shows the section and says so, rather than hiding it (N4).
    expect(PLANNER).toContain('{(stops.length > 0 || canEdit) && tab !== \'delegate\' && (');
    expect(PLANNER).toContain('copy.emptyStops');
  });

  /**
   * 🔴 Copy that points at a direction rots when a section moves, and this
   * ticket moved one. All ten locales of the empty state said "pick places
   * ABOVE" while the picker had just been placed below.
   */
  it('the empty state does not point upward at a section that is now below', () => {
    const UPWARD = ['above', 'ci-dessus', 'oben', 'qui sopra', 'arriba', '위에서', '上方', '上で', 'выше'];
    const lines = PLANNER.split('\n').filter((l) => l.trim().startsWith('emptyStops:'));
    expect(lines.length).toBeGreaterThanOrEqual(10);
    const offenders = lines.filter((l) => UPWARD.some((w) => l.includes(w)));
    expect(offenders).toEqual([]);
  });
});
