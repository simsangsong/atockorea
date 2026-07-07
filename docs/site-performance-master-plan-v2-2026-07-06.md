# 사이트 전반 속도 업그레이드 마스터 플랜 v2

작성일: 2026-07-06
선행: `docs/site-performance-tours-mypage-plan-2026-07-04.md`(Phase 3 — 보텀바 탭·카트·로케일홈·함수리전) / `docs/site-performance-landing-detail-plan-2026-07-04.md`(Phase 2 — 홈·상세)
근거: 병렬 감사 에이전트 5종(체크아웃·빌더·마이페이지 서브라우트·글로벌 셸/번들·API/데이터레이어) + Supabase 성능 어드바이저 + 프로덕션 헤더/지연 실측(2026-07-06).

---

## 0. 이번 세션까지 이미 출하 (재작업 금지)

| 항목 | 효과 |
|------|------|
| 홈 `/` ISR + 폰트(F1/F2) + LCP + CSR bailout(Wave2) | 홈 LCP 21→6.5s |
| 로케일 홈 `/ko`·`/ja`·`/zh`·`/es` ISR (PR #270) | MISS/no-store → PRERENDER, TTFB ~0.3s |
| `/tours/list` ISR + 기본진입 fetch 스킵 + 캐시 (PR #256) | 탭 ~4.5s → ~0.3s |
| `/tour-product/[slug]` ISR(T1) + 레지스트리 lazy(T2) + LCP 이미지 | 상세 캐시 HIT |
| `/mypage` 랜딩 API 다이어트(C1/C2) + 카트(PR #266) | — |
| 카탈로그 로케일 분할(D1, PR #259) | 초기 JS −190KB |
| **🔴 함수 리전 서울(icn1) 고정 (PR #271)** | **모든 동적 API 태평양 왕복 제거 — `/api/tours` 2.49s→0.48s(5배)** |
| **✅ Tier 1 전부 (PR #272 `25c12b5f`, 2026-07-07)** | skipRoleLookup(6라우트 −1~2 DB왕복) + 엣지캐시 헤더 6개(home-summary·card-media·tours/[id]·builder pois·reviews공개·agent avail) + mypage 7서브라우트 force-dynamic 제거(전부 Static) + 챗봇 dynamic(ssr:false)(−15KB gz) + loading.tsx 10개. 빌드/tsc 그린·jest 신규fail 0·로컬 prod 헤더 실측 |
| **✅ Tier 2 번들 (PR #275, 2026-07-07)** | framer-motion을 글로벌 셸(BottomNav·FloatingLangToggle)에서 제거→**콘텐츠 페이지(mypage/cart/checkout/auth/legal) framer 0**(99KB raw 청크 부재 실측) + Header supabase lazy(55KB gz 크리티컬패스 이탈) + 빌더 코드분할(Quote/POIDetail/Grid `dynamic(ssr:false)`). 적대적 리뷰 1 medium(로그아웃 재진입 가드) 수정. **T2-A(홈 카탈로그)는 별도 PR로 분리**(4소비처 전환 필요) |
| **✅ Tier 4 체크아웃 (PR #277, 2026-07-07)** | 투어 체크아웃 공유 useSession(5-6s auth 행 제거, 루프세이프) + booking POST 병렬화(tour+auth+FX·inventory+bookings 2 Promise.all, title/merchant 재조회 제거, **가용성 DB에러 fail-CLOSED** 가드=리뷰 blocker) + Stripe `dynamic(ssr:false)` + 빌더 체크아웃 중복 match_pois 쿼리 제거. 적대적 리뷰 1 blocker 수정 |
| **✅ Tier 5 self-fetch (PR #278, 2026-07-07)** | match-explanation이 전체 match_tours 대신 `fetchMatchTourBySlug` 단일행. **RLS 마이그(131) 스킵**(service-role 우회로 런타임 무영향) |

**핵심 인사이트**: 페이지 **셸은 사이트 전반 이미 건강**하다(모든 주요 경로 PRERENDER, TTFB 0.09~0.58s). 남은 병목은 **① 인증 클라이언트 데이터 로딩(API 왕복) ② 초기 JS 번들 ③ DB RLS ④ 체크아웃/빌더 특화 경로**다.

### 확정된 비(非)이슈 (조사 완료 — 건드리지 말 것)
- **CSR `BAILOUT_TO_CLIENT_SIDE_RENDERING` 마커는 양성**: `dynamic(ssr:false)`(MatcherBottomSheetLazy) + 루트 Suspense의 정상 산물. `/`·`/ko` 모두 실제 콘텐츠로 완전 프리렌더됨(빌드 HTML에 히어로+9섹션 존재). Suspense/useSearchParams 수정 불필요.
- **FX 환율 레이어**(`lib/exchange/usdBasedRates.server.ts`): in-memory TTL+negative-cache+2s abort+`revalidate:3600` 이미 최적. 손대지 말 것.
- **edge 런타임**: 132개 라우트 중 0개(전부 nodejs) — DB 접근 문제 없음. 무변경.
- **Speed Insights**: 하이드레이션 후 자체 주입, 렌더 비블로킹.
- `destinations`·`exchange-rates`·`tours`·`homepage-product-card-images`·`weather`·`currency/rate` 등은 이미 엣지 캐시 HIT(Vercel이 s-maxage를 클라 헤더에서만 제거해 `public,max-age=0`으로 보일 뿐).

---

## 1. Tier 1 — 최대 레버리지·저위험·즉시 출하 (헤더/한 줄/기계적) — ✅ 전부 출하 (PR #272 `25c12b5f`, 2026-07-07)

> 상태: T1-A~E 전부 머지. 프로덕션 배포 후 `X-Vercel-Cache` 반복히트 실측 + Speed Insights 관찰. **다음 착수 = Tier 2 번들** (§2, 브랜치 `perf/tier2-bundle`). 아래는 착수 당시 실행 명세(기록 보존).

### T1-A. `skipRoleLookup` 확산 — 인증 API에서 불필요한 role 조회 제거
`getAuthUser(req)`는 매 호출 `user_profiles` role SELECT(+merchant면 1개 더)를 직렬로 함. identity만 쓰는 라우트는 `{ skipRoleLookup: true }`로:
- `app/api/bookings/route.ts:25` GET (mybookings·upcoming·history 3탭 공용)
- `app/api/wishlist/route.ts:17` GET, `:76` POST, `:184` DELETE
- `app/api/reviews/route.ts:30` GET(`?userId=` 본인 목록)
- `app/api/tour-product/assistant/route.ts:777` (챗봇 매 턴 — role 미사용)
- 효과: 라우트당 −1~2 DB 왕복(서울 내부 ~15-40ms). 위험 0(이미 mypage/cart에 검증된 패턴).

### T1-B. 진짜 미캐시 공개 GET에 캐시 헤더 추가 (엣지 HIT 전환)
프로덕션에서 `X-Vercel-Cache: MISS` 확정된 것만:
| 라우트 | 현재 | 권장 `Cache-Control` |
|--------|------|----------------------|
| `app/api/reviews/home-summary/route.ts` | 없음(→no-store) | `public, s-maxage=300, stale-while-revalidate=1800` |
| `app/api/tour-product-card-media/route.ts` | `no-store` | `public, s-maxage=600, stale-while-revalidate=3600` (형제 `homepage-product-card-images`와 동일) |
| `app/api/tours/[id]/route.ts` | `force-dynamic; revalidate=0` | `public, max-age=0, s-maxage=300, stale-while-revalidate=600` (`/api/tours`와 동일) |
| `app/api/itinerary-builder/pois/route.ts` | `force-dynamic`, 없음 | `public, s-maxage=600, stale-while-revalidate=3600` + `.limit(500)` |
| `app/api/reviews/route.ts` GET(공개분기) | 없음 | `public, s-maxage=120, swr=600` (본인분기는 `private, no-store` 유지) |
| `app/api/agent/v1/tours/[slug]/availability/route.ts` | 없음 | `public, s-maxage=30, swr=60` |
- 효과: 홈·리스트·상세·빌더의 반복 조회가 엣지 HIT. 순수 헤더 편집, 위험 0. ⚠ 검증은 반드시 `X-Vercel-Cache` 반복히트로.

### T1-C. `force-dynamic` 제거 (클라 페이지 — 무효 + 정적 셸 차단)
클라 컴포넌트라 무효인데 서버 셸 정적 프리렌더를 막음:
- `app/mypage/{dashboard,mybookings,upcoming,history,reviews,wishlist,settings}/page.tsx:3` (7개)
- `app/tour/[id]/checkout/page.tsx`(클라측 확인 필요), 빌더 checkout은 서버 동적이라 별도
- 효과: 셸 CDN 정적 서빙, 위험 0.

### T1-D. 챗봇 위젯 `dynamic(ssr:false)` — 전 페이지 −15KB gz
`components/GlobalAiAssistant.tsx:5`가 2029줄 위젯을 **정적 import** → 모든 페이지 첫 로드에 ~48KB raw/15KB gz. 위젯은 닫힌 FAB만 렌더(SSR 무의미):
- `const Widget = dynamic(() => import(...).then(m=>m.TourProductAiAssistantWidget), { ssr:false, loading:()=>null })`
- 효과: 전 페이지 −15KB gz + 파스 지연. 한 줄, 위험 0(idle 티저 6s가 lazy 로드 커버).

### T1-E. `loading.tsx` 추가 (미프리페치 탭 dead-tap 제거 + 스켈레톤 형태 정합)
- mypage 서브라우트 7개(현재 단일 `loading.tsx`가 랜딩 스켈레톤을 모든 탭에 표시 → 형태 미스매치)
- `app/tour/[id]/checkout/`, `app/itinerary-builder/checkout/`, `app/itinerary-builder/`
- 효과: 탭 전환 즉시 올바른 스켈레톤. 위험 0.

---

## 2. Tier 2 — 초기 JS 번들 다이어트 (홈 ~485KB gz → 목표 ~300KB) — ✅ T2-B/C/D 출하 (PR #275); ⬜ T2-A 잔여

> T2-B(framer→CSS)·T2-C(Header supabase lazy)·T2-D(빌더 코드분할) 머지. **T2-A(FeaturedShowcase·IdleMatchPreview 카탈로그 eager import)만 잔여** — 홈 초기 번들에서 카탈로그를 빼려면 정적 소비처 4곳(featured·idle·MatcherMorphing·best-match) 전부 전환 필요(2곳만 하면 이득 0). shape-보존 없이 프리셋만 바꾸면 안 됨. 별도 PR + 빌드 번들그래프 delta 검증.

### T2-A. FeaturedProductsShowcase·IdleMatchPreviewCarousel의 전체 카탈로그 정적 import 제거 — 홈 −70KB gz
`featured-products-showcase.tsx:21` + `IdleMatchPreviewCarousel.tsx`가 전체 `staticTourCatalogCards`(224KB raw/70KB gz, 청크 `802-*`)를 동기 import → `HomeV2MatchProvider`의 lazy import 규율을 무력화. 이 둘은 ~8개 featured 슬러그 카드 데이터만 필요.
- 수정: 서버(`app/page.tsx`)에서 featured 카드 데이터를 prop으로 내리거나(이미 media는 그렇게 함), featured 서브셋 모듈 분리.
- 효과: 홈·로케일홈(최다 트래픽) −40~70KB gz.

### T2-B. framer-motion을 글로벌 셸 2곳에서 제거 — 전 페이지 −20~40KB gz
`BottomNav.tsx:5` + `FloatingLanguageToggle.tsx:6`가 `framer-motion`(121KB raw/40KB gz, 청크 `7241-*`) import → 거의 모든 라우트에 상시 로드. `LazyMotion` 부재 확인. BottomNav은 3px 인디케이터 슬라이드+탭 scale, 토글은 소형 팝오버 — 전부 CSS 대체 가능.
- 수정: 이 2곳을 CSS transition/`@keyframes`로(또는 `LazyMotion`+`m`). 리치 모션 섹션(홈)은 유지.
- 효과: 비(非)홈 전 페이지 −20~40KB gz. ⚠ 시각 다운그레이드 금지(모션 정체성 보존 — home-ux 규칙).

### T2-C. Header의 `lib/supabase` 정적 import lazy화 — 로그아웃 홈 −55KB gz
`Header.tsx:12`가 `@/lib/supabase`(184KB raw/55KB gz, 청크 `5001-*`) 정적 import → auth SDK가 필요 전 다운로드. `auth-session.tsx`·`i18n.ts`는 이미 `import()` lazy.
- 수정: Header의 프로필 로드/사인아웃 핸들러를 dynamic `import('@/lib/supabase')` 뒤로(기존 패턴 복제).
- 효과: 로그아웃 방문자(마케팅 홈 다수) 초기 크리티컬 패스 −55KB gz.

### T2-D. 빌더 번들 코드분할 (빌더 진입 시 −150~250KB)
- `BuilderShell.tsx:21-30`이 모달 5종·dnd-kit·framer 전부 eager import(빌더 = 단일 ~1.3MB 청크). `QuoteModal`·`POIDetailModal`·`ResultTimeline`을 `dynamic(ssr:false)`(전부 인터랙션 게이트).
- POI 그리드/모달의 framer-motion을 CSS로.

**T2 합계 목표: 홈 초기 JS ~485KB → ~300KB gz** (Speed Insights로 검증 후 추가 판단).

---

## 3. Tier 3 — 빌더 데이터 페이로드 (빌더 Jeju −250~290KB 전송) — ⛔ 보류(빌더 사이트 전역 숨김)

> **`ITINERARY_BUILDER_ENABLED=false`** (`lib/itinerary-builder/builder-visibility.ts`, Klook 심사) → `/itinerary-builder*`는 `/tours/list`로 리다이렉트, 홈/리스트 빌더 CTA 미렌더, pois/match API 무호출. **Tier 3 전 표면이 죽은 표면 = 제로 유저 임팩트** → 빌더 재활성화 시까지 보류. ⚠ 착수 시 주의: T3-A는 에이전트 제안(`content_locales->>'ko'`)이 **틀림** — 클라 `localizePoiRow`가 `poi.content_locales[locale]`을 읽으므로 shape 보존 `jsonb_build_object('ko', content_locales->'ko')` 필수 + unstable_cache 키/API에 locale 추가 + 6로케일 QA. T3-B는 grid/modal만(마커·infowindow는 imperative createRoot라 next/image 부적합). T3-C 프리셋 LLM 스킵도 매처 죽어 무의미.

### T3-A. `content_locales` 6로케일 과다직렬화 제거 (CRITICAL)
`itinerary-builder/page.tsx`가 `match_pois`의 `content_locales`(6로케일 전체 사본)를 SSR prop으로 전송 후 5/6 폐기. 실측: Jeju 315KB(중 content_locales 153KB), busan 145KB.
- 수정: 서버에서 활성 로케일만 flatten + `delete content_locales`, 또는 지도용(좌표·이미지·seq)과 모달용(설명·하이라이트) 분리해 모달은 열 때 fetch.
- 효과: Jeju −250~290KB 전송 + 파스 TBT.

### T3-B. POI 이미지 next/image 전환 (빌더 전역 raw `<img>`)
그리드·모달·마커 전부 raw `<img src={default_image_url}>`(풀해상도). 그리드 CLS·LCP 직결.
- 수정: 그리드/모달 히어로는 next/image, 마커(56-64px)는 소형 Storage transform URL + 명시 치수.

### T3-C. 프리셋 매칭 LLM 스킵
`/api/itinerary/match`가 매 추천마다 Gemini 파스 + 클러스터 재조회(무캐시). 5개 프리셋 칩은 고정 시드 → 빌드타임 `ParsedQueryV2` 프리컴퓨트 또는 `hash(intent)` 캐시.

---

## 4. Tier 4 — 체크아웃/예약 핫패스 (전환 직결) — ✅ 출하 (PR #277)

> T4-A(공유 useSession)·T4-B(booking POST 병렬화 + fail-CLOSED 가용성 가드)·T4-C(a)(Stripe lazy)·T4-C(c)(빌더 체크아웃 중복쿼리) 머지. **T4-C(b) cart→checkout projection 보류**(공유 `/api/tours/[id]` transform 결합 취약·이득 작음), T4-C(e) stripe.customers.list는 이미 최적(customer_id 캐시).

### T4-A. 투어 체크아웃 공유 `useSession()` 전환 (CRITICAL — 카트와 동일 안티패턴)
`app/tour/[id]/checkout/page.tsx:133,234`가 원시 `supabase.auth.getSession()` 3회 → 공유 `useSession().getAccessToken()`. `auth-session.tsx` 도크블록이 이게 과거 5-6s 행의 원인이라 명시. 결제 버튼 크리티컬 패스에 있음.

### T4-B. `POST /api/bookings` 직렬 쿼리 체인 병렬화
클릭→결제 사이 4개 직렬 await(tour·`auth.getUser`·inventory·existing-bookings)→insert. 독립 3개 `Promise.all` + `auth.getUser`를 공유 identity로. 가용성 무한(의도)이라 inventory/existing 쿼리는 용량설정 게이트 뒤로.

### T4-C. 기타 체크아웃
- Stripe SDK(`NoShowHoldCardForm`) `dynamic(ssr:false)`(카드폼은 2번째 인터랙션).
- 카트→체크아웃 리다이렉트가 `/api/tours/[id]` `SELECT *`를 3필드 위해 대기 → 경량 projection 또는 sessionStorage에 price_type 저장.
- 빌더 체크아웃 `match_pois` 중복 쿼리 제거(`:89`·`:120` 동일키 2회 → byKey 재사용).
- booking POST가 이미 가진 tour row를 title/merchant_id 위해 재조회 → 최초 select에 포함.
- `stripe.customers.list` 신규고객 핫패스 호출 → 직접 생성 또는 DB에 customer_id 저장.

---

## 5. Tier 5 — DB / 데이터레이어 (별도 트랙, 마이그레이션) — ✅ T5-C 라이브분만 출하 (PR #278); ⛔ 마이그레이션 보류

> **핵심 판정: RLS 마이그(T5-A 63 + T5-B 68 = 131건)는 앱 런타임 제로영향** — `createUserSupabaseClient`(RLS-on)는 정의만 있고 **어떤 라우트도 미사용**(`grep` 확증); 앱 전 DB접근이 service-role(`createServerClient`)로 RLS 우회. RLS-enforced는 브라우저 직접 단일행 user_profiles 읽기뿐(auth.uid() per-row 재평가 무의미). → 순수 위생, 스케일 게이트까지 보류. T5-C 중 **match-explanation만 라이브·실이득**으로 출하(PR #278). availability POST loopback은 **호출자 없음(죽음)**, unused_index(152)=쓰기증폭만, pooler(D)=인프라 → 전부 보류.

### T5-A. RLS `auth_rls_initplan` 63건 재작성 — 유저 스코프 쿼리 가속
정책이 `auth.uid()`를 **행마다** 재평가 → `(select auth.uid())`로 감싸 쿼리당 1회. 핫 유저테이블: **reviews·bookings·cart_items·wishlist·review_reactions·user_settings·promo_code_usage**.
- ⚠ 단서: service-role 클라(`createServerClient`)는 RLS 우회 → 대부분 API는 영향 없음. **`createUserSupabaseClient`(RLS-on) 경로에서만** 물림. 어느 라우트가 유저-RLS인지 먼저 감사.
- additive 마이그레이션(정책 재작성), 적용 후 `get_advisors` 재실행.

### T5-B. `multiple_permissive_policies` 68건 통합 — 최다조회 `tours`(6) 우선
쿼리당 모든 permissive 정책 평가 → 통합. tours(공개 read, /api/tours·카탈로그가 최다 히트) 우선, 그 다음 user_settings·review_*·merchants.

### T5-C. 자체 HTTP 재호출 제거
- `/api/tours/[id]/availability` POST가 자기 GET을 loopback HTTP로 호출 → `computeAvailability()` 공유 함수 in-process.
- `/api/tour-product/match-explanation`이 전체 `match_tours` 재스캔 → winner 슬러그 단일행 `.eq('slug',…).single()`.

### T5-D. 커넥션 풀러 확인
113개 라우트가 요청당 fresh 클라 생성 + `auth_db_connections_absolute` 경고. transaction-mode 풀러(PgBouncer 6543) 사용 확인. T5-A/C가 클라 수 자체를 줄임.

### T5-E. `unused_index` 152건 — 쓰기 증폭(읽기 무관) 정리
bookings/cart 쓰기 약간 가속. 저우선. 실제 미사용 재확인 후 DROP.

---

## 6. Tier 6 — 사용자 조치 게이트 (선행 필요) — 🔴 여전히 사용자 게이트 대기 (미착수, 도입 금지)

> **사용자 조치 필요**: Supabase Dashboard → JWT Keys → 비대칭 ES256 키 마이그레이션+로테이트. 그 전에는 `getClaims()` 로컬검증이 no-op이고 인증을 깨뜨릴 수 있어 **절대 도입 금지**. 사용자가 완료 확인해주면 착수(§6-A). 다음 세션은 사용자에게 이 마이그레이션 여부부터 물을 것.

### T6-A. 🔴 JWT 로컬 검증 (최대 per-request 절감, but 막힘)
`getAuthUser`가 매 인증 요청 GoTrue `auth.getUser(token)` **네트워크 호출**(~72개 라우트). 로컬 JWKS 검증(`getClaims`)으로 대체하면 요청당 왕복 1회 제거(서울내부 ~30-120ms).
- **⚠ 현재 막힘**: 라이브 프로젝트가 **legacy HS256 공유시크릿**(JWKS 빈 배열 확정) → `@supabase/supabase-js@2.106.1`의 `getClaims()`가 **네트워크 `getUser()`로 no-op**. 절대 지금 도입 금지(무이득).
- **선행(사용자)**: Supabase Dashboard → JWT Keys → **비대칭 서명키(ES256) 마이그레이션 + 로테이트**. 그 후 `getClaims()` 로컬검증 + custom access-token hook으로 `user_role` 클레임 주입(role 조회도 소멸).
- 보안: 로컬검증은 exp까지 revocation 못 잡음 → access-token TTL 단축(1800s) + 민감 뮤테이션(refund/settle/delete-user)은 명시적 `getUser()` 재검. Supabase 권장 분리.
- 효과: ~72개 엔드포인트 요청당 −1 왕복, role-gated는 −2~3. **집계 최대 이득.** 사용자 키 마이그레이션 후 착수.

### T6-B. 콜드 스타트 (선택)
리전 무관하게 서버리스 첫 히트 ~2s(부팅). 트래픽 늘면 자연 완화. 필요시 함수 워밍(cron ping) 별도 트랙.

---

## 7. 착수 순서 (권장)

1. **Tier 1 전부** (헤더·skipRoleLookup·force-dynamic·챗봇 lazy·loading.tsx) — 반나절, 위험 0, 즉시 체감. 한 PR로 묶기.
2. **Tier 2 번들** (챗봇 외 카탈로그·framer·supabase lazy) — 홈 −150~180KB gz. Speed Insights 전/후 비교.
3. **Tier 4 체크아웃** (useSession·booking 병렬·Stripe lazy) — 전환 핫패스.
4. **Tier 3 빌더** (content_locales·next/image·프리셋) — 빌더 사용자.
5. **Tier 5 DB** (RLS·self-fetch — 유저-RLS 라우트 감사 후) — 별도 마이그레이션 트랙.
6. **Tier 6-A JWT** — 사용자 키 마이그레이션 완료 시.

## 8. 리스크 / 가드
- 캐시 헤더: 반드시 `X-Vercel-Cache` 반복히트로 실효 검증(Vercel이 s-maxage를 클라 헤더에서 제거).
- 모션 CSS 전환(T2-B): 시각 정체성 보존(home-ux 규칙 — amber·포커스링·모션 유지).
- RLS 재작성(T5): additive, 유저-RLS 경로만, 적용 후 advisor 재실행, 골든 회귀.
- JWT(T6): 키 마이그레이션 **전 `getClaims()` 도입 금지**(no-op). 민감 뮤테이션 재검 리스트 유지.
- `revalidateTag` 금지(Next16) — 캐시 무효화는 revalidatePath.
- 헤드리스 브라우저 QA는 백그라운드 창에서 프리즈/스로틀 빈발 → API는 curl/직접 fetch로, 렌더는 by-construction+프록시 측정으로 갈음.
