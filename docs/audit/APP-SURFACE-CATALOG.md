# APP-SURFACE-CATALOG — 풀 오디트 표면 카탈로그 (A0)

> 생성: 2026-07-30 (풀 오디트 세션 1) · 기준 커밋: af7adbd0 (origin/main 동일)
> 플랜: `docs/full-app-audit-plan-2026-08-01.md` §C-A0
> 이 문서는 이후 페이즈(A2 UI·A3 E2E·A4 연결)의 체크리스트 겸 진행률 원장이다.
> 진행 표기: `-` 미착수 · `~` 부분 · `✓` 완료 · `✗` 결함 발견(원장 ID 병기)

## 0. 플랜 수치 보정 [실측 — glob/원장 재현]

| 플랜의 주장 | 실측 | 비고 |
|---|---|---|
| "라우트 ~20" (페이지) | **9 page.tsx + 1 layout** | `app/(app)/tour-mode/**` glob |
| "41개 K4 원장 기준" (API) | **47 route.ts 파일 · K4 원장 56 (메서드,경로) 쌍** | tour-rooms 41 + tour-mode 6 파일. K4 원장(생성물)이 정본 |
| "65개 컴포넌트" | **tour-mode 92파일(하위 11디렉토리 포함) + tour-ops 24파일** | ts 헬퍼 포함 |

## 1. 페이지 표면 (10) × 역할 × 상태

상태 축: `로비(D-N)` · `D-1` · 투어일 {`pickup` `moving` `arrived` `free` `rally(set/remind/due/overdue/contact)`} · `wait_ended` · `ended` · `post_tour(+48h)`

| # | 표면 | 경로 | 역할 | 상태 축 | A2 | A3 | A4 |
|---|---|---|---|---|---|---|---|
| S1 | 엔트리 | `app/(app)/tour-mode/page.tsx` | anon | 단일 | ✓(overlap 워크·플래그 ON 확인) | - | - |
| S2 | join+PIN | `app/(app)/tour-mode/join/[roomToken]/page.tsx` | customer·driver·guide | 단일 | ~(워크 경유) → A3에서 판정 | - | - |
| S3 | 손님 룸(홈·채팅·지도·오늘+시트 전부) | `app/(app)/tour-mode/room/[bookingId]/page.tsx` | customer(lead/member) | **전 상태** ← 최대 조합 | ✓ 풀 그리드 192콤보 + 채팅 4콤보 통과 | - | - |
| S4 | 기사 콘솔(콕핏) | `app/(app)/tour-mode/driver/page.tsx` | driver | 투어일 전 상태 + T+12 | ✓ **24콤보 판정·화면밖이탈 0**(A8에서 헤드리스 진입 복구) | - | - |
| S5 | 가이드 콘솔 | `app/(app)/tour-mode/guide/page.tsx` | guide | 투어일 전 상태 + 플랜패널·정산 | ~(cjk 0·walk 통과, 그리드 미포함) | - | - |
| S6 | 플랜 인덱스 | `app/(app)/tour-mode/plan/page.tsx` | customer | D-N | - → A3 | - | - |
| S7 | D-1 플랜 에디터 | `app/(app)/tour-mode/plan/[bookingId]/page.tsx` | customer(lead) | D-N·D-1(draft/confirmed) | ~(overlap 워크 경유) → A3 | - | - |
| S8 | 체크인 | `app/(app)/tour-mode/checkin/[token]/page.tsx` | customer | 단일 | ~(overlap 워크 경유) → A3 | - | - |
| S9 | 동반자 뷰 | `app/(app)/tour-mode/companion/[token]/page.tsx` | companion | 투어일 | - → A3(초대 발급 필요) | - | - |
| S10 | 공용 레이아웃 | `app/(app)/tour-mode/layout.tsx` | 전 역할 | — | ✓(전 콤보에 포함) | - | - |

**히어로 3표면(A2 풀 그리드 대상):** S3 투어일 홈 · S4 콕핏 · S3 로비 상태.

## 2. API 표면 (47 파일 · 56 쌍)

**정본: `docs/audit/K4-coverage.md`** (생성물 — 손편집 금지, `gen-k4-coverage.ts`).
행위자 분포: guest 40 · guide 11 · driver 3 · admin 2. 비용: free 43 · llm 12 · people 1.
A3/A6에서 이 원장의 56쌍을 체크리스트로 쓴다. 여기 중복 나열하지 않는다.

- `app/api/tour-rooms/[bookingId]/**` 41 파일 (approach, arrival-bundle, captions, companion-invite(+redeem), concierge, day-summary, dietary, dining(+feedback), driver-signal, events, extend, extras, join, location, manual-arrival, media, meeting-photo, messages(+retranslate), morning-briefing, my-seat, plan(+claim-lead·templates), push-subscribe, reactions, read, signals, sos, spot-events, stt, timeline-coupon, tour-itinerary, tts, typing, vehicle-eta, vehicle-photo, vision-ask) + `broadcast`
- `app/api/tour-mode/**` 6 파일 (booking/[id]/content, bookings, driver/link, driver/overview, guide/overview, room/[bookingId]/snapshot)
- 크론: `app/api/cron/tour-room-flywheel` · `capture-tour-day-payments` (접점: rag-harvest)
- SW: `public/sw-tour-mode.js` · `public/sw-tour-ops.js`

## 3. 컴포넌트 인구조사 [실측]

- `components/tour-mode/` 최상위 63 tsx + 하위: cockpit 3 · staff 3 · driver 1 · guide 7 · plan 5 · join 1 · map 5 · chatlist 1 · checkin 1 · companion 1 · scenery 1 (+ts 헬퍼 4)
- `components/tour-ops/` 24 (OpsApp 셸 + 탭/뷰/패널)
- A4 호출자-부재 스캔의 모집단.

## 4. 접점 어드민 (표본)

`app/(marketing)/admin/`: tour-ops(관제 콘솔) · meeting-photos(검수큐) · tour-mode-spots ·
travel-matrix · vehicle-layouts · guides · guide-settlements · facility-pins

## 5. 게이트 베이스라인 [실측 2026-07-30]

| 게이트 | 결과 | 비고 |
|---|---|---|
| `npx tsc --noEmit` | **exit 0** | |
| `npx jest __tests__/audit` (18스위트) | **18/18 pass · 194 tests** | 상설 게이트 전부 초록 |
| `npx jest` 전체 | **531스위트: 525 pass · 5 fail · 1 skip / 5,614 tests: 5,592 pass · 1 fail · 21 skip** | 실패 분해 ↓ |
| `npm run build` | exit 0 | 세션1에서 실측 |

**전체 jest 실패 5스위트 분해:**
- 실결함 1: `__tests__/api/driverOverviewTourId.test.ts` — **원장 FA-001** (rallyCrossing tourId 누락 호출자)
- 환경 아티팩트 4: e2e 2(`tour-room-chat`·`tour-ops-sos`) + 픽스처 2(`cruise-smallgroup-corpus`·`active-rules`) —
  jest ignore 패턴이 이 워크트리 경로에서 죽음 — **원장 FA-002** (게이트 취약성)

## 5b. A0~A7 1차 완주 후 상태 (2026-07-30, 세션 1)

| 페이즈 | 상태 | 산출 |
|---|---|---|
| A0 카탈로그·베이스라인 | ✓ | 이 문서 · 게이트 기준선 · 시드 2벌(live + **미래 날짜 로비**, `sim-lobby-booking.ts` 신설) |
| A1 회고 대조 | ✓ | 원장 FA-003~010 · 누적 수치 7건 재현(거짓 0) |
| A2 UI 실렌더 | ✓ 히어로 3표면 · ~ 나머지 | `qa-hero-grid.mjs` 신설 216콤보 · 기존 워크 5종 |
| A3 기능 E2E | ✓ 라우트 축 | K4 56쌍 → PASS 53 · FAIL 0 · UNWRITTEN 2 |
| A4 연결·도달성 | ✓ | `qa-caller-absence.mjs` 신설 · dead-exports 20 |
| A5 성능 | ✓ 번들·API · ✗ 3G LCP | `BUNDLE-BASELINE.md` 신설 · `qa-tick-discipline.mjs` 신설 |
| A6 데이터·보안 | ✓ | 토큰 스코프 56쌍 대조 · advisors · **FA-016 P0** |
| A7 원장 | ✓ | `FULL-AUDIT-LEDGER-2026-08.md` 26건 + 게이트 뮤테이션 3/3 |
| A8 수정 | ✓ **완주** | 26건 중 23 수정 · 2 관찰 · 1 사람 게이트. 신설 게이트 6종 · `npm run gate` |

**다음 세션이 이어받을 잔여 감사:** ① A2 축소 그리드(가이드 콘솔·플랜 에디터·시트류·체크인·동반자 —
현재 `~`. 콕핏 진입이 복구됐으니 같은 패턴으로 이식 가능) ② 나머지 15개 게이트 뮤테이션
③ 3G 스로틀 LCP ④ 링(플래너·관제·마케팅 접점) 표본 ⑤ **실기기 리허설 — 남은 유일한 사람 게이트**
(이제 결과가 당일 저녁 보고서의 「도착 기록」 줄로 확인된다).

## 6. 이 워크트리 환경 (다음 세션 부트스트랩용)

- `.claude/worktrees/*`엔 node_modules 없음 + **메인 레포 node_modules는 비어 있음(손상 전례)** →
  정션 필요: `New-Item -ItemType Junction -Path <wt>\node_modules -Target C:\Users\sangsong\atockorea-inbox-gate\node_modules`
  (package.json md5 일치 확인함. 삭제 시 링크 먼저 끊기 — `[System.IO.Directory]::Delete($p,$false)`)
- `.env.local`은 메인 레포에서 복사(gitignored 확인).
- ~~⚠ `.claude` 경로 밑에서는 jest testPathIgnorePatterns가 무력(FA-002)~~ → **A8에서 고쳤다.**
  패턴이 구분자-중립이 됐고 `npm run gate` 하나가 tsc + jest 전체를 돈다. 이제 전체 jest는 **실패 0**이다.
- ⚠ **콕핏을 헤드리스로 열려면 탭을 키로 선택해야 한다** — `staff-tab-btn-ops` → `staff-tab-ops` →
  `ops-drive`(320px에서 접힘 아래라 `state:'attached'` + `scrollIntoViewIfNeeded` 필수). `drive-hero`는
  상태에 따라 렌더되지 않아서 그걸 누르는 방식은 조용히 "unreachable"이 된다.
