# 투어 상세 페이지 UI/UX 업그레이드 플랜 검토 의견

작성일: 2026-05-17  
검토 대상: `docs/tour-product-detail-ui-ux-audit.md`  
대상 페이지: `app/tour-product/[slug]/page.tsx`  
주요 코드:

- `components/product-tour-static/_shared/TourProductDetailClient.tsx`
- `components/product-tour-static/east-signature-nature-core/tour-detail-sections/TourHeroSection.tsx`
- `components/product-tour-static/east-signature-nature-core/tour-detail-sections/TourTabsNav.tsx`
- `components/product-tour-static/east-signature-nature-core/tour-detail-sections/TourDesktopBookingCard.tsx`
- `components/product-tour-static/east-signature-nature-core/tour-detail-sections/TourStickyBookingBar.tsx`
- `components/product-tour-static/east-signature-nature-core/tour-product-v2-scope.css`

## 1. 최종 평가

Claude Code의 업그레이드 플랜은 **큰 방향은 맞다**. 특히 아래 진단은 정확하다.

> "잘 만든 14개 섹션 컴포넌트가 한 페이지에 따로따로 살고 있다."

현재 상세페이지는 콘텐츠와 기능은 풍부하지만, 각 섹션이 서로 다른 색상, radius, shadow, typography, accordion 패턴을 사용한다. 그래서 페이지 전체가 하나의 제품처럼 보이기보다, 여러 개의 독립 카드 묶음처럼 보인다.

다만 이 플랜을 그대로 실행하면 위험하다. 일부 처방은 상세페이지의 전환 흐름과 기능 안정성을 고려하기보다, Apple/Airbnb/Klook 레퍼런스를 강하게 끌어온 전면 리디자인에 가깝다.

내 평가는 다음과 같다.

```text
70% 찬성
20% 조건부 찬성
10% 반대
```

즉, 이 문서는 **실행 기준으로 바로 쓰기보다, 디자인 시스템 부채를 정리하는 상위 진단 문서**로 보는 것이 맞다. 실제 구현은 전환에 직접 영향을 주는 안전한 항목부터 순차 적용해야 한다.

## 2. 강하게 찬성하는 진단

### 2.1 색상 체계가 과하게 분산되어 있다

이 진단은 맞다. 현재 상세페이지는 rose, emerald, amber, primary blue, copper, navy, sky, violet, orange 등이 여러 섹션에서 장식 색상으로 사용된다.

문제는 색상이 "의미"가 아니라 "분위기"로 쓰이고 있다는 점이다.

예:

- Hero: rose
- Trust strip: emerald, amber, primary blue
- At-a-glance: 6색 로테이션
- Pickup: copper
- Drop-off: dark navy
- Included: emerald/rose split
- Fit: amber/copper
- Seasonal: 계절별 4색
- CTA: black

사용자 입장에서는 어떤 색이 브랜드 색인지, 어떤 색이 상태 색인지 구분하기 어렵다.

찬성:

- 색상 다이어트는 반드시 필요하다.
- brand color, accent, neutral, success, danger 정도로 줄여야 한다.
- success/danger는 상태 표현에만 써야 한다.

주의:

- 한 번에 모든 색을 제거하면 페이지가 지나치게 평평해질 수 있다.
- 여행 상품 상세페이지는 감성도 중요하므로, `accent`는 완전히 죽이지 말고 제한적으로 남기는 편이 좋다.

### 2.2 Typography scale이 너무 세분화되어 있다

이 진단도 맞다. 실제 코드에는 `10px`, `10.5px`, `11px`, `11.5px`, `12.5px`, `13.5px`, `17px`, `19px`, `22px` 같은 미세 조정이 많이 보인다.

이런 숫자는 개별 컴포넌트에서는 좋아 보일 수 있지만, 페이지 전체로 보면 리듬이 깨진다.

찬성:

- section heading, eyebrow, body, caption의 공통 스케일을 정해야 한다.
- 특히 section heading은 페이지 전체에서 같은 spec을 써야 한다.
- eyebrow는 하나의 공통 컴포넌트 또는 class로 묶는 것이 좋다.

### 2.3 Shadow와 radius 언어가 너무 많다

현재 페이지는 카드마다 자신만의 elevation을 가진다. 상세페이지에서 가장 떠 있어야 하는 것은 booking card와 drawer인데, 본문 카드들도 거의 비슷한 강도로 떠 있다.

찬성:

- Body card는 대부분 flat 또는 e1 수준으로 낮춰야 한다.
- Desktop booking card와 mobile drawer만 더 높은 elevation을 가져야 한다.
- radius 단계도 줄여야 한다.

주의:

- Claude 플랜처럼 radius를 무조건 `8/12/16` 세 단계로만 제한할 필요는 없다.
- Booking card는 20px 전후까지 허용해도 된다.
- 중요한 건 단계 수를 줄이고 역할별로 고정하는 것이다.

### 2.4 Mobile booking drawer 애니메이션은 너무 느리다

강하게 찬성한다.

현재 `TourStickyBookingBar.tsx`의 drawer transition은:

```tsx
transition={{ duration: 0.78, ease: drawerEase }}
```

0.78초는 모바일 조작에서 느리게 느껴진다. 사용자는 이것을 "고급스러운 전환"보다 "버벅임"으로 느낄 가능성이 크다.

권장:

```text
0.78s → 0.28s ~ 0.34s
```

이 항목은 즉시 개선해도 기능 리스크가 낮다.

### 2.5 CTA가 검정색인 것은 브랜드 전환 관점에서 약하다

현재 desktop booking card와 mobile sticky CTA는 `bg-foreground` 검정 CTA를 쓴다.

검정 CTA는 미니멀하고 고급스럽게 보일 수 있지만, 이 사이트의 브랜드 색은 이미 `--primary: #2e5c8a`로 잡혀 있다. 투어 상세페이지에서 예약 CTA는 가장 중요한 액션이므로 브랜드 색과 연결되는 편이 좋다.

찬성:

- CTA를 `bg-primary` 계열로 바꾸는 것은 좋다.
- hover/disabled/focus 상태도 함께 정리해야 한다.
- CTA label에 total price를 함께 보여주는 방향도 좋다.

주의:

- 모든 버튼을 primary로 바꾸면 안 된다.
- 예약 CTA만 primary로 두고, 나머지 탐색/보조 버튼은 neutral로 낮춰야 한다.

### 2.6 Subnav pill은 무겁다

현재 `TourTabsNav`는 active tab에 `bg-foreground text-white` pill을 사용한다. Sticky nav 자체도 있고, active pill도 강해서 본문보다 navigation이 더 무겁게 느껴질 수 있다.

찬성:

- active state를 underline 또는 가벼운 brand text로 바꾸는 방향은 좋다.
- 오른쪽 fade만 있고 왼쪽 fade가 없는 문제도 맞다.
- active section 계산이 entries 순서에 의존하는 점도 개선 여지가 있다.

권장:

- Phase 1에서 바로 손봐도 좋다.
- 다만 완전한 디자인 변경보다 먼저 active style을 가볍게 낮추는 방식이 안전하다.

### 2.7 Accordion 과잉은 실제 UX 문제다

현재 상세페이지에는 여러 종류의 accordion이 반복된다.

문제는 사용자가 "읽는" 것이 아니라 계속 "열어야" 한다는 점이다. 상세페이지의 중요한 목적은 예약 전 불안을 줄이는 것인데, 핵심 정보가 접혀 있으면 오히려 불안이 남는다.

찬성:

- FAQ와 Practical 정도만 accordion으로 남긴다.
- Included, Fit, Support 중 일부는 기본 노출하는 것이 좋다.
- nested accordion은 줄여야 한다.

## 3. 조건부 찬성하는 항목

### 3.1 Hero를 크게 키우는 제안

Claude 플랜은 hero가 너무 작다고 지적한다. 이 지적은 일부 맞다. 현재 hero는 데스크톱에서도 `max-h-[360px]`로 제한되어 있다.

하지만 "바로 60vh로 키우자"는 제안에는 반대한다.

상세페이지는 랜딩 페이지가 아니다. 상세페이지의 목표는 감성 임팩트만이 아니라:

- 상품명 이해
- 가격 확인
- 일정 확인
- 예약 가능 여부 확인
- CTA 진입

이다. hero를 너무 크게 만들면 예약 정보가 아래로 밀린다.

조건부 찬성:

- `max-h-[360px]`는 약간 완화할 수 있다.
- autoplay를 끄는 것은 찬성한다.
- hero image를 edge-to-edge에 가깝게 정리하는 것도 찬성한다.

보류:

- 60vh hero
- full-screen swipe gallery
- hero 위에 모든 정보를 overlay

권장:

```text
Phase 1: autoplay off, hero shadow/radius 정리
Phase 2: height cap 완화 QA
Phase 3: gallery 구조 개편 검토
```

### 3.2 Hero에 title/price/location/rating overlay

Klook식 상세페이지라면 hero overlay가 익숙하다. 하지만 현재 구현은 "이미지 위 텍스트 없음"을 의도한 구조다.

Overlay를 넣을 때 생기는 리스크:

- 다국어 제목 줄바꿈 문제
- 사진 가독성 문제
- save/share 버튼과 충돌
- 모바일 first fold가 너무 복잡해짐
- booking CTA와 가격 정보의 역할 중복

조건부 찬성:

- rating/location 정도의 가벼운 overlay는 실험 가능
- price overlay는 booking card와 중복되므로 신중해야 한다.
- title overlay는 다국어 QA 후 결정해야 한다.

### 3.3 Trust strip 위치 변경

Claude 플랜은 trust strip이 hero 바로 아래에 있어 위치가 잘못됐다고 본다.

나는 절반만 동의한다.

상세페이지에서 free cancellation, instant confirmation, support는 빠르게 보일수록 신뢰에 도움이 된다. 따라서 hero 바로 아래 위치 자체가 완전히 틀렸다고 보지는 않는다.

다만 현재 trust strip은 3개 아이콘이 각각 다른 색이라 시끄럽다.

권장:

- 위치는 유지해도 된다.
- 색상은 단색으로 통일한다.
- 텍스트 크기는 조금 키운다.
- 같은 문구가 booking card/drawer에서 반복되는 횟수는 줄인다.

### 3.4 OTA/Klook/Airbnb 룰을 그대로 가져오는 것

벤치마크는 좋지만, 그대로 복사하면 안 된다.

AtoC Korea 상세페이지는 Klook 같은 대형 OTA와 다르게:

- 상품 수가 적고
- 직접 선별/운영 신뢰가 중요하고
- 투어룸/사후 안내 같은 자체 경험으로 확장될 수 있고
- 지역/일정 설명의 밀도가 더 높다.

따라서 Klook처럼 기능적이고 차가운 정보 구조만 따라가면 브랜드 차별성이 줄어들 수 있다.

조건부 찬성:

- checkout/booking pattern은 Klook/Airbnb를 적극 참고
- visual polish는 Apple/Airbnb의 절제를 참고
- 콘텐츠 서사는 AtoC Korea만의 운영 신뢰를 유지

### 3.5 Watermark 제거

premium 관점에서는 watermark 없는 사진이 더 좋다. 이 점은 맞다.

하지만 watermark가 무단 사용 방지, 내부 운영, 이미지 출처 관리 목적이면 단순 제거는 위험하다.

조건부 찬성:

- hero/gallery에서는 watermark를 제거하거나 아주 약하게 만든다.
- 정책/저작권/이미지 소유권 확인 후 진행한다.
- lightbox에서는 watermark를 제거하는 편이 더 premium하다.

### 3.6 Interactive map 도입

지도 개선은 장기적으로 좋다. 하지만 지금 당장 priority는 아니다.

리스크:

- Google Maps/Mapbox API 비용
- 클라이언트 JS 증가
- 모바일 스크롤/제스처 충돌
- 현재 상세페이지의 스크롤 freeze 이슈와 맞물릴 수 있음

조건부 찬성:

- Phase 3 이후
- static map 또는 lightweight map부터 검토
- booking conversion 개선 후 진행

## 4. 반대하는 항목

### 4.1 Hero를 바로 60vh로 키우는 것

반대한다.

이 변경은 시각 임팩트는 크지만, 상세페이지의 전환 요소를 아래로 밀 수 있다. 특히 모바일에서 가격/CTA/일정 정보 접근이 늦어질 수 있다.

대신:

- autoplay off
- hero shadow 줄이기
- height cap 소폭 완화
- title strip 정리

부터 하는 것이 맞다.

### 4.2 모든 radius를 기계적으로 8/12/16으로 제한

방향은 맞지만 숫자를 너무 기계적으로 적용하면 안 된다.

상세페이지에서 booking card, drawer, modal은 body card보다 더 큰 radius를 가질 수 있다. 중요한 것은 "역할별로 일관되게 쓰는 것"이다.

권장:

```text
chip: 8px or full
small control: 10-12px
body card/photo: 12-16px
booking/drawer/modal: 18-20px
```

### 4.3 Trust strip을 booking card 안으로만 넣는 것

반대한다.

Booking card 안에 trust가 있는 것은 좋지만, hero 직후의 trust strip도 상세페이지 초반 불안을 줄이는 역할을 한다. 완전히 제거하기보다, 반복 횟수와 색상만 줄이는 것이 안전하다.

### 4.4 Phase 1에 너무 많은 시각 변경을 한 번에 넣는 것

Claude 플랜의 Phase 1은 quick wins라고 되어 있지만 실제로는 꽤 큰 변경이다.

예:

- hero autoplay off
- hero overlay 추가
- hero edge-to-edge
- trust strip 변경
- subnav 변경
- at-a-glance 변경
- gallery gutter 변경
- pickup/dropoff 변경
- included/fit/practical/support 배경 제거
- CTA 색 변경
- drawer animation 변경
- watermark 제거

이걸 한 번에 넣으면 어떤 변경이 성과를 냈는지 알 수 없고, 시각 회귀도 추적하기 어렵다.

권장:

- Phase 1을 더 작게 쪼갠다.
- booking/CTA 계열과 visual system 계열을 분리한다.
- hero/gallery 대수술은 뒤로 보낸다.

## 5. 항목별 찬반 표

| 항목 | 평가 | 이유 |
|---|---|---|
| 색상 다이어트 | 찬성 | 페이지 전체 통일감 회복에 가장 중요 |
| Type scale 압축 | 찬성 | 섹션 리듬 통일 필요 |
| Shadow/elevation 정리 | 찬성 | booking card 위계를 살려야 함 |
| Radius 단계 축소 | 조건부 찬성 | 축소는 맞지만 8/12/16 고정은 과함 |
| Mobile drawer 0.78s 단축 | 찬성 | 즉시 체감 개선 |
| CTA `bg-primary` 전환 | 찬성 | 브랜드성과 전환 명확성 강화 |
| CTA에 total price 포함 | 찬성 | 예약 판단에 도움 |
| Subnav pill 경량화 | 찬성 | sticky nav가 덜 무거워짐 |
| Subnav 양쪽 fade | 찬성 | 가로 스크롤 힌트 개선 |
| At-a-glance 6색 제거 | 찬성 | 의미 없는 색상 신호 제거 |
| Trust strip 단색화 | 찬성 | 신뢰 정보가 더 차분해짐 |
| Trust strip 완전 제거 | 반대 | 초반 신뢰 형성에 도움 |
| Hero autoplay off | 찬성 | 사용자가 통제하는 갤러리가 더 좋음 |
| Hero 60vh 확대 | 반대 | 예약 정보가 밀릴 위험 |
| Hero overlay 전면 도입 | 조건부 찬성 | 다국어/모바일 QA 필요 |
| Gallery cream gutter 제거 | 찬성 | 사진이 더 깔끔해짐 |
| Watermark 제거 | 조건부 찬성 | 정책 확인 필요 |
| Accordion 8개 축소 | 찬성 | 정보 접근성 개선 |
| Included/Fit 기본 노출 | 찬성 | 예약 전 불안 해소 |
| Desktop booking card 5블록화 | 찬성 | 전환 흐름 단순화 |
| Tier table expandable | 조건부 찬성 | private/charter 상품에는 필요 |
| Drawer push spacer 제거 | 조건부 찬성 | overlay 방식이 자연스럽지만 레이아웃 QA 필요 |
| Swipe-down dismiss | 찬성 | 모바일 네이티브 감각 강화 |
| Interactive map | 조건부 찬성 | 장기 과제, 성능/비용 검토 필요 |
| Dark mode | 보류 | 현재 전환 개선보다 우선순위 낮음 |

## 6. 내가 제안하는 수정된 실행 순서

### Phase A. 안전한 전환 개선

목표:

- 예약 흐름의 마찰을 줄인다.
- 기능 구조는 유지한다.
- 시각적 리스크가 낮은 항목부터 적용한다.

작업:

1. Mobile drawer animation `0.78s → 0.3s` 수준으로 단축
2. CTA color `bg-foreground → bg-primary`
3. CTA label에 total price 반영 검토
4. Desktop booking card 블록 수 축소
5. Mobile drawer reassurance row 반복 최소화
6. Drawer에 drag handle 추가

이 Phase는 가장 먼저 해야 한다. 전환에 직접 영향을 주고, 디자인 전체를 흔들지 않는다.

### Phase B. 디자인 시스템 다이어트

목표:

- 페이지 전체가 하나의 시스템처럼 보이게 한다.

작업:

1. 공통 type scale 정의
2. 공통 section heading/eyebrow class 정의
3. color role 정의
4. body card elevation e1로 통일
5. booking card/drawer만 e2/e3 사용
6. radius 역할별 정리
7. focus ring 통일

주의:

- 이 단계는 한 번에 모든 컴포넌트를 바꾸기보다, 공통 class를 만들고 섹션별로 적용하는 방식이 좋다.

### Phase C. 콘텐츠 접근성 정리

목표:

- 사용자가 핵심 정보를 열어보지 않아도 이해하게 만든다.

작업:

1. Included 기본 노출
2. Fit 섹션 nested accordion 제거
3. Support steps 기본 노출 또는 간소화
4. Practical/FAQ만 accordion 중심으로 유지
5. Free cancellation/Pay later 반복 횟수 축소

### Phase D. Navigation과 요약 정보 정리

목표:

- 페이지를 훑을 때 구조가 선명하게 보이게 한다.

작업:

1. Subnav active pill 경량화
2. Subnav 양쪽 fade 처리
3. active section 계산 개선
4. At-a-glance 6색 로테이션 제거
5. 숫자/난이도/소요시간을 더 읽기 쉬운 단색 UI로 변경
6. Trust strip 단색화

### Phase E. Hero/Gallery 개선

목표:

- 첫 인상을 고급스럽게 만들되 예약 흐름을 밀어내지 않는다.

작업:

1. Hero autoplay off
2. dot/swipe control 도입
3. hero shadow/radius 정리
4. hero height cap 소폭 완화 후 QA
5. Gallery cream gutter 제거
6. thumbnail 중복 여부 재검토
7. watermark 정책 확인 후 처리

보류:

- 60vh hero
- full-screen gallery
- title/price 전체 overlay

### Phase F. 장기 premium polish

목표:

- 기능 안정화 후 더 큰 경험 개선을 한다.

작업:

1. in-page map 개선
2. review verified badge 강화
3. recommendation card dark overlay 제거
4. skeleton/loading states 정리
5. dark mode 검토

## 7. 즉시 적용해도 좋은 Top 7

우선순위를 하나로 줄이면 다음 7개다.

1. `TourStickyBookingBar` drawer animation 단축
2. Desktop/mobile 예약 CTA를 brand primary로 변경
3. Desktop booking card의 정보 블록 수 줄이기
4. Trust strip 색상 단색화
5. Subnav active pill 경량화
6. At-a-glance 무지개 색 제거
7. Included/Fit/Support accordion 일부 기본 노출

이 7개는 기능을 크게 바꾸지 않으면서도, 사용자 체감과 premium 느낌을 가장 빠르게 개선한다.

## 8. 실행 시 주의해야 할 리스크

### 8.1 상세페이지 스크롤 freeze 이슈

사용자가 이전에 "상세페이지 스크롤 도중 갑자기 멈춰서 조작이 안 된다"고 보고했다. 따라서 scroll-linked motion, heavy blur, layout animation을 늘리는 작업은 조심해야 한다.

주의:

- hero/gallery에 과한 motion 추가 금지
- drawer animation은 짧고 단순하게
- IntersectionObserver는 괜찮지만 매 프레임 layout 측정은 피하기
- backdrop blur는 필요한 곳에만 제한

### 8.2 다국어 레이아웃

상세페이지는 한국어, 영어, 일본어, 중국어, 스페인어가 걸릴 수 있다. hero overlay나 CTA price label 변경은 언어별 줄바꿈을 반드시 확인해야 한다.

### 8.3 Booking 기능 안정성

Booking card와 sticky drawer는 실제 checkout과 연결된다. 이 영역은 시각 개선이라도 QA가 필요하다.

확인:

- 날짜 선택
- 게스트 변경
- duration tier 변경
- availability checking
- unavailable state
- checkout 이동
- sessionStorage bookingData 저장

### 8.4 Performance

상세페이지는 이미 많은 섹션과 이미지, DatePicker, AI assistant, gallery/lightbox를 가진다. 따라서 premium polish라는 이유로 JS와 animation을 늘리면 안 된다.

피해야 할 것:

- 새 slider library
- 새 map library 즉시 도입
- hero video
- heavy scroll animation
- client-only 섹션 증가

## 9. 최종 결론

Claude Code의 플랜은 문제를 잘 잡았다. 특히 색상, 타이포, shadow, radius, accordion, booking CTA의 분산 문제는 실제로 고쳐야 한다.

하지만 이 문서는 "지금 당장 그대로 구현할 작업표"라기보다 **디자인 시스템 통합을 위한 강한 진단서**로 보는 것이 맞다.

내 최종 결정은 다음과 같다.

```text
방향은 채택한다.
전면 리디자인은 보류한다.
예약 전환과 시스템 통일에 직접적인 항목부터 작게 적용한다.
Hero/Gallery 대수술은 후순위로 둔다.
```

가장 좋은 첫 작업은 다음이다.

```text
1. Booking CTA와 drawer 속도 개선
2. 색상/타입/elevation 토큰 정리
3. Subnav와 At-a-glance 경량화
4. Accordion 정보 노출 개선
5. Hero/Gallery는 별도 QA 후 점진 개선
```

이 순서라면 기존 기능과 예약 흐름을 해치지 않으면서도, 상세페이지가 지금보다 훨씬 더 premium하고 신뢰감 있게 보일 수 있다.
