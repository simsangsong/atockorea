/**
 * Tour-related types for SEO, itinerary_details, and FAQs.
 * Aligns with Supabase tours table columns: seo_title, meta_description, itinerary_details, faqs, highlights.
 */

/** 시간대별 상세 일정 (itinerary_details JSONB). 일정별 사진 URL 목록 선택 */
export interface ItineraryDetail {
  time: string;
  activity: string;
  description: string;
  /** 일정 항목에 연결된 사진 URL 목록 */
  images?: string[];
}

/** 자주 묻는 질문 (faqs JSONB) */
export interface Faq {
  question: string;
  answer: string;
}

/** 아동 자격 규칙 한 항목 (child_eligibility JSONB). id별로 num, num1, num2, text 사용 */
export interface ChildEligibilityRule {
  id: string;
  num?: number;
  num1?: number;
  num2?: number;
  num3?: number;
  text?: string;
}

/** 접근성 시설 (accessibility_facilities JSONB) */
export interface AccessibilityFacilities {
  /** 婴幼儿和儿童将被计为乘客人数 */
  note_children_counted?: boolean;
  /** 儿童座椅: none | no_seat | one_free_on_request | counted_as_passenger | custom */
  child_seat?: 'none' | 'no_seat' | 'one_free_on_request' | 'counted_as_passenger' | 'custom';
  child_seat_custom?: { num1?: number; num2?: number; num3?: number };
  /** 婴儿车: suitable | not_suitable */
  stroller?: 'suitable' | 'not_suitable';
  /** 轮椅: suitable | not_suitable */
  wheelchair?: 'suitable' | 'not_suitable';
  /** 婴儿车+轮椅: both_ok | both_not */
  stroller_wheelchair?: 'both_ok' | 'both_not';
}

/** 상세 페이지용 Tour 확장 타입 (API 응답과 매칭) */
export interface TourDetail {
  id: string;
  title: string;
  tagline?: string;
  location: string;
  city: string;
  rating: number;
  reviewCount: number;
  badges: string[];
  price: number;
  originalPrice: number | null;
  priceType: 'person' | 'group';
  availableSpots?: number;
  duration: string;
  difficulty?: string;
  groupSize?: string;
  highlight?: string;
  keywords?: string[];
  images: Array<{ url: string; title: string; description: string }>;
  quickFacts?: string[];
  itinerary: Array<{ time: string; title: string; description: string; icon?: string; images?: string[] }>;
  /** 새 컬럼: 시간대별 상세 일정 (time, activity, description). 있으면 타임라인 UI에서 우선 사용 */
  itineraryDetails?: ItineraryDetail[];
  inclusions: Array<string | { icon: string; text: string }>;
  exclusions: Array<string | { icon: string; text: string }>;
  pickupPoints: Array<{ id: string; name: string; address: string; lat: number; lng: number; pickup_time?: string | null; image_url?: string | null }>;
  overview?: string;
  highlights?: string[];
  faqs?: Faq[];
  /** 일정표 상단 히어로 배너 이미지 URL (16:9). 없으면 갤러리 첫 이미지 사용 */
  schedule_hero_image_url?: string | null;
  /** SEO: 검색 엔진용 제목 */
  seoTitle?: string | null;
  /** SEO: 메타 설명 (160자 이내 권장) */
  metaDescription?: string | null;
  /** 아동/참가자 자격 규칙 */
  childEligibility?: ChildEligibilityRule[];
  /** 권장 휴대품 */
  suggestedToBring?: string[];
  /** 접근성 시설 */
  accessibilityFacilities?: AccessibilityFacilities;
}
