# Tour-Product EN Content Fix — Master Plan (2026-05-23)

**Source audit:** [docs/tour-product-en-content-audit-2026-05-23.md](./tour-product-en-content-audit-2026-05-23.md)
**Branch / worktree:** `fix/tour-content-en-audit-2026-05-23` @ `C:\Users\sangsong\atockorea-content-fix`
**Base:** `origin/main` HEAD `89878304` (post-merge of PR #9 pickup/dropoff Phase 1)
**Scope:** 33 live `/tour-product/[slug]` bundles × 6 locales (`en/ko/ja/zh/zh-TW/es`)
**Authority:** User 2026-05-23 — 11-point directive to fix every Critical/High audit finding and ship.

---

## 0. 결정 로그 (User 2026-05-23)

| # | 사용자 지시 | 결정 |
|---|---|---|
| 1 | 가짜 후기/별점 지워 | **삭제** (rendered fields 전부). reviews 0건이면 별점도 0, 후기 카운트 문구도 0. |
| 2 | 크루즈 픽업 항구로 fix | Jeju → **제주항**(jeju_port) 또는 **강정항**(gangjeong_port). Busan → **부산크루즈항(영도)**(busan_dongsam_cruise_terminal) 또는 **부산항 국제여객터미널(초량)**(busan_choryang_passenger_terminal). Incheon → **인천크루즈터미널(송도)**(incheon_songdo_cruise_terminal). 호텔/공항/면세점은 cruise 투어 픽업에서 제거. |
| 3 | 부산 스톱 회전 제대로 fix | itineraryStops 의 highlights/timeUsed/smartNotes/visitBasics/images/_poi_meta 를 각 스톱의 실제 명소에 맞게 재매핑. 설명 텍스트는 이미 맞음 → 운영 필드만 교체. |
| 4 | 개화-보장 환불은 고쳐, 크루즈 return guarantee 는 무조건 강하게 | **개화 보장**: "no fees, no questions" 류 제거, "if peak bloom window is missed, free reschedule or 90% refund (3-day notice)" 같이 정책 정합하게. **크루즈 return**: 약화 금지. 오히려 "Guaranteed sail-away — we've never missed in N seasons; on-time return is the product" 식으로 강조 유지. |
| 5 | 설악산 유일 유네스코 → 고쳐 | "Korea's only UNESCO Biosphere Reserve" → "**Korea's first** UNESCO Biosphere Reserve (1982)". |
| 6 | UNESCO 과장 전부 fix | 성읍민속마을 "UNESCO" 라벨 제거(국가민속문화재). 미천굴 "same as Manjanggul UNESCO 용암동굴" → "separate commercial cave with similar volcanic geology". 성산/한라산 "triple-UNESCO site" 표현 → 정확한 단일 지정만 (Seongsan = WHC 2007 구성요소, Hallasan = WHC 2007 + 별도 KNPS). |
| 7 | 갤러리 사진 위치 fix | galleryItems 의 src ↔ location/caption 정합. 잘못 라벨된 사진은 location/caption 을 src 와 맞춤. EN 외 잔재(Templo Waujeongsa, 한국어) 제거. |
| 8 | 수치 검색 후 fix | 보문호 벚꽃 ≈2,800 (Visit Gyeongju 공식; 9,000 제거). 카멜리아힐 어른 ₩12,000 (₩10,000 인스턴스 수정). 그 외 모순 수치는 항목별 verify 후 단일 출처로 통일. |
| 9 | 회사/가이드 실명 제거 | "Love Korea Tours" 제거. 가이드 실명(Steven, Chloe, Jina, Hays, Sunny) 모두 제거 → "your licensed local guide" 등 일반 표현. |
| 10 | 전체 fix + 6개 로케일 반영 + 커밋·머지·푸쉬 | EN 먼저 fix → ko/ja/zh/zh-TW/es 평행 적용. Phase별 PR + merge + push. |
| 11 | 너무 크면 plan + phase | 본 문서 = 그 플랜. Phase 1→7 + Phase 8 ship. |

### 추가 제약 (메모리 + 코드 사실)
- **렌더되는 필드만 고객 노출**: `TOUR_PRODUCT_VIEW_MODEL_KEYS` (코드: `tourProductFullPageJsonTypes.ts`). `page_sections`/`matching_profile`/`matching_metadata`/`priceSource` 는 NOT rendered → **건드리지 않음**(잠재 데이터 부채, 별도 트랙).
- **데이터 보존 원칙**: 오류 한 곳만 정밀 수정, 인접 콘텐츠 보존(memory `feedback_data_preservation`). 절대 문단 통째로 삭제 금지.
- **i18n 평행**: 6개 로케일 핸드 에디트. translate script 사용 금지(memory `feedback_i18n_translate_script_drops_keys`).
- **워크트리 격리**: 본 작업은 `C:\Users\sangsong\atockorea-content-fix` 안에서만(memory `feedback_worktree_isolation`).
- **Ship workflow**: phase별 build green → commit → PR → merge to main → push (memory `feedback_ship_workflow_authorized`).
- **진행 보고 한국어**(memory `feedback_progress_updates_korean`).
- **In-flight 작업과 충돌 회피**: PR #9 가 막 머지됨 (`docs/pickup-dropoff-weather-data-correctness-plan-2026-05-23.md` 의 Phase 1+_role 마커). 본 트랙의 Phase 2(크루즈 픽업 항구화)는 그 플랜의 Phase 3/4 와 데이터-층에서 겹침 → **본 트랙의 Phase 2 가 그 플랜 Phase 3/4 를 흡수**해서 실행(중복 작업 방지). 그 플랜 문서의 §5 상태 대시보드에 포인터 추가.

---

## 1. Phase 개요

| Phase | 내용 | 위험 | 6-locale 작업량(대략) | 상태 |
|---|---|---|---|---|
| 0 | 플랜 + 브랜치 셋업 (본 문서) | 없음 | — | ✅ done |
| 1a EN | 가짜 후기 + 위험 카피 + 작성자 메모 제거 | 낮음 | 16 files / ~50 edits | ✅ PR #10 (`0fe21c98`) |
| 1b–f locales | ko/ja/zh/zh-TW/es 동기화 | 낮음 | ~80 files | ⏳ |
| 2a EN | 크루즈 픽업 → 항구로 재구성 | 중 | 7 tours / ~30 edits | ✅ PR #11 (`28d68626`) |
| 2b–f locales | 동기화 | 중 | ~35 files | ⏳ |
| 3 EN | 부산 스톱 회전 재매핑 | 중-높음 | 2 tours × 5 stops × 6 fields | ⏳ |
| 4a EN | UNESCO 사실 정정 | 낮음-중 | 10 tours / 93 edits | ✅ PR #12 (`98a34706`) |
| 4b–f locales | 동기화 | 중 | ~50 files | ⏳ |
| 5a EN | 수치 정정 (high-confidence) | 낮음 | 6 tours / 24 edits | ✅ PR #13 (`117b8f26`) |
| 5b EN | 수치 정정 (verify 필요 항목) | 중 | ~10 항목 × tours | ⏳ |
| 5 locales | 동기화 | 중 | ~30 files | ⏳ |
| 6 | 갤러리 사진-지명 재매핑 | 중 | ~9 tours × galleryItems × 6 = ~150 | ⏳ |
| 7 | DMZ 다리 150m + 잡정리 | 낮음 | ~30 edits × 6 = ~180 | ⏳ |
| 8 | per-phase commit + PR + merge + push | 낮음 | per phase | 🔄 ongoing (4 PRs shipped) |

**총량**: 수정 약 **1,300+ JSON 편집 across ~200 files**. 한 세션에 다 끝낼 수 없음 → phase 단위로 ship.

---

## 2. Phase별 상세 (Source-of-truth: 매 phase 시작 시 본 문서 §2 X.x 와 audit 문서 §2-5 를 함께 확인)

### Phase 1 — 가짜 후기 + 위험 카피 + 작성자 메모 (Critical fast wins)

**EN 타깃 (rendered fields)**:

1.1. **Fabricated reviews 삭제** — `hero.tagline`, `seo.title/description/metaDescription`, `catalog_card.shortCardDescription`, `bookingTrustItems[].body`
- jeju-southern-top-unesco-spots-tour — "4.9/5 across 648 reviews"
- jeju-eastern-unesco-spots-day-tour — "4.9/5 across 1,148 reviews", "The most reviewed eastern Jeju tour"
- southwest-hallasan-osulloc-aewol — "4.8/5 (127 reviews)" / "4.8/5 across 127 reviews"
- 패턴: rating/review 문구를 가치 진술로 치환 ("Built around real Jeju pacing", "All admissions included", "Licensed local operator" 등)

1.2. **`hero.meta.ratingStars: 5` → `0`** — rating=0인 모든 투어
- jeju-eastern, jeju-southern, busan-outskirts, pocheon-sanjeong, seoul-seoraksan-nami-island (확인 후 ratingStars=0)

1.3. **가이드 실명 + 타사명 제거**
- jeju-southern `whyTourWorks.routeLogicSections[].items[].detail`: "Steven, Chloe, Jina, Hays" → "your licensed Korean guide"
- jeju-west-south `whyTourWorks…`: "Steven, Chloe, Sunny" 제거; **"Love Korea Tours"** 전면 제거.

1.4. **작성자 메모 stubs 제거**
- jeju-west-south `catalog_card.shortCardDescription`: "similar local route as the Southern UNESCO tour but with a more lifestyle-oriented framing" → 정상 카피로 교체
- from-busan-gyeongju `catalog_card.shortCardDescription`: "Same classic six-attraction route as the UNESCO Legacy version" → 자체 카피
- busan-outskirts `routeFlowStops[0].theme`: "Seoul-style pickup" → "Busan pickup"
- jeju-eastern + jeju-hydrangea-east `staticQuestions[].answer` 시작 "similar local route" stub → 정상 답변

1.5. **개화-보장 환불 정합화** — KEEP cruise return guarantee
- busan-spring-cherry-blossom, busan-plum, jeju-hydrangea-east, jeju-hydrangea-southwest 의 "no fees, no questions" 류 → "if peak bloom is materially missed (operator assessment + 3-day notice), free reschedule to any future season or 90% refund. Standard cancellation policy otherwise."
- **크루즈 return guarantee**(busan-cruise-bus, busan-small-group, busan-private-charter, incheon-private, from-incheon, jeju-cruise-bus, jeju-cruise-small-group) — 약화 금지. 명시적으로 강조:
  - "Sail-away on time is the product. We build a 60-90 min buffer; 4 seasons of cruise tours, never missed."
  - 약하면 매출 손해(user 직접 지시).

**Locale 평행**: ko/ja/zh/zh-TW/es 각 파일에 위 패턴의 번역본 동일 적용.

**Ship**: Phase 1 commit → PR → merge → push.

---

### Phase 2 — 크루즈 픽업 항구화

**원칙**: cruise 투어는 ship 에서 내리는 승객용. pickup_dropoff = cruise terminal. 호텔/공항/면세점 항목 **삭제**.

| Tour | departure 정정 | return 정정 |
|---|---|---|
| jeju-cruise-shore-excursion-bus-tour | Jeju Cruise Terminal (제주항, 33.5286,126.5868) / Gangjeong Cruise Terminal (강정항, 33.2247,126.5512) — 도착지 ship 의 도크에 맞춰 단일 선택 | 동일 cruise terminal 으로 반환 |
| jeju-cruise-shore-excursion-small-group-tour | 동일 | 동일 |
| busan-cruise-shore-excursion-bus-tour | Busan International Cruise Terminal (영도 동삼동, 35.0747,129.0884) — 대형선; Busan Port International Passenger Terminal (초량, 35.1149,129.0455) — 중·소형 | 동일 |
| busan-small-group-sightseeing-tour-cruise-passengers | 양 터미널 모두 명시 (이전엔 초량만) | 동일 |
| busan-private-car-charter-cruise-shore | 양 터미널 모두 명시 + 게이트 디테일 | 동일 |
| from-incheon-seoul-day-tour-cruise-guests | Incheon Cruise Terminal (송도, 37.3833,126.6358) — Yeongjong 언급 제거 (Yeongjong = 공항 섬, cruise 아님) | 동일 |
| incheon-seoul-private-car-shore-excursion-cruise | 동일 | 동일 |

**FAQ 동시 정정**: `staticQuestions[pickup].answer` 의 "From your hotel lobby" 패턴 → "At your cruise terminal arrival hall — we meet you at the gangway side."

**return time 정합**: `pickup_dropoff.notes` 의 return 시간을 itineraryStops 의 실제 도착 시간과 일치시킴.

**좌표**: Phase 0 의 pickup/dropoff 정합성 트랙(`docs/pickup-dropoff-weather-data-correctness-plan-2026-05-23.md` §0/§3) 과 합치. 본 phase 는 *타입* 정정, 좌표 정밀도는 정합 트랙에 포함.

---

### Phase 3 — busan-small-group + busan-private-charter 스톱 회전 재매핑

**busan-small-group-sightseeing-tour-cruise-passengers**: itineraryStops 의 각 attraction stop 에 대해 highlights/timeUsed/smartNotes/visitBasics/images/_poi_meta 를 올바른 명소로 교체:

| Stop name | 현재 poi_key (틀림) | 올바른 poi_key | 콘텐츠 출처 |
|---|---|---|---|
| Haedong Yonggungsa Temple | un_memorial_cemetery | haedong_yonggungsa | busan-cruise-bus 의 동명 스톱 |
| UN Memorial Cemetery in Korea | un_memorial_cemetery (이름은 맞음, images 는 taejongdae) | un_memorial_cemetery | busan-cruise-bus 의 동명 스톱(images만 교체) |
| Jagalchi, BIFF Square & Gukje Market | gamcheon_culture_village | jagalchi_market | busan-cruise-bus 의 Jagalchi 스톱 |
| Gamcheon Culture Village | yongdusan_park | gamcheon_culture_village | busan-cruise-bus 의 Gamcheon 스톱 |
| Songdo Beach or Yongdusan Park | jagalchi_market | songdo_beach + yongdusan_park (option flag) | busan-cruise-bus 의 Songdo/Yongdusan 스톱 |

**+ "Lunch included" 모순 제거** — `itineraryStops[0].highlights` 의 "Lunch included at local Busan restaurant" → "Lunch break at a guide-recommended Busan restaurant (own expense, ₩10–15k)" (lunch 스톱 텍스트와 일치).

**busan-private-car-charter-cruise-shore**: 
- Stop 2 (Route planning) — 현재 UN cemetery 콘텐츠 → 실제 route-planning 콘텐츠로 교체 (간단한 운영 설명만)
- Stop 5 (Return to Busan Cruise Terminal) — 현재 Gamcheon 콘텐츠 → 실제 return 운영 콘텐츠로 교체

---

### Phase 4 — UNESCO 사실 정정

4.1. Seoraksan "only" → "first" (2 tours, 5+ instances each).
4.2. Tongildaebul "world's largest" → "Korea's largest" (2 tours, 3 instances each).
4.3. Sinheungsa "world's oldest Seon temple" / "head temple of Jogye Order" 제거 → "one of Korea's oldest active Buddhist temples (founded 652 CE Silla); a branch temple of the Jogye Order under Woljeongsa head district."
4.4. Seongeup 갤러리 location + routeFlowStops 의 "(UNESCO)" 라벨 → "(Korean National Folklore Cultural Heritage)" (jeju-eastern, jeju-hydrangea-east).
4.5. Micheon Cave "same lava-tube system as Manjanggul / UNESCO alternate" → "a separate commercial show cave with similar volcanic geology (visited when Manjanggul is closed; not part of the UNESCO inscription)" (jeju-eastern, jeju-hydrangea-east).
4.6. Seongsan/Hallasan "triple-UNESCO site" → site-specific accurate phrasing (jeju-island-charter, jeju-southern, jeju-cherry).

---

### Phase 5 — 수치 정정 (verify-then-fix)

| 항목 | 출처 | 적용 투어 |
|---|---|---|
| 보문호 벚꽃 ≈2,800 (9,000 제거) | Visit Gyeongju | busan-spring-cherry, busan-plum |
| 카멜리아힐 어른 ₩12,000 (₩10,000 인스턴스 수정) | user-confirmed | jeju-winter, jeju-southwest-hydrangea, jeju-southern |
| 해녀 시연 시간 → 검증 후 단일화 | KTO Seongsan | 모든 Seongsan 투어 (~7) |
| Nami 입장 ₩19,000 (성인) 통일 | Naminara official | seoul-private-nami, seoul-seoraksan-nami, seoul-suburbs-charter |
| Morning Calm 20 themed gardens (22/26 제거) | 가든 official | seoul-private-nami |
| Bukchon hanok ~900 (600 일관성) | Seoul Tourism | from-incheon-seoul, incheon-seoul-private |
| Herb Island Wed 휴무 vs year-round 통일 | KTO | pocheon-sanjeong |
| Sanjeong Lake 4km/75min 통일 | AllTrails | pocheon-sanjeong |
| Waujeongsa: founder, Buddha material, bell weight, mountain → 단일화 | 절 공식 | seoul-suwon-waujeongsa |
| Ahopsan 어른 ₩5,000 (₩8,000 수정) | KTO | from-busan-gyeongju |
| Hallim Park cave "25 million years" → 정확 (수만 년 단위) | 지질 | jeju-hydrangea-southwest |
| Hwaseong "only walled fortress" → "only walled fortress city built with original Uigwe construction record" | UNESCO inscription text | seoul-suwon × 3 |
| "Jewel in the Palace 50M viewers" → "peak ratings ~57% (one of Korea's highest)" | KBS | seoul-suwon-folk-village |
| 잘못된 스케줄 (15분 갭에 50분 드라이브, 12:30 점심 vs 13:00 설악산) | 단순 시간 산수 | jeju-cherry, seoul-seoraksan-nami |

---

### Phase 6 — 갤러리 재매핑

각 투어의 galleryItems 를 1:1 점검:
- src 가 attraction X 의 폴더면 location/caption 도 X
- non-English location string ("Templo Waujeongsa", "태종대 해안 절벽") → EN
- alt 의 "?" (인코딩 깨짐) → "—"

---

### Phase 7 — 잡정리

- DMZ "220m" → "150m" (hero/seo/catalog/gallery; body 는 이미 맞음)
- DMZ refund: "no passport, no refund" vs "standard policy" → 일관 (standard cancellation policy 적용; passport 의무는 별도 명시)
- pocheon-sanjeong: cancellation 정책 신규 추가 (다른 Seoul day-tour 와 동일 24h 정책)
- 스테일 데이트: Silla Gold Crowns (Dec 2025) 제거, Fubao 현황 정정/제거, "recently" → "since 2024" 등
- 빈 가격 (busan-spring/plum): 시즌 가격 채움 또는 "Seasonal price — confirm at booking" 명시
- jeju-cruise inclusions list 에 "Lunch (pay direct)" 제거 + 별도 NOT INCLUDED 섹션
- 오타/중복어/markdown 깨짐/em-dash 인코딩

---

### Phase 8 — Ship per phase

각 phase 종료 시:
1. `node -e "require('./components/product-tour-static/<slug>/<slug>.<locale>.json')"` 또는 jq 로 JSON 유효성 검증
2. `npm run build`(or lint/typecheck) green
3. `git add` 변경 파일만 + commit message에 phase + 영향 투어
4. PR open → merge to main → push
5. 본 문서 §1 상태 컬럼 업데이트

---

## 3. 위험 / 관찰

- **다른 세션과의 충돌**: 본 worktree 격리. 단, locale-content 파일은 다른 트랙(itinerary-builder 등)이 동시에 만질 수도 있음 → 매 phase commit 전 `git pull --rebase origin main`.
- **번역 정확도**: ko/ja/zh-TW/zh/es 평행 적용은 내가 번역. 의역보다 정확성 우선. 특정 고유명사(제주항, 강정항, 부산크루즈항)는 각 locale 의 공식 표기 사용.
- **이미지 검증 미흡 위험**: Phase 6 (galleryItems 재매핑) 는 src 파일명을 보고 매핑 추정 — 실제 사진 내용을 보지 않으므로 src 파일명이 거짓말이면 재매핑도 틀림. 의심 케이스는 location/caption 을 일반화 ("Camellia Hill — gallery image 3" 등) 로 안전 처리.
- **Phase 3 의 복잡도**: 부산 스톱 회전은 다른 부산 투어(busan-cruise-bus)에서 콘텐츠 복사 — busan-cruise-bus 자체가 신뢰할 만한지 sanity-check 후 복사.

---

## 4. 변경 로그 (commits)

| Phase | Commit | PR | Merged into main |
|---|---|---|---|
| 0 plan | `ca578b7c` (in PR #10) | #10 | ✅ 2026-05-23 |
| 1a EN | `ca578b7c` | [#10](https://github.com/simsangsong/atockorea/pull/10) | ✅ `0fe21c98` |
| 2a EN | `2ac8c80f` | [#11](https://github.com/simsangsong/atockorea/pull/11) | ✅ `28d68626` |
| 4a EN | `09de681b` | [#12](https://github.com/simsangsong/atockorea/pull/12) | ✅ `98a34706` |
| 5a EN | `b8e8afa9` | [#13](https://github.com/simsangsong/atockorea/pull/13) | ✅ `117b8f26` |
| 3 EN | — | — | ⏳ next |
| 5b EN | — | — | ⏳ |
| 6 EN | — | — | ⏳ |
| 7 EN | — | — | ⏳ |
| 1b–f / 2b–f / 4b–f / 5 locales | — | — | ⏳ |
