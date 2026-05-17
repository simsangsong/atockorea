# 랜딩 페이지 UI/UX 업그레이드 플랜 검토 의견

작성일: 2026-05-17  
검토 대상: `docs/landing-page-uiux-upgrade-plan-2026-05-17.md`  
참조 문서: `docs/landing-page-uiux-audit-2026-05-16.md`  
검토 방식: 문서 논리 검토 + 현재 코드 대조

## 1. 최종 평가

나는 이 수정안에 **대체로 찬성**한다. 특히 "기능 부족"이 아니라 "약속과 증명의 시차"라는 진단은 정확하고, 1차 audit보다 실행 관점에서 더 좋다.

다만 그대로 마스터 플랜으로 확정하기에는 세 가지 보정이 필요하다.

1. `StickyHomeCta`는 이미 히어로 통과 후 노출되도록 구현되어 있다. 따라서 "즉시 구현"이 아니라 "기준 조정 및 QA" 항목으로 내려야 한다.
2. Phase 0 계측을 별도 선행 단계로 두는 방향은 맞지만, 현재 `analytics.ts`가 실제 수집기가 아니라 `console.log` 수준이다. "baseline 수집"이라고 부르려면 수집 대상이 실제로 연결되어야 한다.
3. `DeferredBestMatchPreview` idle preview는 찬성하지만, 홈 첫 화면 성능과 정보 밀도를 해치지 않도록 "아래쪽 증명 영역"으로 제한해야 한다. 히어로 내부로 끌어올리는 방식은 보류가 맞다.

따라서 내 결론은 다음과 같다.

> **수정안은 방향 채택. 단, Phase 0/1의 실제 작업 항목을 코드 현실에 맞게 재분류해서 진행한다.**

## 2. 문서의 좋은 점

### 2.1 "약속과 증명의 시차" 진단은 매우 좋다

1차 audit은 "매칭 입력 카드가 늦게 보인다"는 쪽으로 문제를 크게 잡았다. 하지만 실제 코드와 화면을 보면 히어로는 이미 매처를 꽤 강하게 안내하고 있다.

더 정확한 문제는 이 수정안이 말한 것처럼:

- 히어로에서 "맞는 투어가 30초 안에 뜬다"고 약속한다.
- 하지만 입력 전에는 결과 예시가 없다.
- 실제 상품 카드는 `Destinations`, `Style` 뒤에 온다.
- 사용자는 약속 직후 결과의 모양을 확인하지 못한다.

이 진단은 채택해야 한다.

### 2.2 Featured를 Destinations 앞으로 올리는 제안은 찬성

현재 흐름:

```text
Hero → DeferredBestMatchPreview → Destinations → Style → Featured → Why → Process → FinalCTA
```

추천 흐름:

```text
Hero → DeferredBestMatchPreview → Featured → Destinations → Style → Why → Process → FinalCTA
```

이 변경은 작지만 효과가 크다. 사용자는 매칭 약속 직후 실제 상품을 보게 된다. 지역/스타일 분기는 탐색을 돕지만, 전환 관점에서는 실제 예약 가능한 상품보다 앞에 오면 모멘텀이 끊긴다.

이 항목은 **찬성, 즉시 적용 가능**이다.

### 2.3 idle preview 제안은 찬성

현재 `DeferredBestMatchPreview`는 `phase === "idle"`일 때 `null`을 반환한다.

```tsx
if (phase === "idle") return null;
```

이 구조는 성능에는 좋지만, UX 관점에서는 "입력하면 무엇을 받는지"를 보여주지 못한다. idle 상태에서 슬림한 결과 예시를 보여주는 제안은 맞다.

단, 가짜 상품을 만들기보다 실제 Featured 상품을 재사용하자는 방향이 특히 좋다.

채택 조건:

- 새 API 호출 없이 기존 Featured/정적 데이터 재사용
- `next/image` priority 금지
- idle preview는 히어로 위가 아니라 히어로 다음 증명 영역에 배치
- "추천 예시"임을 명확히 표시
- 실제 매칭 결과가 나오면 기존 결과 UI로 자연스럽게 교체

### 2.4 H1을 바로 바꾸지 말자는 의견은 찬성

1차 audit에서는 H1을 더 기능적으로 바꾸는 안을 강하게 제안했다. 하지만 현 H1:

```text
당신의 한국 하루, 직접 선별.
```

그리고 서브카피:

```text
스타일만 알려주세요 - 맞는 투어가 30초 안에 떠요.
```

이 조합은 브랜드 감성과 기능 약속을 동시에 담고 있다. 당장 H1을 기능 설명형으로 바꾸면 전환은 오를 수 있지만 브랜드 톤이 평평해질 위험이 있다.

따라서 수정안처럼:

- 현재 H1은 유지
- 기능형 H1은 A/B 후보로만 관리
- 먼저 순서, idle preview, CTA 계층을 손본 뒤 판단

이 방향에 찬성한다.

### 2.5 "가짜 추천 예시 금지"는 찬성

1차 audit의 예시였던 "제주 동부 자연 코스" 같은 정적 가짜 카드는 빠르게 이해시키기에는 좋지만, 실제 상품과 연결되지 않으면 신뢰를 해칠 수 있다.

수정안의 제안처럼 실제 Featured 상품을 사용하면:

- 신뢰가 높다.
- 링크가 실제 상품으로 이어진다.
- 콘텐츠 관리 비용이 늘지 않는다.
- "이런 식으로 추천됩니다"라는 증명 역할을 한다.

이 항목은 강하게 찬성한다.

## 3. 반대 또는 수정이 필요한 점

### 3.1 StickyHomeCta 항목은 현재 코드와 다르다

수정안은 `StickyHomeCta`가 첫 화면부터 노출되어 히어로 CTA와 경쟁한다고 말한다. 그러나 현재 코드 기준으로는 이미 게이팅이 들어가 있다.

현재 구현:

- `[data-home-hero]`를 IntersectionObserver로 추적
- hero의 bottom이 viewport 위로 올라갔을 때 `heroOut = true`
- `footerIn`이면 숨김
- `show = heroOut && !footerIn`

즉, "첫 화면부터 노출"이라는 진단은 현재 코드 기준으로는 틀렸다.

다만 개선 여지는 있다.

현재 기준:

```tsx
setHeroOut(rect.bottom < 0);
```

이것은 히어로가 완전히 지나간 뒤에만 Sticky가 뜬다는 뜻이다. 수정안이 말한 "50% 이상 벗어났을 때"는 더 이른 노출이다.

내 평가는 다음과 같다.

- "Sticky가 첫 화면 CTA와 경쟁한다"는 진단: **반대**
- "노출 기준을 더 정교하게 QA하자"는 제안: **조건부 찬성**
- "즉시 구현 15줄" 항목: **이미 구현된 것으로 재분류**

권장 처리:

```text
Phase 1 신규 작업 → Phase 1 QA/미세조정 항목
```

### 3.2 Phase 0 계측은 맞지만 현재 analytics 상태를 과대평가하면 안 된다

수정안은 Phase 0에서 baseline을 측정하자고 한다. 방향은 맞다. 하지만 현재 `src/design/analytics.ts`의 `trackEvent`는 실제 분석 도구 전송이 아니라 console 출력이다.

현재 코드:

```tsx
console.log("[analytics]", event, data);
// replace later with actual analytics provider
```

따라서 "1일 데이터 수집 후 baseline 기록"은 현재 상태만으로는 불가능하다.

내 평가는 다음과 같다.

- 계측 이벤트 정의 추가: **찬성**
- Phase 0을 최우선으로 두는 것: **찬성**
- 실제 baseline 수집 가능하다고 가정하는 것: **반대**

권장 처리:

1. 이벤트 taxonomy를 먼저 추가한다.
2. 실제 analytics provider 연결 여부를 확인한다.
3. provider가 없으면 "baseline 수집"이 아니라 "계측 훅 추가 및 콘솔 검증"으로 범위를 낮춘다.
4. provider 연결 후 1-2일 baseline을 본다.

### 3.3 시즌 칩 인터랙티브화는 좋지만 Phase 2보다 뒤가 안전할 수 있다

시즌 칩을 버튼으로 바꾸고 intent phrase를 주입하는 제안은 UX적으로 매력적이다. 하지만 히어로 상단의 시즌 칩은 현재 "분위기와 시의성" 역할이다. 이걸 클릭 가능한 기능으로 바꾸면 사용자가 예상하지 못한 입력 조작이 발생할 수 있다.

찬성 조건:

- 버튼 affordance가 너무 강하지 않아야 한다.
- 클릭 후 intent 입력 필드에 문구가 들어갔다는 피드백이 있어야 한다.
- 키보드 접근성과 aria-label이 있어야 한다.
- 클릭이 히어로의 시각적 안정감을 깨지 않아야 한다.

내 평가는 **조건부 찬성**이다. Phase 2에 넣어도 되지만, 먼저 idle preview와 섹션 순서 변경을 적용한 뒤 실제 필요성이 남는지 보는 편이 더 좋다.

### 3.4 in-place 매처 결과 morphing은 신중해야 한다

매처 카드 자체가 결과 카드로 변형되는 경험은 제품적으로 강하다. 하지만 리스크도 크다.

리스크:

- 카드 높이 변화로 모바일 레이아웃이 크게 흔들릴 수 있다.
- 입력 폼과 결과 카드가 같은 공간을 공유하면 "다시 수정" 흐름이 복잡해진다.
- 현재 `BestMatchPreview`가 별도 섹션으로 존재하는 구조와 역할 충돌이 생긴다.
- framer-motion layout animation이 detail page scroll freeze 문제와 같은 성능 민감 영역에 부담을 줄 수 있다.

따라서 이 항목은 수정안처럼 Phase 3 이후 A/B로 분리하는 데 찬성한다. 즉시 구현은 반대다.

## 4. 항목별 찬반 표

| 항목 | 평가 | 이유 |
|---|---|---|
| "약속과 증명의 시차"를 핵심 문제로 정의 | 찬성 | 가장 정확한 진단 |
| Featured를 Destinations 앞으로 이동 | 찬성 | 실제 상품 증명을 앞당김 |
| DeferredBestMatchPreview idle preview 추가 | 찬성 | null 상태를 증명 영역으로 전환 |
| 실제 Featured 상품을 idle preview에 사용 | 찬성 | 가짜 카드보다 신뢰 높음 |
| StickyHomeCta 게이팅 신규 구현 | 반대 | 이미 구현되어 있음 |
| StickyHomeCta 노출 기준 QA/미세조정 | 조건부 찬성 | 0%/50% 기준 비교 가능 |
| matcher 헤더 3단 슬림화 | 찬성 | H1/서브카피와 중복 줄임 |
| Trust 라벨 한글화, 플랫폼명 유지 | 찬성 | 신뢰 자산을 유지하면서 이해도 개선 |
| H1 즉시 기능형 교체 | 반대 | 브랜드 톤 손실 위험 |
| H1 A/B 후보 관리 | 찬성 | 데이터 기반 판단 가능 |
| 시즌 칩 인터랙티브화 | 조건부 찬성 | 좋은 아이디어지만 피드백 설계 필요 |
| in-place 결과 morphing | 조건부 찬성 | Phase 3 이후 A/B로만 |
| OTA 로고 strip | 조건부 찬성 | 라이선스 확인 필요 |
| 공통 scroll reveal | 조건부 찬성 | 과하면 성능/프리미엄 톤 저하 |
| 새 라이브러리/비디오/캐러셀 금지 | 찬성 | 성능과 톤 보호 |
| Phase 0 baseline | 조건부 찬성 | 실제 provider 연결 전에는 baseline 불가 |

## 5. 내가 제안하는 수정된 실행 순서

### Phase A. 계측 기반 정리

목표:

- 이벤트 이름과 payload를 정리한다.
- 현재 console 기반 analytics의 한계를 명확히 한다.
- 실제 provider가 있다면 연결 지점을 확인한다.

작업:

- `home_hero_intent_focus`
- `home_hero_style_chip_click`
- `home_sticky_cta_click`
- `home_match_preview_visible`
- `home_featured_card_click`
- `home_destination_card_click`

주의:

- 기존 `home_cta_click`과 중복되는 이벤트는 source로 흡수할지, 별도 이벤트로 둘지 결정해야 한다.
- 개인정보가 들어갈 수 있는 intent text 자체는 절대 보내지 않는다.

### Phase B. 가장 안전한 전환 개선

목표:

- 레이아웃과 브랜드 톤을 크게 건드리지 않고 약속-증명 시차를 줄인다.

작업:

1. `HomeV2Page`에서 Featured를 Destinations 앞으로 이동
2. `DeferredBestMatchPreview` idle 상태에 슬림 preview 추가
3. matcher 헤더 3단을 1-2단으로 슬림화
4. Trust 라벨 자연어화, 플랫폼명 유지
5. StickyHomeCta 현재 동작 QA

이 Phase가 가장 먼저 구현되어야 한다.

### Phase C. 상호작용 강화

목표:

- 사용자가 더 쉽게 매칭 입력을 시작하게 만든다.

작업:

1. 시즌 칩 인터랙티브화
2. 스타일 칩 클릭 이벤트 계측
3. intent focus 이벤트 계측
4. 매칭 결과 visible 이벤트 계측

주의:

- 시즌 칩 클릭 후 입력 필드에 값이 들어가는 것을 사용자가 알아야 한다.
- 자동 스크롤/자동 포커스는 과하면 방해가 될 수 있다.

### Phase D. 실험성 높은 제품 경험

목표:

- 매칭 카드 안에서 결과가 바로 나오는 제품 서사를 실험한다.

작업:

- in-place result morphing A/B
- 기존 `BestMatchPreview`는 비교 영역으로 역할 재정의
- 실패/재시도/수정 흐름 설계

이 Phase는 반드시 분리해야 한다. Phase B와 함께 넣으면 어떤 변경이 성과를 냈는지 알기 어렵다.

### Phase E. 시각 정체성 확장

목표:

- 히어로의 프리미엄 모션 톤을 아래 섹션에 가볍게 이어준다.

작업:

- 공통 scroll reveal
- OTA logo strip 검토

주의:

- detail page에서 이미 스크롤 freeze 문제가 보고된 만큼, scroll-linked motion을 늘리는 작업은 특히 조심해야 한다.
- IntersectionObserver 기반 reveal은 괜찮지만, 과한 `useScroll`/layout animation 증가는 피한다.

## 6. 수정안 문서에서 고치면 좋은 문장

### 원문

```text
StickyHomeCta — 첫 화면부터 노출되어 매처 CTA와 시각 경쟁
```

수정 제안:

```text
StickyHomeCta는 현재 hero bottom이 viewport 위로 지나간 뒤 노출된다. 첫 화면 경쟁은 현재 코드 기준으로는 확인되지 않는다. 다만 노출 타이밍과 CTA source 분배는 QA/계측 대상이다.
```

### 원문

```text
Phase 0 — 계측 baseline (0.5일)
```

수정 제안:

```text
Phase 0 — 계측 이벤트 정의 및 provider 연결 확인. 실제 analytics provider가 연결되어 있을 때만 baseline 수집 단계로 전환한다.
```

### 원문

```text
DeferredBestMatchPreview idle preview: 실제 Featured 1장 preview
```

수정 제안:

```text
DeferredBestMatchPreview idle preview: 실제 Featured 1장 또는 2장 preview. 단, 추가 API 호출 없이 기존 정적/캐시 데이터를 사용하고 LCP 영향이 없도록 lazy image로 제한한다.
```

## 7. 최종 권장 결정

이 수정안은 **채택하되, 마스터 플랜으로 확정하기 전에 아래 세 줄을 반영**하는 것이 좋다.

1. `StickyHomeCta`는 신규 구현 항목이 아니라 현재 구현 검증 및 노출 기준 조정 항목이다.
2. Phase 0은 "baseline 수집"이 아니라 "계측 정의 + provider 확인"부터 시작한다.
3. Phase 1의 핵심은 `Featured` 선배치와 `idle preview` 추가이며, H1 교체나 in-place morphing은 뒤로 미룬다.

실제 구현 우선순위는 다음이 가장 안전하다.

```text
1. 계측 이벤트 설계 및 provider 확인
2. Featured ↔ Destinations 순서 변경
3. DeferredBestMatchPreview idle preview 추가
4. matcher 헤더 슬림화
5. Trust 라벨 자연어화
6. StickyHomeCta QA
7. 시즌 칩 인터랙티브화
8. in-place result morphing A/B
```

이 순서라면 기능과 디자인을 크게 흔들지 않으면서, 랜딩의 가장 큰 병목인 "약속 후 증명 부족"을 빠르게 줄일 수 있다.
