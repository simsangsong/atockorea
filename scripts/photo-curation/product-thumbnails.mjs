/**
 * Per-product catalogue thumbnail, chosen deliberately instead of derived.
 *
 * 🔴 WHY THIS FILE EXISTS: `tour-payload-thumb-sync.mjs` derives the card image from the
 * FIRST non-OPS itinerary stop. Sibling products start at the same stop, so the catalogue
 * ended up with four Busan cards on one Haedong Yonggungsa frame, three Suwon cards on one
 * Janganmun frame, and three Seoraksan cards on one ridge frame. On an OTA grid that reads
 * as the same product listed four times.
 *
 * Selection follows what an OTA listing image has to do:
 *   서사   the shot carries THIS product's story, not the family's shared opener
 *   관련성 it is a stop that is actually on this itinerary (see the relevance gate in
 *          `__tests__/audit/catalogThumbnailUniqueness.test.ts`)
 *   시각효과 bright, one clear subject, reads at card size
 *   시각어필 the frame a traveller would stop scrolling for
 *   중복금지 no two sellable products may share a frame
 *
 * ⚠ Klook's own image spec is not recorded anywhere in this repo — these criteria are the
 * general OTA listing standard, not a quoted requirement. If the real spec turns up
 * (text/border/logo bans, aspect minimums), re-check the picks against it.
 *
 * 🔴 AI 프레임에 대한 사장님 방침 (2026-08-07, 두 번에 걸쳐 확정):
 *   "ai 생성이나 보정 거친 사진들도 적극 활용하도록" → 이후 →
 *   "AI 사진도 적절히 섞는게 좋아, 다만 실 사진 넣는것도 좋지만
 *    그렇다고 AI사진을 다 짤라버리는건 원하지 않아"
 *
 * 즉 **섞는 게 목표지 실사진 비율이 목표가 아니다.** 한 번 과교정해서 AI 9→3 까지
 * 밀었다가 두 장을 되돌렸다. 다음 세션이 또 흔들지 않도록 판단 규칙을 박아 둔다:
 *
 *   실사진으로 바꾼다 — 실사진이 카드 크기에서 **동급 이상**일 때, 또는
 *                      AI 를 쓰면 **다른 카드와 피사체가 겹칠** 때
 *   AI 를 남긴다   — AI 가 카드에서 **확실히 더 강하고**, 그 일정에 **실제로 있는
 *                    것**을 담고 있을 때 (스카이캡슐처럼 실촬본 자체가 없을 때 포함)
 *
 * ⚠ 실사진이라는 이유만으로 바꾸지 마라. 부산 기항지 버스를 용궁사 실사진으로 바꿨더니
 * 대표 상품과 **같은 절**이 두 카드에 걸려, 처음에 지적받은 중복이 되살아났다.
 *
 * `offItinerary` marks the charter products, whose cards deliberately sell the vehicle or
 * the city rather than a stop — their route variants carry no stop photography at all.
 */

/** @type {Record<string, { image: string, why: string, offItinerary?: boolean }>} */
export const PRODUCT_THUMBNAILS = {
  /* ── 부산: 넷이 해동용궁사 일몰 한 장을 공유하고 있었다 ───────────────── */
  "busan-top-attractions-day-tour": {
    image: "/images/tours/haedong-yonggungsa/haedong-yonggungsa-sunset-cliff.webp",
    why: "대표·최저가 상품이 가장 아이코닉한 프레임을 가져간다 — 나머지 셋을 옮겼다",
  },
  "busan-small-group-yonggungsa-skycapsule-gamcheon-tour": {
    image: "/images/tours/cheongsapo-blue-line/01-chatgpt-image-2026-5-10-12-53-23.webp",
    why: "스카이캡슐이 제목이자 차별점 — 황금빛 해안 캡슐",
  },
  "busan-cruise-shore-excursion-bus-tour": {
    image: "/images/tours/songdo-beach/01-chatgpt-image-2026-5-10-12-32-12.webp",
    why: "기항지 서사는 바다 — 송도 해안 항공샷(AI). 용궁사 실사진으로 바꿔봤지만 대표 상품과 **같은 절**이 두 카드에 걸려 되돌렸다",
  },
  "busan-small-group-sightseeing-tour-cruise-passengers": {
    image: "/images/tours/busan-tower/01-kakaotalk-20260510-230009595.webp",
    why: "같은 코스의 소그룹판 — 용두산 블루아워로 도심 야경을 앞세운다",
  },

  /* ── 수원: 셋이 장안문 야경 한 장을 공유하고 있었다 ────────────────── */
  "seoul-suwon-hwaseong-waujeongsa-starfield": {
    image: "/images/tours/suwon-hwaseong/02-kakaotalk-20260510-222949305.webp",
    why: "셋의 공통 앵커인 화성은 한 상품에만 남긴다 — **실사진** 성벽 일몰(AI 장안문 야경에서 교체)",
  },
  "seoul-suwon-hwaseong-folk-village-starfield-library": {
    image: "/images/tours/korean-folk-village/02-kakaotalk-20260509-223603273-13.webp",
    why: "민속촌이 이 상품만의 스톱 — 정문보다 한복 공연이 「무엇을 하는 투어인지」를 카드에서 바로 보여준다",
  },
  "seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library": {
    image: "/images/tours/gwangmyeong-cave/05-kakaotalk-20260509-231601211-04.webp",
    why: "광명동굴이 이 상품만의 스톱 — **실제 광산 레일 터널**. AI 보라빛 터널이 더 화려하지만 진짜가 아니다",
  },

  /* ── 설악: 셋이 능선 한 장을 공유하고 있었다 ──────────────────────── */
  "seoul-winter-seoraksan-nami-eobi-ice-valley-day-tour": {
    image: "/images/tours/seoraksan-national-park/seoraksan-ridge-view.webp",
    why: "겨울 상품이 설악 능선을 가져간다 (어비계곡은 보유 사진 0)",
  },
  "seoul-seoraksan-naksansa-temple-naksan-beach-day-trip": {
    image: "/images/tours/naksansa-temple/naksansa-uisangdae-pavilion.webp",
    why: "낙산사 의상대 — 바다 절벽 위 정자, 이 상품만의 것",
  },
  "seoul-seoraksan-nami-island-morning-calm-day-tour": {
    image: "/images/tours/nami-island/01-kakaotalk-20260510-222949305-05.webp",
    why: "겨울 상품과의 차별점은 남이섬·아침고요 — **실사진** 메타세쿼이아길(AI 아침고요 정원에서 교체)",
  },

  /* ── 제주 ────────────────────────────────────────────────────── */
  "jeju-grand-highlights-loop": {
    image: "/images/tours/jusangjeolli/01-kakaotalk-20260510-230028438-13.webp",
    why: "최고가 대표 상품 — 주상절리 육각기둥과 짙은 바다가 가장 강하다",
  },
  "southwest-hallasan-osulloc-aewol": {
    image: "/images/tours/aewol-cafe-street/01-chatgpt-image-2026-5-11-01-14-08.webp",
    why: "애월 카페 데크 + 터콰이즈 — 이 코스의 감성이 곧 서사",
  },
  "jeju-eastern-unesco-spots-day-tour": {
    image: "/images/tours/hamdeok-beach/05-kakaotalk-20260510-230028438-04.webp",
    why: "만장굴 동굴 내부는 카드 크기에서 어둡기만 하다 — 함덕 터콰이즈로 교체. 스톱 히어로(01)는 삼각대·스피커가 걸려 카드로는 지저분해서 물놀이 프레임을 쓴다",
  },
  "jeju-cruise-shore-excursion-small-group-tour": {
    image: "/images/tours/seongsan-ilchulbong/01-kakaotalk-20260510-230028438-06.webp",
    why: "짧은 기항지 코스의 핵심이 성산일출봉",
  },
  "jeju-southern-top-unesco-spots-tour": {
    image: "/images/tours/jeongbang-falls/01-kakaotalk-20260510-230028438-17.webp",
    why: "바다로 떨어지는 유일한 폭포 — 상품 서사 그 자체",
  },

  /* ── 경주 ────────────────────────────────────────────────────── */
  "from-busan-gyeongju-ancient-capital-day-tour": {
    image: "/images/tours/woljeonggyo/02-kakaotalk-20260509-231543723-07.webp",
    why: "🔴 기존 썸네일이 아홉산 대나무숲 — 부산 기장이라 「경주 고도」 서사와 어긋났다. **실사진** 월정교 야경으로 교체",
  },

  /* ── 서울 ────────────────────────────────────────────────────── */
  "incheon-seoul-private-car-shore-excursion-cruise": {
    image: "/images/tours/gyeongbokgung/01-chatgpt-image-2026-5-11-12-21-39.webp",
    why: "경회루 연못 반영(AI) — $424 프리미엄 전세라 카드가 고급스러워야 한다. 흥례문 실사진으로 바꿔봤지만 스냅샷에 가까워 되돌렸다",
  },

  /* ── 전세: 카드가 스톱이 아니라 차량·도시를 판다 (의도) ─────────────── */
  "busan-private-car-charter-city-tour": {
    image: "/images/tours/gamcheon-culture-village/01-kakaotalk-20260510-222952680-01.webp",
    why: "감천 어린왕자 — 부산 시내 전세의 대표 장면",
  },
  "busan-private-car-charter-cruise-shore": {
    image: "/images/tours/taejongdae/01-chatgpt-image-2026-5-10-12-27-04.webp",
    why: "태종대 등대와 해안 — 기항지 전세",
  },
  "jeju-island-private-car-charter-tour": {
    image: "/images/tours/jeju-private/jeju-private-thumbnail-carnival-coast.webp",
    why: "전세 상품은 차량이 상품이다",
    offItinerary: true,
  },
  "seoul-suburbs-private-chartered-car-10hr": {
    image: "/images/tours/seoul-private-charter/seoul-private-carnival-han-river-night.webp",
    why: "전세 상품은 차량이 상품이다",
    offItinerary: true,
  },
};
