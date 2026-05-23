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

## 1. Phase 개요 (revised 2026-05-23 — Phase A/B/C/D/Z 추가 후)

| Phase | 내용 | 위험 | 작업량(대략) | 상태 |
|---|---|---|---|---|
| 0 | 플랜 + 브랜치 셋업 (본 문서) | 없음 | — | ✅ done |
| 1a EN | 가짜 후기 + 위험 카피 + 작성자 메모 제거 | 낮음 | 16 files / ~50 edits | ✅ PR #10 (`0fe21c98`) |
| 2a EN | 크루즈 픽업 → 항구로 재구성 | 중 | 7 tours / ~30 edits | ✅ PR #11 (`28d68626`) |
| 4a EN | UNESCO 사실 정정 | 낮음-중 | 10 tours / 93 edits | ✅ PR #12 (`98a34706`) |
| 5a EN | 수치 정정 (high-confidence) | 낮음 | 6 tours / 24 edits | ✅ PR #13 (`117b8f26`) |
| A (NEW, P0) | catalog/page vs offer/checkout 가격 불일치 ($59↔$69 9개 투어) | 높음 — 결제 사기 리스크 | DB-only (tours + tour_product_offers) | ✅ DB written 2026-05-23 |
| B (NEW, P0) | 시즌 종료 투어 $0 노출 + 시즌 가용성 게이팅 | 중-높음 | 2 tours + API/recommend filter | ✅ code shipped 2026-05-23 |
| C (NEW, P0) | `vehicle` price type 코드 버그 (per-guest로 곱해짐) | 중 — 결제 차단 (실제는 fraud 보다 checkout-blocked) | checkout context + 부킹카드 + cart UI | ✅ code shipped 2026-05-23 |
| D (NEW, P1) | Jeju 크루즈 `itinerary_variants` → `routeVariants` 스키마 마이그레이션 | 중 — 포트 변형 itinerary 미렌더 | backward adapter (no JSON rewrite) | ✅ code shipped 2026-05-23 |
| **3 EN** | **부산 스톱 회전 재매핑** | **중-높음** | **2 tours × 5 stops × 6 fields** | **⏳ NEXT** |
| 5b EN | 수치 정정 (verify 필요 항목) | 중 | ~10 항목 × tours | ⏳ |
| 6 EN | 갤러리 사진-지명 재매핑 | 중 | ~9 tours × galleryItems | ⏳ |
| 7 EN | DMZ 다리 150m + 타이포(A easy/the our/? photo) + DMZ refund tone + 잡정리 | 낮음 | ~30 edits | ⏳ |
| **Z (NEW)** | **Verification harness — 33 EN URL fetch + grep 검증 + JSON-LD 일치** | **낮음** | **post-ship smoke test** | **⏳** |
| 1b–f / 2b–f / 4b–f / 5 locales | ko/ja/zh/zh-TW/es 동기화 (모든 EN phase 종료 후) | 낮음-중 | ~200 files | ⏳ |
| 8 | per-phase commit + PR + merge + push | 낮음 | per phase | 🔄 ongoing (4 PRs shipped) |

**총량**: 수정 약 **1,300+ JSON 편집 across ~200 files**. 한 세션에 다 끝낼 수 없음 → phase 단위로 ship.

---

## 2. Phase별 상세 (Source-of-truth: 매 phase 시작 시 본 문서 §2 X.x 와 audit 문서 §2-5 를 함께 확인)

### 2bis. Parallel-session plan cross-reference (2026-05-23)

A parallel session produced [`docs/tour-product-en-content-fix-plan-2026-05-23.md`](./tour-product-en-content-fix-plan-2026-05-23.md) (note different filename from this plan — both files now sit in this worktree). It frames the same audit through a **booking-integrity-first** lens and surfaced 4 high-severity items I had missed.

**Adopted into the phase table above (as Phase A / B / C / D / Z):**

| Other plan item | My response | New phase |
|---|---|---|
| Catalog/page vs offer/checkout price mismatch ($59 vs $69 in 8 Jeju tours + $79/$69 in jeju-grand) | **Adopt — P0**. Customer-pricing-fraud risk. Decide canonical per tour, align `public.tours.price`+`tour_product_offers.amount_minor`+`tour_product_pages.price_amount_label`+JSON `price.amountLabel`/`catalog_card.priceLabel`. | **Phase A** |
| Empty `price.amountLabel`/`catalog_card.priceLabel` on busan-plum, busan-spring → recommendations render `$0`; seasonal window passed | **Adopt — P0**. Decide closed-until-next-season vs. set real price. Filter `$0` in `TourRecommendationsSection.tsx` + `staticTourCatalogCards.ts` + JSON-LD. Add seasonal gate to `app/api/tours/[id]/availability/route.ts`. | **Phase B** |
| `vehicle` price type silently converted to `person` → vehicle-priced private charters multiply by guest count | **Adopt — P0 code fix**. Touch `lib/tour-product/eastSignatureCheckoutContext.ts`, `TourDesktopBookingCard.tsx`, `TourStickyBookingBar.tsx`, `app/api/bookings/route.ts`, `app/checkout/page.tsx`, `app/cart/page.tsx`, type files. Affected: jeju-island-private-car-charter, seoul-suburbs-private-chartered-car-10hr, busan-private-car-charter-cruise-shore, seoul-dmz-private, seoul-private-nami-morning-calm-petite-france (per-vehicle in DB). | **Phase C** |
| Jeju cruise `itinerary_variants` populated but renderer expects `routeVariants` → port-variant itineraries may not render at all | **Adopt — P1**. Phase 2 (shipped) only fixed `pickup_dropoff`. Need to either migrate JSON to `routeVariants` or add backwards-compatible mapping in `buildTourProductViewModelFromJson.ts`/`loadTourProductPage.ts`. | **Phase D** |
| Typos & polish: "A easy" (east-signature), "the our … tour tour" (jeju-cherry FAQ), "? photo" mojibake (southwest, jeju-hydrangea-southwest) | Adopt — fold into Phase 7 | Phase 7 |
| DMZ "No passport, no DMZ entry, no refund" tone | Adopt — fold into Phase 7. **Substance preserved** (military access is real), only tone softened. | Phase 7 |
| End-to-end verification harness — fetch all 33 EN URLs, grep HTML for `$0`/known-bad strings/`Ocean Suites`/cruise residuals/`Steven`/etc., confirm Jeju cruise renders both port variants, JSON-LD = booking card | **Adopt — Phase Z final smoke test** | **Phase Z** |

**Rejected (divergent decision):**

| Other plan item | Reason rejected |
|---|---|
| Soften cruise "return guaranteed" / "never missed a sail-away" language | **User directive #4 explicitly says keep cruise return guarantee STRONG.** "이게 애매해지면 불안함 때문에 크루즈 손님들이 안 사" — softening costs sales. Kept and strengthened in Phase 2a. |

**Reference docs in this worktree:**
- [`docs/tour-product-en-content-audit-2026-05-23.md`](./tour-product-en-content-audit-2026-05-23.md) — original audit (input to this plan)
- [`docs/tour-product-en-content-fix-plan-2026-05-23.md`](./tour-product-en-content-fix-plan-2026-05-23.md) — parallel-session plan (cross-referenced here)
- [`docs/pickup-dropoff-weather-data-correctness-plan-2026-05-23.md`](./pickup-dropoff-weather-data-correctness-plan-2026-05-23.md) — PR #9 merged; this track's Phase 2 supersedes its Phase 3/4 for the Jeju cruise "hotel vs port" category error.

---

### Phase A 상세 — Catalog/page ↔ DB/offer 가격 정합 (✅ DB applied 2026-05-23)

**문제**: 9개 Jeju 투어의 카탈로그/페이지 JSON 은 새 세일 가격($59/$79)으로 마이그레이션됐는데 `public.tours.price` 와 `public.tour_product_offers.amount_minor` 는 구버전($69)에 멈춰 있음. 고객이 $59 보고 클릭 → 체크아웃에서 $69 청구 = 결제 사기 리스크.

**진실 테이블 (수정 전):**

| Slug | JSON `catalog_card.priceLabel` (EN) | JSON `price.amountLabel` | DB `tours.price` / `original_price` | Offer `amount_minor` |
|---|---|---|---|---|
| east-signature-nature-core | "From US$59 per person (was $69, 14% off)" | 59 | 69.00 / 79.00 | 6900 |
| jeju-cherry-blossom-tour-east-route | "From US$59 (was $69, 14% off)" | 59 | 69.00 / 79.00 | 6900 |
| jeju-eastern-unesco-spots-day-tour | "From US$59 (was $69, 14% off)" | 59 | 69.00 / 79.00 | 6900 |
| jeju-grand-highlights-loop | "From US$79 (was $89, 11% off)" | 79 | 69.00 / 79.00 | 6900 |
| jeju-hydrangea-festival-tour-east-route | "From US$59 (was $69, 14% off)" | 59 | 69.00 / 79.00 | 6900 |
| jeju-hydrangea-festival-tour-southwest-route | "From US$59 (was $69, 14% off)" | 59 | 69.00 / 79.00 | 6900 |
| jeju-southern-top-unesco-spots-tour | "From US$59 (was $69, 14% off)" | 59 | 69.00 / 79.00 | 6900 |
| jeju-west-south-full-day-authentic-tour | "From US$59 (was $69, 14% off)" | 59 | 69.00 / 79.00 | 6900 |
| southwest-hallasan-osulloc-aewol | "From US$59 (was $69, 14% off)" | 59 | 69.00 / 79.00 | 6900 |

**Canonical 결정**: 카탈로그/페이지 = canonical (고객 약속). DB·offer 를 JSON 에 맞춤.

**적용 (DB writes only — JSON·코드 변경 없음):**

```sql
UPDATE tours SET price = 59.00, original_price = 69.00
WHERE slug IN ('east-signature-nature-core', 'jeju-cherry-blossom-tour-east-route',
  'jeju-eastern-unesco-spots-day-tour', 'jeju-hydrangea-festival-tour-east-route',
  'jeju-hydrangea-festival-tour-southwest-route', 'jeju-southern-top-unesco-spots-tour',
  'jeju-west-south-full-day-authentic-tour', 'southwest-hallasan-osulloc-aewol');

UPDATE tours SET price = 79.00, original_price = 89.00
WHERE slug = 'jeju-grand-highlights-loop';

UPDATE tour_product_offers SET amount_minor = 5900 WHERE is_default = true
AND tour_product_page_id IN (SELECT id FROM tour_product_pages WHERE slug IN (8개));

UPDATE tour_product_offers SET amount_minor = 7900 WHERE is_default = true
AND tour_product_page_id IN (SELECT id FROM tour_product_pages WHERE slug = 'jeju-grand-highlights-loop');
```

**사후 검증**: `tours.price * 100 = offer.amount_minor` 모든 9건 OK.

**범위 제외** (의도적):
- `tour_product_pages.price_amount_label` / `detail_payload.price` / `detail_payload.catalog_card.priceLabel` — 이미 정합 (EN row "59"/"79"; 비-EN locale row 는 빈 라벨로 catalog_card.priceLabel 의 번역본을 사용 — 현 트랙 EN-first 정책과 일치).
- 기존 booking 의 `bookings.total_price` 등 스냅샷 — 결제 완료 시점 금액 보존이 정상 동작.
- JSON 파일 — 이미 canonical. 편집 불요.
- JSON-LD — `vm.price.amountLabel` 에서 가져오므로 자동 정합.

**남은 작업**: Phase B 시작 — busan-plum / busan-spring 의 빈 가격 + `$0` 추천카드 + 시즌 가용성 게이팅.

---

### Phase B 상세 — 시즌 종료 투어 `$0` 노출 + 시즌 가용성 게이팅 (✅ code shipped 2026-05-23)

**문제 (P0):**
- `busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju` (운영: 02-25 – 04-10) 및 `busan-spring-cherry-blossom-gyeongju-highlights-day-tour` (운영: 03-28 – 04-10) 가 DB·offer·JSON 모두 빈 가격 (`tours.price=0`, `amount_minor=0`, `price.amountLabel=""`).
- 추천 카드 (`TourRecommendationsSection`) 에서 `$0` 으로 렌더 — 신뢰 손상.
- `availability API` 가 시즌 윈도우 무방어 → 시즌 외 날짜 예약 가능 (`available_spots=999` 디폴트).

**Canonical 결정 (made 2026-05-23):**
2027 시즌 가격이 미결정 → 임의 가격 설정 거부. 대신 **노출/예약 차단 인프라**만 적용. 가격 결정 시 후속 phase 에서 데이터 채움.

**적용:**

1. **`lib/tour-seasonal-windows.ts` (신규)** — 슬러그 → MM-DD 윈도우 레지스트리 + `getSeasonalOperatingWindow` + `isDateOutsideSeasonalWindow`. 연도 무관 매년 자동 반복.
   - busan-plum: `02-25 – 04-10`
   - busan-spring: `03-28 – 04-10`

2. **`app/api/tours/[id]/availability/route.ts`** — Jeju East Monday 룰 직후, 시즌 윈도우 외 날짜 → `available:false, reason:"This is a season-locked tour..."` 반환. POST 도 GET 결과 의존이므로 자동 차단.

3. **`app/tour-product/[slug]/page.tsx`** — `otherTours.filter(p => p.slug !== slug && p.listPriceUsd > 0)` 추가. 가격 0 인 카드는 추천에서 자동 제외. 홈페이지 featured grid (`featured-products-showcase.tsx`) 가 이미 같은 패턴 사용 — 일관성 확보.

4. **`__tests__/lib/tour-seasonal-windows.test.ts` (신규)** — 8 케이스: 인사이드/아웃사이드/경계일/null slug/malformed date.

**범위 제외 (의도적):**
- DB price write — 2027 시즌 가격 결정 시 별도 phase.
- JSON-LD — 이미 `safePrice()` 에서 amountLabel 비면 Offer 미생성 (방어 완료).
- `staticTourCatalogCards.ts` `SLUG_OVERRIDES` 항목 추가 — 가격 결정 후.
- `homepage featured grid` — 이미 `listPriceUsd <= 0` 필터링 보유.
- 페이지 자체 (`/tour-product/busan-plum-...`) 렌더 — 빈 가격으로 노출 (다음 시즌 마케팅 카피는 별도 phase).

**검증:**
- `jest __tests__/lib/tour-seasonal-windows.test.ts` → 8/8 pass.
- `tsc --noEmit` → 0 errors.

---

### Phase C 상세 — `vehicle` price type 결제 차단 해제 (✅ code shipped 2026-05-23)

**진단:**
- DB 5개 투어가 `price_type='vehicle'`: busan-private-car-charter-cruise-shore ($359), incheon-seoul-private-car-shore-excursion-cruise ($419), jeju-island-private-car-charter-tour ($249), seoul-dmz-private-3rd-tunnel-suspension-bridge ($419), seoul-suburbs-private-chartered-car-10hr ($179).
- `lib/tour-product/eastSignatureCheckoutContext.ts` line 36 (구버전) 가 `data.price_type === "group" ? "group" : "person"` 으로 vehicle 을 person 으로 무음 변환.
- 클라이언트가 변환된 person 가정으로 `unitPrice × guests` 계산 → 잘못된 total 표시 + 결제 payload 전송.
- 서버 `/api/bookings` 는 DB 의 vehicle 값으로 fixed price 계산 → 클라이언트와 서버 불일치 → `PRICE_MISMATCH` 거부.
- **실제 영향**: 결제 사기 아님 (서버가 거부) → vehicle 5개 투어 **체크아웃 자체가 차단**됨.
- 서버 사이드 카트/체크아웃/예약 계산은 이미 안전 패턴 (`price_type === 'person' ? *guests : fixed`). 클라이언트 단의 type union 좁힘이 유일한 진짜 버그.

**적용:**

1. **`lib/tour-product/eastSignatureCheckoutContext.ts`** — `TourProductCheckoutContext.priceType` union 을 `"person" | "group" | "vehicle"` 로 확장. 변환 로직 `rawPriceType === "group" || rawPriceType === "vehicle" ? rawPriceType : "person"` 로 보존.

2. **`TourDesktopBookingCard.tsx` + `TourStickyBookingBar.tsx`** — `perUnitLabel` 분기에 vehicle 추가 (`"/ vehicle"` 표시). 기존 estimatedTotal 로직 (`priceType === 'person' ? *guests : fixed`) 은 vehicle 케이스에서 자동으로 fixed 처리.

3. **`app/cart/page.tsx`** — `CartItem.priceType` union 확장 + UI 보강. `subtotal`, `itemSubtotal`, `itemDiscount` 가 `item.price * item.quantity` 로 무조건 곱했던 pre-existing 버그 같이 수정 (`lineItemTotal` / `lineItemDiscount` 헬퍼). vehicle + group 둘 다 정확한 fixed 표시. 디스플레이 `/ ${item.priceType}` 는 이미 동적 → 자동으로 "/ vehicle" 표시.

4. **`__tests__/lib/tour-product/eastSignatureCheckoutContext.test.ts` (신규)** — `buildBookingPayload` 6 케이스: person 곱셈 / group 고정 / **vehicle multi-guest 고정 (regression scenario)** / vehicle max-guests / 소수점 라운딩 / ISO 타임스탬프.

**범위 제외 (의도적):**
- 다른 표면의 type union `'person' | 'group'` 잔존 (TourCard, TourList, SeasonalTours, DetailedTourCard, data/tours, src/types/tours, types/tour, mobile/types/tour, lib/db-relations, lib/supabase, lib/admin/tour-write-rules, app/admin/products) — 모두 결제 경로 밖이므로 별도 phase 로 미룸. 표시 라벨이 vehicle 일 때 "/ group" 으로 떨어지는 부분도 동일 보류.
- DB enum 변경 / `lib/supabase.ts` regen — schema 도 변경하면 admin/관리자 도구 영향 → 별도 phase.
- 서버 사이드 `app/api/bookings/route.ts`, `app/checkout/page.tsx`, `app/api/cart/route.ts` — 이미 안전 패턴 보유, 변경 불요.

**검증:**
- `jest __tests__/lib/tour-product/eastSignatureCheckoutContext.test.ts` → 6/6 pass.
- `jest __tests__/lib/tour-seasonal-windows.test.ts` → 8/8 pass (회귀 없음).
- `tsc --noEmit` → 0 errors.

---

### Phase D 상세 — Jeju 크루즈 port 변형 itinerary 렌더 (✅ code shipped 2026-05-23)

**진단:**
- 두 Jeju 크루즈 투어 (`jeju-cruise-shore-excursion-bus-tour`, `jeju-cruise-shore-excursion-small-group-tour`) 가 `itinerary_variants` 키에 채워진 port 변형 데이터 (Jeju Port + Gangjeong Port, 각각 6~7 스톱) 를 보유.
- 렌더러 (`PortSelectorTimeline.tsx`) 는 `routeVariants` 키만 읽음. `TOUR_PRODUCT_VIEW_MODEL_KEYS` 도 `routeVariants` 만 화이트리스트.
- 두 파이프라인 (`buildTourProductViewModelFromFullPageJson` 정적 JSON 경로 + `loadTourProductPage` Supabase 경로) 모두 `routeVariants` 만 매핑 → **port 변형 itinerary 가 한 번도 렌더되지 못함**.
- 다른 33개 투어 (그 외) 의 `itinerary_variants` 는 모두 빈 배열 → 두 크루즈만 영향.

**Canonical 결정**: backward adapter (JSON rewrite 거부).
- 이유 1: `itinerary_variants` 의 풍부한 snake_case shape (port_id, port_label, route_focus, pickup_base, duration_band, return_time_band, poi/theme/scenic tags, level scores) 는 매칭 프로파일이 향후 활용할 수 있는 데이터. JSON 재작성은 데이터 손실 위험.
- 이유 2: 12개 파일 (2 tours × 6 locales) 의 대규모 변형 vs. 30줄짜리 어댑터 = 위험 차이 큼.
- 이유 3: 두 파이프라인 모두 adapter 한 번 호출로 즉시 정렬됨 — 6개 로케일 동시 fix.

**적용:**

1. **`lib/tour-product/portRouteVariantsAdapter.ts` (신규)** — `mapItineraryVariantsToRouteVariants(raw)` 헬퍼. 입력 미존재/빈 배열/파싱 불가 → `null`. 유효 입력 → `PortRouteVariant[]`. 누락 필드 가드 (port_id 필수, stops[].name 필수, number 자동 fallback, visitBasics 빈 내부 → undefined).

2. **`components/product-tour-static/_shared/route-variants/routeVariantTypes.ts`** — `PortVariantStop.visitBasics` 를 optional 로 완화 + 내부 4 필드 모두 optional. `time?`, `whyOnRoute?` 추가 (소스에 있는데 타입에 없던 두 필드). `TourStopDrawerStop` (superset) 이미 모두 optional → 어셈블 안전.

3. **`buildTourProductViewModelFromJson.ts`** — VIEW_MODEL_KEYS 루프 후, `base.routeVariants` 비어있고 `doc.itinerary_variants` 채워져 있으면 adapter 호출하여 back-fill.

4. **`loadTourProductPage.ts`** — DB payload 도 같은 패턴 (`payload.routeVariants` 우선, 없으면 `payload.itinerary_variants` 어댑팅).

5. **`__tests__/lib/tour-product/portRouteVariantsAdapter.test.ts` (신규)** — 10 케이스:
   - mapItineraryVariantsToRouteVariants: null 입력 / 빈 stops / 최소 변형 매핑 / number fallback / port_id 누락 스킵 / visitBasics 빈 inner drop / visitBasics 부분 inner 보존
   - 통합: bus-tour 번들 → routeVariants 2개 (jeju_port + gangjeong_port) / small-group 번들 / non-cruise 투어는 변동 없음

**범위 제외 (의도적):**
- JSON 재작성 — Phase 후속 (필요시) 또는 영구 미실행 (adapter 충분).
- `itinerary_variants` 의 나머지 풍부한 메타 (poi_tags, theme_tags, scenic_level 등) 활용 — 매칭 프로파일 트랙에서 진행.
- `_poi_meta`/`images` 를 `PortVariantStop` 에 추가 — 향후 풍부한 드로어 시 별도 phase.

**검증:**
- `jest __tests__/lib/tour-product/portRouteVariantsAdapter.test.ts` → 10/10 pass.
- 전체 회귀 (`tour-seasonal-windows` + `eastSignatureCheckoutContext` + `portRouteVariantsAdapter`) → 24/24 pass.
- `tsc --noEmit` → 0 errors.

---

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
| A (DB price reconcile) | `6ea957a3` | [#15](https://github.com/simsangsong/atockorea/pull/15) | ✅ `76b27417` |
| B (seasonal $0 + window gate) | `3dfd19cb` | [#16](https://github.com/simsangsong/atockorea/pull/16) | ✅ `cf5eb7b2` |
| C (vehicle price type unblock) | `583f0bf4` | [#17](https://github.com/simsangsong/atockorea/pull/17) | ✅ `b8332b45` |
| D (port routeVariants adapter) | (pending) | (pending) | code change; see Phase D detail below |
| 3 EN | — | — | ⏳ |
| 5b EN | — | — | ⏳ |
| 6 EN | — | — | ⏳ |
| 7 EN | — | — | ⏳ |
| 1b–f / 2b–f / 4b–f / 5 locales | — | — | ⏳ |
