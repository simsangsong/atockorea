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
| (메서드, 경로) 쌍 | **59** |
| 주행 대상 | 58 |
| 설계상 건너뜀 | 1 |
| 방 개수 | 20 |
| 비용 등급 | free 46 · llm 12 · people 1 |
| 행위자 | guest 43 · guide 12 · driver 3 · admin 0 |

`room 0` = **모든 방**이 지난다(문이므로). `room —` = 건너뜀.

## 원장

| 메서드 | 경로 | 행위자 | 비용 | 방 | 건너뛴 사유 |
|---|---|---|---|---|---|
| `DELETE` | `/api/tour-rooms/[bookingId]/location` | guest | free | 1 |  |
| `DELETE` | `/api/tour-rooms/[bookingId]/messages/[messageId]` | guest | free | 2 |  |
| `GET` | `/api/tour-mode/booking/[id]/content` | guest | free | 3 |  |
| `GET` | `/api/tour-mode/bookings` | public | free | 4 |  |
| `GET` | `/api/tour-mode/driver/overview` | driver | free | 5 |  |
| `GET` | `/api/tour-mode/guide/overview` | guide | free | 6 |  |
| `GET` | `/api/tour-mode/room/[bookingId]/snapshot` | guest | free | 7 |  |
| `GET` | `/api/tour-rooms/[bookingId]/arrival-bundle` | guide | free | 8 |  |
| `GET` | `/api/tour-rooms/[bookingId]/companion-invite` | guest | free | 9 |  |
| `GET` | `/api/tour-rooms/[bookingId]/day-summary` | guide | free | 10 |  |
| `GET` | `/api/tour-rooms/[bookingId]/dietary` | guest | free | 11 |  |
| `GET` | `/api/tour-rooms/[bookingId]/events` | guest | free | 12 |  |
| `GET` | `/api/tour-rooms/[bookingId]/extras` | guest | free | 13 |  |
| `GET` | `/api/tour-rooms/[bookingId]/media` | guest | free | 14 |  |
| `GET` | `/api/tour-rooms/[bookingId]/messages` | guest | free | 15 |  |
| `GET` | `/api/tour-rooms/[bookingId]/my-seat` | guest | free | 16 |  |
| `GET` | `/api/tour-rooms/[bookingId]/plan` | guest | free | 17 |  |
| `GET` | `/api/tour-rooms/[bookingId]/plan/templates` | guest | free | 18 |  |
| `GET` | `/api/tour-rooms/[bookingId]/reactions` | guest | free | 19 |  |
| `GET` | `/api/tour-rooms/[bookingId]/region-scripts` | guest | free | 20 |  |
| `GET` | `/api/tour-rooms/[bookingId]/tour-itinerary` | guest | free | 1 |  |
| `GET` | `/api/tour-rooms/[bookingId]/tts` | guest | llm | 2 |  |
| `GET` | `/api/tour-rooms/[bookingId]/vehicle-eta` | guest | free | 3 |  |
| `GET` | `/api/tour-rooms/[bookingId]/vehicle-photo` | guest | free | 4 |  |
| `PATCH` | `/api/tour-rooms/[bookingId]/extras` | guide | free | 5 |  |
| `POST` | `/api/tour-mode/driver/link` | guide | free | 6 |  |
| `POST` | `/api/tour-rooms/[bookingId]/approach` | guest | free | 7 |  |
| `POST` | `/api/tour-rooms/[bookingId]/arrival-bundle` | guide | llm | 8 |  |
| `POST` | `/api/tour-rooms/[bookingId]/captions` | guide | llm | 9 |  |
| `POST` | `/api/tour-rooms/[bookingId]/companion-invite` | guest | free | 10 |  |
| `POST` | `/api/tour-rooms/[bookingId]/companion-invite/redeem` | guest | free | 11 |  |
| `POST` | `/api/tour-rooms/[bookingId]/concierge` | guest | llm | 12 |  |
| `POST` | `/api/tour-rooms/[bookingId]/dining` | guest | llm | 13 |  |
| `POST` | `/api/tour-rooms/[bookingId]/dining/feedback` | guest | free | 14 |  |
| `POST` | `/api/tour-rooms/[bookingId]/driver-signal` | driver | free | 15 |  |
| `POST` | `/api/tour-rooms/[bookingId]/extend` | guest | free | 16 |  |
| `POST` | `/api/tour-rooms/[bookingId]/extras` | guide | free | 17 |  |
| `POST` | `/api/tour-rooms/[bookingId]/join` | guest | free | 전부 |  |
| `POST` | `/api/tour-rooms/[bookingId]/location` | guest | free | 18 |  |
| `POST` | `/api/tour-rooms/[bookingId]/manual-arrival` | guide | llm | 19 |  |
| `POST` | `/api/tour-rooms/[bookingId]/meeting-photo` | driver | free | 20 |  |
| `POST` | `/api/tour-rooms/[bookingId]/messages` | guest | llm | 1 |  |
| `POST` | `/api/tour-rooms/[bookingId]/messages/[messageId]/retranslate` | guest | llm | 2 |  |
| `POST` | `/api/tour-rooms/[bookingId]/morning-briefing` | guide | llm | 3 |  |
| `POST` | `/api/tour-rooms/[bookingId]/plan/claim-lead` | guest | free | 4 |  |
| `POST` | `/api/tour-rooms/[bookingId]/push-subscribe` | guest | free | 5 |  |
| `POST` | `/api/tour-rooms/[bookingId]/reactions` | guest | free | 6 |  |
| `POST` | `/api/tour-rooms/[bookingId]/read` | guest | free | 7 |  |
| `POST` | `/api/tour-rooms/[bookingId]/reinvite` | guide | free | 8 |  |
| `POST` | `/api/tour-rooms/[bookingId]/signals` | guest | free | 9 |  |
| `POST` | `/api/tour-rooms/[bookingId]/sos` | guest | people | — | SKIPPED BY DESIGN — rings a real on-call human (admin email + ops push). Run it only while the owner is watching. |
| `POST` | `/api/tour-rooms/[bookingId]/spot-events` | guest | free | 10 |  |
| `POST` | `/api/tour-rooms/[bookingId]/stt` | guest | llm | 11 |  |
| `POST` | `/api/tour-rooms/[bookingId]/timeline-coupon` | guest | free | 12 |  |
| `POST` | `/api/tour-rooms/[bookingId]/typing` | guest | free | 13 |  |
| `POST` | `/api/tour-rooms/[bookingId]/vision-ask` | guest | llm | 14 |  |
| `POST` | `/api/tour-rooms/broadcast` | guide | llm | 15 |  |
| `PUT` | `/api/tour-rooms/[bookingId]/dietary` | guest | free | 16 |  |
| `PUT` | `/api/tour-rooms/[bookingId]/plan` | guest | free | 17 |  |

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
