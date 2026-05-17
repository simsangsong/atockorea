# 투어 상세 페이지 UI/UX Audit

> **세계 최고 수준 기준 (Apple HIG / Klook / Airbnb / Booking.com) 으로 전면 평가**
>
> 작성일: 2026-05-17
> 대상: `app/tour-product/[slug]/page.tsx` → `TourProductDetailClient`
> 범위: 순수 UI/UX 디자인 관점 (콘텐츠/기능/성능 제외)

---

## 0. Executive Verdict — 한 줄 요약

> **"잘 만든 14개 섹션 컴포넌트가 한 페이지에 따로따로 살고 있다."**
>
> 각각은 정성껏 다듬어졌지만, **하나의 디자인 시스템으로 합의된 적이 없는** 14개의 작은 모놀리식 디자인.
> Apple / Klook / Airbnb 수준의 결정적 차이는 "디테일"이 아니라 **연속성(continuity)** 이다.

---

## 1. 7대 systemic 결함 (page-level)

### 1.1 색채 시스템 붕괴 — 가장 치명적

한 페이지에서 **17개 이상의 색군**이 등장합니다:

| 섹션 | 주조색 |
|---|---|
| Hero / Title | Rose (rose-400~600) |
| Trust strip | Emerald + Amber + Primary blue |
| At-A-Glance | 6색 로테이션 (emerald / amber / orange / rose / violet / sky) |
| Atmosphere | Cream gutter (#e8e2d9) + dark slate |
| DayFlow | Pure slate / white |
| Pickup | Copper gradient (#c8956c) |
| Drop-off | Dark navy gradient (#111d31) |
| Included | Emerald-50 + Rose-50 split |
| Fit | Amber / Copper (#fdf8f2) |
| Weather | Amber + Sky cards in cream |
| Seasonal | 4계절 4색 그라데이션 (rose / amber / orange / sky) |
| Booking Trust | 5색 그라데이션 카드 |
| Support Steps | 6색 단계 테마 |
| Reviews | Amber stars + slate |
| Recommendations | Dark slate overlay |
| FAQ | White + primary blue |
| Sticky CTA | Foreground black |

**Apple / Airbnb의 룰:** 한 페이지 = **1개 brand color + 1개 accent + neutral**.
의미 색상(success green, warning amber, danger red)은 **상태 표시에만**.

**현재 페이지:** 의미 색상을 **장식**으로 쓰고 있음 → 모든 칩이 "중요하다"고 외치니 위계가 사라짐.

**진단:** `components/product-tour-static/east-signature-nature-core/tour-product-v2-scope.css:5-25` 에 `--primary`, `--accent` 토큰이 정의되어 있지만, **거의 모든 섹션이 토큰을 우회하고 인라인 색상**(`#c8956c`, `#fdf4e8`, `rgba(200,149,108,0.07)` 등)을 직접 박음.

---

### 1.2 Typographic scale가 없음 — 17단계의 거짓 정밀함

본문 폰트 사이즈만 추적해보면:

```
10px, 10.5px, 11px, 11.5px, 12px, 12.5px, 13px, 13.5px,
14px(sm), 15px, 16px, 17px, 18px(lg), 19px, 20px, 22px, 24px
```

→ **0.5px 단위 미세 조정 17단계.** 시각적으로 **구분 불가능**한 단계가 절반 이상. 디자이너가 매 컴포넌트마다 "이건 좀 작게"를 즉흥 결정한 흔적.

**Letter-spacing 도 동일:**

```
-0.018em, -0.016em, -0.015em, -0.012em, -0.01em, -0.008em, -0.005em, 0,
0.005em, 0.01em, 0.02em, 0.04em, 0.07em, 0.08em, 0.10em, 0.11em, 0.12em,
0.14em, 0.16em, 0.18em
```

→ **20단계.**

**Apple HIG:** 5~7 type 단계 (Title 1, Title 2, Title 3, Body, Caption 1, Caption 2). 그게 끝.
**Airbnb:** 6단계 (Display, Heading, Title, Body, Small, Tiny).

**현재:** Eyebrow 하나만 봐도 4개 컴포넌트가 4가지 eyebrow 스타일.

| 위치 | spec |
|---|---|
| Recommendations | `text-[10px] / tracking-[0.16em] / text-primary/85` |
| Desktop card | `text-[10.5px] / tracking-[0.12em] / text-muted-foreground` |
| Practical | `text-[10px] / tracking-[0.14em] / text-muted-foreground` |
| Hero region | `text-[10.5px] / tracking-[0.18em]` |

---

### 1.3 Shadow 언어가 6개 — 한 페이지에

각 섹션이 자신만의 shadow를 발명:

```
Hero:           --shadow-hero (2-layer)
card-premium:   2-layer (0 1px 2px / 0 4px 12px)
DayFlow:        3-layer
TourAtAGlance:  6-layer monster (inset + halo + close + long + ambient)
Weather:        4-layer
Recommendations: 3-layer + 다른 hover
StickyCTA:      커스텀 border + -10px 36px
```

**At-A-Glance 한 카드의 shadow:** `TourAtAGlance.tsx:36-39` 에서 단순 2-layer 적용했지만, CSS에서는 `tour-product-v2-scope.css:546-560` 의 `tour-glance-card` 에 **6레이어** shadow를 정의해놓고 실제로는 안 씀 — **죽은 코드**가 디자인 의도와 구현 차이를 보여주는 증거.

**Apple / Airbnb 룰:** 한 디자인 시스템 = **2~3 elevation tokens** (e1, e2, e3). 그게 끝. 카드마다 새로 만들지 않음.

---

### 1.4 Corner radius 6단계

```
8px (sm), 12px (xl), 14px (default --radius), 16px (2xl),
20px, 24px, 26px, 28px
```

→ **8단계.**

같은 화면 안에서:

- Hero photo: `rounded-b-2xl` (16px)
- At-A-Glance card: `rounded-[26px]`
- FAQ card: `rounded-[26px]`
- Included card: `rounded-[20px]`
- Pickup card: `rounded-2xl` (16px)
- Desktop booking card: `rounded-[28px]`
- Pricing table outer: `rounded-2xl` (16px)
- Pricing table inner: `rounded-xl` (12px)
- Inline chips: `rounded-full` / `rounded-md` / `rounded-lg` 혼재

**Airbnb:** 4단계 (4px, 8px, 16px, full).
**Apple:** 3단계 (continuous corner) + iOS 시스템 corner.

---

### 1.5 Spacing rhythm 부재 — 4의 배수가 아닌 즉흥값

내부 padding 만 봐도 9가지 변종:

```
px-2.5 py-1, px-3 py-2, px-3.5 py-3.5, px-4 py-2.5, px-4 py-3,
px-4 py-4, px-5 py-3, px-5 py-4, px-5 py-5
```

세로 간격 5가지:

```
mt-3.5, mt-4, mt-5, mt-7
py-5, py-6
space-y-3, space-y-4, space-y-5, space-y-6, space-y-7
```

**Apple HIG 8-point grid / Airbnb 4-point grid:** 모든 spacing = `4×n`.
**현재:** `3.5`, `2.5` 같은 **half-step** 이 즉흥적으로 들어감 (= 14px, 10px 픽셀 단위 직접 박힘).

---

### 1.6 깊이 / elevation 위계가 무너짐

페이지의 시각적 "중요도 위계" 가 무엇이어야 하는가?

```
1순위(가장 강한 elevation): CTA + Hero
실제 강한 elevation 가진 것들:
  - At-A-Glance card (6-layer halo)
  - Weather card (4-layer)
  - Recommendations cards
  - DayFlow card
  - Timeline cards
  - ...
```

→ **모든 카드가 다 떠 있음** = 어떤 카드도 떠있지 않음. 평면 한 장.

**Klook / GetYourGuide:** Booking card는 페이지에서 유일하게 elevation level 3. 나머지 본문은 level 1 (hairline + 1px shadow).
**Airbnb:** 본문 콘텐츠는 거의 **shadow 없이** divider line으로만 분리. 떠있는 건 image rounded card 뿐.

---

### 1.7 Section orchestration 부재

`TourProductDetailClient.tsx:67-280` 의 섹션 시퀀스:

```
Hero
→ Trust strip
→ Subnav
→ At-A-Glance        (white card with halo)
→ Pricing table      (white card with table)
→ Atmosphere         (cream gutter bento)
→ Haenyeo            (button)
→ DayFlow            (white card with thumbs)
→ Timeline           (white stop cards)
→ Pickup/Dropoff     (copper + dark navy)
→ Included           (green/red split card)
→ Fit                (amber/copper card)
→ PracticalDetails   (amber weather + 4-color seasonal + accordion)
→ BookingSupport     (5-color trust + 6-color steps)
→ FAQ                (white accordion)
→ Reviews            (gradient summary + slate cards)
→ PlatformCompare
→ Recommendations    (white cards w/ dark image overlay)
```

→ **모든 섹션의 무게(elevation)와 색상이 균일하게 시끄러움.** 페이지에 **숨 쉴 곳** 이 없음. 사용자 눈은 끝까지 "다음에 뭐가 중요한지" 판단할 단서를 못 받음.

**Airbnb의 룰:** "Hero → Quick facts → Photos → Long description → Reviews". 5블록. 각 블록 사이는 단순 hairline.
**Klook의 룰:** "Hero → Inclusions → Itinerary → Reviews → FAQ → Book bar". 거의 모든 본문이 **flat white**, divider line only.

---

## 2. 섹션별 Nano Audit

### 2.1 Hero (`TourHeroSection.tsx`)

**관찰:**

- 높이: 29vh / min 214px / max 294px (모바일), 33vh / min 266px / max 360px (sm+) → 모바일에서 iPhone 14 Pro 기준 약 230px, 데스크탑에서도 360px 캡.
- 슬라이드 자동순환 6.5s + Ken Burns 9s zoom.
- 우상단 Save / Share 아이콘 버튼: `h-9 w-9` (36px) + 백드롭블러.
- 헤드라인 line1: `19px / sm:22px / lg:24px` — **24px 캡.**
- 영역 eyebrow에 `rose-400 dot + gradient line + rose-600/85 uppercase` 3중 장식 (`TourHeroSection.tsx:162-168`).

**문제:**

| # | 디테일 | Apple / Klook / Airbnb 기준 |
|---|---|---|
| 1 | **Hero가 너무 작다.** 294px 캡은 카드 썸네일급. | Airbnb hero ≈ 50-60vh, Klook 40-50vh, Apple product hero = **fold 전체**. 360px 캡은 옛 데스크탑 1024px 그리드용 사이즈. |
| 2 | **Hero에 제품명/가격/위치 오버레이 0%.** "Clean, no overlaid text" 주석이 있지만, Airbnb 마저도 location + rating은 hero 위에 올림. 현재는 첫 화면에 "이게 무슨 투어"인지 약함. | Klook: 제목 + 위치 + 가격 + ★ 모두 hero 위. Airbnb: 제목 + 위치 + ★ 위. |
| 3 | **자동 슬라이드 6.5s.** Airbnb / Klook은 hero **자동 안 돌림** — 사용자가 컨트롤. 자동 이동은 멀미 + 통제권 박탈. | 모범: dot 인디케이터 + swipe만. autoplay 0. |
| 4 | **Rose eyebrow + dot + gradient line 3중 장식.** 한 정보(지역명)에 장식 3개. | 모범: text only, 한 개 색상. |
| 5 | **Headline line2가 line1의 65% 불투명 텍스트** (`text-[#1a2332]/65`). 보조 제목이라기엔 너무 흐림. | 모범: 명도 대비는 유지하되 weight/size로만 위계 (Airbnb의 부제는 같은 #222지만 weight 400). |
| 6 | **Pills 그라데이션 + rose-300 ring + 2-layer shadow** (`TourHeroSection.tsx:185`). 한 칩에 그라데이션·링·블러·2-layer shadow. **태그 하나가 카드처럼 처리됨**. | 모범: 평탄한 chip — bg solid, 1px border, **그뿐**. |
| 7 | Meta strip의 별점 별이 amber 가 아닌 `#C8956C` (copper). | 모범: 별점 = 항상 **amber / gold**. universal signal. Copper는 brand color로만. |
| 8 | Save heart의 active 상태가 `fill-rose-500 text-rose-500`. Hero의 rose 시스템과 충돌. | 모범: heart = **brand red** (Airbnb red, Klook orange) — 변하지 않는 universal sig. |
| 9 | Hero photo는 `rounded-b-2xl` (16px 아래) 만 있고 위는 평탄. 헤더 아래에 붙어있어서 위 라운드 불필요. 다만 `shadow-hero` (2-layer) 가 그 위에 있어서 카드처럼 떠보임. 헤더에 붙어있는 hero에 shadow는 어색. | 모범: hero는 **edge-to-edge** + **shadow 0** (Airbnb). |

**점수 (UI/UX 만): 4.5 / 10**

---

### 2.2 Trust strip (`TourProductDetailClient.tsx:77-97`)

**관찰:**

- Hero 바로 아래 가로 strip — `Free cancellation · Instant confirmation · Customer support`
- 3색 아이콘 (emerald, amber, primary blue)
- `text-[11.5px] font-medium`

**문제:**

| # | 디테일 | 기준 |
|---|---|---|
| 1 | **3개 다른 색 아이콘**이 한 줄에 — 위계 없음. 다 동등하게 중요해 보이거나 다 sub-text로 묻힘. | Booking.com / Klook은 trust strip = **1색** (보통 brand green) 또는 monochrome (foreground/70). |
| 2 | **11.5px 폰트** — 모바일에서 거의 안 읽힘. | 모범: 13-14px. |
| 3 | 위치가 잘못됨. **Hero 다음 즉시** trust badge는 컨버전 압박만 주고 제품 매력이 안 들어옴. | Airbnb: trust는 **booking card 안에**만. 본문은 콘텐츠. Klook: trust badge는 **sticky CTA 옆**. |

---

### 2.3 Sub-nav (`TourTabsNav`)

**관찰:**

- Sticky `top: 3rem` (m) / `3.5rem` (md) — global header h-12/h-14 바로 아래.
- Pill 형태, active = `bg-foreground text-white`.
- Right-edge fade gradient (왼쪽 fade 없음 — `TourTabsNav.tsx:140`).
- Scroll-spy는 `rootMargin: -108px 0px -75% 0px` 으로 상단 슬라이스에 들어온 섹션 = active.

**문제:**

| # | 디테일 | 기준 |
|---|---|---|
| 1 | **왼쪽 fade가 없음.** 사용자가 가로 스크롤한 뒤에는 왼쪽이 잘려있어도 fade로 표시되지 않음 — "더 있다" 신호가 한 방향만. | Klook / iOS 표준: **양쪽 fade**, 위치에 따라 토글. |
| 2 | Active pill = **순흑 + 흰 텍스트 (foreground)**. Hero의 rose, Pickup의 copper 등과 색상 일관성 0. | Airbnb: active = **brand color underline** (밑줄 2px) — 가벼움, 자리 안 차지함. Klook: active = brand color text + underline. |
| 3 | Pill 자체가 무거움. **"리본 + 알약 + 색 채움" 3중 강조.** Sticky 영역이 본문 위에 64px+로 떠 있어 본문이 좁아짐. | 모범: **단일 underline** + bottom border 1px, 높이 44-48px. |
| 4 | IntersectionObserver 콜백: `for (entry of entries) if isIntersecting → setActiveSection(id)` — entries는 진입 순서대로 정렬 X. 빠른 스크롤 시 활성 섹션이 **마지막에 들어온** id로 결정될 수 있음 (top-most가 아닐 수 있음). | 모범: entries 중 `boundingClientRect.top` 이 가장 작은 양수인 것 선택. |
| 5 | Active state가 **인스턴트** — `bg-foreground` 변경은 transition 안 됨 (Tailwind는 bg-color transition만, opacity 없음). 결과: 점프. | 색상 + 위치 둘 다 부드럽게. |

---

### 2.4 At-A-Glance (`TourAtAGlance.tsx`)

**관찰:**

- 항목 = `label + 5단계 진척 도트` OR `label + value 문자열`
- 6색 (`emerald / amber / orange / rose / violet / sky`) 로테이션
- 도트: 6px × 6px, gap 1 (4px) — 5개 도트 = ~46px 너비
- Row gap: `py-2.5` (10px)
- Card radius: 26px (페이지에서 가장 큰 코너)

**문제:**

| # | 디테일 | 기준 |
|---|---|---|
| 1 | **6색 로테이션 = 무의미한 무지개.** "Walking intensity" 항목이 emerald(=좋다)인 이유는 단지 idx 0이기 때문. 색상이 정보를 **거짓 신호**로 전달. | Apple: 정보 색은 **의미 있을 때만**. 정도 표시는 **단색 + 단순 fill**. |
| 2 | **6px 도트 × 5개 = 시각적으로 점수 차이 인식 어려움.** 4/5와 5/5가 거의 같아 보임. | 모범: progress bar (TripAdvisor / Yelp 스타일) OR ★ 5개 system OR pill chips (Easy/Moderate/Hard). 5단계 도트는 **정밀하지만 못 읽음**. |
| 3 | Numeric value 항목 (`text-[12px] tracking-[0.02em] text-slate-500`)은 12px 회색 + tracking — 데이터인데 데이터처럼 안 보임. | 모범: tabular-nums + 14-15px + foreground. 데이터는 **선명히**. |
| 4 | Card radius 26px 인데 row dividers는 `divide-slate-100` (얇은 회색 선) — 라운드 코너와 직선 divider는 충돌. | 모범: radius 16px 또는 divider 0 + 항목 자체 background로 분리. |
| 5 | Section heading "At a glance" 가 17px / `tracking-[-0.02em]` — 다른 섹션은 18px (`text-lg`). **단독으로 다른 사이즈.** | 모범: 모든 section heading 동일. |
| 6 | `tour-glance-card` (6-layer shadow + sheen + halo) 가 **정의되어 있지만 컴포넌트에서 안 쓰임**. 즉 디자인 의도 (premium glass card) ≠ 실제 구현. | 코드와 디자인 일치. |

---

### 2.5 Pricing table (`TourProductDetailClient.tsx:108-156`)

**관찰:**

- HTML `<table>` — Group size × Duration prices.
- 라벨: "Per X" eyebrow (top-right), "Tap Check Availability to..." (bottom).

**문제:**

| # | 디테일 | 기준 |
|---|---|---|
| 1 | **본문에 가격표가 따로 있고**, Desktop booking card 내부에도 똑같은 가격표가 있고, 모바일 sticky drawer는 매트릭스가 없음 — **3가지 다른 UI.** | 모범: 가격표 = **booking module 안에만**. 본문은 "from $X" 만. |
| 2 | Table styling: heading row = `bg-slate-100/70 text-[10.5px] uppercase tracking-wide` — 10.5px uppercase 가격 헤더는 작아서 못 읽음. | 모범: 12-13px 정상 케이스, 또는 cell padding으로 호흡. |
| 3 | Selected tier highlight = `bg-amber-50/70`. Amber 는 **이 화면에서 Fit/Weather/Seasonal에서 사용 중**. 또 다른 의미("선택됨")로 재사용 = noise. | 모범: 선택 = **primary brand color**. |
| 4 | "Tap Check Availability to pick..." footer copy는 데스크탑에서도 표시되는데, 우측 rail에 이미 calendar inline이 있으면 의미 없음. | 모범: 디바이스별 다른 copy or 제거. |

---

### 2.6 Gallery — Atmosphere Bento

**관찰:**

- 3×3 grid에 5장 배치 (1번 사진 2×2, 3번 1×2, 나머지 1×1)
- `aspect-ratio: 4/3` — 위 컨테이너 고정
- `bg-[#e8e2d9]` cream gutter + `p-1.5` (6px) padding + `gap: 4px`
- 썸네일 strip (84px 너비) — collage 바로 아래
- Lightbox: framer-motion w/ 0.46-0.58s ease, drag-to-dismiss, dots at bottom (~40×28 thumbnails)

**문제:**

| # | 디테일 | 기준 |
|---|---|---|
| 1 | **Aspect 4:3 + collage** = portrait phone(390×844)에서 collage 너비 ~350px, 높이 ~262px. 5장 중 가장 큰 hero tile ≈ 173×173. 5장이 모두 작음. | Airbnb hero gallery: **fold 전체 (60vh)**, swipe만. Klook: 4:3 1장 + nav arrow. Bento는 **데스크탑 패턴**, 모바일에는 큰 1장이 정답. |
| 2 | **Cream gutter (`#e8e2d9`, 6px)** = 사진 사이 회색 padding이 보이는데, gap 4px와 outer p-1.5 = 6px 둘 다 cream으로 보임 → 사진이 **창문 틀**에 끼워진 듯. 빈티지 갤러리 룩이지만 premium tour와는 mismatch. | Airbnb / Klook: gallery 사이 gap **1-2px**, 색상은 **전체 배경과 동일** (white). 사진이 **떠올라야** 함. |
| 3 | 썸네일 strip은 collage 바로 아래 → **같은 사진을 두 번** (큰 collage + 작은 thumbnail). 정보 중복. | 모범: collage OR strip, 둘 중 하나. Lightbox 안에는 strip OK. |
| 4 | Lightbox dot 인디케이터: `ring-2 ring-white ring-offset-2 ring-offset-[#1A2332]` 활성. 40×28px **사진 썸네일** 이 dot 역할 → 모바일 16:9 화면 하단에 5-9장 썸네일 = 매우 좁고 답답. | Apple Photos / iOS: dot 6px circle (~16px gap) — 정량은 적게, 사진은 메인에 집중. |
| 5 | Lightbox 배경 `bg-[#1A2332]/96` — almost black이지만 navy 톤. 진짜 black이 사진을 가장 깔끔히 드러냄. | 모범: lightbox bg = **pure black** (#000) — universal. |
| 6 | Lightbox 좌우 nav arrow: `bg-white/15 hover:bg-white/28` — 활성 시에도 흐림. 사용자가 "여기 누르면 다음 사진" 인지하기 어려움. | 모범: hover state = bg-white/85 + dark icon (Apple / Klook). |
| 7 | **TourPhotoOverlay watermark가 모든 사진에**. Apple / Klook / Airbnb는 watermark 0. premium 사진은 watermark 없는 것이 첫 신호. | 정책 결정 사항이지만 — premium = **no watermark on hero/gallery**. |

---

### 2.7 DayFlow (`TourDayFlowSection.tsx`)

**관찰:**

- 가로 스크롤 stop chips
- 각 chip: 48×48px 원형 photo + 11.5px 이름 + 10.5px 테마
- chip 사이 ··· (3개 회색 도트, 3×3px)

**문제:**

| # | 디테일 | 기준 |
|---|---|---|
| 1 | **48×48px circle photo** — 명소 사진이 동전만함. 얼굴이 들어간 사진은 식별 불가, 풍경은 점이 됨. | Klook itinerary chip: ~64-80px. Apple itinerary card: full landscape thumbnail. 명소 photo는 **인식 가능**해야 함. |
| 2 | Chip width = `w-[72px]` 고정 — 이름이 한국어 긴 단어면 `line-clamp-2 break-words` 로 잘림. 영문 짧으면 공백 많음. | 모범: **자동 너비** OR `min-w-[100px]` 정도. |
| 3 | Dot connector 3×3px × 3개 — 잘 안 보임. | 모범: 1-2px line OR 명확한 chevron `→`. Klook / Airbnb는 **arrow** 또는 **dashed line**. |
| 4 | Card에 3-layer shadow — itinerary preview 인데 헤비. Timeline (아래) 카드보다 더 elevated. | 모범: 본문 카드 = flat or hairline. Booking만 elevated. |
| 5 | 섹션 heading만 있고 subtitle 없음. 다른 섹션은 다 subtitle 있음 — **불일치**. | 일관성: 모든 section = heading + subtitle. |

---

### 2.8 Timeline (`TourTimelineSection.tsx`)

**관찰:**

- 좌측 number circle (36px) + vertical hairline + StopCard (white)
- StopCard 안에 80×56px photo strip (가로 스크롤 가능)
- StopCard 헤더: clock + time + duration / name (15px) / category (10px) + "Tickets included" pill
- 우측 chevron, click → drawer

**문제:**

| # | 디테일 | 기준 |
|---|---|---|
| 1 | **80×56 photo가 3-4장** = ~240-320px 너비. Card 너비 ~300-380px. 사진이 거의 카드 너비. 추가로 스크롤 가능 — **2단 스크롤 (수직 페이지 + 수평 사진)** = "scroll trap". 사용자가 페이지 스크롤하려다 사진 strip 스크롤됨. | 모범: card 안에 **1장의 cover photo** (16:9 풀 너비) + 클릭 → drawer 안에서 strip. |
| 2 | Number circle `h-9 w-9` (36px) + 2-layer shadow + inset highlight — **숫자 하나에 5-layer 디테일**. 그런데 색은 `#334155` (slate-700) — 거의 안 보임. | 모범: brand color 채움 + 흰 숫자. Klook: 12px circle dot. |
| 3 | Vertical hairline: `bg-gradient-to-b from-slate-200/40 to-transparent` — **40% slate-200** → 거의 안 보임 + 점점 사라짐. 1번-2번 stop 사이 연결성 단서가 약함. | 모범: solid 1px slate-300 또는 dashed. **timeline = 시각적 연결이 핵심**. |
| 4 | Card hover: `hover:-translate-y-px` + shadow 증가. 모바일에서 hover 안 되니 desktop only effect. 모바일 사용자는 affordance 시그널 0. | 모범: 모바일 = chevron (이미 있음) + active state. |
| 5 | "Tickets included" pill: `text-primary bg-primary/[0.06] ring-1 ring-primary/15` — primary blue 6% bg + 15% ring. **너무 흐림.** 본문 텍스트보다 약함. 정보를 알리려는 의도와 반대. | 모범: solid primary border + 12-13px text. **Pill은 본문보다 강해야** 인지됨. |
| 6 | Drawer trigger 명확하지 않음. Card 자체가 button 이지만 chevron 만으로는 "drawer"인지 "expand inline"인지 모름. | 모범: chevron 대신 "View details →" 텍스트, 또는 drawer 시각화. |

---

### 2.9 Pickup / Drop-off (`TourPickupDropoffSection.tsx`)

**관찰:**

- Google static map 상단 (600×280)
- 픽업 섹션: 큰 copper gradient circle (Bus icon) + `pickupPoints.length` locations + 시간 range
- 픽업 항목 list: copper circle number + name + type + time + chevron — 클릭 시 expand
- **드롭오프 섹션은 dark navy gradient** (`#111d31 → #0a1320`) — 페이지에서 **유일하게 dark 영역**

**문제:**

| # | 디테일 | 기준 |
|---|---|---|
| 1 | **Dark navy 드롭오프 strip = 매우 튀는 색 결정.** 1) 페이지 다른 곳에 dark mode 없음. 2) 의미 모호 — 왜 드롭오프만 dark? 3) 가독성 한 단계 떨어짐. | 모범: pickup과 drop-off는 **동일 카드 패턴**, 단지 헤더 라벨로만 구분 (또는 copper vs neutral). |
| 2 | Copper gradient (`#d4a37e → #c8956c → #a67751`) **3-stop**: 단색 brand 보다 디테일하지만 **모든 동그라미에 3-stop gradient** + drop shadow = 카드 안 헤더 + 행마다 number circle 모두 동일 처리 → 시각 노이즈. | 모범: brand color **flat**. Gradient는 hero / CTA 같은 1-2곳에만. |
| 3 | Map: 600×280 static + `aspectRatio: 600/280` = ratio 2.14:1 (매우 wide). 모바일 화면 너비 350 = 높이 ~163px. 마커가 작아 인식 어려움. | 모범: 16:9 (1.78:1) 또는 4:3 + interactive map. Static map은 **2025 기준 retro**. |
| 4 | Map 위 `linear gradient white from-bottom` fade — 마커를 가리는 fade. | 모범: fade 없거나 위에서. |
| 5 | 픽업 row의 expand drawer: 클릭 시 사용자 이름·type·note 가 다시 같은 UI로 보임. 정보 거의 중복. | 모범: row click = open map modal OR show extended Korean address + Pickup tip. |

---

### 2.10 Included / Not Included (`TourIncludedSection.tsx`)

**관찰:**

- Collapsed by default. Title + "X included · Y not included" preview.
- Expand → green section (Included) + red section (Not included).
- 각 아이템 = card-like row with check/X icon, inside green/red bg.

**문제:**

| # | 디테일 | 기준 |
|---|---|---|
| 1 | **Collapsed default.** 사용자가 가장 알고 싶은 정보 중 하나 — "뭐가 포함이지?" — 가 클릭 한 번 필요. Klook / Airbnb는 이걸 **항상 visible**. | 모범: **default open** (또는 카드 위에 처음 3개 list, "See all 12 inclusions →" 버튼). |
| 2 | Background: `#f6fcf8` (옅은 green) + 헤더 + 내부 또 `#f0faf4` (좀 더 진한 green) — **녹색 위 녹색**. Excluded는 `#fff5f5` + `#fff5f5`. 의미는 명확하지만 시각적으로 **칠해진 면적이 너무 큼**. | 모범: White card + 작은 green/red dot icon. Color는 **icon에만**. Klook: text only with ✓/✗. |
| 3 | List item이 또 `bg-white px-3 py-2.5 ring-1 ring-emerald-100/80` — **list 안에 card 안에 card**. 3중 중첩. | 모범: flat `<li>`, divider만. |
| 4 | 아이콘이 두 번 — 헤더 ✓ 큰 거 + 항목마다 ✓. 중복. | 모범: 항목에만. |

---

### 2.11 Fit (`TourFitSection.tsx`)

**관찰:**

- "Best For" 카드 (amber/copper tinted) — collapsed default
- → 열면 best-for list + "Less Ideal" 또 collapsed 토글 안에 + Families/Seniors note
- 별도로 "Route Logic" white card — collapsed default

**문제:**

| # | 디테일 | 기준 |
|---|---|---|
| 1 | **3중 nested collapsible**. Best For (collapsed) → 열면 Less Ideal (collapsed) 또 → Route Logic (별도 collapsed). 한 섹션에 collapsible 3개. | 모범: Collapsible **0~1개**. Airbnb / Klook은 fit section을 **always visible bullet list**. |
| 2 | 인라인 색상 `rgba(200,149,108,0.07)`, `rgba(200,149,108,0.15)`, `rgba(200,149,108,0.18)`, `rgba(200,149,108,0.16)` 등 — copper 의 4가지 알파. **토큰 없이 매직 넘버.** | 모범: `--accent-tint-1, --accent-tint-2` 정의. |
| 3 | hover 시 인라인 style 직접 `onMouseEnter / onMouseLeave` 로 background 바꿈 — Tailwind hover: 우회. 일관성 깨짐. | 모범: CSS class 사용. |
| 4 | persona icon detection by regex (`pickPersonaIcon`) — 다국어 키워드 매칭. 잘 만들었지만 **icon이 cognitively 추가 부담**. 6-8개 항목에 6-8개 다른 아이콘 = 시각 노이즈. | 모범: 단일 person silhouette icon, OR 아이콘 없이 ✓ bullet. |
| 5 | "Best For"와 "Less Ideal" 한 카드 안에 둘 다 = positive/negative 가 같은 표면. 결정 fatigue. | 모범: 카드 2개 분리 OR positive only + "Note: not ideal for X" 단일 문장. |

---

### 2.12 Practical Details + Weather + Seasonal (`TourPracticalDetails.tsx`)

**관찰:**

- 상단: live weather strip (today + tomorrow, 2개 ribbon 카드)
- 중간: seasonal variations 가로 스크롤 (Spring rose, Summer amber, Autumn orange, Winter sky)
- 하단: practical accordion (white card with rows)

**문제:**

| # | 디테일 | 기준 |
|---|---|---|
| 1 | Weather card: `bg-gradient cream → ivory → cream` 외부 + 내부 2칸 (`bg-amber-50 → white → amber-100/55` 또는 `bg-sky-50 → ...`) + **4-layer shadow**. 한 weather strip 에 카드 3개 (외 + 내2) + 그라데이션 6개. | 모범: 단순 row, icon + temp + label. Apple Weather: bg only when full-screen. |
| 2 | Seasonal: 4개 카드 각각 다른 색 그라데이션 — Airbnb의 "When to visit" 도 그래프 + 단일 카드. 4-color rainbow = decorative. | 모범: 1색 카드 + season icon + 짧은 description. 4계절을 **하나의 timeline**으로. |
| 3 | Seasonal 카드 너비: `min(280px, calc(100vw - 3.5rem))` — 모바일에서 약 280px, 한 번에 1.2장 visible. 너비가 또 어색 (한 번에 1개도 아니고 2개도 아닌 1.2장). | 모범: 1장 풀 OR 2장 (45% 너비 each). |
| 4 | Practical accordion은 또 list 형식. 페이지에서 accordion이 Included, Fit (3개), FAQ, PracticalDetails, Pickup (확장 row), Support — **6개 섹션이 accordion 패턴.** 사용자 피로. | 모범: max 1-2 accordion (FAQ + 1개). |
| 5 | Accordion 안 list: `<ul ml-1 space-y-3 border-l-2 border-amber-200/60 pl-4>` — **amber left border**. 위에서 amber weather strip 색과 충돌 안 하려는 의도 같지만, 이 page에서 amber는 이미 5번째 사용. | 모범: divider 없이 list-style. |
| 6 | Inline `<strong>` auto-bold on times/prices/durations — 정보 강조는 좋음. 다만 `text-slate-900` 으로 변경 + tabular-nums — `<strong>` 만으로 충분. 색까지 바꾸면 본문이 패치워크. | 모범: bold weight 만, color는 유지. |

---

### 2.13 Booking Support (`TourBookingSupportSection.tsx`)

**관찰:**

- 상단 3-col trust grid: 5색 그라데이션 카드들 (emerald, sky, amber, orange, rose)
- 하단 accordion (default open): 6-step flow with phase icon + colored ring + spine line

**문제:**

| # | 디테일 | 기준 |
|---|---|---|
| 1 | **5색 trust card grid + 6색 step flow** = 한 섹션에 11색. 페이지 누적 색상 시리어스 폭발. | 모범: 1색 (brand) + neutral. Klook trust card: monochrome navy. |
| 2 | Step flow는 **booking 후 일정** — booking 전 페이지에는 부차적. 그런데 default open + 매우 화려한 시각. | 모범: collapsed default, 작은 timeline 미니어처만. 우선순위 ↓. |
| 3 | Mobile 세로 + Desktop 가로 — 별도 마크업 2벌. 같은 정보 2번 작성 = sync 깨질 위험. | 모범: 단일 마크업 + responsive flex. |

---

### 2.14 FAQ (`TourFaqSection.tsx`)

**관찰:**

- 5개 표시 + "+N more" 토글
- 첫 번째 default open ("first-time")
- 외부 카드 radius 26px

**문제:**

| # | 디테일 | 기준 |
|---|---|---|
| 1 | Card radius **26px**. Apple / Airbnb FAQ는 **divider list** (radius 0 or 16px). 26px 라운드 + accordion 내부 = 외부와 내부 코너 충돌. | 모범: 16px max. |
| 2 | "+N more" 가 또 accordion item 처럼 보임 (chevron, hover). 사용자에게 "이게 답이 있나" 혼동. | 모범: 명확한 link "Show all questions →" + scroll OR 토글 텍스트만. |
| 3 | FAQ footer "Need more help" → "#" href (placeholder). 깨진 링크. | 작은 디테일이지만 — production 페이지에서 dead link는 -1점. |
| 4 | Body line-height 1.7 — 답변은 OK, 다만 질문은 leading-snug — 일관성 ↓. | 모범: 두 곳 동일 line-height. |

---

### 2.15 Reviews (`TourReviewsSection.tsx`)

**관찰:**

- 상단 summary card: 평균/5 + 별점 + 5단계 distribution bar + highlights chips
- 중간: 리뷰 카드 3개 (Card-premium)
- 하단: "Write a review" CTA 카드

**문제:**

| # | 디테일 | 기준 |
|---|---|---|
| 1 | **Summary 카드 gradient** `from-rgba(46,92,138,0.03) to-rgba(200,149,108,0.02)` — primary blue → copper, 3% opacity. 거의 안 보이는 그라데이션은 **잘못된 디테일** (보이지 않으면 의미 없음). | 모범: solid pale bg (`#f8f8fa`) OR gradient 충분히 보이게. |
| 2 | Avatar fallback: muted bg + 첫 글자. 색이 회색 — 평범한 그라이언트 색상 (Airbnb는 random hue per user). | 모범: hue cycling per username hash. |
| 3 | 별 색상: `fill-amber-400 text-amber-400` — universal amber, OK. 다만 Hero에서 별이 copper (`#C8956C`) 였음 → **같은 별이 두 색**. | 모범: 별 = **항상 amber**. |
| 4 | "Verified" 라벨 ← 작은 ✓ + `text-[10px]` — 거의 안 보임. **사회적 증거**의 핵심 단서가 가장 약함. | 모범: 명확한 badge (Airbnb의 superhost-style). |
| 5 | Review text `leading-[1.7]` — 좋음. 다만 "Read more" CTA `text-xs text-primary hover:underline` — primary blue, hover 시에만 underline. 모바일에는 hover 없으니 affordance ↓. | 모범: 항상 underline. |
| 6 | Photos: 112×80 = 4:3. 한 줄 스크롤. OK. 다만 photo border-radius 8px — 카드 라운드 26과 mismatch. | 모범: 16px. |

---

### 2.16 Recommendations (`TourRecommendationsSection.tsx`)

**관찰:**

- 카드 너비 `calc(78vw - 16px)` max 300px
- 카드 photo 위 **dark gradient overlay** (`from-[#0c1622]/55 → transparent`) + **추가 dark grad br** + ring
- Top-left: tag (white pill), bottom-right: duration (white pill)
- 본문: 제목 / description / rating + price

**문제:**

| # | 디테일 | 기준 |
|---|---|---|
| 1 | **Photo 위 2-layer dark gradient + ring** — 사진을 일부러 어둡게 함. 다른 카드형 product UI는 사진 그대로 보임. **product photo는 어둡게 X**. | 모범: gradient 없거나 매우 약하게 (10%). 사진은 **밝게**. |
| 2 | Tag pill 위치 (top-left) + duration pill (bottom-right) = 두 모서리에 정보. 사진 위 정보 2개. 모서리 채움 패턴. | 모범: tag만 OR duration만, 하나. Card body로 옮기기. |
| 3 | Hover: `-translate-y-1 + shadow 증가` — 좋음. 다만 모바일 효과 없음. | 모범: tap effect (active state). |
| 4 | "Explore next" eyebrow + "You might also like" — 작은 eyebrow + 큰 heading. Eyebrow에 `text-primary/85` (= primary 85% opacity) — primary blue tint, 85% opacity는 어색 (왜 100% 안 함?). | 모범: 100% 또는 명확한 secondary color. Opacity-pixel 매직넘버 회피. |
| 5 | 카드 ring 색상: `ring-slate-900/[0.07]` (= 7% 알파). 거의 안 보임. 시각적으로 카드 경계 약함. | 모범: 1px solid border 또는 1px shadow only — 7% ring 은 **있는 듯 없는 듯**. |

---

### 2.17 Desktop Booking Card (`TourDesktopBookingCard.tsx`)

**관찰:**

- Sticky `top-20 py-8` — header 아래 80px + 32px padding
- Card: rounded 28px + border + backdrop-blur + `--home-shadow-neutral-card`
- 가격 header (3xl + tabular-nums) + per/unit label + priceNote + estimated total
- Pricing tier 표 (작은 버전) + Calendar (compact) + Guest stepper + Language select + Availability badge + CTA + Free cancel/Pay later 2-line

**문제:**

| # | 디테일 | 기준 |
|---|---|---|
| 1 | **카드가 너무 무거움.** 가격 + Tier 표 + 캘린더 + 손님 + 언어 + Availability + CTA + 안심 2줄 → 모든 게 한 카드 안. **9개 위계 동시** — 사용자가 "어디서 시작?" 모름. | 모범: Airbnb booking card = 5블록만 (가격 / 날짜 / 손님 / CTA / 안심 trust). Tier 표는 carousel 또는 expandable. |
| 2 | Pricing tier 표가 카드 안 + 헤더 위 + 캘린더 위 = 가격 단가가 한 카드에 **3번 등장** (header price / tier matched cell / "Per X" 안내). 정보 중복. | 모범: 한 곳만. Header price = active tier 의 price = "click here for more sizes". |
| 3 | CTA 버튼: `bg-foreground` (black) `text-white` `h-11` — Apple / Klook (둘 다 brand color CTA), Airbnb (red gradient CTA), Booking.com (blue) 와 다르게 **검정 CTA**. Brand-less. | 모범: **primary brand color** (현재 페이지 brand = `#2e5c8a`). 검은 CTA는 monochrome luxury 브랜드 (Apple, Hermès) 컨벤션. 투어 액세스는 emotional, 검은 CTA = cold. |
| 4 | CTA label "Reserve" — Airbnb 와 동일. 좋음. 다만 가격 옆에 별도 "Total · X guests" 가 작게 — CTA 가 가격을 다 보여줘야 효율적. | 모범: CTA = "Reserve · $X total" (Airbnb 패턴). |
| 5 | "Free cancellation" + "Pay later" 둘 다 emerald-700 — 페이지의 다른 emerald 사용과 mix. | 모범: 1색만, 더 작게. |
| 6 | Sticky `top-20 py-8` — header 아래 80px 띄움. lg screen 1024px+ 에서 header h-14 = 56px, 80px = 24px gap → 시각적으로 카드가 약간 떠있는 느낌. 자연스럽지만 다른 sticky 요소와 충돌 가능성. | 모범: `top: header_height + 16px`. |
| 7 | Card border + ring + shadow + backdrop-blur 4중 처리. Backdrop-blur는 white 위에 의미 없음 (배경 흰색). | 모범: 단일 elevation token. |

---

### 2.18 Mobile Sticky CTA (`TourStickyBookingBar.tsx`)

**관찰:**

- 항상 화면 하단 고정
- 가격 (left) + CTA (right)
- Tap → drawer slide up (max-height 520px, 0.78s ease) — 안에 캘린더 + tier toggle + guest + language
- Tap CTA again → 결제 페이지로

**문제:**

| # | 디테일 | 기준 |
|---|---|---|
| 1 | **Drawer 애니메이션 0.78s** — 너무 느림. iOS 표준 0.3s, Material 0.25s. 0.78s = 0.5초 더 느려 → "버벅" 인식. | 모범: 0.25-0.35s ease-out. |
| 2 | Drawer maxHeight 520px 절대값 + `max-h-[min(62vh,520px)]` → 짧은 phone (iPhone SE 568px) 에선 거의 풀스크린, 큰 폰 (Pro Max) 에선 절반. **inconsistent feel.** | 모범: vh 단위만 OR safe-area aware percentage. |
| 3 | CTA가 처음엔 "Check Availability", drawer 열면 "Reserve" — **버튼 의미가 바뀜**. 사용자 멘탈 모델: 같은 버튼은 같은 동작. | 모범: drawer 안에 명확한 "Reserve $X" 버튼 별도. CTA 라벨 변경 X. |
| 4 | Drawer 안 reassurance row (`bg-emerald-50/60`) 안에 또 "Free cancellation · Pay later" — page에 같은 phrase가 5번 등장 (hero trust strip, Pickup footer, drawer, sticky CTA, desktop card). 반복 noise. | 모범: 1-2회만. |
| 5 | Calendar `card-premium-calendar-wrap--compact` max 17.25rem (276px) — drawer 너비가 더 크면 (mobile 360-430px) 가운데 정렬, 양쪽 빈 공간 큼. | 모범: drawer 안 캘린더는 풀 너비 padding. |
| 6 | Drawer 닫기: backdrop click + X 버튼 + drawer 안 어떤 영역도 swipe-down 으로 안 닫힘. | 모범: drag handle (4px bar at top) + swipe-down to dismiss. iOS native pattern. |
| 7 | Spacer div (`TourStickyBookingBar.tsx:569`): drawer 열리면 페이지 본문 자체가 320rem (60vh) 정도 푸시 down. → 사용자가 drawer 열고 "백그라운드 페이지에 뭐 있나" 보면 페이지가 변형됨. 비표준. | 모범: drawer = overlay, push X. 페이지 그대로. |

---

## 3. 디테일 카탈로그 — 페이지 전체에서 반복되는 패턴 문제

### 3.1 "Section heading + subtitle" 패턴이 11가지

| Section | h2 size | tracking | subtitle |
|---|---|---|---|
| Hero | n/a (h1 19/22/24) | -0.018em ~ -0.008em | rose meta |
| AtAGlance | 17px | -0.02em | 13px muted leading-relaxed |
| Atmosphere | 18px (text-lg) | tracking-tight | sm muted leading-relaxed |
| DayFlow | 18px | tracking-tight | 없음 |
| Timeline | 18px | tracking-tight | sm muted leading-relaxed |
| Pickup | 18px | tracking-tight | sm muted leading-relaxed |
| Included | 18px | tracking-tight | sm muted leading-relaxed (preview!) |
| Fit | 17px | -0.02em | 13px |
| Practical | 18px | tracking-tight | sm muted |
| Support | 18px | tracking-tight | sm muted |
| FAQ | 18px | tracking-tight | sm muted |
| Reviews | 18px | tracking-tight | sm muted leading-snug |
| Recommendations | 18px | tracking-tight | sm muted leading-relaxed |

→ AtAGlance / Fit 만 **17px**, 나머지 18px. **이유 없음.** DayFlow 만 subtitle 없음. 한 룰을 매번 약간씩 깸 = 시각적 불일치.

---

### 3.2 "Eyebrow (작은 uppercase)" 패턴이 10가지

| 위치 | spec |
|---|---|
| Hero region | 10.5px / 0.18em / rose-600/85 |
| Pricing "Per X" | 11px / wide / muted |
| Desktop card "From" | 10.5px / 0.12em / muted |
| Practical weather title | 10px / 0.14em / muted |
| Reviews "Guests mention" | 11px / medium / muted |
| Recommendations "Explore next" | 10px / 0.16em / primary/85 |
| Support timing | 9.5px / 0.14em / themed color |
| Pickup type | 10.5px / 0.08em / muted |
| Dropoff "Return available to" | 9.5px / 0.14em / white/45 |
| Dropoff "approx." | 9.5px / 0.12em / white/45 |

→ **same purpose, 10가지 spec.** Eyebrow 는 page-wide 동일해야 함.

---

### 3.3 Accordion 패턴 인콘시스턴시

페이지에 **8종 accordion**:

1. Included (collapsed, chevron at right, bg color)
2. Fit Best For (collapsed, chevron at right, amber bg)
3. Fit Less Ideal (nested in #2, smaller chevron)
4. Fit Route Logic (collapsed, white bg, primary chevron)
5. Practical accordion (collapsed, white bg, primary chevron)
6. FAQ (item-level, first open by default)
7. Pickup row expand (chevron rotates, drawer down)
8. Support steps (default open, primary chevron)

→ Chevron color, size, bg, default state 다 다름.

---

### 3.4 Button styles 인콘시스턴시 — 17가지

| 위치 | 스타일 |
|---|---|
| Hero Save | 36×36 round, white/10 bg, backdrop-blur, white/30 border |
| Hero Share | 동일 |
| Subnav pill | full pill, foreground/white active, muted hover |
| Gallery thumb | 84px rect, ring-border |
| Stop card | full-width card, white bg, multilayer shadow |
| Included header | full-width, transparent, hover bg-emerald |
| Fit header | full-width, transparent, hover bg-copper |
| Fit Less Ideal header | inline link-style |
| Calendar day | 33.6px, primary/14 hover |
| Stepper +/- | 28×28, muted-foreground, foreground/7 hover |
| Reserve CTA (desktop) | 44px h, bg-foreground, white, primary text |
| Reserve CTA (sticky) | h-9 sm:h-10, bg-foreground, white |
| Write review | bg-primary, primary-foreground |
| Show all reviews | full-width white, border, muted bg hover |
| FAQ Show more | inline primary text |
| Recommendation card | full card link, hover lift |
| Map markers | static map |
| Day chip dot | 3px circle (decorative) |

→ 같은 페이지에서 사용자가 "어디까지 누를 수 있는지" 일관된 mental model 형성 불가.

---

### 3.5 "Card" 정의가 8개

```
.card-premium       = 14px radius + 2-layer subtle shadow (CSS)
.card-hero          = 16px + border + elevated shadow (CSS)
.card-utility       = 12px + 70% border + subtle shadow (CSS)
.tour-glance-card   = 정의되었으나 미사용 (6-layer)
inline DayFlow      = 16px + 3-layer
inline Pickup       = 16px + ring + 3-layer
inline Recommendation = 16px + 7% ring + 3-layer with hover
inline DesktopBooking = 28px + border + ring + backdrop-blur + token shadow
inline StopCard     = 16px + 2-layer + hover lift
```

---

## 4. Apple / Klook / Airbnb 수준 도달을 위한 로드맵

### Phase 0 — 디자인 시스템 토큰 정리 (선행 조건)

**1) Type scale (5단계로 압축)**

```
display:    32 / 1.1  / -0.02em  / 600
title:      24 / 1.2  / -0.015em / 600  ← H1, hero
section:    20 / 1.25 / -0.01em  / 600  ← H2
subsection: 16 / 1.4  / 0        / 600  ← card titles
body:       14 / 1.55 / 0        / 400  ← body, list
caption:    12 / 1.4  / 0.01em   / 500  ← eyebrow, meta
```

**제거:** 11.5, 12.5, 13.5, 15, 17, 19, 22 등 in-between sizes.

**2) Color (4종으로 압축)**

```
--brand:      #2e5c8a       (Primary CTA, links, focus)
--accent:     #c8956c       (highlights only)
--success:    emerald-600   (verified, available — 상태 only)
--danger:     red-500       (not-included, unavailable — 상태 only)
```

**제거:** rose-as-decoration, amber-as-decoration, sky/violet/orange decoration.

**3) Elevation (3단계)**

```
e1: 0 1px 2px rgba(0,0,0,0.04)
e2: 0 2px 8px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)
e3: 0 12px 28px -8px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.05)
```

**룰:** Body cards = e1. Lifted cards (Booking, Hero photo) = e2. Modal / Drawer = e3.

**4) Radius (3단계)**

```
sm: 8px   (chips, pills, day cells)
md: 12px  (cards, photos)
lg: 16px  (hero, booking card)
```

**제거:** 14, 20, 26, 28.

**5) Spacing (4-point grid)**

```
4, 8, 12, 16, 20, 24, 32, 40, 48, 64
```

**제거:** 10, 14, 18 (= half-step) 모두.

---

### Phase 1 — Quick wins (1주, 시각적으로 가장 큰 임팩트)

| # | 변경 | 영향 |
|---|---|---|
| 1 | Hero 자동 슬라이드 OFF, dot 인디케이터 도입 | 컨트롤감 +, 멀미 - |
| 2 | Hero에 location + title + ★ + price 오버레이 (Klook 스타일) | 첫 fold 정보량 +50% |
| 3 | Hero photo `rounded-b-2xl` 제거, edge-to-edge | Airbnb 룩 |
| 4 | Trust strip 단일 색상 (emerald-600 monochrome) | 시각 노이즈 -1 |
| 5 | Sub-nav: 검은 pill → underline (밑줄 2px brand color) | 가벼움 + 본문 자리 +12px |
| 6 | At-A-Glance 6색 로테이션 → monochrome dots + ★ 시스템 (또는 progress bar) | 거짓 신호 제거 |
| 7 | Atmosphere bento cream gutter (`#e8e2d9` → `#ffffff`), gap 4 → 2 | 사진이 떠올라옴 |
| 8 | Pickup copper gradient → flat brand color | 노이즈 -2 |
| 9 | Drop-off dark navy strip 제거, pickup과 같은 카드 패턴 | 일관성 +1 |
| 10 | Included / Fit / Practical / Support 배경 그라데이션 다 제거 (white only) | -7 color decisions |
| 11 | CTA 색: `bg-foreground` (검정) → `bg-primary` (`#2e5c8a` 브랜드 블루) | 브랜드성 + 따뜻함 |
| 12 | Drawer animation 0.78s → 0.30s | "버벅" 인식 사라짐 |
| 13 | TourPhotoOverlay watermark 제거 (정책 결정) | premium feel +1 단계 |

---

### Phase 2 — Section orchestration (2주)

| # | 변경 | 영향 |
|---|---|---|
| 14 | Body cards 모두 e1 (subtle hairline + 1px shadow) 로 통일. Booking card만 e2. | Visual hierarchy 명확 |
| 15 | Accordion 6개 → 2개로 압축 (FAQ + Practical only). 나머지는 always-visible list. | 클릭 횟수 -4 |
| 16 | Included: default open, 첫 5개 visible, "Show all" link. | 마찰 -1 |
| 17 | Fit: 3중 nested collapse → flat list with positive/negative two-column. | 인지 부담 -50% |
| 18 | Day flow chips: 48 → 80px photo, dotted line → arrow. | 인식 가능 |
| 19 | Stop card: horizontal photo strip → single hero photo (16:9 full width) | 2D scroll trap 제거 |
| 20 | Section heading: 모두 동일 spec (`section` = 20px / 1.25 / 600). subtitle 모두 동일. | 리듬감 |
| 21 | Eyebrow: page-wide 단일 spec (12px / 0.12em / muted-fg). | 12 → 1개 |
| 22 | Booking card: 가격 + 날짜 + 손님 + CTA + 안심 = 5블록. Tier 표는 expandable. | 의사결정 흐름 |
| 23 | CTA label: "Reserve · $X total" (Airbnb 패턴). | 가격 노출 통합 |
| 24 | Sticky drawer drag handle (4px bar) + swipe-down dismiss. | iOS native feel |

---

### Phase 3 — Premium polish (3-4주, 본격 Apple / Airbnb 수준)

| # | 변경 | 영향 |
|---|---|---|
| 25 | Hero: 60vh + 풀스크린 swipe gallery (Airbnb-style). | First-fold 임팩트 |
| 26 | Gallery: bento → Klook / Airbnb 2-col (5 photo) + "+N more" overlay. | mobile / desktop 동일 패턴 |
| 27 | Reviews summary: distribution bar 색상 amber 단일, hue shift 제거. Verified = badge로 명확화. | 신뢰성 신호 강화 |
| 28 | Recommendations card: photo dark overlay 제거, tag / duration → card body. | premium card 룩 |
| 29 | Map: static → interactive Mapbox / Google Maps (Klook 패턴). 마커 hover preview. | 정보 밀도 +, retro feel - |
| 30 | Microcopy: "Free cancellation" 페이지에 5회 → 2회 (Booking card + 결제 페이지). | 신호:노이즈 비 ↑ |
| 31 | Loading states: 모든 fetch (availability, weather) skeleton + 페이드인. Avatar fallback color hash. | premium 마이크로 |
| 32 | Animation: Booking drawer open → spring (Apple), 0.4s. Lightbox open → scale + blur (이미 좋음, 0.58s → 0.4s). | tempo 통일 |
| 33 | Focus rings: 모든 인터랙티브 요소 동일 (2px brand color, offset 2px). 현재는 4가지 다른 ring 스타일. | a11y + premium |
| 34 | Dark mode: `prefers-color-scheme: dark` 대응 (Apple / Airbnb는 fully 지원). | 2025 standard |

---

## 5. 한 줄 요약 (당장 실행할 3가지)

1. **색상 다이어트** — page-wide 색 17개 → 3개 (brand / accent / neutral) + 상태 색 2개. **이거 하나만으로 premium feel +40%**.
2. **Accordion 다이어트** — 8개 → 2개. Included / Fit / Pickup / Support의 collapsed default 해제. **첫 fold 정보량 +60%**.
3. **CTA 다이어트** — Booking card 9블록 → 5블록. CTA = brand color + total price 통합. **컨버전 마찰 -1단계**.

---

## 6. 현재 평가 (UI/UX 만, 콘텐츠/기능 제외)

| 항목 | 점수 | 비고 |
|---|---|---|
| **Visual hierarchy** | 4/10 | 모든 카드가 같은 무게로 떠 있음 |
| **Color discipline** | 2/10 | 17색 무지개 |
| **Typography rhythm** | 4/10 | 17사이즈 거짓 정밀 |
| **Spacing rhythm** | 5/10 | half-step 즉흥 |
| **Interaction polish** | 6/10 | drawer 느림, hover only |
| **Accessibility hint** | 6/10 | aria-label / aria-pressed 잘 들어감, focus ring 일관성 X |
| **Information density** | 7/10 | 정보는 충분, 정리가 부족 |
| **Brand presence** | 3/10 | brand color가 CTA에 없음, copper와 rose가 brand인지 아닌지 불명 |
| **Premium feel** | 4/10 | 디테일은 많은데 통일감 부재 |
| **Klook / Airbnb 비교** | 5/10 | 정보는 더 풍부, 시각은 한 세대 뒤 |

**종합: 4.6 / 10**

**Apple / Klook / Airbnb 동격 도달 거리:**

- Phase 0+1만 해도 → **6.5점**
- Phase 2까지면 → **7.5점**
- Phase 3까지면 → **8.5점+**

가장 큰 한 가지를 꼽으라면 — **"디자이너가 14번 다른 결정을 내린 14개 섹션을, 1번 결정한 1개 시스템으로 합쳐야 한다."**

---

## 부록: 참조 파일 경로

| 컴포넌트 | 경로 |
|---|---|
| Page entry | `app/tour-product/[slug]/page.tsx` |
| Client orchestrator | `components/product-tour-static/_shared/TourProductDetailClient.tsx` |
| Hero | `components/product-tour-static/east-signature-nature-core/tour-detail-sections/TourHeroSection.tsx` |
| Sub-nav | `.../TourTabsNav.tsx` |
| At-A-Glance | `.../TourAtAGlance.tsx` |
| Gallery | `.../TourAtmosphereGallery.tsx` |
| DayFlow | `.../TourDayFlowSection.tsx` |
| Timeline | `.../TourTimelineSection.tsx` |
| Pickup / Dropoff | `.../TourPickupDropoffSection.tsx` |
| Included | `.../TourIncludedSection.tsx` |
| Fit | `.../TourFitSection.tsx` |
| Practical | `.../TourPracticalDetails.tsx` |
| Booking Support | `.../TourBookingSupportSection.tsx` |
| FAQ | `.../TourFaqSection.tsx` |
| Reviews | `.../TourReviewsSection.tsx` |
| Recommendations | `.../TourRecommendationsSection.tsx` |
| Desktop Booking | `.../TourDesktopBookingCard.tsx` |
| Sticky Booking | `.../TourStickyBookingBar.tsx` |
| Scope CSS | `.../tour-product-v2-scope.css` |
