/**
 * Derive overlay text for tour-detail photos from their `src` URL alone.
 *
 *   /images/tours/<folder>/<file>.webp
 *
 * `<folder>` is a stable, English-ish POI/region identifier we already use
 * across the JSON bundles. We map it to:
 *   - A region label  (top-left, "Jeju" / "Busan" / "Seoul" / …)
 *   - An English stop name  (bottom-right, magazine style)
 *
 * Returning `null` is OK — the consumer hides the overlay when label is empty.
 */

const SLUG_TO_REGION: Record<string, string> = {
  // Jeju
  'aewol-cafe-street': 'Jeju',
  'camellia-hill': 'Jeju',
  'cheonjeyeon-falls': 'Jeju',
  'hallasan-1100': 'Jeju',
  'hallasan-eoseungsaengak': 'Jeju',
  'hamdeok-beach': 'Jeju',
  'hueree': 'Jeju',
  'hyeopjae-beach': 'Jeju',
  'iho-teu': 'Jeju',
  'ilchulland': 'Jeju',
  'jeju-cruise-terminal': 'Jeju',
  'jeju-ecoland': 'Jeju',
  'jeju-fantasy-forest': 'Jeju',
  'jeju-haenyeo-museum': 'Jeju',
  'jeju-stone-park': 'Jeju',
  'jeongbang-falls': 'Jeju',
  'jusangjeolli': 'Jeju',
  'osulloc-tea': 'Jeju',
  'seongeup-folk-village': 'Jeju',
  'seongsan-ilchulbong': 'Jeju',
  'seopjikoji': 'Jeju',

  // Busan
  'busan-private': 'Busan',
  'busan-tower': 'Busan',
  'cheongsapo-blue-line': 'Busan',
  'gamcheon-culture-village': 'Busan',
  'haedong-yonggungsa': 'Busan',
  'songdo-beach': 'Busan',
  'taejongdae': 'Busan',
  'un-memorial-cemetery': 'Busan',

  // Gyeongju (Gyeongbuk)
  'ahopsan-bamboo': 'Gyeongju',
  'bulguksa-temple': 'Gyeongju',
  'cheomseongdae': 'Gyeongju',
  'daereungwon': 'Gyeongju',
  'gyeongju-national-museum': 'Gyeongju',
  'gyochon-hanok-village': 'Gyeongju',

  // Ulsan
  'amethyst-cave': 'Ulsan',
  'yeongnam-alps': 'Ulsan',

  // Seoul
  'bukchon-hanok': 'Seoul',
  'gwangjang-market': 'Seoul',
  'gyeongbokgung': 'Seoul',
  'myeongdong': 'Seoul',
  'n-seoul-tower': 'Seoul',
  'seoul-private-charter': 'Seoul',

  // Gyeonggi
  'everland': 'Gyeonggi',
  'gamaksan-suspension-bridge': 'Gyeonggi',
  'garden-of-morning-calm': 'Gyeonggi',
  'gwangmyeong-cave': 'Gyeonggi',
  'herb-island': 'Gyeonggi',
  'imjingak': 'Gyeonggi',
  'korean-folk-village': 'Gyeonggi',
  'petite-france': 'Gyeonggi',
  'pocheon-art-valley': 'Gyeonggi',
  'sanjeong-lake': 'Gyeonggi',
  'starfield-library-suwon': 'Gyeonggi',
  'suwon-hwaseong': 'Gyeonggi',
  'waujeongsa': 'Gyeonggi',

  // Gangwon-do
  'dmz': 'Gangwon-do',
  'naksan-beach': 'Gangwon-do',
  'naksansa-temple': 'Gangwon-do',
  'nami-island': 'Gangwon-do',
  'seoraksan-national-park': 'Gangwon-do',

  // Incheon
  'incheon-cruise': 'Incheon',
};

// Hand-tuned English stop names for folders where kebab→TitleCase isn't clean.
const STOP_NAME_OVERRIDES: Record<string, string> = {
  'aewol-cafe-street': 'Aewol Cafe Street',
  'ahopsan-bamboo': 'Ahopsan Bamboo Forest',
  'amethyst-cave': 'Amethyst Cave',
  'bukchon-hanok': 'Bukchon Hanok Village',
  'bulguksa-temple': 'Bulguksa Temple',
  'busan-private': 'Busan',
  'busan-tower': 'Busan Tower',
  'camellia-hill': 'Camellia Hill',
  'cheomseongdae': 'Cheomseongdae',
  'cheonjeyeon-falls': 'Cheonjeyeon Falls',
  'cheongsapo-blue-line': 'Cheongsapo & Blue Line',
  'daereungwon': 'Daereungwon Royal Tombs',
  'dmz': 'DMZ',
  'gamaksan-suspension-bridge': 'Gamaksan Suspension Bridge',
  'gamcheon-culture-village': 'Gamcheon Culture Village',
  'garden-of-morning-calm': 'Garden of Morning Calm',
  'gwangjang-market': 'Gwangjang Market',
  'gwangmyeong-cave': 'Gwangmyeong Cave',
  'gyeongbokgung': 'Gyeongbokgung Palace',
  'gyeongju-national-museum': 'Gyeongju National Museum',
  'gyochon-hanok-village': 'Gyochon Hanok Village',
  'haedong-yonggungsa': 'Haedong Yonggungsa Temple',
  'hallasan-1100': 'Hallasan 1100',
  'hallasan-eoseungsaengak': 'Hallasan Eoseungsaengak',
  'hamdeok-beach': 'Hamdeok Beach',
  'herb-island': 'Herb Island',
  'hueree': 'Hueree Natural Park',
  'hyeopjae-beach': 'Hyeopjae Beach',
  'iho-teu': 'Iho Tewoo Beach',
  'ilchulland': 'Ilchulland',
  'imjingak': 'Imjingak',
  'incheon-cruise': 'Incheon Cruise Terminal',
  'jeju-cruise-terminal': 'Jeju Cruise Terminal',
  'jeju-ecoland': 'Jeju Ecoland',
  'jeju-fantasy-forest': 'Jeju Fantasy Forest',
  'jeju-haenyeo-museum': 'Haenyeo Museum',
  'jeju-stone-park': 'Jeju Stone Park',
  'jeongbang-falls': 'Jeongbang Falls',
  'jusangjeolli': 'Jusangjeolli Cliff',
  'korean-folk-village': 'Korean Folk Village',
  'myeongdong': 'Myeongdong',
  'n-seoul-tower': 'N Seoul Tower',
  'naksan-beach': 'Naksan Beach',
  'naksansa-temple': 'Naksansa Temple',
  'nami-island': 'Nami Island',
  'osulloc-tea': 'Osulloc Tea Museum',
  'petite-france': 'Petite France',
  'pocheon-art-valley': 'Pocheon Art Valley',
  'sanjeong-lake': 'Sanjeong Lake',
  'seongeup-folk-village': 'Seongeup Folk Village',
  'seongsan-ilchulbong': 'Seongsan Ilchulbong',
  'seopjikoji': 'Seopjikoji',
  'seoraksan-national-park': 'Seoraksan National Park',
  'seoul-private-charter': 'Seoul',
  'songdo-beach': 'Songdo Beach',
  'starfield-library-suwon': 'Starfield Library Suwon',
  'suwon-hwaseong': 'Suwon Hwaseong Fortress',
  'taejongdae': 'Taejongdae',
  'un-memorial-cemetery': 'UN Memorial Cemetery',
  'waujeongsa': 'Waujeongsa Temple',
  'yeongnam-alps': 'Yeongnam Alps Cable Car',
  'everland': 'Everland',
};

function extractFolder(src: string | undefined | null): string | null {
  if (!src) return null;
  // Accept full URL or path; match `tours/<folder>/`
  const m = src.match(/\/images\/tours\/([^/]+)\//);
  return m ? m[1] : null;
}

export function deriveRegion(src: string | undefined | null): string | null {
  const folder = extractFolder(src);
  return folder ? SLUG_TO_REGION[folder] ?? null : null;
}

export function deriveEnStopName(src: string | undefined | null): string | null {
  const folder = extractFolder(src);
  if (!folder) return null;
  if (STOP_NAME_OVERRIDES[folder]) return STOP_NAME_OVERRIDES[folder];
  // kebab-case → Title Case (best-effort fallback)
  return folder
    .split('-')
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}
