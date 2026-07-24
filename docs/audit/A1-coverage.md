# A1-coverage — 손님 앱 커버리지 원장 (A1.0)

**생성일:** 2026-07-25 · **대상:** `components/tour-mode/**/*.{ts,tsx}` (테스트 제외)
**총 75개** · 회귀: `__tests__/audit/a1Coverage.test.ts`
**진행:** A1.1~A1.5 완료(37/75) · 산출물 `A1-1-chat-core.md` · `A1-2-cards.md` · `A1-3-concierge.md` · `A1-4-map-location.md` · `A1-5-planner.md`

> 🔴 **이 표가 A1의 완료 판정이다.** `판정` 칸이 비어 있는 행이 하나라도 있으면 A1은 미완이다.
> 파일이 새로 생겼는데 행이 없으면 **테스트가 실패한다** — 원장이 낡는 것을 문서 규율이 아니라
> 테스트로 막는다.

## 왜 원장이 필요했나

A-plan-review R6: A1은 "하나도 빠짐없이 소진"이라고 적혀 있었지만 실제로 호명된 컴포넌트는
**62개 중 34개**였다. 28개가 어느 티켓에도 속하지 않은 채 "전수"로 불리고 있었다.
이름 나열은 소진을 보증하지 못한다 — 나열에서 빠지면 조용히 사라진다.

## 판정 표기

| 표기 | 뜻 |
|---|---|
| ⬜ | 미감사 |
| ✅ | 확인했고 문제없음 |
| P0~P3 | finding 있음 (심각도) |

## A1.1 — 채팅 코어 (6개)

| 파일 | 티켓 | 판정 |
|---|---|---|
| `Avatar.tsx` | A1.1 | P1 · P3 → `A1-1-chat-core.md` |
| `ChatFeed.tsx` | A1.1 | P2 → `A1-1-chat-core.md` |
| `Composer.tsx` | A1.1 | P2 → `A1-1-chat-core.md` |
| `ConfirmSheet.tsx` | A1.1 | ✅ |
| `Lightbox.tsx` | A1.1 | P2 ×2 → `A1-1-chat-core.md` |
| `ReplyPreview.tsx` | A1.1 | P2 → `A1-1-chat-core.md` |

## A1.2 — 카드 계열 (18개)

| 파일 | 티켓 | 판정 |
|---|---|---|
| `ApproachCard.tsx` | A1.2 | ✅ |
| `ArrivalBundleCard.tsx` | A1.2 | ✅ |
| `ArrivalVideoCard.tsx` | A1.2 | ✅ (실영상 미검증) |
| `BriefingEtiquetteCard.tsx` | A1.2 | ✅ |
| `BriefingLunchCard.tsx` | A1.2 | ✅ |
| `BriefingSafetyCard.tsx` | A1.2 | ✅ (실영상 미검증) |
| `BriefingScheduleCard.tsx` | A1.2 | ✅ |
| `CompanionInviteCard.tsx` | A1.2 | ✅ |
| `DepartureCountdown.tsx` | A1.2 | ✅ 모범 |
| `DiningCard.tsx` | A1.2 | ✅ 🔴배제우선 정확 |
| `EmergencyCard.tsx` | A1.2 | ✅ |
| `ExtraLedgerCard.tsx` | A1.2 | ✅ |
| `FacilityMapCard.tsx` | A1.2 | ✅ |
| `NoticeBanner.tsx` | A1.2 | P2 → `A1-2-cards.md` |
| `OfflineInfoCard.tsx` | A1.2 | P1 **수정완료** → `A1-2-cards.md` |
| `SafetyVideoCard.tsx` | A1.2 | ✅ (실영상 미검증) |
| `SecondaryCardBanner.tsx` | A1.2 | ✅ |
| `SpotArrivalCard.tsx` | A1.2 | ✅ |

## A1.3 — 컨시어지 (4개)

| 파일 | 티켓 | 판정 |
|---|---|---|
| `ConciergeEntryRow.tsx` | A1.3 | ✅ |
| `ConciergeInlineAnswer.tsx` | A1.3 | ✅ |
| `ConciergePanel.tsx` | A1.3 | P2 → `A1-3-concierge.md` |
| `Sheet.tsx` | A1.3 | ✅ 🔴모범 (Lightbox 대조군) |

## A1.4 — 지도·위치 (6개)

| 파일 | 티켓 | 판정 |
|---|---|---|
| `LocationPreview.tsx` | A1.4 | ✅ |
| `map/FindGuideCard.tsx` | A1.4 | P1 → `A1-4-map-location.md` (수정 완료) |
| `map/LocationShareCard.tsx` | A1.4 | ✅ |
| `map/RoomMapCanvas.tsx` | A1.4 | ✅ |
| `map/RoomMapTab.tsx` | A1.4 | P1 → `A1-4-map-location.md` (수정 완료) |
| `map/VehicleLocationCard.tsx` | A1.4 | ✅ |

## A1.5 — 플래너 (3개)

| 파일 | 티켓 | 판정 |
|---|---|---|
| `plan/PlanEditorClient.tsx` | A1.5 | P1 · P2 → `A1-5-planner.md` (수정 완료) |
| `plan/PlanStopCards.tsx` | A1.5 | P2 → `A1-5-planner.md` (수정 완료) |
| `plan/PlanTourItinerary.tsx` | A1.5 | ✅ |

## A1.6 — 진입·설정·기타 (25개)

| 파일 | 티켓 | 판정 |
|---|---|---|
| `AppManual.tsx` | A1.6 | ⬜ |
| `AudioButton.tsx` | A1.6 | ⬜ |
| `CaptionBanner.tsx` | A1.6 | ⬜ |
| `EndedCard.tsx` | A1.6 | ⬜ |
| `GuideCaptionBar.tsx` | A1.6 | ⬜ |
| `HomeTab.tsx` | A1.6 | ⬜ |
| `InstallBanner.tsx` | A1.6 | ⬜ |
| `LobbyCard.tsx` | A1.6 | ⬜ |
| `MicPrime.tsx` | A1.6 | ⬜ |
| `PickupBoard.tsx` | A1.6 | ⬜ |
| `PlanNudgeModal.tsx` | A1.6 | ⬜ |
| `PresenceBar.tsx` | A1.6 | ⬜ |
| `PushOptInBanner.tsx` | A1.6 | ⬜ |
| `QuickSignalBar.tsx` | A1.6 | ⬜ |
| `RoomShell.tsx` | A1.6 | ⬜ |
| `SettingsTab.tsx` | A1.6 | ⬜ |
| `SosButton.tsx` | A1.6 | ⬜ |
| `TourModeComingSoon.tsx` | A1.6 | ⬜ |
| `TourModeEntry.tsx` | A1.6 | ⬜ |
| `TourRoomClient.tsx` | A1.6 | ⬜ |
| `TravelTimeline.tsx` | A1.6 | ⬜ |
| `WebviewEscapeBanner.tsx` | A1.6 | ⬜ |
| `entryCopy.ts` | A1.6 | ⬜ |
| `icons.ts` | A1.6 | ⬜ |
| `useKeyboardOpen.ts` | A1.6 | ⬜ |

## A1.8 — 진입 플로우 (claim·동행자·체크인) — **신설** (3개)

| 파일 | 티켓 | 판정 |
|---|---|---|
| `checkin/CheckinLanding.tsx` | A1.8 | ⬜ |
| `companion/CompanionJoin.tsx` | A1.8 | ⬜ |
| `join/JoinFlow.tsx` | A1.8 | ⬜ |

## A2.1 — 가이드 콘솔 — A1 범위 밖 (7개)

| 파일 | 티켓 | 판정 |
|---|---|---|
| `guide/GuideConsole.tsx` | A2.1 | ⬜ |
| `guide/GuideGuestCard.tsx` | A2.1 | ⬜ |
| `guide/GuideLedgerPanel.tsx` | A2.1 | ⬜ |
| `guide/GuidePlanPanel.tsx` | A2.1 | ⬜ |
| `guide/GuideSeatDashboard.tsx` | A2.1 | ⬜ |
| `guide/GuideSeatStrip.tsx` | A2.1 | ⬜ |
| `guide/OperatorAssist.tsx` | A2.1 | ⬜ |

## A2.2 — 기사 콕핏 — A1 범위 밖 (3개)

| 파일 | 티켓 | 판정 |
|---|---|---|
| `cockpit/Cockpit.tsx` | A2.2 | ⬜ |
| `cockpit/TimeWheel.tsx` | A2.2 | ⬜ |
| `driver/DriverConsole.tsx` | A2.2 | ⬜ |

---

## 합계

| 티켓 | 개수 |
|---|---|
| A1.1 | 6 |
| A1.2 | 18 |
| A1.3 | 4 |
| A1.4 | 6 |
| A1.5 | 3 |
| A1.6 | 25 |
| A1.8 | 3 |
| A2.1 | 7 |
| A2.2 | 3 |
| **합계** | **75** |

A1 소관 **65개** · A2 소관 10개(가이드·기사 면).

## 🔴 플랜 대비 조정

- **A1.8 신설.** claim(`join/`)·동행자(`companion/`)·QR 체크인(`checkin/`)은 손님이
  **룸에 들어오기 전** 만나는 화면인데 A1.1~A1.6 어디에도 자리가 없었다. B0.3(개인 링크)과
  B5(자동 체크인)가 바로 이 표면을 바꿨으므로 감사 대상에서 빠지면 안 된다.
- **가이드 7 + 기사 3은 A2로 넘긴다.** `components/tour-mode/` 아래 살지만 손님 앱이 아니다.
  원장에는 남겨 둔다 — 빠뜨린 것과 다른 웨이브 소관인 것은 구분되어야 한다.
