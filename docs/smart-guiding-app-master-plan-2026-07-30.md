# 스마트 가이딩 앱 마스터 플랜 — 시간·사진·발화권·신뢰 (2026-07-30)

> **지위: 이 트랙의 실행 SoT.** `smartapp-ui-fusion-plan-2026-07-29.md`의 §H 웨이브를 대체한다.
> 짝 문서: **감사**(`smartapp-ui-fusion-audit-2026-07-29.md` — 측정 정정·§G 해소·수정 7건),
> **왜**(`smart-guiding-app-zero-based-design-2026-07-29.md`), **구조 목업**(`docs/assets/smart-guiding-mockups-2026-07-29.html`, 재질 참고 금지).
> 이 문서의 file:line은 전부 main `e3364386`(PR #630) + 정찰 3회(에이전트 2 + 직접 read)로 검증한 값이다.
>
> **사장님 불변 7 (여기 어긋나는 티켓은 무효):** ① 채팅 화면 무변경 ② 재질(카드·버튼·음영·질감·스킨 10종·POI 자산) 무변경
> ③ 코디=사장 직접(영·중 관광통역안내사) ④ 해설=TTS ⑤ 픽업 +10 / 관광지 +15 엄격 ⑥ 원가 내재화("준비되어 있습니다"로 자랑)
> ⑦ 기사 로그 공개(단 별점은 집계만, 순위표 금지)

---

## A. 제품 문장

**앱은 시계를 소유하고, 기사는 발화권을 소유하고, 화면은 주인공 한 명만 소유한다.**

손님에게 하는 약속 5개 — 모든 티켓은 이 중 하나를 강화해야 한다:

| # | 약속 | 오늘의 상태 | 이 플랜의 답 |
|---|---|---|---|
| P1 | 지금 무슨 일인지 항상 안다 | NowCard 7상태 완비, 단 숫자가 문장에 갇힘 | §D 4행 문법 + `.tr-numeral` |
| P2 | 다음 일이 **몇 시**인지 항상 안다 | 시각은 있으나 기기 시계 기준, 리마인드 푸시 0 | §E 서버 시계 + T-10 푸시 |
| P3 | 규칙은 **미리** 알려주고, 알려준 대로 **집행**된다 | 표시도 집행도 없음 (`contact`가 터미널) | §E E2 표기 + wait_ended 캡슐 |
| P4 | 길을 잃어도 **다음 행동**이 화면에 있다 | rally 사다리 T+15에서 소멸, 그 뒤 무 | §E 재합류 캡슐 |
| P5 | 모든 안내는 **사람(기사)의 행동**이다 | 도착 카드에 기사 이름 0 | §G 발화 대기열 + §H E3 귀속 |

성공 지표는 제로베이스 §J를 승계한다 — 특히 **"화면 켜짐 시간은 낮을수록 좋다"**: 이 플랜의 모든 화면은 3초 글랜스에 최적화하고, 체류를 유도하는 어떤 장치도 넣지 않는다.

---

## B. 코드 리얼리티 (검증 완료)

**재사용 ✅ — 이미 있고 그대로 쓴다 (재발명 = 이 레포의 반복 사고):**

| 자산 | 위치 | 이 플랜에서의 소비처 |
|---|---|---|
| NowCard 리졸버(의미론만 반환, 카피 분리) | `lib/tour-room/nowCard.ts:130-245` | §D의 기반 — 상태 기계 무변경, data 필드만 추가 |
| 카피 계약 `Record<RoomLocale,…>` (10로케일 강제) | `lib/tour-room/nowCardCopy.ts:16-40` | §D-3 신규 키 |
| 캡슐 문법: `sender_role:'system'` + `metadata.kind` + `translations` jsonb + ChatFeed if-분기 | `signals/route.ts:141-155` · `ChatFeed.tsx:660-840` | wait_ended 캡슐 (§E-4) |
| 멱등 이벤트: `tour_room_events` UNIQUE `(room_id, subject_key, type)` + 23505 스왈로 | `lib/tour-room/events.ts:45-77` · 마이그레이션 `20260716120000:52-54` | 크로싱 디듀프 전부 (§E, §G) |
| 클라이언트-크로싱 발사 패턴 (rally_overdue: 아무 손님 기기나 POST, 서버가 승자 결정) | `NoticeBanner.tsx:248-258` · `signals/route.ts:123-174` | T-10 푸시·wait_ended (§E-3·4) |
| 30초 틱 + visibility 재계산 규율 | `DepartureCountdown.tsx:325-336` | NumeralClock (§D-4) — 두 번째 복사본 금지, 같은 규율 |
| 프리셋 원탭: 클라이언트는 key만, 서버 `getQuickReplyPreset` 해석, LLM 0 | `messages/route.ts:282-300` · `quickReplies.ts:559-562` | 발화 대기열 발사 경로 (§G) |
| X15 도착 프롬프트 — "제안하되 절대 자동 발사 안 함" | `Cockpit.tsx:1722-1769` | 발화 대기열 카드의 원형 (§G) |
| 지오펜스 판정 상수(정확도 100m·체류 60s·속도 6mps·쿨다운 120s) | `lib/tour-room/geo.ts:24-32` · `spotWatcher.ts:21` | 집합 사진 촬영 트리거 (§F-3) |
| 콕핏 카메라 경로 (multipart → messages) | `Cockpit.tsx:908-925, 1693-1705` | 집합 사진 촬영 재사용 (§F-3) |
| 검수 게이트 패턴 `is_verified` | `facility_pins` (라이브 410핀 사례) | 집합 사진 검수 큐 (§F-3) |
| per-booking 요약 라우트 (visited·span·money, LLM 0) | `day-summary/route.ts` · Cockpit `:2159-2219` | "오늘의 나" 확장 지점 (§H-1) |
| 내비 딥링크 4종 | `lib/tour-room/nav-links.ts` | 재합류 카드 (§E-4) |
| 스와치 폴백 | `plan/PoiThumb.tsx:92-99` (`avatarColorFor`) | 사진 밴드 폴백 (§F-1) — ⚠ SpotArrivalCard에 있다는 플랜 §B B11은 감사에서 정정됨 |

**확장 🔶 — 있는 것에 필드/분기만 얹는다:** `nowCard` data 필드 3개(§D-2) · `latestArrival`에 `arrivedAtMs`(§D-2) ·
snapshot에 `server_now_ms`(§E-1)·`next_stop_image`(§F-2) · `rallyStage` 소비처 5곳(§E — 감사가 전수 명단 확보) ·
day-summary 4행(§H-1) · `DRIVER_QUICK_REPLIES` 키 추가(§G — **기존 키 내용 무변경**).

**부재 ❌ — 새로 만든다 (전부 이 문서가 명세):** `.tr-numeral` 한 단 · `NumeralClock` · 서버 시계 오프셋(레포 전체 grep 0) ·
T-10 리마인드 푸시(현재 **첫 푸시가 T+5 — 이미 늦은 뒤**다: `signals/route.ts:161`이 유일한 rally 푸시) ·
wait_ended 캡슐/재합류 카드 · 집합 장소 사진 컬럼+파이프라인(`tour_poi_arrival_profiles`엔 text뿐) ·
손님용 차량 사진 출구(`ops_room_vehicles.photo_path`는 프라이빗 버킷, 손님 경로 SELECT 0) ·
발화 대기열 리졸버 · 스태프 일일 스탯(레포 grep 0 — 원료는 `tour_room_events`에 전부 있음) · D-1 온보딩.

---

## C. 바인딩 결정 (SG-D1~D18)

| # | 결정 | 근거 |
|---|---|---|
| SG-D1 | `.tr-numeral`은 **34px 한 단, hero 카드 내부 전용, 화면당 1개**. `calc(34px * var(--tr-font-scale,1))` + `:where` weight 700 + tabular. 크기 변형(`--sm` 등) 금지 | B9 "주인공 하나" 규칙의 숫자 적용. 위계는 크기가 아니라 톤으로. 스태프 즉석 `text-4xl` 2건(콕핏 인원 `:1498`·기사 PIN)의 이관은 U-D2 트랙으로 위임 — 이 플랜은 손님 표면만 |
| SG-D2 | **4행 문법: 상태/시간/장소/행동.** 숫자가 없거나 신뢰구간 밖이면 **행 자체를 제거** — 억지로 채우지 않는다 | 원칙 6 "모르면 모른다". 매트릭스는 §D-2 |
| SG-D3 | 틱은 `NumeralClock` **한 컴포넌트**가 소유: MM:SS형=1초(visible 한정), N분형=30초, D-N=0. 리렌더는 그 서브트리에 격리. wall-clock 재계산 + visibility 재동기 = DepartureCountdown 규율 계승, 복사본 금지 | B14 · 배터리 · 성능 |
| SG-D4 | **시계는 하나.** snapshot이 `server_now_ms`를 내려주고 클라이언트는 오프셋 하나로 모든 카운트다운을 보정. 기기 시계는 신뢰하지 않는다 | 제로베이스 §H "시계는 하나". 현재 rally_overdue 발사 시각이 기기 시계에 좌우됨(레포에 동기화 0 — 정찰 확인) |
| SG-D5 | **E2 정책 사전 표시는 순수 렌더 파생, 신규 메시지 0.** `waitUntil = targetMs + 15분` (`activeNotice` 만료 경계 `notices.ts:71-90`가 이미 +15 정책의 코드화다). 픽업은 +10, 프라이빗 픽업은 F-4에 따라 "출발"이 아니라 "일정 단축" 카피 | 표시와 집행이 같은 상수를 읽어야 약속이 산다 |
| SG-D6 | **대기 종료 = wait_ended 캡슐.** T+15 크로싱에 클라이언트-레이스로 발사(subject `rally:{noticeId}:departed`). 단 T+12에 스태프 프롬프트("전원 탑승?")가 떠서 **[전원 탑승]이면 억제 이벤트로 발사 취소, [연장]이면 새 notice가 대체, 무응답이면 기본 발사** | D3(집행 주체는 앱) × 오탐(전원 탑승인데 낙오 캡슐) 사이의 균형. 자세한 흐름 §E-4 |
| SG-D7 | **T-10 리마인드 푸시 추가** (rally_overdue와 동일 크로싱+디듀프 패턴, subject `rally:{id}:remind`). 현재 T-10/T-5는 화면 켜진 기기의 진동/TTS뿐(`NoticeBanner.tsx:261-284`) — 잠긴 폰은 T+5에야 첫 푸시를 받는다 | "나쁜 소식을 먼저"(원칙 5)의 최소 구현. 개인별 오프셋(도보 반영)은 서버 스케줄링 필요라 v2 |
| SG-D8 | **E1 개인 도보 역산은 옵트인 + 온디바이스 + 열화.** 위치 없으면 행 생략(거리 조작 금지). 옵트인 시 하버사인/70m·분, clamp[2,60], 출발시각 = target − 도보 − 3분. 서버 전송 0 | `useGeoWatcher`는 콕핏·지도탭만 마운트(감사 추가①) — "이미 안다" 전제는 틀렸다. R-17 퍼지 계약 무충돌 |
| SG-D9 | **사진 밴드는 카드 상단 144px 고정, 글자를 사진에 얹지 않는다.** 소스는 `SpotArrivalContent` 계약 재사용, 폴백은 PoiThumb 문법, `contrast` 스킨은 스와치로 대체. 단계: arrived(0-fetch) → moving/lobby(스냅샷 필드) → free/rally(집합 사진) → pickup(차량) | 융합 플랜 D-1 5원칙 계승 + 감사 정정 반영 |
| SG-D10 | **집합 사진은 기사가 만든다.** 지오펜스 도착 + 검증 사진 없음 → 콕핏에 촬영 제안 → 공개 버킷 업로드 → 검수(`is_verified` 복제) → 통과분만 서빙. 한 번 찍으면 그 POI는 영구 해결 | 유일한 부재 자산(B12)의 유일하게 싼 수집 경로 |
| SG-D11 | **발화 대기열 v1 = 순수 오케스트레이션.** 리졸버가 기존 발사 경로 4종(도착 안내·프리셋·복귀시간·브리핑)만 배열한다. 신규 전송 경로 0. **자동 발사 없음**(v1) — 필수 항목은 마감 표시 + 미발사 이벤트만. X15 프롬프트 카드를 흡수·일반화 | "발사 주체는 기사"(제로베이스 §D-A) + X15의 "제안하되 발사 안 함" 문법이 이미 검증됨 |
| SG-D12 | **오늘의 나 = day-summary 확장, 신규 인프라 0.** 정시·응답·해설·사진 4지표를 `tour_room_events`+메시지에서 파생. **순위표 금지, 개별 손님 연결 불가**(F-10) | 원료 전부 존재(정찰 §6), 집계만 부재 |
| SG-D13 | **T-0 이름 사인 = 콕핏 시트 1장.** 기사 폰 풀스크린에 손님 이름 — 언어 필요한 접촉 0의 상봉 종결 장치. 2탭 이내 | 목업 ⑦, 데이터(예약자명)는 room에 이미 있음 |
| SG-D14 | **D-1 온보딩 3장의 신호 데모는 로컬 에코** — 실제 전송 0 (D-1 저녁의 기사에게 소음 금지). 프리셋 응답 미리보기로 "작동을 체험"시킨다 | 제로베이스 ⑨-2의 의도 보존 + 부작용 제거 |
| SG-D15 | **moving의 안심 문장은 정식 상태다**: "지금은 편히 계시면 됩니다" — 단 기존 카피 톤 규칙("모든 것은 지시 또는 사실", `nowCardCopy.ts:10-12`)의 문법으로 | 제로베이스 §D-B 질문 3 · G2 해소 반영 |
| SG-D16 | **응답 시간 약속은 계속 표시하지 않는다.** 룸 안엔 현재도 없다(G3 확인 — 프레즌스 카운트뿐). 온보딩 3장의 운영시간은 사장님 확정 문구만 | F-7: 실측 없는 약속 금지. 목업 ⑨-3의 "1 min"은 목업 결함 |
| SG-D17 | **신규 카피 전부 `Record<RoomLocale,…>` 사전 번역, 런타임 LLM 0.** `CORE_TRANSLATION_LOCALES` 동결 유지 | 로케일 확장 때 비용 불변을 지켜온 원칙 |
| SG-D18 | **접근성: 1초 틱은 낭독 금지.** numeral은 `aria-hidden`, 분기점(T-10/T-5/T-1) 크로싱만 별도 폴라이트 영역이 1회 안내. 카드 루트의 기존 `aria-live`(`NowCard.tsx:213`)는 유지 — aria-hidden 서브트리 변경은 라이브 영역 처리에서 제외되므로 충돌 없음 | 스크린리더 사용자가 매초 폭격당하지 않게 |

---

## D. 손님 홈 정보 아키텍처 (나노 명세)

### D-1. CSS — 추가되는 전부

`app/tour-room-theme.css` 타입 스케일 블록(현재 `:711-754`) 뒤에:

```css
/* 카운트다운/시각의 단 — tr-display(20)보다 위. hero 카드 안, 화면당 하나. */
.tr-numeral {
  font-size: calc(34px * var(--tr-font-scale, 1));
  line-height: 1.05;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
}
:where(.tr-numeral) { font-weight: 700; }
```

신규 토큰 0 · 색 0 · 그림자 0. `--tr-font-scale` 최대 **1.35**(감사 정정 — `useTourRoomSettings.ts:33-39`) → 34×1.35=**45.9px**.
최장 문자열 `+04:12`(6자) ≈ 46px×0.6em×6 ≈ 165px < 320px 뷰포트 hero 내폭 ~288px. 실기기 게이트는 SG-8.

### D-2. 상태 × 행 매트릭스

리졸버 `nowCard.ts`는 **상태 기계 무변경**, `data`에 3필드 추가: `rallyTargetMs`(rally 분기에서 notice.targetMs 관통),
`freeTimeEndsAtMs`(free 분기 관통 — 현재 minutesLeft 스냅샷만 있어 틱 불가), `arrivedAtMs`(`latestArrival` 반환 확장 `:270-288`).

| 상태 | eyebrow (tr-meta) | **NUMERAL** (tr-numeral) | title (tr-title) | sub (tr-card-text) | action/chips | 틱 |
|---|---|---|---|---|---|---|
| `rally_overdue` | `rallyEyebrow` "집합" | `+MM:SS` (now−target) | rallyTitle (기존) | meetingPoint " · " `waitUntil(target+15m)` **[E2]** | 무변경 | 1초 |
| `free_time` | `freeEyebrow` "자유시간" | 잔여 `MM:SS` (<60분) / `H:MM:SS` | `freeMeetAt(point)` / point 없으면 `freeTitleNoPoint` | **[E1 개인행 or 생략]** " · " `waitUntil` **[E2]** | 무변경 | 1초 |
| `arrived` | 기존 "지금 여기" | 체류 잔여 `N분` (arrivedAt+stay−now; ≤0 또는 미상→행 제거) | spotName (기존) | `arrivedUntil(HH:MM)` "10:40까지 여유 있어요" | 무변경 | 30초 |
| `pickup_window` | `pickupEyebrow` "픽업" | meetingTime까지 `N분` (미래일 때만) | pickupTitle (기존) | 차량정보 (기존 유지) | 무변경 | 30초 |
| `moving` | 기존 "다음" | 도착까지 `N분` = nextStopTime−now (**0<N≤90일 때만**; 밖이면 행 제거+기존 title 형식 유지) | nextStopName | `지금 {current} · movingReassurance` **[SG-D15]** | 무변경 | 30초 |
| `lobby` | — LobbyCard 소유. `D-N` numeral은 SG-1d 소형 티켓 (동일 클래스) | | | | | 0 |
| `ended` | — NowCard null 유지(`:162-165`), recap 소유. X17 무충돌(감사 추가②) | | | | | — |

행 순서는 기존 렌더(`NowCard.tsx:216-239`)에 numeral을 eyebrow 다음에 삽입 — 나머지 순서·버튼·칩 클래스 무변경.
`moving`의 "지금" 정보는 유지된다(B7의 "읽던 걸 덜 읽게 하지 않는다" 규칙) — sub 행으로 이동만.

### D-3. 카피 신규 키 (`NowCardCopy` 인터페이스 추가분, en/ko 기준문)

```
rallyEyebrow      'Meeting time' · '집합'
freeEyebrow       'Free time' · '자유시간'
pickupEyebrow     'Pickup' · '픽업'
freeMeetAt(p)     `Meet at ${p}` · `${p}에서 만나요`
freeTitleNoPoint  'Meeting point coming soon' · '집합 안내를 기다려 주세요'
waitUntil(t)      `Waits until ${t}, then departs` · `${t}까지 대기 후 출발`
pickupWaitUntil(t)  `Please be there by ${t}` · `${t}까지는 나와 주세요`   ← 픽업 +10 (F-4: 프라이빗은 "단축" 카피 별도 키)
arrivedUntil(t)   `Yours until about ${t}` · `약 ${t}까지 여유 있어요`
movingReassurance 'Nothing to do — enjoy the ride' · '지금은 편히 계시면 됩니다'
leaveBy(m, t)     `${m} min walk from you — leave by ${t}` · `당신 위치에서 도보 ${m}분 · ${t}에는 출발하세요`   [E1]
walkOptIn         'Walk time from my location' · '내 위치 기준 도보 시간'   [E1 옵트인 칩]
minutesUnit(n)    `${n} min` · `${n}분`   (NumeralClock minutes형)
```

전 키 10로케일 사전 번역(SG-D17). `text-cjk-safe`/`text-cjk-body` 기존 배치 유지. title이 짧아져 CJK 사고 표면 축소(융합 플랜 C-2의 부수효과 그대로).

### D-4. `NumeralClock` 컴포넌트 (신규, `components/tour-mode/NumeralClock.tsx`)

```
props: { mode: 'down' | 'up'; targetMs: number; tickMs: 1000 | 30000;
         format: 'clock' | 'minutes'; unitLabel?: string;   // minutes형의 "분"
         nowMs?: () => number;                               // §E-1 서버 시계 주입
         testId?: string }
```

- 렌더: `<span className="tr-numeral tr-num block text-[var(--tr-ink)]" aria-hidden="true">` — 항상 잉크색(B8 규율).
- 틱: `setInterval(tickMs)` + `visibilitychange` 재계산 — **DepartureCountdown `:325-336` 규율의 단일 재구현이 아니라, 그 패턴을 이 컴포넌트 하나에만 존재시키고 hero가 소비한다.** 1초 틱은 `document.visibilityState==='visible'`일 때만 돈다.
- 성능: 틱 리렌더는 이 컴포넌트 서브트리에 격리 — HomeTab·NowCard 본체는 상태 전이 때만 리렌더(기존 `key={result.state}` 재마운트 `:203` 유지).
- 접근성(SG-D18): 본체 aria-hidden. NowCard가 sibling으로 `<span className="sr-only" role="status">`를 두고 **T-10/T-5/T-1 크로싱에만** `copy.freeTitle(m)` 형태 문장을 1회 갱신.
- 모션: 없음. 숫자 전이 애니메이션 금지(reduced-motion 이슈 원천 차단, 글랜스에 불필요).

---

## E. 시간 주권 체계

### E-1. 서버 시계 (SG-D4)

- `app/api/tour-mode/room/[bookingId]/snapshot` 응답에 `server_now_ms: Date.now()` 1필드.
- `TourRoomClient`가 수신 시 `offsetMs = server_now_ms − Date.now()` 계산, `nowMs = () => Date.now() + offsetMs`를 컨텍스트로 공급.
- 소비처 관통(전부 이미 `nowMs` 파라미터 보유): `NoticeBanner`(`:213,234`) · `nowCard` 어댑터(`:324`) · `DepartureCountdown`(`:313,327`) · `NumeralClock` · sayQueue(§G).
- 효과: rally_overdue/remind/departed **발사 시각이 기기 시계와 무관**해짐 + "내 시계로는 안 늦었다" 원천 차단(손님 화면 숫자가 서버 시각 기준).

### E-2. E2 정책 사전 표시 (SG-D5)

`waitUntil` 계산은 `notices.ts`에 순수 함수 1개 추가 — `policyWaitUntilMs(notice) = notice.targetMs + 15*60_000`
(만료 경계 `:71-90`과 **같은 상수를 공유하도록 상수 추출** `RALLY_GRACE_MS`). free_time/rally sub 행이 이걸 렌더.
집합 사다리 공표 3회(예약 확인/D-1/탑승) 중 앱이 맡는 3회차가 이 행이다.

### E-3. T-10 리마인드 푸시 (SG-D7)

- `NoticeBanner`의 기존 overdue 크로싱 발사기(`:248-258`)를 일반화: stage가 `set→remind` 크로싱(또는 remind로 시작)하면
  `POST signals {type:'rally_remind', noticeId}`.
- 서버(`signals/route.ts` rally_overdue 분기 `:123-174` 복제·축소): `recordRoomEvent(type:'rally_stage', subjectKey: rally:{id}:remind)` →
  승자만 `sendGuestRoomPush(tag: remind-{room})`. **피드 캡슐 없음**(소음 금지) · 이메일 폴백 없음(T-10은 푸시 실패해도 T+5 사다리가 받친다).
- 푸시 본문: 사전 번역 Record — "집합 10분 전 · {point}".

### E-4. 대기 종료 — wait_ended 캡슐 + 재합류 카드 (SG-D6, P3·P4의 심장)

**흐름:**

```
T+10  rallyStage 'contact' (기존)
T+12  스태프 프롬프트 (콕핏 + 가이드 콘솔 자유시간 카드):
      "10:30 대기 종료가 다가옵니다 — 전원 탑승했나요?"
      [전원 탑승]  → recordRoomEvent(type:'rally_stage', subject: rally:{id}:all_aboard) — 캡슐 억제
      [+15분 연장] → 활성 notice가 free_time_timer면 기존 return_time 재발신(콕핏 시트 `:2061-2107` 재사용),
                     meeting_notice면 가이드 콘솔 meeting-send(`GuideConsole.tsx:993-1015`) 재사용 — 새 notice가 낡은 걸 대체(기존 메커니즘)
      [아직 안 왔어요 / 무응답] → 아래 기본 발사
T+15  클라이언트-레이스 POST signals {type:'rally_departed', noticeId}
      서버: all_aboard 이벤트 존재 시 204 no-op. 아니면 recordRoomEvent(subject: rally:{id}:departed) 승자만:
        ① 캡슐 insert — metadata.kind:'wait_ended', translations 10로케일(사전 번역 골격 + point/시각/다음 스톱 슬롯)
        ② 손님 푸시 (tag departed-{room}) — all_aboard 미확인 상태이므로 발송
        ③ 코디(관제) 어텐션 — 기존 attention 경로에 kind 추가
```

**재합류 카드 (`ChatFeed` 신규 분기, generic pill 앞 `:799` 이전 삽입 — `WaitEndedCard`):**
첫 문장은 사실("차가 10:30에 출발했습니다") · **가장 큰 글씨는 한국어 목적지 카드**(다음 스케줄 스톱명 — 택시기사에게 보여주는 용도, `text-cjk-safe`) ·
내비 딥링크(`nav-links.ts` 재사용) · [코디에게 연락](기존 SOS/컨시어지 경로) · "일행에게도 안내되었습니다" 한 줄.
탑승 중인 손님을 위한 헤지 한 줄: "이미 탑승하셨다면 이 안내는 무시하세요". 택시비 부담 문구는 사장님 문구 게이트(§N-2) 뒤에.
NowCard **신규 상태 없음**(v1) — 경로는 푸시 → 피드 캡슐. 7상태 테스트(`nowCard.test.ts:86-92`) 무변경.

**F-5 집단 지연**: [+15분 연장]이 그 분기다 — 과반 판정 자동화는 인원 근거(비콘)가 없어 v2. 연장 시 해당 스팟 체류를 학습 후보로 올리는 건 기존 플라이휠 크론(§W5)에 이벤트만 남긴다(`rally_extended` 이벤트).

**F-4 픽업 분기**: 픽업 rally(투어 시작 전 meeting_notice)에는 wait_ended를 **발사하지 않는다** — 프라이빗 픽업은 출발할 곳이 없다. 판정: notice 생성 시각이 투어 첫 스톱 이전이면 pickup 컨텍스트 → 캡슐 대신 기존 lost 흐름(T+5 위치 공유 + 코디 통화, `PickupBoard`)이 담당. 문구만 `pickupWaitUntil`.

---

## F. 사진 체계

### F-1. 밴드 스펙 (SG-D9)

NowCard 최상단(모든 행 위), 사진 있을 때만:

```tsx
{photoUrl && !imageFailed && (
  <div className="tr-hero-media -mx-4 -mt-4 mb-3 h-36 overflow-hidden rounded-t-[inherit]">
    <img src={photoUrl} alt="" className="h-full w-full object-cover"
         fetchPriority="high" onError={() => setImageFailed(true)} />
  </div>
)}
```

- **글자를 사진에 얹지 않는다** — 스크림 금지, 텍스트는 전부 카드 표면(검증된 대비 쌍 무손상).
- 높이 144px 고정 → CLS 0. 홈 최상단 1장만 `fetchPriority="high"`.
- 폴백: onError → 밴드 제거(오늘 화면으로 복귀). 스와치 원하면 `avatarColorFor` 재사용(PoiThumb 문법) — **깨진 이미지 노출 금지**(감사 B11 결함의 재발 방지, 별도 칩으로 SpotArrivalCard도 수정).
- `contrast` 스킨: `.tr-root[data-tr-skin='contrast'] .tr-hero-media { display:none; }` — 그 스킨은 장식을 전부 걷는 스킨(B10과 같은 논리).
- 채팅의 SpotArrivalCard는 **무변경**(사장님 불변 ①) — 같은 `SpotArrivalContent` 계약을 읽되 렌더만 다르다(데이터 복사본 0).

### F-2. 상태별 소스와 단계

| 상태 | 소스 | 단계 |
|---|---|---|
| `arrived` | `latestArrival`이 이미 읽는 메시지 meta에서 `content.image` 추출 — **네트워크 0** | SG-4a |
| `moving` / `lobby` | snapshot 서버 확장 `next_stop_image` / `tour_hero_image` (서버엔 `poiContent.server.ts` 로직 기존재) | SG-4b |
| `free_time` / `rally` | **집합 장소 사진** (§F-3) — verified만 | SG-4d |
| `pickup_window` | 차량 사진 — §F-4 손님 출구 | SG-5 |
| `ended` | 무변경 (X17 recap이 소유) | — |

하이진: `poiContent.server.ts:70-80`의 `firstImage`가 `poiImage.ts` 체인의 사본(정찰 확인) → `poiImageCandidates`로 통일(SG-4c, 두 번째 복사본 제거).

### F-3. 집합 장소 사진 파이프라인 (SG-D10)

- **마이그레이션(additive)**: `tour_poi_arrival_profiles`에 `meeting_photo_path text` · `meeting_photo_status text check ('pending','verified','rejected') default 'pending'` · `meeting_photo_meta jsonb`(촬영자 role·시각·좌표). 공개 버킷 `tour-meeting-points`(공개 read — 집합 장소 사진은 PII 아님, 서명 URL은 SW 캐시와 상성 불량이라 배제. §N-6 사장님 승인).
- **수집**: 콕핏 지오펜스 도착(onArrival `Cockpit.tsx:529-539`) + 해당 poi_key 프로필에 verified 사진 없음 → 도착 프롬프트/시트에 보조 버튼 **[집합장소 사진]** — `sendVehiclePhoto`(`:908-925`)와 동일 카메라 입력 재사용, 전송처만 신규 `POST /api/tour-rooms/[bookingId]/meeting-photo`(guide|driver|admin, multipart → 버킷 + 프로필 pending upsert). **기사가 첫 방문에 한 번 찍으면 그 POI는 영구 해결.**
- **검수**: `/admin/facility-pins`의 is_verified 큐 문법 복제 — `/admin/meeting-photos`(pending 목록 → 보고 승인/반려). 서빙은 verified만.
- **서빙**: free/rally hero 밴드 + arrival bundle의 집합 섹션(있으면). 없으면 오늘 화면 그대로.

### F-4. 차량 사진 손님 출구 (G1 해소, SG-5)

`GET /api/tour-rooms/[bookingId]/vehicle-photo` — 룸 세션 검증 → `ops_room_vehicles.photo_path` → 60분 서명 URL 반환(프라이빗 버킷 유지 — 관제 보관용 원본 정책 무변경, 마이그레이션 `20260731090000` 주석의 "조회는 단기 서명 URL로만" 준수). `pickup_window` hero + T-10 카드가 소비. SW 캐시 제외(서명 URL).

### F-5. 오프라인 프리페치 (SG-4e)

`sw-tour-mode.js`(`:16-22, 48-51` 현재 아이콘 5장 + 전부 network-only)에 **공개 POI/집합 이미지 전용** 러ntime 캐시 1개:
cache-first + 최대 12항목 LRU + 오리진 화이트리스트(공개 버킷 호스트만). 프리페치는 클라이언트가 `next_stop_image` 수신 시 `cache.add` 1장.
HTML/API network-only 원칙(`:4-7`) 무변경. 서명 URL 계열은 구조적으로 제외(SG-D9).

---

## G. 발화 대기열 v1 (SG-D11)

**핵심: 신규 전송 경로 0. 리졸버 + 카드 하나.** X15 도착 프롬프트(`Cockpit.tsx:1722-1769` — "OFFER, never a send")를 흡수·일반화한다.

### G-1. 리졸버 `lib/tour-room/sayQueue.ts` (순수 함수)

```ts
interface SayInput {
  nowMs: number; lifecycle: RoomLifecycle;
  schedule: { title: string; poiKey?: string|null; time?: string|null }[];
  notice: NoticeState | null;                    // notices.ts 재사용
  geofenceArrival: { spotId: string; title: string } | null;
  firedSubjects: ReadonlySet<string>;            // tour_room_events + 오늘 메시지에서 파생
}
type SayItem = {
  subject: string;                               // say:{kstDay}:{key} — 디듀프 키
  kind: 'arrival_bundle' | 'preset' | 'return_time' | 'briefing';
  presetKey?: string;                            // DRIVER_QUICK_REPLIES 키
  urgency: 'required' | 'suggested';
  deadlineMs?: number;                           // required만 — 표시용, 자동발사 아님
  spotTitle?: string;
};
sayQueue(input): SayItem[]                        // 최대 4 — 넘으면 실패(제로베이스 §D-B)
```

랭킹(첫 4개만): ① required — 지오펜스 도착 & 오늘 그 스팟 도착안내 미발사 → `arrival_bundle` ·
도착 상태 & 활성 타이머 없음 → `return_time` · 하루 첫 운행 & 브리핑 미발사 → `briefing`
② suggested — 스케줄 레그 파생 프리셋: 출발 5분 전 `departing_soon`, 출발 직후 `seatbelt_check`, 마지막 스톱 접근 `check_belongings`, 90분 경과 무정차 `rest_stop` (전부 **기존 `DRIVER_QUICK_REPLIES` 키** — `quickReplies.ts:301-464`, 내용 무변경·키 추가만 허용).

### G-2. 카드 `components/tour-mode/cockpit/SayQueueCard.tsx`

기존 arrivalPrompt 슬롯(absolute top-16, `:1722`)에 스택형 1카드: 최상위 아이템은 큰 버튼(기존 `도착 안내` 스타일), 나머지 최대 3개는 한 줄 행.
탭 → 기존 액션 그대로: `arrival_bundle→openArrivalSheet` · `preset→` 콕핏 독의 프리셋 전송 함수(`:1805-1840` 경로) · `return_time→setSheet('return')` · `briefing→sendMorningBriefing`.
개별 dismiss → `recordRoomEvent(type:'say_dismissed', subject)` — **이미 말한 건/치운 건 다시 안 뜬다.**
required 아이템은 `deadlineMs` 카운트다운 칩 표시(NumeralClock minutes형 재사용, tr-numeral 아님 — 콕핏 주인공은 지도/피드).
**자동 발사 없음** — 마감 지나면 `say_expired` 이벤트만 남긴다(§H-1 지표·§N-5 v1.5 결정의 근거 데이터).

기사 채택 리스크(제로베이스 §M-4)의 완충: 대기열은 **접혀 있지 않다**(항상 보임), 그러나 dismiss가 1탭이라 강요도 아니다.

---

## H. 신뢰 회계

### H-1. 오늘의 나 (SG-D12)

`day-summary/route.ts` 확장 — 기존 visited/span/money에 4행 추가(전부 기존 데이터 파생, LLM 0):

| 지표 | 파생 |
|---|---|
| 정시 | meeting_notice/free_time_timer 수 대비 `rally:{id}:departed` 없이 종료한 수 (`tour_room_events`) |
| 응답 | `guest_*` 신호 이벤트 → 이후 10분 내 스태프 발신 메시지까지 중앙값 초 |
| 해설 | `spot_arrival`/`arrival_bundle` 메시지 수 |
| 사진 | 스태프 발신 이미지 메시지 수 |

콕핏 `오늘 요약` 시트(`:2159-2219`)에 "오늘의 나" 4스탯 그리드 추가. **순위 없음, 다른 기사와 비교 없음, 개별 손님 연결 없음.** 주간 별점 집계는 리뷰 연동 필요 — v2(§M).

### H-2. D-1 온보딩 3장 (SG-D13·14)

`components/tour-mode/OnboardingCards.tsx` — 조건: `customer && lifecycle==='lobby' && daysUntil<=1 && !localStorage[onboard:{bookingId}]`.
①"기사님은 영어를 하지 않습니다 — 의도된 것입니다" + 기사 이름(차량 라인 기존 데이터) ② 신호 버튼 실습(로컬 에코 — 전송 0)
③ 코디 소개 + 운영 시간(**사장님 확정 문구만**, SG-D16) + 확인 체크. 문구 전체가 사람 게이트(§N-2).

### H-3. E3 기사 귀속 · E4 포함된 것

- **E3 v1(텍스트)**: 도착 카드·해설 재생 버튼 옆 "{driver_name} 기사님의 안내" 한 줄 — `vehicleLineFromPayload`(`LobbyCard.tsx:122-139`)가 이미 이름 보유. 사진·연차는 프로필 데이터 부재(B5 보류와 동일 갭) → §N-3 게이트 뒤 v2.
- **E4**: LobbyCard + 픽업 T-30 카드에 "충전기 · 와이파이 · 생수 · 우산이 준비되어 있습니다" 사전 번역 한 줄(D4 결정 — 안 보이면 그냥 손실). 데이터 소스 없이 고정 문구 v1, 차량별 편차 생기면 ops 필드 v2.

---

## I. 데이터·스키마 변경 (전부 additive)

| # | 변경 | 마이그레이션 |
|---|---|---|
| 1 | `tour_poi_arrival_profiles` + `meeting_photo_path/status/meta` | 신규 1건 |
| 2 | 공개 버킷 `tour-meeting-points` | storage (§N-6 승인 후) |
| 3 | `tour_room_events` 신규 type 문자열들 (`rally_stage:remind/departed/all_aboard` subject · `say_*` · `rally_extended`) | **불필요** — type은 자유 문자열(`events.ts:19`), UNIQUE 인덱스 기존재 |
| 4 | snapshot 응답 `server_now_ms` · `next_stop_image` | 코드만 |
| 5 | 차량 사진 손님 출구 | 코드만 (서명 URL) |

DDL 후 `get_advisors` 재실행(기존 규칙). RLS: 투어룸은 서비스롤 경유라 어드바이저 무관(기존 메모).

---

## J. 파일 인벤토리

**신규 7:** `components/tour-mode/NumeralClock.tsx` · `components/tour-mode/WaitEndedCard.tsx` · `components/tour-mode/OnboardingCards.tsx` ·
`components/tour-mode/cockpit/SayQueueCard.tsx` · `lib/tour-room/sayQueue.ts` · `app/api/tour-rooms/[bookingId]/meeting-photo/route.ts` ·
`app/api/tour-rooms/[bookingId]/vehicle-photo/route.ts` (+ `/admin/meeting-photos` 페이지 1)

**확장 12:** `tour-room-theme.css`(+7줄) · `nowCard.ts`(data 3필드+latestArrival) · `nowCardCopy.ts`(+12키×10로케일) · `NowCard.tsx`(numeral 행+밴드+sr 안내) ·
`notices.ts`(`RALLY_GRACE_MS` 추출+`policyWaitUntilMs`) · `NoticeBanner.tsx`(remind/departed 크로싱 발사) · `signals/route.ts`(rally_remind/rally_departed 분기) ·
`ChatFeed.tsx`(wait_ended 분기 1개 — **분기 추가만, 기존 채팅 무변경**) · `Cockpit.tsx`(SayQueueCard 치환+T+12 프롬프트+집합사진 버튼+welcome 시트+요약 4스탯) ·
`GuideConsole.tsx`(자유시간 카드 T+12 프롬프트) · `snapshot route`(+2필드) · `sw-tour-mode.js`(공개 이미지 캐시 1규칙) · `day-summary/route.ts`(+4지표)

**무변경 선언:** ChatFeed의 기존 분기 전부 · SpotArrivalCard(칩 별도) · quickReplies 기존 키 · 스킨/토큰/그림자 · DriverConsole(U-D6v2로 삭제 예정 — **투자 금지**) · StaffShell.

---

## K. 게이트

**자동 (머지 전, `NEXT-SESSION-SMARTAPP-2026-07-28.md` §6 승계):**

```bash
npx tsc --noEmit
npx jest __tests__/components/tour-mode __tests__/lib/tour-room __tests__/audit __tests__/scripts
npx jest skinContrast typeDiscipline shellStackingContext chipBoundary
npm run build   # 종료 코드로 판정 — 출력 grep 금지 (maxDuration 사고 전례)
```

+ UI 변경 시 Playwright 전후 컷 필수(광 아님 — "코드는 맞고 화면은 틀린 경우가 세 번") · 워크트리 dev는 HMR 불가(재시작) ·
`git add` 경로 명시 · 커밋 푸터 `Co-Authored-By: Claude <noreply@anthropic.com>`만.

**플랜 고유 게이트:** ① `typeDiscipline`에 `.tr-numeral` 등록(즉석 34px 유틸 금지 유지) ② 1초 틱 상태 2종 한정 자동 테스트
③ hero 밴드 CLS=0 계측 ④ wait_ended는 **all_aboard 억제·픽업 제외** 두 조건의 회귀 테스트 필수 ⑤ 신규 카피 10로케일 패리티(tsc가 잡음 — Record 타입 유지)
⑥ NumeralClock 45.9px 최소폭(320px) 렌더 테스트.

**사람 게이트:** ⓐ 실기기(폰트 1.35 × 최소폭 · 마이크/TTS · 1초 틱 배터리) ⓑ 집합 사진 검수 큐 운영 ⓒ §N 문구·정책 확정 ⓓ 온보딩 카피 승인.

---

## L. WBS

| 웨이브 | 티켓 | 크기 | 내용 · 수용 기준 | 의존 |
|---|---|---|---|---|
| **SG-0 기반** | 0a | S | `.tr-numeral` CSS + typeDiscipline 등록 — 게이트 ①⑥ | — |
| | 0b | S | `NumeralClock` + 틱/aria 테스트 — 게이트 ② | 0a |
| | 0c | S | 서버 시계: snapshot `server_now_ms` + `nowMs()` 관통 — 오프셋 ±60s 시뮬 테스트 | — |
| **SG-1 홈 4행** | 1a | M | 리졸버 data 3필드 + `latestArrival` arrivedAtMs — `nowCard.test.ts` 확장 | — |
| | 1b | M | NowCard 4행 렌더 + 카피 12키×10로케일 — 상태별 스냅샷 + Playwright 컷 | 0a·0b·1a |
| | 1c | S | E2 `waitUntil`(`RALLY_GRACE_MS` 추출) — free/rally sub 렌더 테스트 | 1b |
| | 1d | S | LobbyCard `D-N` numeral | 0a |
| **SG-2 시간 주권** | 2a | M | T-10 리마인드 푸시(크로싱+디듀프+푸시) — remind 시작 케이스 포함 | 0c |
| | 2b | L | wait_ended: T+12 프롬프트(콕핏+가이드) · all_aboard 억제 · T+15 발사 · WaitEndedCard · 픽업 제외 — 게이트 ④ | 1c·2a |
| | 2c | S | [+15분 연장] 배선(기존 return_time/meeting-send 재사용) + `rally_extended` 이벤트 | 2b |
| **SG-3 개인화** | 3a | M | E1 옵트인 도보 역산(온디바이스) — 열화 3형 테스트 | 1b |
| | 3b | S | E4 포함된 것(LobbyCard+T-30) · E3 텍스트 귀속 | 1b |
| **SG-4 사진** | 4a | S | arrived 밴드(메시지 파생, 네트워크 0) + onError 폴백 | 1b |
| | 4b | M | snapshot `next_stop_image`/`tour_hero_image` + moving/lobby 밴드 — LCP 계측 | 4a |
| | 4c | S | `firstImage`→`poiImageCandidates` 통일(하이진) | — |
| | 4d | L | 집합 사진: 마이그레이션+버킷+콕핏 촬영+검수 큐+free/rally 밴드 — 사람 게이트 ⓑ | 4a·§N-6 |
| | 4e | S | SW 공개 이미지 캐시 + 프리페치 1장 — 터널 시뮬 컷 | 4b |
| **SG-5 픽업** | 5a | S | pickup 4행(numeral 조건부) + `pickupWaitUntil` | 1b |
| | 5b | S | T-0 이름 사인 콕핏 시트(2탭) | — |
| | 5c | M | 차량 사진 손님 출구(서명 URL) + T-10/히어로 소비 | 5a |
| **SG-6 발화 대기열** | 6a | M | `sayQueue.ts` 리졸버 + 유닛(랭킹·디듀프·max4) | — |
| | 6b | M | SayQueueCard + 콕핏 통합(arrivalPrompt 흡수) + `say_*` 이벤트 | 6a |
| **SG-7 신뢰** | 7a | M | day-summary 4지표 + 콕핏 요약 그리드 | — |
| | 7b | M | D-1 온보딩 3장(로컬 에코 데모) — 사람 게이트 ⓓ | §N-2 |
| **SG-8 하드닝** | 8a | — | 실기기(사람 게이트 ⓐ) · 배터리 1초 틱 실측 · 스크린리더 패스 · 접근성 감사 | 전체 |

**시작점: SG-0a → 0b → 1a → 1b.** 자산 0으로 홈이 눈에 띄게 좋아지는 최단 경로이며, 사진(SG-4)의 레이아웃 결정을 실사용으로 선검증한다.
병렬 가능: SG-0c·1a 동시, SG-2와 SG-3, SG-6과 SG-4. 워크트리·포트·시드는 `NEXT-SESSION-SMARTAPP-2026-07-28.md` §2 그대로.

---

## M. 하지 않는 것

**금지(원칙):** 실시간 자유 번역 주경로 · 앱 설치 강제 · 순위표 · 게이미피케이션/체류 최적화 · 기사에게 판단을 요구하는 UI ·
지킬 수 없는 숫자(고정 응답 시간, 24/7) · 모르는 값 채우기 · 채팅/재질/스킨 변경 · `.tr-numeral` 크기 변형.

**보류(사유 명시):** 버스 좌석 보드·3상태 인원(도어 비콘/QR 하드웨어 — v2 트랙) · SMS/WhatsApp 알림 폴백(발송 인프라 계약 필요) ·
T+7 자동 음성 콜(텔레포니 부재 — T-10/T+5 푸시가 v1 대체) · 자동 발사(§N-5 결정 전까지 이벤트 수집만) ·
개인별 알림 오프셋(서버 스케줄링 필요) · 자동 앨범(서명 URL 스토리지 정책 — X17이 텍스트 공유인 이유와 동일) ·
기사 사진/연차 프로필(§N-3) · 코디 상태 3단 연동(관제 트랙 O2와 병합) · TTS 슬롯 문장·발음 사전(콘텐츠 제작 트랙) ·
스태프 `text-4xl` 2건의 tr-numeral 이관(U-D2 관제 타이포 트랙).

---

## N. 열린 결정 (사장님)

| # | 질문 | 기본값(무응답 시) |
|---|---|---|
| N-1 | wait_ended **무응답 기본 발사** 승인 — T+12 프롬프트에 스태프가 답하지 않으면 T+15에 캡슐+푸시가 나간다 | 발사(D3 집행 원칙) |
| N-2 | 낙오 캡슐의 택시비 문구(제로베이스 F-13: 1인 1회 전액?) · 노쇼/홀드 문구 · 온보딩 3장 카피 | 문구 없이 출시(카드에 비용 표기 생략) |
| N-3 | 기사 프로필 데이터(사진·연차) 제공 여부 — E3 v2·온보딩 강화 | 텍스트 귀속만 |
| N-4 | 코디 운영 시간 표기값(온보딩 3장) | 미표기 |
| N-5 | 발화 대기열 필수 항목 **자동 발사** v1.5 도입 — `say_expired` 데이터 보고 결정 | 미도입 |
| N-6 | 집합 사진 **공개 버킷** 승인(PII 아님 전제) | 보류 시 SG-4d 전체 보류 |

---

*다음 세션 첫 명령: 이 문서 §L의 SG-0a부터. 환경은 `docs/NEXT-SESSION-SMARTAPP-2026-07-28.md` §2, 게이트는 §K.*
