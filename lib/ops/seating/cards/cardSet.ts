/**
 * §5.4 C-17 — the briefing CARD SET config: which cards go out, in what order,
 * and the handful of per-card options the capsules already expose.
 *
 * C-16 deliberately left the seam: `BRIEFING_CARD_STACK` is a declarative array
 * and `fireTourStartBriefing` only walks it. This module is what drives that
 * walk from config instead of from the array's shipped order.
 *
 * ── Two levels, and a code default that can never be edited away ────────────
 *
 *   room override  (ops_briefing_card_sets scope='room', scope_id=tour_rooms.id)
 *        ↓ falls through when the room has no row
 *   product default (scope='tour', scope_id=tours.id)
 *        ↓ falls through when the product has no row
 *   code default   (DEFAULT_BRIEFING_CARD_IDS — the shipped five, in order)
 *
 * Resolution is PER FIELD, not per level: a room that only reorders the cards
 * keeps its product's safety option, and a product that only flips an option
 * keeps the shipped card order. Anything else surprises the operator, because
 * the two things are edited on different screens.
 *
 * 🔴 The fallback is load-bearing. `normalizeCardIds` returns `null` — "this
 * level does not define a set" — for anything that is not a non-empty list of
 * known ids, INCLUDING an empty array. A missing, empty, or corrupted config
 * row therefore produces the full default stack; it can never produce a tour
 * that silently briefs nobody. The editor refuses to save an empty selection
 * for the same reason (an operator who wants no cards is telling us something
 * the product should hear, not something a config row should swallow).
 *
 * ── What is NOT editable here, and why ──────────────────────────────────────
 *
 *   · the COPY. Every card is a pre-translated 5-locale constant (zero LLM at
 *     send time). Turning it into free text would put a Korean operator's
 *     untranslated prose in front of an English/Japanese/Spanish/Chinese guest
 *     — the one failure mode the whole capsule design exists to prevent.
 *   · `push`. Only the welcome card rings the phone. Five notifications for one
 *     [투어 시작] tap is how a guest turns notifications off for good.
 *   · `kind` / `subjectKey`. They are the idempotency contract; editing them
 *     would let a retried gate double-post.
 *
 * Pure and client-safe — the admin editor imports it directly.
 */

import {
  BRIEFING_CARD_STACK,
  DEFAULT_BRIEFING_CARD_IDS,
  type BriefingCardId,
} from '@/lib/ops/seating/cards/stack';

export type CardSetScope = 'tour' | 'room';

/** Where a resolved value came from — surfaced in the editor so the operator
 *  can see whether they are looking at an override or an inherited value. */
export type CardSetSource = 'explicit' | 'room' | 'tour' | 'default';

// ── options ────────────────────────────────────────────────────────────────

export interface SafetyCardOptions {
  /**
   * Card ②'s re-boarding skip (plan §5.4 C-16 ② "재탑승자 스킵 옵션"). When
   * true (shipped default) a guest who already saw the safety card on an
   * earlier day of the same booking gets the one-line collapsed variant; when
   * false the full drill is sent every day.
   */
  skipRepeatBoarding: boolean;
}

export interface LunchCardOptions {
  /**
   * Card ④'s inclusion line. `null` (shipped default) = follow
   * `tours.lunch_included`; a boolean overrides it for this room/product only.
   */
  lunchIncluded: boolean | null;
}

export interface BriefingCardOptions {
  safety: SafetyCardOptions;
  lunch: LunchCardOptions;
}

export type BriefingCardOptionGroup = keyof BriefingCardOptions;

export const BRIEFING_CARD_OPTION_GROUPS: readonly BriefingCardOptionGroup[] = ['safety', 'lunch'];

export const DEFAULT_BRIEFING_CARD_OPTIONS: BriefingCardOptions = {
  safety: { skipRepeatBoarding: true },
  lunch: { lunchIncluded: null },
};

/** A stored (partial) option set — only the groups this level actually sets. */
export interface BriefingCardOptionPatch {
  safety?: SafetyCardOptions;
  lunch?: LunchCardOptions;
}

/** One `ops_briefing_card_sets` row, normalized. */
export interface StoredCardSet {
  scope: CardSetScope;
  scopeId: string;
  /** null = this level does not define a card set (see the header). */
  cardIds: BriefingCardId[] | null;
  options: BriefingCardOptionPatch;
  updatedAt?: string | null;
}

export interface ResolvedBriefingCardSet {
  cardIds: BriefingCardId[];
  options: BriefingCardOptions;
  cardIdsSource: CardSetSource;
  optionSources: Record<BriefingCardOptionGroup, CardSetSource>;
}

// ── normalization (everything crossing the DB / HTTP boundary) ──────────────

const KNOWN_CARD_IDS: ReadonlySet<string> = new Set(BRIEFING_CARD_STACK.map((card) => card.id));

export function isBriefingCardId(value: unknown): value is BriefingCardId {
  return typeof value === 'string' && KNOWN_CARD_IDS.has(value);
}

/**
 * A list of known card ids in the given order, deduped, unknown ids dropped.
 * `null` when the input defines nothing usable — including `[]`, which is the
 * whole point of the fail-open contract described in the header.
 */
export function normalizeCardIds(raw: unknown): BriefingCardId[] | null {
  if (!Array.isArray(raw)) return null;
  const seen = new Set<string>();
  const out: BriefingCardId[] = [];
  for (const value of raw) {
    if (!isBriefingCardId(value) || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out.length > 0 ? out : null;
}

/** jsonb / request body → the option groups this level actually sets. */
export function normalizeCardOptions(raw: unknown): BriefingCardOptionPatch {
  const out: BriefingCardOptionPatch = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  const row = raw as Record<string, unknown>;

  const safety = row.safety;
  if (safety && typeof safety === 'object' && !Array.isArray(safety)) {
    const value = (safety as Record<string, unknown>).skip_repeat_boarding;
    if (typeof value === 'boolean') out.safety = { skipRepeatBoarding: value };
  }

  const lunch = row.lunch;
  if (lunch && typeof lunch === 'object' && !Array.isArray(lunch)) {
    const value = (lunch as Record<string, unknown>).lunch_included;
    if (typeof value === 'boolean' || value === null) out.lunch = { lunchIncluded: value };
  }

  return out;
}

/** The inverse — what actually goes into the jsonb column. */
export function serializeCardOptions(patch: BriefingCardOptionPatch): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (patch.safety) out.safety = { skip_repeat_boarding: patch.safety.skipRepeatBoarding };
  if (patch.lunch) out.lunch = { lunch_included: patch.lunch.lunchIncluded };
  return out;
}

/** A raw DB row → StoredCardSet (never throws; unknown shapes degrade to null). */
export function cardSetFromRow(row: unknown): StoredCardSet | null {
  if (!row || typeof row !== 'object') return null;
  const record = row as Record<string, unknown>;
  const scope = record.scope === 'room' ? 'room' : record.scope === 'tour' ? 'tour' : null;
  const scopeId = typeof record.scope_id === 'string' ? record.scope_id : '';
  if (!scope || !scopeId) return null;
  return {
    scope,
    scopeId,
    cardIds: normalizeCardIds(record.card_ids),
    options: normalizeCardOptions(record.options),
    updatedAt: typeof record.updated_at === 'string' ? record.updated_at : null,
  };
}

// ── resolution ─────────────────────────────────────────────────────────────

/**
 * room override → product default → code default, resolved per field.
 *
 * `explicitCardIds` is the caller's own override (the fan-out's `cardIds`
 * argument and the preview's "what if"), and outranks both stored levels. It
 * follows the same fail-open rule: an empty or unrecognizable list means "not
 * specified", never "send nothing".
 */
export function resolveBriefingCardSet(input: {
  explicitCardIds?: readonly string[] | null;
  room?: StoredCardSet | null;
  tour?: StoredCardSet | null;
}): ResolvedBriefingCardSet {
  const explicit = normalizeCardIds(input.explicitCardIds ?? null);
  const roomIds = input.room?.cardIds ?? null;
  const tourIds = input.tour?.cardIds ?? null;

  let cardIds: BriefingCardId[];
  let cardIdsSource: CardSetSource;
  if (explicit) {
    cardIds = explicit;
    cardIdsSource = 'explicit';
  } else if (roomIds) {
    cardIds = roomIds;
    cardIdsSource = 'room';
  } else if (tourIds) {
    cardIds = tourIds;
    cardIdsSource = 'tour';
  } else {
    cardIds = [...DEFAULT_BRIEFING_CARD_IDS];
    cardIdsSource = 'default';
  }

  const options = { ...DEFAULT_BRIEFING_CARD_OPTIONS } as BriefingCardOptions;
  const optionSources = {} as Record<BriefingCardOptionGroup, CardSetSource>;
  for (const group of BRIEFING_CARD_OPTION_GROUPS) {
    const fromRoom = input.room?.options?.[group];
    const fromTour = input.tour?.options?.[group];
    if (fromRoom) {
      (options[group] as unknown) = fromRoom;
      optionSources[group] = 'room';
    } else if (fromTour) {
      (options[group] as unknown) = fromTour;
      optionSources[group] = 'tour';
    } else {
      (options[group] as unknown) = DEFAULT_BRIEFING_CARD_OPTIONS[group];
      optionSources[group] = 'default';
    }
  }

  return { cardIds, options, cardIdsSource, optionSources };
}

// ── editor descriptors (the admin UI is Korean-only; guests never see these) ─

export interface CardSetOptionDescriptor {
  group: BriefingCardOptionGroup;
  /** 'boolean' = on/off; 'tristate' = 상품값 따름 / 포함 / 불포함. */
  control: 'boolean' | 'tristate';
  label: string;
  help: string;
}

export interface CardSetCardDescriptor {
  id: BriefingCardId;
  label: string;
  summary: string;
  /** This card rings the phone (welcome card only) — display-only, not editable. */
  pushes: boolean;
  /** This card is skipped by its own composer when there is nothing to say. */
  conditional: boolean;
  option: CardSetOptionDescriptor | null;
}

export const BRIEFING_CARD_DESCRIPTORS: readonly CardSetCardDescriptor[] = [
  {
    id: 'start',
    label: '① 시작 브리핑',
    summary: '환영 인사 + 앱 사용 안내. 조인/프라이빗 상품에 따라 문구가 자동으로 달라집니다.',
    pushes: true,
    conditional: false,
    option: null,
  },
  {
    id: 'safety',
    label: '② 안전 안내',
    summary: '안전벨트 · 일행과 함께 · 길이 엇갈렸을 때. 승인된 30초 안전 영상이 있으면 함께 나갑니다.',
    pushes: false,
    conditional: false,
    option: {
      group: 'safety',
      control: 'boolean',
      label: '재탑승 손님은 요약본으로',
      help: '같은 예약으로 다른 날 이미 안전 안내를 받은 손님에게는 한 줄 요약본만 보냅니다. 끄면 매일 전체 안내를 보냅니다.',
    },
  },
  {
    id: 'schedule',
    label: '③ 오늘 일정 프리뷰',
    summary: '일정 리졸버가 해석한 오늘의 스톱. 해석된 일정이 없으면 이 카드는 발송되지 않습니다.',
    pushes: false,
    conditional: true,
    option: null,
  },
  {
    id: 'lunch',
    label: '④ 점심 안내',
    summary: '점심 포함 여부 + 식단 요청 입력(비건·할랄·견과 등 → 식당 추천에 직결).',
    pushes: false,
    conditional: false,
    option: {
      group: 'lunch',
      control: 'tristate',
      label: '점심 포함 여부',
      help: '기본값은 투어 상품의 lunch_included를 그대로 따릅니다. 이 룸/상품만 다르게 안내해야 할 때만 바꾸세요.',
    },
  },
  {
    id: 'etiquette',
    label: '⑤ 매너 · 시간 안내',
    summary: '관광지 금연 · 사찰 매너 · 쓰레기 · 집합 시간 · 주행 중 기사 대화 금지.',
    pushes: false,
    conditional: false,
    option: null,
  },
];

export function cardDescriptor(id: BriefingCardId): CardSetCardDescriptor | null {
  return BRIEFING_CARD_DESCRIPTORS.find((card) => card.id === id) ?? null;
}

// ── pure editor operations (so the drawer's list logic is testable) ─────────

/** Add / remove one card, preserving the shipped order for re-added cards. */
export function toggleCardId(ids: readonly BriefingCardId[], id: BriefingCardId): BriefingCardId[] {
  if (ids.includes(id)) return ids.filter((value) => value !== id);
  const order = DEFAULT_BRIEFING_CARD_IDS;
  const next = [...ids, id];
  return next.sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

/** Move one card up (-1) or down (+1); out-of-range moves are no-ops. */
export function moveCardId(
  ids: readonly BriefingCardId[],
  id: BriefingCardId,
  delta: -1 | 1,
): BriefingCardId[] {
  const index = ids.indexOf(id);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= ids.length) return [...ids];
  const next = [...ids];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

// ── preview (what the gate WOULD send for one room) ────────────────────────

export interface BriefingCardPreviewRow {
  id: BriefingCardId;
  /** metadata.kind — the discriminator the guest feed renders on. */
  kind: string;
  subject_key: string;
  /** False when this card would produce nothing (see `skipped_reason`). */
  will_send: boolean;
  /** 'no_content' (composer returned null) | 'already_sent' | null. */
  skipped_reason: 'no_content' | 'already_sent' | null;
  pushes: boolean;
  /** The exact 5-locale capsule the gate would insert; null when skipped. */
  translations: Record<string, string> | null;
  metadata: Record<string, unknown> | null;
}

export interface BriefingCardSetPreview {
  room_id: string;
  booking_id: string;
  tour_id: string | null;
  tour_date: string | null;
  /** 'join' | 'private' — §11.D D3, drives card ①/②/④ wording. */
  tour_kind: 'join' | 'private';
  resolved: {
    card_ids: BriefingCardId[];
    card_ids_source: CardSetSource;
    options: BriefingCardOptions;
    option_sources: Record<BriefingCardOptionGroup, CardSetSource>;
  };
  cards: BriefingCardPreviewRow[];
}
