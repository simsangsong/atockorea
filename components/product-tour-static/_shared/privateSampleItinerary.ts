/**
 * Private-tour "Sample Itineraries" config.
 *
 * Powers the `샘플 일정` section on private car-charter product detail pages.
 * The private charter is fully customizable, so we only show *example* day
 * plans here — the itinerary slots are intentionally placeholders. Real stop
 * content is imported later (per product direction "일단 일정 슬롯만 만들고
 * import는 나중에"). No pricing/availability logic lives here; pickup and
 * drop-off default to the guest's hotel.
 *
 * Below the sample slots each product shows a detailed private-tour rules
 * block, including the region surcharge rules:
 *   - Seoul charters: +₩50,000 when the plan reaches outer Gyeonggi.
 *   - Busan charters: +₩70,000 when the plan includes Gyeongju.
 */

export type PrivateLocale = "en" | "ko" | "ja" | "zh" | "zh-TW" | "es";

/** Minimal localized string — Korean primary, English fallback for others. */
export type LocalizedText = {
  ko: string;
  en: string;
};

export function pickLocalized(text: LocalizedText, locale: PrivateLocale): string {
  if (locale === "ko") return text.ko;
  return text.en;
}

export type SampleSlotKind = "pickup" | "stop" | "dropoff";

export type SampleSlot = {
  /** Optional clock label (e.g. "09:00"). Omit for unscheduled slots. */
  time?: string;
  title: LocalizedText;
  /** Optional secondary line (e.g. "추후 추가 예정"). */
  note?: LocalizedText;
  kind: SampleSlotKind;
};

export type SampleItinerary = {
  id: string;
  label: LocalizedText;
  blurb?: LocalizedText;
  slots: SampleSlot[];
};

export type PrivateTourRule = {
  text: LocalizedText;
  /** Highlight this rule (used for surcharge / binding rules). */
  emphasis?: boolean;
};

export type PrivateSampleItineraryConfig = {
  title: LocalizedText;
  subtitle: LocalizedText;
  samples: SampleItinerary[];
  rulesTitle: LocalizedText;
  rules: PrivateTourRule[];
};

// ── Reusable building blocks ────────────────────────────────────────────────

/** Hotel pickup is the default for every private-charter sample. */
const HOTEL_PICKUP: SampleSlot = {
  time: "09:00",
  kind: "pickup",
  title: { ko: "호텔 픽업 (기본)", en: "Hotel pickup (default)" },
  note: {
    ko: "투숙 호텔 로비에서 출발 — 요청 시 KTX역·공항으로 조정 가능",
    en: "Depart from your hotel lobby — adjustable to KTX station / airport on request",
  },
};

/** Hotel drop-off is the default for every private-charter sample. */
const HOTEL_DROPOFF: SampleSlot = {
  time: "18:00",
  kind: "dropoff",
  title: { ko: "호텔 드롭오프 (기본)", en: "Hotel drop-off (default)" },
  note: {
    ko: "투숙 호텔로 복귀 — 요청 시 다른 장소로 조정 가능",
    en: "Return to your hotel — adjustable to another location on request",
  },
};

/** Placeholder itinerary slot — real stops are imported later. */
function emptyStop(n: number): SampleSlot {
  return {
    kind: "stop",
    title: { ko: `일정 슬롯 ${n}`, en: `Itinerary slot ${n}` },
    note: { ko: "방문지 추후 추가 예정", en: "Stop to be added" },
  };
}

/** A sample day = hotel pickup → N placeholder slots → hotel drop-off. */
function sampleDay(
  id: string,
  label: LocalizedText,
  blurb: LocalizedText,
  stopCount: number,
): SampleItinerary {
  return {
    id,
    label,
    blurb,
    slots: [
      HOTEL_PICKUP,
      ...Array.from({ length: stopCount }, (_, i) => emptyStop(i + 1)),
      HOTEL_DROPOFF,
    ],
  };
}

// ── Shared rule sets ────────────────────────────────────────────────────────

const COMMON_PRIVATE_RULES: PrivateTourRule[] = [
  {
    text: {
      ko: "차량과 전담 기사는 고객님 일행만 단독으로 이용합니다 (합승 없음).",
      en: "The vehicle and dedicated driver are exclusively for your party — no sharing.",
    },
  },
  {
    text: {
      ko: "표시된 샘플 일정은 예시이며, 실제 방문지·순서는 예약 후 함께 확정합니다.",
      en: "The sample itineraries shown are examples — actual stops and order are confirmed together after booking.",
    },
  },
  {
    text: {
      ko: "픽업·드롭오프는 투숙 호텔이 기본이며, 요청 시 KTX역·공항 등으로 조정 가능합니다.",
      en: "Pickup and drop-off default to your hotel; KTX station, airport, etc. can be arranged on request.",
    },
  },
  {
    text: {
      ko: "일정은 정해진 운행 시간 내에서 고객님 요청에 따라 자유롭게 구성·변경할 수 있습니다.",
      en: "Within the booked hours, the day can be freely arranged or changed to your requests.",
    },
  },
  {
    text: {
      ko: "입장료·식사·주차료 등 개인 비용은 요금에 포함되지 않습니다.",
      en: "Admission fees, meals, and parking are personal expenses and not included in the price.",
    },
  },
  {
    text: {
      ko: "기본 운행 시간을 초과할 경우 시간당 추가 요금이 발생할 수 있습니다.",
      en: "Exceeding the booked hours may incur an additional per-hour charge.",
    },
  },
];

// ── Per-product config ──────────────────────────────────────────────────────

const BUSAN_CONFIG: PrivateSampleItineraryConfig = {
  title: { ko: "샘플 일정", en: "Sample Itineraries" },
  subtitle: {
    ko: "프라이빗 차량 투어의 예시 일정입니다. 아래 일정을 기준으로 고객님 일정에 맞춰 자유롭게 조정해 드립니다.",
    en: "Example day plans for the private charter. Use them as a starting point — we tailor the day to you.",
  },
  samples: [
    sampleDay(
      "busan-city",
      { ko: "부산 시내", en: "Busan City" },
      { ko: "해운대·광안리·남포동 등 부산 시내 핵심 코스", en: "Core Busan-city highlights — Haeundae, Gwangalli, Nampo-dong" },
      5,
    ),
    sampleDay(
      "gyeongju",
      { ko: "경주", en: "Gyeongju" },
      { ko: "신라 천년 고도 경주 당일 코스 (별도 추가 요금)", en: "Day trip to the ancient Silla capital of Gyeongju (surcharge applies)" },
      5,
    ),
  ],
  rulesTitle: { ko: "프라이빗 투어 안내", en: "Private Tour Guidelines" },
  rules: [
    ...COMMON_PRIVATE_RULES,
    {
      emphasis: true,
      text: {
        ko: "경주 일정을 포함하는 경우 70,000원이 추가됩니다.",
        en: "Including Gyeongju in the plan adds ₩70,000.",
      },
    },
  ],
};

function seoulConfig(): PrivateSampleItineraryConfig {
  return {
    title: { ko: "샘플 일정", en: "Sample Itineraries" },
    subtitle: {
      ko: "프라이빗 차량 투어의 예시 일정입니다. 아래 일정을 기준으로 고객님 일정에 맞춰 자유롭게 조정해 드립니다.",
      en: "Example day plans for the private charter. Use them as a starting point — we tailor the day to you.",
    },
    samples: [
      sampleDay(
        "seoul-city",
        { ko: "서울 시내", en: "Seoul City" },
        { ko: "고궁·남산·홍대 등 서울 시내 핵심 코스", en: "Core Seoul-city highlights — palaces, Namsan, Hongdae" },
        5,
      ),
      sampleDay(
        "seoul-suburbs",
        { ko: "서울 근교", en: "Seoul Suburbs" },
        { ko: "남이섬·아침고요수목원 등 경기·강원 근교 코스", en: "Suburban Gyeonggi/Gangwon — Nami Island, Garden of Morning Calm" },
        5,
      ),
    ],
    rulesTitle: { ko: "프라이빗 투어 안내", en: "Private Tour Guidelines" },
    rules: [
      ...COMMON_PRIVATE_RULES,
      {
        emphasis: true,
        text: {
          ko: "경기 외곽 지역을 방문하는 경우 50,000원이 추가됩니다.",
          en: "Visiting outer Gyeonggi areas adds ₩50,000.",
        },
      },
    ],
  };
}

const JEJU_CONFIG: PrivateSampleItineraryConfig = {
  title: { ko: "샘플 일정", en: "Sample Itineraries" },
  subtitle: {
    ko: "프라이빗 차량 투어의 예시 일정입니다. 아래 일정을 기준으로 고객님 일정에 맞춰 자유롭게 조정해 드립니다.",
    en: "Example day plans for the private charter. Use them as a starting point — we tailor the day to you.",
  },
  samples: [
    sampleDay(
      "jeju-east",
      { ko: "제주 동부", en: "Jeju East" },
      { ko: "성산일출봉·우도·섭지코지 등 제주 동부 핵심 코스", en: "Core Jeju-east highlights — Seongsan Ilchulbong, Udo, Seopjikoji" },
      5,
    ),
    sampleDay(
      "jeju-west",
      { ko: "제주 서부", en: "Jeju West" },
      { ko: "한림공원·오설록·애월 등 제주 서부 핵심 코스", en: "Core Jeju-west highlights — Hallim Park, Osulloc, Aewol" },
      5,
    ),
  ],
  rulesTitle: { ko: "프라이빗 투어 안내", en: "Private Tour Guidelines" },
  // No region surcharge specified for Jeju — common private-tour rules only.
  rules: [...COMMON_PRIVATE_RULES],
};

/**
 * Slug → sample-itinerary config. Only the dedicated private car-charter
 * products opt in; everything else returns null and the section is hidden.
 */
const PRIVATE_SAMPLE_ITINERARY: Record<string, PrivateSampleItineraryConfig> = {
  "busan-private-car-charter-cruise-shore": BUSAN_CONFIG,
  "seoul-suburbs-private-chartered-car-10hr": seoulConfig(),
  "incheon-seoul-private-car-shore-excursion-cruise": seoulConfig(),
  "jeju-island-private-car-charter-tour": JEJU_CONFIG,
};

export function getPrivateSampleItineraryConfig(
  slug: string,
): PrivateSampleItineraryConfig | null {
  return PRIVATE_SAMPLE_ITINERARY[slug] ?? null;
}
