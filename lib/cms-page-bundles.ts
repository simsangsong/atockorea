/**
 * CMS 추출/적용 시 페이지(영역)별로 어떤 messages / siteCopy 최상위 키를 포함할지 정의합니다.
 */

export type CmsPageBundleId =
  | "main"
  | "mypage"
  | "auth"
  | "legal"
  | "tours"
  | "tourDetail"
  | "booking"
  | "about"
  | "admin"
  | "customJoin";

export const CMS_PAGE_BUNDLE_IDS: CmsPageBundleId[] = [
  "main",
  "mypage",
  "auth",
  "legal",
  "tours",
  "tourDetail",
  "booking",
  "about",
  "admin",
  "customJoin",
];

/** siteCopy 전체 키 (messages/siteCopy/en.json 기준) */
export const ALL_SITE_COPY_TOP_KEYS: string[] = [
  "brand",
  "nav",
  "hero",
  "howItWorks",
  "comparison",
  "previewItinerary",
  "reviews",
  "homepageBookWithConfidence",
  "tourTypes",
  "surcharge",
  "pickupMatch",
  "joinStatus",
  "joinStatusHelp",
  "checkout",
  "listDetail",
  "detail",
  "timeline",
  "myTour",
  "destinations",
  "fallback",
  "finalCta",
  "builderLoading",
  "builderPickupArea",
  "builderSummary",
  "planner",
  "productCards",
  "homepageComparison",
  "homepageAiPrices",
];

export const CMS_PAGE_BUNDLES: Record<
  CmsPageBundleId,
  {
    labelKo: string;
    labelEn: string;
    messageKeys: string[];
    /** '*' = siteCopy 최상위 전부 */
    siteCopyKeys: string[] | "*";
    /** main만 히어로 등 sectionImages 포함 */
    includeSectionImages: boolean;
  }
> = {
  main: {
    labelKo: "메인 / 랜딩",
    labelEn: "Home / Landing",
    messageKeys: ["common", "nav", "home", "trustBar", "toursList", "tourCard"],
    siteCopyKeys: "*",
    includeSectionImages: true,
  },
  mypage: {
    labelKo: "마이페이지",
    labelEn: "My Page",
    messageKeys: ["common", "nav", "mypage"],
    siteCopyKeys: [],
    includeSectionImages: false,
  },
  auth: {
    labelKo: "로그인 / 회원가입",
    labelEn: "Sign in / Sign up",
    messageKeys: ["common", "nav", "auth", "errors"],
    siteCopyKeys: [],
    includeSectionImages: false,
  },
  legal: {
    labelKo: "약관 (이용·개인정보·쿠키·환불)",
    labelEn: "Legal (Terms, Privacy, Cookie, Refund)",
    messageKeys: ["common", "nav", "terms", "privacy", "cookiePolicy", "refund"],
    siteCopyKeys: [],
    includeSectionImages: false,
  },
  tours: {
    labelKo: "투어 목록",
    labelEn: "Tours list",
    messageKeys: ["common", "nav", "tour", "toursList", "tourCard"],
    siteCopyKeys: ["listDetail", "destinations", "fallback"],
    includeSectionImages: false,
  },
  tourDetail: {
    labelKo: "투어 상세",
    labelEn: "Tour detail",
    messageKeys: ["common", "nav", "tour", "tourCard", "booking", "cart", "wishlist"],
    siteCopyKeys: ["detail", "timeline", "reviews", "tourTypes", "surcharge", "pickupMatch"],
    includeSectionImages: false,
  },
  booking: {
    labelKo: "장바구니 / 결제",
    labelEn: "Cart / Checkout",
    messageKeys: ["common", "nav", "cart", "booking", "wishlist"],
    siteCopyKeys: ["checkout"],
    includeSectionImages: false,
  },
  about: {
    labelKo: "소개 / 고객지원",
    labelEn: "About / Support",
    messageKeys: ["common", "nav", "about", "support"],
    siteCopyKeys: [],
    includeSectionImages: false,
  },
  admin: {
    labelKo: "관리자 UI 문자열",
    labelEn: "Admin UI strings",
    messageKeys: ["common", "admin"],
    siteCopyKeys: [],
    includeSectionImages: false,
  },
  customJoin: {
    labelKo: "맞춤 조인 투어 / 일정 빌더",
    labelEn: "Custom join tour / itinerary builder",
    messageKeys: ["common", "nav", "home", "tour", "booking"],
    siteCopyKeys: [
      "planner",
      "builderLoading",
      "builderPickupArea",
      "builderSummary",
      "previewItinerary",
      "listDetail",
      "detail",
      "timeline",
      "myTour",
      "joinStatus",
      "joinStatusHelp",
      "pickupMatch",
    ],
    includeSectionImages: false,
  },
};

export function isCmsPageBundleId(v: string | null): v is CmsPageBundleId {
  return v !== null && CMS_PAGE_BUNDLE_IDS.includes(v as CmsPageBundleId);
}
