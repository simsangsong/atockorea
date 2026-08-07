/**
 * Pure catalog-registration builder — extracted from
 * `staticTourCatalogCards.ts` (D1, 2026-07-05) so the lazy per-locale client
 * path (`staticTourCatalogCards.lazy.ts`) can build registrations WITHOUT
 * importing the combined 6-locale generated data module.
 *
 * 🔴 SLUG_OVERRIDES is a real pricing surface (see the tour price/type change
 * runbook), and this header used to claim it "lives HERE and only here". That
 * is not true and was not true when it was written: a second copy sits in
 * `staticTourProductRegistry.ts` (search SLUG_OVERRIDES). Both are read — this
 * one by the lazy per-locale client path, that one by the combined registry —
 * so a price changed in one and not the other ships two different numbers to
 * two different surfaces. Change both, and do not trust this comment over a
 * grep. Corrected 2026-08-07 while repricing the Seoraksan products, where the
 * two copies did agree only because nobody had edited either since seeding.
 */

import { isTourSlugBlockedFromConsumerSurfaces } from "@/lib/tour-consumer-visibility";
import type { SlimCatalogPage } from "./catalogCards.generated";

export type StaticTourProductRegistration = {
  slug: string;
  title: string;
  subtitle: string;
  region: string;
  duration: string;
  stopsCount: number;
  rating: number;
  reviewCount: number;
  badges: readonly string[];
  heroImage: string;
  thumbnail: string;
  priceLabel: string;
  shortCardDescription: string;
  listPriceUsd: number;
  compareAtPriceUsd?: number;
  maxGroupSize?: number;
};

/** Locale-invariant per-slug overrides — kept in sync with the heavy registry. */
type SlugOverride = {
  listPriceUsd?: number;
  compareAtPriceUsd?: number;
  maxGroupSize?: number;
};

const SLUG_OVERRIDES: Record<string, SlugOverride> = {
  "east-signature-nature-core": { listPriceUsd: 59, compareAtPriceUsd: 69, maxGroupSize: 8 },
  "jeju-grand-highlights-loop": { listPriceUsd: 93, maxGroupSize: 8 },
  "southwest-hallasan-osulloc-aewol": { listPriceUsd: 49, maxGroupSize: 8 },
  "busan-gyeongju-unesco-legacy-tour-national-museum": { listPriceUsd: 39, compareAtPriceUsd: 50, maxGroupSize: 8 },
  // Klook prep 2026-06-29: +$5 sale price, discount REMOVE (compareAtPriceUsd dropped).
  // Busan cruise shore-excursion trio, 2026-08-04: priced to match the channel
  // listings exactly, to the cent. Keep in lockstep with `staticTourProductRegistry.ts`.
  "busan-cruise-shore-excursion-bus-tour": { listPriceUsd: 58.79 },
  "busan-small-group-sightseeing-tour-cruise-passengers": { listPriceUsd: 68.95, maxGroupSize: 12 },
  // Rate-card minimum (5h, 1–6 pax) — see staticTourProductRegistry.ts.
  "busan-private-car-charter-cruise-shore": { listPriceUsd: 169, maxGroupSize: 14 },
  "busan-top-attractions-day-tour": { listPriceUsd: 34, maxGroupSize: 12 },
  "from-busan-gyeongju-ancient-capital-day-tour": { listPriceUsd: 39, compareAtPriceUsd: 50, maxGroupSize: 8 },
  "from-incheon-seoul-day-tour-cruise-guests": { listPriceUsd: 69, compareAtPriceUsd: 76, maxGroupSize: 8 },
    // 419 = the flat cell on this charter's rate card. The two SLUG_OVERRIDES
  // copies disagreed (419 here vs 424 there), so the same product quoted two
  // prices depending on which surface loaded. maxGroupSize 14 = two vehicles of
  // seven, matching the 1–7 / 8+ rule (owner 2026-08-07).
  "incheon-seoul-private-car-shore-excursion-cruise": { listPriceUsd: 419, maxGroupSize: 14 },
  "jeju-cherry-blossom-tour-east-route": { listPriceUsd: 59, compareAtPriceUsd: 69, maxGroupSize: 8 },
  "jeju-cruise-shore-excursion-bus-tour": { listPriceUsd: 59 },
  "jeju-cruise-shore-excursion-small-group-tour": { listPriceUsd: 77, maxGroupSize: 8 },
  "jeju-eastern-unesco-spots-day-tour": { listPriceUsd: 49, compareAtPriceUsd: 59, maxGroupSize: 8 },
  "jeju-hydrangea-festival-tour-east-route": { listPriceUsd: 64, maxGroupSize: 8 },
  "jeju-hydrangea-festival-tour-southwest-route": { listPriceUsd: 64, maxGroupSize: 8 },
  "jeju-southern-top-unesco-spots-tour": { listPriceUsd: 49, compareAtPriceUsd: 69, maxGroupSize: 8 },
  "jeju-west-south-full-day-authentic-tour": { listPriceUsd: 59, compareAtPriceUsd: 69, maxGroupSize: 8 },
  "jeju-winter-southwest-tangerine-snow-camellia-tour": { listPriceUsd: 59, compareAtPriceUsd: 69, maxGroupSize: 8 },
  "pocheon-sanjeong-lake-herb-island-art-valley": { listPriceUsd: 54, maxGroupSize: 8 },
  "seoul-dmz-private-3rd-tunnel-suspension-bridge": { listPriceUsd: 419, maxGroupSize: 15 },
  "seoul-private-nami-morning-calm-petite-france": { listPriceUsd: 194 },
  // Repriced 2026-08-07 from the operator's own Klook listings (owner
  // screenshots) at the day's rate, 1 USD = 1,429 KRW:
  //   ₩80,000 → $55.98 → $56   ₩113,000 → $79.08 → $79
  // compareAtPriceUsd is scaled to keep the discount the owner had set
  // (8.6% → 8.2%), not re-invented. ⚠ The same map exists in
  // `staticTourProductRegistry.ts` — change both or the two disagree.
  "seoul-seoraksan-naksansa-temple-naksan-beach-day-trip": { listPriceUsd: 56, compareAtPriceUsd: 61, maxGroupSize: 8 },
  "seoul-seoraksan-nami-island-morning-calm-day-tour": { listPriceUsd: 79, maxGroupSize: 8 },
  "seoul-seoraksan-national-park-sokcho-beach-day-trip": { listPriceUsd: 49, compareAtPriceUsd: 57, maxGroupSize: 8 },
  "seoul-suburbs-private-chartered-car-10hr": { listPriceUsd: 184, maxGroupSize: 13 },
  "seoul-suwon-hwaseong-folk-village-starfield-library": { listPriceUsd: 60, compareAtPriceUsd: 66, maxGroupSize: 8 },
  "seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library": { listPriceUsd: 53, compareAtPriceUsd: 59, maxGroupSize: 8 },
  "seoul-suwon-hwaseong-waujeongsa-starfield": { listPriceUsd: 51, compareAtPriceUsd: 54, maxGroupSize: 8 },
  // New products 2026-08-04. maxGroupSize 40 (owner, 2026-08-04) — these are
  // join-in coach tours, so the 8-guest small-group cap the private products
  // carry would be a false claim; 40 is the coach capacity the operator lists.
  "seoul-gapyeong-nami-morning-calm-petite-france-day-tour": { listPriceUsd: 59, maxGroupSize: 40 },
  "seoul-winter-seoraksan-nami-eobi-ice-valley-day-tour": { listPriceUsd: 69, maxGroupSize: 40 },
};

/** Cents-precise — mirrors `parseListPriceUsd` in `staticTourProductRegistry.ts`. */
function parseListPriceUsd(page: SlimCatalogPage | undefined): number {
  if (!page) return 0;
  const amountLabel = page.price?.amountLabel ?? "";
  if (amountLabel) {
    const n = Number(amountLabel.replace(/[^0-9.]/g, ""));
    if (Number.isFinite(n) && n > 0) return Math.round(n * 100) / 100;
  }
  const priceLabel = page.catalog_card.priceLabel ?? "";
  const m = priceLabel.match(/(\d+(?:\.\d+)?)/);
  if (m) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > 0) return Math.round(n * 100) / 100;
  }
  return 0;
}

export function buildRegistrationFromMaps(
  slug: string,
  localeMap: Record<string, SlimCatalogPage>,
  enMap: Record<string, SlimCatalogPage>,
): StaticTourProductRegistration | null {
  const localePage = localeMap[slug] ?? enMap[slug];
  if (!localePage) return null;
  const cc = localePage.catalog_card;
  const override = SLUG_OVERRIDES[slug] ?? {};
  return {
    slug: cc.slug,
    title: cc.title,
    subtitle: cc.subtitle,
    region: cc.region,
    duration: cc.duration,
    stopsCount: cc.stopsCount,
    rating: cc.rating,
    reviewCount: cc.reviewCount,
    badges: cc.badges,
    heroImage: cc.heroImage,
    thumbnail: cc.thumbnail,
    priceLabel: cc.priceLabel,
    shortCardDescription: cc.shortCardDescription,
    listPriceUsd: override.listPriceUsd ?? parseListPriceUsd(enMap[slug]),
    compareAtPriceUsd: override.compareAtPriceUsd,
    maxGroupSize: override.maxGroupSize,
  };
}

/** Build the full consumer-visible list for one locale (blocked slugs filtered). */
export function buildCatalogRegistrations(
  slugOrder: readonly string[],
  localeMap: Record<string, SlimCatalogPage>,
  enMap: Record<string, SlimCatalogPage>,
): readonly StaticTourProductRegistration[] {
  return slugOrder
    .map((slug) => buildRegistrationFromMaps(slug, localeMap, enMap))
    .filter(
      (r): r is StaticTourProductRegistration =>
        r !== null && !isTourSlugBlockedFromConsumerSurfaces(r.slug),
    );
}
