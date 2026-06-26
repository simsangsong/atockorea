# 다음 세션 마스터 프롬프트 — 어드민 대시보드 **Wave 4 마무리 + W4.1 머니시트**

> 이 블록 전체를 다음 세션 첫 메시지로 붙여넣으면 그대로 실행 가능.
> **이 문서가 최신.** 이전 핸드오프(`docs/NEXT-SESSION-EXECUTION-PROMPT-2026-06-25-wave4.md`·`-2026-06-25.md`)는 stale.
> 갱신: 2026-06-26 — Wave 4 페이지 개편 5 PR(#190~#194) main 머지. W4.7 엔진 전체·W4.9 전체·W4.4 통합 인박스 완료. 남은 핵심 = **W4.1 주문상세 머니시트(머니 직결 → 단계 합의 게이트)**.

---

역할: 너는 세계 최고의 풀스택 엔지니어이자 1등 UI/UX 디자이너이며 꼼꼼한 코드 감사자다. AtoC Korea 어드민 대시보드 **Wave 4(페이지별 프리미엄 모바일 개편)** 의 잔여를 이어받아 실행한다. 진행/상태 보고는 **한국어**(코드·커밋 메시지는 영어).

## 0) 단일 기준 문서 (읽기 순서)
1. **이 파일**(부트스트랩 + 환경)
2. `docs/admin-dashboard-upgrade-master-plan-2026-06-24.md` — **SoT**. §A(상태)·§B(결정)·§C(변경로그, 최신은 아래쪽 append)·§R Wave 4 WBS·§8.x 청사진.
3. `docs/admin-premium-mobile-design-spec-2026-06-24.md` — §8.1~8.4 청사진 + §7 키트.

## 1) ⚙️ 환경 — 두 가지 프로파일 (자기 환경부터 확인)
이 브랜치(`claude/admin-dashboard-upgrade-yvb88c`)는 세션마다 다른 환경에서 잡힌다. **먼저 `mcp__atockorea__list_projects`(또는 `execute_sql`)로 라이브 DB 접근 가능 여부부터 확인**하고 프로파일 판별:

- **프로파일 A — Windows 워크트리(라이브 DB+preview 있음, 이번 2026-06-26 세션이 여기):**
  - 워크트리 `C:\Users\sangsong\atockorea-admin`. `node_modules`는 main과 **정션**(있음). `.env.local` 존재(gitignore).
  - 라이브 DB `mcp__atockorea__*`가 atockorea(`cghyvbwmijqpahnoduyv`)에 **연결됨** → 읽기 자유·스키마 대조 가능. **DDL/storage 변경은 사용자 승인 게이트**(하네스 차단; 직접쓰기 권한은 투어 데이터 한정).
  - preview 도구 사용 가능하나 어드민은 auth+DB 게이트 → **§B 결정대로 preview 없이 매 PR main 머지→사용자 라이브 검증**이 실무 워크플로.
- **프로파일 B — 원격 Linux(claude.ai/code, DB·빌드env 부재):**
  - 메인 working dir `/home/user/atockorea`, 브랜치 `claude/next-session-execution-ysuww9`. `node_modules`는 `npm install --no-audit --no-fund` 후 **lockfile 원복**(`git checkout package-lock.json`). 빌드용 `.env.local`은 placeholder 3줄 생성 후 빌드 끝나면 삭제(`ENOTFOUND placeholder.supabase.co`는 정상). 라이브 DB **미접근**(`list_projects`가 Kursoflow만) → DB/마이그레이션 의존 티켓은 프로파일 A 세션에서.

**검증 명령(공통, 로컬 바이너리 직접):** `node_modules/.bin/tsc --noEmit -p tsconfig.json`(0 필수) · `node_modules/.bin/jest --ci`(또는 변경범위) · `npm run build`(`✓ Compiled successfully` 확인). ⚠️ `npx jest` 금지. ⚠️ **신규 npm 의존성 0**(정션/lockfile 오염).

**테스트 baseline = `560 pass / 8 fail`**(2026-06-26 기준). **8 fail은 main 기존 환경결함**(폴리필 부재: error-handler·logger·api/tours·test-utils(no-test) + phase-z=jeju haenyeo 타이밍 stale 콘텐츠) — 회귀 아님. **내 작업 후에도 이 8개만 실패해야 정상**(pass 수만 증가).

## 2) ⚠️ 브랜치 함정 (반드시) — 매 세션 stale
다른 환경 세션이 Wave 4 PR을 **main에 직접 머지**한다. 그래서 `claude/admin-dashboard-upgrade-yvb88c`(및 `...ysuww9`)는 **항상 main보다 뒤처질 수 있다**(2026-06-25엔 25커밋 뒤·옛 핸드오프 1커밋만 unique).
1. 시작 시 `git fetch origin && git reset --hard origin/main`(워크트리 브랜치의 unique 커밋은 superseded된 옛 doc뿐 → 버려도 안전).
2. **PR은 새 per-PR 브랜치로**: `git branch -f claude/admin-wXX-<slug> HEAD && git push origin claude/admin-wXX-<slug>:claude/admin-wXX-<slug>` → 머지 후 삭제 + `git merge --ff-only origin/main` 재동기화. (force-push/충돌 0.)

## 3) 워크플로 — 매 티켓(페이지)마다 (§B 2026-06-25: preview 없이 매 스텝 main 머지)
1. 다음 티켓 선택(§5). 착수 전 한 줄 계획 공유. **모든 file:line은 코드 직접 대조.**
2. 구현 — Wave 1 키트 재사용(`components/admin/*`·토큰·sonner·lucide·framer-motion)·**신규 의존성 0**. 로직은 순수 헬퍼로 추출해 단위테스트(`lib/admin/*` 패턴).
3. 검증: tsc 0 + 변경범위 jest + 전체 jest(560/8 유지) + `npm run build` ✓.
4. 커밋(티켓 단위, 영어). **푸터는 `Co-Authored-By: Claude <noreply@anthropic.com>`만**(모델 식별자·세션 URL 금지).
5. 플랜 §C(맨 아래 append) + §A(현재 활성 Phase 줄) 갱신.
6. **main 머지**: gh/github MCP 없음 → **GitHub REST API + git credential 토큰**(`printf "protocol=https\nhost=github.com\n\n" | git credential fill`로 password 추출; PR body는 Write로 임시파일 → python `urllib`로 POST `/pulls` then PUT `/pulls/{n}/merge` `{"merge_method":"merge"}`). 머지 후 임시 body 파일 삭제 + 브랜치 삭제 + ff-sync. PR body 푸터 `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
   - repo = `simsangsong/atockorea`. ⚠️ Stop hook "Unverified" 경고(머지커밋 committer=noreply@github.com)는 무시(내 커밋 아님·reset-author 금지).
7. 한국어 완료 보고(라이브 확인 포인트 명시) + 다음 후보.

## 4) ✅ 완료(머지됨) — 다시 하지 말 것
### 2026-06-26 Windows 세션 (PR #190~#194, 전부 main)
- **#190 W4.7 분석 오버뷰**(§8.4): KPI 4종 카드 내 스파크라인(별도 차트패널 3개 제거)·통합 일일트렌드 단일차트(메트릭 토글·90일 주간버킷)·상위이벤트 5+모두보기·stale 공지 상단. 공유 `components/admin/Sparkline` 추출+StatCard `chart` 슬롯·순수 `lib/admin/analytics-overview.ts`.
- **#191 W4.7 세션·리텐션**(§8.4): sessions `grid-cols-12`→모바일 `SessionCard`+데스크톱 테이블·retention 코호트 1열 frozen(`sticky left-0`)·4주 기본·`min-w-[44px]`.
- **#192 W4.9-a match-pois**: 항상 side-by-side(w-80)이던 2-pane을 **모바일 단일창**(목록⇄편집기, lg+ 2-pane)·자동선택 lg 게이트·PoiListPane `w-full lg:w-80`.
- **#193 W4.9-bc CMS·업로드**: gray→slate/admin 토큰·`bg-white rounded-xl`→admin-surface 카드·alert→toast·h1 text-3xl→xl·세이브버튼 blue 통일·업로드 이모지→Lucide·**갤러리 hover전용 복사→tap**(모바일 코너 버튼).
- **#194 W4.4 통합 인박스**(§E-4/§8.3): 신규 `GET/PATCH /api/admin/inbox`(contact/email/ticket **인-라우트 키셋 머지**=DDL 게이트 회피)·순수 `lib/admin/inbox.ts`+테스트6·라이브검증(ticket 53 미처리). `/admin/inbox` 페이지(소스/카테고리 칩·날짜그룹·검색·미처리 배지·바텀시트 상세·읽음 토글)·바텀탭 문의→**수신함**·사이드바 수신함 추가. ⚠️ §K-7.5 view 초안 오류 정정: `support_tickets.id`=bigint·`unread_for_admin`=boolean. **연기**: 인박스 내 답장 컴포저·스와이프 해결(3소스 mutation 상이→원본 딥링크)·5슬롯 더보기 IA(W1.10).

### 이전 세션들(요약, 상세는 §C)
- Wave 0(보안·머니 6, #167)·Wave 1 기반(토큰·키트, #168)·Wave 3 안정화(11, #169/170)·Wave 9 공개보안 다수(#171·172·…·181)·D-15(#172)·W5.7 환불경로(#173)·W3.10 lib(#182동봉)·W4.3 대시보드/W4.2 주문목록/W4.7-a 허브/W4.8 챗봇분석/W4.6 머천트(#182~#187). **§R-9 보안 트랙 비-게이트 소진.**

## 5) 🎯 다음 우선순위 — Wave 4 잔여
### ⚠️ 사용자 단계-합의 게이트 (자율 금지)
- **W4.1 주문상세 머니시트**(`/admin/orders/[id]`, §8.2 상세·§6.2) — **머니 직결**. `confirm()`(라인 ~123/173)→**금액 확인 바텀시트**. iOS WebView가 `confirm()`에 무대화상자 `true` 반환 → **무확인 결제 발화(돈 버그)** 차단이 핵심 동기. 액션별 문구(§6.2): capture/완료(slate "지금 [금액] 청구·취소불가")·release/현장(slate)·no-show(red 위약금)·refund. `ConfirmSheet`(`amount`/`destructive`/`noteTone` props, 이미 존재)·`lib/payments/*` 재사용·첫탭 후 disable=멱등. sticky 바텀 머니 액션바(hold상태·<48h amber·만료 red). **착수 전 단계 계획(어떤 액션·문구·멱등 가드)을 사용자에 공유·승인 후 구현.** alert→toast·아코디언(주문정보/결제/이티너리).

### 게이트/저임팩트
- **W4.10 설정/감사로그 UI** — 토큰 채택 부분만 가능(W3.1 site_settings=마이그레이션 게이트·W5.4 audit=데이터트랙).
- **W4.11 횡단 인터랙션** — U-1 Realtime·U-3 가상 DataTable·U-6 undo·U-7 bulk·U-8 saved views(각 적용).
- **W4.5 정산 운영 UI** — ⚠️ W5.2 RPC v2 동시배포(데이터 트랙) 게이트. 지금 금지.

### 여전히 막힌 트랙(임의 금지)
- 마이그레이션/DB(Wave 5 데이터모델·Wave 6 perf·W2.1·W3.1): 프로파일 B는 DB 미접근. 프로파일 A라도 **DDL은 사용자 승인 게이트**.
- pricing 민감(LIB-2 DMZ 차량등급·LIB-3 FX 폴백): 실요금표 대조·사용자 확인. **정수/반올림 변경 금지.**
- 세무(Wave 8): CPA SIGN-OFF(§G-5)+§J 게이트.
- D-15 보류 2(visitors distinct-over-range·retention left-censor): 설계 결정 게이트.

## 6) 🧰 재사용 자산 (검증됨)
- 레이아웃: `app/admin/layout.tsx`가 글로벌 sticky 헤더 제공 → 일반 페이지는 `<div className="space-y-6">` 루트. sticky 필터바 필요 시 `sticky top-0 -mx-4 -mt-4 ... px-4 pt-4 md:-mx-5 md:-mt-5`(주문목록/인박스 패턴).
- 키트: `StatCard`(+`chart` 슬롯·`StatCardSkeleton`)·`Sparkline`·`Skeleton`·`ConfirmSheet`(`amount`/`destructive`/`noteTone`)·`DataCard`·`FilterBar`·`ActivityRow`·`BookingStatusBadge`·`AdminPageShell`.
- 훅/유틸: `useUrlFilters(defaults)`→`{filters,setFilter,setFilters,resetFilters}`(파일명 `lib/admin/useUrlFilters.ts`)·`lib/admin/haptics`·`lib/admin/kst-day`(`kstDayBounds`→`{startIso,endIso}`)·`lib/admin/inbox`.
- 토큰: `bg-admin-surface`/`-hover`/`-raised`·`bg-admin-bg`·`border-admin-border`·`rounded-design-md`/`-sm`·`shadow-admin-card`/`-float`·`tabular-nums`. 색: slate 중립 + **blue-600 단일 액센트** + status emerald/amber/red(데이터만, §1.4).
- 피드백: `import { toast } from 'sonner'`(Toaster layout 마운트됨). `alert()`/`confirm()` **전면 금지**(§B)→toast + ConfirmSheet. 아이콘 `lucide-react`(이모지 금지). 폼: 입력 `text-base`(16px)·컨트롤 `min-h-11`(44px).
- 어드민 API 인증: `requireAdmin(req)`(@/lib/auth)는 **Bearer 헤더 OR 쿠키 세션 둘 다** 허용 → 페이지 fetch는 `credentials:'include'`만으로 OK. service-role 클라=`createServerClient()`.

## 7) 절대 규칙 / 회귀 금지
- 하지 말 것: requireAdmin 약화·service-role 키 클라번들 노출·웹훅 서명검증 제거·머니 cron fail-open화·**pricing 정수/반올림 변경**·재고(product_inventory) UI 추가(availability unlimited)·신규 npm 의존성.
- 통화 표기 USD/KRW 혼합 금지(`formatBookingPrice(amount,currency)`).
- 마이그레이션/DDL/storage = **사용자 승인 게이트**(additive only·적용 후 advisor 재실행).
- 병렬 감사 Agent엔 "하위 에이전트 spawn 금지 + 최종 메시지로 직접 반환" 명시. 진행 보고 한국어.

## 8) 착수 한 줄
**다음 착수 지점**: §5 — **W4.1 주문상세 머니시트**가 잔여 핵심이나 **머니 직결 → 착수 전 단계 계획을 사용자에 공유·승인 후 구현**(자율 금지). 사용자가 W4.10/W4.11 등 다른 항목을 지정하면 그쪽 우선. 승인/지시 즉시 §3 워크플로로 1 PR 진행.

> 갱신: 2026-06-26 — Wave 4 5 PR(#190~#194) 머지. 환경=Windows 워크트리·라이브DB+preview. 상세 §4 + 플랜 §A/§C 최신 행.
