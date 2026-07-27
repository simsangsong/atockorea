/**
 * U-D10 / G1 — locale-completeness scanner for INLINE copy blocks.
 *
 * The room shipped 5 locales for a long time, and most staff/guest copy lives
 * in object literals typed as a loose `Record<string, …>` rather than
 * `Record<RoomLocale, …>`. When the room went to 9 locales tsc stayed silent
 * about every one of those blocks: a `Record<string, string>` with five keys
 * is a perfectly good `Record<string, string>`.
 *
 * The cost is not a crash, it is a wrong-language answer. `vision-ask` picked
 * its reply language from a five-entry map for weeks, so French, German,
 * Russian and Italian guests were quietly answered in English (fixed 2026-07-27,
 * PR #508). A parallel session had already found the same class by hand with a
 * "zh 있고 fr 없는 파일" grep. This promotes that grep to a standing gate.
 *
 * Why parse the literal instead of grepping the file: a file-level check
 * cannot tell a genuine 5-locale copy block from a file that merely happens to
 * mention `zh` somewhere, and it cannot point at the offending object. This
 * finds the enclosing braces and reports the exact line.
 */

export const LOCALE_KEY_PATTERN = /(^|[{,\s])(['"]?)(en|ko|ja|zh|es|fr|de|ru|it)\2\s*:/g;

/** A quoted or bare top-level key inside an object literal. */
const KEY_PATTERN = /(^|[{,])\s*(?:(['"])([A-Za-z0-9_$-]+)\2|([A-Za-z_$][A-Za-z0-9_$]*))\s*:/g;

export interface LocaleBlock {
  /** 1-indexed line of the block's opening brace. */
  line: number;
  keys: string[];
  localeKeys: string[];
  missing: string[];
}

/**
 * Walk back from `index` to the innermost enclosing `{`, then forward to its
 * match. Returns null when the braces don't balance (inside a template
 * literal, say) rather than guessing.
 */
function enclosingObject(src: string, index: number): { start: number; end: number } | null {
  let depth = 0;
  let start = -1;
  for (let i = index; i >= 0; i -= 1) {
    const ch = src[i];
    if (ch === '}') depth += 1;
    else if (ch === '{') {
      if (depth === 0) {
        start = i;
        break;
      }
      depth -= 1;
    }
  }
  if (start < 0) return null;

  depth = 0;
  for (let i = start; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return { start, end: i };
    }
  }
  return null;
}

/** Top-level keys of an object literal source (skips nested objects). */
function topLevelKeys(objectSrc: string): string[] {
  const body = objectSrc.slice(1, -1);
  const keys: string[] = [];
  let depth = 0;
  let segmentStart = 0;
  const segments: string[] = [];
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (ch === '{' || ch === '[' || ch === '(') depth += 1;
    else if (ch === '}' || ch === ']' || ch === ')') depth -= 1;
    else if (ch === ',' && depth === 0) {
      segments.push(body.slice(segmentStart, i));
      segmentStart = i + 1;
    }
  }
  segments.push(body.slice(segmentStart));
  for (const segment of segments) {
    KEY_PATTERN.lastIndex = 0;
    const match = KEY_PATTERN.exec(`,${segment}`);
    if (match) keys.push(match[3] ?? match[4]);
  }
  return keys;
}

/** Every top-level value is a bare locale code (a locale→locale mapping). */
function valuesAreAllLocaleCodes(objectSrc: string, localeSet: Set<string>): boolean {
  const values = [...objectSrc.slice(1, -1).matchAll(/:\s*(['"])([A-Za-z-]+)\1\s*(?=[,}])/g)].map(
    (m) => m[2],
  );
  if (!values.length) return false;
  const pairs = objectSrc.slice(1, -1).split(',').filter((s) => s.includes(':')).length;
  return values.length === pairs && values.every((v) => localeSet.has(v));
}

/**
 * Is this literal the initializer of a Record keyed by a named type?
 *
 * `Record<WeatherLocale, string>` and `Partial<Record<RoomLocale, string>>` are
 * already guarded by tsc: leave a key out and the compiler says so. Flagging
 * them would be noise, and worse, it would push someone to widen a type that
 * was deliberately narrow. Only `Record<string, …>` and bare literals are the
 * blind spot this gate exists for.
 */
function annotatedHere(source: string, braceIndex: number): boolean {
  const before = source.slice(Math.max(0, braceIndex - 240), braceIndex);
  const keyTypes = [...before.matchAll(/Record\s*<\s*([A-Za-z_$][\w$.]*)\s*,/g)].map((m) => m[1]);
  return keyTypes.some((t) => t !== 'string');
}

function hasTypedRecordAnnotation(source: string, braceIndex: number): boolean {
  // A nested value object (`Record<SkyState, Record<WeatherLocale, string>>`)
  // carries no annotation of its own — it inherits the outer one, which may be
  // hundreds of characters back if it is the tenth entry in a long literal. So
  // walk OUT through the enclosing literals instead of guessing a window size.
  // Erring toward skipping is deliberate: a false alarm here would push someone
  // to widen a type that was narrowed on purpose.
  let index: number | null = braceIndex;
  for (let depth = 0; index !== null && depth < 6; depth += 1) {
    if (annotatedHere(source, index)) return true;
    const outer: { start: number; end: number } | null =
      index > 0 ? enclosingObject(source, index - 1) : null;
    index = outer ? outer.start : null;
  }
  return false;
}

/**
 * Find object literals that are locale maps and report the ROOM_LOCALES they
 * are missing.
 *
 * A literal counts as a locale map when at least `minLocaleKeys` of its
 * top-level keys are locale codes AND those make up most of the object — so a
 * config object with a stray `de:` field is not dragged in.
 */
export function findIncompleteLocaleBlocks(
  source: string,
  locales: readonly string[],
  options: { minLocaleKeys?: number; localeShare?: number } = {},
): LocaleBlock[] {
  const minLocaleKeys = options.minLocaleKeys ?? 3;
  const localeShare = options.localeShare ?? 0.6;
  const localeSet = new Set(locales);

  const seen = new Set<number>();
  const out: LocaleBlock[] = [];

  LOCALE_KEY_PATTERN.lastIndex = 0;
  let hit: RegExpExecArray | null;
  while ((hit = LOCALE_KEY_PATTERN.exec(source)) !== null) {
    const bounds = enclosingObject(source, hit.index);
    if (!bounds || seen.has(bounds.start)) continue;
    seen.add(bounds.start);

    if (hasTypedRecordAnnotation(source, bounds.start)) continue;

    const objectSrc = source.slice(bounds.start, bounds.end + 1);
    const keys = topLevelKeys(objectSrc);
    if (!keys.length) continue;
    const localeKeys = keys.filter((k) => localeSet.has(k));
    if (localeKeys.length < minLocaleKeys) continue;
    if (localeKeys.length / keys.length < localeShare) continue;
    // A map whose VALUES are locale codes is a locale→locale translation
    // table (e.g. video language → room locale), not copy. Those legitimately
    // omit locales — there is no Korean narration to point at.
    if (valuesAreAllLocaleCodes(objectSrc, localeSet)) continue;

    const missing = locales.filter((l) => !localeKeys.includes(l));
    if (missing.length) {
      out.push({
        line: source.slice(0, bounds.start).split('\n').length,
        keys,
        localeKeys,
        missing,
      });
    }
  }
  return out;
}
