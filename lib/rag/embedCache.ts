/**
 * Query-embedding cache (W3.2) — every chat turn used to pay a full OpenAI
 * embeddings round-trip (~200–500ms) before RAG retrieval, even for repeated
 * questions (quick chips, retries, common FAQ). Two layers:
 *
 *   1. Per-instance in-memory LRU — free and instant.
 *   2. Upstash REST (when configured) — survives across serverless instances
 *      and deploys. A ~30KB JSON vector per entry with a 24h TTL.
 *
 * Both layers are best-effort: any failure falls through to a fresh
 * embedding call. Never throws.
 */

import { createHash } from "node:crypto";

const MEM_MAX_ENTRIES = 200;
const TTL_SECONDS = 60 * 60 * 24;

/** Insertion-ordered Map as LRU: delete+set moves a key to the tail. */
const mem = new Map<string, number[]>();

export function embedCacheKey(preparedText: string): string {
  return `embq:${createHash("sha256").update(preparedText).digest("hex").slice(0, 40)}`;
}

function upstashConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function upstashCommand(command: (string | number)[]): Promise<unknown> {
  const url = process.env.UPSTASH_REDIS_REST_URL!.replace(/\/$/, "");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  const json = (await res.json()) as { result?: unknown };
  return json.result;
}

export async function getCachedQueryEmbedding(preparedText: string): Promise<number[] | null> {
  const key = embedCacheKey(preparedText);
  const local = mem.get(key);
  if (local) {
    mem.delete(key);
    mem.set(key, local); // refresh LRU position
    return local;
  }
  if (!upstashConfigured()) return null;
  try {
    const raw = await upstashCommand(["GET", key]);
    if (typeof raw !== "string") return null;
    const vec = JSON.parse(raw) as unknown;
    if (!Array.isArray(vec) || vec.length === 0 || typeof vec[0] !== "number") return null;
    rememberLocally(key, vec as number[]);
    return vec as number[];
  } catch {
    return null;
  }
}

function rememberLocally(key: string, vec: number[]): void {
  mem.delete(key);
  mem.set(key, vec);
  while (mem.size > MEM_MAX_ENTRIES) {
    const oldest = mem.keys().next().value;
    if (oldest === undefined) break;
    mem.delete(oldest);
  }
}

export function setCachedQueryEmbedding(preparedText: string, vec: number[]): void {
  const key = embedCacheKey(preparedText);
  rememberLocally(key, vec);
  if (!upstashConfigured()) return;
  // Fire-and-forget: the durable write must never delay the chat turn.
  void upstashCommand(["SET", key, JSON.stringify(vec), "EX", TTL_SECONDS]).catch(() => {});
}

/** Test helper. */
export function __resetEmbedCache(): void {
  mem.clear();
}
