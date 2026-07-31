# 스마트 가이딩 앱 마스터 플랜 v1.2 — 시간·사진·발화권·신뢰 (2026-07-30)

> **지위: 이 트랙의 실행 SoT.** `smartapp-ui-fusion-plan-2026-07-29.md`의 §H 웨이브를 대체한다.
> 짝 문서: **감사**(`smartapp-ui-fusion-audit-2026-07-29.md`), **왜**(`smart-guiding-app-zero-based-design-2026-07-29.md`),
> **구조 목업**(`docs/assets/smart-guiding-mockups-2026-07-29.html`, 재질 참고 금지).
>
> **v1.1 (2026-07-30):** v1.0 실검증 개정 — 게이트 실행(tsc 0 · jest 164스위트/1706 통과), dev 서버 + 시드 룸 + Playwright
> 실렌더 측정, 마이크로 감사 6건 + 적대 리뷰 29건(P0 1) 반영.
> **v1.2 (2026-07-30):** **v1.1이 새로 도입한 장치 자체를 표적**으로 한 2차 딥 감사 반영 — 신규 P0 1(서버 무검증 발사·민팅 표면) ·
> P1 13 · P2 13 + 자체 발견 12(SSR 결정론·헤드리스 사다리 훅·2b 3분할·킬스위치 등). 상세 **§O**.
> 사장님 확정(2026-07-30) §N — **N-3 제외, 나머지 승인**.
>
> **사장님 불변 7 (여기 어긋나는 티켓은 무효):** ① 채팅 화면 무변경(§J의 버그픽스 예외 1건만 명시 허용) ② 재질(카드·버튼·음영·질감·스킨 10종·POI 자산) 무변경
> ③ 코디=사장 직접(영·중 관광통역안내사) ④ 해설=TTS ⑤ 픽업 +10 / 관광지 +15 엄격 ⑥ 원가 내재화("준비되어 있습니다"로 자랑)
> ⑦ 기사 로그 공개(단 별점은 집계만, 순위표 금지)

---

## A. 제품 문장

**앱은 시계를 소유하고, 기사는 발화권을 소유하고, 화면은 주인공 한 명만 소유한다.**

손님에게 하는 약속 5개 — 모든 티켓은 이 중 하나를 강화해야 한다:

| # | 약속 | 오늘의 상태 (실검증) | 이 플랜의 답 |
|---|---|---|---|
| P1 | 지금 무슨 일인지 항상 안다 | NowCard 7상태 완비, 단 숫자가 문장에 갇힘 | §D 4행 문법 + `.tr-numeral` |
| P2 | 다음 일이 **몇 시**인지 항상 안다 | 시각은 있으나 기기 시계 기준, **첫 푸시가 T+5(이미 늦은 뒤)** | §E 서버 시계 + T-10 푸시 |
| P3 | 규칙은 **미리** 알려주고, 알려준 대로 **집행**된다 | 표시도 집행도 없음. ⚠ free_time 룸은 T0 이후 hero가 rally로 안 넘어감(§E-5) | §E E2 표기 + wait_ended + SG-2d |
| P4 | 길을 잃어도 **다음 행동**이 화면에 있다 | rally 사다리 T+15에서 소멸, 그 뒤 무 | §E-4 재합류 캡슐 |
| P5 | 모든 안내는 **사람(기사)의 행동**이다 | 도착 카드에 기사 이름 0 | §G 발화 대기열 + §H E3 귀속 |

성공 지표는 제로베이스 §J 승계 — 특히 **"화면 켜짐 시간은 낮을수록 좋다"**: 모든 화면은 3초 글랜스 최적화, 체류 유도 장치 금지.

---

## B. 코드 리얼리티 (실검증 완료)

**재사용 ✅ — 이미 있고 그대로 쓴다:**

| 자산 | 위치 | 소비처 |
|---|---|---|
| NowCard 리졸버(의미론만, 카피 분리) | `lib/tour-room/nowCard.ts:130-245` | §D — 상태 기계 무변경(+SG-2d 1줄 제외), data 필드만 추가 |
| 카피 계약 `Record<RoomLocale,…>` 10로케일 tsc 강제 | `lib/tour-room/nowCardCopy.ts:16-42` | §D-3 신규 키 (키셋 고정 테스트 없음 — 추가 안전 확인됨) |
| 캡슐 문법: `sender_role:'system'` + `metadata.kind` + `translations` jsonb + ChatFeed 분기 | `signals/route.ts:141-155` · `ChatFeed.tsx:660-840` (`:799` `if (system)` 앞 삽입 — 실측 확인) | wait_ended 캡슐 |
| 멱등 이벤트 UNIQUE `(room_id, subject_key, type)` | `lib/tour-room/events.ts:45-77` | 크로싱 디듀프 전부 — ⚠ **다른 subject끼리는 중재 안 함**(§E-4 resolution 설계의 이유) |
| 클라이언트-크로싱 발사 (rally_overdue) | `NoticeBanner.tsx:248-258` · `signals/route.ts:123-174` | T-10·wait_ended — ⚠ **손님 포그라운드 단일 실패점**이라 콕핏을 공동 발사자로(§E-3·4) |
| 적응 틱 규율 (마지막 3분만 1초, 그 외 15/30초) | `NoticeBanner.tsx:232-244` · `DepartureCountdown.tsx:325-336`(1초 모드 자체가 없음) | NumeralClock — **같은 규율 내장**(SG-D3) |
| 프리셋 원탭: key만 전송, 서버 해석, LLM 0 | `messages/route.ts:282-300` | 발화 대기열 — 필요한 4키(departing_soon·seatbelt_check·check_belongings·rest_stop) **전부 기존재**(`quickReplies.ts:303,351,431,447`) — 키 추가도 불필요 |
| X15 도착 프롬프트 "제안하되 절대 자동 발사 안 함" — **일시적** 오버레이(`absolute top-16 z-30`) | `Cockpit.tsx:1722-1769` | SayQueue 원형 — 단 상시화 금지(§G-2) |
| 지오펜스 상수 · 콕핏 카메라 경로 · `is_verified` 검수 패턴 | `geo.ts:24-32` · `Cockpit.tsx:908-925` · facility_pins | 집합 사진 (§F-3) |
| per-booking 요약 라우트 | `day-summary/route.ts` · Cockpit `:2159-2219` | 오늘의 나 (§H-1) |
| 내비 딥링크 4종 · 스와치 폴백 | `nav-links.ts` · `plan/PoiThumb.tsx:92-104` | 재합류 카드 · 사진 밴드 폴백(**필수**, §F-1) |
| skinContrast는 토큰 블록 파서 | `skinContrast.test.ts:44-60` | `.tr-numeral`·`.tr-hero-media` 추가 등록 **불요**(실측 확인) |

**확장 🔶:** nowCard data 3필드 + `latestArrival` + **rally kind 제한 1줄**(§E-5) · snapshot `server_now_ms`·**`stop_images` 맵**·say subjects ·
`GUEST_SIGNAL_TYPES` 앞단 분기 **rally 3종**(§E-4 — 화이트리스트 합류 대신 **이전 분기**: `TEMPLATES` 더미 강제 회피) · day-summary 4행 ·
**HomeTab/TourRoomClient/LobbyCard 배선**(v1.0 인벤토리 누락 — §J 반영).

**부재 ❌:** `.tr-numeral` · `NumeralClock` · 서버 시계(레포 grep 0 — NoticeBanner·DepartureCountdown·HomeTab이 **각자 시계 소유**: `:213`·`:313`·`:492-496`) ·
T-10 푸시 · wait_ended(+ **발사 파생 자체가 불가능한 현 구조** — §E-4 P0) · 집합 사진 파이프라인 · 차량 사진 손님 출구 · sayQueue(+**이벤트 읽기/쓰기 경로**) · 스태프 일일 스탯 · D-1 온보딩.
⚠ **moving·arrived numeral의 데이터도 현재 없다**: HomeTab이 `nextStop.time`을 `null` 하드코딩(`:540`), `metadata.stay_minutes`는 **writer가 레포에 없음**(reader만 `nowCard.ts:276,284`) — §D-2가 소스를 재정의했다.

---

## C. 바인딩 결정 (SG-D1~D18, v1.1 개정 포함)

| # | 결정 | 근거 |
|---|---|---|
| SG-D1 | `.tr-numeral` 34px 한 단, **불변식 = "화면당 최대 1개"**. 기본 자리는 hero 카드 내부; hero가 없는 화면(lobby)은 최상단 카드 1곳 허용. 크기 변형(`--sm` 등) 금지 — 집행 게이트는 §K ① | v1.0의 "hero 전용"은 LobbyCard(`tr-card`, `:173`)와 자기모순이었다(실측). 진짜 불변식은 개수다 |
| SG-D2 | 4행 문법: 상태/시간/장소/행동. **숫자가 없거나 신뢰구간 밖이면 행 제거** | 원칙 6. 각 상태의 숫자 소스는 §D-2가 "실존하는 데이터"로만 지정 (v1.0의 stay_minutes·nextStop.time 의존은 실측에서 부재 판명 → 재설계) |
| SG-D3 | 틱은 NumeralClock 한 컴포넌트 소유 + **적응 틱 내장**: 타깃까지 >10분=30초, ≤10분=1초(visible 한정), 초과(+MM:SS)=1초, N분형=30초, D-N=0 | v1.0의 "free_time 전체 1초"는 레포가 이미 가격 매겨 기각한 규율(`NoticeBanner.tsx:232-244`)의 역행이었다 |
| SG-D4 | 시계는 하나 — `server_now_ms` 주입 지점은 라우트가 아니라 **`buildRoomSnapshot`**(join 라우트도 스냅샷을 반환하므로 콜드 스타트·콕핏 호출까지 한 번에 커버). `nowMs()` 컨텍스트로 **자체 시계 3개 교체**(NoticeBanner `:213`·DepartureCountdown `:313`·HomeTab `:492-496`) | 발사기가 기기 시계면 E-1 효과가 발사 지점에서 실패. 라우트 주입이면 join 응답(첫 페인트)에 오프셋이 없다 |
| SG-D5 | E2 표시는 순수 렌더 파생, 신규 메시지 0. `RALLY_GRACE_MS`(15분) 상수 추출로 표시·만료·발사가 **같은 상수**를 읽는다. 픽업(+10)은 **집행 캡슐 없음**(F-4) — 카피도 약속문이 아니라 요청문(`pickupWaitUntil` = "…까지는 나와 주세요")이라 표시-집행 불일치가 발생하지 않는다 | 적대 리뷰 #8의 해소: 집행이 없는 곳엔 약속형 문장을 두지 않는다 |
| SG-D6 | 대기 종료 = wait_ended 캡슐. **클라이언트 발사 파생은 `rallyResolution()` 신설**(만료 무시 raw 최신 notice, 윈도우 `GRACE ≤ past ≤ GRACE+10분`, **cancelled → null · arrival_bundle 승격 포함 = activeNotice와 동일 kind 집합 · `created_at < targetMs` 요건**) — activeNotice 기반이면 윈도우 폭 0(1차 P0). 🔴 **서버는 클라이언트를 믿지 않는다**(2차 P0): departed/remind 분기는 ① noticeId로 메시지 실로드(부재·비-notice → 404 — 현행 rally_overdue처럼 임의 문자열을 subject로 민팅하지 않는다) ② metadata+tour_date로 targetMs 재계산 후 `now−target ≥ GRACE` 독립 검증 ③ `created_at < targetMs`(백데이트 차단) ④ **cancelled·승격 포함 최신 notice 존재 시 204**. 결말 3종은 **단일 subject `rally:{noticeId}:resolution` + 단일 type `'rally_resolution'`**(UNIQUE는 (room,subject,**type**) — type이 갈리면 TOCTOU 부활) + payload(`all_aboard`\|`departed`\|`extended{next_notice_id}`). **캡슐 자체 멱등은 별도 subject `rally:{id}:capsule`** — 스태프 수동 [낙오 처리] 버튼은 resolution 무관하게 캡슐 경로로 발사(all_aboard 오탭 탈출구). departed 승자는 푸시(**태그 `departed-{noticeId}`, Android `renotify:true`**) + **overdue와 동일한 이메일 레일**(더 치명적인 쪽에 폴백이 없던 역전 해소) + 관제 어텐션. 픽업 판정은 카드 단위 스탬프가 아니라 **writer의 lifecycle 파생**(`lobby`·픽업 시퀀스 시각대 → `meeting_context:'pickup'`, live 미드투어 제안 → `'rally'` — MeetSetCard는 미드투어 용도가 문서화된 카드라 일괄 스탬프는 오분류) → pickup은 발사 제외. writer측 완화: until/meeting_time이 **과거로 파싱되면 400**(오타·자정 넘김이 즉발 캡슐이 되는 것 차단) | 2차 P0 #1 · P1 #2·#3·#4·#7·#9 · P2 #16 · 자체(수동 탈출구) 전부 이 행 |
| SG-D7 | T-10 푸시 + **발사 로직은 시각 컴포넌트가 아니라 헤드리스 `useRallyLadder` 훅**(30초 자체 틱 — 콕핏엔 사다리용 시계가 없고, 배너 내장 이펙트는 1e 억제·만료 후 윈도우와 구조 충돌) — 게스트 TourRoomClient + 콕핏이 같은 훅을 마운트, 콕핏(웨이크락) 1순위·손님 백업. 라우트 예외는 **rally 3종**(remind·departed·**all_aboard**) — 2종이면 [전원 탑승]·extended 기록이 기사 콕핏에서 갈 라우트가 없다(driver 403). 레이트게이트는 액터 해석 **뒤**, 전용 네임스페이스(`tour_room_rally_crossing`) — 게스트 신호 버킷(6/min) 기아 방지. 푸시 카피는 목표 시각 기반("10:30 집합 · {point}"), 태그 `remind-{noticeId}` | P1 #3·#5 · P2 #15 · 자체(헤드리스 훅·콕핏 틱) |
| SG-D8 | E1 도보 역산: 옵트인 + **one-shot `navigator.geolocation`** + 열화. 🔴 `useGeoWatcher` 재사용 금지 — 그 훅은 위치를 **룸에 발행**한다. 재계산은 **온디맨드만**(마운트·visibility 복귀·재탭 — 인터벌 없음). 위치 없으면 행 생략, 있으면 하버사인/70m·분, clamp[2,60], 출발 = target − 도보 − 3분. 서버 전송 0 | P1 #20 명문화 + 배터리 |
| SG-D9 | 사진 밴드 144px 고정, 글자 안 얹음, **폴백은 스와치 필수**(onError 밴드 제거는 실패 케이스에서 정확히 CLS≠0) — PoiThumb `avatarColorFor` 문법. `contrast` 스킨은 밴드 숨김. 채팅 SpotArrivalCard는 무변경 — 단 **onError 결함 수정 1건은 버그픽스 예외**로 SG-4a에 포함(불변 ①은 리디자인 금지지 결함 존치가 아니다) | P2 #18 · P1 #13 해소 |
| SG-D10 | 집합 사진은 기사가 만든다 (지오펜스 도착 + verified 부재 → 촬영 제안 → 공개 버킷 → 검수 → verified만 서빙) | 변경 없음 |
| SG-D11 | 발화 대기열 v1 = 순수 오케스트레이션, 신규 전송 경로 0, 자동 발사 없음. **기본 상태는 접힌 1줄 필** — required 발생 시에만 X15처럼 일시 확장. 🔴 **fired 판정은 subject가 아니라 type 파생** — 기존 발사 3경로는 subject를 안 쓴다(브리핑=type만·멱등 가드도 없음, 도착=`manual_arrival`, 복귀=`signal` payload) → 오늘 KST 창의 `manual_arrival`(poi별)·`morning_briefing`·`signal.payload='return_time'` + `say_dismissed`로 서버가 fired-set을 도출해 스냅샷에 동봉, 클라이언트는 발사 직후 낙관 병합. 브리핑엔 subjectKey `briefing:{kstDay}` 추가(이중발사도 같이 잡음). **arrived·"90분 무정차" 판정은 휘발성 지오펜스 상태가 아니라 durable 소스**(`latestArrival(messages)` + 마지막 `manual_arrival` 이벤트 시각) — 위치 공유 OFF 기사(합법 상태)에서도 대기열이 살아 있어야 한다 | P1 #10·#11·#15 |
| SG-D12 | 오늘의 나 = day-summary 확장. **집계는 rally 체인(대체 관계) 단위** — 연장 1회가 분모를 2로 부풀리지 않게. 순위표 금지 | P1 #16 반영 |
| SG-D13 | T-0 이름 사인 = 콕핏 시트 1장, 2탭 이내 | 변경 없음 |
| SG-D14 | 온보딩 신호 데모는 로컬 에코(전송 0) | 변경 없음 |
| SG-D15 | moving 안심 문장은 정식 상태 — 기존 톤 문법으로 | 변경 없음 |
| SG-D16 | 응답 시간 약속 표시 금지 유지 | 변경 없음 |
| SG-D17 | 신규 카피 전부 사전 번역 Record, 런타임 LLM 0, `CORE_TRANSLATION_LOCALES` 동결 | 변경 없음 |
| SG-D18 | 1초 틱 낭독 금지: numeral `aria-hidden`. sr-only status는 **`<section>` 바깥 sibling**(루트 `aria-atomic="true"` — 내부면 갱신마다 카드 전체 재낭독) + **낭독 시점 = 상태 진입 1회 + 분기점(T-10/T-5/T-1)** — 진입 낭독이 없으면 SR 사용자는 오늘 title로 듣던 잔여 분을 잃는다(숫자가 aria-hidden으로 이동했으므로 회귀) | P1 #14 + 자체(SR 진입 회귀) |
| SG-D19 | **킬스위치**: `NEXT_PUBLIC_TR_NUMERAL_V1`(기본 ON) — OFF면 NowCard가 기존 렌더(numeral·밴드 없는 v0 경로)로 폴백. `NEXT_PUBLIC_TOUR_MODE_V1`이 프로덕션 ON이라 이 개편은 라이브 손님에게 직행한다 — 롤백 수단이 revert PR뿐인 침묵 상태를 없앤다. SG-8 실기기 게이트 통과 후 플래그 제거 티켓 | 2차 P2 #21 |
| SG-D20 | **포매터 단일화**: 시각 보간 4키(`waitUntil`·`pickupWaitUntil`·`arrivedUntil`·`leaveBy`)와 푸시 카피는 `formatTargetTime(targetMs, locale)` 경유(en=12h 기존 규율 유지 — raw "HH:MM" 주입 금지). 분 단위는 `minuteUnitLabel: string`("분"/"min") — 숫자 소유는 NumeralClock(v1.1의 `minutesUnit(n)` 함수 키는 소유권 모순이라 폐기). 반올림은 ceil(기존 테스트 규율) | 2차 P2 #22 |

---

## D. 손님 홈 정보 아키텍처

### D-1. CSS — 추가되는 전부 (실렌더 검증 완료)

`app/tour-room-theme.css` 스케일 블록(`:711-754`) 뒤:

```css
/* 카운트다운/시각의 단 — tr-display(20)보다 위. 화면당 최대 1개 (SG-D1). */
.tr-numeral {
  font-size: calc(34px * var(--tr-font-scale, 1));
  line-height: 1.05;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
}
:where(.tr-numeral) { font-weight: 700; }
```

**실측(§O):** 스케일 1 → 34px/줄높이 36px, 스케일 1.35 → **45.9px/48px**. 최악 문자열은 6자가 아니라 **7자 `1:12:08`** ≈ 193px —
320px 뷰포트(카드 296px)에서 **한 줄 유지·오버플로 0을 실렌더로 확인**. contrast 스킨(ink 보더)에서 700 웨이트 시각 문제 없음.

### D-2. 상태 × 행 매트릭스 (숫자 소스 = 실존 데이터만)

리졸버 data 추가 3필드: `rallyTargetMs`(notice.targetMs 관통), `freeTimeEndsAtMs`(관통), `meetingTargetMs`(pickup·arrived용 — v1.0의 `ctx.meetingTime`은 어댑터가 **세팅 자체를 안 함**이 실측 판명).

| 상태 | eyebrow | **NUMERAL** | title | sub | 틱 |
|---|---|---|---|---|---|
| `rally_overdue` | `rallyEyebrow` "집합" | `+MM:SS` (now−target) | rallyTitle | meetingPoint · `waitUntil(target+GRACE)` **[E2]** | 1초 |
| `free_time` | `freeEyebrow` "자유시간" | 잔여 `MM:SS`/`H:MM:SS` | `freeMeetAt(point)` / `freeTitleNoPoint` | **[E1]** · `waitUntil` **[E2]** | 적응(>10분 30초→1초) |
| `arrived` | 기존 "지금 여기" | **집합·복귀 시각까지 `N분`** — 활성 notice targetMs 파생(**0<N≤180**일 때만; 밖·부재 → 행 제거). ~~stay_minutes~~ 는 **writer가 레포에 없어 폐기** | spotName | `arrivedUntil(HH:MM)` = notice 목표 시각 | 30초 |
| `pickup_window` | `pickupEyebrow` "픽업" | `meetingTargetMs`까지 `N분` (**0<N≤120** — pickupBoard는 자정부터 visible이라 상한 없으면 새벽에 "445분"). 소스 = notice 또는 `pickupBoardState.myStop.pickup_time`(`PickupSequenceStop` — `NowCardContext.pickup`에 시각 필드 확장 필요, 5a) | pickupTitle | 차량정보 · `pickupWaitUntil(t)` **[E2 픽업판 — 배치 확정]** | 30초 |
| `moving` | 기존 "다음" | 도착까지 `N분` = **nextStop.time 관통 후** wall-clock 파싱(0<N≤90일 때만; 밖·부재 → 행 제거 + 기존 title 형식 유지). ⚠ 현재 HomeTab이 `time: null` 하드코딩(`:540`) — SG-1a가 관통·파싱(`H:MM` 1자리 시 허용) 포함 | nextStopName | `지금 {current} · movingReassurance` | 30초 |
| `lobby` | LobbyCard 소유 — numeral에는 **압축형만**(`D-3` 형태). 🔴 로케일 D-day 문장(es "Faltan 14 días"·ru "Осталось 14 дн." 등 13~16자)은 45.9px에서 320px 한 줄 불가 — 문장은 기존 tr-label 행 유지. 🔴 LobbyCard는 **3곳에 마운트**(홈 `:688` · 픽업 시트 `:947` · **채팅 탭** `TourRoomClient:1155`) — numeral은 `showHeroNumeral` prop으로 **홈 마운트에만**(채팅 탭 유출 = 불변 ① 위반, 픽업 시트 동시 표시 = SG-D1 위반) | | | | 0 |
| `ended` | NowCard null 유지, recap 소유 | | | | — |

**중복 카운트다운 억제(신규 1e):** 억제 키는 boolean이 아니라 **`nowCard.state ∈ {free_time, rally_overdue}`** — hero와 배너가 **같은 targetMs**를 읽는 상태에서만 배너 카운트다운 행 억제(포인트·CTA 유지). moving/arrived hero + 집합 T-3 상황에서는 배너 카운트다운이 **유일한** 집합 시계이므로 억제 금지(hero numeral은 다른 타깃이다). 발사 이펙트는 useRallyLadder(헤드리스)로 분리돼 있어 억제와 무관.

### D-3. 카피 신규 키 12개 (en/ko 기준문 — `NowCardCopy` 인터페이스 추가분)

`rallyEyebrow` 집합 · `freeEyebrow` 자유시간 · `pickupEyebrow` 픽업 · `freeMeetAt(p)` "${p}에서 만나요" · `freeTitleNoPoint` "집합 안내를 기다려 주세요" ·
`waitUntil(t)` "${t}까지 대기 후 출발" · `pickupWaitUntil(t)` "${t}까지는 나와 주세요"(**요청문 — 집행 캡슐 없음과 정합**) · `arrivedUntil(t)` "약 ${t}까지 여유 있어요" ·
`movingReassurance` "지금은 편히 계시면 됩니다" · `leaveBy(m,t)` "당신 위치에서 도보 ${m}분 · ${t}에는 출발하세요" · `walkOptIn` "내 위치 기준 도보 시간" · `minuteUnitLabel` "분"(문자열 — 숫자는 NumeralClock 소유, SG-D20).
전부 10로케일 사전 번역. 시각 보간 `t`는 전부 `formatTargetTime(targetMs, locale)` 경유(SG-D20). **키셋 고정 테스트 없음 확인** — 추가 안전.

### D-4. NumeralClock (신규, `components/tour-mode/NumeralClock.tsx`)

```
props: { mode: 'down' | 'up'; targetMs: number;
         format: 'clock' | 'minutes'; unitLabel?: string;   // minuteUnitLabel 카피 키 주입
         nowMs?: () => number;                               // §E-1 서버 시계 주입
         testId?: string }
```

- 렌더: `<span className="tr-numeral tr-num block text-[var(--tr-ink)]" aria-hidden="true">` — 항상 잉크색(B8 규율). clock형: `MM:SS` / `H:MM:SS` / up이면 `+MM:SS`.
- 🔴 **SSR 결정론**: 룸 페이지는 서버 컴포넌트라 클라이언트 컴포넌트도 SSR된다 — 첫 렌더 값은 **prop으로 받은 `server_now_ms` 기준으로 서버·클라이언트가 동일**해야 하고, 틱은 `useEffect`에서만 시작한다(기기 시계로 첫 렌더하면 hydration 불일치 — PR #335에서 겪은 그 사고의 재현 경로). 0b에 hydration 테스트 포함.
- **적응 틱 내장**(SG-D3): 타깃까지 >10분 = 30초, ≤10분 = 1초, up 모드 = 1초 — 전부 `document.visibilityState==='visible'` 한정 + visibility 재계산(레포의 배너/카운트다운 규율과 동일 문법, 복사본 아닌 단일 소유).
- 성능: 틱 리렌더는 이 서브트리에 격리 — HomeTab·NowCard 본체는 상태 전이 때만(기존 `key={result.state}` 재마운트 유지).
- 접근성(SG-D18): 본체 aria-hidden. 분기점(T-10/T-5/T-1) 안내용 sr-only status는 **NowCard가 `<section>` 밖 sibling으로 소유**(루트 aria-atomic과의 이중 낭독 회피).
- 모션: 숫자 전이 애니메이션 금지.

---

## E. 시간 주권 체계

### E-1. 서버 시계 (SG-D4)

`buildRoomSnapshot` 반환 객체(`lib/tour-room/snapshot.ts:335`)에 `server_now_ms: Date.now()` — **라우트가 아니라 여기**여야 join 응답(`join/route.ts:198-207`, 첫 페인트)과
콕핏의 스냅샷 호출(`Cockpit.tsx:491`)까지 한 번에 커버된다. 클라이언트 오프셋 → `nowMs()` 컨텍스트.
**주입 편집 3곳:** NoticeBanner `useState(Date.now)`(`:213`) · DepartureCountdown(`:313,326` + `kstToday(now)` `:341`) · HomeTab 60초 시계(`:492-496`).
(참고: LobbyCard `kstDaysUntil`도 기기 시계 기본값 — D-N 정밀도상 무해, 자정 SSR/CSR 불일치만 기록.)

### E-2. E2 사전 표시 (SG-D5)

`RALLY_GRACE_MS = 15*60_000` 상수 추출(`notices.ts:90`의 만료와 공유) + `policyWaitUntilMs(notice)`. free/rally sub 행 렌더. 신규 메시지 0.

### E-3. T-10 리마인드 푸시 (SG-D7)

- **발사 로직은 헤드리스 `useRallyLadder` 훅 하나** — 30초 자체 틱(콕핏엔 사다리용 시계가 없다), `rallyResolution` 소비, remind/departed 크로싱 POST를 소유.
  게스트 TourRoomClient와 콕핏이 같은 훅을 마운트(콕핏=웨이크락 1순위, 손님=백업). 배너에서 발사 이펙트를 **분리**해야 1e 억제·만료 후 윈도우와 충돌하지 않는다.
- 라우트: **화이트리스트 이전 분기, rally 3종**(remind·departed·all_aboard — 2종이면 기사 콕핏의 [전원 탑승]이 갈 라우트가 없다). 레이트게이트는 액터 해석 뒤,
  전용 네임스페이스 `tour_room_rally_crossing`(게스트 신호 6/min 버킷 기아 방지).
- 서버: §E-4의 검증 사다리 통과 후 `recordRoomEvent(subject: rally:{id}:remind)` 승자만 `sendGuestRoomPush(tag: remind-{noticeId})`. 피드 캡슐 0 · 이메일 폴백 0(T-10은 T+5 사다리가 받친다).
- ⚠ `sendGuestRoomPush`는 **per-booking**(`guestPush.ts:97-104`) — v1 표적(프라이빗 단일 예약) 완전 커버, 조인 룸은 부분(버스 v2에서 룸 예약 루프).
- 카피: 목표 시각 기반 "10:30 집합 · {point}", `formatTargetTime` 경유(SG-D20).

### E-4. 대기 종료 (SG-D6 — P0 해소 구조)

**핵심 수정: 발사 파생을 `activeNotice`에서 분리한다.** `activeNotice`는 T+GRACE에 null을 반환하므로(`notices.ts:90`) 그 위에서는
**발사 가능한 렌더가 존재하지 않는다**(윈도우 폭 0 — 적대 리뷰 P0). 신설 `rallyResolution(messages, tourDate, nowMs)`:
만료 무시하고 raw 최신 notice(meeting_notice·free_time_timer)를 읽어 `{ noticeId, targetMs, phase }` 반환 —
`phase = 'window'` iff `GRACE ≤ now−target ≤ GRACE+10분`. UI 만료(+15)는 기존 그대로.

```
T+10   'contact' (기존)
T+12   스태프 프롬프트 (콕핏 + 가이드 콘솔): "전원 탑승했나요?"
       [전원 탑승]   → POST {type:'rally_all_aboard', noticeId}
                       → resolution insert (subject rally:{id}:resolution, type 'rally_resolution', payload all_aboard)
       [+15분 연장]  → 기존 재발신 경로(return_time 시트 / meeting-send) 성공 후
                       → resolution {outcome:'extended', next_notice_id} 기록 (체인 접기용, §H-1)
       [아직/무응답] → 아래 기본 발사
T+15   useRallyLadder(콕핏 1순위 + 손님 백업), phase==='window'에서 POST {type:'rally_departed', noticeId}
       서버 검증 사다리 (🔴 클라이언트 무신뢰):
         ① noticeId로 메시지 실로드 — 부재·비-notice kind → 404 (임의 문자열 subject 민팅 차단)
         ② metadata + tour_date로 targetMs 재계산 → now−target ≥ RALLY_GRACE_MS 독립 검증
         ③ notice.created_at < targetMs (백데이트·과거 오타 즉발 차단)
         ④ cancelled·arrival_bundle 승격 포함, 해당 notice보다 최신 notice 존재 → 204
         ⑤ resolution insert (같은 subject·같은 type — UNIQUE가 TOCTOU 없이 승자 중재)
         ⑥ 승자만: wait_ended 캡슐(멱등 subject rally:{id}:capsule) + 푸시(tag departed-{noticeId},
            Android renotify:true) + overdue와 동일한 이메일 레일(재합류 딥링크) + 관제 어텐션
수동   콕핏 [낙오 처리 지금] — resolution 무관하게 캡슐 경로(⑥)로 직행 (all_aboard 오탭 탈출구)
```

**픽업 제외:** writer가 **lifecycle 파생**으로 `metadata.meeting_context` 스탬프 — lobby·픽업 시퀀스 시각대 = 'pickup', live 미드투어 제안 = 'rally'.
(MeetSetCard 일괄 'pickup'은 오분류 — 카드 스스로 "mid-tour at a spot" 용도를 문서화하고 있고 홈 픽업 시트는 하루 종일 열린다.) pickup은 발사 제외.
**writer측 완화:** until/meeting_time이 과거로 파싱되면 **400** — 오타·자정 넘김(레포 기록 버그)이 즉발 캡슐이 되는 경로 차단.
**재합류 카드(WaitEndedCard):** 사실 첫 문장 · **한국어 목적지 최대 글씨** — 목적지는 **서버가 `resolveDaySchedule`로 자체 해석**(클라이언트 body 주입 금지 — 스푸핑 표면) ·
다음 스톱 부재(마지막 스톱) 시 목적지 없는 변형("코디가 연락드립니다" + 통화 CTA) · 내비 딥링크 · "일행에게도 안내되었습니다" · 탑승자 헤지 1줄.
ChatFeed `:799` 앞 분기 1개. NowCard 신규 상태 없음(v1) — 경로는 푸시 → 피드.

### E-5. free_time 룸의 hero 공백 (SG-2d — 2차 감사로 범위 재확정)

`roomNowCardContext`는 **meeting_notice만** rally로 파생한다(`nowCard.ts:331`) — 기사 단독 투어(return_time = free_time_timer)는
T+5 이후에도 hero가 rally_overdue로 넘어가지 않는다. **2d = kind 제한 해제 1줄 + 사다리·배너 정합 테스트** (배너는 이미 kind 무관으로
overdue 캡슐을 쏘고 있음을 실측 확인 — 이 티켓은 hero의 의미론적 완결).

🔴 **단, 손님 hero의 `+MM:SS` 초과 표시는 T+5부터다** — T+0~T+5는 'due' 단계고, due를 hero로 올리지 않는 것은
`nowCard.test.ts:85-94`에 🔴 사유("crying wolf" — 대부분 탑승한 일행 전원에게 위험색을 보이지 않는다)까지 박힌 **기존 결정**이며 v1.2는 이를 존중한다.
T+0~T+5의 시계는 배너 카운트다운이 0 도달로 표시한다(1e의 상태 키 억제는 free_time/rally_overdue만이라 이 구간 배너는 살아 있다).
**목업 ②의 `+04:12`(T+4)는 손님 화면이 아니라 콕핏의 것** — 콕핏 rally 칩은 T+0부터 `+MM:SS`를 표시한다(2b-β 스펙, 스태프에겐 crying-wolf 문제가 없다).
부수 수정: free_time_timer의 meeting_point 기본값이 영어 리터럴 `'the vehicle'`(`driver-signal/route.ts:135`, pointI18n 없음) — 2d 이후 rally hero에
전 로케일 노출되므로 센티널 매핑(로케일 카피 "차량으로") 또는 표시 생략 1줄 + 테스트 1케이스.

---

## F. 사진 체계

### F-1. 밴드 스펙 (SG-D9)

NowCard 최상단(모든 행 위), 사진 있을 때만:

```tsx
{photoUrl && (
  <div className="tr-hero-media -mx-4 -mt-4 mb-3 h-36 overflow-hidden rounded-t-[inherit]">
    {imageFailed
      ? <div className="h-full w-full" style={{ background: avatarColorFor(poiKey) }} />   /* 스와치 필수 — PoiThumb 문법 */
      : <img src={photoUrl} alt="" className="h-full w-full object-cover"
             fetchPriority="high" onError={() => setImageFailed(true)} />}
  </div>
)}
```

- **글자를 사진에 얹지 않는다** — 스크림 금지, 텍스트는 카드 표면(검증된 대비 쌍 무손상).
- 높이 144px 고정 + **onError는 밴드 제거가 아니라 스와치** — 제거는 정확히 실패 케이스에서 CLS≠0(P2 #18). 게이트 ③에 죽은 URL 케이스 포함.
- 홈 최상단 1장만 `fetchPriority="high"`. `contrast` 스킨: `.tr-root[data-tr-skin='contrast'] .tr-hero-media { display:none; }`.
- 채팅 SpotArrivalCard는 무변경(렌더 재설계 금지) — 같은 `SpotArrivalContent` 계약을 읽되 렌더만 다르다. onError 결함 수정 1건만 버그픽스 예외(§J).

### F-2. 상태별 소스와 단계

| 상태 | 소스 | 단계 |
|---|---|---|
| `arrived` | `latestArrival`이 읽는 메시지 meta의 `content.image` — **네트워크 0** | 4a |
| `moving` / `lobby` | snapshot **`stop_images: Record<poiKey, url>` 맵** — 단일 필드는 클라이언트 nextStop 전진 시 **다른 스톱 사진**을 띄운다(P2 #19). 클라이언트가 키로 고른다. **서버는 poi_key 있는 스톱만 모아 `match_pois` `.in()` 1쿼리**(스냅샷은 이미 최고 빈도 읽기 경로 — N+1 금지, 스케줄 비면 스킵) | 4b |
| `free_time` / `rally` | 집합 장소 사진(§F-3) — verified만 | 4d |
| `pickup_window` | 차량 사진(§F-4) | 5c |
| `ended` | 무변경 (X17 recap 소유) | — |

하이진: `poiContent.server.ts:70-83`의 `firstImage`는 `poiImage.ts` 체인의 사본 → `poiImageCandidates`로 통일하되 **4b보다 먼저**(4c — 같은 코드를 두 번 만지지 않게, P2 #29).

**SW 캐시(4e):** 신규 규칙은 현행 cross-origin 조기 반환(`sw-tour-mode.js:50`) **앞**에 서야 하고, `<img>` no-cors의 opaque 응답은
항목당 ~7MB 쿼터 패딩이라 **SW에서 cors 모드로 재요청 후 캐시**(P2 #24). 화이트리스트는 "공개 버킷"이 아니라 **실제 이미지 호스트 분포를 조사해 확정**
(`match_pois` 이미지엔 외부 URL이 혼재 — 비허용 호스트는 캐시 제외 폴백, 깨지지 않는다). 12항목 LRU. HTML/API network-only 원칙 무변경.

### F-3. 집합 장소 사진 파이프라인 (SG-D10)

- **마이그레이션(additive):** `tour_poi_arrival_profiles`에 `meeting_photo_path text` · `meeting_photo_status text check ('pending','verified','rejected') default 'pending'` · `meeting_photo_meta jsonb`(촬영자 role·시각·좌표). 공개 버킷 `tour-meeting-points`(공개 read — 집합 장소 사진은 PII 아님; 서명 URL은 SW 캐시와 상성 불량이라 배제. **N-6 승인됨**).
- **수집:** 콕핏 지오펜스 도착(onArrival `Cockpit.tsx:529-539`) + 해당 poi_key 프로필에 verified 사진 없음 → 도착 프롬프트/시트에 보조 버튼 **[집합장소 사진]** — `sendVehiclePhoto`(`:908-925`)와 동일 카메라 입력 재사용, 전송처만 신규 `POST /api/tour-rooms/[bookingId]/meeting-photo`(guide|driver|admin, multipart → 버킷 + 프로필 pending upsert). **기사가 첫 방문에 한 번 찍으면 그 POI는 영구 해결.**
- **검수:** facility_pins의 is_verified 큐 문법 복제 — `/admin/meeting-photos`(pending → 승인/반려). 서빙은 verified만.
- **서빙:** free/rally hero 밴드 + arrival bundle 집합 섹션. 없으면 오늘 화면 그대로.

### F-4. 차량 사진 손님 출구 (SG-5c)

`GET /api/tour-rooms/[bookingId]/vehicle-photo` — 룸 세션 검증 → `ops_room_vehicles.photo_path` → 60분 서명 URL(프라이빗 버킷 유지 —
`20260731090000_ops_room_vehicle_photo.sql` 주석의 "조회는 단기 서명 URL로만" 준수. ⚠ 같은 스탬프의 파일이 2개라 파일명으로 지칭한다). `pickup_window` hero + T-10 카드 소비. SW 캐시 제외.

---

## G. 발화 대기열 v1

**핵심: 신규 전송 경로 0. 리졸버 + 카드 하나.** X15 도착 프롬프트를 흡수·일반화한다.

### G-1. 리졸버 `lib/tour-room/sayQueue.ts` (순수 함수)

```ts
interface SayInput {
  nowMs: number; lifecycle: RoomLifecycle;
  schedule: { title: string; poiKey?: string|null; time?: string|null }[];
  notice: NoticeState | null;
  geofenceArrival: { spotId: string; title: string } | null;
  firedSubjects: ReadonlySet<string>;            // 정본 = 이벤트 subject (snapshot 동봉, §G 개정 2)
}
type SayItem = {
  subject: string;                               // say:{kstDay}:{key}
  kind: 'arrival_bundle' | 'preset' | 'return_time' | 'briefing';
  presetKey?: string;                            // 기존 DRIVER_QUICK_REPLIES 키만
  urgency: 'required' | 'suggested';
  deadlineMs?: number;                           // 표시용 — 자동발사 아님
  spotTitle?: string;
};
sayQueue(input): SayItem[]                        // 최대 4 — 넘으면 실패
```

랭킹: ① required — 지오펜스 도착 & 미발사 → `arrival_bundle` · 도착 & 타이머 없음 → `return_time` · 하루 첫 운행 → `briefing`
② suggested — 스케줄 레그 파생: 출발 5분 전 `departing_soon` · 출발 직후 `seatbelt_check` · 마지막 스톱 접근 `check_belongings` · 90분 무정차 `rest_stop`.
발사 = 기존 경로 그대로(`openArrivalSheet` · 콕핏 독 프리셋 전송 · `setSheet('return')` · `sendMorningBriefing`). dismiss → `say_dismissed` 이벤트. required 마감 경과 → `say_expired` 이벤트만(자동발사 없음 — N-5).

### G-2. v1.1→v1.2 개정:

1. **기본 접힘 1줄 필** — required 발생 시에만 X15처럼 일시 확장(SG-D11). arrivalPrompt 슬롯은 원래 일시적 오버레이고 toast(`z-20`)가 같은 자리를 쓴다 — 상시 스택은 주행 표면 다운그레이드다.
2. 🔴 **fired 판정은 type 파생**(2차 P1 #10 — 기존 발사 3경로는 subject를 아예 안 쓴다): 서버가 오늘 KST 창의 `manual_arrival`(poi별)·`morning_briefing`·
   `signal.payload='return_time'` 이벤트 + `say_dismissed` subject로 fired-set을 도출해 **스냅샷에 동봉**, 클라이언트는 발사 직후 낙관 병합(+visibility 재조회).
   브리핑 라우트에 subjectKey `briefing:{kstDay}` 추가(멱등 가드 부재 — 이중발사도 같이 잡는다).
   쓰기 = `driver-signal` 라우트에 `say_dismissed` 타입 추가(signals 라우트는 driver 403이라 부적합).
3. **arrived·"90분 무정차"는 durable 소스**(2차 P1 #11): `latestArrival(messages)` + 마지막 `manual_arrival` 이벤트 시각 — 지오펜스 상태는 옵트인(기본 OFF)+휘발성이라
   "미발신 도착 제안"에만 쓴다. 위치 공유를 안 켠 기사에게도 대기열은 살아 있어야 한다.
4. **스냅샷 창 한계**(P2 #17): `SNAPSHOT_MESSAGE_LIMIT=100` — 메시지 파생은 보조, 정본은 위 2번의 이벤트 파생.

프리셋 4종은 전부 기존 키 — **키 추가도 불필요**(실측, P2 #23).

---

## H. 신뢰 회계

### H-1. 오늘의 나 (SG-D12)

`day-summary/route.ts` 확장 — 기존 visited/span/money에 4행 추가(전부 기존 데이터 파생, LLM 0):

| 지표 | 파생 |
|---|---|
| 정시 | **rally 체인 단위** — 체인 구성은 `extended` resolution의 **`next_notice_id`**로 잇는다(2c가 동봉 — 이것 없이는 접기가 파생 불가). resolution 없이 직접 재발신으로 대체된 notice는 `implicit_aboard` 버킷으로 별도 집계(정시로 세지 않고 각주 상한에 포함). 체인 중 `departed` 없이 닫힌 비율 |
| 응답 | `guest_*` 신호 이벤트 → 이후 10분 내 스태프 발신 메시지까지 중앙값 초 |
| 해설 | `spot_arrival`/`arrival_bundle` 메시지 수 |
| 사진 | 스태프 발신 이미지 메시지 수 |

콕핏 `오늘 요약` 시트(`:2159-2219`)에 4스탯 그리드 추가. **순위 없음, 비교 없음, 개별 손님 연결 없음.** **7a는 2b·2c 이후**(departed·extended 이벤트가 생긴 뒤에야 의미).
각주로 정직 기록: 콕핏+손님 2중화로도 둘 다 잠든 극단은 미발사 → 정시 지표는 상한 추정치다.

### H-2. D-1 온보딩 3장 (SG-D13·14)

`components/tour-mode/OnboardingCards.tsx` — 조건: `customer && lifecycle==='lobby' && daysUntil<=1 && !localStorage[onboard:{bookingId}]`.
①"기사님은 영어를 하지 않습니다 — 의도된 것입니다" + 기사 이름(차량 라인 데이터, **연차 표기 없음 — N-3 제외**) ② 신호 버튼 실습(**로컬 에코, 전송 0**)
③ 코디 소개(**운영시간 미표기 — N-4**) + 확인 체크. 기본 카피로 진행, 문구는 교체 가능 슬롯.

### H-3. E3 기사 귀속 · E4 포함된 것

- **E3 최종형(텍스트)**: 도착 카드·해설 재생 버튼 옆 "{driver_name} 기사님의 안내" — `vehicleLineFromPayload`(`LobbyCard.tsx:122-139`)가 이름 보유. 사진·연차는 **N-3 제외로 트랙에서 삭제.**
- **E4**: LobbyCard + 픽업 T-30 카드에 "충전기 · 와이파이 · 생수 · 우산이 준비되어 있습니다" 사전 번역 한 줄(D4 — 안 보이면 그냥 손실). 고정 문구 v1.

---

## I. 데이터·스키마 변경 (전부 additive)

| # | 변경 | 형태 |
|---|---|---|
| 1 | `tour_poi_arrival_profiles` + `meeting_photo_path/status/meta` | 마이그레이션 1건 — ⚠ 스탬프는 기존 최대치 이후의 **유일 값**으로(디렉터리에 `20260731090000`·`20260801050000` 중복 프리픽스가 이미 2쌍 존재) |
| 2 | 공개 버킷 `tour-meeting-points` | storage (**N-6 승인됨**) |
| 3 | `tour_room_events` 신규 type/subject (`rally:{id}:resolution`·`rally:{id}:remind`·`say_*`) | **불필요** — type은 자유 문자열(`events.ts:19`), UNIQUE 인덱스 기존재 |
| 4 | snapshot 응답 `server_now_ms` · `stop_images` · say subjects | 코드만 |
| 5 | 차량 사진 손님 출구 | 코드만 (서명 URL) |

DDL 후 `get_advisors` 재실행. 투어룸은 서비스롤 경유라 RLS 어드바이저 무관(기존 확인).

---

## J. 파일 인벤토리 (v1.1 — 누락 3파일 반영)

**신규 8:** NumeralClock · WaitEndedCard · OnboardingCards(**테마 루트 안에서 렌더** — 오버레이 사고 규칙) · SayQueueCard · `lib/tour-room/sayQueue.ts` ·
**`hooks/useRallyLadder.ts`**(헤드리스 발사기 — §E-3) · meeting-photo 라우트 · vehicle-photo 라우트 (+ admin/meeting-photos 페이지)

**확장 16:** tour-room-theme.css · nowCard.ts · nowCardCopy.ts · NowCard.tsx · notices.ts(`RALLY_GRACE_MS`·`policyWaitUntilMs`·`rallyResolution`) ·
NoticeBanner.tsx(시계 주입 + 카운트다운 행 억제 prop — **크로싱 발사는 useRallyLadder로 이관**) · signals/route.ts(**rally 3종** 이전 분기 + 검증 사다리) · driver-signal/route.ts(`say_dismissed`) ·
ChatFeed.tsx(wait_ended 분기 1개) · Cockpit.tsx(SayQueue·T+12 프롬프트·집합사진·welcome 시트·요약 4스탯·rally 크로싱 발사) · GuideConsole.tsx(T+12 프롬프트) ·
snapshot 라우트(`server_now_ms`·`stop_images`·say subjects) · sw-tour-mode.js · day-summary/route.ts ·
**HomeTab.tsx**(nextStop.time 관통 · pickup 관통 · 시계 주입 — v1.0 누락) · **TourRoomClient.tsx**(오프셋 컨텍스트 · pickupBoardState→HomeTab · OnboardingCards 마운트 — v1.0 누락) · **LobbyCard.tsx**(D-N numeral · E4 문구 — v1.0 누락)

**무변경 선언:** ChatFeed 기존 분기 · quickReplies(키 추가조차 불필요) · 스킨/토큰/그림자 · DriverConsole(U-D6v2 삭제 예정 — 투자 금지) · StaffShell.
**버그픽스 예외 1건:** SpotArrivalCard onError 폴백 — 채팅 표면이지만 결함 수정이며 SG-4a에 포함(별도 칩 선처리 시 생략). v1.0의 "무변경" ↔ "칩 발행" 자기모순 해소.

---

## K. 게이트

자동 4명령( `NEXT-SESSION-SMARTAPP-2026-07-28.md` §6 — 실행 확인: 현 main 기준 tsc 0 · 1706 pass) + Playwright 전후 컷 + git add 경로 명시. 주: 둘째 jest 줄은 첫 줄의 부분집합(중복 무해).

**플랜 고유 게이트 (v1.2):**
① **`tour-room-theme.css`에 `/tr-numeral--/` 부재 단언 1줄 테스트** — "크기 변형 금지"의 집행형 (typeDiscipline 등록은 no-op: tr-*는 자동 통과, skinContrast도 추가 불요 — 실측)
② 적응 틱 자동 테스트(>10분 30초 / ≤10분 1초 / visible 한정) + **0b hydration 테스트**(첫 렌더 = server_now_ms 결정론)
③ 밴드 CLS=0 + **죽은 URL 스와치 케이스** ④ **resolution 회귀 6종**: all_aboard 억제 · 연장 레이스(cancelled·승격 포함 최신 notice 204) ·
픽업 제외(+**미드투어 propose는 제외 안 됨** 반례) · **백데이트/과거 시각 notice 무발사** · type 일치 단언('rally_resolution' 단일) · 수동 [낙오 처리]의 캡슐 멱등
⑤ 카피 10로케일 tsc 패리티 ⑥ 45.9px 최소폭 — 실렌더 1차 통과(§O), **ru/es D-N 문장 반례 포함**, 실기기는 SG-8
⑦ **어댑터 관통 jest 테스트**(스냅샷 픽스처 schedule[time] → `data.nextStopTime` 단언 — CI에서 도는 형태) + 시드 룸 Playwright 컷(보조 — ③⑥⑦의 실렌더 판은 dev 서버 필요라 CI 밖임을 명기)
⑧ **번들 예산**: 손님 룸 청크 δ ≤ +10KB gzip / 웨이브 (X13이 만든 447KB를 지킨다)

**사람 게이트:** 실기기 · 집합 사진 검수 운영 · ~~문구·정책 확정~~ → §N 확정 반영됨(잔여: 낙오 택시비 문구만 추후) · ~~온보딩 카피 승인~~ → 기본 카피로 진행(운영시간 미표기).

---

## L. WBS (v1.1)

| 웨이브 | 티켓 | 크기 | 내용 (v1.1 변경 굵게) | 의존 |
|---|---|---|---|---|
| SG-0 | 0a | S | `.tr-numeral` CSS + **변형 금지 테스트(게이트 ①)** | — |
| | 0b | S | NumeralClock + **적응 틱** + aria 테스트 + **SSR 결정론(hydration 테스트)** | 0a |
| | 0c | M | 서버 시계 — **`buildRoomSnapshot` 주입** + 자체 시계 3곳 교체(NoticeBanner·DepartureCountdown·HomeTab) | — |
| SG-1 | 1a | M | 리졸버 data 3필드 + latestArrival + **HomeTab nextStop.time 관통 + wall-clock 파싱(1자리 시 허용)** — 게이트 ⑦ | — |
| | 1b | M | NowCard 4행 + 카피 12키×10로케일 + sr-only sibling(**상태 진입 낭독 포함**) + **킬스위치 `NEXT_PUBLIC_TR_NUMERAL_V1`** + Playwright 컷 | 0a·0b·1a |
| | 1c | S | E2 waitUntil + **`RALLY_GRACE_MS` 추출 + `rallyResolution()` 신설**(cancelled·승격·created<target 계약 포함 — 2b-α 선행 필수) | — |
| | 1d | S | LobbyCard D-N numeral — **압축형만 · `showHeroNumeral`로 홈 마운트 한정**(3곳 마운트) | 0a |
| | 1e | S | NoticeBanner 카운트다운 행 억제 — **키는 `state ∈ {free_time, rally_overdue}`**(과잉 억제 금지) | 1b |
| SG-2 | 2a | M | **`useRallyLadder` 헤드리스 훅**(30초 틱·크로싱 소유) + T-10 푸시 — rally 3종 이전 분기·전용 레이트 네임스페이스·목표 시각 카피 | 0c·1c |
| | **2b-α** | M | **서버**: 검증 사다리 5단(실로드·재계산·백데이트·supersede·resolution 단일 type) + 캡슐 멱등 subject + 이메일 레일 + 푸시 태그 — 게이트 ④ | 1c·2a |
| | **2b-β** | S | **스태프**: T+12 프롬프트(콕핏+가이드) + 콕핏 rally 칩 **T+0부터 `+MM:SS`**(목업 ②의 실체) + 수동 [낙오 처리] | 2b-α |
| | **2b-γ** | M | **손님**: WaitEndedCard(서버 해석 목적지·no-next-stop 변형) + ChatFeed 분기 | 2b-α (β와 병렬) |
| | 2c | S | [+15분 연장] 배선 + resolution `extended{next_notice_id}` 기록 | 2b-β |
| | 2d | S | free_time 룸 rally 파생(kind 1줄 — **rung은 불변**, 손님 초과는 T+5부터) + `'the vehicle'` 센티널 + 사다리·배너 정합 테스트 | 1a |
| SG-3 | 3a | M | E1 — **one-shot geolocation(useGeoWatcher 금지)** + 열화 3형 | 1b |
| | 3b | S | E4 + E3 텍스트 귀속(**최종형 — N-3 제외 확정**) | 1b |
| SG-4 | **4c** | S | firstImage→poiImageCandidates 통일 (**4b 선행으로 이동**) | — |
| | 4a | S | arrived 밴드(메시지 파생) + **스와치 필수** + SpotArrivalCard onError(버그픽스 예외) | 1b |
| | 4b | M | snapshot **`stop_images` 맵** + moving/lobby 밴드 + LCP | 4c·4a |
| | 4d | L | 집합 사진 파이프라인 (N-6 승인됨) | 4a |
| | 4e | S | SW 캐시 — **cross-origin 반환 앞 + cors 재요청** + 프리페치 1장 | 4b |
| SG-5 | 5a | M | pickup 4행 + **TourRoomClient `pickupBoardState`→HomeTab→어댑터 관통**(현재 `pickup: null` 하드코딩 `:545`) + meetingTargetMs | 1b |
| | 5b | S | T-0 이름 사인 시트 | — |
| | 5c | M | 차량 사진 손님 출구(서명 URL) | 5a |
| SG-6 | 6a | M | sayQueue 리졸버 + **fired-set type 파생(서버, 스냅샷 동봉) + durable arrived 소스** + briefing `briefing:{kstDay}` 멱등 | — |
| | 6b | M | SayQueueCard **접힘 필 기본** + **driver-signal `say_dismissed`(쓰기)** + 낙관 병합 + 콕핏 통합 | 6a |
| SG-7 | 7a | M | day-summary 4지표 — **체인 단위 집계, 의존 2b·2c** | **2b·2c** |
| | 7b | M | D-1 온보딩(기본 카피 — 운영시간 미표기·연차 없음) | 1b |
| SG-8 | 8a | — | 실기기 · 배터리 · 스크린리더 · 터널 컷 | 전체 |

**시작점: 0a → 0b → 0c·1a(병렬) → 1b.** 실행 환경·명령은 `NEXT-SESSION-SMARTAPP-2026-07-28.md` §2(워크트리 dev HMR 불가·빌드는 종료코드·Playwright만) 그대로.
⚠ **Cockpit.tsx(2,757줄) 접촉 티켓 6개(2a·2b-β·4d·5b·6b·7a)는 병렬 금지, 이 순서로 직렬** — 같은 파일 6중 병렬은 머지 충돌 병목이다.

---

## M. 하지 말 것 / 보류

**금지(원칙):** 실시간 자유 번역 주경로 · 앱 설치 강제 · 순위표 · 게이미피케이션/체류 최적화 · 기사에게 판단을 요구하는 UI ·
지킬 수 없는 숫자(고정 응답 시간, 24/7) · 모르는 값 채우기 · 채팅/재질/스킨 변경(§J 버그픽스 예외 1건만) · `.tr-numeral` 크기 변형.

**보류(사유):** 버스 좌석 보드·3상태 인원(도어 비콘/QR 하드웨어 — v2) · SMS/WhatsApp 알림 폴백(발송 인프라 계약) ·
T+7 자동 음성 콜(텔레포니 부재 — T-10/T+5 푸시가 v1 대체) · **rally 발사 서버 크론 폴백**(콕핏+손님 모두 잠든 극단 — per-minute 크론은 새 인프라, v2 재평가) ·
**자정 넘는 집합 시각**(레포 기록 버그 승계 — `wallClockToMs`가 당일 자정 기준이라 야간 투어에서 즉시 만료; SG-D6의 과거-시각 400이 writer측 오발신은 막지만 야간 투어 지원 자체는 별도 트랙) ·
자동 발사(N-5 — `say_expired` 수집 후 재결정) · 개인별 알림 오프셋(서버 스케줄링 필요) · 자동 앨범(서명 URL 스토리지 정책) ·
**E3 v2 기사 사진·연차 + 온보딩 연차 표기(N-3 제외 확정 — 트랙에서 삭제)** · 코디 상태 3단 연동(관제 트랙 O2) ·
TTS 슬롯 문장·발음 사전(콘텐츠 제작 트랙) · 스태프 `text-4xl` 2건의 tr-numeral 이관(U-D2 관제 타이포 트랙).

---

## N. 사장님 결정 — 2026-07-30 확정 반영

| # | 결정 | 확정 |
|---|---|---|
| N-1 | wait_ended 무응답 기본 발사 | ✅ **승인** — T+12 프롬프트 무응답 시 T+15 발사 |
| N-2 | 낙오 택시비·노쇼·온보딩 문구 | ✅ 기본값 진행 — **캡슐에 비용 표기 생략**, 문구는 추후 교체 가능 슬롯으로 |
| N-3 | 기사 프로필(사진·연차) | ❌ **제외** — E3는 텍스트 귀속이 최종형, 온보딩 연차 표기 삭제 |
| N-4 | 코디 운영시간 표기 | ✅ 기본값 — **미표기** |
| N-5 | 발화 대기열 자동 발사 v1.5 | ✅ 기본값 — **미도입**, `say_expired` 데이터 수집 후 재결정 |
| N-6 | 집합 사진 공개 버킷 | ✅ **승인** — SG-4d 진행 |

잔여 열린 항목: 낙오 캡슐 택시비 문구 최종안(N-2 슬롯) 1건뿐.

---

## O. 실검증 부록 (2026-07-30)

**베이스라인 게이트 (현 main `e3364386` + 정션 환경):** `npx tsc --noEmit` **0** · 4스위트 jest **164 suites / 1706 tests 전부 통과**(9.8s).

**실렌더 측정 (dev :3172 + `sim-tour-day` 시드 룸 + Playwright chromium, 시드는 `--cleanup` 완료):**
시뮬 룸 hero = `moving` 상태(스킨 classic). `.tr-numeral` 프로토타입 주입 결과 —

| 조건 | 폰트 | 줄높이 | 한 줄 | 오버플로 |
|---|---|---|---|---|
| 390px · scale 1 · `+04:12` | 34px/700 | 36px | ✅ | 0 |
| 390px · scale 1.35 · `1:12:08` | **45.9px** | 48px | ✅ | 0 |
| **320px** · scale 1.35 · `1:12:08`(7자 최악) | 45.9px | 48px | ✅ | 0 |
| 320px · 1.35 · **contrast 스킨** | 45.9px | 48px | ✅ | 0 (ink 보더 정상, 700 웨이트 시각 문제 없음) |

스크린샷 4장: `baseline-390` · `numeral-390` · `numeral-320-135` · `numeral-contrast`.

**1차: 마이크로 감사 6건 + 적대 리뷰 29건(P0 1 · P1 15 · P2 13) — 전량 v1.1 반영.** 대표:
P0 발사 윈도우 폭 0(→`rallyResolution`) · moving/arrived numeral 데이터 부재(→소스 재설계) · 시계 3곳 자체 소유(→0c 확장) ·
발사자 손님 단일점(→콕핏 2중화) · 연장 레이스·TOCTOU(→resolution 단일 subject) · 1초 틱 규율 역행(→적응 틱) ·
중복 카운트다운(→1e) · sayQueue 경로 부재(→snapshot/driver-signal) · 인벤토리 3파일 누락(→§J) · SayQueue 상시 점유(→접힘 필) ·
sr-only 이중 낭독(→sibling) · free_time hero 공백(→2d) · 픽업 오분류(→writer 스탬프).

**2차(v1.1 신설 장치 표적): 적대 리뷰 26건(P0 1 · P1 12 · P2 13) + 자체 12건 — 전량 v1.2 반영.** 대표:
🔴 **P0 서버 무검증 발사** — noticeId 실존·시각 정당성 검증 0(현행 rally_overdue는 임의 문자열을 subject로 민팅), 과거 오타 notice가 즉발 캡슐 → 5단 검증 사다리(§E-4) ·
resolution의 UNIQUE는 **type까지 동일**해야 성립(→단일 type 'rally_resolution') · all_aboard/extended가 갈 라우트 부재(driver 403 → rally 3종 예외) ·
cancelled/승격 supersede 미정의(→계약 명문화) · **2d 1줄로는 목업 ②가 안 나옴**('due'는 🔴 기존 결정 — 손님 T+5·콕핏 T+0으로 재확정) ·
1e 과잉 억제(→상태 키) · departed에 이메일 폴백 부재(overdue엔 있는 역전 → 동일 레일) · server_now_ms 주입 지점(라우트→`buildRoomSnapshot`, join 커버) ·
MeetSetCard 일괄 픽업 스탬프 오류(미드투어 용도 문서화 → lifecycle 파생) · fired-set subject 전제 오류(기존 3경로는 subject 무기록 → type 파생) ·
arrived 판정의 옵트인·휘발성 의존(→durable 소스) · LobbyCard 3중 마운트(채팅 탭 numeral 유출 → prop 게이트) · D-N 로케일 문장 320px 불가(→압축형만) ·
SSR hydration(첫 렌더 server_now_ms 결정론) · 헤드리스 `useRallyLadder`(발사 로직의 시각 컴포넌트 탈출) · 2b 3분할 + Cockpit 6티켓 직렬화 ·
킬스위치 신설 · 포매터 단일화(formatTargetTime) · 마이그레이션 스탬프 중복 실존 · 자정 넘김 승계 명기 · WaitEndedCard 목적지 서버 해석(스푸핑 차단).

---

## P. 구현 원장 (2026-07-31 완주 — 플랜 대비 대조 리뷰)

**SG-0~7 전 웨이브 main 머지 완료.** 이 섹션이 인수인계 정본이다. 아래 표의 "검증"은 전부
실행된 것만 적었다(추측 없음).

### P-1. 웨이브 → PR → 검증

| 웨이브 | PR | 티켓 | 실검증 |
|---|---|---|---|
| SG-0 | #640 | 0a·0b·0c | 게이트 ①(numeralScale) CI 편입 · NumeralClock 적응 틱/aria/SSR 결정론 유닛 · `server_now_ms` 스냅샷 주입 + RoomClockProvider ref 1회 앵커 유닛 |
| SG-1 | #641 | 1a~1e | 어댑터 관통 게이트 ⑦ 유닛 · 4행 매트릭스 유닛(밴드·2d·센티널 포함) · **실렌더**: free hero 24:16@34px, `--tr-font-scale:1.35`→45.9px@320px, 배너 카운트다운 억제, overflow-x 0 · 킬스위치 `NEXT_PUBLIC_TR_NUMERAL_V1='0'` 경로 유닛 |
| SG-2 | #644 | 2a·2b-α/β/γ·2c·2d | 서버 사다리 5단 게이트 ④ 유닛 · **실 API**: remind 201/200(멱등), 백데이트·조기 크로싱 409, manual departed 201 · **실렌더**: WaitEndedCard 캡슐(목적지 있음/없음 열화) · rallyResolution 유닛(cancelled·승격·created<target) |
| SG-3 | #645 | 3a·3b | WalkBackLine 유닛(하버사인·옵트인 키·one-shot) · E3 귀속 라인 유닛 · 실렌더에서 arrived 귀속 확인 |
| SG-4 | #646 | 4c·4a·4b·4d·4e | **실렌더**: moving 밴드 실사진(산정호수)·144px 고정(CLS 0)·contrast 스킨 은닉 · poiImage 오브젝트 소스 유닛 · SW 이미지 레인 유닛 · **라이브 DB**: `arrival_profiles` 3컬럼 + `tour-meeting-points` 버킷 적용 · 어드민 검수 큐 reachability 게이트 통과 |
| SG-5 | #647 | 5a·5b·5c | pickup 4행 + `scheduleTargetMs` 폴백 유닛 · 이름 사인 시트(text-5xl 허용 목록 게이트) · vehicle-photo 서명 URL K4 원장 등재 |
| SG-6 | #648 | 6a·6b | sayQueue 리졸버 유닛(4개 상한·TYPE 파생 fired·타이머-도착 순서·briefing 오전) · say_dismissed/expired 북키핑 라우트 유닛 · 콕핏 필/패널 상호작용 유닛(X15 지오펜스 스위트 재작성 포함) |
| SG-7 | #649 | 7a·7b | day-summary 4지표 유닛(정시 체인 = superseded 접기, 응답 중앙값 ≤600s 갭) · 온보딩 유닛 2건(1회성·로컬 에코 네트워크 0) |
| 게이트 최종 | — | — | tsc 0 · **`npm run gate`**(tsc + jest 전체) green · `npm run build` exit 0 · CJK 래칫 ≤492 · A1 원장 전수 · K4 원장 재생성 정합 |

> 🔴 **FA-009 (풀 오디트 2026-07-30) — 이 칸의 숫자 셋이 재현 불가였다.**
> "jest 179 스위트/1815"는 여기 문서화된 4개 디렉토리 명령으로 재현되지 않았다(실측 176/1794).
> "A1 원장 87/87"은 작성 시점에도 이미 98/98이었다. 그리고 그 4개 명령은
> `__tests__/hooks`·`__tests__/api` 를 돌지 않아서 **이미 빨간불이던 상설 게이트
> (`driverOverviewTourId`)가 8웨이브를 통과했다(FA-008).**
> 그래서 게이트를 **숫자와 디렉토리 목록이 아니라 명령 하나**로 바꿨다 — `npm run gate`.
> 스위트 수를 적지 않는 것이 의도다: 늘어나는 수를 손으로 적으면 반드시 낡고,
> 낡은 수는 "덜 재고 있다"는 신호를 지운다.

### P-2. 의도적 편차 3건 (버그 아님 — 판단 기록)

1. **2b-β 스태프 T+12 프롬프트는 콕핏 전용.** GuideConsole에는 기존 rally 사다리
   (NoticeBanner overdue + 연락 칩)가 이미 있고, 낙오 처리는 운행 화면(콕핏)에서 일어나는
   행위라 이원화하지 않았다. 가이드가 낙오 처리하려면 운행 모드 진입.
2. **2c [+15분 연장]은 독립 API가 아니라 기존 return_time 시트 프리필 경로.** 전송 시
   `rally_extended{next_notice_id}` resolution이 체인된다 — "연장"이 새 공지 발행과 분리될
   수 없다는 §E-4 계약을 그대로 실행한 형태.
3. **3a E1 도보 역산 — 기록을 코드에 맞춰 고침(FA-007, 풀 오디트 2026-07-30).**
   원래 이 칸에는 "온디맨드 전용(자동 새로고침 없음) · 탭할 때만 재계산"이라 적혀 있었다.
   **코드는 그보다 낫다:** `components/tour-mode/WalkBackLine.tsx:94-108` 은 사전 동의가 있으면
   **마운트마다, 그리고 탭 복귀(visibilitychange)마다 자동으로 재계산**한다
   (자체 테스트 `walkBackLine.test.tsx:63` "computes on mount" 이 이를 명문화).
   지켜진 것은 **백그라운드 위치 소비 0** 이다 — `watchPosition` 없음, visibilitychange는
   포그라운드 전이뿐. SG-D8이 금지한 것(인터벌·룸 발행)은 실제로 없다.
   교훈: **편차 기록이 코드보다 보수적이면, 다음 사람이 있는 기능을 없다고 읽는다.**

### P-3. 남은 사람 게이트 (코드 잔여 0)

| # | 게이트 | 비고 |
|---|---|---|
| 1 | **실기기 리허설** (§L 8a) | 폰트 스케일 1.35 실기기 · 콕핏 마이크/TTS · ≤10분 1초 틱 배터리 · 스크린리더(sr 낭독 T-10/5/1) · 온보딩 카드 실화면(시뮬은 live 룸이라 로비 D≤1 조건 미충족 — 유닛으로만 검증됨) |
| 2 | **집합 사진 검수 운영** | `/admin/meeting-photos` 큐 주 1회 배치 — verified만 손님 노출 |
| 3 | **낙오 택시비 문구** (N-2) | WaitEndedCard에 슬롯 있음, 문구는 사장님 확정 대기 |
| 4 | **킬스위치 제거 시점** | `NEXT_PUBLIC_TR_NUMERAL_V1` — 실기기 통과 후 v0 경로 삭제 결정 |
| 5 | **rally 크로싱 서버 크론 폴백 v2** | 현재 크로싱 발화는 클라이언트(콕핏 primary/손님 backup) — 둘 다 백그라운드면 이메일 레일만 남는다. 주간 크론에 편승할지 결정 |
| 6 | **번들 예산 전/후 실측** | build exit 0으로 간접 확인만 됨 — first-load JS 델타 미계측 |

⚠ 기존 기록 엣지 승계: 자정 넘는 집합 시각은 당일 00:00 해석(야간 투어 도입 시 재검토).

---

*다음 세션 첫 명령: §L SG-0a. 환경 `NEXT-SESSION-SMARTAPP-2026-07-28.md` §2, 게이트 §K.*
*(2026-07-31 갱신: SG-0~7 완주 — 위 §P가 현재 상태의 정본. 다음 세션은 §P-3 사람 게이트부터.)*
