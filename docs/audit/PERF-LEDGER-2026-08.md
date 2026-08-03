# PERF-LEDGER — 스마트앱 성능 감사 원장 (2026-08)

> 플랜: `docs/smartapp-performance-audit-plan-2026-08-03.md`
> **감사와 수정은 분리한다.** 여기엔 발견만 적고, 수정은 P6 에서 한 건 = 한 PR 로 한다.
> 모든 숫자에 **[실측] / [계산] / [추정]** 을 표시한다. 추정은 원칙적으로 쓰지 않는다.

## 측정 조건 (이걸 안 적으면 숫자가 쓸모없어진다)

| 항목 | 값 |
|---|---|
| 코드 | `origin/main` @ `a8dc24a8` · 브랜치 `claude/smartapp-perf-audit-2026-08-03` |
| 서버 | `npm run build`(exit 0) + `npx next start -p 3182` — **프로덕션 빌드** |
| 클라이언트 | Playwright Chromium · 390×844 모바일 · **콜드 캐시(라우트마다 새 컨텍스트)** |
| 4G 프로파일 | 4 Mbps↓ · 3 Mbps↑ · RTT 70ms · **CPU 4x 스로틀** |
| slow4g 프로파일 | 1.6 Mbps↓ · 0.75 Mbps↑ · RTT 150ms · CPU 4x |
| 데이터 | `sim-tour-day` 2방 + `sim-lobby-booking` 1방 (실데이터, `sim_tag` 격리) |
| 통계 | 3회 중앙값 |
| 🔴 한계 | **실기기 아님.** 스로틀은 재현 가능한 대리값이다. 실기기 측정은 사람 게이트로 남는다 |

---

## P-01 🔴 룸 진입이 4G 성능 예산을 넘는다 — §F #4 최초 실측, 미달

**증상.** 손님이 초대 링크를 열고 실제로 쓸 수 있게 되기까지 **4G에서 2.9~3.2초**.
§F 예산은 **< 2.5s (4G)** 다. 이 지표는 그동안 **한 번도 측정된 적이 없었다**
(`A0-perf-baseline.md` 가 "미측정 6/10" 로 남겨둔 항목).

| 라우트 | 4G 첫 유의미 | 예산 | 판정 | slow4g 첫 유의미 |
|---|---|---|---|---|
| 룸(진행 중 투어) | **2,909 ms** | 2,500 ms | ❌ **+409 ms (16% 초과)** | **5,553 ms** |
| 룸(로비, D-1) | **3,164 ms** | 2,500 ms | ❌ **+664 ms (27% 초과)** | **5,454 ms** |
| 가이드 콘솔 | 2,454 ms | (예산 없음) | — | 4,929 ms |

[실측] 3회 중앙값 · `scripts/qa-perf-throttled.mjs`

🔴 **연결이 나빠지면 선형이 아니라 2배로 나빠진다** — 4G 2.9초 → slow4g **5.6초**(1.9배).
JS 페이로드가 지배적일 때 나타나는 모양이다(대역폭이 절반이면 다운로드가 두 배).
제주 시골 구간·버스 이동 중이 정확히 slow4g 쪽이고, 예산의 근거가
*"버스 하차 직전 30초 안에 정보 확인"* 이므로 **실사용에서 더 나쁜 쪽이 기본값에 가깝다.**

**분해 — 병목은 서버가 아니라 전부 클라이언트다.**

| 구간 | 룸(live) | 읽는 법 |
|---|---|---|
| TTFB | **7 ms** | 서버는 즉답한다. 여기엔 문제가 없다 |
| FCP | 2,832 ms | 첫 픽셀까지 2.8초 — **이 구간이 사실상 전부** |
| 첫 유의미 | 2,909 ms | FCP 직후 바로 사용 가능해진다 |
| LCP | 3,548 ms | 최대 요소는 더 늦다 |

**TTFB 7ms → FCP 2,832ms.** 그 사이에 서버 작업은 없다. 오직 **612 KB JS 의 다운로드·파싱·실행**과
그 뒤의 `join` 왕복뿐이다 [실측 + 코드 실측].

**원인 (코드 실측).** `app/(app)/tour-mode/room/[bookingId]/page.tsx` 는 `force-dynamic` 인데
**서버에서 데이터를 하나도 읽지 않고** `TourRoomClient` 만 렌더한다. 즉 손님은
**HTML → JS 다운로드 → 파싱/실행 → join API → snapshot → 렌더** 를 **직렬로** 기다린다.
서버가 7ms 에 답할 수 있다는 것은, 그 시간에 스냅샷을 같이 실어 보낼 여지가 있다는 뜻이다.

**영향.** 손님 전원. 그리고 §F 예산의 근거가 *"버스 하차 직전 30초 안에 정보 확인"* 이므로
이 초과는 실사용 시나리오를 직접 침해한다.

**게이트 가능:** ✅ `qa-perf-throttled.mjs --check` 로 예산 게이트화 가능(현재 `--check` 미구현, P6).

---

## P-02 룸 JS 612 KB — 예산은 지키지만 P-01 의 직접 원인

| 값 | 출처 |
|---|---|
| 룸 first-load JS **205 KB (gzip)** | `A0-perf-baseline.md` [실측, 2026-07-25] |
| 룸 라우트 JS 전송 **612.2 KB** | 이번 실측 (무스로틀 완주, `qa-bundle-baseline`) |
| §F 예산 | < 350 KB gzip |

두 숫자는 **모순이 아니다** — 205 KB 는 gzip first-load, 612 KB 는 소켓이 실어 온 전체 JS(26 요청).
**예산 자체는 통과**이나, P-01 의 2.8초가 이 페이로드의 다운로드·파싱·실행 시간이다.
⚠ 이전 베이스라인 606 KB → **612.2 KB** 로 6.2 KB 늘었다(main 이동분). 게이트가 없어 조용히 늘었다.

**게이트 가능:** ✅ 라우트별 JS KB 상한.

---

## P-03 가이드 콘솔 — FCP 676ms 인데 사용 가능까지 2,454ms

[실측, 4G] 첫 픽셀은 0.7초에 뜨는데 `staff-shell` 이 준비되기까지 **1.8초가 더** 걸린다.
손님 룸(FCP 2,832 → 유의미 2,909, 격차 77ms)과 **모양이 완전히 다르다** —
룸은 "늦게 뜨고 바로 쓸 수 있음", 가이드는 "빨리 뜨고 오래 못 씀".
후자가 사용자에게 더 나쁘다(뜬 화면을 눌렀는데 반응이 없다).

**원인:** 미판별. P5 에서 렌더 프로파일 필요.

---

## P-04 관제 콘솔 TBT≈ 848ms · 요청 105건

[실측, 4G] 앱에서 가장 무거운 표면. long task 6건, 총 차단 근사 **848 ms**.
무스로틀 전송량도 **JS 768 KB / 총 3,179 KB / 87 요청** 으로 최대 [실측].
⚠ 다만 관제는 **손님이 아니라 사무실 데스크톱**에서 쓴다 — 우선순위는 손님 < 스태프 < 관제 순.

---

## P-05 중복 API 3건 (2건은 기존 발견 재현, 1건은 신규)

| 호출 | 라우트 | 상태 |
|---|---|---|
| `…/join ×2` | 손님 룸(live·lobby 둘 다) | **기존 발견 재현.** 설계된 동작(TTS 능력 보고)이나 effect deps 에 `locale` 이 있어 **로케일 변경마다 1회 추가** — 앞 감사가 P3 로 남김 |
| `/api/currency/rate ×2` | 관제 | **기존 발견 재현.** 미판별 |
| `/api/analytics/experiments/active ×2` | 관제 | 🆕 **이번에 처음 관측**(1회차 런에서만 나타남 — 재현성 확인 필요) |

---

## P-06 🔴 성능 아님 — 차량이 배정된 예약은 **삭제가 구조적으로 불가능하다**

성능 감사 중 시뮬 드레인이 실패하면서 드러났다. 성능 문제가 아니라 **데이터 무결성 결함**이라
여기 적어 두고, 수정은 이 트랙 밖이다.

**스키마 (라이브 실측, `pg_constraint`):**
```
ops_room_vehicles_anchor_present   CHECK (group_id IS NOT NULL OR room_id IS NOT NULL)
ops_room_vehicles_room_id_fkey     FOREIGN KEY (room_id)  → tour_rooms(id)      ON DELETE SET NULL
ops_room_vehicles_group_id_fkey    FOREIGN KEY (group_id) → ops_tour_groups(id) ON DELETE CASCADE
tour_rooms_booking_id_fkey         FOREIGN KEY (booking_id) → bookings(id)      ON DELETE CASCADE
```

**체인:** `bookings` 삭제 → CASCADE → `tour_rooms` 삭제 → `ops_room_vehicles.room_id` **SET NULL** →
그 행은 `group_id` 도 NULL 이라 **CHECK 위반** → 트랜잭션 롤백 → **예약 삭제 전체가 실패한다.**

**즉 룸에 차량이 배정된 예약은 지울 수 없다.** 방-앵커 차량(`group_id` NULL, `room_id` 있음)은
전세/프라이빗 투어의 정상 형태다.

**실제 발생:** 오늘 `sim-tour-day.ts --cleanup` 이 이 제약으로 **exit 1** 로 죽었다 [실측].
에러 원문: `new row for relation "ops_room_vehicles" violates check constraint
"ops_room_vehicles_anchor_present"`. 문서화된 드레인 경로가 막힌 것이므로
**이 함정은 시뮬을 쓰는 다음 세션마다 재발한다.**

**영향:** 예약 취소·삭제 경로 · 개인정보 삭제 요청(GDPR 식) · 시뮬 드레인.
현재 `ops_room_vehicles` 총 2행뿐이라 운영 폭발이 안 났을 뿐이다 [실측].

**우회(오늘 쓴 것):** 해당 `ops_room_vehicles` 행을 먼저 지우고 드레인 재실행 → 성공
(15건 제거 · 잔여 0 · 고아 0). ⚠ 사장님의 `manual-test-2026-07` 11건은 건드리지 않았다(확인함).

**후보 수정:** `room_id` FK 를 `ON DELETE CASCADE` 로(차량 배정은 룸 없이는 의미가 없고,
`group_id` 는 이미 CASCADE 다). **DDL 이므로 사장님 확인 후.**

**게이트 가능:** ✅ 삭제 왕복 테스트(예약 생성 → 차량 배정 → 삭제)가 이걸 영구히 막는다.

---

## 재현 방법

```bash
npm run build && npx next start -p 3182
ALLOW_SIM_SEED=1 npx tsx scripts/sim-tour-day.ts
ALLOW_SIM_SEED=1 npx tsx scripts/sim-lobby-booking.ts
WALK_BASE=http://localhost:3182 node scripts/qa-perf-throttled.mjs --profile 4g --runs 3 --out
WALK_BASE=http://localhost:3182 node scripts/qa-bundle-baseline.mjs        # 무스로틀 바이트 정본
npx tsx scripts/sim-tour-day.ts --cleanup                                   # 🔴 드레인
```

---

## 아직 미측정 (§F 예산 중)

| 지표 | 예산 | 막는 것 |
|---|---|---|
| 메시지 전송 → 화면 반영 | < 300ms | 하니스에 상호작용 계측 추가 필요 |
| 카드 탭 → 시트 열림 | < 150ms | 위와 동일 |
| 컨시어지 Tier1 | < 4s | 실 LLM 비용 — **사장님 승인 필요** |
| 다이닝 HIT / MISS | < 600ms / 미확정 | warm 셀 필요 |
| 라우트 p50/p95 (손님 핵심 20) | — | 서버 부하 하니스 필요 |
| 투어당 LLM/Kakao 호출 | < 30 / < 20 | **계측은 켜져 있고 실투어 트래픽이 0** |

**시뮬 불가(구조상)** — 동시 리얼타임 연결 상한 · SSE 폴백 증폭 · 콜드스타트 ·
실기기 백그라운드 타이머 스로틀. `BUNDLE-BASELINE.md` 의 자백과 동일하다.
