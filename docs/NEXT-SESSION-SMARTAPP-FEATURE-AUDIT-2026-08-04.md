# 다음 세션 부트스트랩 — 스마트앱 기능 감사 **종결** (2026-08-03 갱신)

> **이 트랙은 끝났다.** 이 문서는 *무엇이 끝났고 무엇을 일부러 안 했는지*를 남긴다.
> 플랜 정본: `docs/smartapp-feature-audit-plan-2026-08-03.md` — **§F 실행 로그가 결과다**
> 격자(생성물, 손대지 말 것): `docs/audit/feature-journey.md`
>
> **다음에 할 일은 이 트랙이 아니다** → §6.

---

## §1 지금 상태 한 문단

**감사 F-1 · F0~F8 전 페이즈 완주.** PR **#683~#699 (15건) 머지.**
기준선: `tsc` **0** · `jest` **5,844 pass / 0 fail**(544 스위트) · `npm run build` **exit 0** ·
상설 게이트 `__tests__/audit` **30종**.

2026-08-03 후반 세션이 §4 잔여 다섯을 전부 닫았다:
**K1a SSE 클라이언트 절반 · 자정 집합시각 · 동시 편집(플래너+원장) · F8 래칫 2종 ·
선언했는데 안 읽는 prop 스캐너.**

🔴 **다음 사람에게 남기는 한 줄 — 이 감사가 두 세션에 걸쳐 증명한 것:**
**티켓의 처방을 그대로 쓰면 절반은 틀린다. 숫자는 다시 재고, 처방은 그 자리의 코드와
그 옆의 게이트를 읽고 다시 정한다.** 이번 세션에서도 세 번 그랬다(§3).

---

## §2 이번 세션이 실제로 고친 것 (전부 **실주행으로 판정**)

| # | 무엇 | 실측 증거 | PR |
|---|---|---|---|
| 1 | **K1a 클라이언트 절반** — 서버는 이미 끝나 있었다. `EventSource` 가 비-200 에 **영구히** 닫히는데 되살릴 주인이 없었다 | realtime 차단 후 `/events` 500 한 번 → **26초에 재시도 0**, 헤더는 "Reconnecting…" 이라 거짓말. 수정 후 **3회 시도 · "Offline — retrying"** | [#695](https://github.com/simsangsong/atockorea/pull/695) |
| 2 | **자정 집합시각** — `00:30` 이 투어일 *시작*으로 풀려 즉시 만료 | 대조군은 "35 min" 이 뜨는데 00:30 은 **화면에 아무것도 없다**(채팅엔 "Meeting time is 00:30" 이 있는데). 수정 후 **"157 min · 12:30 AM"** | [#696](https://github.com/simsangsong/atockorea/pull/696) |
| 3 | **동시 편집** — `tour_day_plans.version` 을 **쓰고 화면에 찍기만 하고 아무도 안 읽었다** | 한 스냅샷에서 두 번 저장 → 둘 다 **200**, 먼저 것이 사라짐. 수정 후 **409 `plan_stale`** · 원장도 같은 모양이라 조건부 쓰기 | [#697](https://github.com/simsangsong/atockorea/pull/697) |
| 4 | **F8 래칫 2종** — 개수가 아니라 **정체**로 고정 | caller-absence **허용목록 2건(이름+사유)** · route-coverage **125** + 🔴 **스마트앱 표면 미커버 0 유지** | [#698](https://github.com/simsangsong/atockorea/pull/698) |
| 5 | **declared-props 스캐너** — 151 컴포넌트 · 703 prop → **3건, 전부 진짜** | 세 건 다 제거, 게이트는 **상한이 아니라 0** 으로 고정 | [#699](https://github.com/simsangsong/atockorea/pull/699) |

---

## §3 🔴 이번 세션에 처방이 뒤집힌 세 번 — 전부 **그 자리의 코드/게이트**가 잡았다

| 티켓이 시키는 대로 했으면 | 실제 |
|---|---|
| K1a: "서버 SSE 순환을 고쳐라" | **서버는 이미 끝나 있었다**(maxDuration·백오프·reconnectCache·K1b). 남은 건 그 파일이 자기 주석에 적어 둔 브라우저 쪽이었다 |
| prop 스캐너: "`onOpenConcierge` 를 배선해라" | **정반대.** `conciergeDoorCount` 게이트가 **문은 둘**이라고 못 박았고 세 번째는 **측정된 이유로 지운 것**이다 → 배선이 아니라 잔해 제거 |
| F8: "route-coverage **113+** 를 상한으로" | **113 은 출력의 *나머지* 줄**(`… +113 more`)이었다. 실제 미커버는 **125** — 그대로 옮겼으면 상한이 12 헐거웠다 |

**그리고 하니스·게이트가 거짓 실패를 네 번 냈고 네 번 다 내 잘못이었다:**
① 자정 워크가 `notice-banner` 를 봤는데 손님 홈에서는 **히어로가 카운트다운을 소유**한다
(`heroOwnsCountdown`) ② 동시편집 워크가 스톱 제목을 `title` 로 읽었는데 저장 형태는
`name_i18n.en` ③ 래칫 게이트가 **자기 정규식 리터럴에 자기가 걸렸다**
④ 래칫이 `insertExtraCapsule` 을 POST 쪽에서 재고 있었다.
**스크린샷 한 장 · diff 한 번이 매번 막았다.**

🔴 **그리고 한 번은 tsc 가 못 잡았다** — 전역 치환이 `tourTitle` 을 **살아 있는 두 소비처**
(`TravelTimelineEntry` 공유 문구 · `HomeTab`)에서도 지웠는데 **옵셔널 prop 이라 컴파일러가 조용했다.**
**diff 를 읽어서** 잡았다. *타입 시스템은 prop 이 무엇을 위한 것인지 모른다.*

---

## §4 🔴 사장님 결정 (2026-08-03) — **투어룸을 손님에게 발송하지 않는다**

라이브 실측: 진짜 예약 **18건** 중 룸이 생긴 건 **3건**, 그 3건 전부 **초대 0 · 참가자 0**.
DB 의 활동은 **전부 사장님 수동 테스트**(`manual-test-2026-07`)다.

- 🔴 **"실사용 0" 을 결함으로 다시 올리지 마라.** 의도다
- 🔴 **자동 발송 경로를 만들지 마라.** 「투어룸 발송」이 어드민 수동 버튼인 게 **안전장치**다
- `scripts/qa-live-silence.ts` 는 **발송을 시작한 날 이후**부터 값이 있다. 그날 첫 명령이 이것이다

---

## §5 의도적으로 **안 한 것** (다시 열 때 여기부터)

| | 왜 안 했나 | 언제 다시 보나 |
|---|---|---|
| `scheduleTargetMs` 자정 처리 | 호출부에 참조가 없고 라이브에 그런 시각 **0건**. 올바른 규칙은 "일정은 단조 증가"이고 **배열을 보는 자리**에서 해야 한다 | 야간/일출 상품이 생기는 날 |
| `DepartureCountdown` 날짜 가드 | **산술은 멀쩡하다**(분 누적이라 28:00 이 자연히 다음 날). `kstToday !== tourDate` 가드만 자정 넘은 전세 투어에서 카운트다운을 감춘다 | 같이 |
| `qa-unfilled-props` 래칫 | 결함 밀도 **0** — 상한을 걸면 무해한 옵셔널 prop 하나가 빌드를 깨고 게이트가 꺼진다. 게이트 머리에 "넣지 말 것"이라 적어 뒀다 | 안 함 |
| `lib/ops/parse/client-sse.ts` 삭제 | 진짜 고아(임포터 0, 주석이 없는 파일을 소비처로 지목)지만 **ops 범위**. 지우는 건 사장님 결정 | ops 트랙 |
| 기사 × 여정 빈 칸 | 격자 사유에 전부 적혀 있다(`docs/audit/feature-journey.md`) | — |

---

## §6 그래서 **다음은 무엇인가**

이 감사는 끝났다. 대기 중인 트랙은 **스마트앱/관제 통합 트랙 잔여 12건**이다 —
`docs/NEXT-SESSION-SMARTAPP-2026-08-01.md` **§4 순서 고정**:

> X12 → X10 → X9 → X8(⚠세무 보고만) → X11 → X19 → T0 → T1v2 → T3 → T5 → O6 → R6

🔴 **착수 전에 §3 을 다시 읽어라.** 그 트랙은 "미착수"를 **일곱 번** 틀리게 적었고,
이 감사도 두 세션에 걸쳐 여섯 번 같은 실수를 했다. **5분 grep + 그 자리의 주석**이 라운드를 아낀다.

---

## §7 작업 환경 (여기서 시간을 제일 많이 잃는다)

| 항목 | 값 |
|---|---|
| 워크트리 | **전용 워크트리.** 메인 디렉터리는 타 세션 경합 + `node_modules` 손상 |
| `node_modules` | 워크트리엔 없다. 살아 있는 다른 워크트리에서 **정션**(`New-Item -ItemType Junction`) |
| `.env.local` | 없으면 `cp C:/Users/sangsong/atockorea/.env.local .env.local` — **없으면 빌드가 죽는다** |
| dev | `.claude/launch.json`(gitignore 됨)에 항목 추가. ⚠ **3181·3182 는 타 세션이 잡고 있었다** — 빈 포트를 쓸 것 |
| dev 재기동 | 🔴 **워크트리는 HMR 이 안 먹는다.** 소스를 고쳤으면 **dev 를 재시작하고** 워크를 돌려라 |
| 빌드 | `npm run build` 만. **종료 코드로 확인** |
| 커밋 | `git add -A` **금지**, 경로 명시. 푸터는 `Co-Authored-By: Claude <noreply@anthropic.com>` 만 |

### 첫 명령

```bash
git fetch origin main && git checkout -B <새-브랜치> origin/main
cp C:/Users/sangsong/atockorea/.env.local .env.local 2>/dev/null || true
npm run gate                                        # tsc 0 · jest 5,844 pass
npm run build > /tmp/b.log 2>&1; echo "BUILD_EXIT=$?"
```

### 시뮬 / 실주행

```bash
ALLOW_SIM_SEED=1 npx tsx scripts/sim-tour-day.ts && npx tsx scripts/sim-populate.ts
WALK_BASE=http://localhost:<port> node scripts/qa-smartapp-walk.mjs      # 9/9
npx tsx scripts/sim-tour-day.ts --cleanup           # 🔴 드레인 경로는 하나다
```

⚠ **첫 워크는 콜드 컴파일로 실패할 수 있다** — 두 세션 연속 같은 자리에서 그랬다.
**화면부터 보고**(스크린샷) 웜 재주행하라.

---

## §8 이 감사가 남긴 자산

### 하니스 (신설 6 · 수리 4)

| 스크립트 | 무엇 |
|---|---|
| `qa-driver-walk.ts` **9/9** | 🔴 기사 여정 정본. 토큰→PIN→운행→콕핏→지연/분실물→**두 번째 브라우저를 손님으로 열어 도착 확인** |
| `qa-sse-reconnect.ts` **5/5** | realtime 을 막고 SSE 를 진짜 전송로로. abort(브라우저가 복구) vs 500(우리가 복구)을 **가른다** |
| `qa-midnight-meeting.ts` **4/4** | 집합 공지 둘(대조군 먼저)을 넣고 **손님 화면**에서 카운트다운을 읽는다 |
| `qa-plan-concurrency.ts` **6/6** | 한 스냅샷에서 두 번 저장 → 먼저 것이 사는지 |
| `qa-declared-props.ts` | 선언만 하고 안 읽는 prop. 0건이면 exit 0, **검사한 게 0이면 exit 2** |
| `qa-live-silence.ts` | 기능별 **진짜 손님** 사용 횟수(발송 시작 후에 값이 생긴다) |
| `sim-seat-door.ts` | 좌석 문 전제를 **실행 가능하게** ⚠ 투어일을 내일로 민다 |
| 수리 4 | `qa-course-classification`(env 로더 부재로 내내 exit 2) · `qa-smartapp-walk`(**항상 exit 0**) · `qa-home-walk` · `qa-caller-absence`(**두 번째 원장이 눈멀게 함**) |

### 상설 게이트 (`__tests__/audit` **30종**)

이번 세션 신설 넷 — `planConcurrency`(서버+두 클라이언트 3면) ·
`wiringRatchet`(배선 인벤토리 2종을 **정체**로) · `declaredPropsScan`(**0** 고정) ·
그리고 `sseFallbackDefence`·`midnightMeeting` 확장.

🔴 **이 세션의 게이트 설계 교훈 셋:**
① **개수보다 정체** — 하나 고쳐지고 하나 생기면 개수 게이트는 초록이다
② **비-공허를 단정하라** — 워크가 깨져 0을 재면 모든 상한이 통과한다
③ 🔴 **게이트가 자기가 지키는 스캔을 눈멀게 할 수 있다** — `__tests__/**` 는
route-coverage 의 코퍼스라 **게이트에 라우트 URL 을 적으면 그 라우트가 "커버됨"이 된다.**
그래서 래칫은 **자기 소스를 읽어** 라우트 리터럴 0을 단정한다. "기억하기"는 메커니즘이 아니다.
