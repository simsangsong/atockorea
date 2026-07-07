import type { TourProductPageLocale } from "@/lib/tour-product/resolveTourProductDbLocale";

export type ChatbotIntent =
  | "tour_recommendation"
  | "tour_catalog"
  | "quote_request"
  | "price_question"
  | "policy"
  | "booking_specific"
  | "company"
  | "poi"
  | "legal"
  | "support"
  | "unknown";

export type ChatbotIntentResult = {
  intent: ChatbotIntent;
  confidence: number;
  reasons: string[];
  useTourCatalog: boolean;
  useSiteKnowledge: boolean;
  requiresHuman: boolean;
};

function normalize(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function hasAny(value: string, terms: readonly string[]): boolean {
  const q = normalize(value);
  return terms.some((term) => q.includes(normalize(term)));
}

function scoreAny(value: string, terms: readonly string[]): number {
  const q = normalize(value);
  return terms.reduce((score, term) => score + (q.includes(normalize(term)) ? 1 : 0), 0);
}

const REGION_TERMS = [
  "jeju",
  "busan",
  "seoul",
  "gyeongju",
  "incheon",
  "dmz",
  "nami",
  "seoraksan",
  "제주",
  "부산",
  "서울",
  "경주",
  "인천",
  "남이섬",
  "설악산",
  "済州",
  "釜山",
  "ソウル",
  "慶州",
  "仁川",
  "济州",
  "釜山",
  "首尔",
  "庆州",
  "仁川",
];

const TOUR_TERMS = [
  "tour",
  "tours",
  "trip",
  "itinerary",
  "recommend",
  "suggest",
  "available",
  "catalog",
  "catalogue",
  "product",
  "private",
  "small group",
  "cruise",
  "shore excursion",
  "unesco",
  "tour under",
  "투어",
  "여행",
  "일정",
  "코스",
  "추천",
  "갈 만한",
  "가볼",
  "상품",
  "한정 상품",
  "프라이빗",
  "전용차",
  "소그룹",
  "크루즈",
  "유네스코",
  "카탈로그",
  "목록",
  "옵션",
  "항구",
  "공항",
  "봄 시즌",
  "여름 한정",
  "겨울 제주",
  "ツアー",
  "旅行",
  "おすすめ",
  "旅游",
  "一日游",
  "一日遊",
  "行程",
  "推荐",
  "privado",
  "tour privado",
];

// W2.1 (C-3): quote vs price split. An EXPLICIT quote ask ("견적", "quote")
// or a price question that itself carries a private/charter signal enters the
// custom-quote funnel; a plain price question about listed tours ("How much is
// the Pocheon tour?") must be ANSWERED WITH A NUMBER from the catalogue
// instead of hijacked into private-tour slot collection.
const EXPLICIT_QUOTE_TERMS = [
  "quote", "quotation", "estimate for",
  "견적",
  "見積", "見積もり",
  "报价", "報價",
  "presupuesto", "cotización", "cotizacion",
];

const PRICE_TERMS = [
  "price", "pricing", "cost", "how much",
  "가격", "얼마", "비용", "요금",
  "料金", "いくら",
  "价格", "價格", "多少钱", "多少錢", "费用", "費用",
  "precio", "cuánto", "cuanto", "cuesta",
];

const PRIVATE_TOUR_TERMS = [
  "private", "charter", "custom", "build my own", "build a", "tailor",
  "맞춤", "프라이빗", "전세", "전용", "직접 짜",
  "プライベート", "貸切", "チャーター", "オーダーメイド",
  "私人", "包车", "包車", "定制", "客製",
  "privado", "a medida", "personalizado",
];

const EXPLICIT_RECOMMENDATION_TERMS = [
  "recommend",
  "suggest",
  "show me available",
  "which listed tours",
  "what tours",
  "do you have",
  "tour catalogue",
  "public tour catalogue",
  "추천",
  "투어 있어",
  "투어가 있어",
  "투어 있",
  "투어가 있",
  "투어 있나",
  "투어 있을까",
  "투어 상품",
  "투어 알려",
  "투어를 알려",
  "상품 있어",
  "상품은 뭐",
  "상품만",
  "목록",
  "보여줘",
  "추려줘",
  "옵션만",
  "찾고 있어",
];

const POLICY_TERMS = [
  "refund",
  "cancel",
  "cancellation",
  "payment",
  "chargeback",
  "charged",
  "no-show",
  "no show",
  "deposit",
  "card",
  "fee",
  "platform fee",
  "insurance",
  "travel insurance",
  "included",
  "not included",
  "weather",
  "compensation",
  "route change",
  "환불",
  "취소",
  "취소료",
  "결제",
  "청구",
  "차지백",
  "카드",
  "노쇼",
  "보증금",
  "수수료",
  "플랫폼 수수료",
  "보험",
  "여행자 보험",
  "포함사항",
  "미포함",
  "포함되지",
  "날씨",
  // Deep-audit 2026-07-05: ja/zh/es weather words were missing, so
  // "済州の明日の天気は？" / "济州明天天气怎么样？" fell to tour_catalog and the
  // W6.6 forecast instant answer never fired for those locales.
  "天気",
  "天气",
  "天氣",
  "clima",
  "pronóstico",
  "el tiempo",
  "보상",
  "코스가 바뀌",
  "예약 변경 수수료",
  "카시트",
  "child seat",
  // W1.5.3 (C-24) — real tourist FAQ that used to fall to "unknown":
  // airport pickup, luggage, child fare/policy, guide language, weather cancel.
  "airport pickup",
  "airport transfer",
  "pick me up at the airport",
  "luggage",
  "baggage",
  "suitcase",
  "child fare",
  "children's price",
  "kids price",
  "price for kids",
  "price for children",
  "infant",
  "toddler",
  "booster seat",
  "guide language",
  "english-speaking guide",
  "english speaking guide",
  "speak english",
  "bad weather",
  "rain policy",
  "if it rains",
  "typhoon",
  "공항 픽업",
  "공항픽업",
  "공항 샌딩",
  "공항 마중",
  "수하물",
  "캐리어",
  "짐 보관",
  "아동 요금",
  "아이 요금",
  "어린이 요금",
  "유아 요금",
  "아기도",
  "가이드 언어",
  "영어 가이드",
  "한국어 가이드",
  "우천",
  "비 오면",
  "비가 오면",
  "태풍",
  // W1.5.4 (C-25) — ja/zh/es policy coverage (was ko/en only, so "退款政策?"
  // scored 0 and fell through to unknown).
  "返金",
  "払い戻し",
  "キャンセル料",
  "キャンセルポリシー",
  "空港送迎",
  "空港ピックアップ",
  "荷物",
  "スーツケース",
  "子供料金",
  "子ども料金",
  "チャイルドシート",
  "英語ガイド",
  "日本語ガイド",
  "雨天",
  "雨の場合",
  "台風",
  "退款",
  "退錢",
  "退钱",
  "取消政策",
  "取消费",
  "取消費",
  "机场接送",
  "機場接送",
  "行李",
  "儿童票",
  "兒童票",
  "儿童价",
  "兒童價",
  "安全座椅",
  "英文导游",
  "英文導遊",
  "中文导游",
  "中文導遊",
  "下雨",
  "台风",
  "颱風",
  "reembolso",
  "cancelación",
  "cancelacion",
  "política de cancelación",
  "recogida en el aeropuerto",
  "equipaje",
  "maleta",
  "tarifa de niños",
  "precio para niños",
  "asiento infantil",
  "idioma del guía",
  "guía en inglés",
  "si llueve",
  "mal tiempo",
];

const LEGAL_TERMS = [
  "legal",
  "liability",
  "lawsuit",
  "dispute",
  "dsa",
  "privacy",
  "cookie",
  "terms",
  "privacy officer",
  "data deletion",
  "delete my data",
  "personal data",
  "sell customer personal information",
  "법",
  "법적",
  "책임",
  "분쟁",
  "소송",
  "개인정보",
  "개인정보 삭제",
  "쿠키",
  "약관",
  "법무",
  "삭제 요청",
];

const STRONG_PERSONAL_BOOKING_TERMS = [
  "exact pickup",
  "driver contact",
  "driver's phone",
  "driver phone",
  "pickup time",
  "pickup location",
  "pickup vehicle",
  "vehicle number",
  "booking reference",
  "booking number",
  "confirmation email",
  "receipt",
  "refund status",
  "charged twice",
  "driver",
  "기사",
  "기사님",
  "드라이버",
  "픽업 시간",
  "픽업 장소",
  "픽업 차량",
  "차량 번호",
  "예약번호",
  "예약 번호",
  "확정 메일",
  "확정서",
  "영수증",
  "환불 처리",
  "두 번 결제",
];

const PERSONAL_BOOKING_TERMS = [
  ...STRONG_PERSONAL_BOOKING_TERMS,
  "my booking",
  "my reservation",
  "my card",
  "my refund",
  "my receipt",
  "change my",
  "reschedule my",
  "update my",
  "add one more traveler",
  "booking date",
  "booking confirmed",
  "did my payment",
  "go through",
  "내 예약",
  "내 결제",
  "내 환불",
  "내 영수증",
  "내 주문",
  "내 쿠폰",
  "내 투어",
  "내 호텔",
  "호텔을 바꿨",
  "예약 날짜",
  "예약일",
  "예약자 이름",
  "이름 변경",
  "날짜를",
  "바꿔줘",
  "바꾸고 싶어",
  "수정해줘",
  "추가하고",
  "이름을 바꾸",
  "적용됐는지",
  "정상 출발",
  "어디쯤",
  "확인해줘",
  "봐줘",
  "다시 보내",
];

const PERSONAL_MARKER_TERMS = [
  "my ",
  "mine",
  "i changed",
  "i did not receive",
  "please resend",
  "can you check",
  "can you change",
  "can you update",
  "내 ",
  "제 ",
  "저의",
  "나의",
  "확인해줘",
  "바꿔줘",
  "바꾸고 싶어",
  "수정해줘",
  "봐줘",
  "다시 보내",
  "추가하고",
  "연락처 알려줘",
];

const COMPANY_TERMS = [
  "company",
  "address",
  "email",
  "phone",
  "contact",
  "support email",
  "who are you",
  "operator",
  "provider",
  "intermediary",
  "located",
  "partnership",
  "partner",
  "support hours",
  "atoc",
  "회사",
  "주소",
  "이메일",
  "전화",
  "연락처",
  "고객센터",
  "고객 지원",
  "운영사",
  "중개자",
  "파트너십",
  "제휴",
  "문의는 어디",
  "답변 시간",
];

const POI_TERMS = [
  "opening hours",
  "hours",
  "admission",
  "ticket",
  "parking",
  "restroom",
  "bathroom",
  "attraction",
  "temple",
  "market",
  "beach",
  "museum",
  "wheelchair",
  "stroller",
  "free admission",
  "rainy day",
  "운영 시간",
  "운영시간",
  "관람 시간",
  "관람시간",
  "입장료",
  "입장",
  "무료 입장",
  "주차",
  "화장실",
  "명소",
  "사찰",
  "시장",
  "해변",
  "박물관",
  "유모차",
  "휠체어",
  "밤에도",
  "비 오는 날",
  "갈 만해",
  "빡세",
  "다니기 괜찮",
  "성산일출봉",
  "한라산",
  "어리목",
  "오설록",
  "주상절리",
  "천제연",
  "감천문화마을",
  "해동용궁사",
  "starfield",
  "별마당",
  "수원화성",
  "에버랜드",
  "한국민속촌",
  "용두암",
  "함덕해변",
  "카멜리아힐",
  "hallasan",
  "seongsan",
  "eorimok",
  "camellia hill",
];

const SUPPORT_TERMS = [
  "human",
  "agent",
  "representative",
  "customer support",
  "customer service",
  "contact support",
  "talk to someone",
  "talk to a human",
  "message me",
  "call me",
  "staff message me",
  "telegram",
  "kakao",
  "not the ai",
  "상담원",
  "담당자",
  "관리자",
  "사람이랑",
  "연결해줘",
  "연락해줘",
  "연락줘",
  "연락받고",
  "문의하기",
  "문자 보내",
  "전화줘",
  "텔레그램",
  "카카오톡",
];

function result(
  intent: ChatbotIntent,
  confidence: number,
  reasons: string[],
  options: Pick<ChatbotIntentResult, "useTourCatalog" | "useSiteKnowledge" | "requiresHuman">,
): ChatbotIntentResult {
  return { intent, confidence: Math.min(1, confidence), reasons, ...options };
}

export function classifyChatbotQuery(message: string): ChatbotIntentResult {
  const q = normalize(message);
  const reasons: string[] = [];

  const supportScore = scoreAny(q, SUPPORT_TERMS);
  if (supportScore > 0) {
    reasons.push("explicit_support_request");
    return result("support", 0.75 + supportScore * 0.05, reasons, {
      useTourCatalog: false,
      useSiteKnowledge: false,
      requiresHuman: true,
    });
  }

  const policyScore = scoreAny(q, POLICY_TERMS);
  const legalScore = scoreAny(q, LEGAL_TERMS);
  const strongPersonalScore = scoreAny(q, STRONG_PERSONAL_BOOKING_TERMS);
  const personalScore = scoreAny(q, PERSONAL_BOOKING_TERMS);
  const hasPersonalMarker = hasAny(q, PERSONAL_MARKER_TERMS);
  const companyScore = scoreAny(q, COMPANY_TERMS);
  const poiScore = scoreAny(q, POI_TERMS);
  const regionScore = scoreAny(q, REGION_TERMS);
  const tourScore = scoreAny(q, TOUR_TERMS);
  const explicitRecommendation = hasAny(q, EXPLICIT_RECOMMENDATION_TERMS) && tourScore > 0;
  const explicitQuoteScore = scoreAny(q, EXPLICIT_QUOTE_TERMS);
  const priceScore = scoreAny(q, PRICE_TERMS);
  const quoteScore = explicitQuoteScore + priceScore;
  const privateScore = scoreAny(q, PRIVATE_TOUR_TERMS);

  const looksBookingSpecific =
    personalScore > 0 &&
    (hasPersonalMarker || strongPersonalScore > 0) &&
    !(policyScore > 0 && !hasPersonalMarker);

  // Custom private-tour quote funnel: an EXPLICIT quote ask ("견적"/"quote")
  // paired with a private/tour/region signal, or a price ask that itself
  // carries a private/charter signal (W2.1 narrowing — C-3: plain catalog
  // price questions no longer land here).
  // Checked BEFORE booking_specific so a NEW-tour quote that mentions "픽업"
  // (pickup zone) isn't mistaken for an existing-booking pickup-time question.
  // A bare existing-booking question ("내 예약 픽업 시간?") has no quote/tour/
  // region cue, so it still falls through to booking_specific below.
  // Deep-audit 2026-07-05: a listed-tour NAME can itself carry the private
  // signal ("Jeju Island Private Car Charter Tour"), so "how much is the …
  // charter tour?" was hijacked into the quote interrogation instead of
  // answering the $254 list price. Require an explicit quote word OR a genuine
  // quote-slot cue (date / party / hours) before a price+private message
  // counts as a custom-quote request; otherwise it's a listed-price question.
  const hasQuoteSlotSignal =
    /\b\d+\s*(?:people|persons?|pax|guests?|hours?|hrs?)\b|\d+\s*(?:명|인|시간)|\d{4}-\d{2}-\d{2}|\b(?:tomorrow|next\s+week)\b|내일|다음\s*주/i.test(
      q,
    );
  const looksQuoteRequest =
    (explicitQuoteScore > 0 && (privateScore > 0 || tourScore > 0 || regionScore > 0)) ||
    (priceScore > 0 && privateScore > 0 && (explicitQuoteScore > 0 || hasQuoteSlotSignal));
  if (looksQuoteRequest) {
    reasons.push("custom_quote_request");
    return result("quote_request", 0.74 + quoteScore * 0.05 + privateScore * 0.03, reasons, {
      useTourCatalog: false,
      useSiteKnowledge: false,
      requiresHuman: false,
    });
  }

  if (looksBookingSpecific) {
    reasons.push("personal_booking_detail");
    return result("booking_specific", 0.8 + personalScore * 0.04, reasons, {
      useTourCatalog: false,
      useSiteKnowledge: true,
      requiresHuman: true,
    });
  }

  if (legalScore > 0) {
    reasons.push("legal_or_privacy");
    return result("legal", 0.72 + legalScore * 0.05, reasons, {
      useTourCatalog: false,
      useSiteKnowledge: true,
      requiresHuman: false,
    });
  }

  if (policyScore > 0) {
    reasons.push("policy_terms");
    return result("policy", 0.72 + policyScore * 0.05, reasons, {
      useTourCatalog: false,
      useSiteKnowledge: true,
      requiresHuman: false,
    });
  }

  if (poiScore > 0 && !explicitRecommendation) {
    reasons.push("poi_or_place_fact");
    return result("poi", 0.64 + poiScore * 0.05, reasons, {
      useTourCatalog: false,
      useSiteKnowledge: true,
      requiresHuman: false,
    });
  }

  // W2.1 (C-3·C-12): listed-tour price question — route WITH the catalogue
  // (which carries the USD list prices) so the answer states a number, instead
  // of hijacking into the private-quote interrogation or dodging pricelessly.
  if (priceScore > 0 && (tourScore > 0 || regionScore > 0)) {
    reasons.push("listed_price_question");
    return result("price_question", 0.7 + priceScore * 0.05, reasons, {
      useTourCatalog: true,
      useSiteKnowledge: true,
      requiresHuman: false,
    });
  }

  if (explicitRecommendation || (regionScore > 0 && tourScore > 0)) {
    reasons.push(regionScore > 0 ? "region_signal" : "tour_signal");
    return result("tour_recommendation", 0.62 + (regionScore + tourScore) * 0.04, reasons, {
      useTourCatalog: true,
      useSiteKnowledge: true,
      requiresHuman: false,
    });
  }

  if (companyScore > 0) {
    reasons.push("company_contact");
    return result("company", 0.7 + companyScore * 0.05, reasons, {
      useTourCatalog: false,
      useSiteKnowledge: true,
      requiresHuman: false,
    });
  }

  if (regionScore > 0 || tourScore > 0) {
    reasons.push(regionScore > 0 ? "region_signal" : "tour_signal");
    return result(tourScore > 0 ? "tour_recommendation" : "tour_catalog", 0.62 + (regionScore + tourScore) * 0.04, reasons, {
      useTourCatalog: true,
      useSiteKnowledge: true,
      requiresHuman: false,
    });
  }

  reasons.push("fallback_unknown");
  return result("unknown", 0.35, reasons, {
    useTourCatalog: false,
    useSiteKnowledge: true,
    requiresHuman: false,
  });
}

export function expandQueryForTourCatalogue(query: string): string {
  const q = normalize(query);
  const expansions: string[] = [];

  const addIf = (terms: readonly string[], values: readonly string[]) => {
    if (hasAny(q, terms)) expansions.push(...values);
  };

  addIf(["제주", "jeju", "済州", "济州"], ["jeju"]);
  addIf(["부산", "busan", "釜山"], ["busan"]);
  addIf(["서울", "seoul", "ソウル", "首尔"], ["seoul"]);
  addIf(["경주", "gyeongju", "慶州", "庆州"], ["gyeongju"]);
  addIf(["인천", "incheon", "仁川"], ["incheon"]);
  addIf(["남이섬", "nami"], ["nami"]);
  addIf(["설악산", "seoraksan"], ["seoraksan"]);
  addIf(
    [
      "부모님", "어르신", "70대", "무릎", "오래 걷", "힘든", "빡세지", "senior", "seniors", "elderly",
      "parents", "low walking", "高齢", "シニア", "年配", "ゆっくり", "老人", "长辈", "年长", "老年",
      "mayores", "tercera edad", "ancianos", "relajado",
    ],
    ["parents", "senior", "relaxed", "low mobility"],
  );
  addIf(
    [
      "아이", "초등학생", "가족", "유모차", "kids", "children", "family", "stroller", "家族", "子供",
      "子ども", "小孩", "家庭", "親子", "亲子", "儿童", "niños", "niñas", "niño", "familia",
    ],
    ["family", "kids"],
  );
  addIf(
    [
      "휠체어", "배리어프리", "거동", "車椅子", "車いす", "輪椅", "无障碍", "無障礙", "wheelchair",
      "accessible", "accessibility", "step free", "step-free", "mobility", "silla de ruedas",
    ],
    ["accessible", "wheelchair", "private", "low mobility"],
  );
  addIf(["크루즈", "기항", "항구", "cruise", "shore", "port"], ["cruise", "shore excursion", "port"]);
  addIf(["공항", "airport"], ["airport"]);
  addIf(["전용차", "프라이빗", "private", "charter"], ["private", "charter"]);
  addIf(["소그룹", "small group"], ["small group"]);
  addIf(["유네스코", "unesco"], ["unesco"]);
  addIf(["벚꽃", "수국", "동백", "눈", "귤", "cherry", "hydrangea", "camellia", "snow", "tangerine"], [
    "seasonal",
  ]);

  return Array.from(new Set([query, ...expansions])).join(" ");
}

export function bookingSpecificReply(locale: TourProductPageLocale): string {
  if (locale === "ko") {
    return "정확한 픽업 시간, 기사 연락처, 결제 상태, 환불 처리 여부처럼 개인 예약에 묶인 정보는 예약 기록 확인이 필요합니다. 이 채팅에서 담당자에게 바로 연결해 드릴 수 있어요.";
  }
  return "Exact pickup time, driver contact, payment status, booking changes, or refund progress require checking your booking record. I can connect you with customer support in this chat.";
}

export function policyFallbackReply(locale: TourProductPageLocale): string {
  if (locale === "ko") {
    return "일반적으로 취소 및 환불 가능 여부는 예약 시 고지된 투어 제공자 정책과 AtoC Korea 환불 정책에 따라 달라집니다. 흔히 출발 24~48시간 전까지는 전액 환불이 가능할 수 있고, 기한 이후 취소나 노쇼는 부분 환불 또는 환불 불가가 될 수 있습니다. 정확한 예약별 결과는 예약 기록과 확인서의 조건 확인이 필요하므로, 이 채팅에서 담당자에게 바로 연결해 드릴 수 있어요.";
  }
  return "In general, free cancellation may be available before a stated cutoff such as 24 to 48 hours before departure, while late cancellations or no-shows may be partially refundable or non-refundable. The exact outcome depends on the tour provider policy shown at booking and AtoC Korea's refund policy. I can connect you with support in this chat for a booking-specific answer.";
}

export function replyLooksMisrouted(intent: ChatbotIntent, reply: string): boolean {
  const r = normalize(reply);
  const tourHeavy = scoreAny(r, ["tour", "투어", "상품", "추천", "/tour-product/", "day tour"]) >= 2;
  if (intent === "policy") {
    return tourHeavy && !hasAny(r, ["refund", "cancel", "policy", "환불", "취소", "정책", "24"]);
  }
  if (intent === "booking_specific" || intent === "company" || intent === "legal" || intent === "poi") {
    return tourHeavy && !hasAny(r, ["support", "contact", "담당자", "고객", "legal", "privacy", "개인정보", "입장", "주차"]);
  }
  return false;
}
