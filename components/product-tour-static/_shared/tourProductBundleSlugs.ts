/**
 * Slug-only mirror of `STATIC_TOUR_PRODUCT_BUNDLES` from
 * `tourProductBundleRegistry.ts`. Lives in its own file so consumer code
 * (e.g. `lib/tour-consumer-visibility.ts`, called from many client surfaces)
 * can resolve canonical `/tour-product/[slug]` routing without dragging the
 * 30 EN JSON bundles into client bundles.
 *
 * Source of truth: this list. The bundle registry constrains its keys to
 * `StaticTourProductBundleSlug` so adding/removing a slug here is
 * compile-time enforced in the registry.
 */

export const STATIC_TOUR_PRODUCT_BUNDLE_SLUG_LIST = [
  "busan-gyeongju-unesco-legacy-tour-national-museum",
  "busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju",
  "busan-cruise-shore-excursion-bus-tour",
  "busan-outskirts-tongdosa-amethyst-yeongnam-day-tour",
  "busan-private-car-charter-cruise-shore",
  "busan-small-group-sightseeing-tour-cruise-passengers",
  "busan-spring-cherry-blossom-gyeongju-highlights-day-tour",
  "busan-top-attractions-day-tour",
  "east-signature-nature-core",
  "from-busan-gyeongju-ancient-capital-day-tour",
  "from-incheon-seoul-day-tour-cruise-guests",
  "incheon-seoul-private-car-shore-excursion-cruise",
  "jeju-cherry-blossom-tour-east-route",
  "jeju-cruise-shore-excursion-bus-tour",
  "jeju-cruise-shore-excursion-small-group-tour",
  "jeju-eastern-unesco-spots-day-tour",
  "jeju-grand-highlights-loop",
  "jeju-hydrangea-festival-tour-east-route",
  "jeju-hydrangea-festival-tour-southwest-route",
  "jeju-island-private-car-charter-tour",
  "jeju-southern-top-unesco-spots-tour",
  "jeju-west-south-full-day-authentic-tour",
  "jeju-winter-southwest-tangerine-snow-camellia-tour",
  "pocheon-sanjeong-lake-herb-island-art-valley",
  "seoul-dmz-private-3rd-tunnel-suspension-bridge",
  "seoul-private-nami-morning-calm-petite-france",
  "seoul-seoraksan-naksansa-temple-naksan-beach-day-trip",
  "seoul-seoraksan-nami-island-morning-calm-day-tour",
  "seoul-seoraksan-national-park-sokcho-beach-day-trip",
  "seoul-suburbs-private-chartered-car-10hr",
  "seoul-suwon-hwaseong-folk-village-starfield-library",
  "seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library",
  "seoul-suwon-hwaseong-waujeongsa-starfield",
  "southwest-hallasan-osulloc-aewol",
] as const;

export type StaticTourProductBundleSlug =
  (typeof STATIC_TOUR_PRODUCT_BUNDLE_SLUG_LIST)[number];

export const STATIC_TOUR_PRODUCT_BUNDLE_SLUGS: ReadonlySet<string> = new Set(
  STATIC_TOUR_PRODUCT_BUNDLE_SLUG_LIST,
);
