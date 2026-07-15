# 다음 세션 실행 프롬프트 — 투어룸 컨시어지+엘레강스 v2 잔여 웨이브 (V1·V4·V5·V6)

**작성:** 2026-07-16 (V0+V2+V3 완료 세션 직후)
**마스터 플랜(단일 기준):** `docs/tour-room-concierge-uiux-v2-master-plan-2026-07-15.md` — 모든 결정·티켓·가드레일의 유일한 출처. §I 상태 보드에 완료 해시 기록.
**개발 브랜치:** `claude/tour-mode-uiux-concierge-p7k2vm` (워크트리 `C:\Users\sangsong\atockorea-tourmode-uiux`, node_modules는 `C:\Users\sangsong\atockorea-tourmode`에서 정션, `.env.local` 이미 복사됨 — `NEXT_PUBLIC_TOUR_MODE_V1=1` 포함)
**현재 상태:** V0(버그+팔레트)·V2(Tier 0)·V3(Tier 1/2) **main 머지 완료(PR #317 `23e54f5c`)**. 잔여 = V1(색 감사) → V4(타임라인+쿠폰) → V5(카피 정직성) → V6(QA 게이트).

---

## 1. 이어받는 즉시 할 일 (순서 고정)

1. 워크트리로 이동: `cd C:\Users\sangsong\atockorea-tourmode-uiux` → `git fetch origin` → `git merge origin/main` (V0~V3은 이미 main에 있음 — 브랜치가 main보다 뒤면 머지로 최신화).
2. 베이스 그린 확인: `npx tsc --noEmit` + `npx jest __tests__/lib/tour-room/concierge.test.ts __tests__/api/tour-rooms-concierge.test.ts --silent`.
3. 마스터 플랜을 이 순서로 읽는다: **§C(색 개정 U2-D1) → §E(타임라인+쿠폰) → §F(카피 정직성) → §G WBS(V1·V4·V5·V6 티켓) → §H(가드레일)**.
4. V1부터 착수. 티켓 완료 시 플랜 §I 상태 보드에 `✅ 완료(커밋해시)` 갱신 커밋을 함께 남긴다.

## 2. 절대 규칙 (위반 금지)

- **커밋 푸터는 `Co-Authored-By: Claude <noreply@anthropic.com>`만.** 모델 식별자 절대 금지. 코드/커밋 영어, 사용자 보고는 한국어.
- **§H-1: U0~U8 구조 결정 불변** — 레이아웃·그룹핑·꼬리·FAB·탭바는 건드리지 않는다. 이 트랙은 색·컨시어지·타임라인·카피만.
- **§H-2: SOS/긴급 레드는 "은은함" 원칙의 예외** — V1 색 감사에서 `--tr-danger` 계열을 절대 뮤트하지 말 것(의도된 포화 레드).
- **§H-3: `lib/tour-room/*` 기존 함수 시그니처 변경 금지** — 신규 함수 추가만 허용. `data-testid` 계약 전부 보존.
- 완료+검증(테스트 green) 후 커밋→PR→main 머지까지 자율(기존 승인 워크플로). `gh` CLI 없음 → GitHub REST API + git credential(bash).
- 라이브 DB 시딩은 반드시 sim 스크립트로만, 끝나면 `--cleanup`.

## 3. 잔여 티켓 상세

### Wave V1 — 색 적용 감사 【3】
- **V1.1** ChatFeed 버블(발신/수신/시스템) 대비 확인 — 파치먼트 `#F1E6CC`+잉크 `#2A2620`은 이미 적용됨(`eb0fa338`); 남은 건 육안 감사 + 혹시 남은 하드코딩 색 잔재 그렙(`grep -rn "amber-\|emerald-\|sky-" components/tour-mode`).
- **V1.2** 카드류(SpotArrival·Lobby·Pickup·Notice·PresenceBar) — 에메랄드가 `--tr-safe`(파인 `#3F6B58`)로 토큰 경유하는지, tailwind 직접 클래스(emerald-*)가 남았는지 확인·교체.
- **V1.3** SOS·긴급시트 **무변경** 재확인 — 스크린샷 대조(§H-2).

### Wave V4 — Travel Timeline + 리뷰 쿠폰 【4】 (플랜 §E)
- **V4.1** 투어 종료 요약 페이지 — 기존 `spot_arrival` 이벤트+vision-ask 사진을 종료 후 재집계한 정적 타임라인 뷰. **새 이벤트 스키마 금지** — `tour_room_messages`/`tour_room_spot_events` 기존 데이터 재집계만. EndedCard에서 진입 링크.
- **V4.2** 타임라인 완성 판정 + 쿠폰 발급 — ⚠ **쿠폰은 "타임라인 완성·사진 업로드"에만** 지급(리뷰 대가성 금지 — TripAdvisor/Google/Klook 정책 리스크, §B). 쿠폰 인프라는 웰컴 쿠폰의 promo_codes+grants 모델 재사용 검토(`docs/welcome-coupon-master-plan-2026-07-08.md`).
- **V4.3** "리뷰 남기기" 버튼 — 쿠폰과 **무관하게** 별도 상시 노출.
- **V4.4** 5로케일 카피. AI가 리뷰 초안 작성 금지(§B 가드레일 — 타임라인은 기억 보조까지만).

### Wave V5 — 카피 정직성 【2】 (플랜 §F)
- **V5.1** `messages/en.json:1339` "AI concierge 24/7" → 정직한 표현으로 전 로케일 교정(1인 운영, 24/7 상시응대 약속 불가).
- **V5.2** 투어룸 내부 노출 카피 "Smart Guide" 톤 정리. **사이트 전체(랜딩) 리브랜딩은 스코프 밖** — landing-page-uiux 스킬 소관.

### Wave V6 — QA 게이트 【1】
- **V6.1** 플랜 §J 체크리스트(AA 대비·44px 타깃·reduced-motion·5로케일×2테마 스크린샷 매트릭스) + `npm test` + 플랜 §I·CLAUDE.md 갱신.

## 4. 자산 인벤토리 (V0~V3 산출물 — 재사용하라)

| 자산 | 위치 | 비고 |
|---|---|---|
| 컨시어지 순수 코어 | `lib/tour-room/concierge.ts` | 인텐트·가드레일·Tier0·5로케일 템플릿·`latestArrivalContext`. 클라/서버 공유 단일 소스 |
| 컨시어지 엔드포인트 | `app/api/tour-rooms/[bookingId]/concierge/route.ts` | 가드레일→Tier0 재확인→Tier1(라우터 `'concierge'`)·예산 3중·`logChatTurn` 플라이휠 |
| 스마트 가이드 패널 | `components/tour-mode/ConciergePanel.tsx` | RoomShell `concierge` prop으로 주입, 시트는 RoomShell이 소유 |
| 팔레트 토큰 | `app/tour-room-theme.css` | U2-D1(아이보리+브라스). `--tr-danger` 뮤트 금지 |
| 어텐션 큐 | `lib/tour-ops/attention.ts` | `'concierge'` reason 추가됨(우선순위 need_help 다음) |
| 시뮬 3종 | `scripts/sim-tour-day.ts`(시딩/`--cleanup`) → `sim-populate.ts` → `sim-concierge-screens.mjs` | dev 서버 포트 3150(launch.json `tourmode-uiux-dev`), `SIM_OUT=<dir>` 필수 |
| 테스트 | `__tests__/lib/tour-room/concierge.test.ts`(42)·`api/tour-rooms-concierge.test.ts`(10)·`components/tour-mode/conciergePanel.test.tsx`(13) | 전체 투어 스위트 348 green 기준선 |

## 5. Gotcha (이번 세션에서 밟은 것들)

- **React 배치 업데이트 중복 key**: `setState(prev=>...)` 업데이터 안에서 ref 카운터를 읽으면 연속 push 쌍이 같은 id를 받는다 — id는 push 시점에 스냅샷. **유닛 테스트는 통과하고 라이브 시뮬에서만 잡혔음** → V4 타임라인 구현 후에도 반드시 시뮬 실구동으로 검증할 것.
- jsdom에는 `Element.scrollTo`가 없다 — 옵셔널 체이닝(`?.scrollTo?.()`)으로 가드.
- 인앱 브라우저 페인(preview)은 백그라운드 탭이라 hydration이 멈춰 보인다(기존 메모리 `reference_react_hidden_tab_hydration`) — **검증은 Playwright 스크립트(sim-concierge-screens.mjs 패턴)로**.
- 시딩 후 정리 잊지 말 것: `npx tsx scripts/sim-tour-day.ts --cleanup`.
- 메인 dir(`C:\Users\sangsong\atockorea`)은 타 세션 경합 — 작업은 반드시 워크트리에서.
