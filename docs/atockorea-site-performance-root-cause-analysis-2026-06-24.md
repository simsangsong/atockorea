# AtoC Korea 사이트 전반 로딩 속도 저하 원인 분석

작성일: 2026-06-24  
작성/정리: Codex 코드 감사 기반  
대상: 메인 홈, 투어 리스트, 상품 카드/상세, 일정 빌더, 어드민 주요 API

> 이 문서는 코드 레벨 정적 분석과 로컬 빌드 검증을 기반으로 정리한 성능 저하 원인 보고서다. 실제 Web Vitals/프로덕션 APM 수치가 붙은 계측 보고서는 아니며, 병목 가능성이 높은 코드 경로를 우선순위로 정리했다.

---

## 0. 결론 요약

현재 체감 속도 저하의 1차 원인은 특정 한 지점이 아니라, 메인에 서빙되는 여러 경로에서 다음 패턴이 동시에 겹친 것이다.

1. 상품 카드 이미지/미디어를 서버에서 이미 준비한 뒤 클라이언트에서 다시 `no-store`로 재요청한다.
2. 투어 리스트 API가 최대 500개 단위로 넓게 가져오고, 필터 조건에 따라 내부 fetch span을 900~2200까지 확장한다.
3. 일정 빌더 POI API가 지역별로 700KB~1.3MB 이상의 무거운 JSON을 한 번에 내려준다.
4. 카드 미디어 API가 `force-dynamic`, `revalidate = 0`, `Cache-Control: no-store` 구조라 CDN/브라우저 캐시를 사실상 못 탄다.
5. 어드민/orders/stats/tours API가 `select('*')`, 대량 행 JS reduce, 잘못된 count 처리 등으로 서버 메모리와 응답 시간을 키운다.
6. 상세/리스트/홈/추천 섹션이 같은 카드 미디어 resolver를 반복 호출해 Supabase 쿼리가 중복된다.

즉, “빌더가 느리다”와 “tours 리스트 진입이 느리다”는 별도 문제가 아니라, 같은 구조적 원인인 **과한 payload + 중복 fetch + 캐시 무력화 + 서버 측 overfetch**가 서로 다른 화면에서 드러난 현상이다.

---

## 1. 가장 큰 병목: 상품 카드 미디어 중복 로딩

### 관련 코드

- `app/tours/list/page.tsx`
- `app/tours/list/ToursListClient.tsx`
- `hooks/useTourProductCardMedia.ts`
- `app/api/tour-product-card-media/route.ts`
- `lib/tour-product/resolveTourProductCardMedia.server.ts`
- `components/tours-list/ShelvesContainer.tsx`
- `components/home/v2/sections/featured-products-showcase.tsx`
- `components/product-tour-static/east-signature-nature-core/tour-detail-sections/TourRecommendationsSection.tsx`

### 발견 내용

투어 리스트는 서버에서 카드 미디어를 미리 가져와 `initialMediaBySlug`로 넘긴다. 그런데 클라이언트 훅 `useTourProductCardMedia()`가 같은 slug/locale 조합에 대해 다시 `/api/tour-product-card-media`를 호출한다.

문제는 이 API가 캐시 불가능하게 설정되어 있다는 점이다.

- `force-dynamic`
- `revalidate = 0`
- 응답 헤더 `Cache-Control: no-store`
- 클라이언트 fetch도 `cache: 'no-store'`

결과적으로 홈, 투어 리스트, 상세 추천 카드에서 같은 썸네일 정보를 반복해서 새로 요청한다.

### 왜 느려지는가

카드 이미지는 첫 화면 체감 성능에 직접 영향을 준다. 현재 구조는 다음 순서로 비용이 발생한다.

1. 서버 렌더 단계에서 slug별 미디어 조회
2. 클라이언트 hydration 이후 같은 데이터 재요청
3. API 내부에서 slug별 Supabase 조회
4. 캐시 불가라 다음 방문/뒤로가기/언어 전환에서도 재반복

### 영향

- `/tours/list` 초기 진입 지연
- 홈 featured/product shelf 지연
- 상세 하단 recommendation 카드 지연
- 모바일에서 카드 이미지가 늦게 바뀌거나 flicker 발생 가능

### 개선 방향

- `initialMediaBySlug`가 있는 경우 클라이언트 재요청을 생략한다.
- 카드 미디어 API는 짧은 TTL이라도 적용한다. 예: `s-maxage=300, stale-while-revalidate=3600`.
- admin 저장 직후 반영이 꼭 필요하면 version key 또는 revalidation tag를 사용한다.
- slug 배열 단위 resolver를 1~2쿼리로 고정하고, 카드별 쿼리를 금지한다.

---

## 2. 투어 리스트 API overfetch

### 관련 코드

- `app/tours/list/ToursListClient.tsx`
- `app/api/tours/route.ts`

### 발견 내용

클라이언트는 기본적으로 `limit=500`을 요청한다.

서버 API는 필터/정렬 조건에 따라 내부적으로 더 넓은 범위를 가져온다.

- fetch span이 900~2200까지 확대될 수 있음
- 추가로 product media query 수행
- 반환 tour id 기준 booking count를 별도 집계
- 일부 집계/정렬이 DB가 아니라 JS에서 처리됨

### 왜 느려지는가

사용자가 제주/부산/서울 필터 하나를 눌러도 서버는 “화면에 보이는 24장”이 아니라 훨씬 넓은 후보군을 가져와 후처리한다. 여기에 카드 미디어 조회와 예약 수 집계가 붙으면서 응답 지연이 커진다.

### 영향

- `/tours/list?destination=jeju` 같은 필터 진입이 느림
- 정렬 변경 시 응답 지연
- 모바일 네트워크에서 첫 리스트 렌더 지연
- 서버 함수 실행 시간 증가

### 개선 방향

- API 페이지네이션을 실제 서버 페이지네이션으로 바꾼다.
- 최초 응답은 24~36개 정도만 내려주고, 이후 cursor 기반 load more로 확장한다.
- booking count는 실시간 JS 집계 대신 materialized count 또는 denormalized counter 사용.
- product media는 API 응답에 이미 붙이거나, 별도 호출을 cacheable하게 분리한다.

---

## 3. 일정 빌더 POI payload 과다

### 관련 코드

- `app/api/itinerary-builder/pois/route.ts`
- `components/home/v2/sections/home-builder-section.tsx`
- `components/itinerary-builder/*`

### 발견 내용

POI API가 지역 단위로 매우 풍부한 필드를 한 번에 내려준다.

대표적으로 포함되는 필드:

- `description`
- `highlights`
- `images`
- `why_on_route`
- `smart_notes`
- `visit_basics`
- `convenience`
- 기타 빌더/추천용 상세 데이터

이전 분석에서 확인한 대략적 payload:

| Region | Rows | JSON 크기 |
| --- | ---: | ---: |
| Jeju | 61 | 약 1.316MB |
| Seoul | 다수 | 1.36MB 이상 가능 |
| Busan | 다수 | 약 728KB |

### 왜 느려지는가

빌더 첫 진입 또는 지역 변경 시 UI에 당장 필요하지 않은 상세 설명/이미지/운영 메모까지 모두 내려온다. 모바일에서는 이 JSON 다운로드, 파싱, React state 반영만으로도 체감 지연이 생긴다.

### 영향

- 빌더 열기/지역 변경이 느림
- 홈 안에 빌더가 있을 경우 홈 전체 반응성 저하
- 모바일에서 CPU 파싱 비용 증가
- POI 카드가 많을수록 렌더 비용 증가

### 개선 방향

- POI 리스트 API와 POI 상세 API를 분리한다.
- 리스트에는 `poi_key`, `title`, `category`, `lat/lng`, `thumbnail`, `short_label`, `duration_hint` 정도만 내려준다.
- 상세 설명, smart notes, visit basics는 POI 선택/상세 drawer 열 때 lazy-load한다.
- 지역별 POI 응답은 gzip/br + CDN TTL 적용.
- 홈에서는 빌더가 실제로 열리기 전까지 POI를 가져오지 않는다.

---

## 4. 홈/리스트/상세가 같은 미디어 계층을 반복 사용

### 관련 코드

- `components/home/v2/sections/featured-products-showcase.tsx`
- `components/tours-list/ShelvesContainer.tsx`
- `components/product-tour-static/east-signature-nature-core/tour-detail-sections/TourRecommendationsSection.tsx`
- `hooks/useTourProductCardMedia.ts`

### 발견 내용

같은 상품 카드 미디어가 여러 화면에서 재사용되지만, 공통 캐시 계층이 약하다. 특히 상세 페이지 하단 추천 섹션도 카드 미디어 훅을 호출한다.

### 왜 느려지는가

사용자가 홈 → 리스트 → 상세로 이동할수록 이미 봤던 상품 카드 이미지 메타를 계속 다시 가져온다. 이미지 자체는 CDN 캐시가 탈 수 있어도, “어떤 이미지를 보여줄지 결정하는 API”가 캐시되지 않으면 라우트 전환마다 지연이 반복된다.

### 개선 방향

- 카드 미디어 resolution 결과를 앱 전역 cache key로 공유한다.
- 서버 컴포넌트에서 이미 전달한 media map은 client fetch의 seed로만 쓰지 말고 “fresh enough” 판단에 사용한다.
- admin 저장 직후 반영은 tag revalidate로 해결한다.

---

## 5. Admin API 대량 조회가 서버 리소스를 잡아먹음

### 관련 코드

- `app/api/admin/stats/route.ts`
- `app/api/admin/orders/route.ts`
- `app/api/admin/tours/route.ts`

### 발견 내용

어드민 API에서도 다음 패턴이 확인된다.

- `stats`: paid bookings를 넓게 조회한 뒤 JS에서 reduce
- `orders`: `select('*')`, 최대 5만 행 적재 가능, count가 전체가 아니라 페이지 길이에 가까움
- `tours`: `*, pickup_points(*)` heavy select

### 왜 사이트 전반에 영향을 줄 수 있는가

어드민과 고객 사이트가 같은 Next/Supabase 프로젝트 자원을 공유한다면, 어드민 대시보드 접속이나 데이터 많은 API 호출이 서버 함수 시간, DB connection, Supabase 응답 지연을 키울 수 있다.

### 개선 방향

- admin list API는 반드시 서버 페이지네이션 + 명시 컬럼 select 적용.
- stats는 DB aggregation 또는 materialized summary로 이동.
- orders count는 PostgREST `count: 'exact'` 또는 별도 count query로 분리.
- CSV export와 화면 리스트 API를 분리한다.

---

## 6. 캐시 정책 불일치

### 관련 코드

- `next.config.js`
- `app/api/tour-product-card-media/route.ts`
- `hooks/useTourProductCardMedia.ts`
- `app/tour-product/[slug]/page.tsx`

### 발견 내용

이미지 변환 캐시는 강하게 잡혀 있다.

- `images.minimumCacheTTL = 31536000`

하지만 이미지 메타/API 쪽은 반대로 캐시를 막는다.

- 카드 미디어 API: `no-store`
- 상세 페이지: `dynamic = 'force-dynamic'`, `revalidate = 0`
- 클라이언트 fetch: `cache: 'no-store'`

### 왜 느려지는가

브라우저/Next image optimizer는 이미지 파일 자체를 오래 캐시할 수 있지만, 어떤 이미지 URL을 써야 하는지 결정하는 API가 매번 새로 실행된다. 따라서 이미지 캐시 정책의 장점이 반감된다.

### 개선 방향

- “상품 상세 본문”과 “카드 미디어 메타”의 캐시 정책을 분리한다.
- 상세 페이지는 즉시 반영이 필요한 admin preview와 public page를 분리한다.
- public detail은 짧은 ISR 또는 route segment cache를 적용한다.
- admin 저장 후 필요한 slug만 revalidate한다.

---

## 7. 정적 카탈로그와 DB 상품의 이중 소스

### 관련 코드

- `components/product-tour-static/catalog/staticTourCatalogCards.ts`
- `components/product-tour-static/catalog/catalogCards.generated.ts`
- `components/product-tour-static/_shared/tourProductBundleRegistry.ts`
- `app/api/tours/route.ts`
- `app/tour-product/[slug]/page.tsx`
- `lib/tour-consumer-visibility.ts`

### 발견 내용

상품 리스트와 상세는 정적 JSON bundle, DB `tours`, DB `tour_product_pages`를 함께 사용한다.

상세 페이지는 `isStaticTourProductBundleRegistered(slug)`를 통과한 slug만 렌더한다. 리스트 API는 DB tour row를 기반으로 내려오고, slug가 등록 bundle이면 `/tour-product/[slug]`로 연결된다.

이 구조 자체는 가능하지만, 다음 문제가 생기기 쉽다.

- DB에는 active인데 정적 bundle이 없거나 불완전한 상품
- blocklist에는 막혔는데 static registry에는 남아 있는 상품
- admin에서 저장한 `tour_product_pages.detail_payload`가 불완전한 상품
- static fallback과 DB payload가 서로 다른 스키마 버전을 가진 상품

### 성능 영향

소스가 여러 개라 fallback/validation/overlay 로직이 많아지고, 상세 진입 시 Supabase 조회 → static JSON fallback → checkout context → recommendations 계산이 이어진다.

### 개선 방향

- public catalog에 노출 가능한 slug를 하나의 manifest로 고정한다.
- `/api/tours`는 “상세 렌더 가능한 slug”만 내려주도록 registry와 교차 검증한다.
- admin 저장 데이터는 저장 시점에 detail payload completeness 검증을 강제한다.

---

## 8. 우선순위별 수정 플랜

### P0. 즉시 체감 개선

1. `useTourProductCardMedia()`가 `initialMediaBySlug`를 받으면 동일 request key 재요청을 하지 않게 한다.
2. `/api/tour-product-card-media`의 `no-store`를 제거하고 짧은 CDN TTL을 적용한다.
3. `/api/itinerary-builder/pois` 리스트 응답에서 무거운 상세 필드를 제거한다.
4. `/api/tours` 최초 limit을 낮추고 서버 페이지네이션을 실제 적용한다.

### P1. 구조 개선

1. POI list/detail API 분리.
2. tour card media resolver를 batch query로 고정.
3. booking count/materialized summary 도입.
4. public detail page와 admin preview cache 정책 분리.

### P2. 운영 안정화

1. Web Vitals 수집을 실제 페이지별로 분리한다.
2. API별 server timing 로그를 추가한다.
3. Supabase slow query와 함수 실행 시간을 대시보드로 본다.
4. 홈, 투어 리스트, 빌더, 상품 상세를 Playwright + Lighthouse로 회귀 측정한다.

---

## 9. 검증 기준

수정 후 최소 기준:

- `/tours/list?destination=jeju` 첫 응답 payload 300KB 이하.
- builder POI list payload 지역당 200KB 이하.
- 카드 미디어 API 동일 slug/locale 반복 요청 제거.
- 상품 리스트 첫 화면 카드 24개 이하 렌더.
- 모바일 4G 기준 tours list LCP 개선.
- 홈에서 빌더를 열지 않으면 POI JSON 다운로드 없음.

---

## 10. 최종 판단

느려진 핵심 원인은 UI 애니메이션이나 단순 이미지 용량 하나가 아니라, **데이터를 너무 많이, 너무 자주, 캐시 없이 가져오는 구조**다.

가장 먼저 고칠 지점은 다음 3개다.

1. 카드 미디어 중복 fetch 제거.
2. 일정 빌더 POI payload 축소.
3. 투어 리스트 API의 overfetch와 count/media 후처리 축소.

이 세 가지를 먼저 잡으면 tours list 진입, 홈 상품 카드, 빌더 체감 속도가 동시에 좋아질 가능성이 높다.

---

## 11. AI Agent 챗봇 응답 지연 · 토큰 비용 리뷰 및 개선 플랜

### 11-0. 결론 요약

현재 AI Agent 챗봇이 느린 이유는 단일 원인이 아니라, **사용자는 스트리밍을 기대하지만 서버는 전체 답변 생성이 끝날 때까지 기다리는 경로가 기본값이고, 그 전에 RAG 검색·DB 조회·카탈로그/정책 컨텍스트 구성·긴 대화 히스토리·후처리 모델 호출이 한 턴에 겹치는 구조**이기 때문이다.

가장 가능성이 높은 체감 병목은 다음 순서다.

1. 클라이언트는 `stream: true`를 보내지만 서버는 `CHAT_STREAMING === "1"`일 때만 SSE 스트리밍을 사용한다. 운영 환경에서 이 값이 꺼져 있으면 사용자는 첫 토큰을 보는 대신 전체 Gemini 응답 완료까지 기다린다.
2. 일반 답변마다 RAG가 켜질 수 있다. `OPENAI_API_KEY`가 있고 `CHAT_RAG !== "0"`이면 OpenAI embedding 호출 후 Supabase vector RPC + keyword RPC를 수행한다.
3. `PRODUCT CONTEXT`, `TOUR CATALOGUE`, `SITE KNOWLEDGE`, `RAG CONTEXT`, `TRAVELER MEMORY`, 과거 메시지 최대 24개가 하나의 프롬프트에 같이 들어갈 수 있다. 토큰이 커질수록 모델 응답도 느려지고 비용도 커진다.
4. 세션 메모리 조회, RAG, QA fallback, matcher가 대부분 순차 흐름이다. 독립적인 작업도 직렬 대기한다.
5. 답변 생성 후 `finalizeAssistantTurn()`에서 감사 로그, 에스컬레이션, 티켓 생성, Telegram, 세션 메모리 업데이트가 붙을 수 있다. 특히 메모리 업데이트는 별도 Gemini 호출이다.
6. 현재 측정값은 주로 모델 호출 구간 중심이라, 실제 사용자 체감 시간인 `request start -> first token -> final done`을 정확히 분해해서 보고 있지 않다.

즉시 체감 개선은 `CHAT_STREAMING=1` 확인이 1순위다. 실제 비용과 총 시간을 줄이는 핵심은 RAG/컨텍스트/히스토리를 의도별로 줄이고, 느린 보조 작업을 timeout·cache·background 처리하는 것이다.

### 11-1. 코드 기준 현재 응답 파이프라인

대상 코드:

- `app/api/tour-product/assistant/route.ts`
- `components/product-tour-static/_shared/TourProductAiAssistantWidget.tsx`
- `lib/rag/retrieve.ts`
- `lib/rag/embed.ts`
- `lib/chatbot/sessionMemory.ts`
- `lib/chatbot/sseStream.ts`
- `lib/tour-product/tourProductAssistantContext.ts`
- `lib/chatbot/tourCatalogKnowledge.ts`

현재 일반 AI 답변은 대략 다음 순서로 진행된다.

1. 클라이언트 위젯이 `/api/tour-product/assistant`로 `messages`, `pageContext`, `stream: true`를 보낸다.
2. 서버가 body를 검증한다. `messages`는 최대 24개, 전체 대화는 40,000자까지 허용된다.
3. 세션 쿠키, 인증 사용자, assistant scope, tour slug, locale, 정적 tour bundle을 확인한다.
4. human handoff, booking-specific, privacy/legal, quote request 같은 deterministic gate를 먼저 검사한다.
5. quote request는 `extractQuoteDraft()`에서 별도 Gemini 모델 호출로 슬롯 추출을 할 수 있다.
6. 일반 답변이면 product context를 매번 구성한다. 상품 상세에서는 itinerary, FAQ, policy, best-fit 등 큰 텍스트가 붙는다.
7. intent를 다시 분류하고, 필요하면 tour catalogue context와 site knowledge context를 만든다.
8. `CHAT_SESSION_MEMORY !== "0"`이면 Supabase에서 `chat_memory`를 읽는다.
9. `CHAT_RAG !== "0"`이고 `OPENAI_API_KEY`가 있으면 RAG를 실행한다.
10. RAG는 OpenAI embedding 호출 후 Supabase `match_knowledge_chunks`, `keyword_knowledge_chunks` RPC를 호출한다.
11. RAG 결과가 없을 때만 approved QA fallback을 조회한다.
12. 추천 intent이면 tour matcher를 추가로 실행한다.
13. 긴 `systemInstruction`을 만들고 Gemini 모델을 생성한다.
14. `messages.slice(0, -1)` 전체를 Gemini history로 전달한다.
15. `CHAT_STREAMING=1`이면 SSE로 delta를 보내고, 아니면 buffered JSON으로 전체 답변 완료 후 반환한다.
16. 답변 이후 `finalizeAssistantTurn()`이 fallback/misroute/handoff를 보정하고, 설정에 따라 로그·티켓·Telegram·세션 메모리 업데이트를 수행한다.

이 구조는 기능적으로는 풍부하지만, 상업 운영 환경에서는 한 턴이 너무 많은 외부 의존성과 토큰을 동시에 끌고 들어온다.

### 11-2. 원인별 상세 리뷰

#### A. 스트리밍은 구현되어 있으나 운영 기본값이 꺼진 구조

클라이언트 위젯은 이미 `stream: true`를 보낸다. 또한 `text/event-stream`이면 delta를 받아 말풍선을 즉시 갱신한다.

하지만 서버는 다음 조건을 모두 만족해야만 스트리밍한다.

- 요청 body의 `stream === true`
- `process.env.CHAT_STREAMING === "1"`
- debug no-side-effects 모드가 아님

따라서 운영 환경에서 `CHAT_STREAMING`이 unset 또는 `0`이면, 사용자는 Gemini가 전체 답변을 완성하고 후처리까지 끝날 때까지 타이핑 점만 보게 된다.

영향:

- 총 처리 시간이 같아도 체감 속도가 크게 나빠진다.
- RAG, matcher, memory, 모델 생성이 길어지는 날에는 "챗봇이 멈춘 것처럼" 보인다.

판단:

- 최우선으로 운영 환경 `CHAT_STREAMING=1` 여부를 확인해야 한다.
- SSE header는 `Cache-Control: no-cache, no-transform`, `X-Accel-Buffering: no`까지 이미 준비되어 있어 구조상 켤 수 있는 상태다.

#### B. RAG가 너무 넓고 비싸게 실행될 수 있음

`retrieveKnowledge()`는 매 요청에서 다음 비용을 낸다.

1. OpenAI embedding API 호출
2. Supabase vector RPC
3. Supabase keyword RPC
4. 결과 fusion
5. 최대 8,000자 RAG context 구성

문제는 RAG가 "정말 필요한 질문"에만 제한되어 있지 않다는 점이다. 현재는 `OPENAI_API_KEY`가 있고 kill switch가 꺼져 있지 않으면 일반 답변에서 실행될 수 있다.

RAG가 유용한 경우:

- POI 세부 정보
- 여러 상품/정책/FAQ에 걸친 복합 질문
- admin approved QA나 site knowledge만으로 답하기 어려운 질문

RAG가 불필요하거나 낭비인 경우:

- 인사말
- "사람 연결해줘"
- 예약번호/이메일을 요구해야 하는 booking-specific 질문
- 개인정보 삭제/법무 이메일 안내처럼 deterministic 답변 가능한 질문
- quote request의 누락 슬롯 안내
- 현재 상품의 가격, 소요시간, 기본 FAQ처럼 product context만으로 충분한 질문

추가 리스크:

- `lib/rag/embed.ts`는 embedding API가 429/5xx를 반환하면 최대 5회 재시도하며 0.5초, 1초, 2초, 4초, 8초까지 대기할 수 있다. 장애나 rate limit 순간에는 챗봇 전체가 길게 붙잡힌다.

#### C. 프롬프트 컨텍스트가 질문 의도 대비 과함

현재 프롬프트에는 상황에 따라 다음 블록이 같이 들어간다.

- 긴 security instruction
- product context
- matcher ranking
- tour catalogue
- verified knowledge 또는 approved Q&A + site knowledge
- verified booking
- traveler memory
- 과거 대화 history

문제는 사용자가 단순히 "가격이 얼마야?", "픽업 돼?", "사람이랑 이야기하고 싶어"라고 물어도 프롬프트 구조가 큰 컨텍스트를 만들 수 있다는 점이다.

현재 상한 기준:

- RAG context: 최대 8,000자
- site knowledge: 정책/법무 intent 최대 8,500자, 일반 최대 6,200자
- tour catalogue: site assistant 최대 5,200자, tour assistant 최대 3,600자
- 대화 전체: 최대 40,000자
- history: 최대 24개 메시지
- model output: 최대 1,200 tokens

이론상 한 턴 프롬프트가 수만 자까지 커질 수 있다. 모델 토큰 비용뿐 아니라 응답 시작 시간도 커진다.

#### D. 독립 작업이 순차 대기함

현재 흐름은 대체로 다음처럼 직렬이다.

1. memory fetch
2. RAG
3. approved QA fallback
4. matcher
5. Gemini 답변
6. finalize side effects

memory fetch, RAG, matcher, 일부 context build는 서로 독립적인 경우가 많다. 지금처럼 순차 대기하면 가장 느린 작업 하나가 아니라 각 작업 지연의 합을 사용자가 기다린다.

#### E. 세션 메모리 업데이트가 별도 모델 호출임

`updateSessionMemory()`는 답변 이후 Gemini를 다시 호출해서 300자 이하의 rolling memory를 만든다. 기능 자체는 좋지만, 사용자가 기다리는 API 응답 경로에 붙으면 늦어진다.

특히 buffered 응답에서는 모델 답변이 이미 완성되어도 memory update가 끝날 때까지 최종 JSON이 늦어질 수 있다. streaming 응답에서는 본문 delta는 빨리 보일 수 있지만 `done` 이벤트가 늦어질 수 있다.

#### F. quote request는 슬롯 추출 모델 호출이 선행됨

견적 요청 intent는 `extractQuoteDraft()`에서 Gemini 호출로 구조화된 견적 슬롯을 추출한다. 이후 예약/가격/checkout 흐름으로 넘어간다.

정교한 자연어 추출에는 유용하지만, 사용자가 단순히 "성인 2명 제주 3월 10일 가격"처럼 정형에 가까운 문장을 보낼 때도 모델 추출을 매번 쓰면 느리고 비싸다.

#### G. 히스토리 전달 방식이 길어질수록 느려짐

클라이언트는 `trimChatHistory(next)`로 최대 24개 메시지를 보낸다. 서버도 그 history를 Gemini `startChat()`에 그대로 전달한다.

문제:

- 긴 대화일수록 매 턴 이전 내용을 다시 전송한다.
- 이미 `chat_memory`가 있는데도 최근 24개 전체와 memory가 중복될 수 있다.
- 상품 페이지마다 sessionStorage에 남은 긴 대화가 다음 요청 비용으로 계속 이어진다.

#### H. 관측 지표가 부족함

현재 `elapsedMs`는 주로 Gemini model call 구간에 가깝다. 그러나 실제 사용자가 느끼는 시간은 다음 전체다.

- request receive
- auth/session
- bundle/context build
- memory fetch
- RAG embedding
- Supabase RPC
- matcher
- model first token
- model complete
- finalize
- response done

따라서 "Gemini가 느린지", "RAG가 느린지", "Supabase가 느린지", "후처리가 느린지"를 운영 대시보드에서 바로 분해하기 어렵다.

### 11-3. 즉시 적용 가능한 설정 점검

코드 수정 전에도 확인할 항목:

1. 운영 환경에 `CHAT_STREAMING=1`을 설정한다.
2. 설정 후 실제 브라우저 Network에서 `/api/tour-product/assistant` 응답 `content-type`이 `text/event-stream`인지 확인한다.
3. 급한 장애 대응으로 너무 느리면 임시로 `CHAT_RAG=0`을 켜서 RAG를 끄고 비교한다. 이 경우 POI/정책/복합 질문 품질은 낮아질 수 있으므로 fallback 안내와 support 연결이 중요하다.
4. 메모리 기능 때문에 지연이 크면 임시로 `CHAT_SESSION_MEMORY=0`을 켜고 비교한다. 개인화는 줄지만 응답 경로가 단순해진다.
5. `GEMINI_TOUR_PRODUCT_ASSISTANT_MODEL`은 현재 지원되는 빠른 모델명을 확인한 뒤 단순 intent용 fast/lite 모델로 분리하는 방향을 검토한다. 모델명은 최신 지원 목록이 바뀔 수 있으므로 적용 전 공식 SDK/콘솔에서 확인한다.

즉시 기대 효과:

- `CHAT_STREAMING=1`: 총 시간은 그대로여도 첫 토큰 체감은 크게 개선.
- `CHAT_RAG=0`: embedding + vector/keyword RPC 제거로 총 지연과 토큰 감소. 단, 지식 검색 품질 저하.
- `CHAT_SESSION_MEMORY=0`: memory read/update 제거로 일부 지연 감소. 단, 재방문 개인화 저하.

### 11-4. P0 개선 플랜: 체감 지연 먼저 줄이기

#### P0-1. 실제 단계별 시간 계측 추가

`app/api/tour-product/assistant/route.ts`에 stage timer를 추가한다.

기록할 값:

- `total_ms`
- `auth_ms`
- `bundle_context_ms`
- `memory_fetch_ms`
- `rag_embedding_rpc_ms`
- `qa_fallback_ms`
- `matcher_ms`
- `model_first_token_ms`
- `model_total_ms`
- `finalize_ms`
- `memory_update_ms`
- `prompt_chars`
- `history_chars`
- `context_chars`
- `rag_chunk_count`
- `output_chars`
- `streaming_enabled`
- `intent`
- `scope`

응답 header에 `Server-Timing`을 붙이고, `chat_messages` 또는 별도 `chat_turn_metrics` 테이블에 저장한다.

목표:

- p50/p95 기준으로 병목을 숫자로 분해.
- "Gemini 문제"와 "RAG/Supabase 문제"를 분리.
- 토큰 절감 전후 효과를 검증.

#### P0-2. RAG를 intent-gated로 변경

RAG 실행 조건을 명시적으로 줄인다.

RAG 사용:

- `poi`
- `policy` 중 product/site context로 답이 불명확한 경우
- `unknown`이지만 사용자가 factual detail을 묻는 경우
- `tour_recommendation`에서 matcher/catalogue가 약한 경우

RAG 미사용:

- `greeting`
- `handoff`
- `booking_specific`에서 검증 정보가 부족한 경우
- `quote_request`
- `legal/privacy` deterministic 답변
- `company/contact`
- 현재 상품의 기본 가격/시간/포함사항/FAQ 질문

구현 방향:

- `shouldUseRag(activeIntent, ctx)` helper 추가.
- RAG sourceTypes도 intent별로 축소한다.
- 예: POI 질문은 `["poi", "tour_product"]`, policy 질문은 `["policy", "qa"]`.

기대 효과:

- embedding 호출 횟수 대폭 감소.
- RAG context 8,000자 삽입 빈도 감소.
- 단순 문의 p50 응답 시간 개선.

#### P0-3. 느린 보조 작업에 timeout 적용

외부 호출이 오래 걸리면 답변 자체를 막지 않도록 제한한다.

권장 budget:

- memory fetch: 250-400ms
- RAG 전체: 900-1,200ms
- matcher: 500-800ms
- approved QA fallback: 500ms
- support escalation/logging: 사용자 응답 후 처리

timeout 시 동작:

- RAG timeout: RAG 없이 product/site context로 답변.
- matcher timeout: catalogue keyword ranking만 사용.
- memory timeout: memory 없이 답변.
- logging timeout: 답변은 성공시키고 실패 로그만 남김.

주의:

- timeout은 품질 저하를 만들 수 있으므로, confidence가 낮은 답변은 support 연결을 더 적극적으로 제공해야 한다.

#### P0-4. 독립 작업 병렬화

현재 직렬 대기하는 작업을 `Promise.allSettled()`로 묶는다.

병렬 후보:

- memory fetch
- RAG retrieval
- approved QA fallback 또는 site knowledge
- matcher
- static catalogue build

단, 모든 작업을 무조건 병렬 실행하면 오히려 비용이 늘 수 있다. 먼저 intent gate로 필요한 작업만 고르고, 그 다음 병렬화한다.

#### P0-5. 후처리 side effect를 사용자 응답 경로에서 분리

현재 `finalizeAssistantTurn()` 안에서 수행될 수 있는 작업:

- chat turn logging
- escalation detection
- support ticket insert
- Telegram notification
- session memory update

개선 방향:

- 답변을 사용자에게 먼저 반환.
- 로그/메모리/알림은 job table 또는 queue로 넘긴다.
- Next.js route handler에서 단순 unawaited promise만 쓰면 serverless 종료 시 유실될 수 있으므로, `chat_postprocess_jobs` 같은 DB job table을 만들고 worker/cron/edge function이 처리하는 편이 안전하다.

우선순위:

- support ticket 생성처럼 사용자에게 즉시 ticket_id를 보여줘야 하는 작업은 유지.
- memory update, analytics logging, Telegram은 응답 완료 후 처리 후보.

### 11-5. P1 개선 플랜: 토큰 절약

#### P1-1. intent별 context budget router 도입

현재는 큰 context block을 구성한 뒤 모델에 넣는 방식이다. 이를 intent별 예산으로 바꾼다.

권장 예산:

| Intent | 포함 context | context 목표 | maxOutputTokens |
| --- | --- | ---: | ---: |
| greeting | 없음 또는 300자 이하 브랜드 톤 | 0-300자 | 120-180 |
| handoff | deterministic 답변 | 0자 | 120 |
| booking_specific 미검증 | 예약번호/이메일 요청 템플릿 | 0자 | 160 |
| booking_specific 검증 | verified booking facts만 | 500-1,200자 | 350 |
| quote_request | 슬롯/가격 계산용 최소 정보 | 500-1,500자 | 350-500 |
| current product FAQ | 현재 상품 핵심 섹션만 | 1,500-3,000자 | 450 |
| policy/legal | 해당 정책 chunk만 | 1,500-2,800자 | 450 |
| tour_recommendation | matcher top 3-5 + 필수 catalogue | 2,000-3,500자 | 650-800 |
| POI/deep factual | RAG top 3-5 | 2,000-3,500자 | 600 |
| unknown | 짧은 fallback + support offer | 500-1,500자 | 300 |

핵심은 "모든 질문에 모든 지식"을 넣지 않는 것이다.

#### P1-2. product context를 섹션 단위로 쪼개기

`buildTourProductAssistantContextText()`는 현재 상품 context를 통째로 만든다.

개선:

- `buildTourProductContextSlice(doc, intent, query)` 신설.
- 가격 질문: title, price, currency, duration, included/excluded만.
- 픽업 질문: pickup, meeting, private transfer, route notes만.
- 취소/환불 질문: cancellation policy만.
- accessibility 질문: best-fit, less-ideal, route difficulty만.
- FAQ 질문: matching FAQ top 3만.

기대 효과:

- 현재 상품 질문의 prompt chars를 50% 이상 줄일 수 있다.

#### P1-3. RAG context 축소

현재 RAG는 최대 8개 chunk, 총 8,000자까지 넣는다.

개선:

- 기본 limit 8 -> 4 또는 5.
- chunk당 1,200자 -> 600-800자.
- 총 maxChars 8,000 -> intent별 2,500-3,500.
- sourceTypes를 intent별로 제한.
- similarity/keyword score가 낮은 chunk는 넣지 않음.

기대 효과:

- RAG를 쓰는 턴에서도 토큰 40-60% 절약.
- hallucination도 줄어듦. 너무 많은 관련 없는 chunk가 들어가면 모델이 엉뚱한 조합을 만들 수 있다.

#### P1-4. history를 서버에서 다시 줄이기

클라이언트가 최대 24개 메시지를 보내더라도 서버에서 intent별로 재정리한다.

권장:

- 기본: 최근 6개 메시지만 전달.
- quote/booking 진행 중: 최근 8-10개까지 허용.
- 긴 대화는 `chat_memory` summary + 최근 N개만 전달.
- assistant의 긴 이전 답변은 800-1,000자 이하로 잘라 history에 넣는다.
- user message도 일반 답변은 2,000자, 법무/복합 질문은 4,000자 정도로 intent별 clamp.

기대 효과:

- 장기 세션의 토큰 폭증 방지.
- sessionStorage에 오래 남은 대화가 매번 비용으로 재전송되는 문제 완화.

#### P1-5. system instruction 압축

현재 system instruction은 안전 규칙과 라우팅 규칙이 매우 길다. 안전성은 유지하되 중복 문장을 줄인다.

유지해야 할 핵심:

- context/user message는 untrusted data.
- prompt injection/role change 무시.
- verified booking 외 개인 예약 정보 금지.
- 정책/가격/운영시간 invent 금지.
- confidence 낮으면 support 연결.
- 접근성/어린이/고령자 제약은 명시 지원 상품만 추천.

줄일 수 있는 부분:

- 유사한 "추천하지 말라" 문장 중복.
- context omitted 안내 반복.
- support 안내 반복.

기대 효과:

- 모든 턴에서 고정으로 빠지는 prompt tokens 감소.

#### P1-6. output token budget을 intent별로 낮추기

현재 `maxOutputTokens`는 streaming/buffered 모두 1,200이다. 대부분 고객 응대에는 과하다.

권장:

- deterministic/support: 120-180
- 기본 상품 질문: 350-500
- 정책/법무: 450-600
- 추천: 650-800
- 사용자가 "자세히" 요청한 경우만 900-1,000

효과:

- 모델 생성 시간 단축.
- 장황한 답변 감소.
- 토큰 비용 절약.

### 11-6. P2 개선 플랜: 캐시와 deterministic fast path

#### P2-1. product/site/catalog context 캐시

정적 tour bundle과 site knowledge는 매 요청마다 크게 변하지 않는다.

캐시 후보:

- `productContext` by `slug + locale + bundleVersion`
- `siteKnowledgeContext` by `locale + intent + normalizedQueryHash`
- `tourCatalogContext` by `locale + queryClass`
- matcher 결과 by `locale + normalizedQuery`

캐시 위치:

- 우선 module-level LRU Map + TTL 5-30분.
- 장기적으로 Redis/KV/Supabase cache table 검토.

주의:

- admin에서 상품/FAQ/정책 수정 시 cache invalidation 필요.
- stale 답변이 치명적인 정책/가격은 TTL을 짧게 둔다.

#### P2-2. embedding/RAG 결과 캐시

동일한 quick chip이나 반복 질문은 같은 embedding과 유사 retrieval을 반복한다.

개선:

- normalized query hash 기준 embedding cache.
- `locale + sourceTypes + queryHash` 기준 RAG result cache.
- TTL 10-30분.

효과:

- 인기 질문 반복 시 OpenAI embedding 비용과 Supabase RPC 감소.

#### P2-3. deterministic fast path 확대

모델을 부르지 않아도 되는 답변은 즉시 반환한다.

후보:

- 인사말/도움말
- 사람 연결 요청
- 개인정보 삭제/법무 이메일 안내
- 예약 조회에 필요한 booking reference/email 요청
- 명확한 회사 연락처/운영자 정보
- quick chip으로 들어오는 고정 질문 일부
- quote request에서 누락된 필수 슬롯 안내

효과:

- 0.1-0.5초대 응답 가능.
- 비용 거의 0.
- 모델 장애 시에도 기본 고객 응대 유지.

### 11-7. 상업 운영 환경 리스크

#### 리스크 1. RAG를 줄이면 답변 정확도가 떨어질 수 있음

RAG를 무조건 끄면 POI, 정책, admin Q&A 기반 답변 품질이 낮아질 수 있다.

대응:

- RAG를 완전 제거하지 말고 intent-gated로 축소.
- confidence 낮으면 "확인 후 안내"와 support 연결을 명확히 제공.
- RAG off A/B 테스트 시 negative feedback rate를 같이 본다.

#### 리스크 2. 스트리밍은 중간 답변을 먼저 보여준다

현재 streaming은 마지막 `done.reply`로 bubble을 authoritative 답변으로 스냅한다. 후처리에서 답변을 크게 바꾸면 사용자는 중간에 본 문장과 최종 문장이 달라지는 느낌을 받을 수 있다.

대응:

- finalize에서 답변을 크게 rewrite하는 경우를 줄인다.
- safety/handoff 판단은 모델 호출 전 gate에서 최대한 처리한다.
- streaming 중 fallback override 가능성이 높은 intent는 deterministic으로 먼저 분기한다.

#### 리스크 3. background 처리 유실

serverless 환경에서 unawaited promise는 함수 종료 시 유실될 수 있다.

대응:

- memory/logging/telegram을 단순 fire-and-forget으로만 빼지 않는다.
- DB job table 또는 queue 기반으로 안전하게 분리한다.

#### 리스크 4. 개인정보와 세션 메모리

속도 개선 중 memory/logging을 손대면 PII scrub, booking verification, legal/privacy gate가 약해질 수 있다.

대응:

- `scrubPii()`와 verified booking 규칙은 유지.
- memory update는 답변 품질 보조일 뿐, 예약/정책 사실로 사용하지 않는 현재 원칙 유지.

### 11-8. 단계별 실행 순서

#### Phase A. 측정 + 설정 확인

1. 운영 env의 `CHAT_STREAMING` 확인.
2. 브라우저 Network에서 SSE 여부 확인.
3. `Server-Timing` 또는 로그에 stage timing 추가.
4. p50/p95 기준으로 현재 baseline 수집.

완료 기준:

- 챗봇 턴마다 total, first token, RAG, model, finalize 시간이 기록된다.
- 스트리밍 on/off 상태가 로그에 남는다.

#### Phase B. 체감 지연 P0 수정

1. streaming 운영 활성화.
2. RAG intent gate.
3. RAG/memory/matcher timeout.
4. 독립 작업 병렬화.
5. memory update를 응답 경로 밖으로 분리.

목표:

- 단순 질문 first token 1.2초 이하.
- 일반 상품 질문 p50 3초 이하.
- RAG 질문 p95 6초 이하.

#### Phase C. 토큰 절감 P1 수정

1. intent별 context budget router.
2. product context slicing.
3. RAG maxChars/limit 축소.
4. server-side history pruning.
5. system instruction 압축.
6. maxOutputTokens intent별 조정.

목표:

- 평균 prompt chars 50% 이상 감소.
- RAG 실행 턴 비중 20-35% 이하.
- 평균 output chars 30% 이상 감소.
- negative feedback rate 증가 없음.

#### Phase D. 캐시/fast path P2 수정

1. product/site/catalog context TTL cache.
2. embedding/RAG result cache.
3. quick chip deterministic replies.
4. admin 수정 시 cache invalidation.

목표:

- 반복 질문 비용 대폭 감소.
- 인기 질문 응답 p50 1초대.

### 11-9. 최종 권고

챗봇 속도는 모델만 바꿔서 해결할 문제가 아니다. 지금 구조에서는 모델 호출 전에 이미 RAG, DB, 큰 context, 긴 history가 쌓이고, 모델 호출 후에도 memory/logging이 붙을 수 있다.

가장 먼저 해야 할 일은 다음 5개다.

1. `CHAT_STREAMING=1` 운영 활성화 여부 확인.
2. assistant route stage timing 추가.
3. RAG를 intent별로 제한.
4. prompt/context/history를 intent별 예산제로 축소.
5. memory update/logging 같은 비필수 후처리를 응답 경로에서 분리.

이 순서로 가면 답변 품질을 크게 해치지 않으면서도 체감 응답 시간과 토큰 비용을 동시에 줄일 수 있다.

---

## 12. 빌더 POI 추가 지연 · AI 추천 1분 지연 리뷰 및 개선 플랜

### 12-0. 결론 요약

현재 빌더의 느림은 두 갈래다.

1. **POI 추가 버튼 지연**: 버튼 자체가 API를 부르는 것은 아니지만, cart 상태를 URL query(`pois=`)에 저장하면서 `router.replace()`를 호출한다. 전용 빌더 페이지는 `searchParams`를 받는 서버 컴포넌트이고, 같은 페이지에서 `match_pois`를 다시 조회한다. 즉 POI 하나 추가할 때도 App Router 내비게이션, 서버 컴포넌트 재실행, POI payload 재전송, 클라이언트 전체 재렌더가 겹칠 수 있다.
2. **AI 추천 1분 지연**: `/api/itinerary/match`는 먼저 `parseQuery(intent, "auto")`를 호출하고, `ANTHROPIC_API_KEY`가 있으면 Anthropic Haiku 파서를 기다린다. 현재 명시적 짧은 timeout이 없고 SDK 기본 timeout은 매우 길며 retry도 붙을 수 있다. 그래서 외부 LLM 호출이 느리거나 실패 직전이면 rule parser fallback이 있어도 거의 1분을 기다린 뒤에야 fallback될 수 있다.

DB 자체는 주범이 아니다. 실제 `match_pois`는 총 124행, `region` 인덱스가 있고, 제주 후보 조회 `EXPLAIN ANALYZE`는 warm 기준 약 0.17ms다. 다만 빌더 화면용 payload는 제주 약 330KB, 부산 약 192KB라서, 이 payload를 POI 추가 때마다 다시 실어 나르는 구조라면 모바일 체감은 충분히 나빠진다.

### 12-1. 리뷰 범위

대상 코드:

- `lib/itinerary-builder/cart.ts`
- `components/itinerary-builder/BuilderShell.tsx`
- `components/itinerary-builder/POICatalogGrid.tsx`
- `components/itinerary-builder/POICatalogMap.tsx`
- `components/itinerary-builder/AIRecommendPanel.tsx`
- `app/itinerary-builder/page.tsx`
- `app/api/itinerary-builder/pois/route.ts`
- `app/api/itinerary/match/route.ts`
- `lib/tour-match-v2/parser.ts`
- `lib/tour-match-v2/parser-haiku.ts`
- `lib/tour-match-v2/parser-rule.ts`
- `lib/itinerary-match-engine/score-poi.ts`
- `lib/itinerary-match-engine/sequence.ts`

실브라우저 Chrome DevTools trace는 이 세션에 MCP 도구가 없어 수행하지 못했다. 대신 코드 흐름, DB row/payload, 인덱스, API 파이프라인을 기준으로 원인을 분해했다.

### 12-2. DB 대조 결과

`public.match_pois` 상태:

- 전체 행 수: 124
- 전체 relation size: 약 4.6MB
- table size: 약 352KB
- indexes size: 약 384KB
- 주요 인덱스: `idx_match_pois_region`, `idx_match_pois_meta_gin`, `match_pois_pkey`

빌더 화면용 select payload 추정:

| Region | Rows | Approx payload |
| --- | ---: | ---: |
| busan cluster | 5 | 약 192KB |
| jeju | 29 | 약 330KB |
| seoul cluster | 3 | 약 84KB |

AI 추천 API 후보 select payload 추정:

| Region | Rows | Approx payload |
| --- | ---: | ---: |
| busan cluster | 5 | 약 9KB |
| jeju | 29 | 약 48KB |
| seoul cluster | 3 | 약 8KB |

`EXPLAIN ANALYZE` 기준 제주 `match_pois` 조회:

- builder full select: 약 0.156ms execution
- AI match select: 약 0.17ms execution
- 둘 다 `idx_match_pois_region` 사용

판단:

- DB where/filter/index 자체는 빠르다.
- 느림은 DB scan보다는 Next 서버 컴포넌트 재실행, Supabase roundtrip, JSON serialization, RSC payload 전송, Google Maps/React 재렌더, 외부 LLM 호출에서 발생할 가능성이 높다.

### 12-3. POI 추가 버튼이 느린 원인

#### A. cart 변경이 URL navigation으로 처리됨

`useCart()`는 cart를 `pois` query param에 저장한다.

현재 흐름:

1. 사용자가 POI 카드의 Add 버튼을 누른다.
2. `onAdd(poi.poi_key)`가 호출된다.
3. `useCart().add()`가 `pushUrl([...cart, key])`를 호출한다.
4. `pushUrl()`이 `router.replace(`${pathname}?${qs}`, { scroll: false })`를 호출한다.
5. URL의 `pois=`가 바뀐다.
6. `useSearchParams()`를 보는 클라이언트 컴포넌트들이 다시 렌더링된다.
7. 전용 빌더 페이지에서는 `app/itinerary-builder/page.tsx`가 `searchParams`를 받으므로 App Router가 서버 컴포넌트를 다시 계산할 수 있다.
8. 그 서버 컴포넌트는 다시 `match_pois` full select를 수행한다.

즉 Add 버튼은 "로컬 배열에 하나 push"가 아니라 "URL navigation + 서버 데이터 재확인 + 클라이언트 전체 반영"에 가깝다.

특히 `app/itinerary-builder/page.tsx`는 `searchParams`를 읽고, 같은 render에서 `match_pois` full payload를 다시 가져온다. `pois` query는 서버가 POI 목록을 가져오는 데 필요하지 않은 값인데, URL이 바뀌는 순간 서버 렌더 invalidation에 같이 얽힌다.

#### B. POI 목록이 cart 변경 때 전체 재정렬/재렌더됨

`POICatalogGrid`는 매 render마다:

- `cartPosition = new Map(cart.map(...))`
- `ordered = [...pois].sort(...)`
- in-cart POI를 맨 앞으로 올림
- 전체 POI 카드 map 렌더
- Framer Motion wrapper 사용

결과:

- Add 한 번에 전체 카드 목록의 순서가 바뀐다.
- 클릭한 카드가 grid 상단으로 이동하면서 layout work가 커진다.
- 모바일에서는 이미지 카드, motion wrapper, grid layout 재계산이 INP를 악화시킬 수 있다.

현재 timeline이 이미 선택된 cart를 보여주므로, grid까지 매번 in-cart 우선 정렬할 필요가 크지 않다.

#### C. Google Maps marker/route가 cart 변경마다 다시 만들어짐

`POICatalogMap`은 `cart`, `previewKeys`, `cartActive`, `previewMode` 변화에 반응한다.

현재 흐름:

- 기존 marker들을 detach
- route key 기준으로 새 `AdvancedMarkerElement` 생성
- polyline path 갱신
- route가 2개 이상이면 `fitBounds`
- marker click/hover listener 재부착

현재 코드는 out-of-route POI를 모두 marker로 만들지는 않아 과거보다는 낫다. 그래도 Google Maps DOM/marker는 일반 React DOM보다 비싸고, cart 변경마다 teardown/recreate하는 방식은 클릭 반응을 둔하게 만들 수 있다.

#### D. 부수 계산은 작지만 한 번에 몰림

cart 변경 시 같이 일어나는 계산:

- `BuilderShell`의 `cartPois` Map build
- live price quote recompute
- cluster block 계산
- ResultTimeline drive/stay total recompute
- POICatalogGrid reorder
- POICatalogMap marker/polyline/fitBounds
- URL replace/navigation

각각은 작아도, URL navigation과 지도 업데이트가 같이 붙으면 사용자는 "추가가 늦다"고 느낀다.

### 12-4. POI 추가 속도 개선 플랜

#### P0-1. cart를 즉시 반응하는 client state로 분리

현재:

- URL query가 cart source of truth.
- 모든 add/remove/reorder가 `router.replace()`를 탄다.

개선:

- 최초 mount 때만 URL의 `pois`를 읽어서 client state를 초기화한다.
- 이후 Add/Remove/Reorder는 React state를 즉시 변경한다.
- URL 동기화는 `window.history.replaceState` 또는 Next native history API로 debounced 처리한다.
- quote/share/checkout 시점에는 현재 client cart를 명시적으로 사용한다.

목표:

- Add 버튼 클릭 즉시 timeline과 badge가 바뀐다.
- Add 버튼 클릭으로 `/itinerary-builder?...pois=` RSC request가 다시 발생하지 않는다.

주의:

- URL 공유 기능은 유지해야 한다.
- 브라우저 뒤로가기/앞으로가기와 client cart state 동기화 정책을 정해야 한다.

#### P0-2. 서버 컴포넌트가 `pois` query에 영향받지 않게 분리

전용 builder page의 서버 데이터 fetch는 `region`만 필요하다. `pois`, `intent`, `autoRun`, `duration`, `party` 등 클라이언트 상태성 query가 바뀔 때 POI list를 다시 가져오면 안 된다.

개선 방향:

- 서버 컴포넌트는 `region`만 canonicalize하고 POI를 가져온다.
- cart 관련 query는 Client Component 내부에서만 읽는다.
- 가능하면 `/itinerary-builder/[region]` 또는 segment param 구조로 region을 분리해, cart query 변경이 서버 POI fetch와 얽히지 않게 한다.

#### P0-3. grid 재정렬 제거 또는 완화

현재 in-cart POI를 grid 맨 앞으로 올리는 정렬은 사용자가 누를 때마다 layout을 크게 흔든다.

개선:

- 기본 grid 순서는 고정한다.
- 선택 상태는 badge/ring만 바꾼다.
- 선택된 일정은 ResultTimeline에서 보여준다.
- 필요하면 "Selected" filter/toggle을 별도 제공한다.

기대 효과:

- Add 클릭 후 grid 전체 재배치 감소.
- 모바일 layout/repaint 감소.

#### P0-4. map marker를 incremental update로 전환

현재는 cart/preview 변화마다 route markers를 재생성한다.

개선:

- `markersByKeyRef: Map<string, AdvancedMarkerElement>` 유지.
- 새로 추가된 key만 marker 생성.
- 제거된 key만 detach.
- 순서 변경은 seq badge/state만 업데이트.
- polyline은 path만 set.
- `fitBounds`는 AI 추천 자동 적용 또는 reset시에만 실행하고, 단일 Add마다 매번 카메라를 흔들지 않는다.

기대 효과:

- Google Maps DOM churn 감소.
- 버튼 클릭 후 지도 반응이 부드러워짐.

#### P0-5. add/remove를 `startTransition`과 optimistic update로 감싸기

사용자 입력 반응은 즉시 처리하고, URL sync/analytics/map fitting 같은 비필수 작업은 낮은 우선순위로 넘긴다.

권장:

- `setCart(next)`는 즉시.
- URL update는 transition 또는 debounce.
- analytics는 비동기 best-effort.
- scroll/focus/fitBounds는 requestAnimationFrame 뒤로 분리.

#### P0-6. POI 추가 성능 계측

추가할 metric:

- `builder_add_click_to_badge_ms`
- `builder_add_click_to_timeline_ms`
- `builder_add_click_to_map_marker_ms`
- `builder_url_sync_ms`
- `builder_grid_render_count`
- `builder_map_marker_rebuild_count`
- Add 클릭 후 발생한 network request 수

검증 기준:

- Add 클릭 후 UI badge/timeline 반영 100-200ms 이내.
- Add 클릭으로 `/itinerary-builder?...pois=` 서버 재요청 없음.
- Add 클릭으로 POI full payload 재다운로드 없음.
- 모바일 INP 200ms 이하 목표.

### 12-5. AI 추천 1분 지연 원인

#### A. AI 추천 API는 LLM 파서를 먼저 기다림

`AIRecommendPanel`은 `/api/itinerary/match`를 호출한다. 서버는 다음 순서로 처리한다.

1. request body parse
2. `parseQuery(intent, "auto")`
3. `ruleParse(intent)`와 merge
4. `match_pois` 후보 조회
5. `scorePoi`
6. `sequence`
7. 결과 반환

핵심은 2번이다. `parseQuery(auto)`는 `ANTHROPIC_API_KEY`가 있으면 `haikuParse(query)`를 먼저 기다린다. 실패하면 rule parser로 fallback하지만, 실패가 빠르게 발생하지 않으면 fallback도 늦다.

#### B. Anthropic SDK 기본 timeout/retry가 너무 길다

현재 `haikuParse()`는:

- `new Anthropic({ apiKey })`
- `client.messages.create(...)`

만 사용한다.

로컬 SDK 타입 기준:

- 기본 timeout: 10분
- 기본 maxRetries: 2
- timeout도 retry될 수 있어 실제 대기 시간이 더 길어질 수 있음

따라서 provider가 지연되거나 edge/network가 불안정하면 사용자가 1분 가까이 기다리는 상황이 충분히 발생한다.

#### C. 파서 prompt가 큼

`parser-haiku.ts`는 약 19.9KB이고, taxonomy JSON은 약 21.5KB다. `buildSystemPrompt()`는 compact taxonomy, schema, rules, 다수 예시를 하나의 system prompt로 만든다.

prompt caching을 쓰고 있지만:

- 첫 cache create 호출은 여전히 무겁다.
- cache TTL이 지나면 다시 무거운 호출이 된다.
- preset chip처럼 반복되는 질의에도 매번 외부 LLM을 호출한다.

#### D. deterministic rule parser가 즉시 fallback으로 사용되지 않음

`/api/itinerary/match`는 `mergeBuilderParserHints(await parseQuery(intent, "auto"), ruleParse(intent), ...)` 구조다.

즉 rule parser는 merge용으로 준비되어 있지만, `await parseQuery()`가 끝나야 다음으로 간다. Haiku가 60초 걸리면 rule parser도 60초 뒤에야 의미가 있다.

#### E. DB와 시퀀싱은 1분 병목이 아님

AI match API payload는 제주 기준 약 48KB이고, DB execution은 약 0.17ms였다. `sequence()`도 최대 7개 POI permutation과 bounded backfill이라 1분급 병목이 아니다.

### 12-6. AI 추천 속도 개선 플랜

#### P0-1. rule parser first로 변경

현재:

- Haiku 우선
- 실패 시 rule fallback

개선:

- `ruleParse(intent)`를 즉시 실행한다.
- 기본 추천은 rule result만으로 계산 가능하게 한다.
- Haiku는 "보강"이지 "게이트"가 아니어야 한다.

권장 정책:

- preset chip: 100% rule/precompiled profile 사용. LLM 호출 금지.
- 일반 짧은 intent: rule result로 먼저 추천.
- 복합 자연어/다국어 긴 문장만 Haiku를 짧은 timeout으로 보강.

#### P0-2. Haiku timeout과 retry를 강하게 제한

권장:

- Anthropic client 또는 request에 `timeout: 1200-1800ms`
- `maxRetries: 0`
- timeout 시 즉시 rule parser 결과 사용

이유:

- 일정 추천은 "즉시 쓸 만한 결과"가 중요하다.
- 1분 기다린 고품질 parsing보다 1-2초 내 괜찮은 일정이 상업 UX에 더 맞다.

#### P0-3. `Promise.race` 기반 fast fallback

구조:

- rule parse는 즉시 완료.
- Haiku parse는 background promise.
- 1.5초 안에 Haiku가 오면 merge.
- 1.5초를 넘기면 rule parse로 계속 진행.

중요:

- timeout 후에도 비용이 계속 나가는 dangling LLM 호출을 막기 위해 AbortSignal 또는 SDK timeout을 같이 써야 한다.

#### P0-4. 추천 결과 cache

cache key:

- `normalizedIntent`
- `region`
- `track`
- `origin`
- `maxHours`
- `maxPois`

TTL:

- 10-60분

캐시 대상:

- parsed query
- final recommendation result

특히 preset chip은 모든 사용자가 같은 intent seed를 보내므로 캐시 효과가 크다.

#### P0-5. preset은 precompiled parsed profile로 대체

현재 preset은 영어 seed text를 API로 보내고, 서버가 다시 parsing한다.

개선:

- `firstTime`, `family`, `unesco`, `foodie`, `beachesCafes`는 미리 `ParsedQueryV2` 객체로 정의한다.
- 서버 body에 `presetKeys`를 보내거나, intent text를 서버에서 preset key로 인식한다.
- preset-only 요청은 LLM/parser 없이 바로 score/sequence.

기대 효과:

- preset 추천 응답 1초대 가능.
- 외부 API 비용 0.

#### P0-6. API stage timing 추가

`/api/itinerary/match`에 다음 timing을 추가한다.

- `parse_rule_ms`
- `parse_llm_ms`
- `parse_used: rule|haiku|haiku_timeout`
- `db_ms`
- `score_ms`
- `sequence_ms`
- `total_ms`
- `payload_rows`
- `cache_hit`

응답 header:

- `Server-Timing: parse;dur=..., db;dur=..., score;dur=..., sequence;dur=...`

admin analytics:

- 추천 API p50/p95
- Haiku timeout rate
- cache hit rate
- empty recommendation rate

#### P1-1. parser prompt 축소

현재 system prompt는 taxonomy와 예시가 크다.

개선:

- builder preset/간단 intent는 prompt를 아예 사용하지 않음.
- LLM parser가 필요한 경우도 taxonomy 전체가 아니라 필요한 키만 보냄.
- schema를 짧게 하고 예시는 2-3개로 축소.
- output max tokens 800 -> 300-450 검토.

#### P1-2. 추천 API를 streaming/progressive UI로 보강

추천 결과 자체는 한 번에 오지만, UI는 단계 표시가 가능하다.

예:

- "취향 분석 중"
- "동선 계산 중"
- "일정에 적용 중"

단, 이것은 체감 완화일 뿐이다. 실제 1분 병목은 timeout/rule-first/cache로 줄여야 한다.

### 12-7. 실행 우선순위

#### Phase A. POI 추가 체감속도

1. cart source of truth를 URL에서 client state로 이전.
2. URL sync는 debounce/history replace로 전환.
3. `pois` query 변경이 서버 POI fetch를 다시 만들지 않게 분리.
4. grid in-cart 우선 정렬 제거.
5. map marker incremental update.

완료 기준:

- Add 클릭 직후 timeline/badge 즉시 반영.
- Add 클릭으로 full POI payload 재요청 없음.
- 모바일에서 Add 버튼 INP 200ms 이하.

#### Phase B. AI 추천 응답시간

1. rule parser first.
2. Haiku timeout 1.2-1.8초 + maxRetries 0.
3. timeout 시 rule result로 즉시 추천.
4. preset은 precompiled parsed profile.
5. 추천 결과 캐시.
6. API stage timing.

완료 기준:

- preset 추천 p50 1초 이하.
- 일반 intent 추천 p50 2초 이하.
- LLM 보강 사용 시에도 p95 5초 이하.
- 어떤 경우에도 8초 이상 대기하지 않고 rule fallback.

### 12-8. 최종 판단

POI 추가 버튼 지연은 "DB insert/update가 느린 문제"가 아니다. 현재 cart가 URL navigation으로 표현되어, 작은 선택 변경이 페이지/서버/지도/그리드 전체 갱신으로 번지는 구조가 문제다.

AI 추천 1분 지연도 DB 후보 조회나 시퀀싱 문제가 아니다. 외부 LLM 파서를 먼저 기다리고, 짧은 timeout 없이 긴 SDK 기본 timeout/retry에 맡긴 구조가 가장 큰 원인이다.

따라서 고칠 순서는 명확하다.

1. cart를 client state로 즉시 반응하게 만들고 URL sync를 뒤로 미룬다.
2. Add/remove가 서버 POI 재조회와 연결되지 않게 끊는다.
3. AI 추천은 rule-first + LLM timeout fallback으로 바꾼다.
4. preset 추천은 LLM을 호출하지 않는다.
5. timing을 심어 실제 p50/p95를 운영에서 확인한다.
