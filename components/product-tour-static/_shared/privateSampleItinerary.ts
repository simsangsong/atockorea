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

/**
 * Cruise shore-excursion charters do NOT collect from hotels. The Busan cruise
 * charter's own `pickup_dropoff.notes` says so in as many words ("Hotel pickup
 * is not offered on this SKU"), and the channel listing sells it as cruise
 * passengers only — yet this section rendered "호텔 픽업 (기본)" right under it.
 * A real render is what showed the two sitting on the same page.
 */
const CRUISE_PICKUP: SampleSlot = {
  time: "09:00",
  kind: "pickup",
  title: { ko: "크루즈 터미널 픽업", en: "Cruise terminal pickup" },
  note: {
    ko: "배가 접안하는 터미널의 도착 홀에서 출발 — 영도 또는 초량, 예약 후 확정",
    en: "From the arrival hall of whichever terminal your ship berths at — Yeongdo or Choryang, confirmed at booking",
  },
};

const CRUISE_DROPOFF: SampleSlot = {
  time: "17:00",
  kind: "dropoff",
  title: { ko: "크루즈 터미널 하차", en: "Cruise terminal drop-off" },
  note: {
    ko: "아침에 모셨던 터미널로 복귀 — 승선 마감 시각 최소 60분 전",
    en: "Back to the terminal you were collected from — at least 60 minutes before all-aboard",
  },
};

/** A slot that names a real stop, instead of promising one later. */
function namedStop(title: LocalizedText): SampleSlot {
  return { kind: "stop", title };
}

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

/**
 * The Busan charter is a CRUISE shore excursion, so its samples start and end at
 * the ship, and its slots name real stops. The stop names are lifted from
 * documented courses in this repo — the charter's own bundle for the Busan day,
 * and `from-busan-gyeongju-ancient-capital-day-tour` for the Gyeongju day — not
 * invented here. Shipping "일정 슬롯 1 / 방문지 추후 추가 예정" to a paying guest
 * was the placeholder leaking, not a design.
 */
const BUSAN_CONFIG: PrivateSampleItineraryConfig = {
  title: { ko: "샘플 일정", en: "Sample Itineraries" },
  subtitle: {
    ko: "프라이빗 차량 투어의 예시 일정입니다. 아래 일정을 기준으로 고객님 일정에 맞춰 자유롭게 조정해 드립니다.",
    en: "Example day plans for the private charter. Use them as a starting point — we tailor the day to you.",
  },
  samples: [
    {
      id: "busan-city",
      label: { ko: "부산 시내", en: "Busan City" },
      blurb: {
        ko: "유엔기념공원·태종대·감천문화마을·용두산·자갈치를 잇는 부산 시내 핵심 코스",
        en: "The core Busan day — UN Memorial Cemetery, Taejongdae, Gamcheon, Yongdusan and Jagalchi",
      },
      slots: [
        CRUISE_PICKUP,
        namedStop({ ko: "유엔기념공원 (한국전쟁)", en: "UN Memorial Cemetery (Korean War)" }),
        namedStop({ ko: "태종대 해안 절벽", en: "Taejongdae coastal cliffs" }),
        namedStop({ ko: "점심식사 (부산 현지 식당)", en: "Lunch (local Busan restaurant)" }),
        namedStop({ ko: "감천문화마을", en: "Gamcheon Culture Village" }),
        namedStop({ ko: "용두산공원 & 부산타워", en: "Yongdusan Park & Busan Tower" }),
        namedStop({ ko: "남포동 & 자갈치 수산시장", en: "Nampo-dong & Jagalchi Fish Market" }),
        CRUISE_DROPOFF,
      ],
    },
    {
      id: "gyeongju",
      label: { ko: "경주", en: "Gyeongju" },
      blurb: {
        ko: "신라 천년 고도 경주 당일 코스 (부산 외 목적지 추가 요금)",
        en: "Day trip to the ancient Silla capital of Gyeongju (outside-Busan surcharge applies)",
      },
      slots: [
        CRUISE_PICKUP,
        namedStop({ ko: "불국사 (유네스코 세계문화유산)", en: "Bulguksa Temple (UNESCO World Heritage)" }),
        namedStop({ ko: "점심식사 (경주 현지 식당)", en: "Lunch (local Gyeongju restaurant)" }),
        namedStop({ ko: "교촌한옥마을 & 월정교", en: "Gyochon Hanok Village & Woljeonggyo Bridge" }),
        namedStop({ ko: "대릉원 & 황리단길", en: "Daereungwon Tomb Complex & Hwangnidan-gil" }),
        namedStop({ ko: "국립경주박물관", en: "Gyeongju National Museum" }),
        CRUISE_DROPOFF,
      ],
    },
  ],
  rulesTitle: { ko: "프라이빗 투어 안내", en: "Private Tour Guidelines" },
  rules: [
    ...COMMON_PRIVATE_RULES.filter((r) => !r.text.ko.includes("투숙 호텔이 기본")),
    {
      text: {
        ko: "픽업·하차는 배가 접안하는 크루즈 터미널입니다. 기항지 전세 상품이라 호텔·KTX 픽업은 제공하지 않습니다.",
        en: "Pickup and drop-off are at the cruise terminal your ship berths at. This is a shore-excursion charter, so hotel and KTX pickup are not offered.",
      },
    },
    {
      emphasis: true,
      // Listing figure. The module previously said ₩70,000 for Gyeongju, which
      // contradicted the ₩130,000 out-of-Busan surcharge stated in the policy
      // accordion on the same page.
      text: {
        ko: "부산 외 목적지(경주 등)를 포함하는 경우 130,000원이 추가됩니다.",
        en: "Destinations outside Busan (Gyeongju, for example) add ₩130,000.",
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
        "pocheon",
        { ko: "포천", en: "Pocheon" },
        { ko: "산정호수·허브아일랜드·아트밸리 등 포천 근교 코스", en: "Pocheon highlights — Sanjeong Lake, Herb Island, Art Valley" },
        5,
      ),
      sampleDay(
        "seoul-city",
        { ko: "서울 시내", en: "Seoul City" },
        { ko: "고궁·남산·홍대 등 서울 시내 핵심 코스", en: "Core Seoul-city highlights — palaces, Namsan, Hongdae" },
        5,
      ),
      sampleDay(
        "suwon-hwaseong",
        { ko: "수원화성", en: "Suwon Hwaseong" },
        { ko: "수원화성·한국민속촌·스타필드 등 수원권 코스", en: "Suwon-area highlights — Hwaseong Fortress, Korean Folk Village, Starfield" },
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
  rules: [
    ...COMMON_PRIVATE_RULES,
    {
      emphasis: true,
      text: {
        ko: "제주시 외 지역에서 픽업 또는 드롭하는 경우 60,000원이 추가됩니다 (예약 시 결제 또는 당일 현금).",
        en: "Pickup or drop-off outside Jeju City adds ₩60,000 (paid at booking or in cash on the day).",
      },
    },
  ],
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
