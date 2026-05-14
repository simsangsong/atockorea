/**
 * Consumers list filters use `inferTourCatalogType`; keep this in ONE place together
 * with GET /api/tours so badges and filtering never drift apart.
 */

export type TourCatalogType = "private" | "join" | "bus";

const KNOWN_BUS_TOUR_SLUGS = new Set([
  "busan-gyeongju-unesco-legacy-tour-national-museum",
  "busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju",
  "busan-spring-cherry-blossom-gyeongju-highlights-day-tour",
  "busan-top-attractions-day-tour",
  "jeju-cruise-shore-excursion-bus-tour",
  "seoul-seoraksan-national-park-sokcho-beach-day-trip",
  "seoul-suwon-hwaseong-folk-village-starfield-library",
  "seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library",
]);

/**
 * Product detail profiles mark these as `vehicle_type: coach` / `vehicle_type_legacy: bus_coach`.
 * They are fixed-route join products, but should be surfaced as bus/coach tours rather than
 * small-group minicoach products.
 */
export function isKnownBusTourSlug(slug: string | undefined | null): boolean {
  const s = (slug ?? "").trim().toLowerCase();
  if (!s) return false;
  return KNOWN_BUS_TOUR_SLUGS.has(s);
}

/**
 * SKUs shipped as curated small-group / join rails (titles vary by locale).
 */
export function isKnownJoinTourSlug(slug: string | undefined | null): boolean {
  const s = (slug ?? "").trim().toLowerCase();
  if (!s) return false;
  if (s === "east-signature-nature-core") return true;
  if (s.startsWith("east-signature-nature-core-")) return true;
  if (s === "east-jeju-signature-small-group") return true;
  if (s.startsWith("east-jeju-signature-small-group-")) return true;
  if (s === "jeju-east-small-group-template-preview") return true;
  if (s === "busan-top-attractions-authentic-one-day-tour") return true;
  if (s === "busan-city-tour-shore-excursion-cruise-guests") return true;
  if (s === "jeju-grand-highlights-loop") return true;
  if (s.startsWith("jeju-grand-highlights-loop-")) return true;
  return false;
}

export function tagIndicatesSmallGroupJoin(tag: string | undefined | null): boolean {
  const t = (tag ?? "").trim().toLowerCase();
  if (!t) return false;
  return /small\s*group|소그룹|拼团|少人数|grupo\s*pequeño|small-group/i.test(t);
}

export function titleForCatalogType(title: string, type: TourCatalogType): string {
  if (type === "join") return title;
  const cleanTitle = title.replace(/\s*(?:\u00b7|-)?\s*Small[- ]Group(?:\s*Tour)?\s*$/i, "").trim();
  if (type !== "bus") return cleanTitle || title;
  if (/\b(?:bus|coach)\b/i.test(cleanTitle)) return cleanTitle;
  return `${cleanTitle || title} \u00b7 Bus Tour`;
}

export function tagsForCatalogType(tags: string[], type: TourCatalogType): string[] {
  if (type === "join") return tags;
  return tags.filter((tag) => !/\bsmall\s*[- ]?\s*group\b/i.test(String(tag)));
}

function badgeIndicatesSmallGroup(badges: string[]): boolean {
  return badges.some((b) =>
    /\bsmall\s*group\b|소그룹|少人数|精品小团|小团|小團|拼团/i.test(String(b)),
  );
}

function titleIndicatesSmallGroup(title: string): boolean {
  const t = title.toLowerCase();
  return (
    /\bsmall\s*[- ]?\s*group\b/i.test(title) ||
    /\bsemi[- ]\s*f\.?\s*i\.?\s*t\.?\b/i.test(title) ||
    /\bout[\s-]*travel/i.test(title) ||
    /소그룹|精品小团|小团一日游|拼团|少人数/i.test(title) ||
    /\b(grupo\s*pequeño|grupo\s*reducido)\b/i.test(t) ||
    /east\s*signature\s*nature\s*core/i.test(t) ||
    /동부\s*시그니처|시그니처\s*네이처|네이처\s*코어/.test(title) ||
    /grand\s+highlights\s+loop/i.test(t)
  );
}

/** Scheduled large-format / coach tours — distinguish from accidental "join our tour" wording. */
function titleIndicatesClassicBusTour(title: string, slug?: string): boolean {
  const s = slug?.trim().toLowerCase() ?? "";
  if (/-bus-tour\b|\bbus\s*coach\b|\bcoach\s*tour\b/i.test(s)) return true;
  const t = title.toLowerCase();
  return (
    /\bclassic\s*(south\s*)?bus\b/i.test(t) ||
    /\b(bus|coach)\s*(day\s*)?tour\b/i.test(t) ||
    /\bbest[- ]value\s*bus\b/i.test(t) ||
    /\b버스\b.*\b(투어|일주|관광)\b|\b관광\s*버스\b|\b교통편\b.*\b버스\b/.test(title) ||
    /\b(shared\s*)?(coach|shuttle)\s+tour\b/i.test(t)
  );
}

function badgeIndicatesClassicBusTour(badges: string[]): boolean {
  return badges.some((b) =>
    /\blarge\s*coach\b|\bcoach\b|\bbus\s*tour\b|\bclassic\s*bus\b|\bbudget\s*cruise\b/i.test(String(b)),
  );
}

export function inferTourCatalogType(item: {
  title?: string;
  badges?: string[];
  slug?: string | null;
  tag?: string | null;
  priceType?: string | null;
  groupSize?: string | null;
}): TourCatalogType {
  const slug = typeof item.slug === "string" ? item.slug.trim() : undefined;
  const title = typeof item.title === "string" ? item.title.trim() : "";
  const badges = Array.isArray(item.badges) ? item.badges.map((b) => String(b)) : [];
  const tag = typeof item.tag === "string" ? item.tag : null;
  const priceType = typeof item.priceType === "string" ? item.priceType.trim().toLowerCase() : "";
  const groupSize = typeof item.groupSize === "string" ? item.groupSize.trim().toLowerCase() : "";

  if (isKnownBusTourSlug(slug)) return "bus";
  if (isKnownJoinTourSlug(slug)) return "join";

  const smallGroupCue = titleIndicatesSmallGroup(title) || badgeIndicatesSmallGroup(badges);
  const privateCue =
    priceType === "vehicle" ||
    priceType === "group" ||
    /private|charter|customi[sz]able|exclusive/i.test(title) ||
    /private|charter|customi[sz]able|exclusive/i.test(groupSize) ||
    badges.some((b) => /private|charter|customi[sz]able|exclusive/i.test(String(b)));

  if (privateCue) return "private";

  if (titleIndicatesClassicBusTour(title, slug) || badgeIndicatesClassicBusTour(badges)) {
    return "bus";
  }

  if (tagIndicatesSmallGroupJoin(tag)) return "join";

  if (
    /private|프라이빗|私人|プライベート|privado|전용\b|包车|包車/i.test(title) ||
    badges.some((b) =>
      /\bprivate\b|프라이빗|私人|プライベート|privado|전용|包车|包車/i.test(String(b)),
    )
  ) {
    if (!smallGroupCue && !badgeIndicatesSmallGroup(badges)) return "private";
  }

  if (smallGroupCue) return "join";

  return "bus";
}

/** Expand dropdown / URL city labels to concrete `tours.city` values used in legacy rows. */
export function expandDestinationCsvForCityInFilter(csv: string): string[] {
  const trimmed = csv.trim();
  if (!trimmed) return [];
  const out = new Set<string>();
  const groups: Record<string, string[]> = {
    Seoul: ["Seoul", "서울"],
    Busan: ["Busan", "부산"],
    Jeju: ["Jeju", "제주"],
  };

  const expandOne = (raw: string): void => {
    const p = raw.trim();
    if (!p) return;
    const keyHit = Object.keys(groups).find(
      (k) =>
        k.toLowerCase() === p.toLowerCase() ||
        groups[k]!.some((v) => v.toLowerCase() === p.toLowerCase()),
    );
    if (keyHit) {
      groups[keyHit]!.forEach((v) => out.add(v));
    } else {
      out.add(p);
    }
  };

  for (const segment of trimmed.split(",")) expandOne(segment);
  return [...out];
}
