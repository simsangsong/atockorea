/**
 * Korean place name normalization for Tour API keyword matching.
 * Heuristics only — tune aliases in data/jeju-curated-places.json for edge cases.
 */

const MULTISPACE = /\s+/g;

/** Remove decorative middle dots / alternate punctuation used in listings. */
function normalizePunctuation(input: string): string {
  let s = input;
  s = s.replace(/[·•∙‧]/g, ' ');
  s = s.replace(/[()（）\[\]]/g, ' ');
  return s;
}

function stripNoiseWords(input: string): string {
  let s = input;
  const noise = [
    '테마파크',
    '테마 파크',
    '관광지',
    '명소',
    '입구',
    '주차장',
  ];
  for (const w of noise) {
    s = s.replace(new RegExp(w, 'g'), ' ');
  }
  return s;
}

/** "제주올레길 7코스" → "제주올레 7코스" style fixes */
function normalizeJejuOlle(input: string): string {
  let s = input.replace(/올레\s*길/g, '올레');
  s = s.replace(/올레길/g, '올레');
  return s;
}

/** Collapse repeated region tokens like "제주 제주시" (light pass). */
function dedupeJejuTokens(input: string): string {
  const parts = input.split(MULTISPACE).filter(Boolean);
  const out: string[] = [];
  let prev = '';
  for (const p of parts) {
    if (p === prev && (p === '제주' || p === '서귀포')) continue;
    out.push(p);
    prev = p;
  }
  return out.join(' ');
}

/**
 * Public normalizer: trim, punctuation, common synonym fixes, whitespace.
 */
export function normalizeKoreanPlaceName(raw: string): string {
  let s = raw.trim();
  if (!s) return s;
  s = normalizePunctuation(s);
  s = normalizeJejuOlle(s);
  s = stripNoiseWords(s);
  s = s.replace(MULTISPACE, ' ').trim();
  s = dedupeJejuTokens(s);
  return s;
}

/**
 * Strip trailing "시/군/읍/면" etc. for broader search (optional step d).
 */
export function stripAdministrativeSuffixes(input: string): string {
  return input
    .replace(/\s*(제주특별자치도|제주도|제주시|서귀포시)\s*$/g, '')
    .replace(MULTISPACE, ' ')
    .trim();
}

/**
 * (d) 불필요 수식어만 제거한 검색어: 올레/가운뎃점 등은 아직 full normalize보다 약한 단계.
 */
export function stripRedundantModifiersOnly(raw: string): string {
  let s = raw.trim();
  if (!s) return s;
  s = normalizePunctuation(s);
  s = normalizeJejuOlle(s);
  s = stripNoiseWords(s);
  s = s.replace(MULTISPACE, ' ').trim();
  return s;
}

/**
 * Build search query variants in order:
 * (a) 원문 (b) 정규화 (c) 제주 + 정규화명 (d) 수식어 제거 (e) 행정 접미/제주 접두 보조
 */
export function buildSearchVariants(sourceName: string): string[] {
  const normalized = normalizeKoreanPlaceName(sourceName);
  const modifierOnly = stripRedundantModifiersOnly(sourceName);
  const stripped = stripAdministrativeSuffixes(
    stripNoiseWords(normalized).replace(MULTISPACE, ' ').trim(),
  );

  const out: string[] = [];
  const push = (q: string) => {
    const t = q.trim();
    if (t && !out.includes(t)) out.push(t);
  };

  push(sourceName);
  push(normalized);
  if (normalized) push(`제주 ${normalized}`);
  if (modifierOnly) push(modifierOnly);
  if (modifierOnly && modifierOnly !== normalized) push(`제주 ${modifierOnly}`);
  if (stripped && stripped !== normalized && stripped !== modifierOnly) push(stripped);
  if (stripped) push(`제주 ${stripped}`);

  return out;
}
