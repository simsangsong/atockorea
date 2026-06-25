# 다음 세션 마스터 프롬프트 — 어드민 대시보드 개편 **Wave 4 페이지 개편 이어가기**

> 아래 블록 전체를 다음 세션 첫 메시지로 붙여넣으면 그대로 실행 가능.
> **이 문서는 2026-06-25 Wave 4 세션(원격 Linux/web 환경)의 인수인계.** 이전 부트스트랩(`docs/NEXT-SESSION-EXECUTION-PROMPT-2026-06-25.md`)은 보안/lib 트랙 기준이라 이제 stale — **이 문서가 최신**.
> 갱신: 2026-06-25 — Wave 4 페이지 개편 6 PR(#182~#187) main 머지. 대시보드·주문목록·분석허브·챗봇분석·머천트(목록·생성·상세) 완료.

---

역할: 너는 세계 최고의 풀스택 엔지니어이자 1등 UI/UX 디자이너이며 꼼꼼한 코드 감사자다. AtoC Korea 어드민 대시보드 전면 개편의 **Wave 4(페이지별 프리미엄 모바일 개편)** 구현을 이어받아 실행한다. 진행/상태 보고는 **한국어**(코드·커밋 메시지는 영어).

## 0) 단일 기준 문서 (읽기 순서)
1. **이 파일** (Wave 4 부트스트랩 + 환경)
2. `docs/admin-dashboard-upgrade-master-plan-2026-06-24.md` — **SoT**. 특히 **§A(상태)·§B(결정 로그)·§C(변경로그, 최신 위쪽)·§R Wave 4 WBS·§8.x 청사진 참조**
3. `docs/admin-premium-mobile-design-spec-2026-06-24.md` — **§8.1~8.4 페이지 청사진 + §7 컴포넌트 키트**(이미 구현된 토큰/키트)

---

## 1) ⚙️ 이 환경의 비자명한 사실 (중요 — 반드시 숙지)

이 세션은 **원격 Linux(claude.ai/code web) 환경**이다. 이전 세션들이 가정한 Windows 워크트리(`C:\Users\sangsong\atockorea-admin`)·정션 등은 **여기 해당 없음**.

1. **작업 브랜치 = `claude/next-session-execution-ysuww9`** (이 환경에 지정된 브랜치). 메인 working dir `/home/user/atockorea`에서 바로 작업. 플랜의 `claude/admin-dashboard-upgrade-yvb88c`가 아님 — 혼동 금지.
2. **`node_modules`는 클론 직후 없을 수 있음.** lockfile이 살짝 어긋나(`@swc/helpers`) `npm ci`는 실패함 → **`npm install --no-audit --no-fund` 사용**(약 30초·1200패키지). 끝나면 `cp package-lock.json <backup>` 후 **lockfile은 원복**해서 diff 오염 방지(`git checkout package-lock.json` 또는 백업 복사).
3. **빌드 env가 없음.** `npm run build`엔 `.env.local`이 필요 → placeholder로 생성(빌드만 통과시키는 용도, gitignore됨):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key
   SUPABASE_SERVICE_ROLE_KEY=placeholder-service-role
   ```
   빌드 로그 끝에 `ENOTFOUND placeholder.supabase.co`(prerender fetch 실패)는 **가짜 DB라 정상**·컴파일과 무관. `✓ Compiled successfully`만 확인하면 됨. **빌드 후 `.env.local` 삭제**.
4. **라이브 DB(atockorea `cghyvbwmijqpahnoduyv`)는 이 환경에서 접근 불가.** `mcp__Supabase__list_projects`가 **Kursoflow(`thgyevrqykkscvcpwmfp`)만** 반환 — 과거 "K-0" 상황과 동일. ⇒ **DB 마이그레이션/advisor 의존 티켓은 이 세션에서 검증 불가**. 그런 티켓은 `mcp__atockorea__*`가 연결된 세션에서.
5. **검증 명령어**(로컬 바이너리 직접):
   - `node_modules/.bin/tsc --noEmit -p tsconfig.json` (0 에러 필수)
   - `node_modules/.bin/jest --ci` (전체) 또는 `node_modules/.bin/jest <path>` (변경범위)
   - `npm run build` (위 env 세팅 후, `✓ Compiled successfully` 확인)
   - ⚠️ `npx jest` 금지(엉뚱한 버전).
6. **테스트 baseline = `549 pass / 8 fail`**(이 세션 기준). **8 fail은 origin/main의 기존 환경결함이라 회귀 아님**:
   - 폴리필 부재: `__tests__/lib/error-handler`·`lib/logger`·`api/tours`·`utils/test-utils.tsx`(no-test)
   - 콘텐츠 stale: `__tests__/tour-content/phase-z-known-bad-strings`(jeju haenyeo 타이밍)
   - **새 변경 후에도 이 8개만 실패해야 정상.** 내 테스트 추가 시 pass 수만 증가.
7. **`server-only` 가드**: 패키지가 node_modules에 물리적으로 없지만 `next/jest`+tsc가 해석함(repo의 `.server.ts`들이 이미 사용). `import 'server-only'`는 tsc·jest·build 모두 통과. **단, 클라 컴포넌트에서 import되면 빌드 실패** → 추가 전 그 모듈이 `app/api/**` 등 서버에서만 import되는지 grep으로 먼저 확인.

---

## 2) 워크플로 — 매 페이지(티켓)마다 (사용자 합의: §B 결정)

**사용자가 preview 게이트를 해제했다(§B 2026-06-25 결정): preview 없이 진행, 매 스텝 완료 시 main 머지·푸시 → 사용자가 라이브에서 직접 시각/UX 검증.** 따라서:

1. 다음 티켓 선택(§4 우선순위). 착수 전 한 줄 계획 공유. **모든 file:line은 코드 직접 대조.**
2. 구현 — **Wave 1 키트 재사용**(`components/admin/*`·토큰·sonner·lucide·framer-motion)·**신규 의존성 0**. 로직 있으면 순수 헬퍼로 추출해 단위테스트(`lib/admin/*` 패턴).
3. 검증: `tsc` 0 + 변경범위 jest + 전체 jest(549/8 유지) + `npm run build` ✓Compiled.
4. 커밋(티켓 단위, 영어 메시지) → 푸시 `git push -u origin claude/next-session-execution-ysuww9`.
   - **커밋 푸터는 `Co-Authored-By: Claude <noreply@anthropic.com>`만**(모델 식별자·세션 URL 금지). git config는 이미 `noreply@anthropic.com`/`Claude`.
5. 플랜 `docs/admin-dashboard-upgrade-master-plan-2026-06-24.md` **§C(맨 위 행 추가)·§A(현재 활성 Phase 줄 갱신)** 업데이트 → 커밋·푸시.
6. **main 머지**: GitHub MCP 툴 사용(`ToolSearch "select:mcp__github__create_pull_request,mcp__github__merge_pull_request"`). PR 생성(base `main`, head `claude/next-session-execution-ysuww9`) → `merge_method: "merge"`로 머지. 머지 후 `git fetch origin main && git merge --ff-only origin/main`로 브랜치 재동기화.
   - **PR 본문 푸터**: `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
   - ⚠️ **Stop hook 경고는 무시**: GitHub 머지 버튼이 만든 머지 커밋(committer `noreply@github.com`)을 ff-sync로 가져오면 매번 "Unverified" 경고가 뜸. **내 커밋이 아니고 이미 main에 있으므로 reset-author 금지**(브랜치가 main과 갈라짐). 정상·무해.
7. 한국어로 완료 보고(라이브 확인 포인트 명시) + 다음 후보 제시.

---

## 3) ✅ 지금까지 완료(머지됨) — 다시 하지 말 것

### 이번 Wave 4 세션 (2026-06-25, PR #182~#187, 전부 main 머지)
- **W3.10 lib 비-pricing**(`1fba271`, PR #182): **LIB-6**(`authorized` 결제상태 한국어 라벨 복원 — stray override가 평문영어로 클로버링한 것 수정, 순수 `lib/email/payment-status-label.ts` 추출+테스트)·**LIB-good**(`lib/email.ts` `import 'server-only'` 가드).
- **CB-1 CORS**(PR #182 동봉): `/api/agent/v1/*` 와일드카드는 의도적·안전 → verify-and-document 종결(코드변경0).
- **W4.3 대시보드**(`87b0fe7`, PR #182, §8.1): 액션큐 우선배치(대기예약+미처리문의, 비0=amber)·StatCard KPI 그리드·**7일 매출 스파크라인**(의존성0 인라인SVG)·**D-1 수정**(미처리문의 실카운트 `contact_inquiries status='new'`·가짜"새 리뷰"0카드 제거·최근활동 가격 null-safe·alert→toast)·skeleton·floating help 제거. API `/api/admin/stats`에 `newContacts`+`revenueTrend7d` 추가, 순수 `lib/admin/revenue-trend.ts`+테스트.
- **W4.2 주문 목록**(`38e80c6`, PR #183, §8.2): **sticky 필터바**·**신규 검색박스**(클라이언트)·필터 **URL 이관**(`useUrlFilters`)·한국어+토큰·alert→toast·skeleton·**D-2** CSV에 Source/Currency 컬럼·금액 null-safe.
- **W4.7-a 분석 허브**(`0906ccb`, PR #184, §B): 레거시 `/admin/analytics` placeholder(가짜차트·**USD를 ₩로 오라벨**·이모지) 폐기 → 통화정확 비즈니스요약 + **엔진 8섹션 런처**(상품분석/이벤트/퍼널/리텐션/A·B실험/세션/챗봇/헬스). §B IA 결함 해소.
- **W4.8 챗봇 분석**(`4b5abe5`, PR #185): **에스컬레이션율 KPI 렌더**(API는 계산했으나 미표시)·**기간선택기 7/30/90일**·StatCard 토큰·이모지→Lucide·alert→toast·skeleton.
- **W4.6 머천트 영역 완료**:
  - 목록(`3f231cf`, PR #186): status/delete `confirm()` → **ConfirmSheet**·alert→toast·토큰·skeleton(iOS WebView confirm=true 무대화상자 홀도 차단).
  - 생성+상세(`ccaeb62`, PR #187): 전영문→한국어·**자격증명 alert 제거**(API가 임시비번 이메일발송[D-4]·정확한 인라인 성공상태)·**sticky CTA**·**dirty 가드**(beforeunload)·detail status confirm→ConfirmSheet·verify+alert→toast.

### 이전 세션들(머지됨, 요약 — 상세는 §C)
- Wave 0(보안·머니 6건, PR #167)·Wave 1 기반(토큰·키트 W1.1~1.8, PR #168)·Wave 3 안정화(11건, PR #169/170).
- Wave 9 공개보안(PA-1/2/N17/N11/N13/N16/P2/P4/CB-5/PA-3·N14/N19/N20·N18/P6·N34·PA-4/5/6·CB-2, PR #171·172·…·181)·N21/P3 verify·W3.8 B-2/M-8.
- D-15 analytics 3 BLOCKER(PR #172)·W5.7 환불경로(PR #173).
- **§R-9 보안 트랙 비-게이트 항목 소진 완료.**

---

## 4) 🎯 다음 우선순위 = Wave 4 남은 페이지 (§R Wave 4)

머니 무관·자기완결·시각 임팩트 큰 순. **각 페이지 = 1 PR.**

### 추천 다음 착수 (게이트 없음)
1. **엔진 페이지 §8.4** — `app/admin/analytics/product/page.tsx`(오버뷰) 먼저. KPI 카드 내 스파크라인·range 칩(기간선택기)·통합 일일트렌드·상위이벤트. 이후 `sessions/page.tsx`(SessionCard, grid-cols-12 교체)·`retention/page.tsx`(frozen 1열 히트맵·stale 공지 상단). **분석 허브에서 이미 링크됨** — 실제 엔진 페이지 모바일/시각 개편이 남음. (W4.7 본체)
2. **W4.9 POI/CMS/업로드** — `app/admin/match-pois`(w-80→lg:flex 모바일)·`cms`·`upload`(hover→tap). match-pois는 모바일 0 페이지였음.
3. **W4.5 정산 운영 UI** — ⚠️ **게이트**: W5.2 RPC v2 동시배포 필요(데이터 트랙). 지금 하지 말 것.

### 게이트/신중
- **W4.4 통합 인박스**(신규 `/admin/inbox`, §8.3) — **신규 API `/api/admin/inbox`(contact/email/support UNION) 선행 필요**. API부터 만들어야 함(중간 규모). 바텀탭 5슬롯(W1.10)도 이걸로 해제.
- **W4.1 주문 상세 머니액션 시트**(`/admin/orders/[id]`, §8.2 상세) — ⚠️ **머니 직결**(confirm()→머니 확인시트·청구/현장/노쇼·환불). 블라인드 변경 리스크 최대 → **라이브 확인 각별히 신중**, 가능하면 사용자와 단계 합의 후. ConfirmSheet(`amount` prop)·`lib/payments/*` 재사용.
- **W4.10 설정/감사로그 UI** — 일부 게이트(W3.1 site_settings=마이그레이션 게이트, W5.4 audit). 토큰 채택 부분만 가능.

### 여전히 막힌 트랙(임의로 하지 말 것)
- **마이그레이션/DB**(W2.1·W3.1·Wave 5 데이터모델·Wave 6 perf): 라이브 DB 미접근(§1.4). `mcp__atockorea__*` 세션 필요.
- **pricing 민감**(LIB-2 DMZ 차량등급·LIB-3 FX 폴백): 실요금표 대조·사용자 확인. 정수/반올림 변경 금지.
- **세무(Wave 8)**: CPA SIGN-OFF(§G-5) + §J #2/#3 게이트.
- **D-15 보류 2건**(visitors distinct-over-range·retention left-censor): 설계 결정 게이트(원시 COUNT DISTINCT vs MV/RPC).

---

## 5) 🧰 재사용 자산 (이번 세션에서 검증된 패턴)

- **레이아웃**: `app/admin/layout.tsx`가 **글로벌 sticky 헤더(top-0, breadcrumb)** 제공 → 페이지에서 `AdminPageShell` 쓰면 **헤더 중복**. 일반 페이지는 `<div className="space-y-6">` 루트로, sticky 필터바가 필요하면 `sticky top-0 -mx-4 -mt-4 ... px-4 pt-4 md:-mx-5 md:-mt-5`(주문목록 패턴) 직접 사용.
- **키트**: `StatCard`/`StatCardSkeleton`·`Skeleton`·`ConfirmSheet`(바텀시트, `amount`/`destructive`/`noteTone` props)·`DataCard`·`FilterBar`·`ActivityRow`·`BookingStatusBadge`·`AdminPageShell`(상세페이지용).
- **훅/유틸**: `useUrlFilters(defaults)`→`{filters,setFilter,setFilters,resetFilters}`(필터 URL 이관)·`lib/admin/haptics`·`lib/admin/kst-day`(`kstDayBounds`).
- **토큰**: `bg-admin-surface`·`bg-admin-surface-hover`·`bg-admin-surface-raised`·`border-admin-border`·`rounded-design-md`/`-sm`·`shadow-admin-card`·`tabular-nums`. 색: slate 중립 + **blue-600 액센트**(링크/CTA) + status는 emerald/amber/red.
- **피드백**: `import { toast } from 'sonner'`(Toaster는 layout에 마운트됨, `toast.success/error`). `alert()`/`confirm()` **전면 금지**(§B 결정) → toast + ConfirmSheet/ConfirmDialog.
- **아이콘**: `lucide-react`(이모지 금지). `size-4`/`size-5`, `strokeWidth={1.75}`.
- **폼**: 입력 `text-base`(16px, iOS 줌 방지)·컨트롤 `min-h-11`(44px 터치)·sticky CTA 바·dirty 가드(beforeunload) — 머천트 create 패턴 참고.

---

## 6) 절대 규칙 / 회귀 금지

- **하지 말 것**: requireAdmin 약화·service-role 키 클라번들 노출·웹훅 서명검증 제거·머니 cron fail-open화·**pricing 정수/반올림 변경**·재고(product_inventory) UI 추가(availability unlimited 결정)·신규 npm 의존성(모바일).
- **통화 표기**: USD/KRW 절대 혼합 금지(대시보드/허브에서 ₩오라벨 버그 수정함). `formatBookingPrice(amount, currency)` 사용, currency 모르면 라벨 분리.
- **마이그레이션 additive only** + 적용 후 advisor 재실행 — **단 이 환경은 DB 미접근**이라 DB 티켓은 다른 세션.
- 병렬 감사 에이전트엔 **"하위 에이전트 spawn 금지 + 최종 메시지로 직접 반환"** 명시.
- 진행 보고 **한국어**.

---

## 7) 착수 한 줄

**다음 착수 지점**: §4 추천 1 = **분석 엔진 오버뷰(`app/admin/analytics/product/page.tsx`, §8.4)** 모바일/시각 개편. (사용자가 다른 페이지 지정 시 그쪽 우선.) 승인/지시 즉시 §2 워크플로로 1 PR 진행.

> 갱신: 2026-06-25 Wave 4 세션 — 페이지 개편 6 PR(#182~#187) 머지. 환경=원격 Linux·DB 미접근·매스텝 main 머지. 상세 §3 + 플랜 §A/§C.
