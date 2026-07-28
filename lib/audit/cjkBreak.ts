/**
 * X1 / U-D17 — CJK character-level line-break scanner, rebuilt.
 *
 * The invariant (CLAUDE.md P1-5): Korean, Chinese and Japanese have no word
 * spaces, so CSS's default `word-break: normal` splits them CHARACTER BY
 * CHARACTER. A label with nothing specified collapses vertically —
 * `빈민 / 유형 / 준비전`. The cause is not `break-all`; it is having said
 * nothing, which is why grepping for `break-all` finds almost none of it.
 * Table headers, buttons, badges, chips and tabs must carry `.text-cjk-safe`;
 * body copy must carry `.text-cjk-body`.
 *
 * 🔴 Why this file replaces the old scanner rather than extending it.
 *
 * The previous version reported 22-23 hits and was trusted. Then a walk caught
 * `투어일 / 기준` and `엑 / 셀` collapsing on the ops bookings toolbar — three
 * controls the scanner had never mentioned. It could not have: it only matched
 * width classes (`flex-1`, `w-N`, `grid-cols`), and a chip in a `flex-wrap` row
 * has none of those. Its width comes from its content.
 *
 * A guard that leaks is more dangerous than no guard, because people stop
 * looking. So the rule here follows CLAUDE.md's own wording instead of a proxy
 * for it: a CONTROL (button / link / tab / table header / chip-shaped element)
 * holding CJK text needs a protection class, whatever its width classes say.
 *
 * Three other blind spots are closed at the same time:
 *   - only `className="…"` was parsed, so every template literal and `cn(…)`
 *     call in the repo was invisible — and those are the majority here;
 *   - only Hangul was searched, though the rule covers Chinese and Japanese and
 *     the guest app ships ten locales;
 *   - the text had to appear within two lines of the className.
 *
 * And it reports two buckets rather than one number. A control whose child is
 * an expression (`{p.label}`) cannot be judged from source — calling those
 * clean would recreate the same false confidence in a new place, so they are
 * counted separately as `suspect`.
 */

/** Han, Hiragana, Katakana, Hangul syllables + jamo. */
export const CJK_PATTERN =
  /[぀-ヿ㐀-䶿一-鿿豈-﫿가-힯ᄀ-ᇿ]/;

/** Either protection class, or a rule that already prevents the collapse. */
const PROTECTED =
  /\btext-cjk-(safe|body)\b|\btruncate\b|\bwhitespace-nowrap\b|\bline-clamp-\d\b|\bbreak-keep\b/;

/** Width comes from the parent — the original heuristic, kept. */
// `w-\d` without the `+` silently failed on `w-24`: the \b after a single digit
// cannot match when another digit follows. The old scanner carried the same bug.
const WIDTH_CONSTRAINED = /\b(flex-1|min-w-0|w-\d+|w-\[|grid-cols-\d+|max-w-\[)/;

/** Width comes from the content: a chip, pill, badge or tab. */
const CHIP_SHAPED = /\brounded-(full|xl|2xl|lg)\b/;

const CONTROL_TAGS = new Set(['button', 'a', 'th', 'summary', 'option', 'label']);

export type Confidence = 'certain' | 'suspect';

export interface CjkBreakHit {
  file: string;
  line: number;
  /** Character offset of the opening `<`, and one past its `>`. Codemods need
   *  these so a fixer edits the exact tag the scanner judged, not a re-match. */
  start: number;
  openEnd: number;
  tag: string;
  /** Why this element is in scope at all. */
  reason: 'control' | 'chip' | 'width';
  confidence: Confidence;
  /** The CJK text found, or the expression that might render some. */
  text: string;
  classes: string;
}

/**
 * Collect every string literal that contributes to a className, from any of the
 * forms this repo actually uses:
 *   className="a b"  ·  className={'a b'}  ·  className={`a ${x} b`}
 *   className={cn('a', cond && 'b')}  ·  className={clsx(...)}
 */
export function classNamesIn(openingTag: string): string {
  const out: string[] = [];
  const plain = /className\s*=\s*"([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = plain.exec(openingTag))) out.push(m[1]);

  const braced = /className\s*=\s*\{/g;
  while ((m = braced.exec(openingTag))) {
    // Walk to the matching brace so a nested cn(...) call is fully captured.
    let depth = 1;
    let i = m.index + m[0].length;
    while (i < openingTag.length && depth > 0) {
      if (openingTag[i] === '{') depth += 1;
      else if (openingTag[i] === '}') depth -= 1;
      i += 1;
    }
    const expr = openingTag.slice(m.index + m[0].length, i - 1);
    for (const lit of expr.matchAll(/(['"`])((?:\\.|(?!\1)[\s\S])*)\1/g)) {
      // Template holes carry no class we can read; the surrounding literal does.
      out.push(lit[2].replace(/\$\{[^}]*\}/g, ' '));
    }
  }
  return out.join(' ');
}

/** End index (exclusive) of the opening tag starting at `start`, brace-aware. */
function endOfOpeningTag(source: string, start: number): number {
  let i = start;
  let depth = 0;
  let quote: string | null = null;
  while (i < source.length) {
    const ch = source[i];
    if (quote) {
      if (ch === '\\') i += 1;
      else if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
    } else if (ch === '{') depth += 1;
    else if (ch === '}') depth -= 1;
    else if (ch === '>' && depth === 0) return i + 1;
    i += 1;
  }
  return source.length;
}

/** The element's inner content, by tag-depth counting. Empty if self-closing. */
function innerOf(source: string, tag: string, openEnd: number): string {
  if (source.slice(Math.max(0, openEnd - 2), openEnd).includes('/>')) return '';
  const open = new RegExp(`<${tag}(?=[\\s/>])`, 'g');
  const close = new RegExp(`</${tag}>`, 'g');
  let depth = 1;
  let i = openEnd;
  while (i < source.length) {
    open.lastIndex = i;
    close.lastIndex = i;
    const o = open.exec(source);
    const c = close.exec(source);
    if (!c) return source.slice(openEnd, Math.min(source.length, openEnd + 4000));
    if (o && o.index < c.index) {
      depth += 1;
      i = o.index + 1;
    } else {
      depth -= 1;
      if (depth === 0) return source.slice(openEnd, c.index);
      i = c.index + 1;
    }
  }
  return source.slice(openEnd);
}

/**
 * Direct text of an element: literal children, plus any string literal that a
 * simple expression child can render.
 *
 * 🔴 That second part is not a nicety. The defect that triggered this rewrite —
 * `투어일 / 기준` on the ops toolbar — is written as
 * `{axis === 'tour_date' ? '투어일 기준' : '예약 유입일 기준'}`. Throwing away
 * everything between braces put a KNOWN, fully decidable Korean label into the
 * "cannot judge from source" bucket, which is where findings go to be ignored.
 * A ternary over two string literals is as decidable as a bare literal.
 *
 * Expressions that reference a variable still yield nothing here and stay
 * `suspect` — the honest answer for those.
 */
function directText(inner: string): string {
  const literalsInExpressions: string[] = [];
  for (const expr of inner.matchAll(/\{([^{}]*)\}/g)) {
    for (const lit of expr[1].matchAll(/(['"`])((?:\\.|(?!\1)[\s\S])*)\1/g)) {
      literalsInExpressions.push(lit[2]);
    }
  }
  const literalChildren = inner.replace(/<[^>]*>/g, ' ').replace(/\{[^{}]*\}/g, ' ');
  return [literalChildren, ...literalsInExpressions].join(' ').replace(/\s+/g, ' ').trim();
}

export function scanSource(file: string, source: string): CjkBreakHit[] {
  const hits: CjkBreakHit[] = [];
  const tagRe = /<([a-zA-Z][a-zA-Z0-9]*)(?=[\s/>])/g;
  let m: RegExpExecArray | null;

  while ((m = tagRe.exec(source))) {
    const tag = m[1];
    // Components (capitalised) hide their own markup; the primitive they render
    // is where the class belongs, and DataTable/ChatListRow already carry it.
    if (/^[A-Z]/.test(tag)) continue;

    const openEnd = endOfOpeningTag(source, m.index);
    const openingTag = source.slice(m.index, openEnd);
    const classes = classNamesIn(openingTag);
    if (PROTECTED.test(classes)) continue;

    const isControl =
      CONTROL_TAGS.has(tag) ||
      /role\s*=\s*["'](tab|button|columnheader)["']/.test(openingTag);
    const isChip = CHIP_SHAPED.test(classes) && /\bpx-|\bpy-|\bp-\d/.test(classes);
    const isWidth = WIDTH_CONSTRAINED.test(classes);
    if (!isControl && !isChip && !isWidth) continue;

    const inner = innerOf(source, tag, openEnd);
    const text = directText(inner);
    const line = source.slice(0, m.index).split('\n').length;
    const reason: CjkBreakHit['reason'] = isControl ? 'control' : isChip ? 'chip' : 'width';

    if (CJK_PATTERN.test(text)) {
      hits.push({ file, line, start: m.index, openEnd, tag, reason, confidence: 'certain', text: text.slice(0, 60), classes: classes.slice(0, 80) });
      continue;
    }
    // No literal text — but a control whose label is an expression is exactly
    // where a Korean string arrives at runtime. Reported, not counted as clean.
    const expr = inner.match(/\{[^{}]{1,60}\}/);
    if (expr && !CJK_PATTERN.test(inner) && /^(button|a|th)$/.test(tag)) {
      hits.push({
        file,
        line,
        start: m.index,
        openEnd,
        tag,
        reason,
        confidence: 'suspect',
        text: expr[0].slice(0, 60),
        classes: classes.slice(0, 80),
      });
    }
  }
  return hits;
}
