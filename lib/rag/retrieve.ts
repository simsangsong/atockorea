/**
 * Hybrid retrieval over knowledge_chunks for the chatbot.
 *
 * Vector search (semantic) + trigram keyword search (lexical), fused with
 * Reciprocal Rank Fusion (RRF). Same-locale and "all" chunks are preferred.
 *
 * Designed to degrade gracefully: any failure (no OpenAI key, RPC error)
 * throws, and the caller falls back to the legacy keyword builders.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { embedQuery, toVectorLiteral } from "@/lib/rag/embed";
import type { KnowledgeSourceType } from "@/lib/rag/sources";

export type RetrievedChunk = {
  id: number;
  source_type: KnowledgeSourceType;
  source_id: string;
  locale: string;
  title: string | null;
  content: string;
  url: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
  similarity: number | null;
  score: number;
};

type MatchRow = {
  id: number;
  source_type: KnowledgeSourceType;
  source_id: string;
  locale: string;
  title: string | null;
  content: string;
  url: string | null;
  tags: string[] | null;
  metadata: Record<string, unknown> | null;
  similarity?: number;
  score?: number;
};

export type RetrieveOptions = {
  query: string;
  locale?: string;
  sourceTypes?: KnowledgeSourceType[];
  limit?: number;
  /** How many candidates each retriever pulls before fusion. */
  candidatePool?: number;
  /** Discard vector hits below this cosine similarity. */
  minSimilarity?: number;
};

const RRF_K = 60;
const LOCALE_BONUS = 0.15; // additive RRF bonus for same-locale / universal chunks

function normalizeRow(row: MatchRow): Omit<RetrievedChunk, "score"> {
  return {
    id: row.id,
    source_type: row.source_type,
    source_id: row.source_id,
    locale: row.locale,
    title: row.title,
    content: row.content,
    url: row.url,
    tags: row.tags ?? [],
    metadata: row.metadata ?? {},
    similarity: typeof row.similarity === "number" ? row.similarity : null,
  };
}

/**
 * Retrieve the most relevant knowledge chunks for a query.
 * Throws on hard failure so the caller can fall back to keyword builders.
 */
export async function retrieveKnowledge(
  sb: SupabaseClient,
  opts: RetrieveOptions,
): Promise<RetrievedChunk[]> {
  const query = opts.query.trim();
  if (!query) return [];
  const limit = opts.limit ?? 8;
  const pool = opts.candidatePool ?? Math.max(24, limit * 3);
  const minSimilarity = opts.minSimilarity ?? 0.18;
  const sourceTypes = opts.sourceTypes ?? null;

  const embedding = await embedQuery(query);

  const [vectorRes, keywordRes] = await Promise.all([
    sb.rpc("match_knowledge_chunks", {
      query_embedding: toVectorLiteral(embedding),
      p_locale: null, // locale preference handled in fusion (poi/policy are "all")
      p_source_types: sourceTypes,
      match_count: pool,
      min_similarity: minSimilarity,
    }),
    sb.rpc("keyword_knowledge_chunks", {
      q: query,
      p_source_types: sourceTypes,
      match_count: pool,
    }),
  ]);

  if (vectorRes.error) throw new Error(`match_knowledge_chunks: ${vectorRes.error.message}`);
  // Keyword is best-effort; a failure there shouldn't sink the whole retrieval.
  const vectorRows = (vectorRes.data ?? []) as MatchRow[];
  const keywordRows = keywordRes.error ? [] : ((keywordRes.data ?? []) as MatchRow[]);

  const fused = new Map<number, RetrievedChunk>();
  const bump = (row: MatchRow, rank: number) => {
    const existing = fused.get(row.id);
    const rrf = 1 / (RRF_K + rank);
    if (existing) {
      existing.score += rrf;
      return;
    }
    const base = normalizeRow(row);
    const localeMatch = opts.locale && (base.locale === opts.locale || base.locale === "all");
    fused.set(row.id, {
      ...base,
      score: rrf + (localeMatch ? LOCALE_BONUS / RRF_K : 0),
    });
  };

  vectorRows.forEach((row, i) => bump(row, i));
  keywordRows.forEach((row, i) => bump(row, i));

  return Array.from(fused.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Format retrieved chunks into a context block with source citations. */
export function buildRagContextText(
  chunks: RetrievedChunk[],
  { maxChars = 8000 }: { maxChars?: number } = {},
): string {
  const blocks: string[] = [];
  let used = 0;
  for (const chunk of chunks) {
    const cite = chunk.url ? `Source: ${chunk.url}` : `Source: ${chunk.source_type}`;
    const body = chunk.content.length > 1200 ? `${chunk.content.slice(0, 1199).trim()}…` : chunk.content;
    const block = [`### ${chunk.title ?? chunk.source_id}`, cite, body].join("\n");
    // rag-05 (pressure-test): skip an over-budget chunk instead of `break` —
    // breaking on the first overflow dropped ALL remaining (often smaller,
    // still-relevant) chunks. Continue so the budget gets filled.
    if (used + block.length > maxChars) continue;
    blocks.push(block);
    used += block.length;
  }
  return blocks.join("\n\n");
}
