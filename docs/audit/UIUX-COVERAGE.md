# UIUX-COVERAGE — 스마트앱 UI/UX 커버리지 (U1 생성물)

> 🔴 **생성물이다. 손으로 고치지 마라.** 소유자: `scripts/gen-uiux-coverage.mjs`.
> 재생성: `node scripts/gen-uiux-coverage.mjs` · 검증: `node scripts/gen-uiux-coverage.mjs --check`
> 플랜: `docs/smartapp-uiux-audit-master-plan-2026-08-03.md` §5 U1

## 0. 이 문서가 퍼센트를 안 쓰는 이유

조합 공간은 표면·상태당 **5,000** 이다(locale 10 × skin 10 × textScale 5 × rallyStage 5 × theme 2).
전수는 아무도 감당 못 한다. 그래서 이 문서는 비율이 아니라 **"각 축의 위험단이 그물 안에 있는가"** 를 본다.

## 1. 축별 커버리지

### locale — 그물 안 4 / 전체 10

- **정본:** `lib/tour-room/snapshot.ts ROOM_LOCALES`
- **그물 안:** `en` · `ko` · `de` · `ru`
- **그물 밖:** `zh` · `zh-TW` · `ja` · `es` · `fr` · `it`
- **위험단:** 가장 긴 불가분 토큰을 가진 로케일이 위험단. `npm run locale:fit` 이 판정한다.

### skin — 그물 안 3 / 전체 10

- **정본:** `hooks/useTourRoomSettings.ts TOUR_SKINS`
- **그물 안:** `classic` · `jeju` · `contrast`
- **그물 밖:** `sky` · `winter` · `forest` · `meadow` · `seoul` · `busan` · `blossom`
- **위험단:** `contrast` 가 대비 극단, 어두운 계열(`forest`·`busan`)이 다크와 겹칠 때 위험단.

### textScale — 그물 안 2 / 전체 5

- **정본:** `hooks/useTourRoomSettings.ts TEXT_SCALE_STEPS`
- **그물 안:** `3` · `5`
- **그물 밖:** `1` · `2` · `4`
- **위험단:** 5 가 노안 최대. 레이아웃 붕괴는 여기서만 보인다.

### rallyStage — 그물 안 0 / 전체 5

- **정본:** `lib/tour-room/notices.ts RallyStage`
- **그물 안:** **없음**
- **그물 밖:** `set` · `remind` · `due` · `overdue` · `contact`
- **위험단:** `overdue`·`contact` 가 공지 배너를 전면 점유한다 — 다른 카드를 덮는 유일한 상태.

### theme — 그물 안 2 / 전체 2

- **정본:** `고정 — .dark 캐스케이드`
- **그물 안:** `light` · `dark`
- **그물 밖:** 없음 ✅
- **위험단:** dark × 밝은 스킨이 캐스케이드 누수 지점.

## 2. 표면 × 하니스

실렌더(playwright) 하니스만 센다. 정적 분석 스크립트는 레이아웃을 볼 수 없다.
출처 표기: **[선언]** = 하니스의 `COVERS` · **[리터럴]** = 소스의 URL 문자열

| 표면 | 방문하는 하니스 |
|---|---|
| `/tour-mode` | `qa-bundle-baseline.mjs`[리터럴] · `qa-chrome-overlap.mjs`[리터럴] · `qa-driver-walk.ts`[리터럴] · `qa-ios-smoke.ts`[리터럴] · `qa-perf-throttled.mjs`[리터럴] · `qa-planner-walk.mjs`[리터럴] |
| `/tour-mode/checkin/[token]` | `qa-chrome-overlap.mjs`[리터럴] |
| `/tour-mode/companion/[token]` | 🔴 **없음** |
| `/tour-mode/driver` | `qa-chrome-overlap.mjs`[리터럴] · `qa-driver-walk.ts`[리터럴] · `qa-ios-smoke.ts`[리터럴] |
| `/tour-mode/guide` | `qa-bundle-baseline.mjs`[리터럴] · `qa-cockpit-walk.mjs`[선언] · `qa-hero-grid.mjs`[선언] · `qa-ios-smoke.ts`[리터럴] · `qa-perf-throttled.mjs`[리터럴] · `qa-smartapp-walk.mjs`[선언] · `qa-uiux-flow.mjs`[선언] · `qa-uiux-render.mjs`[선언] |
| `/tour-mode/join/[roomToken]` | 🔴 **없음** |
| `/tour-mode/plan` | `qa-bundle-baseline.mjs`[리터럴] · `qa-chrome-overlap.mjs`[리터럴] · `qa-ios-smoke.ts`[리터럴] · `qa-perf-throttled.mjs`[리터럴] · `qa-planner-walk.mjs`[리터럴] |
| `/tour-mode/plan/[bookingId]` | `qa-bundle-baseline.mjs`[리터럴] · `qa-chrome-overlap.mjs`[리터럴] · `qa-ios-smoke.ts`[리터럴] · `qa-perf-throttled.mjs`[리터럴] · `qa-planner-walk.mjs`[리터럴] · `qa-uiux-render.mjs`[선언] |
| `/tour-mode/room/[bookingId]` | `qa-bundle-baseline.mjs`[리터럴] · `qa-hero-grid.mjs`[선언] · `qa-ios-smoke.ts`[리터럴] · `qa-perf-throttled.mjs`[리터럴] · `qa-smartapp-walk.mjs`[선언] · `qa-uiux-flow.mjs`[선언] · `qa-uiux-render.mjs`[선언] |

**실렌더 하니스가 한 번도 방문하지 않는 표면: 2개** — `/tour-mode/companion/[token]` · `/tour-mode/join/[roomToken]`

**판정 불가 — 선언도 리터럴도 없는 실렌더 하니스: 21개** — `qa-admin-cjk.ts` · `qa-chat-bubble-fit.mjs` · `qa-cjk-mechanism.mjs` · `qa-cjk-narrow-cell.mjs` · `qa-cjk-render.mjs` · `qa-cockpit-tray.ts` · `qa-door-fixes-walk.mjs` · `qa-guest-tray.ts` · `qa-home-walk.mjs` · `qa-midnight-meeting.ts` · `qa-ops-walk.mjs` · `qa-overlay-photo-probe.mjs` · `qa-perf-dining.mjs` · `qa-perf-idle.mjs` · `qa-perf-interactions.mjs` · `qa-perf-payload.mjs` · `qa-perf-routes.mjs` · `qa-recovery-p4.ts` · `qa-seat-door-walk.mjs` · `qa-sse-reconnect.ts` · `qa-tick-discipline.mjs`

> 판정 불가는 "커버 안 됨"이 **아니다.** 런타임 URL·환경변수로 이동해서 소스가 볼 수 없다는 뜻이고,
> 어느 쪽으로든 추측하면 게이트가 거짓말을 한다. 해소하려면 그 하니스에 `COVERS` 를 선언한다.

## 3. 하니스가 선언한 축

### `scripts/qa-hero-grid.mjs`

- `LOCALES` (locale): `ko` · `en` · `de` · `ru`
- `SCHEMES` (theme): `light` · `dark`
- `SKINS` (skin): `classic` · `contrast` · `jeju`
- `SCALES` (textScale): `3` · `5`

