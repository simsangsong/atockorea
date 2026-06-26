# AtoC Korea 사이트 로딩 성능 — 통합 실행 마스터 플랜
작성일: 2026-06-25
선행 문서: `docs/atockorea-site-performance-root-cause-analysis-2026-06-24.md` (Codex 1차 정적 분석)
이 문서의 위치: 1차 분석을 **검증 + 보강**하고, 1차 분석이 놓친 사이트 전반의 로딩 저하 요인을 코드/DB 레벨로 새로 발굴해 **우선순위가 매겨진 단일 실행 플랜**으로 합친 것.

방법: App Router 코드베이스를 5개 차원(번들/JS · 렌더링전략/워터폴 · 이미지/폰트/서드파티 · 클라이언트 런타임 · API/DB 쿼리)으로 병렬 정적 감사 + Supabase performance advisor 직접 조회(282건). 실제 Web Vitals/APM 수치는 아직 없음 — 그래서 **§0 계측이 모든 코드 수술보다 먼저다.**

---

## 0. 대전제 — 측정 없이 12개 트랙을 동시에 고치지 않는다

- 1차 문서도 이번 감사도 **측정 0**이다. "어드민이 사이트 전반에 영향", "모바일 체감 악화"는 *구조적 가능성*이지 *관측된 사실*이 아니다.
- 따라서 실행 순서의 0번은 **계측 + 회귀 베이스라인**이다. 이게 깔려야 "고쳤다"를 증명하고 회귀를 잡는다.
- 그다음은 **리스크 0(되돌리기 쉬운 env/설정) → 저위험 고효율 코드 → 측정 후 큰 수술** 순서.

### G0. 베이스라인 게이트 (모든 P0보다 먼저)
- [ ] 홈 `/`, `/[locale]`, `/tours/list?destination=jeju`, `/tour-product/[slug]`, `/itinerary-builder` 5개 경로에 대해 Lighthouse + Playwright 트레이스로 LCP/INP/CLS/TBT, 초기 JS, 초기 HTML payload 기록.
- [ ] 챗봇 1턴, AI추천 1콜의 `request→first token→done` 분해 로깅(§D-T 계측 포함).
- [ ] 이 수치들이 각 수정의 "완료 조건" 비교 기준. 수정 PR마다 동일 경로 재측정.

---

## 1. 1차 문서가 이미 잡은 것 (요약 — 상세는 선행 문서)

| ID | 항목 | 본 플랜에서의 처리 |
|----|------|------|
| K1 | 카드 미디어 `initialMediaBySlug` 있는데 클라가 `no-store` 재요청 | P0 유지 (저위험: 재요청 스킵만 / 캐시 의미변경은 분리) |
| K2 | `/api/tours` limit=500 overfetch + booking count JS 집계 | P1 (서버 페이지네이션) |
| K3 | 빌더 POI payload 과다(제주 ~330KB~1.3MB) | P1 (list/detail 분리) |
| K4 | admin stats/orders/tours `select('*')` 대량 | E1로 흡수 + 확장 |
| K5 | 캐시 정책 불일치(이미지 TTL vs API no-store, 상세 force-dynamic) | B4로 흡수 + 확장 |
| K6 | 정적/DB 이중 소스 | **성능 트랙에서 제외** — 정확성/유지보수 이슈, 별도 트랙 |
| K7 | 챗봇 지연(스트리밍 off·RAG·큰 프롬프트·직렬·메모리) | §C 유지 |
| K8 | 빌더 cart=URL navigation, AI추천 Haiku timeout 없음 | §C 유지 |

**검증 완료(코드 대조):** K7의 `CHAT_STREAMING==="1"` 게이트(기본 OFF, ships-dark) — [route.ts:1104](app/api/tour-product/assistant/route.ts) 사실. K8의 Haiku no-timeout — [parser-haiku.ts:191](lib/tour-match-v2/parser-haiku.ts) `new Anthropic({apiKey})`만, SDK 기본(10분/retry2) 사실. match가 `await parseQuery` 먼저 — [match/route.ts:77](app/api/itinerary/match/route.ts) 사실.

---

## 2. 신규 발견 (1차 문서에 없던 것) — 차원별

> 표기: [심각도] `파일:줄` — 무엇 / 왜 느린가 / 고침. 줄 번호는 감사 시점 기준이라 구현 때 재확인.

### A. 번들 / JS 무게 (클라이언트 hydration·파싱)

- **A1 [HIGH]** `app/[locale]/page.tsx:1` — **localized 홈 전체가 `"use client"`.** `/ko /ja /zh-CN /zh-TW /es` 진입 시 Header·Footer·BottomNav·HomeMainBody 전부 클라이언트 hydration. 영어 `/`는 정적 HTML인데 로케일 홈만 풀 하이드레이션. → 서버 컴포넌트로 전환, 로케일 세팅만 얇은 client 경계로.
- **A2 [HIGH]** `components/home/v2/HomeV2MatchProvider.tsx` + `HomeV2Page.tsx:34` — match 컨텍스트 provider가 **홈 전체 트리를 감싸** 모든 섹션을 client-aware로 끌어올림(정적 Featured/Destinations/WhyAtockorea 포함). → provider 범위를 매처가 실제로 필요한 섹션(Hero·BestMatchPreview·StickyCta·BottomSheet)으로 축소, 정적 섹션은 provider 위 서버 컴포넌트로.
- **A3 [MED]** `hero-section.tsx:1` / `landing-planner-card.tsx:1` — 히어로 스크롤 패럴럭스·플래너 카드가 framer-motion + 빌더 UI(SelectDropdown/IntakeDateField)를 최상위 eager import. → 패럴럭스를 `dynamic(ssr:false)` 서브컴포넌트로, 빌더 필드는 build 탭 활성 시 lazy.
- **A4 [MED]** framer-motion이 37+ 컴포넌트에서 사용. `next.config.js`의 `optimizePackageImports`에 포함돼 트리셰이크는 되지만 모듈 파싱비용은 남음. → 단순 fade/slide은 CSS transition으로 강등, 모달/드로어/바텀시트만 유지.
- **A5 [LOW]** 부킹 카드(`TourStickyBookingBar.tsx:6-8`, `TourDesktopBookingCard.tsx:24-25`)가 date-fns 로케일 `enUS/ko/zhCN` 정적 import. → 활성 로케일만 dynamic import.
- **유지할 좋은 패턴(건드리지 말 것):** `optimizePackageImports`(lucide/framer), datepicker `dynamic ssr:false`, 슬림 카탈로그(~275KB, 25MB 레지스트리 아님), DeferredBestMatchPreview·MatcherBottomSheet lazy. `recharts`는 미사용이나 무해.

### B. 렌더링 전략 / 데이터 워터폴 (서버)

- **B1 [HIGH · 사이트 전역 최우선]** `middleware.ts:44` — `refreshSupabaseSession()`이 **매 비정적 요청마다 `auth.getUser()`**(Supabase 토큰 검증+회전, 네트워크 블로킹) 호출. 모든 네비게이션에 RTT가 붙음. → 쿠키 TTL 기반으로 N분에 1회만 refresh, 또는 client 주기 폴링으로 이동, matcher에서 더 많은 경로 제외. **체감상 가장 광범위.**
- **B2 [HIGH]** `app/api/admin/stats/route.ts:20-109` — count 쿼리 6~8개가 **순차 await**(각 100ms면 800ms). → `Promise.all` 일괄.
- **B3 [HIGH]** `app/tour-product/[slug]/page.tsx:117-162` — viewModel → checkoutContext → catalog **순차 await** + `force-dynamic`/`revalidate=0`(CDN 캐시 0)이라 매 요청 반복. → 독립 작업 `Promise.all`, 상세는 ISR(`revalidate=3600`)+어드민 프리뷰 분리 검토.
- **B4 [MED]** force-dynamic / revalidate=0 남용 — ISR로 내릴 수 있는 것들: card-media, `api/currency/rate`(환율은 시간단위), `api/haenyeo-status`(revalidate=0인데 응답 헤더는 `max-age=60` — 모순), admin/stats. → 각 경로 TTL 정렬.
- **B5 [MED]** `app/itinerary-builder/page.tsx` POI 쿼리 `revalidate=300`(하루 288회 재생성)인데 POI 메타는 거의 안 변함. → TTL 대폭 상향(86400+), K3의 list/detail 분리와 함께.
- **B6 [MED]** `app/admin/page.tsx` — `'use client'` + `useEffect`에서 `/api/admin/stats` fetch → 네비→하이드레이션→fetch 더블 라운드트립, Suspense 없음. → RSC 프리페치 또는 Suspense 스켈레톤.

### C. 이미지 / 폰트 / 서드파티 (LCP·CLS)

- **C1 [HIGH]** Google Maps가 `useJsApiLoader`로 **즉시 로드**: `TourPickupMapSection.tsx`, `components/maps/HotelMapPicker.tsx:59`, `PickupPointSelector.tsx:70`. ~150KB+ JS가 지도 보기 전에 파서 블로킹(상세페이지 모든 방문자). → `dynamic(ssr:false)` + in-view/탭 클릭 시 인스턴스화, 정적 이미지 폴백.
- **C2 [MED→HIGH(콜드)]** `app/layout.tsx:48-51` — preconnect에 jsdelivr/google fonts만 있고 **Supabase 도메인 누락.** Supabase는 거의 모든 페이지에서 첫 fetch 대상 → 콜드 방문 시 DNS+TLS ~300ms. → `<link rel="preconnect" href="https://<project>.supabase.co" crossOrigin>` 추가.
- **C3 [MED]** `app/layout.tsx:69` — Noto JP/SC/TC/Serif-KR **4개 CJK 패밀리를 모든 로케일에서** 로드. unicode-range·swap로 완화되나 CSS 파싱+요청 낭비. → 감지 로케일에 맞는 패밀리만 로드.
- **C4 [MED]** 히어로 2번+ 슬라이드 및 `destination-card.tsx:52`, `itinerary-builder-entry.tsx:81` 카드 이미지가 `priority` 없음 → 뷰포트 진입 시 지연/CLS. → above-the-fold 첫 2~3장 `priority`, `sizes` 명시.

### D. 클라이언트 런타임 (hydration·INP·리렌더)

- **D1 [HIGH]** `lib/currency.tsx:125-134` — `CurrencyProvider`가 마운트에서 `fetchRate()` + **10분 `setInterval` 폴링**. 환율 전역 컨텍스트라 갱신마다 모든 가격 컴포넌트 리렌더, 폴링이 이벤트루프 점유. → 첫 `useCurrency()` 소비 시 lazy fetch, 폴링은 서버 캐시(api revalidate)로 이전, SWR류로 리렌더 차단.
- **D2 [HIGH]** `lib/i18n.ts:116-206` — `I18nProvider`가 마운트에서 `supabase.auth.getSession()` + `user_profiles` 쿼리 + 비영어 로케일 JSON dynamic import를 **timeout 없이** 수행(SessionProvider는 6s 타임아웃 있는데 여기는 없음) → 느린 네트워크에서 hydration 정지. → getSession 타임아웃 추가, localStorage+navigator 동기 폴백 우선, 현재 로케일만 preload, `startTransition`.
- **D3 [MED]** `app/tours/list/ToursListClient.tsx:400-417` 렌더마다 document 리스너 재등록(once 미사용); `:685-689` 스크롤 페이지네이션마다 카드 미디어 fetch(중복·경합). → 리스너 ref 가드/`{once}`, 미디어 fetch는 배치+캐시.
- **D4 [MED]** 빌더(§K8 외 추가): `POICatalogMap.tsx:275-424` cart 변경마다 **O(n²) 오프셋 + 마커 전체 재생성**; `POICatalogGrid.tsx:62` 렌더마다 `[...pois].sort + localeCompare`(메모 없음)로 framer-motion 전체 카드 재애니메이션. → 마커 incremental(추가/삭제분만), 오프셋 캐시, 정렬 `useMemo`.
- **D5 [LOW]** `LocaleCurrencySync.tsx:22` 로케일 전환→setCurrency 전역 리렌더 캐스케이드(디바운스); `POICatalogGrid.tsx:44` 마운트 즉시 visible인데 IntersectionObserver(`useRevealContainerProps`) 죽은 셋업.

### E. API / 서버 데이터 레이어 (신규 offender — K4 외)

- **E1 [HIGH]** `app/api/admin/tours/route.ts:155-183` — `select('*, pickup_points(*)')` 무제한 조인 + slug로 `match_tours.matching_profile`(큰 JSONB) 무제한 조인. ~180 투어 × 중첩 → 50MB급. → 필요한 컬럼만, pickup_points 제한, match_tours 캐시/필터.
- **E2 [MED]** `app/api/mypage/summary/route.ts:117-129` — `limit(100)`로 완료예약·리뷰 100행씩 가져와 카운트/윈도우 체크에만 사용(9 라운드트립). → 필드 프로젝션 축소, count는 `{count:'exact',head:true}`.
- **E3 [MED]** `app/api/tours/[id]/route.ts:107-142` — UUID→fallback select→`ilike` slug 3단 폴백, 실패마다 풀 라운드트립. → 스키마 1회 프로브/캐시, 조건부 select.
- **E4 [MED]** `app/api/admin/emails/route.ts:29` — `count:'exact'`가 페이지네이션마다 full COUNT(*). → `count:'planned'` 또는 별도 카운트 캐시.
- **E5 [MED]** `app/api/bookings/route.ts:218-448` — 재고체크·insert·재고update·재투어조회·알림이 **7+ 순차 쿼리 + 블로킹 이메일**. → 배치, 알림/이메일은 잡 큐로 비동기.
- **E6 [MED]** `app/api/admin/merchants/route.ts:21-52` — `select('*')` 무제한 + 전 머천트 프로필 enrichment(.in 무제한). → limit/페이지네이션.

### F. 데이터베이스 (Supabase advisor — 전부 신규, 1차 문서에 없음)

advisor 282건: unused_index 133, **auth_rls_initplan 62**, **multiple_permissive_policies 62**, **unindexed_foreign_keys 24**, 연결풀 1.

- **F1 [HIGH]** **RLS `auth_rls_initplan` — 62개 정책 / 40개 테이블**이 `auth.uid()`/`current_setting()`를 **행마다 재평가**. 핫 고객 테이블 포함: `bookings, reviews, product_inventory, tours, cart_items, wishlist, pickup_points, merchants, products, analytics_*`. → 정책의 `auth.uid()`를 `(select auth.uid())`로 감싸 InitPlan 1회 평가화. 행 많은 authed 쿼리에서 큰 이득, 마이그레이션만으로 해결.
- **F2 [MED]** **`multiple_permissive_policies` 62개** — 한 role/action에 permissive 정책 다수 → Postgres가 전부 평가(OR). 핫: `tours, product_inventory, pickup_points, reviews, settlements, merchants, qa_pairs`. → 정책 통합(중복 제거/병합).
- **F3 [MED]** **미인덱스 FK 24개** — 조인/cascade 삭제 느림. 고객경로 핫: `cart_items.pickup_point_id`, `chat_messages(ticket fk)`, `chat_feedback.message_id`, `tour_room_messages.booking_id/sender_user_id`, `emails.tour_id`, `tour_*.tour_id`. → 커버링 인덱스 추가(마이그레이션).
- **F4 [LOW]** **unused_index 133개** — 읽기는 안 느리지만 쓰기 비용/용량. *주의: 아직 안 켜진 기능용일 수 있음* → 사용량 확인 후 선별 드롭, 일괄 삭제 금지.
- **F5 [INFO]** Auth 연결풀 최대 10 — 인스턴스 스케일 시 수동 상향 필요.

---

## 3. 통합 우선순위 (리스크 × 레버리지)

### P0 — 즉시 / 리스크 0~저, 고효율
1. **(env, 코드 0)** `CHAT_STREAMING=1` 프로덕션 점등 + 재배포 → 챗봇 첫토큰 체감. *대시보드에서 사용자가 토글.*
2. **(설정)** G0 계측 + 베이스라인 — 이것부터.
3. **B1 middleware auth 호출 완화** — 사이트 전역 최대 레버리지.
4. **C2 Supabase preconnect** (5분) / **C1 Google Maps lazy** (상세 LCP).
5. **D1 Currency / D2 I18n provider 마운트 블로킹 해소** — hydration 전역.
6. **K1 카드 미디어 재요청 스킵** (initialMediaBySlug 가드, 캐시 의미변경은 보류).
7. **AI추천 rule-first + Haiku timeout(1.5s)+maxRetries 0**, preset=LLM 미호출 (§K8).
8. **F1 RLS `(select auth.uid())` 마이그레이션** + **F3 미인덱스 FK 인덱스** — DML만으로 authed 쿼리 가속.
9. **B2 admin/stats Promise.all**, **B3 tour-product Promise.all**.

### P1 — 측정 후 구조 개선
- A1 로케일 홈 서버화 / A2 provider 범위 축소.
- K2 tours 서버 페이지네이션 / K3·B5 빌더 POI list·detail 분리 + TTL.
- B4 force-dynamic→ISR 정렬(card-media·currency·haenyeo).
- E1 admin/tours 조인 다이어트, E2·E3·E4·E5·E6.
- D3·D4 런타임 메모이즈/배치, C3 CJK 폰트 로케일 분리, C4 priority.
- 챗봇 토큰 다이어트(§C: intent-gated RAG, context budget, history pruning) — **`chat_feedback` 부정률 가드레일 + A/B 필수.**
- F2 permissive 정책 통합.

### P2 — 캐시 / 정리 / 운영
- 컨텍스트·임베딩·추천 캐시(LRU/KV), deterministic fast-path 확대.
- A3·A4·A5 번들 미세 축소, D5 정리.
- F4 unused_index 선별 드롭(사용량 확인 후), F5 연결풀.
- Web Vitals 경로별 상시 수집 + Playwright/Lighthouse 회귀 게이트.

---

## 4. 완료 기준 (베이스라인 대비)
- `/tours/list?destination=jeju` 첫 응답 payload ≤300KB, 첫 화면 카드 ≤24.
- 빌더 POI list payload 지역당 ≤200KB, 동일 slug/locale 카드미디어 중복요청 0.
- 빌더 Add 클릭→badge/timeline 반영 ≤200ms, POI 풀 payload 재요청 0.
- AI추천 preset p50 ≤1s, 일반 p50 ≤2s, 어떤 경우도 ≥8s 대기 없이 rule fallback.
- 챗봇 첫토큰(스트리밍 on) ≤1.2s, 부정률 증가 없음.
- 모든 네비게이션에서 middleware auth RTT 제거(콜드 제외).
- authed 핫쿼리(bookings/reviews/inventory) RLS InitPlan 1회 평가.

## 5. 리스크 / 가드
- RLS 정책 수정(F1/F2)은 **보안 정책이므로 staging에서 행가시성 회귀 테스트 후** 적용. `(select auth.uid())` 변환은 의미 동일하지만 정책 통합은 신중히.
- 캐시 TTL 도입(K1·B4)은 어드민 저장 반영 지연 → 태그 revalidate/버전키 동반.
- 챗봇 RAG/컨텍스트 축소는 품질 회귀 가능 → 가드레일·A/B.
- serverless에서 이메일/알림 background 분리(E5)는 fire-and-forget 유실 위험 → job table.
- K6 정적/DB 이중소스는 성능 아닌 정확성 트랙 → 본 플랜에서 제외.
