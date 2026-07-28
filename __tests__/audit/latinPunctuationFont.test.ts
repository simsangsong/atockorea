/**
 * Standing gate — Latin punctuation must not be resolved by a CJK face.
 *
 * The bug this locks down was photographed on a real phone: "You’ ve left
 * today’ s course to the guide". No stray space in the data — the curly
 * apostrophe was being drawn by a CJK font, where it carries a fullwidth (1em)
 * advance. Measured in headless Chromium at font-size 100px, isolating the
 * glyph as width("nnn’n") − width("nnnn"):
 *
 *   Microsoft YaHei 1.000em · MS Gothic 1.000em   ← the gap
 *   Arial 0.222em · Segoe UI 0.229em · Pretendard 0.231em
 *
 * The reason only the apostrophe breaks is a property of the *dynamic subset*
 * Pretendard build we load from jsdelivr: it splits U+2018-2019 into a
 * different subset file from the Latin letters, while the straight quote, the
 * double quotes and the dashes travel with the letters. So that one codepoint
 * can fall out of the webfont on its own and land on whatever the platform
 * offers next — on a CJK device, a CJK face.
 *
 * These assertions are about the shape of the rule rather than the rendering,
 * which no CI runner can reproduce faithfully (it depends on installed system
 * fonts). What they prevent is the regression that is actually likely: someone
 * adding a new language stack, or reordering an existing one, and dropping the
 * punctuation family off the front.
 */
import { readFileSync } from 'fs';
import path from 'path';

const CSS = readFileSync(path.join(process.cwd(), 'app/globals.css'), 'utf8');
const FAMILY = '"AtoC Latin Punctuation"';

/** Faces that are known to give U+2019 a fullwidth advance, or that lead a stack of them. */
const CJK_LEADING_FACE =
  /"(Noto Sans (SC|TC|JP|KR)|PingFang|Hiragino|Microsoft (YaHei|JhengHei)|Yu Gothic|Meiryo|MS PGothic|Source Han|Apple SD Gothic|Malgun Gothic)/;

/** Every `body`-level font-family declaration, with the selector that owns it. */
function bodyFontStacks(): { selector: string; stack: string }[] {
  const out: { selector: string; stack: string }[] = [];
  // Rules whose selector list mentions `body` (bare, `html[lang] body`, `body.lang-xx`).
  const rule = /([^{}]*\bbody\b[^{}]*)\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = rule.exec(CSS))) {
    const selector = m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim();
    if (!/(^|,|\s)body(\.|:|\s|,|$)/.test(selector)) continue;
    const font = /\bfont-family:\s*([^;]+);/.exec(m[2]);
    if (font) out.push({ selector, stack: font[1].replace(/\s+/g, ' ').trim() });
  }
  return out;
}

describe('latin punctuation font face', () => {
  it('declares the punctuation face', () => {
    expect(CSS).toContain(`font-family: ${FAMILY};`);
  });

  it('covers exactly the codepoints Pretendard splits away from the letters', () => {
    const range = /unicode-range:\s*([^;]+);/.exec(
      CSS.slice(CSS.indexOf(`font-family: ${FAMILY};`)),
    );
    expect(range).not.toBeNull();
    const covered = range![1].toUpperCase();

    // The split-off set — these can fall back alone, so they must be pinned.
    for (const cp of ['U+2018-2019', 'U+201B', 'U+2010', 'U+02BC']) {
      expect(covered).toContain(cp);
    }

    // These arrive in the same subset as the Latin letters and therefore can
    // never fall back on their own. Claiming them would change CJK typography
    // (fullwidth quotes are correct inside a Chinese or Japanese sentence) for
    // no benefit, so the range must stay off them.
    for (const cp of ['201C', '201D', 'U+27', '2013', '2014']) {
      expect(covered).not.toContain(cp);
    }
  });

  it('resolves to a proportional face on every platform, and degrades to nothing', () => {
    const src = /src:\s*([^;]+);/.exec(CSS.slice(CSS.indexOf(`font-family: ${FAMILY};`)));
    expect(src).not.toBeNull();
    const sources = src![1];

    // One reachable local() per platform family. A device with none of them
    // skips the face entirely and gets the normal stack — never worse.
    expect(sources).toContain('local("Segoe UI")'); // Windows
    expect(sources).toContain('local("Helvetica Neue")'); // iOS / macOS
    expect(sources).toContain('local("Roboto")'); // Android
    expect(sources).toContain('local("Arial")');

    // No url() — this must not add a network request to first paint.
    expect(sources).not.toContain('url(');
  });

  it('is first in every body stack that can reach a CJK face', () => {
    const stacks = bodyFontStacks();
    expect(stacks.length).toBeGreaterThanOrEqual(5);

    const exposed = stacks.filter((s) => CJK_LEADING_FACE.test(s.stack));
    expect(exposed.length).toBeGreaterThanOrEqual(4);

    for (const { selector, stack } of exposed) {
      // First, not merely present: whatever leads the stack wins the glyph.
      expect({ selector, leads: stack.startsWith(FAMILY) }).toEqual({ selector, leads: true });
    }
  });

  it('does not reach beyond punctuation into the CJK faces themselves', () => {
    // A stack must still name a CJK face after the punctuation family, or we
    // would have traded a spacing bug for missing glyphs.
    const stacks = bodyFontStacks().filter((s) => s.stack.startsWith(FAMILY));
    for (const { stack } of stacks) {
      const rest = stack.slice(FAMILY.length);
      expect(rest.trim().replace(/^,/, '').trim().length).toBeGreaterThan(0);
    }
  });
});
