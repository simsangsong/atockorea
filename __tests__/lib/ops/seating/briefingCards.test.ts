/**
 * C-16 cards ②~⑤ — capsule composition contracts.
 *
 * What is locked down here:
 *   ① every guest-facing string exists in all 5 room locales (a missing key
 *      would ship an `undefined` into a traveller's chat feed);
 *   ② card ③ returns null when the resolver produced no schedule — "no card"
 *      is the honest fallback, never an empty or invented one;
 *   ③ card ④ reuses the dining vocabulary verbatim and never offers `kids`
 *      (dietary.ts defines it as derived and "never written to needs.dietary");
 *   ④ the stack is declarative: unique kinds, unique subject keys, and a
 *      selector C-17 can drive from a config row.
 */
import { ROOM_LOCALES, type RoomLocale } from '@/lib/tour-room/snapshot';
import {
  SAFETY_COPY,
  composeSafety,
  composeSafetyTranslations,
  safetyFullTranslations,
} from '@/lib/ops/seating/cards/safety';
import {
  SCHEDULE_COPY,
  composeSchedule,
  composeScheduleTranslations,
  scheduleStopsFrom,
  MAX_PREVIEW_STOPS,
} from '@/lib/ops/seating/cards/schedule';
import { LUNCH_COPY, LUNCH_INTAKE_TAGS, composeLunch, composeLunchTranslations } from '@/lib/ops/seating/cards/lunch';
import { ETIQUETTE_COPY, composeEtiquette, composeEtiquetteTranslations } from '@/lib/ops/seating/cards/etiquette';
import {
  BRIEFING_CARD_STACK,
  DEFAULT_BRIEFING_CARD_IDS,
  selectBriefingCards,
  type BriefingCardContext,
} from '@/lib/ops/seating/cards/stack';
import { DIETARY_FILTER_TAGS, DIETARY_LABELS, isDietaryTag } from '@/lib/ops/dining/dietary';
import type { ScheduleItemLike } from '@/lib/tour-room/concierge';

/** Every locale carries a non-empty string for every key of a copy record. */
function expectComplete(copy: Record<string, Record<string, string>>): void {
  for (const locale of ROOM_LOCALES) {
    const entry = copy[locale];
    expect(entry).toBeDefined();
    for (const [key, value] of Object.entries(entry)) {
      expect(typeof value).toBe('string');
      expect(`${locale}.${key}: ${value.trim()}`).not.toBe(`${locale}.${key}: `);
    }
  }
}

function expectTranslations(translations: Record<string, string>): void {
  expect(Object.keys(translations).sort()).toEqual([...ROOM_LOCALES].sort());
  for (const locale of ROOM_LOCALES) {
    expect(`${locale}: ${translations[locale].trim()}`).not.toBe(`${locale}: `);
    expect(translations[locale]).not.toContain('undefined');
  }
}

describe('5-locale completeness (every card)', () => {
  it('card chrome copy is complete', () => {
    expectComplete(SAFETY_COPY);
    expectComplete(SCHEDULE_COPY);
    expectComplete(LUNCH_COPY);
    expectComplete(ETIQUETTE_COPY);
  });

  it('capsule bodies are complete', () => {
    expectTranslations(composeSafetyTranslations());
    expectTranslations(composeSafetyTranslations({ collapsed: true }));
    expectTranslations(composeSafetyTranslations({ tourKind: 'private' }));
    expectTranslations(safetyFullTranslations());
    expectTranslations(safetyFullTranslations('private'));
    expectTranslations(composeLunchTranslations({ lunchIncluded: false }));
    expectTranslations(composeLunchTranslations({ lunchIncluded: true }));
    expectTranslations(composeLunchTranslations({ lunchIncluded: true, tourKind: 'private' }));
    expectTranslations(composeEtiquetteTranslations());
    expectTranslations(composeScheduleTranslations([{ time: '09:30', title: 'Seongsan Ilchulbong' }]));
  });

  it('every locale of every capsule ships a distinct translation (no copy-paste of en)', () => {
    const bodies = composeSafetyTranslations();
    const unique = new Set(ROOM_LOCALES.map((l) => bodies[l]));
    expect(unique.size).toBe(ROOM_LOCALES.length);
  });
});

describe('card ② safety', () => {
  it('carries the metadata contract and a null video slot by default', () => {
    const card = composeSafety({ tourDate: '2099-07-24' });
    expect(card.metadata).toMatchObject({ kind: 'briefing_safety', collapsed: false, video_card: null });
    expect(card.source_locale).toBe('en');
    expect(card.source_text).toBe(card.translations.en);
  });

  it('rides an approved video when one exists, stays complete when it does not', () => {
    const video = {
      video_url: 'https://cdn/safety.mp4',
      poster_url: null,
      duration_seconds: 30,
      tracks: [{ srclang: 'en' as const, label: 'English', src: '/videos/safety-intro-30s/subtitles/en.vtt' }],
    };
    expect(composeSafety({ videoCard: video }).metadata.video_card).toEqual(video);
    // Without a video the text still contains all four instructions.
    const text = composeSafety({}).translations.en;
    expect(text).toMatch(/seatbelt/i);
    expect(text).toMatch(/stay with the group/i);
    expect(text).toMatch(/SOS/);
  });

  it('re-boarding guests get the collapsed variant (shorter, same instructions available)', () => {
    const full = composeSafety({});
    const collapsed = composeSafety({ collapsed: true });
    expect(collapsed.metadata.collapsed).toBe(true);
    for (const locale of ROOM_LOCALES) {
      expect(collapsed.translations[locale].length).toBeLessThan(full.translations[locale].length);
      expect(collapsed.translations[locale].split('\n')).toHaveLength(1);
    }
    // The full text is still reachable for the "show again" expansion.
    expect(safetyFullTranslations().en).toBe(full.translations.en);
  });

  it('does not restate emergency phone numbers (the emergency card owns them)', () => {
    for (const locale of ROOM_LOCALES) {
      expect(composeSafety({}).translations[locale]).not.toMatch(/\b1330\b|\b119\b|\b112\b/);
    }
  });

  // §11.D D3 — exactly ONE line differs by kind; the rest must stay shared.
  it('swaps only the stay-together line for a private charter', () => {
    const join = composeSafety({ tourKind: 'join' });
    const priv = composeSafety({ tourKind: 'private' });
    expect(join.metadata.tour_kind).toBe('join');
    expect(priv.metadata.tour_kind).toBe('private');

    for (const locale of ROOM_LOCALES) {
      const a = join.translations[locale].split('\n');
      const b = priv.translations[locale].split('\n');
      expect(a).toHaveLength(b.length);
      const differing = a.filter((line, index) => line !== b[index]);
      expect(differing).toHaveLength(1);
    }
    expect(priv.translations.en).not.toMatch(/staff/i);
    expect(priv.translations.ko).toContain('기사님');
  });

  it('defaults to the shipped join wording when no kind is given', () => {
    expect(composeSafety({}).translations.en).toBe(composeSafety({ tourKind: 'join' }).translations.en);
    expect(composeSafety({}).metadata.tour_kind).toBe('join');
  });

  it('the collapsed reminder is kind-neutral (nothing in it names a staff role)', () => {
    const collapsed = composeSafety({ collapsed: true, tourKind: 'private' });
    expect(collapsed.translations.en).toBe(composeSafety({ collapsed: true }).translations.en);
  });
});

describe('card ③ schedule', () => {
  const schedule: ScheduleItemLike[] = [
    { time: '09:30', title: 'Seongsan Ilchulbong', poi_key: 'seongsan' },
    { title: 'Seopjikoji' },
    { time: '12:30', title: 'Lunch stop' },
  ];

  it('no schedule → no card', () => {
    expect(composeSchedule({ schedule: [], source: 'none' })).toBeNull();
    expect(composeSchedule({ schedule: null, source: 'none' })).toBeNull();
    expect(composeSchedule({ schedule: undefined, source: 'none' })).toBeNull();
    // Entries with no usable title contribute nothing → still no card.
    expect(composeSchedule({ schedule: [{ time: '09:00' }, {}], source: 'day_plan' })).toBeNull();
  });

  it('builds rows from the resolver output, keeping order and times', () => {
    const card = composeSchedule({ schedule, source: 'day_plan', tourDate: '2099-07-24' })!;
    expect(card).not.toBeNull();
    expect(card.metadata).toMatchObject({ kind: 'briefing_schedule', source: 'day_plan' });
    expect(card.metadata.stops).toEqual([
      { time: '09:30', title: 'Seongsan Ilchulbong', poi_key: 'seongsan' },
      { time: null, title: 'Seopjikoji', poi_key: null },
      { time: '12:30', title: 'Lunch stop', poi_key: null },
    ]);
    expect(card.translations.ko).toContain('09:30 · Seongsan Ilchulbong');
  });

  it('drops malformed times rather than printing them', () => {
    expect(scheduleStopsFrom([{ time: 'noon', title: 'A' }])[0].time).toBeNull();
    expect(scheduleStopsFrom([{ time: '9:3', title: 'A' }])[0].time).toBeNull();
  });

  it('caps the preview and says how many more there are', () => {
    const many = Array.from({ length: MAX_PREVIEW_STOPS + 3 }, (_, i) => ({ title: `Stop ${i + 1}` }));
    const card = composeSchedule({ schedule: many, source: 'tour_schedule' })!;
    expect((card.metadata.stops as unknown[]).length).toBe(MAX_PREVIEW_STOPS);
    expect(card.translations.en).toContain('3 more');
    expect(card.translations.ko).toContain('3곳');
  });
});

describe('card ④ lunch', () => {
  it('reuses the dining vocabulary verbatim and excludes the derived `kids` tag', () => {
    expect(LUNCH_INTAKE_TAGS).toEqual(DIETARY_FILTER_TAGS.filter(isDietaryTag));
    expect(LUNCH_INTAKE_TAGS).not.toContain('kids');
    for (const tag of LUNCH_INTAKE_TAGS) {
      // Labels come from DIETARY_LABELS — no second vocabulary anywhere.
      for (const locale of ROOM_LOCALES) {
        expect(DIETARY_LABELS[tag][locale as RoomLocale].trim()).not.toBe('');
      }
    }
  });

  it('states lunch is NOT included when that is true for the tour', () => {
    const card = composeLunch({ lunchIncluded: false });
    expect(card.metadata).toMatchObject({ kind: 'briefing_lunch', lunch_included: false });
    expect(card.translations.en).toMatch(/not included/i);
    expect(card.translations.ko).toContain('포함되어 있지 않');
  });

  it('says the opposite when lunch IS included (never both)', () => {
    const card = composeLunch({ lunchIncluded: true });
    expect(card.metadata.lunch_included).toBe(true);
    expect(card.translations.en).not.toMatch(/not included/i);
    expect(card.translations.en).toMatch(/included/i);
  });

  // §11.D D3 — only the "who walks you there" line differs by kind, and only
  // on the included branch (a not-included card names nobody).
  it('names the driver instead of the staff on a private charter', () => {
    const join = composeLunch({ lunchIncluded: true, tourKind: 'join' });
    const priv = composeLunch({ lunchIncluded: true, tourKind: 'private' });
    expect(join.translations.en).toMatch(/the staff will take you/i);
    expect(priv.translations.en).toMatch(/your driver will take you/i);
    expect(priv.translations.ko).toContain('기사님이 식당으로');
    expect(priv.metadata.tour_kind).toBe('private');

    for (const locale of ROOM_LOCALES) {
      const a = join.translations[locale].split('\n');
      const b = priv.translations[locale].split('\n');
      expect(a.filter((line, index) => line !== b[index])).toHaveLength(1);
    }
  });

  it('the not-included branch is identical for both kinds', () => {
    expect(composeLunch({ lunchIncluded: false, tourKind: 'private' }).translations.en).toBe(
      composeLunch({ lunchIncluded: false, tourKind: 'join' }).translations.en,
    );
  });

  it('pre-selects the tags already on file, dropping junk and derived tags', () => {
    const card = composeLunch({ lunchIncluded: false, dietary: ['vegan', 'kids', 'astrology'] });
    expect(card.metadata.dietary).toEqual(['vegan']);
  });
});

describe('card ⑤ etiquette', () => {
  it('covers sites, punctuality, and the driver rule, and points at the presets', () => {
    const card = composeEtiquette();
    expect(card.metadata).toMatchObject({ kind: 'briefing_etiquette', preset_hint: true });
    const en = card.translations.en;
    expect(en).toMatch(/non-smoking/i);
    expect(en).toMatch(/meeting point/i);
    expect(en).toMatch(/do not talk to the driver/i);
    expect(en).toMatch(/one-tap phrases/i);
  });
});

describe('the declarative stack (C-17 seam)', () => {
  const ctx: BriefingCardContext = {
    tourDate: '2099-07-24',
    tourKind: 'join',
    startCapsule: {
      source_locale: 'en',
      source_text: 'hi',
      translations: { en: 'hi', ko: '안녕', ja: 'やあ', es: 'hola', zh: '你好' },
      metadata: { kind: 'tour_start_briefing' },
    },
    safetyVideo: null,
    safetySeenBefore: false,
    schedule: [{ time: '09:00', title: 'A' }],
    scheduleSource: 'day_plan',
    lunchIncluded: false,
    dietary: [],
  };

  it('is the five C-16 cards, in plan order', () => {
    expect(DEFAULT_BRIEFING_CARD_IDS).toEqual(['start', 'safety', 'schedule', 'lunch', 'etiquette']);
  });

  it('gives every card a unique metadata.kind and a unique subject key', () => {
    const kinds = BRIEFING_CARD_STACK.map((c) => c.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
    const keys = BRIEFING_CARD_STACK.map((c) => c.subjectKey(ctx));
    expect(new Set(keys).size).toBe(keys.length);
    // Card ① keeps its shipped room-scoped key; ②~⑤ are day-scoped.
    expect(keys[0]).toBe('tour_start_briefing');
    for (const key of keys.slice(1)) expect(key).toContain(':2099-07-24');
  });

  it('composes each card to the kind its spec declares', () => {
    for (const spec of BRIEFING_CARD_STACK) {
      const composed = spec.compose(ctx);
      expect(composed).not.toBeNull();
      expect((composed!.metadata as { kind?: string }).kind).toBe(spec.kind);
    }
  });

  it('pushes for the welcome card only', () => {
    expect(BRIEFING_CARD_STACK.filter((c) => c.push).map((c) => c.id)).toEqual(['start']);
  });

  it('selectBriefingCards filters + reorders by id, ignoring unknowns and duplicates', () => {
    expect(selectBriefingCards(null)).toBe(BRIEFING_CARD_STACK);
    expect(selectBriefingCards(['lunch', 'start']).map((c) => c.id)).toEqual(['lunch', 'start']);
    expect(selectBriefingCards(['lunch', 'lunch', 'nope']).map((c) => c.id)).toEqual(['lunch']);
    expect(selectBriefingCards([])).toEqual([]);
  });
});
