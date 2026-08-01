/**
 * 지역 공통 해설(제주 알아보기) — 타입·라벨·거리 계산.
 *
 * 🔴 client-safe. `next/headers`를 끌어오는 것을 여기 import하면 클라이언트
 * 번들이 깨진다(2026-07 i18n 확장에서 한 번 당한 함정) — 서버 전용 조회는
 * 라우트가 하고, 이 파일은 순수 함수와 상수만 갖는다.
 *
 * 설계 메모 — **거리는 판정이 아니라 참고다.** 초안에서는 "N km 이상이면 오늘
 * 못 갑니다" 배지를 붙이려 했지만, 갈 수 있는지는 차량·교통·잔여 시간을 아는
 * 기사가 정한다. 앱이 단정하면 (a) 갈 수 있는 곳을 막거나 (b) 못 가는 곳을
 * 약속하게 된다. 그래서 여기에는 임계값이 없다. 숫자만 보여주고 판단은 사람이.
 */

import type { RoomLocale } from '@/lib/tour-room/snapshot';

export interface RegionScriptPlace {
  /** 'black_pork' | 'cafe' | … — UI가 라벨만 번역한다(상호는 고유명사). */
  tag: string;
  ko: string;
  en: string;
  addr?: string;
  phone?: string;
  lat?: number;
  lng?: number;
  /** 지점이 여러 개라 사람이 골라야 하는 항목. 관리 화면에서만 쓴다. */
  verify?: boolean;
}

export interface RegionScriptSource {
  label: string;
  url: string;
}

export interface RegionScriptCard {
  topicKey: string;
  icon: string | null;
  /** 4·3처럼 손님이 선택해서 여는 주제. 카드가 본문을 미리 펼치지 않는다. */
  sensitive: boolean;
  imageUrl: string | null;
  imageCredit: string | null;
  title: string;
  teaser: string;
  body: string;
  funFact: string | null;
  places: RegionScriptPlace[];
  sources: RegionScriptSource[];
}

/** 상품 → 지역. 지금은 슬러그로 충분하다(부산 크루즈가 들어오면 여기만 는다). */
export function regionKeyForTour(slug: string | null | undefined): string | null {
  const s = (slug ?? '').toLowerCase();
  if (!s) return null;
  if (s.includes('jeju')) return 'jeju';
  if (s.includes('busan')) return 'busan';
  return null;
}

// ---------------------------------------------------------------------------
// 거리 — 참고용
// ---------------------------------------------------------------------------

const EARTH_KM = 6371;
const rad = (d: number) => (d * Math.PI) / 180;

/** 두 좌표 사이 대권거리(km). 제주 규모에서는 도로거리와 충분히 비례한다. */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface StopPoint {
  lat: number;
  lng: number;
}

/**
 * 오늘 일정 스톱 중 가장 가까운 곳까지의 거리(km). 좌표가 없으면 null —
 * **0이 아니다.** 좌표 없음을 0으로 접으면 "바로 옆"으로 표시된다.
 */
export function nearestStopKm(
  place: RegionScriptPlace,
  stops: StopPoint[],
): number | null {
  if (typeof place.lat !== 'number' || typeof place.lng !== 'number') return null;
  const usable = stops.filter(
    (s) => Number.isFinite(s.lat) && Number.isFinite(s.lng),
  );
  if (usable.length === 0) return null;
  const here = { lat: place.lat, lng: place.lng };
  return usable.reduce(
    (min, s) => Math.min(min, haversineKm(here, s)),
    Number.POSITIVE_INFINITY,
  );
}

/** 좌표만으로 여는 구글지도 링크. 장소 ID가 없어도 되고 앱이 있으면 앱이 뜬다. */
export function googleMapsUrl(place: RegionScriptPlace): string | null {
  if (typeof place.lat !== 'number' || typeof place.lng !== 'number') return null;
  return `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`;
}

/** 1km 미만은 소수 한 자리, 그 이상은 정수. "0km"로 보이는 일이 없게. */
export function formatKm(km: number): string {
  return km < 10 ? `${km.toFixed(1)}km` : `${Math.round(km)}km`;
}

// ---------------------------------------------------------------------------
// 로케일 문자열
// ---------------------------------------------------------------------------

export const REGION_SCRIPT_UI: Record<
  RoomLocale,
  {
    sectionTitle: string;
    sectionHint: string;
    readMore: string;
    close: string;
    sensitive: string;
    places: string;
    /** 거리 표기 — {d}가 "12km"로 치환된다. */
    fromRoute: string;
    askDriver: string;
    openMap: string;
    sources: string;
  }
> = {
  en: {
    sectionTitle: 'About Jeju',
    sectionHint: 'Short reads for the drive',
    readMore: 'Read',
    close: 'Close',
    sensitive: 'Difficult history',
    places: 'Where to go',
    fromRoute: '{d} from today’s route',
    askDriver: 'Ask your driver whether today allows a stop — otherwise save it for a free day.',
    openMap: 'Map',
    sources: 'Sources',
  },
  ko: {
    sectionTitle: '제주 알아보기',
    sectionHint: '이동 중에 읽는 짧은 이야기',
    readMore: '읽기',
    close: '닫기',
    sensitive: '아픈 역사',
    places: '가볼 만한 곳',
    fromRoute: '오늘 경로에서 {d}',
    askDriver: '오늘 들를 수 있는지는 기사님께 여쭤보세요. 어려우면 자유일정 때 가보시면 됩니다.',
    openMap: '지도',
    sources: '출처',
  },
  ja: {
    sectionTitle: '済州を知る',
    sectionHint: '移動中に読む短い話',
    readMore: '読む',
    close: '閉じる',
    sensitive: '重い歴史',
    places: '行ってみる',
    fromRoute: '本日のルートから{d}',
    askDriver: '本日立ち寄れるかはドライバーにお尋ねください。難しければ自由行動の日にどうぞ。',
    openMap: '地図',
    sources: '出典',
  },
  es: {
    sectionTitle: 'Sobre Jeju',
    sectionHint: 'Lecturas breves para el trayecto',
    readMore: 'Leer',
    close: 'Cerrar',
    sensitive: 'Historia difícil',
    places: 'Dónde ir',
    fromRoute: 'A {d} de la ruta de hoy',
    askDriver: 'Pregunte a su conductor si hoy es posible parar; si no, guárdelo para un día libre.',
    openMap: 'Mapa',
    sources: 'Fuentes',
  },
  zh: {
    sectionTitle: '了解济州',
    sectionHint: '路上读的小故事',
    readMore: '阅读',
    close: '关闭',
    sensitive: '沉重的历史',
    places: '可以去的地方',
    fromRoute: '距今日路线{d}',
    askDriver: '今天能否顺路前往请询问司机；不方便的话可留到自由行的日子。',
    openMap: '地图',
    sources: '资料来源',
  },
  'zh-TW': {
    sectionTitle: '認識濟州',
    sectionHint: '路上讀的小故事',
    readMore: '閱讀',
    close: '關閉',
    sensitive: '沉重的歷史',
    places: '可以去的地方',
    fromRoute: '距今日路線{d}',
    askDriver: '今天能否順路前往請詢問司機；不方便的話可留到自由行的日子。',
    openMap: '地圖',
    sources: '資料來源',
  },
  fr: {
    sectionTitle: 'À propos de Jeju',
    sectionHint: 'De courtes lectures pour la route',
    readMore: 'Lire',
    close: 'Fermer',
    sensitive: 'Histoire douloureuse',
    places: 'Où aller',
    fromRoute: 'À {d} de l’itinéraire du jour',
    askDriver: 'Demandez à votre chauffeur si un arrêt est possible aujourd’hui ; sinon, gardez-le pour une journée libre.',
    openMap: 'Carte',
    sources: 'Sources',
  },
  de: {
    sectionTitle: 'Über Jeju',
    sectionHint: 'Kurze Lektüre für unterwegs',
    readMore: 'Lesen',
    close: 'Schließen',
    sensitive: 'Schwierige Geschichte',
    places: 'Wohin',
    fromRoute: '{d} von der heutigen Route',
    askDriver: 'Fragen Sie Ihren Fahrer, ob heute ein Halt möglich ist – sonst heben Sie es für einen freien Tag auf.',
    openMap: 'Karte',
    sources: 'Quellen',
  },
  ru: {
    sectionTitle: 'О Чеджу',
    sectionHint: 'Короткие тексты в дорогу',
    readMore: 'Читать',
    close: 'Закрыть',
    sensitive: 'Трудная история',
    places: 'Куда сходить',
    fromRoute: '{d} от сегодняшнего маршрута',
    askDriver: 'Спросите водителя, возможна ли остановка сегодня; если нет — оставьте на свободный день.',
    openMap: 'Карта',
    sources: 'Источники',
  },
  it: {
    sectionTitle: 'Conoscere Jeju',
    sectionHint: 'Brevi letture per il viaggio',
    readMore: 'Leggi',
    close: 'Chiudi',
    sensitive: 'Storia difficile',
    places: 'Dove andare',
    fromRoute: 'A {d} dall’itinerario di oggi',
    askDriver: 'Chieda al suo autista se oggi è possibile una sosta; altrimenti la tenga per un giorno libero.',
    openMap: 'Mappa',
    sources: 'Fonti',
  },
};

/** 장소 태그 라벨. 상호는 번역하지 않고 분류만 번역한다. */
export const PLACE_TAG_LABEL: Record<string, Record<RoomLocale, string>> = {
  pick: {
    en: 'Tangerine picking', ko: '감귤 따기', ja: 'みかん狩り', es: 'Recogida de mandarinas',
    zh: '摘橘子', 'zh-TW': '採橘子', fr: 'Cueillette de mandarines', de: 'Mandarinen pflücken',
    ru: 'Сбор мандаринов', it: 'Raccolta mandarini',
  },
  cafe: {
    en: 'Orchard café', ko: '감귤 카페', ja: 'みかん畑カフェ', es: 'Café en el huerto',
    zh: '橘园咖啡', 'zh-TW': '橘園咖啡', fr: 'Café du verger', de: 'Plantagen-Café',
    ru: 'Кафе в саду', it: 'Caffè nel frutteto',
  },
  black_pork: {
    en: 'Black pork', ko: '흑돼지', ja: '黒豚', es: 'Cerdo negro',
    zh: '黑猪肉', 'zh-TW': '黑豬肉', fr: 'Porc noir', de: 'Schwarzes Schwein',
    ru: 'Чёрная свинина', it: 'Maiale nero',
  },
  pork_noodles: {
    en: 'Pork noodle soup', ko: '고기국수', ja: 'コギグクス', es: 'Sopa de fideos con cerdo',
    zh: '猪肉面', 'zh-TW': '豬肉麵', fr: 'Nouilles au porc', de: 'Schweinefleisch-Nudelsuppe',
    ru: 'Лапша со свининой', it: 'Zuppa di noodle al maiale',
  },
  horse: {
    en: 'Horse meat', ko: '말고기', ja: '馬肉', es: 'Carne de caballo',
    zh: '马肉', 'zh-TW': '馬肉', fr: 'Viande de cheval', de: 'Pferdefleisch',
    ru: 'Конина', it: 'Carne di cavallo',
  },
  hairtail: {
    en: 'Hairtail', ko: '갈치', ja: 'タチウオ', es: 'Pez cinto',
    zh: '带鱼', 'zh-TW': '白帶魚', fr: 'Poisson-sabre', de: 'Degenfisch',
    ru: 'Рыба-сабля', it: 'Pesce sciabola',
  },
  haejangguk: {
    en: 'Hangover soup', ko: '해장국', ja: 'ヘジャンクク', es: 'Sopa reconfortante',
    zh: '解酒汤', 'zh-TW': '解酒湯', fr: 'Soupe réconfortante', de: 'Katersuppe',
    ru: 'Суп хэджангук', it: 'Zuppa haejangguk',
  },
  bomal: {
    en: 'Sea snail noodles', ko: '보말칼국수', ja: 'ボマルカルグクス', es: 'Fideos con caracol de mar',
    zh: '海螺刀削面', 'zh-TW': '海螺刀削麵', fr: 'Nouilles aux bigorneaux', de: 'Meeresschnecken-Nudeln',
    ru: 'Лапша с морскими улитками', it: 'Noodle con lumache di mare',
  },
  seongge: {
    en: 'Sea urchin soup', ko: '성게국', ja: 'ウニのスープ', es: 'Sopa de erizo de mar',
    zh: '海胆汤', 'zh-TW': '海膽湯', fr: 'Soupe d’oursin', de: 'Seeigelsuppe',
    ru: 'Суп с морским ежом', it: 'Zuppa di ricci di mare',
  },
  momguk: {
    en: 'Seaweed & pork soup', ko: '몸국', ja: 'モムグク', es: 'Sopa de alga y cerdo',
    zh: '马尾藻猪肉汤', 'zh-TW': '馬尾藻豬肉湯', fr: 'Soupe algue-porc', de: 'Algen-Schweine-Suppe',
    ru: 'Суп момгук', it: 'Zuppa momguk',
  },
};

export function placeTagLabel(tag: string, locale: RoomLocale): string {
  return PLACE_TAG_LABEL[tag]?.[locale] ?? tag;
}
