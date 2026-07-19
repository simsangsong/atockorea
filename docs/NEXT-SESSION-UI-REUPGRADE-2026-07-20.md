# NEXT SESSION — UI 컴팩트·프리미엄 재업그레이드 + tour-mode 디바이스 QA (2026-07-20 인수인계)

**이 문서를 먼저 읽고 시작.** SoT 마스터플랜: `docs/ui-compact-premium-reupgrade-master-plan-2026-07-19.md`. 메모리: `project_ui_compact_premium_reupgrade`.

---

## ⚠️ 0. 착수 전 — 공유 디렉토리 동시성 (가장 중요)

`C:\Users\sangsong\atockorea`(main 작업 디렉토리)를 **다른 Claude 세션과 공유**할 수 있음. 직전 세션 중 병렬 세션이 **`claude/tour-facility-pins`** 브랜치에서 "관광지별 화장실·포토스팟 핀 지도"(SoT=`docs/tour-room-facility-pins-master-plan-2026-07-19.md`)를 활발히 구현하며 PR #396~#402를 열었음.

**착수 시 반드시:**
1. `git branch --show-current` + `git status --short`로 **다른 세션의 미커밋 작업이 있는지** 확인.
2. 미커밋 tracked 변경이 있으면 → **절대 `git stash`/`git checkout` 하지 말 것**(그 작업 삼킴). 병렬 세션이 활발하면 **전용 워크트리**(`git worktree add C:/Users/sangsong/atockorea-ui2 origin/main` + node_modules 정션)에서 작업.
3. working tree가 깨끗하면(이번처럼) 공유 dir에서 진행 가능하되: **항상 `git checkout -b <branch> origin/main`**, **`git add`는 내 파일만**(`git add -A` 금지), stash 최소화.
4. **facility-pins/컨시어지 파일은 건드리지 말 것**: `lib/tour-room/concierge.ts`·`ConciergeInlineAnswer.tsx`·`lib/tour-room/facilityPins.ts`·`app/api/admin/facility-pins/*`(그 세션 영역).

---

## 1. 이번까지 완료 (#369~#403, 전부 origin/main 머지·라이브)

**W1(운영 토큰 수렴):** 콕핏 raw neutral→`tr-*` 다크 토큰 완전 수렴(#379) · 콕핏 이모지→lucide(#375) · 44px 탭 하한 안전분(가이드 42→44·관제 32→44·#380).
**W2(손님 앱/채팅):** SpotArrivalCard 히어로 스크림(#376) · 리액션/퀵리플라이 칩 헤어라인+프레스 모션 · 홈 타일 밀도(#377) · 스케줄 현재스톱 카드(#378).
**W3(운영자):** 관제 설정 iOS 그룹리스트(#389) · 가이드 히어로 스탯 스트립(#390) · 가이드 룸카드 2줄→1줄 아이콘화(#392).
**W4(어드민):** 분석엔진 레거시 5페이지 토큰화(#381·384·385) + events 모바일 카드 폴백(#403) · 주문상세 타입/밀도(#386)+**한국어 우선 i18n**(#388) · 레이아웃/대시보드/머천트 타입 스윕(#387) · **⌘K 커맨드 팔레트**(#393, nav 라우트 검색·헤더 ⌕).
**디바이스 QA(사용자 스크린샷):** 인앱 뒤로가기 + 지도 내위치/전체보기 컨트롤 + 지도 프레임(#382) · **언어 설정 통합**("언어" 카드 아래 앱언어/채팅언어, #383) · **위치 메시지 인라인 지도 프리뷰**(#391, `/api/maps/static` 프록시 경유=#395) · **뒤로가기 백스택 수리**(#394, 탭 히스토리+폰뒤로 트랩=한 스텝씩·앱 안 나감).

**✅ Maps Static API 확인됨(2026-07-20)**: 라이브 `/api/maps/static` = 200 image/png. **별도 ops 작업 불필요** — 배포만 되면 위치 지도 썸네일이 실제로 뜸.

---

## 2. 남은 것 = 전부 **결정/시각 QA 게이트** (자동으로 밀면 안 됨)

### 사용자 결정 필요 (판단이 갈림 — 물어보고 진행)
- **W2.1 채팅 `⋯` 리빌화(카톡식 롱프레스 단독)** — 항상 노출 버튼 제거 시 관광객·고령 손님 발견성 회귀. `ChatFeed.tsx:446` `IconMore` 블록 제거+`onContextMenu` 유지가 구현이지만 **이득<손해로 보류함**. 사용자가 "카톡식으로 가"라고 확정하면 진행.
- **주문 상세 아코디언** — 4 정보카드 접어 정산 도달 스크롤↓. 단 **모바일 sticky 정산바(`orders/[id]/page.tsx` `sticky bottom-16 md:hidden`)가 이미 authorized 상태 접근 해결** → 중복이라 보류. 머니페이지 구조 변경이라 라이브 확인 후.

### 시각 QA 게이트 (라이트/다크 셰이드 = 블라인드 고위험)
- **W1.2 관제센터 전면 tr-* 이관** — `tour-ops/*`가 별도 엔진(raw `slate` + `.ops-light`/`opsTheme.ts`). tr-* 라이트+다크로 이관 = 매일 쓰는 관제 툴에 셰이드 변경. **실기기에서 라이트/다크 둘 다 보고** 진행. 콕핏(#379)처럼 완전 매핑 필요하되 라이트 값 주의.

### 신규 기능 / 저가치
- **W4.4 ⌘K 데이터 검색 확장** — 현재 nav 라우트만. 주문(예약번호)·업체(이름) 검색은 `AdminCommandPalette items` 확장 + 검색 API 필요.
- **W3.3 roomHue → chip 그라디언트**(가이드/관제 hue 태그, 마이너) · **다른 화면 뒤로가기 확장**(PlanEditorClient 등 standalone 페이지도 폰뒤로 트랩 필요할 수 있음).

### 게이트 (사인오프)
- **마케팅 W5** — U2-D6: "프리미엄=enrichment, 축소·색 줄이기 금지" 거버넌스라 **전용 감사 + 사용자 사인오프 후에만**. home-v2/tours-list/tour-product 각자 마스터플랜 준수.

---

## 3. 핵심 원칙·gotcha

- **컴팩트≠탭축소**: 44px 탭 하한 불가침. 세로는 줄병합/그룹리스트/아코디언으로 회수.
- **팔레트 불변**: tr-*=중립잉크(파인/민트 재도입 금지, SOS레드·CaptionBanner 다크 유지). admin=blue-600 단일. 어드민 텍스트는 `text-slate-*`(정상, 토큰 아님), 크롬만 `border-admin-border`/`bg-admin-surface`+컴포넌트킷(StatCard/DataCard).
- **⚠ 부분문자열 replace_all 위험**: `p-6`→`p-5`가 `gap-6`→`gap-5`까지 바꿈(#386에서 복구). `gap-3`→`gap-4`도 `gap-3.5` 확인 후. replace_all 전 부분매칭 점검.
- **사전존재 lint 무관**: 어드민 다수 파일에 `catch(err:any)`·exhaustive-deps(내 className 변경과 무관, 라이브 배포됨=빌드 통과). 내 파일이 새 effect면 nested `run()`/latest-ref 패턴으로 동기 setState lint 회피(`react-hooks/set-state-in-effect`).
- **테스트/빌드**: 각 PR `npx tsc --noEmit` + `npx eslint <files>` + `npx jest <suite> --testPathIgnorePatterns "\.claude[\\/]worktrees"` green 후 머지.
- **머지 워크플로**: GitHub REST API(python urllib + `git credential fill`), origin/main 분기→PR→`merge_method:'merge'`. 커밋 푸터 `Co-Authored-By: Claude <noreply@anthropic.com>`만(모델 식별자 금지). 진행보고 한국어·코드/커밋 영어.

---

## 4. 착수 지점

먼저 사용자에게 **A/B/C 중 무엇을 원하는지** 확인:
- (A) 격리 워크트리에서 남은 비충돌 항목 순차(주문 아코디언 → ⌘K 데이터검색 → W1.2 관제이관은 시각QA 후).
- (B) 특정 항목 지정.
- (C) facility-pins 병렬 세션 종료 후 tour-mode 이어받기.

병렬 세션 활발 시 **§0 절차 필수**. 마케팅(W5)은 사인오프 전 착수 금지.
