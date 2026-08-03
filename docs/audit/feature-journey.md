# feature-journey — 역할 × 여정 격자

> 🔴 **이 파일은 생성물이다.** 손으로 고치지 말 것 —
> `lib/audit/featureJourney.ts` 를 고치고 `npx tsx scripts/gen-feature-journey.ts` 를 돌린다.
> `__tests__/audit/featureJourney.test.ts` 가 소스와 어긋나면 실패한다.

커버리지("모든 라우트를 한 번씩 쳤다")와 완주("사람이 끝까지 갔다")는 다른 주장이고,
지금까지 이 레포는 앞의 것만 하고 있었다. 이 격자는 뒤의 것을 묻는다.
**빈 칸은 그 자체로 발견**이다 — 결함이라는 뜻은 아니지만, 누군가 적어 둔 결정이어야 한다.

## 격자 (엔드포인트 수)

| 역할 | 예약 직후 | D-1 전날 | 당일 아침 | 투어 중 | 종료 후 |
|---|---|---|---|---|---|
| **guest** | 5 | 10 | 2 | 24 | 1 |
| **guide** | **— 없음** | 1 | 2 | 7 | 1 |
| **driver** | **— 없음** | **— 없음** | 2 | 1 | **— 없음** |

## 빈 칸과 그 사유

### guide × 예약 직후

Assignment happens in the ops console, not the smart app. A guide has no endpoint here because they do not yet know the tour is theirs.

### driver × 예약 직후

Same as the guide, and more so: the driver is picked last and holds no link until the guide mints one.

### driver × D-1 전날

Covered by GET /api/tour-mode/driver/overview, which the grid files under morning because that is when it is mostly read. It scopes to the token's tourDate rather than today, so the same link answers the day before. The acknowledgement gap is closed too (F7): joining already wrote a driver row in tour_room_participants and /guide/overview already sent it — the guide console declared the field and never read it, so the answer arrived on every poll and was dropped. It now shows 기사 미확인 until the driver opens the link. Engine present, consumer absent; the consumer is here now.

### driver × 종료 후

Closed by found_item (feature audit F4), which rides driver-signal and so is filed under during. The driver taps it while cleaning the van; the route has no lifecycle gate, so it works after the tour, and it reaches both the guests and the ops desk that actually stores the item. Before that the guest could report a LOST item and the person holding it could not report a FOUND one — the signals route answers a driver 403 "Drivers use driver-signal", and driver-signal had no such type.

## 칸별 엔드포인트

**guest · 예약 직후** (5)

- `POST /api/tour-rooms/[bookingId]/join`
- `GET /api/tour-rooms/[bookingId]/companion-invite`
- `POST /api/tour-rooms/[bookingId]/companion-invite`
- `POST /api/tour-rooms/[bookingId]/companion-invite/redeem`
- `GET /api/tour-mode/room/[bookingId]/snapshot`

**guest · D-1 전날** (10)

- `GET /api/tour-rooms/[bookingId]/tour-itinerary`
- `GET /api/tour-rooms/[bookingId]/plan`
- `PUT /api/tour-rooms/[bookingId]/plan`
- `GET /api/tour-rooms/[bookingId]/plan/templates`
- `POST /api/tour-rooms/[bookingId]/plan/claim-lead`
- `GET /api/tour-rooms/[bookingId]/dietary`
- `PUT /api/tour-rooms/[bookingId]/dietary`
- `POST /api/tour-rooms/[bookingId]/push-subscribe`
- `GET /api/tour-rooms/[bookingId]/my-seat`
- `GET /api/tour-mode/booking/[id]/content`

**guest · 당일 아침** (2)

- `GET /api/tour-rooms/[bookingId]/vehicle-eta`
- `GET /api/tour-rooms/[bookingId]/vehicle-photo`

**guest · 투어 중** (24)

- `GET /api/tour-rooms/[bookingId]/messages`
- `POST /api/tour-rooms/[bookingId]/messages`
- `POST /api/tour-rooms/[bookingId]/messages/[messageId]/retranslate`
- `GET /api/tour-rooms/[bookingId]/reactions`
- `POST /api/tour-rooms/[bookingId]/reactions`
- `POST /api/tour-rooms/[bookingId]/read`
- `POST /api/tour-rooms/[bookingId]/typing`
- `GET /api/tour-rooms/[bookingId]/media`
- `GET /api/tour-rooms/[bookingId]/tts`
- `POST /api/tour-rooms/[bookingId]/stt`
- `GET /api/tour-rooms/[bookingId]/region-scripts`
- `POST /api/tour-rooms/[bookingId]/approach`
- `GET /api/tour-rooms/[bookingId]/events`
- `POST /api/tour-rooms/[bookingId]/spot-events`
- `POST /api/tour-rooms/[bookingId]/dining`
- `POST /api/tour-rooms/[bookingId]/dining/feedback`
- `GET /api/tour-rooms/[bookingId]/extras`
- `POST /api/tour-rooms/[bookingId]/extend`
- `POST /api/tour-rooms/[bookingId]/signals`
- `POST /api/tour-rooms/[bookingId]/location`
- `DELETE /api/tour-rooms/[bookingId]/location`
- `POST /api/tour-rooms/[bookingId]/concierge`
- `POST /api/tour-rooms/[bookingId]/vision-ask`
- `POST /api/tour-rooms/[bookingId]/sos`

**guest · 종료 후** (1)

- `POST /api/tour-rooms/[bookingId]/timeline-coupon`

**guide · D-1 전날** (1)

- `POST /api/tour-mode/driver/link`

**guide · 당일 아침** (2)

- `POST /api/tour-rooms/[bookingId]/morning-briefing`
- `GET /api/tour-mode/guide/overview`

**guide · 투어 중** (7)

- `POST /api/tour-rooms/[bookingId]/captions`
- `GET /api/tour-rooms/[bookingId]/arrival-bundle`
- `POST /api/tour-rooms/[bookingId]/arrival-bundle`
- `POST /api/tour-rooms/[bookingId]/manual-arrival`
- `POST /api/tour-rooms/[bookingId]/extras`
- `PATCH /api/tour-rooms/[bookingId]/extras`
- `POST /api/tour-rooms/broadcast`

**guide · 종료 후** (1)

- `GET /api/tour-rooms/[bookingId]/day-summary`

**driver · 당일 아침** (2)

- `POST /api/tour-rooms/[bookingId]/meeting-photo`
- `GET /api/tour-mode/driver/overview`

**driver · 투어 중** (1)

- `POST /api/tour-rooms/[bookingId]/driver-signal`
