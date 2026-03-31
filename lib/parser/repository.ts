/**
 * Repository layer for the 4-stage parser.
 *
 * Re-exports the catalog loaders from lib/itinerary/parser/catalog.ts
 * under the names expected by the stage modules, so we don't duplicate
 * the DB query logic that already exists and is tested.
 *
 * All three loaders return [] when the table is empty (bootstrap not yet run)
 * and throw on DB/network errors so the caller can decide on fallback.
 */
export {
  loadPhraseRules as fetchActivePhraseRules,
  loadSynonymGroups as fetchActiveSynonymGroups,
  loadIntentExamples as fetchActiveIntentExamples,
} from '@/lib/itinerary/parser/catalog';

export type {
  PhraseRuleRow,
  SynonymGroupRow,
  IntentExampleRow,
} from '@/lib/itinerary/parser/catalog';
