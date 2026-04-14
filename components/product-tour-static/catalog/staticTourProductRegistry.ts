/**
 * DB/API 없이 프로젝트에만 존재하는 정적 투어 상품 등록부.
 * 상세 페이지: /tour-product/[slug]
 */

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
};

export const STATIC_TOUR_PRODUCT_DETAIL_PREFIX = "/tour-product" as const;

export function hrefStaticTourProductDetail(slug: string): string {
  return `${STATIC_TOUR_PRODUCT_DETAIL_PREFIX}/${slug}`;
}

/** East Signature Nature Core — 정적 신규 상품 1호 */
export const eastSignatureNatureCoreStaticProduct: StaticTourProductRegistration = {
  slug: "east-signature-nature-core",
  title: "Jeju East Volcano, Coast & Village Small Group Tour",
  subtitle: "Stone to coast. Crater to garden to village.",
  region: "East Jeju",
  duration: "8 hrs",
  stopsCount: 6,
  rating: 4.8,
  reviewCount: 127,
  badges: ["First-Time Friendly", "East Jeju"],
  heroImage: "https://images.unsplash.com/photo-1596402184320-417e7178b2cd?w=1920&q=80",
  thumbnail: "https://images.unsplash.com/photo-1596402184320-417e7178b2cd?w=600&q=80",
  priceLabel: "From $58 / person",
  shortCardDescription:
    "A structured East Jeju day that begins with stone and volcanic context, opens to the coast, peaks at Seongsan, and finishes with garden calm and village texture.",
};

/** catalog_card — southwest-tour-product-full-page.en.json 과 동기 */
export const southwestHallasanOsullocAewolStaticProduct: StaticTourProductRegistration = {
  slug: "southwest-hallasan-osulloc-aewol",
  title: "Jeju Southwest Hallasan, Osulloc & Aewol Small Group Tour",
  subtitle: "Short Hallasan hike. Basalt cliffs. Waterfall paths. Tea fields and a relaxed Aewol finish.",
  region: "Southwest Jeju",
  duration: "8 hrs",
  stopsCount: 6,
  rating: 4.8,
  reviewCount: 127,
  badges: ["First-Time Friendly", "Southwest Jeju"],
  heroImage: "https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?w=1920&q=80",
  thumbnail: "https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?w=600&q=80",
  priceLabel: "From $58 / person",
  shortCardDescription:
    "A structured Southwest Jeju day with a short Hallasan trail, Jusangjeolli’s basalt coast, Cheonjeyeon Falls, O’Sulloc tea fields, and a relaxed finish at Aewol Cafe Street.",
};

/** catalog_card — jeju-grand-highlights-loop-tour-product-full-page.en.json 과 동기 */
export const jejuGrandHighlightsLoopStaticProduct: StaticTourProductRegistration = {
  slug: "jeju-grand-highlights-loop",
  title: "Jeju Grand Highlights Loop Small Group Tour",
  subtitle: "Hallasan to Seongsan, in one powerful day.",
  region: "All-Around Jeju",
  duration: "9-9.5 hrs",
  stopsCount: 5,
  rating: 0,
  reviewCount: 0,
  badges: ["Best for One-Day Visitors", "Fast-Paced Highlights"],
  heroImage: "https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?w=1920&q=80",
  thumbnail: "https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?w=600&q=80",
  priceLabel: "From $78 / person",
  shortCardDescription:
    "A premium Jeju loop for travelers with only one day—Hallasan, south coast scenery, and Seongsan Ilchulbong in one high-impact route.",
};

export const STATIC_TOUR_PRODUCTS: readonly StaticTourProductRegistration[] = [
  eastSignatureNatureCoreStaticProduct,
  southwestHallasanOsullocAewolStaticProduct,
  jejuGrandHighlightsLoopStaticProduct,
];

export function getStaticTourProductBySlug(slug: string): StaticTourProductRegistration | undefined {
  return STATIC_TOUR_PRODUCTS.find((p) => p.slug === slug);
}
