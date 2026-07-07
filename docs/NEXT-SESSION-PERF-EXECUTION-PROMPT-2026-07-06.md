# 다음 세션 실행 프롬프트 — 사이트 전반 속도 업그레이드 (Perf v2)

> 이 파일을 다음 세션 시작 시 첫 번째로 읽어라. 사이트 전체 성능 트랙을 이어받는 부트스트랩이다.

---

## 0. 한 줄 상태
셸(틀)은 사이트 전반 이미 건강(전 주요경로 PRERENDER, TTFB 0.09~0.58s) + **함수 리전 서울(icn1) 고정 완료로 모든 동적 API 5배** 빨라짐. **남은 병목 4갈래 = ① 인증 API 왕복 ② 초기 JS 번들 ③ DB RLS ④ 체크아웃/빌더**. 플랜은 확정, **Tier 1(반나절·위험0)부터 미착수**.

## 1. 읽기 순서 (SoT)
1. **`docs/site-performance-master-plan-v2-2026-07-06.md`** ← 단일 실행 기준. Tier 1~6 전부 파일:라인·효과·위험 포함.
2. `docs/site-performance-tours-mypage-plan-2026-07-04.md` (Phase 3 — 탭·카트·로케일홈·함수리전, §5에 프로덕션 after-metrics)
3. `docs/site-performance-landing-detail-plan-2026-07-04.md` (Phase 2 — 홈·상세)
4. 메모리 `project_site_performance_master_plan.md`

## 2. 환경 / 워크플로 규칙 (엄수)
- **작업 워크트리**: `C:\Users\sangsong\atockorea-perf-tabs` (메인 dir `C:\Users\sangsong\atockorea`는 타 세션 경합). 시작 시 `git fetch origin main && git checkout -b <branch> origin/main`. env는 메인에서 복사되어 있음(`.env.local`).
- **라이브 DB**: `mcp__atockorea__*` (execute_sql·get_advisors·apply_migration). DDL은 additive + 적용 후 `get_advisors` 재실행.
- **출하 승인됨**: 빌드 그린+검증 후 commit→PR→merge→push를 태스크당 승인 없이. gh 미설치 → GitHub REST API(`feedback_ship_workflow_authorized`). merge commit.
- **커밋 푸터**: `Co-Authored-By: Claude <noreply@anthropic.com>`만. 모델 식별자 금지.
- **진행 보고 한국어**, 코드·커밋 영어.
- **`revalidateTag` 금지**(Next16) → `revalidatePath`만.
- **문서는 워크트리 docs/에** 두고 커밋(메인 dir에 두면 타 세션 pull 충돌).

## 3. 다음 착수 = Tier 1 (한 PR로 묶기, 브랜치 `perf/tier1-quick-wins`)
플랜 §1 전체. 순서:
1. **T1-A skipRoleLookup 확산**: `getAuthUser(req,{skipRoleLookup:true})` 적용 →
   `app/api/bookings/route.ts:25`(GET), `app/api/wishlist/route.ts`(GET:17·POST:76·DELETE:184), `app/api/reviews/route.ts:30`(본인목록 GET), `app/api/tour-product/assistant/route.ts:777`. (옵션 시그니처는 `lib/auth.ts`에 이미 존재 — mypage/cart에서 검증됨.)
2. **T1-B 캐시 헤더** (플랜 §1 표): `reviews/home-summary`·`tour-product-card-media`(no-store→s-maxage=600)·`tours/[id]`(force-dynamic 제거)·`itinerary-builder/pois`(+`.limit(500)`)·`reviews` 공개분기·`agent availability`. **본인분기·뮤테이션은 private/no-store 유지.**
3. **T1-C force-dynamic 제거**: `app/mypage/{dashboard,mybookings,upcoming,history,reviews,wishlist,settings}/page.tsx:3` 7개. (클라 컴포넌트라 무효인데 정적 셸 차단.) 투어 체크아웃 클라측 확인 후.
4. **T1-D 챗봇 lazy**: `components/GlobalAiAssistant.tsx:5` 정적 import → `dynamic(()=>import('@/components/product-tour-static/_shared/TourProductAiAssistantWidget').then(m=>m.TourProductAiAssistantWidget),{ssr:false,loading:()=>null})`. 전 페이지 −15KB gz.
5. **T1-E loading.tsx**: mypage 서브라우트 7개(현재 단일 랜딩 스켈레톤이 모든 탭에 형태 미스매치)·`tour/[id]/checkout`·`itinerary-builder/checkout`·`itinerary-builder`.

**검증**: `npm run build` 그린 + `npx jest`(베이스라인 7 fail은 기존 인프라 문제 — 신규 fail 0 확인) + 로컬 prod-server(`npx next start -p 31XX`)에서 `X-Vercel-Cache`/헤더 확인. 그 후 PR·merge·push. 배포 후 프로덕션 `X-Vercel-Cache` 반복히트 실측.

그 다음: **Tier 2 번들**(홈 −150~180KB) → **Tier 4 체크아웃** → **Tier 3 빌더** → **Tier 5 DB(마이그레이션)**.

## 4. 이번 세션 핵심 교훈 / 함정 (반복 방지)
- **"홈/메인 느림" 신고 = `/`가 아니라 사용자 실경로(`/ko`)부터 확인**. 최적화가 `/`(영어)만 타면 비영어 사용자 홈은 미최적. (PR #270이 이걸 잡음.)
- **동적 API 느리면 코드 전에 인프라 지오그래피**: `x-vercel-id`(함수 리전) vs DB 리전(server IP→AWS 대역, `2406:da12`=서울) 대조. 이번 최대 이득이 `vercel.json` 한 줄(icn1)이었음.
- **CSR `BAILOUT_TO_CLIENT_SIDE_RENDERING` 마커는 양성** — `dynamic(ssr:false)`의 정상 산물. 홈은 완전 프리렌더됨. 이걸 "버그"로 쫓지 말 것.
- **캐시 검증은 `X-Vercel-Cache` 반복히트로**. Vercel이 s-maxage를 **클라 응답 헤더에서 제거**해 `public,max-age=0`으로 보임 → 헤더만 보고 "미캐시" 오판 금지(destinations·tours 등 이미 HIT).
- **Vercel 402(DEPLOYMENT_DISABLED) 중 머지 = 빌드 스킵** → 결제 복구 후에도 **구버전 서빙**. 신버전 판별은 동작변화 헤더(cache-control·x-vercel-id)로. 해결=빈 커밋 재트리거.
- **헤드리스 브라우저 QA는 백그라운드 창에서 렌더러 프리즈**(CDP 45s 타임아웃) 빈발 → 인증 API는 curl/직접 fetch, 렌더는 by-construction+프록시(`/api/tours`) 측정으로 갈음. 실측 못 하면 정직하게 명시.
- **jest 베이스라인**: origin/main에서도 4 suites/7 tests fail(NextResponse.json 목킹 인프라 문제, 내 변경 무관). 신규 fail만 본다.

## 5. 🔴 사용자 조치 게이트 (선행 필요 — 못 넘어감)
**Tier 6-A JWT 로컬 검증**(플랜 §6): ~72개 인증 엔드포인트가 매 요청 GoTrue `auth.getUser()` 네트워크 검증. 로컬 JWKS 검증으로 요청당 왕복 1회 제거(집계 최대 이득)인데 —
- **현재 막힘**: 라이브가 **legacy HS256 공유시크릿**(JWKS 빈 배열) → `getClaims()`가 네트워크 no-op. **지금 도입 금지.**
- **사용자가 해야 함**: Supabase Dashboard → JWT Keys → **비대칭키(ES256) 마이그레이션+로테이트**. 완료되면 착수: `getClaims()` 로컬검증 + custom access-token hook으로 `user_role` 클레임 주입(role 조회도 소멸) + access TTL 1800s + 민감뮤테이션(refund/settle/delete-user)은 `getUser()` 재검.
- **다음 세션에서 사용자에게 이 마이그레이션 했는지 먼저 물어라.**

## 6. 미착수 Tier 요약 (플랜이 SoT — 여기선 인덱스만)
- **T2** 번들: FeaturedShowcase 카탈로그 eager import 제거(−70KB), framer 글로벌셸 CSS화(−20~40KB), Header supabase lazy(−55KB), 빌더 코드분할.
- **T3** 빌더: `content_locales` 6로케일 과다직렬화(Jeju −250KB), POI next/image, 프리셋 LLM 스킵.
- **T4** 체크아웃: 투어 체크아웃 공유 useSession(카트 안티패턴 재발), booking POST 직렬체인 병렬화, Stripe lazy, 카트→체크아웃 projection.
- **T5** DB: RLS auth_rls_initplan 63건 `(select auth.uid())` 재작성(유저-RLS 경로 감사 후), multiple_permissive 68건 통합(tours 우선), self-fetch 제거(availability·match-explanation), 풀러 확인. **주의: service-role 클라는 RLS 우회 → `createUserSupabaseClient` 경로만 물림.**
