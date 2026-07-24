/**
 * W4.3 / F1 — the Korean restaurant card generator (BRIDGE+CARD).
 *
 * Turns the A10 needs checklist into polite Korean lines the guest can show
 * restaurant staff. Pure string building, zero LLM — the dietary vocabulary
 * is fixed and the free-text allergy note is quoted verbatim (guides see the
 * same needs in the console and can interpret).
 */

export const ALLERGY_CARD_HEADER = '🙏 식당 직원분께 — 저희 손님 식사 안내';

const DIETARY_KO: Record<string, string> = {
  vegetarian: '채식주의자입니다 — 고기와 생선을 드시지 않습니다.',
  vegan: '비건(완전 채식)입니다 — 고기·생선·계란·유제품 모두 드시지 않습니다.',
  halal: '할랄 식사만 가능합니다 — 돼지고기와 술(알코올)이 들어가면 안 됩니다.',
  no_pork: '돼지고기를 드시지 않습니다.',
  no_seafood: '해산물(생선·조개·새우 등)을 드시지 않습니다.',
  // §5.7 R-1 — the two chips the dining RAG added to the A10 checklist.
  // Shellfish and nut reactions are the ones that turn severe fastest, so both
  // lines name the hidden sources Korean kitchens actually use.
  no_shellfish: '조개·갑각류(새우·게·조개·굴 등) 알레르기가 있습니다 — 육수에도 들어가지 않도록 부탁드립니다.',
  no_nuts: '견과류(땅콩·호두·잣 등) 알레르기가 있습니다 — 고명이나 소스에도 들어가지 않도록 부탁드립니다.',
  gluten_free: '글루텐(밀가루)을 드시지 못합니다 — 밀가루·간장 확인 부탁드립니다.',
};

const CLOSER = '재료를 확인해 주시면 감사하겠습니다!';

export interface AllergyCardNeeds {
  dietary?: string[] | null;
  allergy_note?: string | null;
  [key: string]: unknown;
}

/** null when the needs carry nothing dietary — the card simply doesn't exist. */
export function koreanAllergyCardLines(needs: AllergyCardNeeds | null | undefined): string[] | null {
  if (!needs || typeof needs !== 'object') return null;
  const lines: string[] = [];
  const dietary = Array.isArray(needs.dietary) ? needs.dietary : [];
  for (const tag of dietary) {
    if (typeof tag === 'string' && DIETARY_KO[tag]) lines.push(DIETARY_KO[tag]);
  }
  const note = typeof needs.allergy_note === 'string' ? needs.allergy_note.trim() : '';
  if (note) {
    lines.push(`⚠ 알레르기: ${note}`);
    lines.push('알레르기 반응이 심할 수 있으니 해당 재료가 들어가지 않도록 부탁드립니다.');
  }
  if (lines.length === 0) return null;
  return [ALLERGY_CARD_HEADER, ...lines, CLOSER];
}
