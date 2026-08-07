/**
 * Standing gate — `.tr-btn-physical` lifts, it does not paint.
 *
 * 🔴 Why this exists.
 *
 * The class used to set `color: var(--tr-chip-ink)` and
 * `background: var(--tr-chip-grad)` (a SHORTHAND, so it reset `background-color`
 * too). Ten of its fourteen call sites pair it with `bg-[var(--tr-…)]` and
 * `text-[var(--tr-…)]` utilities, and `tour-room-theme.css` loads after the
 * Tailwind layer — so at equal specificity the theme won both properties and
 * every one of those callers rendered as the charcoal chip.
 *
 * Measured in a browser, not reasoned about. `home-now-action` ("Open map") is
 * authored `bg-[var(--tr-accent)] text-[var(--tr-on-accent)]` and computed to:
 *
 *     background-color : rgba(0, 0, 0, 0)
 *     background-image : linear-gradient(140deg, #3a4144, #181c1e)
 *
 * The guest home's primary had been rendering as the same dark slab as the
 * secondary next to it, and `qa-uiux-render` reported "0 primaries" on a screen
 * whose primary was in the source the whole time.
 *
 * ⚠ The first fix cleared the gradient but set `color: inherit`, which clobbered
 * the caller's text utility in exactly the same way — the freshly-green button
 * rendered near-black ink at 2.41:1. Hence the rule below is about BOTH paint
 * properties, not just background.
 *
 * The assertion is on the stylesheet rather than on call sites on purpose:
 * several callers build their classes in template literals with the background
 * inside an interpolated branch (`SayQueueCard`), where a source scan cannot
 * see it. If the shared class never paints, those callers cannot be ambushed
 * no matter how they are written.
 */
import { readFileSync } from 'fs';
import path from 'path';

const CSS = readFileSync(path.join(process.cwd(), 'app/tour-room-theme.css'), 'utf8');

/** Body of a rule whose selector is exactly `sel` (no `:active` etc.). */
function ruleBody(sel: string): string | null {
  const re = new RegExp(`(^|\\})\\s*\\${sel}\\s*\\{([^}]*)\\}`, 'm');
  const m = re.exec(CSS);
  return m ? m[2] : null;
}

describe('tr-btn-physical: physicality only, never paint', () => {
  it('the rule exists — an empty scan is not a pass', () => {
    expect(ruleBody('.tr-btn-physical')).toBeTruthy();
    expect(ruleBody('.tr-btn-physical--chip')).toBeTruthy();
  });

  it('🔴 the shared class sets no colour and no background', () => {
    const body = ruleBody('.tr-btn-physical')!;
    expect(body).not.toMatch(/(^|;|\s)color\s*:/);
    expect(body).not.toMatch(/(^|;|\s)background(-color|-image)?\s*:/);
  });

  it('🔴 and never via the `background` shorthand, which also resets background-color', () => {
    // Called out separately because the shorthand is the specific trap: it looks
    // like it only sets a gradient and silently clears the caller's colour.
    expect(ruleBody('.tr-btn-physical')!).not.toMatch(/background\s*:/);
  });

  it('the chip look still exists for callers that want it', () => {
    const chip = ruleBody('.tr-btn-physical--chip')!;
    expect(chip).toMatch(/--tr-chip-grad/);
    expect(chip).toMatch(/--tr-chip-ink/);
  });

  it('it still lifts — the shadow and press are what the class is for', () => {
    expect(ruleBody('.tr-btn-physical')!).toMatch(/box-shadow/);
    expect(CSS).toMatch(/\.tr-btn-physical:active\s*\{/);
  });

  it('no call site references the retired --fill modifier', () => {
    // It existed for one commit and set `color: inherit`; anything still asking
    // for it would be silently unstyled.
    expect(CSS).not.toMatch(/tr-btn-physical--fill/);
  });
});
