# 랜딩 페이지 UI/UX 마스터 플랜 v3

작성일: 2026-05-17
문서 상태: **표준 마스터 플랜 (v3가 유일한 실행 기준)**
대상: AtoC Korea 메인 랜딩 `/`

## 0. 이 문서의 위치

| 문서 | 역할 |
|---|---|
| `docs/landing-page-uiux-audit-2026-05-16.md` | 1차 Codex audit. 입력 자료. |
| `docs/landing-page-uiux-upgrade-plan-2026-05-17.md` | v2. 시니어 비평 기반 마스터 플랜. 사실 오류 2건 포함. **이 문서로 폐기.** |
| `docs/landing-page-uiux-upgrade-plan-review-2026-05-17.md` | Codex의 v2 리뷰. 사실 오류 2건 잡음. 입력 자료. |
| **이 문서 (v3)** | **표준. 모든 실행은 v3 기준.** |

v3 만든 이유:
1. v2에는 코드 실사 안 한 사실 오류 2건 (`StickyHomeCta`, `analytics.ts`) → Codex 리뷰가 잡음. 수정 반영.
2. Codex 리뷰가 못 본 시니어 UI/UX 통찰 11건 (가변성 시그널, 모바일 fold, expectation inflation, bottom-sheet 패턴, A/B variant 다양성, phrase 길이, stagger 구체 값, 롤백 임계값, reason chip 동적 데이터, 성공 기준 정직화, Phase 0 기간) → v3에서 반영.
3. v2가 결정 분포에서 약했던 부분("조건부 찬성" 다수)을 강한 accept/reject로 재정렬.

---

## §A. 상태 대시보드

| Phase | 상태 | 시작일 | 완료일 | 마지막 커밋 | 비고 |
|---|---|---|---|---|---|
| 0a — 계측 이벤트 정의 | ✅ 완료 | 2026-05-17 | 2026-05-17 | b6b73c07 | 7종 메서드 + 6개 호출부 와이어링 + `docs/analytics-events-home.md`. dev 콘솔 발화 7종 검증 통과 (Cloudflare Quick Tunnel) |
| 0b — provider 연결 + baseline | 🔄 baseline 대기 (시스템 ✅) | 2026-05-17 | — | — | 자체 분석 시스템 풀빌드 ✅ (`atockorea-analytics-master-plan` Phase 1~7). provider 연결 ✅. **baseline 미수집** — 2026-05-21 실측: 47 visitors / 100 sessions / 838 events / 3.3일(~14/day). A/B 변이당 10-15명(min 200)로 검정력 없음. 사실 수정 §C 2026-05-21 |
| 0c — 모바일 fold 실측 | ✅ 완료 | 2026-05-17 | 2026-05-17 | 3fdb9359 | CDP 실측: 390x844 CTA -81px / 430x932 CTA -32px (모두 fold 아래). §2.6 + §3 P0-A 보강 |
| B — 가장 안전한 전환 개선 | ✅ 완료 | 2026-05-17 | 2026-05-17 | a94d73b9 | B.1~B.6 모두 ✅. CDP QA: sticky top=hidden / mid=visible / deep=visible / footer=hidden. 사후 audit는 §2.6.1 (bottom nav overlay 발견 — Phase 0b 데이터로 재판단) |
| C — 상호작용 강화 | ✅ 완료 | 2026-05-17 | 2026-05-17 | 90345fd6 | C.1 ✅ 시즌 칩 인터랙티브. C.2는 이미 코드에 반영(사실 수정) — result card는 product.badges 동적 (vm:112-117), idle preview는 card.badges (B.2) |
| D — 실험 (in-place + bottom-sheet + Sticky threshold A/B) | ✅ 완료 | 2026-05-17 | 2026-05-17 | 248169d4 | D.1 (desktop in-place morphing) + D.2 (mobile bottom-sheet) + D.3 (sticky threshold) 모두 wired + 3 실험 DB 등록. matcher_funnel primary metric 공통 |
| E — 시각 정체성 확장 | ✅ 완료 | 2026-05-17 | 2026-05-17 | a162b7fc | E.1 ✅ scroll-reveal 5 섹션 + 공통 helper. E.2 OTA 로고는 §D 보류 (라이선스 의존) |

상태 마커:
- ⏳ 대기 (아직 시작 안 함)
- 🔄 진행 중
- ⏸ 보류 (의존성 미해소)
- ✅ 완료
- ❌ 중단/롤백

**현재 활성 Phase: 없음 (v3 본 실행 + Phase D 완료). 후속 트랙 통합 플래너 플랜(`docs/landing-matcher-builder-unified-plan-2026-05-20.md`) Phase 1–4 완료·커밋(25f160c0, 미푸시), 플래너 i18n 6개 로케일 완비(es/ja/zh/zh-TW 추가 2026-05-21). Phase 5(match→build 브릿지)는 선택·사용자 승인 대기.**
**실험 상태 (2026-05-21): 4종 모두 running이나 검정력 없음 (변이당 10-15명 / min 200). home_cta_copy / home_result_morphing / home_result_bottomsheet는 통합 플래너가 surface를 대체하므로 conclude 권장 — 단 production DB write는 사용자 승인 대기 (Phase 2 CTA 재구성 전 처리). home_sticky_threshold는 미충돌로 running 유지.**
**다음 액션 (사용자 결정 대기): (1) 3개 power-empty 실험 conclude (DB write 사용자 승인 필요), (2) ~~Seoul 'Request a Seoul day' 타깃 확정~~ → **해결 2026-05-22**: Seoul도 빌더로 라우팅 (itinerary builder Phase 9 D12에서 Seoul+DMZ 빌더 지원 추가). landing-planner-card의 seoul 'coming soon' 분기 제거, PLANNER_BUILD_PREVIEW에 seoul 추가. 커밋 `4ef6ac08`. (3) Phase 5 go/no-go. traffic 누적 전까지 정성 판단 (v3 §12).**

---

## §B. 결정 로그

각 행은 binding decision. 번복 시 새 행으로 추가 (삭제 금지, 이력 보존).

| 날짜 | 결정 | 이유 | 번복 |
|---|---|---|---|
| 2026-05-17 | v2 폐기, v3가 유일한 표준 실행 기준 | v2 사실 오류 2건 + 시니어 통찰 11건 누락 | — |
| 2026-05-17 | idle preview는 단일 카드 금지, 2-3장 cycling 또는 stacked carousel | 단일 카드는 매칭 가변성 시그널 못 전달 | — |
| 2026-05-17 | 매처 CTA 카피 "최적 매치 보기" → "맞춤 추천 받기" | expectation inflation 회피 | — |
| 2026-05-17 | StickyHomeCta는 신규 구현 아님 (이미 게이팅됨). Phase B는 QA only, threshold 변경은 Phase D.3 A/B | 코드 실측 `StickyHomeCta.tsx:31-57` | — |
| 2026-05-17 | Phase 0를 0a (정의) + 0b (baseline) + 0c (모바일 fold 실측) 분해 | analytics provider 미연결 (`analytics.ts:18-21`) | — |
| 2026-05-17 | A/B variant는 Phase 0b baseline 확보 후만 시작 | baseline 없이 카피 변경 시 회귀 발견 불가 | — |
| 2026-05-17 | 모바일 결과 = bottom-sheet (Phase D.2), 데스크톱 = in-place morphing (Phase D.1) 분리 | 모바일 레이아웃 흔들림 vs 데스크톱 single-surface 서사 | — |
| 2026-05-17 | amber eyebrow 유지, Process 다크 섹션 라이트화 금지 | 사용자 명시 피드백 (premium > 절제) | — |
| 2026-05-17 | 새 라이브러리 도입 금지 (carousel, bottom-sheet 모두 framer-motion 내) | 성능·번들 비용 | — |
| 2026-05-17 | 가짜 추천 예시 카드 금지, 실제 Featured 데이터 재사용 | 신뢰 자산 보호 + 콘텐츠 관리 비용 ↓ | — |
| 2026-05-17 | H1 즉시 교체 금지, A/B로만 측정 | 브랜드 보이스 손실 위험 | — |
| 2026-05-17 | reason chips는 상품 메타 동적 데이터 (`tour.tags` / `tour.highlights`), 정적 카피 금지 | 상품 회전 시 미스매치 방지 | — |
| 2026-05-17 | Trust 행 플랫폼명 (Klook · GetYourGuide · Viator) 무조건 유지, 라벨만 한글화 | 브랜드 신뢰 자산 | — |
| 2026-05-17 | Phase 3b `ItineraryBuilderEntry`는 Destinations 직후 위치 유지. B.1 swap 후에도 Destinations와 함께 페이지 후반부로 이동 | 코드 실사 (`HomeV2Page.tsx:24-35`). v3 작성 시점에 §2.5에 미반영된 사실 — 사실 수정. ItineraryBuilderEntry는 "지역 분기 후 맞춤 빌더로 유도"라는 인접 관계 | — |
| 2026-05-17 | B.3 매처 헤더 슬림은 단독 진행 금지. **Trust strip 컴팩트화와 묶음 처리** (B.3.1 헤더 슬림 + B.3.2 Trust 컴팩트) | Phase 0c 실측: iPhone 14 fold 회수 81px 필요, 헤더 슬림 단독은 ~60px만 회수 | — |
| 2026-05-17 | **Phase 0b 외부 SaaS provider 모두 보류, 자체 분석 시스템 빌드로 진행** (`docs/atockorea-analytics-master-plan-2026-05-17.md`). DOM 세션 리플레이는 §D PostHog 옵션으로 분리 | PII 통제 + 매처 도메인 join + 비용 0 + 데이터 소유 + 기존 Supabase 인프라 재사용. 6.5일 풀빌드 | — |
| 2026-05-21 | **ItineraryBuilderEntry "Destinations 직후 위치 유지" 결정(2026-05-17) 번복 → 홈에서 제거.** 통합 플래너(`docs/landing-matcher-builder-unified-plan-2026-05-20.md`) Phase 3로 홈에서 제거(파일은 레포 임시 존치) | 매처+빌더를 단일 segmented planning surface로 통합 → 경쟁하는 두 플래닝 CTA 제거. 사용자 결정 2026-05-21. 통합 플랜 Gate 0.3 충족 | ← 2026-05-17 "인접 위치 유지" row 대체 |
| 2026-05-21 | **B.3 매처 헤더 제거(2472b0ae) 부분 번복 → 데스크톱 한정 headline+subhead 재도입, 모바일은 eyebrow-only 유지** (반응형 헤더) | 모바일 fold 보호(현 CTA effective -78px, §2.6.1) + 데스크톱은 수직 여유로 프리미엄 프레이밍 허용. 사용자 결정 2026-05-21. 통합 플랜 Gate 0.1/0.2 충족 | ← B.3 eyebrow-only(2472b0ae) 부분 대체 (모바일만 유지) |
| 2026-05-23 | **히어로 Trust strip(4.9★/100K+/8) → "큐레이션 증명" 블록 교체.** 헤드라인 "Curated by humans. Proven by travelers." + 3-stat(30 엄선 / 100K+ OTA / 4.9★ 평점) + 정성 증명 한 줄, 6 로케일 번역 | 사용자 요청 2026-05-23(스크린샷 추천안). 가드: 30·100K+만 검증·노출, "1,000+ 검토"는 정성 문구로 대체(허위주장 0). **사실 수정**: 2026-05-17 "Trust 행 플랫폼명(Klook·GYG·Viator) 유지" 결정은 이미 무효 — 통합 플래너 리팩터 때 플랫폼명이 hero에서 빠져 PlatformCompareBlock으로 이동(현 hero trust row 부재). 8플랫폼 통계만 제거(4.9★ 평점은 최강 전환 신호라 유지) + 큐레이션 서사로 재구성 — 3-stat 최종 (사용자 판단 위임 → 베테랑 디자이너 권고) | ← 2026-05-17 "Trust 행 플랫폼명 유지" + B.3.2 trust strip 부분 대체 |
| 2026-05-24 | **히어로 시즌 칩(Phase C.1 인터랙티브 chip) 제거 + H1·서브카피 ~15% 축소 + 하단 패딩 축소로 텍스트 패널을 사진 하단 가장자리로 밀어붙임.** 사진 가시성 최대화 (텍스트가 차지하던 상단 ~80px 회수). `home_hero_season_chip_click` analytics 이벤트는 analytics.ts에 그대로 두되 dead-end(호출부 없음) | 사용자 요청 2026-05-24(스크린샷). 직전 2026-05-23 큐레이션 증명 블록 교체로 hero 아래에 강한 trust signal이 이미 살아있어 시즌 chip의 "now relevant" 시그널은 정보 중복. 사진 자체가 시즌 큐(예: 여름 = 해변/페스티벌 분위기)를 이미 전달. **시즌 phrase 인젝트 기능 손실은 수용** — 통합 플래너 카드의 style chips가 등가 입력 마찰 감소 역할 | ← 2026-05-17 Phase C.1 시즌 칩 인터랙티브화 부분 번복 (chip 제거; chip-aria/phrase i18n 키와 SeasonConfig는 잔존, analytics 메서드도 잔존) |
| 2026-05-24 (2) | **히어로 슬라이드 5장 전면 교체 + Vogue/B2 화보 필터 도입.** HERO_SLIDES = [경복궁 광화문 일몰 / 해운대 블루라인 트램 / 벚꽃·유채 도로 / 해동용궁사 일출 / 섭지코지 말]. 모든 슬라이드에 `filter: saturate(1.08) contrast(1.06) brightness(0.99)` (Kodak Portra warmth) + SVG fractalNoise film grain(opacity 0.12, mix-blend-overlay) + 코너 비네트(transparent 60%→rgba(0,0,0,0.15)) 레이어 적용 | 사용자 요청 2026-05-24. 직전 (1) 결정에서 사진 가시성을 최대화했으니 다음 단계는 사진 자체의 화보 톤. TourListCard/CatalogueHero에서 검증된 'B2 family' 화보 톤을 hero에 이식하여 hero ↔ 카드 그리드 image identity 통일. 새 라이브러리 0개(§B 결정 준수). 5장 WebP 1600w q90 총 ~2MB(원본 PNG 13MB → 84% 감소), 첫 슬라이드 LCP 327KB | — |
| 2026-05-24 (3) | **헤드라인 뒤 검정 radial scrim 패널 dramatically lighten (~60% opacity 감소) + 텍스트 그림자 강화로 사진 노출 우선.** 패널 stops 0.88/0.72/0.45/0.18 → 0.35/0.25/0.12/0.04. H1 textShadow blur 12→16 alpha 0.5→0.6, 서브카피 blur 8→12 alpha 0.55→0.65, 서브카피 컬러 white/85→white/90. 패널 자체는 유지(완전 제거 시 일부 슬라이드 — 특히 벚꽃·하늘 부분 — 에서 흰색 텍스트 contrast 위험) | 사용자 요청 2026-05-24 "검정 오버레이 패널 없애든가 좀 연하게". 직전 (1) headline 축소 + (2) 화보 사진 도입의 직접 연장 — 패널이 화보 톤을 가리는 마지막 잔재. 텍스트 그림자만으로 가독성 보호 (multi-layer drop-shadow 보강) | ← 2026-05-24 (1) 패널 라디언트 좁히기 부분 보강 (제거가 아닌 dramatic 감쇠) |
| 2026-05-25 | **Destinations 카드 3장 전면 교체 + Vogue/Bazaar 매거진 커버 타이포 + 공격적 화보 필터.** (a) DESTINATIONS imageSrc 3장 신규 webp (Seoul 경복궁 처마 아치 / Busan 감천 어린왕자 일몰 / Jeju 섭지코지 그네 — 사용자 지정 순서). 6 로케일 alt 텍스트 일괄 갱신. (b) 지역명 h3 + 상단 badge 폰트를 `font-magazine-serif-ko`(Noto Serif KR → Cormorant Garamond → Georgia, weight 300 upright serif — italic 금지 §B 2026-05-20 준수). 지역명 1.75→`text-[1.75rem]/light/tracking-[0.02em]`, badge `tracking-[0.32em]/light/opacity-70`. (c) Image filter `saturate(1.18) contrast(1.18) brightness(0.92)` — hero의 (1.08/1.06/0.99) 대비 한 단계 공격적, 살짝 어둡되 진한 화보 톤. (d) film grain opacity 0.16 (hero 0.12보다 강함, 카드는 가까이 봐서 입자감 살림). (e) 코너 비네트 transparent 50%→rgba(0,0,0,0.28) (hero 0.15 대비 진함). 기존 bottom-up dark gradient + 호버 scale-1.04 유지 | 사용자 요청 2026-05-25 "지역명 Vogue/하이엔드 폰트 + 상단 카피 폰트도 + 사진 3장 교체 + Vogue 필터 공격적 살짝 어둡되 무조건 프리미엄". 직전 hero (2)/(3) 화보화 트랙의 destinations로 확장. (1)/(2)/(3)에서 입증된 B2 family 톤을 한 단계 강화하여 destinations 카드 단계에서 화보 정점 달성. 추가 라이브러리 0, 새 폰트 0(이미 layout.tsx에서 Noto Serif KR + Cormorant 로드됨) | — |
| 2026-05-25 (2) | **Destinations 카드 모바일 좌우 spacing 보강 + 필터 살짝 밝게(but not too bright).** (a) 모바일 snap-scroll 좌우 패딩 16→24px (`px-4`→`px-6`), gap 14→18px (`gap-3.5`→`gap-[18px]`), 카드 폭 60vw→55vw — 첫 카드가 viewport 가장자리에 붙어 짤려 보이던 문제 해소 + 다음 카드 peek (~62%, 이전 ~53%) 명확화. (b) Image filter `saturate(1.18) contrast(1.18) brightness(0.92)` → `saturate(1.14) contrast(1.10) brightness(0.98)` — brightness +0.06으로 어두움 해소하되 너무 중성으로 가지 않게, contrast 1.18→1.10으로 dramatic 톤 완화. (c) film grain opacity 0.16→0.13 (brightness ↑에 맞춰 grain도 같이 ↓), 비네트 stops `transparent 50%/0.28` → `55%/0.20` (전체 다크 가중치 감소) | 사용자 요청 2026-05-25 "카드들이 좌우 양쪽 너무 붙어있어서 짤려보여 + 필터 조금만 밝고 고급지게, 그렇다고 너무 밝게는 말고". 직전 (1)의 공격적 필터가 모바일 화면에서 답답하게 읽혀 균형점으로 보정. 데스크톱 grid는 영향 없음(`md:gap-5/md:px-0`로 분기) | ← 2026-05-25 (1) filter/grain/vignette 값 부분 조정 (필터 컨셉 유지, 강도만 한 단계 down) |

---

## §C. 변경 로그

Phase 진행 시 한 줄씩 추가. 커밋 단위.

| 날짜 | 항목 | 커밋 | 비고 |
|---|---|---|---|
| 2026-05-17 | v3 마스터 플랜 작성 | (pending) | `docs/landing-page-uiux-master-plan-v3-2026-05-17.md` |
| 2026-05-17 | v3에 §A-§D 트래킹 섹션 추가 + 스킬 등록 | (pending) | `.claude/skills/landing-page-uiux/SKILL.md` |
| 2026-05-17 | Phase 0a 시작 — 이벤트 7종 정의 + 호출부 와이어링 | 5e8348ca | sticky/featured/destination/match-visible/intent-focus/style-chip; 시즌 칩은 메서드만 정의 (Phase C 와이어링) |
| 2026-05-17 | Phase 0a 코드 랜딩 — analytics.ts 7 메서드 + 6 호출부 + taxonomy doc | b6b73c07 | dev 콘솔 발화 검증 후 ✅. provider 미연결 (Phase 0b) |
| 2026-05-17 | Phase 0a console 검증 통과 (Cloudflare Quick Tunnel) → ✅ | — | 사용자 확인. Phase 0c 진입 |
| 2026-05-17 | Phase 0c 시작 — 모바일 fold 실측 | (pending) | 390x844 / 430x932 매처 CTA fold 위치 측정 |
| 2026-05-17 | Phase 0c 완료 — CDP 실측: iPhone 14 CTA -81px / Pro Max -32px (둘 다 fold 아래). §2.6 + §3 P0-A 보강 | 3fdb9359 | B.3 단독으로 부족 → B.3 + Trust strip 압축 합산 회수 전략 명시 |
| 2026-05-17 | 사실 수정 — §2.5 섹션 순서에 ItineraryBuilderEntry 반영 (Phase 3b 이후 누락). §B 결정 row 2건 추가 (ItineraryBuilderEntry 위치 + B.3+Trust 묶음) | (pending) | 코드 실사 우선 (skill rule 10) |
| 2026-05-17 | Phase B 시작 — B.1 섹션 순서 swap | 5f082374 | `HomeV2Page.tsx:24-35` Featured ↔ Destinations swap, ItineraryBuilderEntry는 Destinations 인접 유지 |
| 2026-05-17 | B.1 ✅ — Featured slot 6 → 3 (Match preview 직후). Destinations/Builder/Style 한 칸씩 후퇴 | d41628bf | 빌드 클린. promise→proof 거리 5→1 섹션으로 축소 |
| 2026-05-17 | B.2 ✅ — IdleMatchPreviewCarousel 신규 (3장 cycling). DeferredBestMatchPreview idle 분기 연결. i18n 6 locale | 741b3cd3 | STATIC_TOUR_PRODUCTS 사용. analytics home_match_preview_visible(idle) + home_featured_card_click(idle_preview) 활성화 |
| 2026-05-17 | B.3 ✅ — 매처 헤더 3단 → eyebrow 1단 + Trust strip 패딩 컴팩트. matcherHeadline/Subline i18n 6 locale 삭제 | 2472b0ae | CDP 재측정: iPhone 14 +2px / Pro Max +51px **ABOVE fold**. 83px 회수. §3 P0-A 가시성 문제 해결 |
| 2026-05-17 | B.1+B.2+B.3 사후 audit — 모바일 fixed bottom nav가 viewport 하단 80px 오버레이. CDP fold(+2px)는 통과지만 user-visible effective fold(764px)로는 여전히 CTA -78px. §2.6.1 추가 | 3e73b8f7 | 권장: 수용 + B.4/B.5 진행 (Phase 0b 데이터로 재판단). 대안: B.3.3 hero `min-h` 축소 |
| 2026-05-17 | B.4 ✅ — Trust 라벨 i18n 추출 + ko 한글화 + 5 locale 번역. 플랫폼명(Klook/GetYourGuide/Viator) 그대로 유지 | a94d73b9 | i18n key: home.premium.hero.trust{AvgRating,Bookings,Platforms} |
| 2026-05-17 | B.5 ✅ — findMatchCta 6 locale 카피 교체. ko "최적 매치 보기" → "맞춤 추천 받기" (expectation inflation 가드) | a94d73b9 | §B 결정 준수. A/B는 Phase 0b 후 측정 |
| 2026-05-17 | B.6 ✅ — StickyHomeCta CDP QA. top/mid/deep/footer 4 sample 모두 기대대로 동작. 코드 변경 없음 | — | gating logic intact (`StickyHomeCta.tsx:31-57`). threshold A/B는 Phase D.3로 분리 |
| 2026-05-17 | **Phase B 완료** — 6 sub-task 모두 ✅ | a94d73b9 | 커밋: d41628bf / 741b3cd3 / 2472b0ae / a94d73b9. 다음: Phase C 또는 Phase 0b 의사결정 |
| 2026-05-17 | Phase C 시작 — 시즌 칩 인터랙티브 + reason chips 동적 | bcdf4027 | C.1 + C.2 분리 커밋 |
| 2026-05-17 | C.1 ✅ — 시즌 칩 button + phrase 주입 + 200ms glow + analytics + 6 locale phrase/chipAria 키 | 90345fd6 | SeasonConfig.phraseKey 신규. analytics HomeHeroSeason 5 값으로 정렬 |
| 2026-05-17 | 사실 수정 — C.2 reason chips는 이미 dynamic 구현. result card는 `buildV2BestMatchResultViewModelFromApi:112-117`에서 `product.badges`, idle preview는 B.2에서 `card.badges`. 정적 fallback(joinChip1-3)은 no_match 시 브랜드 카피로 의도된 fallback이라 §B "정적 카피 금지" 위반 아님 | (pending) | 코드 변경 없음. §A C.2 ✅ 마감 |
| 2026-05-17 | **Phase C 완료** — C.1 코드 랜딩 + C.2 사실 수정으로 마감 | — | 다음: Phase D는 0b baseline 의존 → Phase E 또는 일단 멈춤 결정 |
| 2026-05-17 | Phase E 시작 — E.1 scroll-reveal 5 섹션. E.2 OTA 로고는 §D 보류 (라이선스 확인 필요) | f91308a6 | §8 motion spec 그대로 적용 |
| 2026-05-17 | E.1 ✅ — `reveal.ts` 공통 helper + 5 섹션(Destinations/Featured/Style/Why/Process) viewport-trigger 변환. legacy `scroll-animate` mount-trigger 패턴 제거 | a162b7fc | reduce-motion 가드, LCP-safe (fold 아래), 신규 lib 없음 |
| 2026-05-17 | **Phase E 완료** — E.1 코드 랜딩 + E.2 §D 보류. v3 본 실행 범위 종료 | a162b7fc | 다음: Phase 0b provider 의사결정 → Phase D 진입 |
| 2026-05-17 | Phase 0b 자체 분석 시스템 빌드로 결정 + 마스터플랜 작성 | (pending) | `docs/atockorea-analytics-master-plan-2026-05-17.md`. 외부 SaaS 모두 §D 옵션으로 강등 |
| 2026-05-17 | §D #1 — 매처 결과 카드 아래 "비슷한 투어" 3-카드 추천 strip 랜딩 | d6afd195 | `lib/home/similar-tours.ts` (region/badge score) + `components/home/v2/SimilarToursStrip.tsx` + `best-match-preview.tsx` 분기 + 6 locale `home.premium.v2.similarTours.heading`. analytics `home_featured_card_click` source `similar_recommendation` 신규 추가 |
| 2026-05-17 | §D #1 매칭 로직 핫픽스 — 광역지역 정규화 + multi-region + 폴백 제거 | 47534209 | **사용자 보고 버그**: 제주 winner인데 부산/크루즈 추천. 원인 (a) `broadRegion()`이 영문 키워드만 검사 → 한글 region 전부 미매칭 → score=0 fallback이 catalog 순서로 부산 시리즈 노출. (b) badge 1개 공유로 광역 다른 매물 추천 진입. 수정: 한국어+영문 키워드 룰 5종(jeju/gangwon/busan/gyeongju/seoul) + multi-region Set + 광역 교집합 없으면 score=0 게이트 + catalog 순서 폴백 제거 (strip은 1~3개 동적 grid). 검증: 30개 자연어 케이스 (jeju/busan/seoul 각 10개) production /api/tour-product/match 호출 → 30/30 광역 일치 ✅ |
| 2026-05-17 | 헤더 언어 토글 핫픽스 — i18n provider race 제거 (초기 ~5클릭 무시 버그) | (pending) | **사용자 보고 버그**: 랜딩 헤더 언어 버튼 첫 ~5번 클릭이 무시됨, 그 다음부터는 1클릭 OK. 원인 (a) `I18nProvider.loadLocale()` 비동기 체인(localStorage → dynamic supabase import → auth.getSession → user_profiles select → navigator.language fallback)이 첫 1-2초 안에 사용자의 `setLocale()` 호출을 silently revert. (b) `setLocale`이 useCallback 미적용이라 매 render마다 새 참조 → `LocaleHomeClient.useEffect([locale,setLocale])`가 URL-derived locale로 사용자 선택을 강제로 덮어씀. 수정 (`lib/i18n.ts`): (1) `userOverrideRef` 추가, 각 async 체크포인트 후 사용자 override 있으면 abort. (2) `setLocale`을 useCallback으로 stable ref. 검증 CDP: ko→ja→zh→ko→en 4회 연속 1클릭 전환 모두 즉시 반영 (URL/lang/localStorage/H1 일치). 영향 범위: 글로벌 헤더 — 랜딩 외 모든 페이지에서도 fix |
| 2026-05-17 | §D 모바일 floating 언어 pill 랜딩 (옵션 A) | (pending) | 사용자 옵션 A 선택. `components/FloatingLanguageToggle.tsx` 신규 (md:hidden, bottom-[calc(env(safe-area-inset-bottom,0px)+80px)] right-4 z-40). Globe 아이콘 + 2글자 코드 pill, 상향 dropdown(`bottom-full right-0`), 기존 i18n 핸들러 재사용(LanguageSwitcher와 동일 navigateWithLocale 로직). Sticky competition 가드: `[data-home-hero]`+`[data-home-final-cta]` IntersectionObserver(StickyHomeCta와 동일 sentinel)로 heroOut&&!footerIn 시 `opacity-0 pointer-events-none`. 마운트: `SitePageShell.tsx` (showBottomNav=true일 때만) + `app/[locale]/page.tsx`. tour-product layout은 showBottomNav=false라 자동 제외 — sticky 예약 바와 충돌 없음. SSR 검증: iPhone UA 페이지 HTML에 `aria-label="Change language"` + `aria-haspopup="menu"` + `fixed right-4 z-40 md:hidden bottom-[calc(env(safe-area-inset-bottom,0px)+80px)] ... opacity-100` 정확히 출력 확인. 인터랙션 검증: Chrome MCP 세션 만료로 사용자 수기 테스트로 지연 — 동일 핸들러 사용(헤더 5-클릭 fix 검증분과 공유)이라 회귀 위험 낮음 |
| 2026-05-21 | 통합 플래너 플랜 실행 진입 — Phase 0 Gate 정합 | (pending) | `docs/landing-matcher-builder-unified-plan-2026-05-20.md`. Gate 0.5(빌더재설계 완료·main) 해소, 0.6(정직성) 적용. §B 번복 2건 추가(ItineraryBuilderEntry 제거 / 매처 헤더 데스크톱 한정 재도입) |
| 2026-05-21 | 사실 수정 — §A Phase 0b "baseline 미수집" | (pending) | 실측: 47 visitors / 100 sessions / 838 events / 3.3일(~14/day). A/B 4종 변이당 10-15명(min 200)→검정력 없음. §A 0b row + 활성 Phase note 갱신 |
| 2026-05-21 | Gate 0.4 — 실험 conclude 보류 (승인 대기) | — | home_cta_copy/morphing/bottomsheet conclude 권장하나 production DB write 자동 거부됨(명시 승인 필요). Phase 1(추출)은 실험 wiring 보존이라 미차단; Phase 2 CTA 재구성 전 처리 |
| 2026-05-21 | lint 위생 — `react-hooks/set-state-in-effect` 4건 제거 + IdleMatchPreviewCarousel hydration mismatch 수정 (behavior-neutral) | (pending) | 통합 플래너 Phase 1 중 발견된 pre-existing 부채(스킬 rule 1c, in-flight bug-fix). (a) matchMedia setState-in-effect 2건(MatcherBottomSheet/MatcherMorphingPanel) → `useSyncExternalStore` 훅 신규(`components/home/v2/use-media-query.ts`, getServerSnapshot=false로 기존 `useState(false)` 초기값 보존), 브레이크포인트(max-767/min-768) 불변. (b) 실험 변이 폴링 setState 2건 → `getExperimentVariantAsync().then(setVariant)` (landing-planner-card `home_cta_copy` 패턴), 실험 키/할당 로직 불변. (c) IdleMatchPreviewCarousel: `reduceMotion` 의존 inline `transition` → CSS class + `@media (prefers-reduced-motion: reduce)`로 이전(hydration mismatch 원인 제거, `reduceMotion`은 auto-cycle 게이트로 유지). `hooks/useMediaQuery.ts`는 site-diet 삭제 후보라 미사용. 검증: `npm run lint` exit 0 + `tsc --noEmit` 터치 파일 클린 + 프리뷰 reload 콘솔 error 0 (직전 hydration-mismatch 6건 → 0, prefersReducedMotion=true 환경) |
| 2026-05-21 | hydration mismatch 수정 — `useReducedMotion()` SSR 비결정성 3건 (behavior-neutral, in-flight bug-fix) | (pending) | **사용자 보고 버그** (prefers-reduced-motion 환경에서 home v2 hydration mismatch 6+건). 원인: `useReducedMotion()`이 서버=null·reduce 클라이언트=true → 렌더 분기가 SSR/CSR 불일치. 규칙: SSR 직렬화되는 값(initial/animate geometry/attribute)은 결정적이어야 하고, `transition`(타이밍, style 미직렬화)만 reduceMotion 분기 가능. 수정: (a) `components/home/v2/ui/reveal.ts` — `initial` 항상 "hidden", reveal 타이밍을 컨테이너 `visible` transition으로 이전(children 전파), `REVEAL_ITEM_VARIANTS`는 geometry-only → 5 섹션(Destinations/Featured/Style/Why/Process) 캐스케이드 해소. (b) `landing-planner-card.tsx:295` — `bodyMotion.animate` 결정화(`{opacity:1,y:0}`), initial/exit/transition만 reduce 분기(AnimatePresence `initial={false}`라 첫 마운트 SSR style과 무관). (c) **글로벌** `components/BottomNav.tsx:72` — whileTap reduce-gate로 framer가 서버에만 `tabindex=0` 부여 → aria-hidden 장식 span에 명시적 `tabIndex={-1}`(결정적 + 비포커스 정합). 검증: CDP `/ko`, prefers-reduced-motion=true, Next badge `data-error=false`(직전 6+ → 0), 스크롤 후 reveal opacity 정상(stuck 0), `npm run lint` 3파일 exit 0. N8/§8 모션 의도 보존. (`BottomNav`는 자체 플랜 `docs/bottom-nav-uiux-master-plan-2026-05-20.md` 소관 — 여기선 디자인 변경 없이 hydration만 수정) |
| 2026-05-21 | 통합 플래너 i18n 완성 — `home.premium.v2.planner` es/ja/zh/zh-TW 추가 (en/ko는 Phase 2 작성분) | (pending) | 11키 6 로케일 완비. house 용어 정합(`getQuoteCta`→presupuesto/お見積もり/报价/報價; `findMatchCta`→recomendación/おすすめ/推荐/推薦; stops→paradas/スポット/景点/景點). match CTA는 `home.premium.hero.findMatchCta` 재사용(Gate 0.6, 중복 무생성), `customizeThisDay`는 Phase 5로 지연. 검증: 6개 JSON parse + 정확한 11키 parity(누락/잉여 0) |
| 2026-05-22 | Seoul build 라우팅 수정 + IntakeForm 프리미엄 톤 (사용자 보고, in-flight bug-fix 1c) | `4ef6ac08` | **사용자 보고**: (1) 홈 플래너 build 모드에서 Seoul 선택 시 빌더로 안 가고 match로 되돌아감(stale 'jeju+busan only' 게이트), (2) `/itinerary-builder` IntakeForm 카드가 레거시 톤. 수정: (a) `landing-planner-card.tsx` seoul 'coming soon' 분기 제거 → 3개 지역 모두 `/itinerary-builder?region=` 라우팅(빌더 Phase 9 D12로 Seoul+DMZ 지원), `seoulBuild*` i18n키·`unifiedPlannerSeoulRequest` 호출 dead. (b) `planner-builder-preview.ts` seoul 엔트리(seoul-hero.jpg + Gyeongbokgung/Bukchon/Namsan). (c) **사실 수정**: 컴포넌트 주석 'builder map supports jeju+busan only' → 3개 지역. (d) IntakeForm + page 카드 = 랜딩 플래너카드 톤 계승(navy-selected 옵션 / slate-50 surface / rounded-button·shadow-1 토큰 / focus-ring / 컴팩트 spacing, 레거시 amber 글로우 제거). 검증: `npm run build` green + `tsc` 클린. 별건 보고: `/itinerary-builder/[region]` 지도 로드 실패는 코드 무변경(POICatalogMap·loader·[region] page가 main↔feat-unified 동일) → API 키 referrer/quota/billing 등 환경 이슈, 기존 gmaps 호환 트랙(`project_builder_map_gmaps_compat_crash`) |
| 2026-05-23 | 히어로 Trust strip → 큐레이션 증명 블록 (신규 스코프, 사용자 요청·AskUserQuestion 승인) | (pending) | `hero-section.tsx` Value Bridge(4.9★/100K+/8 grid) → 헤드라인 h2 + 3-stat(divide-x: 30/100K+/4.9★) + 증명문(`md:block`). i18n: `premium.hero.trust{AvgRating,Bookings,Platforms}` 3키 제거 → `curation{Headline,ShortlistValue,ShortlistLabel,BookingsValue,BookingsLabel,RatingValue,RatingLabel,Proof}` 8키 ×6 로케일 (4.9★ 평점 유지=전환 신호, es 평점값 4,9). 숫자 정직화: 30(=현 ~29 투어)·100K+만 검증 노출, "1,000+ 검토"는 정성 증명문 대체. 100K+ → ko 10만+/ja·zh 10万+/zh-TW 10萬+ 현지화. fold 가드: 모바일 증명문 hidden. 검증: 6 JSON parse OK + 구 trust키 dangling ref 0 + `npm run lint`(home/v2 scope) exit 0. 브라우저 스크린샷 보류 — Next16 single-dev-lock(동시 세션 :3000 점유로 2nd next dev 불가) |
| 2026-05-24 | 시즌 칩 제거 + H1/서브카피 축소 + 패널 하단 밀착 (사진 가시성 최대화, §B 2026-05-24 번복 row) | (pending) | `hero-section.tsx`: (a) `getCurrentSeason`/`SeasonConfig` derivations 제거(season/SeasonIcon/seasonLabel/seasonPhrase). (b) `intentGlowing` state + glow timer ref + cleanup useEffect 제거. (c) `handleSeasonChipClick` callback 제거. (d) 시즌 chip `<button>` JSX 제거(약 16 LOC). (e) H1 사이즈 1.35→1.1rem / md 1.75→1.4rem / lg 2.15→1.7rem (~17% 축소). 서브카피 `text-caption`→`text-[0.78rem] leading-snug` 모바일, md는 `text-caption`. (f) inner 텍스트 패널 padding `px-5 py-3 md:px-7 md:py-4` → `px-4 py-1.5 md:px-6 md:py-2`. (g) radial-gradient 음각 `-inset-x-10 -inset-y-6 md:-inset-x-16 md:-inset-y-8` → `-inset-x-8 -inset-y-4 md:-inset-x-14 md:-inset-y-6` (텍스트 작아진 만큼 그라데이션도 좁혀 잔여 어두움 최소화). (h) 패널 하단 패딩 `pb-3 md:pb-5` → `pb-1.5 md:pb-2.5`. (i) 헤드라인 wrapper `mb-1 pb-0.5 md:mb-2` → `mb-0 md:mb-0.5` + `pb-0.5` 제거. `landing-planner-card.tsx`: `intentGlowing` prop 인터페이스/디스트럭처/유저랜드 모두 제거, intent textarea border는 `border-slate-200/70` 고정(amber glow 분기 삭제), transition 토큰에서 `box-shadow` 빼서 호버 클린업. SeasonConfig/season i18n 키/`homeHeroSeasonChipClick` analytics 메서드는 잔존(다른 surface 재사용 가능성·dead 메서드는 비용 없음). `npm run lint` (home/v2 + lib/home + reviews) exit 0. 검증: 첫 paint 텍스트 위치가 사진 하단에 밀착, 상단 ~80px hero 영역 추가 노출 |
| 2026-05-24 (2) | 히어로 슬라이드 5장 전면 교체 + Vogue 화보 필터 도입 (사용자 요청, §B 2026-05-24 (2) row) | `fbe24a3e` | (a) `scripts/convert-hero-photos.mjs` 신규 — sharp 1600w q90 WebP 변환 (한 번 쓰는 one-off). (b) `D:/Atoc Photos/modified/hero-2026-05-24/*.png` 5장 → `public/images/home/hero/{01..05}-*.webp` (총 ~2MB, 원본 13MB 84% 감소, 첫 슬라이드 327KB). (c) `hero-section.tsx` HERO_SLIDES 배열 5장 전면 교체 (경복궁/해운대 블루라인 트램/벚꽃·유채 도로/해동용궁사 일출/섭지코지 말 — 사용자 지정 순서), alt 텍스트도 신규 사진에 맞게 영문 설명형. (d) 모든 Image에 `style.filter = "saturate(1.08) contrast(1.06) brightness(0.99)"` (TourListCard·CatalogueHero의 B2 family 화보 톤, Kodak Portra warmth). (e) 사진 컨테이너 위에 z-[1] SVG fractalNoise film grain layer (baseFreq 0.9, octaves 2, opacity 0.12, mix-blend-overlay — 컴포넌트별 SVG 재정의가 아닌 inline data-URL이라 추가 fetch 0). (f) 같은 z-[1]에 코너 비네트 layer (`radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.15) 100%)`). 모두 darkenOpacity layer(z-[2]) 아래라 스크롤 시 cinematic darken에 자연스럽게 흡수됨. 검증: `npm run build` 통과 (에러/경고 0), `preview_eval`로 첫 슬라이드 computed filter "saturate(1.08) contrast(1.06) brightness(0.99)" + src 200 OK 확인. PR #70 머지 → main `fbe24a3e` |
| 2026-05-24 (3) | 헤드라인 뒤 검정 radial scrim 패널 dramatically lighten + 텍스트 그림자 강화 (사용자 요청, §B 2026-05-24 (3) row) | `0999b62b` | `hero-section.tsx`: (a) scrim radial-gradient stops `0.88/0.72/0.45/0.18` → `0.35/0.25/0.12/0.04` (~60% opacity 감소, 거의 투명에 가까움 — 사진이 텍스트 패널을 통과해 읽힘). (b) H1 textShadow `0 2px 12px rgba(0,0,0,0.5) + 0 1px 3px rgba(0,0,0,0.45)` → `0 2px 16px rgba(0,0,0,0.6) + 0 1px 4px rgba(0,0,0,0.55)` (blur ↑ alpha ↑). (c) 서브카피 textShadow `0 1px 8px rgba(0,0,0,0.55) + 0 1px 2px rgba(0,0,0,0.45)` → `0 1px 12px rgba(0,0,0,0.65) + 0 1px 3px rgba(0,0,0,0.55)`, 텍스트 컬러 `text-white/85` → `text-white/90`. 패널 자체는 제거하지 않음 — 5장 슬라이드 중 벚꽃·하늘 등 밝은 영역에서 흰색 텍스트 contrast 안전판으로 옅게 유지. PR #71 merge → main `0999b62b` |
| 2026-05-25 | Destinations 카드 3장 전면 교체 + Vogue 매거진 타이포 + 공격적 화보 필터 (사용자 요청, §B 2026-05-25 row) | `6173d544` | (a) `scripts/extract-session-images.mjs` 신규 — Claude Code 세션 jsonl에서 base64 첨부 이미지 추출(사용자가 디스크에 따로 저장하지 않아도 됨). 9장 추출(이전 hero 5장 + 신규 destinations 4장 = 사진 3 + 컨텍스트 스크린샷 1). (b) `scripts/convert-destinations-photos.mjs` 신규 — sharp 1200w q90 WebP 변환 + 슬러그 매핑(01-seoul → seoul-card, 02-busan → busan-card, 03-jeju → jeju-card). 결과: seoul 205KB / busan 324KB / jeju 129KB 총 658KB. (c) `destinations-showcase.tsx` DESTINATIONS imageSrc 3개 .jpg → .webp. (d) `messages/{en,ko,ja,zh,zh-TW,es}.json` `home.premium.v2.destinations.{seoul,busan,jeju}.alt` 6 로케일 신규 사진에 맞게 일괄 갱신(node 스크립트). (e) `destination-card.tsx` 대규모 — Image filter `saturate(1.18) contrast(1.18) brightness(0.92)` 추가, SVG fractalNoise film grain layer (opacity 0.16, mix-blend-overlay), 코너 vignette (transparent 50%→rgba(0,0,0,0.28)). 지역명 h3: `text-[1.5rem]/font-semibold/Inter` → `text-[1.75rem]/font-light/font-magazine-serif-ko/tracking-[0.02em]`(Noto Serif KR → Cormorant Garamond). Badge: `text-micro/font-semibold/Inter` → `text-[0.62rem]/font-light/font-magazine-serif-ko/tracking-[0.32em]/opacity-70`. textShadow 강화(`0 3px 24px → 0 3px 28px + 0 1px 4px alpha 0.6`). 검증: `preview_eval` 3장 모두 신규 src/filter/font 적용 확인 + `npm run build` exit 0 + 6 JSON parse OK |
| 2026-05-29 | 플래너 카드 Date 픽커 달력 crush 수정 (사용자 보고 스크린샷, in-flight bug-fix 1c) | (pending) | **사용자 보고**: 랜딩 플래너 카드 Date 픽커를 열면 달력이 좁게 축소돼 요일 헤더가 겹치고("SunMonTueWed…") 날짜 셀이 깨짐. 원인: `IntakeDateField`가 달력 패널을 normal-flow inline(`mt-2`)으로 확장 → 트리거 컬럼 폭(랜딩 카드 50% `grid-cols-2` 셀, PlannerTopRail `min-w-[180px]`)을 그대로 상속 → 7-col 그리드(`h-9 w-9`×7 ≈ 252px+)가 ~150-180px에 압축. 수정(`IntakeDateField.tsx`): 패널을 `absolute left-0 top-full z-50 w-[18rem] max-w-[calc(100vw-2rem)]` 팝오버로 전환 → grid/flex 트랙 사이징에서 제외돼 부모 50/50 레이아웃 불변 + 달력은 항상 자연 폭(288px)로 렌더. 컴포넌트 doc 코멘트도 "inline 의도적" → "left-anchored popover"로 동기화. 두 호출부(landing-planner-card + PlannerTopRail) 모두 적용. overflow-hidden 조상 없음(랜딩 카드 grid-cols-2 셀) 확인. `tsc`(npx) IntakeDateField 에러 0 (잔여는 pre-existing jest 타입 노이즈). node_modules 미설치로 full build/lint 미실행 — className+comment 한정 변경 |
| 2026-05-25 (2) | Destinations 카드 모바일 좌우 spacing 보강 + 필터 살짝 밝게 (사용자 요청, §B 2026-05-25 (2) row) | (pending) | `destinations-showcase.tsx` 모바일 snap-scroll 보강: `px-4`→`px-6`(16→24px each side), `gap-3.5`→`gap-[18px]`(14→18px), 카드 wrapper `w-[60vw]`→`w-[55vw]`. 데스크톱 grid 분기(`md:gap-5/md:px-0`)는 무영향. `destination-card.tsx` filter/grain/vignette: filter `(1.18/1.18/0.92)`→`(1.14/1.10/0.98)`, grain opacity 0.16→0.13, vignette `transparent 50%/0.28`→`55%/0.20`. 컴포넌트 doc 코멘트도 새 값에 맞춰 동기화. 검증: `preview_eval` 4종 computed style 모두 신규 값 적용 확인(scrollPaddingLeft 24px / scrollGap 18px / wrapper className `w-[55vw]` / image filter `saturate(1.14) contrast(1.1) brightness(0.98)` / grain opacity 0.13 / vignette `radial-gradient(... transparent 55%, rgba(0,0,0,0.2) 100%)`) + `npm run build` exit 0 |

Phase 안에 없지만 좋은 아이디어. Phase 끝나기 전엔 손대지 말 것. 추가 시 출처 + 보류 이유 명시.

| 아이디어 | 출처 | 보류 이유 |
|---|---|---|
| ~~매처 결과 카드에 "비슷한 투어" 추천 줄 추가~~ ↗ **랜딩 2026-05-17** | 일반 패턴 | ~~Phase D 후만 의미 있음~~ — Phase D 완료 후 §D #1로 실행. §C 참조 |
| 시즌 칩 외 "요일별 추천" 칩 추가 | 일반 패턴 | Phase C 완료 후 효과 검증 후 |
| Trust 행에 실시간 예약 카운터 ("오늘 23명 예약") | — | 실시간 데이터 인프라 비용 검토 필요 |
| BestMatchPreview를 다중 후보 비교 영역으로 재정의 | Phase D.1 부산물 | Phase D.1 결과 따라 결정 |
| 매처 입력 음성 입력 | — | 우선순위 매우 낮음 |
| 매처 결과 PDF/이미지 공유 기능 | — | 마케팅 가치 미검증 |
| Phase E.2 OTA 로고 strip | Phase E 분할 결정 (2026-05-17) | OTA 4-6사 라이선스 확인 필요. §B "플랫폼명 텍스트 유지" 결정과 시너지 평가 후 진행 |
| Phase B.3.3 hero `min-h-[44vh]` 축소 | Phase 0c audit (§2.6.1) | 모바일 bottom nav overlay로 user-visible CTA가 여전히 가려짐. 정량 데이터(0b) 후 결정 |
| PostHog 무료 티어 보강 (세션 리플레이용) | 자체 분석 plan §B-3 부산물 | 자체 timeline으로 demo 충분. 필요 시 hybrid (자체 정량 + PostHog 정성) |
| ~~화면 우하단 floating 언어 토글~~ ↗ **랜딩 2026-05-17 (옵션 A 채택)** | 사용자 요청 2026-05-17 | ~~옵션 A/B/C 대기~~ — 옵션 A로 랜딩 완료. §C 참조 |

---

## 1. 한 줄 결론

> **랜딩의 진짜 문제는 "기능 부족"이 아니라 "약속과 증명의 시차" + "매칭 가변성 시그널의 부재"다.** 매처는 약속만 하고, 증명은 빈 영역과 분기 카드 뒤에 있으며, 이마저도 "결과가 어떻게 다양해질 수 있는가"를 못 보여준다. 카피·디자인 리뉴얼이 아니라 **(a) 섹션 순서 + (b) idle preview 가변성 + (c) 계측 인프라** 세 가지가 핵심.

---

## 2. 코드 실사 스냅샷 (사실 검증 완료)

### 2.1 히어로 — 이미 정교함

`components/home/v2/sections/hero-section.tsx` (실측):

- 스크롤 패럴럭스 + 다크닝 핸드오프 (`photoY` · `darkenOpacity` · `headlineY` · `headlineOpacity`)
- Ken Burns 자동 줌 (20s ease-in-out alternate)
- 시즌 칩 (월 기반 자동 회전, 표시 전용)
- H1 + 서브카피 + radial-gradient 배경 패널 (L179-L224)
- Trust 3-stat 행 — **`4.9★ · 100K+ bookings · 8 platforms` + 플랫폼명 `Klook · GetYourGuide · Viator`** (L240-L258, 라인 256에 플랫폼명 명시)
- 매처 eyebrow + 매처 헤드라인 + 매처 서브라인 (L266-L275, 카드 위 3단 헤더)
- 매처 카드 (L278-L401): destination 라디오그룹 + expandable intent textarea + style chips + primary CTA + microcopy
- `prefers-reduced-motion` 대응 완비

### 2.2 BestMatchPreview — idle에서 null

`components/home/v2/DeferredBestMatchPreview.tsx:17` — `phase === "idle"`이면 `null`. 입력 전엔 영역 자체가 없음.

dynamic + `ssr: false` (L6-L12) — 의도된 LCP 최적화.

### 2.3 StickyHomeCta — **이미 게이팅됨** (v2 사실 오류 수정)

`components/home/v2/StickyHomeCta.tsx` (실측):

```ts
// L31-L40
const heroObs = new IntersectionObserver(
  ([entry]) => {
    const rect = entry.boundingClientRect;
    setHeroOut(rect.bottom < 0);  // hero가 viewport 위로 완전히 지나갔을 때만 true
  },
  { threshold: 0 },
);
// L43-L48
const footerObs = new IntersectionObserver(
  ([entry]) => setFooterIn(entry.isIntersecting),
  { threshold: 0.2 },
);
// L57
const show = heroOut && !footerIn;
```

+ AnimatePresence fade-in (L69-L99). reduced-motion 대응.

**v2의 "Sticky 신규 게이팅 구현" 항목은 사실 오류. 이미 구현되어 있음. v3에서는 "노출 임계값 실험"으로 재정의.**

### 2.4 analytics — **console.log 수준** (v2 사실 오류 수정)

`src/design/analytics.ts:15-22` (실측):

```ts
export function trackEvent(event: string, payload: AnalyticsPayload = {}) {
  const data = sanitizePayload(payload);
  if (typeof window !== "undefined") {
    console.log("[analytics]", event, data);
    // replace later with actual analytics provider
  }
}
```

실제 provider 미연결. "1일 baseline 수집" 직접 불가능. **v3에서는 Phase 0를 0a(정의+provider 결정) + 0b(연결 후 baseline)로 분해.**

### 2.5 섹션 순서 — **사실 수정 (Phase B.1 진입 시 보강, 2026-05-17)**

`components/home/v2/HomeV2Page.tsx:24-35` 실측 현재 순서:

```
Hero
DeferredBestMatchPreview
DestinationsShowcase
ItineraryBuilderEntry            ← Phase 3b에서 추가 (v3 작성 시점 미반영)
ChooseTravelStyle
FeaturedProductsShowcase
WhyAtockorea
ProcessOperational
FinalCTA
```

매처 약속 → null 영역 (idle) → 지역 분기 → 빌더 진입점 → 스타일 분기 → 실제 상품. 모멘텀 손실 + Featured까지 5번째 섹션이라는 거리감 동일. v3 작성 시 §2.5 기재가 Phase 3b 이전 시점 기준이었던 사실 수정.

### 2.6 모바일 first-screen fold — **실측 완료 (Phase 0c, 2026-05-17)**

Headless Chrome + CDP `getBoundingClientRect` 실측 (`.tmp-fold/measure-fold.mjs`).

| Viewport | Hero bottom | Intent textarea bottom | Matcher CTA top | Matcher CTA bottom | Fold (h) | Δ (CTA bottom − fold) |
|---|---|---|---|---|---|---|
| **iPhone 14 (390x844)** | 998px | 794px | **873px** | **925px** | 844px | **-81px (CTA 전체 fold 아래)** |
| **iPhone 14 Pro Max (430x932)** | 1037px | 833px | **912px** | **964px** | 932px | **-32px (CTA 전체 fold 아래)** |

핵심 발견:
1. **iPhone 14에서 매처 CTA top(873)이 이미 fold(844) 아래.** 사용자는 CTA 자체를 보지 못함. v3 §2.6 추정 "살짝 잘릴 위험"보다 실측이 더 심각.
2. **Pro Max에서도 CTA bottom이 fold 아래 32px.** 화면이 큰 기기에서도 CTA 잘림.
3. Hero panel(`min-h-[44vh]` 등) 자체가 fold를 154-105px 넘어서 늘어남 — fold 안에 매처 카드 전체를 넣으려면 hero panel 자체 압축이 필요.
4. Phase B.3 매처 헤더 슬림화 회수 추정 ~60px → iPhone 14는 여전히 ~21px 잘림. **B.3만으로 부족.** Trust strip 압축(추가 ~30-40px 회수) 또는 hero `min-h` 재조정 필요.
5. 측정된 CTA 텍스트 "최적 매치 보기" — Phase B.5에서 "맞춤 추천 받기"로 교체 예정 (expectation inflation 가드).

Phase B 진입 시 회수 전략:
- **B.3 매처 헤더 슬림화** (~60px): matcherHeadline + matcherSubline 제거, eyebrow만 유지.
- **B.3 + Trust strip 컴팩트화** (추가 ~30-40px): 가로 폭 활용으로 Trust strip 1줄 압축.
- 합쳐도 부족하면 hero `min-h-[44vh]` 자체 재검토 (현재 모바일 ~371px 보장).

§3 P0-A 진단 보강: 매처 CTA fold 아래 잘림 → "약속-증명 시차"가 단순 컴포넌트 순서 문제가 아닌 **CTA 자체 가시성 문제**임이 확인됨. Phase B.3 우선순위 ↑.

#### 2.6.1 사후 audit 발견 (2026-05-17, B.3 랜딩 후)

B.3 (2472b0ae) 랜딩 후 CDP 재측정에선 iPhone 14 CTA가 fold +2px 위로 올라옴. **그러나 실제 모바일 사용 환경에서는 fixed `MobileBottomNav`가 viewport 하단 ~80px를 오버레이로 덮음.** Phase 0c CDP 측정은 브라우저 viewport 기준이라 이 overlay를 카운트하지 못함.

**실측 effective fold (overlay 적용):**

| Viewport | CDP fold | bottom nav | effective fold | CTA bottom (B.3 후) | Δ |
|---|---|---|---|---|---|
| iPhone 14 (390x844) | 844px | ~80px | **~764px** | 842px | **-78px (overlay에 가려짐)** |
| Pro Max (430x932) | 932px | ~80px | **~852px** | 881px | **-29px (overlay에 가려짐)** |

즉 B.3는 CDP-기준 fold 회수는 통과했으나 user-visible 영역으론 여전히 가림.

**옵션:**
1. **B.3.3 hero `min-h` 축소** — `min-h-[44vh]` → `min-h-[38vh]` (~50px 회수). 위험: 히어로 시각 임팩트 감소.
2. **수용** — 사용자가 조금만 스크롤하면 보임. 모바일 패턴상 흔한 트레이드오프.
3. **MobileBottomNav 동적 hide** — 히어로 단계에서 nav 숨김 (별도 feature, B 범위 밖).

권장: **옵션 2 수용 + B.4/B.5 진행.** 효과 측정은 Phase 0b baseline 후 정량 판단. 단, §C에 audit 발견 row를 남겨 추후 데이터로 재판단 가능하게 함.

---

## 3. 핵심 진단

### P0-A. 약속-증명 시차

매처는 "30초 안에 맞는 투어가 뜬다"고 약속하지만:
- 입력 전: 결과 영역 **물리적으로 존재 안 함** (`null` 리턴)
- 실제 상품 카드(`Featured`)는 4번째 섹션
- 그 사이에 지역 + 스타일 = 2단계 분기

→ 사용자는 약속 직후 "결과가 어떻게 생겼는가"를 못 봄.

### P0-B. **매칭 가변성 시그널 부재 (v3 신규)**

가설적 idle preview를 1장만 박으면 "이게 추천돼요"로 읽힘. 사용자는:
- "내 입력에 따라 결과가 어떻게 달라지나?"
- "정말 매처가 작동하나, 아니면 그냥 같은 상품 보여주나?"

이 질문에 답이 없으면 매처 입력 동기 자체가 약화. **단일 카드 idle preview는 약속-증명 시차를 메우지만 가변성 시그널은 못 채움.** 이 부분은 Codex 리뷰가 못 봄.

처방: idle preview는 **2-3장 cycling** 또는 **3장 stacked carousel**. 각각 다른 destination/style/season 조합으로.

### P0-C. 포지셔닝 두 갈래 → 카드 위 헤더에서 중복

- H1 "당신의 한국 하루, 직접 선별." = 큐레이션 약속
- 서브카피 "스타일만 알려주세요 - 맞는 투어가 30초 안에 떠요." = 매칭 약속
- 매처 eyebrow + headline + subline (`hero-section.tsx:266-275`) = **또 한 번 매칭 약속 반복**

H1+서브카피가 이미 시 + 약속 조합을 완결시키는데, 매처 카드 위에 또 3단 헤더 = **메시지 중복 + 시선 분산.** 슬림화 대상.

### P0-D. CTA 계층 (Codex 수정 반영)

primary 무게 surface 6-7개. 단, **StickyHomeCta는 이미 게이팅되어 히어로 단계에서 안 보임**. 따라서 "첫 화면 경쟁"이 아니라 "스크롤 이후 단계에서의 source 분배" 문제로 재정의.

남은 진짜 문제:
- Destinations / Style / Featured 카드가 동시에 primary 시각 무게 가짐
- FinalCTA + Sticky가 페이지 하단에서 동시 시야

### P1-A. 매처 결과가 새 섹션으로 점프

CTA 클릭 → 페이지 스크롤이 BestMatchPreview로. 매처 카드는 위, 포커스는 아래. 한 카드 안에서 결과 보는 강한 서사 깨짐.

### P1-B. 시즌 칩이 표시 전용

월 기반 자동 회전만. 인터랙티브 진입점 비활성. 입력 마찰 줄일 자연스러운 한 클릭이 죽어 있음.

**단, 인터랙티브화 시 두 가지 위험 (Codex + v3 결합):**
1. **affordance 강도** — 버튼처럼 보이면 사용자가 "여기 뭐가 일어나지?" 혼란. (Codex)
2. **주입 phrase 길이** — "벚꽃 시즌 분위기로" 너무 김. 사용자 추가 입력 어색. (v3 self-review)

→ 처방: 짧은 phrase ("벚꽃 시즌") + 약한 affordance (호버 시만 인디케이터) + 클릭 시 명시 피드백 (intent 입력란 글로우).

### P1-C. 매처 CTA "최적 매치 보기"의 expectation inflation (v3 신규)

"최적"이 약속 무게 큼. 실제 결과가 best가 아닐 때 (실제로 매칭 엔진은 score 기반 — best 보장 안 함) 실망. "맞춤 추천 받기" / "내 투어 찾기"가 부담 작음. 이 부분 Codex 리뷰 못 봄.

### P1-D. 모션 정체성 단절

히어로 = cinematic (parallax + Ken Burns + scroll darken). Destinations / Featured / Style = static cards. "프리미엄 도구" vs "범용 OTA"로 둘로 갈림.

### P2-A. Trust 신호 밀도

`4.9 · 100K+ · 8 platforms · Klook · GetYourGuide · Viator` — 텍스트만. 회색조 OTA 로고로 신호 밀도 ↑. 단 라이선스 확인 필요.

### P2-B. 계측 공백 (Codex 수정 반영)

provider 미연결 = **현재 측정 불가능**. v2의 "1일 baseline" 거짓. Phase 0를 두 단계로 분해해야 정직.

### P2-C. 모바일 결과 인터랙션 (v3 신규)

모바일에서 CTA 클릭 후 스크롤 점프는 컨텍스트 손실. **bottom-sheet 슬라이드업**이 모바일 네이티브 패턴. Phase D에 in-place morphing과 별도 트랙으로 둠. Codex 리뷰 못 봄.

---

## 4. 결정 매트릭스 — 강한 분포

v2가 "조건부 찬성" 일색이었던 걸 강한 accept/reject로 재정렬.

### Accept (즉시 실행, 단서 없음)

| 항목 | 위치 | 추정 LOC |
|---|---|---|
| Featured ↔ Destinations 순서 swap | `HomeV2Page.tsx:25-33` | 2줄 |
| 매처 헤더 3단 → 1단 슬림화 | `hero-section.tsx:266-275` | ~10줄 |
| Trust 라벨 한글화 (플랫폼명 유지) | `hero-section.tsx:240-258` + i18n | ~15줄 |
| 계측 이벤트 7종 정의 (provider 결정과 분리) | `src/design/analytics.ts` | ~80줄 |

### Accept with Specific Design (수용, 단 구체 설계 명시)

| 항목 | 구체 설계 |
|---|---|
| Idle preview | **단일 카드 아님. 2-3장 cycling** (5초 간격 fade) 또는 가로 stacked carousel. 실제 Featured 데이터 재사용 (`getFeaturedJoinTourProduct` 등). reason chips는 상품 메타에서 동적 |
| 시즌 칩 인터랙티브 | 짧은 phrase (`벚꽃 시즌`) + 약한 affordance + 클릭 시 intent 글로우 피드백 + aria-label |
| 매처 CTA 카피 | "최적 매치 보기" → "맞춤 추천 받기" (expectation inflation 회피) |
| `StickyHomeCta` 노출 threshold 실험 | 현재 `rect.bottom < 0` (100% out) vs `rect.bottom < viewport*0.5` (50% out). A/B로만, 즉시 변경 금지 |

### Reject (실행 안 함)

| 항목 | 이유 |
|---|---|
| H1 즉시 기능형 교체 | 브랜드 보이스 손실. A/B로만 측정 |
| 매처 카드 첫 화면 압축 | Phase 0a fold 실측 후 결정. 측정 없이 자르지 말 것 |
| amber eyebrow 뮤트 / Process 다크 라이트화 | 사용자 명시 피드백 |
| 새 배경비디오 / 라이브러리 / 캐러셀 (idle preview용은 inline JS로 처리) | 성능·번들 비용 |
| 가짜 "추천 예시" 상품 카드 (제주 동부 자연 코스 등) | 실제 Featured 재사용으로 가짜 자산 회피 |
| `console.log` 기반 baseline 수집 | 실측 불가능. provider 결정 후로 미룸 |
| StickyHomeCta 게이팅 "신규 구현" | 이미 구현됨 (v2 사실 오류) |
| in-place result morphing 즉시 적용 | Phase D A/B로만. Phase B에 절대 섞지 말 것 |

### Defer / Investigate (조건부 — 결정 미룸)

| 항목 | 결정 조건 |
|---|---|
| OTA 로고 strip | 라이선스 확인 결과 |
| Trust strip 한글화 영어 locale 처리 | i18n 리소스 검토 후 |
| Phase 0b baseline 기간 | provider 결정 후 트래픽 볼륨 따라 1-2주 결정 |

---

## 5. Phase별 실행 계획

v2의 Day 0-9 일정을 분해. 각 Phase는 **독립 PR**로 분리. Phase 간 베이스라인 비교 가능하게.

### Phase 0a — 계측 인프라 정의 (1일)

목표: **provider 미연결 상태를 인정하고**, 그 위에서 할 수 있는 일만 한다.

작업:

1. 신규 이벤트 7종 정의 (`src/design/analytics.ts`):
   - `home_hero_intent_focus` — intent textarea 첫 포커스
   - `home_hero_style_chip_click` — `{ chipId: string }`
   - `home_hero_season_chip_click` — `{ season: string }` (Phase C 의존)
   - `home_sticky_cta_click` — 기존 `home_cta_click`과 source로 통합 결정
   - `home_match_preview_visible` — IntersectionObserver, idle/loading/success 구분
   - `home_featured_card_click` — `{ source: "idle_preview" | "regular_section", slug: string }`
   - `home_destination_card_click` — `{ destination: string }`

2. payload sanitization 확인 — **intent textarea 전문 절대 안 보냄**. 길이/언어만 (PII 보호).

3. `home_cta_click`과 신규 이벤트 충돌 방지 — source enum 통합 vs 별도 이벤트 결정.

4. **provider 결정 issue 별도 생성** — Mixpanel / GA4 / PostHog / Vercel Analytics 후보 검토. v3 범위 밖 (별도 의사결정).

산출물:
- 이벤트 taxonomy 문서 (`docs/analytics-events-home.md`)
- analytics.ts 변경 PR (console.log 유지하되 호출부는 다 연결)

검증: 콘솔에서 이벤트 발화 7종 모두 확인.

### Phase 0b — provider 연결 + baseline (provider 결정 후 1-2주)

**Phase 0a 끝난 뒤 별도 의사결정 후 시작.** Phase 1과 비동기.

작업:
- 결정된 provider SDK 도입
- `trackEvent` 본문 교체
- 1-2주 baseline 수집
- 7개 이벤트 평일/주말 노이즈 포함 평균 기록

이 단계 완료 후에만 Phase 2의 카피/순서 변경 "성과"를 정량 평가 가능.

### Phase 0c — 모바일 fold 실측 (0.5일, Phase 0a와 병렬)

목표: §2.6의 추정치를 실측으로 대체.

작업:
1. preview_start로 dev 띄우기
2. 390x844 / 430x932 viewport에서 스크린샷
3. 매처 CTA가 fold 위/아래/걸침 확인
4. 결과를 §2.6에 박아넣고 P0 진단 보강

만약 CTA가 fold 아래라면:
- Trust strip 컴팩트화 OR
- 매처 헤더 3단 → 1단 슬림화 (이미 Phase B 항목)로 회수

### Phase B — 가장 안전한 전환 개선 (1-2일)

가장 ROI 높고 위험 가장 낮음. 백엔드 무변경. Phase 0a 완료 후 즉시.

#### B.1 섹션 순서 swap

`HomeV2Page.tsx:24-35` — Featured를 Match 직후로 끌어올림. ItineraryBuilderEntry는 §B 결정(2026-05-17)에 따라 Destinations와 함께 후반부로 이동:

```tsx
<HeroSection />
<DeferredBestMatchPreview />
<FeaturedProductsShowcase />     // ↑ Match 직후로 이동
<DestinationsShowcase />          // ↓ Featured 뒤로
<ItineraryBuilderEntry />         // Destinations 인접 유지
<ChooseTravelStyle />
<WhyAtockorea />
<ProcessOperational />
<FinalCTA />
```

결과 흐름: 매처 약속 → 결과 영역 → **실제 상품 (Featured)** → 지역 분기 → 빌더 진입 → 스타일 분기 → ...

핵심 효과: Featured가 4→3 위치로 한 단계 위 (Match preview 직후). idle phase에선 Featured가 "실제 상품 미리보기" 역할도 함 (Phase B.2 IdleCarousel과 시너지).

#### B.2 DeferredBestMatchPreview idle preview — **cycling 카드 2-3장**

`DeferredBestMatchPreview.tsx` 리팩토:

```tsx
"use client";
import dynamic from "next/dynamic";
import { useHomeV2Match } from "@/components/home/v2/HomeV2MatchProvider";
import { IdleMatchPreviewCarousel } from "./IdleMatchPreviewCarousel"; // 정적 import

const BestMatchPreview = dynamic(/* ... */, { ssr: false });

export function DeferredBestMatchPreview() {
  const { phase } = useHomeV2Match();
  if (phase === "idle") return <IdleMatchPreviewCarousel />;
  return <BestMatchPreview />;
}
```

`IdleMatchPreviewCarousel.tsx` (신규):
- 3장 cycling (5초 fade 또는 가로 stacked)
- 각각 다른 destination/style/season 조합 — Featured 슬롯에서 가져옴
- 라벨: "이런 식으로 추천돼요"
- reason chips는 상품 메타에서 동적 (`tour.tags` 또는 `tour.highlights` 활용)
- 이미지 `next/image` priority 안 줌, `loading="lazy"`
- 모션: `useScroll` 안 씀. 단순 setInterval 또는 framer-motion variants
- 클릭 시 실제 상품 페이지 이동 + analytics `{ source: "idle_preview" }`

성능 가드:
- 정적 import이지만 carousel 자체는 마운트 후 그림
- 위치는 히어로 직하지만 LCP 영역 아님 (fold 아래)

#### B.3 매처 헤더 3단 슬림화

`hero-section.tsx:266-275`를 다음으로 축소:

```tsx
<div className="mx-auto mb-3 max-w-lg px-1 text-center md:mb-4">
  <span className="text-eyebrow">{t("premium.v2.hero.matcherEyebrow")}</span>
</div>
```

- eyebrow는 짧은 amber 라벨 유지 ("Smart Match" 또는 "맞춤 매칭")
- matcherHeadline, matcherSubline 제거 (H1 + 서브카피와 중복)

#### B.4 Trust 라벨 한글화 (한국어 locale only)

i18n 리소스에서 `ko` 번들만:

```
4.9★ avg. rating       → 4.9★ 평균 평점
100K+ bookings         → 100K+ 누적 예약
8 platforms · Klook... → 8개 플랫폼 운영 · Klook · GetYourGuide · Viator
```

**플랫폼명 반드시 유지.** 영어 locale은 변경 없음.

#### B.5 매처 CTA 카피 변경

i18n `premium.hero.findMatchCta`:
- 현재: "최적 매치 보기" / "Find My Best Match"
- 변경: "맞춤 추천 받기" / "Get My Recommendation"

이유: expectation inflation 회피. "최적"/"Best"가 실제 매칭 score 한계 넘는 약속.

**A/B 옵션:** Phase 0b baseline 후 두 카피 비교 측정.

#### B.6 StickyHomeCta QA (신규 구현 아님)

`StickyHomeCta.tsx` 현재 동작 확인만:
- 데스크톱 1440px / 모바일 390px 모두 히어로 단계 미노출 확인
- 스크롤 후 정상 노출
- FinalCTA 진입 시 사라짐
- focus order / reduced-motion 동작

**현재 threshold (`rect.bottom < 0`) vs 50% 변경 비교**는 Phase D 실험으로 분리.

### Phase C — 상호작용 강화 (1-2일)

Phase B 완료 후. 사용자 입력 진입 마찰 감소.

#### C.1 시즌 칩 인터랙티브화

`hero-section.tsx:188-197`에 onClick 추가:

설계:
- 칩을 `<button>`으로 (현재 `<div>`)
- 약한 affordance — 호버 시만 ring 강도 ↑, 기본 상태에서 버튼 인상 안 줌
- 클릭 시 `appendIntentPhraseToIntentField`로 짧은 phrase 주입:
  - spring → `벚꽃 시즌` (영어 `cherry blossom season`)
  - summer → `여름 시원하게` (영어 `cool summer`)
  - autumn → `단풍 시즌` (영어 `autumn foliage`)
  - winter → `겨울 야경` (영어 `winter night views`)
- 클릭 후 intent textarea에 200ms glow ring (피드백)
- aria-label: `"시즌 키워드 '벚꽃 시즌' 추가"`
- 키보드 Enter/Space 동작 보장
- analytics: `home_hero_season_chip_click({ season })`

위험 가드:
- 자동 포커스 이동 금지 (사용자 흐름 방해)
- 자동 스크롤 금지

#### C.2 reason chips 동적 데이터 연결

`BestMatchPreview` 결과 카드에 reason chips 1줄 추가. 매칭 엔진의 `matchResult.reasons` 또는 상품 메타 (`tour.tags` / `tour.highlights`)에서 가져옴.

idle preview의 reason chips도 같은 데이터 소스 — 정적 카피 만들지 말 것.

### Phase D — 실험성 높은 제품 경험 (3-5일, A/B 필수)

Phase B/C 안정화 후. 위험·보상 큼.

#### D.1 in-place 매처 결과 morphing (데스크톱)

설계:
- 매처 카드 컨테이너에 framer-motion `LayoutGroup` + `motion.div layout`
- phase=loading → 카드 내부 스켈레톤 (높이 자연 변형)
- phase=success → 결과 (이미지 + 타이틀 + reason chips + secondary CTA "전체 보기") in-place 교체
- 기존 `BestMatchPreview` 섹션은 "비교용 다중 후보" 영역으로 역할 재정의

위험:
- 카드 높이 변화로 모바일 레이아웃 흔들림 → **모바일은 D.2 패턴 사용, in-place는 데스크톱만**
- "다시 수정" 흐름 복잡화 → 결과 카드 안에 "다시 매칭" 버튼 명시
- framer-motion layout animation 성능 부담 → reduced-motion에서는 즉시 교체

A/B:
- A: 기존 점프 동작
- B: in-place morphing (데스크톱) + bottom-sheet (모바일)
- 측정: 매처 완료율, 결과 카드 클릭률, bounce rate

#### D.2 모바일 bottom-sheet 결과 (v3 신규, Codex 못 본 패턴)

설계:
- 모바일 vw < 768px에서 CTA 클릭 시 페이지 스크롤 대신 bottom-sheet 슬라이드업
- sheet 높이 70vh (handle bar로 dragable)
- sheet 내부: BestMatchPreview 결과 카드 + reason + CTA
- swipe down 또는 outside tap 닫힘
- focus trap + escape key 대응

이유: 모바일 네이티브 패턴. 매처 컨텍스트 (입력 카드) 위에 결과가 떠서, 사용자가 결과 보면서 "다시 입력 수정"으로 돌아가기 쉬움.

라이브러리: framer-motion에 이미 dragable + AnimatePresence. **새 라이브러리 도입 금지** 가드 준수.

A/B:
- A: 기존 점프
- B: bottom-sheet

#### D.3 StickyHomeCta 노출 threshold A/B

- A: 현재 `rect.bottom < 0` (히어로 100% out)
- B: `rect.bottom < viewport*0.5` (히어로 50% out, Codex 제안)
- 측정: sticky 클릭률, hero CTA 클릭률, 모두 합산한 매처 완료율

### Phase E — 시각 정체성 확장 (2-3일)

Phase D 후. 가장 낮은 우선순위. 측정으로 가치 입증된 뒤만.

#### E.1 공통 scroll-reveal 모션 통일

목표: 히어로 cinematic 톤이 Destinations / Featured / Style / Why / Process 진입까지 이어짐.

**구체 값 (v2가 빠뜨린 부분):**
- 패턴: framer-motion variants (useScroll 안 씀 — 성능 보호)
- threshold: `IntersectionObserver` 15% (`useInView` `amount: 0.15`)
- initial: `{ opacity: 0, y: 16 }`
- animate: `{ opacity: 1, y: 0 }`
- transition: `{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }` (히어로 sticky CTA와 동일 easing)
- stagger (자식 카드): `0.08s` interval
- `prefers-reduced-motion`: 즉시 `opacity: 1, y: 0` (애니메이션 0ms)

피해야 할 것:
- `useScroll` 추가 (히어로에 이미 사용 중. 추가 useScroll은 성능 부담)
- 회전, scale, 튀어오름
- 1초 이상 지연

#### E.2 OTA 로고 strip (조건부)

라이선스 확인 후만. 텍스트 `Klook · GetYourGuide · Viator`를 회색조 SVG 로고 4-6개로.

- 모두 회색조 `#9ca3af` 톤
- 모바일 2줄 또는 슬라이드
- alt 텍스트 명기
- contrast ratio 4.5:1 이상 (회색조 톤이 약하면 darker로 조정)

라이선스 미확보 시 Phase E.2 스킵, 텍스트 유지.

---

## 6. 컴포넌트별 변경 요약

### `components/home/v2/sections/hero-section.tsx`

- [x] **Phase B.3.1**: matcher 헤더 3단 → eyebrow 1단 (2472b0ae)
- [x] **Phase B.3.2**: Trust strip 패딩 컴팩트 (2472b0ae, +83px fold 회수)
- [x] **Phase B.4**: Trust 라벨 i18n 추출 + 6 locale (a94d73b9)
- [x] **Phase B.5**: 매처 CTA 카피 i18n 6 locale 교체 (a94d73b9)
- [x] **Phase C.1**: 시즌 칩 button 변환 + phrase 주입 + glow + analytics (90345fd6) — **부분 번복 2026-05-24**: chip JSX + glow + season derivations 제거 (사진 가시성 우선, §B 2026-05-24)
- [ ] **Phase D.1**: LayoutGroup wrap (in-place result 준비)
- [ ] **Phase D.3**: data attribute 또는 prop 노출 (Sticky threshold 실험용)
- **유지**: parallax, Ken Burns, scroll darken, 사진 비중, 모션 토큰

### `components/home/v2/DeferredBestMatchPreview.tsx`

- [x] **Phase B.2**: idle 분기 → `IdleMatchPreviewCarousel` (741b3cd3)
- [x] dynamic + ssr:false 유지 (BestMatchPreview만 dynamic, IdleCarousel은 정적 import)

### `components/home/v2/IdleMatchPreviewCarousel.tsx` (신규)

- [x] **Phase B.2**: 3장 cycling carousel (741b3cd3)
- [x] 실제 STATIC_TOUR_PRODUCTS catalog 데이터 재사용 (slug 3개 고정 — Jeju/Seoul/Busan)
- [x] reason chips는 `card.badges` 동적 (Phase C.2에서 추가 정교화 가능)
- [x] LCP 영향 없음 — lazy image, priority 안 줌, fold 아래 위치

### `components/home/v2/sections/best-match-preview.tsx`

- [x] **Phase C.2**: reason chips 동적 — 이미 구현됨 (사실 수정, `vm:112-117` `product.badges` 사용)
- [ ] **Phase D.1**: 데스크톱에서 in-place morphing 대상 (또는 비교 영역 재정의)
- [ ] **Phase D.2**: 모바일 bottom-sheet 컨테이너로 wrap

### `components/home/v2/HomeV2Page.tsx`

- [x] **Phase B.1**: Featured ↔ Destinations 순서 swap (d41628bf)

### `components/home/v2/StickyHomeCta.tsx`

- [x] **Phase B.6**: QA only — CDP 4 sample 검증 통과 (코드 변경 없음)
- [ ] **Phase D.3**: threshold 실험 (A/B variant 지원)

### `components/home/v2/HomeV2MatchProvider.tsx`

- [ ] **Phase D.2**: 모바일 bottom-sheet 상태 추가 (`sheetOpen` 등)
- [ ] **Phase C.2**: reason chips 데이터 전달

### Destinations / Featured / Style / Why / Process 섹션

- [x] **Phase E.1**: scroll-reveal variants 적용 (a162b7fc, `reveal.ts` 공통 helper + 5 섹션)
- 외 변경 없음

### `src/design/analytics.ts`

- [x] **Phase 0a**: 이벤트 7종 정의 (시즌 칩은 메서드만 — Phase C.1 와이어링)
- [ ] **Phase 0b**: provider SDK 연결 (별도 의사결정 후)

---

## 7. 카피 가이드

### 원칙

1. **H1은 브랜드 시. 약속은 서브카피.**
2. **CTA는 동사 + 부담 작은 단어.** "Best/최적" 금지. expectation inflation 회피.
3. **Trust는 숫자 + 한국어 명사 + 플랫폼명 살리기.**
4. **eyebrow는 짧고 amber 톤 유지.**
5. **매처 카드 위 카피는 H1/서브카피와 중복 금지.**

### 현재 H1 유지 (권장 기본)

```
H1: 당신의 한국 하루, 직접 선별.
Sub: 스타일만 알려주세요 - 맞는 투어가 30초 안에 떠요.
CTA: 맞춤 추천 받기  ← (B.5에서 변경)
```

### A/B 후보 (Phase 0b 후 측정)

v2는 B/C가 너무 비슷한 기능형 두 개였음. v3는 더 도발적 후보 추가.

```
[A · 현재] 당신의 한국 하루, 직접 선별.
[B · 기능형] 한국 투어, 많이 찾지 말고 맞게 고르세요.
[C · 후기 인용] "30분 만에 제주 일정 완성됐어요." — 김O O, 2025
[D · 결과 미리보기 inline] 당신의 한국 하루, [제주 동부 자연 코스]처럼.
```

운영 기준: baseline 대비 매처 완료율 **+10% 이상 + 5일 이상 지속**에서만 채택. p-value 0.05 이하.

### eyebrow

- 한국어 locale: `맞춤 매칭`
- 영어 locale: `Smart Match`
- amber 톤 유지 (사용자 피드백 가드)

### CTA

- 1차 (히어로): `맞춤 추천 받기` / `Get My Recommendation`
- 2차 (Sticky): `지금 매칭 시작` / `Start Matching Now` — 의미 살짝 다르게
- Final CTA: `내 투어 찾기` / `Find My Tour`

### Trust 행 (한국어 locale)

```
4.9★ 평균 평점
100K+ 누적 예약
8개 플랫폼 운영 · Klook · GetYourGuide · Viator
```

영어 locale: 기존 영문 유지.

### 시즌 칩 phrase (짧게)

- spring → `벚꽃 시즌` / `cherry blossom`
- summer → `여름 시원하게` / `cool summer`
- autumn → `단풍 시즌` / `autumn foliage`
- winter → `겨울 야경` / `winter night views`

### idle preview 라벨

- 한국어: `이런 식으로 추천돼요`
- 영어: `Here's what your match might look like`

---

## 8. 모션 & 시각 정체성 — 구체 값

### 유지

- 히어로 패럴럭스 + Ken Burns + scroll darken
- 시즌 칩 (Phase C에서 interactive로 업그레이드)
- radial-gradient 헤드라인 패널
- amber eyebrow (사용자 피드백)
- Process 다크 섹션 (사용자 피드백)
- 카드 그림자/라운드/타이포 스케일

### 추가 — 구체 값 명시

#### scroll-reveal (Phase E.1)

```ts
const revealVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
};
const containerVariants = {
  visible: {
    transition: { staggerChildren: 0.08 },
  },
};
```

- `useInView({ amount: 0.15, once: true })`
- reduced-motion: variants 무시, 즉시 visible

#### Idle preview carousel (Phase B.2)

```ts
const fadeInterval = 5000; // 5s per card
const fadeDuration = 600;  // 600ms crossfade
const cards = 3;           // 2-3장
```

- reduced-motion: cycling 일시 정지, 첫 카드만 표시 + dot navigation 노출

#### Sticky CTA fade (이미 구현, Phase D.3 실험만)

```ts
// 현재 유지
initial: { y: 64, opacity: 0 }
animate: { y: 0, opacity: 1 }
transition: { duration: 0.34, ease: [0.22, 1, 0.36, 1] }
```

### 금지

- 새 useScroll 추가 (히어로 외)
- 새 라이브러리 / 캐러셀 / 슬라이더
- 회전, 튀어오름, 과한 scale
- 카드 안 카드 중첩
- 새 배경 비디오
- 텍스트 가독성 해치는 사진 합성

---

## 9. 성능 가드레일

### 메트릭 임계값 (Phase별 회귀 판정)

| 메트릭 | 절대 임계값 | Phase별 허용 변화 |
|---|---|---|
| LCP (모바일 4G) | < 2.5s | +50ms 이내 |
| TBT | < 200ms | +30ms 이내 |
| CLS | < 0.1 | +0.02 이내 |
| Bundle (home route) | 측정 후 baseline | +5% 이내 |

### 가드

- 히어로 신규 대용량 이미지 금지
- idle preview carousel: 정적 import이나 priority 안 줌, `loading="lazy"`
- 첫 화면 위쪽 클라이언트 상태 추가 금지
- 매칭 결과 미리보기는 기존 데이터 (`getFeaturedJoinTourProduct`) 재사용
- 새 폰트, 새 CSS 라이브러리 금지
- 추가 API 호출 없음 (Phase 0-C 범위)
- Phase D.1 layout animation은 reduced-motion에서 비활성

---

## 10. 접근성 가드레일

- 시즌 칩 button 변환 시 aria-label 명시 (`"시즌 키워드 '벚꽃 시즌' 추가"`)
- 매처 결과 morphing 시 `aria-live="polite"` announcement
- 모바일 bottom-sheet: focus trap + escape key + handle drag + aria-modal
- StickyHomeCta 첫 활성 시 포커스 이동 금지
- 모든 신규 인터랙션 키보드 Enter/Space 지원
- `focus-ring` 토큰 유지
- Trust 행 OTA 로고 회색조: contrast ratio 4.5:1 이상
- idle preview carousel: dot navigation 키보드 접근 (←→ 화살표)
- reduced-motion: cycling, parallax, scroll-reveal 모두 무력화

---

## 11. 롤백 트리거 (v3 신규)

각 Phase 종료 후 다음 임계값 위반 시 **직전 Phase로 즉시 롤백**.

| 트리거 | 임계값 | 조치 |
|---|---|---|
| LCP 회귀 | +50ms 이상 (5일 평균) | 해당 Phase 롤백 + 원인 분석 |
| TBT 회귀 | +30ms 이상 (5일 평균) | 동일 |
| CLS 회귀 | +0.02 이상 (5일 평균) | 동일 |
| 매처 CTA 클릭률 | -5% 이상 (7일) | 카피/UI 변경 롤백 |
| Featured 카드 클릭률 | -10% 이상 (7일) | 순서 변경 또는 idle preview 영향 분석 |
| 에러율 | +1% 이상 | 즉시 hotfix 또는 롤백 |
| 사용자 클레임 | 같은 패턴 3건 이상 (7일) | UX 변경 재검토 |

베이스라인 없는 항목 (Phase 0b 미완료)은 정성 + 직관 판단. 단 결정 시 문서화.

---

## 12. 성공 기준 — 정직화

### 정량 (Phase 0b baseline 확보 후 임계값 확정)

v2의 "+15%/+20%/+25%"는 baseline 없이 만들어진 추측이었음. v3는 다음과 같이 정직화.

**Phase 0b 완료 전 (현재 상태)**: 정성 + 직관 판단만 가능.

**Phase 0b 완료 후 (목표 임계값 가설):**

| 지표 | 가설 목표 (baseline 후 확정) |
|---|---|
| `home_hero_cta_click` rate | baseline +10% 이상 |
| `home_hero_intent_focus` rate | baseline +15% 이상 |
| `home_match_preview_visible` rate | baseline +20% 이상 |
| `home_featured_card_click` (`source: idle_preview`) | 전체 featured 클릭의 5% 이상 흡수 |
| 모바일 스크롤 깊이 (>= Featured) | baseline +10% 이상 |
| LCP | 회귀 없음 (위 §9 임계값 준수) |

**baseline 측정 전엔 위 숫자를 약속하지 않는다.** 가설로만 유지.

### 정성

- 첫 화면만 보고 "스타일 입력 → 추천 받는 서비스"라는 인지 즉시 성립
- 매처 약속과 idle preview의 가변성이 같이 읽힘 ("진짜 다양한 결과가 나오겠구나")
- 첫 클릭 망설임 없음 (히트맵)
- 사진/신뢰/상품/매칭이 한 흐름
- 브랜드 premium 톤 유지 — 절제 audit에 끌려가 평탄해지지 않음
- 모바일에서 매처 컨텍스트 손실 없이 결과 확인 가능 (Phase D.2 후)

---

## 13. 안 할 일 / 안티패턴

v2 + v3 자체 비평 통합.

- 전체 디자인 시스템 교체
- 컬러 팔레트 대규모 변경
- 매칭 로직 변경
- 새 DB 스키마 도입
- 새 외부 UI 라이브러리 도입 (idle carousel, bottom-sheet 모두 framer-motion 내에서)
- 랜딩을 설명형 긴 페이지로 변환
- 인기 상품 카드 UI 자체 갈아엎기
- amber eyebrow 뮤트
- Process 다크 섹션 라이트화
- 시 H1을 기능 설명서 H1으로 일괄 교체 (A/B 외)
- baseline 없이 카피만 바꾸기
- "추천 예시"용 가짜 상품 카드 만들기 (실제 Featured 재사용)
- **idle preview 단일 카드** (가변성 시그널 부재 — v3 신규 가드)
- **"최적/Best" 류 expectation 인플레이션 카피** (v3 신규 가드)
- **StickyHomeCta 게이팅 "신규 구현"** 일감 생성 (이미 있음)
- **provider 없이 "baseline 수집" 약속** (Codex 수정 반영)
- 시즌 칩 강한 affordance + 긴 phrase 주입
- Phase B와 Phase D 섞기 (어떤 변경이 성과 냈는지 못 가림)

---

## 14. 실행 순서 요약

```
Day 0-0.5   Phase 0a + 0c (계측 정의 + 모바일 fold 실측, 병렬)
Day 0.5-2   Phase B (순서 swap + idle carousel + 헤더 슬림 + Trust + CTA 카피 + Sticky QA)
                    ↓ Phase 0b는 provider 결정 의사결정 트랙으로 분리, 비동기 진행
Day 3-4     Phase C (시즌 칩 인터랙티브 + reason chips 동적)
Day 5-9     Phase D (in-place morphing A/B + 모바일 bottom-sheet A/B + Sticky threshold A/B)
Day 10-12   Phase E (scroll-reveal 통일 + OTA 로고 strip 조건부)

병렬 트랙   Phase 0b (provider 결정 → 연결 → 1-2주 baseline 수집)
            Phase D는 Phase 0b baseline 확보 후만 측정 의미 있음 → 시기 조정
```

Phase 간 의존:
- Phase 0a → Phase B 시작 가능
- Phase 0c → Phase B의 매처 헤더 슬림화 영향 판단
- Phase B → Phase C → Phase D 순서 고정
- Phase D는 Phase 0b 완료 시점과 sync (측정 가능해야 의미)
- Phase E는 마지막 (가장 낮은 우선순위)

---

## 15. 결정 사항 / 거버넌스

1. **v3가 유일한 표준 실행 기준.** v2 폐기. v1 audit + v2 review는 입력 자료 보존.
2. 각 Phase는 독립 PR. 한 PR에 여러 Phase 섞기 금지.
3. Phase 0b provider 결정은 v3 범위 밖. 별도 의사결정 후 진행.
4. 롤백 트리거 (§11) 위반 시 자동 롤백 + 원인 분석 문서화.
5. A/B variant는 Phase 0b baseline 확보 후만 시작. baseline 없이 카피 변경 금지.
6. v3 자체도 살아있는 문서. Phase 진행하며 새 사실/측정 결과 반영해 업데이트.

---

## 16. 다음 액션

**즉시:**
1. Phase 0a 시작 — `src/design/analytics.ts`에 이벤트 7종 정의 PR
2. Phase 0c — preview_start로 dev 띄워서 390x844 fold 실측 (§2.6 보강)
3. Phase 0b — provider 후보 4종 (Mixpanel/GA4/PostHog/Vercel) 비교 issue 별도 생성

**Phase B 진입 조건:** 0a 완료 + 0c 측정값 §2.6에 반영.

**v3 완성도 한계 인정:**
- Phase 0b provider 결정 안 됨 (out of scope)
- 모바일 fold 실측 안 됨 (Phase 0c에서 곧 측정)
- A/B variant 통계 모델 / 실험 도구 미정
- OTA 라이선스 미확인

이 4개는 별도 의사결정 트랙으로 분리. v3 실행 시작을 막지 않음.
