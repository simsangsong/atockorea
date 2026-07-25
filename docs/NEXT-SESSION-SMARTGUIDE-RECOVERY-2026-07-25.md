# 인수인계 — Smart Guide 복구 + 관제센터 구현 (2026-07-25)

> **이 문서 하나만 읽고 이어받을 수 있게 쓴다.** 원 지시서는
> `C:\Users\sangsong\Downloads\smartguide-bugfix-handoff.md`.

## 0. 환경 — 먼저 확인할 것

| 항목 | 값 |
|---|---|
| 워크트리 | `C:\Users\sangsong\atockorea-main-merge` |
| 브랜치 | `fix/smartguide-recovery-2026-07-25` (22커밋, **아직 push 안 함**) |
| Supabase | ✅ **`mcp__atockorea__*` = `cghyvbwmijqpahnoduyv`** 만 사용 |
| 🛑 금지 | `mcp__kursoflow__*` 와 이름 없는 UUID MCP — 둘 다 `thgyevrqykkscvcpwmfp`(Kursoflow) |
| 게이트 | `npx tsc --noEmit` (0) + `npx jest` (**4029 pass** / 1 skip) |
| 로컬 dev | `npx next dev -p 3160 --webpack` · `.env.local`에 `NEXT_PUBLIC_TOUR_MODE_V1=1` 이미 추가됨 |

**시뮬 데이터**: `ALLOW_SIM_SEED=1 npx tsx scripts/sim-tour-day.ts` → 끝나면
**반드시** `--cleanup`. 라이브 DB에 쓰므로 잔여 확인까지.

---

## 1. 완료된 것 (재작업 금지)

### PHASE 0~1 (P0 전부)
| 항목 | 진짜 원인 | 커밋 |
|---|---|---|
| P0-2/3 번역 | 감사 `e9a999a0`이 translate 출력 cap을 1200으로 강제 → 다국어 JSON 잘림 → 원문 폴백. **유일하게 감사가 깨뜨린 것** | `46946601` |
| P0-1 자막 | 자막 STT가 오디오 미지원 모델(`gemini-2.5-flash-lite`/`gpt-5-mini`)에 `input_audio` 전송 → 10/10 실패. Whisper 직행으로 변경 | `8e5e2306` |
| P0-4 알림 | `push_subscriptions.user_id NOT NULL` — 손님은 로그인 유저가 아님. **VAPID는 무관**(기존 키도 유효했음) | `33e552c9` `dada8e66` |
| P0-5 일정 | 리졸버가 locale 없이 `name_en` 하드코딩 + 실사용 경로는 단일언어 `tours.schedule` | `62b73927` `b524707f` `d8de2329` |
| P0-6 TTS | WebAudio만 unlock, 재생은 매번 새 `Audio()` → iOS/웹뷰 차단 | `91156224` |

### PHASE 2 (P1 전부)
`0e531653`(P1-1/P1-4) `a0e78b10`(P1-2/P1-3) `85305c87`+`b0930224`(P1-5)
`1f5234a5`(P1-6) `6acbb0e5`(P1-7) `8bdebfdd`(P1-8) `50c0af3b`(P1-3 기사)

### 추가 작업
- `307f3218` 기사 위치공유·주차핀 (지오로케이션 전략 + 정직한 상태 표시)
- `45ca4f98` 콕핏 카톡식 `+` 트레이 · `39ce87ee` 손님 컴포저 트레이 + 주얼톤

### 적용된 마이그레이션 (라이브)
- `push_subscriptions_guest_user_id_nullable`
- `tour_room_locations_driver_role`

---

## 2. 남은 일 — 우선순위 순

### 🔴 A. 관제센터 P2 모듈

**전수 조사 결과 "구현된 것 없음"은 사실이 아니다. 8개 중 5개가 이미 상당 부분 있다.**
설계안: `docs/ops-center-dashboard-design-2026-07-25.md` (단, §0의 "이미 있는 것" 표는
아래 실측으로 갱신할 것).

| 모듈 | 실제 | 남은 일 |
|---|---|---|
| 가이드 배정 | **~85%** — `ops_guide_assignments`, API 4종(`/api/admin/guides/assignments`, `.../[id]`, `/recommend`), `/admin/guides` 배정 탭, `GuideAssignmentsPanel` | **충돌 차단 없음**(API·DB 양쪽). 투어-우선 배정 화면 없음. `assigned_by`/`assigned_at` 컬럼 없음. 시간 겹침은 `bookings.tour_time` 조인 필요(테이블은 date-only) |
| 차량 배차·종류선택 | **~70%** — `OpsRoomVehiclePanel`(716줄, 충돌 409 프로토콜+undo), `/admin/vehicle-layouts`(895줄 좌석맵 에디터) | **`ops_vehicles` 마스터 테이블 없음** ← 최대 병목. 중복배차 감지 불가. 날짜별 배차 보드 없음. 차종은 `ops_vehicle_layouts.model` 5값 CHECK(`county_20`/`solati_16`/`limo_27`/`bus_35`/`bus_45`) |
| 월간 예약 내역 | **거의 완성** — `OpsBookingsOverview` + `/api/admin/tour-ops/bookings-overview`(CSV 포함), 예약 탭에 이미 마운트 | 선택: 평면 테이블 뷰 |
| 투어룸 생성 내역 | **~50%** — `/api/admin/tour-ops/rooms?date=`, `OpsRoomManager`(792줄) | **일자별만.** 월 범위 API + 목록 화면 필요 |
| 가이드 근무 달력 | **~40%** — `GuideRestCalendar`(월 그리드, 1인), `/api/admin/guides/[id]/unavailable?year=&month=` | **전체 가이드 매트릭스 없음**(행=가이드, 열=일) |
| **배차 달력** | **0%** | 월 범위 배차 API + 화면. 설계안: 근무달력과 **한 컴포넌트 두 축**으로 |
| **오토파일럿** | **0%** | ⚠️ `lib/ops/parse/autopilot-trigger.ts`는 **OTA 파서용 동명이인** — 재사용 금지. 큐 테이블 + 감지기 + 원탭 승인. **자동 실행은 MVP 제외**(설계안 §1-7) |

**착수 순서 (조사 에이전트 권고 = 설계안과 일치):**
1. `ops_vehicles` 마스터(additive 마이그레이션 + CRUD + 간단 목록) ← 병목 해소
2. 가이드 배정 충돌 규칙 (API 검증 + DB 제약 **둘 다**, 설계안 §1-1)
3. 투어룸 생성 내역 월간 뷰 (신규 스키마 0)
4. 달력 2종 (`GuideRestCalendar` + `lib/ops/bookings/ranges` 재사용, 읽기 전용)
5. 오토파일럿 (제안 전용)

**관제 UI 진입점**: `components/tour-ops/OpsApp.tsx` — 탭 union `:45`, 배열 `:321`,
렌더 `:387-427`. 탭은 이미 6개라 `flex-1`이 좁다. **달력·생성내역은 새 탭 말고
전체화면 시트 패턴**(`managerOpen`/`inboxOpen`, `:64-70`+`:429-445`)으로.

### 🟡 B. P1-5 CJK — 잔여
전역 안전망(`app/globals.css` `.admin-root :is(button,th,label,dt,summary,[role=tab])`)
+ 구조 수정(DataTable/orders/merchants/filings에 `min-w`) 적용 후 **10개 어드민 경로에서
세로배열 0건** 확인. 검증 스크립트: `npx tsx scripts/qa-admin-cjk.ts`.

남은 것: `min-w` 없는 표가 **아직 5개** — `ops-finance/periods/[period]`(2개),
`support`, `analytics/product/retention`, `tour-ops/no-show-evidence`.
`app/admin/**`에 뱃지 `<span>` 49개는 CSS 안전망 밖(=span 미포함). 세로배열은
현재 0건이지만 더 좁은 화면에서 재발 가능 → 필요 시 `.text-cjk-safe` 개별 적용.

### 🟡 C. 손님 트레이 확장
`Composer`가 `extraActions?: ActionGridItem[]`를 받는다. 현재 타일 2개(사진·파일 /
사진 질문)뿐. **`TourRoomClient`에서 스마트가이드·긴급·빠른신호를 내려주면** 손님
쪽도 콕핏처럼 풍성해진다. (`RoomShellChatApi.openConcierge` 이미 존재)

### 🔴 D. 실기기 검증 (코드로 못 닫음)
시뮬레이터가 재현 못 하는 것: **마이크(자막방송)·TTS 실제 재생·푸시 실제 도착·
GPS 정확도/권한 거부**.
- P0-6 TTS는 prod에 **`OPENAI_API_KEY`** + **`tour-audio` 스토리지 버킷**(마이그레이션이
  만들지 않음 — 수동 생성 대상) 필요.
- P0-4는 VAPID 3종이 Vercel에 있고 **재배포** 필요(`NEXT_PUBLIC_`은 빌드타임).

### 🟢 E. 미해결 인프라
- **OTA 이메일 수신 주소 설정 UI** (지시서 PHASE 3) — 미착수. `OpsSettingsTab.tsx` 존재.
- **가이드 주소 암호화 키** — 새로 만들지 말 것. 기존 봉투 `lib/ops/guides/pii.ts`,
  env `OPS_GUIDE_PII_ENC_KEY`(폴백 `GUIDE_PII_ENC_KEY`). 라이브 암호화 데이터 0건이라
  지금 설정은 안전하나 **한 번 설정 후 절대 교체 금지**. `ops_guides`에 `address_enc`
  컬럼은 **아직 없음**.

---

## 3. 이 저장소에서 배운 것 (반복하지 말 것)

1. **감사 가드 테스트가 진짜로 잡는다.** `__tests__/audit/singleSourceOfTruth.test.ts`
   (로케일 배열 중복), `a1Coverage.test.ts`(신규 컴포넌트 원장 등록). 새 컴포넌트를
   `components/tour-mode/`에 만들면 `docs/audit/A1-coverage.md`에 행을 추가해야 통과.
2. **검증 스크립트가 인증에 실패하면 조용히 0건을 보고한다.** 이 앱은 **쿠키 세션**
   (`@supabase/ssr`) — localStorage 주입은 무효. `scripts/qa-admin-cjk.ts`가 올바른
   쿠키 주입 예시.
3. **"성공한 척하는 실패"가 이 코드베이스의 주 패턴이다.** 위치공유가 `watching`이면
   "공유 중"이라 했지만 100m 필터로 전송 0건이었고, 주차핀은 pin insert 에러를 무시하고
   201+✓를 냈다. 새 기능마다 **"서버가 실제로 받았는가"를 UI 상태로 쓸 것.**
4. **일괄 치환 금지** — 이번 사고의 원인. CSS/프리미티브 레벨로 해결할 것.
5. **커밋 푸터에 모델 식별자 금지.** `Co-Authored-By: Claude <noreply@anthropic.com>`만.
6. 보고는 한국어, 코드·커밋은 영어.

---

## 4. 검증 하니스 (이미 있음)

| 스크립트 | 용도 |
|---|---|
| `scripts/qa-recovery-p4.ts` | 손님 5언어 + 가이드 역할 게이팅 (13 PASS/0 FAIL) |
| `scripts/qa-admin-cjk.ts` | 어드민 10경로 CJK 세로배열 측정 (현재 0건) |
| `scripts/qa-cockpit-tray.ts` | 콕핏 트레이 라이트/다크 캡처 |
| `scripts/qa-guest-tray.ts` | 손님 컴포저 트레이 캡처 |
| `scripts/qa-ios-smoke.ts` | 기존 iOS 스윕 — ⚠️ set-route 투어에서 "Pick places" 탭 대기하다 멈춤(픽스처 불일치, 코드 버그 아님) |
