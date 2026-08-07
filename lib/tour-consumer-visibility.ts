import { STATIC_TOUR_PRODUCT_BUNDLE_SLUGS } from "@/components/product-tour-static/_shared/tourProductBundleSlugs";
import {
  CANONICAL_EAST_JEJU_SIGNATURE_SMALL_GROUP_SLUG,
  matchesEastSignatureSlugSegment,
} from "@/src/lib/east-signature-nature-core-match";

/**
 * Consumer blocklist for legacy `/tour/[id]` rows (and matching slugs).
 * Do not wire new UI to `data/tours` or `TourCardDetail` — see `.cursor/rules/legacy-isolated-tour-surfaces.mdc` and `eslint.config.mjs`.
 */

/** Public detail page for the flagship East Signature product. */
export const CANONICAL_EAST_SIGNATURE_PRODUCT_PATH = "/tour-product/east-signature-nature-core";

/** Public detail page for the Jeju Grand Highlights Loop product (JSON-driven). */
export const CANONICAL_JEJU_GRAND_PRODUCT_PATH = "/tour-product/jeju-grand-highlights-loop";

/** Public detail page for the Southwest (Hallasan → O'Sulloc → Aewol) product (JSON-driven). */
export const CANONICAL_SOUTHWEST_PRODUCT_PATH = "/tour-product/southwest-hallasan-osulloc-aewol";

/**
 * Single slug we keep in GET /api/tours (and derived cards). Other East Signature–family
 * rows are duplicate/legacy marketing SKUs for the same experience.
 */
export const CANONICAL_EAST_SIGNATURE_CATALOG_SLUG = "east-signature-nature-core";

/** Slug of the Jeju Grand Highlights Loop flagship row in `tours`. */
export const CANONICAL_JEJU_GRAND_CATALOG_SLUG = "jeju-grand-highlights-loop";

/** Slug of the Southwest flagship row in `tours`. */
export const CANONICAL_SOUTHWEST_CATALOG_SLUG = "southwest-hallasan-osulloc-aewol";

/**
 * Slug aliases that resolve to a canonical `/tour-product/<other-slug>` page —
 * for legacy / variant SKUs whose alias slug isn't itself a registered bundle
 * but should still land on a flagship's detail surface.
 *
 * Bundle-registered slugs (see `STATIC_TOUR_PRODUCT_BUNDLE_SLUGS`) resolve
 * automatically and must NOT be listed here. Only add aliases whose canonical
 * target slug differs from the alias slug.
 */
export const FLAGSHIP_SLUG_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  /** Live East small-group SKU shares the flagship East Signature detail page. */
  [CANONICAL_EAST_JEJU_SIGNATURE_SMALL_GROUP_SLUG]: CANONICAL_EAST_SIGNATURE_PRODUCT_PATH,
});

/**
 * Returns the `/tour-product/[slug]` path when the row should redirect away from
 * `/tour/[id]`. Resolves explicit aliases first, then falls through to the
 * static bundle registry — every registered bundle gets a canonical link
 * automatically, so adding a new product to the registry is enough.
 */
export function canonicalProductPathForSlug(slug: string | null | undefined): string | null {
  if (slug == null || typeof slug !== "string") return null;
  const s = slug.trim().toLowerCase();
  if (!s) return null;
  const aliased = FLAGSHIP_SLUG_ALIASES[s];
  if (aliased) return aliased;
  if (STATIC_TOUR_PRODUCT_BUNDLE_SLUGS.has(s)) {
    return `/tour-product/${s}`;
  }
  return null;
}

/**
 * Legacy / duplicate `tours.id` values that must never appear on consumer surfaces:
 * lists, search, sitemap, `/tour/[id]`, availability, or internal links to `/tour/...`.
 * Admin PATCH/DELETE on `/api/tours/[id]` still works.
 *
 * Includes the “seven tours” bundle (scripts/i18n/seven-tours-bundle.mjs) — legacy `/tour/[id]`
 * SKUs being retired in favor of future small-group–style product pages.
 */
export const CONSUMER_BLOCKED_TOUR_IDS = new Set<string>([
  "97877063-e982-4754-a4d9-daa8688a5455",
  "59877dce-5425-42f4-bd59-cc4e816fdc39",
  "0288eb78-b741-4bcf-821f-523518906753",
  "d7187d55-a482-4d5c-9d5a-ab6992448d82",
  "dd4a604c-e328-4d24-b060-f6f4e31266ad",
  "357e63a6-59fd-4e55-a5f7-11d766ed1aa5",
  "b0bd462c-a1a8-4ec6-92d7-f275335f8762",
  "592ac1da-9ea2-4ac0-8cd5-26efbbf75699",
]);

/**
 * Exact slugs removed from the public catalog (same policy as blocked ids).
 * Also see `isTourSlugBlockedFromConsumerSurfaces` for timestamped / scripted variants.
 */
export const CONSUMER_BLOCKED_TOUR_SLUGS = new Set<string>([
  "busan-top-attractions-authentic-one-day-guided-tour",
  "jeju-southern-top-unesco-spots-bus-tour",
  "jeju-island-full-day-tour-cruise-passengers",
  "jeju-eastern-unesco-spots-bus-tour",
  "east-jeju-signature-small-group",
  // Deactivated 2026-06-24 (product decision) — hidden from list + all consumer
  // surfaces (chatbot catalog, home). DB is_active=false also removes them from
  // /api/tours + the matcher (match_tours rows deleted).
  "east-signature-nature-core",
  "jeju-west-south-full-day-authentic-tour",
  // Retired 2026-05-23 — overlapped with from-busan-gyeongju-ancient-capital-day-tour
  // (same Busan→Gyeongju route, same $39 price). Keeping the small-group variant active.
  "busan-gyeongju-unesco-legacy-tour-national-museum",
  // Seoul re-activated 2026-06-21 (was Paused 2026-05-25 pending operator re-vetting).
  // All 11 Seoul-region day tours back online per product decision; DB is_active was
  // already true (the 2026-05-25 "Mirrors is_active=false" note was stale — the pause
  // was enforced by this blocklist + the landing-planner Seoul gate only).
  //
  // ── Klook onboarding prep 2026-06-29 ──────────────────────────────────────
  // Catalog narrowed to exactly 12 active SKUs for the Klook listing. The
  // slugs below are hidden from every consumer surface (chatbot catalog, home,
  // sitemap, agent channel, matcher) AND set is_active=false / is_published=false
  // in the AtoC DB (migration 20260629000000_klook_prep_activate_12_tours.sql).
  // Reversible: remove a slug here + flip its DB flags back to re-list it.
  //
  // ── Jeju course revision 2026-08-04 (owner instruction) ───────────────────
  // Hydrangea season SKUs retired (added below); the three regional Jeju day
  // tours re-opened (removed from this list): jeju-eastern-unesco-spots-day-tour
  // (re-coursed Manjanggul→Seongeup→lunch→Seongsan→haenyeo→Hamdeok),
  // jeju-southern-top-unesco-spots-tour, southwest-hallasan-osulloc-aewol.
  // DB half staged in supabase/pending-db-apply/2026-08-04-*.sql.
  "jeju-hydrangea-festival-tour-east-route",
  "jeju-hydrangea-festival-tour-southwest-route",
  // ── Busan cruise shore-excursion trio re-opened 2026-08-04 (owner instruction) ──
  // busan-cruise-shore-excursion-bus-tour was hidden by the 2026-06-29 Klook
  // 12-SKU narrowing. All three Busan cruise SKUs are now priced to match their
  // channel listings exactly, so the join-in tier has to be sellable again.
  // DB half staged in supabase/pending-db-apply/ — is_active/is_published must be
  // flipped back for this slug or the row stays dark on /api/tours.
  "busan-outskirts-tongdosa-amethyst-yeongnam-day-tour",
  "busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju",
  "busan-spring-cherry-blossom-gyeongju-highlights-day-tour",
  // ── Gyeongju re-opened 2026-08-04 (owner decision) ────────────────────────
  // The from-busan-gyeongju-ancient-capital-day-tour slug was removed from this
  // list. (Deliberately written without quotes: a naive scraper that greps this
  // file for quoted slugs would otherwise read the slug back OUT of this comment
  // and believe it is still blocked — that happened once while writing this.)
  // It was narrowed out for the Klook 12-SKU listing on 2026-06-29, then re-coursed
  // on 2026-08-04 (Ahopsan → Bulguksa → lunch → Gyochon+Choi+Woljeonggyo →
  // Daereungwon+Hwangnidan-gil → National Museum, or Donggung & Wolji by night
  // in Nov–Feb). This is the repo half; the DB half is
  // supabase/pending-db-apply/applied/2026-08-04-10-gyeongju-reopen.sql, which
  // flips tours.is_active and the six tour_product_pages.is_published flags that
  // file 07 deliberately left alone. Both halves are needed to put it on sale.
  //
  // 🔴 Re-opened at the UNCHANGED price: USD 39 (compare-at 50) for what is now
  // an 11.5-hour day ending ≈19:50 — it was 10.5 hours when that price was set.
  // Repricing was not part of the re-open instruction; flagged, not assumed.
  // ── Winter/Eobi OPENED 2026-08-07 (owner: "겨울 어비는 12월부터 시작이 맞아") ──
  //
  // It sat here from 2026-08-04 because its ops note says "do not open
  // year-round sales" and nothing in the app read `matching_profile.seasonality`
  // — a winter_only flag with no consumer stops nothing by itself. That gap is
  // now closed properly rather than by hiding the product: the season is a real
  // rule in `lib/tour-seasonal-windows.ts` (20 Dec – 28 Feb, from the operator's
  // own listing title) and all four booking-decision surfaces read it, so a
  // July date is refused by the calendar, the API, the create route and the
  // chatbot alike. Weekdays (Mon/Wed/Fri) are in `tour-departure-days.ts` and in
  // all ten bundles. Both were verified against the owner's Klook calendars.
  //
  // The measurement that made this line necessary is worth keeping, because it
  // is the reason a DB flag alone is not "closed" and not "open" either:
  //
  //      surface              is_active=false alone   + this list
  //      /api/tours           absent (17 entries)     absent
  //      /tours/list card     PRESENT                 absent
  //      /tour-product page   renders (349 KB)        404
  //
  // So this list retires a product from view, while `tours.is_active` only stops
  // the sale. Anything not for sale needs both; anything for sale needs neither.
  "jeju-cherry-blossom-tour-east-route",
  "jeju-cruise-shore-excursion-bus-tour",
  "jeju-winter-southwest-tangerine-snow-camellia-tour",
  "from-incheon-seoul-day-tour-cruise-guests",
  "seoul-dmz-private-3rd-tunnel-suspension-bridge",
  //
  // ── Suwon three + Gangwon/Seoraksan three re-opened 2026-08-07 (owner) ────
  // Six slugs removed from this list. They were hidden by the 2026-06-29 Klook
  // 12-SKU narrowing, not by anything wrong with the products. The DB half —
  // tours.is_active plus the six tour_product_pages.is_published rows each —
  // was flipped in the same change; both halves are needed, and re-blocking
  // either one alone puts the pair back out of step. Removed:
  //   seoul-suwon-hwaseong-folk-village-starfield-library      (Mon/Thu/Sat)
  //   seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library  (Sun/Wed/Fri)
  //   seoul-suwon-hwaseong-waujeongsa-starfield                (Tue/Thu/Sat)
  //   seoul-seoraksan-naksansa-temple-naksan-beach-day-trip    (Mon/Thu)
  //   seoul-seoraksan-nami-island-morning-calm-day-tour        (Mon/Wed/Fri)
  //
  // Sokcho was briefly re-opened with them and is closed again below — see its
  // own entry. The Seoraksan set the owner actually sells is the three with
  // Klook calendars: Naksansa, Morning Calm, and the winter Eobi trip.
  //
  // 🔴 One thing a later session will be tempted to "fix" — don't:
  //
  //    Every fixed-schedule product here carries its weekdays in BOTH
  //    `lib/tour-departure-days.ts` and each bundle's `departureWeekdays`.
  //    Both are load-bearing: the table is what the availability routes and the
  //    booking route read, the bundle is what the picker falls back to when the
  //    availability fetch fails (it fails open). Opening a fixed-schedule
  //    product with only one of them is what
  //    `__tests__/audit/departureWeekdays.test.ts` now fails on.
  //
  // 🔴 This block first shipped saying "The Seoraksan three have no schedule
  // entry, which is correct — nothing says they are anything but daily
  // on-demand". That was false, and it was false at the moment it was written:
  // the owner had already sent the Klook calendars showing Naksansa on Mon/Thu
  // and Morning Calm on Mon/Wed/Fri. The claim was reasoned from the absence of
  // a row in the schedule table rather than from the source, so for a few hours
  // these two were live and selling days they do not run. An empty table is not
  // evidence that a product runs daily — it is only evidence that nobody
  // entered it.
  //
  // ── Sokcho closed again 2026-08-07 (owner) ────────────────────────────────
  // It was re-opened earlier the same day as one of "the Seoraksan three", but
  // asked about it the owner said they do not recognise the product
  // ("속초는 무슨 투어를 얘기하는건지 모르겠네") and to sell only the three that
  // have Klook calendars — Naksansa, Morning Calm, winter Eobi.
  //
  // That fits everything else known about it: no Klook listing, no screenshot,
  // no schedule, and a 2026-05-14 note saying it was replaced by
  // naksansa-temple-naksan-beach. It was live for a few hours at $49 with no
  // weekday rule, which is exactly the state a product nobody is operating
  // should never be in. `tours.is_active` and its six `is_published` rows are
  // flipped back with this. Its price and content are left untouched so
  // re-opening is one line here plus the DB flags, should it turn out to be a
  // real SKU under a name the owner uses for something else.
  "seoul-seoraksan-national-park-sokcho-beach-day-trip",
  // ── Retired 2026-08-07 (owner instruction, from the live /tours/list) ──────
  // Two products taken off sale while the de/fr/it/ru translation track opens
  // the remaining live catalogue. Both halves flipped in the same breath, since
  // the DB flag alone leaves the card on /tours/list (see the measured table
  // above): tours.is_active=false + every tour_product_pages.is_published=false.
  //
  // Translation is deliberately NOT done for these two — the owner's rule is
  // that anything already private, or on its way private, waits. Only the live
  // catalogue gets the four locales, and the URL gate opens once that set is
  // complete. Re-opening either one therefore also re-opens a translation gap.
  //
  // Re-open = remove the line here AND flip both DB flags back.
  "seoul-private-nami-morning-calm-petite-france",
  "pocheon-sanjeong-lake-herb-island-art-valley",
]);

function normalizeTourIdForBlocklist(id: string): string {
  return id.trim().toLowerCase();
}

/** True when this `tours.id` must be hidden from every consumer-facing flow. */
export function isTourIdBlockedFromConsumerSurfaces(tourId: string | null | undefined): boolean {
  if (tourId == null || typeof tourId !== "string") return false;
  return CONSUMER_BLOCKED_TOUR_IDS.has(normalizeTourIdForBlocklist(tourId));
}

function normalizeSlugForBlocklist(slug: string): string {
  return slug.trim().toLowerCase();
}

/**
 * Block legacy rows by `tours.slug` when ids differ per environment, and scripted
 * `*-timestamp` variants (private Busan / Jeju car charter).
 */
export function isTourSlugBlockedFromConsumerSurfaces(slug: unknown): boolean {
  if (slug == null || typeof slug !== "string") return false;
  const s = normalizeSlugForBlocklist(slug);
  if (!s) return false;
  if (CONSUMER_BLOCKED_TOUR_SLUGS.has(s)) return true;
  if (s.startsWith("private-busan-tour-discover-top-sights")) return true;
  if (s.startsWith("jeju-private-car-charter-tour")) return true;
  if (s.startsWith("busan-top-attractions-authentic-one-day-guided-tour")) return true;
  return false;
}

/** True when either id or slug is on the consumer blocklist (catalog + links). */
export function isTourBlockedFromConsumerSurfaces(
  tourId: string | null | undefined,
  slug: string | null | undefined
): boolean {
  if (isTourIdBlockedFromConsumerSurfaces(tourId)) return true;
  return isTourSlugBlockedFromConsumerSurfaces(slug);
}

/**
 * Href for a tour detail URL; blocked IDs fall back to `/tours/list` so nothing points at a removed SKU.
 *
 * Flagship rows (East / Jeju Grand / Southwest) link directly to their canonical
 * `/tour-product/[slug]` surface so cards never flash through the legacy `/tour/[id]`
 * template while waiting for its client-side redirect.
 */
export function consumerTourDetailHref(tourId: string | null | undefined, slug?: string | null): string {
  if (tourId == null || tourId === "") return "/tours/list";
  if (isTourBlockedFromConsumerSurfaces(tourId, slug ?? null)) return "/tours/list";
  const canonicalPath = canonicalProductPathForSlug(slug ?? null);
  if (canonicalPath) return canonicalPath;
  return `/tour/${tourId}`;
}

/** Stripe checkout under `/tour/[id]/checkout`; blocked IDs fall back to `/tours/list`. */
export function consumerTourCheckoutHref(tourId: string | null | undefined, slug?: string | null): string {
  if (tourId == null || tourId === "") return "/tours/list";
  if (isTourBlockedFromConsumerSurfaces(tourId, slug ?? null)) return "/tours/list";
  return `/tour/${tourId}/checkout`;
}

/**
 * Hide flagship / duplicate rows from consumer tour lists (web + mobile + search).
 * Blocked tour ids are removed separately (`isTourIdBlockedFromConsumerSurfaces`).
 *
 * 🔴 B6 (2026-07-29, owner confirmed) — the whole East Signature family is
 * hidden here now, including the canonical row. It used to be exempted, which
 * was right while the family were duplicate SKUs for one live experience: keep
 * one, hide the copies. That stopped being true when the product itself was
 * retired — live DB reads `tours.is_active = false` and zero bookings, ever.
 *
 * The exemption is what kept it in `/api/tours`, the destinations feed and
 * `/api/mypage/extras` anyway, because those filter on this function and the
 * static catalogue never consults `is_active`. Two ways of saying "retired",
 * and only one of them was being read.
 *
 * The detail page is deliberately unaffected — `consumerTourDetailHref` does
 * not go through here, so existing links and search results still resolve
 * rather than 404.
 */
export function isTourSlugHiddenFromPublicCatalog(slug: unknown): boolean {
  if (slug == null || typeof slug !== "string") return false;
  const s = slug.trim().toLowerCase();
  if (!s) return false;
  if (s === "jeju-east-small-group-template-preview") return true;
  if (matchesEastSignatureSlugSegment(s)) return true;
  if (isTourSlugBlockedFromConsumerSurfaces(s)) return true;
  return false;
}

/** GET /api/tours list filter: blocked ids plus `isTourSlugHiddenFromPublicCatalog` (East + blocked slugs). */
export function isTourRowHiddenFromPublicTourApi(tour: {
  id?: string | null;
  slug?: string | null;
}): boolean {
  if (isTourIdBlockedFromConsumerSurfaces(tour.id != null ? String(tour.id) : null)) return true;
  return isTourSlugHiddenFromPublicCatalog(tour.slug);
}
