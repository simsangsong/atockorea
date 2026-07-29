# A1-coverage — 손님 앱 커버리지 원장 (A1.0)

**생성일:** 2026-07-25 · **대상:** `components/tour-mode/**/*.{ts,tsx}` (테스트 제외)
**총 83개** · 회귀: `__tests__/audit/a1Coverage.test.ts`
**진행:** ✅ **83/83 전량 감사 완료** (A1 소관 65 + A2 운영자면 10 + P7 신규 2 + SG 신규 3). 산출물 `A1-1`~`A1-8` · `A2-1-2-operator-faces.md` · `A2-4-permission-matrix.md`

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
| `Avatar.tsx` | A1.1 | P1 **수정완료** · P3 → `A1-1-chat-core.md` |
| `ChatFeed.tsx` | A1.1 | P2 **수정완료** → `A1-1-chat-core.md` |
| `Composer.tsx` | A1.1 | P2 **수정완료** → `A1-1-chat-core.md` |
| `ConfirmSheet.tsx` | A1.1 | ✅ |
| `Lightbox.tsx` | A1.1 | P2 ×3 **전부 수정완료** → `A1-1-chat-core.md` |
| `ReplyPreview.tsx` | A1.1 | P2 **수정완료** → `A1-1-chat-core.md` |

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
| `NoticeBanner.tsx` | A1.2 | P2 **수정완료** → `A1-2-cards.md` |
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
| `ActionGrid.tsx` | A1.3 | ✅ 신설 (카톡식 접이 액션 트레이 — 기사 콘솔 12버튼 상시노출 대체) |

## A1.4 — 지도·위치 (6개)

| 파일 | 티켓 | 판정 |
|---|---|---|
| `LocationPreview.tsx` | A1.4 | ✅ |
| `NavBrandButton.tsx` | A1.4 | ✅ 신규(2026-07-28) — 지도 카드·콕핏 NavRow의 브랜드 딥링크 버튼. 전역 44px 최소치가 11px 라벨을 44×44 덩어리로 부풀리던 것을 시각/히트 분리로 해소, 브랜드 잉크를 색과 함께 고정 |
| `map/FindGuideCard.tsx` | A1.4 | P1 → `A1-4-map-location.md` (수정 완료) |
| `map/LocationShareCard.tsx` | A1.4 | ✅ |
| `map/RoomMapCanvas.tsx` | A1.4 | ✅ |
| `map/RoomMapTab.tsx` | A1.4 | P1 → `A1-4-map-location.md` (수정 완료) |
| `map/VehicleLocationCard.tsx` | A1.4 | ✅ |

## A1.5 — 플래너 (5개)

| 파일 | 티켓 | 판정 |
|---|---|---|
| `plan/PlanEditorClient.tsx` | A1.5 | P1 · P2 → `A1-5-planner.md` (수정 완료) · P7.7 로 3,750 → 2,491줄 |
| `plan/PlanStopCards.tsx` | A1.5 | P2 → `A1-5-planner.md` (수정 완료) |
| `plan/PlanTourItinerary.tsx` | A1.5 | ✅ |
| `plan/PoiThumb.tsx` | P7.1 | ✅ 신규 — 사진 후보 체인 + 스와치 폴백. 커버리지 8.9% → 60.5% (실측) |
| `plan/planCopy.ts` | P7.7 | ✅ 신규 — 10로케일 카피 테이블 분리(1,264줄). UI 없음, 문자열만 |

## A1.6 — 진입·설정·기타 (25개)

| 파일 | 티켓 | 판정 |
|---|---|---|
| `AppManual.tsx` | A1.6 | ✅ |
| `AudioButton.tsx` | A1.6 | P3 → `A1-6-entry-shell-misc.md` |
| `CaptionBanner.tsx` | A1.6 | ✅ |
| `EndedCard.tsx` | A1.6 | P2 → `A1-6-entry-shell-misc.md` (수정 완료) |
| `GuideCaptionBar.tsx` | A1.6 | ✅ |
| `HomeTab.tsx` | A1.6 | P3 → `A1-6-entry-shell-misc.md` |
| `InstallBanner.tsx` | A1.6 | ✅ |
| `LobbyCard.tsx` | A1.6 | ✅ |
| `MicPrime.tsx` | A1.6 | ✅ |
| `PickupBoard.tsx` | A1.6 | ✅ |
| `PlanNudgeModal.tsx` | A1.6 | ✅ |
| `PresenceBar.tsx` | A1.6 | ✅ |
| `PushOptInBanner.tsx` | A1.6 | P2 → `A1-6-entry-shell-misc.md` (수정 완료) |
| `QuickSignalBar.tsx` | A1.6 | P1 · P2 → `A1-6-entry-shell-misc.md` (수정 완료) |
| `RoomShell.tsx` | A1.6 | P3 → `A1-6-entry-shell-misc.md` |
| `SettingsTab.tsx` | A1.6 | ✅ |
| `SosButton.tsx` | A1.6 | P1 → `A1-6-entry-shell-misc.md` (수정 완료) |
| `TourModeComingSoon.tsx` | A1.6 | ✅ |
| `NowCard.tsx` | A1.6 | ✅ (I2에서 신설 — 홈 히어로. 상태·톤은 리졸버가, 문구는 `nowCardCopy` 10로케일이 갖는다) |
| `NumeralClock.tsx` | SG-0b | ✅ (SG-0b에서 신설 — 유일한 틱 시계. 적응 틱·visible 한정·SSR 결정론·aria-hidden, `numeralClock.test.tsx`) |
| `roomClock.tsx` | SG-0c | ✅ (SG-0c에서 신설 — 스냅샷 server_now_ms 1회 앵커 오프셋 컨텍스트, `roomClock.test.tsx`) |
| `WaitEndedCard.tsx` | SG-2b | ✅ (SG-2b에서 신설 — 낙오 캡슐. 사실 우선·한국어 목적지 최대·무목적지 열화·탑승자 헤지, `waitEndedCard.test.tsx`) |
| `TourModeEntry.tsx` | A1.6 | P2 → `A1-6-entry-shell-misc.md` (수정 완료) |
| `TourRoomClient.tsx` | A1.6 | ✅ (lint은 A4.5) → `A1-6-entry-shell-misc.md` |
| `TravelTimeline.tsx` | A1.6 | ✅ |
| `WebviewEscapeBanner.tsx` | A1.6 | ✅ |
| `entryCopy.ts` | A1.6 | ✅ |
| `useEntryLocale.ts` | A1.6 | ✅ (N6에서 신설 — 첫 렌더를 서버가 정한 로케일로 고정하고 그 뒤에만 기기 로케일로 갱신) |
| `icons.ts` | A1.6 | ✅ |
| `useKeyboardOpen.ts` | A1.6 | ✅ |

## A1.8 — 진입 플로우 (claim·동행자·체크인) — **신설** (3개)

| 파일 | 티켓 | 판정 |
|---|---|---|
| `checkin/CheckinLanding.tsx` | A1.8 | P2 → `A1-8-entry-flows.md` (수정 완료) |
| `companion/CompanionJoin.tsx` | A1.8 | ✅ |
| `join/JoinFlow.tsx` | A1.8 | ✅ (P3 → `A1-8-entry-flows.md`) |

## A2.1 — 가이드 콘솔 — A1 범위 밖 (7개)

| 파일 | 티켓 | 판정 |
|---|---|---|
| `guide/GuideConsole.tsx` | A2.1 | ✅ → `A2-1-2-operator-faces.md` |
| `guide/GuideGuestCard.tsx` | A2.1 | ✅ → `A2-1-2-operator-faces.md` |
| `guide/GuideLedgerPanel.tsx` | A2.1 | ✅ → `A2-1-2-operator-faces.md` |
| `guide/GuidePlanPanel.tsx` | A2.1 | ✅ → `A2-1-2-operator-faces.md` |
| `guide/GuideSeatDashboard.tsx` | A2.1 | ✅ → `A2-1-2-operator-faces.md` |
| `guide/GuideSeatStrip.tsx` | A2.1 | ✅ → `A2-1-2-operator-faces.md` |
| `guide/OperatorAssist.tsx` | A2.1 | ✅ → `A2-1-2-operator-faces.md` |

## A2.2 — 기사 콕핏 — A1 범위 밖 (3개)

| 파일 | 티켓 | 판정 |
|---|---|---|
| `cockpit/Cockpit.tsx` | A2.2 | ✅ → `A2-1-2-operator-faces.md` |
| `cockpit/TimeWheel.tsx` | A2.2 | ✅ → `A2-1-2-operator-faces.md` |
| `driver/DriverConsole.tsx` | A2.2 | ✅ → `A2-1-2-operator-faces.md` |

---

## 합계

| 티켓 | 개수 |
|---|---|
| A1.1 | 6 |
| A1.2 | 18 |
| A1.3 | 4 |
| A1.4 | 6 |
| A1.5 | 5 |
| A1.6 | 25 |
| A1.8 | 3 |
| A2.1 | 7 |
| A2.2 | 3 |
| W2/W4 | 3 |
| **합계** | **80** |

A1 소관 **65개** · A2 소관 10개(가이드·기사 면) · W-트랙 신규 3개 · P7 신규 2개(`PoiThumb` · `planCopy`).

⚠ 섹션 헤더의 개수와 실제 행 수가 어긋난 곳이 있다(A1.3·A1.4는 이 트랙 이전부터). 판정은 표가 하고, 개수는 `a1Coverage` 테스트가 파일 목록으로 직접 센다.

## W-트랙 신규 (2026-07-27, 스마트앱 UI 프리미엄 업그레이드 — SoT `docs/smartapp-ui-premium-upgrade-master-plan-2026-07-26.md`)

태어날 때부터 테스트를 지참한 컴포넌트 — 감사가 아니라 출생신고다.

| 파일 | 티켓 | 판정 |
|---|---|---|
| `RoomDrawer.tsx` | W4 | ✅ 신규 — `roomDrawer.test.tsx` 5케이스(미디어 인증 헤더·숏컷·멤버·ESC) |
| `staff/StaffShell.tsx` | W2 | ✅ 신규 — `staffShell.test.tsx` 6케이스(4탭·뱃지·테마 스토어 추종·overlay 스코프) + C-D1 헤더 다이어트·C-D5 스킨 스탬프(`skinPicker.test.tsx`) |
| `staff/StaffSettings.tsx` | W2/W5 | ✅ 신규 — 테마 세그·글자크기·사용설명 아코디언(스토어는 기존 `useTourRoomSettings` 검증 경유) + C-D6 배경 테마 피커 |
| `staff/GuideAnnouncePanel.tsx` | 리뷰라운드(#488) | ✅ 신규 — `guideAnnouncePanel.test.tsx`(프리셋·수신자 wa.me/mailto·변수누락 배지) + walk `13-staff-announce` 실렌더 |
| `SkinPicker.tsx` | C-D6(chat-ui-theme 2026-07-27) | ✅ 신규 — `skinPicker.test.tsx` 5케이스(6스킨 렌더·persist·라벨 로케일·양 셸 스탬프) + walk 스킨 매트릭스 실렌더 |
| `InstallCard.tsx` | T-D2(PWA 설치, PR#495) | ✅ 신규 — 설치 진입점 카드(네이티브 프롬프트/iOS 공유시트 안내), `useInstallPrompt` 4표면 배선 |
| `scenery/SkinScenery.tsx` | T-D5(풍경 9씬, PR#495) | ✅ 신규 — 스킨별 SVG 풍경(시그니처 상단 스트립·다크=밤), 고대비 스킨은 렌더 없음 |
| `MeetSetCard.tsx` | M-D5(meet-exactly 2026-07-27) | ✅ 신규 — `meetExactly.test.tsx` 3케이스(시간 게이트·장소/핀 필수·meeting_propose 페이로드) · 프라이빗 전용은 서버 403 테스트가 짝 |
| `LanguageSelect.tsx` | R3v2(기기 리포트 2026-07-27) | ✅ 신규 — 앱/채팅 언어 공용 드롭다운(트리거=국기+현재값, 시트=radiogroup+체크). 칩 나열을 대체했고 9로케일·32언어를 같은 UI로 감당 |
| `chatlist/ChatListRow.tsx` | O4/U-D5(관제 디자인 통일 2026-07-27) | ✅ 신규 — 가이드 대화탭과 관제 룸 모니터링이 **같은 행 컴포넌트**를 쓴다(두 벌이 각각 자라던 것을 추출). `chatListRow.test.tsx` 4케이스: 가이드형(링크·도트·⋯가 탭영역 밖) / 관제형(버튼·카운트·SOS 스트립이 카드 안) / 긴 CJK 이름이 시각을 밀지 않음(P1-5) / 우측 열 생략 |

## 🔴 플랜 대비 조정

- **A1.8 신설.** claim(`join/`)·동행자(`companion/`)·QR 체크인(`checkin/`)은 손님이
  **룸에 들어오기 전** 만나는 화면인데 A1.1~A1.6 어디에도 자리가 없었다. B0.3(개인 링크)과
  B5(자동 체크인)가 바로 이 표면을 바꿨으므로 감사 대상에서 빠지면 안 된다.
- **가이드 7 + 기사 3은 A2로 넘긴다.** `components/tour-mode/` 아래 살지만 손님 앱이 아니다.
  원장에는 남겨 둔다 — 빠뜨린 것과 다른 웨이브 소관인 것은 구분되어야 한다.
