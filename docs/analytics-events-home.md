# Home Analytics Event Taxonomy

작성일: 2026-05-17
연관 플랜: `docs/landing-page-uiux-master-plan-v3-2026-05-17.md` Phase 0a
구현: `src/design/analytics.ts`

## 목적

랜딩 페이지(`/`) 매처 퍼널의 단계별 사용자 행동을 측정하기 위한 이벤트 정의서. v3 Phase 0a에서 정의·와이어링되며, Phase 0b에서 실제 analytics provider(Mixpanel/GA4/PostHog/Vercel 중 1)에 연결될 때 본 문서가 단일 진실 원천이 된다.

`trackEvent`는 현재 `console.log`만 호출. provider 결정 후 본문 교체.

## PII 가드 (절대 위반 금지)

- 매처 intent textarea **본문 절대 전송 금지** — 길이/언어만 (Phase 0a §5 step 2)
- 좌표/호텔명/위경도는 `sanitizePayload`가 자동 제거 (analytics.ts:3-13)
- 사용자 이메일/세션 토큰/결제 정보는 어떤 이벤트에서도 payload에 포함하지 않음

## 이벤트 카탈로그

### 1. `home_hero_intent_focus`

| 항목 | 값 |
|---|---|
| 발화 시점 | 히어로 매처 카드의 intent textarea가 **세션 내 첫 포커스**를 받을 때 1회 |
| Payload | `{}` |
| 와이어링 | `components/home/v2/sections/hero-section.tsx` (`intentFocusFiredRef` 가드) |
| 메서드 | `analytics.homeHeroIntentFocus()` |
| 측정 의도 | 매처 사용 의도 표명률. CTA 클릭까지 안 가도 "관심" 신호 |
| Phase | 0a 와이어링 완료 |

### 2. `home_hero_style_chip_click`

| 항목 | 값 |
|---|---|
| 발화 시점 | 히어로 매처 카드 내 스타일 칩 클릭 |
| Payload | `{ chipId: string }` — 칩 id (e.g., `localFavorite`, `slowPaced`). 사용자 입력 텍스트 아님 |
| 와이어링 | `components/home/v2/sections/hero-section.tsx` style chip onClick |
| 메서드 | `analytics.homeHeroStyleChipClick({ chipId })` |
| 측정 의도 | 어떤 스타일 키워드가 매처 입력 유도 효과가 큰지 분포 |
| Phase | 0a 와이어링 완료 |

### 3. `home_hero_season_chip_click`

| 항목 | 값 |
|---|---|
| 발화 시점 | 시즌 칩 클릭 시. 짧은 phrase 주입과 함께 발화 |
| Payload | `{ season: "springBlossom" \| "lateSpring" \| "summer" \| "autumn" \| "winter" }` |
| 와이어링 | `components/home/v2/sections/hero-section.tsx` season pill (`<button>`) onClick |
| 메서드 | `analytics.homeHeroSeasonChipClick({ season })` |
| 측정 의도 | 시즌 칩이 매처 입력 마찰 줄여주는 효과 |
| Phase | 0a 정의 / Phase C.1 와이어링 완료 (2026-05-17) |

**season enum 정렬:** 코드의 `SeasonKey` (`lib/home/season.ts`)와 일치. 5 값. 현재 `SEASON_BY_MONTH`는 `lateSpring`을 어느 월에도 매핑하지 않아 실제로 발화될 가능성은 낮지만 schema는 유지.

### 4. `home_sticky_cta_click`

| 항목 | 값 |
|---|---|
| 발화 시점 | 스티키 하단 CTA 영역에서 액션 클릭 |
| Payload | `{ action: "focus_matcher" \| "browse_tours" }` |
| 와이어링 | `components/home/v2/StickyHomeCta.tsx` primary 버튼 + secondary Link |
| 메서드 | `analytics.homeStickyCtaClick({ action })` |
| 측정 의도 | Phase D.3 노출 threshold A/B 측정 베이스. sticky surface만 isolation 가능해야 함 |
| Phase | 0a 와이어링 완료 |

**왜 별도 이벤트인가 (기존 `home_cta_click` source 통합 안 한 이유):**
- Phase D.3 threshold A/B는 sticky-only 클릭률을 hero CTA와 분리해서 측정해야 함
- 기존 `HomeCtaSource` enum이 이미 11개 값 — 추가 시 분석 복잡도 증가
- sticky는 노출 조건이 hero CTA와 본질적으로 다른 surface (게이팅된 별도 영역)

### 5. `home_match_preview_visible`

| 항목 | 값 |
|---|---|
| 발화 시점 | 매처 결과 미리보기 영역이 viewport 30% 이상 노출 + phase 전환 시 |
| Payload | `{ phase: "idle" \| "loading" \| "result" }` |
| 와이어링 | `components/home/v2/DeferredBestMatchPreview.tsx` IntersectionObserver (threshold 0.3) |
| 메서드 | `analytics.homeMatchPreviewVisible({ phase })` |
| 측정 의도 | 매처 결과까지 도달한 사용자 비율 + 각 phase 노출률 |
| Phase | 0a 와이어링 완료 (loading/result만 즉시 발화. `idle` phase는 Phase B.2 IdleCarousel 도입 후 활성) |

**phase 명명:** provider의 `HomeV2MatchPhase` (`idle`/`loading`/`result`)와 정렬. 플래너 본문은 "success"로 적혔으나 코드 일관성을 위해 `result` 채택.

### 6. `home_featured_card_click`

| 항목 | 값 |
|---|---|
| 발화 시점 | Featured 상품 카드 클릭 (메인 섹션 또는 idle preview 캐러셀) |
| Payload | `{ source: "idle_preview" \| "regular_section", slug: string }` |
| 와이어링 | `components/home/v2/sections/featured-products-showcase.tsx` (regular_section). idle_preview는 Phase B.2에서 와이어링 |
| 메서드 | `analytics.homeFeaturedCardClick({ source, slug })` |
| 측정 의도 | Phase B.2 idle carousel 도입 후 "idle 카드가 실제 클릭 흡수하는 비율" 측정 |
| Phase | 0a 와이어링 완료 (regular_section). idle_preview는 Phase B.2 |

### 7. `home_destination_card_click`

| 항목 | 값 |
|---|---|
| 발화 시점 | Destinations 섹션의 도시 카드(Seoul/Busan/Jeju) 클릭 |
| Payload | `{ destination: string }` — `Seoul` \| `Busan` \| `Jeju` |
| 와이어링 | `components/home/v2/sections/destinations-showcase.tsx` (DestinationCard `onClick` prop) |
| 메서드 | `analytics.homeDestinationCardClick({ destination })` |
| 측정 의도 | Featured와 Destinations 중 어느 entry가 더 큰 분기 흡수하는지 |
| Phase | 0a 와이어링 완료 |

## 결정 로그 (이 문서 내 한정)

| 날짜 | 결정 | 이유 |
|---|---|---|
| 2026-05-17 | sticky CTA는 별도 이벤트 (`home_sticky_cta_click`), `home_cta_click` source 통합 안 함 | Phase D.3 A/B isolation + HomeCtaSource 단순성 |
| 2026-05-17 | match preview phase 값을 `idle/loading/result`로 채택 (플래너 "success" 대신) | provider `HomeV2MatchPhase` 코드와 일관 |
| 2026-05-17 | `home_hero_intent_focus`는 세션 내 첫 포커스만 (ref 가드) | 매 키 입력마다 발화하면 노이즈 |
| 2026-05-17 | `home_match_preview_visible`은 IntersectionObserver threshold 0.3 + phase 전환마다 발화 | 단순 phase 변화는 viewport 밖에서도 일어남 — 실제 사용자 노출만 카운트 |
| 2026-05-17 | featured/destination 카드 트래킹은 wrapper div onClick 사용 (TourListCard 비침습) | TourListCard 공유 컴포넌트. wishlist는 이미 `stopPropagation` (L63) |

## 후속 작업 (out of Phase 0a scope)

- **Phase 0b:** provider SDK 결정 후 `trackEvent` 본문 교체. 후보: Mixpanel / GA4 / PostHog / Vercel Analytics
- **Phase 0c:** 모바일 fold 측정. `home_hero_intent_focus` 발화율로 fold 영향 측정 가능
- **Phase B.2:** Idle preview carousel 도입 시 `home_match_preview_visible({ phase: "idle" })` + `home_featured_card_click({ source: "idle_preview" })` 활성
- **Phase C.1:** 시즌 칩 인터랙티브화 시 `home_hero_season_chip_click` 와이어링
- **Phase D.3:** Sticky threshold A/B variant 분기 시 `home_sticky_cta_click`에 `variant` 필드 추가 검토

## 검증

dev 환경에서 7개 이벤트가 `[analytics]` 콘솔 로그로 발화하는지 직접 클릭 테스트. provider 미연결 상태에선 console.log가 유일한 검증 수단.
