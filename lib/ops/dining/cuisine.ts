/**
 * Cuisine parsing + the exclusion primitive (§5.7 R-4, "배제 우선 semantics").
 *
 * 🔴 The safety principle this whole file exists to enforce:
 *
 *     We EXCLUDE. We never ASSERT compliance.
 *
 * Neither Kakao nor Google can tell us a restaurant is halal, gluten-free, or
 * nut-free. Claiming it would be a fabricated safety guarantee — the single
 * worst failure mode this feature has. So the pipeline only ever *removes*
 * places whose own name or category makes them obviously incompatible
 * ("흑돼지 맛집" for a no-pork guest), and the card always carries
 * DIETARY_CAUTION telling the guest to confirm ingredients themselves.
 *
 * `satisfiesPositively` is the narrow exception: it returns true only when a
 * *verified positive signal* already sits on the row (Google's
 * servesVegetarianFood, or the words 비건/할랄 in the business's own name), and
 * it is used ONLY as a ranking bonus — never as a claim rendered to the guest.
 *
 * Matching is substring-based on a lowercased "name + category" haystack, which
 * biases toward over-exclusion (e.g. the very common Korean syllable 회 for raw
 * fish will also hit a few innocent names). That bias is the correct direction:
 * a guest who wanted seafood loses one option; a guest with an allergy does not
 * get shown a sashimi bar.
 *
 * Pure and client-safe.
 */

import type { DietaryFilterTag, DietaryTag } from '@/lib/ops/dining/dietary';

/** The minimum a place needs to expose to be judged. */
export interface DietaryPlaceLike {
  name?: string | null;
  category_name?: string | null;
  cuisine?: string | null;
  /** Verified positive tags stored on the cache row (see spec §1.2). */
  tags?: string[] | null;
}

/**
 * `'음식점 > 한식 > 해물,생선'` → `'해물,생선'`.
 * Kakao's category_name is a `>`-separated path; the leaf is the only part
 * specific enough to show a guest. Null-safe: returns null for anything that
 * isn't a non-empty string.
 */
export function cuisineLeaf(categoryName: unknown): string | null {
  if (typeof categoryName !== 'string') return null;
  const parts = categoryName
    .split('>')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  const leaf = parts[parts.length - 1];
  // A bare top-level category ("음식점" / "카페") carries no information.
  if (parts.length === 1 && (leaf === '음식점' || leaf === '카페')) return null;
  return leaf || null;
}

/**
 * Obviously-incompatible keywords per restriction.
 *
 * These are *venue-identity* words: a place that puts 흑돼지 or 횟집 in its name
 * or category is built around that ingredient. We do not attempt to reason
 * about individual menu items — that is what DIETARY_CAUTION is for.
 */
export const EXCLUSION_KEYWORDS: Record<DietaryTag, string[]> = {
  // Meat/fish-forward venues. A vegetarian can technically eat at a 갈비집, but
  // recommending one as their meal stop is the wrong answer.
  vegetarian: [
    '고기', '정육', '삼겹', '갈비', '족발', '보쌈', '곱창', '막창', '치킨', '닭갈비', '순대',
    '회', '횟집', '해물', '해산물', '초밥', '장어', '오리',
    'bbq', 'barbecue', 'chicken', 'pork', 'beef', 'meat', 'steak', 'seafood', 'sushi',
  ],
  // Same venues; dairy/egg cannot be detected from a name, hence the caution line.
  vegan: [
    '고기', '정육', '삼겹', '갈비', '족발', '보쌈', '곱창', '막창', '치킨', '닭갈비', '순대',
    '회', '횟집', '해물', '해산물', '초밥', '장어', '오리',
    'bbq', 'barbecue', 'chicken', 'pork', 'beef', 'meat', 'steak', 'seafood', 'sushi',
  ],
  // Halal = the pork set plus alcohol-centric venues. NOTE: passing this filter
  // does NOT make a place halal — nothing here can establish that (see header).
  halal: [
    '돼지', '흑돼지', '족발', '보쌈', '삼겹', '순대', '돈까스', '돈가스', '돈카츠',
    '술집', '호프', '포차', '이자카야', '와인바', '막걸리',
    'pork', 'izakaya',
  ],
  no_pork: [
    '돼지', '흑돼지', '족발', '보쌈', '삼겹', '순대', '돈까스', '돈가스', '돈카츠',
    'pork',
  ],
  no_seafood: [
    '해물', '해산물', '조개', '굴', '전복', '회', '횟집', '물회', '갈치', '고등어',
    '오징어', '새우', '멸치', '장어', '초밥', '어시장',
    'seafood', 'oyster', 'sashimi', 'sushi', 'fish',
  ],
  no_shellfish: [
    '조개', '굴', '전복', '홍합', '바지락', '새우', '랍스터', '대게', '꽃게', '해물',
    'shellfish', 'oyster', 'clam', 'shrimp', 'lobster', 'crab',
  ],
  // Only unambiguous nut words — a bare "nut" would hit "doughnut".
  no_nuts: ['땅콩', '견과', 'peanut', 'walnut', 'almond'],
  // ⚠ ADVISORY ONLY. Korean cooking hides wheat in soy sauce, gochujang, and
  // batter, so a place passing this filter is NOT gluten-free — we merely drop
  // venues whose entire identity is a wheat dish. The caution line does the
  // real work here.
  gluten_free: [
    '국수', '칼국수', '라멘', '라면', '우동', '냉면', '만두', '빵', '베이커리', '제과',
    '파스타', '피자', '분식', '튀김',
    'noodle', 'ramen', 'udon', 'pasta', 'pizza', 'bakery', 'bread', 'dumpling',
  ],
};

function haystack(place: DietaryPlaceLike): string {
  return [place.name, place.category_name, place.cuisine]
    .filter((part): part is string => typeof part === 'string' && part !== '')
    .join(' ')
    .toLowerCase();
}

/**
 * TRUE when the place's name/category matches an exclusion keyword for ANY of
 * the requested tags. This is the hard filter applied before ranking — the SAFE
 * primitive.
 *
 * `kids` is not a restriction and never excludes anything.
 */
export function violatesDietary(place: DietaryPlaceLike, tags: readonly string[] | null | undefined): boolean {
  if (!place || !Array.isArray(tags) || tags.length === 0) return false;
  const text = haystack(place);
  if (!text) return false;

  for (const tag of tags) {
    const keywords = EXCLUSION_KEYWORDS[tag as DietaryTag];
    if (!keywords) continue; // 'kids' and unknown strings never exclude
    for (const keyword of keywords) {
      if (text.includes(keyword)) return true;
    }
  }
  return false;
}

/** The exclusion keywords that actually fired — for admin/debug surfaces. */
export function exclusionReasons(
  place: DietaryPlaceLike,
  tags: readonly string[] | null | undefined,
): Array<{ tag: DietaryTag; keyword: string }> {
  if (!place || !Array.isArray(tags)) return [];
  const text = haystack(place);
  const out: Array<{ tag: DietaryTag; keyword: string }> = [];
  for (const tag of tags) {
    const keywords = EXCLUSION_KEYWORDS[tag as DietaryTag];
    if (!keywords) continue;
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        out.push({ tag: tag as DietaryTag, keyword });
        break;
      }
    }
  }
  return out;
}

/**
 * TRUE only when a VERIFIED POSITIVE signal exists on the row for this tag.
 *
 * Supported for `vegetarian` / `vegan` / `halal` / `kids` only — every other
 * restriction is unverifiable from our sources and always returns false.
 * Used exclusively as a ranking bonus (R-4 dietaryFitBonus); it must never be
 * rendered as "this restaurant is halal".
 */
export function satisfiesPositively(place: DietaryPlaceLike, tag: DietaryFilterTag | string): boolean {
  const tags = Array.isArray(place?.tags) ? place.tags : [];
  if (tags.length === 0) return false;
  switch (tag) {
    case 'vegetarian':
      return tags.includes('vegetarian_friendly') || tags.includes('vegan');
    case 'vegan':
      return tags.includes('vegan');
    case 'halal':
      return tags.includes('halal');
    case 'kids':
      return tags.includes('kids_ok');
    default:
      return false;
  }
}
