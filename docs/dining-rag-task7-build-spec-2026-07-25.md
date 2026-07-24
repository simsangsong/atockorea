# task#7 — Kakao 식당 추천 RAG 빌드 사양 (§5.7 R-1~R-7)

> SoT: `C:\Users\sangsong\Downloads\atoc-consolidation-plan.md` §5.7 (D13).
> 이 문서는 §5.7을 **코드 현실에 맞춰 실행 가능한 계약으로 확정한 것**이다.
> 플랜과 다르게 간 지점은 §0에 이유와 함께 전부 적었다(누락·축소 아님, 근거 있는 개정).

---

## 0. 플랜 대비 확정 개정 (근거 포함)

| # | 플랜 문구 | 코드/API 현실 | 확정 |
|---|---|---|---|
| K1 | "품질 필터(리뷰 10개 미만·별점 3.5 미만 제외)" | **Kakao Local API는 평점·리뷰수를 주지 않는다** (repo가 이미 기록: `scripts/collect-facility-pins.mjs` L18 "Kakao Local has no rating") | MISS 시 **Kakao Local(발견·한국어명·카카오맵 딥링크·카테고리) + Google Places(New)(평점·리뷰수·가격대·영업시간·아동친화·채식) 하이브리드 1회 수집** 후 좌표 40m + 정규화 이름으로 머지. 평점 없는 곳은 필터 통과 못 함(단, 셀 전체가 무평점이면 거리순 폴백 + `unrated` 뱃지). 수집은 셀당 1회뿐 → HIT 시 외부호출 0 계약은 그대로 |
| K2 | "10 locale 번역은 Claude Haiku + prompt caching" | `lib/ai/router.ts`에 anthropic 프로바이더 없음. `batch` 래더(deepseek→gemini→openai)가 이미 배치 생성·일일예산 카운터를 공유 | **기존 `chatCompletion('batch', …)` 사용.** 요구의 본질(싸게·1회·영구캐시)은 동일하게 충족. 새 프로바이더 도입 리스크 회피 |
| K3 | "대표메뉴 3" | 두 API 모두 메뉴를 주지 않음. 카카오 플레이스 페이지 스크래핑은 ToS 위반 소지 | **Google Places(New) `reviews` 본문에 명시된 요리명만 verbatim 추출**(generatedContent.ts의 "facts→LLM→critic" 패턴 그대로, 근거 없으면 빈 배열). 추가로 항상 **카카오 `category_name` 잎 노드**(예: `한식 > 해물,생선`)를 사실 라벨로 노출 — 없으면 생략, 창작 금지 |
| K4 | 테이블 2종 | "셀에 유효 캐시 ≥10곳이면 HIT" 규칙만으로는 **식당이 원래 3곳뿐인 시골 셀**이 영원히 MISS → 매번 Kakao 호출(제로콜 계약 파괴) | **`ops_kakao_cell_index` 1개 추가(총 3종).** HIT 판정 = "이 셀을 이미 수집했고 TTL 유효" (개수 아님). ≥10 규칙은 *수집 시 반경 확대 트리거*로 이동 |
| K5 | "반경 500m" | 성산일출봉 중심 r=500 실호출 결과 **documents 0건**(관광지 내부라 식당이 없음). r=1500이면 122건 | 기본 **800m**, 유효 후보 < 10이면 **1500m로 1회 확대 재조회**(셀당 최대 2콜) |
| K6 | "poi_facility_pins 같은 검수 게이트를 쓸지 판단" | 화장실·포토핀은 *추론*이라 사람 검수가 필요했지만, Kakao/Google 식당은 **사업자 원천 데이터** + 평점 필터가 있음. 30 POI 선행 시딩 = 수백 건 → 전수 검수는 자동화를 무력화 | **전수 검수 게이트 없음.** 대신 ①정량 품질필터 ②TTL 90일 ③게스트 "정보 틀림" 신고 → 3회 누적 시 자동 숨김 + 어드민 큐 ④어드민 수동 블랙리스트/무효화. `/admin/dining-cache`로 노출 |
| K7 | "카드 렌더 … Kakao Map 딥링크" | ⚠ Kakao ToS: **Kakao POI 데이터를 비카카오 지도 위에 표시하면 약관 위반 소지**(repo가 이미 기록) | 다이닝 카드는 **리스트 + 항목별 카카오맵 딥링크**로만 렌더. Google Static Map에 카카오 출처 좌표를 찍지 않는다. 기존 `FacilityMapCard`(구글 출처 핀)는 무변경 |
| K8 | "브리핑 카드 ④(점심안내)에서 dietary 선택" | C-16 브리핑 카드스택은 **아직 미구현**(남은 큐 #5) | 인테이크 2경로로 대체: ①기존 `/plan` A10 니즈 체크리스트(이미 라이브) ②**다이닝 카드 자체의 필터 칩**(플랜을 안 쓴 게스트도 즉시 필터). C-16이 생기면 같은 `needs.dietary` 계약에 그대로 얹힘 |

---

## 1. 데이터 모델 (마이그레이션 1건: `ops_dining_rag`)

모두 `ops_*` 관례대로 **RLS enable + 정책 0 (service-role 전용)**.

### 1.1 `ops_kakao_cell_index` — 셀 수집 원장 (HIT 판정의 단일 진실)
```
id uuid pk default gen_random_uuid()
cell text not null unique          -- geohash7 of the SEARCH CENTER
center_lat numeric not null
center_lng numeric not null
radius_m integer not null
place_count integer not null default 0
kakao_calls integer not null default 0
google_calls integer not null default 0
source text not null default 'kakao+google'
fetched_at timestamptz not null default now()
expires_at timestamptz not null    -- fetched_at + 90d
created_at / updated_at timestamptz not null default now()
```
인덱스: `(cell)` unique, `(expires_at)`.

### 1.2 `ops_kakao_place_cache` — 정규화된 장소 캐시
```
id uuid pk
place_key text not null unique       -- 'kakao:21499361' (머지 시 kakao id가 정본)
cell text not null                   -- geohash7 of the PLACE itself
search_cells text[] not null default '{}'  -- 이 장소를 발견한 검색 셀들
name text not null                   -- 카카오 원어명(한국어)
name_i18n jsonb                      -- 10 locale, 1회 번역 후 영구
category_group text not null         -- FD6 | CE7
category_name text                   -- '음식점 > 한식 > 해물,생선'
cuisine text                         -- 잎 노드 정규화 ('해물,생선')
road_address text / address text / phone text
place_url text not null              -- 카카오맵 딥링크
lat numeric not null / lng numeric not null
rating numeric / review_count integer          -- Google 머지분(없으면 null)
price_band smallint                            -- 1..4 (₩ ~ ₩₩₩₩), Google priceLevel
tags text[] not null default '{}'              -- 검증된 양성 태그만
signature_menus jsonb                          -- [{name, name_i18n}] verbatim 추출, 없으면 []
menus_i18n jsonb                               -- 예약(향후)
open_hours jsonb                               -- Google regularOpeningHours.periods 원문
google_place_id text
quality_score numeric not null default 0       -- rating × log10(reviews+1) + 피드백 가중
is_blocked boolean not null default false      -- 어드민 블랙리스트
is_closed boolean not null default false       -- 폐업 감지
reported_wrong_count integer not null default 0
expires_at timestamptz not null
created_at / updated_at
```
인덱스: `(cell)`, `(expires_at)`, GIN `(tags)`, `(search_cells)` GIN.

**tags 어휘(검증된 양성 신호만 넣는다 — 추론 금지):**
`vegetarian_friendly`(Google servesVegetarianFood=true 또는 상호/카테고리에 채식·비건·vegan·vegetarian) ·
`vegan`(상호/카테고리에 비건·vegan 명시) · `halal`(상호/카테고리에 할랄·halal·무슬림·muslim 명시 — **절대 추론 금지**) ·
`kids_ok`(Google goodForChildren 또는 menuForChildren) · `takeout` · `dine_in` · `cafe`(CE7) ·
`parking`(Google parkingOptions 존재) · `reservable`

### 1.3 `ops_restaurant_recommendations` — 노출·탭·방문 원장 (R-6)
```
id uuid pk
booking_id uuid not null references bookings(id) on delete cascade
room_id uuid
participant_id uuid references tour_room_participants(id) on delete set null
poi_key text / cell text not null
place_key text not null
rank smallint not null
dietary_tags text[] not null default '{}'   -- 노출 당시 적용된 필터
shown_at timestamptz not null default now()
tapped_at timestamptz / visited_at timestamptz
feedback text  -- null | 'good' | 'wrong' | 'closed'
created_at
```
인덱스: `(booking_id)`, `(place_key)`, `(cell)`, UNIQUE `(booking_id, place_key, cell)` — 같은 룸·같은 셀에서 같은 집 재노출은 1행 갱신.

---

## 2. 모듈 배치

```
lib/ops/dining/
  geohash.ts        pure  encodeGeohash(lat,lng,precision) / decode / neighbors(cell)
  dietary.ts        pure  DIETARY_TAGS 8종 · needsToDietary(needs) · dietaryFromSpecialRequests(text)
                          · placeMatchesDietary(place, tags) (배제 우선 semantics)
  cuisine.ts        pure  카카오 category_name → cuisine 잎 · 돼지고기/해산물/견과 배제 판정
  places.ts         pure  normalize · qualityFilter · rankPlaces(places, needs, feedback) · top5
  card.ts           pure  DiningCardMeta 계약 + 5로케일 카드 크롬 + 카카오 딥링크 빌더
  hours.ts          pure  Google periods → 당일 영업 여부/마감시각
  mealStop.ts       pure  isMealStop(stopLike, nowMs) 판정 (stop_type='meal' > 시간대 > 키워드)
  kakao.server.ts   io    Kakao Local category.json (FD6/CE7) + 쿼터 카운터
  google.server.ts  io    Google Places(New) searchNearby(+reviews) 인리치먼트
  merge.server.ts   io    kakao×google 좌표+이름 머지 → 정규화 행
  translate.server.ts io  10 locale 1회 번역(batch 래더, 예산 편승) → name_i18n/menus
  cache.server.ts   io    셀 HIT 판정 · 수집 · upsert · TTL · 무효화 · quality_score 갱신
  recommend.server.ts io  needs 로드 → 캐시조회/수집 → 필터·랭킹 → DiningCardMeta
```

> 🔴 **client-safe 분리 규칙**: `.server.ts`가 아닌 파일은 `node:*`·`sharp`·supabase를 import하지 않는다.
> 클라이언트 컴포넌트(`DiningCard.tsx`)는 `card.ts`/`dietary.ts`/`geohash.ts`만 import.
> (선례: `facilityPins/.server`, `eta/.server`, `evidence/evidenceFormat` — 이 규칙을 어기면 `next build --webpack`만 깨진다.)

---

## 3. 파이프라인 계약

### R-1 인테이크
- 1순위 `tour_day_plans.needs.dietary`(기존 컬럼·기존 A10 체크리스트). 어휘 확장: 기존 6종
  (`vegetarian` `vegan` `halal` `no_pork` `no_seafood` `gluten_free`) + **신규 `no_shellfish` `no_nuts`**,
  그리고 `kids`는 `needs.children > 0`에서 파생(저장 안 함).
- 2순위 `dietaryFromSpecialRequests(booking.special_requests ?? notes)` — 다국어 키워드 스캔, needs가 비었을 때만 병합.
- 3순위 카드 위 필터 칩(클라이언트 즉시 재필터, 서버 재호출 없음 — 캐시 페이로드를 그대로 다시 거른다).
- `allergyCard.ts`에 `no_shellfish`/`no_nuts` 한국어 줄 추가(기존 파일 additive).

### R-2 트리거 (새 크론 금지)
1. **접근 카드 훅** — `POST /api/tour-rooms/[bookingId]/approach`에서 대상 POI가 식사 스톱이면 다이닝 카드를 **별도 `dining_card` 메시지**로 후속 발사(접근 카드 자체는 무변경).
2. **도착 번들 훅** — `arrival-bundle`의 `next_leg`가 식사 스톱이고 `minutes <= 20`이면 동일 발사(= 플랜의 "15분 전"에 대응하는 실존 훅).
3. **온디맨드** — 컨시어지 `restaurant` 인텐트가 다이닝 RAG로 승격(캐시 HIT이면 즉답, MISS면 수집). 기존 facility pin 식당 카드는 폴백으로 유지.
4. **오퍼레이터 수동** — 기사/가이드 콕핏 원탭 `[식당 추천 보내기]`.
- 멱등: `(room, cell, KST 날짜)` 당 1회 — `tour_room_events` UNIQUE `subject_key` 선점 패턴 재사용(§11.C C2 선례).
- 팬아웃: 공유투어(price_type person/group)는 arrival-bundle과 동일한 Model B.

### R-3 캐시/수집
```
serve(cell, center):
  idx = cell_index[cell]
  if idx and idx.expires_at > now:            # HIT — 외부호출 0
      places = cache where cell in cellsWithin(center, radius) and not blocked/closed and expires_at > now
      return rank(filter(places))
  # MISS
  budgetGuard()                                # 일일 쿼터 70% 도달 시 ops 알림, 100%면 HIT-only 모드
  kakao = kakaoCategory(center, 800, FD6) + kakaoCategory(center, 800, CE7)
  if validCandidates(kakao) < 10: kakao = 재조회(center, 1500)     # K5
  google = placesNearby(center, radius, [restaurant, cafe])
  rows = merge(kakao, google)                  # 40m + 이름 정규화 매칭
  rows = qualityFilter(rows)                   # rating>=3.5 & reviews>=10, 무평점 전량이면 거리순 폴백
  rows = translateOnce(rows)                   # 10 locale, batch 래더, 실패는 원어 폴백(치명 아님)
  upsert(rows); upsert(cell_index)             # 이후 이 셀은 영구 HIT
```
- 외부호출은 전부 `AbortController` 타임아웃(카카오 2.5s / 구글 4s)·실패 시 **조용히 폴백**(카드 없음 = 허용되는 결과).
- 쿼터: `durableIncrWindow('ops_dining:kakao_daily' | 'ops_dining:google_daily', 86400)`. 70% 도달 시 기존 `lib/ops/inbox/alert.ts` 경로로 1일 1회 알림.

### R-4 필터·랭킹
```
score = quality_score                                  # rating × log10(reviews+1)
      + 0.6 × dietaryFitBonus                          # 요청 태그를 양성 충족
      + 0.4 × proximityBonus(distance_m)               # 400m 이내 가산
      + feedbackBonus                                  # visited +0.3, tapped +0.1, wrong −1.0 (place 전역)
      − 2.0 × openNowPenalty                           # 당일 휴무면 사실상 배제
배제(하드): dietary 배제 규칙 위반 · is_blocked · is_closed · reported_wrong_count >= 3
상위 5곳.
```
**배제 우선 semantics(안전 원칙):** 양성 검증이 불가능한 제약(할랄·글루텐프리·견과)은 "맞다"고 **주장하지 않고**, 명백히 상충하는 곳을
**빼기만** 한다(예: `no_pork`/`halal` → 카테고리·상호에 돼지고기·흑돼지·족발·보쌈·삼겹 포함 제외).
필터가 걸린 카드에는 항상 ①기존 `koreanAllergyCardLines()` 한국어 카드 ②"재료는 직접 확인해 주세요" 주의 1줄을 함께 렌더.

### R-5 카드 (게스트 언어)
`dining_card` 메시지 metadata:
```ts
interface DiningCardMeta {
  kind: 'dining_card';
  poi_key: string | null;
  spot_title: string;
  cell: string;
  meal: 'lunch' | 'dinner' | 'snack';
  dietary: string[];            // 적용된 필터
  places: DiningPlace[];        // 최대 5
  source: 'cache' | 'fresh';
  triggered_by_role?: string;
  [key: string]: unknown;
}
interface DiningPlace {
  place_key: string; name: string; name_i18n?: Record<string,string> | null;
  cuisine: string | null; category_name: string | null;
  lat: number; lng: number; distance_m: number | null; walk_min: number | null;
  price_band: number | null; rating: number | null; review_count: number | null;
  tags: string[]; signature_menus: Array<{ name: string; name_i18n?: Record<string,string> | null }>;
  place_url: string;            // 카카오맵 딥링크
  open_today: boolean | null; closes_at: string | null;
}
```
렌더: 이름(원어 + 게스트 언어 병기) · 도보 거리/분(80m/분) · 가격대 `₩`~`₩₩₩₩` · 카테고리/대표메뉴 최대 3 ·
태그 뱃지 · `[카카오맵]` 딥링크 · `[여기 갈게요]` · `[정보가 틀려요]`. 5로케일 크롬 상수(zero-LLM).
**지도 타일 없음**(K7).

### R-6 피드백
`POST /api/tour-rooms/[bookingId]/dining/feedback` `{ placeKey, cell, action: 'tap'|'visited'|'wrong'|'closed' }`
→ `ops_restaurant_recommendations` upsert + `wrong`/`closed`는 `ops_kakao_place_cache.reported_wrong_count++`
(3회 → 자동 숨김 + 어드민 큐). 노출 시점에 rank 1..5가 `shown_at`으로 일괄 기록.

### R-7 수명
- TTL 90일(`expires_at`), 만료 셀은 다음 요청 때 자동 재수집.
- 강제 무효화: 게스트 신고 3회 / 어드민 `[셀 무효화]`·`[장소 차단]` / `is_closed`.
- **주간 플라이휠(`/api/cron/tour-room-flywheel`)에 퍼지 1스텝 추가**: 만료 90일+ 지난 캐시행·추천행 삭제(기존 퍼지 블록 옆, additive).

### R-8 선행 시딩 + 쿼터
`scripts/seed-dining-cells.mjs` — 제주 주요 POI 30곳(match_pois region='jeju', is_operational, 좌표 有, 방문빈도순)
→ 셀당 수집 1회, `--dry` 기본 지원, `--limit`, `--poi=`, 150ms 페이싱, 진행 로그, 쿼터 70% 도달 시 중단.

### R-9 어드민
`/admin/dining-cache` — 셀 목록(수집일·만료·건수) · 셀 상세 장소표(평점·리뷰·태그·신고수) ·
`[차단]`·`[셀 무효화]`·`[재수집]` · **신고 큐**(reported_wrong_count>0 우선). 기존 admin 레이아웃·`tr-*`/ops 토큰 재사용.

---

## 4. 불변 원칙 (이 슬라이스에도 적용)
- 투어룸 코어는 **additive만**: 기존 파일 수정은 ①`allergyCard.ts` 태그 2종 추가 ②`approach`/`arrival-bundle` 라우트 말미 훅 1블록
  ③`concierge.ts` restaurant 인텐트 폴백 유지한 채 승격 ④`ChatFeed.tsx` `dining_card` 렌더 분기 1개 ⑤플라이휠 퍼지 1스텝 — 그 외 신규 파일.
- 비가역 대외 액션 없음(외부 API는 읽기 전용 검색뿐).
- 커밋 푸터 `Co-Authored-By: Claude <noreply@anthropic.com>`만.
- 검수 게이트: `tsc 0` + 신규 jest green + 기존 비파괴 + 🔴 `npx next build --webpack`.
