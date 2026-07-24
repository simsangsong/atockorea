# PROGRESS — 야간 자율 실행 상태 (재개용 단일 기준)

> 🔴 **세션이 끊기거나 한도에 걸려 재개될 때 이 파일을 가장 먼저 읽는다.**
> 아래 「다음 착수 지점」 한 줄이 진실이다. 매 티켓 완료 시 이 파일을 갱신하고 커밋한다.
> 상세 플랜: `docs/app-wide-audit-master-plan-2026-07-25.md` · 리뷰: `docs/audit/A-plan-review.md`

---

## 다음 착수 지점

**→ B1.5 (파싱 실패·리뷰 큐에서 한 번에 조치) · 이어서 §L L5 · A0.3/A0.4 → A1.0 → A1 전수**

## 기준선

- main = `ac832065` (origin/main과 동일, 미푸시 0) — tsc 0 · `next build --webpack` ✓ · 204스위트 2118 green 재검증 완료
- 작업 워크트리: `C:\Users\sangsong\atockorea-audit` (브랜치 `claude/audit-b0`, `npm ci` 실설치 완료)
- 라이브 마이그레이션 5건 추가 적용: `ops_ai_usage` · `bookings_sim_tag` · `ops_tour_groups` · `tours_max_room_guests` · `ops_guest_notes`
- 머지 워크트리: `C:\Users\sangsong\atockorea-main-merge`
- Supabase atockorea = `cghyvbwmijqpahnoduyv` (쓰기 가능) · Kursoflow = `thgyevrqykkscvcpwmfp` (읽기전용·쓰기 절대금지)
- 사전존재 실패 5스위트(무시): `api/tours` · `lib/error-handler` · `lib/logger` · `integration/assistant-streaming` · `utils/test-utils`

## 실행 순서 (§J 개정판)

| # | 티켓 | 상태 |
|---|---|---|
| 0 | 플랜 리뷰 + §L 신설 + 플랜 11건 반영 | ✅ `5f0f5842` |
| 1 | §L L0 계측 (`ops_ai_usage` + 라우터 훅) | ✅ `c9162012` |
| 2 | §L L1 출력 토큰 상한 기본값 | ✅ `c9162012` |
| 3 | A0.1 시뮬 환경 격리 | ✅ `b7058001` · `docs/audit/A0-sim-env.md` |
| 4 | B0.1 마이그레이션 (`ops_tour_groups` + 증거 캐스케이드 차단) | ✅ `54cd3741` |
| 5 | B0.2 `ensureTourGroup()` 리졸버 | ✅ `54cd3741` |
| 6 | B0.3 + B0.3c 개인 링크 전환 + 룸 진입 토큰 캐싱 | ✅ `54cd3741` |
| 7 | B0.3b 채널 중립 템플릿 렌더러 | ✅ `fb7de9ed` |
| 8 | B0.4 차량 그룹 이관 + B0.5 회귀 3시나리오 | ✅ `647ca802` |
| 9 | B2.1/2.1b/2.2 정원 (컬럼 + 해석순서 + 순수함수) | ✅ `f942cd10` |
| 10 | B2.3/2.4/2.5 경고 표면·2호차 분리·판매표면 회귀 | ✅ `f942cd10` · `cb3464f6` |
| 11 | B3 대화상대 선택 (B3.1~3.5) | ✅ `a03e2725` |
| 12 | B4 명단 메모 (B4.1~4.4) | ✅ `ddc8d768` · `f2980160` |
| 13 | B5 QR 자동 체크인 (B5.1~5.5) | ✅ `212e837c` |
| 14 | B1 통합 통계 | ✅ `c8e256db` · `96881528` (B1.1~1.4 + B1.6 CSV · **B1.5 큐 조치 미완**) |
| 15 | §L L0·L1·L2·L3·L4·L6 | ✅ (**L5 컨텍스트 다이어트만 미완**) |
| 16 | A0.3 성능 베이스라인 · A0.4 로케일 하니스 · A4 코드 건강도 | ⬜ |

## 남은 것 (우선순위순)

1. **B1.5** 파싱 실패·리뷰 큐에서 한 번에 조치 (기존 `OpsReviewQueueView`와 같은 엔드포인트로 수렴).
   ⚠ 라이브 인박스가 아직 미활성이라 **실데이터 0** — 빈 상태를 먼저 설계할 것(B1-D6과 같은 함정)
2. **§L L5** 컨텍스트 다이어트 — Tier1 프롬프트 입력 토큰을 L0 데이터로 실측한 뒤
   품질 무저하 상한을 정한다. **A7.2(환각 사냥 50문항)가 판정 도구**라 그것과 함께 하는 편이 낫다
3. **A0.3** 성능 베이스라인 · **A0.4** 로케일 하니스 → **A1.0 커버리지 원장** → A1 전수
4. **A4** 코드 건강도 (A0.1 무관, 언제든 병행 가능). A4.1 중복 진실 사냥이 B1-D3·B2.1b의 사후 검증이기도 하다
5. 🟡 **머지 게이트 확대** — 표준 게이트 스위트 목록에 `__tests__/`가 빠져 있어 L0 회귀를
   B3 단계에서야 잡았다. `npx jest lib components app/api __tests__`로 넓힐 것

## 슬라이스 절차 (매 티켓)

1. `atockorea-audit`에서 구현 + 로컬 커밋
2. 검수: `npx tsc --noEmit` → `npx jest <해당범위>` → 🔴 `npx next build --webpack`
3. 마이그레이션 있으면: 파일 검토 → **기존데이터 위반 사전쿼리** → `mcp__atockorea__apply_migration` → 검증쿼리 + `get_advisors`
4. `atockorea-main-merge`에서 `git merge --no-ff` → tsc + 게이트 jest + 빌드 재검 → `git push origin main`
5. **이 파일 갱신 + 커밋**

## 불변 원칙

- 투어룸 코어(`tour_room_*`, `/app/tour-mode`, `lib/tour-room`) 수정 금지 — additive만 (D2)
- 🔴 신규 `ops_*` 테이블 전부 `tenant_id text not null default 'atockorea'` + `revoke all on ... from anon, authenticated`
- 비가역 대외 액션(세무 제출·대량 발송·결제·push) 금지 (D10)
- 커밋 푸터 `Co-Authored-By: Claude <noreply@anthropic.com>`만
- 희소성 UI("매진/잔여") 금지 — 정원은 판매 차단이 아니라 운영 캡 (B2-D1)

## 실행 로그 (append-only)

- **[18]** §L L3 프리워밍 — 시작 게이트에서 오늘 앞쪽 스팟 콘텐츠를 미리 생성(await 안 함·기존 예산 편승·순차 실행·시뮬 제외). 호출 수는 같지만 **손님이 기다리는 시각이 아니다**. 3876 green. → `ac832065`
- **[17]** §L L4 Tier0 커버리지 — Tier1로 샌 질문을 빈도순 후보로. 가드레일·기존적중·일회성 제외, 🔴자동 추가 없음(오답이 사전에 굳으면 영원히 틀린 즉답). `npm run ai:tier0-coverage`. → `cf7be0d3`
- **[16]** B4.4 관제 드로어 메모 — 세 화면이 같은 API를 읽는다(B4-D4 완결). → `f2980160`
- **[15]** B0.3b 채널 중립 템플릿 — wa.me와 이메일이 **같은 토큰 어휘**를 쓴다. 이전엔 `{guest_name}` vs `{guestName}`으로 갈려 있었다. 두 채널 동일 결과 회귀. → `fb7de9ed`
- **[14]** B1.6 CSV — 화면과 같은 리졸버 · UTF-8 BOM · 합계 행 없음(테스트로 고정). → `96881528`
- **[13]** B2.4 2호차 분리 — 배차도 그룹 스코프로 · 🔴테스트가 잡은 것: **상품 캡이 병목이면 2호차를 붙여도 정원이 안 는다** → 병목을 화면이 말하고 그룹 예외 정원을 올리는 동선 추가. → `cb3464f6`
- **[12]** §L L6 일일 예산 표면 — 오늘 호출/캐시히트 상시 1줄 + 투어당 30회 초과만 요주의. 3820 green. → `e55a973e`
- **[11]** §L L2 Tier1 응답 캐시 — 컨텍스트 버전 키(스팟·라이프사이클·자유시간·30분 시각버킷) · 질문 원문 미저장 · 히트 계측 · 7일 퍼지. 3814 green. → `38e9b915`
- **[10]** B0.4/B0.5 차량 그룹 소유 — `loadRoomVehicles`가 그룹 차량을 준다(시그니처 무변경) · 🔴앵커 아닌 룸에서 '차량 미배정'으로 보이던 버그 수정 · 회귀 3시나리오. → `647ca802`
- **[9]** B1 통합 통계 — 3평면 리졸버(총합 필드 없음) · 룸 누락 3종 분리 · 🔴비활성≠빈상태(인박스 미연결 표기) · 주간 카드/월간 달력 · 이름 마스킹 · 시뮬 배제. 3791 green. → `c8e256db`
- **[8]** B5 QR 자동 체크인 — `autoEligible`(서버 단언) · nonce 필수 자동 경로 · `guest_qr_auto` actor 구분 · 환영 화면 5로케일 + [투어룸 열기] · 자동분만 되돌리기. 3744 green. → `212e837c`
- **[7]** B4 명단 메모 — `ops_guest_notes`(예약당 1개·needs와 분리) · 명단 아이콘/카드 편집(낙관적) · 스태프 전용 게이트 · 30일 퍼지. → `ddc8d768`
- **[6]** B3 대화상대 선택 — broadcast `bookingIds` additive(스코프 밖 거부) · 대상 칩+버튼 라벨 연동 · 오발송 방지 양방향 회귀. → `a03e2725`
- **[5]** B2 정원 — `tours.max_room_guests`(person 8건 시딩/vehicle 미설정) · 해석 순서 단일 지점 · 일일보고서 초과 경고 · 🔴판매표면 희소성 누출 파일시스템 회귀. → `f942cd10`
- **[4]** B0.1/0.2/0.3/0.3c — 마스터 룸(`ops_tour_groups`) + 차량 소유 이관 + 노쇼 증거 캐스케이드 차단 · 개인 링크 일괄 발송(폐기-후-재발급) · 룸 진입 토큰 캐싱 · 초대 메일 5로케일 문구 교정. 2251 green. → `54cd3741`
- **[3]** A0.1 시뮬 격리 — `bookings.sim_tag` + `simScope.ts` + 집계/금전 배제 + 시더 가드 + cleanup 고아행 수정. → `b7058001`
- **[1-2]** §L L0/L1 — `ops_ai_usage` 계측(라우터 단일 지점, fire-and-forget) + 목적별 출력 상한 기본값 + 30일 퍼지. → `c9162012`
- **[0]** 플랜 전수 리뷰 완료 — 11건 발견(구현불가 1·커버리지구멍 1·누락 1 포함), 전부 플랜 본문 반영. §L 신설. main `65b5703c` 건전성 재검증. → `5f0f5842`
