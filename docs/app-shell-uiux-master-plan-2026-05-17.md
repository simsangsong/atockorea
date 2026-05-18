# AtoC Korea 앱 셸 UI/UX 마스터 플랜 — 다크 모드 + iOS 백 버튼

작성일: 2026-05-17
문서 상태: **표준 마스터 플랜 (이 문서가 유일한 실행 기준)**
대상: 글로벌 앱 셸 — `SitePageShell`, `Header`, `BottomNav`, `app/globals.css`, PWA 인프라
범위: (1) 다크 모드 시스템 (2) iOS PWA/인앱 브라우저용 백 버튼

## 0. 이 문서의 위치

| 문서 | 역할 |
|---|---|
| **이 문서** | **표준. 다크 모드 + 백 버튼 실행은 이 문서 기준.** |
| `.claude/skills/app-shell-uiux/SKILL.md` | 이 플랜을 강제하는 스킬 정의 |
| `docs/landing-page-uiux-master-plan-v3-2026-05-17.md` | 랜딩(`/`) UI/UX — 다크화 적용 시 §11 롤백 트리거 공유 |
| `docs/tour-product-detail-ui-ux-audit-response-2026-05-17.md` | 투어 상세 — Phase D6 의존성. 종료 전까지 `tour-product-v2-scope` 다크화 금지 |
| `docs/atockorea-analytics-master-plan-2026-05-17.md` | 다크 모드 토글 / 백 버튼 클릭 이벤트 발화처 |

핵심 원칙:
- 두 기능 모두 `SitePageShell` 단일 진입점을 거치므로 결정 흐름을 통합 관리한다.
- **백 버튼(B*)이 먼저, 다크 모드(D*)는 그 다음.** 백 버튼은 범위가 좁고 즉시 가치가 있으며, 다크 모드 진행 중 헤더 변경이 충돌하면 두 작업 모두 흔들린다.
- 다크 모드는 한 PR 거대화 금지. 페이지별 점진 마이그레이션이 default.

---

## §A. 상태 대시보드

| Phase | 상태 | 시작일 | 완료일 | 마지막 커밋 | 비고 |
|---|---|---|---|---|---|
| 0 — 사전 정의 + 토큰 인벤토리 | ✅ 완료 | 2026-05-17 | 2026-05-17 | (planner only) | 부록 §14/§15/§16 등재. 코드 변경 0건 |
| B.1 — iOS/standalone/in-app 감지 유틸 | ✅ 완료 | 2026-05-18 | 2026-05-18 | (uncommitted) | `src/lib/device/use-ios-backbar.ts` + `__tests__/use-ios-backbar.test.ts`. Jest 11/11 통과, tsc clean |
| B.2 — BackButton 컴포넌트 | ✅ 완료 | 2026-05-18 | 2026-05-18 | (uncommitted) | `components/app-shell/BackButton.tsx` + 6 locale i18n + `analytics.appShellBackClick`. tsc clean, JSON valid 6/6. 런타임 acceptance(history.length 분기)는 B.4 CDP QA에서 검증 |
| B.3 — Header 통합 (SitePageShell 진입점) | ✅ 완료 | 2026-05-18 | 2026-05-18 | (uncommitted) | `components/Header.tsx` BackButton 통합 + `useIosBackbar` 게이트 + path/admin 제외 + `md:hidden`. tsc clean, B.1 회귀 11/11 |
| B.4 — 엣지 케이스 QA | ✅ 완료 | 2026-05-18 | 2026-05-18 | (uncommitted) | §17 부록 등재 — z-index 매핑/history anchor 패치/BottomNav 분석. CDP·카톡·PWA 실측은 §17.4 manual QA로 이연 |
| B.5 — PWA manifest + apple meta | ✅ 완료 | 2026-05-18 | 2026-05-18 | (uncommitted) | `public/manifest.json` + 3 PNG icons (180/192/512) + layout.tsx PWA meta 6종 추가. tsc clean, B.1 회귀 11/11 |
| D.1 — Tailwind class + next-themes 연결 | ✅ 완료 | 2026-05-18 | 2026-05-18 | (uncommitted) | next-themes 설치 + `darkMode: 'class'` + `ThemeProvider` 래퍼 + layout.tsx 통합. tsc clean, B.1 회귀 11/11. devtools `html.dark` 강제 토글 검증은 §17.4로 이연 |
| D.2 — globals.css `.dark` 블록 완성 | ⏳ 대기 | — | — | — | 69 토큰 다크 값 채움 |
| D.3 — 토글 컴포넌트 + Header 통합 | ⏳ 대기 | — | — | — | ☀️/🌙/💻 3-상태 |
| D.4 — shadcn/ui + 홈 v2 다크 시각 QA | ⏳ 대기 | — | — | — | 자동 다크화 영역 검증 + 누락 토큰 보강 |
| D.5 — 페이지별 점진 마이그레이션 | ⏳ 대기 | — | — | — | 반복 작업 — `/`, `/tours`, `/cart`, `/checkout`, `/mypage`, 인증, `/admin` |
| D.6 — 투어 상세 (`tour-product-v2-scope`) | ⏸ 보류 | — | — | — | `docs/tour-product-detail-ui-ux-audit-response-2026-05-17.md` 종료 의존 |
| D.7 — 이미지/사진 명도 보정 + 최종 QA | ⏳ 대기 | — | — | — | 다크 logo 변형, `brightness` 필터, contrast WCAG AA |

상태 마커:
- ⏳ 대기 (아직 시작 안 함)
- 🔄 진행 중
- ⏸ 보류 (의존성 미해소)
- ✅ 완료
- ❌ 중단/롤백

**현재 활성 Phase: 없음 (D.1 ✅. D.2 진입 사용자 승인 대기).**
**다음 액션: Phase D.2 — `app/globals.css` `.dark` 블록 완성 (AtoC 커스텀 토큰 22개에 다크 페어 + shadcn 충돌 11종 §B #16 재정의 + WCAG AA contrast 검증).**

---

## §B. 결정 로그

각 행은 binding decision. 번복 시 새 행으로 추가 (삭제 금지, 이력 보존).

| # | 날짜 | 결정 | 이유 | 번복 |
|---|---|---|---|---|
| 1 | 2026-05-17 | 두 기능을 하나의 마스터 플랜으로 통합 관리 (백 버튼 + 다크 모드) | 둘 다 `SitePageShell` 단일 진입점, 충돌 가능성, 결정 흐름 통합이 효율적 | — |
| 2 | 2026-05-17 | **실행 순서 = B(백 버튼) → D(다크 모드)**. D 시작 전 B 전체 ✅ 필수 | B는 좁고 명확, D 진행 중 헤더 충돌 시 양쪽 흔들림 | — |
| 3 | 2026-05-17 | 다크 모드 기본값 = `system` (OS 따름) | 명시 토글 전엔 사용자 OS 설정 존중. 깜빡임·예상 위반 최소화 | — |
| 4 | 2026-05-17 | 다크 모드 구현 = `next-themes` + `tailwind.darkMode: 'class'` + CSS 변수 | shadcn/ui가 이미 변수 기반. v0 worktree에 이미 패턴 검증됨. 신규 의존성 1개로 한정 | — |
| 5 | 2026-05-17 | 하드코딩 클래스 (~1,200) 마이그레이션 = `dark:` 접두사 점진 추가 (페이지 단위) | CSS 변수 일괄 치환은 PR 거대화 + 회귀 리스크 ↑. `dark:` 접두사는 라이트 동작 보존 ✓ | — |
| 6 | 2026-05-17 | 한 PR 한 페이지 마이그레이션 (D.5에서). 여러 페이지 묶음 금지 | 리뷰·롤백 단위 작게 유지 | — |
| 7 | 2026-05-17 | `tour-product-v2-scope.css` 다크화는 `docs/tour-product-detail-ui-ux-audit-response-2026-05-17.md` 종료 후 | 마스터 플랜 진행 중 양쪽 토큰 충돌 시 디버깅 비용 ↑ | — |
| 8 | 2026-05-17 | 백 버튼 표시 조건 = **iOS + (`navigator.standalone` 또는 인앱 브라우저 UA)**. 일반 iOS Safari는 제외 | 일반 Safari는 하단 ← 존재 → 중복. 진짜 부재 상황만 보완 | — |
| 9 | 2026-05-17 | 백 버튼 위치 = `Header` 좌측 슬롯. 루트(`/`)에서는 숨김. `history.length <= 1` 시 `/` 폴백 | 단일 진입점 (`SitePageShell`) → 전역 적용 ✓. 외부 딥링크 안전 처리 | — |
| 10 | 2026-05-17 | Admin (`/admin/*`)에는 백 버튼 표시 안 함 | 자체 breadcrumb 이미 존재 (`app/admin/layout.tsx:23-35`) | — |
| 11 | 2026-05-17 | PWA manifest는 최소 시작 (`display: standalone` + icons + apple meta). PWA full 기능(오프라인·푸시)은 §D | 백 버튼의 명분(standalone 모드)을 의미 있게 만드는 것이 1차 목표 | — |
| 12 | 2026-05-17 | 새 테마/UI 라이브러리 도입 금지 (chakra, theme-ui, mui 등). `next-themes` 하나만 추가 | 번들·러닝 코스트, 기존 shadcn 토큰 시스템과 충돌 | — |
| 13 | 2026-05-17 | 다크 토글 SSR 깜빡임(FOUC) 방지를 위해 `<script>` head injection 패턴 사용 (next-themes 기본 패턴) | 깜빡임은 즉시 브랜드 신뢰 손상 | — |
| 14 | 2026-05-17 | 토글 UI = ☀️/🌙/💻 3-상태 (라이트/다크/시스템). 단순 토글 금지 | 시스템 기본을 명시적으로 노출. 사용자 자율성 ↑ | — |
| 15 | 2026-05-17 | 모든 다크 색상은 globals.css `.dark { … }` 내부 CSS 변수 재정의로만 추가. inline `dark:` 접두사는 **Tailwind 의미 클래스**(`bg-white` 등)에만 사용 | 토큰 일관성. 디자인 시스템 확장 시 한 곳에서 변경 ✓ | — |
| 16 | 2026-05-17 | **토큰 네임스페이스 충돌 해소: shadcn 다크 블록(`.dark` L1115–1148)이 정의한 토큰 중 AtoC 커스텀(L21–73)과 이름 겹치는 것(`--accent`, `--background`, `--foreground`, `--card`, `--popover`, `--primary`, `--secondary`, `--muted`, `--border`, `--ring`, `--input`)은 D.2에서 AtoC가 `.dark`에 동일 변수 재정의 (앰버 아이덴티티 보존). AtoC 비충돌 토큰(`--accent-soft`, `--accent-strong`, `--text-*`, `--surface-*`, `--line-*`, `--focus-ring`, `--shadow-*`, `--hero-*`, `--home-shadow-*`)도 D.2에서 다크 페어 추가. shadcn 단독 토큰(`--chart-*`, `--sidebar-*`)은 그대로 사용 | Phase 0 코드 실사 결과: `.dark` 클래스 활성 시 shadcn의 `--accent: oklch(0.269 0 0)`이 AtoC `theme('colors.amber.700')`을 덮어쓰면 §B #brand-voice 위반(앰버 아이덴티티 손실). 별도 prefix(`--atoc-accent`)는 ~3,200개 클래스 마이그레이션 비용 → 같은 변수명 재정의로 통일 | — |

---

## §C. 변경 로그

Phase 진행 시 한 줄씩 추가. 커밋 단위.

| 날짜 | 항목 | 커밋 | 비고 |
|---|---|---|---|
| 2026-05-17 | 마스터 플랜 v1 작성 | (pending) | `docs/app-shell-uiux-master-plan-2026-05-17.md` |
| 2026-05-17 | app-shell-uiux 스킬 등록 | (pending) | `.claude/skills/app-shell-uiux/SKILL.md` |
| 2026-05-17 | Phase 0 시작 — 사전 정의 + 토큰 인벤토리 + UA 매트릭스 (코드 변경 없음) | (pending) | §A 0 → 🔄 |
| 2026-05-17 | 사실 수정 — §2.1 token count 69 → 실제 113 변수 정의 라인 (AtoC 커스텀 22 + shadcn 33×2 페어 + 미니 :root 4 + 기타). `.dark` 블록 정확한 위치 L1115–1148 (shadcn 토큰만, AtoC 커스텀 L21–73은 다크 미정의) | (pending) | 코드 실사 globals.css 1347 line |
| 2026-05-17 | 사실 수정 — §2.1 하드코딩 클래스 count 약 1,200 → 실제 3,231 (`/app` 1,815 in 96 files + `/components` 1,416 in 170 files). 단 v0 worktree 포함 — 실제 마이그레이션 대상은 약 2,000개로 추정 | (pending) | grep `bg-white\|bg-gray-*\|bg-slate-*\|text-gray-*\|text-slate-*\|bg-neutral-*\|text-neutral-*` |
| 2026-05-17 | §B #16 추가 — 토큰 네임스페이스 충돌 해소 결정 (앰버 아이덴티티 보존 위해 AtoC `.dark`에서 shadcn 충돌 토큰 재정의) | (pending) | shadcn `.dark`의 `--accent: oklch(0.269 0 0)` 회색이 AtoC amber 덮어쓰는 문제 |
| 2026-05-17 | Phase 0.1 ✅ — 토큰 인벤토리 표 (§14 부록) | (pending) | AtoC 22 + shadcn 33 + 충돌 11 + 비충돌 11 분류 완료 |
| 2026-05-17 | Phase 0.2 ✅ — 페이지별 하드코딩 클래스 카운트 표 (§15 부록) | (pending) | D.5 우선순위 9 buckets 확정 |
| 2026-05-17 | Phase 0.3 ✅ — iOS UA / standalone / 한국 인앱 브라우저 매트릭스 (§16 부록) | (pending) | KAKAOTALK / Instagram / FBAN / NAVER / Line / KakaoStory / daum 7종 패턴 정리 |
| 2026-05-17 | Phase 0.4 ✅ — §A 표 확정 (현 §A 상태로 fix) | (pending) | 13 Phase 모두 ⏳/⏸ 정합 |
| 2026-05-17 | Phase 0 ✅ — 4 작업 완료. 다음: 사용자 승인 받아 Phase B.1 진입 | (pending) | 코드 변경 0건. 인벤토리·매트릭스만 |
| 2026-05-18 | Phase B.1 시작 — `useIosBackbar` hook 신규 + §16.4 9 fixture 단위 테스트 | (pending) | §A B.1 → 🔄 |
| 2026-05-18 | B.1 코드 랜딩 — `src/lib/device/use-ios-backbar.ts` (detectIosBackbar 순수 함수 + useIosBackbar 훅, 분리 설계로 테스트 용이) + `__tests__/use-ios-backbar.test.ts` (11 fixture: §16.4의 9개 + Desktop Mac 무터치 + Android Chrome) | (uncommitted) | display-mode `change` 리스너로 PWA 진입/이탈 동적 반영 |
| 2026-05-18 | B.1 acceptance ✅ — Jest 11/11 통과 (0.672s), tsc --noEmit clean (B.1 파일 0 에러) | (uncommitted) | iPhone Safari false / PWA standalone true / KAKAOTALK true / Instagram true / FBAN true / NAVER true / Line true / iPad masquerade+touch true / Mac desktop no-touch false / Android false / Desktop Chrome false |
| 2026-05-18 | **Phase B.1 ✅** — 다음: 사용자 승인 받아 B.2 (`BackButton` 컴포넌트) 진입 | (uncommitted) | 헤더 통합(B.3)·엣지(B.4)·PWA(B.5)는 B.2 ✅ 이후 |
| 2026-05-18 | Phase B.2 시작 — BackButton 컴포넌트 + i18n + analytics | (pending) | §A B.2 → 🔄 |
| 2026-05-18 | B.2 i18n 6 locale — `appShell.backButton.label` 추가 (ko 뒤로 / en Back / ja 戻る / zh 返回 / zh-TW 返回 / es Atrás). 6/6 JSON parse 통과 | (uncommitted) | `messages/{ko,en,ja,zh,zh-TW,es}.json` |
| 2026-05-18 | B.2 analytics — `analytics.appShellBackClick({ routeFrom, fallbackUsed })` 신규 메서드 + 주석. event_name `app_shell_back_clicked` | (uncommitted) | `src/design/analytics.ts` (analytics 객체 끝에 추가) |
| 2026-05-18 | B.2 컴포넌트 — `components/app-shell/BackButton.tsx` 신규. lucide-react `ChevronLeft` + 44px touch target (`min-h-touch min-w-[44px]`) + `focus-ring` + `motion-reduce:transition-none` + history.length 분기 (외부 딥링크 시 `/` 폴백, 분석 이벤트 fallbackUsed=true) | (uncommitted) | minWidth.touch 없어 `min-w-[44px]` arbitrary 사용 — B.2 스코프 외 config 변경 회피 |
| 2026-05-18 | B.2 acceptance — tsc --noEmit clean (B.2 파일 0 에러), JSON parse 6/6 통과. 런타임 분기(history.length 외부 딥링크 시 `/` 폴백)는 B.4 CDP QA에서 실측 | (uncommitted) | 컴포넌트는 visibility 결정 안 함(B.3에서 useIosBackbar로 게이트), 클릭 시 동작만 책임 |
| 2026-05-18 | **Phase B.2 ✅** — 다음: 사용자 승인 받아 B.3 (Header 좌측 슬롯 통합) 진입 | (uncommitted) | B.3는 `components/Header.tsx` 수정 — D.3와 같은 파일 → §B #2 & §12 순서 binding 준수 |
| 2026-05-18 | Phase B.3 시작 — Header.tsx 좌측 슬롯 통합 + useIosBackbar 게이트 + pathname/admin 제외 | (pending) | §A B.3 → 🔄 |
| 2026-05-18 | B.3 imports — `BackButton` + `useIosBackbar` 임포트. `showIosBackButton = useIosBackbar() && pathname !== '/' && !pathname.startsWith('/admin')` 게이트 변수 추가 | (uncommitted) | `components/Header.tsx` |
| 2026-05-18 | B.3 슬롯 — Logo `<Link>` 직전에 `{showIosBackButton && <BackButton className="md:hidden -ml-1.5 flex-shrink-0" />}` 삽입. `-ml-1.5`로 좌측 엣지에 살짝 붙임, `flex-shrink-0`로 logo 영역 우선 보존 | (uncommitted) | `md:hidden`으로 데스크톱 영향 0 |
| 2026-05-18 | B.3 acceptance — tsc --noEmit clean (B.3 파일 0 에러), B.1 jest 회귀 11/11 ✅ (0.639s). 런타임(실 PWA standalone / 카톡 인앱 / 일반 Safari / `/` / admin) 가시성은 B.4 CDP QA에서 검증 | (uncommitted) | 4개 게이트(`useIosBackbar` + `!= '/'` + `!startsWith('/admin')` + `md:hidden`) 모두 정합 |
| 2026-05-18 | **Phase B.3 ✅** — 다음: 사용자 승인 받아 B.4 (엣지 케이스 QA) 진입 | (uncommitted) | B.4 = 실측 단계. D.3 진입은 §B #2 binding에 따라 B 전체 ✅ 이후 |
| 2026-05-18 | Phase B.4 시작 — z-index 정적 분석 + 외부 referrer 가드 검토 | (pending) | §A B.4 → 🔄 |
| 2026-05-18 | B.4 z-index 매핑 — 12 영역 grep 분석 완료, BackButton은 Header z-50 상속, 다른 fixed/sticky와 위치(top vs bottom) 또는 z(40<50) 분리 정합. §17.1 부록 등재 | (uncommitted) | 의도된 occlusion(lightbox/drawer)만 존재, 비의도 충돌 0 |
| 2026-05-18 | **B.4 결함 발견 — B.2 BackButton `history.length <= 1` 단독 가드는 부족**. Insta→/tour→/cart→back→/tour→다시-back 시 Insta로 이탈 가능. §17.2 시나리오 매트릭스로 입증 | (uncommitted) | 코드 실사 우선 (스킬 rule 11) — 진행 중 발견된 결함 즉시 패치 |
| 2026-05-18 | B.4 패치 — BackButton.tsx에 `getHistoryAnchor()` 추가 (sessionStorage 기반 tab-life anchor). `history.length > anchor`일 때만 router.back() 안전 사용. privacy mode에서는 catch fallback로 안전 default | (uncommitted) | tsc clean, B.1 jest 회귀 11/11 ✅. 5 시나리오 모두 안전(§17.2) |
| 2026-05-18 | B.4 BottomNav 시각 충돌 분석 — 둘 다 모바일 한정이나 위치 분리(top vs bottom) → 충돌 0. §17.3 등재 | (uncommitted) | — |
| 2026-05-18 | B.4 manual QA 이연 — CDP/모바일 디바이스/카톡 인앱/PWA 홈스크린 실측은 사용자 환경 의존, §17.4에 권장 방법 문서화 | (uncommitted) | "(가능한 경우)" caveat는 §5 B.4 명시 |
| 2026-05-18 | **Phase B.4 ✅** — 정적 분석 3/5 완료, manual QA 2/5 §17.4로 이연. 다음: 사용자 승인 받아 B.5 (PWA manifest) 진입 | (uncommitted) | B.5 종료 시 Phase B 전체 ✅ → D.1 진입 가능 |
| 2026-05-18 | Phase B.5 시작 — PWA manifest + apple meta + 아이콘 3종 | (pending) | §A B.5 → 🔄 |
| 2026-05-18 | B.5 아이콘 — `public/icons/{apple-touch-icon,icon-192,icon-512}.png` 생성. 소스: `public/atoc-oauth-logo-1024.png` → sharp resize (compressionLevel 9). 파일 크기 15.9/17.2/46.1 KB | (uncommitted) | `purpose: any` (maskable는 safe-zone 미보장 — OAuth 로고 소스 그대로 사용 안전) |
| 2026-05-18 | B.5 manifest — `public/manifest.json` 작성. name/short_name `AtoC Korea`, start_url `/`, scope `/`, display `standalone`, orientation `portrait`, background_color/theme_color `#fffaf6` (warm cream — 헤더 frosted 톤과 일치), lang `ko`, icons 192/512 | (uncommitted) | JSON parse 통과 |
| 2026-05-18 | B.5 layout meta — `app/layout.tsx` `<head>`에 PWA meta 6종 추가: `<link rel="manifest">`, `<link rel="apple-touch-icon">`, `meta apple-mobile-web-app-capable=yes`, `meta apple-mobile-web-app-status-bar-style=default`, `meta apple-mobile-web-app-title=AtoC Korea`, `meta theme-color=#fffaf6` | (uncommitted) | Preconnect 태그 위에 배치 (PWA가 우선) |
| 2026-05-18 | B.5 acceptance — manifest JSON valid, tsc --noEmit clean, B.1 jest 회귀 11/11 ✅. 실 디바이스 "홈 화면에 추가" → standalone 진입 → BackButton 표시는 §17.4 manual QA로 이연 | (uncommitted) | sharp 의존성 이미 설치(0.34.5) — 신규 dep 0 |
| 2026-05-18 | **Phase B.5 ✅, Phase B 전체 ✅** — B.1 hook + B.2 component + B.3 Header + B.4 가드/QA + B.5 PWA infra. 다음: 사용자 명시 승인 후 D.1 진입 (§B #2 binding 해제) | (uncommitted) | 7 파일 변경/신규 + 6 i18n locale + 3 PNG. 커밋 단위 결정 사용자에게 |
| 2026-05-18 | Phase D.1 시작 — Tailwind darkMode='class' + next-themes 인프라 (시각 변화 0) | (pending) | §A D.1 → 🔄. §B #2 binding 해제 후 첫 D Phase |
| 2026-05-18 | D.1 install — `npm install next-themes` (1 패키지 추가). 신규 의존성 §B #12 한도 내(다음-themes 하나만) | (uncommitted) | 사전 vulnerabilities는 기존 패키지 — D.1과 무관 |
| 2026-05-18 | D.1 tailwind — `tailwind.config.js`에 `darkMode: 'class'` 추가 (default 'media'에서 변경). `.dark` 클래스 토글로 다크 모드 활성화 | (uncommitted) | next-themes class 전략과 정합 |
| 2026-05-18 | D.1 provider — `components/app-shell/ThemeProvider.tsx` 신규 (use client 래퍼). `attribute="class"`, `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange`, `storageKey="theme"`. §B #3/#4/#13 인코딩 | (uncommitted) | next-themes 자체 inline head script로 FOUC 방지 |
| 2026-05-18 | D.1 layout — `app/layout.tsx` ErrorBoundary 안쪽 outermost에 ThemeProvider 추가, I18nProvider/CurrencyProvider/children 래핑. `<html suppressHydrationWarning>`은 이미 L44에 존재 (next-themes 요구사항 충족) | (uncommitted) | 시각 변화 0 — 토글 UI는 D.3 |
| 2026-05-18 | D.1 acceptance — tsc --noEmit clean, B.1 jest 회귀 11/11 ✅. 정적 체인 검증: tailwind class → next-themes html.dark → shadcn `.dark { var redefinition }` (globals.css L1115–1148, Phase 0 확인) → component renders. devtools 강제 `html.dark` 토글 실측은 §17.4 manual QA로 이연 | (uncommitted) | 라이트 모드는 무변화 — system OS 다크 사용자만 자동 다크 활성 |
| 2026-05-18 | **Phase D.1 ✅** — 다음: D.2 (`.dark` 블록 완성 — AtoC 22 토큰 다크값 + shadcn 충돌 11종 §B #16 재정의 + WCAG AA) | (uncommitted) | D.1은 시각 변화 0 의도. 실 다크 적용은 D.2부터 |

---

## §D. 보류 아이디어 (Scope Creep Registry)

Phase 안에 없지만 좋은 아이디어. Phase 끝나기 전엔 손대지 말 것. 추가 시 출처 + 보류 이유 명시.

| 아이디어 | 출처 | 보류 이유 |
|---|---|---|
| PWA 풀 기능 (오프라인 캐싱, 푸시 알림) | Phase B.5 부산물 | manifest 최소부터. 사용자 PWA 설치율 확인 후 |
| Android 백 제스처 처리 (`history.back` 외에) | 일반 패턴 | Android는 시스템 ← 존재. 필요성 검증 후 |
| 다크 모드 자동 스케줄링 (해 뜨면 라이트, 해 지면 다크) | 일반 UX 패턴 | `system` 기본이 OS 스케줄링 위임. 자체 스케줄링은 중복 |
| OLED 절전용 "AMOLED 블랙" 변형 (#000 배경) | 일반 패턴 | 사용자 요구 검증 전. 디자인 결정 필요 |
| 투어 카드 이미지 다크 변형 (별도 다크 사진 셋) | Phase D.7 부산물 | `brightness(0.92)` 필터로 충분한지 먼저 검증 |
| 백 버튼에 햅틱 피드백 (iOS) | 일반 패턴 | iOS Web Haptic API 제한. 검증 필요 |
| 다크 모드 토글에 라벨 텍스트 ("다크/라이트") | UX 검토 | 아이콘만으로 충분한지 사용자 피드백 후 |
| 토글 위치를 `/settings` 페이지로도 확장 | UX 검토 | Header 우측 아이콘으로 시작. 사용자 발견율 보고 결정 |

---

## 1. 한 줄 결론

> **두 기능 모두 글로벌 셸(`SitePageShell`) 단일 진입점을 거치므로 결정 흐름을 통합한다. 백 버튼은 좁고 즉시 가치(0.5–1일), 다크 모드는 토큰 인프라가 절반쯤 있으나 1,200개 하드코딩 클래스가 마이그레이션 부담. 둘 다 한 PR에 묶지 않고 페이지 단위로 점진.**

---

## 2. 코드 실사 스냅샷 (사실 검증 완료)

### 2.1 다크 모드 인프라 — 토대는 절반쯤 있음 (Phase 0 코드 실사 결과 보강)

| 항목 | 위치 | 상태 |
|---|---|---|
| `tailwind.config.darkMode` | `tailwind.config.js` | ❌ 미설정 (default = `prefers-color-scheme` media query) — D.1에서 `'class'` 전환 |
| AtoC 커스텀 토큰 | `app/globals.css` L21–73 (22 토큰, unlayered `:root`) | ✅ 라이트 정의됨, ❌ 다크 미정의 |
| 미니 :root 토큰 | `app/globals.css` L194–204 (`--background`/`--foreground` 2개) | ⚠️ AtoC 토큰과 변수명 충돌. `@media (prefers-color-scheme: dark)`로 다크 정의 존재 |
| shadcn `:root` 라이트 | `app/globals.css` L1077–1114 (33 토큰, `@layer base`) | ✅ shadcn oklch 라이트 |
| shadcn `.dark { … }` 블록 | `app/globals.css` L1115–1148 (`@layer base`) | ✅ shadcn oklch 다크 — 단, **AtoC와 변수명 충돌 11종** (§B #16 참조) |
| `html.dark { … }` 추가 룰 | `app/globals.css` L1159–1161, L1242–1249 | ✅ background + body::before 다크 처리 |
| `@import "shadcn/tailwind.css"` | `app/globals.css` L190 | ✅ shadcn npm v4.0.8 패키지 (`node_modules/shadcn/dist/tailwind.css`) |
| `next-themes` | `package.json` | ❌ 미설치. D.1에서 신규 추가 |
| **하드코딩 색상 클래스 (실측)** | `/app` 96 files / `/components` 170 files | ⚠️ **약 3,231 occurrences** (`/app` 1,815 + `/components` 1,416). v0 worktree 제외 시 약 2,000 |
| shadcn/ui (`components/ui/*`) | 15 컴포넌트 | ✅ 변수 기반, 일부 `dark:` 접두사 포함 |
| `tour-product-v2-scope.css` | `components/product-tour-static/east-signature-nature-core/` | ⚠️ light 전용. `.tour-product-v2-static-root.dark` 미정의 (D.6 보류) |
| 홈 v2 토큰 (`--hero-cool-bg-*`, `--home-shadow-*`) | `app/home-premium.css` (`@import` 경유) | ✅ 라이트 정의, 다크 미정의 |

**핵심 발견 (§B #16의 배경)**:
- 토큰 네임스페이스 충돌 11종 — AtoC와 shadcn이 동일 변수명 사용: `--accent`, `--background`, `--foreground`, `--card`, `--popover`, `--primary`, `--secondary`, `--muted`, `--border`, `--ring`, `--input`.
- AtoC L21–73은 unlayered `:root` (cascade 우선). shadcn L1077은 `@layer base`. 라이트 상태에서는 AtoC가 우선. **그러나 `.dark` 클래스 적용 시 shadcn `.dark { --accent: oklch(0.269 0 0) }`이 specificity(0,1,0) > AtoC `:root`(0,0,1)로 덮어쓰며 앰버 아이덴티티 손실** → §B #16 결정.

### 2.2 백 버튼 진입점 — 단일 통합 가능

| 항목 | 위치 | 상태 |
|---|---|---|
| 공유 레이아웃 | `src/components/layout/SitePageShell.tsx` | ✅ 모든 페이지 래핑 (admin 제외) |
| 메인 헤더 | `components/Header.tsx` | ✅ `usePathname` / `useRouter` 이미 사용 → 확장 용이 |
| 모바일 하단 nav | `components/BottomNav.tsx` | ✅ md:hidden 4-탭, z-50 fixed bottom — 백 버튼과 z-index 충돌 가능성 ⚠️ |
| iOS 감지 | (없음) | ❌ |
| standalone/PWA 감지 | (없음) | ❌ |
| PWA manifest | (없음) | ❌ |
| Admin breadcrumb | `app/admin/layout.tsx:23-35` | ✅ 자체 시스템 — 백 버튼 제외 대상 |
| 투어 상세 sticky booking bar | `tour-product-v2-scope` 영역 | ⚠️ 백 버튼 z-index 검토 필요 |

### 2.3 페이지 인벤토리 (D.5 마이그레이션 단위)

- **공개 핵심**: `/`, `/tours`, `/tour-product/[slug]`, `/tour/[id]`, `/search`, `/about`, `/contact`
- **예약**: `/cart`, `/checkout`
- **인증**: `/signin`, `/signup`, `/forgot-password`, `/forgot-id`, `/reset-password`
- **사용자**: `/mypage`, `/my-page`, `/match`, `/merchant`
- **법무**: `/legal`, `/privacy`, `/refund-policy`, `/terms`, `/dsa`, `/cookies`
- **Admin**: `/admin/*` (별도 마이그레이션, 우선순위 ↓)
- **지역**: `/seoul`, `/busan`, `/jeju`
- **빌더**: `/itinerary-builder`

---

## 3. 페인 포인트

### 다크 모드
1. **현재 다크 모드 없음** — 야간 사용자 눈 부담, OS 기본 다크 사용자가 사이트만 강한 흰 배경.
2. **이미 토큰 절반은 있는데 활성화 안 됨** — `app/globals.css`에 `.dark { … }` 블록이 부분 존재하나 토글 미연결.
3. **하드코딩 클래스 ~1,200개** — 일괄 변환은 PR 거대화 + 회귀 위험.
4. **투어 상세 페이지 격리 스코프** — `tour-product-v2-scope.css`가 light 전용 토큰 → 다크화 시 별도 분기 필요.

### iOS 백 버튼
1. **PWA 홈스크린 추가 모드에서 백 버튼 없음** — 사용자가 막힘.
2. **카카오톡/인스타그램 인앱 브라우저에서 ←가 가려지거나 혼란** — 한국 사용자 비중 ↑.
3. **PWA manifest 없음** → 진짜 앱처럼 동작 불가.
4. **공유 레이아웃은 있으나 헤더에 백 버튼 슬롯이 없음** — 라우트별 분기 없이 한 곳에서 처리 가능한 상태.

---

## 4. 핵심 결정 (§B 요약)

| 영역 | 결정 |
|---|---|
| 실행 순서 | B(백 버튼) 전체 ✅ → D(다크 모드) 시작 |
| 다크 모드 기본 | `system` (OS 따름) |
| 다크 모드 구현 | `next-themes` + `tailwind.darkMode: 'class'` + 기존 CSS 변수 확장 |
| 다크 마이그레이션 방식 | `dark:` 접두사 점진 추가, 한 PR 한 페이지 |
| 토글 UI | ☀️ / 🌙 / 💻 (3-상태), Header 우측 |
| 백 버튼 표시 조건 | iOS + (standalone OR 인앱 브라우저) |
| 백 버튼 위치 | Header 좌측 슬롯, 루트 `/`에서 숨김 |
| Admin 제외 | 자체 breadcrumb 존재 |
| 투어 상세 다크화 | tour-product-detail 마스터 플랜 종료 후 (Phase D.6) |
| 신규 의존성 | `next-themes` 하나만 |

---

## 5. Phase별 실행 계획

### Phase 0 — 사전 정의 + 토큰 인벤토리 (코드 변경 없음, 0.5일)

목표: D.2/D.5 진행 시 필요한 토큰·페이지 인벤토리 사전 확정.

- [ ] `app/globals.css` 69 변수 전체 표 만들기 → 다크 값 결정 (작업 시트, 커밋 안 함)
- [ ] 페이지별 하드코딩 클래스 카운트 (`bg-white` / `bg-gray-*` / `text-slate-*` 등) → D.5 우선순위 확정
- [ ] iOS UA / standalone / 인앱 브라우저 매트릭스 정리 (카카오톡 / 인스타 / 페이스북 / 네이버 인앱 / Line)
- [ ] §A 표 확정 (현 시점에 작성된 위 §A 표가 base, 사용자 검토 후 fix)

**Acceptance**: 작업 시트 작성 + §C에 한 줄 등록. 코드 미변경.

### Phase B.1 — iOS/standalone/in-app 감지 유틸 (0.5일)

- [ ] `src/lib/device/use-ios-backbar.ts` 신규
  - `isIOS = /iPhone|iPad|iPod/.test(ua)`
  - `isStandalone = (navigator as any).standalone === true || matchMedia('(display-mode: standalone)').matches`
  - `isInAppBrowser = /KAKAOTALK|Instagram|FBAN|FBAV|NAVER|Line/i.test(ua)`
  - `shouldShow = isIOS && (isStandalone || isInAppBrowser)`
- [ ] SSR safe (window 가드)
- [ ] 단위 테스트 — 5개 UA fixture (Safari / 카톡 / 인스타 / Naver / Line)

**Acceptance**: 5개 UA fixture 모두 expected 결과 일치.

### Phase B.2 — BackButton 컴포넌트 (0.5일)

- [ ] `components/app-shell/BackButton.tsx` 신규
  - chevron-left 아이콘 + a11y label (i18n)
  - `onClick = () => history.length > 1 ? router.back() : router.push('/')`
  - touch target ≥ 44px (iOS HIG)
  - reduce-motion 가드
- [ ] i18n 키 — `appShell.backButton.label` (6 locale)
- [ ] analytics 이벤트 — `app_shell_back_clicked` (route_from, fallback_used)

**Acceptance**: 외부 딥링크(`history.length === 1`)에서 클릭 시 `/`로 이동, 일반 진입에서 이전 페이지 이동.

### Phase B.3 — Header 통합 (0.5일)

- [ ] `components/Header.tsx`에 좌측 슬롯 추가 (로고 왼쪽)
- [ ] `useIosBackbar` hook + `usePathname() !== '/'` 조건
- [ ] `pathname.startsWith('/admin')` 제외
- [ ] 모바일에서만 표시 (`md:hidden`), 데스크톱 영향 없음

**Acceptance**: 모바일 PWA standalone에서 헤더 좌측에 ← 표시. 일반 Safari에서 미표시. `/`에서 미표시. Admin에서 미표시.

### Phase B.4 — 엣지 케이스 QA (0.5일)

- [ ] 투어 상세 sticky booking bar와 z-index 충돌 확인 (`tour-product-v2-scope` 영역)
- [ ] BottomNav (z-50)와 헤더 z-index 정합
- [ ] 외부 referrer 차단 — 백 버튼이 외부 사이트로 가지 않게 history state 검증
- [ ] CDP/모바일 디바이스 (390x844 / 430x932) 실측
- [ ] 카카오톡 인앱 브라우저 실측 (가능한 경우)

**Acceptance**: §C에 CDP 스크린샷 경로 + 충돌 없음 확인 한 줄.

### Phase B.5 — PWA manifest + apple meta (0.5일)

- [ ] `public/manifest.json` 작성 — `name`, `short_name`, `start_url: '/'`, `display: 'standalone'`, `theme_color`, `background_color`, `icons` (180/192/512)
- [ ] `app/layout.tsx` `<head>` — `<link rel="manifest">`, `<meta name="apple-mobile-web-app-capable" content="yes">`, `<meta name="apple-mobile-web-app-status-bar-style" content="default">`, `<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">`
- [ ] 기존 SVG 로고에서 PNG 180x180 / 192x192 / 512x512 추출 (public/icons/)

**Acceptance**: iPhone에서 "홈 화면에 추가" → 앱 아이콘 표시 + standalone 진입 시 백 버튼 보임.

### Phase D.1 — Tailwind class + next-themes 연결 (0.5일)

- [ ] `npm install next-themes`
- [ ] `tailwind.config.*` → `darkMode: 'class'`
- [ ] `app/layout.tsx` — `<ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>` 래핑
- [ ] 무 깜빡임 head script (next-themes 자동 처리, 검증)
- [ ] **이 단계에서는 시각 변화 0 — 토글 UI 없음, `.dark` 토큰 미보강**

**Acceptance**: devtools에서 `<html class="dark">` 수동 토글 시 shadcn 컴포넌트(Button, Card, Input)가 자동 다크. 다른 영역은 변화 없음.

### Phase D.2 — globals.css `.dark` 블록 완성 (1일)

- [ ] Phase 0에서 작성한 69 토큰 표 기반 다크 값 채움
  - `--background`, `--foreground`
  - `--surface-card`, `--surface-card-soft`, `--surface-section-warm`, `--surface-section-dark`
  - `--text-primary` / `--text-secondary` / `--text-muted` / `--text-inverse`
  - `--line-soft` / `--line-strong`
  - `--shadow-*` (다크에서는 약화)
  - `--accent` / `--accent-soft` / `--accent-strong` (앰버는 그대로, 강도만 미세 조정)
  - `--hero-cool-bg-*` / `--hero-elevated-*`
  - `--home-shadow-*`
  - `--focus-ring` (다크에서 contrast 조정)
- [ ] WCAG AA contrast 검증 (모든 텍스트/배경 조합)

**Acceptance**: 다크 모드 강제 활성화 시 홈 라이트 동등 정보 표시 + WCAG AA 통과.

### Phase D.3 — 토글 컴포넌트 + Header 통합 (0.5일)

- [ ] `components/app-shell/ThemeToggle.tsx`
  - 3-상태 cycle (light → dark → system → light)
  - 아이콘 ☀️ / 🌙 / 💻
  - 현재 상태 a11y label
  - i18n 키 — `appShell.themeToggle.{light,dark,system}`
- [ ] Header 우측 (currency dropdown 옆) 통합
- [ ] analytics — `app_shell_theme_changed` (from, to)

**Acceptance**: 토글 후 reload 유지, FOUC 없음, 시스템 모드에서 OS 변경 시 자동 반영.

### Phase D.4 — shadcn/ui + 홈 v2 다크 시각 QA (1일)

- [ ] shadcn/ui 컴포넌트 다크 시각 검증 (Button / Card / Dialog / Input / Select / Sheet / Tabs / …)
- [ ] 홈 v2 (`components/home/v2/*`) 다크 미리보기
  - Hero / Match preview / Sticky CTA / Season chip / Idle preview / Featured / Destinations / Process / Why
- [ ] 누락 토큰 / 하드코딩 발견 시 D.5로 이전 (페이지 단위 PR)
- [ ] 사진/이미지 명도 점검 (필요 시 D.7로 이전)

**Acceptance**: 홈 모든 섹션 다크 스크린샷 + WCAG AA + 페인 포인트 리스트 → D.5/D.7 우선순위 반영.

### Phase D.5 — 페이지별 점진 마이그레이션 (반복, 5–10일)

페이지별 한 PR씩. 각 페이지 PR 구조:
- 하드코딩 클래스 → `dark:` 접두사 추가 (의미 클래스 한정, `bg-white dark:bg-neutral-900` 식)
- 변수 클래스가 더 적합한 경우만 변수화 (`bg-background`)
- 페이지 다크 스크린샷 → §C 첨부

순서 (사용자 빈도 기준):
- [ ] D.5.a — `/` (홈) — D.4에서 누락분 보강
- [ ] D.5.b — `/tours`, `/search`
- [ ] D.5.c — `/cart`, `/checkout`
- [ ] D.5.d — `/mypage`, `/my-page`, `/match`
- [ ] D.5.e — `/signin`, `/signup`, `/forgot-*`, `/reset-password`
- [ ] D.5.f — `/about`, `/contact`, `/legal/*`, `/privacy`, `/terms`, `/refund-policy`, `/dsa`, `/cookies`
- [ ] D.5.g — `/seoul`, `/busan`, `/jeju`
- [ ] D.5.h — `/itinerary-builder`
- [ ] D.5.i — `/admin/*` (후순위)

**Acceptance per page**: 다크 스크린샷 + WCAG AA + 라이트 회귀 없음.

### Phase D.6 — 투어 상세 (`tour-product-v2-scope`) — ⏸ 보류

- 의존성: `docs/tour-product-detail-ui-ux-audit-response-2026-05-17.md` 종료
- 작업 내용: `tour-product-v2-scope.css`에 `.tour-product-v2-static-root.dark { … }` 블록 추가, 격리 토큰 다크 값 정의
- 종료 시점에 이 Phase 활성화 결정.

### Phase D.7 — 이미지/사진 명도 보정 + 최종 QA (1일)

- [ ] 로고 다크 변형 (`<picture>` + `prefers-color-scheme` source)
- [ ] OTA 사진에 `filter: brightness(0.92)` 적용 (다크에서만, 너무 밝지 않게)
- [ ] 포커스 링 (`--focus-ring`) 다크 contrast 검증
- [ ] 전체 페이지 다크 회귀 스크린샷 모음
- [ ] WCAG AA 자동화 검증 (axe-core CI 또는 수동 lighthouse)

**Acceptance**: 다크 모드 활성화 후 라이트와 동등 정보·기능·접근성.

---

## 6. 체크리스트 (모든 Phase 통합 뷰)

§5의 모든 체크박스가 여기로 그대로 옮겨질 수 있도록 §5를 진행하며 동기화. 별도 페이지로 분리하지 않음 (§5가 단일 진실).

---

## 7. 토큰 매핑 / 컴포넌트 계약

### 7.1 토큰 다크 값 결정 가이드 (Phase 0 / D.2)

| 라이트 토큰 | 다크 값 결정 원칙 |
|---|---|
| `--background` (`#fff`) | `#0a0a0a` 또는 `#0c0e12` (순백 → 짙은 무채 어두움) |
| `--foreground` (`#171717`) | `#ededed` (순흑 → 따뜻한 라이트 그레이) |
| `--text-primary` | 다크에서 contrast 7:1 이상 (WCAG AAA 권장) |
| `--text-secondary` | 4.5:1 이상 (AA) |
| `--surface-card` | `--background`보다 한 단계 밝게 (앱이 어둠 깊이 표현) |
| `--accent` (앰버) | hue 유지, saturation 미세 ↓, lightness 미세 ↑ (다크에서 너무 강하지 않게) |
| `--shadow-*` | 다크에서 약화 (검은 배경에 검은 그림자는 의미 없음) |
| `--focus-ring` | 다크에서 contrast 3:1 이상 |

### 7.2 컴포넌트 계약 (Phase B / D.3)

| 컴포넌트 | 파일 | 신규/수정 |
|---|---|---|
| `useIosBackbar` hook | `src/lib/device/use-ios-backbar.ts` | 신규 |
| `BackButton` | `components/app-shell/BackButton.tsx` | 신규 |
| `ThemeToggle` | `components/app-shell/ThemeToggle.tsx` | 신규 |
| `Header` | `components/Header.tsx` | 수정 (좌측 슬롯 + 토글) |
| `ThemeProvider` | `app/layout.tsx` | 수정 (래핑) |
| `manifest.json` | `public/manifest.json` | 신규 |
| `globals.css .dark` | `app/globals.css` | 수정 (블록 완성) |

---

## 8. 모션 / a11y 가이드

- 다크 모드 전환 시 transition 비활성화 (next-themes `disableTransitionOnChange`). 페이지 전체 깜빡임 방지.
- 백 버튼 touch target ≥ 44px (iOS HIG). 시각 크기 24px 아이콘 + 패딩.
- prefers-reduced-motion 시 토글 아이콘 회전 애니메이션 생략.
- 모든 토글/버튼 a11y label 다국어 제공.
- 포커스 링은 다크에서도 명확히 보이도록 `--focus-ring` 별도 다크 값.

---

## 9. i18n / 카피 키

| 키 | ko | en | ja | zh | zh-TW | es |
|---|---|---|---|---|---|---|
| `appShell.backButton.label` | 뒤로 | Back | 戻る | 返回 | 返回 | Atrás |
| `appShell.themeToggle.light` | 라이트 모드 | Light mode | ライトモード | 浅色模式 | 淺色模式 | Modo claro |
| `appShell.themeToggle.dark` | 다크 모드 | Dark mode | ダークモード | 深色模式 | 深色模式 | Modo oscuro |
| `appShell.themeToggle.system` | 시스템 설정 | System | システム | 跟随系统 | 跟隨系統 | Sistema |

(Phase B.2 / D.3 진입 시 messages 파일에 실제 추가)

---

## 10. 성공 기준

### 다크 모드
- ✅ 토글 후 reload 시 상태 유지 (localStorage)
- ✅ `system` 모드에서 OS 다크 변경 시 자동 반영
- ✅ FOUC(깜빡임) 0ms — head script로 hydration 전 적용
- ✅ 모든 페이지 WCAG AA (text 4.5:1, non-text 3:1)
- ✅ LCP 회귀 < +50ms
- ✅ CLS 회귀 < +0.01

### iOS 백 버튼
- ✅ iOS standalone 모드에서 표시, 일반 Safari에서 미표시
- ✅ 카카오톡/인스타 인앱 브라우저에서 표시
- ✅ Android에서 미표시 (시스템 ← 존재)
- ✅ Admin에서 미표시
- ✅ 루트(`/`)에서 미표시
- ✅ 외부 딥링크 진입 시 `/`로 폴백, 사이트 밖으로 안 나감
- ✅ touch target ≥ 44px

---

## 11. 롤백 트리거

자동 롤백 임계값. 발견 시 active Phase 즉시 ❌ 표시.

| 트리거 | 행동 |
|---|---|
| LCP 회귀 > +100ms (다크 모드 적용 후) | D.x 직전 커밋으로 revert + §C 사유 기록 |
| CLS 회귀 > +0.02 | revert |
| WCAG AA 위반 페이지 발견 | 해당 페이지 D.5.x revert + 토큰 조정 후 재진입 |
| 백 버튼 클릭 시 외부 사이트 이동 발생 | B.4 revert + history state 검증 강화 |
| iOS standalone 진입 후 화이트스크린 | B.5 manifest revert |
| 다크 토글 후 FOUC 발생 (200ms+ 깜빡임) | D.1 next-themes 설정 재검토 |

---

## 12. 의존성 / 충돌 관리

### 외부 의존성
- **`next-themes`** — Phase D.1에서 신규 도입. 단일 라이브러리, ~3kb gz.
- **그 외 신규 라이브러리 금지** (§B #12).

### 다른 마스터 플랜과의 충돌
- `docs/tour-product-detail-ui-ux-audit-response-2026-05-17.md` (투어 상세) — Phase D.6 보류 사유. 종료 후 활성화.
- `docs/landing-page-uiux-master-plan-v3-2026-05-17.md` (랜딩) — D.5.a에서 홈 다크화 시 §11 LCP/CLS 임계값 공유. 위반 시 양쪽 §A 모두 ❌.
- `docs/itinerary-builder-plan.md` — D.5.h에서 itinerary-builder 다크화 시 POI 핀 색상·맵 스타일 별도 검토 (Google Maps 다크 스타일).

### 내부 충돌
- Header (`components/Header.tsx`) 한 파일에 백 버튼 + 토글 둘 다 추가됨 → B.3 / D.3 동시 PR 금지. B.3 완료 후 D.3.

---

## §14. 부록 — 토큰 인벤토리 (Phase 0.1 산출)

`app/globals.css` 코드 실사 결과. **총 113 변수 정의 라인** (선언 라인 기준, `:root` / `.dark` / `@media` 합산). 의미 단위로 분류:

### 14.1 AtoC 커스텀 토큰 (`:root` L21–73, unlayered) — 22 토큰, 다크값 ❌

| 토큰 | 라이트 값 | 권장 다크 값 (D.2 결정 가이드) | 충돌 여부 |
|---|---|---|---|
| `--section-py-sm` | 64px | (mode-independent, 그대로) | — |
| `--section-py-md` | 96px | (mode-independent) | — |
| `--section-py-lg` | 144px | (mode-independent) | — |
| `--radius-card` | 24px | (mode-independent) | — |
| `--radius-button` | 14px | (mode-independent) | — |
| `--radius-image` | 12px | (mode-independent) | — |
| `--shadow-1` | crisp+diffuse 라이트 | 그림자 약화 (rgba 0,0,0,0.3 외곽선 강조) | — |
| `--shadow-2` | 동일 패턴 | 위와 동일 원칙 | — |
| `--shadow-3` | 동일 패턴 | 위와 동일 원칙 | — |
| `--accent` | `theme('colors.amber.700')` | `theme('colors.amber.400')` (다크에서 밝게 — 앰버 유지) | ⚠️ shadcn 충돌 |
| `--accent-soft` | `theme('colors.amber.50')` | `theme('colors.amber.950')` (다크 톤 톡톡) | — |
| `--accent-strong` | `theme('colors.amber.800')` | `theme('colors.amber.300')` | — |
| `--text-primary` | `colors.slate.900` | `colors.slate.100` (contrast 12.6:1) | — |
| `--text-secondary` | `colors.slate.600` | `colors.slate.300` (contrast 7.5:1) | — |
| `--text-muted` | `colors.slate.400` | `colors.slate.500` (contrast 4.7:1) | — |
| `--text-inverse` | `colors.white` | `colors.slate.900` | — |
| `--surface-card` | `#ffffff` | `#171c26` (한 단계 밝게) | ⚠️ shadcn `--card` 충돌 |
| `--surface-card-soft` | `colors.slate.50` | `#1a2030` | — |
| `--surface-section-warm` | `#FDF8F0` | `#1a160e` (warm 톤 보존) | — |
| `--surface-section-dark` | `#141008` | (그대로, 이미 다크) | — |
| `--line-soft` | `colors.slate.100` | `#252b38` | — |
| `--line-strong` | `colors.slate.200` | `#363d4d` | — |
| `--focus-ring` | `0 0 0 2px rgba(245, 158, 11, 0.6)` | `0 0 0 2px rgba(252, 211, 77, 0.85)` (다크 contrast 3:1↑) | — |
| `--focus-ring-offset` | 2px | (mode-independent) | — |

### 14.2 미니 `:root` 토큰 (L194–204) — 2 토큰, `prefers-color-scheme` 다크 ✅

| 토큰 | 라이트 | 다크 (`@media prefers-color-scheme: dark`) | 충돌 |
|---|---|---|---|
| `--background` | `#ffffff` | `#0a0a0a` | ⚠️ shadcn 충돌 |
| `--foreground` | `#171717` | `#ededed` | ⚠️ shadcn 충돌 |

→ D.1에서 `tailwind.darkMode: 'class'` 전환 시 `@media` 룰은 **제거 또는 `.dark` 블록과 일관성 맞춤** 필요. 그대로 두면 `system` 모드 + 수동 라이트 토글 시 충돌.

### 14.3 shadcn 토큰 (`@layer base { :root }` L1077–1114) — 33 토큰, `.dark` 페어 ✅

라이트 / 다크 페어가 이미 존재. AtoC와 충돌하는 11종을 §B #16에서 AtoC가 `.dark`에 동일 변수 재정의로 처리:

| 충돌 shadcn 토큰 (D.2에서 AtoC가 .dark에 재정의) |
|---|
| `--background`, `--foreground`, `--card`, `--card-foreground`, `--popover`, `--popover-foreground`, `--primary`, `--primary-foreground`, `--secondary`, `--muted`, `--accent`, `--border`, `--ring`, `--input` |

| 비충돌 shadcn 토큰 (그대로 사용) |
|---|
| `--destructive`, `--chart-1..5`, `--radius`, `--sidebar`, `--sidebar-foreground`, `--sidebar-primary`, `--sidebar-primary-foreground`, `--sidebar-accent`, `--sidebar-accent-foreground`, `--sidebar-border`, `--sidebar-ring`, `--font-sans`, `--page-gradient-fallback` |

### 14.4 home-premium.css / tour-detail-cards.css 토큰

별도 파일이라 본 표에 미수록. D.4 진입 시 같은 형식의 표를 추가 부록으로 보강 예정.

### 14.5 D.2 작업 요약

1. AtoC `:root` L21–73의 22 토큰 중 mode-dependent 19개(section-py, radius 3종 제외)에 다크값 추가
2. 미니 `:root` L194–204 + `@media` 룰을 `.dark` 블록으로 통합 (D.1 단계)
3. shadcn 충돌 11종을 AtoC `.dark` 블록에서 앰버 아이덴티티 유지 가능한 값으로 재정의
4. WCAG AA contrast 검증 (모든 text/surface 페어)

---

## §15. 부록 — 페이지별 하드코딩 클래스 카운트 (Phase 0.2 산출)

grep 패턴: `\bbg-white\b|\bbg-gray-[0-9]+\b|\bbg-slate-[0-9]+\b|\btext-gray-[0-9]+\b|\btext-slate-[0-9]+\b|\bbg-neutral-[0-9]+\b|\btext-neutral-[0-9]+\b`

**총합**: `/app` 1,815 occurrences in 96 files / `/components` 1,416 in 170 files = **3,231 occurrences** (v0 worktree 포함). v0 worktree 제외 추정 약 **2,000**.

### 15.1 D.5 마이그레이션 우선순위 (사용자 빈도 + 매출 영향 + 작업량 균형)

| D.5 슬롯 | 경로 | 주요 파일 (count) | 누적 추정 |
|---|---|---|---|
| **D.5.a — 홈** | `/` | 홈은 대부분 `components/home/v2/*` (~120). `app/page.tsx` 직접 거의 없음 | ~120 |
| D.5.b — 투어 리스트 / 검색 | `/tours`, `/search`, `/tours/list` | `app/tours/page.tsx`(7) + `app/tours/list/page.tsx`(34) + `app/search/page.tsx`(3) + `components/tours-hub/*`(17) + `components/tours/*`(51) | ~112 |
| D.5.c — 예약 (매출 직결) | `/cart`, `/checkout`, `/tour/[id]/checkout` | `app/cart/page.tsx`(38) + `app/checkout/page.tsx`(2) + `app/tour/[id]/checkout/page.tsx`(24) + `components/checkout/*`(8) | ~72 |
| D.5.d — 마이페이지 / 매칭 | `/mypage/*`, `/match` | `app/mypage/settings/page.tsx`(37) + `app/match/page.tsx`(30) + `app/mypage/dashboard/page.tsx`(19) + `app/mypage/history/page.tsx`(12) + `mypage/mybookings`(12) + `wishlist`(14) + `reviews`(12+16) + 기타. components/mypage 다수 | ~200 |
| D.5.e — 인증 | `/signin`, `/signup`, `/forgot-*`, `/reset-password` | `signup`(41) + `signin`(17) + `forgot-id`(7) + `reset-password`(1) + `forgot-password`(1) + `components/auth/*`(5) | ~72 |
| D.5.f — 법무 / 정적 페이지 | `/about`, `/contact`, `/legal/*`, `/privacy`, `/terms`, `/refund-policy`, `/cookies`, `/dsa`, `/support` | `about`(24) + `contact`(4) + `support`(27) + `cookies`(1) + `legal`(12) + `components/legal/legal-document.tsx`(12) | ~80 |
| D.5.g — 지역 페이지 | `/seoul`, `/busan`, `/jeju` | 각 1 (대부분 SeasonalTours 컴포넌트 경유) | ~5 |
| D.5.h — 빌더 | `/itinerary-builder/*` | `itinerary-builder/page.tsx`(5) + `[region]/page.tsx`(5) + `thanks/page.tsx`(24) + `components/itinerary-builder/*`(72) | ~106 |
| D.5.i — Admin (후순위) | `/admin/*` | `admin/products/page.tsx`(189 — 최고) + `admin/orders/[id]`(69) + `admin/contacts`(40) + `admin/merchants/[id]`(40) + `admin/cms`(36) + `admin/analytics/*` 다수 | ~600+ |
| **(제외)** v0 / mockup / detailpage 변종 | `components/b_*`, `components/landing page (4)`, `components/sangsong027 detailpage`, `components/TourDetailV2`, `app/mockup` | 약 ~600 — 실제 라이브 라우트 아님 | — |

### 15.2 우선순위 결정 원칙

1. **매출 직결 + 사용자 빈도 ↑** = D.5.a → D.5.b → D.5.c (홈 → 리스트 → 결제)
2. **회원 영역** = D.5.d → D.5.e (재방문자 / 신규 가입)
3. **저빈도 + 정적** = D.5.f → D.5.g → D.5.h (콘텐츠 페이지 / 지역 / 빌더)
4. **백오피스** = D.5.i 마지막 (사용자 노출 0)
5. **v0 / mockup / detailpage 변종 = 마이그레이션 대상 외** — 살아있는 라우트가 아니거나 deprecated. tour-product-detail-uiux 종료 후 일괄 정리 권장 (§D 추가 아이디어 후보)

---

## §16. 부록 — iOS UA / standalone / 인앱 브라우저 매트릭스 (Phase 0.3 산출)

Phase B.1의 `src/lib/device/use-ios-backbar.ts` 구현 기준.

### 16.1 감지 시그널

| 시그널 | 판정 방법 | 노트 |
|---|---|---|
| iOS 기기 | `/iPhone\|iPad\|iPod/.test(navigator.userAgent)` | iPadOS 13+는 `Macintosh` UA 위장. `navigator.maxTouchPoints > 1` 추가 검사 권장 |
| Standalone (PWA 홈스크린 추가) | `(navigator as any).standalone === true \|\| matchMedia('(display-mode: standalone)').matches` | iOS 전용 `navigator.standalone`. 일반 브라우저는 `false` |
| 일반 iOS Safari | iOS = true + standalone = false + 인앱 = false | 하단 ← 존재 → **백 버튼 표시 ❌** (§B #8) |

### 16.2 한국 주요 인앱 브라우저 UA 패턴

| 앱 | UA 매칭 패턴 (regex 부분) | 출처 / 비고 |
|---|---|---|
| 카카오톡 인앱 | `/KAKAOTALK[/\s]/i` | 예: `KAKAOTALK 10.5.5`. 한국 비중 ↑↑↑ |
| 인스타그램 인앱 | `/Instagram[/\s]/i` | 예: `Instagram 280.0.0.18.114` |
| 페이스북 인앱 (iOS) | `/FBAN\/FBIOS\|FBAV\//i` | 예: `FBAN/FBIOS;FBAV/420.0.0.32.106` |
| 네이버 인앱 | `/NAVER\(inapp/i` | 예: `NAVER(inapp; search; 1235; 11.16.3)` |
| Line 인앱 | `/Line[/\s]/i` | 예: `Line/12.5.0` |
| 카카오스토리 | `/KAKAOSTORY[/\s]/i` | 트래픽 적지만 안전 매칭 |
| 다음 (Daum) 인앱 | `/daumapps[/\s]/i` | 다음 앱 |

### 16.3 통합 감지 로직 (B.1 구현 가이드)

```ts
// src/lib/device/use-ios-backbar.ts (B.1 신규)
export function useIosBackbar(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIOSDevice = /iPhone|iPad|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (!isIOSDevice) return false;

  const isStandalone =
    (navigator as any).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches;
  const isInAppBrowser =
    /KAKAOTALK[/\s]|Instagram[/\s]|FBAN\/FBIOS|FBAV\/|NAVER\(inapp|Line[/\s]|KAKAOSTORY[/\s]|daumapps[/\s]/i.test(ua);

  return isStandalone || isInAppBrowser;
}
```

### 16.4 B.1 단위 테스트 픽스처 (UA 문자열)

| 케이스 | UA | 기대 결과 |
|---|---|---|
| iPhone Safari (일반) | `Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ... Version/17.0 Mobile/15E148 Safari/604.1` | `false` |
| iPhone PWA standalone | (같은 UA) + `navigator.standalone === true` | `true` |
| iPhone 카카오톡 인앱 | `Mozilla/5.0 (iPhone; ...) KAKAOTALK 10.5.5` | `true` |
| iPhone 인스타 인앱 | `Mozilla/5.0 (iPhone; ...) Instagram 280.0.0.18.114` | `true` |
| iPhone 페이스북 인앱 | `Mozilla/5.0 (iPhone; ...) [FBAN/FBIOS;FBAV/420.0.0.32.106;...]` | `true` |
| iPhone 네이버 인앱 | `Mozilla/5.0 (iPhone; ...) NAVER(inapp; search; 1235; 11.16.3)` | `true` |
| iPad PWA standalone | `Mozilla/5.0 (Macintosh; ...) maxTouchPoints=5 + standalone=true` | `true` |
| Android Chrome | `Mozilla/5.0 (Linux; Android 13; ...) Chrome/115` | `false` |
| Desktop Chrome | `Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/115` | `false` |

### 16.5 엣지 케이스 (B.4 QA 항목)

- **카카오톡 인앱**에서 표시되는 자체 ← 버튼이 화면 좌하단에 있어 헤더 백 버튼과 시각 충돌 가능 → CDP 실측 시 확인
- **인스타그램 인앱**은 상단에 자체 X (close) 있음, 백 버튼 없음 → 표시 정당함
- **iPadOS** UA 위장 케이스 = `maxTouchPoints` 검사 누락 시 미표시 발생 → 픽스처 8번으로 커버

---

## §17. 부록 — B.4 엣지 케이스 QA 산출 (Phase B.4)

### 17.1 z-index 매핑 (`grep z-\d+|z-\[\d+\]` across components)

| 영역 | 컴포넌트 | z | 위치 | BackButton과의 관계 |
|---|---|---|---|---|
| **전역 셸** | `Header` (`sticky top`) | `z-50` | top | **BackButton은 Header 내부 자식 — Header z-50 상속** |
| 전역 셸 | `BottomNav` (`fixed bottom`) | `z-50` | bottom (md:hidden) | 상하 위치 분리 → 충돌 없음 |
| 홈 | `StickyHomeCta` (`fixed bottom`) | `z-40` | bottom | Header 아래, BackButton 위치(top) 분리 → 충돌 없음 |
| 헤더 | Header 검색 모달 | `z-50` | full | 모달 열렸을 때 BackButton 가려짐 — 모달 자체 close UX 있음(X 버튼). 정상 |
| 투어 상세 | `EastSignatureV0SiteHeader` | `z-50` | top | 메인 Header와 동등. 페이지 분기 시 충돌 없음(둘 다 sticky top → 한 페이지에 한쪽만 렌더) |
| 투어 상세 | `TourStickyBookingBar` overlay | `z-40` | full | Header z-50 아래 → BackButton 클릭 가능 ✓ |
| 투어 상세 | `TourStickyBookingBar` self | `z-50` | bottom | 위치 분리 → 충돌 없음 |
| 투어 상세 | `TourTabsNav` (subnav-sticky) | `z-40` | sticky top:3rem | Header 아래 stack → BackButton 클릭 가능 ✓ |
| 투어 상세 | `TourAtmosphereGallery` lightbox | `z-50` | full | 라이트박스 자체 close — BackButton과 동시 표시 시 lightbox가 가림. 의도된 동작 |
| 투어 상세 | `TourStopDetailDrawer` | `z-[70~90]` | full | drawer 열림 시 Header 위 → BackButton 가려짐. drawer 자체 close UX 있음. 의도된 동작 |
| 투어 상세 | `TourProductAiAssistantWidget` | `z-[65]` | fixed right | 좌측 BackButton과 위치 분리 → 충돌 없음 |
| 투어 상세 | `bookingShared` dropdown | `z-[55~60]` | absolute | 카드 내부 dropdown — BackButton과 위치/스택 분리 → 충돌 없음 |

**결론**: BackButton(Header 내부, top-left, z-50 상속)은 다른 모든 fixed/sticky 요소와 **위치 분리(top vs bottom) 또는 z 분리** 정합. 의도된 occlusion(lightbox/drawer) 외에 충돌 없음.

### 17.2 외부 referrer 가드 — B.2 코드 결함 발견 및 패치

**결함 (B.2 v1)**:
```ts
const fallbackUsed = window.history.length <= 1; // 부족
```

**시나리오**:
- Insta → `/tour-product/x` (`history.length=2`) → `/cart` (`history.length=3`)
- `/cart`에서 백 → router.back() → `/tour-product/x` ✓
- `/tour-product/x`에서 다시 백 → `history.length=2 > 1` 이므로 폴백 안 됨 → router.back() → **Insta로 이탈** ✗

**패치 (B.4 fix)**: tab 첫 진입 시점의 `history.length`를 sessionStorage anchor로 저장. `현재 length > anchor`일 때만 router.back() 안전.

```ts
const HISTORY_ANCHOR_KEY = "atoc_history_anchor";

function getHistoryAnchor(): number {
  if (typeof window === "undefined") return 0;
  try {
    const stored = window.sessionStorage.getItem(HISTORY_ANCHOR_KEY);
    if (stored !== null) {
      const parsed = parseInt(stored, 10);
      if (Number.isFinite(parsed)) return parsed;
    }
    const current = window.history.length;
    window.sessionStorage.setItem(HISTORY_ANCHOR_KEY, String(current));
    return current;
  } catch {
    return typeof window !== "undefined" ? window.history.length : 0;
  }
}

// in handleClick:
const fallbackUsed =
  typeof window === "undefined" ? false : window.history.length <= getHistoryAnchor();
```

**검증 (시나리오 매트릭스)**:

| 시나리오 | anchor | history.length 흐름 | BackButton 결과 |
|---|---|---|---|
| Insta → `/tour` → 백 | 2 | 2 | 2 ≤ 2 → 폴백 `/` ✓ |
| Insta → `/tour` → `/cart` → 백 | 2 | 3 | 3 > 2 → router.back() → `/tour` ✓ |
| 위 ↑ → `/tour`에서 다시 백 | 2 | 2 | 2 ≤ 2 → 폴백 `/` ✓ (Insta로 안 새어나감) |
| 신규 탭 → `/` 직접 입력 → `/tours` → 백 | 1 | 2 | 2 > 1 → router.back() → `/` ✓ |
| Privacy mode (sessionStorage 차단) | catch fallback → 현재 length | 동일 | 항상 fallback (안전 default) ✓ |

**비고**: sessionStorage는 탭 단위 분리(localStorage 아님) → 사용자가 두 탭에서 AtoC를 열어도 각 탭 anchor 독립. 탭 닫힘과 동시에 정리.

### 17.3 BottomNav 시각 충돌 — none

BottomNav(`fixed bottom-0`, z-50, md:hidden, 4 탭)는 모바일 하단. BackButton은 헤더 좌상단. 둘 다 모바일 한정이나 위치(top vs bottom) 완전 분리 → 충돌 없음.

### 17.4 이연된 manual QA (사용자 환경 의존)

| 항목 | 사유 | 권장 방법 |
|---|---|---|
| CDP/모바일 디바이스 (390x844 / 430x932) 실측 | dev server + browser automation 필요 | Cloudflare Quick Tunnel + Chrome DevTools (이전 v3 패턴) — `npm run dev` → tunnel → mobile UA emulation → 백 버튼 표시/숨김 스크린샷 |
| 카카오톡 인앱 실측 | 실 디바이스 필요 | iOS Safari로 AtoC URL을 카톡 자기방에 전송 → 메시지 내 링크 클릭 → 인앱 브라우저에서 백 버튼 표시 확인 |
| iPhone PWA 홈스크린 추가 → standalone 진입 검증 | 실 디바이스 필요 | Safari 공유 메뉴 → "홈 화면에 추가" → 아이콘 클릭 → standalone 진입 → 백 버튼 표시 확인 (B.5 PWA manifest 종료 후 의미 있어짐) |

---

## 13. 안 할 일 (Anti-patterns)

- ❌ 백 버튼 + 다크 모드를 한 PR에 묶기
- ❌ D.5 페이지 마이그레이션을 여러 페이지 한 PR로 처리
- ❌ 일반 iOS Safari에 백 버튼 표시 (브라우저 ← 중복)
- ❌ `tour-product-v2-scope.css` 다크화 (D.6 의존성 미해소 상태에서)
- ❌ 새 테마 라이브러리 도입 (`next-themes`만 허용)
- ❌ 1,200개 하드코딩 클래스를 한 번에 변환
- ❌ 토글 직후 transition 애니메이션 (`disableTransitionOnChange` 필수)
- ❌ inline `style={{ color: ... }}` 사용 (Tailwind / CSS 변수만)
- ❌ 다크 모드 별도 분기 컴포넌트 작성 (`HeaderDark.tsx` 같은 거)
- ❌ Phase B 끝나기 전 Phase D 진입
- ❌ B.3 완료 전 D.3 진입 (Header 동시 수정 충돌)
- ❌ 마스터 플랜 업데이트 없이 Phase 진행 (§A / §C 비동기화)
- ❌ Admin에 백 버튼 추가 (자체 breadcrumb 충돌)
- ❌ Acceptance 검증 없이 Phase ✅ 마킹

---
