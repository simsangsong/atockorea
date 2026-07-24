/**
 * Dietary intake — the vocabulary the dining RAG filters on (§5.7 R-1).
 *
 * Three intake paths, in priority order:
 *   1. `tour_day_plans.needs.dietary` — the A10 checklist the lead guest ticks
 *      in /plan. Already live; this file only widens the vocabulary by two
 *      (`no_shellfish`, `no_nuts`).
 *   2. `dietaryFromSpecialRequests(booking.special_requests ?? notes)` — a
 *      conservative multilingual keyword scan, consulted ONLY when needs carry
 *      nothing. A guest who wrote "no pork please" in the booking form should
 *      not have to re-declare it.
 *   3. The card's own filter chips (client-side, zero network) — those reuse
 *      DIETARY_LABELS from here so the chip text and the stored tag can never
 *      drift apart.
 *
 * `kids` is DERIVED (needs.children > 0) and never stored — it is a ranking
 * preference ("this place has a kids menu"), not a dietary restriction.
 *
 * Pure and client-safe: no DB, no fetch. Read by the chat client.
 */

import type { RoomLocale } from '@/lib/tour-room/snapshot';

/** The 8 storable chips. Superset of the 6 already shipped in /plan A10. */
export const DIETARY_TAGS = [
  'vegetarian',
  'vegan',
  'halal',
  'no_pork',
  'no_seafood',
  'no_shellfish',
  'no_nuts',
  'gluten_free',
] as const;

export type DietaryTag = (typeof DIETARY_TAGS)[number];

/** Derived at read time from needs.children — never written to needs.dietary. */
export const DERIVED_TAGS = ['kids'] as const;
export type DerivedTag = (typeof DERIVED_TAGS)[number];

/** Everything the filter/ranking layer understands. */
export type DietaryFilterTag = DietaryTag | DerivedTag;

export const DIETARY_FILTER_TAGS: readonly DietaryFilterTag[] = [...DIETARY_TAGS, ...DERIVED_TAGS];

export function isDietaryTag(value: unknown): value is DietaryTag {
  return typeof value === 'string' && (DIETARY_TAGS as readonly string[]).includes(value);
}

export function isDietaryFilterTag(value: unknown): value is DietaryFilterTag {
  return typeof value === 'string' && (DIETARY_FILTER_TAGS as readonly string[]).includes(value);
}

/** The `tour_day_plans.needs` jsonb shape this module reads (extras tolerated). */
export interface DietaryNeeds {
  dietary?: unknown;
  allergy_note?: unknown;
  children?: unknown;
  child_ages?: unknown;
  [key: string]: unknown;
}

/**
 * Legacy/loose spellings the checklist or an operator might have written.
 * Normalisation is one-way and conservative — an unknown string is dropped,
 * never guessed into a restriction that would silently hide restaurants.
 */
const TAG_ALIASES: Record<string, DietaryTag> = {
  veggie: 'vegetarian',
  vegetarian: 'vegetarian',
  vegan: 'vegan',
  halal: 'halal',
  no_pork: 'no_pork',
  pork_free: 'no_pork',
  no_seafood: 'no_seafood',
  seafood_free: 'no_seafood',
  no_shellfish: 'no_shellfish',
  shellfish_free: 'no_shellfish',
  no_nuts: 'no_nuts',
  nut_free: 'no_nuts',
  no_nut: 'no_nuts',
  gluten_free: 'gluten_free',
  glutenfree: 'gluten_free',
  no_gluten: 'gluten_free',
};

function normalizeTag(raw: unknown): DietaryTag | null {
  if (typeof raw !== 'string') return null;
  const key = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return TAG_ALIASES[key] ?? null;
}

export interface NeedsDietaryResult {
  /** Normalized, de-duplicated, in DIETARY_FILTER_TAGS order. */
  tags: DietaryFilterTag[];
  /** Verbatim free-text allergy note (the Korean card quotes it as-is). */
  allergyNote: string | null;
  /** Derived from needs.children > 0. */
  kids: boolean;
  children: number;
}

function toCount(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.max(0, Math.floor(raw));
  if (typeof raw === 'string' && raw.trim()) {
    const n = Number(raw.trim());
    if (Number.isFinite(n)) return Math.max(0, Math.floor(n));
  }
  return 0;
}

/**
 * `tour_day_plans.needs` → the filter vocabulary. Never throws on a malformed
 * jsonb blob (needs is guest-authored and historically loose).
 */
export function needsToDietary(needs: DietaryNeeds | null | undefined): NeedsDietaryResult {
  const empty: NeedsDietaryResult = { tags: [], allergyNote: null, kids: false, children: 0 };
  if (!needs || typeof needs !== 'object' || Array.isArray(needs)) return empty;

  const found = new Set<DietaryFilterTag>();
  const raw = Array.isArray(needs.dietary) ? needs.dietary : [];
  for (const entry of raw) {
    const tag = normalizeTag(entry);
    if (tag) found.add(tag);
  }

  const children = toCount(needs.children);
  // child_ages is the more reliable signal when `children` was left blank —
  // a guest who listed "5, 8" clearly has children along.
  const ages = Array.isArray(needs.child_ages) ? needs.child_ages.length : 0;
  const kids = children > 0 || ages > 0;
  if (kids) found.add('kids');

  const note = typeof needs.allergy_note === 'string' ? needs.allergy_note.trim() : '';

  return {
    tags: DIETARY_FILTER_TAGS.filter((tag) => found.has(tag)),
    allergyNote: note || null,
    kids,
    children: children > 0 ? children : ages,
  };
}

/**
 * Unambiguous phrases only — one per tag family, in the languages our guests
 * actually book in (en/ko/ja/es/zh) plus common fr/de.
 *
 * 🔴 Deliberately conservative. A false positive here silently hides
 * restaurants from a guest who never asked for a restriction, and they have no
 * way to know why. So: no bare "vegetal", no "sin" without its object, no
 * standalone "nuts" (matches "doughnuts"). Phrases are matched
 * case-insensitively as substrings on a whitespace-normalized haystack.
 */
const SPECIAL_REQUEST_PATTERNS: Record<DietaryTag, string[]> = {
  vegetarian: [
    'vegetarian', 'no meat', 'meat free', 'meat-free',
    '채식', '베지테리언', 'ベジタリアン', '肉なし',
    'vegetariano', 'vegetariana', 'végétarien', 'vegetarier', 'vegetarisch',
    '素食', '素菜',
  ],
  vegan: ['vegan', '비건', 'ヴィーガン', 'ビーガン', 'vegano', 'vegana', 'végétalien', '纯素', '純素'],
  halal: [
    'halal', 'halaal', '할랄', 'ハラル', 'ハラール', 'muslim friendly', 'muslim-friendly',
    '무슬림', 'musulman', 'clean eating halal', '清真',
  ],
  no_pork: [
    'no pork', 'without pork', 'pork free', 'pork-free', 'cannot eat pork', "can't eat pork",
    '돼지고기 못', '돼지고기 안', '돼지고기 제외', '노 포크',
    '豚肉なし', '豚肉抜き', '豚肉ダメ', '豚肉不可',
    'sin cerdo', 'sans porc', 'kein schweinefleisch', 'ohne schwein',
    '不吃猪肉', '不要猪肉', '無豬肉',
  ],
  no_seafood: [
    'no seafood', 'seafood free', 'seafood-free', 'no fish', 'cannot eat seafood', "can't eat seafood",
    '해산물 못', '해산물 안', '해산물 제외', '생선 못', '생선 안',
    '魚介類なし', '魚介類ダメ', '海鮮なし', '魚だめ',
    'sin mariscos', 'sin pescado', 'sans fruits de mer', 'kein fisch', 'keine meeresfrüchte',
    '不吃海鲜', '不要海鲜', '無海鮮',
  ],
  no_shellfish: [
    'no shellfish', 'shellfish allergy', 'shellfish-free', 'allergic to shellfish',
    'no shrimp', 'shrimp allergy', 'allergic to shrimp', 'crab allergy',
    '조개 알레르기', '갑각류', '새우 알레르기',
    '甲殻類', '貝アレルギー', 'えびアレルギー',
    'alergia a los mariscos', 'allergie aux crustacés', 'schalentierallergie',
    '贝类过敏', '甲壳类过敏', '海鮮過敏',
  ],
  no_nuts: [
    'nut allergy', 'no nuts', 'nut-free', 'nut free', 'allergic to nuts',
    'peanut allergy', 'no peanuts', 'allergic to peanuts',
    '견과류 알레르기', '견과 알레르기', '땅콩 알레르기',
    'ナッツアレルギー', 'ピーナッツアレルギー', '木の実アレルギー',
    'alergia a los frutos secos', 'alergia al cacahuete',
    'allergie aux noix', 'allergie aux arachides', 'nussallergie', 'erdnussallergie',
    '坚果过敏', '花生过敏', '堅果過敏',
  ],
  gluten_free: [
    'gluten free', 'gluten-free', 'glutenfree', 'no gluten', 'celiac', 'coeliac', 'gluten allergy',
    '글루텐', '밀가루 알레르기',
    'グルテンフリー', 'グルテン不使用', 'セリアック',
    'sin gluten', 'sans gluten', 'glutenfrei', 'zöliakie',
    '无麸质', '無麩質', '麸质过敏',
  ],
};

/**
 * Second-priority intake (R-1): scan free text for unambiguous declarations.
 * Returns tags only — the caller decides whether to merge (it must not, when
 * needs already carry something).
 */
export function dietaryFromSpecialRequests(text: unknown): DietaryTag[] {
  if (typeof text !== 'string' || !text.trim()) return [];
  const haystack = text.toLowerCase().replace(/\s+/g, ' ');
  const found = new Set<DietaryTag>();
  for (const tag of DIETARY_TAGS) {
    for (const phrase of SPECIAL_REQUEST_PATTERNS[tag]) {
      if (haystack.includes(phrase)) {
        found.add(tag);
        break;
      }
    }
  }
  // A halal declaration always implies no pork — the exclusion set is the same
  // and stating both makes the card's applied-filter line honest.
  if (found.has('halal')) found.add('no_pork');
  // Vegan implies vegetarian for exclusion purposes.
  if (found.has('vegan')) found.add('vegetarian');
  return DIETARY_TAGS.filter((tag) => found.has(tag));
}

/** Zero-LLM chip labels, 5 room locales. */
export const DIETARY_LABELS: Record<DietaryFilterTag, Record<RoomLocale, string>> = {
  vegetarian: { en: 'Vegetarian', ko: '채식', ja: 'ベジタリアン', es: 'Vegetariano', zh: '素食' },
  vegan: { en: 'Vegan', ko: '비건', ja: 'ヴィーガン', es: 'Vegano', zh: '纯素' },
  halal: { en: 'Halal', ko: '할랄', ja: 'ハラル', es: 'Halal', zh: '清真' },
  no_pork: { en: 'No pork', ko: '돼지고기 제외', ja: '豚肉なし', es: 'Sin cerdo', zh: '不含猪肉' },
  no_seafood: { en: 'No seafood', ko: '해산물 제외', ja: '魚介類なし', es: 'Sin mariscos', zh: '不含海鲜' },
  no_shellfish: { en: 'No shellfish', ko: '조개·갑각류 제외', ja: '貝・甲殻類なし', es: 'Sin crustáceos', zh: '不含贝类' },
  no_nuts: { en: 'No nuts', ko: '견과류 제외', ja: 'ナッツなし', es: 'Sin frutos secos', zh: '不含坚果' },
  gluten_free: { en: 'Gluten-free', ko: '글루텐 프리', ja: 'グルテンフリー', es: 'Sin gluten', zh: '无麸质' },
  kids: { en: 'Kid-friendly', ko: '아이 동반', ja: '子ども連れ', es: 'Para niños', zh: '适合儿童' },
};

/**
 * 🔴 Mandatory on every filtered card (R-4 "배제 우선 semantics").
 *
 * We never assert that a restaurant complies with a restriction — we only
 * remove places that obviously conflict. This line is the honest half of that
 * contract and must render whenever any dietary filter was applied.
 */
export const DIETARY_CAUTION: Record<RoomLocale, string> = {
  en: 'We filtered out obvious conflicts, but please confirm the ingredients with the restaurant yourself.',
  ko: '명백히 맞지 않는 곳은 걸렀지만, 재료는 식당에 직접 확인해 주세요.',
  ja: '明らかに合わないお店は除いていますが、材料はお店で必ずご確認ください。',
  es: 'Hemos descartado los casos evidentes, pero confirma tú mismo los ingredientes en el restaurante.',
  zh: '我们已排除明显不符的店家，但请您亲自向餐厅确认食材。',
};

/** Localized chip label with a safe fallback to the raw tag. */
export function dietaryLabel(tag: string, locale: RoomLocale): string {
  return isDietaryFilterTag(tag) ? DIETARY_LABELS[tag][locale] : tag;
}
