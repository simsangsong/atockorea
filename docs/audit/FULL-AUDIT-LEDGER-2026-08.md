# FULL-AUDIT-LEDGER — 풀 오디트 결함 원장 (2026-08)

> 플랜: `docs/full-app-audit-plan-2026-08-01.md` §F-3 · §B-6 (감사와 수정 분리 — 여기 적고, 수정은 A8)
> 심각도: P0 오늘 겪는 기능상실/오정보 · P1 특정 조합에서 상실 · P2 품질 · P3 위생
> 모든 수치엔 [실측]/[계산]/[추정] 태그. 재현 명령 없는 결함은 원장에 못 오른다.

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

## A1 회고 대조 — 참으로 확인된 주장 (불일치 아님, 기록용)

- **누적 수치 주장 7건 중 거짓 0건**: K4 53/53(당시)→현 55/56 · A1 87→98/98 · CJK 상한 일치 · 도착해설 **122/124 라이브 실측 일치**(전 로케일 98%) · 기사 PIN fail-closed(번호판 등록 시)+회귀 2겹 · STT groq→openai 폴백 배선+호출자 3곳(verbose_json 400 사인 수정됨) · jest 수치 단조 증가.
- **§P 구현 원장 "만들었다" 축 전 행 일치** — 신규 모듈 전부 실존+실호출. 이 트랙은 "연결하는 문제"를 피했다.
- TTS 버킷(`tour-audio`) 라이브 존재 ✓ [실측]. TTS는 OpenAI 단일 경로(폴백 없음 — 설계).
- `ops-vehicle-refs` 버킷 라이브 부재는 **lazy-create 설계**(업로드 시 ensureLayoutPhotoBucket) — 결함 아님. 단, **라이브 차량 사진 0장**(ops_room_vehicles 1행/photo 0) [실측] → SG5 픽업 밴드 차량 사진은 운영 업로드 사람 게이트 대기.
- fr/de/it/ru POI 해설 검수 대기: 118/113/112/90건 (A4 게이트 보류 중) [실측].

## 즉시수정 (감사 블로커만 — §B-6 예외)

*(없음)*

## 재현 불가 판정

- "jest 179 스위트/1815" (§P 게이트 최종) — 문서화된 4명령으로 재현 불가(176/1794). FA-009.
