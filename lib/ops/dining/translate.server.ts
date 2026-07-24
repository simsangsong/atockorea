/**
 * One-shot enrichment: 10-locale names + verbatim signature menus (spec K2/K3).
 *
 * Runs ONCE per place, at collection time, and the result is stored forever —
 * that is the whole economic argument for the cell cache. A cache HIT does zero
 * LLM work, zero Kakao work, zero Google work.
 *
 * K2 deviation from the plan, recorded here because it is load-bearing: the
 * plan said "Claude Haiku + prompt caching", but `lib/ai/router.ts` has no
 * anthropic provider — the `batch` ladder (deepseek → gemini → openai) already
 * does batch generation and already shares the daily budget counter. The
 * requirement's substance (cheap, once, cached forever) is met without adding a
 * provider.
 *
 * K3 hard rule: signature menus must be dish names a reviewer LITERALLY wrote.
 * Neither API exposes a menu, and inventing "the pork belly is famous" would be
 * a fabricated recommendation. So the flow is generate → LLM critic → a final
 * DETERMINISTIC verbatim check against the same review text. The last gate is
 * the one that actually guarantees the property; the critic just gets the easy
 * cases out first.
 *
 * Never throws, never blocks: budget exhausted, provider outage, or unparseable
 * JSON all return the rows untouched (Korean name only). A card with untranslated
 * names is a fine outcome; a failed arrival hook is not.
 */

import { chatCompletion } from '@/lib/ai/router';
import { durableIncrWindow } from '@/lib/durable-rate-limit';
import type { SignatureMenu } from '@/lib/ops/dining/places';

/**
 * The 10 site locales — same list as `SUPPORTED_LOCALES` in `middleware.ts`
 * (en, ko, zh-CN, zh-TW, ja, es, fr, de, it, ru), hardcoded here because
 * middleware.ts is edge-runtime code we must not pull into a node/server lib.
 * ⚠ Keep in sync if middleware's list ever changes.
 */
export const DINING_LOCALES = ['en', 'ko', 'zh-CN', 'zh-TW', 'ja', 'es', 'fr', 'de', 'it', 'ru'] as const;
export type DiningLocale = (typeof DINING_LOCALES)[number];

/** Places per LLM call — big enough to amortise, small enough to stay parseable. */
export const TRANSLATE_BATCH_SIZE = 12;

export interface TranslatablePlace {
  place_key: string;
  name: string;
  category_name?: string | null;
  cuisine?: string | null;
  /** Bundle from merge.server.extractSignatureMenus — the ONLY menu source. */
  review_text?: string;
  name_i18n?: Record<string, string> | null;
  signature_menus?: SignatureMenu[] | null;
}

export interface EnrichedFields {
  name_i18n: Record<string, string> | null;
  signature_menus: SignatureMenu[];
}

// ---------------------------------------------------------------------------
// Prompts + JSON hygiene (pure, exported for tests)
// ---------------------------------------------------------------------------

export function buildTranslationPrompt(input: {
  places: TranslatablePlace[];
  locales: readonly string[];
}): { system: string; user: string } {
  const system = [
    'You localize Korean restaurant names for a travel app and extract dish names from reviews. Output STRICT JSON only, no markdown fences, no commentary.',
    'Schema: { "<place_key>": { "name_i18n": { "<locale>": string }, "signature_menus": string[] } }',
    'name_i18n: a natural rendering of the KOREAN business name in each requested locale. Latin-script locales use a readable romanization or the established English name; CJK locales may use the local script. Never invent a different business, never append the city, never add words like "Restaurant" that are not in the original.',
    'HARD RULE for signature_menus: list ONLY dish names that appear LITERALLY in the REVIEWS text for that place, copied verbatim (at most 3, ordered by how often they are mentioned). If the reviews name no dish, or there are no reviews, return an EMPTY ARRAY. Never guess a dish from the restaurant category or name. An empty array is always an acceptable answer.',
    'Return one entry for every place_key given, and no other keys.',
  ].join('\n');

  const user = [
    `Locales: ${input.locales.join(', ')}`,
    'PLACES:',
    ...input.places.map((place) =>
      JSON.stringify({
        place_key: place.place_key,
        korean_name: place.name,
        category: place.category_name ?? place.cuisine ?? null,
        reviews: place.review_text ? place.review_text.slice(0, 1600) : '',
      }),
    ),
  ].join('\n');

  return { system, user };
}

export function buildMenuCriticPrompt(input: {
  places: Array<{ place_key: string; review_text: string; menus: string[] }>;
}): { system: string; user: string } {
  const system = [
    'You are a fact-check filter for extracted dish names. Output STRICT JSON only, no markdown fences.',
    'Schema: { "<place_key>": string[] }',
    'For each place, KEEP a dish name only if that exact string appears in the place\'s REVIEWS text. Delete everything else, including plausible-sounding dishes. Do not add anything. Do not rewrite the kept strings. An empty array is the correct answer when nothing survives.',
  ].join('\n');

  const user = input.places
    .map((place) =>
      JSON.stringify({ place_key: place.place_key, menus: place.menus, reviews: place.review_text.slice(0, 1600) }),
    )
    .join('\n');

  return { system, user };
}

function stripFences(raw: string): string {
  let text = String(raw ?? '').trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return '';
  return text.slice(start, end + 1);
}

function cleanMenuList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'string') continue;
    const name = entry.trim().slice(0, 60);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
    if (out.length >= 3) break;
  }
  return out;
}

/**
 * Parse the generation response. Unknown place_keys and unknown locales are
 * dropped; a malformed payload returns null so the caller keeps the raw rows.
 */
export function parseTranslationJson(
  raw: string,
  allowedKeys: readonly string[],
  locales: readonly string[] = DINING_LOCALES,
): Record<string, { name_i18n: Record<string, string>; signature_menus: string[] }> | null {
  const sliced = stripFences(raw);
  if (!sliced) return null;
  const allowed = new Set(allowedKeys);
  const localeSet = new Set(locales);
  try {
    const parsed = JSON.parse(sliced) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

    const out: Record<string, { name_i18n: Record<string, string>; signature_menus: string[] }> = {};
    for (const [placeKey, value] of Object.entries(parsed)) {
      if (!allowed.has(placeKey)) continue;
      if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
      const entry = value as { name_i18n?: unknown; signature_menus?: unknown };

      const names: Record<string, string> = {};
      if (entry.name_i18n && typeof entry.name_i18n === 'object' && !Array.isArray(entry.name_i18n)) {
        for (const [locale, name] of Object.entries(entry.name_i18n as Record<string, unknown>)) {
          if (!localeSet.has(locale)) continue;
          if (typeof name !== 'string' || !name.trim()) continue;
          names[locale] = name.trim().slice(0, 120);
        }
      }

      out[placeKey] = { name_i18n: names, signature_menus: cleanMenuList(entry.signature_menus) };
    }
    return Object.keys(out).length > 0 ? out : null;
  } catch {
    return null;
  }
}

/** Parse the critic response (`{ place_key: string[] }`). */
export function parseCriticJson(raw: string, allowedKeys: readonly string[]): Record<string, string[]> | null {
  const sliced = stripFences(raw);
  if (!sliced) return null;
  const allowed = new Set(allowedKeys);
  try {
    const parsed = JSON.parse(sliced) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const out: Record<string, string[]> = {};
    for (const [placeKey, value] of Object.entries(parsed)) {
      if (!allowed.has(placeKey)) continue;
      out[placeKey] = cleanMenuList(value);
    }
    return out;
  } catch {
    return null;
  }
}

/**
 * 🔴 The gate that actually enforces K3. Keeps a dish only when the string is
 * present in the review text (case-insensitive, whitespace-normalized).
 *
 * Deterministic and LLM-independent on purpose: the critic call can be skipped
 * (budget), fail (outage), or itself hallucinate, and none of those may let an
 * invented dish reach a guest. With no review text, nothing survives.
 */
export function filterMenusToReviewText(menus: readonly string[], reviewText: string | null | undefined): string[] {
  const haystack = String(reviewText ?? '').toLowerCase().replace(/\s+/g, ' ');
  if (!haystack) return [];
  const out: string[] = [];
  for (const menu of menus) {
    if (typeof menu !== 'string') continue;
    const needle = menu.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!needle) continue;
    if (haystack.includes(needle)) out.push(menu.trim());
  }
  return out;
}

// ---------------------------------------------------------------------------
// Budget
// ---------------------------------------------------------------------------

/**
 * Rides the SHARED concierge daily counter — same key and same cap as
 * generatedContent.ts, so dining enrichment can never starve the guest-facing
 * concierge by spending a separate budget nobody is watching.
 */
export async function translationBudgetExhausted(calls: number): Promise<boolean> {
  const cap = Number(process.env.TOUR_ROOM_CONCIERGE_DAILY_CAP ?? 300);
  if (!Number.isFinite(cap) || cap <= 0) return false;
  try {
    let count = 0;
    for (let i = 0; i < calls; i += 1) {
      count = await durableIncrWindow('tour_room_concierge:daily_llm', 24 * 60 * 60);
    }
    return count > cap;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export interface TranslateOptions {
  locales?: readonly string[];
  batchSize?: number;
}

/**
 * Enrich a batch of freshly merged rows in place (returns new objects).
 *
 * Contract for callers: the returned array ALWAYS has the same length and the
 * same order as the input. On any failure the rows come back with their
 * original `name_i18n` (usually null) and an empty `signature_menus` — the card
 * then renders the Korean name alone, which is correct, just less pretty.
 */
export async function translateAndEnrichPlaces<T extends TranslatablePlace>(
  rows: T[],
  options: TranslateOptions = {},
): Promise<T[]> {
  const list = Array.isArray(rows) ? rows.filter(Boolean) : [];
  if (list.length === 0) return [];

  const locales = options.locales ?? DINING_LOCALES;
  const batchSize = Math.max(1, options.batchSize ?? TRANSLATE_BATCH_SIZE);
  const batches = chunk(list, batchSize);

  // 2 calls per batch (generation + critic) against the shared counter.
  if (await translationBudgetExhausted(batches.length * 2)) {
    return list.map((row) => ({ ...row, signature_menus: row.signature_menus ?? [] }));
  }

  const enriched = new Map<string, EnrichedFields>();

  for (const batch of batches) {
    const keys = batch.map((row) => row.place_key);
    let draft: Record<string, { name_i18n: Record<string, string>; signature_menus: string[] }> | null = null;

    try {
      const prompt = buildTranslationPrompt({ places: batch, locales });
      const completion = await chatCompletion(
        'batch',
        [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ],
        { maxOutputTokens: 2200, temperature: 0.2 },
      );
      draft = parseTranslationJson(completion.content, keys, locales);
    } catch (error) {
      console.warn('[ops-dining] translation batch failed:', error);
      draft = null;
    }
    if (!draft) continue;

    // Critic pass — only for the places that actually proposed a menu.
    const criticInput = batch
      .filter((row) => (draft?.[row.place_key]?.signature_menus.length ?? 0) > 0)
      .map((row) => ({
        place_key: row.place_key,
        review_text: row.review_text ?? '',
        menus: draft?.[row.place_key]?.signature_menus ?? [],
      }));

    let criticed: Record<string, string[]> | null = null;
    if (criticInput.length > 0) {
      try {
        const prompt = buildMenuCriticPrompt({ places: criticInput });
        const completion = await chatCompletion(
          'batch',
          [
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.user },
          ],
          { maxOutputTokens: 900, temperature: 0 },
        );
        criticed = parseCriticJson(completion.content, criticInput.map((p) => p.place_key));
      } catch {
        criticed = null; // the deterministic gate below still holds
      }
    }

    for (const row of batch) {
      const entry = draft[row.place_key];
      if (!entry) continue;
      const proposed = criticed?.[row.place_key] ?? entry.signature_menus;
      // 🔴 Final, non-negotiable verbatim gate (K3).
      const verified = filterMenusToReviewText(proposed, row.review_text);
      enriched.set(row.place_key, {
        name_i18n: Object.keys(entry.name_i18n).length > 0 ? entry.name_i18n : null,
        signature_menus: verified.map((name) => ({ name })),
      });
    }
  }

  return list.map((row) => {
    const fields = enriched.get(row.place_key);
    if (!fields) return { ...row, signature_menus: row.signature_menus ?? [] };
    return { ...row, name_i18n: fields.name_i18n, signature_menus: fields.signature_menus };
  });
}
