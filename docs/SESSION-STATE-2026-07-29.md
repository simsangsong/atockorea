# 세션 작업 기록 — 2026-07-29 (밤샘 자율 세션)

> **이 파일은 "지금 어디까지 왔고 무엇이 살아 있는가"만 적는다.**
> 무엇부터 할지는 `docs/NEXT-SESSION-SMARTAPP-2026-07-28.md`,
> 왜 그런지는 `docs/ops-staff-design-unification-master-plan-2026-07-27.md`.
> 직전 기록은 `docs/SESSION-STATE-2026-07-28.md`.

---

## 1. 한 문단

**1순위 8건이 전부 닫혔다** — 그리고 그중 **둘은 애초에 이미 배포돼 있었다**(P0·P1).
플랜이 최우선 티켓 두 개를 "미착수"로 두 라운드 광고한 것이 이 세션의 가장 비싼 발견이다.
🔴 **그리고 내가 프로덕션 빌드를 한 번 깼다**(K1a의 `maxDuration`) — 47분 만에 복구했고,
같은 계열이 재발하지 않도록 상설 가드를 심었다. §4에 전말.

## 2. 머지된 것 (전부 main)

| PR | 티켓 | 내용 |
|---|---|---|
| #560 | **N5** | 콕핏 재질 **회귀 없음**(카드 0개라 닿지도 않았다) · 콕핏·가이드 칩 경계 1.16~1.45 → **6.60~21.00** · 상설 게이트 `chipBoundary` 신설 · **공용 계측기** `scripts/qa-lib/contrast-inject.js` |
| #561 | **N6** | 진입 hydration **1 → 0**(ko/fr) · 서버가 쿠키+`Accept-Language`로 판정 → **손님 언어가 첫 HTML에** |
| #562 | **K1a** | SSE 폴백 방어 — `maxDuration` · 백오프 2→8초 · 예약/룸 15초 메모 · `retry:`+`Last-Event-ID` |
| #563 | **L1** | 투어 중 현금 고지 — 전세 5종 × 6로케일 렌더 확인 + OTA 붙여넣기 정본 문서 |
| #564 | **B1** | 전세 샘플 일정 브랜치 **2개 폐기**(main이 하루 먼저 배포) + 이미 머지된 3번째 정리 |
| #565 | **P0** | 본체는 이미 있었다 → 실렌더 확인 + **§M-3 상설 데이터 게이트 2종** |
| #566 | **P1** | 이것도 이미 있었다 → **`claim-lead` 라우트 API 테스트 7건** |
| **#567** | 🔴 **핫픽스** | `maxDuration`을 리터럴로 — **프로덕션 빌드 복구** |
| #568 | 가드 | 세그먼트 설정 비리터럴 **상설 차단**(55ms) |
| #569 | **X1** | CJK 스캐너 재작성 + 코드모드 **357건/90파일** · 관제 툴바 wrap · 손님 룸 잘림 0 |
| #570 | **I1** | `nowCard` 7상태 리졸버 + 경계 16건 |


## 2b. 2순위(Part I)까지 이어서 머지된 것

| PR | 티켓 | 핵심 |
|---|---|---|
| #572 | **I2** | 홈 재구성 — 첫 화면 선택지 **10 → 4**, 스크롤 527 → 307px, 닿는 testid **20 → 25(잃은 것 0)** |
| #573 | **I3** | 상태 전이 크로스페이드 · reduced-motion에서 **완전 정지** · danger만 assertive |
| #574 | **I4** | 관제 홈 — 탭 중복 타일 2개 제거(10→8) · SOS/응대필요 KPI에만 위험 위계(0이면 중립) |
| #575 | **I5** | 지금카드 색쌍을 상설 게이트에 → **danger 3.95<4.5 적발** + **다크 rgba가 검사조차 안 되던 것** 수정 |

**I6는 사장님 결정**이고 기본값(접힘)으로 뒀다. 뒤집기는 `HomeTab`의 `useState(false)` 한 줄.

## 2c. 🔴 I 트랙에서 배운 것 두 개

**① 워크가 잡고 단위 테스트는 못 잡은 것.** 시뮬 룸이 **마지막 스톱**이었는데 `moving`이
`nextStop`을 요구해서, 그 손님은 전 상태에서 떨어져 **투어 마지막 한 시간 동안 히어로 카드가
사라졌다.** 픽스처는 전부 다음 스톱이 남아 있어 **빨간불이 한 번도 안 떴다.**
→ 픽스처는 "우리가 이미 아는 데이터"다. 실 데이터로 한 번은 걸어야 한다.

**② 게이트를 넓히는 것이 화면을 보는 것보다 빨랐다.** I5에서 색쌍 두 개를 추가하자마자
위험 카드의 3.95가 나왔다 — 그 카드를 눈으로 보고는 못 잡았을 값이다.
같은 자리에서 **게이트가 rgba를 통째로 건너뛰고 있던 것**도 드러났다(NaN을 "이상 없음"으로 처리).

## 2d. ⏸ N7(플래너 스킨)은 착수 후 보류 — 사장님 결정 필요

스킨 블록 특이도가 `.tr-plan-root`보다 높아서, 그냥 스탬프하면 **플래너 팔레트가 반씩 섞인다**
(그라디언트 양끝이 다른 계열). 선택지 A/B와 권장·선행조건은 **마스터 플랜 §N-9**에 적어 뒀다.
🔴 **게이트(10스킨 × 플래너 대비) 없이 손대지 말 것** — 플래너는 이미 게이트 밖이라
`ink-3` 미달인 채 배포된 전력이 있다.

## 7b. 갱신된 다음 착수 지점

**Part I 완료.** 다음은 **감성 마감**과 **3순위 속도** 중 하나:

- 감성: `N3`잔여(풍경/콘텐츠 레이어 분리 — 타일 고아 행은 I2가 이미 해소) → `N8`(광원을 스태프 표면까지, **콕핏 제외 확정**) → `N2`(하루의 결) → `N4`(빈 채팅)
- 속도: `K2`(요금제 상한 확인 — 사장님/콘솔 필요) → `K1b` → **`X13`(단독 세션·단독 PR)** → `K3` → `K5`
- 잔여 CJK: certain **603** (대부분 `text-cjk-body` 패스) + suspect 537. 도구는 다 있다

## 3. 🔴 다음 사람이 반드시 알아야 할 것 세 가지

**① 플랜의 "미착수"를 믿지 말고 코드를 먼저 확인하라.** P0·P1 둘 다 이미 배포돼 있었다.
착수 전 5분 grep이 두 라운드를 아낀다.

**② 빌드 게이트는 grep이 아니라 종료 코드다.**
`next build`는 **"Compiled successfully"를 찍고 나서** "Collecting page data"에서 실패한다.
성공 줄을 grep하면 **exit 1을 초록으로 읽는다.** 반드시:
```bash
npm run build > /tmp/build.log 2>&1; echo "EXIT=$?"
```

**③ 게이트 목록에 `__tests__/audit`가 빠져 있었다.** N6가 A1 커버리지 원장 행 없이 머지돼
main에서 그 게이트가 깨져 있었다(#569에서 복구). 갱신된 목록은 부트스트랩 §6.

## 4. 🔴 프로덕션 빌드를 깬 건 (전말)

K1a가 `export const maxDuration = SSE_MAX_DURATION_S`로 나갔다. Next.js는 세그먼트 설정을
**모듈 그래프가 생기기 전에 정적으로** 읽으므로 임포트 식별자는 값이 아니다.

```
⨯ Unknown identifier "SSE_MAX_DURATION_S" at "maxDuration"
⨯ Invalid segment configuration export detected
```

**초록 신호 3개와 깨진 배포였다** — tsc 통과(타입은 멀쩡), jest 통과(임포트도 멀쩡),
그리고 로컬 빌드가 "Compiled successfully"를 찍었다. 내가 그 줄을 grep으로 확인했다.

복구: #567(리터럴화 + 라이브러리 상수와 일치 검증) → #568(전 라우트 상설 가드).
**사장님이 배포 로그를 붙여 주지 않았으면 아침까지 몰랐다.**

## 5. 지금 살아 있는 환경

- 워크트리: `.claude/worktrees/smartapp-control-integration-628681`
- `.env.local` 복사됨(`NEXT_PUBLIC_TOUR_MODE_V1=1` 포함) · `node_modules` 설치됨(`npm ci`)
- 시드: `scripts/.sim-fixtures.json` (`room1Url`·`room2Url`·`guideUrl`·`adminSession`)
  — 토큰 만료 **2026-07-29**. 지나면 `ALLOW_SIM_SEED=1 npx tsx scripts/sim-tour-day.ts` 재시드
- dev 포트 **3178** (3161·3171은 타 세션 가능성)
- ⚠ **워크트리 HMR 안 먹음** — 고치면 서버 재시작 필수
- ⚠ **dev 서버가 한 번 응답 불능이 됐다**(포트는 LISTEN, `/api/health` 20초 타임아웃).
  원인 1순위는 닫히지 않은 SSE 스트림 누적 — K1a가 고친 그 구조다. 멈추면 죽이고 재시작.

## 6. 새로 생긴 도구 (다음 세션이 다시 만들지 말 것)

| 도구 | 무엇 |
|---|---|
| `scripts/qa-lib/contrast-inject.js` | **공용 색 계측기.** rgba 알파 · `color(srgb 0~1)` · **테두리까지 보는 경계 대비**. 단위 테스트 11건 |
| `scripts/qa-cjk-scan.ts` | 새 CJK 스캐너(옛 `.mjs`는 **삭제**). certain/suspect 2통 |
| `scripts/fix-cjk-labels.ts` | 코드모드. 삽입만 하고 **자기 diff를 왕복 검증**. 기본 dry-run |
| `scripts/qa-course-classification.ts` | 라이브 코스형 분류 드리프트(인증 실패 시 **exit 2**) |
| `lib/audit/cjkBreak.ts` · `lib/tour-room/courseClassification.ts` · `lib/tour-room/nowCard.ts` | 순수 로직 |
| `__tests__/audit/segmentConfig.test.ts` | 세그먼트 설정 리터럴 강제 |
| `__tests__/components/tour-mode/chipBoundary.test.ts` | 칩 행에 `.tr-chip-tap` 강제 |

## 7. 다음 착수 지점

**I2**(NowCard + 홈 재구성). I1이 리졸버를 끝냈으므로 남은 건 화면이다.
🔴 **단독 PR · 전후 컷 필수 · `더 보기`가 기존 그리드를 전량 흡수**(U-D25) ·
기존 `home-*` testid 전량 보존. 하나라도 끊기면 손님에겐 기능이 삭제된 것이다.

그 다음: I3 → I4 → I5 → I6 → 감성 마감(N3잔여 → N7 → N8 → N2 → N4) → 3순위 속도.

## 8. 사장님 결정 대기 (변동 없음 + 1건 추가)

U-D20v2 · I6 · X16 · L3 · K4 · `claude/ai-agent-booking-channel` ·
🔴 8/17 예약 `d8e12b1d` 카드 미저장 `pending` ·
**(신규) B6** — `claude/hide-two-tours-tourist-hnd3ka`, 상품 2종 숨김이 지금도 유효한 운영 의도인가.
