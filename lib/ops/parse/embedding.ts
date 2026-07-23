// Phase 0-ter — 1024-dim embedding for parse_observations.embedding
// Master plan §4.2 — vector(1024). Uses Voyage AI's voyage-3-lite (1024 dims).
//
// POLICY (Phase 27 / Sprint 27.D — §45.9): pgvector cosine-similarity
// CLUSTERING IS DOWNGRADED. Template mining runs on `template_hash` only
// (see learning.ts / mining.ts); embeddings are NOT consumed anywhere in the
// runtime path, and the `parse_observations_embed_idx` (hnsw) index is unused.
// This module is retained as a no-cost OPT-IN: provisioning VOYAGE_API_KEY
// re-populates the column for a future re-enable, but mining stays template-
// only until that work is explicitly re-scoped. Without the key, embedText()
// returns null and the row is inserted with embedding=NULL (the prod default:
// 0/123 embedded as of 2026-05-20).

const VOYAGE_MODEL = 'voyage-3-lite'
const VOYAGE_URL = 'https://api.voyageai.com/v1/embeddings'
const EXPECTED_DIM = 1024

export interface EmbeddingResult {
  vector: number[]
  model: string
}

/**
 * Embed a single text input. Returns null when no provider is configured
 * or on transient network failure. Callers should treat null as "skip this
 * embedding" rather than retry.
 */
export async function embedText(text: string): Promise<EmbeddingResult | null> {
  const key = process.env.VOYAGE_API_KEY?.trim()
  if (!key) return null
  if (!text || text.trim().length === 0) return null

  try {
    const res = await fetch(VOYAGE_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: VOYAGE_MODEL,
        input: [text.slice(0, 8000)],   // cap input length to avoid OOM
        input_type: 'document',
        output_dimension: EXPECTED_DIM,
      }),
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    const json = await res.json() as { data?: Array<{ embedding?: number[] }> }
    const vec = json.data?.[0]?.embedding
    if (!Array.isArray(vec) || vec.length !== EXPECTED_DIM) return null
    return { vector: vec, model: VOYAGE_MODEL }
  } catch {
    return null
  }
}

/** Batch embed — sequential to respect Voyage rate limits. */
export async function embedBatch(texts: string[]): Promise<Array<EmbeddingResult | null>> {
  const out: Array<EmbeddingResult | null> = []
  for (const t of texts) {
    out.push(await embedText(t))
  }
  return out
}

/** pgvector text format — `[0.1,0.2,...]`. */
export function toPgVector(vec: number[]): string {
  return `[${vec.join(',')}]`
}
