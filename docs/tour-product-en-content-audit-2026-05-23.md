# Tour-Product Detail — EN Content Audit (33 live tours)

**Date:** 2026-05-23
**Scope:** English (`en`) locale only, all 33 consumer-visible `/tour-product/[slug]` bundles
**Type:** Read-only content review. **No code or data was changed.**
**Requested by:** User 2026-05-23 — "오류 / 이상한 문구 / 위험한 문구 / 고객 오해 포인트 / 모순·착오 표현 / 픽업·드롭오프 이상" across the EN locale.

---

## 0. 요약 (Korean executive summary)

33개 라이브 투어의 EN 콘텐츠를 전수 리뷰했습니다 (번들 34개 중 `seoul-seoraksan-national-park-sokcho-beach-day-trip` 는 은퇴/차단 상태라 제외). 리뷰는 **실제로 렌더되는 필드만** "고객 노출"로 분류했습니다 — `page_sections`, `matching_profile`, `matching_metadata`, `priceSource` 는 렌더되지 않으므로(메모리 `reference_tour_product_render_source` + 코드 `TOUR_PRODUCT_VIEW_MODEL_KEYS` 확인) **잠재(latent)** 로 따로 분리했습니다.

**가장 시급한 4가지 (모두 렌더되는 고객 노출, 즉시 조치 권장):**

1. **가짜 리뷰/별점** — 후기가 0건인데 hero·SEO·카탈로그·신뢰배지에 "4.9/5 across 648 reviews" 같은 문구가 박혀 있음. 소비자 기만(허위 사회적 증거) — 법적·신뢰 리스크. (Jeju 최소 3개 투어 + 별 5개 하드코딩 다수)
2. **크루즈 투어가 호텔로 픽업 안내** — 배에서 내리는 크루즈 승객용 투어인데 픽업 카드가 호텔(Ocean Suites·LOTTE City·신라면세점·공항)을 가리킴. 승객이 배를 놓칠 수 있는 운영 사고. (Jeju 크루즈 2개 + Busan 크루즈 2개)
3. **부산 소그룹 크루즈 투어: 모든 명소 카드가 다른 명소 내용 표시** — 해동용궁사 카드에 UN기념공원 운영정보, 자갈치 카드에 감천문화마을 정보… 한 칸씩 밀려 있음 (poi_key 불일치로 확인).
4. **시즌 투어의 "개화 보장 → 전액 환불, 이유 불문" 류 문구** — 환불 정책과 충돌할 수 있는 위험 카피.

그 외 사실 오류(예: 설악산 "한국 유일의 UNESCO 생물권보전지역"은 거짓 — 한국에 9개 이상, 설악산은 *최초*), UNESCO 지위 과장(성읍민속마을 "UNESCO", 미천굴=만장굴 동일 용암동굴 등), 갤러리 사진-지명 불일치, 내부 수치 모순(벚꽃나무 9,000 vs 2,800그루 등), 픽업 시간 불일치, 카피 작성용 내부 메모 노출("similar local route", "Love Korea Tours", 가이드 실명) 등이 다수 발견됨. 상세는 아래 영문 본문 참조.

> 참고: 이번 리뷰는 EN 콘텐츠 *텍스트* 정합성 위주입니다. 좌표 정확도/날씨 앵커는 별도 트랙 `docs/pickup-dropoff-weather-data-correctness-plan-2026-05-23.md` 에서 다루고 있으나, **크루즈 투어의 "호텔 vs 항구" 픽업 종류 오류**는 그 플랜의 좌표-정확도 프레이밍보다 더 근본적인 문제라 여기서 별도 강조합니다.

---

## 1. Method & important caveat (what is actually customer-facing)

Each tour's EN content is one bundle: `components/product-tour-static/<slug>/<slug>.en.json`. The live page renders **only** the keys in `TOUR_PRODUCT_VIEW_MODEL_KEYS` (`tourProductFullPageJsonTypes.ts`):

> `headlineLine1/2, hero, price, subnavItems, glanceItems, galleryItems, itineraryStops, routeFlowStops, routePhases, routeShapeIntro, whyTourWorks, practicalAccordionItems, practicalWeatherStatic, seasonalVariations, bookingTrustItems, bookingSupportSteps, staticQuestions, guestReviews, reviewsSummary, pickup_dropoff, routeVariants, pricingTiers, liveStatusSection`

Plus `seo` (→ page `<title>`/meta description) and `catalog_card` (→ catalogue listing). These are **customer-facing**.

**NOT rendered → latent only:** `page_sections`, `matching_profile`, `matching_metadata`, `priceSource`, `_publication`, `_poi_meta`. The review agents flagged many issues inside `page_sections` (e.g. sticky-bar price `$78` vs `$79`, an entire wrong tour pasted into a `page_sections` hero, Jeju content inside a Busan charter). **Those are real data debt and a regression risk, but a customer does not see them today.** They are collected in §6, not in the customer-facing severities.

**Severity scale (customer-facing only):**
- **Critical** — false/dangerous claim, legal/liability exposure, or a contradiction that can make a paying customer miss their ship / go to the wrong place / be charged differently than shown.
- **High** — clear factual error or strong internal contradiction a customer will notice.
- **Medium** — misleading/ambiguous wording, unverifiable superlative, stale dated content, polish that erodes a "premium" impression.
- **Low** — typos, broken markdown, minor inconsistency.

One reviewer false-positive was corrected during compilation: "Daecheongbong = Korea's 3rd-highest peak" is **correct** (Hallasan 1947 m > Jirisan 1915 m > Daecheongbong 1708 m) and is *not* an error.

---

## 2. CRITICAL findings (rendered — fix first)

### C1. Fabricated review counts & star ratings (false social proof) — legal/trust risk
Reviews data is empty (`reviewsSummary.totalReviews: 0`, `guestReviews: []`) yet prominent rendered copy asserts specific high ratings and review counts.

| Tour | Where (rendered) | Verbatim |
|---|---|---|
| `jeju-southern-top-unesco-spots-tour` | `hero.tagline`, `seo.description`, `seo.metaDescription`, `catalog_card.shortCardDescription`, `bookingTrustItems[].body` | "The most reviewed entry-level Jeju tour — **4.9/5 across 648 reviews**" / "4.9/5 (648 reviews)" — **verified** against `reviewsSummary.averageRating: 0` |
| `jeju-eastern-unesco-spots-day-tour` | `hero.tagline`, `catalog_card.shortCardDescription`, `bookingTrustItems[0].body` | "**4.9/5 across 1,148 reviews**" / "The most reviewed eastern Jeju tour" — reviews data = 0 |
| `southwest-hallasan-osulloc-aewol` | `seo.metaDescription`, `bookingTrustItems[0].body` | "**4.8/5 (127 reviews)**" / "4.8/5 across 127 reviews" — reviews data = 0 |

Related, same root cause:
- **`hero.meta.ratingStars: 5` while `hero.meta.rating: 0`** → renders 5 filled stars for a 0-review product. Seen in `jeju-eastern-unesco-spots-day-tour`, `jeju-southern-top-unesco-spots-tour`, `busan-outskirts-tongdosa-amethyst-yeongnam-day-tour`, `pocheon-sanjeong-lake-herb-island-art-valley`, `seoul-seoraksan-nami-island-morning-calm-day-tour`. (Many other tours correctly use `ratingStars: 0`.)
- **References to reviews/guides that don't exist** in rendered `whyTourWorks`: `jeju-southern` — "reviews consistently mention the guides personally — **Steven, Chloe, Jina, Hays** — by name"; `jeju-west-south` — guide names + "**Love Korea Tours**" (looks like a prior/competitor operator name leaked into copy).

> **Action:** Either import the real reviews so the data backs the claim, or remove every hard-coded rating/review-count string and set `ratingStars` to 0 until reviews exist. This is the highest-liability item in the audit.

### C2. Cruise shore-excursion tours send guests to HOTELS, not the cruise terminal
These products are sold to passengers disembarking a ship; pickup must be the cruise terminal. The rendered `pickup_dropoff` block (and the rendered pickup FAQ) instead describe hotel pickup.

- **`jeju-cruise-shore-excursion-bus-tour`** and **`jeju-cruise-shore-excursion-small-group-tour`** — `pickup_dropoff.departure[]` = "**Ocean Suites Jeju Hotel**", "**Jeju International Airport (3F, Gate 3)**", "**LOTTE City Hotel Jeju**", "**Shilla Duty Free**" (verified); `staticQuestions[pickup].answer` = "**From your hotel lobby or a designated pickup point in the booking area.**" Yet `itineraryStops`/`routeVariants` correctly say "Jeju Cruise Terminal Pickup". Direct contradiction on the single most safety-critical field for a cruise passenger.
  - Also `pickup_dropoff.notes` = "Return usually runs around **17:30–18:00**" conflicts with the itinerary's "arrive port ≈16:00–16:45" and FAQ "16:30–17:00" — a guest trusting the notes could miss sail-away.
- **`busan-small-group-sightseeing-tour-cruise-passengers`** — only names "Busan Port International **Passenger** Terminal" (Choryang). Large cruise ships use the **Dongsam International Cruise Terminal (Yeongdo)**; no meeting info for those passengers (the private-charter sibling does cover both).

> Connects to `docs/pickup-dropoff-weather-data-correctness-plan-2026-05-23.md` D1 ("cruise/charter tours keep port pickup") — but that plan frames the Jeju issue as *coordinate accuracy*. The deeper defect is the **wrong category of pickup point entirely**. Confirm before the coordinate pass so the hotel rows aren't "corrected" in place.

### C3. Busan small-group cruise tour — every attraction card shows a *different* attraction's details
In the rendered `itineraryStops`, the operational fields are rotated one position. Verified via `_poi_meta.poi_key` mismatches:

| Stop name (correct) | Attached `poi_key` / content (wrong) |
|---|---|
| Haedong Yonggungsa Temple | `un_memorial_cemetery` (UNMCK hours, "Turn Toward Busan" ceremony, Wall of Remembrance, wheelchair-flat — opposite of the temple's 108 steps) |
| Jagalchi, BIFF Square & Gukje Market | `gamcheon_culture_village` (UN-HABITAT award, Little Prince bench, steep stair-alleys) |
| Gamcheon Culture Village | `yongdusan_park` (Busan Tower observatory hours, Yi Sun-sin statue, ₩12,000 tower admission) |
| Songdo Beach or Yongdusan Park | `jagalchi_market` (fish-market hours, sannakji, "buy-downstairs/eat-upstairs") |

Stop *descriptions* are correct, but the highlights / timeUsed / smartNotes / visitBasics / images a customer reads are the wrong site's. **`busan-private-car-charter-cruise-shore`** has the same defect (a stop labeled "Route planning with your guide" carries full UN-Memorial-Cemetery content; "Return to Busan Cruise Terminal" carries Gamcheon content).
- Also in `busan-small-group…`: `itineraryStops[0].highlights` says "**Lunch included at local Busan restaurant**" while the lunch stop, FAQ, and practical accordion all say lunch is **not** included.

### C4. Rendered price contradictions / missing prices
(Most price mismatches the agents found live in `page_sections` and are **latent** — see §6. The following are in rendered fields.)

- **`busan-small-group-sightseeing-tour-cruise-passengers`** — `catalog_card.priceLabel`/`price` = **$79** but `staticQuestions[q-vs-private].answer` (rendered) = "this shared-van version runs at **$58.50 per person**". A customer sees two different prices.
- **`busan-spring-cherry-blossom-gyeongju-highlights-day-tour`** and **`busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju`** — `catalog_card.priceLabel` = `""` and `price.amountLabel` = `""` → the card/booking surface renders **no price at all** (conversion blocker; inconsistent with every other tour). May be intentional for a hold-and-pay seasonal SKU, but currently reads as broken.

### C5. Risky guarantees & bloom/refund promises (liability wording)
- **`busan-spring-cherry-blossom-gyeongju-highlights-day-tour`** — `catalog_card.shortCardDescription` + `bookingTrustItems` + FAQ: "**full refund if bloom is materially delayed or finished**" / "at least 3 days' notice and **full refund — no fees, no questions**." Operator-subjective trigger, framed as an unconditional promise; can conflict with the platform's enforced cancellation terms.
- **`busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju`**, **`jeju-hydrangea-festival-tour-east-route`**, **`jeju-hydrangea-festival-tour-southwest-route`** — similar bloom-refund language.
- Cruise tours — "**Guaranteed return**" badge / "Return is guaranteed by 19:30" / "has not missed a sail-away in 4 seasons" while the return drive can run 60–90 min and no compensation is stated if a ship is missed (`busan-cruise-shore-excursion-bus-tour`, `incheon-seoul-private-car-shore-excursion-cruise`, `from-incheon-seoul-day-tour-cruise-guests`, `busan-private-car-charter-cruise-shore`). Recommend softening "guaranteed" → "planned/built-in buffer" and stating the no-liability/own-risk position.

---

## 3. HIGH findings (rendered — clear errors / strong contradictions)

### H1. False superlative — Seoraksan "Korea's **only** UNESCO Biosphere Reserve"
Korea has 9+ UNESCO Biosphere Reserves (Jeju 2002, Shinan Dadohae 2009, Gwangneung 2010, Gochang 2013, Suncheon 2018, …). Seoraksan (1982) is the **first**, not the only. Appears repeatedly in rendered `itineraryStops.highlights/description/whyOnRoute` of **`seoul-seoraksan-nami-island-morning-calm-day-tour`** and **`seoul-seoraksan-naksansa-temple-naksan-beach-day-trip`** (copy-pasted Seoraksan block). *(confidence: high)*

### H2. Seoraksan temple/Buddha overclaims (same two tours, same shared block)
- "Tongildaebul … **world's largest seated bronze Buddha**" — false; e.g. Hong Kong's Tian Tan Buddha (34 m) far exceeds 14.6 m. Should be "**Korea's** largest…". *(high)*
- "Sinheungsa (652 CE) — **world's oldest Seon (Zen) temple**" — anachronistic; Seon reached Korea only ~9th c. (Doui, ~821 CE). *(high)*
- "Sinheungsa — **head temple of the Jogye Order**" — it is a branch temple (under Woljeongsa, District 4), not a head temple. *(med-high)*

### H3. UNESCO status overstated/conflated across Jeju (and one Busan) tours
Customer-facing fields conflate three distinct programs (World Heritage 2007 vs Biosphere Reserve 2002 vs Global Geopark 2010) or attach "UNESCO" to non-UNESCO sites:
- "**Seongeup Folk Village (UNESCO heritage)**" in `galleryItems.location` + `routeFlowStops` — it is *national* folk heritage, not UNESCO (the tour's own non-rendered metadata even says so). `jeju-eastern-unesco-spots-day-tour`, `jeju-hydrangea-festival-tour-east-route`. *(high)*
- "Micheon Cave (Ilchul Land) — **same lava-tube system as Manjanggul / UNESCO**" — it is a separate commercial cave; the UNESCO cave is Manjanggul. `jeju-eastern-unesco-spots-day-tour`, `jeju-hydrangea-festival-tour-east-route`. *(high)*
- "**triple-UNESCO site**" / "only triple-designated site" applied to Seongsan Ilchulbong or Hallasan — Biosphere & Geopark are island-wide, not per-site. `jeju-island-private-car-charter-tour`, `jeju-southern-top-unesco-spots-tour`, `jeju-cherry-blossom-tour-east-route`. *(high)*
- "Jusangjeolli … UNESCO Global Geopark **(2010)**" using the *World Heritage* inscription name. `jeju-hydrangea-festival-tour-southwest-route`. *(med)*

### H4. East flagship SEO names attractions the tour doesn't visit
**`east-signature-nature-core`** — `seo.title`/`seo.metaDescription`: "Jeju Stone Park, **Hamdeok Beach** & **Manjanggul Cave** …". The tour actually visits Seopjikoji and Micheon Cave (inside Ilchul Land); Hamdeok and Manjanggul are not on it. Wrong promise in Google snippets for the flagship product. *(high)*

### H5. Gallery image ↔ location/caption mismatches (rendered `galleryItems`)
Customers see photos captioned with the wrong place. Confirmed across many tours:
- `jeju-southern-top-unesco-spots-tour` — systematic one-position offset; **every** gallery photo is labeled with the wrong attraction (Hallasan img→"Camellia Hill", Osulloc imgs→"Camellia Hill", etc.).
- `jeju-west-south-full-day-authentic-tour` — 5 swaps (Hallasan→Jusangjeolli, Osulloc→Hyeopjae, Jusangjeolli→Cheonjeyeon, Cheonjeyeon→Osulloc…).
- `southwest-hallasan-osulloc-aewol` — Cheonjeyeon/Osulloc/Aewol images swapped.
- `jeju-cherry-blossom-tour-east-route` — Seongsan images captioned "Jeonnong-ro Cherry Blossom Street".
- `jeju-eastern-unesco-spots-day-tour` — first gallery image (Hamdeok beach file) labeled "Seongeup Folk Village".
- `from-incheon-seoul-day-tour-cruise-guests` — Gwangjang Market image labeled "Insadong".
- `seoul-suwon-hwaseong-waujeongsa-starfield` — multiple Starfield Library / Suwon Hwaseong images labeled "Waujeongsa Temple".
- `busan-top-attractions-day-tour` — un-memorial images labeled "Gamcheon"; cheongsapo images labeled "UN Memorial Cemetery".
- `busan-small-group-sightseeing-tour-cruise-passengers` — Taejongdae images labeled "UN Memorial Cemetery", + Korean-text locations (see M-non-English).

### H6. Internal numeric/factual contradictions a customer can see (rendered ↔ rendered)
- **Cherry-tree count** — Bomun Lake "**9,000** cherry trees" (routePhases/routeShapeIntro/whyTourWorks) vs "**~2,800**" (itineraryStops description). `busan-spring-cherry-blossom…`, `busan-plum-cherry-blossom…`. (~2,800 is the realistic figure.)
- **Camellia Hill admission** — "₩10,000" (accordion) vs "₩12,000 adult" (stop highlights/description). `jeju-winter-southwest-tangerine-snow-camellia-tour`, `jeju-hydrangea-festival-tour-southwest-route`, `jeju-southern-top-unesco-spots-tour`.
- **Haenyeo demonstration time** — "daily at **13:30 and 15:00**" (description) vs "**once daily at 14:00**" (highlights) — in *every* Seongsan tour: `jeju-cherry-blossom…`, `jeju-cruise-…-bus`, `jeju-cruise-…-small-group`, `jeju-eastern-unesco…`, `jeju-grand-highlights-loop`, `jeju-hydrangea-…-east`, `east-signature-nature-core`.
- **Nami Island admission** — ₩19,000 vs ₩16,000 vs ₩18,000 across `seoul-private-nami-morning-calm-petite-france`, `seoul-suburbs-private-chartered-car-10hr` (and within single files).
- **Garden of Morning Calm themed gardens** — "20" vs "22" vs "26" in one file. `seoul-private-nami-morning-calm-petite-france`.
- **Bukchon hanok count** — "~900" (stop) vs "≈600" (FAQ). `from-incheon-seoul-day-tour-cruise-guests`.
- **Herb Island** — "**Closed Wednesdays**" (highlights) vs "**Open year-round**" (visitBasics); admission ₩9,000 vs ₩10,000/₩12,000. `pocheon-sanjeong-lake-herb-island-art-valley`.
- **Sanjeong Lake trail** — "3 km / 50–60 min" (stop) vs "4 km / 75 min" (FAQ + routeLogic). `pocheon-…`.
- **Waujeongsa** — founder "Master Haedeung" (stop) vs "Monk Kim Hae-Geun" (FAQ); reclining Buddha "Indian sandalwood" vs "Indonesian juniper"; bell "8-ton" vs "12-ton"; mountain "Yeonhwasan" vs "Eunesan". `seoul-suwon-hwaseong-waujeongsa-starfield` (canonical itineraryStops vs rendered FAQ — both customer-facing).
- **Ahopsan admission** — "₩8,000 adult" (stop) vs "₩5,000" (FAQ/inclusions). `from-busan-gyeongju-ancient-capital-day-tour`.
- **Hallim Park cave age** — "Hyeopjaegul Cave (~**25 million years old**)" — geologically impossible for Jeju (volcanism ~1–2 Myr; tubes ~tens of thousands of years). Likely off by ~3 orders of magnitude. `jeju-hydrangea-festival-tour-southwest-route`. *(high)*
- **Schedule impossibility** — `jeju-cherry-blossom-tour-east-route`: Stop 2 starts 10:30 but its `timeUsed` says "Drive from Jeonnong-ro … (~50 min)" after Stop 1 ends 10:15 (15-min gap for a 50-min drive).
- **Lunch vs schedule** — `seoul-seoraksan-nami-island-morning-calm-day-tour`: lunch "~12:30 en route Seoraksan→Nami" but Seoraksan is 10:00 + 3 h = until ~13:00 (verified earlier).

### H7. Pickup time/sequence inconsistencies (itineraryStops text vs `pickup_dropoff` block — both rendered)
- `busan-top-attractions-day-tour` — first pickup "**09:00**" (itinerary) vs "**08:30**" (pickup_dropoff/FAQ/practical); pickup order also reversed.
- `from-busan-gyeongju-ancient-capital-day-tour` — Haeundae "**08:40**" (itinerary) vs "**09:10**" (pickup_dropoff/FAQ) — a guest would arrive 30 min early.
- `busan-gyeongju-unesco-legacy-tour-national-museum` — Seomyeon 08:25 vs 08:30, Haeundae 08:45 vs 09:10.
- `seoul-suwon-hwaseong-folk-village-starfield-library` & `…gwangmyeong-cave…` — drop-off order unspecified in customer text; Myeongdong "Exit 2 or 4" (departure) vs "Exit 4" (return).

### H8. DMZ suspension-bridge length wrong in headline copy
**`seoul-dmz-private-3rd-tunnel-suspension-bridge`** — `hero.tagline`/`seo.metaDescription`/`catalog_card.subtitle`/atmosphere caption say "**220-meter** … Korea's longest red suspension bridge", but the stop description (and the file's own `_poi_meta.note`) say it's **150 m** per Visit Korea and that "220 m most likely conflates this bridge with the nearby Majangho Suspension Bridge." The wrong number is in the most prominent fields. *(high)*

### H9. "Korea's only walled fortress" (false)
**`seoul-suwon-hwaseong-folk-village-starfield-library`** & **`seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library`** — `hero.tagline`: "Korea's **only walled fortress**". False (Namhansanseong, Gongsanseong, etc.). The defensible claim is "only walled *fortress city* built with its original construction record (Uigwe)" — which the body text actually uses. *(high)*

### H10. Internal authoring notes / wrong-operator names leaked into customer copy
- `jeju-west-south-full-day-authentic-tour` — `catalog_card.shortCardDescription`: "**similar local route as the Southern UNESCO tour but with a more lifestyle-oriented framing**" (an editorial note); `whyTourWorks` references "**Love Korea Tours**" + guide names.
- `from-busan-gyeongju-ancient-capital-day-tour` — `catalog_card.shortCardDescription`: "Same classic six-attraction route as the **UNESCO Legacy version**" (sibling-product reference meaningless to a customer).
- `busan-outskirts-tongdosa-amethyst-yeongnam-day-tour` — `routeFlowStops[0].theme`: "**Seoul-style pickup**" (this is a Busan tour); lunch stop copy addresses "**cruise … guests**" (not a cruise tour).
- `jeju-eastern-unesco-spots-day-tour`, `jeju-hydrangea-…-east` — FAQ answers literally begin "**similar local route**" (unfinished stub).

### H11. "Jewel in the Palace — 50 million domestic viewers" (impossible)
**`seoul-suwon-hwaseong-folk-village-starfield-library`** — 50 M ≈ all of Korea's population; peak episodic viewership was ~20–25 M. Appears in two stop descriptions. *(high)*

---

## 4. MEDIUM findings (rendered)

- **Stale dated content presented as current** (today is 2026-05-23):
  - `busan-gyeongju-unesco-legacy-tour-national-museum` — "Silla Gold Crowns exhibition **through Dec 14, 2025**" advertised as current (ended ~5 months ago).
  - `seoul-suburbs-private-chartered-car-10hr` — Everland "**ranked 19th globally … in 2018**"; "**Fubao**" described as a resident panda (repatriated to China Apr 2024).
  - `incheon-seoul-private-car-shore-excursion-cruise` — N Seoul Tower "**2012** survey #1 attraction" as a present-tense claim.
  - Several Seoraksan tours — "park entrance FREE (**recently** abolished)" ("recently" will age badly; give a year).
- **Non-English text in the EN bundle** (rendered): `seoul-suwon-hwaseong-waujeongsa-starfield` — `galleryItems.location` = "**Templo Waujeongsa**" (Spanish, 4×); `busan-small-group-sightseeing-tour-cruise-passengers` — `galleryItems.location` = "**태종대 해안 절벽**", "**감천문화마을**", "**용두산공원 & 부산타워**" (Korean).
- **Lunch listed as "included" then "pay direct"** — both Jeju cruise tours' `practicalAccordionItems[included]` list "Lunch (pay direct at restaurant)" inside the **Included** section.
- **Stop-count inconsistencies** — `catalog_card.stopsCount` vs `hero.meta.stops` vs the actual itinerary differ on most tours (pickup/lunch/return counted inconsistently); e.g. `busan-cruise…bus` "8 stops" vs 11 entries; `busan-top-attractions` subtitle "9.5-hour" vs duration "10.5 hours". Pick one convention.
- **Unverifiable superlatives / puffery** (premium-tone risk): "Asia's largest amethyst cave" (`busan-outskirts…`), "East Asia's premier columnar-jointing site" (`jeju-grand…`, `jeju-cruise…bus`), "largest Buddhist temple complex in East Asia" — Yakcheonsa (`jeju-island-private-car-charter-tour`), "the only waterfall in Asia that falls directly into the ocean" — Jeongbang (`jeju-grand-highlights-loop`), "Korea's first comprehensive resort" — Bomun (`busan-spring/plum`), "most-photographed streetfood alley", "Korea's most photographed garden scene" (`from-incheon-seoul…`), "the only road in Korea where pink cherry + canola bloom simultaneously" (`jeju-cherry-blossom…`), "Korea's first carbon-free island certification" (`jeju-hydrangea-…-southwest`).
- **Geography/coverage overstatement** — `jeju-grand-highlights-loop` "full-island loop covering … **west** Jeju" (it doesn't visit west Jeju); seasonal note mentions "Cheonjeyeon at peak flow" though Cheonjeyeon isn't on-route.
- **`pocheon-sanjeong-lake-herb-island-art-valley` has no cancellation policy** in any accordion (the other Seoul day-tours do).
- **Cruise audience mismatch** — `busan-plum-cherry-blossom…` lists "Cruise passengers" in `whyTourWorks.bestFor` but picks up only at subway stations (no port pickup).
- **`jeju-grand-highlights-loop`** — `seo.metaDescription` "**10-hour**" vs everywhere else "9–9.5 hours".

---

## 5. LOW findings (rendered — polish)

- Typos / doubled words: "what's the difference vs **the our** … tour **tour**" (`jeju-cherry…` FAQ), "switch the **route route** option" (both Jeju cruise), "hard schedule **schedule** limit" (`jeju-winter…`), duplicated APEC bullet (`busan-spring`/`busan-plum`), "Jeju's **only highest-altitude** national highway" (`jeju-west-south`).
- Broken markdown: `***Tricyrtis macropoda***` (bold+italic, unparseable) — `jeju-southern…`.
- Invalid token: `iconColor: "text-slate-698"` (not a Tailwind shade) — `jeju-island-private-car-charter-tour`.
- Em-dash rendered as "?" in many gallery captions/alt (encoding) — `jeju-hydrangea-…-southwest`, `jeju-west-south`, `southwest-hallasan-osulloc-aewol` (Osulloc entries).
- Truncated sentence: `itineraryStops[0].description` ends "…Nami specifically markets to" — `seoul-private-nami-morning-calm-petite-france`.
- Place-name spelling drift within a file: "Ssamzigil"/"Ssamziegil", "heuk-doeji"/"heuk-dwaeji".

---

## 6. LATENT issues (NOT currently rendered — data debt / regression risk)

These are real and worth a cleanup pass, but `page_sections`/`matching_profile`/`matching_metadata`/`priceSource` are not rendered, so a customer does not see them **today**. They become live bugs if the render path ever falls through to `page_sections`.

- **`page_sections` sticky-bar prices disagree with the live `price`** on nearly every tour (e.g. `$78`/10% vs `$79`/11%; `$54` vs `$52`; `$48.60` vs `$47`; empty `amountLabel`; leftover `priceNote` "price not yet confirmed"; GetYourGuide IDs like `getyourguide_t816598`). Live `price` is the rendered/correct one.
- **Whole-wrong-tour content inside `page_sections`** — `busan-plum-cherry-blossom…` `page_sections` hero/itinerary is the **Gyeongju Legacy** tour; `busan-private-car-charter-cruise-shore` `page_sections` carries **Jeju** route-variant remnants.
- **`page_sections` itinerary disagreeing with canonical** — Dora Observatory "rebuilt 2018" vs "2024"; "reach Gwangmyeong Cave before noon" (cave is visited ~15:00); Waujeongsa facts; admission prices.
- **`matching_profile` / `matching_metadata` errors** — `poi_tags`/`anchor_poi_keys` listing sites not on the route (Manjanggul, Seoraksan, Cheonjiyeon, Hallim Park); `lunch_included_fit: 1` when lunch isn't included; `min_recommended_age` vs FAQ age; typo "hallasan_uneso". (Affects the recommender/matcher, not the detail page text.)

---

## 7. Per-tour worst-severity index

| Tour | Worst (rendered) | Headline issue |
|---|---|---|
| jeju-cherry-blossom-tour-east-route | Critical | gallery mislabels; impossible 50-min drive in 15-min gap; "only road" superlative |
| jeju-cruise-shore-excursion-bus-tour | Critical | hotel pickup for cruise; return-time conflict; lunch-in-included |
| jeju-cruise-shore-excursion-small-group-tour | Critical | hotel pickup for cruise; same as above |
| jeju-eastern-unesco-spots-day-tour | Critical | fabricated "1,148 reviews"; Seongeup "UNESCO"; Micheon=Manjanggul; airport gate conflict |
| jeju-grand-highlights-loop | High | UNESCO conflation; "9,000 trees"? no; "covers west"; SEO 10h |
| jeju-hydrangea-festival-tour-east-route | High | Seongeup "UNESCO"; Micheon=Manjanggul; bloom framing |
| jeju-hydrangea-festival-tour-southwest-route | High | cave "25 M years"; fixed-vs-flexible pickup; Camellia price |
| jeju-island-private-car-charter-tour | High | "triple-UNESCO" site; Yakcheonsa "largest in East Asia"; ferry price split |
| jeju-southern-top-unesco-spots-tour | Critical | fabricated "648 reviews"; every gallery photo mislabeled; drop-off times conflict 1 h+ |
| jeju-west-south-full-day-authentic-tour | Critical | internal note in card copy; "Love Korea Tours" + guide names; gallery swaps |
| jeju-winter-southwest-tangerine-snow-camellia-tour | High | Camellia ₩10k vs ₩12k; reminder "12 h" vs "2 days"; 250 vs 500 varieties |
| southwest-hallasan-osulloc-aewol | Critical | fabricated "127 reviews"; SEO names wrong first stop; gallery swaps |
| east-signature-nature-core | High | SEO names Hamdeok+Manjanggul (not visited); haenyeo time conflict |
| busan-cruise-shore-excursion-bus-tour | High | sail-away "guaranteed"; stop count 8 vs 11; Songdo/Haeundae date claim |
| busan-gyeongju-unesco-legacy-tour-national-museum | High | pickup time splits; stale Dec-2025 exhibition; routeFlow stop not in itinerary |
| busan-outskirts-tongdosa-amethyst-yeongnam-day-tour | High | "Asia's largest amethyst cave"; "Seoul-style pickup"; Bulguksa "Sansa" error |
| busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju | Critical | empty price; Haeundae vs Nopo pickup conflict; bloom-refund; cruise in bestFor |
| busan-private-car-charter-cruise-shore | Critical | stop content from wrong POIs; terminal ambiguity; "guaranteed return" |
| busan-small-group-sightseeing-tour-cruise-passengers | Critical | every attraction card rotated to wrong POI; $79 vs $58.50; "lunch included" |
| busan-spring-cherry-blossom-gyeongju-highlights-day-tour | Critical | empty price; bloom-refund "no questions"; 9,000 vs 2,800 trees; "362-day lunar year" |
| busan-top-attractions-day-tour | Critical | first-pickup 09:00 vs 08:30; gallery mislabels; "22 vs 21 nations" |
| from-busan-gyeongju-ancient-capital-day-tour | High | Haeundae pickup 08:40 vs 09:10; Ahopsan ₩8k vs ₩5k; "UNESCO Legacy version" leak |
| from-incheon-seoul-day-tour-cruise-guests | High | 7 vs 6 stops; Bukchon 900 vs 600; Gwangjang img→"Insadong"; sail-away buffer |
| incheon-seoul-private-car-shore-excursion-cruise | Critical | "Guaranteed return" vs 60–90 min drive; vehicle "sedan/SUV" vs KIA Carnival; Bukchon "15th-century" |
| pocheon-sanjeong-lake-herb-island-art-valley | High | Herb Island closed-Wed vs year-round; 3 vs 4 km trail; **no cancellation policy** |
| seoul-dmz-private-3rd-tunnel-suspension-bridge | Critical | bridge 220 m vs 150 m in headline; "no passport, no refund" vs "standard policy"; rooftop-closure under-warning |
| seoul-private-nami-morning-calm-petite-france | High | Nami ₩19k/₩16k; Morning Calm 20/22/26 gardens; Tagore name origin; truncated sentence |
| seoul-seoraksan-nami-island-morning-calm-day-tour | High | "only" biosphere; "world's largest/oldest" Buddha/temple; 12:30 lunch vs 13:00 schedule |
| seoul-seoraksan-naksansa-temple-naksan-beach-day-trip | High | same Seoraksan errors (copy-paste); min-age 6 vs "8+ for comfort" |
| seoul-suburbs-private-chartered-car-10hr | High | "from $179" = 4 h not 10 h; stale Everland/Fubao; Folk Village ₩37k vs ₩32k |
| seoul-suwon-hwaseong-folk-village-starfield-library | High | "Korea's only walled fortress"; "Jewel in the Palace 50 M viewers" |
| seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library | High | "only walled fortress"; Weta-Workshop dragon (unverified); Wine Cave 200 vs 170 |
| seoul-suwon-hwaseong-waujeongsa-starfield | Critical | founder/Buddha/bell/mountain all contradict; "Templo" Spanish; Starfield imgs→"Waujeongsa" |

*(Excluded: `seoul-seoraksan-national-park-sokcho-beach-day-trip` — retired 2026-05-14, consumer-blocked.)*

---

## 8. Recommended fix order

1. **C1 fabricated reviews / 5-star-with-0-reviews** — every tour, rendered. Highest legal/trust risk; fastest to scope (string + `ratingStars`).
2. **C2 cruise hotel-vs-terminal pickup** — 4 cruise tours. Safety/ops; coordinate with the pickup/drop-off plan so hotels aren't "geocoded" in place.
3. **C3 Busan small-group + private-charter stop-content rotation** — the stop cards are unusable; re-map `poi_key`→content (and remove "lunch included").
4. **C5/H8/H9 risky/false headline claims** — bloom-refund guarantees, "guaranteed return", "220 m" bridge, "only walled fortress", "only" biosphere reserve, "world's largest/oldest" Buddha/temple.
5. **H3 UNESCO conflation** + **H5 gallery mislabels** + **H6 numeric contradictions** — batch by attraction (Seongeup, Micheon/Manjanggul, Camellia price, haenyeo time, Bomun trees) since they repeat across tours via shared POI copy.
6. **H10 authoring-note leaks** + **M non-English / stale dates / empty prices**.
7. **§6 latent `page_sections`/matching cleanup** — separate hygiene pass; lower urgency but needed before any render-path change.

---

## 9. Systemic root causes (so fixes don't regress)

1. **Shared POI copy blocks propagate one error to many tours** — fix the *source* block (Seoraksan, Seongsan haenyeo, Camellia Hill, Cheonjeyeon/Jusangjeolli) once, then re-sync.
2. **A bulk fill pipeline misaligned stop-level fields by position** (Busan cruise rotation; gallery one-off offsets) — needs a `poi_key`↔content integrity check.
3. **Hard-coded marketing rating/review strings** decoupled from `reviewsSummary` — should be derived from data, never literal.
4. **Two parallel content layers** (`itineraryStops` rendered vs `page_sections` legacy) drift apart — either delete `page_sections` or gate it so it can't render stale content.
5. **`pickup_dropoff` authored from a generic hotel template** even for cruise/port products — needs product-type-aware authoring.

*Next step on request: produce the same audit for the other 5 locales (ko/ja/zh/zh-TW/es), or turn any section above into a fix-ready task list.*
