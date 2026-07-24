/**
 * 🔴 THE CARD STACK — the one declarative array C-16 fans out and C-17 will
 * later drive from a config row (plan §5.4: "카드 내용은 사전 설정: /admin/
 * tour-ops 룸 설정에서 카드 세트·순서·포함 여부 편집").
 *
 * `fireTourStartBriefing` does not know any card. It resolves a context, walks
 * THIS array in order, and for each spec: composes → gates on the spec's own
 * subject key → inserts → broadcasts → optionally pushes. Adding, removing, or
 * reordering a card is an edit to this array and nothing else; the C-17 editor
 * becomes `selectBriefingCards(BRIEFING_CARD_STACK, configRow)` — a filter and
 * a sort over ids, not a rewrite of the fan-out.
 *
 * Idempotency contract: ONE subject key per card, so a retried start gate can
 * never double-post any card.
 *   - card ① keeps its shipped room-scoped key `tour_start_briefing`
 *     (changing it would re-fire the welcome for rooms that already got it);
 *   - cards ②~⑤ are DAY-scoped (`tour_start_briefing:{id}:{YYYY-MM-DD}`) so a
 *     multi-day booking can be briefed again on day 2 — which is precisely what
 *     makes the re-boarding skip on card ② meaningful.
 *
 * Pure and client-safe.
 */

import { composeSafety } from '@/lib/ops/seating/cards/safety';
import { composeSchedule } from '@/lib/ops/seating/cards/schedule';
import { composeLunch } from '@/lib/ops/seating/cards/lunch';
import { composeEtiquette } from '@/lib/ops/seating/cards/etiquette';
import type { ComposedBriefingCard } from '@/lib/ops/seating/cards/types';
import type { SafetyVideoCardMeta } from '@/lib/tour-room/safetyVideo';
import type { TourKind } from '@/lib/tour-room/tourKind';
import type { ScheduleItemLike } from '@/lib/tour-room/concierge';

export type BriefingCardId = 'start' | 'safety' | 'schedule' | 'lunch' | 'etiquette';

/**
 * Everything a composer may read. Resolved once per room by the fan-out.
 *
 * 🔴 The C-17 card-set OPTIONS are deliberately absent here: they are consumed
 * while this context is built (the safety option decides `safetySeenBefore`,
 * the lunch option decides `lunchIncluded`), so a spec never has to know that
 * a config layer exists. Only `tourKind` — a fact about the tour, not a
 * setting — reaches the composers.
 */
export interface BriefingCardContext {
  tourDate: string;
  /** §11.D D3 — 'join' (shared bus/small-group) | 'private' (charter). */
  tourKind: TourKind;
  /** Card ①'s capsule, composed by the caller from composeMorningBriefing. */
  startCapsule: ComposedBriefingCard;
  /** Card ② — approved 30 s render, or null (card ships as text only). */
  safetyVideo: SafetyVideoCardMeta | null;
  /** Card ② — this booking already saw the safety card on an earlier day. */
  safetySeenBefore: boolean;
  /** Card ③ — resolveDaySchedule output ([] → the card is not sent). */
  schedule: ScheduleItemLike[];
  scheduleSource: string;
  /** Card ④ — tours.lunch_included. */
  lunchIncluded: boolean;
  /** Card ④ — dietary tags already on file (chips render pre-selected). */
  dietary: string[];
}

export interface BriefingCardSpec {
  id: BriefingCardId;
  /** `metadata.kind` — the discriminator ChatFeed renders on. */
  kind: string;
  /** tour_room_events.type for this card's idempotency gate. */
  eventType: string;
  /** tour_room_events.subject_key — unique per card (see the header). */
  subjectKey: (ctx: BriefingCardContext) => string;
  /**
   * Web push. Only the welcome card rings the phone: five notifications for one
   * [투어 시작] tap is how a guest turns notifications off, and the other four
   * cards land in the same feed a second later.
   */
  push: boolean;
  /** null = nothing worth sending (card ③ with no schedule). */
  compose: (ctx: BriefingCardContext) => ComposedBriefingCard | null;
}

/** Day-scoped key for cards ②~⑤. */
function dayKey(id: BriefingCardId, ctx: BriefingCardContext): string {
  return `tour_start_briefing:${id}:${ctx.tourDate}`;
}

export const BRIEFING_CARD_STACK: readonly BriefingCardSpec[] = [
  {
    id: 'start',
    kind: 'tour_start_briefing',
    eventType: 'tour_start_briefing',
    subjectKey: () => 'tour_start_briefing',
    push: true,
    compose: (ctx) => ctx.startCapsule,
  },
  {
    id: 'safety',
    kind: 'briefing_safety',
    eventType: 'briefing_card',
    subjectKey: (ctx) => dayKey('safety', ctx),
    push: false,
    compose: (ctx) =>
      composeSafety({
        collapsed: ctx.safetySeenBefore,
        videoCard: ctx.safetyVideo,
        tourDate: ctx.tourDate,
        tourKind: ctx.tourKind,
      }),
  },
  {
    id: 'schedule',
    kind: 'briefing_schedule',
    eventType: 'briefing_card',
    subjectKey: (ctx) => dayKey('schedule', ctx),
    push: false,
    compose: (ctx) =>
      composeSchedule({ schedule: ctx.schedule, source: ctx.scheduleSource, tourDate: ctx.tourDate }),
  },
  {
    id: 'lunch',
    kind: 'briefing_lunch',
    eventType: 'briefing_card',
    subjectKey: (ctx) => dayKey('lunch', ctx),
    push: false,
    compose: (ctx) =>
      composeLunch({
        lunchIncluded: ctx.lunchIncluded,
        dietary: ctx.dietary,
        tourDate: ctx.tourDate,
        tourKind: ctx.tourKind,
      }),
  },
  {
    id: 'etiquette',
    kind: 'briefing_etiquette',
    eventType: 'briefing_card',
    subjectKey: (ctx) => dayKey('etiquette', ctx),
    push: false,
    compose: (ctx) => composeEtiquette({ tourDate: ctx.tourDate }),
  },
];

export const DEFAULT_BRIEFING_CARD_IDS: readonly BriefingCardId[] = BRIEFING_CARD_STACK.map((c) => c.id);

/**
 * C-17's seam: a room/product config row supplies the ids it wants and their
 * order; unknown ids are ignored and duplicates collapse. No argument = the
 * shipped default set in its shipped order.
 */
export function selectBriefingCards(
  ids?: readonly string[] | null,
): readonly BriefingCardSpec[] {
  if (!Array.isArray(ids)) return BRIEFING_CARD_STACK;
  const seen = new Set<string>();
  const out: BriefingCardSpec[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    const spec = BRIEFING_CARD_STACK.find((card) => card.id === id);
    if (!spec) continue;
    seen.add(id);
    out.push(spec);
  }
  return out;
}

/** The prefix a safety event's subject key carries, for the seen-before scan. */
export const SAFETY_SUBJECT_PREFIX = 'tour_start_briefing:safety:';
export const BRIEFING_CARD_EVENT_TYPE = 'briefing_card';
