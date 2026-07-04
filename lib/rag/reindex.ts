/**
 * RAG index refresh core (W1.1) — shared by the CLI script
 * (`scripts/build-knowledge-index.ts`) and the daily Vercel cron
 * (`/api/cron/rag-reindex`), so the index can no longer silently go stale
 * (C-4: the 6/22 index kept recommending tours deactivated on 6/29).
 *
 * Incremental: each chunk carries content_hash = sha256(content). Only new or
 * changed chunks are re-embedded; rows that disappeared from source are
 * deleted — which is exactly how deactivated tours leave the index, because
 * `collectStaticKnowledgeRecords` only walks active consumer-visible tours
 * (`listStaticTourProducts` applies the consumer-surface blocklist).
 *
 * Approved Q&A (source_type='qa') is owned by the approval flow and untouched.
 */

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { collectStaticKnowledgeRecords, type KnowledgeRecord } from "@/lib/rag/sources";
import { embedTexts, toVectorLiteral } from "@/lib/rag/embed";

const MANAGED_SOURCE_TYPES = ["poi", "tour_product", "site", "policy"] as const;

export type ReindexSummary = {
  collected: number;
  upserted: number;
  deleted: number;
  unchanged: number;
  totalManaged: number | null;
  dryRun: boolean;
};

function keyOf(r: { source_type: string; source_id: string; locale: string; chunk_index: number }): string {
  return `${r.source_type} ${r.source_id} ${r.locale} ${r.chunk_index}`;
}

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export async function reindexKnowledge(
  sb: SupabaseClient,
  opts: { dryRun?: boolean; log?: (line: string) => void } = {},
): Promise<ReindexSummary> {
  const log = opts.log ?? (() => {});
  const dryRun = opts.dryRun === true;

  log("Collecting source records…");
  const records = collectStaticKnowledgeRecords();
  const byKey = new Map<string, KnowledgeRecord & { content_hash: string }>();
  for (const r of records) {
    if (!r.content?.trim()) continue;
    byKey.set(keyOf(r), { ...r, content_hash: hashContent(r.content) });
  }
  log(`  ${byKey.size} unique chunks across ${MANAGED_SOURCE_TYPES.join("/")}`);

  // Existing managed rows (hash only) for incremental diff.
  const existing = new Map<string, { id: number; content_hash: string }>();
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from("knowledge_chunks")
      .select("id, source_type, source_id, locale, chunk_index, content_hash")
      .in("source_type", MANAGED_SOURCE_TYPES as unknown as string[])
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`load existing: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const row of data) {
      existing.set(keyOf(row), { id: row.id as number, content_hash: row.content_hash as string });
    }
    if (data.length < PAGE) break;
  }
  log(`  ${existing.size} existing managed rows`);

  // Diff.
  const toUpsert: Array<KnowledgeRecord & { content_hash: string }> = [];
  for (const [key, rec] of byKey) {
    const prev = existing.get(key);
    if (!prev || prev.content_hash !== rec.content_hash) toUpsert.push(rec);
  }
  const toDeleteIds: number[] = [];
  for (const [key, row] of existing) {
    if (!byKey.has(key)) toDeleteIds.push(row.id);
  }

  const unchanged = byKey.size - toUpsert.length;
  log(`Plan: upsert ${toUpsert.length}, delete ${toDeleteIds.length}, unchanged ${unchanged}`);
  if (dryRun) {
    log("--dry-run: no embedding or writes.");
    return {
      collected: byKey.size,
      upserted: toUpsert.length,
      deleted: toDeleteIds.length,
      unchanged,
      totalManaged: null,
      dryRun: true,
    };
  }

  // Embed changed chunks.
  if (toUpsert.length > 0) {
    log(`Embedding ${toUpsert.length} chunks…`);
    const vectors = await embedTexts(toUpsert.map((r) => `${r.title ? r.title + "\n" : ""}${r.content}`));
    const rows = toUpsert.map((r, i) => ({
      source_type: r.source_type,
      source_id: r.source_id,
      chunk_index: r.chunk_index,
      locale: r.locale,
      title: r.title,
      content: r.content,
      url: r.url,
      tags: r.tags,
      metadata: r.metadata,
      content_hash: r.content_hash,
      embedding: toVectorLiteral(vectors[i]),
      is_active: true,
    }));

    const BATCH = 200;
    for (let i = 0; i < rows.length; i += BATCH) {
      const slice = rows.slice(i, i + BATCH);
      const { error } = await sb
        .from("knowledge_chunks")
        .upsert(slice, { onConflict: "source_type,source_id,locale,chunk_index" });
      if (error) throw new Error(`upsert batch @${i}: ${error.message}`);
      log(`  upserted ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
    }
  }

  // Delete stale rows (deactivated tours, removed content).
  if (toDeleteIds.length > 0) {
    const BATCH = 500;
    for (let i = 0; i < toDeleteIds.length; i += BATCH) {
      const slice = toDeleteIds.slice(i, i + BATCH);
      const { error } = await sb.from("knowledge_chunks").delete().in("id", slice);
      if (error) throw new Error(`delete batch @${i}: ${error.message}`);
    }
    log(`  deleted ${toDeleteIds.length} stale rows`);
  }

  const { count } = await sb
    .from("knowledge_chunks")
    .select("id", { count: "exact", head: true })
    .in("source_type", MANAGED_SOURCE_TYPES as unknown as string[]);
  log(`Done. Managed rows now: ${count}`);

  return {
    collected: byKey.size,
    upserted: toUpsert.length,
    deleted: toDeleteIds.length,
    unchanged,
    totalManaged: count ?? null,
    dryRun: false,
  };
}
