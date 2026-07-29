# 관제센터 · 정산 체인 · 어드민 IA — 통합 실행 플랜 v1 (2026-07-25)

> 이 문서는 `docs/NEXT-SESSION-SMARTGUIDE-RECOVERY-2026-07-25.md` §2 (A/B/C)에
> 사용자가 추가로 요구한 **가이드 단가→월말정산→세무서식→Excel 출력 체인**과
> **어드민 IA 재편**을 결합해 갱신한 **단일 실행 기준**이다.
> 설계 근거는 `docs/ops-center-dashboard-design-2026-07-25.md`(P2 설계안)이고,
> 참조 구현은 로컬 `C:\Users\sangsong\kursoflow-app`(코드만 — **kursoflow DB는 접근 금지**).

## 0. 착수 전 확인한 코드 리얼리티 (추측 아님)

| 영역 | 실제 상태 | 근거 |
|---|---|---|
| 3.3% 원천징수 산식 | **이미 포팅 완료** | `lib/ops/tax/withholding.ts` (kursoflow 산식 1:1, 절사 지점 동일) |
| 세무 서식 4종 | **이미 구현** — 원천징수이행상황신고서·간이지급명세서·원천징수영수증·연간지급명세서 | `lib/ops/tax/forms.ts` (427줄) |
| 월말 정산 배치 | **이미 구현** — worked 배정 집계 → 3.3% → `ops_guide_settlements` upsert(멱등) → `ops_entity_ledger` 기입 | `lib/ops/tax/settlement.ts` (498줄) |
| 가이드 단가 | **이미 구현** — `ops_guide_rates` 이력 테이블 + `resolveRate` + `GuideRatesPanel` | `lib/ops/guides/rates.ts` |
| 출력 형식 | **CSV(UTF-8 BOM)만.** 진짜 `.xlsx` 없음 | `forms.ts` §"xlsx 의존성을 뺐다" |
| 가이드 배정 | 테이블·API·화면 있음. **충돌 차단 0** | `app/api/admin/guides/assignments/route.ts` — insert 직행 |
| 차량 마스터 | **없음.** `ops_room_vehicles`는 룸 단위 인스턴스이고 `plate_number`가 자유 텍스트 | 라이브 스키마 확인 |
| 어드민 내비 | **23개 평면 항목** | `app/admin/layout.tsx:53-77` |

**따라서 "정산·세무를 새로 만든다"는 오답이다.** 남은 것은 ① 배정→단가→정산이
끊기는 지점을 잇고 ② 진짜 Excel 출력을 붙이고 ③ 관제 5모듈을 채우고
④ 23개 탭을 묶는 것이다.

### 배정→정산 체인이 실제로 끊기는 지점 (이번에 잇는다)

```
가이드 등록 ──▶ 단가 설정 ──▶ 투어 배정 ──▶ worked 표시 ──▶ 월말 정산 ──▶ 세무 서식
   ✅            ✅            ⚠️ 충돌 차단 없음   ⚠️ 수동          ✅         ✅ (CSV만)
                              ⚠️ 단가 미설정을
                                 배정 시점에 모름
                                       │
                                       └─▶ 정산 때 unresolved 로 터짐 (= 0원 지급 위험)
```

끊긴 곳은 **두 군데뿐이다**: (a) 배정 시점에 단가·충돌을 검증하지 않는 것,
(b) 출력이 CSV뿐인 것. 이 둘을 메우면 체인 전체가 유기적으로 연결된다.

---

## 1. 웨이브 (착수 순서 = 의존성 순서)

| W | 이름 | 신규 스키마 | 커밋 |
|---|---|---|---|
| W1 | `ops_vehicles` 차량 마스터 | 테이블 1 + 컬럼 1 | 1 |
| W2 | 가이드 배정 충돌 차단 (API+DB) | 컬럼 4 + 트리거 1 + 인덱스 1 | 1 |
| W3 | 투어룸 생성 내역 월간 뷰 | 0 | 1 |
| W4 | 달력 2종 (한 컴포넌트 두 축) | 0 | 1 |
| W5 | 오토파일럿 (제안 전용) | 테이블 1 | 1 |
| W6 | **Excel(.xlsx) 실출력 엔진** | 0 | 1 |
| W7 | 정산 체인 완결 (단가 경고·발행 원장·일괄 worked) | 테이블 1 | 1~2 |
| W8 | 사전 안내 메시지 (배정 확정 → 손님·가이드) | 0 | 1 |
| W9 | B — CJK 잔여 5표 + 뱃지 span | 0 | 1 |
| W10 | C — 손님 트레이 extraActions | 0 | 1 |
| W11 | 어드민 IA 재편 (23 → 6그룹) | 0 | 1 |

각 웨이브는 **원인/설계 → 구현 → 검증 → 개별 커밋**. 게이트는 매 웨이브마다
`npx tsc --noEmit` 0 + 해당 스위트 green, 마지막에 `npx jest` 전량.

---

## 2. W1 — `ops_vehicles` 차량 마스터

**원인.** `ops_room_vehicles.plate_number`가 자유 텍스트라 "같은 차가 같은 날 두 투어에
배차됐는가"를 물어볼 대상이 없다. 중복 배차 감지의 유일한 병목.

**스키마 (additive).**
```
ops_vehicles(id, tenant_id, plate_number, layout_id → ops_vehicle_layouts,
             nickname, seat_capacity, driver_name, driver_phone,
             active, note, created_at, updated_at)
  UNIQUE(tenant_id, plate_number)
ops_room_vehicles.vehicle_id uuid NULL → ops_vehicles(id) ON DELETE SET NULL
```
- `seat_capacity`는 레이아웃의 `total_seats`와 다를 수 있다(실차 개조). NULL이면 레이아웃 값 상속.
- 기존 `plate_number` 텍스트는 **지우지 않는다** — 마스터 미등록 차량의 기록이 사라지면 안 된다.
  `vehicle_id`가 있으면 마스터가, 없으면 텍스트가 표시된다.

**API.** `GET/POST /api/admin/ops-vehicles`, `PATCH/DELETE /api/admin/ops-vehicles/[id]`
(삭제는 배차 이력이 있으면 `active=false` 소프트).

**화면.** `/admin/vehicle-layouts`에 탭 추가(배치도 | 차량) — 새 상단 메뉴를 만들지 않는다.

---

## 3. W2 — 가이드 배정 충돌 차단

**원인.** POST가 `insert` 직행이다. 기존 `UNIQUE(guide_id, tour_date, booking_id)`는
`booking_id IS NULL`이면 Postgres가 NULL을 서로 다르게 보므로 **날짜 단위 중복이 그대로 뚫린다.**

**규칙 (설계안 §1-1 + 트러스트 기반 오버라이드).**

| # | 조건 | 판정 | 오버라이드 |
|---|---|---|---|
| 1 | 같은 가이드·같은 날·시간 겹침 (양쪽 다 시각 보유) | 🔴 하드 블록 | 가능(사유 필수) |
| 2 | 같은 가이드·같은 날·같은 예약(둘 다 NULL 포함) | 🔴 하드 블록 | 불가 (의미 없는 중복) |
| 3 | 휴무일 배정 | 🔴 하드 블록 | 가능(사유 필수) |
| 4 | 비활성 가이드 | 🔴 하드 블록 | 불가 |
| 5 | 같은 날 2건 이상 (시각 미상) | 🟡 경고 | — |
| 6 | 언어 불일치 | 🟡 경고 | — |
| 7 | **(guide, tour_type, tour_date) 단가 미설정** | 🟡 경고 | — |

7번이 이번 플랜의 핵심 연결고리다 — 정산 때 `unresolved`로 터지던 것을
**배정 시점에** 알린다.

**스키마 (additive).**
```
ops_guide_assignments
  + start_time time NULL,  + end_time time NULL
  + assigned_by uuid NULL, + assigned_at timestamptz NULL
  + conflict_override boolean NOT NULL DEFAULT false
  + conflict_override_reason text NULL
  + CHECK (end_time IS NULL OR start_time IS NULL OR end_time > start_time)
  + 부분 유니크: (tenant_id, guide_id, tour_date) WHERE booking_id IS NULL
                 AND status <> 'cancelled'      -- 규칙 2의 NULL 구멍 봉인
  + BEFORE INSERT/UPDATE 트리거 ops_guide_assignment_conflict_guard()
       → 규칙 1·3·4. conflict_override 시 1·3만 통과.
```
> **DB 트리거를 두는 이유**: UI/API 검증만 두면 동시 편집·직접 SQL·다른 라우트에서
> 뚫린다. 설계안 §1-1이 "둘 다"라고 못박은 이유다.

**순수 로직.** `lib/ops/guides/conflicts.ts` — `detectAssignmentConflicts()`가
규칙 1~7을 순수 함수로 판정(테스트 대상). API는 이 결과로 409/경고를 만든다.

**API.** POST/PATCH가 `{ blocked: [...], warnings: [...] }`를 409로 반환.
`?dryRun=1`이면 저장 없이 판정만 — 화면이 저장 전에 미리 보여준다.

---

## 4. W3 — 투어룸 생성 내역 월간 뷰

**원인.** `/api/admin/tour-ops/rooms?date=`가 일자별뿐이라 "이번 달에 몇 개 방이
열렸고 몇 개가 죽어 있나"를 볼 수 없다.

`GET /api/admin/tour-ops/rooms/monthly?period=YYYY-MM` — `tour_rooms` ×
`tour_room_participants` 집계(참가자 수·마지막 활동·초대 수·상태). 신규 스키마 0.
화면은 **새 탭이 아니라 전체화면 시트**(`managerOpen` 패턴) — 탭 6개가 이미 `flex-1`로 좁다.

---

## 5. W4 — 달력 2종 (한 컴포넌트 두 축)

`components/tour-ops/OpsScheduleCalendar.tsx` — `axis: 'guide' | 'vehicle'`.
행=가이드/차량, 열=1..말일. 셀 = 배정 건수 + 충돌 뱃지 + 휴무 해칭.
`GET /api/admin/tour-ops/schedule?period=YYYY-MM&axis=guide|vehicle`.
읽기 전용(드래그 배정은 v2 — 모바일 오조작 위험, 설계안 §1-3).
날짜 산술은 `lib/ops/guides/availability.ts`의 `monthCells` 재사용(중복 구현 금지).

---

## 6. W5 — 오토파일럿 (제안 전용)

⚠️ `lib/ops/parse/autopilot-trigger.ts`는 **OTA 파서용 동명이인** — 재사용 금지.

**원칙(설계안 §1-7): 실행하지 않고 제안한다.**
```
ops_autopilot_suggestions(id, tenant_id, kind, severity, subject_key,
                          tour_date, title, detail, payload jsonb,
                          status suggested|done|dismissed, resolved_at, resolved_by, created_at)
  UNIQUE(tenant_id, subject_key)   -- 재점검이 같은 제안을 쌓지 않는다(멱등)
```
탐지기(`lib/ops/autopilot/detectors.ts`, 순수):
`guide_unassigned` · `vehicle_unassigned` · `capacity_over`(정원<인원) ·
`rate_missing`(worked 배정인데 단가 없음) · `settlement_pending`(전월 미정산).
UI = 카드 목록 + [화면으로 이동] [처리함] [무시]. **자동 실행 없음.**

---

## 7. W6 — Excel(.xlsx) 실출력 엔진 ★사용자 요구

**원인.** 현재 CSV뿐이다. 세무 서식은 여러 시트·숫자서식·열너비가 있어야 세무사 검수가
편하고, 사용자는 명시적으로 "excel 등으로도 출력"을 요구했다.

**설계.** 신규 npm 의존성 **금지** 원칙은 유지한다 → `lib/ops/export/xlsx.ts`에
**의존성 0의 OOXML 작성기**를 직접 쓴다. `.xlsx`는 ZIP이고 Node에 `zlib`이 내장이므로
(`deflateRawSync`) 외부 라이브러리가 필요 없다.

- 입력: `Aoa`(기존 `forms.ts` 타입 그대로) × N시트.
- 지원: 문자열/숫자 구분, 굵은 헤더, 열 너비, 틀 고정, `#,##0` 숫자서식, 한글 안전(UTF-8).
- 출력: `Buffer`. 라우트는 `?format=xlsx`로 분기(기존 `csv`·`html`은 그대로 둔다).

**적용처(한 엔진, 여러 소비처).**
① 세무 서식 4종 ② 가이드 월 정산 목록 ③ 월간 예약 내역 ④ 투어룸 생성 내역
⑤ 배차/근무 달력 매트릭스.

---

## 8. W7 — 정산 체인 완결

1. **단가 미설정 경고의 배정 시점 노출** (W2 규칙 7) + `GuideRatesPanel`에
   테넌트 기본단가(`guide_id IS NULL`) 입력 지원 — 이미 스키마가 허용하는데 UI가 없다.
2. **일괄 worked 표시** — 배정 화면에서 날짜/월 단위 다중 선택 → `PATCH .../assignments/bulk`.
   지금은 한 건씩이라 월말에 사람이 수십 번 누른다. 정산 대상이 안 잡히는 최대 원인.
3. **서식 발행 원장** `ops_tax_form_issues(tenant_id, period, form_key, issued_at,
   issued_by, totals jsonb, row_count, note)` — "무엇을 언제 뽑아서 냈는가"의 사후 기록.
   🔴 D10 유지: **제출하지 않는다.** 발행 기록일 뿐.
4. 정산 화면에서 **가이드별 원천징수영수증 개별 출력**(소득자 교부용) — 지금은 전체
   합본만 나온다.

---

## 9. W8 — 사전 안내 메시지 (kursoflow 참조)

kursoflow의 `departure-reminders` 크론 + `whatsapp-broadcast`가 하는 일을
**이 저장소에 이미 있는 레일 위에** 얹는다(새 채널 만들지 않는다):
- 가이드에게: 배정 확정 시 `ops_guides.email` 로 배정 안내(Resend, 기존 `lib/ops/messaging`).
- 손님에게: `tour_rooms` 브로드캐스트 + 웹푸시(W4.1 `guestPush.ts`) — **기존 공지 레일 재사용**.
- 발송은 **버튼 한 번 = 사람의 행동**. 자동 발송 없음(D10).

---

## 10. W11 — 어드민 IA 재편 (23 → 6그룹) ★사용자 요구

**원인.** `adminMenuItems` 23개가 평면이라 스캔이 불가능하고 `NEW` 뱃지가 12개라
강조가 죽었다. kursoflow가 같은 문제를 **5그룹·24항목**으로 풀었다(`AdminSidebar.tsx`).

**하드룰: 기능 0 삭제.** 모든 경로는 (a) 그룹 안 (b) ⌘K (c) 허브 카드 중
하나로 반드시 도달 가능해야 한다.

| 그룹 | 항목 |
|---|---|
| **운영** | 대시보드 · 주문 관리 · 수신함 · 문의 관리 · 받은 메일 |
| **투어 현장** | 투어 관제센터 · 재등록 승인 · 브리핑 카드 세트 |
| **가이드 · 차량** | 가이드 관리 · 가이드 정산 · 차량/배치도 |
| **상품 · 콘텐츠** | 상품 관리 · 업체 관리 · 외부 리뷰 · 콘텐츠 CMS · 이미지 업로드 |
| **데이터 · 지도** | 매칭 POI · 편의시설 핀 · 다이닝 캐시 · 데이터 분석 · 챗봇 분석 |
| **정산 · 설정** | 파이낸스 원장 · 시스템 설정 |

- 접이식 그룹(로컬스토리지 기억), 현재 경로가 속한 그룹은 자동 펼침.
- `NEW` 뱃지는 **최근 30일 신규만** 남긴다 — 12개가 NEW면 아무것도 NEW가 아니다.
- 모바일 하단 탭 4+더보기는 유지. `pathToBreadcrumb`은 그룹 구조에서 파생시켜
  두 곳을 따로 고치는 사고를 없앤다.

---

## 11. 게이트 · 위생

- `npx tsc --noEmit` = 0, `npx jest` 전량 통과.
- 시뮬 데이터 사용 시 **반드시** `--cleanup` + 라이브 잔여 0 확인.
- 커밋 푸터: `Co-Authored-By: Claude <noreply@anthropic.com>` 만. 모델 식별자 금지.
- 마이그레이션은 **additive만**, 적용 후 `get_advisors` 재실행.
- 새 `components/tour-mode/**` 컴포넌트를 만들면 `docs/audit/A1-coverage.md`에 행 추가
  (안 하면 `a1Coverage.test.ts`가 실패한다).
- 보고는 한국어, 코드·커밋은 영어.

---

## 13. 손님 안내 메시지 체인 (M1~M5) — v2 추가 요구

### 13.0 전수 조사: 이미 있는 것 / 없는 것

사용자가 나열한 체인을 코드로 하나씩 확인했다. **절반 이상이 이미 있다.**

| 단계 | 상태 | 근거 |
|---|---|---|
| 자동 파싱 (OTA 메일) | ✅ | `lib/ops/parse/**`, `ops_email_parse_logs`, 인박스 리뷰 큐 |
| 투어룸 생성 | ✅ | `OpsRoomManager` + `/api/admin/tour-ops/rooms` |
| 고객 명단 생성 | ✅ | `OpsManifestView`(501줄) + `lib/ops/manifest/group.ts` (픽업지 그룹핑) |
| **왓츠앱 순차 발송** | ✅ **이미 구현** | `OpsManifestView` — 프리셋 선택 → wa.me 새 탭 + opened 로그 → [발송 완료] 체크, 일괄 모드 **[다음 열기 (N번째)]** (팝업 차단 안전: 클릭당 1탭) |
| 개인 토큰 링크 | ✅ | `{room_link}`가 예약별 개인 링크로 해석됨(§K B0.3) |
| 이메일 일괄 발송 | 🔶 **부분** | `manifest/bulk-invite` — 고정 초대문구만. **제목·본문 prefill/편집 없음** |
| 가이드 배정 | ✅ (+W2 충돌 차단) | |
| 가이드 단가 반영 | ✅ (+W2 규칙 7 경고) | |
| 정산 일괄 반영 | ✅ (+W7 일괄 worked) | |
| 월말정산·세무서식 | ✅ (+W6 엑셀) | |
| **투어별 템플릿** | ❌ | 프리셋이 (preset_key × locale) 전역 1벌뿐 |
| **날씨·착장 안내** | ❌ | 코드에 날씨 개념 자체가 없음 |
| **관제 홈에서 진입** | ❌ | 명단은 룸 드로어 안에만 있어 "내일 안내 보내기"가 3단계 깊이 |

→ 남은 것은 **템플릿의 개인화(투어별·날씨)와 이메일 쪽 prefill, 그리고 진입 동선**이다.

### 13.1 M1 — 다음날 날씨 예보 → 문구 자동 삽입

- **API 선택: Open-Meteo.** 키가 없고(신규 credential 0), 무료이며, 좌표만 있으면 된다.
  라이브 `tours.city`는 **Jeju·Seoul·Busan 3개뿐**이라 좌표는 상수 표로 충분하다 —
  지오코딩을 붙이는 것은 지금 없는 문제를 푸는 일이다.
- `lib/ops/weather/forecast.ts` (순수 + fetch 분리):
  `weatherLine(forecast, locale)` · `clothingAdvice(forecast, locale)` 6로케일.
- 캐시 `ops_weather_cache(city, date, payload, fetched_at)` — 손님 수만큼 부르지 않는다.
- 🔴 **예보를 못 가져오면 그 줄을 통째로 뺀다.** 빈 `{weather}`가 남은 메시지를
  보내는 것보다 낫고, 지어낸 날씨는 최악이다.
- 신규 토큰 `{weather}` `{clothing}` — 계약(`lib/ops/messaging/template.ts`)에 추가.

### 13.2 M2 — 투어별 템플릿 오버라이드

```
ops_tour_message_templates(tenant_id, tour_id, preset_key, locale, channel,
                           subject, body, updated_by, updated_at)
  UNIQUE(tenant_id, tour_id, preset_key, locale, channel)
```
해석 순서: **투어 오버라이드 → 전역 `ops_whatsapp_templates` → 코드 프리셋**.
`channel`이 있는 이유: 이메일은 제목이 필요하고 wa.me는 아니다.

### 13.3 M3 — 이메일 원버튼 일괄 발송 (prefill + 미리보기 + 발송)

- `GET  /api/admin/tour-ops/manifest/bulk-message?...` → 수신자별 **렌더된 제목·본문**
  + 개인 링크 + 날씨 줄. 화면이 보내기 전에 그대로 보여준다.
- `POST /api/admin/tour-ops/manifest/bulk-message` → 편집된 제목·본문으로 일괄 발송.
- 🔴 **미리보기에서 본 그대로 나간다.** 서버가 다시 렌더하면 화면과 다른 것이 나갈 수 있어,
  POST는 화면이 확인한 본문을 받아 **수신자별 변수만** 채운다.
- 발송 기록은 기존 `ops_whatsapp_send_logs`를 채널 확장해 재사용한다(로그가 두 벌이 되면
  "이 손님에게 무엇을 보냈나"의 답이 갈라진다). additive: `channel`·`subject`·`status`·`error`.

### 13.4 M4 — 진입 동선 (UI)

- 관제 홈에 **[손님 안내 보내기]** 타일 신설 → 날짜별 룸 목록 → 명단 → WA/이메일.
- 오토파일럿에 `guest_message_pending` 탐지 추가: **내일 투어인데 D-1 안내를 아무에게도
  안 보낸 룸**. 이 체인에서 사람이 가장 자주 빠뜨리는 칸이다.

### 13.5 M5 — 체인 감사 문서

`docs/ops-guest-message-chain-2026-07-26.md` — 파싱→룸→명단→발송→배정→정산→세무의
각 칸이 어느 파일/라우트/테이블에 있는지 1:1 표. 다음 사람이 "이미 있는 것"을
다시 만들지 않게.

## 12. 변경 이력

- v1 (2026-07-25) — 최초 작성. 복구 문서 §2 A/B/C + 사용자 추가 요구(정산 체인·Excel·IA)를 W1~W11로 통합.
- v2 (2026-07-26) — §13 손님 안내 메시지 체인(M1~M5) 추가. 전수 조사 결과 왓츠앱
  순차 발송·개인 링크·명단은 **이미 구현돼 있었고**, 남은 것은 투어별 템플릿·날씨
  문구·이메일 prefill·진입 동선으로 좁혀졌다.
- W1~W11 진행: W1✅ W2✅ W3✅ W4✅ W5✅ W6✅ W7✅ W9(B)✅ W10(C)✅ W11✅ / W8은 M1~M4가 대체.

---

## 백로그 이식 — 투어 후 자사 리뷰 요청 (2026-07-29, Part O B2에서)

`claude/cross-platform-review-import-8xn2q7`(2026-06-24 문서 전용 브랜치)을 판정하다 나온
**유일하게 아직 안 만들어진 것**이다. 브랜치는 폐기했고(`archive/claude-cross-platform-review-import-8xn2q7`),
문서 자체는 main에 넣지 않았다 — 그 문서의 본론(**타사 리뷰 원문 수입**)은 main이 사흘 뒤
**의도적으로 다르게 결정**했기 때문이다. `supabase/migrations/20260627120000_tour_external_reviews.sql`이
집계값만(플랫폼·평균평점·건수·출처URL) 담고, 헤더에 정책을 명시한다: *"We do NOT copy review prose
(copyright stays with the author)"*. 문서를 그대로 넣으면 **main이 이미 거절한 설계를
살아 있는 지침처럼** 읽히게 만든다.

- [ ] **투어 후 자사 리뷰 요청** — 예약 완료 + N일에 발사. 기존 Resend 인프라와
      `ReviewWriteWizard` 토큰 링크를 재사용한다. **미구현 확인**: `vercel.json`의 크론 9개와
      `app/api/cron/` 라우트 8개 중 리뷰 요청·리마인더는 하나도 없다(실측 2026-07-29).
  - 🔴 **채널 게이트 필수**: `lib/tour-room/reviewPolicy.ts`(2026-07-28 사용자 결정 "옵션 B")가
    OTA 예약 손님을 **그 OTA의 리뷰 페이지로** 보내고 자사 유인을 막는다(PR #533). 이 요청 메일도
    같은 게이트를 통과해야 한다 — 안 그러면 Klook 계약 §5.11(유인 금지) 위반이다.

### 같이 옮겨 적는 것 — **영구 미구현 결정과 그 근거**

폐기한 문서에서 **이 한 항목만은 사라지면 안 된다**. 타사 리뷰 원문을 리라이팅해
자사 자연 리뷰인 척 게시하는 기능은 **영구 제외**다. 근거:

- 미국 **FTC Fake Review Rule**(2024) — 위반 건당 최대 $51,744
- 한국 **표시·광고의 공정화에 관한 법률**
- EU **UCPD / Omnibus 지침**
- 그리고 실무적으로: **회피 의도의 리라이팅은 분쟁에서 가중 사유**다

폐기 이유가 "이미 있다"가 아니라 **"하면 안 된다"**인 항목은, 브랜치를 닫을 때
그 판단까지 같이 버려지기 쉽다. 그래서 여기 남긴다.
