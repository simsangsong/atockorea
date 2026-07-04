/**
 * OpenAI embedding client for chatbot RAG.
 *
 * Uses text-embedding-3-small (1536 dims) to match the existing
 * `embedding vector(1536)` columns. No SDK dependency — plain fetch,
 * same pattern as lib/openai-server.ts.
 */

import { getCachedQueryEmbedding, setCachedQueryEmbedding } from "@/lib/rag/embedCache";

const OPENAI_API_BASE = "https://api.openai.com/v1";

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMS = 1536;

/** OpenAI accepts large batches; keep it conservative for token/payload limits. */
const MAX_BATCH = 96;
/** text-embedding-3-small max ~8191 tokens; clamp by chars defensively. */
const MAX_CHARS = 8000;

function getKey(): string {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY is not configured");
  return key;
}

function prepareInput(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_CHARS);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type EmbeddingResponse = {
  data?: Array<{ embedding: number[]; index: number }>;
  error?: { message?: string };
};

async function embedBatch(inputs: string[], attempt = 0): Promise<number[][]> {
  const res = await fetch(`${OPENAI_API_BASE}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: inputs }),
  });

  if (res.status === 429 || res.status >= 500) {
    if (attempt >= 5) {
      throw new Error(`OpenAI embeddings failed after retries: ${res.status} ${await res.text()}`);
    }
    await sleep(Math.min(500 * 2 ** attempt, 8000));
    return embedBatch(inputs, attempt + 1);
  }
  if (!res.ok) {
    throw new Error(`OpenAI embeddings failed: ${res.status} ${await res.text()}`);
  }

  const json = (await res.json()) as EmbeddingResponse;
  const data = json.data;
  if (!data || data.length !== inputs.length) {
    throw new Error("OpenAI embeddings returned unexpected shape");
  }
  // Preserve request order.
  return [...data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

/** Embed many texts, batched. Returns vectors in the same order as `texts`. */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += MAX_BATCH) {
    const batch = texts.slice(i, i + MAX_BATCH).map(prepareInput);
    out.push(...(await embedBatch(batch)));
  }
  return out;
}

/** Embed a single query string — cached (W3.2): repeated questions (quick
 *  chips, retries, common FAQ) skip the OpenAI round-trip entirely. */
export async function embedQuery(text: string): Promise<number[]> {
  const prepared = prepareInput(text);
  const cached = await getCachedQueryEmbedding(prepared);
  if (cached) return cached;
  const [vec] = await embedTexts([prepared]);
  setCachedQueryEmbedding(prepared, vec);
  return vec;
}

/** pgvector text literal: `[0.1,0.2,...]`. Safe to send through PostgREST. */
export function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`;
}
