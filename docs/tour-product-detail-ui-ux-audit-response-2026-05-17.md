# 투어 상세 페이지 UI/UX Audit — Codex 리뷰에 대한 응답 및 통합 실행 플랜

작성일: 2026-05-17
원문: `docs/tour-product-detail-ui-ux-audit.md` (Claude 1차 마스터 플랜)
리뷰: `docs/tour-product-detail-ui-ux-audit-review-2026-05-17.md` (Codex 의견)
대상 페이지: `app/tour-product/[slug]/page.tsx`

---

## 0. 한 줄 입장

> **Codex의 리뷰는 70% 맞다. 나머지 30%는 안전 우선 관점이라 옳은 견제이지만, "디자인 시스템 부채"의 본질을 약간 완화해서 본다.**
>
> 나의 1차 플랜은 진단은 정확했으나, **실행 순서가 위험했다.** Codex의 conversion-first 순서를 받아들이되, 디자인 시스템 통일의 강도는 양보하지 않는다.

요약 입장:

```
방향: 그대로 유지 (색상·타이포·shadow·radius·accordion 다이어트)
순서: Codex의 Phase A (conversion 안전 항목 먼저) 채택
강도: 색상 다이어트는 양보 X — 한 페이지 17색은 premium의 가장 큰 적
범위: Hero 대수술과 interactive map은 Phase E/F로 미룸
가드: 모든 변경은 섹션 단위 feature flag + 다국어 QA 통과 후 머지
```

---

## 1. Codex 평가 중 내가 수용하는 부분 (= 내가 틀렸음)

### 1.1 Phase 1에 13개 변경을 한 번에 묶은 것 — 잘못

원문 Phase 1은 `Hero 자동슬라이드 OFF + Hero overlay + Hero edge-to-edge + Trust strip 단색 + Sub-nav 변경 + At-A-Glance 변경 + Gallery gutter + Pickup gradient 제거 + Drop-off dark 제거 + 배경 그라데이션 제거 + CTA 색 + Drawer 0.78s → 0.30s + Watermark 제거` 13항목.

**Codex 지적이 옳다:** 이건 quick-win이 아니라 **전면 리스킨**. 한 번에 머지하면:

- 어떤 변경이 컨버전을 끌어올렸는지/떨어뜨렸는지 측정 불가
- 시각 회귀(QA)가 한 PR에 14개 섹션 동시 발생
- 롤백 단위가 너무 큼 → 작은 버그도 통째로 revert
- 다국어 5종 × 14 섹션 = 70개 회귀 케이스

**수정:** Phase 1은 두 트랙으로 분리.

```
트랙 1 (컨버전 안전): drawer 속도 + CTA 색 + booking card 슬림화
트랙 2 (시각 시스템): 토큰 정의만, 적용은 섹션별 점진
```

### 1.2 Hero 60vh 확대 — 후회

원문은 "Hero 60vh + 풀스크린 swipe gallery (Airbnb-style)" 을 Phase 3 권장. **이건 상세페이지 컨버전 본능에 반한다.**

- 상세페이지 ≠ 랜딩 페이지. 상세는 "가격·일정·예약 가능" 확인이 목적.
- 60vh hero = 모바일에서 가격/CTA 정보가 첫 fold 아래로 밀림
- Airbnb는 호텔/숙소가 본질적으로 시각 의존도 99% (사진이 곧 상품). 투어는 일정 + 포함 + 가이드 신뢰가 본질의 60%

**수정:** Hero는 현재 `max-h-[360px]` 캡을 **소폭** 완화 (예: `max-h-[420px]` 데스크탑) 정도만. 모바일은 그대로. 60vh 안 함.

### 1.3 Radius 8/12/16 기계적 3단계 — 너무 좁음

원문은 `sm 8 / md 12 / lg 16` 3단계로 제한. Codex가 옳다: **booking card, drawer, modal은 본문 카드보다 더 큰 radius를 가질 수 있다.**

**수정 (Codex의 role-based scale 채택):**

```
chip / pill:        8px or full
small control:      10-12px
body card / photo:  12-16px
booking / drawer:   18-20px
modal:              20px
```

핵심은 **숫자 단계 수**가 아니라 **역할별 1:1 매핑**. 현재 페이지에 `14, 20, 26, 28` 8단계가 있는 게 문제이지, 4단계로 가도 OK.

### 1.4 Trust strip 완전 제거 — 과한 처방

원문은 "Hero 직후 trust strip은 컨버전 압박만 주고 매력 안 들어옴" → "booking card 안으로 옮기기" 제안. Codex 지적대로 **이건 정보 위치만 보고 가치를 놓침**.

상세페이지 도입부의 신뢰 신호는:
- 결정 fatigue 완화
- 첫 fold ≠ booking card 인 사용자(스크롤 사용자) 에게 reassurance 시그널 제공
- 가격을 먼저 보기 전에 "위험 낮음" 시그널

**수정:**
- Trust strip **위치는 유지**.
- 단색화 + 폰트 13-14px 로 키움.
- 같은 문구(free cancellation, pay later)가 page에 5번 등장하는 중복은 **개수만** 줄임 (5 → 2회: trust strip + booking card 안).

### 1.5 Phase 0 "토큰 먼저, 그 다음 적용" 순서 — 비현실적

원문은 Phase 0 (토큰 정의) → Phase 1 (시각 변경) 순서. Codex 지적: **토큰만 정의해놓고 적용을 미루면 토큰은 영원히 dead code.**

**수정:** Codex의 conversion-first 순서를 채택. **먼저 컨버전 안전 항목(=CTA 계열)을 작은 PR로 처리하면서 동시에 그 PR 안에서 토큰을 함께 정의·사용.** 토큰은 적용과 동시에 태어남.

```
Before (원문):  토큰 → (대기) → 적용
After (수정):   적용 PR 안에서 토큰 정의 + 사용 동시
```

### 1.6 Scroll freeze 리스크 — 안 짚었음

Codex가 추가한 가드: "사용자가 상세페이지 스크롤 도중 멈춤 보고함 → motion 추가에 주의".

원문에는 빠진 중요한 컨텍스트. 결과:
- Hero ken-burns animation: **유지** (이미 IntersectionObserver paused 처리됨)
- Drawer push-spacer: **신중하게** overlay 전환 (한 번에 전환 X, QA 단계)
- Hero overlay: **모바일 first fold 정보가 늘어남** → first paint LCP 영향 측정 필수
- Backdrop blur: 새로 추가 금지, 기존 것도 stack 2개 이상 금지 (이미 sub-nav에서 한 번 제거된 이력)

### 1.7 Watermark 제거 — 정책 확인 필요

원문은 "premium = no watermark" 일방 처방. Codex 지적: **저작권/내부 운영 정책 확인이 선행 조건.**

**수정:**
- Lightbox 안: watermark 제거 우선 (사용자가 가장 크게 보는 순간)
- Hero/gallery 메인: 정책팀 확인 후
- Card thumbnail: 유지해도 OK (작아서 거의 안 보임)

---

## 2. Codex 평가 중 내가 더 강하게 밀어야 하는 부분

### 2.1 색상 다이어트는 양보 X — 단일 최고 임팩트 변경

Codex도 "찬성"하되 "지나치게 평평해질 수 있으니 accent는 살려두자" 는 단서. **나는 더 강하게 밀어야 한다고 본다.**

이유:
- 현재 페이지의 premium feel 부재 원인 1순위가 색상 분산. (2번째가 typography, 3번째가 shadow)
- "여행 상품 = 감성이라 색이 필요" 라는 주장은 **착각**. Airbnb / Klook 모두 본문은 거의 monochrome + 1 brand color. 감성은 **사진**이 담당. UI 색이 담당 X.
- "accent 완전히 죽이지 말기" 는 동의하지만, 현재 페이지 accent (copper `#c8956c`) 는 **Pickup section + Fit card + Hero star + Trust strip 아이콘 + 일부 ring** 에서 5가지 다른 의미로 쓰임. 이건 "accent" 가 아니라 **secondary brand color 가 의미 없이 흩뿌려진 상태**.

**고집할 룰:**

```
brand:    #2e5c8a          → CTA, focus ring, primary 인터랙티브
accent:   #c8956c           → Hero star + 1-2 hero accent only (예: subnav active underline)
success:  emerald-600        → "available", "verified", "included" 상태 only
danger:   red-500            → "unavailable", "not included" 상태 only
neutral:  slate-900 ~ slate-50 → 나머지 전부
```

→ **rose, amber-as-decoration, sky, violet, orange = 페이지에서 0회 사용.**

### 2.2 Type scale은 "정의"가 아니라 "강제"가 필요

Codex는 "공통 type scale 정의" 만 권장. 나는 **enforcement** 없이는 토큰이 무력하다고 본다.

이유: 현재 코드에서도 `--radius`, `--primary` 같은 토큰은 이미 정의되어 있다 (`tour-product-v2-scope.css:5-25`). 그런데 **거의 모든 섹션이 토큰을 우회하고 인라인 값을 박았다.** 토큰을 정의해도 사용 안 됨 = dead token.

**추가해야 할 가드:**

1. ESLint rule: `text-\[1[0-9](\.[0-9])?px\]` 매칭하는 임의 픽셀 클래스 경고
2. PR template: "이 PR에 새로운 색·radius·shadow 가 들어가는가? 토큰 사용했는가?" 체크박스
3. Storybook (또는 단순 design.tsx 페이지): 페이지 단위로 type / color / elevation 샘플을 보여줌 → 디자이너가 즉흥 결정하기 전에 참조

### 2.3 Accordion 다이어트 — Codex가 약하게 잡음

Codex는 "FAQ + Practical만 accordion 으로 남김" 권장. 동의하지만 **수치를 더 강하게**.

현재 페이지 accordion 패턴 8종 (Included, Fit-BestFor, Fit-LessIdeal nested, Fit-RouteLogic, Practical, FAQ-item, Pickup-row, Support).

**목표: 2종으로 축소.**

```
유지:  FAQ (item-level), Practical (top-level)
폐기:  Included accordion → 첫 5개 always visible + "Show all" link
폐기:  Fit 3중 nested → flat 2-col (best / less ideal) always visible
폐기:  Pickup row expand → 단순 list (note 가 있는 경우 row 아래 항상 노출)
폐기:  Support default-open accordion → flat horizontal timeline mini
```

이거 하나로 **사용자 클릭 -8회**, **first-fold 정보량 +60%**.

### 2.4 CTA 통합 (price + label) — Codex가 약하게 잡음

Codex도 "CTA에 total price 포함" 찬성. 다만 "검토" 라고 약한 표현. **나는 강한 처방.**

근거:
- Airbnb 패턴: `Reserve · $1,247 total` — 한 줄에 액션 + 가격 + 단위
- 현재 페이지: CTA 위에 "From $X" 별도 / CTA "Reserve" / 그 아래 "Total · X guests $Y" 별도 → **가격이 3번 등장, 사용자 인지 분산**
- 모바일 sticky bar 도 마찬가지 — 좌측에 "From $X / per person" + 우측 CTA "Check Availability" → CTA에 가격 신호 0

**처방:**

```
Desktop CTA:        Reserve · {totalFormatted}    (guestCount > 1)
                    Reserve · {unitFormatted}     (guestCount = 1)
Mobile pre-drawer:  Check Availability · from {unit}
Mobile in-drawer:   Reserve · {total}
```

### 2.5 At-A-Glance 6색 무지개 — Codex가 동의했지만 대체안 모호

Codex 찬성: "의미 없는 색상 신호 제거". 그러나 **그 다음 어떤 UI 가 들어가야 하는가** 는 빠짐.

내 처방 (3개 옵션 중 하나):

```
A. Progress bar:    "Walking intensity ████░ "  (단색 brand color)
B. Pill chip:        "Easy" / "Moderate" / "Vigorous"   (text only, brand color tinted)
C. ★ system:         "Walking intensity ★★★☆☆"   (amber, universal)
```

Tour 의 직관에는 **B (text pill)** 이 가장 명확하다. "Easy / Moderate / Hard" 는 추상 도트보다 즉시 이해됨. Klook/Booking 도 이 패턴.

---

## 3. 통합 실행 플랜 (Codex Phase A-F → 압축 4 Sprint)

Codex의 6 Phase는 방향은 옳지만 **너무 길다.** 실제 실행 가능한 단위로 압축:

### Sprint 1 — 컨버전 안전 (1주, 1 PR group)

목표: 예약 흐름 마찰 즉시 감소. 시각 시스템에는 거의 손대지 않음.

| 작업 | 파일 | 리스크 |
|---|---|---|
| Drawer animation `0.78s → 0.30s` | `TourStickyBookingBar.tsx:319, 334` | 거의 없음 |
| Desktop + Mobile CTA `bg-foreground → bg-primary` | `TourDesktopBookingCard.tsx:522`, `TourStickyBookingBar.tsx:291` | 낮음 (visual only) |
| CTA label에 total price 통합 (위 §2.4) | 동일 파일 | 다국어 5종 QA 필요 |
| Booking card pricing tier 중복 제거 (페이지 본문 + booking card 안 + drawer = 3곳 중복) | `TourProductDetailClient.tsx:108-156` | 중간 (정보 표시 변경) |
| Free cancellation / Pay later 반복 5회 → 2회 | trust strip + booking card 안만 유지 | 낮음 |
| Drawer drag handle (4px bar at top) + swipe-down dismiss | `TourStickyBookingBar.tsx` | 낮음 |

**완료 기준:** booking checkout flow 5종(date 선택 / guest 변경 / duration / available / unavailable / 결제 진입) QA 통과.

---

### Sprint 2 — 디자인 시스템 토큰 + 색상 다이어트 (2주, 섹션별 점진 PR)

목표: 색상 17개 → 5개 강제. 토큰은 정의 + 즉시 사용.

| 작업 | 영향 섹션 | 방식 |
|---|---|---|
| Color tokens 정의 (§2.1) | `tour-product-v2-scope.css` | 신규 CSS 변수 추가, 기존 토큰 유지 (호환성) |
| Type scale 6단계 정의 + utility class (`.text-display, .text-title, .text-section, .text-body, .text-caption, .text-eyebrow`) | scope CSS | 신규 class 추가 |
| Hero rose → neutral + accent 1회 (region eyebrow만 accent) | `TourHeroSection.tsx` | 1 PR |
| Pickup copper gradient → flat brand (drop-off dark → light pickup과 동일 카드) | `TourPickupDropoffSection.tsx` | 1 PR |
| Included emerald/rose split → white card with green/red icon only | `TourIncludedSection.tsx` | 1 PR |
| Fit amber/copper bg → white card | `TourFitSection.tsx` | 1 PR |
| Practical weather 4-layer gradient → 단순 row | `TourPracticalDetails.tsx` | 1 PR |
| Seasonal 4계절 4색 → 단일 카드 + season icon (색은 icon에만) | `TourPracticalDetails.tsx` | 1 PR |
| Booking Support 5색 trust + 6색 steps → 1색 | `TourBookingSupportSection.tsx` | 1 PR |
| Reviews summary gradient 3% opacity → solid pale bg | `TourReviewsSection.tsx` | 1 PR |
| Hero star copper → amber (다른 모든 별과 통일) | `TourHeroSection.tsx` | 1 PR |
| Trust strip 3색 → emerald-only monochrome | `TourProductDetailClient.tsx:77-97` | 1 PR |

**완료 기준:** 한 페이지에서 사용하는 색군 grep 으로 5개 (brand/accent/success/danger/neutral) 이하 검증.

---

### Sprint 3 — 콘텐츠 접근성 + 정보 위계 (2주)

목표: Accordion 8개 → 2개. 사용자가 "열어야 하는" 정보를 "보이는" 정보로 전환.

| 작업 | 파일 |
|---|---|
| Included accordion 해제 → 첫 5개 always visible + "Show all" | `TourIncludedSection.tsx` |
| Fit 3중 nested 해제 → 2-col flat layout (best left / less ideal right) | `TourFitSection.tsx` |
| Support default-open accordion → 작은 horizontal timeline | `TourBookingSupportSection.tsx` |
| Pickup row expand 해제 → note 있는 행만 항상 표시 | `TourPickupDropoffSection.tsx` |
| Section heading + subtitle: 모두 동일 spec (Sprint 2 token 사용) | 12개 섹션 |
| Eyebrow: page-wide 단일 class (10가지 → 1개) | 페이지 전체 |
| At-A-Glance 6색 → text pill ("Easy / Moderate / Vigorous") | `TourAtAGlance.tsx` |
| Subnav active pill → underline 2px brand color | `TourTabsNav.tsx` |
| Subnav 양쪽 fade + IntersectionObserver entries 정렬 (top-most 선택) | 동일 |

**완료 기준:** Lighthouse 첫 fold 정보 가시성 +30%, 사용자가 "어느 section 이 active 인지" mental model 명확.

---

### Sprint 4 — Hero / Gallery 안전한 개선 (2주, QA 집중)

목표: Hero/Gallery 첫인상 개선, **단 컨버전 흐름은 건드리지 않음**.

| 작업 | 처리 |
|---|---|
| Hero autoplay 6.5s → OFF, dot 인디케이터 + swipe만 | 즉시 |
| Hero `max-h-[360px]` → `max-h-[420px]` (데스크탑만), 모바일 유지 | QA 후 |
| Hero `rounded-b-2xl` 제거, edge-to-edge | 즉시 |
| Hero `shadow-hero` 제거 | 즉시 |
| Hero pill 그라데이션 + ring + shadow 3중 → flat chip | 즉시 |
| Save heart active state: rose-500 → brand red 통일 | 즉시 |
| Hero overlay (location + ★) — 다국어 QA 후 결정 | 보류 |
| Gallery cream gutter `#e8e2d9` → `#ffffff`, gap 4 → 2 | 즉시 |
| Gallery 썸네일 strip 제거 (collage 와 중복) | 즉시 |
| Lightbox bg `#1A2332/96` → `#000` | 즉시 |
| Lightbox 좌우 nav arrow: hover bg 25% → 85% | 즉시 |
| Lightbox watermark — 정책 확인 후 제거 | 보류 |
| Recommendations 사진 위 2-layer dark gradient → 약하게 (20%) | 즉시 |
| Day flow chip 48 → 80px photo | 즉시 |
| Day flow dot connector 3×3px → arrow icon | 즉시 |
| Stop card 사진 strip → 1장 cover (16:9 풀너비) | 중간 |

**완료 기준:** Hero/gallery 시각 회귀 0, 다국어 5종 LCP 회귀 없음, 모바일 스크롤 freeze 재발 없음.

---

### Sprint 5+ — 장기 polish (보류, 분기별 검토)

- Interactive map (Mapbox/Google JS API) — 성능·비용 검토 후
- Dark mode (`prefers-color-scheme: dark`) — 분기별 우선순위 검토
- Reviews avatar fallback hash-based hue
- Loading skeleton + fade-in
- Focus ring 통일 (현재 4가지)
- Animation tempo 통일 (현재 0.18s / 0.20s / 0.24s / 0.28s / 0.30s / 0.35s / 0.40s / 0.46s / 0.58s / 0.78s)

---

## 4. 1차 플랜 vs Codex 리뷰 vs 통합 플랜 — 핵심 차이

| 영역 | Claude 1차 | Codex 리뷰 | **통합 (현재)** |
|---|---|---|---|
| **순서** | Phase 0 (토큰) → 1 (시각 13항목) → 2-3 | Phase A (CTA/drawer) → B (시스템) → C (콘텐츠) → D-F | **Sprint 1 (CTA) → 2 (토큰+색상) → 3 (콘텐츠) → 4 (Hero/Gallery)** |
| **Hero 크기** | 60vh 권장 | 60vh 반대 | **데스크탑 max 360 → 420 소폭 완화만** |
| **Radius 단계** | 3단계 (8/12/16) 기계적 | role-based 4단계 | **role-based 4단계 채택** |
| **Trust strip** | booking card 안으로 이동 | 위치 유지, 단색화 | **위치 유지, 단색화 + 반복 5회 → 2회** |
| **CTA 색** | brand primary | 찬성 | **유지** |
| **CTA + 가격 통합** | "Reserve · $X" 권장 | 찬성 (검토) | **강한 처방, sprint 1 필수** |
| **Hero overlay** | title + price + location + ★ 다 추가 | 다국어 QA 후 일부만 | **rating + location 만 시범, price/title 보류** |
| **Watermark** | 일괄 제거 | 정책 확인 후 | **lightbox 만 우선 제거, hero/gallery 정책 확인** |
| **At-A-Glance 색** | monochrome dots OR ★ OR progress | 무지개 제거 (대체안 미정) | **text pill (Easy/Moderate/Vigorous) 권장** |
| **Accordion** | 8개 → 2개 (FAQ + Practical) | FAQ + Practical만 | **동일 — 양보 X** |
| **색상 다이어트** | 17 → 3 + 상태 2 | 찬성 (accent 살리기) | **17 → 5 강제 (brand/accent/success/danger/neutral)** |
| **Type scale** | 6단계 정의 | 정의 권장 | **정의 + ESLint enforcement + PR template 가드** |
| **Interactive map** | Phase 3 권장 | Phase 3 이후 보류 | **Sprint 5+ 분기 검토** |
| **Dark mode** | Phase 3 권장 | 보류 | **Sprint 5+ 분기 검토** |
| **Scroll freeze 리스크** | 안 짚음 | 강조 | **모든 motion 추가 PR 에 명시적 체크 포함** |
| **다국어 QA** | 안 짚음 | 강조 | **CTA label / Hero overlay PR 에 5종 QA 필수** |
| **Phase 1 묶음** | 13항목 한 묶음 | 분리 권장 | **Sprint 1 = 6항목 (CTA계열만), 시각 시스템은 Sprint 2-4** |

---

## 5. 즉시 실행 Top 8 (Codex Top 7 + 1개 추가)

Codex의 Top 7 + 내가 추가하는 1개 (Reviews summary 가독성):

| # | 작업 | 리스크 | 임팩트 |
|---|---|---|---|
| 1 | `TourStickyBookingBar` drawer animation 0.78s → 0.30s | 거의 0 | 모바일 체감 큼 |
| 2 | Desktop + Mobile CTA `bg-foreground → bg-primary` | 낮음 | 브랜드성 +1단계 |
| 3 | CTA label 에 total price 통합 (다국어 QA) | 중간 | 의사결정 마찰 ↓ |
| 4 | Trust strip 3색 → emerald monochrome | 낮음 | 노이즈 ↓ |
| 5 | Subnav active pill → underline 2px brand | 낮음 | sticky 영역 가벼움 |
| 6 | At-A-Glance 6색 → text pill (Easy/Moderate/Vigorous) | 낮음 | 정보 명확성 ↑ |
| 7 | Included / Fit / Support accordion 부분 기본 노출 | 중간 | first-fold 정보량 +60% |
| 8 | **(추가)** Reviews summary 3% gradient → solid pale bg + verified badge 강화 | 낮음 | 사회적 증거 +1단계 |

**8번 추가 이유:** Reviews 는 컨버전 직전 마지막 신뢰 신호. 현재 summary card 의 그라데이션은 3% opacity 라 **사실상 안 보임** (있으나마나한 디테일). Verified 표시는 10px 회색으로 **신뢰 신호의 가장 약한 표현**. 이 둘은 컨버전 directly 영향, sprint 1 에 포함할 만한 가치.

---

## 6. Codex가 안 짚은 가드레일 (내가 추가)

### 6.1 토큰 enforcement 메커니즘

토큰 정의해도 안 쓰면 dead. 가드:

```
1. ESLint rule (custom): className 에 `text-\[\d+px\]` 매칭 시 warn
2. ESLint rule: className 에 `bg-\[#[0-9a-f]+\]` 매칭 시 warn (인라인 hex)
3. ESLint rule: style={{ background: ... }} 인라인 색상 warn
4. PR template: "신규 색·radius·shadow·font-size 추가됨? 토큰 사용?" 체크박스
5. design tokens 단일 파일: tour-product-v2-scope.css 가 single source of truth
```

### 6.2 Feature flag per section (선택적)

Sprint 2 의 11개 PR 을 한 번에 머지하지 않고 환경변수로 켜고 끄기:

```
TOUR_DETAIL_V3_HERO=on
TOUR_DETAIL_V3_PICKUP=on
TOUR_DETAIL_V3_INCLUDED=off
...
```

→ 어떤 섹션이 컨버전에 영향을 주는지 분리 측정. 문제 발견 시 섹션 단위 즉시 롤백.

### 6.3 다국어 LCP 회귀 측정

특히 Hero overlay / CTA label 변경 PR 은:

```
- 5종 언어 (ko, en, ja, zh, es) LCP 측정
- 가장 긴 텍스트 케이스 시뮬레이션 (독일어가 없지만, 일본어 + 중문 한자 폭)
- text-balance + line-clamp 가 의도대로 작동하는지 시각 회귀
```

### 6.4 Animation tempo 통일 (Sprint 5+)

현재 페이지 transition duration 10가지 (0.18, 0.20, 0.24, 0.28, 0.30, 0.35, 0.40, 0.46, 0.58, 0.78s). Sprint 5+ 에 4-step scale 로 정리:

```
quick:    150ms   (hover, active)
default:  240ms   (toggle, accordion)
deliberate: 360ms (drawer, modal)
slow:     520ms   (hero crossfade, lightbox)
```

---

## 7. 한 줄 결론

**Codex의 안전 우선 순서는 채택한다. 디자인 시스템 통일의 강도는 양보하지 않는다.**

- 1차 플랜의 **진단(diagnosis)** 은 그대로.
- 1차 플랜의 **순서(sequence)** 는 Codex의 conversion-first 로 교체.
- 1차 플랜의 **Hero 60vh, 8/12/16 radius, trust strip 제거** 는 철회.
- 색상 다이어트, accordion 다이어트, CTA 다이어트는 **양보 X**.
- 모든 변경 PR 에 다국어 QA + 컨버전 회귀 측정 + 스크롤 freeze 체크 가드 추가.

가장 좋은 첫 PR (Sprint 1):

```
title: feat(tour-product): conversion-safe booking improvements

scope:
- drawer animation 0.78s → 0.30s
- desktop + mobile CTA bg-foreground → bg-primary
- CTA label에 total price 통합 (5종 다국어 QA)
- booking card pricing-tier 본문 중복 제거
- free cancellation 반복 5회 → 2회
- drawer drag handle + swipe-down dismiss

risk: 낮음 — 시각 시스템 변경 없음, 컨버전 흐름 측정 가능
```

이 PR 머지 + 1주 모니터링 후 Sprint 2 (토큰 + 색상 다이어트) 진입.

---

## 부록: 의사결정 매트릭스

각 항목의 "내가 더 강하게" vs "Codex 가 옳음" 정리:

| 항목 | Codex 우세 | 내가 우세 | 동률 |
|---|---|---|---|
| Phase 1 묶음 분리 | O | | |
| Hero 60vh 보류 | O | | |
| Radius role-based scale | O | | |
| Trust strip 위치 유지 | O | | |
| Scroll freeze 리스크 강조 | O | | |
| 다국어 QA 가드 | O | | |
| Watermark 정책 검토 | O | | |
| 색상 다이어트 강도 | | O | |
| Type scale enforcement | | O | |
| CTA + 가격 통합 강도 | | O | |
| Accordion 2개 축소 강도 | | O | |
| At-A-Glance 대체안 (text pill) | | O | |
| Reviews summary 가독성 추가 | | O | |
| Booking pricing tier 중복 제거 | | | O |
| Drawer animation 단축 | | | O |
| 토큰 정의 자체 | | | O |

총평: Codex 7 / Claude 6 / 동률 3 → 둘 다 비슷한 비중. 좋은 페어 리뷰.
