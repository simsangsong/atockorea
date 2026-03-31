/**
 * Stage 3: Intent/example similarity matching (app-level Jaccard fallback).
 *
 * pgvector embeddings are deferred (not yet populated in request_intent_examples).
 * This stage uses token-level Jaccard similarity as a safe, deterministic fallback
 * that produces the same output for the same input (Rule 6: deterministic).
 *
 * Threshold: 0.25 Jaccard — below this, the example is not considered a match.
 * Confidence is capped at min(example.confidence, jaccard_score) so that weak
 * similarity never inflates confidence above what the example warrants.
 *
 * When pgvector embeddings are ready, this module can be swapped to use
 * cosine similarity without changing the stage interface.
 */
import { fetchActiveIntentExamples } from '@/lib/parser/repository';
import type { ParserStageResult, SlotMap, SlotValue } from '@/lib/parser/types';

const JACCARD_THRESHOLD = 0.25;

function tokenize(input: string): string[] {
  return input
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function jaccard(a: string[], b: string[]): number {
  const sa = new Set(a);
  const sb = new Set(b);
  const inter = [...sa].filter((x) => sb.has(x)).length;
  const union = new Set([...sa, ...sb]).size;
  return union === 0 ? 0 : inter / union;
}

export async function runSimilarityStage(
  rawText: string,
  locale = 'ko',
): Promise<ParserStageResult> {
  let examples: Awaited<ReturnType<typeof fetchActiveIntentExamples>>;
  try {
    examples = await fetchActiveIntentExamples(locale);
  } catch (err) {
    return {
      values: {},
      perSlotConfidence: {},
      perSlotSource: {},
      matchedExamples: [],
      unmatchedTerms: [],
      debug: {
        error: err instanceof Error ? err.message : String(err),
        exampleCount: 0,
      },
    };
  }

  const inputTokens = tokenize(rawText);

  const values: SlotMap = {};
  const perSlotConfidence: Record<string, number> = {};
  const perSlotSource: Record<string, string> = {};
  const matchedExamples: Array<string | number> = [];

  for (const ex of examples) {
    const exampleTokens = tokenize(String(ex.example_text ?? ''));
    const score = jaccard(inputTokens, exampleTokens);

    if (score < JACCARD_THRESHOLD) continue;

    const slotKey = String(ex.slot_key);
    // Confidence is capped at the similarity score — weak match never inflates confidence
    const confidence = Math.min(Number(ex.confidence ?? 0.75), score);

    if ((perSlotConfidence[slotKey] ?? -1) < confidence) {
      values[slotKey] = ex.slot_value as SlotValue;
      perSlotConfidence[slotKey] = confidence;
      perSlotSource[slotKey] = `example:${ex.id}`;
    }

    matchedExamples.push(ex.id);
  }

  return {
    values,
    perSlotConfidence,
    perSlotSource,
    matchedExamples,
    unmatchedTerms: [],
    debug: {
      exampleCount: examples.length,
      matchCount: matchedExamples.length,
      threshold: JACCARD_THRESHOLD,
    },
  };
}
