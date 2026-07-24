/**
 * §5.4 C-17 — `ops_briefing_card_sets` reads/writes.
 *
 * Kept out of lib/ops/seating/cards/cardSet.ts (which the admin editor and the
 * card components import) so no Supabase code reaches the client bundle — the
 * facilityPins.ts / facilityPins.server.ts split. Pure helpers are re-exported
 * from here so a server caller only needs one import.
 *
 * 🔴 Fail-open, always. The migration ships as a file and is applied by a human
 * later, so this module must work on a database that has no such table: every
 * read degrades to "no config" (→ the code default stack) and reports
 * `migrationPending` so the editor can say so instead of showing an error. A
 * missing table must never mean a tour starts without a briefing.
 */

import type { RoomDbClient } from '@/lib/tour-room/access';
import {
  cardSetFromRow,
  normalizeCardIds,
  serializeCardOptions,
  type BriefingCardOptionPatch,
  type CardSetScope,
  type StoredCardSet,
} from '@/lib/ops/seating/cards/cardSet';

export * from '@/lib/ops/seating/cards/cardSet';

export const CARD_SET_TABLE = 'ops_briefing_card_sets';

const COLUMNS = 'scope, scope_id, card_ids, options, updated_at';

export interface CardSetLevels {
  room: StoredCardSet | null;
  tour: StoredCardSet | null;
  /** True when the table is absent (migration not applied yet). */
  migrationPending: boolean;
}

/** One level's row, or null. Never throws. */
export async function loadCardSet(
  supabase: RoomDbClient,
  scope: CardSetScope,
  scopeId: string | null | undefined,
): Promise<{ set: StoredCardSet | null; migrationPending: boolean }> {
  if (!scopeId) return { set: null, migrationPending: false };
  try {
    const { data, error } = await supabase
      .from(CARD_SET_TABLE)
      .select(COLUMNS)
      .eq('scope', scope)
      .eq('scope_id', scopeId)
      .maybeSingle();
    if (error) return { set: null, migrationPending: true };
    return { set: cardSetFromRow(data), migrationPending: false };
  } catch {
    return { set: null, migrationPending: true };
  }
}

/**
 * Both levels for one room. The two reads are independent — a room override
 * with no product default is normal, and so is the reverse.
 */
export async function loadCardSetLevels(
  supabase: RoomDbClient,
  input: { roomId?: string | null; tourId?: string | null },
): Promise<CardSetLevels> {
  const [room, tour] = await Promise.all([
    loadCardSet(supabase, 'room', input.roomId ?? null),
    loadCardSet(supabase, 'tour', input.tourId ?? null),
  ]);
  return {
    room: room.set,
    tour: tour.set,
    migrationPending: room.migrationPending || tour.migrationPending,
  };
}

export interface SaveCardSetInput {
  scope: CardSetScope;
  scopeId: string;
  /** null → this level stops defining a set (falls through to the next one). */
  cardIds: readonly string[] | null;
  options: BriefingCardOptionPatch;
  updatedBy?: string | null;
}

export type SaveCardSetOutcome =
  | { ok: true; set: StoredCardSet }
  | { ok: false; error: 'empty_selection' | 'migration_pending' | 'write_failed'; message: string };

/**
 * Upsert one level.
 *
 * An empty selection is rejected rather than stored: `normalizeCardIds` would
 * read it back as "not configured" anyway, so saving it would silently mean
 * the opposite of what the operator pressed. Passing `cardIds: null`
 * explicitly is the supported way to clear an override.
 */
export async function saveCardSet(
  supabase: RoomDbClient,
  input: SaveCardSetInput,
): Promise<SaveCardSetOutcome> {
  let cardIds: string[] | null = null;
  if (input.cardIds !== null && input.cardIds !== undefined) {
    const normalized = normalizeCardIds(input.cardIds);
    if (!normalized) {
      return {
        ok: false,
        error: 'empty_selection',
        message: '카드를 최소 한 장은 포함해야 해요. 전부 끄려면 [기본값으로 되돌리기]를 쓰세요.',
      };
    }
    cardIds = normalized;
  }

  const payload: Record<string, unknown> = {
    scope: input.scope,
    scope_id: input.scopeId,
    card_ids: cardIds,
    options: serializeCardOptions(input.options),
    updated_at: new Date().toISOString(),
  };
  if (input.updatedBy) payload.updated_by = input.updatedBy;

  try {
    const { data, error } = await supabase
      .from(CARD_SET_TABLE)
      .upsert(payload, { onConflict: 'scope,scope_id' })
      .select(COLUMNS)
      .single();
    if (error) {
      return {
        ok: false,
        error: 'migration_pending',
        message: '카드 세트 테이블이 아직 없어요. 마이그레이션 적용 후 다시 시도해 주세요.',
      };
    }
    const set = cardSetFromRow(data);
    if (!set) return { ok: false, error: 'write_failed', message: '저장은 됐지만 결과를 읽지 못했어요.' };
    return { ok: true, set };
  } catch {
    return {
      ok: false,
      error: 'migration_pending',
      message: '카드 세트 테이블이 아직 없어요. 마이그레이션 적용 후 다시 시도해 주세요.',
    };
  }
}

/** Remove one level's row entirely → it inherits again. Never throws. */
export async function clearCardSet(
  supabase: RoomDbClient,
  scope: CardSetScope,
  scopeId: string,
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from(CARD_SET_TABLE)
      .delete()
      .eq('scope', scope)
      .eq('scope_id', scopeId);
    return !error;
  } catch {
    return false;
  }
}
