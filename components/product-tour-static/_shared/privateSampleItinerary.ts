/**
 * Private-tour "Sample Itineraries" config.
 *
 * Powers the `샘플 일정` section on private car-charter product detail pages.
 * The private charter is fully customizable, so these are *example* day plans:
 * real stops, real photos, but the actual order is agreed after booking.
 *
 * Two things this file is strict about:
 *
 *  1. **Every display string carries all six locales.** `pickLocalized` used to
 *     fall back to English for ja/zh/zh-TW/es, so the whole section rendered in
 *     English on the Chinese and Japanese pages while the rest of the page was
 *     translated. Optional locales still fall back, but the Jeju/Busan/Seoul
 *     copy below fills them in.
 *  2. **Stops name real places and point at real photos.** Placeholder slots
 *     ("Itinerary slot 1 / Stop to be added") shipped to guests for a while;
 *     `image` is the POI photo already used elsewhere on the site for that spot.
 *
 * Below the sample slots each product shows a detailed private-tour rules
 * block, including the region surcharge rules:
 *   - Seoul charters: +₩50,000 when the plan reaches outer Gyeonggi.
 *   - Busan charters: +₩70,000 when the plan includes Gyeongju.
 *   - Jeju charters: +₩60,000 for pickup/drop-off outside Jeju City.
 */

export type PrivateLocale = "en" | "ko" | "ja" | "zh" | "zh-TW" | "es";

/**
 * Localized string. `ko` + `en` are required; the other four are optional and
 * fall back to English, so a half-translated entry degrades to the old
 * behaviour instead of rendering `undefined`.
 */
export type LocalizedText = {
  ko: string;
  en: string;
  ja?: string;
  zh?: string;
  "zh-TW"?: string;
  es?: string;
};

export function pickLocalized(text: LocalizedText, locale: PrivateLocale): string {
  return text[locale] ?? text.en;
}

export type SampleSlotKind = "pickup" | "stop" | "dropoff";

export type SampleSlot = {
  /** Optional clock label (e.g. "09:00"). Omit for unscheduled slots. */
  time?: string;
  title: LocalizedText;
  /** Optional secondary line — one sentence on why the stop is worth it. */
  note?: LocalizedText;
  kind: SampleSlotKind;
  /**
   * Photo for the stop, served from `/public/images/tours/**`. Omit when the
   * site has no photograph of that place yet — the card falls back to a
   * typographic tile rather than borrowing another spot's picture.
   */
  image?: string;
  /** Typical time on the ground, already localized (e.g. "약 60분"). */
  stay?: LocalizedText;
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
  title: {
    ko: "호텔 픽업 (기본)",
    en: "Hotel pickup (default)",
    ja: "ホテルお迎え（標準）",
    zh: "酒店接您（默认）",
    "zh-TW": "飯店接您（預設）",
    es: "Recogida en el hotel (por defecto)",
  },
  note: {
    ko: "투숙 호텔 로비에서 출발 — 요청 시 공항·터미널로 조정 가능",
    en: "Depart from your hotel lobby — adjustable to the airport or terminal on request",
    ja: "ご滞在ホテルのロビーから出発 — ご希望により空港・ターミナルへ変更可能",
    zh: "从您入住酒店的大堂出发 — 可应要求改为机场或码头",
    "zh-TW": "從您入住飯店的大廳出發 — 可應要求改為機場或碼頭",
    es: "Salida desde el vestíbulo de su hotel; se puede cambiar al aeropuerto o terminal si lo solicita",
  },
};

/** Hotel drop-off is the default for every private-charter sample. */
const HOTEL_DROPOFF: SampleSlot = {
  time: "18:00",
  kind: "dropoff",
  title: {
    ko: "호텔 드롭오프 (기본)",
    en: "Hotel drop-off (default)",
    ja: "ホテルお送り（標準）",
    zh: "送回酒店（默认）",
    "zh-TW": "送回飯店（預設）",
    es: "Regreso al hotel (por defecto)",
  },
  note: {
    ko: "투숙 호텔로 복귀 — 요청 시 다른 장소로 조정 가능",
    en: "Return to your hotel — adjustable to another location on request",
    ja: "ご滞在ホテルへお送り — ご希望により他の場所へ変更可能",
    zh: "送回您入住的酒店 — 可应要求改为其他地点",
    "zh-TW": "送回您入住的飯店 — 可應要求改為其他地點",
    es: "Regreso a su hotel; se puede cambiar a otro lugar si lo solicita",
  },
};

/** Shorthand for the "약 N분" stay label in all six locales. */
function stayMinutes(n: number): LocalizedText {
  return {
    ko: `약 ${n}분`,
    en: `approx. ${n} min`,
    ja: `約${n}分`,
    zh: `约${n}分钟`,
    "zh-TW": `約${n}分鐘`,
    es: `aprox. ${n} min`,
  };
}

/** Placeholder itinerary slot — used only where real stops are not defined yet. */
function emptyStop(n: number): SampleSlot {
  return {
    kind: "stop",
    title: {
      ko: `일정 슬롯 ${n}`,
      en: `Itinerary slot ${n}`,
      ja: `行程スロット ${n}`,
      zh: `行程位 ${n}`,
      "zh-TW": `行程位 ${n}`,
      es: `Tramo del itinerario ${n}`,
    },
    note: {
      ko: "예약 후 함께 정하는 자유 구간",
      en: "An open slot we plan together after booking",
      ja: "ご予約後に一緒に決める自由枠",
      zh: "预订后与您共同商定的自由时段",
      "zh-TW": "預訂後與您共同商定的自由時段",
      es: "Un tramo libre que planificamos juntos tras la reserva",
    },
  };
}

/** A sample day = hotel pickup → stops → hotel drop-off. */
function sampleDay(
  id: string,
  label: LocalizedText,
  blurb: LocalizedText,
  stops: SampleSlot[],
): SampleItinerary {
  return { id, label, blurb, slots: [HOTEL_PICKUP, ...stops, HOTEL_DROPOFF] };
}

/** A sample day whose stops are still placeholders. */
function placeholderDay(
  id: string,
  label: LocalizedText,
  blurb: LocalizedText,
  stopCount: number,
): SampleItinerary {
  return sampleDay(
    id,
    label,
    blurb,
    Array.from({ length: stopCount }, (_, i) => emptyStop(i + 1)),
  );
}

// ── Shared rule sets ────────────────────────────────────────────────────────

/**
 * What the charter fee covers. Ground truth is the operator's own listing:
 * driver-guide, private vehicle, fuel, tolls, parking and tax are inside the
 * price; admissions, meals and tips are not. The previous copy listed parking
 * as a guest expense, which was wrong in the guest's disfavour.
 */
const COMMON_PRIVATE_RULES: PrivateTourRule[] = [
  {
    text: {
      ko: "차량과 전담 기사는 고객님 일행만 단독으로 이용합니다 (합승 없음).",
      en: "The vehicle and dedicated driver are exclusively for your party — no sharing.",
      ja: "車両と専属ドライバーはお客様のグループ専用です（相乗りなし）。",
      zh: "车辆与专属司机仅供您的团队使用（不与他人拼车）。",
      "zh-TW": "車輛與專屬司機僅供您的團體使用（不與他人共乘）。",
      es: "El vehículo y el conductor son exclusivos para su grupo, sin compartir con otros pasajeros.",
    },
  },
  {
    text: {
      ko: "요금에 포함되는 것: 가이드 기사, 전용 차량, 유류비, 주차료, 통행료.",
      en: "Included in the price: your driver-guide, the private vehicle, fuel, parking fees and tolls.",
      ja: "料金に含まれるもの：ガイドドライバー、専用車両、燃料費、駐車料金、通行料。",
      zh: "费用包含：司导、专属车辆、燃油费、停车费、过路费。",
      "zh-TW": "費用包含：司機導遊、專屬車輛、燃油費、停車費、過路費。",
      es: "Incluido en el precio: conductor-guía, vehículo privado, combustible, aparcamiento y peajes.",
    },
    emphasis: true,
  },
  {
    text: {
      ko: "포함되지 않는 것: 관광지 입장료, 식사·음료, 팁. 입장료와 식사는 현장에서 각자 결제하십니다.",
      en: "Not included: attraction admissions, meals and drinks, and tips. Admissions and meals are paid individually on site.",
      ja: "含まれないもの：観光地の入場料、食事・飲み物、チップ。入場料と食事は現地で各自お支払いいただきます。",
      zh: "不包含：景点门票、餐饮、小费。门票与餐食请于现场各自支付。",
      "zh-TW": "不包含：景點門票、餐飲、小費。門票與餐食請於現場各自支付。",
      es: "No incluido: entradas a atracciones, comidas y bebidas, y propinas. Las entradas y comidas se pagan en el momento.",
    },
    emphasis: true,
  },
  {
    text: {
      ko: "표시된 샘플 일정은 예시이며, 실제 방문지·순서는 예약 후 함께 확정합니다.",
      en: "The sample itineraries shown are examples — actual stops and order are confirmed together after booking.",
      ja: "掲載のサンプル行程は一例です。実際の訪問地と順番はご予約後に一緒に確定します。",
      zh: "所示样本行程仅为示例，实际站点与顺序将在预订后与您共同确定。",
      "zh-TW": "所示範例行程僅為示意，實際站點與順序將在預訂後與您共同確定。",
      es: "Los itinerarios mostrados son ejemplos: las paradas y el orden se confirman juntos tras la reserva.",
    },
  },
  {
    text: {
      ko: "픽업·드롭오프는 투숙 호텔이 기본이며, 요청 시 공항·터미널 등으로 조정 가능합니다.",
      en: "Pickup and drop-off default to your hotel; the airport, a terminal, etc. can be arranged on request.",
      ja: "送迎はご滞在ホテルが基本です。ご希望により空港・ターミナルなどへ調整できます。",
      zh: "接送默认在您入住的酒店，可应要求调整为机场、码头等地点。",
      "zh-TW": "接送預設在您入住的飯店，可應要求調整為機場、碼頭等地點。",
      es: "La recogida y el regreso son en su hotel por defecto; el aeropuerto o una terminal pueden gestionarse a petición.",
    },
  },
  {
    text: {
      ko: "일정은 정해진 운행 시간 내에서 고객님 요청에 따라 자유롭게 구성·변경할 수 있습니다.",
      en: "Within the booked hours, the day can be freely arranged or changed to your requests.",
      ja: "ご予約の運行時間内であれば、ご要望に応じて自由に構成・変更できます。",
      zh: "在预订的用车时长内，行程可依您的要求自由安排或调整。",
      "zh-TW": "在預訂的用車時數內，行程可依您的要求自由安排或調整。",
      es: "Dentro de las horas contratadas, el día puede organizarse o cambiarse según sus peticiones.",
    },
  },
  {
    text: {
      ko: "기본 운행 시간을 초과할 경우 시간당 추가 요금이 발생할 수 있습니다.",
      en: "Exceeding the booked hours may incur an additional per-hour charge.",
      ja: "ご予約の運行時間を超過した場合、1時間ごとの追加料金が発生することがあります。",
      zh: "超出预订用车时长时，可能按小时收取额外费用。",
      "zh-TW": "超出預訂用車時數時，可能按小時收取額外費用。",
      es: "Superar las horas contratadas puede conllevar un cargo adicional por hora.",
    },
  },
];

const SAMPLE_TITLE: LocalizedText = {
  ko: "샘플 일정",
  en: "Sample Itineraries",
  ja: "サンプル行程",
  zh: "样本行程",
  "zh-TW": "範例行程",
  es: "Itinerarios de ejemplo",
};

const SAMPLE_SUBTITLE: LocalizedText = {
  ko: "프라이빗 차량 투어의 예시 일정입니다. 아래 일정을 기준으로 고객님 일정에 맞춰 자유롭게 조정해 드립니다.",
  en: "Example day plans for the private charter. Use them as a starting point — we tailor the day to you.",
  ja: "プライベートチャーターの一日プラン例です。これを出発点に、お客様に合わせて組み立てます。",
  zh: "私人包车的一日行程示例。以此为起点，我们会按您的需求量身调整。",
  "zh-TW": "私人包車的一日行程範例。以此為起點，我們會按您的需求量身調整。",
  es: "Planes de día de ejemplo para el servicio privado. Son un punto de partida: adaptamos el día a usted.",
};

const RULES_TITLE: LocalizedText = {
  ko: "프라이빗 투어 안내",
  en: "Private Tour Guidelines",
  ja: "プライベートツアーのご案内",
  zh: "私人包车须知",
  "zh-TW": "私人包車須知",
  es: "Información del tour privado",
};

// ── Jeju stops ──────────────────────────────────────────────────────────────
//
// Photo paths reuse the POI imagery already shipped with the Jeju day tours.
// Manjanggul has no photograph of its own on the site: the eastern UNESCO tour
// has long illustrated that stop with the Ilchulland lava-tube images, so this
// follows the same convention. Oedolgae has no asset at all and renders
// without a photo.

const JEJU_EAST_STOPS: SampleSlot[] = [
  {
    kind: "stop",
    title: {
      ko: "함덕 서우봉 해변",
      en: "Hamdeok Seoubong Beach",
      ja: "咸徳ソウボンビーチ",
      zh: "咸德犀牛峰海滩",
      "zh-TW": "咸德犀牛峰海灘",
      es: "Playa de Hamdeok Seoubong",
    },
    note: {
      ko: "에메랄드빛 얕은 바다와 흰 모래 — 동부로 향하는 첫 정차",
      en: "Emerald shallows and white sand — the first stop on the way east",
      ja: "エメラルド色の浅瀬と白砂 — 東部へ向かう最初の停車地",
      zh: "翡翠色浅滩与白沙 — 前往东部的第一站",
      "zh-TW": "翡翠色淺灘與白沙 — 前往東部的第一站",
      es: "Aguas turquesas poco profundas y arena blanca: la primera parada rumbo al este",
    },
    image: "/images/tours/hamdeok-beach/kakaotalk-20260510-230028438.webp",
    stay: stayMinutes(45),
  },
  {
    kind: "stop",
    title: {
      ko: "만장굴 용암동굴",
      en: "Manjanggul Lava Tube",
      ja: "万丈窟（溶岩洞窟）",
      zh: "万丈窟熔岩洞",
      "zh-TW": "萬丈窟熔岩洞",
      es: "Tubo de lava Manjanggul",
    },
    note: {
      ko: "유네스코 세계자연유산 — 연중 11~13℃, 7.6m 용암석주",
      en: "UNESCO World Natural Heritage — 11–13°C year-round, a 7.6 m lava column",
      ja: "ユネスコ世界自然遺産 — 年間11〜13℃、高さ7.6mの溶岩柱",
      zh: "联合国教科文组织世界自然遗产 — 全年11~13℃，7.6米熔岩石柱",
      "zh-TW": "聯合國教科文組織世界自然遺產 — 全年11~13℃，7.6公尺熔岩石柱",
      es: "Patrimonio Natural de la UNESCO: 11–13 °C todo el año y una columna de lava de 7,6 m",
    },
    image: "/images/tours/ilchulland/chatgpt-image-2026-5-8-07-49-08.webp",
    stay: stayMinutes(60),
  },
  {
    kind: "stop",
    title: {
      ko: "성산일출봉",
      en: "Seongsan Ilchulbong",
      ja: "城山日出峰",
      zh: "城山日出峰",
      "zh-TW": "城山日出峰",
      es: "Seongsan Ilchulbong",
    },
    note: {
      ko: "바다에서 솟은 응회구 — 정상까지 왕복 약 60분",
      en: "A tuff cone risen from the sea — about 60 minutes round trip to the rim",
      ja: "海から隆起した凝灰岩の火山 — 頂上まで往復約60分",
      zh: "自海中隆起的凝灰岩火山口 — 登顶往返约60分钟",
      "zh-TW": "自海中隆起的凝灰岩火山口 — 登頂往返約60分鐘",
      es: "Un cono de toba surgido del mar; unos 60 minutos ida y vuelta hasta el borde",
    },
    image: "/images/tours/seongsan-ilchulbong/kakaotalk-20260510-230028438-06.webp",
    stay: stayMinutes(90),
  },
  {
    kind: "stop",
    title: {
      ko: "해녀 물질 공연",
      en: "Haenyeo Diving Show",
      ja: "海女の素潜り実演",
      zh: "海女潜水表演",
      "zh-TW": "海女潛水表演",
      es: "Espectáculo de buceo Haenyeo",
    },
    note: {
      ko: "성산 앞바다에서 매일 14:00 1회 — 취소 시 해녀박물관으로 대체",
      en: "Once daily at 14:00 in the cove below Seongsan — the Haenyeo Museum stands in if it is cancelled",
      ja: "城山の入り江で毎日14:00の1回のみ — 中止の場合は海女博物館へ振替",
      zh: "城山海湾每日仅14:00一场 — 若取消则改为海女博物馆",
      "zh-TW": "城山海灣每日僅14:00一場 — 若取消則改為海女博物館",
      es: "Una vez al día a las 14:00 en la cala bajo Seongsan; si se cancela, se visita el Museo Haenyeo",
    },
    image: "/images/tours/seongsan-ilchulbong/seongsan-haenyeo-show-ai.webp",
    stay: stayMinutes(40),
  },
  {
    kind: "stop",
    title: {
      ko: "성읍민속마을",
      en: "Seongeup Folk Village",
      ja: "城邑民俗村",
      zh: "城邑民俗村",
      "zh-TW": "城邑民俗村",
      es: "Aldea folclórica de Seongeup",
    },
    note: {
      ko: "1423년에 자리 잡은 성곽 마을 — 초가와 돌담 골목",
      en: "A walled town settled in 1423 — thatched roofs and stone-wall lanes",
      ja: "1423年に築かれた城郭の村 — 茅葺き屋根と石垣の路地",
      zh: "始建于1423年的城郭村落 — 茅草屋顶与石墙小巷",
      "zh-TW": "始建於1423年的城郭村落 — 茅草屋頂與石牆小巷",
      es: "Una villa amurallada fundada en 1423, con techos de paja y callejones de piedra",
    },
    image: "/images/tours/seongeup-folk-village/chatgpt-image-2026-5-8-07-37-51.webp",
    stay: stayMinutes(50),
  },
];

const JEJU_SOUTHWEST_STOPS: SampleSlot[] = [
  {
    kind: "stop",
    title: {
      ko: "한라산 1100고지 습지",
      en: "Hallasan 1100 Highland Wetland",
      ja: "漢拏山1100高地湿原",
      zh: "汉拿山1100高地湿地",
      "zh-TW": "漢拏山1100高地濕地",
      es: "Humedal de altura Hallasan 1100",
    },
    note: {
      ko: "차로 오르는 람사르 습지 — 데크 한 바퀴면 충분한 고산 풍경",
      en: "A Ramsar wetland you reach by car — one loop of boardwalk for the alpine view",
      ja: "車で上がれるラムサール条約湿地 — デッキを一周するだけで高山の景色",
      zh: "驱车即可抵达的拉姆萨尔湿地 — 木栈道走一圈即可饱览高山景致",
      "zh-TW": "驅車即可抵達的拉姆薩濕地 — 木棧道走一圈即可飽覽高山景致",
      es: "Un humedal Ramsar al que se llega en coche: una vuelta por la pasarela basta para el paisaje alpino",
    },
    image: "/images/tours/hallasan-1100/kakaotalk-20260510-230009595-21.webp",
    stay: stayMinutes(40),
  },
  {
    kind: "stop",
    title: {
      ko: "대포 주상절리대",
      en: "Daepo Jusangjeolli Cliff",
      ja: "大浦柱状節理帯",
      zh: "大浦柱状节理带",
      "zh-TW": "大浦柱狀節理帶",
      es: "Acantilado de Jusangjeolli en Daepo",
    },
    note: {
      ko: "육각 기둥으로 굳은 용암 절벽에 파도가 부딪히는 자리",
      en: "Waves breaking against lava frozen into hexagonal columns",
      ja: "六角柱状に固まった溶岩の崖に波が砕ける場所",
      zh: "海浪拍击六角柱状熔岩绝壁之处",
      "zh-TW": "海浪拍擊六角柱狀熔岩絕壁之處",
      es: "Olas rompiendo contra lava solidificada en columnas hexagonales",
    },
    image: "/images/tours/jusangjeolli/chatgpt-image-2026-2-15-10-01-04.webp",
    stay: stayMinutes(45),
  },
  {
    kind: "stop",
    title: {
      ko: "천제연폭포",
      en: "Cheonjeyeon Falls",
      ja: "天帝淵瀑布",
      zh: "天帝渊瀑布",
      "zh-TW": "天帝淵瀑布",
      es: "Cascadas de Cheonjeyeon",
    },
    note: {
      ko: "3단 폭포와 선임교 — 숲 그늘을 따라 걷는 짧은 코스",
      en: "A three-tier waterfall and the Seonimgyo bridge, on a short shaded walk",
      ja: "三段の滝と仙臨橋 — 木陰を歩く短いコース",
      zh: "三段瀑布与仙临桥 — 沿林荫步行的短程路线",
      "zh-TW": "三段瀑布與仙臨橋 — 沿林蔭步行的短程路線",
      es: "Una cascada de tres niveles y el puente Seonimgyo, en un paseo corto y sombreado",
    },
    image: "/images/tours/cheonjeyeon-falls/kakaotalk-20260510-230009595-04.webp",
    stay: stayMinutes(50),
  },
  {
    kind: "stop",
    title: {
      ko: "오설록 티뮤지엄",
      en: "O'sulloc Tea Museum",
      ja: "オソルロク茶ミュージアム",
      zh: "O'sulloc 茶博物馆",
      "zh-TW": "O'sulloc 茶博物館",
      es: "Museo del Té O'sulloc",
    },
    note: {
      ko: "녹차밭에 둘러싸인 티하우스 — 녹차 아이스크림과 티라미수",
      en: "A tea house ringed by green-tea fields — green-tea ice cream and tiramisu",
      ja: "茶畑に囲まれたティーハウス — 抹茶アイスとティラミス",
      zh: "被绿茶田环绕的茶室 — 绿茶冰淇淋与提拉米苏",
      "zh-TW": "被綠茶田環繞的茶室 — 綠茶冰淇淋與提拉米蘇",
      es: "Una casa de té rodeada de campos de té verde, con helado de té verde y tiramisú",
    },
    image: "/images/tours/osulloc-tea/osulloc-sign-couple-20260521.webp",
    stay: stayMinutes(60),
  },
  {
    kind: "stop",
    title: {
      ko: "애월 카페거리",
      en: "Aewol Café Street",
      ja: "涯月カフェ通り",
      zh: "涯月咖啡街",
      "zh-TW": "涯月咖啡街",
      es: "Calle de cafés de Aewol",
    },
    note: {
      ko: "한담 해안 산책로를 낀 바다 전망 카페 거리",
      en: "Ocean-view cafés along the Handam coastal walk",
      ja: "ハンダム海岸遊歩道沿いの、海を望むカフェ通り",
      zh: "沿汉潭海岸步道的海景咖啡街",
      "zh-TW": "沿漢潭海岸步道的海景咖啡街",
      es: "Cafés con vistas al mar junto al paseo costero de Handam",
    },
    image: "/images/tours/aewol-cafe-street/kakaotalk-20260510-230009595-24.webp",
    stay: stayMinutes(60),
  },
  {
    kind: "stop",
    title: {
      ko: "이호테우 말등대",
      en: "Iho Tewoo Horse Lighthouses",
      ja: "梨湖テウ海岸の馬灯台",
      zh: "梨湖海边马灯塔",
      "zh-TW": "梨湖海邊馬燈塔",
      es: "Faros con forma de caballo de Iho Tewoo",
    },
    note: {
      ko: "붉고 흰 목마 등대 — 공항 근처라 일몰 마무리로 좋습니다",
      en: "Red and white horse-shaped beacons — close to the airport, so a natural sunset finish",
      ja: "赤と白の馬の形をした灯台 — 空港に近く、夕暮れの締めくくりに最適",
      zh: "红白双色马形灯塔 — 邻近机场，适合作为日落收尾",
      "zh-TW": "紅白雙色馬形燈塔 — 鄰近機場，適合作為日落收尾",
      es: "Faros con forma de caballo, rojo y blanco; cerca del aeropuerto, ideal para cerrar al atardecer",
    },
    image: "/images/tours/iho-teu/chatgpt-image-2026-5-9-01-17-13.webp",
    stay: stayMinutes(30),
  },
];

const JEJU_SOUTH_STOPS: SampleSlot[] = [
  {
    kind: "stop",
    title: {
      ko: "정방폭포",
      en: "Jeongbang Falls",
      ja: "正房瀑布",
      zh: "正房瀑布",
      "zh-TW": "正房瀑布",
      es: "Cascada de Jeongbang",
    },
    note: {
      ko: "바다로 곧장 떨어지는 폭포 — 아시아에서 드문 지형",
      en: "A waterfall that drops straight into the sea — a rare landform in Asia",
      ja: "海へ直接落ちる滝 — アジアでは珍しい地形",
      zh: "直接落入海中的瀑布 — 亚洲罕见的地貌",
      "zh-TW": "直接落入海中的瀑布 — 亞洲罕見的地貌",
      es: "Una cascada que cae directamente al mar, un accidente raro en Asia",
    },
    image: "/images/tours/jeongbang-falls/kakaotalk-20260510-230028438-15.webp",
    stay: stayMinutes(50),
  },
  {
    kind: "stop",
    title: {
      ko: "외돌개 · 올레 7코스",
      en: "Oedolgae & Olle Route 7",
      ja: "ウェドルゲ（孤立岩）・オルレ7コース",
      zh: "独立岩与偶来7号路线",
      "zh-TW": "獨立岩與偶來7號路線",
      es: "Oedolgae y la ruta Olle 7",
    },
    note: {
      ko: "20m 바위 기둥에서 시작하는 해안 절벽길 — 원하는 만큼만 걷습니다",
      en: "A cliff-edge coastal path starting at the 20 m sea stack — walk only as far as you like",
      ja: "高さ20mの奇岩から始まる海岸絶壁の道 — 歩きたい分だけ",
      zh: "自20米海蚀柱起步的海岸崖径 — 想走多远就走多远",
      "zh-TW": "自20公尺海蝕柱起步的海岸崖徑 — 想走多遠就走多遠",
      es: "Un sendero costero que arranca en el peñón de 20 m; camine solo lo que quiera",
    },
    stay: stayMinutes(50),
  },
  {
    kind: "stop",
    title: {
      ko: "약천사",
      en: "Yakcheonsa Temple",
      ja: "薬泉寺",
      zh: "药泉寺",
      "zh-TW": "藥泉寺",
      es: "Templo de Yakcheonsa",
    },
    note: {
      ko: "동아시아 최대 규모의 대적광전 — 귤밭과 바다를 등진 법당",
      en: "The largest main hall in East Asia, backed by tangerine groves and the sea",
      ja: "東アジア最大の大寂光殿 — みかん畑と海を背にした法堂",
      zh: "东亚最大的大寂光殿 — 背倚橘园与大海的殿堂",
      "zh-TW": "東亞最大的大寂光殿 — 背倚橘園與大海的殿堂",
      es: "El mayor salón principal de Asia Oriental, con naranjales y el mar al fondo",
    },
    image: "/images/tours/yakcheonsa/photo-001.webp",
    stay: stayMinutes(40),
  },
  {
    kind: "stop",
    title: {
      ko: "오설록 티뮤지엄",
      en: "O'sulloc Tea Museum",
      ja: "オソルロク茶ミュージアム",
      zh: "O'sulloc 茶博物馆",
      "zh-TW": "O'sulloc 茶博物館",
      es: "Museo del Té O'sulloc",
    },
    note: {
      ko: "서쪽 내륙의 녹차밭 — 남부 일정의 쉼표",
      en: "Green-tea fields inland to the west — the pause in a southern day",
      ja: "西部内陸の茶畑 — 南部行程のひと休み",
      zh: "西部内陆的绿茶田 — 南线行程中的休止符",
      "zh-TW": "西部內陸的綠茶田 — 南線行程中的休止符",
      es: "Campos de té verde en el interior oeste: la pausa de una jornada por el sur",
    },
    image: "/images/tours/osulloc-tea/osulloc-sign-couple-20260521.webp",
    stay: stayMinutes(60),
  },
  {
    kind: "stop",
    title: {
      ko: "한라산 어승생악",
      en: "Hallasan Eoseungsaengak",
      ja: "漢拏山オスンセンアク",
      zh: "汉拿山御乘生岳",
      "zh-TW": "漢拏山御乘生岳",
      es: "Eoseungsaengak, en el Hallasan",
    },
    note: {
      ko: "왕복 1시간 남짓의 완만한 오름 — 맑으면 제주 북부가 다 보입니다",
      en: "A gentle hour-ish climb — on a clear day the whole north of Jeju opens up",
      ja: "往復1時間ほどの緩やかな登り — 晴れれば済州北部を一望",
      zh: "往返约一小时的平缓登山 — 天晴时可俯瞰济州北部全景",
      "zh-TW": "往返約一小時的平緩登山 — 天晴時可俯瞰濟州北部全景",
      es: "Una subida suave de aproximadamente una hora; en días claros se ve todo el norte de Jeju",
    },
    image: "/images/tours/hallasan-eoseungsaengak/kakaotalk-20260510-230009595-19.webp",
    stay: stayMinutes(75),
  },
];

// ── Per-product config ──────────────────────────────────────────────────────

const BUSAN_CONFIG: PrivateSampleItineraryConfig = {
  title: SAMPLE_TITLE,
  subtitle: SAMPLE_SUBTITLE,
  samples: [
    placeholderDay(
      "busan-city",
      {
        ko: "부산 시내",
        en: "Busan City",
        ja: "釜山市内",
        zh: "釜山市区",
        "zh-TW": "釜山市區",
        es: "Ciudad de Busan",
      },
      {
        ko: "해운대·광안리·남포동 등 부산 시내 핵심 코스",
        en: "Core Busan-city highlights — Haeundae, Gwangalli, Nampo-dong",
        ja: "海雲台・広安里・南浦洞など釜山市内の主要コース",
        zh: "海云台、广安里、南浦洞等釜山市区核心路线",
        "zh-TW": "海雲台、廣安里、南浦洞等釜山市區核心路線",
        es: "Lo esencial de Busan: Haeundae, Gwangalli y Nampo-dong",
      },
      5,
    ),
    placeholderDay(
      "gyeongju",
      {
        ko: "경주",
        en: "Gyeongju",
        ja: "慶州",
        zh: "庆州",
        "zh-TW": "慶州",
        es: "Gyeongju",
      },
      {
        ko: "신라 천년 고도 경주 당일 코스 (별도 추가 요금)",
        en: "Day trip to the ancient Silla capital of Gyeongju (surcharge applies)",
        ja: "新羅千年の古都・慶州への日帰りコース（追加料金あり）",
        zh: "新罗千年古都庆州一日线路（另收附加费）",
        "zh-TW": "新羅千年古都慶州一日路線（另收附加費）",
        es: "Excursión de un día a Gyeongju, antigua capital de Silla (con recargo)",
      },
      5,
    ),
  ],
  rulesTitle: RULES_TITLE,
  rules: [
    ...COMMON_PRIVATE_RULES,
    {
      emphasis: true,
      text: {
        ko: "경주 일정을 포함하는 경우 70,000원이 추가됩니다.",
        en: "Including Gyeongju in the plan adds ₩70,000.",
        ja: "行程に慶州を含める場合、70,000ウォンが加算されます。",
        zh: "行程包含庆州时，加收70,000韩元。",
        "zh-TW": "行程包含慶州時，加收70,000韓元。",
        es: "Incluir Gyeongju en el plan añade 70.000 KRW.",
      },
    },
  ],
};

function seoulConfig(): PrivateSampleItineraryConfig {
  return {
    title: SAMPLE_TITLE,
    subtitle: SAMPLE_SUBTITLE,
    samples: [
      placeholderDay(
        "pocheon",
        { ko: "포천", en: "Pocheon", ja: "抱川", zh: "抱川", "zh-TW": "抱川", es: "Pocheon" },
        {
          ko: "산정호수·허브아일랜드·아트밸리 등 포천 근교 코스",
          en: "Pocheon highlights — Sanjeong Lake, Herb Island, Art Valley",
          ja: "山井湖・ハーブアイランド・アートバレーなど抱川近郊コース",
          zh: "山井湖、香草岛乐园、艺术谷等抱川近郊路线",
          "zh-TW": "山井湖、香草島樂園、藝術谷等抱川近郊路線",
          es: "Lo mejor de Pocheon: lago Sanjeong, Herb Island y Art Valley",
        },
        5,
      ),
      placeholderDay(
        "seoul-city",
        { ko: "서울 시내", en: "Seoul City", ja: "ソウル市内", zh: "首尔市区", "zh-TW": "首爾市區", es: "Ciudad de Seúl" },
        {
          ko: "고궁·남산·홍대 등 서울 시내 핵심 코스",
          en: "Core Seoul-city highlights — palaces, Namsan, Hongdae",
          ja: "古宮・南山・弘大などソウル市内の主要コース",
          zh: "古宫、南山、弘大等首尔市区核心路线",
          "zh-TW": "古宮、南山、弘大等首爾市區核心路線",
          es: "Lo esencial de Seúl: palacios, Namsan y Hongdae",
        },
        5,
      ),
      placeholderDay(
        "suwon-hwaseong",
        { ko: "수원화성", en: "Suwon Hwaseong", ja: "水原華城", zh: "水原华城", "zh-TW": "水原華城", es: "Hwaseong de Suwon" },
        {
          ko: "수원화성·한국민속촌·스타필드 등 수원권 코스",
          en: "Suwon-area highlights — Hwaseong Fortress, Korean Folk Village, Starfield",
          ja: "水原華城・韓国民俗村・スターフィールドなど水原圏コース",
          zh: "水原华城、韩国民俗村、Starfield等水原地区路线",
          "zh-TW": "水原華城、韓國民俗村、Starfield等水原地區路線",
          es: "Zona de Suwon: fortaleza de Hwaseong, Aldea Folclórica Coreana y Starfield",
        },
        5,
      ),
    ],
    rulesTitle: RULES_TITLE,
    rules: [
      ...COMMON_PRIVATE_RULES,
      {
        emphasis: true,
        text: {
          ko: "경기 외곽 지역을 방문하는 경우 50,000원이 추가됩니다.",
          en: "Visiting outer Gyeonggi areas adds ₩50,000.",
          ja: "京畿道の外郭地域を訪れる場合、50,000ウォンが加算されます。",
          zh: "前往京畿道外围地区时，加收50,000韩元。",
          "zh-TW": "前往京畿道外圍地區時，加收50,000韓元。",
          es: "Visitar zonas exteriores de Gyeonggi añade 50.000 KRW.",
        },
      },
    ],
  };
}

const JEJU_CONFIG: PrivateSampleItineraryConfig = {
  title: SAMPLE_TITLE,
  subtitle: SAMPLE_SUBTITLE,
  samples: [
    sampleDay(
      "jeju-east",
      { ko: "동부", en: "Jeju East", ja: "東部", zh: "东部", "zh-TW": "東部", es: "Jeju Este" },
      {
        ko: "함덕 바다에서 만장굴·성산일출봉을 지나 성읍민속마을까지 — 유네스코 동부 코스",
        en: "From Hamdeok's water through Manjanggul and Seongsan to Seongeup Folk Village — the UNESCO east",
        ja: "咸徳の海から万丈窟・城山日出峰を経て城邑民俗村へ — ユネスコの東部コース",
        zh: "从咸德海滨经万丈窟、城山日出峰到城邑民俗村 — 教科文组织东部路线",
        "zh-TW": "從咸德海濱經萬丈窟、城山日出峰到城邑民俗村 — 教科文組織東部路線",
        es: "Del agua de Hamdeok a Manjanggul y Seongsan, hasta la aldea de Seongeup: el este UNESCO",
      },
      JEJU_EAST_STOPS,
    ),
    sampleDay(
      "jeju-southwest",
      { ko: "서남부", en: "Jeju Southwest", ja: "西南部", zh: "西南部", "zh-TW": "西南部", es: "Jeju Suroeste" },
      {
        ko: "1100고지에서 내려와 주상절리·천제연을 지나 오설록과 애월, 이호테우 일몰까지",
        en: "Down from the 1100 Highland past Jusangjeolli and Cheonjeyeon to O'sulloc, Aewol and the Iho Tewoo sunset",
        ja: "1100高地から下り、柱状節理・天帝淵を経てオソルロクと涯月、梨湖テウの夕日まで",
        zh: "自1100高地一路而下，经柱状节理、天帝渊，前往O'sulloc、涯月与梨湖的日落",
        "zh-TW": "自1100高地一路而下，經柱狀節理、天帝淵，前往O'sulloc、涯月與梨湖的日落",
        es: "Desde el altiplano 1100 pasando por Jusangjeolli y Cheonjeyeon hasta O'sulloc, Aewol y el ocaso de Iho Tewoo",
      },
      JEJU_SOUTHWEST_STOPS,
    ),
    sampleDay(
      "jeju-south",
      { ko: "남부", en: "Jeju South", ja: "南部", zh: "南部", "zh-TW": "南部", es: "Jeju Sur" },
      {
        ko: "정방폭포와 외돌개 해안길, 약천사를 거쳐 오설록과 어승생악으로 마무리",
        en: "Jeongbang Falls and the Oedolgae coast path, then Yakcheonsa, O'sulloc and a finish at Eoseungsaengak",
        ja: "正房瀑布とウェドルゲの海岸路、薬泉寺を経てオソルロクと御乗生岳で締めくくり",
        zh: "正房瀑布与独立岩海岸路，经药泉寺后以O'sulloc和御乘生岳收尾",
        "zh-TW": "正房瀑布與獨立岩海岸路，經藥泉寺後以O'sulloc和御乘生岳收尾",
        es: "La cascada de Jeongbang y el sendero de Oedolgae, luego Yakcheonsa, O'sulloc y final en Eoseungsaengak",
      },
      JEJU_SOUTH_STOPS,
    ),
  ],
  rulesTitle: RULES_TITLE,
  rules: [
    ...COMMON_PRIVATE_RULES,
    {
      emphasis: true,
      text: {
        ko: "제주시 외 지역에서 픽업 또는 드롭하는 경우 60,000원이 추가됩니다 (예약 시 결제 또는 당일 현금).",
        en: "Pickup or drop-off outside Jeju City adds ₩60,000 (paid at booking or in cash on the day).",
        ja: "済州市外での送迎の場合、60,000ウォンが加算されます（ご予約時のお支払い、または当日現金）。",
        zh: "在济州市以外接送时，加收60,000韩元（预订时支付或当天现金支付）。",
        "zh-TW": "在濟州市以外接送時，加收60,000韓元（預訂時支付或當天現金支付）。",
        es: "La recogida o el regreso fuera de la ciudad de Jeju añade 60.000 KRW (al reservar o en efectivo ese día).",
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
