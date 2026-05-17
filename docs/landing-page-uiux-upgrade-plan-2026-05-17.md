# 랜딩 페이지 UI/UX 마스터 업그레이드 플랜

작성일: 2026-05-17
대상: AtoC Korea 메인 랜딩 `/`
관련 코드:
- `components/home/v2/HomeV2Page.tsx`
- `components/home/v2/sections/hero-section.tsx`
- `components/home/v2/sections/best-match-preview.tsx`
- `components/home/v2/sections/destinations-showcase.tsx`
- `components/home/v2/sections/featured-products-showcase.tsx`
- `components/home/v2/sections/choose-travel-style.tsx`
- `components/home/v2/DeferredBestMatchPreview.tsx`
- `components/home/v2/StickyHomeCta.tsx`
- `components/home/v2/HomeV2MatchProvider.tsx`

입력 자료:
- `docs/landing-page-uiux-audit-2026-05-16.md` (Codex 1차 audit)
- 시니어 UI/UX 비평 + 코드 실사 검증
- 사용자 누적 피드백 (premium > 절제, amber eyebrow 유지, Process 다크 유지)

이 문서가 표준이며, 위 audit은 입력 자료로만 참조한다.

---

## 0. 한 줄 결론

> **랜딩의 진짜 문제는 "기능 부족"이 아니라 "약속과 증명의 시차"다.** 매처 카드는 약속만 하고, 증명(결과·상품·이유)은 빈 영역과 분기 카드 뒤로 밀려 있다. 카피·디자인 리뉴얼이 아니라 **순서 + 빈 상태 + CTA 계층** 세 가지만 잡으면 동일 자산으로 전환 폭 가장 크게 회복된다.

---

## 1. 현재 사이트의 정확한 스냅샷

Codex audit이 부정확하게 묘사한 부분을 보정.

### 1.1 히어로는 이미 정교하다

`components/home/v2/sections/hero-section.tsx` 기준:

- 스크롤 패럴럭스 + 다크닝 핸드오프 (photoY · darkenOpacity · headlineY · headlineOpacity)
- Ken Burns 자동 줌 (20s ease-in-out alternate)
- 시즌 칩 (월 기반 자동 회전)
- H1 + 서브카피 + radial-gradient 배경 패널
- Trust 3-stat 행 (`4.9★ · 100K+ bookings · 8 platforms · Klook · GetYourGuide · Viator`)
- 매처 eyebrow + 매처 헤드라인 + 매처 서브라인 (카드 위)
- 매처 카드: destination 라디오그룹 · expandable intent textarea · style chips · primary CTA + 보조 microcopy
- `prefers-reduced-motion` 대응 완비

→ "사진 + 감성 카피" 묘사는 부정확. 실제로는 **이미 매처가 카드 위 헤더로 안내되고 있고, 모바일 44vh / 데스크톱 64-72vh로 사진 비중도 절제됨.**

### 1.2 BestMatchPreview는 idle에서 null 리턴

`components/home/v2/DeferredBestMatchPreview.tsx:17` — `phase === "idle"`일 때 `null`. 입력 전에는 **빈 상태가 아니라 영역 자체가 존재하지 않음**. Codex audit이 말한 "기대 효과 부족"보다 한 단계 강한 결함.

또한 `dynamic(import, { ssr: false })`로 의도된 LCP 최적화 — idle preview를 박는다면 이 트레이드오프를 명시적으로 수용하는 결정.

### 1.3 섹션 순서

`components/home/v2/HomeV2Page.tsx:25-33`:

```
Hero → DeferredBestMatchPreview → Destinations → Style → Featured → Why → Process → FinalCTA
```

문제: 약속(매처) 직후 **실제 상품(Featured)** 이 아닌 **분기 카드(Destinations·Style)** 가 먼저 옴. 모멘텀 손실.

### 1.4 Trust 행에 이미 OTA 명기

`hero-section.tsx:256` — `Klook · GetYourGuide · Viator` 텍스트 명기됨. Codex audit이 라벨 자연어화 권고하면서 이 자산을 버릴 위험 있음.

### 1.5 CTA 중첩 현실

- 히어로 매처 CTA (primary, amber gradient)
- Destinations 카드 (전체 클릭)
- Style 카드 (전체 클릭)
- Featured 카드 (전체 클릭)
- Why 섹션 보조 CTA
- FinalCTA primary
- **StickyHomeCta** — 첫 화면부터 노출되어 매처 CTA와 시각 경쟁

---

## 2. 핵심 문제 진단

### P0-A. 약속-증명 시차

매처 헤드라인은 "30초 안에 맞는 투어가 뜬다"고 약속하지만:
- 입력 전에는 결과 영역이 **물리적으로 존재하지 않음**
- 실제 상품 카드(Featured)는 4번째 섹션
- 그 사이에 지역 분기 + 스타일 분기 = 2단계 의사결정 지연

→ 사용자는 약속 직후 "어떻게 생긴 결과를 받게 되나?"를 알 수 없음.

### P0-B. 포지셔닝 두 갈래

- "직접 선별" (에디토리얼 큐레이션)
- "AI 매칭" (입력 기반 시스템 추천)

두 메시지가 다 좋은데 첫 화면에서 어느 쪽이 주역인지 불분명. 매처 eyebrow + matcherHeadline + matcherSubline이 H1 직후에 또 한 번 같은 약속을 반복 — **메시지 중복**.

### P0-C. CTA 계층 분산

primary 무게 surface가 동시에 6-7개. 사용자 첫 클릭 분산. 특히 StickyHomeCta가 히어로 CTA와 함께 노출되는 것은 명백한 시각 경쟁.

### P1-A. 매처 결과가 새 섹션으로 점프

현재: 입력 → 페이지 스크롤이 BestMatchPreview 영역으로 이동. 매처 카드는 위에 남고 사용자 포커스는 아래로 점프.
→ "한 카드 안에서 결과를 본다"는 강한 제품 서사가 깨짐.

### P1-B. 시즌 칩이 표시 전용

이미 월 기반 자동 회전. 인터랙티브 진입점으로 못 쓰고 있음. 입력 카드 진입 마찰을 줄일 가장 자연스러운 한 클릭이 비활성화 상태.

### P1-C. 모션 정체성 단절

히어로는 cinematic (parallax + Ken Burns + scroll darken). Destinations / Featured / Style은 그 DNA를 안 이어받음 → 사이트가 "프리미엄 도구"와 "범용 OTA 카드"로 둘로 갈림.

### P2-A. Trust 신호 밀도

`4.9 · 100K+ · 8 platforms · Klook · GetYourGuide · Viator` — 텍스트로만 표기. 같은 공간에서 OTA 로고 회색조로 보여주면 신호 밀도 ↑, 읽기 부담 ↓.

### P2-B. 계측 공백

문서는 "전환률 상승"을 성공 기준으로 두면서 정작 현재 히어로 CTA 클릭률 · intent focus rate · sticky vs hero CTA 분배 측정이 없음. 카피·순서 변경을 측정 없이 진행하면 회귀 발견 못 함.

---

## 3. 처방 매트릭스 — 적용/보류/거부

### Apply Now (즉시)

| 항목 | 이유 | 추정 LOC |
|---|---|---|
| **Featured ↔ Destinations 순서 swap** | 약속 → 실제 상품 모멘텀 회복 | 2줄 |
| **DeferredBestMatchPreview idle 빈 상태 채우기** | null → 실제 Featured 1장 preview. 약속-증명 시차 해소 | ~40줄 |
| **StickyHomeCta 게이팅** | IntersectionObserver — 히어로 통과 후 활성 | ~15줄 |
| **eyebrow/matcher 헤더 슬림화** | H1과 의미 중복 제거 | ~10줄 |
| **시즌 칩 인터랙티브화** | 클릭 시 intent에 시즌 키워드 주입 — 입력 진입 한 클릭 | ~20줄 |
| **계측 4종 이벤트 박기** | 카피 변경 전 baseline | ~30줄 |

### Apply with Caveat (조건부)

| 항목 | 조건 |
|---|---|
| Trust 라벨 한글화 | 플랫폼명 (Klook/GYG/Viator) 반드시 유지. 라벨만 한글 |
| 매처 결과를 같은 카드 내 변형 | A/B 권장. 위험·보상 큼 |
| H1 카피 변경 | 현재 시적 카피 유지하고 기능형 변형은 A/B로만 측정 |
| OTA 로고 회색조 strip | 라이선스/사용 조건 확인 |

### Reject (적용 안 함)

| 항목 | 이유 |
|---|---|
| "매처 카드를 첫 화면 안으로 압축" | 현재 44vh도 모바일에서 빠듯하지 과한 게 아님. 측정 없이 자르지 말 것 |
| "추천 예시" 가짜 카피 ("제주 동부 자연 코스") | 실제 Featured 상품으로 대체하면 가짜 자산 안 만들어도 됨 |
| H1을 기능 설명형으로 일괄 교체 | 브랜드 보이스 손실. 현재 H1 + 서브카피 조합이 이미 시 + 약속 |
| amber eyebrow 뮤트, Process 다크 라이트화 | 사용자 명시 피드백 (premium 우선) |
| 새 배경 비디오 / 라이브러리 / 캐러셀 | 성능 비용 큼 |
| 카드 안에 카드 중첩 | 시각 잡음 |

---

## 4. Phase별 실행 계획

### Phase 0 — 계측 baseline (0.5일)

목표: 카피·순서 변경 **전에** 현재 funnel 측정.

이벤트:
1. `home_hero_cta_click` — 매처 primary CTA 클릭
2. `home_hero_intent_focus` — intent textarea 첫 포커스
3. `home_hero_style_chip_click` — 스타일 칩 클릭 (chip id 함께)
4. `home_sticky_cta_click` (vs hero_cta_click 분배 측정)
5. `home_match_preview_visible` — 결과 영역 노출
6. `home_featured_card_click` (source: idle_preview | regular)
7. `home_destination_card_click`

위치: `src/design/analytics.ts`에 추가 (기존 `analytics.homeCtaClick` 패턴 따라가기).

검증: 1일 데이터 수집 후 baseline 기록 → 이후 Phase별 변화율 비교.

### Phase 1 — 순서 + 빈 상태 + Sticky 게이팅 (1-2일)

가장 ROI 높은 3건. 백엔드 무변경.

#### 1.1 섹션 순서 swap

`components/home/v2/HomeV2Page.tsx:25-33`:

```tsx
<HeroSection />
<DeferredBestMatchPreview />
<FeaturedProductsShowcase />   // ↑ Destinations 앞으로
<DestinationsShowcase />        // ↓ Featured 뒤로
<ChooseTravelStyle />
<WhyAtockorea />
<ProcessOperational />
<FinalCTA />
```

#### 1.2 DeferredBestMatchPreview idle preview

`components/home/v2/DeferredBestMatchPreview.tsx`:

- idle 상태일 때 null 반환 대신, **정적 import**된 슬림 preview 컴포넌트 렌더링
- 내용: Featured 상품 1개를 "이런 식으로 추천돼요" 라벨과 함께 표시
  - 실제 상품 이미지 (next/image, priority 안 줌)
  - 실제 슬러그 링크
  - "왜 추천?" reason chips 1-2개 (정적 카피)
- 데이터: `lib/home/featured-join-tour-offer.ts:getFeaturedJoinTourProduct()` 재사용
- 라벨: "추천 예시" (locale: `premium.v2.bestMatch.idlePreviewLabel`)

비용: idle preview는 위로 올라가지 않게 — 히어로 직하지만 LCP 측정 대상 아님. dynamic 유지 + `loading="lazy"` 이미지로 LCP 회귀 차단.

#### 1.3 StickyHomeCta 게이팅

`components/home/v2/StickyHomeCta.tsx`:

- IntersectionObserver로 hero 패널 (`data-home-hero`) 추적
- hero가 viewport에서 50% 이상 벗어났을 때만 활성
- `prefers-reduced-motion` 대응 fade-in 200ms

검증:
- 데스크톱 1440px / 모바일 390px에서 히어로 단계에서 Sticky 미노출
- 스크롤 후 정상 노출
- 매처 CTA 클릭 vs Sticky 클릭 분배 측정 (Phase 0 이벤트로)

### Phase 2 — 카피 슬림화 + 시즌 칩 인터랙티브 (1일)

#### 2.1 매처 헤더 블록 슬림화

`hero-section.tsx:266-275`에 있는 eyebrow + matcherHeadline + matcherSubline 3단을 **eyebrow 1단으로 축소**.

이유: H1 ("당신의 한국 하루, 직접 선별.") + 서브카피 ("스타일만 알려주세요 - 맞는 투어가 30초 안에 떠요.")가 이미 약속을 완결시킴. 카드 위에 또 한 번 헤드라인을 박는 건 중복.

변경 후:
```tsx
<div className="mx-auto mb-4 max-w-lg px-1 text-center md:mb-5">
  <span className="text-eyebrow">{t("premium.v2.hero.matcherEyebrow")}</span>
</div>
```

→ 카드 자체로 행동이 바로 이어짐. eyebrow는 "Smart Match" 같은 짧은 라벨로 유지 (amber 톤 유지 — 사용자 피드백 반영).

#### 2.2 Trust 행 한글 라벨화 + 플랫폼명 유지

`hero-section.tsx:240-258`:

```
[4.9★ avg. rating] → [4.9★ 평균 평점]
[100K+ bookings] → [100K+ 누적 예약]
[8 platforms · Klook · GetYourGuide · Viator] → [8개 플랫폼 운영 · Klook · GetYourGuide · Viator]
```

플랫폼명은 **무조건 유지**. 영문→한글은 라벨만.

(국제화 키 사용 중이면 i18n 리소스에서 처리. 영어 locale에서는 영문 라벨 그대로 유지.)

#### 2.3 시즌 칩 인터랙티브화

`hero-section.tsx:188-197` 시즌 칩에 onClick 추가:
- 클릭 시 intent textarea에 시즌 phrase 주입 (`appendIntentPhraseToIntentField` 재사용)
- 칩이 button으로 변환, aria-label 추가
- 시즌별 phrase 매핑 (i18n):
  - spring → "벚꽃 시즌 분위기로"
  - summer → "여름 시원한 해안 코스로"
  - autumn → "단풍 시즌 분위기로"
  - winter → "겨울 야경 · 실내 위주로"

이유: 입력 카드 진입 마찰 가장 크게 줄임. 자동 카피 1줄로 사용자가 "입력 시작" 한 클릭.

### Phase 3 — In-place 매처 결과 변형 (3-5일, A/B)

야심 큰 변경. 코드 위험도 중. 보상 큼.

목표: CTA 클릭 후 페이지 점프 대신 매처 카드 자체가 **결과 카드로 morphing**.

구현 방향:
- 매처 카드 컨테이너에 framer-motion `LayoutGroup` + `motion.div layout`
- phase가 `loading`이 되면 카드 내부가 스켈레톤으로 교체 (높이 자연 변형)
- phase가 `success`가 되면 결과 (이미지 + 타이틀 + reason chips + secondary CTA "전체 보기")로 in-place 교체
- 기존 `BestMatchPreview` 섹션은 "여러 후보 비교" 영역으로 역할 분리 (선택적)

검증:
- 모바일에서 카드 높이 변화가 시각적으로 자연스러운가
- A/B 테스트 (in-place vs 기존 점프) — 매처 완료율 측정
- LCP 영향 없음 확인

이 변경은 **다른 모든 Phase가 안정화된 뒤** 진행. Phase 0-2가 baseline 측정 + 가시 효과 큰 변경을 끝낸 상태에서 Phase 3을 분리 측정.

### Phase 4 — 모션 DNA 통일 (2-3일)

목표: 히어로의 cinematic 톤이 아래 섹션으로 끊기지 않게.

작업:
- 공통 `useScrollReveal` 훅 (또는 framer-motion variant) 만들어 Destinations / Featured / Style / Why / Process 진입 시 동일 stagger 적용
- `prefers-reduced-motion` 무조건 대응
- 새 라이브러리 도입 금지 — framer-motion 이미 있음

피해야 할 것:
- 회전·튀어오름·과한 scale — premium 톤 깨짐
- 진입 시 1초 이상 지연 — 인지 부담

### Phase 5 — Trust strip OTA 로고화 (1-2일, 조건부)

라이선스/사용 조건 확인 후 진행.

`hero-section.tsx:240-258`의 텍스트 plaftorm 행을 **회색조 OTA 로고 4-6개** 가로 배치로 교체.

- 로고 SVG는 brand assets에서 받음
- 모두 동일 회색조 (`#9ca3af` 톤)로 처리 (브랜드 충돌 방지)
- 모바일은 2줄 또는 슬라이드
- alt 텍스트 명기

라이선스 확인 안 되면 Phase 5 스킵, 텍스트 유지.

---

## 5. 컴포넌트별 변경 요약

### HeroSection (`components/home/v2/sections/hero-section.tsx`)

- [ ] 시즌 칩 → 인터랙티브 button (Phase 2)
- [ ] eyebrow + matcherHeadline + matcherSubline 3단 → eyebrow 1단 (Phase 2)
- [ ] Trust 행 라벨 한글화 (플랫폼명 유지) (Phase 2)
- [ ] 매처 카드 자체에 LayoutGroup wrap — in-place result morphing 준비 (Phase 3)
- [ ] H1 카피 A/B variant locale 추가 (Phase 2 → 4)
- 유지: 패럴럭스, Ken Burns, scroll darken, 사진 비중, 모션 토큰

### DeferredBestMatchPreview (`components/home/v2/DeferredBestMatchPreview.tsx`)

- [ ] idle 분기에서 null → 슬림 idle preview 컴포넌트 (Phase 1)
- [ ] dynamic import 유지, idle preview는 정적 import로 분리
- [ ] LCP 회귀 없음 측정

### BestMatchPreview (`components/home/v2/sections/best-match-preview.tsx`)

- [ ] reason chips 1줄 UI 추가 (현재 매칭 엔진 데이터 활용)
- [ ] Phase 3에서 "비교용 multi-card" 역할로 재정의 검토

### HomeV2Page (`components/home/v2/HomeV2Page.tsx`)

- [ ] 섹션 순서 swap: Featured ↔ Destinations (Phase 1)

### StickyHomeCta (`components/home/v2/StickyHomeCta.tsx`)

- [ ] IntersectionObserver로 hero 통과 게이팅 (Phase 1)
- [ ] fade-in transition + reduced-motion 대응
- [ ] 모바일에서 매처 CTA 위치와 안 겹치게 확인

### Destinations / Featured / Style 섹션

- [ ] 진입 stagger 모션 통일 (Phase 4)
- [ ] 외 변경 없음 — 카드 UI 자체는 유지

### `src/design/analytics.ts`

- [ ] 신규 이벤트 7종 추가 (Phase 0)

---

## 6. 카피 가이드

### 원칙

1. **H1은 브랜드 시. 약속은 서브카피.**
   - H1은 줄여서 외울 수 있는 문장.
   - 서브카피는 "무엇을 줄여주는지" 명시.
2. **CTA는 동사로 끝낸다.**
3. **Trust 라벨은 숫자 + 한국어 명사 + 플랫폼명 살리기.**
4. **eyebrow는 짧고 amber 톤 유지.**

### 현재 H1 유지 (권장)

```
당신의 한국 하루, 직접 선별.
스타일만 알려주세요 - 맞는 투어가 30초 안에 떠요.
```

### A/B 후보 (Phase 2 측정용)

```
A: 당신의 한국 하루, 직접 선별. / 스타일만 알려주세요 - 맞는 투어가 30초 안에 떠요. [현재]
B: 한국 투어, 많이 찾지 말고 맞게 고르세요. / 여행 스타일과 도시만 알려주시면 지금 예약하기 좋은 투어부터 좁혀드립니다.
C: 한국 하루, 30초에 맞춰드립니다. / 스타일과 페이스만 알려주세요. 검증된 투어 중 가장 맞는 것부터 보여드립니다.
```

운영 기준: baseline 대비 매처 완료율 +10% 이상에서만 채택.

### eyebrow

- `Smart Match` (영문 유지 권장, amber 톤)
- 또는 `맞춤 매칭` (한글 시)

### CTA

- 1차: "최적 매치 보기" / "추천 받기"
- 2차 (Sticky): "지금 매칭 시작" — 1차와 의미 살짝 다르게 두어 중복 인상 회피

### Trust 행

```
4.9★ 평균 평점
100K+ 누적 예약
8개 플랫폼 운영 · Klook · GetYourGuide · Viator
```

(영어 locale에서는 기존 영문 그대로 유지)

---

## 7. 모션 & 시각 정체성

### 유지

- 히어로 패럴럭스 + Ken Burns + scroll darken
- 시즌 칩 (interactive로 업그레이드)
- radial-gradient 헤드라인 패널
- amber eyebrow (사용자 피드백)
- Process 다크 섹션 (사용자 피드백)
- 카드 그림자/라운드/타이포 스케일
- 사진 자산 톤

### 추가

- 공통 scroll-reveal stagger (Phase 4) — Destinations / Featured / Style / Why / Process 진입 시 동일 패턴
- 매처 카드 LayoutGroup (Phase 3) — in-place 결과 morphing 준비

### 금지

- 새 배경 비디오
- 새 라이브러리 / 캐러셀 / 슬라이더
- 회전, 튀어오름 등 과한 모션
- 카드 안 카드 중첩
- 색 팔레트 대규모 변경
- 새로운 히어로 일러스트 추가
- 텍스트 가독성 해치는 사진 합성

---

## 8. 성능 가드레일

- 히어로 신규 대용량 이미지 금지 (LCP 보호)
- idle preview는 정적 import이나 priority 안 줌, `loading="lazy"`
- 첫 화면 위쪽에 클라이언트 상태/계산 추가 금지
- 매칭 결과 미리보기는 기존 데이터 (`getFeaturedJoinTourProduct`) 재사용
- 새 폰트, 새 CSS 라이브러리 도입 금지
- 애니메이션 `prefers-reduced-motion` 무조건 대응
- 추가 API 호출 없음 (Phase 1-2 범위 내)

기준 메트릭:
- LCP 변화 < +50ms
- TBT 변화 < +30ms
- CLS 변화 0

---

## 9. 접근성 가드레일

- 시즌 칩 button 변환 시 aria-label 추가
- 매처 결과 카드 morphing 시 스크린리더 announcement (aria-live)
- StickyHomeCta는 첫 활성 시 포커스 이동 없음 (사용자 흐름 방해 금지)
- 모든 신규 인터랙션 키보드 동작 (Enter / Space) 지원
- `focus-ring` 토큰 유지
- Trust 행 OTA 로고 회색조 시 contrast ratio 4.5:1 이상

---

## 10. 성공 기준

### 정량 (Phase 0 baseline 대비)

| 지표 | 목표 |
|---|---|
| `home_hero_cta_click` rate | +15% 이상 |
| `home_hero_intent_focus` rate | +20% 이상 |
| `home_match_preview_visible` rate | +25% 이상 |
| `home_featured_card_click` (idle_preview source) | 신규 측정 (전체 click의 5% 이상 흡수) |
| 모바일 스크롤 깊이 (>= Featured 도달) | +10% 이상 |
| LCP | 회귀 없음 (+50ms 이내) |

### 정성

- 첫 화면만 보고 "스타일 입력 → 추천 받는 서비스"라는 인지가 즉시 성립
- 첫 클릭에서 망설임 없음 (히트맵으로 확인)
- 사진/신뢰/상품/매칭이 따로 놀지 않고 한 흐름으로 읽힘
- 브랜드 premium 톤 유지 — 절제 audit에 끌려가서 평탄해지지 않음

---

## 11. 안 할 일 / 안티패턴

- 전체 디자인 시스템 교체
- 컬러 팔레트 대규모 변경
- 매칭 로직 변경
- 새 DB 스키마 도입
- 새 외부 UI 라이브러리 도입
- 랜딩을 설명형 긴 페이지로 변환
- 인기 상품 카드 UI 자체를 갈아엎기
- amber eyebrow 뮤트
- Process 다크 섹션 라이트화
- 시 H1을 기능 설명서 H1으로 일괄 교체
- 측정 없이 카피만 바꾸기
- "추천 예시"용 가짜 상품 카드 만들기 (실제 Featured 재사용)

---

## 12. 실행 우선순위 (요약)

```
Day 0    Phase 0  계측 baseline (4-7개 이벤트 박기)
Day 1    Phase 1  Featured↔Destinations swap + idle preview + Sticky 게이팅
Day 2    Phase 2  eyebrow 슬림화 + Trust 한글화 + 시즌 칩 인터랙티브
Day 3-5  Phase 3  in-place 매처 결과 morphing (A/B)
Day 6-7  Phase 4  scroll-reveal 모션 DNA 통일
Day 8-9  Phase 5  Trust strip OTA 로고화 (라이선스 확인 후)
```

각 Phase 종료 후 Phase 0 이벤트 데이터 1-2일 확인 후 다음 Phase 진행. 회귀 발견 시 직전 Phase 롤백.

---

## 13. 이 문서의 결정 사항

- 원본 Codex audit (`docs/landing-page-uiux-audit-2026-05-16.md`)은 입력 자료로 보존, 실행 기준 아님.
- 이 문서가 표준 마스터 플랜.
- 변경/롤백/추가 결정은 이 문서를 업데이트하며 진행.
- Phase 0 계측 이벤트 정의는 별도 PR로 분리.

다음 액션: Phase 0 계측 이벤트 추가 PR 시작.
