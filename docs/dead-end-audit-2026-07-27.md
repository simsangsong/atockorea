# 진입점 없는 기능 전수 감사 (2026-07-27)

> 사장님 지시: "다 읽어 코드는 완성됐는데 진입점이 없는 기능들 전부 찾아내"

## 왜 이 감사가 필요했나

2026-07-27 하루에 사장님이 보고한 결함 세 건이 **전부 같은 병**이었다.

| 보고 | 코드 상태 | 실제 문제 |
|---|---|---|
| 스마트 가이드 사진 질문이 없다 | `vision-ask` 라우트 + 10로케일 응답 완비 | 컴포저에만 붙어 있고 스마트 가이드 시트엔 버튼이 없었다 |
| 노쇼 증거 남기기 버튼이 없다 | 사진+GPS+시각 강제 플로우 완비, 테스트 통과 | **좌석**에만 매달려 있었고 관제는 좌석을 배정한 적이 없다 |
| 가이드 일비 정하는 곳이 없다 | 단가표·해석기·정산 체인 완비 | 화면 이름이 "단가"라 사장님 어휘로 찾을 수 없었다 |

셋 다 테스트는 green이었다. 즉 **테스트로는 절대 안 잡히는 결함군**이다. 화면 워크로도
안 잡힌다 — 워크는 "열 수 있는 것"만 열어보므로 열 수 없는 것은 애초에 방문하지 않는다.

그래서 소스에서 역으로 판정했다.

## 방법 (재현 가능)

TypeScript 컴파일러 API로 프로그램 전체(2,096 소스 파일)를 올려 놓고 다섯 개의 탐지기를 돌렸다.

| 탐지기 | 무엇을 찾나 |
|---|---|
| **D1** | `app/` 진입점에서 import를 따라가도 도달하지 않는 파일 |
| **D2** | 어떤 프로덕션 코드도 부르지 않는 API 라우트 (253개 중) |
| **D3** | 선언은 있는데 어떤 호출부도 안 넘기는 옵셔널 prop (핸들러 미전달 = 버튼 부재) |
| **D4** | 어디서도 링크되지 않는 페이지 |
| **D10** | `lib/`·`hooks/`의 export 중 **자기 파일 안에서조차** 아무도 안 부르는 것 |

### 탐지기를 믿기 전에 고친 오탐 3종

1. `.next/types/**`의 Next.js 자동 생성 파일이 모든 라우트 경로를 언급해서 **253개 전부**
   "호출자 있음"으로 위장했다. → 제외.
2. D10 초판은 `aggregateWorkedAssignments`·`buildSimplifiedStatementAoa` 같은 **정산·세무
   핵심 함수**를 "소비처 0"으로 신고했다. 실제로는 같은 파일의 상위 함수가 부르고 있었다.
   → 자기 파일 참조를 세도록 수정. **어제 드린 정산 체인 설명은 그대로 유효하다.**
3. 워크트리 경로에 `.claude`가 들어 있어 스킵 규칙이 전 파일을 걸렀다(파일 0개인데 "이상 없음"
   으로 보였다). → 상대경로로 판정.

## TIER 1 — 실운영 기능인데 손이 닿지 않는다

### DE1. 조인투어 일괄 초대 링크 (가장 큼)

**만들어져 있는 것**

- `POST /api/admin/tour-ops/rooms/[roomId]/claim-link` — QR까지 생성, 만료=투어일+1,
  원장 `tour_room_invites role='room_claim'`
- `/tour-mode/join/[roomToken]` 페이지 + `components/tour-mode/join/JoinFlow.tsx` **568줄**
- `POST /api/ops/rooms/[roomId]/claim` — 손님이 명단에서 본인을 고르는 순간 개인 토큰 발급
- `lib/ops/seating/claimToken.ts` — 서명·검증

**없는 것:** 발급 버튼. 관제 UI 두 곳(`OpsManifestView`, `OpsRoomManager`)은 전부
`/api/admin/tour-ops/links`만 부르는데, 그건 **예약 1건당** customer/guide/driver 토큰이다.

**라이브 증거:** `tour_room_invites` 57건 중 `role='room_claim'` **0건**. 한 번도 발급된 적이 없다.

**운영상 의미:** 조인투어 20명이면 링크를 20번 따로 발급해서 20번 보내야 한다.
버스 한 대에 링크 하나 뿌리고 손님이 명단에서 자기를 고르게 하는 설계(§5.1 링크 2계층)가
1층째 통째로 잠겨 있다.

### DE2. 완성된 관리자 화면 3개가 사이드바에도 없고 아무 데서도 링크되지 않는다

URL을 직접 쳐야만 열린다. 어드민 페이지 49개 중 3개.

| 화면 | 줄 수 | 못 열면 생기는 일 |
|---|---|---|
| `/admin/poi-videos` | 232 | **POI 동영상 검수 큐.** 승인해야만 도착 카드에 영상이 나간다. 즉 `video:upload`로 올린 렌더는 영원히 `pending_review`로 남는다 |
| `/admin/tour-mode-spots` | 313 | **투어모드 지오펜스 스팟 좌표 편집기.** "파일럿 스팟 좌표 검수"는 런칭 사람 게이트로 적혀 있는데 그 검수를 할 화면이 잠겨 있었다 |
| `/admin/support` | 205 | 에스컬레이션된 문의 티켓 목록 |

`/admin/qa-review`, `/admin/ops-finance/{filings,periods}`, `/admin/analytics/product/*`는
사이드바엔 없지만 부모 화면에서 링크되므로 도달 가능 — 오탐이 아니라 정상.

### DE3. 손님 화면의 차량 안내 줄이 아무도 쓰지 않는 테이블을 읽는다

`tour_bus_details`를 **읽는** 곳 4개:
`HomeTab` 차량 라인 · `LobbyCard` · `lib/tour-room/snapshot.ts` · `lib/tour-room/driver.ts`(PIN 폴백)

**쓰는** 곳은 `POST /api/admin/tours/[id]/bus-detail` 하나뿐이고 **어떤 UI도 이걸 부르지 않는다.**

`lib/tour-room/driver.ts:11` 주석이 이미 말하고 있다 — *"`tour_bus_details` is the old sheet"*,
살아 있는 소스는 `ops_room_vehicles`.

**결과:** 관제에서 새 방식으로 배차해도 손님 홈의 차량 줄은 계속 비어 있다.
(라이브 `tour_bus_details` 2행은 옛날에 손으로 넣은 것, `ops_room_vehicles`는 1행.)

## TIER 2 — 로직만 있고 아무도 부르지 않는다

전부 테스트는 통과한다. 화면에 붙일지는 **결정 사항**이라 여기 목록으로만 남긴다.

| 함수 | 파일 | 원래 용도(주석 기준) |
|---|---|---|
| `suggestPartySeats` | `lib/ops/seating/logic.ts` | 일행 연속좌석 자동 제안 (좌석 배정 자체가 0건이라 후순위) |
| `toggleCardId` · `moveCardId` | `lib/ops/seating/cards/cardSet.ts` | 브리핑 카드 세트 순서/on-off 편집 |
| `sameTourGroup` · `loadGroupRooms` | `lib/ops/seating/group.ts` | 다차량 조인투어 그룹 |
| `unknownTokens` | `lib/ops/messaging/template.ts` | 주석: *"템플릿 편집 화면이 '이건 안 채워집니다'라고 말할 수 있어야 한다"* — 그 경고가 없다 |
| `getLearningHealth` | `lib/ops/parse/health.ts` | 주석: *"the admin surface treats null as..."* — 그 admin surface가 없다 |
| `pendingReclaims` | `lib/ops/reclaim.ts` | 재등록 대기만 거르기 |
| `rankTier0Candidates` · `potentialCallsSaved` | `lib/ops/ai/tier0Coverage.ts` | Tier0 커버리지 개선 제안(=AI 호출 절감) |
| `hasTimelineContent` | `lib/tour-room/timeline.ts` | 타임라인 비었을 때 진입 숨기기 |
| `resolveTourKind` | `lib/tour-room/tourKind.ts` | price_type 우선 프라이빗/조인 판정 |
| `targetMany` | `lib/tour-room/messageTarget.ts` | 다중 대상 메시지 |
| `buildWhatsAppMessage` | `lib/ops/whatsapp/wa-deep-link.ts` | |
| `servingHours` · `exclusionReasons` | `lib/ops/dining/*` | |

### 기능 누락이 아니라 중복인 것 (정리 대상)

- `courseToStopSeeds` (`lib/tour-room/courseOptions.ts`) — **P0에서 내가 만들고 안 붙였다.**
  클라이언트가 좌표·이름까지 필요해 `applyCourseOption`에 다시 짰다. 순수 중복 → 삭제.
- `assignedCountsFor` (`lib/ops/tax/assignments.ts`) — 같은 로직이 `recommend` 라우트와
  `recommendGuides`에 각각 인라인돼 있다. 기능은 살아 있다.

## TIER 3 — 옛 마켓플레이스 계층의 잔해

프로덕션 호출자 0. 지금 사업 모델(투어 운영)과 무관하므로 **UI를 붙이면 안 된다.**
남겨둘지 지울지는 별도 결정.

`/api/settlements` · `/api/inventory`(+`[id]`) · `/api/notifications`(+`[id]`) ·
`/api/reviews/reactions` · `/api/reviews/reports`(+`[id]`) · `/api/user-settings` ·
`/api/cms/content` · `/api/admin/email-diag` · `/api/auth/{confirm-email,
delete-user-without-profile,send-verification-code,verify-code}` ·
`/api/admin/merchants/create` · `/api/admin/tours/[id]/bus-detail`(DE3) ·
`/api/tour-mode/driver/link`(→ `tour-ops/links`가 driver role까지 대체함)

## 오탐 — 진입점이 없는 게 아니라 호출자가 밖에 있는 것

- **크론 9개** (`vercel.json` 등록): reminders · recapture-holds · capture-tour-day-payments ·
  analytics-refresh-views · analytics-anonymize · rag-reindex · rag-harvest ·
  tour-room-flywheel · ops-daily-report
- **웹훅 2개**: `/api/stripe/webhook` · `/api/telegram/support-webhook`
- `lib/audit/*` = jest 게이트가 소비 · `__reset*ForTests` = 테스트 훅 ·
  `lib/ops/dining/seed.ts` · `lib/video-automation/batch.ts` = npm 스크립트가 소비

## 재발 방지

이 감사의 교훈은 "세 개를 고쳤다"가 아니라 **"이 결함군은 테스트도 워크도 못 잡는다"**이다.
그래서 소스 유래 게이트를 상설로 둔다.

- `__tests__/audit/adminPageReachability.test.ts` — 새 `/admin` 페이지가 사이드바에도 없고
  어디서도 링크되지 않으면 CI 실패. DE2를 숨긴 실패 모드 그 자체를 막는다.

## 실행 로그

| 티켓 | 상태 |
|---|---|
| DE2 사이드바 3개 등재 + 상설 게이트 | ✅ |
| DE1 조인투어 일괄 초대 발급 | ✅ |
| DE3 차량 줄을 살아 있는 배차로 | ✅ |
| DE4 `courseToStopSeeds` 중복 제거 | ✅ |
| TIER 2 12건 | 결정 대기 (사장님 우선순위) |
| TIER 3 잔해 정리 | 결정 대기 |
