/**
 * Standing gate — the CJK line-break invariant (CLAUDE.md P1-5).
 *
 * 🔴 Why this file exists at all.
 *
 * The invariant had a scanner (`scripts/qa-cjk-scan.ts`) and no gate. It was not
 * in jest, not in CI, not in package.json — nothing ran it unless a human
 * remembered to. Between two sessions the reported count went 576 → 583 and
 * nobody saw it, because there was nothing to see it with. Four sweeps had
 * applied protection classes element by element and the number kept refilling.
 *
 * So the fix moved from opt-in to default: `globals.css` now declares
 * `word-break: keep-all; overflow-wrap: break-word` on `html`, and both
 * properties inherit — including into `createPortal` subtrees that an app-shell
 * rule would miss. Measured with `scripts/qa-cjk-render.mjs`, that took the
 * Korean home page from 11 illegal breaks to 0 without editing one component.
 *
 * That makes those two declarations the single load-bearing line for the whole
 * invariant, which is exactly the kind of thing that gets deleted by a refactor
 * with a tidy diff. Hence this gate, and hence the mutation tests below: a gate
 * nobody has watched fail is a gate nobody knows works.
 *
 * What this file does NOT claim: that no CJK text can ever collapse. It cannot.
 * A run still breaks mid-syllable when its box is narrower than the run itself
 * — measured on `/admin/orders`, where 미선택 sits in a 64px cell. Source cannot
 * tell a squeezed box from a roomy one; only rendering can, which is what
 * `qa-cjk-render.mjs` is for.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';
import { scanSource, scanBreakAllOnCjk, type CjkBreakHit } from '@/lib/audit/cjkBreak';

const CSS_PATH = path.join(process.cwd(), 'app/globals.css');

/**
 * 🔴 Comments are stripped before any brace counting.
 *
 * This repo has already lost a gate to prose: a comment reading
 * `--tr-plan-shadow-{soft,card,button}` unbalanced another scanner's block
 * parser, and the gate went from measuring a palette to measuring nothing while
 * still reporting green. Anything that walks `{`/`}` in CSS here strips comments
 * first, and `stripCssComments` is asserted below on that exact shape.
 */
export function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, ' ');
}

/** Declaration bodies of every rule whose selector matches, comments removed. */
function declarationsFor(css: string, selectorPattern: string): string[] {
  const re = new RegExp(`(?:^|[\\s{};])${selectorPattern}\\s*\\{([^{}]*)\\}`, 'g');
  return [...stripCssComments(css).matchAll(re)].map((m) => m[1]);
}

const declares = (bodies: string[], prop: string, value: string) =>
  bodies.some((b) => new RegExp(`${prop}\\s*:\\s*${value}\\s*(;|$)`).test(b));

describe('the root default — the one line the whole invariant rests on', () => {
  const css = readFileSync(CSS_PATH, 'utf8');

  it('globals.css declares keep-all + break-word on html', () => {
    const bodies = declarationsFor(css, 'html');
    expect(bodies.length).toBeGreaterThan(0);
    expect(declares(bodies, 'word-break', 'keep-all')).toBe(true);
    expect(declares(bodies, 'overflow-wrap', 'break-word')).toBe(true);
  });

  /**
   * The companion, and why it is not optional. `break-word` deliberately does
   * not count toward intrinsic sizing, so under `keep-all` a cell's min-content
   * becomes its longest 어절 and the column can no longer shrink — measured, a
   * 150px table rendered 176px. `anywhere` breaks identically but does count,
   * which restored every column width exactly (150px → 150px).
   */
  it('table cells carry the anywhere companion', () => {
    expect(declares(declarationsFor(css, 'td\\s*,\\s*th'), 'overflow-wrap', 'anywhere')).toBe(true);
  });

  // ---- mutation: the assertions above must actually bite -------------------

  /**
   * ⚠ The first version of this mutation deleted the wrong rule and the gate
   * caught it. `word-break: keep-all; overflow-wrap: break-word` is a byte-exact
   * substring of `.text-cjk-body` as well, so a plain text replace emptied the
   * utility and left the root rule standing — the mutation "applied", the
   * assertion failed, and the failure was the useful part. Empty the `html`
   * blocks specifically instead.
   */
  it('🔴 fails when the root declaration is deleted', () => {
    const mutated = css.replace(/(^|[\s{};])(html\s*\{)[^{}]*\}/g, '$1$2}');
    expect(mutated).not.toBe(css); // the mutation must have applied
    const bodies = declarationsFor(mutated, 'html');
    expect(bodies.length).toBeGreaterThan(0); // still parsed as html rules…
    expect(declares(bodies, 'word-break', 'keep-all')).toBe(false); // …but now empty
  });

  it('🔴 is not satisfied by a comment that merely mentions the rule', () => {
    const commentOnly = '@layer base {\n  /* html { word-break: keep-all; overflow-wrap: break-word; } */\n}';
    expect(declares(declarationsFor(commentOnly, 'html'), 'word-break', 'keep-all')).toBe(false);
  });

  it('🔴 stripCssComments survives braces inside a comment (the recorded failure)', () => {
    const hostile = '/* --tr-plan-shadow-{soft,card,button} */\nhtml { word-break: keep-all; }';
    expect(declares(declarationsFor(hostile, 'html'), 'word-break', 'keep-all')).toBe(true);
  });
});

// ---- rule 2: break-all is for ASCII, never for CJK -------------------------

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx$/.test(entry)) out.push(full);
  }
  return out;
}

const SOURCES = ['components', 'app'].flatMap((r) => walk(path.join(process.cwd(), r)));
const relative = (f: string) => path.relative(process.cwd(), f).replace(/\\/g, '/');

describe('rule 2 — break-all on CJK is the one opt-out the default cannot save', () => {
  it('no element sets break-all on text containing CJK', () => {
    const offenders: CjkBreakHit[] = [];
    for (const file of SOURCES) {
      offenders.push(...scanBreakAllOnCjk(relative(file), readFileSync(file, 'utf8')));
    }
    expect(offenders.map((h) => `${h.file}:${h.line} <${h.tag}> "${h.text}"`)).toEqual([]);
  });

  it('🔴 the check bites — a planted violation is caught', () => {
    const planted = scanBreakAllOnCjk('x.tsx', '<div className="break-all w-24">성산일출봉으로 이동합니다</div>');
    expect(planted).toHaveLength(1);
  });

  it('leaves break-all on ASCII alone — that is its legitimate use', () => {
    expect(scanBreakAllOnCjk('x.tsx', '<div className="break-all">https://example.com/a/very/long/path</div>')).toEqual([]);
  });
});

// ---- the ratchet ----------------------------------------------------------

/**
 * 🔴 A ceiling, not a target.
 *
 * With the root default in place a `certain` hit no longer means "this text
 * collapses". It means "this element carries no `.text-cjk-safe`, so it will
 * collapse IF its box is squeezed narrower than the run". That is a real
 * standing risk and it is the population that grew 576 → 583 unwatched, so it
 * gets a ceiling. Lower this number when a sweep lowers the count — a ratchet
 * left above the real figure is a gate that has stopped measuring.
 */
const CERTAIN_CEILING = 492;
/**
 * 428 → 429 on 2026-07-30: the in-room seat card (`seat/RoomSeatCard.tsx`) is
 * one new element carrying CJK.
 *
 * A ratchet may only move up on evidence, never on faith — the whole point is
 * that the population once grew 576 → 583 with nobody looking. The evidence
 * here is a real render, not a reading of the source: `scripts/qa-seat-door-walk.mjs`
 * and `scripts/qa-door-fixes-walk.mjs` drive the card in Korean at 390px and
 * count line breaks landing between two CJK characters. Both report 0, and the
 * action label carries `.text-cjk-safe` so a squeezed box truncates instead of
 * collapsing. `suspect` means "source cannot tell"; the render can, and did.
 *
 * 429 → 430 on 2026-08-07: `EmojiPicker.tsx` — the composer's emoji tray
 * (사장님 지시). One new element, and the scanner's own reason for flagging it
 * is `control` + an unresolved `{emoji}` child, i.e. "source cannot tell".
 *
 * Here the source CAN tell, which is why this is evidence and not faith: the
 * child is `COMPOSER_EMOJI.map()` over a literal array of single pictographs
 * (`lib/tour-room/emoji.ts`), so the button never holds CJK and a one-glyph
 * button has no break opportunity to place. ChatFeed's identical `{emoji}`
 * reaction button is already inside this 429 for the same shape — counting
 * this one keeps the population honest rather than carving an exception.
 */
const SUSPECT_CEILING = 430;

describe('ratchet — the count that grew unwatched now has a ceiling', () => {
  const hits: CjkBreakHit[] = [];
  for (const file of SOURCES) hits.push(...scanSource(relative(file), readFileSync(file, 'utf8')));

  it(`certain stays at or below ${CERTAIN_CEILING}`, () => {
    const certain = hits.filter((h) => h.confidence === 'certain');
    expect(certain.length).toBeLessThanOrEqual(CERTAIN_CEILING);
  });

  it(`suspect stays at or below ${SUSPECT_CEILING}`, () => {
    expect(hits.filter((h) => h.confidence === 'suspect').length).toBeLessThanOrEqual(SUSPECT_CEILING);
  });

  /**
   * `native` is `<option>`/`<select>`, whose text the platform widget draws and
   * whose CSS it ignores. They sat in `certain` for four sweeps, where they
   * could neither be fixed nor dismissed — a floor nobody could reach, under a
   * number people were asked to drive to zero.
   */
  it('native hits are excluded from certain, not hidden', () => {
    const native = hits.filter((h) => h.confidence === 'native');
    expect(native.length).toBeGreaterThan(0);
    expect(native.every((h) => h.tag === 'option' || h.tag === 'select')).toBe(true);
    expect(hits.filter((h) => h.confidence === 'certain').some((h) => h.tag === 'option')).toBe(false);
  });
});
