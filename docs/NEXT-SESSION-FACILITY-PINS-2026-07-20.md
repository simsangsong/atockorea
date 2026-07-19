# 다음 세션 부트스트랩 — 관광지별 편의시설·맛집 핀 지도

> 이 트랙을 이어받으면 **이 문서를 먼저** 읽고, 그다음 SoT 플랜을 봐라.
> **SoT 플랜:** `docs/tour-room-facility-pins-master-plan-2026-07-19.md`
> **진행 메모리:** `project_facility_pins_map`

## 한 줄 요약
손님이 **관광지 도착 후** 채팅에서 "화장실?" / "포토스팟?" / "맛집?" 을 물으면, **그 관광지 것만** 핀이 찍힌 **인라인 지도 카드**(구글 Static 멀티마커 + 이름 리스트 + 길안내)가 손님 본인 화면에 뜬다. 전체 투어 지도가 아니라 **매 관광지 스코프**. 컨시어지 Tier0(제로 네트워크) 위에 얹혀 있다.

## ⚠️ 시작 전 필수
- **워킹트리 경합:** 메인 디렉토리 `C:\Users\sangsong\atockorea`는 동시 세션과 브랜치를 공유한다(이번에도 세션 도중 `claude/ui-events-mobile` 등으로 바뀜). **이 트랙 작업은 반드시 `git fetch origin && git checkout main && git pull` 로 최신 main에서 시작하거나 전용 브랜치를 새로 파라.** 디스크 파일이 옛 버전으로 보이면 브랜치가 딴 데 가 있는 것 — 당황 말 것.
- **전부 main에 머지됨:** PR **#396~#402** 전부 `origin/main`. 코드/데이터 SoT는 main.
- **라이브 DB = `mcp__atockorea__*`** (execute_sql / apply_migration). DDL은 additive + 적용 후 `get_advisors`.
- 진행 보고는 한국어, 코드/커밋은 영어. 커밋 푸터는 `Co-Authored-By: Claude ...`만.

## 지금까지 완료 (전부 배포됨)
- **W0** 스키마 `poi_facility_pins`(poi_key 전역 키) + `lib/tour-room/facilityPins.ts`(선택·정렬·Static 경로·라벨).
- **W1** 수동 CRUD API `app/api/admin/facility-pins/route.ts`(+`[id]`) + 어드민 편집기 `app/admin/facility-pins/page.tsx`(+`_components/PinMap.tsx`). 모바일 단일패널 전환 포함. 어드민 내비 '편의시설 핀'.
- **W2** 서빙: 도착 라우트(`spot-events`, `manual-arrival`)가 metadata에 `poi_key`+`facility_pins` 주입(`facilityPins.server.ts`=서버 전용, 클라 번들에 supabase 안 들어감) → `concierge.ts` `answerTier0`가 `mapCard` 반환 → `components/tour-mode/FacilityMapCard.tsx` 렌더 → `ConciergeInlineAnswer`(본인화면 배너) + `ConciergePanel`(시트 스레드) 배선.
- **W3 자동수집** `scripts/collect-facility-pins.mjs`:
  - 화장실 = **카카오 Local 키워드**(WGS84, 커버리지 최상). 구글 폴백(`--provider=google`, Places New `public_bathroom`).
  - 맛집 = **구글 Places(New) searchNearby**(rating+userRatingCount) — 카카오는 평점 미제공. 랭킹 = `rating × log10(reviews)`, 필터 `--minRating`(4.0)·`--minReviews`(50).
  - 옵션: `--kind=restroom|restaurant` `--provider=kakao` `--region=jeju` `--all-pois` `--radius=600` `--max=3` `--limit` `--dry`.
  - npm: `facility:collect:kakao[:dry]`, `facility:collect:restaurants[:dry]`, `facility:collect[:dry]`.
- **A안(외국손님 라벨)**: `guestPinLabel()` — 화장실은 로케일 일반라벨(Restroom/トイレ/洗手间/Baño), 맛집·포토는 이름 유지. 한글 상세명은 `name`에 보존(어드민 편집기용 `pinLabel`).
- **맛집 서빙**: 컨시어지에 `restaurant` 인텐트(맛집/식당/where to eat…) + '맛집' 퀵칩. **venue_recommendation 가드레일과 화해** — 그 POI에 평점 데이터가 있으면 평점순 지도카드(각 행 ★rating·reviews), 없으면 기존 거절(§D-3 "LLM 기억 추천 금지" 유지). FacilityMapCard restaurant = 앰버·Utensils·★표시.

## 라이브 데이터 (전부 `is_verified=false` 검수대기)
- **맛집 237핀 / 88 POI** (평균 ★4.42, 최다 리뷰 11,974). 구글, 영어 이름.
- **화장실 173핀 / 56 POI** (카카오, 600m).
- 총 **410핀**. `select kind, count(*), count(distinct poi_key) from poi_facility_pins where is_active group by kind;`

## 환경/게이트 현황
- `KAKAO_REST_API_KEY` 로컬 `.env.local` 세팅됨 + 사용자가 Vercel에도 추가·배포. **주의: 카카오 앱이 이름 유사 2개('AtoCKorea' ID 1350193 vs 'AtoC KOREA')** — 키앱=카카오맵 서비스 ON 앱을 일치시켜야 함(안 맞으면 `disabled OPEN_MAP_AND_LOCAL service` 403).
- 카카오 ToS(카카오 데이터를 구글 지도에 표시)는 **사용자가 진행 결정함**.
- 레거시 Places API는 이 GCP 프로젝트 **비활성** → 반드시 **Places API (New)** 엔드포인트 사용.
- 손님 지도카드는 투어모드 플래그 `NEXT_PUBLIC_TOUR_MODE_V1`(OFF) 아래 — 실기기/손님 노출은 플래그 게이트.
- ⚠️ 컴포넌트 jest(conciergePanel 등)는 **사전존재 워크트리 react-중복 환경이슈**로 실패(내 변경 무관). 검증은 순수 로직·API 테스트로(현재 163 green, tsc 0).

## 남은 일 (다음 세션 후보)
### 사람 게이트
1. **편집기 검수** `/admin/facility-pins` — 410핀 is_verified=false. 오탐/위치 교정 → 검수됨 승격. (특히 맛집 오탐, 먼 화장실.)
2. **손님 지도카드 실기기 QA** — 투어모드 플래그 ON 시점.
3. **포토스팟 큐레이션** — 여전히 어드민 수동 입력(자동수집 없음).

### 코드 후보(요청 시)
- **커버리지 더**: `--region=` 없이 `--all-pois --radius` 키우거나 재실행(멱등). region=null POI 이미 포함됨.
- **맛집 이름 번역/노출 개선**: 지금 name(구글 영어)만. name_i18n 5로케일 LLM 번역 옵션(B안, 미채택).
- **맛집 노출 정책**: is_verified 안 된 자동수집 맛집을 손님에게 바로 보일지 vs 검수분만. (현재 서빙은 is_active 전부 노출 — 검수 게이트 미적용.) ← **결정 필요할 수 있음.**
- **정밀도/재현율 튜닝**: 화장실 `public_bathroom` 타입은 정밀↑재현↓; 맛집 minRating/minReviews/radius 조정.
- **Phase 2 사진핀**: `RoomMapCanvas`/`photo-pin.ts` 인터랙티브(⚠gmaps 크래시 이력 — 마커만).

## 핵심 파일 지도
- 데이터/로직: `lib/tour-room/facilityPins.ts`, `facilityPins.server.ts`
- 컨시어지: `lib/tour-room/concierge.ts`(intent/answerTier0/inlineConciergeAnswer/latestArrivalContext)
- 렌더: `components/tour-mode/FacilityMapCard.tsx`, `ConciergeInlineAnswer.tsx`, `ConciergePanel.tsx`
- 도착 주입: `app/api/tour-rooms/[bookingId]/spot-events/route.ts`, `manual-arrival/route.ts`
- 어드민: `app/admin/facility-pins/page.tsx`(+`_components/PinMap.tsx`), `app/api/admin/facility-pins/route.ts`(+`[id]`)
- 수집 스크립트: `scripts/collect-facility-pins.mjs`
- 프록시: `app/api/maps/static/route.ts`(멀티마커, `markers` 허용, 캐시)
- 마이그레이션: `supabase/migrations/20260719140000_poi_facility_pins.sql`, `20260720090000_poi_facility_pins_restaurant_kind.sql`
- 테스트: `__tests__/lib/tour-room/facilityPins.test.ts`, `concierge.test.ts`, `__tests__/api/admin-facility-pins.test.ts`
