/**
 * The `dining_card` message contract + its 5-locale chrome (§5.7 R-5).
 *
 * 🔴 CLIENT-SAFE. A React client component (`DiningCard.tsx`, slice B) imports
 * this file directly, so it must never reach for `node:*`, supabase, or fetch.
 * (Precedent: facilityPins vs facilityPins.server, eta vs eta.server — breaking
 * the split only shows up as a `next build --webpack` failure.)
 *
 * 🔴 NO MAP TILE (spec K7). Kakao's terms make it questionable to plot Kakao
 * POI data on a non-Kakao map, so the card is a LIST with a per-item Kakao Map
 * deep link. `kakaoPlaceUrl`/`kakaoDirectionsUrl` are the only navigation
 * surface here on purpose.
 *
 * All copy is a fixed constant — zero LLM at render time. The LLM only ever
 * touched the place *names* (once, at collection) and the verbatim menu names.
 */

import { DIETARY_CAUTION, dietaryLabel } from '@/lib/ops/dining/dietary';
import { ROOM_LOCALES, type RoomLocale } from '@/lib/tour-room/snapshot';

export type MealKind = 'lunch' | 'dinner' | 'snack';

export interface DiningPlace {
  place_key: string;
  name: string;
  name_i18n?: Record<string, string> | null;
  cuisine: string | null;
  category_name: string | null;
  lat: number;
  lng: number;
  distance_m: number | null;
  walk_min: number | null;
  price_band: number | null;
  rating: number | null;
  review_count: number | null;
  tags: string[];
  signature_menus: Array<{ name: string; name_i18n?: Record<string, string> | null }>;
  /** Kakao Map deep link (the only map surface — K7). */
  place_url: string;
  open_today: boolean | null;
  closes_at: string | null;
  /** Set when the whole cell was unrated and we fell back to distance order. */
  unrated?: boolean;
}

export interface DiningCardMeta {
  kind: 'dining_card';
  poi_key: string | null;
  spot_title: string;
  cell: string;
  meal: MealKind;
  /** The dietary filters that were applied when this card was built. */
  dietary: string[];
  /** At most 5 (places.MAX_RESULTS). */
  places: DiningPlace[];
  source: 'cache' | 'fresh';
  triggered_by_role?: string;
  [key: string]: unknown;
}

export interface DiningCopy {
  /** Card title per meal. */
  title: Record<MealKind, string>;
  /** "5 min walk" unit — {min} interpolates. */
  walk: string;
  /** "Open until 21:00" — {time} interpolates. */
  openUntil: string;
  openNow: string;
  closedToday: string;
  hoursUnknown: string;
  /** Honest badge when the whole cell had no ratings (K1). */
  unrated: string;
  reviews: string;
  /** Chip row prefix, e.g. "Filtered for:" */
  filteredFor: string;
  /** Primary action — logs a `visited` feedback row. */
  goHere: string;
  /** Secondary action — logs `wrong`, 3 reports auto-hide the place (K6). */
  reportWrong: string;
  /** Kakao Map deep link label. */
  mapLink: string;
  directions: string;
  /** The mandatory "confirm ingredients yourself" line (from dietary.ts). */
  caution: string;
  /** Rendered when nothing survived the filters. */
  empty: string;
}

/** Zero-LLM card chrome, all 5 room locales. */
export const DINING_COPY: Record<RoomLocale, DiningCopy> = {
  en: {
    title: {
      lunch: 'Lunch near {spot}',
      dinner: 'Dinner near {spot}',
      snack: 'A bite near {spot}',
    },
    walk: '{min} min walk',
    openUntil: 'Open until {time}',
    openNow: 'Open now',
    closedToday: 'Closed right now',
    hoursUnknown: 'Hours unknown',
    unrated: 'No reviews available — sorted by distance',
    reviews: '{count} reviews',
    filteredFor: 'Filtered for',
    goHere: "We'll go here",
    reportWrong: 'This looks wrong',
    mapLink: 'Kakao Map',
    directions: 'Directions',
    caution: DIETARY_CAUTION.en,
    empty: 'Nothing nearby matched — ask your guide and we will find something.',
  },
  ko: {
    title: {
      lunch: '{spot} 근처 점심',
      dinner: '{spot} 근처 저녁',
      snack: '{spot} 근처 간단히',
    },
    walk: '도보 {min}분',
    openUntil: '{time}까지 영업',
    openNow: '영업 중',
    closedToday: '지금은 영업 안 해요',
    hoursUnknown: '영업시간 정보 없음',
    unrated: '리뷰 정보가 없어 거리순으로 보여드려요',
    reviews: '리뷰 {count}개',
    filteredFor: '적용된 조건',
    goHere: '여기 갈게요',
    reportWrong: '정보가 틀려요',
    mapLink: '카카오맵',
    directions: '길찾기',
    caution: DIETARY_CAUTION.ko,
    empty: '조건에 맞는 곳을 못 찾았어요 — 가이드에게 말씀해 주시면 찾아드릴게요.',
  },
  ja: {
    title: {
      lunch: '{spot}周辺のランチ',
      dinner: '{spot}周辺のディナー',
      snack: '{spot}周辺の軽食',
    },
    walk: '徒歩{min}分',
    openUntil: '{time}まで営業',
    openNow: '営業中',
    closedToday: '現在は営業していません',
    hoursUnknown: '営業時間不明',
    unrated: 'レビュー情報がないため距離順で表示しています',
    reviews: 'レビュー{count}件',
    filteredFor: '適用条件',
    goHere: 'ここにします',
    reportWrong: '情報が違います',
    mapLink: 'カカオマップ',
    directions: 'ルート案内',
    caution: DIETARY_CAUTION.ja,
    empty: '条件に合うお店が見つかりませんでした — ガイドにお声がけください。',
  },
  es: {
    title: {
      lunch: 'Almuerzo cerca de {spot}',
      dinner: 'Cena cerca de {spot}',
      snack: 'Algo rápido cerca de {spot}',
    },
    walk: '{min} min a pie',
    openUntil: 'Abierto hasta las {time}',
    openNow: 'Abierto ahora',
    closedToday: 'Cerrado en este momento',
    hoursUnknown: 'Horario desconocido',
    unrated: 'Sin reseñas disponibles — ordenado por distancia',
    reviews: '{count} reseñas',
    filteredFor: 'Filtrado por',
    goHere: 'Vamos aquí',
    reportWrong: 'La información es incorrecta',
    mapLink: 'Kakao Map',
    directions: 'Cómo llegar',
    caution: DIETARY_CAUTION.es,
    empty: 'No encontramos nada que encaje — dígaselo a su guía y buscaremos otra opción.',
  },
  zh: {
    title: {
      lunch: '{spot}附近的午餐',
      dinner: '{spot}附近的晚餐',
      snack: '{spot}附近的小吃',
    },
    walk: '步行{min}分钟',
    openUntil: '营业至{time}',
    openNow: '营业中',
    closedToday: '目前未营业',
    hoursUnknown: '营业时间不详',
    unrated: '暂无评价信息 — 按距离排序',
    reviews: '{count}条评价',
    filteredFor: '已应用条件',
    goHere: '就去这家',
    reportWrong: '信息有误',
    mapLink: 'Kakao地图',
    directions: '路线',
    caution: DIETARY_CAUTION.zh,
    empty: '没有找到符合条件的餐厅 — 请告诉您的向导，我们会再找。',
  },
};

/** `null`-safe `1..4` → `₩`..`₩₩₩₩`. Anything else renders nothing. */
export function priceBandLabel(band: number | null | undefined): string | null {
  if (typeof band !== 'number' || !Number.isFinite(band)) return null;
  const level = Math.round(band);
  if (level < 1 || level > 4) return null;
  return '₩'.repeat(level);
}

/**
 * Normalize the cached Kakao place URL to https. Kakao historically hands back
 * `http://place.map.kakao.com/...`, and an http link inside an https page is
 * blocked as mixed content on iOS Safari — the deep link would silently do
 * nothing, which is the whole card's only navigation affordance.
 */
export function kakaoPlaceUrl(place: Pick<DiningPlace, 'place_url'>): string {
  const raw = typeof place?.place_url === 'string' ? place.place_url.trim() : '';
  if (!raw) return '';
  if (raw.startsWith('https://')) return raw;
  if (raw.startsWith('http://')) return `https://${raw.slice('http://'.length)}`;
  if (raw.startsWith('//')) return `https:${raw}`;
  return raw;
}

/**
 * Kakao Map "navigate to" deep link. Opens the Kakao Map app when installed and
 * the web map otherwise — the standard `link/to/<name>,<lat>,<lng>` form.
 */
export function kakaoDirectionsUrl(place: Pick<DiningPlace, 'name' | 'lat' | 'lng'>): string {
  const name = encodeURIComponent(String(place?.name ?? '').trim() || 'Restaurant');
  const lat = Number(place?.lat);
  const lng = Number(place?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';
  return `https://map.kakao.com/link/to/${name},${lat},${lng}`;
}

/**
 * Localized name with the Korean original in parentheses when they differ.
 * The original is never dropped: the guest has to say or show it to a taxi
 * driver or a restaurant host, and a romanized-only name is useless there.
 */
export function placeDisplayName(place: Pick<DiningPlace, 'name' | 'name_i18n'>, locale: RoomLocale): string {
  const original = String(place?.name ?? '').trim();
  const localized = place?.name_i18n?.[locale];
  const translated = typeof localized === 'string' ? localized.trim() : '';
  if (!translated || translated === original) return original;
  if (locale === 'ko') return translated;
  return `${translated} (${original})`;
}

function interpolate(template: string, values: Record<string, string | number>): string {
  let out = template;
  for (const [key, value] of Object.entries(values)) {
    out = out.replaceAll(`{${key}}`, String(value));
  }
  return out;
}

/** Card title for one locale. */
export function diningTitle(meta: Pick<DiningCardMeta, 'meal' | 'spot_title'>, locale: RoomLocale): string {
  const copy = DINING_COPY[locale];
  return interpolate(copy.title[meta.meal] ?? copy.title.snack, { spot: meta.spot_title });
}

/** "Open until 21:00" / "Closed right now" / "Hours unknown". */
export function hoursLabel(place: Pick<DiningPlace, 'open_today' | 'closes_at'>, locale: RoomLocale): string {
  const copy = DINING_COPY[locale];
  if (place.open_today === false) return copy.closedToday;
  if (place.open_today === true) {
    return place.closes_at ? interpolate(copy.openUntil, { time: place.closes_at }) : copy.openNow;
  }
  return copy.hoursUnknown;
}

/**
 * The message row's plain-text body for one locale (zero LLM).
 *
 * This is what a guest sees in a notification, in an offline snapshot, or if
 * the rich card fails to render — so it has to stand alone: title, up to five
 * numbered picks with walk time and price, and the caution line whenever a
 * filter was applied.
 */
export function composeDiningText(meta: DiningCardMeta, locale: RoomLocale): string {
  const copy = DINING_COPY[locale];
  const lines: string[] = [diningTitle(meta, locale)];

  const places = Array.isArray(meta.places) ? meta.places : [];
  if (places.length === 0) {
    lines.push(copy.empty);
    return lines.join('\n');
  }

  const dietary = Array.isArray(meta.dietary) ? meta.dietary : [];
  if (dietary.length > 0) {
    lines.push(`${copy.filteredFor}: ${dietary.map((tag) => dietaryLabel(tag, locale)).join(', ')}`);
  }

  if (places.some((place) => place.unrated)) lines.push(copy.unrated);

  places.forEach((place, index) => {
    const parts: string[] = [`${index + 1}. ${placeDisplayName(place, locale)}`];
    if (place.cuisine) parts.push(place.cuisine);
    const walk = typeof place.walk_min === 'number' ? interpolate(copy.walk, { min: place.walk_min }) : null;
    if (walk) parts.push(walk);
    const price = priceBandLabel(place.price_band);
    if (price) parts.push(price);
    if (typeof place.rating === 'number') {
      const rating =
        typeof place.review_count === 'number'
          ? `★${place.rating.toFixed(1)} (${interpolate(copy.reviews, { count: place.review_count })})`
          : `★${place.rating.toFixed(1)}`;
      parts.push(rating);
    }
    if (place.open_today === false) parts.push(copy.closedToday);
    else if (place.closes_at) parts.push(interpolate(copy.openUntil, { time: place.closes_at }));
    lines.push(parts.join(' · '));
  });

  if (dietary.length > 0) lines.push(copy.caution);

  return lines.join('\n');
}

/**
 * All room locales at once — the message row's `translations` column, mirroring
 * `composeApproachTranslations` in lib/tour-room/approach.ts. English is the
 * declared source so the existing translation plumbing treats it as canonical.
 */
export function composeDiningTranslations(meta: DiningCardMeta): {
  source_locale: string;
  source_text: string;
  translations: Record<string, string>;
} {
  const translations: Record<string, string> = {};
  for (const locale of ROOM_LOCALES) translations[locale] = composeDiningText(meta, locale);
  return { source_locale: 'en', source_text: translations.en, translations };
}
