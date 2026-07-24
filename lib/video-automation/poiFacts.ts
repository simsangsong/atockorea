/**
 * Grounding layer for POI intro scripts (plan §14.3 "POI 소개비디오").
 *
 * The repo rule for generated travel copy is the one already enforced in
 * lib/tour-room/generatedContent.ts: **a factual claim must come from the
 * source data verbatim, or it must be omitted.** A narrator that invents
 * opening hours is worse than a narrator that says nothing about hours.
 *
 * Two pure pieces live here:
 *   1. `buildFactSheet` — flattens one POI's resolved content into the list of
 *      strings that are allowed to be the origin of a claim, each carrying the
 *      id of the source it came from (file/poi_kb/match_pois/generated row).
 *   2. `stripUnsupportedClaims` — sentence-level filter. Any sentence carrying
 *      a hard claim token (a time, a price, a phone number, a measurement, a
 *      year, a superlative, an admission statement) that does not appear in the
 *      fact sheet is dropped, and the drop is reported so QC can show it.
 *
 * Client-safe: pure string work only — no node:*, no supabase, no fetch.
 */

import type { VideoLanguageCode } from '@/lib/video-automation/languages';
import type { VideoLocalizedPoiContent, VideoPoiSource } from '@/lib/video-automation/types';

export interface PoiFact {
  /** Where in the content this string came from, e.g. `highlights[0]`. */
  field: string;
  text: string;
  /** Provenance id from the resolver (`file:...`, `poi_kb:...`, `db:match_pois:...`). */
  sourceId: string;
}

export interface PoiFactSheet {
  poiId: string;
  language: VideoLanguageCode;
  name: string;
  facts: PoiFact[];
  /** Every fact text lowercased and concatenated — the claim lookup haystack. */
  haystack: string;
  /** Every number the facts state, comma/period-stripped. Exact-match only. */
  numbers: Set<string>;
}

/** Claim kinds a generated sentence may not introduce on its own. */
export type ClaimKind =
  | 'time'
  | 'money'
  | 'phone'
  | 'measurement'
  | 'year'
  | 'percent'
  | 'admission'
  | 'superlative'
  | 'quantity';

interface ClaimPattern {
  kind: ClaimKind;
  pattern: RegExp;
}

/**
 * Hard claim patterns. Deliberately conservative: they fire on things a reader
 * would act on (be there at 9, bring ₩5,000, walk 300 m) and on unverifiable
 * ranking language. Adjectives, atmosphere, and history framed as general
 * knowledge are left alone — the same split generatedContent.ts's critic uses.
 */
const CLAIM_PATTERNS: ClaimPattern[] = [
  { kind: 'time', pattern: /\b\d{1,2}:\d{2}\b/g },
  { kind: 'time', pattern: /\b\d{1,2}\s?(?:am|pm|a\.m\.|p\.m\.)\b/gi },
  { kind: 'time', pattern: /(?:오전|오후)\s?\d{1,2}\s?시/g },
  { kind: 'time', pattern: /\d{1,2}\s?(?:時|时)/g },
  { kind: 'money', pattern: /[₩$€£¥]\s?\d[\d,.]*/g },
  { kind: 'money', pattern: /\d[\d,.]*\s?(?:won|krw|usd|eur|원|元|円)\b/gi },
  { kind: 'phone', pattern: /\b\d{2,4}-\d{3,4}-\d{4}\b/g },
  {
    kind: 'measurement',
    pattern: /\b\d[\d,.]*\s?(?:km|m|meters|metres|miles|ha|hectares|floors?)\b/gi,
  },
  { kind: 'measurement', pattern: /\d[\d,.]*\s?(?:미터|킬로미터|층|분\s?거리)/g },
  { kind: 'year', pattern: /\b(?:1[0-9]{3}|20[0-9]{2})\s?(?:년|年)?\b/g },
  { kind: 'year', pattern: /\b\d{1,2}(?:st|nd|rd|th)\s+century\b/gi },
  { kind: 'year', pattern: /\d{1,2}\s?(?:세기|世紀|世纪)/g },
  { kind: 'percent', pattern: /\b\d[\d.]*\s?%/g },
  {
    kind: 'admission',
    pattern: /\b(?:free admission|free entry|admission fee|entrance fee|no entry fee)\b/gi,
  },
  { kind: 'admission', pattern: /(?:무료\s?입장|입장료|입장\s?무료|門票|入場料|入场料)/g },
  {
    kind: 'superlative',
    pattern:
      /\b(?:largest|biggest|oldest|longest|tallest|smallest|first|only|best|most\s+\w+)\b/gi,
  },
  { kind: 'superlative', pattern: /(?:가장|최대|최초|최고|유일|最大|最古|最高|唯一|一番)/g },
];

/** Lowercase + drop separators so "₩5,000" and "5000 won" compare sanely. */
export function normalizeClaim(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s,. ]/g, '')
    .replace(/[’']/g, '');
}

export interface DetectedClaim {
  kind: ClaimKind;
  text: string;
  normalized: string;
}

/** Any number written with two or more digits ("99", "5,000", "1889"). */
const NUMBER_TOKEN = /\d[\d,.]*/g;

/** The digit groups in a text, comma/period-stripped: "5,000 m" → ["5000"]. */
export function numberTokens(text: string): string[] {
  NUMBER_TOKEN.lastIndex = 0;
  return [...text.matchAll(NUMBER_TOKEN)]
    .map((match) => match[0].replace(/[,.]/g, ''))
    .filter((token) => token.length >= 2);
}

/**
 * Every hard claim token in a piece of text, de-duplicated by normalized form.
 *
 * `quantity` is the catch-all: a bare two-or-more-digit number in one or two
 * sentences of travel narration is essentially always a factual assertion
 * ("600 metres wide", "99 rocks", "5,000 years old"), and the shaped patterns
 * above only cover the ones that carry a unit.
 */
export function detectClaims(text: string): DetectedClaim[] {
  const found = new Map<string, DetectedClaim>();
  for (const { kind, pattern } of CLAIM_PATTERNS) {
    // Fresh lastIndex per call — the module-level regexes are /g.
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const raw = match[0].trim();
      if (!raw) continue;
      const normalized = normalizeClaim(raw);
      if (!normalized) continue;
      if (!found.has(normalized)) found.set(normalized, { kind, text: raw, normalized });
    }
  }
  for (const token of numberTokens(text)) {
    const key = `#${token}`;
    if (!found.has(key)) found.set(key, { kind: 'quantity', text: token, normalized: token });
  }
  return [...found.values()];
}

/**
 * Is one claim backed by the facts?
 *
 * Numbers are matched against the fact sheet's number-token set (exact), not
 * as substrings — otherwise a source that mentions 1990 would silently license
 * an invented "90 metres deep". Everything else is a phrase lookup.
 */
export function claimSupported(claim: DetectedClaim, sheet: PoiFactSheet): boolean {
  if (claim.kind === 'quantity') return sheet.numbers.has(claim.normalized);
  return sheet.haystack.includes(claim.normalized);
}

function pushFact(facts: PoiFact[], field: string, text: unknown, sourceId: string): void {
  if (typeof text !== 'string') return;
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length < 2) return;
  facts.push({ field, text: clean, sourceId });
}

function contentFacts(content: VideoLocalizedPoiContent, fallbackSourceId: string): PoiFact[] {
  const facts: PoiFact[] = [];
  const sourceId = content.sourceFactIds[0] ?? fallbackSourceId;
  pushFact(facts, 'name', content.name, sourceId);
  pushFact(facts, 'category', content.category, sourceId);
  pushFact(facts, 'description', content.description, sourceId);
  content.highlights.forEach((highlight, index) =>
    pushFact(facts, `highlights[${index}]`, highlight, sourceId),
  );
  for (const [group, record] of [
    ['visitBasics', content.visitBasics],
    ['convenience', content.convenience],
    ['smartNotes', content.smartNotes],
  ] as const) {
    for (const [key, value] of Object.entries(record ?? {})) {
      pushFact(facts, `${group}.${key}`, value, sourceId);
    }
  }
  return facts;
}

/**
 * The permitted-claim origin set for one POI in one language. English content
 * is appended as a secondary source because the localized files are
 * translations of the same facts — a number present in the English row is not
 * an invention when it reappears in the Japanese narration.
 */
export function buildFactSheet(
  source: VideoPoiSource,
  language: VideoLanguageCode,
): PoiFactSheet {
  const fallbackSourceId = source.sourcePaths[0] ?? `poi:${source.poiId}`;
  const primary = source.localized[language];
  const english = language === 'en' ? undefined : source.localized.en;

  const facts: PoiFact[] = [
    ...(primary ? contentFacts(primary, fallbackSourceId) : []),
    ...(english ? contentFacts(english, fallbackSourceId) : []),
  ];

  const joined = facts.map((fact) => fact.text).join(' ');
  return {
    poiId: source.poiId,
    language,
    name: primary?.name || source.canonicalName,
    facts,
    haystack: normalizeClaim(joined),
    numbers: new Set(numberTokens(joined)),
  };
}

/** True when every hard claim in `text` also occurs somewhere in the facts. */
export function claimsSupported(text: string, sheet: PoiFactSheet): boolean {
  return detectClaims(text).every((claim) => claimSupported(claim, sheet));
}

/** Sentence split that also terminates on CJK full stops. */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?](?=\s|$)|[。！？])/u)
    .map((part) => part.trim())
    .filter(Boolean);
}

export interface StripResult {
  text: string;
  /** Dropped sentences with the claim that was not backed by the facts. */
  removed: Array<{ sentence: string; claim: DetectedClaim }>;
}

/**
 * Drops every sentence carrying an unsupported hard claim.
 *
 * Sentence granularity is the point: blanking a whole scene because one clause
 * quoted an invented price throws away the supported half of the narration,
 * and rewriting the sentence would be inventing text of our own.
 */
export function stripUnsupportedClaims(text: string, sheet: PoiFactSheet): StripResult {
  const removed: StripResult['removed'] = [];
  const kept: string[] = [];
  for (const sentence of splitSentences(text)) {
    const offending = detectClaims(sentence).find((claim) => !claimSupported(claim, sheet));
    if (offending) removed.push({ sentence, claim: offending });
    else kept.push(sentence);
  }
  return { text: kept.join(' ').replace(/\s+/g, ' ').trim(), removed };
}
