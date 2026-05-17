# AtoC Korea 자체 분석 시스템 마스터 플랜

작성일: 2026-05-17
문서 상태: **표준 마스터 플랜 (자체 분석 빌드의 유일한 실행 기준)**
대상: atockorea product analytics + admin dashboard (자체 구현)
현재 트리거: v3 landing master plan Phase 0b 차단 해제 + 장기 운영 데이터 인프라화

## 0. 이 문서의 위치

| 문서 | 역할 |
|---|---|
| `docs/landing-page-uiux-master-plan-v3-2026-05-17.md` | 랜딩 v3 마스터 플랜. Phase 0b가 이 문서로 위임됨 |
| **이 문서** | **자체 분석 시스템 표준. 모든 분석 빌드 실행은 이 문서 기준** |
| `docs/analytics-events-home.md` | 이벤트 taxonomy (Phase 0a 산출물, 14+ 메서드). 이 마스터플랜의 입력 |
| `docs/tour-match-v2-migration-audit-2026-05-17.md` | 매처 마이그레이션 audit (도메인 join 분석에 참조) |

v3 landing master plan §A Phase 0b는 "🔄 자체 빌드 (atockorea-analytics-master-plan) 트랙"으로 전환.

---

## §A. 상태 대시보드

| Phase | 상태 | 시작일 | 완료일 | 마지막 커밋 | 비고 |
|---|---|---|---|---|---|
| 1 — Foundation (ingestion + storage + 최소 dashboard) | ✅ 완료 | 2026-05-17 | 2026-05-17 | f140e82c | schema(5 tables + 2 mat views + 5 seed funnels) + SDK 확장(cookie/session/queue/sendBeacon) + ingestion + identify endpoints + admin Overview + 6 placeholder tabs |
| 2 — Events Explorer | ✅ 완료 | 2026-05-17 | 2026-05-17 | d6e11898 | list (이벤트 자동 discover) + detail (시계열 + payload top-10 분포 + 4 breakdown + 25 샘플) |
| 3 — Funnels | ✅ 완료 | 2026-05-17 | 2026-05-17 | (pending) | 5 seed funnel UI + 단계별 전환률 + 4 breakdown (locale/device/utm_source/country) + conversion window respect |
| 4 — Retention / Cohorts | ✅ 완료 | 2026-05-17 | 2026-05-17 | (pending) | ISO 주별 cohort × W+0..W+N 히트맵 (anonymous_id or user_id) |
| 5 — Session Timeline | ⏳ 대기 | — | — | — | 4 후. 이벤트 시퀀스 (DOM 녹화 아님) |
| 6 — A/B Experiments | ⏳ 대기 | — | — | — | landing v3 Phase D unblock 트리거 |
| 7 — 운영 / 헬스 / 익명화 | ⏳ 대기 | — | — | — | 6 후. 90일 익명화 cron + bot 필터 + CSV export |
| 8 — 옵션 (heatmap / PostHog 보강 등) | ⏸ 보류 | — | — | — | 트래픽 의미 있게 늘어난 뒤만 |

상태 마커: ⏳ 대기 / 🔄 진행 중 / ⏸ 보류 / ✅ 완료 / ❌ 중단

**현재 활성 Phase: 없음 (Phase 1 + 2 + 3 + 4 ✅ 완료, Phase 5 진입 대기).**
**다음 액션: Phase 5 (Session Timeline) — 세션별 이벤트 시퀀스 viewer.**

---

## §B. 결정 로그 (binding)

각 행은 binding decision. 번복 시 새 row 추가, 삭제 금지.

| 날짜 | 결정 | 이유 |
|---|---|---|
| 2026-05-17 | Phase 0b 외부 provider(Mixpanel/GA4/PostHog/Vercel) 모두 보류, **자체 빌드**로 진행 | PII 완전 통제 + 매처 도메인 join + 비용 0 + 데이터 소유 + 기존 인프라 재사용 |
| 2026-05-17 | **Postgres(Supabase) 기반**, 별도 분석 DB(ClickHouse 등) 도입 안 함 | 트래픽 규모 적절 (월 1.5M 이벤트 추정), 기존 인프라 재사용. 10x 도달 시 partition + read replica, 100x 시 ClickHouse 검토 |
| 2026-05-17 | **DOM 세션 리플레이 미포함** — 이벤트 시퀀스 timeline만 제공 | rrweb 통합 + 스토리지 + 재생 UI = 별도 1주+ 작업, MVP 범위 초과. 필요 시 PostHog 무료 티어 보강 (§D) |
| 2026-05-17 | 클라이언트 SDK는 기존 `src/design/analytics.ts` **확장**, 신규 SDK 만들지 않음 | 14 메서드 + 25+ call site 이미 와이어링됨. `trackEvent` 본문 교체만으로 모든 기존 호출 자동 흐름 |
| 2026-05-17 | `anonymous_id`는 **first-party cookie** (1년 만료) + `user_id` 머지 | PII 가벼움, 로그인 후에도 연속 분석 가능, 3rd-party cookie 의존성 0 |
| 2026-05-17 | **90일 후 자동 익명화** (raw 텍스트 필드 NULL + anonymous_id 해시화) | PIPA/GDPR 가드. cron daily 03:00 |
| 2026-05-17 | A/B variant 할당은 **server-side stable hash** (`hash(anonymous_id + key) % 100`) | SSR/CSR 일관성, edge case 줄임, 클라이언트 조작 불가 |
| 2026-05-17 | 대시보드 권한: `requireAdmin` 전용 | 분석 데이터는 민감. 향후 merchant-자기-데이터 뷰는 별도 트랙 |
| 2026-05-17 | 이벤트 schema는 **backwards-compatible** (필드 추가만, 삭제 금지) | 과거 데이터 보존 + 분석 연속성 |
| 2026-05-17 | **raw events 보존 + materialized view로 집계** | 원본 + 빠른 쿼리 둘 다 가능. hourly refresh |
| 2026-05-17 | ingestion endpoint는 **batch 전용** (500 events/batch 상한) | p95 < 100ms 보장, 메인 DB write 부담 ↓ |
| 2026-05-17 | 매처 intent textarea **본문 절대 미저장** (이미 Phase 0a 가드), `payload` jsonb의 텍스트 필드도 schema에 명시된 것만 허용 | PII 보호. 자유 텍스트 필드 자동 reject |
| 2026-05-17 | IP 주소 **미저장**. 지역 분석은 country code(헤더에서 추출) 한 컬럼만 | PII 무게 ↓, country만으로 분석 충분 |

---

## §C. 변경 로그

Phase 진행 시 한 줄씩 추가. 커밋 단위.

| 날짜 | 항목 | 커밋 | 비고 |
|---|---|---|---|
| 2026-05-17 | 자체 분석 마스터 플랜 작성 + v3 landing §A/§B/§C cross-ref | 6848f06a | `docs/atockorea-analytics-master-plan-2026-05-17.md` |
| 2026-05-17 | Phase 1 시작 — Foundation atomic 묶음 | 51a6b352 | schema + SDK + ingestion + admin scaffold + Overview |
| 2026-05-17 | Phase 1 ✅ 완료 — schema 적용(prod) + SDK 교체 + 2 endpoint + admin dashboard 1+6 화면 | f140e82c | dev → 이벤트 발화 시 console.log + Supabase insert + Overview에서 카운트 표시 |
| 2026-05-17 | fix — 세션 upsert가 2nd batch에서 entry context를 NULL로 clobber하던 버그 | e04cda44 | End-to-end 검증 통과 (6/6 poll round) |
| 2026-05-17 | Phase 1 E2E 검증 — bot UA filter / invalid schema / real Chrome → production / DB row | (verified) | home_hero_season_chip_click 1건 prod에 정상 저장 (locale=ko-KR, device=desktop, country=KR) |
| 2026-05-17 | Phase 2 ✅ 완료 — Events Explorer (list + detail + filters) | d6e11898 | event auto-discover + 시계열 + payload top-10 분포 + 4 breakdown + 25 samples |
| 2026-05-17 | Phase 3 ✅ 완료 — Funnels (5 seed + 단계별 전환률 + breakdown) | 66c788fe | server-side step walk per session with conversion window respect; UI: bar chart with retention from prev / from first |
| 2026-05-17 | Phase 4 ✅ 완료 — Retention 주별 cohort 히트맵 (4/8/12주 토글) | (pending) | ISO Mon-Sun 주. user_id 머지 후 unique 카운트 |

---

## §D. 보류 아이디어 (Scope Creep Registry)

Phase 안에 없지만 좋은 아이디어. 추가 시 출처 + 보류 이유 명시.

| 아이디어 | 출처 | 보류 이유 |
|---|---|---|
| **PostHog 무료 티어 추가** (세션 리플레이 보충용) | §B-3 결정 부산물 | 자체 timeline으로 충분히 demo 가능. 정 필요해지면 PostHog만 추가 (자체 정량 + PostHog 정성 hybrid) |
| Click coordinate heatmap | 일반 패턴 | Phase 5 timeline으로 대체 가능. 별도 라이브러리 부담 |
| Web Vitals 자동 수집 (LCP/CLS/TBT) | 일반 패턴 | Vercel Analytics 무료 티어로 보강 가능. 자체 이벤트와 별도 |
| Slack/Email 알람 (이상치 자동 알림) | 운영 패턴 | Phase 7 헬스 완료 후 결정. 신호 vs 노이즈 검증 필요 |
| Merchant 셀프 분석 (자기 투어 데이터 보기) | 사용자 가치 | RLS 정책 + UI 분리. 별도 트랙 |
| Bayesian A/B 통계 정밀 | Phase 6 부산물 | 간이 카이제곱으로 시작, 트래픽 늘면 검토 |
| GA4와 dual track (광고 측정 보완) | 마케팅 가치 | server-side propagation으로 GA4도 보낼 수 있음. 광고 운영 시작하면 검토 |
| Server-side propagation (Segment 같은 forwarding) | 외부 도구 호환 | 자체로 충분. 향후 BI 도구 연결 시 검토 |
| Materialized view → ClickHouse 분리 | 스케일 패턴 | 트래픽 100x 도달 시 검토 (월 100M+ 이벤트) |

---

## 1. 한 줄 결론

> **외부 SaaS provider 대신 자체 분석 시스템을 빌드한다.** 6.5일 작업으로 ingestion + 6개 핵심 어드민 화면(overview / events / funnels / retention / sessions / experiments)을 갖춘 분석 도구를 만들어 v3 landing Phase D A/B 측정을 unblock + 장기적으로 atockorea 운영 데이터 인프라로 활용한다. **세션 리플레이 같은 PostHog 시그니처 기능은 의도적으로 미포함** — 1주+ 작업이 MVP 범위 초과 + 필요해지면 무료 티어 보강으로 해결 가능.

---

## 2. 코드 실사 스냅샷

### 2.1 현재 분석 인프라 상태

`src/design/analytics.ts:15-22`:

```ts
export function trackEvent(event: string, payload: AnalyticsPayload = {}) {
  const data = sanitizePayload(payload);
  if (typeof window !== "undefined") {
    console.log("[analytics]", event, data);
    // replace later with actual analytics provider  ← ★ 여기 교체 ★
  }
}
```

- **14+ 메서드 정의됨** (`analytics.homeCtaClick`, `homeHeroStyleChipClick`, `homeMatchPreviewVisible` 등)
- **25+ 호출 위치** 와이어링됨 (Phase 0a `b6b73c07` + Phase C.1 `90345fd6`)
- payload sanitizer 있음 (hotelName / lat / lng / coordinates 자동 strip)
- `home_*` 이벤트 7종 + `match_page_*` 4종 + 결제 funnel 8종

→ **trackEvent 본문만 교체하면 25+ 호출 자동으로 자체 분석 시스템에 흐름.** 호출부 리팩토 0건.

### 2.2 기존 인프라 재사용 가능

- Supabase Postgres (이미 사용)
- Next.js 14/15 App Router (이미 사용)
- `requireAdmin` 인증 헬퍼 (`lib/auth.ts`, 이미 사용 — Phase 2 admin orders 등에서)
- Vercel cron (Phase 7 익명화에 사용)
- Recharts 등 차트 라이브러리 — 새로 설치 필요할 수도 (검토)

### 2.3 트래픽 예상

- 현재 (런칭 직후): 추정 < 1K visits/day → ~50K events/day → **월 1.5M events**
- 단기 (3-6개월): 5-10K visits/day → ~500K events/day → **월 15M events**
- 중기 (1년+): 50K visits/day → 5M events/day → **월 150M events** (이 시점 ClickHouse 검토)

Postgres는 월 15M event는 적절한 인덱스 + materialized view로 무난.

---

## 3. 핵심 진단 — 왜 자체 빌드인가

### P0-A. PII 통제 — 외부 SaaS의 한계
- 매처 intent textarea는 한국어 자유 텍스트
- 외부 SaaS로 보내면 PIPA/GDPR 가드 추가 작업 (계약, 데이터 처리 위치, 동의 UX)
- 자체 빌드 = PII가 자체 DB 외부로 절대 안 나감

### P0-B. 도메인 join 비용
- "특정 intent 패턴 → 어떤 winner_product가 가장 많이 매칭되나"
- "tour-mode 사용자가 매처 → 결제 funnel 어디서 이탈하나"
- 외부 SaaS는 자체 DB와 join하려면 별도 ETL 필요
- 자체 분석 = 같은 Supabase 안에서 SQL join 한 방

### P0-C. 비용 / 락인
- Mixpanel: 월 트래픽 따라 빠르게 비용 증가 (~$30-200/월 시작, 트래픽 늘면 천 단위)
- PostHog: 무료 티어 1M events/월 — 우리 트래픽 1.5M부터 유료
- SaaS 락인: 데이터 export 어렵고 history 깨짐 위험
- 자체 빌드 = Supabase 비용만 (현 인프라 비용 내)

### P0-D. 기존 인프라 충분
- Supabase Postgres 여유 있음
- Next.js admin 영역 이미 있음
- 새 의존성 0 (차트 라이브러리만 추가)

### P1-A. 향후 확장성
- 자체 빌드 = 새 이벤트 / 새 화면 / 새 metric 즉시 추가 가능
- 외부 SaaS = 그 도구가 제공하는 metric만 가능

---

## 4. 시스템 아키텍처

```
┌─ Client (Browser) ─────────────────────────┐
│  src/design/analytics.ts (확장)             │
│  ├ session_id (cookie, 30min idle reset)   │
│  ├ anonymous_id (cookie, 1yr)              │
│  ├ user_id (auth, optional)                │
│  ├ context auto-collect                    │
│  │   (locale, viewport, device, UTM)       │
│  └ batch queue + sendBeacon fallback       │
└──────────────┬─────────────────────────────┘
               │ POST /api/analytics/events
               │ (batched, max 500)
               ▼
┌─ Next.js API ──────────────────────────────┐
│  app/api/analytics/events/route.ts         │
│  ├ rate limit (per anonymous_id)           │
│  ├ bot UA filter (basic)                   │
│  ├ payload sanitize (PII strip)            │
│  ├ schema validation                       │
│  ├ session upsert                          │
│  └ Supabase batch insert                   │
└──────────────┬─────────────────────────────┘
               ▼
┌─ Supabase Postgres ────────────────────────┐
│  RAW                                       │
│    analytics_events                        │
│    analytics_sessions                      │
│    analytics_users (anon ↔ user merge)    │
│  CONFIG                                    │
│    analytics_funnels                       │
│    analytics_experiments                   │
│  AGGREGATE (materialized views, hourly)    │
│    analytics_events_daily                  │
│    analytics_sessions_daily                │
│    analytics_funnels_daily                 │
│    analytics_retention_cohorts             │
└──────────────┬─────────────────────────────┘
               ▼
┌─ Admin Dashboard (Next.js, requireAdmin) ──┐
│  /admin/analytics                          │
│  ├ /overview     (DAU/세션/전환 종합)        │
│  ├ /events       (이벤트 explorer)          │
│  ├ /funnels      (펀널 분석)                │
│  ├ /retention    (cohort 매트릭스)          │
│  ├ /sessions     (세션 timeline)            │
│  ├ /experiments  (A/B variant 비교)         │
│  └ /health       (수집 상태 + alarm)        │
└────────────────────────────────────────────┘

ASYNC JOBS (Vercel Cron):
  - hourly: refresh materialized views
  - daily 03:00: 90일 익명화 + 비활성 세션 정리
  - daily 04:00: cohort/retention 재계산
```

---

## 5. Phase별 실행 계획

각 Phase = 독립 PR (Phase 1만 atomic 묶음).

### Phase 1 — Foundation (1.5일)

목표: ingestion + storage + 가장 기본적인 dashboard 화면 1개. **이 시점에서 console.log를 끄고 자체 시스템으로 전환.**

작업:

1.1 **Supabase schema 마이그레이션** (`supabase/migrations/`)
- `analytics_events` 테이블 (§6 스키마)
- `analytics_sessions` 테이블
- `analytics_users` 테이블
- 인덱스 4개 (event_name+ts / session_id / user_id / anonymous_id)
- RLS 정책 (event insert는 service_role만, read는 admin role)

1.2 **클라이언트 SDK 확장** (`src/design/analytics.ts`)
- `anonymous_id` cookie helper (1년 만료, first-party)
- `session_id` cookie + 30min idle 리셋
- context auto-collect: locale (`navigator.language`), viewport (`innerWidth/Height`), device class (mobile/tablet/desktop heuristic)
- UTM 파라미터 capture
- batch queue: 5개 이벤트 모이거나 5초마다 flush
- `beforeunload`에서 `navigator.sendBeacon` fallback (offline-safe)
- `trackEvent` 본문: 큐에 push (console.log 제거)
- dev env: console.log 추가 옵션 유지 (debug)

1.3 **Ingestion endpoint** (`app/api/analytics/events/route.ts`)
- POST batch (max 500 events/req)
- rate limit: 100 req/min per anonymous_id
- bot UA filter (간단 휴리스틱: known bot UA strings)
- payload schema validation (Zod)
- session upsert (insert or update event_count)
- batched Supabase insert
- 응답: 202 Accepted (비동기 OK)

1.4 **Admin dashboard scaffold**
- `app/admin/analytics/layout.tsx` (nav: overview/events/funnels/...)
- `app/admin/analytics/page.tsx` → redirect /overview
- `requireAdmin` gate
- 디자인 토큰 admin v2 일관

1.5 **Overview 화면 v0** (`app/admin/analytics/overview/page.tsx`)
- 7일 / 30일 토글
- 일일 이벤트 수 (line chart)
- 일일 세션 수
- 핵심 전환 카운트 (`home_cta_click` source breakdown)
- 데이터 소스: `analytics_events_daily` view (다음 Phase에서 materialized 전환)

산출물:
- migration 1건
- analytics.ts 확장 (~150 LOC)
- ingestion endpoint (~120 LOC)
- admin/analytics/layout + overview (~200 LOC)

검증:
- dev에서 페이지 클릭 → 5초 후 admin/analytics/overview에서 카운트 증가
- 7일 트렌드 표시
- requireAdmin 미충족 시 redirect

### Phase 2 — Events Explorer (1일)

2.1 이벤트 리스트 페이지 — 등록된 모든 event_name (14+ 자동 추출) + 7일 카운트
2.2 이벤트 상세 페이지 — 시계열 차트 + payload 분포 (top 10 키별 카운트)
2.3 필터 UI — 날짜 범위, locale, device_class, viewport_width 그룹, source(UTM)
2.4 새 이벤트 자동 detect — 처음 보는 event_name이 들어오면 dashboard에 자동 표시 (수동 등록 불필요)

검증:
- `home_hero_style_chip_click` 클릭 시 chipId 분포 차트 표시
- locale 필터로 ko vs en 비교

### Phase 3 — Funnels (1일)

3.1 `analytics_funnels` 테이블 + UI에서 funnel 정의 가능
3.2 Funnel 계산 SQL (단계별 윈도우 함수)
3.3 Funnel UI: 단계별 bar chart + drop-off %
3.4 5개 predefined funnels 시드:
   - **매처 펀널** (8 단계): page_view (`/`) → `home_hero_intent_focus` → `home_cta_click` (source=hero_planner_match) → `home_match_preview_visible` (phase=loading) → `home_match_preview_visible` (phase=result) → `home_cta_click` (source=best_match_result_primary) → page_view (`/tour-product/...`) → `checkout_started`
   - **Featured pickup**: page_view (`/`) → `home_featured_card_click` (source=regular_section) → page_view (`/tour-product/...`) → `checkout_started` → `checkout_payment_completed`
   - **Idle preview engagement**: page_view (`/`) → `home_match_preview_visible` (phase=idle) → `home_featured_card_click` (source=idle_preview) → page_view (`/tour-product/...`)
   - **Destinations 분기**: page_view (`/`) → `home_destination_card_click` → page_view (`/tours/list?destination=...`)
   - **Tour-mode**: `booking_confirmed` → tour-mode page_view → spot_event triggered (≥1) → tour_completed (PR 4 wiring 후 활성)
3.5 Breakdown: locale / viewport / device / UTM source

검증:
- 매처 펀널 표시 + iPhone 14 viewport breakdown

### Phase 4 — Retention / Cohorts (1일)

4.1 Cohort 정의 (signup date, first_event date, first_match date 등 선택)
4.2 D+1, D+7, D+30 retention 매트릭스 (히트맵 시각화)
4.3 Cohort별 핵심 metric 비교 (5월 cohort vs 6월 cohort 매처 사용률 등)
4.4 Materialized view `analytics_retention_cohorts`

검증:
- 첫 매처 사용일 cohort 기준 D+7 retention 표시

### Phase 5 — Session Timeline (1일)

5.1 세션 리스트 (정렬: 최근/긴/전환됨)
5.2 세션 상세 → 이벤트 시퀀스 timeline (chronological)
5.3 사용자 컨텍스트 표시 (locale, device, entry_path, UTM)
5.4 "Funnel 도달한 세션", "이탈한 세션" 필터
5.5 **DOM 녹화 아님** — 이벤트 + payload + 시간만 (rrweb은 보류, §D)

검증:
- 매처 완료한 세션 1개 timeline 표시 가능
- 매처 중 이탈한 세션 timeline에서 이탈 지점 식별 가능

### Phase 6 — A/B Experiments framework (1일)

6.1 `analytics_experiments` 테이블 + admin UI (`/admin/analytics/experiments`)
6.2 `useExperiment(key)` 클라이언트 hook + `getExperiment(key, anonymousId)` 서버 helper
6.3 Variant 할당: server-side stable hash (`hash(anonymous_id + key) % 100 < cumulative_weight`)
6.4 Variant를 모든 이벤트의 `experiment_assignments` jsonb에 자동 첨부
6.5 Experiment dashboard: variant별 핵심 지표(conversion rate, funnel completion) + 간이 카이제곱 p-value + 시간별 추세
6.6 첫 실험 시드 가설 (v3 landing Phase D 의존):
   - `home_sticky_threshold` (D.3) — A: `rect.bottom < 0` / B: `rect.bottom < viewport*0.5`
   - `home_cta_copy` — A: "맞춤 추천 받기" / B: "내 투어 찾기"
6.7 v3 landing master plan §A Phase D **unblock** 명시

검증:
- 실험 1개 생성 + variant 50/50 할당 + 24시간 후 dashboard에서 variant별 funnel 비교 가능

### Phase 7 — 운영 / 헬스 / 익명화 (0.5일)

7.1 90일 자동 익명화 cron (Vercel cron, daily 03:00)
   - 90일 이상 raw event: payload jsonb 텍스트 필드 NULL, anonymous_id 해시화, user_id NULL, `anonymized_at` 채움
   - 90일 이상 비활성 세션: 동일 처리
7.2 Materialized view 시간별 refresh (Vercel cron, hourly)
7.3 Bot 필터 강화 (UA 패턴 + 이상 트래픽 비율)
7.4 CSV export (admin UI에서 raw events / 집계 모두 다운로드)
7.5 Health dashboard `/admin/analytics/health` — 일일 이벤트 수, ingestion 에러율, 새 이벤트 종류 detect
7.6 PII audit 페이지 — payload에 의도치 않은 텍스트 필드 자동 detect

검증:
- 90일 익명화 dry-run 실행 + 영향받는 row 카운트 확인
- PII 가드 통과: raw events에 intent_text 등 없음

### Phase 8 — 옵션 (보류)

- Click coordinate heatmap (lite — 좌표 저장만, 시각화는 후일)
- PostHog 무료 티어 추가 (자체 정량 + PostHog 정성/세션 리플레이 hybrid)
- Web Vitals 자동 수집
- Slack/Email 알람 (이상 detect)
- Bayesian A/B 정밀 통계

모두 §D 보류. 트래픽이 의미 있게 늘어난 뒤(현재 대비 5x+) 재검토.

---

## 6. 데이터 모델

### 6.1 `analytics_events`

```sql
CREATE TABLE public.analytics_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_name text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- identity
  anonymous_id text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id text NOT NULL,

  -- context
  page_path text,
  page_query jsonb,                   -- ?utm_*=...
  referrer text,
  locale text,
  viewport_width integer,
  viewport_height integer,
  device_class text CHECK (device_class IN ('mobile', 'tablet', 'desktop', 'unknown')),
  user_agent_family text,             -- "Chrome" / "Safari" — full string NOT stored
  country_code text,                  -- 2-letter, from Vercel geo header
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,

  -- experiment context (auto-attached if any experiments active)
  experiment_assignments jsonb DEFAULT '{}'::jsonb,

  -- timestamps
  client_ts timestamptz NOT NULL,     -- when SDK captured it
  server_ts timestamptz NOT NULL DEFAULT now(),

  -- soft anonymization
  anonymized_at timestamptz
);

CREATE INDEX idx_analytics_events_name_ts
  ON public.analytics_events (event_name, server_ts DESC);
CREATE INDEX idx_analytics_events_session
  ON public.analytics_events (session_id, server_ts);
CREATE INDEX idx_analytics_events_user
  ON public.analytics_events (user_id, server_ts DESC)
  WHERE user_id IS NOT NULL;
CREATE INDEX idx_analytics_events_anonymous
  ON public.analytics_events (anonymous_id, server_ts);
```

### 6.2 `analytics_sessions`

```sql
CREATE TABLE public.analytics_sessions (
  id text PRIMARY KEY,                       -- session_id (UUID v4)
  anonymous_id text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  started_at timestamptz NOT NULL,
  last_event_at timestamptz NOT NULL,
  event_count integer NOT NULL DEFAULT 0,
  page_view_count integer NOT NULL DEFAULT 0,

  entry_path text,
  entry_referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,

  device_class text,
  viewport_width integer,
  locale text,
  country_code text,

  -- conversion tracking
  converted boolean NOT NULL DEFAULT false,
  converted_at timestamptz,
  converted_event text,                       -- which event marked conversion

  anonymized_at timestamptz
);

CREATE INDEX idx_analytics_sessions_started
  ON public.analytics_sessions (started_at DESC);
CREATE INDEX idx_analytics_sessions_anon
  ON public.analytics_sessions (anonymous_id, started_at DESC);
CREATE INDEX idx_analytics_sessions_user
  ON public.analytics_sessions (user_id, started_at DESC)
  WHERE user_id IS NOT NULL;
```

### 6.3 `analytics_users` (anonymous ↔ user merge)

```sql
CREATE TABLE public.analytics_users (
  anonymous_id text PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  merged_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_analytics_users_user
  ON public.analytics_users (user_id);
```

머지 시점: 사용자가 로그인할 때 클라이언트가 `analytics.identify(user_id)` 호출 → 서버가 이 테이블에 row 추가 → 분석 쿼리는 `COALESCE(user_id::text, anonymous_id)`로 unique user 카운트.

### 6.4 `analytics_funnels`

```sql
CREATE TABLE public.analytics_funnels (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  steps jsonb NOT NULL,                       -- [{event_name, filter_payload?, label}]
  conversion_window_seconds integer NOT NULL DEFAULT 1800,  -- 30 min
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### 6.5 `analytics_experiments`

```sql
CREATE TABLE public.analytics_experiments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  key text UNIQUE NOT NULL,
  description text,
  status text NOT NULL CHECK (status IN ('draft', 'running', 'paused', 'concluded')),
  variants jsonb NOT NULL,                    -- [{key, weight, label}]
  primary_metric_funnel_key text REFERENCES public.analytics_funnels(key),
  start_date timestamptz,
  end_date timestamptz,
  conclusion_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### 6.6 Materialized views (집계)

```sql
-- Daily event counts (refreshed hourly)
CREATE MATERIALIZED VIEW public.analytics_events_daily AS
SELECT
  date_trunc('day', server_ts) AS day,
  event_name,
  locale,
  device_class,
  count(*) AS event_count,
  count(DISTINCT session_id) AS session_count,
  count(DISTINCT COALESCE(user_id::text, anonymous_id)) AS user_count
FROM public.analytics_events
WHERE anonymized_at IS NULL
  AND server_ts >= now() - interval '90 days'
GROUP BY 1, 2, 3, 4;

CREATE UNIQUE INDEX ON public.analytics_events_daily (day, event_name, locale, device_class);

-- Daily session counts
CREATE MATERIALIZED VIEW public.analytics_sessions_daily AS
SELECT
  date_trunc('day', started_at) AS day,
  locale,
  device_class,
  utm_source,
  count(*) AS session_count,
  count(DISTINCT anonymous_id) AS unique_visitor_count,
  count(*) FILTER (WHERE converted) AS conversion_count,
  avg(event_count) AS avg_events_per_session,
  avg(extract(epoch FROM (last_event_at - started_at))) AS avg_duration_seconds
FROM public.analytics_sessions
WHERE anonymized_at IS NULL
  AND started_at >= now() - interval '90 days'
GROUP BY 1, 2, 3, 4;

CREATE UNIQUE INDEX ON public.analytics_sessions_daily (day, locale, device_class, utm_source);
```

Refresh: Vercel cron hourly (`REFRESH MATERIALIZED VIEW CONCURRENTLY`).

---

## 7. 대시보드 화면 카탈로그

### 7.1 `/admin/analytics/overview`

**목표:** "오늘 / 이번 주 사이트가 어떻게 돌아가는가" 한눈에.

위에서 아래로:
1. KPI 4-up: DAU / 일일 세션 / 신규 vs 재방문 / 일일 전환 카운트
2. 7일 트렌드 line chart (DAU + 세션 + 전환 3 줄)
3. 핵심 전환 source breakdown (`home_cta_click` source enum별 일일 카운트)
4. 새 이벤트 detect 알림 ("지난 24시간 첫 발화: X")

필터: 7일 / 30일 / 90일 토글, locale 토글

### 7.2 `/admin/analytics/events`

**목표:** 이벤트별 발화 추세 + payload 분포.

리스트 페이지:
- 전체 event_name 리스트 (자동 detect, 14+ 표시)
- 각 행: 이름, 7일 카운트, 일일 평균, 추세 sparkline, 최근 발화 시점

상세 페이지 (`/events/[name]`):
- 시계열 chart (일/시간/분 분해능)
- payload 분포 ("chipId top 10", "season distribution", "phase=loading/result 비율")
- 필터: 날짜 / locale / device_class / viewport (작은/중간/큰) / UTM
- 호출 위치 (코드 grep 기반, 정적 hint)

### 7.3 `/admin/analytics/funnels`

리스트 페이지:
- 등록된 funnel 5개
- 각 행: 이름, 7일 conversion rate, 추세

상세 페이지 (`/funnels/[key]`):
- bar chart 단계별 (8 단계 funnel이면 8개 bar)
- 각 단계 절대 카운트 + 직전 단계 대비 retention %
- breakdown 토글: locale / viewport / device / UTM
- 시간 분포 (단계 간 P50, P90 시간)
- 이탈 분석 — 각 단계에서 다음 단계 대신 다른 이벤트 발생한 top 5

### 7.4 `/admin/analytics/retention`

- Cohort 매트릭스 (히트맵)
  - 행: cohort (signup week 등)
  - 열: D+0 / D+1 / D+3 / D+7 / D+14 / D+30
  - 셀: retention % (active user count / cohort size)
- Cohort 기준 선택 dropdown: signup / first_event / first_match / first_purchase
- Breakdown: locale / device

### 7.5 `/admin/analytics/sessions`

리스트:
- 정렬: 최근 / 긴 (event_count) / 전환됨
- 각 행: started_at, duration, event_count, converted, locale, device

상세 페이지 (`/sessions/[id]`):
- 사용자 컨텍스트 카드 (entry_path, referrer, UTM, device, locale, anonymous_id 부분 마스킹)
- 이벤트 시퀀스 timeline (chronological, 모든 이벤트 + payload 펼치기)
- 시각 표시: page view는 큰 dot, 클릭은 작은 dot, 매처 phase 변화는 단계 표시

**DOM 녹화 아님** — 사용자 화면 재생은 §D PostHog 옵션.

### 7.6 `/admin/analytics/experiments`

리스트:
- 실험 현황 (draft / running / paused / concluded)

상세 페이지 (`/experiments/[key]`):
- variant별 트래픽 (참가자 수)
- variant별 primary metric (funnel completion rate)
- 통계 유의성 (간이 카이제곱 p-value)
- 시간별 variant별 트렌드
- 결정 액션: variant 고정 / 실험 종료 / 비율 조정

### 7.7 `/admin/analytics/health` (Phase 7)

- ingestion 성공률 (24시간)
- 일일 이벤트 수 (자동 -50% / +200% 변화 detect)
- 새 이벤트 종류 detect ("처음 보는 event_name: ...")
- PII audit ("payload에 unexpected 키 발견: ...")
- 90일 익명화 cron 마지막 실행 + 영향 row 수
- Materialized view refresh 마지막 실행 + 지연

---

## 8. 핵심 펀널 정의 (도메인 특화)

### 8.1 매처 펀널 (8 단계)

| # | event_name | filter |
|---|---|---|
| 1 | `page_view` | `page_path = '/'` |
| 2 | `home_hero_intent_focus` | — |
| 3 | `home_cta_click` | `source = 'hero_planner_match'` |
| 4 | `home_match_preview_visible` | `phase = 'loading'` |
| 5 | `home_match_preview_visible` | `phase = 'result'` |
| 6 | `home_cta_click` | `source = 'best_match_result_primary'` |
| 7 | `page_view` | `page_path LIKE '/tour-product/%'` |
| 8 | `checkout_started` | — |

핵심 지표: 1→8 전환률 (현재 baseline 미확보 — Phase 1 후 1주 측정 시작)

### 8.2 Featured pickup 펀널

| # | event_name | filter |
|---|---|---|
| 1 | `page_view` | `page_path = '/'` |
| 2 | `home_featured_card_click` | `source = 'regular_section'` |
| 3 | `page_view` | `page_path LIKE '/tour-product/%'` |
| 4 | `checkout_started` | — |
| 5 | `checkout_payment_completed` | — |

### 8.3 Idle preview engagement 펀널

| # | event_name | filter |
|---|---|---|
| 1 | `page_view` | `page_path = '/'` |
| 2 | `home_match_preview_visible` | `phase = 'idle'` |
| 3 | `home_featured_card_click` | `source = 'idle_preview'` |
| 4 | `page_view` | `page_path LIKE '/tour-product/%'` |

목적: Phase B.2 IdleMatchPreviewCarousel 효과 측정

### 8.4 Destinations 분기 펀널

| # | event_name | filter |
|---|---|---|
| 1 | `page_view` | `page_path = '/'` |
| 2 | `home_destination_card_click` | — |
| 3 | `page_view` | `page_path LIKE '/tours/list%'` |

### 8.5 Tour-mode 펀널 (PR 4 wiring 후 활성)

| # | event_name | filter |
|---|---|---|
| 1 | `booking_confirmed` | — |
| 2 | `page_view` | `page_path LIKE '/tour-mode/%'` |
| 3 | `tour_room_spot_event_triggered` | — (≥1 회) |
| 4 | `tour_completed` | — |

후속 추가 가능: 8.6 sticky CTA 사용 patrh, 8.7 시즌 칩 sourced funnel, 8.8 결제 abandonment.

---

## 9. PII / 보안 / 권한 가드

### 9.1 PII 제거 규칙

**절대 저장 안 함:**
- 매처 intent textarea 자유 텍스트 본문 (이미 Phase 0a 가드)
- 사용자 이메일 / 결제 카드 / 세션 토큰
- IP 주소 (country code만)
- 정확한 위경도 / 호텔명 (이미 `sanitizePayload` 가드 — 강화)

**저장 가능 (메타데이터):**
- 텍스트 길이 (예: `intent_length: 42`)
- 언어 detect (예: `intent_lang: "ko"`)
- 카테고리 슬러그 (chipId, season, destination, slug)
- 디바이스 family (Chrome/Safari), 정확한 UA 문자열 X

**Schema 가드:**
- ingestion endpoint Zod schema가 허용 키만 통과
- 알 수 없는 키는 자동 drop + 헬스 알림에 기록 ("처음 보는 payload key")

### 9.2 권한

- `/admin/analytics/*` 모두 `requireAdmin` (이미 사용 중인 헬퍼)
- ingestion endpoint (`POST /api/analytics/events`): 익명 허용 (CSRF는 SameSite cookie + Origin 헤더 검증)
- service_role key는 서버사이드 환경변수에만, 브라우저 노출 0
- RLS:
  - `analytics_events.INSERT` — service_role만
  - `analytics_events.SELECT` — admin role JWT claim 보유 사용자만
  - 향후 merchant 자기-데이터 뷰 (별도 트랙) — `analytics_events.user_id = auth.uid()` RLS

### 9.3 90일 자동 익명화

- daily 03:00 KST cron (`/api/cron/analytics-anonymize`)
- 90일 이상된 raw event:
  - `payload` jsonb의 자유 텍스트 필드 NULL 처리 (현재 없지만 향후 가드)
  - `anonymous_id` SHA-256 해시화 (cohort 분석은 여전히 가능하지만 역추적 불가)
  - `user_id` NULL
  - `country_code` 유지 (집계 가능)
  - `anonymized_at` 현재 시각 채움
- 90일 이상 비활성 세션도 동일 처리
- Materialized view는 무영향 (집계만 함)
- 익명화 dry-run mode 제공 (admin UI에서 영향 row 수 확인 후 실행)

---

## 10. 성능 / 스케일 가드

### 10.1 클라이언트 SDK

- 메인 스레드 작업 < 5ms per event (batch + microtask + IntersectionObserver thumbprint만)
- batch queue: 5개 모이거나 5초마다 flush
- `beforeunload`에서 `navigator.sendBeacon` (offline-safe)
- 네트워크 실패 시 다음 flush까지 큐 유지
- 최대 큐 크기 50 (그 이상은 drop, 큐 overflow 카운터 자체 이벤트로 보고)

### 10.2 Ingestion endpoint

- batch 최대 500 events/req
- p95 < 100ms 목표
- rate limit 100 req/min per anonymous_id
- Supabase batch insert (single INSERT with multiple rows)
- 큐 비동기 — endpoint는 즉시 202 응답

### 10.3 Materialized views

- hourly refresh (Vercel cron)
- `REFRESH MATERIALIZED VIEW CONCURRENTLY` (락 없이)
- 첫 refresh 부담 → 90일 데이터로 한정 (`WHERE server_ts >= now() - interval '90 days'`)

### 10.4 스케일 임계값 + 대응

| 트래픽 | 월 이벤트 | 대응 |
|---|---|---|
| 현재 (~1K visits/day) | ~1.5M | 현 schema로 충분 |
| 5K visits/day | ~7.5M | 인덱스 부담 모니터링, 필요 시 BRIN 인덱스 추가 |
| 10K visits/day | ~15M | events 테이블 월별 partition + read replica 분리 |
| 50K visits/day | ~75M | hot path 별도 view + 정기 archive |
| 100K visits/day | ~150M | **ClickHouse / Tinybird 검토** |

---

## 11. A/B 실험 프레임워크

### 11.1 Variant 할당

`useExperiment(key)` hook:
```ts
export function useExperiment<TVariantKey extends string>(
  experimentKey: string,
): TVariantKey | null {
  const anon = useAnonymousId();
  const config = useExperimentConfig(experimentKey);
  if (!anon || !config || config.status !== "running") return null;
  return assignVariant(anon, experimentKey, config.variants);
}
```

`assignVariant`:
- stable hash: SHA-256(`anonymous_id` + `experiment_key`) → 0~99
- cumulative weight 비교로 variant 선택
- 같은 anonymous_id → 항상 같은 variant
- 서버사이드 동일 알고리즘 (SSR 일관성)

할당 결과는 `experiment_assignments` jsonb에 자동 첨부 (모든 후속 이벤트에 묶임).

### 11.2 통계 유의성

- 간이 카이제곱 (2x2 매트릭스: variant × converted/not)
- p-value < 0.05 시 "유의" 표시
- 최소 표본 크기 알림 (per variant ≥ 200)
- Bayesian 정밀 통계는 §D 보류

### 11.3 v3 landing Phase D 실험 시드

- `home_sticky_threshold` (D.3) — A: `rect.bottom < 0` / B: `rect.bottom < viewport*0.5`
- `home_result_morphing` (D.1) — A: jump scroll / B: in-place morph (desktop)
- `home_result_bottomsheet` (D.2) — A: jump scroll / B: bottom-sheet (mobile)
- `home_cta_copy` (B.5 follow-up) — A: "맞춤 추천 받기" / B: "내 투어 찾기" / C: "30초 매칭 시작"

각 실험은 `analytics_experiments` row + 클라이언트 site에서 `useExperiment` 호출 + variant별 매처 펀널 비교.

---

## 12. 운영 / 헬스 / 알람

- `/admin/analytics/health` (Phase 7)
- 일일 이벤트 수 -50% 이상 변화 시 dashboard 배지
- 새 event_name detect 시 dashboard 알림
- ingestion 에러율 +1% 시 dashboard 배지
- Slack/Email 알람은 §D 옵션

---

## 13. 안 할 일 / 안티패턴

- ❌ **DOM 세션 리플레이** (rrweb 등) — 1주+ 작업, 스토리지 비용 폭증. §D
- ❌ 이벤트 schema 필드 **삭제** (backwards-compatible only)
- ❌ raw events에 PII 평문 저장 (텍스트 자유 필드 자동 reject)
- ❌ 비-admin이 분석 데이터 read
- ❌ ingestion endpoint에서 동기 작업 (반드시 batch + 즉시 202)
- ❌ 클라이언트 SDK가 메인 스레드 5ms 초과
- ❌ 외부 SaaS와 이중 추적 (한 쪽 표준 — 정확성 헷갈림)
- ❌ session_id를 URL 쿼리에 포함 (cookie only)
- ❌ anonymous_id를 user-facing UI에 노출 (admin에선 부분 마스킹)
- ❌ payload 자유 텍스트 필드 (`raw_intent`, `comment`, `note` 같은 필드 금지)

---

## 14. 실행 순서 요약

```
Day 1-1.5   Phase 1 Foundation
            (schema + ingestion + SDK 교체 + overview 화면)
Day 2       Phase 2 Events Explorer
Day 3       Phase 3 Funnels (5 predefined seed)
Day 4       Phase 4 Retention / Cohorts
Day 5       Phase 5 Session Timeline (이벤트 시퀀스 only)
Day 6       Phase 6 A/B Experiments  ← landing v3 Phase D unblock
Day 6.5     Phase 7 운영 / 헬스 / 90일 익명화
──────────────────────────────────────────────
총 6.5일 단일 개발자 풀타임 기준

Day 7+    Phase 8 옵션 (보류) — 트래픽 5x 도달 시 재검토
```

### Phase 의존 그래프

```
Phase 1 ── Phase 2 ── Phase 3 ── Phase 6
              │           │
              ├─ Phase 4 ─┤
              │           │
              └─ Phase 5  └─ Phase 7
```

Phase 4 + Phase 5는 Phase 2 후 병렬 가능.

---

## 15. 거버넌스

1. **이 마스터플랜이 자체 분석 시스템의 유일한 표준 실행 기준.**
2. v3 landing master plan과의 cross-ref:
   - v3 §A Phase 0b: ⏸ 보류 → 🔄 (이 plan 참조)
   - v3 §B 새 결정 row: "Phase 0b는 자체 빌드(atockorea-analytics)로 진행. 외부 provider는 §D 옵션으로 강등"
   - v3 §D: PostHog 보강 항목 추가 (세션 리플레이용)
3. 각 Phase는 독립 PR. Phase 1만 atomic (schema + endpoint + SDK + 첫 dashboard 묶음).
4. binding decision은 §B에 row 추가 / 번복 금지 (이력 보존).
5. 새 이벤트 추가 시 `docs/analytics-events-home.md` taxonomy doc 업데이트 + schema 확장 (필드 삭제 금지).
6. 분석 결과로 도출되는 핵심 결정(예: A/B 승자 채택, 펀널 회귀 롤백)은 v3 landing master plan §C에도 반영.
7. 90일 익명화 정책은 사용자 가시 영역 (PIPA 정보보호 정책 페이지)과 일관 유지.

---

## 16. 다음 액션

**즉시 (다음 세션):**
1. **Phase 1 시작** — 작업 4-5 sub-task 묶음:
   - Supabase schema 마이그레이션 (`supabase/migrations/`)
   - `src/design/analytics.ts` 확장 (anonymous_id / session_id / context 자동 수집 / batch queue)
   - `app/api/analytics/events/route.ts` 신규 endpoint
   - `app/admin/analytics/layout.tsx` + `/overview/page.tsx`
   - Materialized view `analytics_events_daily` 1개
2. v3 landing master plan §A/§B/§C cross-ref 업데이트

**중기 (Phase 1 랜딩 1주 후):**
- baseline 측정 (현 트래픽 매처 펀널 전환률 등)
- Phase 2-7 순차 진행

**장기 (Phase 7 완료 후):**
- v3 landing Phase D 진입 (A/B 시드 실험 시작)
- Phase 8 옵션 평가 (트래픽 + 가치 검토)

---

## 부록: v3 landing master plan과의 매핑

| v3 landing 항목 | 이 plan 항목 | 관계 |
|---|---|---|
| Phase 0a (이벤트 7종 정의) | Phase 1.2 (SDK 확장) | 0a는 입력. 1.2가 `trackEvent` 본문 교체 |
| Phase 0b (provider 미결정) | 이 plan 전체 | 0b가 이 plan으로 위임 |
| Phase D.1 in-place morphing | Phase 6 + 11.3 | D.1 실험을 `home_result_morphing` 키로 측정 |
| Phase D.2 bottom-sheet | Phase 6 + 11.3 | D.2 실험을 `home_result_bottomsheet` 키로 측정 |
| Phase D.3 sticky threshold | Phase 6 + 11.3 | D.3 실험을 `home_sticky_threshold` 키로 측정 |
| §A 롤백 트리거 (LCP/CTR/CLS) | Phase 1 + 2 + 3 | 자체 분석으로 임계값 측정 가능 |
| §2.6.1 bottom nav overlay | Phase 3 매처 펀널 | 펀널 step 6 (matcher CTA click) 전환률로 정량 평가 |
| §B.3.3 hero min-h 축소 (§D) | Phase 6 | A/B 실험으로 정량 판단 |
