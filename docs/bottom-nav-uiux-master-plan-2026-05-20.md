# Sticky 보텀 내비바 (BottomNav) UI/UX 전면 업그레이드 마스터 플랜

작성일: 2026-05-20
문서 상태: **표준 마스터 플랜 (유일한 실행 기준)**
대상: `components/BottomNav.tsx` (모바일 `md:hidden` 하단 고정 내비 — Home / Tours / Cart / My)
관련: `components/FloatingLanguageToggle.tsx` (보텀나비 위 +80px 플로팅 언어 토글), `src/components/layout/SitePageShell.tsx` (마운트), `components/Header.tsx` (상단 nav — 톤 기준)

작성 배경:
- `/tours/list` 매거진 업그레이드(2026-05-20 완료)로 사이트 톤이 **파스텔 메시 + 반투명 화이트 + slate-900 차콜**로 정착. 글로벌 Header도 `bg-white/88 backdrop-blur-xl`로 격상됨.
- 그런데 **BottomNav만 옛 톤**(blue-600 액센트, bg-white/95, 영어 하드코딩, 모션·배지·a11y 부재)에 남음 → 가족 톤에서 이탈.
- 사용자 지시(2026-05-20): "home tours cart my, sticky 보텀내비바 코딩, 디자인 전면 업그레이드".
- 사용자 방향 결정: **active = 상단 바 + fill 아이콘** / **4탭 유지(FAB 없음)**.

---

## §A. 상태 대시보드

| Phase | 상태 | 시작일 | 완료일 | 마지막 커밋 | 비고 |
|---|---|---|---|---|---|
| 0 — 게이트 (코드 실사 + 토큰 + i18n 키 + cart 카운트 소스 확인 + 결정 로그) | ✅ 완료 | 2026-05-20 | 2026-05-20 | (pending) | **i18n nav.* 키 6 locale 이미 존재(재사용)** · **cart 배지는 글로벌 카운트 스토어 부재로 보류(N6)** · 토큰/결정 확정 |
| 1 — 비주얼/구조 리스킨 (frosted white · slate-900 active · 상단 인디케이터 바 + fill 아이콘 · safe-area · i18n 라벨 · a11y) | 🔄 진행 중 | 2026-05-20 | — | — | 가족 톤 진입 핵심 |
| 2 — 모션 폴리시 (spring tap · active 전환 · reduce-motion 가드). ~~cart 배지~~ N6 보류 | ⏳ | — | — | — | cart 배지는 글로벌 cart context 도입 시 별도 |

상태 마커: ⏳ 대기 / 🔄 진행 중 / ✅ 완료 / ❌ 중단 / 📦 보류

**현재 활성 Phase: Phase 1 — 비주얼/구조 리스킨 (🔄). Phase 0 ✅ (키 재사용, 배지 보류).**

---

## §B. 결정 로그 (binding)

| # | 날짜 | 결정 | 이유 | 번복 |
|---|---|---|---|---|
| N1 | 2026-05-20 | **액센트 = slate-900 차콜.** blue-600 폐기 | 사이트 site-native 톤(랜딩 매처 칩·tours-list)과 가족 컬러. blue는 이탈 | — |
| N2 | 2026-05-20 | **재질 = frosted white `bg-white/85 backdrop-blur-xl` + 상단 hairline.** | 새 Header(`bg-white/88 backdrop-blur-xl`)와 동일 유리 재질 | — |
| N3 | 2026-05-20 | **Active = 상단 인디케이터 바 + fill 아이콘 + 라벨 bold.** | 사용자 선택. iOS/메이저 앱 표준, 깔끔·명확 | — |
| N4 | 2026-05-20 | **4탭 유지 (Home/Tours/Cart/My), 중앙 FAB 없음.** | 사용자 선택. 단순·일관·검증됨 | — |
| N5 | 2026-05-20 | **라벨 i18n 6 locale 의무** (en/ko/zh/zh-TW/es/ja). 하드코딩 영어 금지 | 사이트 전체 6 locale, nav만 영어는 회귀 | — |
| N6 | 2026-05-20 | **Cart 카운트 배지 도입.** 단, **실 카운트 소스가 있을 때만** 실제 수 노출 (없으면 배지 생략 — 가짜 숫자 금지) | tours-list B13 정신 — 동작 안 하는 UI 금지 | — |
| N7 | 2026-05-20 | **safe-area-inset-bottom 패딩 의무.** | 노치/제스처바 폰 하단 잘림 방지 | — |
| N8 | 2026-05-20 | **reduce-motion 가드 의무.** spring tap·active 전환 모두 `prefers-reduced-motion` 존중 | tours-list/상세 모션 정책 일치 | — |
| N9 | 2026-05-20 | **a11y: `aria-current="page"` (active 탭) + 명확한 라벨.** | 스크린리더 접근성 | — |
| N10 | 2026-05-20 | **FloatingLanguageToggle 좌표(보텀나비 위 +80px) 보존.** BottomNav 높이 변경 시 토글 bottom offset 동기화 점검 | 두 요소 겹침 방지 (기존 가드) | — |
| N11 | 2026-05-20 | **신규 라이브러리 금지.** framer-motion(기존) + lucide(기존)만 | 번들·일관성 (사이트 전체 룰) | — |
| N12 | 2026-05-20 | **데스크탑 `md:hidden` 유지.** 데스크탑은 Header nav가 담당 | 현 구조 보존 | — |

---

## §C. 변경 로그

| 날짜 | 항목 | 커밋 | 비고 |
|---|---|---|---|
| 2026-05-20 | 마스터 플랜 작성 | 4b7a0007 | `docs/bottom-nav-uiux-master-plan-2026-05-20.md` |
| 2026-05-20 | **Phase 0 ✅ — 게이트.** 실사 결과: (a) `nav.home/tours/cart/my` i18n 키 6 locale **이미 존재**(Header 사용 중) → 재사용. (b) cart 카운트 — Header도 배지 없음, 메인 cart는 비동기(게스트 sessionStorage/로그인 API), 글로벌 client 카운트 스토어 부재 → **N6대로 배지 보류**(가짜 숫자 금지). Phase 2는 모션만. | (pending) | planner-first |

---

## §1. 코드 실사 스냅샷 (2026-05-20)

- `components/BottomNav.tsx` (73줄, client). `fixed bottom-0 ... bg-white/95 backdrop-blur-md border-t border-white/40 z-50 md:hidden`. `h-16` flex, 4 navItems(인라인 SVG outline 아이콘 + 영어 라벨 하드코딩).
- Active 로직: `path === '/tours/list' ? pathname.startsWith('/tours') : pathname === item.path`. Active 색 `text-blue-600`, 비active `text-gray-500`.
- 마운트: `SitePageShell` → `showBottomNav` true일 때 `<BottomNav/>` + `<div className="h-16 md:hidden"/>`(스페이서) + `<FloatingLanguageToggle/>`.
- 라우트: Home `/`, Tours `/tours/list`, Cart `/cart`, My `/mypage`.
- **i18n 부재** — 라벨 영어 하드코딩. (참고: 사이트 i18n은 `lib/i18n` `useTranslations()`.)
- **cart 카운트**: `lib/itinerary-builder/cart.ts` + `app/api/cart/route.ts` 존재. Phase 0에서 클라이언트에서 읽을 카운트 소스(스토어/컨텍스트/localStorage) 확인 필요.
- safe-area: `h-16` 고정, `env(safe-area-inset-bottom)` 미적용.

---

## §2. 진단 (다운그레이드 신호)

| # | 진단 |
|---|---|
| D1 | 하드코딩 영어 라벨 (6 locale 미적용) |
| D2 | blue-600 액센트 — 사이트 slate-900 톤 이탈 |
| D3 | cart 카운트 배지 없음 |
| D4 | `bg-white/95 backdrop-blur-md` — 새 Header `bg-white/88 backdrop-blur-xl`와 재질 불일치 |
| D5 | 모션 0 (active 전환·탭 피드백 없음) |
| D6 | 아이콘 active 상태 빈약 (outline만, fill/인디케이터 없음) |
| D7 | safe-area 미적용 (노치 폰 잘림) |
| D8 | a11y 부재 (`aria-current` 없음) |
| D9 | "My Page" 2단어 cramped |

---

## §3. 설계 방향 + 토큰

```
[ Home ]   [ Tours ]   [ Cart•3 ]   [ My ]
  ▔▔                                          ← active 상단 인디케이터 바 (slate-900)
  fill      outline     outline      outline   ← active만 fill 아이콘
```

| 토큰 | 값 | 용도 |
|---|---|---|
| nav 베이스 | `bg-white/85 backdrop-blur-xl border-t border-slate-200/60` | 컨테이너 (N2) |
| nav 그림자 | `shadow-[0_-8px_24px_-16px_rgba(15,23,42,0.18)]` | 상단 떠보임 |
| active 색 | `text-slate-900` | 아이콘+라벨 (N1) |
| inactive 색 | `text-slate-400` | 아이콘+라벨 |
| active 인디케이터 | 상단 `h-0.5 w-8 rounded-full bg-slate-900` (탭 상단 중앙) | N3 |
| active 라벨 | `font-semibold` | |
| inactive 라벨 | `font-medium` | |
| 라벨 크기 | `text-[10.5px] tracking-tight` | "My Page"→"My"로 단축(D9) |
| cart 배지 | `bg-amber-500 text-white text-[9px] font-bold` 원형, 아이콘 우상단 | N6 (카운트>0일 때만) |
| 높이 | `h-16` + `pb-[env(safe-area-inset-bottom)]` | N7 |
| tap 모션 | `active:scale-95` + framer spring(옵션) | N8 |

- 아이콘: active = solid(fill) 변형, inactive = outline. lucide 또는 인라인 SVG 페어(outline/solid) 사용.
- 라벨 단축: Home / Tours / Cart / **My** (i18n 키로 각 locale 최적 단어).

---

## §4. Phase별 실행 계획

### Phase 0 — 게이트
| # | 작업 | 통과 기준 |
|---|---|---|
| 0.1 | 현재 BottomNav 스냅샷 + 라우트/active 로직 기록 | §1 확정 |
| 0.2 | 디자인 토큰 확정 (§3) | — |
| 0.3 | i18n 6 locale 키 `nav.home / nav.tours / nav.cart / nav.my` 추가 (값 6×4=24) | 빌드 클린 |
| 0.4 | **cart 카운트 소스 확인** — 클라이언트에서 읽을 수 있는 카운트(스토어/컨텍스트/api) 존재 여부. 없으면 N6대로 배지 생략 결정 | 소스 확정 or 배지 보류 명시 |
| 0.5 | §A/§B/§C planner-first 커밋 | commit hash |

**Phase 0 ✅ 조건**: 0.1–0.5 + 사용자 "Phase 1 진입 승인".

### Phase 1 — 비주얼/구조 리스킨
| # | 작업 |
|---|---|
| 1.1 | 컨테이너 frosted white(N2) + 상단 hairline + 그림자 + `pb-[env(safe-area-inset-bottom)]`(N7) |
| 1.2 | active/inactive 색 blue→slate(N1) |
| 1.3 | 상단 인디케이터 바 + fill 아이콘(N3) — outline/solid 아이콘 페어 |
| 1.4 | 라벨 i18n(N5) + "My Page"→"My" 단축 |
| 1.5 | a11y `aria-current="page"` + role(N9) |
| 1.6 | 스페이서 높이 + FloatingLanguageToggle bottom offset 동기화 점검(N10) |

**Phase 1 ✅ 조건**: 사이트 톤 일치(slate+frosted), 6 locale 라벨, safe-area 적용, blue 잔재 0. 사용자 시각 승인.

### Phase 2 — Cart 배지 + 모션
| # | 작업 |
|---|---|
| 2.1 | cart 카운트 배지(N6) — 소스 있을 때만, 0이면 숨김 |
| 2.2 | spring tap(active:scale-95 / framer) + active 전환 모션(N8) |
| 2.3 | reduce-motion 가드(N8) |

**Phase 2 ✅ 조건**: 배지 정확(또는 보류 명시), 60fps, reduce-motion 비활성화 확인.

---

## §5. 안티 다운그레이드 가드

- ❌ blue-600 잔재 (N1) / ❌ 하드코딩 영어 (N5) / ❌ safe-area 누락 (N7)
- ❌ 가짜 cart 숫자 (N6) / ❌ 신규 라이브러리 (N11) / ❌ 데스크탑 노출 (N12)
- ✅ slate-900 + frosted white 가족 톤 / ✅ reduce-motion 가드 / ✅ aria-current
- ✅ FloatingLanguageToggle 겹침 점검 (N10)

---

## §6. i18n gate
- Phase 0.3: `nav.home/tours/cart/my` 6 locale 동시 (24 entry). 추가 카피(배지 a11y 등) 6 locale 동시.

---

## §7. 파일 맵
- 직접: `components/BottomNav.tsx`, `messages/{6}.json` (nav 키)
- 점검(수정 가능): `components/FloatingLanguageToggle.tsx` (bottom offset 동기화), `src/components/layout/SitePageShell.tsx` (스페이서 높이)
- 의존(읽기): cart 카운트 소스 (`lib/itinerary-builder/cart.ts` / `app/api/cart` — Phase 0.4 확인)
- Out of scope: `components/Header.tsx` (상단 nav — 톤 기준일 뿐 수정 X)

**문서 끝.**
