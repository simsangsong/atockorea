# 관광지별 화장실·포토스팟 핀 지도 — 마스터 플랜 (SoT)

- **작성일:** 2026-07-19
- **트랙:** 스마트 가이드 프라이빗 모드 후속 기능 (SoT: `docs/smart-guide-private-mode-master-plan-v2-2026-07-16.md` 의 컨시어지 Tier0 위에 얹힘)
- **한 줄 요약:** 손님이 **현재 도착한 관광지**에서 "화장실 어디?" / "포토스팟?" 을 물으면, 채팅창에 **그 관광지의 화장실·포토스팟 핀만** 찍힌 지도 카드가 뜬다. 전체 투어 지도가 아니라 **매 관광지 스코프**.
- **확정 결정(사용자, 2026-07-19):**
  - **F-D1** 화장실 좌표 = **Google Places 자동수집** (배치 스크립트).
  - **F-D2** 포토스팟 좌표 = **어드민/가이드 큐레이션** (사람이 지정).
  - **F-D3** 핀 표시 v1 = **이름 라벨 + Static 멀티마커 지도** (사진 썸네일 핀 = Phase 2 인터랙티브).
  - **F-D4** 다음 단계 = **이 플랜 문서 승인 후 구현 착수.**

---

## §A. 코드 리얼리티 감사 (재사용 ✅ / 확장 🔶 / 부재 ❌)

이 기능은 **렌더링·서빙·트리거가 이미 대부분 존재**한다. 없는 건 오직 **좌표 데이터**다.

### A-1. 트리거 & 스코핑 — ✅ 이미 있음 (그대로 재사용)
- `lib/tour-room/concierge.ts`
  - `matchConciergeIntent()` — `restroom` / `photo_spot` 인텐트를 5로케일 키워드로 감지 (라틴 word-boundary + CJK substring). **이미 동작.**
  - `answerTier0(intent, ctx, locale)` (L489) — 현재는 `ctx.content?.convenience?.restroom` / `ctx.content?.smartNotes?.photo` **텍스트**만 반환. → **여기에 핀 지도를 첨부**하는 게 이 트랙의 핵심 확장 지점.
  - `latestArrivalContext(messages)` (L583) — 가장 최근 geofence 도착 메시지에서 `spotTitle`+`content`를 뽑음. **"매 관광지 도착 시 그 관광지 것만" 스코핑 구조가 이미 이것으로 구현됨.** → 🔶 **`poi_key`도 함께 뽑도록 확장** 필요(핀 조인 키).
- `CONCIERGE_CHIPS` (L130) — 퀵칩 `restroom`/`photo_spot` 라벨 5로케일. 손님이 타이핑 없이 칩만 눌러도 트리거됨. **이미 있음.**

### A-2. 채팅 인라인 지도 렌더 — 🔶 확장 (단일핀 → 멀티핀)
- `components/tour-mode/LocationPreview.tsx` — 채팅 버블에 **단일핀 Static 지도 썸네일** 렌더 (기사 주차핀/도착핀/lost-me). `onError` 폴백 카드까지 있음. tr-* 토큰이라 손님앱·다크 콕핏 공용.
- `lib/tour-room/locationMessage.ts` — `staticMapUrl(lat,lng,opts)` 가 **단일** 마커 URL 생성. → 🔶 **멀티마커 버전 필요**(`markers` 여러 개 + `color:R|P` 구분).

### A-3. Static Maps 서버 프록시 — ✅ 멀티마커 즉시 가능
- `app/api/maps/static/route.ts` + `lib/maps-proxy.ts`
  - `ALLOWED_STATIC_MAP_PARAMS` 에 **`markers` 이미 포함** → 멀티마커 URL 그대로 통과.
  - 키 서버 숨김(2키 폴백), per-IP 레이트리밋, **24h 캐시**, 쿼리 4KB·60파라미터 캡. → **멀티핀 지도 카드는 이 프록시만 쓰면 키 노출·비용 폭주 위험 없음.** `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` 직접 박은 `staticMapUrl` 대신 **프록시 경유로 통일**하는 게 정석.

### A-4. 인터랙티브 지도 (Phase 2용) — ✅ 존재 / ⚠️ 크래시 이력
- `components/tour-mode/map/RoomMapCanvas.tsx` — `@react-google-maps/api` 기반. 번호핀 + **`facilities` 시설점 prop(회색 점) 이미 있음** + 사람핀. `dynamic(ssr:false)`.
- `lib/itinerary-builder/photo-pin.ts` — 사진 썸네일 마커 생성기(빌더). Phase 2 사진핀에 재사용.
- ⚠️ **주의:** 이 레포엔 `@react-google-maps/api` 2.20 vs React19/Next16 **연쇄 크래시 이력**(메모리 `project_builder_map_gmaps_compat_crash` — Polyline `setAt` 한정). **마커만 쓰면 안전**하지만, v1을 Static으로 가는 이유가 이것. Phase 2는 이 리스크를 감안.

### A-5. 핀+사진 데이터 선례 — ✅ 스키마 패턴 존재
- `tour_room_pins` 테이블: `kind / lat / lng / label / photo_url / expires_at / created_by_role`. → **핀+사진+라벨 저장 패턴이 이미 있음.** 단 이건 **룸별 휘발성**(주차·lost-me). 우리가 만들 건 **POI-전역 레퍼런스 데이터**(관광지별 화장실은 예약과 무관하게 동일) → 별도 테이블이 맞음.

### A-6. POI 데이터 모델 — ❌ 서브핀 좌표 부재 (이게 유일한 갭)
- `match_pois`: `poi_key`(PK), **`lat`/`lng` 관광지 중심 1개뿐**, `convenience`(jsonb, restroom **텍스트**), `smart_notes`(jsonb, photo **텍스트**), `is_attraction`, `region`. → **화장실·포토스팟의 개별 좌표는 어디에도 없음.**
- `tour_guide_spots`: `poi_key`, `latitude`/`longitude`, `content`(jsonb), `trigger_radius_m`. 룸의 geofence 스팟 — **`poi_key`로 `match_pois` 및 신규 핀 테이블과 조인.**
- `data/poi_kb/poi_knowledge_base_v1.29.json` (83 POI): `convenience.restroom`, `smartNotes.photo` **문장 설명만**. 좌표 0.

### A-7. Places 호출 선례 — ✅ 화장실 자동수집 토대
- `lib/tour-room/generatedContent.ts` `fetchPlaceFacts(placeId)` — `maps.googleapis.com/maps/api/place/details/json`, 서버키 `GOOGLE_MAPS_SERVER_API_KEY` (폴백 public), 5s abort, never-throws. → **화장실 Nearby Search 배치 스크립트가 이 패턴 그대로 재사용.**
- `generationBudgetExhausted(n)` — 일일 예산 게이트 선례(자동수집도 비용 캡 적용 가능).

**감사 결론:** 트리거(A-1)·프록시(A-3)·핀 스키마 패턴(A-5)·Places 선례(A-7)는 **그대로**. 확장은 (A-2 멀티핀 URL, A-1 poi_key 스레딩, 답변에 지도 첨부) **작은 3건**. **부재는 좌표 데이터(A-6) 단 하나** — 그래서 이 트랙의 무게중심은 코드가 아니라 **데이터 파이프라인**이다.

---

## §B. 바인딩 결정 (F-D1 ~ F-D10)

| # | 결정 | 값 | 근거 |
|---|------|-----|------|
| **F-D1** | 화장실 좌표 소스 | Google Places Nearby (`type=toilet`) 배치 자동수집 | 객관·공개 데이터, 자동화 가능 |
| **F-D2** | 포토스팟 좌표 소스 | 어드민/가이드 수동 큐레이션 | 주관적 → 품질은 사람이 |
| **F-D3** | 핀 렌더 v1 | 이름 라벨 + Static 멀티마커 카드 | crash 위험 0·저렴·캐시·즉시 |
| **F-D4** | 데이터 저장 위치 | **신규 테이블 `poi_facility_pins`, `poi_key` 전역 키** | 화장실/포토스팟은 예약 무관 동일 → 룸별 X, POI별 O (A-5) |
| **F-D5** | 스코핑 | 현재 도착 스팟(`latestArrivalContext`)의 `poi_key`만 | "매 관광지 도착 시 그것만" (A-1) |
| **F-D6** | 답변 서피스 | 손님 **본인 화면 전용·비영구** 인라인 카드 (`ConciergeInlineAnswer` 확장) | 피드 스팸 방지 = 기존 Tier0 원칙 유지. 공지처럼 전체 브로드캐스트 X |
| **F-D7** | 핀 개수 캡 | 화장실 최대 3, 포토스팟 최대 3 (중심 거리순) | Static 마커·가독성·비용 |
| **F-D8** | 텍스트 폴백 | 핀 0개면 기존 텍스트 응답(`restroom_none`/`photo_info`) 그대로 | 무회귀 — 데이터 없는 POI는 지금과 동일 |
| **F-D9** | 플래그 | `NEXT_PUBLIC_TOUR_MODE_V1` 아래 (현재 OFF, 파일럿 게이트) | 투어룸 일부 |
| **F-D10** | **수동 편집 = 핵심** | 어드민에서 **모든 핀(화장실·포토 공통) 추가·수정·삭제 + 자동수집분 교정**. 편집기는 선택이 아니라 **자동수집 오류 교정 레이어** → 데이터파이프라인의 상위 웨이브(W1) | 사용자 요구(2026-07-19). 한국 Places `toilet` 편차 커서 교정 UI 필수 |

**오픈 퀘스천 → §H 인간 게이트로.**

> **F-D10 상세 — 어드민 핀 편집기가 지원해야 하는 것:**
> - **추가:** POI 선택 → 지도 클릭으로 lat/lng → 종류(restroom/photo)·이름(5로케일)·선택적 photo_url → `source='curated'`.
> - **수정:** 기존 핀의 좌표·이름·종류·photo_url·sort_order 편집. 자동수집(`source='places_auto'`) 핀도 교정 가능(교정 시 `is_verified=true` 승격).
> - **삭제:** 기본 소프트 삭제(`is_active=false`, 복구 가능). 하드 삭제는 별도 확인.
> - **목록:** POI×kind별 핀 리스트 + 지도 미리보기 + source/verified 배지.

---

## §C. 데이터 모델 (W0)

신규 테이블 — **POI 전역 레퍼런스 핀** (예약/룸과 무관, `poi_key`로 조인):

```sql
create table public.poi_facility_pins (
  id            uuid primary key default gen_random_uuid(),
  poi_key       text not null,                 -- match_pois.poi_key (FK 논리적)
  kind          text not null check (kind in ('restroom','photo')),
  lat           numeric not null,
  lng           numeric not null,
  name          text,                          -- 표시 라벨(중립/영문), null이면 kind 기본 라벨
  name_i18n     jsonb,                          -- { en,ko,ja,es,zh } 선택(큐레이션 시)
  photo_url     text,                           -- Phase 2 사진핀용(선택)
  source        text not null default 'curated' check (source in ('places_auto','curated')),
  place_id      text,                           -- places_auto 출처 추적/재수집 dedupe
  distance_m    integer,                        -- 관광지 중심에서의 거리(정렬·품질)
  is_verified   boolean not null default false, -- 자동수집분 사람 검수 여부
  is_active     boolean not null default true,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index poi_facility_pins_lookup
  on public.poi_facility_pins (poi_key, kind, is_active);

-- 자동수집 재실행 idempotent (같은 화장실 중복 방지)
create unique index poi_facility_pins_place_uniq
  on public.poi_facility_pins (poi_key, kind, place_id)
  where place_id is not null;
```

- **RLS:** 손님 서빙은 서버 라우트(서비스 롤)에서 읽어 응답에 실어 보냄 → 손님 직접 select 불필요. 어드민 CRUD는 admin 세션. (마이그레이션 후 `get_advisors` 재확인 — §H.)
- **왜 룸별이 아닌가:** 성산일출봉 화장실은 어느 예약이든 같은 자리 → `poi_key` 전역이 정답(F-D4). 룸별 휘발 핀(주차)은 이미 `tour_room_pins`.

**lib 계약** — `lib/tour-room/facilityPins.ts` (신규, 순수/isomorphic):
```ts
export interface FacilityPin {
  kind: 'restroom' | 'photo';
  lat: number; lng: number;
  name: string | null;
  nameI18n?: Partial<Record<RoomLocale, string>>;
  photoUrl?: string | null;
}
// 현재 스팟의 핀을 kind로 필터·거리순·캡(F-D7) 적용
export function selectFacilityPins(pins: FacilityPin[], kind, cap = 3): FacilityPin[]
// 멀티마커 Static URL(프록시 경유, A-3) — 이름 라벨 마커
export function facilityStaticMapPath(pins: FacilityPin[], opts): string  // '?center=…&markers=…'
```

---

## §D. 서빙 (W2) — 답변에 지도 첨부

1. **`poi_key` 스레딩(🔶 A-1):** `latestArrivalContext`가 `spot_arrival` 메시지 metadata에서 `poi_key`도 반환하도록 확장. (도착 이벤트 발행 시 metadata에 `poi_key` 실려있는지 확인 → 없으면 발행부에 추가하는 1줄 티켓.)
2. **Tier0 확장:** `answerTier0('restroom'|'photo_spot', ctx, locale)` 가 `ctx.facilityPins`(현재 `poi_key`로 서버가 조회해 주입)를 받아, 핀이 있으면 `{ text, mapCard: { pins, staticPath } }` 를 반환. 핀 0개면 **기존 텍스트 그대로**(F-D8, 무회귀).
   - Tier0는 클라이언트에서도 도는데(네트워크 0), 핀 데이터는 어떻게 손에 쥐나? → **룸 스냅샷/도착 이벤트에 현재 스팟 핀을 미리 실어둠**(도착 시점에 서버가 `poi_facility_pins` 조회해 `spot_arrival` metadata 또는 스냅샷에 포함). 그러면 손님이 물을 때 **네트워크 0으로** 즉답 유지. (대안: `/concierge` 라우트가 조회 — 하지만 Tier0 무네트워크 원칙 깨짐. 전자 채택.)
3. **서피스(F-D6):** `ConciergeInlineAnswer`(본인 화면·비영구 배너)에 `mapCard` optional prop 추가 → 텍스트 아래 `FacilityMapCard` 렌더. 퀵칩 경로도 동일.

---

## §E. 렌더 (W2) — `FacilityMapCard`

신규 `components/tour-mode/FacilityMapCard.tsx`:
- **지도:** `<img src="/api/maps/static{facilityStaticMapPath(pins)}">` — 멀티마커, 화장실=파랑 `R`, 포토=핑크/앰버 `P` 라벨. `onError` 폴백(LocationPreview 패턴 재사용).
- **이름 리스트:** 지도 아래 각 핀 1행 — 아이콘 + 이름(로케일) + `photo_url` 있으면 24px 썸네일(= "사진으로 혹은 이름으로" 부분 충족) + **탭 → `https://www.google.com/maps/dir/?api=1&destination=lat,lng` 길찾기**.
- tr-* 토큰만 사용(손님앱/콕핏 공용). `data-testid="facility-map-card"`.

---

## §F. 데이터 파이프라인

### F-1. 어드민 핀 편집기 (W1) — 수동 CRUD, 모든 핀 공통 (F-D10)
**이게 데이터의 1차 입력구이자 자동수집 교정 레이어.** 화장실·포토 공통.
- **위치:** 어드민 신규 라우트(예: `/admin/facility-pins` 또는 기존 match-pois 에디터 인접). 지도 피커는 `components/maps/PickupPointSelector.tsx` / `HotelMapPicker.tsx` 패턴 재사용.
- **API:** `GET/POST/PATCH/DELETE /api/admin/facility-pins`(admin 세션 가드). POST=추가, PATCH=수정(좌표·이름·종류·photo_url·sort_order·is_verified), DELETE=소프트(`is_active=false`)+하드 옵션.
- **UI:** POI 선택 → 그 POI의 화장실·포토 핀 목록 + 지도 미리보기(마커) → 지도 클릭으로 신규 lat/lng, 행 클릭으로 편집, 삭제 버튼. source/verified 배지. 자동수집(`places_auto`) 핀 교정 시 `is_verified=true` 자동 승격.
- **5로케일 라벨:** `name`(중립) + `name_i18n` 선택 입력.

### F-2. 화장실 자동수집 (W3) — `scripts/collect-facility-pins.mjs`
- `match_pois where is_attraction` 순회 → 각 POI 중심(`lat/lng`)에서 **Places Nearby Search**(`rankby=distance`, `type=toilet`, 반경 ~250m) → 상위 3 → `poi_facility_pins (kind='restroom', source='places_auto', place_id, distance_m, is_verified=false)` **upsert**(place_id unique로 idempotent).
- 키: `GOOGLE_MAPS_SERVER_API_KEY`(A-7). 예산 캡·5s abort·never-throw.
- ⚠️ **한국 Places `toilet` 커버리지 편차** → `is_verified=false` 로 들어오고, **W1 편집기에서 사람이 교정·승격**(§H 검수 게이트).
- **파일럿 리전만 먼저**(예: 제주 그랜드 하이라이트 루프 스팟) — 전량 X.

### F-3. 포토스팟 큐레이션 (W4) — 사람 입력 + (선택) 가이드 콘솔
- **어드민:** W1 편집기로 포토스팟 핀 입력(`source='curated'`). 파일럿 관광지 **소수만**.
- **가이드 콘솔(선택, W4.2):** 가이드가 현장에서 "여기 포토스팟" 원탭 추가.

---

## §G. WBS (웨이브·티켓)

**MVP = W0 → W1(수동 편집기) → W2(손님 지도카드) → W3(화장실 자동수집).**
편집기(W1)를 서빙보다 먼저 두는 이유: 자동수집 전에도 **사람이 파일럿 POI를 손으로 채워 즉시 W2를 테스트**할 수 있고, 자동수집분 교정 레이어가 서빙 전에 준비됨.

### W0 — 데이터 토대
- **W0.1** 마이그레이션 `poi_facility_pins`(§C) + `get_advisors` 재확인.
- **W0.2** `lib/tour-room/facilityPins.ts`(타입·`selectFacilityPins`·`facilityStaticMapPath`) + 유닛테스트(캡·거리순·멀티마커 URL·프록시 경유).

### W1 — 어드민 핀 편집기 (수동 CRUD, F-D10) ← 사용자 요구, 상위 승격
- **W1.1** `GET/POST/PATCH/DELETE /api/admin/facility-pins`(admin 가드) + 유닛테스트(권한·전이·소프트삭제).
- **W1.2** 어드민 UI(§F-1) — POI 선택·핀 목록·지도 클릭 추가·행 편집·삭제·source/verified 배지·5로케일 라벨.
- **W1.3** 파일럿 POI 몇 개 수동 입력(사람) → W2 테스트 데이터 확보.

### W2 — 서빙 + 렌더 (손님 지도 카드)
- **W2.1** `latestArrivalContext` + 스냅샷/도착 이벤트에 `poi_key` & 현재 스팟 핀 주입(§D-1,2). 회귀테스트.
- **W2.2** `answerTier0` restroom/photo → `mapCard` 반환(핀0=텍스트 폴백, F-D8). 테스트.
- **W2.3** `FacilityMapCard`(§E) + `ConciergeInlineAnswer`/퀵칩 배선.
- **W2.4** E2E: 도착 → "화장실" → 그 POI 화장실 핀만 지도 / 다른 POI 도착 → 스코프 전환 / 핀 없는 POI → 텍스트 폴백.

### W3 — 화장실 자동수집
- **W3.1** `scripts/collect-facility-pins.mjs`(§F-2) + idempotent 재실행 검증.
- **W3.2** 파일럿 리전 배치 실행 → **W1 편집기에서 표본 검수·교정·승격**(§H) → 노출.

### W4 — 포토스팟 큐레이션 (사람) + (선택) 가이드 콘솔
- **W4.1** 파일럿 관광지 포토스팟 입력(W1 편집기, 사람).
- **W4.2(선택)** 가이드 콘솔 원탭 포토스팟 추가.

### W5 (Phase 2, 선택) — 사진 썸네일 인터랙티브 핀
- **W5.1** `RoomMapCanvas`/`photo-pin.ts` 재사용해 `photo_url` 썸네일 마커 + InfoWindow 이름. ⚠️ gmaps 크래시 이력(A-4) 감안 — 마커 한정, Polyline 미사용.

---

## §H. 인간 게이트 / 오픈 퀘스천 (코드로 못 넘는 것)

1. **Places API 과금·활성화** — Nearby Search(신규 or 레거시) 엔드포인트가 GCP 프로젝트에 enable 됐는지 + 배치 비용 확인. (일회성 배치라 저렴하지만 사전 확인.)
2. **화장실 자동수집 정확도** — 한국 `toilet` 커버리지 편차 → 파일럿 표본 검수 필수. **노출 정책 결정:** `is_verified` 된 것만 노출 vs 자동수집분도 바로 노출.
3. **포토스팟 큐레이션 담당·범위** — 누가(ops/가이드), 파일럿 관광지 몇 개.
4. **플래그** — 이 기능 `NEXT_PUBLIC_TOUR_MODE_V1`(현재 OFF) 파일럿에 포함할지.
5. **RLS 검증** — `poi_facility_pins` 손님 노출은 서버 경유 전제 → advisor 재확인.

---

## §I. QA 체크리스트 (W1.4 / 배포 전)
- [ ] A 관광지 도착 → "화장실" → **A의 화장실 핀만** (전체 투어 지도 아님).
- [ ] B로 이동·도착 → "포토스팟" → **B 것만** (스코프 전환 확인).
- [ ] 핀 없는 POI → 기존 텍스트 폴백(무회귀).
- [ ] 5로케일 라벨 + 지도 카드 tr-* 토큰 라이트/다크 정상.
- [ ] Static 프록시 캐시·레이트리밋 정상, 키 미노출.
- [ ] 답변이 **본인 화면 전용·비영구**(피드 브로드캐스트 안 됨, F-D6).
- [ ] `npm test` 투어룸 스위트 green, `tsc` 0.

---

## §J. 착수 순서
승인 시 **W0.1(마이그레이션) → W0.2(lib+테스트) → W1(어드민 편집기 CRUD) → W2(서빙·렌더) → W3(화장실 배치)**. 진행 보고는 한국어, 코드/커밋은 영어. 커밋 푸터는 `Co-Authored-By: Claude ...`만.
