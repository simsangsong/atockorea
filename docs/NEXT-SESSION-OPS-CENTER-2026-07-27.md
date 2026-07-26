# 인수인계 — 관제센터·정산·손님 안내 이후 (2026-07-27)

> **이 문서 하나만 읽고 이어받을 수 있게 쓴다.**
> 직전 트랙: `docs/ops-center-settlement-upgrade-plan-2026-07-25.md` (v2, W1~W11 + M1~M5)
> 전 구간 지도: `docs/ops-guest-message-chain-2026-07-26.md` ← **손대기 전에 이걸 먼저**

## 0. 환경

| 항목 | 값 |
|---|---|
| 브랜치 | main (PR #459 §4 1~8번 · PR #460 렌트 운영 정정 — 둘 다 머지·배포 완료) |
| 워크트리 | `C:\Users\sangsong\atockorea-ops-next` (node_modules는 `atockorea-main-merge`에서 정션 — 🔴 삭제 시 정션 먼저 끊을 것) |
| Supabase | ✅ `mcp__atockorea__*` = `cghyvbwmijqpahnoduyv` 만 사용 |
| 🛑 금지 | `mcp__kursoflow__*` 와 이름 없는 UUID MCP — 둘 다 Kursoflow. **코드 참조는 디스크**(`C:\Users\sangsong\kursoflow-app`)로만 |
| 게이트 | `npx tsc --noEmit` 0 · `npx jest` **4448 pass / 21 skip** · **`npx next build --webpack` exit 0** |
| 라이브 검증 | `npx tsx scripts/qa-ops-center-queries.ts --cleanup` (15검사) |
| 화면 검증 | `npx tsx scripts/qa-admin-cjk.ts` (세션 없으면 **exit 2**) |

### 🔴 `tsc` 통과 ≠ 배포 가능

`next build`는 **라우트 모듈이 핸들러 외 export를 갖는 것**을 거절하는데 `tsc --noEmit`은 통과시킨다.
직전 세션에서 이걸로 배포가 깨질 뻔했다(`ea3d738e`가 그 수정). **머지 전 반드시 `next build`를 돌린다.**

---

## 1. 직전 세션이 한 것 (재작업 금지)

### 관제센터 W1~W5
- **W1 `ops_vehicles`** 차량 마스터 + CRUD + `/admin/vehicle-layouts` 차량 탭
- **W2 배정 충돌 차단** — 순수 판정(`lib/ops/guides/conflicts.ts`) + **DB 트리거**. 규칙 7(단가 미설정)이 배정 시점에 경고
- **W3 투어룸 월간 뷰** — 기본 필터 **미입장**
- **W4 근무·배차 달력** — 한 컴포넌트 두 축(`OpsScheduleCalendar`)
- **W5 오토파일럿** — 제안 전용, 6종 탐지. `ops_autopilot_suggestions`

### 정산 체인
- **의존성 0 xlsx 작성기**(`lib/ops/export/xlsx.ts`) → 세무 서식 4종·지급명세·달력·룸내역
- **일괄 worked**(`assignments/bulk`) — 정산이 비던 최대 원인
- **가이드별 원천징수영수증**(`?guideId=`)
- **가이드 배정 안내 메일**(`assignments/notify`) + `notified_at`

### 손님 안내 M1~M5
- **날씨 자동 삽입** — Open-Meteo(키 불필요), `ops_weather_cache`, 토큰 `{weather}` `{clothing}`
- **이메일 원버튼 일괄** — 미리보기→발송, 제외자 사유 표시
- **투어별 문구 오버라이드** — `ops_tour_message_templates`, 편집 자리에서 저장
- 관제 홈 **[손님 안내 보내기]** 타일

### 그 외
- CJK 잔여(표 5·뱃지 9) 0건 확인 · 손님 트레이 2타일 · **어드민 사이드바 23→6그룹**

### 🔴 이미 있으니 다시 만들지 말 것
왓츠앱 순차 발송(wa.me + opened 로그 + [다음 열기]) · 개인 토큰 링크 · 명단 픽업 그룹핑 ·
3.3% 원천징수 산식 · 세무 서식 4종 · 월 정산 멱등 배치 · 원장 기입.
⚠️ `lib/ops/parse/autopilot-trigger.ts`는 **OTA 파서용 동명이인** — 관제 오토파일럿과 무관.

---

## 2. 🔴 직전 세션이 남긴 갭 — **2026-07-26 전부 닫힘**

> 아래 2-1~2-8은 브랜치 `claude/ops-next-additions`에서 8커밋으로 전부 구현됐다.
> 워크트리 `C:\Users\sangsong\atockorea-ops-next`. 게이트 통과:
> `tsc` 0 · `jest` **4430 pass / 21 skip** · `next build --webpack` exit 0 ·
> `qa-ops-center-queries.ts --cleanup` **15 PASS / 0 FAIL** (라이브 잔여 0).
> **prod 스키마 변경 없음** — 전부 코드 변경이다(`vehicle_id` 컬럼은 이미 있었다).
>
> | 갭 | 무엇을 했나 | 커밋 |
> |---|---|---|
> | 2-1 | 배차 패널 "등록된 차량에서 고르기" → `ops_room_vehicles.vehicle_id` 기입. 마스터 연결 시 번호판은 마스터가 정본(자유 입력 닫힘), 용차는 텍스트 유지 | `66c2fea0` |
> | 2-2 | **좌석을 줄이는 저장만** 하드 블록(409 `capacity_short`) + 사유 입력 시 통과·기록. 배치도/마스터 교체와 배차 해제 양쪽 | `eedaa7bb` |
> | 2-3 | 오토파일럿 점검을 **일일** 크론(`ops-daily-report`, 18:00 KST)에 편입. 결과가 같은 요청의 일일 보고서 ⑤ 요주의에 실린다 | `8aa52515` |
> | 2-4 | `ops_weather_cache` 퍼지(투어일 +7일) — flywheel 퍼지 단계 ⑧ | `ebaac91a` |
> | 2-5 | 배정 안내 메일에 셀프 스케줄 링크. URL 조립은 `issueGuideScheduleLink` 한 곳 | `bf2b3ecf` |
> | 2-6 | 명단이 채널을 갈라 읽는다(이메일 로그가 왓츠앱 상태를 오염시키던 **라이브 버그** 수정) + 손님별 메일 이력·실패 사유·카운터 | `501fc7a3` |
> | 2-7 | 명단에서 왓츠앱 문구 편집·되돌리기(6로케일) | `6cbf0e54` |
> | 2-8 | 예약 내역 xlsx(요약·상세 2시트), CSV와 같은 리졸버·같은 행 | `77a9ec48` |
>
> 아래 원문은 **왜 그게 문제였는지**의 기록으로 남긴다. 다시 만들지 말 것.

### 2-1. 차량 마스터가 배차와 **연결돼 있지 않다** ← 최우선

`ops_vehicles`(마스터)와 `ops_room_vehicles.vehicle_id`(FK) 를 만들었지만,
**배차 화면(`OpsRoomVehiclePanel`)이 그 FK를 채우지 않는다.** 결과:

- 배차 달력의 **차량 축이 항상 비어 있다**
- **중복 배차 감지가 영원히 발동하지 않는다** — W1이 풀려던 바로 그 문제
- 오토파일럿 `capacity_over`도 마스터 정원을 못 본다

⚠️ **이름 충돌 주의**: 배차 라우트의 요청 파라미터 `vehicle_id`는 **`ops_room_vehicles.id`**(배차 행 id)이고,
내가 추가한 컬럼 `ops_room_vehicles.vehicle_id`는 **`ops_vehicles.id`**(마스터 id)다. 같은 이름, 다른 것.
건드리기 전에 `app/api/admin/tour-ops/rooms/[roomId]/vehicles/route.ts:361` 을 읽을 것.

**해야 할 일**: 배차 UI에 "등록된 차량에서 고르기" 드롭다운 → `ops_room_vehicles.vehicle_id` 설정.
마스터 미등록(용차)은 지금처럼 `plate_number` 텍스트로 남긴다(그 폴백은 의도된 설계).

### 2-2. 정원 초과가 하드 블록이 아니다
설계안 §1-2는 "정원 초과 → 하드 블록(안전 문제)"인데, 현재는 오토파일럿 **경고**뿐이다.
좌석수 < 인원인 배차가 그대로 저장된다. (2-1을 먼저 해야 정원을 알 수 있다.)

### 2-3. 오토파일럿이 수동이다
`vercel.json`에 크론이 없다. [지금 점검]을 누르지 않으면 제안이 생기지 않는다 —
"안내 미발송" 같은 임박 항목이 아무도 안 누르면 무의미하다. 기존 `tour-room-flywheel` 크론에 얹으면 된다.

### 2-4. 예보 캐시가 무한 증가
`ops_weather_cache`에 퍼지가 없다. 하루 3행씩 쌓인다(느리지만 영구). flywheel 크론의 퍼지 단계에 추가.

### 2-5. 배정 안내 메일에 셀프 스케줄 링크가 안 붙는다
`noticeBody`가 `scheduleLink`를 받도록 돼 있지만 라우트가 채우지 않는다.
`/api/admin/guides/[id]/schedule-link`가 이미 있으니 발급해서 넣으면 된다.

### 2-6. 이메일 발송 이력을 보는 화면이 없다
`ops_whatsapp_send_logs`에 `channel='email'`로 남지만, 명단 화면은 **왓츠앱 상태만** 표시한다.
"이 손님에게 메일 갔나"를 화면에서 못 본다.

### 2-7. 투어별 문구 저장이 이메일 채널만
왓츠앱 채널 오버라이드는 API(`tour-templates`)로는 되지만 저장 UI가 없다.

### 2-8. 월간 예약 내역 엑셀 없음
`bookings-overview`는 CSV만. xlsx 엔진은 이미 있으니 붙이기만 하면 된다.

---

## 3. 사람이 해야 하는 것 (코드로 못 닫음)

### 3-1. `OPS_GUIDE_PII_ENC_KEY` 설정 — 🔴 한 번 넣으면 교체 금지
- 없으면 주민번호·계좌 저장이 **거부**된다(fail-closed, 의도된 동작). 나머지 정보는 지금도 저장된다.
- 값: 아무 문자열(SHA-256으로 32바이트 파생). 폴백 이름 `GUIDE_PII_ENC_KEY`.
- 넣을 곳: **Vercel 환경변수(Production + Preview)** + 로컬 `.env.local`. **커밋 금지.**
- 라이브 암호화 데이터 **0건**이라 지금 넣는 것은 안전하다.
- ⚠️ **교체하면 기존 `rrn_enc`/`bank_account_enc`가 전부 복호화 불능**이 된다.

### 3-2. 실기기 리허설
시뮬레이터가 재현 못 하는 것: **마이크(자막방송)·TTS 실제 재생·푸시 실제 도착·GPS 권한 거부.**
- TTS는 prod에 **`OPENAI_API_KEY`** + **`tour-audio` 스토리지 버킷** 필요
  (마이그레이션이 만들지 않는다 — **수동 생성 대상**)
- 푸시는 VAPID 3종이 Vercel에 있고 **재배포** 필요(`NEXT_PUBLIC_`은 빌드타임)

### 3-3. 세무 서식 CPA 검수
`ops_finance_config.expert_reviewed=false` 인 동안 모든 산출물에 **DRAFT**가 찍힌다.
세무사 확인 후 사람이 그 값을 바꾼다. 🔴 자율 제출 금지.

### 3-4. 첫 데이터 입력 (없으면 화면이 비어 보인다)
현재 라이브: 가이드 **1명**, 차량 **0대**, 단가 **0건**, 배정 **0건**.
1. `/admin/vehicle-layouts` → 차량 탭 → 실제 차량 번호판 등록
2. `/admin/guides` → 단가 탭 → **테넌트 기본단가**(guide_id NULL)를 투어유형별로 1건씩
   — 이게 없으면 배정마다 "단가 미설정" 경고가 뜬다
3. 가이드 이메일 채우기 — 없으면 배정 안내 메일이 안 나간다

### 3-5. GitHub CLI (선택)
`winget install GitHub.cli` → `gh auth login`. 있으면 다음 세션부터 PR을 직접 만들 수 있다.

---

## 4. 추가하면 좋은 것 — **1~8번 전부 완료 (2026-07-26)**

§2 표를 볼 것. 1~8번(§2-1~2-8)은 브랜치 `claude/ops-next-additions`에 8커밋으로
들어갔고 세 게이트를 모두 통과했다. **다시 만들지 말 것.**

남은 것:

| 항목 | 왜 / 주의 |
|---|---|
| OTA 수신 주소 설정 UI | 미착수. `OpsSettingsTab.tsx` 존재. 화이트리스트는 **파싱 신뢰의 근거**라 여기 없는 발신자는 자동 확정 금지 |
| `ops_guides.address_enc` | 컬럼 자체가 아직 없다. 기존 봉투(`lib/ops/guides/pii.ts`) 재사용, 새 키 만들지 말 것 |

### 4-1. 이번에 새로 알게 된 것

- **`ops_whatsapp_send_logs`는 두 채널이 같이 사는 테이블이고 `opened_at`은
  NOT NULL DEFAULT now()다.** 채널을 안 거르고 읽으면 메일 한 통이 "왓츠앱을 열었다"가
  된다. 이 테이블을 새로 읽는 코드는 반드시 `channel`로 먼저 나눌 것
  (`channel` DEFAULT `'whatsapp'`이라 옛 행은 제자리에 온다).
- **정원 하드 블록은 "줄이는 저장"에만 건다.** 이미 모자란 상태를 막으면 2호차를
  붙이는 것까지 거부하게 되고, 그건 오버부킹을 고치러 온 사람의 손을 묶는다.
- **좌석수 미상은 판정하지 않는다.** 모르는 것을 근거로 저장을 거부하면 운영자는
  시스템을 우회하는 법부터 배우고, 그때부터 화면은 있지도 않은 좌석을 말한다.
- **순수 함수 테스트만으로는 "호출부가 안 채우는 인자"를 절대 못 잡는다.**
  §2-5가 정확히 그 모양이었다(계약도 테스트도 있었고 라우트만 비어 있었다).
  새 기능은 라우트/화면을 통과시키는 테스트를 한 개는 둘 것.
- **차량 배차의 `vehicle_id` 두 뜻**은 여전히 살아 있다. 요청 경계에서는
  `master_vehicle_id`(마스터)와 `vehicle_id`(배차 행 id)로 갈라져 있고, 순수 규칙은
  `lib/ops/vehicles/registry.ts`에 모여 있다.

### 4-2. 🔴 §2-1의 전제가 틀렸다 — PR #460으로 정정 (2026-07-26)

**이 운영은 차를 소유하지 않는다. 매번 렌트하고 차량 정보가 매번 바뀐다.**
(사용자 확정, 2026-07-26)

§2-1을 "보유 차량을 등록해 두고 고른다"로 만든 것이 오답이었다. 배차 시점에
확정된 것은 **차종·좌석수뿐**이고 번호판은 대개 당일에야 나온다. 정정 내용:

| 커밋 | 내용 |
|---|---|
| `621c332e` | **차량 타입이 1순위·필수, 그것만으로 배차 완결.** 번호판은 항상 옵션·항상 편집 가능. 등록 차량 피커는 아래로 강등하고 0대면 아예 숨김("등록된 차량이 없어요" 잔소리 제거 — 렌트에서 그건 정상 상태다) |
| `fa23f804` | 배차 달력 차량 축에 **타입 행** 추가 → "8월 3일 카운티 2대·쏠라티 1대". 같은 타입 2건은 2대 렌트지 충돌이 아니므로 타입 행은 overlap/double을 띄우지 않는다(등록 차량 행은 그대로 감지) |
| `3b4b2fb8` | 배차별 **차량 사진(옵션)**. private 버킷 `ops-vehicle-refs` 재사용(`room-vehicle/` 접두사), path 저장 + 단기 서명 URL. 🔴 스키마: `ops_room_vehicles.photo_path` additive nullable(prod 적용 완료) |

**지켜진 규칙:** 번호판을 등록 차량과 다르게 고치면 연결이 끊긴다(클라이언트+서버).
다른 번호 = 다른 차이고, 연결을 유지한 채 번호만 다르면 그때부터 기록이 어느
버스에 손님이 탔는지를 두고 거짓말을 시작한다. 표기만 다른 같은 번호는 여전히
같은 차다(그 정규화가 #459에서 중복 감지를 살린 것이고, 그대로 남아 있다).

⚠ **차량 사진은 두 개가 있고 목적이 다르다.** 기사 콕핏의 [차량사진](`Cockpit.tsx` B1)은
**손님 채팅으로 보내는** 것이고, `photo_path`는 **관제가 보관하는** 배차 기록이다.
합치지 말 것.

### 4-3. 사람이 해야 남는 것

§3에서 **§3-4의 차량 등록 항목은 더 이상 필수가 아니다** — 타입 행 덕분에 달력은
아무것도 등록하지 않아도 동작한다. 등록 차량은 "자주 쓰는 렌트 차"가 생겼을 때의
지름길일 뿐이다. 나머지(§3-1 키, §3-2 실기기, §3-3 세무 검수, 단가 기본값)는 유효하다.

---

## 5. 이 저장소에서 배운 것 (반복 금지)

1. **`tsc` 0 ≠ 빌드 통과.** 머지 전 `next build` 필수(§0).
2. **검증 스크립트가 인증에 실패하면 조용히 0건을 보고한다.** `qa-admin-cjk.ts`가 실제로 그랬고
   지금은 exit 2로 고쳤다. 쿠키 세션(`@supabase/ssr`)이라 localStorage 주입은 무효.
3. **"성공한 척하는 실패"가 이 코드베이스의 주 패턴이다.** 새 기능마다
   "서버가 실제로 받았는가"를 UI 상태로 쓸 것. 못 보낸 사람을 목록에서 지우지 말 것.
4. **일괄 치환 금지.** CSS/프리미티브 레벨로 해결.
5. **모르는 것을 아는 척하지 말 것.** 정원 미상은 0이 아니고, 예보 실패는 빈 문자열이 아니라
   줄 삭제이고, 단가 미설정은 0원이 아니다.
6. **워크트리 공유.** `git add -A` 금지, 경로 명시.
7. 커밋 푸터는 `Co-Authored-By: Claude <noreply@anthropic.com>` 만. **모델 식별자 금지.**
8. 보고는 한국어, 코드·커밋은 영어.
9. **한 테이블에 두 채널이 살면 반드시 채널로 나눠 읽어라.** `ops_whatsapp_send_logs`가
   실제로 그랬고, 안 나눈 코드가 메일 발송을 "왓츠앱 열었음"으로 보여주고 있었다.
10. **순수 함수 테스트는 "호출부가 안 채우는 인자"를 못 잡는다.** 계약도 있고 테스트도
    green인데 기능이 없는 상태가 실제로 있었다(§2-5). 표면 테스트를 하나는 둘 것.
11. 🔴 **운영의 실제 모양을 확인하고 기본 동선을 정해라.** §2-1을 "보유 차량 등록 →
    선택"으로 만들었는데 이 운영은 **차를 소유하지 않는다**(전부 렌트). 기능은 다
    동작했지만 기본 경로가 틀려서, 화면이 매번 "등록된 차량이 없어요"와 고치라는
    잔소리를 띄웠다. 코드가 맞아도 전제가 틀리면 화면은 매일 거짓말을 한다.
12. **"없음"이 정상 상태인 칸에 잔소리를 붙이지 마라.** 영구히 뜨는 안내는 안내가
    아니라 소음이고, 그 옆의 진짜 경고까지 같이 안 읽히게 만든다.

---

## 6. 다음 세션 프롬프트

§4 1~8번은 끝났다(브랜치 `claude/ops-next-additions`, 머지 대기).
이어받는 세션은 아래 중 하나다.

**(a) 머지부터:**

```
C:\Users\sangsong\atockorea-ops-next 의 claude/ops-next-additions 를 main에 머지해라.
머지 전 게이트 재확인: npx tsc --noEmit + npx jest + npx next build --webpack.
prod 스키마 변경은 없다(코드 전용). 머지·배포 직전에 알려라.
```

**(b) 남은 항목:**

```
C:\Users\sangsong\atockorea-ops-next, main에서 새 브랜치.
docs/NEXT-SESSION-OPS-CENTER-2026-07-27.md §4를 읽어라 — 1~8번은 이미 끝났다.
남은 것은 OTA 수신 주소 설정 UI와 ops_guides.address_enc 둘뿐이다.
후자는 기존 봉투(lib/ops/guides/pii.ts)를 재사용하고 새 키를 만들지 마라.

Supabase는 mcp__atockorea__* (cghyvbwmijqpahnoduyv)만 사용. kursoflow MCP는 금지.
게이트: npx tsc --noEmit (0) + npx jest (전부 통과) + npx next build --webpack (exit 0).
라이브 검증은 npx tsx scripts/qa-ops-center-queries.ts --cleanup (잔여 0 확인).
워크트리 공유 — git add -A 금지, 경로 명시. 커밋 푸터에 모델 식별자 금지. 보고는 한국어.
```

### 더 짧게 (한 항목만 시킬 때)

```
C:\Users\sangsong\atockorea-main-merge, main에서 새 브랜치.
docs/NEXT-SESSION-OPS-CENTER-2026-07-27.md 읽고 §2-1(차량 마스터 ↔ 배차 연결)만 해라.
§2-1의 vehicle_id 이름 충돌 경고를 먼저 확인할 것.
게이트: tsc 0 + jest 전부 + next build exit 0. Supabase는 mcp__atockorea__* 만.
```
