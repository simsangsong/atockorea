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

## 즉시수정 (감사 블로커만 — §B-6 예외)

*(없음)*

## 재현 불가 판정

*(없음)*
