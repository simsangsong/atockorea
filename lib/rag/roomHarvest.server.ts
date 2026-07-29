/**
 * X20 — the DB half of the operations corpus.
 *
 * `roomHarvest.ts` holds the pure logic (pairing, redaction, de-identification)
 * and is fully tested without a database. This file is the thin part that reads
 * rooms and writes drafts, kept separate for exactly that reason: the privacy
 * property lives where it can be asserted cheaply, not behind a Supabase mock.
 *
 * Writes into `qa_pairs` alongside the existing chat harvest — same table, same
 * `review_status: 'draft'`, same admin review queue at /admin/qa-review. The
 * decision said to widen the flywheel rather than start a second one, and a
 * second corpus would be a second thing to keep in sync.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { sanitizeQaText, inferQaLocale, inferQaCategory, buildQaTags } from '@/lib/support/qa-learning';
import { roomQaCandidates, type RoomTurn } from '@/lib/rag/roomHarvest';

const SOURCE = 'room_message';

/** How far back to look. Rooms older than this have been mined already. */
const DEFAULT_LOOKBACK_DAYS = 30;

type MessageRow = {
  id: string;
  room_id: string;
  sender_role: string | null;
  source_text: string | null;
  source_locale: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

export interface RoomHarvestReport {
  roomsScanned: number;
  pairsFound: number;
  created: number;
  dupes: number;
  tooThin: number;
}

function toTurn(row: MessageRow): RoomTurn {
  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    roomId: row.room_id,
    senderRole: row.sender_role,
    text: row.source_text,
    locale: row.source_locale,
    createdAt: row.created_at,
    kind: typeof meta.kind === 'string' ? meta.kind : null,
    poiKey: typeof meta.poi_key === 'string' ? meta.poi_key : null,
  };
}

/**
 * Mine recent rooms for guest-question / staff-answer pairs.
 *
 * Deliberately does NOT call an LLM. The chat harvest asks Gemini whether a
 * pair is a generalisable FAQ, which is worth paying for on 2,338 marketing
 * chat messages. Here the signal is different: a guide answered a real guest in
 * a real place, so the pair is almost always operational by construction, and
 * the admin review queue is the judge that already exists. Spending a model
 * call per pair would buy a second opinion we do not need and a cost that grows
 * with the corpus we are trying to grow.
 */
export async function harvestRoomQaCandidates(
  sb: SupabaseClient,
  opts: { limit?: number; lookbackDays?: number; dryRun?: boolean; log?: (line: string) => void } = {},
): Promise<RoomHarvestReport> {
  const limit = opts.limit ?? 40;
  const log = opts.log ?? (() => {});
  const since = new Date(Date.now() - (opts.lookbackDays ?? DEFAULT_LOOKBACK_DAYS) * 86_400_000).toISOString();

  const report: RoomHarvestReport = { roomsScanned: 0, pairsFound: 0, created: 0, dupes: 0, tooThin: 0 };

  const { data, error } = await sb
    .from('tour_room_messages')
    .select('id, room_id, sender_role, source_text, source_locale, created_at, metadata')
    .gte('created_at', since)
    .order('created_at', { ascending: true })
    .limit(4000);
  if (error) {
    log(`[room-harvest] read failed: ${error.message}`);
    return report;
  }

  // Group by room. The pairing rule is per-room and order-sensitive: a staff
  // reply in room A is not an answer to a question in room B, and the query
  // above interleaves them.
  const byRoom = new Map<string, RoomTurn[]>();
  for (const row of (data as MessageRow[] | null) ?? []) {
    const turn = toTurn(row);
    const list = byRoom.get(turn.roomId);
    if (list) list.push(turn);
    else byRoom.set(turn.roomId, [turn]);
  }
  report.roomsScanned = byRoom.size;

  const candidates = [...byRoom.values()].flatMap((turns) => roomQaCandidates(turns));
  report.pairsFound = candidates.length;

  for (const c of candidates.slice(0, limit)) {
    const question = sanitizeQaText(c.question);
    const answer = sanitizeQaText(c.answer);
    if (question.length < 6 || answer.length < 12) {
      report.tooThin += 1;
      continue;
    }

    // Same dedupe as the chat harvest: exact question text. Collapsing two
    // guests who genuinely asked the same thing is the desired behaviour for a
    // Q&A corpus, not a loss.
    const { data: dup } = await sb.from('qa_pairs').select('id').eq('question', question).maybeSingle();
    if (dup?.id) {
      report.dupes += 1;
      continue;
    }

    const category = inferQaCategory(question, answer);
    const tags = [
      ...buildQaTags({ category, tourSlug: null, source: SOURCE }),
      ...c.tags,
      `hour:${c.hourOfDay ?? 'unknown'}`,
      `fp:${c.fingerprint}`,
    ];

    if (opts.dryRun) {
      log(`  [draft] (${category}) ${question.slice(0, 70)}`);
      report.created += 1;
      continue;
    }

    const { error: insertError } = await sb.from('qa_pairs').insert({
      source: SOURCE,
      // bigint column; room message ids are uuids, so it stays null and the
      // question-text dedupe above does the work.
      source_message_id: null,
      question,
      answer,
      question_locale: inferQaLocale(question, c.questionLocale),
      answer_locale: inferQaLocale(answer, c.answerLocale),
      category,
      tour_slug: null,
      tags,
      review_status: 'draft',
      is_active: false,
    });
    if (insertError) {
      log(`  insert error: ${insertError.message}`);
      continue;
    }
    report.created += 1;
  }

  log(
    `[room-harvest] rooms=${report.roomsScanned} pairs=${report.pairsFound} created=${report.created} dupes=${report.dupes} thin=${report.tooThin}`,
  );
  return report;
}
