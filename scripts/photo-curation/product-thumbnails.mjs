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
    image: "/images/tours/cheongsapo-blue-line/01-skycapsule-red13-pines-01.webp",
    why: "스카이캡슐이 제목이자 차별점 — 사장님 제공 **실촬본**(2026-08-07). 이 POI 는 쓸 수 있는 실사진이 아예 없어서 AI 를 쓰고 있었다",
  },
  "busan-cruise-shore-excursion-bus-tour": {
    image: "/images/tours/un-memorial-cemetery/01-chatgpt-image-2026-5-10-12-35-47.webp",
    why: "UN기념공원 만국기 — 기존 송도 해변 항공샷은 어느 해변인지도 모르겠고 기항지 버스투어의 특징이 0이었다. 이 코스에서만 가는 곳이고 다른 어떤 카드와도 안 겹친다",
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
    image: "/images/tours/seoraksan-national-park/photo-001.webp",
    why: "설악 단풍 계곡 — 남이섬 메타세쿼이아를 셋이 돌려쓰고 있었다. 제목 첫머리가 설악이고 이 단풍 컷은 이 상품만의 것",
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
    image: "/images/tours/manjanggul/01-manjanggul-stairs-lit-path-01.webp",
    why: "만장굴 조명 통로(사장님 실촬) — 「동부 UNESCO」 상품에 물놀이 인파는 서사가 없다. 용암동굴이 이 상품의 이야기다",
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

  /* ── 🔴 아래 17개는 카탈로그에 있는데 오버라이드에 없어서 중복 검사를 못 받고 있었다.
   *      게이트가 「내가 관리하는 21개」만 재고 실제로 나가는 38개를 안 쟀다. ───────── */
  "seoul-private-nami-morning-calm-petite-france": {
    image: "/images/tours/nami-island/02-kakaotalk-20260510-222949305-04.webp",
    why: "남이섬 은행나무 터널 + 커플 — 프라이빗 상품의 결. 셋이 같은 메타세쿼이아를 쓰고 있었다",
  },
  "seoul-gapyeong-nami-morning-calm-petite-france-day-tour": {
    image: "/images/tours/nami-island/03-chatgpt-image-2026-5-11-01-12-05.webp",
    why: "남이섬 짚와이어 — 조인 데이투어는 액티비티가 팔린다",
  },
  "from-incheon-seoul-day-tour-cruise-guests": {
    image: "/images/tours/gyeongbokgung/03-kakaotalk-20260510-222949305-09.webp",
    why: "수문장 교대식 — 프라이빗판이 경회루를 쓰므로 조인판은 「무엇을 보는지」로 간다",
  },
  "jeju-cruise-shore-excursion-bus-tour": {
    image: "/images/tours/seopjikoji/02-kakaotalk-20260510-230009595-10.webp",
    why: "섭지코지 붉은 링 + 일몰 — 소그룹판이 성산을 쓰므로 코치판은 다른 얼굴",
  },
  "seoul-seoraksan-national-park-sokcho-beach-day-trip": {
    image: "/images/tours/seoraksan-national-park/seoraksan-sinheungsa-ulsanbawi.webp",
    why: "울산바위 — 겨울 상품이 능선 컷을 쓰므로 이쪽은 신흥사·울산바위",
  },
  "busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju": {
    image: "/images/tours/bulguksa-temple/04-10-20260708-120112.webp",
    why: "불국사 붉은 연등(실촬) — 통도사 일주문을 두 상품이 돌려쓰고 있었다",
  },
  "busan-outskirts-tongdosa-amethyst-yeongnam-day-tour": {
    image: "/images/itinerary/tongdosa-iljumun.webp",
    why: "통도사 일주문 — 제목이 통도사라 이쪽이 가져간다",
  },
  "jeju-hydrangea-festival-tour-east-route": {
    image: "/images/tours/hamdeok-beach/03-kakaotalk-20260510-230028438-02.webp",
    why: "함덕 일몰 — 동부 수국 코스의 스톱 사진에 정작 수국이 없다(별도 촬영감)",
  },
  "jeju-hydrangea-festival-tour-southwest-route": {
    image: "/images/tours/hallim-park/01-kakaotalk-20260508-171119960-06.webp",
    why: "한림공원 수국 + 풍차 — 수국 축제 상품인데 카드가 해수욕장 인파였다",
  },
  "seoul-dmz-private-3rd-tunnel-suspension-bridge": {
    image: "/images/tours/gamaksan-suspension-bridge/01-kakaotalk-20260509-231613245-29.webp",
    why: "감악산 붉은 출렁다리 — 제목의 suspension bridge 그 자체. 임진각 정자는 DMZ 상품이라는 게 전혀 안 읽혔다",
  },
  "east-signature-nature-core": {
    image: "/images/tours/jeju-stone-park/04-kakaotalk-20260510-230028438-20.webp",
    why: "돌하르방 열주 — 「화산·해안·민속」 서사를 한 장으로 말한다",
  },
  "jeju-west-south-full-day-authentic-tour": {
    image: "/images/tours/jusangjeolli/04-chatgpt-image-2026-2-15-10-01-04.webp",
    why: "주상절리 육각기둥 — 1100고지 초원은 아무 상품에나 붙을 수 있는 그림이었다",
  },
  "busan-gyeongju-unesco-legacy-tour-national-museum": {
    image: "/images/tours/ahopsan-bamboo/01-chatgpt-image-2026-5-10-12-22-47.webp",
    why: "아홉산 대나무숲 — 활성 경주 상품이 월정교를 쓰므로 이 비활성 상품이 대나무를 가져간다",
  },
  "busan-spring-cherry-blossom-gyeongju-highlights-day-tour": {
    image: "/images/itinerary/bomun-lake-cherry-blossom-promenade.webp",
    why: "보문호 벚꽃 산책로 — 벚꽃 상품의 서사 그대로",
  },
  "jeju-cherry-blossom-tour-east-route": {
    image: "/images/tours/jeonnong-ro/photo-001.webp",
    why: "전농로 벚꽃길 — 제주 벚꽃 상품의 대표 스팟",
  },
  "jeju-winter-southwest-tangerine-snow-camellia-tour": {
    image: "/images/tours/jeju-tangerine-farm/01-kakaotalk-20250603-221325343-14.webp",
    why: "감귤 따기 — 겨울 상품의 체험이 곧 서사",
  },
  "pocheon-sanjeong-lake-herb-island-art-valley": {
    image: "/images/tours/sanjeong-lake/01-chatgpt-image-2026-5-10-10-42-25.webp",
    why: "산정호수 + 명성산 — 이 코스의 출발점",
  },
};
