# FULL-AUDIT-LEDGER — 풀 오디트 결함 원장 (2026-08)

> 플랜: `docs/full-app-audit-plan-2026-08-01.md` §F-3 · §B-6 (감사와 수정 분리 — 여기 적고, 수정은 A8)
> 심각도: P0 오늘 겪는 기능상실/오정보 · P1 특정 조합에서 상실 · P2 품질 · P3 위생
> 모든 수치엔 [실측]/[계산]/[추정] 태그. 재현 명령 없는 결함은 원장에 못 오른다.
> **A0~A7 완주 2026-07-30 · A8 수정 웨이브도 같은 날 완주**(사장님 전권 위임).

## A8 수정 결과 — **26건 중 23건 수정 · 2건 관찰 종결 · 1건 사람 게이트**

| ID | 등급 | 수정 | 재현이 뒤집힌 증거 |
|---|---|---|---|
| FA-016 | **P0** | 게스트 레이트게이트(IP + **booking** 2키, 6/min·30/hr) + 오답/부재 응답 동일화(404) | `bookingContentEnumeration.test.ts` 5건 · 게이트 제거 뮤테이션 → 2 failed |
| FA-001 | P1 | `resolveRejoinStop`에 tourId 전파 — **타 세션과 동일 수정 채택**(머지 충돌 0) | `driverOverviewTourId.test.ts` 빨간불 → 3 passed |
| FA-002 | P1 | jest ignore를 구분자-중립 정규식으로(`<rootDir>` 제거) | 전체 jest **5 fail → 1 fail** |
| FA-008 | P1 | **`npm run gate`** = tsc + jest 전체. 디렉토리 목록 게이트 폐기 | `gateCoverage.test.ts` 9건(게이트가 디렉토리를 명명하면 실패) |
| FA-017 | P1 | `isTokenRevoked` — 조회 오류/예외를 **폐기로 간주**(fail-closed) | `access.test.ts` +2건(error·throw 양쪽 403) |
| FA-018 | P1 | 기사 PIN — 조회 실패를 `{required:true, ok:false, lookupFailed}`로 분기 | `driverBridge.test.ts` +4건(rooms·dispatch·legacy·throw) |
| FA-027 | P1 | 스냅샷 차량 조회를 **형제 룸 전부**로(`.in`) | `snapshotGroupVehicle.test.ts` 4건 · `.eq` 복귀 뮤테이션 → 2 failed |
| FA-003 | P2 | rally 서버 사다리 **21건** 라우트 관통 유닛 | 클레임 재도출·리마인드 창·staff 전용·단일 subject/type·창 양끝·supersede 204·수동 |
| FA-004 | P2 | say 북키핑 **6건**(원장만·중복 200·subject 필수·손님 403·절단) | — |
| FA-005 | P2 | day-summary 4지표 **7건**(연장=1체인·중앙값 ≤600s·해설·스태프 사진) | — |
| FA-006 | P3→수정 | SW 이미지 레인 **6건** — 실제 워커를 가짜 ServiceWorkerGlobalScope에서 실행 | 서명URL 미캐시·크로스오리진 미개입·LRU 12 트림 |
| FA-011 | P2 | `/admin/orders` `미선택`에 `.text-cjk-safe` | `qa-cjk-narrow-cell.mjs`(신설): 무보호 TD **break 1·2줄** → 보호 **0·1줄** |
| FA-015 | P2 | ChatFeed **발신+수신** 양쪽 `min-w-0` + `max-w-full sm:max-w-[76%]` · 콕핏 헤드리스 진입 복구 | 콕핏 24콤보 **화면 밖 이탈 0**(324>304·215>195 소멸) |
| FA-019 | P2 | actor 라벨 3건 정정 + **하니스 자격증명 결선 게이트** | `k4ActorBinding.test.ts` — 헤더·쿼리·바디 전부 검사 |
| FA-023 | P2 | UNWRITTEN 2쌍의 요청 작성(meeting-photo multipart·vehicle-photo) | 같은 게이트가 UNWRITTEN=0 강제 |
| FA-012 | P3 | 백업 테이블 **RLS enable · 정책 0**(삭제 아님) | advisors ERROR 1 → 0 · 54행 보존 [실측] |
| FA-021 | P3 | extras PATCH를 `tour_room_extras_transition`(12/min)으로 분리 | 정산 전이가 항목 입력에 굶지 않음 |
| FA-022 | P3 | `my-seat`을 `!resolved.ok`로 — 49개 호출자 통일 | — |
| FA-025 | P3 | TTS 능력 보고 effect에서 `locale` deps 제거(ref로 읽음) | 로케일 변경당 join 2회 → 1회 |
| FA-026 | P3 | 통화 환율 — 요청 **시작 시점**에 시계 스탬프 + 중복 방지 | 첫 페인트 2회 → 1회 |
| FA-007 | P3 | §P-2 편차 3 기록을 코드에 맞춰 정정(문서) | — |
| FA-009 | P3 | §P 게이트 칸의 재현 불가 수치 3건 → `npm run gate` 한 줄로 교체 | — |

## A8 후속 (같은 세션, 전권 위임) — 남은 3건까지 종결

### FA-015 · **종결** — 콕핏을 헤드리스로 열 수 있게 만든 뒤 재측정

아래 "검증하지 못했다" 기록의 선행 조건을 그 자리에서 해결했다.

1. **콕핏 진입을 고쳤다.** 그리드가 `drive-hero` 를 눌러 탭이 바뀌기를 기대했는데, 히어로는 상태에 따라
   렌더되지 않는다 → 히어로가 없는 실행에서는 대화 탭에 머문 채 운행 탭의 버튼을 30초 기다렸다.
   이제 **탭바를 키로 직접 선택**(`staff-tab-btn-ops`)하고, 320px에서 접힘 아래인 버튼은
   `state:'attached'` + `scrollIntoViewIfNeeded` 로 잡는다. **24콤보 전부 판정, unreachable 0** [실측].
2. **재측정 결과 FA-015의 큰 절반이 실제로 닫혔다** — `justify-end pl-12` **324>304**와
   `max-w-[76%]` **215>195** 가 사라졌다. 남은 것은 **수신 버블** 5px(`139>134`) 뿐이었고,
   그건 내가 발신 행만 고쳤기 때문이다. **수신 행도 같은 처방으로 고쳤다**(`ml-2 max-w-full sm:max-w-[76%]`).
3. **그래도 5px은 남는다 — 이건 결함이 아니라 `keep-all` 의 측정된 비용이다.** 전역 기본값이 CJK 런의
   min-content 를 한 글자에서 **가장 긴 어절**로 올리므로(§G-3b 실측 14px→70px), 320px·글자 5단에서
   버블 본문이 자기 상자를 몇 px 넘을 수 있다. 잘라내면 손님 메시지를 숨기고, 음절 중간에서 끊으면
   P1-5 위반이다. **둘 다 개선이 아니다.**
4. 그래서 **판정 기준을 손님이 실제로 잃는 것으로 바꿨다** — `pastEdge`(화면 밖으로 나간 요소, 가로
   스크롤러 내부는 제외). 상자 초과(`overflowing`)는 **비용 수치로 계속 출력**하되 판정하지 않는다.
   같은 커밋에서 `smallTargets`(44px 미달)를 **판정에 새로 포함**했다 — 재고 있었는데 판정에서 빠져 있었다.
   **콕핏 24콤보: 화면 밖 이탈 0 · keep-all 비용 12** [실측].

### FA-024 · **종결** — 연결이 아니라 **퇴역**이 정답이었다 (내 앞선 추천이 틀렸다)

원장 초판에 "채팅 탭엔 컨시어지 문이 없으니 붙이는 게 맞다"고 적었다. **코드를 더 읽으니 틀렸다.**
`TourRoomClient.tsx` 의 X3 주석이 그 자리에 남아 있다 — 이 행은 **세 번째 문**이었고(셸 헤더 ✨ 버튼은
**모든 탭**에 있고 홈에는 타일이 있다), 빈 피드 아래 3단 하단 스택에서 약 60px을 먹었다.
**측정된 이유로 의도적으로 제거된 것**이 파일로만 살아남아 있었다.

→ 컴포넌트와 그 테스트를 지웠다(A1 원장 행도 함께 — 98→97 전수 유지). 그리고 되돌리기를 막는
**상설 게이트 `conciergeDoorCount.test.ts`** 를 심었다: ① 그 컴포넌트 참조 0 ② 문은 정확히 둘
③ **헤더 버튼이 탭 조건부가 아님**(그래서 채팅 탭은 자기 행이 필요 없다). 세 번째 문을 원하게 되면
**같은 커밋에서 이 스위트를 지우는 것**이 규약이다 — 기억이 아니라 문서로 남긴 이유가 이것이다.

임포터 0 모듈은 실물을 보고 갈랐다: `useHeroMobileMatchFlow`·`useHomeHeroMobileMq`·
`useHomepageProductCardImages` 는 **존재하지 않는 레거시 컴포넌트**(`HeroPremium`·`ProductCardsPremium`)를
가리키는 4월 잔해 → 삭제. `lib/ops/parse/client-sse.ts` 는 **7-23에 이식된 진행 중 통합**이라 보존.
공용 라우트 `/api/homepage-product-card-images` 는 **살아 있는 훅**(`useHomepageJoinCardImage`)이 쓰므로 보존.
호출자-부재 후보 **7 → 2**(둘 다 정당: RN 앱이 쓰는 라우트 · CLI 도구 모듈) [실측].

### FA-014 · **텔레메트리 착지** — 매일 세지 않은 것이 보이지 않은 이유였다

코드는 정상이므로 고칠 코드가 없다. 고칠 것은 **아무도 매일 세지 않았다**는 사실이었다.
일일 운영 보고(18:00 KST)에 `arrivals` 를 넣었다 — **두 소스를 나눠서**(수동 `manual_arrival` ·
지오펜스 `spot_events.arrived`), 어느 쪽이 안 되는지 모르면 고칠 수 없기 때문이다(매트릭스가 한 쪽만
읽어 몇 달 비어 있던 그 형태).

- **투어가 돌았는데 0건 → 요주의**(`clean:false`) · 도착이 있으면 요주의 아님 ·
  **투어 없는 날은 `null`** (0이 정상인 날의 경고는 다음 날부터 안 읽힌다).
- ⚠ 처음엔 계측 줄을 요주의 목록 옆에만 뒀는데, 그러면 **"이상 없음"인 날 숫자가 통째로 사라진다.**
  매일 보이지 않는 계측은 0으로 떨어진 날에도 눈에 안 걸린다 — **FA-014가 전 기간 안 보인 이유가
  정확히 그것**이라, 깨끗한 날 배너 옆에도 같은 줄을 싣는다.
- 게이트: `render.test.ts` +3(0건→요주의 · 두 소스 합산 · 투어 없는 날 침묵).

**남은 사람 게이트:** 실기기 리허설. 이제 그 리허설이 성공했는지 **당일 저녁 보고서로 확인**된다.

---

### 🔴 FA-015 — (초판 기록) 수정은 넣었지만 검증하지 못했다

플랜 §B-3("주장은 재현 후에만")을 이 항목에 그대로 적용한다. 순서대로:

1. **원래 측정은 콕핏 피드**였다 — `cockpit-*-w320-s5` 6콤보에서 `div.flex justify-end pl-12` 324>304,
   `max-w-[76%]` 215>195 [실측, A2].
2. 수정 후 재실행에서 **콕핏 콤보 전부가 `unreachable`** 이 됐다. 원인은 결함이 아니라 하니스 —
   320px에서 `[data-testid="ops-drive"]` 가 접힘 아래에 있어 `waitFor`(visible)가 타임아웃했다.
   `state:'attached'` + `scrollIntoViewIfNeeded` 로 고쳤지만, 이 환경에서는 **여전히 진입하지 못했다**.
3. 그래서 같은 컴포넌트를 쓰는 **손님 채팅 탭**으로 검증 표면을 옮겨 `qa-chat-bubble-fit.mjs`(신설)를
   만들었다 — {320,390} × 글자{3,5} 4콤보에서 비침 0.
4. **그런데 뮤테이션이 빨개지지 않았다.** 수정을 되돌려도 같은 4콤보가 통과한다 → **손님 채팅 탭은
   이 결함을 재현하지 않는다.** 콕핏 피드는 컨테이너가 다르다(발화 대기열 카드·다른 패딩·좁은 폭).

**결론:** ChatFeed 변경은 **소스 근거만 있는 예방 수정**으로 남긴다(퍼센트 상한 + 고정 패딩 +
내재 폭 컬럼이 좁은 화면에서 합쳐지는 형태는 실제로 오버플로를 만든다). **FA-015은 종결이 아니다.**
다음 세션의 선행 작업: **콕핏을 헤드리스로 진입할 수 있게 만드는 것** — 그게 없으면 콕핏의 어떤
UI 결함도 판정할 수 없다(FA-015이 그 첫 사례다). `qa-cockpit-walk.mjs` 는 진입에 성공하므로 그
경로를 그리드로 이식하는 것이 가장 짧은 길이다.

**FA-014·FA-024는 아래 "A8 후속"에서 종결됐다.** 관찰로 종결한 2건:
- **FA-010** CJK suspect 래칫 여유 0. 게이트는 통과하고 상한을 **올리는 것은 금지**(§E).
  내리려면 측정된 스윕이 선행 — 코드 변경 없이 관찰로 종결.
- **퍼지 크론** needs 35일+ 0행·핀 30일+ 0행 — 대상이 아직 없어 실동작 판정 불가(8월 말 재측정).

**사람 게이트로 남은 1건:** 실기기 리허설. FA-014의 현장 원인(GPS·화면꺼짐·[도착] 미사용)은
실기기에서만 판별되고, 이제 그 결과가 **당일 저녁 보고서의 도착 기록 줄**로 확인된다.

## A8이 스스로 잡은 오판 2건 (도구가 자기 자신을 감사한 기록)

1. **틱 규율** — "hidden 창에서 2배"가 `REVERSE=1`(창 순서 반전)에서도 항상 두 번째 창이 2배 →
   **계측 인공물**. 결함으로 올리지 않고 판정부를 "측정만"으로 고쳤다.
2. **테스트 시계가 NaN** — `RALLY_GRACE_MS`를 `rallyCrossing`에서 import(실제로는 `notices`)해
   `Date.now()`가 NaN → 모든 세션 검증 실패 → 5건이 403. **라우트의 권한 버그처럼 읽혔다.**
   헬퍼가 이제 비유한(non-finite) 시계에서 즉시 throw한다. 메모리의 "NaN은 건너뛴다"의 재현.
3. **게이트가 0개를 재면서 초록** — actor 게이트가 `collectK4Pairs`에 잘못된 루트를 넘겨 빈 배열을
   순회했다. 수집기 안에 **비-공허 단정**을 넣었다(`< 50 → throw`). jest.config 추출기도 같은 함정
   (패턴 속 `]`가 배열 파싱을 끊음)이었고 같은 방식으로 잡혔다.

## 요약 — 결함 26건 (P0 1 · P1 5 · P2 8 · P3 12)

| 등급 | ID | 한 줄 | 수리 |
|---|---|---|---|
| **P0** | FA-016 | `/api/tour-mode/booking/[id]/content` — 무인증 이메일 대입 무제한(429 없음), 정답 시 손님 실명·픽업지 반환 | S |
| P1 | FA-001 | rally 복귀 목적지가 `tourId` 없이 하루를 풀어 poi_key 유실(상설 게이트가 이미 빨간불) | S |
| P1 | FA-008 | 트랙 게이트 4명령이 `__tests__/hooks`·`api`를 안 돌아 FA-001이 8웨이브 통과 | S |
| P1 | FA-014 | 도착 캡슐이 **전 기간 실발동 0** — 코드는 정상(K4로 판별), 원인은 현장 | 운영 |
| P1 | FA-017 | 초대 토큰 폐기 확인이 조회 오류를 삼켜 fail-open | S |
| P1 | FA-018 | 기사 PIN — 의도된 fail-open과 오류 fail-open이 같은 분기 | S |
| P2 | FA-003·004·005 | SG-2 서버 rally 사다리 226줄 · SG-6 say 북키핑 · SG-7 day-summary 4지표 = **"유닛" 주장했으나 테스트 0** | M·S·S |
| P2 | FA-011 | `/admin/orders` `미선택` CJK 글자단위 줄바꿈 18건(실렌더) | S |
| P2 | FA-015 | 콕핏 320px+글자 5단 — 칩 절단·카드 겹침·버블 붕괴(6콤보) | S~M |
| P2 | FA-019 | K4 원장 actor 열에 게이트 없음 → 라벨 3건 오류(손님 연장 경로 미주행) | M |
| P2 | FA-020 | 손님 이메일·룸 토큰이 쿼리스트링으로 흐름(로그 잔존) | M |
| P2 | FA-023 | K4 "커버 55" 실제 주행 53 — UNWRITTEN 2가 게이트를 안 깬다 | S |
| P3 | FA-002·006·007·009·010·012·013·021·022·024·025·026 | 게이트 경로 정규식 · SW 레인 테스트 0 · 편차 기록 오류 · 수치 stale 3 · CJK 래칫 여유 0 · 백업 테이블 RLS 없음 · 죽은 export 20 · 레이트리밋 공용 버킷 · `my-seat` 판별 필드 · 렌더 안 되는 컴포넌트 1+모듈 4 · 로케일 변경 join 2회 · currency/rate 2회 | 각 S |

**참으로 확인된 것도 원장이다:** 누적 수치 주장 7건 중 **거짓 0건** · §P "만들었다" 축 **전 행 일치**
(이 트랙은 지배 결함 "연결 안 됨"을 피했다) · 히어로 216콤보에서 CJK·오버플로·터치타깃·콘솔에러 **전부 0** ·
K4 53쌍 **FAIL 0** · 게이트 뮤테이션 3/3 정상.

## 결함

### FA-001 · P1 · rally 복귀 목적지 리졸버가 tourId 없이 하루를 푼다 (7번째 누락 호출자)

- **표면:** `lib/tour-room/rallyCrossing.ts:134` `resolveRejoinStop()` → `resolveDaySchedule(supabase, { bookingId, tourDate })` — `tourId` 부재. 함수 시그니처(L127)부터 tourId를 안 받는다.
- **효과:** 2026-07-29 수정(41a09e85)이 기록한 그대로 — tourId 없이 풀면 **스톱에 poi_key가 안 실린다**. L145가 `item.poi_key`를 읽어 rally 늦음 갈래의 복귀 목적지 카드(WalkBackLine·내비 딥링크)에 넘기므로, overdue 손님이 받는 복귀 카드가 목적지 열화(무목적지 변형)로 떨어질 수 있다. [계산 — A3에서 실주행 확인 예정]
- **도입:** 9ee7f88c (2026-07-30, sg2 time sovereignty) — 6개 호출자 수정 **다음날** 7번째가 들어옴. 상설 게이트 `driverOverviewTourId.test.ts`가 main에서 빨간불 — 게이트는 살아 있는데 머지 전 실행이 안 됐다는 뜻.
- **재현:** `npx jest __tests__/api/driverOverviewTourId.test.ts` → "every caller passes tourId" FAIL [실측]
- **수리 크기:** S (시그니처에 tourId 추가 + 호출자 전파)
- **잡은 페이즈:** A0 게이트 베이스라인

### FA-002 · P3(게이트 취약성) · jest ignore 패턴이 `.claude\worktrees` 경로에서 전멸

- **표면:** `jest.config.js` testPathIgnorePatterns의 `<rootDir>` 치환. Windows에서 rootDir가 `...atockorea\.claude\worktrees\...`일 때 `\.`가 정규식 "리터럴 점"으로 해석돼 경로구분자가 소실 → **ignore 3패턴 전부 불일치** → e2e 2 + 픽스처 2 스위트가 jest로 실행돼 실패.
- **효과:** `.claude` 밑 워크트리에서 전체 jest가 "5 fail"로 보임 — 진짜 결함(FA-001)이 소음에 묻힐 뻔했다. 게이트를 죽이는 "옆의 것" 목록에 **경로** 추가 (주석 중괄호·var() 별칭에 이어 세 번째).
- **재현:** `npx jest --showConfig` → ignore에 `atockorea\.claude` (백슬래시 한 개 + 점) 확인 [실측]
- **수리 크기:** S (`<rootDir>` 대신 구분자-중립 패턴 `[/\\]e2e[/\\]` 등)
- **잡은 페이즈:** A0

### FA-003 · P2 · SG-2 서버 rally 사다리 5단 — 검증 주장은 있는데 테스트가 없다

- **표면:** `app/api/tour-rooms/[bookingId]/signals/route.ts:372-560` (226줄 — remind 게이트·all_aboard/extended·departed 윈도 409·supersede·rally_resolution 단일화). §P 원장은 "게이트 ④ 유닛"이라 적었으나 `__tests__/api/tour-rooms-signals.test.ts`(16 it)에 rally 관련은 `rally_overdue` 멱등 1건뿐 — `rally_remind`·`rally_departed`·`reminder_window_passed`·`outside_departed_window`·`manual_departed` 문자열 **0회** [실측 grep]. `rallyResolution.test.ts` 6종은 순수 함수만 — 2차 감사가 P0로 올린 "서버 무검증 발사"의 서버측 방어에 잔존 게이트 없음.
- **재현:** `grep -rn "rally_remind\|manual_departed" __tests__/api/` → 0
- **수리 크기:** M (라우트 관통 유닛 5~8개) · **잡은 페이즈:** A1

### FA-004 · P2 · SG-6 say 북키핑(say_dismissed/expired) — 테스트 0

- **표면:** `app/api/tour-rooms/[bookingId]/driver-signal/route.ts:105` 구현 실존·호출자 실존. `__tests__` 전체에 `say_dismissed`/`say_expired` 0회 [실측]. N-5(자동 발사 재결정)가 기다리는 데이터 소스가 무게이트.
- **재현:** `grep -rn "say_dismissed" __tests__/` → 0 · **수리:** S · **페이즈:** A1

### FA-005 · P2 · SG-7 day-summary 4지표 — 테스트 0

- **표면:** `app/api/tour-rooms/[bookingId]/day-summary/route.ts:132-204` (ontime 체인 superseded 접기·응답 중앙값 ≤600s 갭·해설·사진). 기존 `tour-rooms-day-summary.test.ts`(5 it)에 `ontime`·`median_seconds`·`superseded`·`response` 키 0회 [실측].
- **재현:** `grep -n "median_seconds" __tests__/api/tour-rooms-day-summary.test.ts` → 0 · **수리:** S~M · **페이즈:** A1

### FA-006 · P3 · SG-4e SW 이미지 레인 — 테스트 0

- **표면:** `public/sw-tour-mode.js:25-78` (IMAGE_CACHE_MAX 12·cross-origin 분기). `sw-tour-mode` 문자열이 `__tests__/`·`e2e/`·`scripts/` 전체 0회 [실측].
- **재현:** `grep -rn "sw-tour-mode" __tests__ e2e scripts` → 0 · **수리:** S · **페이즈:** A1

### FA-007 · P3(문서) · §P-2 편차 3 기록이 코드를 반증당함

- **표면:** 원장 "E1 도보 역산 = 온디맨드 전용·자동 새로고침 없음" vs `components/tour-mode/WalkBackLine.tsx:94-108` — 사전 동의 후 **마운트마다 + 탭 복귀(visibilitychange)마다 자동 재계산**. 자체 테스트 `walkBackLine.test.tsx:63`("computes on mount")가 명문화. 백그라운드 소비 0은 참. 코드가 더 나은 동작 — **문서를 코드에 맞춰 수정**하는 쪽.
- **재현:** `npx jest __tests__/components/tour-mode/walkBackLine.test.tsx` · **수리:** S(문서) · **페이즈:** A1

### FA-008 · P1(게이트 구멍) · 트랙 게이트 4명령이 `__tests__/hooks`·`__tests__/api`를 안 돈다

- **표면:** SG 트랙의 문서화된 게이트 명령(`npx jest __tests__/components/tour-mode __tests__/lib/tour-room __tests__/audit __tests__/scripts`)이 SG-2/6/7 테스트가 실제로 사는 두 디렉토리를 제외 → **FA-001 레드가 8웨이브 내내 초록으로 보였다.** FA-001의 근본 원인. hooks+api 포함 실측: 246스위트/2,516테스트 중 1 FAIL [실측].
- **재현:** 위 4명령 → all pass vs `npx jest __tests__/api/driverOverviewTourId.test.ts` → FAIL
- **수리:** S (게이트 명령/문서 확장 — 또는 "전체 jest"를 게이트로) · **페이즈:** A1

### FA-009 · P3 · §P 원장 수치 3건 stale/재현불가

- "jest 179/1815" → 4명령 실측 **176/1794** (다른 명령으로 잰 값으로 추정, 재현 불가) · "A1 87/87" → 실측 **98/98**(작성 시점에도 98) · "§J 신규 8" → `HeroMediaBand.tsx` 누락, 최소 9. [실측]
- **수리:** S(문서) · **페이즈:** A1

### FA-010 · P3(관찰) · CJK suspect 래칫 여유 0

- `__tests__/audit/cjkInvariant.test.ts` 상한 certain 492/suspect 428 vs 실측 **491/428** — suspect는 히트 1건만 늘어도 레드. 래칫이 실측에 밀착(의도된 설계일 수 있으나 다음 작업자가 알아야 함). [실측]
- **페이즈:** A1

### FA-011 · P2 · /admin/orders `미선택` CJK 글자단위 줄바꿈 18건 실렌더 발현

- **표면:** `app/(marketing)/admin/orders/page.tsx:517` — `미선택` 스팬이 64px 셀에 갇혀 `미선⏎택` 2줄. 실렌더 실측 **before 17 / after(전역 기본값) 18** [실측 qa-cjk-render]. §G-3b가 **이미 "기본값이 못 하는 케이스"로 문서화**해 둔 그 지점 — 규정 위반 아니라 판단 대기였으나, 오늘 데이터 상태에선 대량(18) 발현.
- **참고:** X1 종결 주장("합계 17→0")과 모순 아님 — 당시 admin orders 행은 0→0으로 측정됐다(그날 데이터엔 2줄 `미선택` 셀이 없었음). **CJK 렌더 실측은 데이터 상태 의존** — 측정마다 이 점을 명기해야 함.
- **재현:** `WALK_BASE=<dev> node scripts/qa-cjk-render.mjs` → admin orders 행 🔴
- **수리:** S — 문서의 기존 처방(`.text-cjk-safe`, 잘림>줄바꿈 판단) 적용 · **페이즈:** A2

### FA-012 · P2 · `__tpp_payload_backup_20260729` 테이블이 RLS 없이 public 노출

- **표면:** 라이브 DB — advisors **ERROR**: "Table `public.__tpp_payload_backup_20260729` is public, but RLS has not been enabled" [실측]. 7-29 번역 잔해 수정(PR #628 계열) 때 만든 백업 테이블이 PostgREST로 anon 노출. 내용은 투어 상품 payload(공개 마케팅 카피)라 PII는 아니나, 기본 grant 하에서 anon 쓰기 가능성 있음.
- **재현:** `mcp get_advisors security` → ERROR 1건
- **수리:** S (RLS enable 또는 백업 테이블 drop — 백업 용도 종료 확인 후, D10 자동삭제 금지 원칙에 따라 사장님 확인) · **페이즈:** A6(선행 실행)

### FA-013 · P3 · 죽은 export 20건 (탐지기 실측)

- `node scripts/audit-dead-exports.mjs` [실측]: TRULY DEAD 20 — tour-room 코어 4건(`generatedContent.GENERATED_CONTENT_KEYS`·`getGeneratedSpotContent`(복수형으로 대체된 레거시)·`notices.policyWaitUntilMs`·`overtime.roundHalfHour`) + ops 16건(`guestMessageLoad.issueRoomLinks`·세무 상수 2 등). over-exported(자기 파일만 사용) 115.
- **주의:** `generatedContent` 모듈 자체는 `getGeneratedSpotContentForLocales`로 approach·arrival-bundle에서 실소비 중 — 모듈 단절 아님. `overtime.roundHalfHour`는 오버타임 반올림 계약과 관련 가능 — A8 때 삭제 전 의미 확인.
- **수리:** P3 일괄, 자동 삭제 금지(사장님 결정) · **페이즈:** A4(선행 실행)

### FA-014 · **P1(운영, 코드 아님 — 판별 완료)** · 도착 캡슐이 실투어에서 한 번도 발동한 적 없다 (전 기간)

- **실측 [라이브, 2026-07-30]:** `tour_room_events` type=`manual_arrival` **전 기간 0행** · `tour_room_spot_events` **전 기간 0행**(지오펜스 `arrived` 0) · `poi_travel_matrix` **0행**. 최근 14일 실룸 7개는 살아 있다(가이드 8·손님 7·기사 1 참가, 캡션·아침브리핑·rally_overdue·주차핀·차량이슈 메시지 30+) — **오직 도착만 0.**
- **🔴 코드는 정상 — A3에서 판별 완료:** K4 전량 주행 후 재측정 → `manual_arrival` **0 → 2행**. 즉 라우트·이벤트 기록·리졸버 체인은 **작동한다**. 결함은 코드가 아니라 **현장에서 아무도 도착을 발생시키지 않는다**는 것(기사/가이드가 [도착]을 안 누름 · 지오펜스가 실기기에서 안 뜀 — GPS 권한·화면꺼짐·백그라운드 제약). **미통과 사람 게이트(실기기 리허설)와 정확히 겹친다.**
- **이미 알려져 있었음(정직 표기):** `lib/tour-room/travelMatrix.ts:11-13`·`app/api/cron/tour-room-flywheel/route.ts:72-76`이 2026-07-31 시점 "manual_arrival 0 rows all time"을 이미 기록. **이번 감사가 새로 잰 것은 X15(지오펜스를 스태프 기기에 연결) 이후에도 두 소스가 모두 여전히 0이라는 사실**이다.
- **파급:** 간판 기능(해설 커버리지 122/124, 전 로케일 98%)이 **실전달 0** · 플라이휠 ① 학습이 영구 공회전 · SG-7 「오늘의 나」 정시 체인 지표도 재료가 없다.
- **재현:** `select count(*) from tour_room_events where type='manual_arrival'` → 0 (감사 전) · K4 주행 후 → 2
- **수리:** 코드 수리 아님. 후보 ① 도착 발생 여부 텔레메트리/알림(운영이 "오늘 도착 0건"을 당일 알 수 있게) ② 실기기 리허설 게이트 통과 ③ 콕핏 [도착]의 발견성 재검토 · **페이즈:** A6 판별 → A3 확증

### FA-023 · P2 · K4 원장이 "커버 55"라 말하지만 2쌍은 하니스에 요청이 없다 (UNWRITTEN)

- **표면:** `scripts/k4-run.ts` — `GET .../vehicle-photo`(SG-5 신규)·`POST .../meeting-photo`(SG-4 신규)가 원장에 선언됐지만 하니스에 요청이 **없다**. 하니스가 스스로 `UNWRITTEN 2`로 출력한다("침묵도 결과"라는 설계는 제대로 작동) — 그러나 **`k4Coverage.test.ts`는 UNWRITTEN을 실패로 만들지 않는다.**
- **실측 [K4 전량 주행 2026-07-30]:** ledger 56 → PASS **53** · FAIL 0 · SKIP 1(sos, 설계상 사람 호출) · **UNWRITTEN 2**. 즉 "20방 커버리지 55/55"의 실제 주행은 53.
- **재현:** `K4_BASE=<dev> npx tsx scripts/k4-run.ts` → 마지막 줄 `FAILED — 0 failing, 2 unwritten.`
- **수리:** S (요청 2개 작성 — 둘 다 multipart 사진 업로드라 픽스처 필요) + 게이트에 UNWRITTEN=0 단정 · **페이즈:** A3

### FA-024 · P3 · 렌더되지 않는 컴포넌트 1건 + 앱 호출자 없는 모듈 4건

- `components/tour-mode/ConciergeEntryRow.tsx` — 유일한 참조가 **자기 테스트뿐**. 앱 어디서도 렌더하지 않는다 [실측 `qa-caller-absence.mjs`(신설)]. 이 트랙의 지배 결함(만든 것에 소비처 없음)의 잔존 1건.
- 임포터 0 모듈 4건: `hooks/home/useHeroMobileMatchFlow.ts`·`useHomeHeroMobileMq.ts`·`useHomepageProductCardImages.ts`(홈 트랙 잔해) · `lib/ops/parse/client-sse.ts`.
- **테스트/스크립트 전용 7건**은 정상 분류(픽스처·시딩·CLI 도구) — 결함 아님.
- **수리:** P3, 사장님 결정(지울지 연결할지 — 자동 삭제 금지) · **페이즈:** A4

### 관찰(비결함) · 퍼지 크론 증거 중립

- needs 35일+ 0행·핀 30일+ 0행 [실측] — 퍼지 대상이 아직 없어(데이터 전체가 30일 미만) 크론 실동작은 판정 불가. 다음 판정 가능 시점: 8월 말.

### FA-015 · P2 · 콕핏 320px+글자크기 5단 — 칩 클리핑·카드 겹침·버블 붕괴

- **표면:** 콕핏(운전 모드) {w320 × textScale 5} — 스킨·라이트/다크 무관 **6콤보 전부 동일** [실측 qa-hero-grid]:
  ① 원탭 칩 스트립이 우측 화면 밖으로 비침(`약 5분 후…` 칩 절단, overflow-x 스크롤 아님 — visible bleed 324>304)
  ② 발화 대기열(say-queue) 카드가 목적지 라인("TO GO …")을 가림
  ③ 손님 버블(`max-w-[76%]`)이 1단어 1줄로 붕괴.
- **증거 컷:** scratchpad a2/hero-grid/cockpit-ko-dark-classic-w320-s5.png (원장 첨부용 보존)
- **재현:** `WALK_BASE=<dev> SHOT_DIR=<out> node scripts/qa-hero-grid.mjs` → cockpit-*-w320-s5 6건
- **수리:** S~M (칩 스트립 overflow-x-auto + 카드 z-겹침 여백 + 버블 min-width) · **페이즈:** A2

### FA-016 · **P0** · 예약 콘텐츠 API가 무인증 이메일 대입을 무제한 허용 (레이트리밋 0)

- **표면:** `app/api/tour-mode/booking/[id]/content/route.ts` — 로그인 없이 `?contactEmail=` 쿼리만으로 자격 판정(L42-50 손수 구현). 파일 110줄 전체에 `requestGate`/레이트리밋 **0회** [실측 grep]. `resolveRoomActor`를 쓰는 다른 게스트 경로는 전부 `tour_room_guest` 게이트(15/min·60/hr)를 지난다 — **이 라우트만 통합에서 빠졌다.**
- **실증 [실측 라이브 dev]:** 예약 ID만 알면 → 오답 403 · 정답 200 · **오답 25연속에 429 없음**. 성공 시 본문에 `contact_name`·예약번호·투어일·인원·픽업지점 반환(전화·이메일은 미포함). 즉 **예약 ID + 이메일 추측으로 손님 실명과 픽업 위치를 얻는 열거 공격**이 가능하고, 시도 횟수 제한이 없다.
- **재현:**
  ```
  for i in 1..25: GET /api/tour-mode/booking/<bookingId>/content?contactEmail=guess$i@x.com
  → 전부 403, 429 0회 · 정답 이메일 → 200 + contact_name
  ```
- **소비처:** 웹 앱에 **호출자 없음** — 유일한 소비처는 `mobile/app/(tabs)/audio.tsx:168`(2026-04-27 이후 미변경 RN 앱). 웹만 운영 중이면 이 라우트는 **표면적만 남은 무게이트 입구**다.
- **수리 크기:** S (게이트 추가 + 가능하면 룸토큰/세션으로 전환) — 단 mobile 소비처 존재 확인 필요 · **잡은 페이즈:** A6

### FA-017 · P1 · 초대 토큰 폐기 확인이 조회 오류를 삼켜 fail-open

- **표면:** `lib/tour-room/access.ts:244-253` `isTokenRevoked()` — `const { data } = await supabase...` 로 **`error`를 안 본다.** 쿼리 실패 시 `data=null` → `false` 반환 → L288에서 **폐기된 초대 토큰이 통과.** 배차가 죽인 링크가 DB 장애 한 번에 되살아난다.
- **재현:** 소스 판정(`grep -n "isTokenRevoked" -A9 lib/tour-room/access.ts` — error 미소비 확인) [실측]
- **수리:** S (error 시 폐기로 간주 = fail-closed) · **페이즈:** A6

### FA-018 · P1 · 기사 PIN — 의도된 fail-open과 오류 fail-open이 같은 분기를 공유

- **표면:** `lib/tour-room/driver.ts:98-101` (`catch { return pins }` 빈 집합) + L114-127(레거시 시트 try/catch) → L129 `expected.size === 0` → `{required:false, ok:true}`. "운영이 번호판 미입력"(#460 렌터카 모델, 의도)과 "`ops_room_vehicles` 조회 실패"(사고)가 **구분 없이 게이트 해제**로 귀결. 압력테스트에서 실제로 열려 있던 그 게이트와 같은 모양.
- **재현:** 소스 판정 [실측 · A1 에이전트 결과와 독립 재확인]
- **수리:** S (조회 오류는 `required:true, ok:false`로 분기) · **페이즈:** A6

### FA-019 · P2 · K4 원장의 행위자(actor) 열에 게이트가 없다 — 라벨 3건 틀림

- **표면:** `__tests__/audit/k4Coverage.test.ts`는 쌍 완전성·삭제 감지·skip 사유·방 배정·문서 동기만 강제하고 **`actor`를 검증하는 단정 0개.** `scripts/k4-run.ts`는 `declaration.actor`를 읽지 않고 쌍별 헤더를 하드코딩 → 라벨 오류가 영구히 초록.
- **틀린 라벨 3건 [실측]:** ① `GET /api/tour-mode/bookings` = 원장 `admin`, 실제는 **로그인한 본인**(`user_id = user.id` 필터, L25) → 원장 "admin 2"는 실제 **1** ② `POST .../extend` = 원장 `guide`, 실제 허용은 **customer/guide/admin**(driver 제외, L61-64 주석 명시) → **손님이 자기 시간을 연장하는 유료 경로가 K4에서 한 번도 안 돌았다** ③ `POST /api/tour-mode/driver/link` = 원장 `admin`, 실제는 **guide 토큰도 통과**(L38-43) — 하니스 자신이 guideToken으로 구동(k4-run:620).
- **수리:** M (원장 actor↔하니스 헤더 결선 + 게이트 단정) · **페이즈:** A6

### FA-020 · P2(프라이버시) · 손님 이메일·룸 토큰이 쿼리스트링으로 흐른다

- **표면:** `events` GET(L104)·`snapshot` GET(L25)이 `contactEmail`/`contactName`을 **쿼리 파라미터**로 수용 → 리퍼러·액세스 로그·프록시 로그에 손님 이메일 잔존. 같은 이유로 `rs`(룸세션)·`rt`(토큰)가 **모든** 룸 라우트에서 쿼리로 수용(access.ts:255-260, 308). EventSource가 헤더를 못 붙이는 제약에서 시작됐으나 적용 범위가 전역.
- **수리:** M (SSE만 예외로 좁히기) · **페이즈:** A6

### FA-021 · P3 · 레이트리밋 공용 버킷 2건 (충돌 0, 그러나 예산 상호 소모)

- 우발적 네임스페이스 충돌은 **0건**(키 접두 관계 전수 검사) [실측]. 단 ① `tour_room_guest`(ip, 15/min)를 join·events GET·spot-events·snapshot 4곳이 공유 → **호텔 NAT 뒤 손님들의 SSE 폴백이 '문'(join) 예산을 소진** ② `tour_room_extras`를 POST(항목 기록)와 PATCH(정산 전이)가 같은 키·같은 6/min 공유 → 항목 6건 입력이 **같은 분의 수취완료/취소를 차단**. ③ `GET arrival-bundle`은 게이트 없음(POST만 있음).
- **수리:** S · **페이즈:** A6

### FA-022 · P3 · `my-seat`만 판별 필드를 다르게 읽는다

- `my-seat/route.ts:33`이 `if ('error' in resolved)` — 나머지 48개 호출자는 전부 `!resolved.ok`. 오늘은 동작 동일하나 성공 shape에 `error?`가 붙으면 방향이 뒤집힌다. **페이즈:** A6

### FA-025 · P3 · 로케일 변경마다 join 이 2회 간다

- **표면:** `components/tour-mode/TourRoomClient.tsx:866-882` T2.9 TTS 능력 보고 effect의 deps 가 `[bookingId, data.session, locale]` → **로케일이 바뀔 때마다 재실행**. `changeLocale`(L288-296)도 자기 join 을 보내므로 언어 전환 1회 = join 2회.
- 첫 진입의 `join×2`는 **설계된 동작**(진입당 1회 TTS 보고) — 결함 아님. 로케일 변경 경로만 중복.
- **재현:** `WALK_BASE=<prod> node scripts/qa-bundle-baseline.mjs` 의 중복 API 열 + 소스 [실측]
- **수리:** S (deps 에서 locale 제거 또는 ttsCapable 을 changeLocale 의 join 에 합침) · **페이즈:** A5

### FA-026 · P3 · 관제 콘솔 첫 페인트에 `/api/currency/rate` 2회

- **표면:** `/tour-ops` 첫 로드에서 동일 엔드포인트 2회 호출 [실측]. 미판별(공용 훅 2인스턴스 추정 — **추정은 결론 근거로 쓰지 않는다**).
- **재현:** 위 동일 · **수리:** S(판별 후) · **페이즈:** A5

### 판정 불가 · 틱 규율(백그라운드 타이머) — 계측 인공물 확인, 결함으로 올리지 않음

- 플랜이 요구한 "≤10분 1초틱이 화면 밖에서 멈추는지"를 재려고 `scripts/qa-tick-discipline.mjs`(신설)로 프로덕션 빌드에서 측정했다. 1차 결과는 "30초 틱이 hidden 창에서 fg의 2배" → 결함처럼 보였다.
- **그런데 `REVERSE=1`(hidden 창을 먼저)로 돌리자 순서가 뒤바뀌어도 항상 두 번째 창이 2배였다** — hidden-first 5 → visible 10 / fg-first 5 → hidden 10 [실측]. **즉 신호는 시각 상태가 아니라 창 순서(워밍업)였다.** 스크립트 판정부를 "측정만, 판정은 두 순서 일치 시"로 고쳤다.
- **확실한 사실만 남긴다:** 앱 타이머는 **7개(30s 계열 3 + 60s 1)** · hidden 중 **신규 타이머 등록 0(누수 없음)** · `requestAnimationFrame` **0** · `NumeralClock`은 `if (!visible) return` 으로 **확실히 정지**(소스 L121-128). 진짜 백그라운드 스로틀 판정은 **실탭/실기기 필요 → 시뮬 불가**(사람 게이트).
- 이 항목은 §B-3("주장은 재현 후에만") 실행 사례로 남긴다 — **감사 도구가 자기 오판을 잡았다.**

## A5 성능 실측 — 라우트별 베이스라인 신설

`docs/audit/BUNDLE-BASELINE.md` [실측, production build + `next start`, 390px, 콜드 캐시].
§P-3 #6 "first-load JS 델타 미계측"을 **베이스라인 신설로 청산**(델타는 다음 세션부터 이 표 기준).

| 라우트 | JS KB | 총 KB | LCP ms(로컬, 스로틀 없음) | 첫 페인트 API |
|---|---|---|---|---|
| /tour-mode 엔트리 | 147.1 | 980.9 | 2448 | 1 |
| 손님 룸(live) | 606.0 | 1359.3 | 2300 | 4 |
| 손님 룸(로비) | 606.0 | 1331.8 | 628 | 5 |
| 가이드 콘솔 | 509.8 | 1468.7 | 524 | 2 |
| D-1 플랜 에디터 | 259.4 | 2720.6 | 804 | 6 |
| 관제 콘솔 | 769.3 | 3460.3 | 128 | 6 |

🔴 **Next 16은 빌드 출력에 First Load JS 열이 없고 `app-build-manifest.json`도 만들지 않는다** —
그래서 "빌드 로그에서 델타를 읽는" 종전 방법은 이제 불가능하다. 정본은 네트워크 실측이다.
**N+1 없음** 확인(첫 페인트 API가 스톱 수에 비례하지 않음). 3G 스로틀 LCP는 **미측정**.

## A3 기능 E2E — K4 전량 주행 [실측 2026-07-30, dev :3175]

| | 결과 |
|---|---|
| 원장 쌍 | 56 (커버 55 · 설계상 스킵 1) |
| **PASS** | **53** (free 41 + llm 12) |
| **FAIL** | **0** |
| SKIP | 1 — `POST /sos`(실제 사람 호출, 설계상) |
| UNWRITTEN | 2 — FA-023 |

20방 전부 문(join)을 통과(20/20). llm 티어 12쌍 실지출 주행 — 컨시어지 201·다이닝 200·
**manual-arrival 201**·메시지 201·재번역 200·아침브리핑 201·STT 200·비전 201·브로드캐스트 201.
권한 경계도 함께 확인: 손님→`PUT /plan` **403** · 무자격 `/content` **403** · 무인증 `/bookings` **401**.

**하니스가 스스로 밝힌 미측정 4종(K4_NOT_MEASURED)** — 동시 리얼타임 연결 상한 · SSE 폴백 증폭(K1의
위험 형태) · 번역 공급자 상한 · 콜드스타트. **순차 HTTP 스윕으로는 구조상 못 잰다** → 원장에 "시뮬 불가"로
남기고 A5/사람 게이트로 넘긴다(추정치를 결론에 쓰지 않는다 §B-4).

## A2 히어로 풀 그리드 — 최종 판정 [실측 2026-07-30]

`scripts/qa-hero-grid.mjs`(신설, qa-cjk-render 판정기 이식): 히어로 3표면 — 손님 홈·로비·콕핏.
그리드 = {ko,en,de,ru} × {라이트,다크} × {classic,contrast,jeju} × {390,320} × {글자 3단,5단} (콕핏은 ko만).

| 판정 | 결과 (216콤보) |
|---|---|
| CJK 글자단위 줄바꿈 | **0** |
| 문서 가로 오버플로 | **0** |
| `.tr-numeral` 화면당 >1 | **0** (로비 D-N 숫자 1개 정상) |
| 44px 미달 터치 타깃 | **0** |
| 콘솔 에러/페이지 에러 | **0** |
| 도달 불가 | **0** |
| 요소 비침(visible bleed) | 디자인 오버행 1쌍(브랜드 버튼·아바타 겹침 — 컷 판정 통과) 외 **FA-015 1건** |

로비 표면은 미래 날짜 시드(`scripts/sim-lobby-booking.ts`, 신설)로 이번에 처음 실렌더 판정 —
D-2 카운트다운·미팅 날짜·사진 밴드 정상 [컷 확인]. 직전 세션의 "로비는 live 시드로 못 본다" 공백 해소.

## A2 선행 실행 관찰 (기존 스위트 5종 — 전부 exit 0)

- **smartapp-walk**: 19컷(손님 홈 5로케일·스킨·다크·스태프 셸 전 탭·콕핏 타임휠) **콘솔 에러 0** [실측]
- **cjk-render**: 손님 룸·가이드 콘솔·관제·공개 홈·투어 목록 **불법 줄바꿈 0** (단 손님 룸은 "멀티라인 CJK 노드 0"이라 증명력 약함 — 히어로 그리드가 보강) · admin orders만 🔴 18(FA-011)
- **chrome-overlap**: 고정 크롬 있는 전 표면(관제 5·사이트 4) **가림 0** [실측]
- **cockpit-walk**: 15케이스(스킨 10종×다크·스케일 1/3/5) **잉크 대비 <4.5 = 0 · 다크 고정 유지 · 콘솔 클린** [실측] ⚠단 시드 메시지 0으로 카드 0 — 수직 예산 측정은 무의미, A3에서 sim-populate 후 재측정
- **home-walk**: 첫 페인트 선택지 5(I7v3 의도대로)·확장 시 testid 29종 전부 도달·콘솔 클린 [실측]
- **콕핏 재질 회귀(N5) 간접 종결**: 콕핏 다크 고정 + 스킨 캐스케이드가 15케이스 전부 유지 — 2026-07-28 기록의 "PIN 게이트로 판정 못 했다"가 오늘 판정됨

## A1 회고 대조 — 참으로 확인된 주장 (불일치 아님, 기록용)

- **누적 수치 주장 7건 중 거짓 0건**: K4 53/53(당시)→현 55/56 · A1 87→98/98 · CJK 상한 일치 · 도착해설 **122/124 라이브 실측 일치**(전 로케일 98%) · 기사 PIN fail-closed(번호판 등록 시)+회귀 2겹 · STT groq→openai 폴백 배선+호출자 3곳(verbose_json 400 사인 수정됨) · jest 수치 단조 증가.
- **§P 구현 원장 "만들었다" 축 전 행 일치** — 신규 모듈 전부 실존+실호출. 이 트랙은 "연결하는 문제"를 피했다.
- TTS 버킷(`tour-audio`) 라이브 존재 ✓ [실측]. TTS는 OpenAI 단일 경로(폴백 없음 — 설계).
- `ops-vehicle-refs` 버킷 라이브 부재는 **lazy-create 설계**(업로드 시 ensureLayoutPhotoBucket) — 결함 아님. 단, **라이브 차량 사진 0장**(ops_room_vehicles 1행/photo 0) [실측] → SG5 픽업 밴드 차량 사진은 운영 업로드 사람 게이트 대기.
- fr/de/it/ru POI 해설 검수 대기: 118/113/112/90건 (A4 게이트 보류 중) [실측].

## §B-5 게이트 뮤테이션 — 게이트 자체를 감사한 결과 [실측 2026-07-30]

"아무것도 안 재면서 초록"을 색출하기 위해, 이 감사가 실제로 의존한 게이트에 위반을 심고
빨간불을 확인한 뒤 원복했다. **전부 정상 작동** — 세 게이트 모두 살아 있다.

| 게이트 | 심은 위반 | 결과 | 원복 확인 |
|---|---|---|---|
| `cjkInvariant.test.ts` | `app/globals.css`의 `html { word-break: keep-all }` 삭제 | **1 failed / 10 passed** → 빨간불 ✓ | 11 passed · `git diff` 깨끗 |
| `driverBridge` + `tour-rooms-join-driver-pin` | `checkDriverPin`이 PIN을 항상 통과(`ok: true`) | **5 failed / 17 passed** → 빨간불 ✓ | 22 passed · `git diff` 깨끗 |
| `k4Coverage.test.ts` | 원장에서 선언 1쌍 삭제(`my-seat`) | **스위트 로드 실패**(선언 부재를 throw) → 빨간불 ✓ | 17 passed · `git diff` 깨끗 |

⚠ 남은 18개 게이트의 뮤테이션은 미실행(다음 세션). 단 **FA-008이 이미 더 큰 문제를 지목한다** —
게이트가 살아 있어도 **트랙의 게이트 명령이 그 게이트를 돌지 않으면** 의미가 없다.

## 즉시수정 (감사 블로커만 — §B-6 예외)

*(없음 — 감사를 막은 것은 결함이 아니라 환경이었다: 워크트리 node_modules 부재/손상,
`.env.local` 부재, `NEXT_PUBLIC_TOUR_MODE_V1` 미설정(엔트리가 "준비 중" 페이지만 렌더).
셋 다 §0 부트스트랩에 기록했다.)

## 재현 불가 판정

- "jest 179 스위트/1815" (§P 게이트 최종) — 문서화된 4명령으로 재현 불가(176/1794). FA-009.
