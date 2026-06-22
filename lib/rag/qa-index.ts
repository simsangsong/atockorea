/**
 * Keep approved Q&A pairs in sync with the RAG index (knowledge_chunks).
 *
 * Closes the learning loop: when an admin approves a Q&A pair it is embedded
 * and becomes immediately retrievable; when it is rejected / deactivated it is
 * removed. Failures are non-fatal to the caller (log + continue).
 */

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { embedTexts, toVectorLiteral } from "@/lib/rag/embed";

type QaRow = {
  id: number;
  question: string;
  answer: string;
  question_locale: string | null;
  answer_locale: string | null;
  category: string | null;
  tour_slug: string | null;
  tags: string[] | null;
  review_status: string;
  is_active: boolean;
};

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

/** Remove a Q&A pair from the RAG index. */
export async function removeQaFromIndex(sb: SupabaseClient, qaId: number): Promise<void> {
  await sb.from("knowledge_chunks").delete().eq("source_type", "qa").eq("source_id", String(qaId));
}

/**
 * Upsert an approved+active Q&A pair into the RAG index. If the pair is no
 * longer approved/active, it is removed instead.
 */
export async function syncQaPairToIndex(sb: SupabaseClient, qaId: number): Promise<"indexed" | "removed"> {
  const { data, error } = await sb
    .from("qa_pairs")
    .select(
      "id, question, answer, question_locale, answer_locale, category, tour_slug, tags, review_status, is_active",
    )
    .eq("id", qaId)
    .maybeSingle();
  if (error) throw new Error(`load qa_pair: ${error.message}`);
  const qa = data as QaRow | null;

  if (!qa || !qa.is_active || qa.review_status !== "approved") {
    await removeQaFromIndex(sb, qaId);
    return "removed";
  }

  const content = `Q: ${qa.question}\nA: ${qa.answer}`;
  const locale = qa.answer_locale || qa.question_locale || "all";
  const [embedding] = await embedTexts([content]);

  const { error: upsertError } = await sb.from("knowledge_chunks").upsert(
    {
      source_type: "qa",
      source_id: String(qa.id),
      chunk_index: 0,
      locale,
      title: qa.question.slice(0, 180),
      content,
      url: qa.tour_slug ? `/tour-product/${qa.tour_slug}` : null,
      tags: ["qa", qa.category, qa.tour_slug ? `tour:${qa.tour_slug}` : null].filter(Boolean) as string[],
      metadata: { category: qa.category, tour_slug: qa.tour_slug, source: "approved_qa" },
      content_hash: hashContent(content),
      embedding: toVectorLiteral(embedding),
      is_active: true,
    },
    { onConflict: "source_type,source_id,locale,chunk_index" },
  );
  if (upsertError) throw new Error(`upsert qa chunk: ${upsertError.message}`);
  return "indexed";
}
