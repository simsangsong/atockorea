# 보텀바 Tours·Mypage 탭 성능 — Phase 3 실행 플랜

작성일: 2026-07-04
선행 문서: `docs/site-performance-landing-detail-plan-2026-07-04.md` (Phase 2 — 랜딩/상세 완료: F1/F2 폰트, T1 상세 ISR, T2 레지스트리 다이어트, Wave 2 CSR bailout 수리)
범위: 보텀바(`components/BottomNav.tsx`)에서 **Tours 탭(`/tours/list`)**, **Mypage 탭(`/mypage`)** 클릭 시 체감 지연의 원인 진단 + 수정 플랜. 기능(어드민 썸네일 즉시 반영, 필터/정렬, 인증 게이트, 스켈레톤 UX)은 전부 보존.

---

## 0. 구조 요약 (탭 클릭 시 실제로 일어나는 일)

### Tours 탭 → `/tours/list`
1. `app/tours/list/page.tsx:47` — 서버 컴포넌트가 `cookies()`를 읽음 → **라우트가 매 요청 동적 SSR로 강제**됨(상세페이지 T1 이전과 동일 클래스의 병목).
2. 서버는 응답 전에 `loadTourProductCardMediaBySlug()`를 **블로킹 await** — Supabase 2쿼리(`tour_product_pages` + `tours`, 카탈로그 슬러그 전체 `.in()`).
3. `app/tours/list/`에 **`loading.tsx` 없음** → 동적 라우트라 Next의 Link prefetch가 가져올 수 있는 게 0 → **탭을 눌러도 서버 응답(콜드 시 1~2s)까지 화면 무반응(dead tap)**.
4. 클라이언트 하이드레이션 후 `ToursListClient`가 마운트되며:
   - `/api/tours?limit=500&compact=1&…` fetch (`ToursListClient.tsx:308`) — **기본 진입은 셸브 뷰(필터 없음)라 이 500건 결과가 화면에 안 보이는데도 항상 실행**.
   - `/api/tours/destinations` fetch (`ToursListClient.tsx:241`).
   - `/api/tours` 내부(`app/api/tours/route.ts`): tours 쿼리 + **결과 슬러그 전체(최대 500개)에 대해 `loadTourProductCardMediaBySlug` 재실행**(2쿼리) + FX. CDN 캐시는 `s-maxage=30`뿐이라 히트율 낮음.
5. 클라이언트 번들: `catalogCards.generated.ts`(**소스 ~275KB, 6로케일 전체**)가 `ShelvesContainer → listStaticTourProducts` 경유로 **브라우저 번들에 포함**. 첫 탭 클릭 시 이 라우트 청크 다운로드+파싱.

### Mypage 탭 → `/mypage`
1. `app/mypage/page.tsx:3` — `'use client'` 파일에서 `export const dynamic = 'force-dynamic'`. 페이지·레이아웃 전부 클라이언트 컴포넌트이고 서버에서 읽는 데이터가 0인데 라우트만 동적 → **prefetch 무효 + 매 클릭 서버 왕복**. (클라이언트 컴포넌트의 route segment config는 버전에 따라 무시/적용이 갈리는 회색지대 — 어느 쪽이든 제거 대상.)
2. `loading.tsx` 없음 → Tours와 같은 dead-tap.
3. 도착 후 클라이언트 워터폴:
   - `MyPageAuthGate` 스피너(세션 ready 대기; 루트 `lib/auth-session` 공유 구독 덕에 보통 웜이지만 첫 진입/새로고침 시 bootstrap `getSession()` 최대 6s 타임아웃 경로).
   - `getAccessToken()` → `/api/mypage/summary` + `/api/mypage/extras` 병렬 fetch.
   - **각 API가 `getAuthUser()`(`lib/auth.ts:43`)를 통과: `auth.getUser(token)` = Supabase Auth 서버 네트워크 왕복 + `user_profiles` role 쿼리(+merchant면 1쿼리 추가)** — mypage API는 role이 필요 없는데도 요청당 2~3 왕복 오버헤드 ×2 API.
   - summary(`app/api/mypage/summary/route.ts`): 9개 병렬 쿼리 — 이 중 **completed 후보 100행 × 3-way 조인**(tours+pickup_points, `:117-123`)을 pendingReviews 5개 뽑으려고 수행, reviews도 100행.
   - extras: wishlist/bookings 조인 + FX + 34투어 추천 스코어링.
4. **프로필 3중 조회**: `MyPageSessionProvider`가 브라우저에서 직접 `user_profiles` SELECT(+조건부 PATCH 후 재조회), summary API도 profile SELECT, getAuthUser도 role SELECT.

체감 합계(4G 기준 추정): Tours = dead tap 0.5~2s + 번들 + API 0.3~1s. Mypage = dead tap 0.3~1s + 게이트/토큰 + API 왕복 0.6~1.5s.

---

## 1. 병목 목록 (임팩트 순)

### `/tours/list`
| ID | 심각도 | 내용 | 위치 |
|----|--------|------|------|
| TL-1 | CRITICAL | `cookies()`로 매 요청 동적 SSR + 응답 전 Supabase 2쿼리 블로킹 | `app/tours/list/page.tsx:47-49` |
| TL-2 | HIGH | `loading.tsx` 부재 → prefetch 0 + dead tap | `app/tours/list/` |
| TL-3 | HIGH | 기본 진입(셸브 뷰)에서도 `/api/tours` 500건+미디어 재조회 fetch 항상 실행 | `ToursListClient.tsx:277-343` |
| TL-4 | MED | `/api/tours` CDN 캐시 `s-maxage=30`으로 짧음, 내부에서 슬러그 500개 미디어 2쿼리 | `app/api/tours/route.ts:339-349,654` |
| TL-5 | MED | `catalogCards.generated.ts` 275KB(6로케일 전체)가 클라 번들 포함 | `staticTourCatalogCards.ts:23` |
| TL-6 | LOW | `/api/tours/destinations` 마운트 즉시 fetch | `ToursListClient.tsx:241` |
| TL-G | GUARD | `ToursListClient`가 top-level `useSearchParams()` 사용 — **정적 전환 시 Suspense 경계 없으면 Wave-2와 동일한 CSR bailout 재발** | `ToursListClient.tsx:5` |

### `/mypage`
| ID | 심각도 | 내용 | 위치 |
|----|--------|------|------|
| MP-1 | HIGH | 클라 페이지에 `force-dynamic` → prefetch 무효·매 클릭 서버 왕복 | `app/mypage/page.tsx:3` |
| MP-2 | HIGH | API당 `getAuthUser` = `auth.getUser` 네트워크 검증 + role 쿼리(+merchant) ×2 API | `lib/auth.ts:43-96` |
| MP-3 | MED | 프로필 3중 조회(SessionProvider 직접 + summary + getAuthUser) | `MyPageSessionProvider.tsx:68-141` |
| MP-4 | MED | pendingReviews용 completed 후보 100행 3-way 조인 + reviews 100행 | `summary/route.ts:117-129` |
| MP-5 | LOW | `loading.tsx` 부재 | `app/mypage/` |
| MP-6 | LOW | extras 추천 스코어링 매 요청 | `extras/route.ts` |

---

## 2. 실행 플랜

### Wave 0 — 측정 게이트 (코드 0, 반나절)
- [x] **G0** 프로덕션 실측 완료 (2026-07-04, 한국에서 curl 3회):

| 경로 | CDN | TTFB | 문서 완료 | 비고 |
|------|-----|------|-----------|------|
| `/tours/list` | **MISS 매회** (no-store) | 0.62~1.53s | 0.85~2.08s | HTML 102KB — TL-1 확정 |
| `/mypage` | **HIT** (정적) | 0.09~1.13s | ~0.1s(웜) | 🔍 `force-dynamic`이 **무시되고 있음**(클라 컴포넌트) — 셸은 이미 정적. 체감 지연은 클라 워터폴(MP-2~4)이 지배 |
| `/api/tours?limit=500&compact=1…` | MISS 시 | **2.49s** | 2.50s | 26KB. `s-maxage=30`이라 MISS가 일상 — B1/B2 중요도 상향 |
| `/` (참고) | HIT | 0.1s급(웜) | — | 기준선 |

  - 해석: Tours 탭 = 서버 SSR 0.8~2s(dead tap) + 도착 후 그리드 데이터 2.5s = **최악 ~4.5s**. A3(ISR)와 B1(기본 진입 fetch 스킵)이 각각 절반씩 제거.
  - Mypage 탭 = 셸 즉시 + 콘텐츠는 API 왕복(auth 오버헤드 포함)이 전부 → **C웨이브가 주 병목**. A1은 오해 방지용 정리(무시되는 export 제거)로 강등.

### Wave A — 탭 반응 즉시화 (최대 레버리지)
- [x] **A1: `/mypage` force-dynamic 제거** (MP-1, MP-5) — ✅ 구현 (2026-07-04). G0에서 이 export가 클라 컴포넌트라 **이미 무시되고 있음**이 확인됨(프로덕션 CDN HIT) → 오해 방지용 삭제 + `app/mypage/loading.tsx` 추가(기존 `MyPageSkeletons` 재활용, 하위 라우트 공용).
- [x] **A2: `/tours/list` loading.tsx 추가** (TL-2) — ✅ 구현. 셸브 형태 스켈레톤(`app/tours/list/loading.tsx`).
- [x] **A3: `/tours/list` ISR 전환** (TL-1, TL-G) — ✅ 구현. T1 패턴 그대로:
  - `cookies()` 제거 → 공유 서버 바디 `app/tours/list/toursListPageBody.tsx`(locale은 라우트 입력). 베어 `/tours/list`=EN ISR(`revalidate=3600`), `app/[locale]/tours/list` 신설(on-demand ISR, `/en/...`→베어 redirect).
  - 미들웨어: 베어 경로 쿠키 non-EN → `/{locale}/tours/list` 307, 로케일 접두사는 rewrite 대신 패스스루(+`/en/tours/list`→베어 307) — tour-product 블록과 대칭.
  - **TL-G 해결 방식 변경**: Suspense 래핑 대신 **`useSearchParams()` 자체를 제거** — `window.location.search` mount/popstate 파싱 + `push()`/`resetFilters()`가 자기 URL 쓰기를 로컬 미러링(T1의 스위처와 같은 접근). Suspense 방식은 정적 HTML이 fallback만 실어 SEO/LCP를 잃기 때문. `buildUrl`은 현재 pathname 유지(로케일 경로에서 필터 시 307 왕복 방지).
  - **어드민 즉시 반영 보존**: tour-product-pages PATCH의 revalidatePath에 `/{locale}/tours/list` 5종 + `/[locale]/tours/list` page 추가(베어는 T1 때 이미 존재).

### Wave B — Tours 데이터 경로 다이어트
- [x] **B1: 기본 진입 시 `/api/tours` fetch 스킵** (TL-3) — ✅ 구현. 구현 중 추가 발견: 렌더 순서가 `isInitialLoading ?`이 셸브보다 먼저라 **기본 진입도 2.5s API를 기다리며 스켈레톤을 보고 있었음** → 셸브 분기를 최우선으로 재배치 + 기본값 조합이면 fetch skip. `hasFetchedResults` 상태로 "첫 필터 활성화 직후 300ms 디바운스 창"에 빈 상태 플래시 방지. `CatalogueFooterStrip`은 셸브 뷰에서 tours 무관하게 표시(기존엔 fetch 완료 후 표시되던 것 — 오히려 개선).
- [x] **B2: `/api/tours` 캐시 강화** (TL-4) — ✅ `s-maxage=300, stale-while-revalidate=600`. ⚠ 주의: API 응답의 CDN 캐시는 revalidatePath로 퍼지되지 않으므로 그리드 썸네일은 최대 ~5분 지연 가능(리스트/상세 페이지 자체는 revalidatePath 즉시 반영이라 사용자 표면 영향 미미).
- [x] **B3: destinations idle 지연** (TL-6) — ✅ `requestIdleCallback`(폴백 500ms setTimeout)으로 하이드레이션 크리티컬 패스에서 제거.

### Wave C — Mypage API 왕복 다이어트
- [x] **C1: `getAuthUser` 경량 모드** (MP-2) — ✅ `getAuthUser(req, { skipRoleLookup: true })` — role/merchant 조회 스킵(요청당 DB 1~2왕복 절감), summary/extras 적용. JWT 로컬 검증(auth.getUser 왕복 제거)은 보안 등가성 검토 필요로 **후속 보류**.
- [x] **C2: summary 쿼리 다이어트** (MP-4) — ✅ completed 후보 100→25행 + 전용 슬림 SELECT(`PENDING_REVIEW_CANDIDATE_SELECT`, pickup_points 조인 제거). reviews 100은 유지(reviewedBookingIds 정합성).
- [ ] **C3 (보류)**: 프로필 중복 제거 (MP-3) — 콘텐츠 블로킹 경로가 아님(병렬 실행), 사이드바 전 라우트 공용이라 리팩터 리스크 대비 이득 낮음. 재측정 후 판단.
- [ ] **C4 (보류)**: summary+extras 단일 API 통합 — C1 적용 후 재측정에서 auth 오버헤드가 남을 때만.

### Wave D — 번들 (측정 후 판단)
- [ ] **D1: 카탈로그 클라 번들 다이어트** (TL-5) — `PER_LOCALE_PRODUCTS` 6로케일 전체가 클라이언트로 감. 활성 로케일만 dynamic `import()`하거나 카드 필드 슬림 생성 파일 분리. **A3+B1 후 번들 분석(next build --analyze 상당) 실측으로 효과 확인 후에만** — T2와 동일한 접근.

---

## 3. 착수 순서 + 기대 효과

| 순서 | 항목 | 난이도 | 기대 효과 |
|------|------|--------|-----------|
| 1 | A1 mypage force-dynamic 제거 + loading | XS | Mypage 탭 즉시 전환(셸) |
| 2 | A2 tours/list loading.tsx | XS | Tours dead-tap 제거 |
| 3 | A3 tours/list ISR + Suspense 가드 | M | 탭→콘텐츠 ~100ms (최대 항목) |
| 4 | B1 기본 진입 fetch 스킵 + B2 캐시 + B3 | S | 진입 시 DB 부하·대역폭 제거 |
| 5 | C1~C3 mypage API 다이어트 | S~M | 스켈레톤→콘텐츠 0.6~1.5s → ~0.3s |
| 6 | D1 번들 (조건부) | S | 첫 방문 청크 축소 |

## 4. 리스크 / 가드
- **어드민 썸네일 즉시 반영**(2026-05-25 플래시 회귀 이력): 서버 시드는 유지하되 ISR 재생성으로 이동 + 어드민 저장 revalidatePath. 시드 제거(완전 클라 폴백) 방식은 채택하지 않음.
- **CSR bailout**(Wave-2 재발 방지): A3 머지 전 프로덕션/로컬 HTML에 셸브 콘텐츠가 SSR로 실리는지 curl 확인 필수.
- **`?party=`/필터 딥링크**: searchParams는 클라이언트에서만 소비 — ISR과 충돌 없음(T1 선례).
- **mypage 인증 의미론 불변**: 게이트·리다이렉트·PII 노출 없음(정적 셸은 스켈레톤뿐).
- **revalidateTag 금지** — revalidatePath만(Next 16, T1 결정).

---

## 5. 결과 — 출하 + 프로덕션 after-metrics (2026-07-05)

**PR #256 머지 `8546bd90`.** 배포 삽화: 머지 시점에 Vercel 계정이 `DEPLOYMENT_DISABLED`(402, 결제 문제)여서 빌드가 스킵됨 — 결제 복구 후에도 **구버전이 서빙되고 있었음**(쿠키 307은 구 미들웨어도 하던 동작이라 신버전 증거가 아님 — 판별 기준은 `/tours/list`의 cache-control). 빈 커밋 `074b3a1f`로 재빌드 트리거하여 해결.

| 경로 | Before (G0) | After (실측) |
|------|-------------|--------------|
| `/tours/list` | **MISS 매회** (no-store), TTFB 0.62~1.53s, 문서 0.85~2.08s, SSR 투어링크 **0**(CSR bailout 빈 셸) | **HIT**, TTFB **0.14~0.33s**, 문서 **0.21~0.38s**, SSR 투어링크 **22** (268KB 콘텐츠) |
| `/ko/tours/list` | (쿠키 varying으로 캐시 불가) | on-demand ISR fill 1회(2.8s) 후 **HIT, TTFB 0.11s**, SSR 링크 22 |
| 기본 진입 그리드 대기 | `/api/tours` MISS **+2.5s** (셸브가 이걸 기다림) | **0** — fetch 자체 스킵, 셸브 즉시 |
| `/mypage` | HIT(이미 정적)·클라 API 왕복 과다 | HIT 유지 + API당 DB 1~2왕복 절감(C1)+슬림 쿼리(C2) |

체감: Tours 탭 최악 ~4.5s → **CDN 히트 시 ~0.2~0.4s + 셸브 즉시 렌더**. 실브라우저 QA(필터 클릭·딥링크·로케일 경로 유지·mypage 랜딩 풀로드) 통과.

**보류/후속**: C3(프로필 3중 조회)·C4(summary+extras 통합)·JWT 로컬검증 — Speed Insights 관찰 후 판단.

### D1 출하 (2026-07-05, PR #259 `b9232774`)

측정 게이트 통과 후 즉시 실행: 6로케일 통합 카탈로그 모듈(raw 230KB/gz 60KB)이 ShelvesContainer 경유로 `/tours/list` 초기 JS에 실려 있었음.
- 빌드 스크립트가 `catalogCards.<locale>.generated.ts`(로케일당 ~42KB) + `catalogCards.slugs.generated.ts` 추가 산출(통합 모듈은 서버·홈용으로 유지).
- `catalogRegistrationBuilder.ts`로 빌더+**SLUG_OVERRIDES**(가격 표면 — 복제 금지) 추출, 기존 `staticTourCatalogCards.ts`는 위임(동작 동일, 테스트 29/29).
- `staticTourCatalogCards.lazy.ts`: EN 인라인 + 로케일별 명시적 dynamic import + `useSyncExternalStore` 훅. 비EN은 청크 도착까지 EN 카피(i18n 메시지와 동일한 폴백 의미론).
- **홈 표면(매처·featured 등)은 의도적으로 무변경** — 통합 모듈 유지, Speed Insights가 정당화할 때 이관.
- 프로덕션 검증: ja 카탈로그 마커가 배포 전 초기 JS에 존재 → 배포 후 **전체 부재**(초기 JS raw ~−190KB); ISR HIT·SSR 콘텐츠 22링크 유지; 실브라우저 ko 카드 카피 정상 로컬라이즈.

### 카트 탭 (2026-07-05, PR #266 `e3aecdac`)

사용자 후속 리포트: "카트 진입이 아직 느리다". mypage/tours와 동일 클래스 3종:
- **CT-1**: `app/cart/page.tsx`의 무시되는 `force-dynamic` 제거(클라 컴포넌트라 이미 정적 ○ 셸) + `app/cart/loading.tsx` 추가(dead-tap 제거).
- **CT-2**: `/api/cart` GET/POST/DELETE → `getAuthUser(req, { skipRoleLookup: true })`. 카트는 user.id 스코프·role 미사용 → 요청당 DB 1~2왕복 절감. (`[id]` PUT/DELETE는 이미 `getUser`만 써서 무변경.)
- **CT-3**: 마운트 시 새 `supabase.auth.getSession()` → 공유 `useSession().getAccessToken()`(웜 토큰 재사용, 콜드 부트스트랩 6s 타임아웃 회피). 뮤테이션 핸들러도 동일. /mypage 랜딩 패턴.
- ⚠ **구현 중 버그 → 수정**: 첫 시도에서 `useCallback([session, t])` + `useEffect([status, fetchCartItems])`로 짰다가 **무한 refetch 루프**(라이브 200회+ 관측). 원인 = `useTranslations()`의 `t`가 매 렌더 새 참조(tours-list가 이미 문서화한 함정). 에러 라벨을 primitive로 추출 + `status` 게이트 제거 후 mypage식 `getAccessToken()` await로 재작성 → deps 전부 값-안정.
- 검증: 빌드 그린; `/cart` 정적 ISR HIT(웜 TTFB 5ms); `/api/cart` 미인증 401·쿠키세션 200(skipRoleLookup 정상); 루프 0회(수정 후); 테스트 회귀 0(카트 테스트 파일 부재, 실패 스위트는 브랜치 베이스 동일). ⚠ QA 한계: 헤드리스 브라우저 창이 백그라운드+사용자 포커스 거부로 **visible-tab 해피패스 렌더는 미관측** — 대신 API 200 직접 확인 + 루프 by-construction 증명 + mypage 검증패턴 재사용으로 갈음.
