/**
 * @jest-environment node
 *
 * §5.4 C-17 — the card-set config: normalization, the three-level precedence,
 * and the fail-open rule that keeps a missing/corrupt row from silencing a
 * tour's briefing.
 */
import {
  BRIEFING_CARD_DESCRIPTORS,
  DEFAULT_BRIEFING_CARD_OPTIONS,
  cardSetFromRow,
  moveCardId,
  normalizeCardIds,
  normalizeCardOptions,
  resolveBriefingCardSet,
  serializeCardOptions,
  toggleCardId,
  type StoredCardSet,
} from '@/lib/ops/seating/cards/cardSet';
import { BRIEFING_CARD_STACK, DEFAULT_BRIEFING_CARD_IDS } from '@/lib/ops/seating/cards/stack';

const room = (over: Partial<StoredCardSet> = {}): StoredCardSet => ({
  scope: 'room',
  scopeId: 'room-1',
  cardIds: null,
  options: {},
  ...over,
});

const tour = (over: Partial<StoredCardSet> = {}): StoredCardSet => ({
  scope: 'tour',
  scopeId: 'tour-1',
  cardIds: null,
  options: {},
  ...over,
});

describe('normalizeCardIds — the fail-open contract', () => {
  it('keeps the given order, drops unknowns and duplicates', () => {
    expect(normalizeCardIds(['lunch', 'start', 'lunch', 'nope', 42])).toEqual(['lunch', 'start']);
  });

  it('returns null — "this level defines nothing" — for every empty shape', () => {
    // 🔴 [] is the load-bearing case: it must mean "inherit", never "send nothing".
    expect(normalizeCardIds([])).toBeNull();
    expect(normalizeCardIds(['nope', 'also-nope'])).toBeNull();
    expect(normalizeCardIds(null)).toBeNull();
    expect(normalizeCardIds(undefined)).toBeNull();
    expect(normalizeCardIds('start')).toBeNull();
    expect(normalizeCardIds({ 0: 'start' })).toBeNull();
  });
});

describe('normalizeCardOptions', () => {
  it('accepts only the two known groups, with the right types', () => {
    expect(
      normalizeCardOptions({
        safety: { skip_repeat_boarding: false },
        lunch: { lunch_included: true },
        bogus: { x: 1 },
      }),
    ).toEqual({ safety: { skipRepeatBoarding: false }, lunch: { lunchIncluded: true } });
  });

  it('treats null lunch_included as an explicit "follow the product"', () => {
    expect(normalizeCardOptions({ lunch: { lunch_included: null } })).toEqual({
      lunch: { lunchIncluded: null },
    });
  });

  it('drops wrong-typed and missing values instead of guessing', () => {
    expect(normalizeCardOptions({ safety: { skip_repeat_boarding: 'yes' } })).toEqual({});
    expect(normalizeCardOptions({ lunch: {} })).toEqual({});
    expect(normalizeCardOptions(null)).toEqual({});
    expect(normalizeCardOptions([1, 2])).toEqual({});
  });

  it('round-trips through the jsonb shape', () => {
    const patch = { safety: { skipRepeatBoarding: false }, lunch: { lunchIncluded: false } };
    expect(normalizeCardOptions(serializeCardOptions(patch))).toEqual(patch);
    expect(serializeCardOptions({})).toEqual({});
  });
});

describe('cardSetFromRow', () => {
  it('normalizes a real row', () => {
    expect(
      cardSetFromRow({
        scope: 'room',
        scope_id: 'room-9',
        card_ids: ['etiquette', 'start'],
        options: { safety: { skip_repeat_boarding: false } },
        updated_at: 'T',
      }),
    ).toEqual({
      scope: 'room',
      scopeId: 'room-9',
      cardIds: ['etiquette', 'start'],
      options: { safety: { skipRepeatBoarding: false } },
      updatedAt: 'T',
    });
  });

  it('rejects rows without a usable scope', () => {
    expect(cardSetFromRow(null)).toBeNull();
    expect(cardSetFromRow({ scope: 'planet', scope_id: 'x' })).toBeNull();
    expect(cardSetFromRow({ scope: 'room' })).toBeNull();
  });
});

describe('resolveBriefingCardSet — room override → product default → code default', () => {
  it('falls all the way through to the shipped stack when nothing is configured', () => {
    const resolved = resolveBriefingCardSet({});
    expect(resolved.cardIds).toEqual([...DEFAULT_BRIEFING_CARD_IDS]);
    expect(resolved.cardIdsSource).toBe('default');
    expect(resolved.options).toEqual(DEFAULT_BRIEFING_CARD_OPTIONS);
    expect(resolved.optionSources).toEqual({ safety: 'default', lunch: 'default' });
  });

  it('uses the product default when the room has no override', () => {
    const resolved = resolveBriefingCardSet({ tour: tour({ cardIds: ['start', 'lunch'] }) });
    expect(resolved.cardIds).toEqual(['start', 'lunch']);
    expect(resolved.cardIdsSource).toBe('tour');
  });

  it('lets the room override beat the product default', () => {
    const resolved = resolveBriefingCardSet({
      room: room({ cardIds: ['etiquette'] }),
      tour: tour({ cardIds: ['start', 'lunch'] }),
    });
    expect(resolved.cardIds).toEqual(['etiquette']);
    expect(resolved.cardIdsSource).toBe('room');
  });

  it('lets an explicit caller argument beat both stored levels', () => {
    const resolved = resolveBriefingCardSet({
      explicitCardIds: ['safety'],
      room: room({ cardIds: ['etiquette'] }),
      tour: tour({ cardIds: ['start'] }),
    });
    expect(resolved.cardIds).toEqual(['safety']);
    expect(resolved.cardIdsSource).toBe('explicit');
  });

  it('resolves PER FIELD — a room that only reorders keeps the product option', () => {
    const resolved = resolveBriefingCardSet({
      room: room({ cardIds: ['lunch', 'start'] }),
      tour: tour({ cardIds: ['start'], options: { safety: { skipRepeatBoarding: false } } }),
    });
    expect(resolved.cardIds).toEqual(['lunch', 'start']);
    expect(resolved.cardIdsSource).toBe('room');
    expect(resolved.options.safety.skipRepeatBoarding).toBe(false);
    expect(resolved.optionSources.safety).toBe('tour');
  });

  it('and a room that only sets an option keeps the product order', () => {
    const resolved = resolveBriefingCardSet({
      room: room({ options: { lunch: { lunchIncluded: true } } }),
      tour: tour({ cardIds: ['start', 'safety'] }),
    });
    expect(resolved.cardIds).toEqual(['start', 'safety']);
    expect(resolved.cardIdsSource).toBe('tour');
    expect(resolved.options.lunch.lunchIncluded).toBe(true);
    expect(resolved.optionSources.lunch).toBe('room');
    // the untouched group still comes from the code default
    expect(resolved.optionSources.safety).toBe('default');
  });

  it('a corrupted / empty config row can never produce an empty stack', () => {
    for (const broken of [[], ['nope'], null]) {
      const resolved = resolveBriefingCardSet({
        room: room({ cardIds: normalizeCardIds(broken) }),
        tour: tour({ cardIds: normalizeCardIds(broken) }),
      });
      expect(resolved.cardIds).toEqual([...DEFAULT_BRIEFING_CARD_IDS]);
      expect(resolved.cardIdsSource).toBe('default');
    }
  });
});

describe('editor helpers', () => {
  it('toggle removes, and re-adds in the shipped order', () => {
    expect(toggleCardId(['start', 'safety', 'lunch'], 'safety')).toEqual(['start', 'lunch']);
    expect(toggleCardId(['lunch', 'start'], 'safety')).toEqual(['start', 'safety', 'lunch']);
  });

  it('move swaps with the neighbour and no-ops at the ends', () => {
    expect(moveCardId(['a', 'b'] as never, 'b' as never, -1)).toEqual(['b', 'a']);
    expect(moveCardId(['start', 'safety'], 'start', -1)).toEqual(['start', 'safety']);
    expect(moveCardId(['start', 'safety'], 'safety', 1)).toEqual(['start', 'safety']);
    expect(moveCardId(['start', 'safety'], 'start', 1)).toEqual(['safety', 'start']);
  });

  it('describes exactly the cards that exist, and marks the one that pushes', () => {
    expect(BRIEFING_CARD_DESCRIPTORS.map((card) => card.id)).toEqual([...DEFAULT_BRIEFING_CARD_IDS]);
    const pushing = BRIEFING_CARD_DESCRIPTORS.filter((card) => card.pushes).map((card) => card.id);
    expect(pushing).toEqual(BRIEFING_CARD_STACK.filter((spec) => spec.push).map((spec) => spec.id));
    // every declared option group points at a real card option
    const groups = BRIEFING_CARD_DESCRIPTORS.flatMap((card) => (card.option ? [card.option.group] : []));
    expect(groups.sort()).toEqual(['lunch', 'safety']);
  });
});
