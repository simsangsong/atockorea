/**
 * 투어 상품 상세 페이지에서 컴포넌트에 하드코딩되던 섹션 제목·부제·공통 라벨.
 * `detail_payload.sectionUi`로 로케일별 주입; 없으면 EN 기본값.
 */

export type TourProductSectionUiV1 = {
  atAGlanceTitle: string;
  atAGlanceSubtitle: string;
  atmosphereTitle: string;
  atmosphereSubtitle: string;
  itineraryTitle: string;
  itinerarySubtitle: string;
  dayFlowStopsPrefix: string;
  stopHighlightsHeading: string;
  stopTimeUsedHeading: string;
  stopVisitBasicsHeading: string;
  stopVisitHoursLabel: string;
  stopVisitAdmissionLabel: string;
  stopVisitWalkingLabel: string;
  stopVisitClosedLabel: string;
  stopSmartNotesHeading: string;
  stopSmartNotesPhotoPrefix: string;
  stopSmartNotesTipPrefix: string;
  fitTitle: string;
  fitSubtitle: string;
  fitBestForLabel: string;
  fitLessIdealLabel: string;
  fitFamiliesPrefix: string;
  fitFamiliesText: string;
  fitSeniorsPrefix: string;
  fitSeniorsText: string;
  fitRouteLogicTitle: string;
  fitRouteLogicSubtitle: string;
  practicalTitle: string;
  practicalSubtitle: string;
  seasonalTitle: string;
  seasonalSubtitle: string;
  bookingSupportTitle: string;
  bookingSupportSubtitle: string;
  bookingAfterTitle: string;
  bookingAfterSubtitle: string;
  faqTitle: string;
  faqSubtitle: string;
  faqShowFewer: string;
  /** `{count}` 치환 */
  faqMoreQuestionsTemplate: string;
  faqFooterTitle: string;
  faqFooterLink: string;
  reviewsTitle: string;
  reviewsSubtitle: string;
  /** `{total}` 치환 */
  reviewsBasedOnTemplate: string;
  reviewsGuestsMention: string;
  reviewsShowFewerReviews: string;
  /** `{count}` 치환 */
  reviewsShowAllTemplate: string;
  reviewsVerified: string;
  reviewsReadMore: string;
  reviewsShowLess: string;
  /** `{count}` 치환 */
  reviewsHelpfulTemplate: string;
  reviewsCtaTitle: string;
  reviewsCtaSubtitle: string;
  reviewsWriteReview: string;
};

export const DEFAULT_TOUR_PRODUCT_SECTION_UI_EN: TourProductSectionUiV1 = {
  atAGlanceTitle: "At a glance",
  atAGlanceSubtitle: "A quick read on scenery, walking comfort, and overall fit.",
  atmosphereTitle: "See the route atmosphere",
  atmosphereSubtitle: "Before the details, this is how the day feels.",
  itineraryTitle: "Your Day, Stop by Stop",
  itinerarySubtitle: "Each stop builds naturally into the next. Expand any for full detail.",
  dayFlowStopsPrefix: "Stops",
  stopHighlightsHeading: "Highlights",
  stopTimeUsedHeading: "How the time is used",
  stopVisitBasicsHeading: "Visit basics",
  stopVisitHoursLabel: "Hours",
  stopVisitAdmissionLabel: "Admission",
  stopVisitWalkingLabel: "Walking",
  stopVisitClosedLabel: "Closed",
  stopSmartNotesHeading: "Smart notes",
  stopSmartNotesPhotoPrefix: "Photo:",
  stopSmartNotesTipPrefix: "Tip:",
  fitTitle: "Why this tour works",
  fitSubtitle: "Who this cadence suits and how the day is sequenced.",
  fitBestForLabel: "Best for",
  fitLessIdealLabel: "Less ideal for",
  fitFamiliesPrefix: "Families:",
  fitFamiliesText:
    "Good for ages 8+; younger children possible but the crater climb makes it better for older kids. ",
  fitSeniorsPrefix: "Seniors:",
  fitSeniorsText: "Comfortable when Seongsan uses the lighter coastal option.",
  fitRouteLogicTitle: "Route logic",
  fitRouteLogicSubtitle: "Pacing, sequence, stop timing, and why the day flows this way",
  practicalTitle: "Practical details",
  practicalSubtitle: "Pickup, walking, weather, packing, and inclusions.",
  seasonalTitle: "Seasonal variations",
  seasonalSubtitle: "How this route feels through the year.",
  bookingSupportTitle: "Booking & support",
  bookingSupportSubtitle: "What to expect before, during, and after.",
  bookingAfterTitle: "After booking",
  bookingAfterSubtitle: "Support you receive before, during, and after",
  faqTitle: "Questions",
  faqSubtitle: "The few questions that usually decide it.",
  faqShowFewer: "Show fewer",
  faqMoreQuestionsTemplate: "{count} more questions",
  faqFooterTitle: "Questions before booking?",
  faqFooterLink: "Message us anytime",
  reviewsTitle: "Guest Reviews",
  reviewsSubtitle: "What travelers say about this experience.",
  reviewsBasedOnTemplate: "Based on {total} reviews",
  reviewsGuestsMention: "Guests frequently mention",
  reviewsShowFewerReviews: "Show fewer reviews",
  reviewsShowAllTemplate: "Show all {count} reviews",
  reviewsVerified: "Verified",
  reviewsReadMore: "Read more",
  reviewsShowLess: "Show less",
  reviewsHelpfulTemplate: "Helpful ({count})",
  reviewsCtaTitle: "Been on this tour?",
  reviewsCtaSubtitle: "Share your experience to help other travelers.",
  reviewsWriteReview: "Write a Review",
};

function pickSectionUiKeys(raw: unknown): Partial<TourProductSectionUiV1> {
  if (typeof raw !== "object" || raw === null) return {};
  const o = raw as Record<string, unknown>;
  const out: Partial<TourProductSectionUiV1> = {};
  for (const key of Object.keys(DEFAULT_TOUR_PRODUCT_SECTION_UI_EN) as (keyof TourProductSectionUiV1)[]) {
    const v = o[key];
    if (typeof v === "string" && v.trim() !== "") {
      out[key] = v;
    }
  }
  return out;
}

export function mergeTourProductSectionUi(raw?: unknown): TourProductSectionUiV1 {
  return { ...DEFAULT_TOUR_PRODUCT_SECTION_UI_EN, ...pickSectionUiKeys(raw) };
}
