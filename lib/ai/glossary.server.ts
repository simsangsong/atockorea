/**
 * P1-8 — proper-noun glossary: the loader.
 *
 * The seed data is the POI knowledge base itself (`match_pois`), which already
 * holds confirmed ko/en/zh/zh-TW/ja/es names — 甘川文化村 is sitting in there
 * correctly while the translator was inventing 甘泉文化村. So there is no new
 * source of truth to maintain: fix a name in the KB and every caption, chat
 * message and itinerary line follows.
 *
 * Split from glossary.ts (pure) for the same reason as facilityPins/.server and
 * usage/.server in this repo: client bundles must not pull in a DB client.
 */

import { createServerClient } from '@/lib/supabase';
import type { GlossaryEntry } from '@/lib/ai/glossary';

/** Names shorter than this are too collision-prone to force (e.g. 산, BIFF). */
const MIN_SURFACE_LENGTH = 2;

const CACHE_TTL_MS = 10 * 60 * 1000;

let cache: { entries: GlossaryEntry[]; loadedAt: number } | null = null;

interface MatchPoiRow {
  poi_key?: string | null;
  name_en?: string | null;
  name_ko?: string | null;
  names_other_locales?: Record<string, unknown> | null;
}

export function rowsToGlossaryEntries(rows: MatchPoiRow[]): GlossaryEntry[] {
  const entries: GlossaryEntry[] = [];
  for (const row of rows) {
    if (!row.poi_key) continue;
    const names: Record<string, string> = {};

    for (const [locale, value] of Object.entries(row.names_other_locales ?? {})) {
      if (typeof value === 'string' && value.trim().length >= MIN_SURFACE_LENGTH) {
        names[locale] = value.trim();
      }
    }
    if (row.name_en && row.name_en.trim().length >= MIN_SURFACE_LENGTH) names.en = row.name_en.trim();
    if (row.name_ko && row.name_ko.trim().length >= MIN_SURFACE_LENGTH) names.ko = row.name_ko.trim();

    // A single name is still worth masking — it pins that one rendering.
    if (Object.keys(names).length > 0) entries.push({ key: row.poi_key, names });
  }
  return entries;
}

/**
 * Load (and cache) the glossary. Any failure returns an empty glossary: a
 * translation without forced proper nouns is degraded, but a translation that
 * throws because the KB was briefly unreachable is an outage.
 */
export async function loadGlossary(now: number = Date.now()): Promise<GlossaryEntry[]> {
  if (cache && now - cache.loadedAt < CACHE_TTL_MS) return cache.entries;
  try {
    const supabase = createServerClient();
    const { data } = await supabase
      .from('match_pois')
      .select('poi_key, name_en, name_ko, names_other_locales');
    const entries = rowsToGlossaryEntries((data ?? []) as MatchPoiRow[]);
    cache = { entries, loadedAt: now };
    return entries;
  } catch {
    cache = { entries: [], loadedAt: now };
    return [];
  }
}

/** Test hook. */
export function __resetGlossaryCacheForTests(): void {
  cache = null;
}

/**
 * §P1-8 — proper nouns the glossary does not cover yet. Logged rather than
 * stored: a new table would need its own retention story, and the point is to
 * notice gaps, not to build a second knowledge base.
 */
export function logUnknownProperNouns(terms: string[], context?: string): void {
  if (terms.length === 0) return;
  console.log(`[glossary] uncovered proper nouns${context ? ` (${context})` : ''}:`, terms.join(', '));
}
