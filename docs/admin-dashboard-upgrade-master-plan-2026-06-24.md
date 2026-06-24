# AtoC Korea 어드민 대시보드 전면 리뷰 · 개편 · 업그레이드 마스터 플랜

작성일: 2026-06-24
문서 상태: **표준 마스터 플랜 (어드민 대시보드 개편의 유일한 실행 기준)**
대상: `app/admin/**`, `app/api/admin/**`, 정산/세무 데이터 모델, 자체 analytics 엔진, 어드민 UI/UX 전반
작성 방식: 코드 레벨 정적 분석 + 데이터 흐름 모의 테스트(mock trace) + 미국 세법 1차 리서치(인용 포함). **이 단계에서 코드는 수정하지 않음 — 문제점/개편안만 기록.**

---

## 0. 이 문서의 위치

| 문서 | 역할 |
|---|---|
| **이 문서** | **어드민 대시보드 개편 표준. 모든 어드민 빌드 실행은 이 문서 기준** |
| `docs/atockorea-analytics-master-plan-2026-05-17.md` | 자체 analytics 시스템 마스터 플랜(Phase 1~7 완료). 통계 확장은 이 문서를 입력으로 사용 |
| `docs/STRIPE_SETUP.md` / `STRIPE_BUSINESS_DESCRIPTION.md` / `MERCHANT_ONBOARDING.md` | 결제·온보딩 현행 기준 |
| `supabase/_archive/20260422-220935/root-sql/complete-database-schema.sql` | 기초 비즈니스 테이블 canonical 정의(migrations는 ALTER만 수행) |

> ⚠️ **법무·세무 면책:** §G(세무/정산)와 본 문서의 모든 세법 해석은 **1차 리서치 결과이며 법률·세무 자문이 아니다.** "SIGN-OFF 필수"로 표기된 항목은 **미국 세무 변호사 + CPA의 검토·승인 전에는 어떤 자동 생성 서류도 신뢰·제출 금지.**

---

## §A. 상태 대시보드

| Phase | 제목 | 상태 | 비고 |
|---|---|---|---|
| 0 | 진단 + 마스터 플랜 (이 문서) | ✅ 완료 | 5개 도메인 병렬 코드감사 + 세법 리서치 종합 |
| 1 | 기능 안정화 (BLOCKER/MAJOR 버그 수정) | ⏳ 대기 | §D. 코드는 멀쩡해 보이나 깨진 기능 우선 |
| 2 | 디자인 시스템 통합 (토큰·팔레트·타이포·i18n) | ⏳ 대기 | §H.1. 모든 페이지 개편의 선행 조건 |
| 3 | 페이지별 UI/UX 개편 | ⏳ 대기 | §H.2~. Phase 2 토큰 위에서 한 페이지씩 |
| 4 | 데이터 모델 확장 (정산 원가/수수료·귀속·감사로그·견적 이탈) | ⏳ 대기 | §E·§F·§G. 마이그레이션 + 백필 |
| 5 | 통계/Analytics 정확성 수정 + 확장 | ⏳ 대기 | §F. 기존 엔진 수학 버그 수정이 먼저 |
| 6 | 세무 정산 자동화 (서류 자동 생성) | ⏳ 대기 | §G. CPA SIGN-OFF 게이트 통과 후에만 |
| 7 | 신규 운영 기능 (통합 인박스·견적 추적·대화 뷰어·감사 로그 UI) | ⏳ 대기 | §E |
| 8 | 압력 테스트 + 회귀 검증 + 운영 인수인계 | ⏳ 대기 | §I |

상태 마커: ⏳ 대기 / 🔄 진행 중 / ⏸ 보류 / ✅ 완료 / ❌ 중단

**현재 활성 Phase: Phase 0 완료. 다음 액션 = §J 오픈 입력(주(州) 등록지·수익인식 정책 등) 확인 → Phase 1 착수.**

> 실행 순서 원칙: **Phase 1(기능 안정화) → 2(디자인 토큰) → 3(UI 개편)** 은 사용자 체감 라인. **Phase 4(데이터) → 5(통계) → 6(세무)** 는 데이터 라인으로 병행 가능. Phase 6은 §J 세무 SIGN-OFF가 없으면 시작 금지.

---

## §B. 결정 로그 (binding)

각 행은 binding decision. 번복 시 새 row 추가, 삭제 금지.

| 날짜 | 결정 | 이유 |
|---|---|---|
| 2026-06-24 | **현행 코드 수정 없이 진단·플랜만 우선** (사용자 지시) | "고치지는 말고 문제점만 자세히 기록". Phase 1부터 실제 수정 |
| 2026-06-24 | 어드민 단일 **디자인 시스템(토큰)** 먼저 확정 후 페이지 개편 | 현재 3개 팔레트 혼재(slate/blue · indigo/gray/green · rainbow-emoji). 토큰 없이는 개편이 또 파편화 |
| 2026-06-24 | 정산 모델을 **flat 10% → 원가 기준(`fee = customer_amount − merchant_cost`)** 으로 교체 | 대리판매 경제구조를 현재 코드가 전혀 표현 못 함. 세무 전 수치 신뢰 불가 |
| 2026-06-24 | 거래당 **FX·통화·Stripe charge/fee·원가·운영수수료·수익인식 플래그** 컬럼 신설 | 미국 세무는 USD 기준. KRW 예약에 거래일 USD 환산값이 없음 |
| 2026-06-24 | 세무 자동화는 **"데이터·초안 워크시트 생성"까지만**, 자동 제출 금지 | §G. 책임은 withholding agent에게 1차 귀속(IRC §1461). CPA 승인 게이트 |
| 2026-06-24 | 1099-K 임계값은 **$20,000 / 200건** 기준으로 설계 (OBBBA 2025로 $600 단계안 폐기) | IRS OBBBA FAQ. $5k/$2.5k/$600 phase-in은 무효 |
| 2026-06-24 | 한국 tenant 지급액은 **기본 foreign-source = 무원천징수·무 1042-S** 로 설계하되 **W-8BEN-E 수집 + sourcing 메모 보관 의무화** | IRC §861/§862 용역 수행지 기준 + 한미조세조약. 방어 문서 필수 |
| 2026-06-24 | 모든 어드민 mutation 라우트에 **audit_logs 기록 헬퍼 의무 적용** | 현재 audit_logs는 2곳만 기록. 에이전트 활동기록 요구사항 충족 |
| 2026-06-24 | 모든 기록 화면(예약·문의·대화·결제·감사)은 **날짜+카테고리 그룹 + 접기/펼치기 + 서버 필터/검색/페이지네이션** 표준 패턴 | 사용자 요구: "날짜별·카테고리별로 보기/조작 쉽게" |
| 2026-06-24 | 상단 nav "데이터 분석"을 **자체 analytics 엔진(`/analytics/product/*`)** 으로 연결, 레거시 placeholder 페이지 폐기 | 강력한 엔진이 메뉴에 노출 안 됨(IA 결함) |
| 2026-06-24 | 통계 신뢰성 확보를 위해 **기존 analytics 라우트의 수학 버그를 신규 기능보다 먼저 수정** | distinct 합산 과대집계·funnel/retention 계산 오류·experiment 필터 폐기 등 |
| 2026-06-24 | 어드민 UI 문자열은 **한국어 1차 + i18n 키 체계 도입**, 영/한 혼용 제거 | 현재 페이지마다 영/한 무작위 혼용 |
| 2026-06-24 | `alert()/confirm()` 기반 피드백 전면 폐기 → **toast + 인라인 검증 + 모달 확인** 표준 | 원시적 UX의 핵심 원인 |

---

## §C. 변경 로그

Phase 진행 시 한 줄씩 추가. 커밋 단위.

| 날짜 | 항목 | 커밋 | 비고 |
|---|---|---|---|
| 2026-06-24 | Phase 0 — 어드민 전면 진단 + 마스터 플랜 작성 | (this) | 5개 도메인 병렬 감사(페이지·API·DB·정산/세무·UI) 종합 |

---

# §D. 기능성 리뷰 — 코드 레벨 모의 테스트 결과 (수정 전, 문제점 기록)

> 방법: 각 페이지를 backing `/api` 라우트까지 데이터 흐름으로 추적(mock trace)하고, null/에러/경계 조건을 코드상으로 모의 실행. 인증 패턴(`getSession()` → `Bearer`)은 **전 페이지 일관·정상**이며, 참조된 모든 `/api` 라우트는 실재하고 admin-guard가 걸려 있음. **다만 모든 어드민 라우트는 service-role 클라이언트를 사용 → RLS 우회, 즉 `requireAdmin`이 유일한 게이트**(권한 검증 1곳만 뚫려도 전 데이터 노출).

심각도: **BLOCKER**(핵심 기능 깨짐/오인) · **MAJOR**(중대 버그 또는 가짜/죽은 기능) · **MINOR**(견고성/엣지).

## D-1. 대시보드 (`app/admin/page.tsx`)
- **MAJOR** — "새 리뷰", "미처리 문의" 카운트가 **하드코딩 `0`** (`page.tsx:119`, `:129`). 랜딩 화면의 가짜 지표.
- **MAJOR** — `parseFloat(booking.final_price.toString())` (`:303`): `final_price`가 null이면 `null.toString()`에서 throw → 최근활동 렌더 전체 붕괴.
- **MINOR** — 403 경로 `alert()`(`:78`), `fetchStats` 취소 없음(재시도 레이스).
- 정상: USD 헤드라인 + KRW 서브 분리 표기(`:167-170`)는 의도적·정확.

## D-2. 주문/예약 (`orders/page.tsx`, `orders/[id]/page.tsx`)
- **BLOCKER** — 목록·CSV의 고객 이메일이 **항상 공란**: 페이지는 `user_profiles.email`을 읽지만(`orders/page.tsx:343`, CSV `:159`) 라우트가 프로필에서 `id, full_name`만 select(`api/admin/orders/route.ts:74`) 후 `email: '' `로 매핑(`:83`).
- **BLOCKER** — 주문상세 상태 `<select>`에 `no_show` 옵션 있으나 PUT 라우트가 400으로 거부(`orders/[id]/page.tsx:310-314` vs `api/admin/orders/[id]/route.ts:116-121`) → "No-show" 선택은 항상 실패하는 죽은 옵션.
- **BLOCKER**(API) — `orders/route.ts:120` `count`가 전체가 아니라 페이지 크기. 사실상 **페이지네이션 없음**, `select('*')` 최대 5만행 메모리 적재(`:7,22,34`).
- **MAJOR** — CSV "Amount"가 통화 없는 raw 숫자(`orders/page.tsx:164`): KRW 340000과 USD 52.00 구분 불가. Currency/Source 컬럼 부재.
- **MAJOR** — 클라이언트 날짜 그룹핑이 서버 정렬과 충돌(`:117,128-130`): 선택한 `orderBy`와 화면 순서 불일치.
- **MAJOR** — 상태 변경 PUT이 검증 없이 `status` 수용(`api/admin/orders/[id]/route.ts:122`) → `completed` 직접 지정으로 정산 우회 가능. 낙관적 롤백 없어 거부 시 select가 잘못된 값에 고정.
- **MAJOR** — `special_requests`를 무조건 `JSON.parse` → 평문이면 조용히 누락(`orders/[id]/page.tsx:483-508`). 빌더(KRW) `itinerary.breakdown`은 fetch하나 미렌더, Unit/Total이 `—`/`₩0`(`:521-531`).
- **MINOR** — `new Date(tour_date)` 무방비 "Invalid Date"; `/tour/[slug]` 링크는 실제 `/tour-product/[slug]`와 불일치로 404 추정.

## D-3. 정산 (`api/admin/orders/[id]/settle/route.ts`, `api/settlements/route.ts`)
- **MAJOR** — `collectedOffline` 해제 경로에 예약 상태 가드 없음 → 취소/환불 건도 paid/completed로 정산 가능. `no_show_fee_usd_cents`는 조회만 하고 미정산.
- 정상(예외적으로 견고) — settle는 **유일하게** `adminAuthJsonResponse`로 `AdminAuthFailure`를 정확히 401/403 처리, **모든 금액을 Stripe에서 읽음(클라 신뢰 금액·하드코딩 수수료 없음)**, Stripe PI 상태에 멱등. (정산 "로직"은 정확하나 "모델"이 틀림 → §G 참조.)

## D-4. 업체/Merchant (`merchants/page.tsx`, `[id]`, `create`)
- **BLOCKER**(API) — `merchants/create/route.ts:164-176`가 **평문 임시 비밀번호를 HTTP 응답으로 반환**(코드 주석 자체가 "remove in production"). 즉시 제거 대상.
- **MAJOR** — create 페이지가 더 약한 `/api/admin/merchants` POST로 전송(`create/page.tsx:43`): 이 라우트는 **트랜잭션 롤백 없음**(`route.ts:119-194`) → merchant insert 실패 시 auth user + user_profiles **고아 레코드**. 정작 안전한 `/create`(rate-limit·merchant_settings·audit·rollback)는 미사용.
- **MAJOR** — `merchants/route.ts:31` PostgREST `.or()`/ilike에 미sanitize `search` → 필터 인젝션.
- **MAJOR** — 성공 `alert()`이 "로그인 정보 전달하라"지만 페이지는 임시 비번을 못 받음(`create/page.tsx:74`). 온보딩이 에러 삼키는 best-effort 환영메일에 전적 의존.
- **MAJOR** — 목록 필터에서 `company_name.toLowerCase()` 등 null 가능값(`merchants/page.tsx:179-181`), 상세에서 `parseFloat(tour.price.toString())`(`[id]/page.tsx:340`) → 화면 전체 붕괴. 가격에 하드코딩 `₩`.
- **MAJOR** — POST와 `/create` 두 개의 상이한 생성 엔드포인트 공존(중복·표준 부재).

## D-5. 문의 (`contacts/page.tsx`)
- **MAJOR** — 필터/검색 변경 시 페이지를 1로 리셋 안 함(effect dep `[filters, pagination.page]`, `:43`) → 3페이지에서 필터 시 빈 "No inquiries found".
- **MAJOR** — 검색이 **키 입력마다** 인증 fetch(디바운스·취소 없음, `:267`+`:43`) → 요청 폭주·순서 꼬임.
- **MAJOR** — PATCH 실패 무음 처리(read 마킹 `:100`, 상태변경 `:92-146`은 `response.ok`만 갱신, 실패 메시지 없음).
- **MINOR** — 재fetch마다 전체를 스피너로 교체(검색창 포커스 상실), 세션 null 시 `Bearer undefined`.
- 구조 문제 — 문의가 **4곳에 분산**(contacts 폼 / emails / support 티켓 / chat). 날짜·카테고리 그룹핑 없음. → §E-4 통합 인박스로 해결.

## D-6. 받은 메일 (`emails/page.tsx`)
- **MAJOR** — 답장 후 영속 "replied" 상태 없음(`:190-192`); 백엔드 `is_replied`는 명시적 TODO(`api/admin/emails/[id]/reply/route.ts:149`). 답장 표시가 어디에도 없음.
- **MAJOR** — 키 입력마다 fetch(디바운스·취소 없음, `:72-74,241`), 필터 변경 시 페이지 리셋 안 함(`:93-99`).
- **MINOR** — `new Date(received_at)` "Invalid Date"; 첨부는 나열만 되고 다운로드 불가. HTML은 DOMPurify로 정상 sanitize.

## D-7. 이미지 업로드 (`upload/page.tsx`, `api/admin/upload/route.ts`)
- **BLOCKER**(API) — `upload/route.ts:99,118,203` **파일 크기 제한 미적용** + 비이미지/영상이 **public 버킷에 무제한 raw 업로드**.
- **MAJOR**(API) — content-type을 조작 가능한 클라 `file.type`로만 검사(magic-byte sniff 없음, `:103,128`); 미sanitize 클라 `folder`를 storage key에 직접 연결(`:91,216`).
- **MAJOR**(페이지) — 업로드가 **어느 투어에도 연결 안 됨** — URL을 수동으로 SQL에 붙여넣는 복붙 유틸(`upload/page.tsx:144-156`). "업로드=연결"로 오인 쉬움.

## D-8. 콘텐츠 CMS (`cms/page.tsx`)
- **MAJOR** — `loadState`에 try/catch 없음(`:55-86`); `setLoading(false)`가 마지막 줄에만 → 중간 throw(토큰 만료) 시 스피너 영구 고착.
- **MAJOR** — 403 처리가 `cmsRes`만 검사하고 병렬 `imgRes`는 미검사(`:65-69`) → 이미지 403 시 카드 섹션 무음 공백.
- CMS 라우트 자체는 BLOCKER/MAJOR 없음(필드명 일치).

## D-9. 상품 관리 에디터 (`products/**`) — 별도 정밀 감사 요약
- **MAJOR(잠재 BLOCKER)** — 모든 저장이 `detail_payload`를 보내는데 API가 `detail_payload.schema_version >= 1` 없으면 400(`ProductEditorPane.tsx:70` vs route `197-214`). 에디터가 schema_version을 세팅 안 함 → 이 필드 없는 행은 **영구 저장 불가**.
- **MAJOR** — 상품 로드 fetch에 취소/in-flight 가드 없음(`useProductPage.ts:32-66`) → 빠른 전환 시 stale 데이터로 덮어씀.
- **MAJOR** — FAQ read/write 키 모호성(`staticQuestions` vs `faqs`) → 첫 편집 시 legacy 데이터 stranding(`ProductEditorPane.tsx:289-293,349-353`).
- **MAJOR** — Hero rating/ratingStars가 편집 시 `?? 0`/`?? 5`로 강제 → 의도적 null 덮어씀, "평점 없음" 표현 불가(`:321-322`, `HeroSection.tsx:134,185,189`).
- **MINOR 군집** — caption·stop별 image는 저장되나 편집 UI 없음(caption은 placeholder로 degrade); 갤러리 삭제 시 Storage 객체 고아(DELETE 엔드포인트 존재하나 미호출); 발행 플래그가 `tours.is_active` vs `tour_product_pages.is_published` 2-테이블 불일치.

## D-10. 매칭 POI (`match-pois/**`)
- **MAJOR** — 범위 밖 lat/lng가 저장을 막지 못하고(소프트 경고만, `PoiEditorPane.tsx:38,473`) API가 전체 upsert를 거부(`[poi_key]/route.ts:122-127`) → 무관 필드 편집까지 차단, 인라인 표시 없음.
- **MAJOR** — `NumberField`가 비숫자 입력 시 stale draft 유지(`PoiEditorPane.tsx:453-461`) → 모델/표시 괴리, 저장 미차단.
- **MAJOR** — "기타/other" region 필터가 null-region과 진짜 비클러스터 region을 혼동(`PoiListPane.tsx:58-63`).

## D-11. 시스템 설정 (`settings/page.tsx`)
- **BLOCKER** — "Maintenance Mode", "Allow New Registrations" 토글이 **저장은 되나 아무것도 강제 안 함**(`:162-186`): repo 전체에 reader 없음(maintenance 미들웨어·가입 게이트 부재). 완전 작동하는 것처럼 보이는 no-op.
- **MAJOR** — 저장 중 상태/disable 없음(`:191-196`) → 더블 서밋. GET이 DB 에러를 삼키고 기본값으로 success 반환(`api/admin/settings/route.ts:32-37`).

## D-12. 챗봇 분석 (`chatbot-analytics/page.tsx`)
- **MAJOR** — 헤드라인 지표가 전체 기간인데 라벨은 "최근 30일"(`:64,117,135`): 라우트의 volume/feedback/Q&A/RAG 카운트에 날짜 필터 없음(`api/admin/chatbot-analytics/route.ts:44-72`). 라벨과 수치 모순.
- **MAJOR** — `days` 윈도우가 라우트엔 있으나 UI는 30 하드코딩·선택기 없음(죽은 컨트롤). `escalationRate` 등 fetch하나 미렌더.
- 데이터 caveat — `chat_messages.category`/`chat_feedback.*` 부재 시 페이지 500.

## D-13. 지원 티켓 (`support/page.tsx`, `[id]`)
- **MAJOR** — 목록 무음 50행 절단, 페이지네이션 없음(`api/admin/support/tickets/route.ts:21` 기본 50). 50개 초과 시 구건 비가시.
- **MAJOR** — 답장에 in-flight/disable 없음(`[id]/page.tsx:97-112`) → 더블클릭 시 메시지·QA 초안 2중 생성.

## D-14. QA 리뷰 (`qa-review/page.tsx`)
- **BLOCKER** — 필터 드롭다운 `true`/`false` 옵션이 항상 0행(`:141`): `review_status`는 `draft|approved|rejected|needs_edit`만 존재하나 쿼리는 `.eq("review_status","true")`(`api/admin/qa-pairs/route.ts:35`). 옵션·카운트 영구 죽음.
- **MAJOR** — 키보드 액션 in-flight 가드 없음(`:91,110`) → 빠른 키 입력 시 같은 항목 더블 PATCH/스킵.

## D-15. 통계/Analytics 엔진 정확성 (`api/admin/analytics/**`) — ⚠️ 핵심
> 이 자체 엔진은 "잘 만든 부분"으로 보였으나, **집계 수학에 다수 정확성 버그**가 있어 통계를 신뢰할 수 없음. requireAdmin은 11개 라우트 전부 정상.
- **BLOCKER** — `overview/route.ts:69-76` total_visitors가 버킷별 distinct 합산을 전체 distinct로 오표기(과대집계).
- **BLOCKER** — `funnels/[key]/route.ts:163-218` funnel을 세션 단위 + 30분 윈도우로만 계산 → 다중세션/장기 funnel 완료 불가. `:151` 200k cap ASC 정렬로 cap-hit 시 최근 데이터 유실.
- **BLOCKER** — `retention/route.ts:29,53-54,87` cohort 기준일을 윈도우 가장자리에 고정(실제 first-seen 아님) → cohort/분모 손상. 주석은 SQL window 함수라지만 실제로는 최대 50만행을 JS로 적재(`:34-38`). 익명→로그인 identity stitching 없음(`:51`).
- **BLOCKER** — `experiments/[key]/route.ts:110-121` 전환을 이벤트명만으로 계산하고 funnel 필터 폐기(`void conversionFilter`) → 전환율·chi-square 무효. chi-square가 variant[0] vs [1] 하드코딩(`:140-149`, 3+ variant 미지원).
- **BLOCKER** — `events/[name]/route.ts:64-65,167-169` 50k cap 부분집합을 totals로 라벨; timeseries 신선도 로직 반전으로 오늘 마지막 시간 무음 누락(`:88-97`).
- **MAJOR** — `events/route.ts:86-89` distinct 합산 오표기; raw 24h 병합이 first/last_seen만 갱신·카운트 미반영(`:118-133`); raw 24h 쿼리 무제한(`:51-53`).
- **배포 의존** — `health/route.ts:20`가 RPC `analytics_health_snapshot()` 호출하나 해당 CREATE FUNCTION이 analytics 마이그레이션에 없음 → 미배포 시 500.

## D-16. 횡단 패턴 (전 페이지 sweep 대상)
1. 필터 변경 시 페이지네이션 미리셋 (contacts, emails).
2. 키 입력마다 fetch·디바운스/취소 부재 → 레이스 (contacts, emails, orders/merchants/poi 훅).
3. `parseFloat(x.toString())`·`.toLowerCase()`를 null 가능값에 → 화면 전체 크래시 (dashboard, merchants).
4. in-flight/더블서밋 가드 부재 (settings, support 답장, qa-review).
5. `/tour/[slug]` vs 실제 `/tour-product/[slug]` 404 링크.
6. 거의 모든 피드백이 `alert()/confirm()`.

---

# §E. 신규 기능 플랜 (요구사항 + 운영 보강)

> 공통 UX 표준(§B): 모든 기록 화면 = **날짜 그룹 헤더 + 카테고리 탭/칩 + 접기/펼치기 + 서버 필터·검색·페이지네이션 + CSV/Export**. 가상 스크롤(대량 행) + URL 쿼리 동기화(공유 가능한 필터 상태).

## E-1. 예약(견적) 추적 — "고객이 견적을 냈는지 / 어디서 이탈했는지"
현황(§gap a): 빌더 이벤트 일부만 발화, 중간 단계 이벤트·드래프트 영속 없음. 이탈은 "build_start 후 booking_submitted 없음"의 거친 2점 추론만 가능.
- 신규 스테이지 이벤트: `builder_poi_added/removed`, `builder_day_reordered`, `builder_quote_modal_opened`, `builder_intake_submitted`, `builder_price_shown`, `builder_abandoned`(beforeunload + last_stage).
- 신규 테이블 `quote_drafts`(anonymous_id, user_id, region, track, poi_keys[], intake jsonb, last_stage, price_shown, abandoned_at, converted_booking_id). 빌더 진행에 따라 upsert.
- `analytics_funnels`에 빌더 스테이지 funnel 정의 추가 → 어드민에서 단계별 이탈 맵.
- 어드민 화면: "견적 요청" 탭 — 단계별 깔때기 + 미전환 드래프트 목록(연락처 있으면 follow-up 액션) + 전환된 건 링크.

## E-2. AI 챗봇 대화내역 뷰어
현황(§gap b): `chat_messages`에 **모든 턴 + 모델/토큰/비용/분류/에스컬레이션/임베딩** 이미 완전 저장됨. 필요한 건 리더 UI뿐.
- 화면: 세션 목록(최근/장기/에스컬레이션됨) → 세션 상세(시간순 말풍선, role 구분, 페이지 컨텍스트, 분류·신뢰도 배지, 토큰/비용, support ticket 링크). 검색(내용/슬러그/카테고리), 날짜 그룹.
- chat_feedback(👍/👎) 오버레이, QA 초안 승격 버튼(기존 파이프라인 연결).

## E-3. 에이전트(어드민) 활동 기록 — 감사 로그
현황(§gap c): `audit_logs` 테이블은 존재하나 **2곳만 기록**(merchant_created, change-password). 고객용 `user_activity_logs`는 admin 감사 아님.
- `lib/admin/audit.ts` 기록 헬퍼 신설 → **모든 어드민/merchant mutation 라우트에 의무 호출**(예약 상태변경·환불·정산 실행·티켓 답장·상품/머천트 편집·설정 변경). actor_id, action, resource_type/id, before/after diff(jsonb), ip, ua.
- 인덱스 `(user_id, created_at)`, `(resource_type, resource_id)`(스키마에 이미 명시).
- 화면: 활동 타임라인(actor·액션·대상·diff 펼치기), 날짜/액션/actor 필터.

## E-4. 통합 문의 인박스 — 날짜·카테고리 정리
현황(§gap d): 문의가 received_emails / support_tickets / chat_messages 3원화. 각각 카테고리·날짜 보유.
- `unified_inquiries` view(또는 materialized view): 3소스를 (source, category, contact, created_at, status, ref_id)로 정규화 UNION.
- 화면: 단일 인박스 — 소스 칩(메일/티켓/챗/폼) + 카테고리 칩(support/inquiry/complaint/booking/legal/refund…) + 날짜 그룹 + 미처리 배지(대시보드 D-1 하드코딩 0 대체) + 검색.

## E-5. 운영 보강 기능(미언급이나 필요)
- **정산 운영 화면**: 현재 정산은 API-only, 어드민/머천트 화면 부재(`app/admin/settlements/**` 없음). 기간별 정산 생성·미리보기·명세서 발행·지급 상태 추적.
- **환불/취소 워크플로**: 예약 상세에 Stripe 환불 트리거 + 사유 + audit. 현재 환불 필드는 있으나 UI/정산 반영 미흡.
- **재고/가용성 관리**: `product_inventory`(날짜별 capacity) 편집 UI 부재.
- **알림 센터**: 신규 예약·미처리 문의·에스컬레이션·정산 마감 통합 알림(현재 Telegram 브리지만 존재).
- **글로벌 검색/커맨드 팔레트**(⌘K): 예약·고객·상품·티켓 교차 검색.

---

# §F. 통계/Analytics 확장 플랜

> 원칙(§B): **기존 엔진의 수학 버그(§D-15)를 먼저 수정**해 신뢰 가능한 베이스라인 확보 → 그 위에 요구 지표 확장. 상단 nav "데이터 분석"을 레거시 placeholder(`/admin/analytics`, "Chart will be added here" + 혼합통화 ₩오표기)에서 자체 엔진으로 교체.

## F-1. 수학 버그 수정 (Phase 5 선행)
- distinct 합산 과대집계 → DB `COUNT(DISTINCT)` 단일 쿼리/매트뷰로 교체(overview, events).
- funnel을 세션·30분 한정에서 **identity-stitched user 단위 + 설정 가능한 conversion window**로 재계산. cap-hit 시 플래그·정렬 명시.
- retention cohort를 **실제 first-seen 기준**으로, identity stitching(anonymous→user) 반영.
- experiment 전환에 funnel 필터 실제 적용, n-variant chi-square 일반화.
- `analytics_health_snapshot()` 등 미배포 RPC 마이그레이션 확정.

## F-2. 요구 지표 확장
- **유입/귀속**: utm_source/medium/campaign·referrer·entry_path는 `analytics_sessions`에 first-touch로 이미 수집됨 → **주문/문의에 귀속 FK 부재**가 핵심 gap(§gap e). `bookings`·`support_tickets`에 `utm_*`, `referrer`, `landing_page`, `attribution_session_id`, `anonymous_id` 비정규화(체크아웃 시 SDK 쿠키에서 세팅) → "주문/문의별 전환 경로"가 단일 행 쿼리.
- **주문량·문의량 시계열**: 통화 분리(USD/KRW, FX-USD 환산 §G)된 일/주/월 추이.
- **이탈/전환 지점**: 페이지·funnel 단계별 drop-off, 전환 높은 지점(랜딩 매처·featured·상세).
- **상품별 클릭→조회→견적→전환 + 이탈률**(§gap f): 모든 product-funnel 이벤트에 `slug`/`product_id` 표준 부착(현재 비일관), 노출(impression) 이벤트 신설, 상품별 funnel 매트뷰(노출·클릭·상세조회·전환·단일페이지 이탈수). 상품별 bounce rate.
- **링크 추적**: referral 링크/캠페인별 유입·전환(utm 기반 + 단축링크 매핑 옵션).

## F-3. 표현
- 시계열 차트(Recharts) — 현재 placeholder를 실제 차트로. 통화 토글, 기간 비교, breakdown(locale/device/country/utm).
- 상품별 funnel 비주얼, cohort 히트맵(기존 retention 개선판), 실시간 요약 카드.

---

# §G. 법무·세무 / 정산 자동화 플랜 — ⚠️ 최우선 리스크 영역

> **목표:** ATOC Korea LLC(미국 법인)가 Stripe로 전액 수금 → tenant 원가 + 현지 운영수수료를 거래별로 정확히 분해 → 미국 세무 제출 서류를 **데이터·초안 워크시트까지 자동 생성**, 세무 리스크 0. **자동 제출은 하지 않음.**

## G-1. 현행 코드/모델 진단 (Part 1)
- **Stripe Connect 미사용** — `transfer_data`/`application_fee_amount`/`on_behalf_of` 없음. ATOC가 단일 플랫폼 키로 **전액을 자기 잔고로 수금**(`stripe/checkout/route.ts:24-27`), 머천트엔 **별도 은행 송금**(out-of-band). → 세무상 **principal(gross)** 성격을 강화(§G-3).
- **Capture 모델**: 투어 ≤7일 → manual-capture PaymentIntent(auth hold), >7일 → SetupIntent(vault) + cron이 ~5일 전 hold. 투어 시점 capture(`settle/route.ts:163-173`).
- **다중통화·FX 미포착**: `bookings.currency` usd/krw, **거래일 FX·USD 환산값 없음**. `lib/exchange/usdBasedRates.server.ts`는 표시용 실시간 환율뿐. 미국 세무는 USD 기준 → KRW 예약에 감사 가능한 USD 값 부재.
- **정산 모델이 비즈니스와 불일치(핵심 결함)**: RPC가 **flat %** 로만 계산 — `platform_fee = revenue × 0.10`, `merchant_payout = revenue × 0.90`(`20260515132911_*.sql:81-82`), 호출부는 rate 미전달로 **전부 10/90 하드코딩**(`api/settlements/route.ts:109-115`). **머천트 실원가(원가)가 입력이 아님** → ATOC가 실제로 갖는 수수료가 `customer_price − merchant_cost`가 아니라 허구. 하류 세무 수치 전부 불신.
- **스키마 결손**: `tours`에 `cost`/원가 없음; `bookings`에 merchant cost·operational fee·FX·Stripe fee·charge/balance-txn id·tax 분류 없음; `settlements`에 **통화 컬럼 없음**(USD/KRW 총액 구분 불가); `settlement_bookings`은 멱등 설계는 좋으나 % 파생 잘못된 숫자를 스냅샷. 환불 필드는 있으나 RPC가 무시.
- 긍정: webhook 멱등·"capture 다운그레이드 방지" 가드 견고; RPC는 `FOR UPDATE` 원자적 + `service_role` 한정.

## G-2. 신규 데이터 모델 (Phase 4)
거래(주문)당 추가: `merchant_cost`(원가), `operational_fee`(= customer_amount − merchant_cost), `currency`, `fx_rate_to_usd` + `usd_amount`(거래일 포착), `stripe_charge_id`, `stripe_balance_txn_id`, `stripe_fee`, `revenue_treatment`(gross/net), `place_of_performance`, `us_source`(bool).
머천트당: `is_us_person`, `tax_id`, `w8_on_file`, `w8_expiry`.
`settlements`에 `currency` 추가. **flat-10% 공식을 원가 기준 `fee = customer_amount − merchant_cost`로 교체.** `tours.cost_price` + `cost_currency`(도매 원가) 신설.
→ 이 필드들이 §G-4 모든 자동 서류의 전제 조건. 기존 예약 백필 전략 필요(원가 소급은 머천트 계약서 기반 수기 보정 가능성).

## G-3. 세법 규칙 → 데이터 요구 (Part 2, 인용)
1. **Agent vs Principal / gross vs net (게이트, SIGN-OFF 필수)** — ASC 606 control 기준. 마케팅 문구(STRIPE_BUSINESS_DESCRIPTION: "intermediary")는 agent를 시사하나, 코드 사실(전액 수금·가격/할인 재량·카드/차지백 리스크·예약계약 발행)은 **principal/gross**를 시사. **상품별로 다를 가능성**(ATOC 자체 프라이빗투어=principal, 대리판매 tenant=조건부 agent). gross↔net은 보고 총수입을 ~10× 좌우 → 1099-K 대사·sales tax 과세표준·주 apportionment에 연쇄. [PwC 10.1, Deloitte 10.2, RevenueHub]
2. **1099-K (Stripe)** — OBBBA(2025)로 임계값 **$20,000 & 200건**으로 환원($600 단계안 폐기). Stripe가 ATOC에 **gross(환불/수수료/지급 전)** 기준 발행 → recognized revenue와 큰 괴리. 대사 필요. [IRS OBBBA FAQ, Avalara, PwC]
3. **외국(한국 tenant) 지급 — 1042/1042-S·W-8BEN-E·sourcing (SIGN-OFF 필수)** — 용역은 **수행지 기준 소득원천**(IRC §861/§862). 한국 수행 투어 = **foreign-source → 일반적으로 30% 원천징수·1042-S 대상 아님**. 한미조세조약상 PE 없으면 사업소득은 한국 과세. **단, 포지션 방어를 위해 tenant별 W-8BEN-E 수집 + sourcing 메모 보관 필수.** [IRS Pub 515, NRA withholding, W-8BEN-E instr, 한미조약]
4. **1099-NEC/MISC** — 미국인 수취인 대상. W-8 보유 외국 tenant는 제외. ATOC가 **미국 거주 가이드/제휴자에게 연 $600↑** 지급 시 1099-NEC 필요. [Pub 515]
5. **Sales/occupancy/amusement tax · nexus (주별, SIGN-OFF 필수)** — Wayfair 경제적 nexus 통상 $100k 또는 200건(대형주 $500k). 투어/여행 용역 과세 여부는 **주별 상이**(다수 주는 용역 비과세, 일부 admission/amusement 과세). 마켓플레이스 facilitator 규정. [Sales Tax Institute, Avalara]
6. **주 LLC franchise/income tax (등록 주 = 필수 입력)** — DE: 연 $300(6/1, 연차보고 없음). CA: 연 $800 최소 + gross-receipts 수수료($250k↑). 소득세·apportionment는 등록/영업 주에 의존. [DE Div. of Corps, CA LLC guide]
7. **기록 보존** — 일반 3년, 고용세 4년, 25%↑ 누락 6년, 무신고/사기 무기한. W-8 통상 3년. → 거래별 불변 레코드 + 보존 클래스. [IRS recordkeeping]
8. **벌칙 리스크** — 원천징수 오류 시 **withholding agent 1차 책임**(IRC §1461; §1463도 이자·벌금은 면제 안 함). 1099 오류 §6721/§6722 + 24% backup withholding. agent/principal 오분류 시 총수입·과세표준·nexus 임계 연쇄 오류.

## G-4. 자동 생성 서류 (Phase 6, SIGN-OFF 게이트 후)
- **연간 수익인식 요약**: gross 뷰(매출/원가/마진) + net 뷰(수수료) 동시 산출(상품군별) → CPA가 포지션 선택, 양쪽 장부 정합.
- **Stripe 1099-K 대사 리포트**: `1099-K gross = recognized revenue + merchant payouts + refunds/chargebacks ± FX/timing` 라인별, 미설명 delta 플래그.
- **W-8 컴플라이언스 대시보드**: tenant별 유효/만료 W-8BEN-E, 3년 만료 전 알림.
- **외국 수취인 sourcing 원장 + 1042-S export stub**: US-source로 표시된 지급만 1042-S 처리(기대값: 비어 있음 = 방어 기록).
- **1099-NEC 후보 리포트**: 미국인 수취인 연 $600↑만, W-8 외국 tenant 명시 제외.
- **Nexus 모니터 + 주별 징수액 리포트**: 12개월 롤링 매출·건수 vs 주별 임계 알림.
- **주 신고 캘린더 + franchise tax 추정기**: 등록 주 기준(DE/CA…). **주 확정 전 미완.**
- **연간 세무기록 아카이브 export**(불변, ≥7년): 거래 원장 + Stripe 대사 + W-8 세트 + 정산 명세.

## G-5. 필수 전문가 SIGN-OFF (자동 서류 신뢰 전 게이트)
미국 세무 변호사 + CPA가 다음을 승인해야 Phase 6 착수: (1) 상품별 agent-vs-principal(§G-3.1), (2) 한국 tenant foreign-source·무원천징수 결론(§G-3.3), (3) 실제 nexus 주의 과세 여부(§G-3.5), (4) 주 확정 후 franchise/income 신고(§G-3.6).

---

# §H. UI/UX 전면 개편 플랜

> 진단: 사용자 표현대로 "원시적". 근거 — **3개 팔레트 혼재**(대시보드 slate/blue · 주문 indigo/gray/green · 분석 rainbow-emoji 🏢🎫📦💰), 페이지마다 **영/한 무작위 혼용**, **`alert()` 저장 확인**, 정보 위계 부재(text-xl~text-3xl 제각각), 빈/로딩/에러 상태 비일관, 모바일에서 죽는 컨트롤(미리보기 desktop-only 등), 강력한 analytics가 메뉴에 노출 안 됨(IA 결함), placeholder 화면이 메인 분석으로 노출.

## H-1. 디자인 시스템 통합 (Phase 2 — 전 페이지 개편의 선행 조건)
- **토큰**: 단일 팔레트(중립 slate + 단일 accent), 시맨틱 색(success/warn/danger/info), 라운드/섀도/스페이싱/타이포 스케일 토큰화(tailwind config + CSS 변수). 기존 customer 사이트의 amber 규율과 충돌 없이 어드민 전용 스코프.
- **컴포넌트 키트**(`components/admin/ui/*`): Button(variant/size/loading), Input/Select/Textarea(label·error·hint), Table(정렬·빈·로딩·페이지네이션), Card/StatCard, Badge(상태 시맨틱), Tabs, Drawer/Modal(=alert 대체), Toast, EmptyState, FilterBar, DateRange, Pagination, Skeleton.
- **i18n**: 어드민 문자열 키화(ko 1차), 영/한 혼용 제거.
- **표준 패턴**: 페이지 헤더(타이틀+액션+breadcrumb), 리스트(FilterBar+Table+Pagination), 마스터-디테일(데스크탑 우측 레일 / 모바일 시트), 폼(검증·dirty·저장상태·확인 모달).
- **a11y**: aria-label·focus ring·키보드 내비·대비 기준. 토글 `aria-pressed`, 글리프 버튼 라벨.

## H-2. 정보 구조(IA)·내비게이션
- nav 재편: 운영(예약·문의·정산) / 콘텐츠(상품·CMS·POI·업로드) / 인텔리전스(분석·챗봇·견적추적) / 시스템(머천트·설정·감사로그) 그룹핑.
- "데이터 분석" → 자체 엔진 연결, 레거시 placeholder 폐기. 통합 인박스 진입점.
- 대시보드 재설계: 실데이터 KPI(하드코딩 0 제거), 통화 분리 매출, 미처리 큐(예약/문의/티켓/정산), 최근 활동, 빠른 작업.

## H-3. 페이지별 개편 (Phase 3, 한 페이지씩 — 토큰 적용 + §D 버그 동반 수정)
순서(트래픽/가치): 대시보드 → 주문/예약 → 통합 문의 인박스 → 정산 → 상품 → 머천트 → 분석 → 챗봇/견적추적 → POI/CMS/업로드 → 설정/감사로그.
각 페이지 작업: 디자인 토큰 적용 · 빈/로딩/에러/스켈레톤 표준화 · 날짜·카테고리 그룹 + 접기/펼치기 · 서버 필터/검색(디바운스)/페이지네이션 · 모바일 패리티 · alert→toast/modal · §D 해당 버그 수정.

## H-4. 마이크로 인터랙션·완성도
낙관적 업데이트 + 롤백, 인라인 검증, 키보드 단축키(⌘K 검색, j/k 내비), 가상 스크롤(대량), 저장 상태 표시, 일관된 모션(절제), 다크 모드(옵션).

---

# §I. 압력 테스트 · 검증 (Phase 8)
- **부하/스케일**: 주문 5만행·이벤트 대량에서 페이지네이션·쿼리·메모리(현 `select('*')` 전수 적재 제거 검증).
- **경계/널**: §D-16 null-크래시 패턴 회귀 테스트(final_price/price/company_name null).
- **권한**: 전 어드민 라우트 requireAdmin·service-role 경계 재검증, 비admin/만료토큰/타테넌트 접근 차단.
- **금액 정합**: settle·환불·정산이 Stripe 잔고/1099-K와 대사 일치(통화·FX 포함).
- **분석 정확성**: §D-15 수정 후 known-input → expected-output 골든 테스트.
- **E2E**: 핵심 어드민 플로우(예약 상태변경·정산 발행·문의 처리·상품 저장) Playwright.

---

# §J. 오픈 입력 (사용자/전문가 확인 필요 — Phase 4·6 블로커)
1. **ATOC Korea LLC 등록 주(州) 및 영업 주** — §G-3.5/3.6, 주 신고 캘린더·franchise·sales tax 전제. **확인 전 §G-4 일부 미완.**
2. **CPA의 수익인식 정책(상품군별 gross/net)** — §G-3.1 게이트. 자동 수익요약의 기준.
3. **모든 tenant 투어가 한국에서 수행됨 확인** — §G-3.3 sourcing 앵커.
4. **미국 거주 계약자/제휴자에게 연 $600↑ 지급 여부** — §G-3.4(1099-NEC) on/off.
5. **머천트별 실원가(원가) 소스** — 기존 예약 백필 방법(계약서 단가표 등).
6. **어드민 디자인 방향성** — 어드민 전용 중립 톤 vs customer amber 계승 정도.

---

## 부록 — Phase별 산출물 한눈에
| Phase | 핵심 산출물 |
|---|---|
| 1 기능 안정화 | §D BLOCKER 6건(주문 email·no_show·QA 필터·설정 토글·대시보드 0/null·머천트 평문비번/롤백) + MAJOR 수정 |
| 2 디자인 토큰 | 토큰·컴포넌트 키트·i18n·표준 패턴 |
| 3 UI 개편 | 페이지별 개편(토큰+버그 동반) |
| 4 데이터 모델 | 정산 원가/수수료·FX·귀속 FK·audit_logs·quote_drafts·unified_inquiries |
| 5 통계 | analytics 수학 버그 수정 + 유입/이탈/전환/상품별 funnel/bounce 확장 |
| 6 세무 자동화 | 수익요약·1099-K 대사·W-8 대시보드·sourcing 원장·nexus 모니터·아카이브 (SIGN-OFF 후) |
| 7 신규 운영 기능 | 통합 인박스·견적추적·대화 뷰어·감사 UI·정산 운영·환불·재고·⌘K |
| 8 검증 | 부하·널·권한·금액정합·분석정확성·E2E |
