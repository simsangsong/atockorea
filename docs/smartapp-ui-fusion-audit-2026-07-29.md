# 융합 플랜 감사 — §B 재검증·§G 해소·플랜 수정 7건 (2026-07-29)

> **이 문서의 용도:** `docs/smartapp-ui-fusion-plan-2026-07-29.md`(이하 "플랜")의 §B 측정 18건을
> 현재 main(`e3364386`, PR #630 머지 후) 기준으로 전수 재검증하고, §G 미확인 7건을 전부 해소한 결과.
> **플랜 §B의 B2는 거짓, B1·B11은 정정 대상이며, §G는 이 문서가 대체한다.**
> 티켓화할 때는 플랜 + 이 문서를 한 쌍으로 읽는다.
>
> 측정 베이스 주의: 플랜의 file:line은 PR #581 시점이다. 이 문서의 file:line이 현재 정본.

---

## 1. 판정

**융합 방향은 맞다. 순서(숫자→사진→밀도)도 맞다.** 다만 아래 §4의 수정 7건을 반영하지 않고
그대로 티켓화하면 안 된다. 근거 3개:

1. **결핍-우위 정합.** 손님 표면 타입 상한 20px(`tr-display`)·숫자의 문장 갇힘(`NowCard.tsx:120`)·
   "photography lives HERE" 주석 아래 `<img>` 0개 — 전부 재확인. 제로베이스 설계의 유일한 우위
   (정보 계층)가 현재 앱의 유일한 실측 결핍을 정확히 찌른다.
2. **재질 비대칭은 실증이다.** 목업의 전신(채팅 위젯)은 다크 대비가 깨졌다 — 게이트 0회 통과 재질의
   예견된 사고. 현재 앱 재질은 10스킨 × `skinContrast` 게이트 통과 상태. 검증된 쪽이 기준이 되는 게 맞다.
3. **수렴 증거.** 목업 13종 중 상당수가 이미 지어져 있다 — ⑫ 현장 결제 ≈ LEDGER/extras,
   ⑬ 리뷰 OTA 분기 ≈ X17(`timelineShare.ts` reviewPolicy 사다리), ⑪ 손님 지연 고지 ≈ activeCard,
   신호 버튼 ≈ `QuickSignalBar` 6종. 독립 설계 둘이 같은 답에 도달한 면적이 이만큼 = 재작성이 아니라
   융합이 맞다는 증거.

---

## 2. §B 재검증 — 15 유효 · 2 정정 · 1 거짓

| # | 판정 | 현재 상태 (file:line = 현재 main) |
|---|---|---|
| B1 | ⚠ 정정 | "앱 최대 20px"은 **손님 표면 한정**. 콕핏 인원수 `text-4xl tabular-nums`(`cockpit/Cockpit.tsx:1498`)·기사 PIN `text-4xl`(`driver/DriverConsole.tsx:185`)이 이미 있고, `__tests__/components/tour-mode/typeDiscipline.test.ts:75,81-83`에 **allowlist 예외로 등재** — 단 `--tr-font-scale`을 안 곱는다. `.tr-numeral`은 신설이 아니라 이 예외들의 표준화 기회 |
| B2 | 🔴 거짓 | `.tr-num`(`tour-room-theme.css:780-782`)은 "쓴 적 없다"가 아니라 **~30곳 사용 중**(DepartureCountdown·ChatFeed·콕핏·가이드 콘솔·체크인 …). 단 tabular-nums 정렬 유틸이지 크기 단이 아니므로 "큰 숫자 **단**이 없다"는 논지는 유효 |
| B3 | ✅ | 8클래스 전부 `calc(Npx * var(--tr-font-scale, 1))` — 스케일 블록 현재 `tour-room-theme.css:711-754` |
| B4 | ✅ | `:where()` weight 규율 유지(`:776-778`) |
| B5 | ✅ | `NowCard.tsx:120` `title = copy.freeTitle(result.data.minutesLeft ?? 0)` |
| B6 | ✅ | 주석 `NowCard.tsx:11-12`, `<img>` 0개 재확인 |
| B7 | ✅ | eyebrow→title→sub→action→chips = `:216→221→224→226→239` |
| B8 | ✅(간접) | NowCard 구조 불변으로 간접 확인 (TONE_CLASS/TONE_INK 개별 재검증은 생략) |
| B9 | ✅ | `.tr-card-hero` `:1374-1380`, "one per screen" 주석 `:1371-1372` |
| B10 | ✅+보강 | contrast 스킨 shadow none(`:1359-1361`, `:1381-1384`) + **hero border를 ink로 스왑**까지 한다 |
| B11 | ⚠ 정정 | 사진 `h-36 object-cover`는 참(`SpotArrivalCard.tsx:166`). **스와치 폴백은 여기 없고 `plan/PoiThumb.tsx:92-99`에 있다**(`avatarColorFor`). SpotArrivalCard 무사진 분기는 텍스트뿐이고 `onError` 부재 → 죽은 URL이면 깨진 이미지 노출(잠복 결함, 수정 칩 발행됨). 렌더는 채팅 피드뿐(`ChatFeed.tsx:782`, `ArrivalBundleCard.tsx:196`) — 참 |
| B12 | ✅ | `MeetSetCard.tsx` 이미지 0. `tour_poi_arrival_profiles`는 `meeting_point text` + `_i18n`뿐, 이미지 컬럼 없음 |
| B13 | ✅ | `offlineVault.ts` = JSON 암호화 저장만. 이미지 캐시 0 |
| B14 | ✅+보강 | 30초 틱+visibility(`DepartureCountdown.tsx:325-336`), 서버 타이머 없음. **추가:** 이제 `extra_ledger` 캡슐에서 `boughtHours`를 파생(`:297-311`) — 타깃이 `departure_time + base + bought` |
| B15 | ✅ | 7상태 불변(`nowCard.ts:33-40`). X15(#629)·X18(#630)은 이 파일을 안 건드렸다 |
| B16 | ✅ | `notices.ts:116-126` — `contact`가 터미널. "대기 종료" 개념 여전히 부재 |
| B17 | ✅+잔드리프트 | 역할 3종 × 10로케일, LLM 0. 헤더 주석 "5로케일"은 낡은 카피. `PickupBoard.tsx:134`는 레거시 별칭(`QUICK_REPLY_PRESETS`=customer 세트)을 읽어 역할 디스패치를 우회 |
| B18 | ✅ | speed 소비처 전수 확인 — 행동적 사용은 `geo.ts:168` 도착 판정뿐. 기사 기기까지 rebroadcast되고(`useTourRoomChannel.ts:77`) **아무도 안 읽는다**. 주행 잠금(F-1) 재료가 이미 배선돼 있는 셈 |

---

## 3. §G 해소 — 7건 전부 + 추가 확인 2건

| # | 답 | 플랜 영향 |
|---|---|---|
| G1 | 차량 사진은 DB에 있다 — `ops_room_vehicles.photo_path`(마이그레이션 `20260731090000_ops_room_vehicle_photo.sql`, **프라이빗 버킷 `ops-vehicle-refs`, 서명 URL 전용**). 손님 경로는 SELECT조차 안 한다(`snapshot.ts:289`, `my-seat/route.ts:42-43`). 콕핏 "차량사진" 버튼은 채팅으로 쏘는 별개 경로 | **N3 = 자산 배치가 아니라 신규 손님용 서명 URL 출구 개발.** 비용 상향 |
| G2 | `moving` 카피는 eyebrow(`다음`)+action(`지도 열기`) 2개뿐(`nowCardCopy.ts:55-56,74-75`). "아무것도 안 하셔도 됩니다" 등가물 없음. 파일 톤 규칙은 "전부 지시 또는 사실" | 제로베이스 명제 채택 권고 — 단 기존 톤 문법으로 ("지금은 쉬시면 됩니다 · 다음은 ~") |
| G3 | 룸 안에 응답 시간 약속 없음. 라이브 프레즌스 카운트(`PresenceBar.tsx:14-25`)와 정적 라우팅 문구(`SosButton.tsx:28,39`)뿐 | 목업 ④⑨의 "replies in 1 min"은 **데이터 소스 없는 넷뉴 카피 — 도입 금지 유지**(SoT F-7과 코드 현실 일치) |
| G4 | **주인공 둘은 불가능** — NowCard(`HomeTab.tsx:702`)와 폴백 hero(`:730-731`)는 `nowCardResult` 유무로 상호배타. U-D23 주석(`:696-701`)까지 있다 | 플랜 D-1 원칙 3의 리스크 소멸. `home-status-live`는 병존 카드가 아니라 NowCard의 **폴백** |
| G5 | `sw-tour-mode.js` = 아이콘 PNG 5장만 프리캐시(`:16-22`), 나머지 **명시적 network-only**(`:48-51`) | N4 필요성 확정. 단 채팅/차량 사진은 서명 URL이라 SW 캐시와 상성 나쁨 → **N4는 공개 POI 자산 1장으로 한정** |
| G6 | `tr-display` 사용: 콕핏 14곳(초과시간 스테퍼 클러스터 `:2582-2598` 포함)·체크인·플래너 등. **가이드 콘솔·손님 홈 NowCard 영역은 클린** | N0(손님 홈)은 무충돌. 콕핏 numeral 통일은 **별도 티켓으로 분리**(allowlist 예외 2건 이관 결정 포함) |
| G7 | `--tr-font-scale` = **0.85 / 0.925 / 1 / 1.15 / 1.35** 5단(`useTourRoomSettings.ts:33-39`), 슬라이더(`SettingsTab.tsx:521-533`) | 게이트 수치 정정: 34 × **1.35 = 45.9px**(플랜의 1.3 가정보다 큼). "+04:12" 6자 tabular ≈ 165px — 320px 뷰포트 hero 내폭(~288px)에 수용 가능하나 실기기 게이트 유지 |
| 추가① | `useGeoWatcher` 마운트 = 콕핏(`Cockpit.tsx:541`) + 지도탭 옵트인 공유(`RoomMapTab.tsx:137`)뿐. **손님 홈은 위치 권한이 없다** | **E1 "손님 위치를 이미 안다"는 전제 오류** → §4-2 |
| 추가② | X17(#609)은 타임라인 시트 안 텍스트 공유 버튼만 추가. **`ended` hero 슬롯은 안 가져갔다**(`nowCard.ts:217-225` 불변, `NowCard.tsx:162-165` null 반환). 사진 URL 0은 의도(서명 URL 6시간 만료 → 공유 불가) | 플랜 D-2 `ended` 행 유효. 앨범 그리드는 타임라인 시트에 기존재(한 탭 깊이) |

---

## 4. 플랜 수정 7건 (티켓화 전 필수 반영)

1. 🔴 **E2는 약속인데 집행 장치가 없다 — 최우선.** "10:30까지 대기 후 출발"을 표시하는 순간 약속인데,
   `rallyStage`는 `contact`가 터미널이라 10:30에 아무 일도 안 일어난다(B16). 설계 원칙 8
   ("약속은 지킬 수 있는 것만 표시") 자기 위반. 늦은 손님이 "10:30 넘었는데 차가 있네"를 학습하면
   정책 전체가 죽는다. → **E2를 N0-e에서 떼어 `departed` 스테이지(+최소 낙오 캡슐)와 한 티켓으로.**
   rallyStage는 순수 시간 파생이라 스테이지 추가는 싸다. 짝이 안 되면 E2 문구를 정보("출발 예정 10:15")로 강등.
2. **E1은 옵트인 + 열화 문법.** 위치 없으면 "집합 장소에서 도보 약 6분"(일반형), 옵트인 시
   "당신 위치에서 6분 · 10:09 출발"(개인형). 계산은 온디바이스 — 서버 전송 불필요, R-17 퍼지 계약 무충돌.
3. **콕핏은 N0 범위에서 제외, 별도 티켓.** 손님 홈은 무충돌(G6)이지만 콕핏은 tr-display 클러스터 +
   allowlist `text-4xl` 공존이라 "주인공 하나"의 콕핏 적용은 별도 결정. 목업 ②의 일행 명단(340m·6분)은
   연속 위치 공유 전제 = 프라이버시 계약 변경이라 보류.
4. **문서 정정 3건:** B2(거짓 — `.tr-num` ~30곳 사용 중), B11(폴백은 `PoiThumb` 문법 재사용으로 명시),
   C-6 게이트(1.3 → **1.35**, 44 → 45.9px).
5. **a11y 게이트 5번 추가:** 1초 틱 numeral은 스크린리더에 매초 읽히면 안 된다 —
   `aria-hidden` + 분 단위 별도 aria-live 텍스트.
6. **moving 숫자 크기 단일화:** 플랜 C-3(전 상태 34px) vs 목업 ④(22px) 불일치 → **단일 34px** 권고.
   위계는 크기가 아니라 톤으로, 스케일 단은 하나만.
7. **N4는 공개 자산 한정:** X17이 텍스트 공유가 된 이유(서명 URL 만료)가 SW 캐시에도 그대로 적용된다.
   프리페치 1장은 공개 POI 히어로만.

---

## 5. 목업 13종 판정

- **융합 플랜이 소비(정확):** ② ⑤ (④ ⑦ ⑧은 부분)
- **이미 있다 — 재발명 금지:** ⑫ ≈ LEDGER/extras · ⑬ 리뷰 분기 ≈ X17 · ⑪ 손님측 ≈ activeCard 지연 · 신호 ≈ QuickSignalBar 6종(running_late·rest_stop·lost·pickup_request·dropoff_change·share_location)
- **작지만 지금 짝으로 필요:** ⑧의 "대기 종료 선언" → §4-1
- **새 기능 트랙(융합 범위 밖이 맞음):** ① 발화 대기열 · ③ 오늘의 나 · ⑥ 코디 콘솔 · ⑨ 온보딩 3장 · ⑩ 좌석 보드(버스 v2) · ⑪ 기사 3택 조정
- **목업 자체 결함 2건(카피를 따라가지 말 것):** ⑨-3 "replies in about 1 min" 정적 약속 = SoT F-7 자기 위반 ·
  ② 푸터 "출발 결정은 앱이 합니다" = SoT §H("앱은 대기 종료만 선언, 출차는 기사")와 충돌

---

## 6. 수정 웨이브 — ⚠ 역사 기록 (2026-07-30부로 `smart-guiding-app-master-plan-2026-07-30.md` §L이 대체)

| | 내용 | 변경점 |
|---|---|---|
| N0-a | `.tr-numeral` + NowCard 4행 (손님 홈만) | 콕핏 제외 명시. 시작점 유지 |
| N0-b | 상태별 숫자 매핑 (moving 포함 전부 34px 단일) | §4-6 |
| N0-c | 1초 틱 2상태 한정 + **a11y aria 처리** | §4-5 |
| N0-e′ | **E2 사전 표시 + `departed` 스테이지 + 최소 낙오 캡슐 (한 티켓)** | §4-1, 승격 |
| N0-d | 실기기 font-scale — **45.9px** 기준 | §4-4 |
| N0-f | E1 옵트인 + 열화 문법 | §4-2, 신설 |
| N1 | 이미지 밴드 + **PoiThumb 폴백 문법 재사용** + SpotArrivalCard onError 동반 수정 | §4-4 |
| N2 | 집합 사진 파이프라인 (변경 없음) | — |
| N4 | 오프라인 프리페치 — **공개 POI 자산 1장 한정** | §4-7 |
| N3 | 차량 사진 = **신규 손님용 서명 URL 출구** (비용 상향) | G1 |
| N5 | E3 기사 귀속 · E4 포함된 것 (변경 없음) | — |
| 별도 | 콕핏 numeral 통일(allowlist 예외 이관 결정) · 문서 정정 3건 | §4-3·4 |

**시작점은 그대로 N0-a.**
