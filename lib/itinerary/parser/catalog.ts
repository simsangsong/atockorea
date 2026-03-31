/**
 * Catalog loader — fetches active phrase rules and synonym groups from DB
 * via the SQL helper RPCs created in 20250330130000_itinerary_parser_sql_helpers.sql.
 *
 * Uses createServerClient() from @/lib/supabase (repo pattern: service-role key,
 * no cookie-based auth needed for internal server-side reads).
 *
 * Errors are surfaced explicitly (not swallowed) so the caller can decide
 * whether to fall back to empty rules or abort.
 */
import { createServerClient } from '@/lib/supabase';

export type PhraseRuleRow = {
  id: number;
  locale: string;
  pattern: string;
  match_type: 'exact' | 'contains' | 'regex';
  intent_key: string;
  slot_key: string;
  slot_value: unknown;
  confidence: number;
  priority: number;
};

export type SynonymGroupRow = {
  id: number;
  locale: string;
  group_key: string;
  intent_key: string;
  slot_key: string;
  canonical_phrase: string | null;
  phrases: string[];
  slot_value: unknown;
  confidence: number;
};

export type IntentExampleRow = {
  id: number;
  locale: string;
  intent_key: string;
  example_text: string;
  slot_key: string;
  slot_value: unknown;
  confidence: number;
  notes: string | null;
};

/**
 * Load active phrase rules for the given locale.
 * Returns [] when the table is empty (bootstrap not yet run).
 * Throws on DB/network errors so the caller can surface them.
 */
export async function loadPhraseRules(locale: string): Promise<PhraseRuleRow[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase.rpc('get_active_phrase_rules', {
    p_locale: locale,
  });

  if (error) {
    throw new Error(`[parser/catalog] get_active_phrase_rules failed: ${error.message}`);
  }

  return (data ?? []) as PhraseRuleRow[];
}

/**
 * Load active synonym groups for the given locale.
 * Returns [] when the table is empty.
 * Throws on DB/network errors.
 */
export async function loadSynonymGroups(locale: string): Promise<SynonymGroupRow[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase.rpc('get_active_synonym_groups', {
    p_locale: locale,
  });

  if (error) {
    throw new Error(`[parser/catalog] get_active_synonym_groups failed: ${error.message}`);
  }

  return (data ?? []) as SynonymGroupRow[];
}

/**
 * Load intent examples for the given locale.
 * Used for future similarity-based matching (pgvector deferred).
 * Returns [] when the table is empty.
 * Throws on DB/network errors.
 */
export async function loadIntentExamples(locale: string): Promise<IntentExampleRow[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase.rpc('get_active_intent_examples', {
    p_locale: locale,
  });

  if (error) {
    throw new Error(`[parser/catalog] get_active_intent_examples failed: ${error.message}`);
  }

  return (data ?? []) as IntentExampleRow[];
}
