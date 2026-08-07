/**
 * Maps the consolidated photo library on `D:/한국여행사진_통합` (region → POI → season,
 * plus a `_보정본` bucket holding retouched / AI-generated frames) onto the POI keys the
 * site actually renders.
 *
 * The older `scripts/import-atoc-modified-photos.mjs` FOLDER_MAP reads a *flat* drop
 * folder (`D:/Atoc Photos/modified/<POI>`); this one reads the consolidated tree, which
 * is a superset (it absorbed both `D:/Atoc Photos` and `D:/jeju photos`). Keys here are
 * the leaf POI folder name — unique across the tree, so the region prefix is not needed.
 *
 * `poiKeys` are matched against `itineraryStops[]._poi_meta.poi_key` /
 * `_poi_metas[].poi_key` and against `match_pois.poi_key`.
 */

export const LIBRARY_ROOT = "D:/한국여행사진_통합";

/** Extra source trees that never made it into the consolidated library. */
export const EXTRA_SOURCES = [
  { dir: "D:/해녀쇼", poi: "해녀 물질쇼(성산)", region: "제주/05_성산·표선" },
];

/** @typedef {{ poiKeys: string[], assetSlug: string, nameGuard?: RegExp }} PoiSpec */

/** @type {Record<string, PoiSpec>} */
export const POI_FOLDER_MAP = {
  /* ── 강원 ─────────────────────────────────────────────── */
  남이섬: { poiKeys: ["nami_island"], assetSlug: "nami-island" },

  /* ── 경기 ─────────────────────────────────────────────── */
  DMZ: {
    poiKeys: ["third_infiltration_tunnel", "dora_observatory"],
    assetSlug: "dmz",
  },
  "감악산 출렁다리": { poiKeys: ["gamaksan_red_bridge"], assetSlug: "gamaksan-suspension-bridge" },
  광명동굴: { poiKeys: ["gwangmyeong_cave"], assetSlug: "gwangmyeong-cave" },
  쁘디프랑스: { poiKeys: ["petite_france"], assetSlug: "petite-france" },
  산정호수: { poiKeys: ["sanjeong_lake"], assetSlug: "sanjeong-lake" },
  수원화성: {
    poiKeys: ["hwaseong_fortress", "hwaseong_haenggung"],
    assetSlug: "suwon-hwaseong",
    nameGuard: /hwaseong|suwon|수원|화성|행궁/i,
  },
  아침고요수목원: { poiKeys: ["garden_of_morning_calm"], assetSlug: "garden-of-morning-calm" },
  아트밸리: { poiKeys: ["pocheon_art_valley"], assetSlug: "pocheon-art-valley" },
  에버랜드: { poiKeys: [], assetSlug: "everland" },
  와우정사: { poiKeys: ["waujeongsa_temple"], assetSlug: "waujeongsa" },
  임진각: {
    poiKeys: ["imjingak_peace_park"],
    assetSlug: "imjingak",
    nameGuard: /imjingak|임진각|peace park|평화/i,
  },
  한국민속촌: {
    poiKeys: ["korean_folk_village", "korean_folk_village_yongin"],
    assetSlug: "korean-folk-village",
  },
  허브아일랜드: { poiKeys: ["herb_island"], assetSlug: "herb-island" },
  "수원 남문시장": { poiKeys: [], assetSlug: "suwon-namun-market" },

  /* ── 경상 ─────────────────────────────────────────────── */
  감천문화마을: {
    poiKeys: ["gamcheon_culture_village"],
    assetSlug: "gamcheon-culture-village",
    nameGuard: /gamcheon|감천|culture village|마추픽추|산토리니/i,
  },
  "경주 동궁과 월지": { poiKeys: ["donggung_wolji"], assetSlug: "donggung-wolji" },
  "경주 보문호": {
    poiKeys: ["bomun_lake"],
    assetSlug: "bomun-lake",
    nameGuard: /bomun|보문|경주월드|gyeongju world/i,
  },
  "경주 월정교": { poiKeys: ["woljeonggyo_bridge"], assetSlug: "woljeonggyo" },
  "경주 한옥마을": { poiKeys: ["gyochon_hanok_village"], assetSlug: "gyochon-hanok-village" },
  경주교촌마을: { poiKeys: ["gyochon_hanok_village"], assetSlug: "gyochon-hanok-village" },
  경주국립박물관: { poiKeys: ["gyeongju_national_museum"], assetSlug: "gyeongju-national-museum" },
  대릉원: { poiKeys: ["daereungwon_tomb_complex"], assetSlug: "daereungwon" },
  부산타워: {
    poiKeys: ["yongdusan_park"],
    assetSlug: "busan-tower",
    nameGuard: /yongdusan|busan tower|용두산|diamond tower|부산타워/i,
  },
  불국사: { poiKeys: ["bulguksa_temple"], assetSlug: "bulguksa-temple" },
  송도해수욕장: { poiKeys: ["songdo_beach"], assetSlug: "songdo-beach" },
  아홉산숲: { poiKeys: ["ahopsan_bamboo_forest"], assetSlug: "ahopsan-bamboo" },
  유엔기념공원: { poiKeys: ["un_memorial_cemetery"], assetSlug: "un-memorial-cemetery" },
  첨성대: { poiKeys: ["cheomseongdae"], assetSlug: "cheomseongdae" },
  "청사포 다릿돌 전망대": {
    poiKeys: ["cheongsapo_daritdol_observatory"],
    assetSlug: "cheongsapo-daritdol",
  },
  태종대: { poiKeys: ["taejongdae"], assetSlug: "taejongdae" },
  "해운대 블루라인파크": {
    poiKeys: ["cheongsapo_blue_line_park"],
    assetSlug: "cheongsapo-blue-line",
  },
  해운대해수욕장: { poiKeys: ["haeundae_beach"], assetSlug: "haeundae-beach" },

  /* ── 서울 ─────────────────────────────────────────────── */
  경복궁: { poiKeys: ["gyeongbokgung_palace"], assetSlug: "gyeongbokgung" },
  광장시장: { poiKeys: ["gwangjang_market"], assetSlug: "gwangjang-market" },
  남산타워: {
    poiKeys: ["n_seoul_tower"],
    assetSlug: "n-seoul-tower",
    nameGuard: /namsan|n seoul|남산타워|서울타워|타워/i,
  },
  명동: { poiKeys: ["myeongdong"], assetSlug: "myeongdong", nameGuard: /myeongdong|명동/i },
  북촌한옥마을: { poiKeys: ["bukchon_hanok_village"], assetSlug: "bukchon-hanok" },
  "스타필드 도서관": {
    poiKeys: ["starfield_library_suwon"],
    assetSlug: "starfield-library-suwon",
  },

  /* ── 제주 ─────────────────────────────────────────────── */
  "도두 무지개해안도로": { poiKeys: ["dodu_rainbow_road"], assetSlug: "dodu-rainbow-road" },
  이호테우: { poiKeys: ["iho_tewoo_beach"], assetSlug: "iho-teu" },
  애월카페거리: { poiKeys: ["aewol_cafe_street"], assetSlug: "aewol-cafe-street" },
  신창풍차해안도로: { poiKeys: ["sinchang_windmill_road"], assetSlug: "sinchang-windmill-road" },
  한림공원: { poiKeys: ["hallim_park"], assetSlug: "hallim-park" },
  협재해수욕장: { poiKeys: ["hyeopjae_beach"], assetSlug: "hyeopjae-beach" },
  돌문화공원: { poiKeys: ["jeju_stone_park"], assetSlug: "jeju-stone-park" },
  만장굴: { poiKeys: ["manjanggul_lava_tube"], assetSlug: "manjanggul" },
  보롬왓: { poiKeys: ["boromwat"], assetSlug: "boromwat" },
  스누피가든: { poiKeys: ["snoopy_garden"], assetSlug: "snoopy-garden" },
  함덕해수욕장: {
    poiKeys: ["hamdeok_seoubong_beach", "hamdeok_beach"],
    assetSlug: "hamdeok-beach",
  },
  해녀박물관: { poiKeys: ["jeju_haenyeo_museum"], assetSlug: "jeju-haenyeo-museum" },
  "해녀 물질쇼(성산)": { poiKeys: ["jeju_haenyeo_museum"], assetSlug: "jeju-haenyeo-museum" },
  "성산 해녀 물질시연": { poiKeys: ["jeju_haenyeo_museum"], assetSlug: "jeju-haenyeo-museum" },
  광치기해변: { poiKeys: ["gwangchigi_beach"], assetSlug: "gwangchigi-beach" },
  섭지코지: { poiKeys: ["seopjikoji"], assetSlug: "seopjikoji" },
  성산일출봉: { poiKeys: ["seongsan_ilchulbong"], assetSlug: "seongsan-ilchulbong" },
  성읍민속마을: { poiKeys: ["seongeup_folk_village"], assetSlug: "seongeup-folk-village" },
  일출랜드: {
    poiKeys: ["ilchulland_micheon_cave", "ilchulland_themed_gardens"],
    assetSlug: "ilchulland",
  },
  외돌개: { poiKeys: ["oedolgae_olle7"], assetSlug: "oedolgae" },
  정방폭포: { poiKeys: ["jeongbang_falls"], assetSlug: "jeongbang-falls" },
  천지연폭포: { poiKeys: ["cheonjiyeon_waterfall"], assetSlug: "cheonjiyeon-falls" },
  휴애리: { poiKeys: ["hueree_natural_park"], assetSlug: "hueree" },
  본태박물관: { poiKeys: ["bonte_museum"], assetSlug: "bonte-museum" },
  산방산: { poiKeys: ["sanbangsan_mountain"], assetSlug: "sanbangsan" },
  송악산: { poiKeys: ["songaksan"], assetSlug: "songaksan" },
  약천사: { poiKeys: ["yakcheonsa_temple"], assetSlug: "yakcheonsa" },
  오설록티뮤지엄: { poiKeys: ["osulloc_tea_museum"], assetSlug: "osulloc-tea" },
  용머리해안: { poiKeys: ["yongmeori_coast"], assetSlug: "yongmeori-coast" },
  주상절리: {
    poiKeys: ["daepo_jusangjeolli_cliff", "jusangjeolli_cliff"],
    assetSlug: "jusangjeolli",
  },
  천제연폭포: { poiKeys: ["cheonjeyeon_falls"], assetSlug: "cheonjeyeon-falls" },
  카멜리아힐: { poiKeys: ["camellia_hill"], assetSlug: "camellia-hill" },
  "감귤 따기 체험": {
    poiKeys: ["jeju_tangerine_picking_experience"],
    assetSlug: "jeju-tangerine-farm",
  },
  "1100고지": { poiKeys: ["hallasan_1100_wetland"], assetSlug: "hallasan-1100" },
  어승생악: { poiKeys: ["hallasan_eoseungsaengak"], assetSlug: "hallasan-eoseungsaengak" },
  새별오름: { poiKeys: ["saebyeol_oreum"], assetSlug: "saebyeol-oreum" },
  산굼부리: { poiKeys: ["sangumburi"], assetSlug: "sangumburi" },
  에코랜드: { poiKeys: [], assetSlug: "jeju-ecoland" },
  "녹산로 유채꽃길": {
    poiKeys: ["noksan_ro_gasiri_blossom_road"],
    assetSlug: "noksan-ro",
  },
  "우도 서빈백사": { poiKeys: ["udo_seobin_baeksa"], assetSlug: "udo-seobinbaeksa" },
  "우도 하고수동해변": { poiKeys: ["udo_hagosudong_beach"], assetSlug: "udo-hagosudong" },
  "아쿠아플라넷 제주": { poiKeys: ["aquaplanet_jeju"], assetSlug: "aquaplanet-jeju" },
  여미지식물원: { poiKeys: ["yeomiji_botanical_garden"], assetSlug: "yeomiji-garden" },
  "세계자동차&피아노박물관": {
    poiKeys: ["world_automobile_piano_museum"],
    assetSlug: "world-automobile-museum",
  },
  중문관광단지: { poiKeys: ["jungmun_resort"], assetSlug: "jungmun-resort" },
  "애월 한담해안산책로": { poiKeys: ["aewol_handam_trail"], assetSlug: "aewol-handam" },
  "한라산 백록담": { poiKeys: ["hallasan_baengnokdam"], assetSlug: "hallasan-baengnokdam" },
};

/** Folders deliberately left out of curation (not a place, or dropped from the site). */
export const SKIP_FOLDERS = new Set([
  "_미분류",
  "_자료(광고)",
  "_자료(문서)",
  "_자료(스크린샷)",
  "오늘은 녹차한잔",
  "사려니숲길",
  "환상숲",
]);
