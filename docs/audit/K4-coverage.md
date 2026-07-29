# K4-coverage — 20방 전 기능 커버리지 원장

> 🔴 **이 파일은 생성물이다.** 손으로 고치지 말 것 —
> `lib/audit/k4Coverage.ts` 를 고치고 `npx tsx scripts/gen-k4-coverage.ts` 를 돌린다.
> `__tests__/audit/k4Coverage.test.ts` 가 이 파일과 소스가 어긋나면 실패한다.

## 왜 원장이 먼저인가

사장님 결정으로 K4 는 "100방 채팅 부하"에서 **"20방 × 전 기능, 그리고 안 돌린 것을 출력"**
으로 바뀌었다. 마지막 절이 이 티켓의 본체다 — **공백을 말하지 않는 초록은 "다 된다"로 읽힌다.**
실제로 이 레포의 프로덕션 하니스가 그랬다: POST 전용 라우트 5개를 GET 으로 치고 있었고,
기대 코드에 404 가 들어 있어서 **여섯 건이 가짜로 통과**했다.

원장이 **먼저** 착지하는 이유도 같다. 원장이 틀리면 그 아래 배정·주행·보고가 전부 틀리는데,
원장을 제대로 만드는 데에는 **네트워크도 비용도 들지 않는다.**

## 수치

| | |
|---|---|
| (메서드, 경로) 쌍 | **54** |
| 주행 대상 | 53 |
| 설계상 건너뜀 | 1 |
| 방 개수 | 20 |
| 비용 등급 | free 41 · llm 12 · people 1 |
| 행위자 | guest 39 · guide 11 · driver 2 · admin 2 |

`room 0` = **모든 방**이 지난다(문이므로). `room —` = 건너뜀.

## 원장

| 메서드 | 경로 | 행위자 | 비용 | 방 | 건너뛴 사유 |
|---|---|---|---|---|---|
| `DELETE` | `/api/tour-rooms/[bookingId]/location` | guest | free | 1 |  |
| `GET` | `/api/tour-mode/booking/[id]/content` | guest | free | 2 |  |
| `GET` | `/api/tour-mode/bookings` | admin | free | 3 |  |
| `GET` | `/api/tour-mode/driver/overview` | driver | free | 4 |  |
| `GET` | `/api/tour-mode/guide/overview` | guide | free | 5 |  |
| `GET` | `/api/tour-mode/room/[bookingId]/snapshot` | guest | free | 6 |  |
| `GET` | `/api/tour-rooms/[bookingId]/arrival-bundle` | guide | free | 7 |  |
| `GET` | `/api/tour-rooms/[bookingId]/companion-invite` | guest | free | 8 |  |
| `GET` | `/api/tour-rooms/[bookingId]/day-summary` | guide | free | 9 |  |
| `GET` | `/api/tour-rooms/[bookingId]/dietary` | guest | free | 10 |  |
| `GET` | `/api/tour-rooms/[bookingId]/events` | guest | free | 11 |  |
| `GET` | `/api/tour-rooms/[bookingId]/extras` | guest | free | 12 |  |
| `GET` | `/api/tour-rooms/[bookingId]/media` | guest | free | 13 |  |
| `GET` | `/api/tour-rooms/[bookingId]/messages` | guest | free | 14 |  |
| `GET` | `/api/tour-rooms/[bookingId]/my-seat` | guest | free | 15 |  |
| `GET` | `/api/tour-rooms/[bookingId]/plan` | guest | free | 16 |  |
| `GET` | `/api/tour-rooms/[bookingId]/plan/templates` | guest | free | 17 |  |
| `GET` | `/api/tour-rooms/[bookingId]/reactions` | guest | free | 18 |  |
| `GET` | `/api/tour-rooms/[bookingId]/tour-itinerary` | guest | free | 19 |  |
| `GET` | `/api/tour-rooms/[bookingId]/tts` | guest | llm | 20 |  |
| `GET` | `/api/tour-rooms/[bookingId]/vehicle-eta` | guest | free | 1 |  |
| `PATCH` | `/api/tour-rooms/[bookingId]/extras` | guide | free | 2 |  |
| `POST` | `/api/tour-mode/driver/link` | admin | free | 3 |  |
| `POST` | `/api/tour-rooms/[bookingId]/approach` | guest | free | 4 |  |
| `POST` | `/api/tour-rooms/[bookingId]/arrival-bundle` | guide | llm | 5 |  |
| `POST` | `/api/tour-rooms/[bookingId]/captions` | guide | llm | 6 |  |
| `POST` | `/api/tour-rooms/[bookingId]/companion-invite` | guest | free | 7 |  |
| `POST` | `/api/tour-rooms/[bookingId]/companion-invite/redeem` | guest | free | 8 |  |
| `POST` | `/api/tour-rooms/[bookingId]/concierge` | guest | llm | 9 |  |
| `POST` | `/api/tour-rooms/[bookingId]/dining` | guest | llm | 10 |  |
| `POST` | `/api/tour-rooms/[bookingId]/dining/feedback` | guest | free | 11 |  |
| `POST` | `/api/tour-rooms/[bookingId]/driver-signal` | driver | free | 12 |  |
| `POST` | `/api/tour-rooms/[bookingId]/extend` | guide | free | 13 |  |
| `POST` | `/api/tour-rooms/[bookingId]/extras` | guide | free | 14 |  |
| `POST` | `/api/tour-rooms/[bookingId]/join` | guest | free | 전부 |  |
| `POST` | `/api/tour-rooms/[bookingId]/location` | guest | free | 15 |  |
| `POST` | `/api/tour-rooms/[bookingId]/manual-arrival` | guide | llm | 16 |  |
| `POST` | `/api/tour-rooms/[bookingId]/messages` | guest | llm | 17 |  |
| `POST` | `/api/tour-rooms/[bookingId]/messages/[messageId]/retranslate` | guest | llm | 18 |  |
| `POST` | `/api/tour-rooms/[bookingId]/morning-briefing` | guide | llm | 19 |  |
| `POST` | `/api/tour-rooms/[bookingId]/plan/claim-lead` | guest | free | 20 |  |
| `POST` | `/api/tour-rooms/[bookingId]/push-subscribe` | guest | free | 1 |  |
| `POST` | `/api/tour-rooms/[bookingId]/reactions` | guest | free | 2 |  |
| `POST` | `/api/tour-rooms/[bookingId]/read` | guest | free | 3 |  |
| `POST` | `/api/tour-rooms/[bookingId]/signals` | guest | free | 4 |  |
| `POST` | `/api/tour-rooms/[bookingId]/sos` | guest | people | — | SKIPPED BY DESIGN — rings a real on-call human (admin email + ops push). Run it only while the owner is watching. |
| `POST` | `/api/tour-rooms/[bookingId]/spot-events` | guest | free | 5 |  |
| `POST` | `/api/tour-rooms/[bookingId]/stt` | guest | llm | 6 |  |
| `POST` | `/api/tour-rooms/[bookingId]/timeline-coupon` | guest | free | 7 |  |
| `POST` | `/api/tour-rooms/[bookingId]/typing` | guest | free | 8 |  |
| `POST` | `/api/tour-rooms/[bookingId]/vision-ask` | guest | llm | 9 |  |
| `POST` | `/api/tour-rooms/broadcast` | guide | llm | 10 |  |
| `PUT` | `/api/tour-rooms/[bookingId]/dietary` | guest | free | 11 |  |
| `PUT` | `/api/tour-rooms/[bookingId]/plan` | guest | free | 12 |  |

## 🔴 이 주행이 재지 않는 것

라우트 커버리지 100% 를 보고 "부하 테스트를 통과했다"고 읽지 않도록, 아래를 표와 **항상 같이**
출력한다. 이것들은 엔드포인트가 아니라서 건너뜀 행으로도 나타날 수 없다 —
그래서 적어 두지 않으면 영영 안 보인다.

| 안 잰 것 | 왜 |
|---|---|
| Concurrent realtime connections (§K-2 wall #1) | A sequential HTTP run opens one socket at a time. The ceiling is a property of simultaneous subscribers, and its actual value is still unknown (K2 needs the Supabase console). |
| SSE fallback amplification (§K-3) | The dangerous shape is every client degrading to SSE at once and converting one capacity limit into unbounded function-hours and DB reads. Reproducing it needs induced realtime failure under concurrency, not a route sweep. |
| Translation provider rate limits (§K-2 wall #4) | The run reuses a small sentence corpus so the translation cache absorbs it — deliberately, to keep the bill down. That means it also never approaches the provider ceiling. |
| Cold-start latency | A back-to-back sweep keeps functions warm. Real guests arrive spread across a morning and pay cold starts the harness never sees. |

## 실행 기록 — Phase 2~4 (2026-07-31)

`ALLOW_SIM_SEED=1 npx tsx scripts/k4-seed.ts` → `npx tsx scripts/k4-run.ts` →
`npx tsx scripts/sim-tour-day.ts --cleanup`

| | |
|---|---|
| 방 | **20** (프라이빗 11 / 조인 9 — 라이브 예약비 7:6 실측) |
| 커버 대상 쌍 | **53** |
| PASS | **53** |
| FAIL | **0** |
| UNWRITTEN(선언됐지만 하니스가 안 부름) | **0** |
| SKIP | **1** — `POST /sos`, 설계상 제외(실제 당직자 호출) |
| 모델 티어 12쌍 | **전부 2xx** — 조기 반환 없이 실제 실행 |
| 정리 | 20예약 삭제 · 고아 0 |

### 🔴 이 주행이 원장을 고쳤다 — 배우 선언 4건이 틀렸었다

원장의 손으로 쓴 절반은 *"actor 는 라우트 파일만 보고는 추론할 수 없다"* 고 적어 뒀는데,
**그 추측이 네 번 틀렸다.** 전부 `guest` 로 선언돼 있었고 실제로는 스태프 전용이었다:

| 쌍 | 선언 | 실제 |
|---|---|---|
| `GET /day-summary` | guest | **guide/driver/admin** |
| `GET /arrival-bundle` | guest | **guide/driver/admin** |
| `POST /morning-briefing` | guest | **guide/driver/admin** |
| `POST /captions` | guest | **guide** |

**네 번째는 숨어 있었다.** 빈 바디로 부르면 이 라우트는 *누가 부르는지 확인하기 훨씬 전에*
400(입력 검증)으로 답한다. 진짜 입력을 넣어 주자 403 으로 바뀌었다 —
**입력 검증 오류가 인가 계약을 가릴 수 있다.**

### 🔴 하니스가 스스로 만든 거짓 통과 두 가지 (둘 다 고침)

**① `403` 을 기대 집합에 넣어 뒀다.** `x-tour-room-auth` 는 `join` 이 발급한 **세션**을 받는데
룸 **토큰**을 그대로 넣고 있었다. 403 이 기대 안에 있으니 **PASS 로 보고되면서 실제로는
"인증 안 된 호출자는 거부된다"만 증명**하고 있었다 — 이 원장 주석이 경고하던
*"기대 집합이 너무 관대한"* 함정 그대로. (스태프 세션은 **투어가 아니라 예약 단위**다.
방 3에서 딴 세션은 방 7에서 403 이다.)

**② `PASS ≠ 기능이 돌았다`.** `tts`·`retranslate`·`reactions`·`read` 는 자기 방에 메시지가
없으면 400/404 로 **조기 반환**하는데 그게 기대 안에 있어 PASS 였다. 즉 **라우트는 답했지만
기능은 한 번도 실행되지 않았다.** 각 방에 메시지를 하나 심는 전제를 넣자 200 으로 바뀌었다.
`captions`·`dining` 도 같은 이유로 400 이었다(텍스트/좌표 없음).

> **"핸들러가 답했다"와 "기능이 실행됐다"는 다른 주장이다.** 커버리지 주행이 둘을 섞으면
> 그게 바로 이 티켓이 막으려던 것이다.

