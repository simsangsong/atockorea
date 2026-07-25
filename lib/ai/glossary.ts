/**
 * P1-8 — proper-noun glossary: the pure half.
 *
 * 감천문화마을 was being rendered 甘泉文化村 (spring) instead of 甘川文化村
 * (river). Asking the model nicely does not fix this class of error: a place
 * name is exactly the kind of token an LLM "corrects" toward the more common
 * character. So we never let it see the name at all.
 *
 *   mask()    source text → confirmed names replaced by opaque tokens
 *   restore() translated text → tokens replaced by the CONFIRMED name for the
 *             target locale
 *
 * The model translates around an opaque token, so the rendering is decided by
 * the knowledge base, not by the model. Names come from match_pois, which
 * already stores confirmed ko/en/zh/zh-TW/ja/es names.
 *
 * Deliberately dependency-free so it can be unit-tested and reused by the
 * caption, chat and itinerary paths without dragging in a DB client.
 */

export interface GlossaryEntry {
  /** Stable id (match_pois.poi_key). */
  key: string;
  /** locale → confirmed name. 'en' is the practical fallback. */
  names: Record<string, string>;
}

export interface MaskedTerm {
  token: string;
  entry: GlossaryEntry;
  /** The exact surface form found in the source, for honest fallback. */
  matched: string;
}

export interface MaskResult {
  text: string;
  terms: MaskedTerm[];
}

/**
 * Tokens must survive translation intact. Digits inside a bracket pair are the
 * most robust shape we found: no natural-language content, nothing the model is
 * tempted to translate, and easy to detect when it mangles one anyway.
 */
export function glossaryToken(index: number): string {
  return `⟦G${index}⟧`;
}

const TOKEN_RE = /⟦G(\d+)⟧/g;

/** Longest names first, so "감천문화마을" wins over a shorter overlapping name. */
function surfaceForms(entry: GlossaryEntry): string[] {
  return Object.values(entry.names)
    .filter((name): name is string => typeof name === 'string' && name.trim().length > 1)
    .map((name) => name.trim());
}

/**
 * Replace every known proper noun in `text` with an opaque token.
 * Matching is case-insensitive and longest-first across the whole glossary, so
 * overlapping names cannot produce a half-masked string.
 */
export function maskGlossaryTerms(text: string, entries: GlossaryEntry[]): MaskResult {
  if (!text || entries.length === 0) return { text, terms: [] };

  const candidates: Array<{ surface: string; entry: GlossaryEntry }> = [];
  for (const entry of entries) {
    for (const surface of surfaceForms(entry)) candidates.push({ surface, entry });
  }
  candidates.sort((a, b) => b.surface.length - a.surface.length);

  const terms: MaskedTerm[] = [];
  let masked = text;

  for (const { surface, entry } of candidates) {
    // One token per entry per call — a name repeated in one utterance reuses it.
    const existing = terms.find((term) => term.entry.key === entry.key);
    const index = masked.toLowerCase().indexOf(surface.toLowerCase());
    if (index === -1) continue;

    const token = existing?.token ?? glossaryToken(terms.length);
    const matched = masked.slice(index, index + surface.length);
    // Replace every occurrence of this surface form.
    const escaped = surface.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    masked = masked.replace(new RegExp(escaped, 'gi'), token);
    if (!existing) terms.push({ token, entry, matched });
  }

  return { text: masked, terms };
}

/**
 * Put the confirmed names back, in the target locale.
 *
 * Falls back locale → base language → en → the original surface form. Never
 * leaves a raw token in guest-visible text: an unresolved token is worse than
 * an untranslated name.
 */
export function restoreGlossaryTerms(
  text: string,
  terms: MaskedTerm[],
  locale: string,
): string {
  if (!text || terms.length === 0) return text;
  let restored = text;

  for (const term of terms) {
    const names = term.entry.names;
    const base = (locale || '').split('-')[0];
    const replacement =
      names[locale] ??
      (base ? names[base] : undefined) ??
      Object.entries(names).find(([key]) => key.split('-')[0] === base)?.[1] ??
      names.en ??
      term.matched;
    restored = restored.split(term.token).join(replacement);
  }

  // A mangled token (spacing, half-width brackets) must not reach a guest.
  return restored.replace(TOKEN_RE, (whole, index: string) => {
    const term = terms[Number(index)];
    return term ? term.matched : whole;
  });
}

/** Did the model damage any token? Used to decide whether to trust the output. */
export function hasUnresolvedToken(text: string): boolean {
  TOKEN_RE.lastIndex = 0;
  return TOKEN_RE.test(text);
}

/**
 * Proper-noun-looking terms the glossary does NOT cover, for the collection log
 * (§P1-8 "사전에 없는 고유명사는 로그로 수집해 추후 보강"). Intentionally
 * conservative: Korean place suffixes and Capitalised multiword English only.
 */
export function collectUnknownProperNouns(text: string, entries: GlossaryEntry[]): string[] {
  if (!text) return [];
  const known = new Set(
    entries.flatMap((entry) => surfaceForms(entry).map((surface) => surface.toLowerCase())),
  );
  const found = new Set<string>();

  const korean = text.match(/[가-힣]{2,}(?:마을|시장|사찰|공원|해수욕장|타워|궁|사|산|섬|폭포|계곡|다리|성)/g) ?? [];
  for (const term of korean) {
    if (!known.has(term.toLowerCase())) found.add(term);
  }

  const english =
    text.match(/\b(?:[A-Z][a-z]{2,}\s){1,3}(?:Village|Market|Temple|Palace|Tower|Beach|Park|Bridge|Island|Falls)\b/g) ??
    [];
  for (const term of english) {
    const trimmed = term.trim();
    if (!known.has(trimmed.toLowerCase())) found.add(trimmed);
  }

  return [...found];
}
