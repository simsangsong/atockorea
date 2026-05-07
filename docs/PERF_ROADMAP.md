# 성능 개선 로드맵 — Phase 2/3 상세 계획서

> 이 문서는 Claude Code 세션 인계용. 새 세션에서 작업 하나를 시작할 때, 해당 섹션을 통째로 복사해 첫 메시지로 붙여넣으면 바로 실행 가능하도록 작성.
>
> 마지막 갱신: 2026-05-07 (A 작업 `057f903` 완료 직후)

---

## 0. 이미 완료된 작업 (참고용 — 다시 하지 말 것)

| # | Commit | 작업 |
|---|--------|------|
| 1 | `775e432` | 라이브 perf 1차 — hero MP4 lazy + 폰트 link + bundle 트리쉐이킹 + 이미지 압축 + blur 줄이기 + force-dynamic 명시 제거 |
| 2 | `95fe989` | `/jeju\|seoul\|busan/<slug>` → `/tour-product/<slug>` 308 redirect 통합 |
| 3 | `0610958` | day-flow + pickup card 디자인을 premium-minimal로 통일 |
| 4 | `d117af3` | i18n 이미지 fix — 언어 전환 시 EN 사진 유지 (`imageFieldFallback.ts`) |
| 5 | `ecb77be` | tour-product 스크롤 jank fix (A-E from audit) — TourTabsNav scroll-spy → IntersectionObserver, 이미지 dimensions, transition 제한, gallery 단순화 |
| 6 | `d7ce6c1` | Phase 1 — Speed Insights 활성화, review 이미지 lazy, Maps iframe IntersectionObserver, DatePicker dynamic import (LazyDatePicker wrapper), availability fetch debounce, FitSection/FaqSection transition 제한, sqlite3 dep 제거 |
| 7 | `057f903` | `/api/tours` 기본 응답을 compact로 (pickup_points join 드롭) |

**남은 핵심 미해결**: `app/layout.tsx:46`의 `await cookies()` — 모든 페이지 dynamic 강제. 이 문서의 Task 2~4 모두 어느 정도 이 문제와 연관.

---

## Task 1 — `/api/reviews` user_profiles join 통합 (Phase 2 완료)

### 한 줄 요약
지금 리뷰 목록 받을 때 DB가 두 번 일하는데(리뷰 100개 → 작성자 100명 따로), 한 번의 쿼리로 합쳐 응답 시간 -30%.

### 위험도: 🟠 (중간 — Supabase RLS 정책 검증 필수)

### 현재 상태
- 파일: [lib/reviews-queries.server.ts:42-72](../lib/reviews-queries.server.ts) — `attachReviewProfiles()` 함수
- 파일: [app/api/reviews/route.ts](../app/api/reviews/route.ts)
- 동작: 리뷰 N개 가져온 후 `user_profiles`에서 user_id batch로 다시 select. **N+1 anti-pattern**.

### ⚠️ 사용자 수동 작업 (반드시 먼저)

코드 변경 전에 Supabase 콘솔에서 직접 확인해야 할 것:

1. **Supabase Dashboard → Authentication → Policies → `user_profiles` 테이블** 열기
2. 현재 RLS policies 목록 확인. 다음 셋 중 어디에 해당하는지 파악:
   - **Case A**: `user_profiles SELECT` 가 모든 사용자 (또는 anon)에게 허용 → 자유롭게 join 가능. 가장 안전.
   - **Case B**: `auth.uid() = id` (자신 row만) → 익명 리뷰 fetch 시 다른 사용자 프로필 못 받음. **이 경우 join 안 됨**. 별도 public view 만들어야 함.
   - **Case C**: 부분 노출 (`full_name, avatar_url` 만 anon에게) → policy 또는 generated column으로 노출 항목 한정 가능.

3. **확인 결과를 새 세션 prompt에 포함시켜 주세요** (Case A/B/C 명시).

### 로직 재설계

#### Case A인 경우 (가장 단순)
- [lib/reviews-queries.server.ts](../lib/reviews-queries.server.ts)의 `attachReviewProfiles()` 함수 자체를 **제거**
- 메인 reviews select에 join 추가:
  ```ts
  // before
  const { data } = await supabase
    .from('reviews')
    .select('*')
    .eq('tour_id', tourId);
  // 그리고 attachReviewProfiles()로 별도 fetch

  // after — single query
  const { data } = await supabase
    .from('reviews')
    .select('*, user_profile:user_profiles(id, full_name, avatar_url)')
    .eq('tour_id', tourId);
  ```
- transform 단계에서 `r.user_profile.full_name` 등으로 access

#### Case B/C인 경우
- public view 생성 (Supabase SQL Editor):
  ```sql
  create view public.review_authors as
  select id, full_name, avatar_url
  from public.user_profiles;
  -- + RLS: select to anon, authenticated
  ```
- view를 join: `.select('*, user_profile:review_authors(id, full_name, avatar_url)')`
- view migration은 사용자가 Supabase Dashboard에서 직접 (또는 mcp__atockorea__apply_migration 사용 가능)

### 검토할 파일
- [lib/reviews-queries.server.ts](../lib/reviews-queries.server.ts) (전체)
- [app/api/reviews/route.ts](../app/api/reviews/route.ts) (메인 호출처)
- [app/api/reviews/home-summary/route.ts](../app/api/reviews/home-summary/route.ts) (이쪽도 영향 검토)
- 모든 caller — `grep -r "attachReviewProfiles\|/api/reviews" --include="*.ts" --include="*.tsx"` 

### 위험 요소
- **다른 사람 이름 노출** (RLS 우회 위험) — Case B에서 가장 위험
- **응답 shape 변경**: 기존 `review.full_name` → `review.user_profile.full_name`로 바뀔 수 있음. 모든 consumer 검사 필요
- **Supabase relational query 문법** — `user_profile:user_profiles(...)` foreign key가 PostgREST에 인지되어 있어야. Tables Schema에서 reviews.user_id → user_profiles.id FK 확인

### 검증 체크리스트
- [ ] dev: `/api/reviews?tourId=...` 호출 응답에 user_profile 객체 정상 포함
- [ ] dev: 익명(로그아웃) 상태로 호출 시에도 이름/아바타 정상
- [ ] dev: 응답 시간 측정 — 이전 대비 30% 이상 단축 확인
- [ ] dev: 모든 caller가 새 shape에 적응했는지 (TypeScript 빌드 통과)
- [ ] prod 가이드: 로그인한 사용자가 다른 사용자 이름이 본인 것으로 잘못 보이지 않는지 (캐시 키 분리 확인)

### 새 세션에서 시작할 prompt

```
docs/PERF_ROADMAP.md의 Task 1을 진행해주세요.

수동 사전 확인 결과:
- Supabase user_profiles RLS Case: [A / B / C 중 선택]
- (Case B인 경우) public view 생성 가능 여부: [yes/no]
- (특이사항 있으면 기술)

작업: /api/reviews의 N+1 패턴을 single join으로 통합. 단계적으로 진행 + 빌드 검증 + commit.
```

---

## Task 2 — Header auth waterfall → SSR (Phase 3)

### 한 줄 요약
모든 페이지 들어갈 때마다 Header가 (1) 로그인 상태 확인 → (2) 프로필 fetch 두 단계 직렬로 실행 (100~500ms). 서버에서 미리 가져와 HTML과 함께 보내면 깜빡임 + 지연 사라짐.

### 위험도: 🔴 (높음 — 잘못 캐시되면 보안 사고 가능)

### 현재 상태
- 파일: [components/Header.tsx](../components/Header.tsx) (Line 43–122 부근)
- 동작:
  1. 'use client' Header 마운트
  2. `useEffect(() => { ... supabase.auth.getSession() ... })` 실행
  3. session 있으면 → `supabase.from('user_profiles').select(...)` 또 호출
  4. 둘 다 끝나면 사용자 이름/아바타 표시
- 모든 페이지에서 Header 깜빡임 + 100~500ms TTI 지연

### ⚠️ 사용자 수동 작업

1. **Supabase auth cookie 검증**
   - `@supabase/auth-helpers-nextjs` 또는 `@supabase/ssr` 패키지 사용 여부 확인 (`grep -r "auth-helpers\|@supabase/ssr" package.json`)
   - 없으면 설치 결정 — Supabase 권장 방식. `npm install @supabase/ssr`
   - 있으면 그것 사용

2. **로그인/로그아웃 동작 직접 테스트 시나리오 정의**
   - 로그인 → 페이지 새로고침 → Header에 즉시 본인 이름 보이는지
   - 로그아웃 → Header 즉시 sign-in 버튼으로 바뀌는지
   - 다른 탭에서 로그아웃 → 이 탭은 어떻게 동기화?
   - 30분 후 토큰 만료 시?

### 로직 재설계 단계

#### Step 1: Server-side auth 헬퍼 추가
- 새 파일: `lib/auth/getServerUser.ts`
  ```ts
  // server-only
  import { cookies } from "next/headers";
  import { createServerClient } from "@/lib/supabase";

  export async function getServerUser() {
    const supabase = createServerClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id, full_name, avatar_url, role')
      .eq('id', session.user.id)
      .maybeSingle();
    return { id: session.user.id, email: session.user.email, ...profile };
  }
  ```

#### Step 2: Header를 server component로 분할
- `components/Header.tsx` → `components/HeaderShell.tsx` (server component, fetches user)
- 인터랙티브 부분 (drawer toggle, search modal 등)은 `components/HeaderInteractive.tsx` (client child)
- `HeaderShell`이 `getServerUser()` 호출 → user prop을 `HeaderInteractive`로 전달

#### Step 3: layout.tsx에서 새 Header 사용
- `<Header />` → `<HeaderShell />`로 교체 (현재는 `SitePageShell` 안에 있음)

#### Step 4: client-side auth state listener는 유지
- 로그인/로그아웃은 client에서 발생 → 그때는 `router.refresh()` 호출로 server component 재렌더 트리거
- `HeaderInteractive`에 listener:
  ```ts
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        router.refresh();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);
  ```

#### Step 5: 캐싱 검증
- Header를 포함한 페이지가 user-specific cache key 가지는지 — Vercel CDN, Next.js Data Cache 모두 검토
- `cookies()` 호출은 자동으로 dynamic 마킹 — 페이지 캐시는 user별로 분리됨 (Next.js 16 기준). 이걸 검증

### 검토할 파일
- [components/Header.tsx](../components/Header.tsx) (전체 — auth 로직 위치)
- [src/components/layout/SitePageShell.tsx](../src/components/layout/SitePageShell.tsx) (Header 사용처)
- [lib/supabase.ts](../lib/supabase.ts) (createServerClient 정의 위치)
- [lib/auth.ts](../lib/auth.ts)
- [app/layout.tsx](../app/layout.tsx) (root layout)
- 모든 페이지의 auth-protected route — middleware.ts 참조

### 위험 요소
- **🚨 캐시 사고**: 사용자 A가 사용자 B의 Header(이름)를 보면 보안 사고. cookies()로 dynamic 마킹되면 자동 분리되지만 검증 필수
- **로그인 직후 stale data**: SSR이라 화면에 즉시 반영 안 됨 → `router.refresh()` 필요
- **다른 탭 동기화**: 한 탭에서 로그아웃해도 다른 탭은 옛 Header 보임 → BroadcastChannel 또는 storage event 활용

### 검증 체크리스트
- [ ] dev: 로그아웃 상태로 페이지 진입 → Header에 sign-in 버튼 즉시 표시 (깜빡임 0)
- [ ] dev: 로그인 후 페이지 새로고침 → Header에 본인 이름 즉시 표시
- [ ] dev: 한 탭 로그아웃 → 다른 탭 새로고침 시 동기화 확인
- [ ] dev: Network 탭에서 Header 관련 client fetch 사라진 것 확인
- [ ] dev: 다른 사용자 계정으로 로그인 → 이전 사용자 정보 안 남는지 (incognito 탭으로 검증)
- [ ] prod 가이드: Vercel deploy 후 시크릿 창 + 로그인 창 둘 동시에 → 각자 다른 사용자 보이는지
- [ ] prod 가이드: Lighthouse Performance — Header TTI 100~300ms 단축 확인

### 새 세션에서 시작할 prompt

```
docs/PERF_ROADMAP.md의 Task 2를 진행해주세요. **위험도 높음 — 한 단계씩 신중히, 매 단계 빌드/lint 검증.**

수동 사전 확인 결과:
- @supabase/ssr 또는 auth-helpers-nextjs 설치 여부: [installed/not installed]
- 로그인/로그아웃 테스트 시나리오 정의됨: [yes/no]

작업: Header의 client-side auth fetch를 SSR로 이전. 단계 1~5 순서대로. 각 단계마다 commit 분리 (revert 단위로 안전). 마지막에 main push.

특히 검증: 캐시 누수 (사용자 A → B 정보 노출) 없는지 incognito 탭으로 직접 확인.
```

---

## Task 3 — mypage server component 분리 (Phase 3)

### 한 줄 요약
마이페이지 9개 페이지가 `'use client' + force-dynamic + useEffect fetch`로 매번 처음부터 새로 만들어짐. 서버에서 미리 데이터 챙겨 HTML과 함께 보내면 매 방문 -100~300ms.

### 위험도: 🔴 (높음 — auth 처리 + 사용자 데이터 캐시)

### 현재 상태
- 9개 페이지: `app/mypage/page.tsx`, `app/mypage/dashboard/page.tsx`, `app/mypage/history/page.tsx`, `app/mypage/mybookings/page.tsx`, `app/mypage/reviews/page.tsx`, `app/mypage/reviews/write/page.tsx`, `app/mypage/settings/page.tsx`, `app/mypage/upcoming/page.tsx`, `app/mypage/wishlist/page.tsx`
- 모두 `'use client'` + `export const dynamic = 'force-dynamic'`
- 마운트 후 `useEffect`로 fetch (Supabase 또는 API route)
- 페이지 진입 → blank → spinner → 데이터 → 화면 (느림)

### ⚠️ 사용자 수동 작업

1. **Task 2 (Header SSR) 먼저 완료 권장** — getServerUser() 헬퍼 재사용
2. **각 mypage의 데이터 의존성 mapping**: 각 페이지가 Supabase의 어떤 테이블을 쓰는지 직접 확인 후 알려주기
   - dashboard: ?
   - history: ?
   - mybookings: ?
   - reviews: ?
   - settings: ?
   - upcoming: ?
   - wishlist: ?
3. **로그아웃 사용자가 mypage 직접 URL로 접근 시 동작 정의**
   - 옵션 A: signin 페이지로 redirect (권장)
   - 옵션 B: empty state 표시

### 로직 재설계

#### Step 1: mypage layout에서 auth gate
- 새 파일: `app/mypage/layout.tsx` (server component)
  ```ts
  import { redirect } from "next/navigation";
  import { getServerUser } from "@/lib/auth/getServerUser";

  export default async function MypageLayout({ children }: { children: React.ReactNode }) {
    const user = await getServerUser();
    if (!user) redirect("/signin?next=/mypage");
    return <>{children}</>;
  }
  ```
- 9개 페이지 모두 자동으로 auth-gated

#### Step 2: 각 페이지를 server component로 변환 (한 번에 하나씩)
- 각 페이지를 두 컴포넌트로 분할:
  - `page.tsx` (server) — getServerUser() + 데이터 fetch + 결과를 client에 prop으로
  - `*Client.tsx` (client) — 인터랙션 (button, form 등)
- 데이터 fetch가 단순한 페이지부터 (예: settings) → 복잡한 페이지 (dashboard) 순서

#### Step 3: force-dynamic 라인 제거 (자연 dynamic)
- `cookies()` 호출이 layout/페이지 어디든 있으면 자동 dynamic. 명시적 force-dynamic 불필요

#### Step 4: revalidate 또는 streaming 검토
- 일부 정적 콘텐츠는 streaming + Suspense로:
  ```tsx
  <Suspense fallback={<DashboardSkeleton />}>
    <DashboardData userId={user.id} />
  </Suspense>
  ```

### 검토할 파일
- [app/mypage/](../app/mypage/) 9개 page.tsx 모두
- middleware.ts (mypage redirect 로직 — 있는지 확인)
- 각 페이지의 fetch 호출처 (`useEffect` 안)

### 위험 요소
- **🚨 사용자 데이터 누수**: 캐시가 사용자별 분리 안 되면 A의 booking이 B에게 보임. cookies() 사용 시 Next.js가 자동 분리하지만 검증 필수
- **로그아웃 시 redirect 무한 루프**: signin 페이지 자체가 mypage layout에 의존하면 안 됨
- **next 파라미터 처리**: redirect("/signin?next=/mypage/...") 후 로그인 시 원래 URL로 돌아오는지

### 검증 체크리스트
- [ ] dev: 로그아웃 상태로 `/mypage/dashboard` 직접 진입 → signin 페이지로 redirect
- [ ] dev: 로그인 후 `/mypage/*` 진입 → 즉시 데이터 표시 (spinner 없음)
- [ ] dev: 사용자 A 로그인 → mypage 본 후 → 사용자 B로 재로그인 → A의 데이터 흔적 없음
- [ ] dev: incognito 탭 + 일반 탭 동시 다른 사용자 → 각자 자기 데이터만
- [ ] dev: TTI 측정 — 매 방문 -100~300ms 확인
- [ ] dev: TypeScript 빌드 통과

### 새 세션에서 시작할 prompt

```
docs/PERF_ROADMAP.md의 Task 3을 진행해주세요. **위험도 높음 — 9개 페이지 한 번에 다 옮기지 말고, 한 페이지씩 commit 분리.**

사전 조건:
- Task 2 (Header SSR) 완료 여부: [yes/no]
- 9개 mypage의 데이터 의존성 mapping (Supabase 테이블):
  - dashboard: [...]
  - history: [...]
  - ...
- 로그아웃 사용자 행동: [redirect-to-signin / empty-state]

작업: Step 1 (auth gate layout) → Step 2 (각 페이지 server 변환, settings부터) → Step 3 (force-dynamic 제거) → Step 4 (Suspense streaming).

각 페이지마다 commit 분리. 캐시 누수 없는지 incognito + 일반 탭 둘로 직접 검증.
```

---

## Task 4 — `[locale]` SSR (Phase 3)

### 한 줄 요약
`/ko`, `/zh-CN` 같은 다국어 홈페이지가 클라이언트 redirect로 처리됨. 영어 깜빡임 + 추가 페이지 로드. 서버에서 미리 언어 결정해 보내면 -150~300ms.

### 위험도: 🟠 (중간 — middleware 충돌 + 다국어 SEO 검증)

### 현재 상태
- 파일: [app/[locale]/page.tsx](../app/%5Blocale%5D/page.tsx) (`'use client' + router.replace`)
- 동작:
  1. 사용자가 `/ko` 진입
  2. 영어 페이지가 SSR로 서빙됨 (locale 무시)
  3. client에서 `useParams()`로 locale 감지
  4. `router.replace('/?locale=ko')` 또는 비슷한 redirect
  5. 그제서야 한국어 페이지

### ⚠️ 사용자 수동 작업

1. **현재 라우팅 구조 정확히 파악**
   - middleware.ts의 locale 감지 로직 ([middleware.ts:68-90](../middleware.ts) 부근) 확인
   - `/ko`, `/zh-CN` 등이 어떻게 rewrite되는지 (NextResponse.rewrite vs redirect)
2. **다국어 SEO 정책 확정**
   - 한국어 페이지 URL이 `/ko`인가 `/`(쿠키 기반)인가? 둘 중 하나로 통일.
   - hreflang tags 어디서 생성되는지 확인 ([app/layout.tsx](../app/layout.tsx) 또는 SEO util)
3. **Google Search Console에서 현재 색인 상태 확인**
   - `/ko` 페이지가 색인되어 있나? `site:atockorea.com ko` 검색
   - 변경 후 사라지면 SEO 영향. redirect 정책 신중히

### 로직 재설계

#### Step 1: middleware 분석 + 결정
- 현재 middleware가 `/ko` → `/?locale=ko`로 rewrite 한다면, 별도 `app/[locale]/page.tsx` 불필요
- 만약 `/ko/...` URL을 그대로 유지하려면 → `app/[locale]/layout.tsx` + `app/[locale]/page.tsx` 모두 server component로

#### Step 2 (Option A — locale-prefixed URL 유지)
- `app/[locale]/page.tsx`를 server component로 변환:
  ```tsx
  // No 'use client'
  import { HomeMainBody } from "@/components/home/HomeMainBody";
  import { SitePageShell } from "@/src/components/layout/SitePageShell";

  export default async function LocalizedHome({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    // 검증
    if (!["en", "ko", "zh-CN", "zh-TW", "ja", "es"].includes(locale)) notFound();
    return <SitePageShell><main><HomeMainBody locale={locale} /></main></SitePageShell>;
  }
  ```
- locale prop을 hierarchy 아래로 전파 (또는 LocaleProvider context server-side)

#### Step 2 (Option B — middleware rewrite로 일원화)
- `/ko` 등을 middleware에서 `/?locale=ko`로 rewrite (이미 그렇게 되어 있는지 확인)
- `app/[locale]/page.tsx` 자체를 **삭제** + redirect만 처리 (또는 그대로 두고 server-side redirect)
- root `app/page.tsx`가 cookies()로 locale 감지 + 콘텐츠 분기

#### Step 3: hreflang tags
- root layout 또는 페이지 metadata에서 locale별 hreflang 자동 생성
  ```tsx
  alternates: {
    languages: {
      en: "https://atockorea.com/",
      ko: "https://atockorea.com/ko",
      // ...
    }
  }
  ```

### 검토할 파일
- [middleware.ts](../middleware.ts) (locale 처리 로직)
- [app/[locale]/page.tsx](../app/%5Blocale%5D/page.tsx)
- [app/[locale]/error.tsx](../app/%5Blocale%5D/error.tsx)
- [lib/i18n.ts](../lib/i18n.ts) (I18nProvider — client side i18n)
- [lib/seo/](../lib/seo/) (hreflang 생성 위치)

### 위험 요소
- **SEO 회귀**: 색인된 URL이 변경되거나 중복 색인 (Google이 `/`와 `/ko` 모두 색인하면 canonical 분산)
- **middleware 무한 redirect**: rewrite가 또 매칭돼서 loop 가능
- **next-intl 패키지 영향**: 사용 중인지 확인 — 현재 `next-intl` package.json에 있음. 라우팅과 별개로 messages만 사용일 수도

### 검증 체크리스트
- [ ] dev: `/ko` 직접 접근 → 한국어 페이지 즉시 SSR (영어 깜빡임 0)
- [ ] dev: 모든 locale (`en`, `ko`, `zh-CN`, `zh-TW`, `ja`, `es`) 진입 정상
- [ ] dev: middleware redirect chain 1회 이내 (Network 탭으로 확인)
- [ ] dev: Lighthouse Mobile FCP/LCP — `/ko`에서 -150~300ms
- [ ] dev: hreflang tags HTML에 정상 출력 (View Source)
- [ ] prod 가이드: Search Console에서 색인 상태 변화 monitoring (배포 후 1주일)

### 새 세션에서 시작할 prompt

```
docs/PERF_ROADMAP.md의 Task 4를 진행해주세요.

사전 조건:
- middleware 분석 결과: [Option A locale-prefixed 유지 / Option B rewrite로 일원화]
- 다국어 SEO 정책: [/ko URL 유지 / / 쿠키 기반]
- Google Search Console 색인된 locale URL: [/ko, /zh-CN, ... 등 명시]

작업: 결정된 옵션에 따라 [locale] 라우트 server-side로 전환. middleware 충돌 없는지 dev에서 redirect chain 검증. hreflang tags 정상 출력 확인.

배포 후 1주일간 Search Console 모니터링 가이드 마지막에 첨부.
```

---

## 권장 작업 순서

```
Task 1 (reviews join, 1시간, RLS 검증 후)
   ↓
Task 4 (locale SSR, 반나절, SEO 정책 확정 후)
   ↓
Task 2 (Header SSR, 하루, auth 인프라 정비 함께)
   ↓
Task 3 (mypage SSR, 하루~이틀, Task 2 완료 후 — getServerUser 재사용)
```

이유:
- Task 1은 risk 낮고 효과 즉시 (DB 부담 -90%)
- Task 4는 SEO 검증만 끝나면 단순 변환
- Task 2는 Task 3의 prerequisite (auth 인프라 공통)
- Task 3은 가장 risk 큼 — 마지막에

## 단일 세션에서 한꺼번에 하지 말 것

각 Task는 독립 세션. 한 세션에서 두 개 동시 진행 시:
- context 부담 → 실수 위험 ↑
- 캐시 검증 / RLS 검증 등 수동 단계 누락 가능
- commit 분리 어려움 → revert 단위 모호

**한 세션 = 한 Task 원칙**.

## 각 Task 완료 후

1. 변경된 commit 해시를 이 문서의 "이미 완료" 표에 추가
2. 해당 Task 섹션을 "✅ 완료 (commit XYZ)"로 표시
3. 발생한 문제/배운 점은 해당 섹션 마지막에 "📝 노트" 추가

## 배포 후 측정

Vercel Speed Insights ([commit d7ce6c1](commit/d7ce6c1)에서 활성화) — 24시간 누적 후 비교:

- p75 LCP: tour-product, mypage, home 각각
- p75 FCP: 동일
- TTI 차이

각 Task 효과 추정:
- Task 1: 리뷰 응답 -30% (직접 측정)
- Task 4: locale 사용자 FCP -150~300ms
- Task 2: 모든 페이지 TTI -100~300ms
- Task 3: mypage TTI -100~300ms
