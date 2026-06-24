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
| 0.5 | 검증 2차 패스 (§K) — 전 주장 코드 재대조 | ✅ 완료 | 3개 감사 에이전트 재검증. 핵심 주장 CONFIRMED, C1~C12 정정 + N1~N10 신규결함 + R1~R4 위험. 라이브 DB는 MCP 미연결(K-0) |
| 0.6 | UI/UX 코드 심층 감사 (§K-6) — §H 실행 사양화 | ✅ 완료 | 3개 UI 감사 에이전트. 토큰·`ui/*` 16개 100% 미사용 발견 → §H-1 정정(신규도입→채택). 드리프트 정량화 + 현재값→토큰 매핑표 + 우선순위(legacy analytics #1) |
| 1 | 기능 안정화 (BLOCKER/MAJOR 버그 수정) | ⏳ 대기 | §D. 코드는 멀쩡해 보이나 깨진 기능 우선 |
| 2 | 디자인 시스템 통합 (토큰·팔레트·타이포·i18n) | ⏳ 대기 | §H.1. 모든 페이지 개편의 선행 조건 |
| 3 | 페이지별 UI/UX 개편 | ⏳ 대기 | §H.2~. Phase 2 토큰 위에서 한 페이지씩 |
| 4 | 데이터 모델 확장 (정산 원가/수수료·귀속·감사로그·견적 이탈) | ⏳ 대기 | §E·§F·§G. 마이그레이션 + 백필 |
| 5 | 통계/Analytics 정확성 수정 + 확장 | ⏳ 대기 | §F. 기존 엔진 수학 버그 수정이 먼저 |
| 6 | 세무 정산 자동화 (서류 자동 생성) | ⏳ 대기 | §G. CPA SIGN-OFF 게이트 통과 후에만 |
| 7 | 신규 운영 기능 (통합 인박스·견적 추적·대화 뷰어·감사 로그 UI) | ⏳ 대기 | §E |
| 8 | 압력 테스트 + 회귀 검증 + 운영 인수인계 | ⏳ 대기 | §I |

상태 마커: ⏳ 대기 / 🔄 진행 중 / ⏸ 보류 / ✅ 완료 / ❌ 중단

**현재 활성 Phase: Phase 0 + 0.5(검증) 완료. 다음 액션 = §J 오픈 입력 확인 + §K-5 다음 세션 범위(§H UI/UX 심층 검증 등) → Phase 1 착수. Phase 1 BLOCKER는 §D 6건 + N1(익명화 RPC 미배포)·N2(업로드 검증 dead code) 포함.**

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
| 2026-06-24 | **등록 주 = Wyoming(와이오밍) 확정** (사용자 확인) | 주 소득세·franchise tax 없음. 연차보고 license tax = max($60, WY자산×0.0002)뿐. 주 신고 캘린더 단순화 |
| 2026-06-24 | LLC가 **외국인 소유면 Form 5472 + pro-forma 1120 연 신고 의무** 자동 추적 대상에 포함 | 미신고 건당 $25,000 벌금. 소유구조 확인 후 §G-4 서류에 편입 (SIGN-OFF 필요) |
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
| 2026-06-24 | §J 갱신 — 등록 주=Wyoming 확정 + Form 5472 + 수익인식 설명 | fae9319 | — |
| 2026-06-24 | Phase 0.5 — 검증 2차 패스(§K). 전 주장 코드 재대조, C1~C12 정정·N1~N10 신규·R1~R4 위험. §D/§D-15 본문 직접 수정 | (this) | 라이브 DB는 MCP가 타 프로젝트(Kursoflow) 연결로 미검증(K-0) |
| 2026-06-24 | Phase 0.6 — UI/UX 코드 심층 감사(§K-6). 토큰·`ui/*` 16개 미사용 발견 → §H-1 정정, 현재값→토큰 매핑표·컴포넌트 키트·우선순위 | (this) | 모범 사례 products/match-pois/analytics-product 구조 보존 |

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
- **MAJOR** (당초 BLOCKER → 검증 후 하향) — 목록·CSV에서 **`user_profiles` 조인이 `email`을 select하지 않아 프로필 이메일은 항상 공란**(`api/admin/orders/route.ts:74,83`). 단 UI는 `contact_email` 폴백이 있어(`orders/page.tsx:343`, CSV `:159`; 라우트가 `contact_email` 반환 `:113`) 게스트/빌더 예약은 정상 표시되고, **로그인 유저 예약 중 contact_email 없는 건만 N/A**. (당초 "항상 공란"은 과장 — 폴백 누락분만 공란.)
- **BLOCKER** — 주문상세 상태 `<select>`에 `no_show` 옵션(`orders/[id]/page.tsx:314`, select 블록 `304-315`)이 있으나 PUT 라우트가 400으로 거부(`api/admin/orders/[id]/route.ts:116-121`) → "No-show" 선택은 항상 실패. (별도의 전용 no-show 버튼 `[id]/page.tsx:654-666`은 settle 경로로 정상 작동 — 드롭다운 옵션만 죽은 경로.)
- **BLOCKER**(API) — `orders/route.ts:120` `count`가 전체가 아니라 페이지 크기. 사실상 **페이지네이션 없음**, `select('*')` 최대 5만행 메모리 적재(`:7,22,34`).
- **MAJOR** — CSV "Amount"가 통화 없는 raw 숫자(`orders/page.tsx:164`): KRW 340000과 USD 52.00 구분 불가. Currency/Source 컬럼 부재.
- **MAJOR** — 클라이언트 날짜 그룹핑이 서버 정렬과 충돌(`:117,128-130`): 선택한 `orderBy`와 화면 순서 불일치.
- **MAJOR** — 상태 변경 PUT이 검증 없이 `status` 수용(`api/admin/orders/[id]/route.ts:122`) → `completed` 직접 지정으로 정산 우회 가능. 낙관적 롤백 없어 거부 시 select가 잘못된 값에 고정.
- **MAJOR** — `special_requests`를 `JSON.parse`하되 **try/catch로 감싸 평문이면 조용히 null 반환·아무것도 미표시**(`orders/[id]/page.tsx:484-507`). (당초 "무조건 parse로 throw"는 부정확 — 크래시는 없고 표시만 안 됨.) 빌더(KRW) `itinerary.breakdown`은 fetch하나 미렌더(`:358-417`); Unit/Total `—`/`₩0`은 빌더가 unit/total_price를 채우지 않아 생기는 결과(하드코딩 리터럴 아님).
- **MINOR** — `new Date(tour_date)` 무방비 "Invalid Date"; `/tour/[slug]` 링크는 실제 `/tour-product/[slug]`와 불일치로 404 추정.

## D-3. 정산 (`api/admin/orders/[id]/settle/route.ts`, `api/settlements/route.ts`)
- **MAJOR** — `collectedOffline` 해제 경로에 예약 상태 가드 없음 → 취소/환불 건도 paid/completed로 정산 가능. `no_show_fee_usd_cents`는 조회만 하고 미정산.
- 정상(예외적으로 견고) — settle는 **orders/정산 체인에서 유일하게** `adminAuthJsonResponse`로 `AdminAuthFailure`를 정확히 401/403 처리(검증: `merchants/route.ts`·`emails/[id]/reply/route.ts`도 이 헬퍼 사용 — "전 라우트 중 유일"은 과장), **모든 금액을 Stripe에서 읽음(클라 신뢰 금액·하드코딩 수수료 없음)**, Stripe PI 상태에 멱등. (정산 "로직"은 정확하나 "모델"이 틀림 → §G 참조.)

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
- **MAJOR** — `days` 윈도우가 라우트엔 있으나 **UI에 기간 선택기 자체가 없음(30 하드코딩)**. `escalationRate`·`escalatedMessages`·`tickets` fetch하나 미렌더. 검증 정정: volume/feedback/Q&A/RAG 카운트는 무필터(전체기간)이나 `categories`·`funnel`은 `since` 적용 → "최근 30일" 라벨이 전체기간+윈도우 혼합 수치를 덮음.
- 데이터 caveat — `chat_messages.category`/`chat_feedback.*` 부재 시 페이지 500.

## D-13. 지원 티켓 (`support/page.tsx`, `[id]`)
- **MAJOR** — 목록 무음 50행 절단, 페이지네이션 없음(`api/admin/support/tickets/route.ts:21` 기본 50). 50개 초과 시 구건 비가시.
- **MAJOR** — 답장에 in-flight/disable 없음(`[id]/page.tsx:97-112`) → 더블클릭 시 메시지·QA 초안 2중 생성.

## D-14. QA 리뷰 (`qa-review/page.tsx`)
- **BLOCKER** — 필터 드롭다운 `true`/`false` 옵션이 항상 0행(`:141`): `review_status`는 `draft|approved|rejected|needs_edit`만 존재하나 쿼리는 `.eq("review_status","true")`(`api/admin/qa-pairs/route.ts:35`). 옵션·카운트 영구 죽음.
- **MAJOR** — 키보드 액션 in-flight 가드 없음(`:91,110`) → 빠른 키 입력 시 같은 항목 더블 PATCH/스킵.

## D-15. 통계/Analytics 엔진 정확성 (`api/admin/analytics/**`) — ⚠️ 핵심
> 이 자체 엔진은 "잘 만든 부분"으로 보였으나, **집계 수학에 다수 정확성 버그**가 있어 통계를 신뢰할 수 없음. requireAdmin은 11개 라우트 전부 정상.
- **BLOCKER** — `overview/route.ts:73-76` **total_visitors**가 버킷별(day·locale·device·utm) distinct 합산을 전체 distinct로 오표기(과대집계). 검증 정정: `total_sessions`(`:69-72`)는 `count(*)` 합산이라 **정확함**(행이 disjoint). 같은 결함이 일별 timeseries(`:99-112`)에도 있어 일별 visitor/conversion도 과대. 수정은 distinct 계열만 타깃.
- **BLOCKER** — `funnels/[key]/route.ts:163-218` funnel을 **세션 단위로만** 계산 → 다중세션/장기 funnel 완료 불가. 윈도우는 funnel의 `conversion_window_seconds`(기본 30분, `:188`)로 **설정 가능**(당초 "30분 하드코딩"은 부정확 — 세션 한정이 진짜 결함). `:151` 200k cap ASC 정렬로 cap-hit 시 최근 데이터 유실(`events_cap_hit` 플래그 `:249`).
- **BLOCKER** — `retention/route.ts:47-61,87` cohort 기준일을 **로드된 윈도우 내 first-seen으로 left-censoring** → `startIso` 이전 첫 방문 유저가 오분류돼 cohort 크기/분모 손상(당초 "윈도우 가장자리 고정"은 메커니즘 부정확, 손상은 실재). 주석(`:4-6,32-33`)은 SQL window 함수 + `analytics_users` 조인이라지만 **실제로는 최대 50만행 JS 적재(`:34-38`)·조인 없음**(주석이 적극적으로 오도). 익명→로그인 identity stitching 없음(`:51`).
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
6. **주 LLC franchise/income tax — 등록 주 = Wyoming 확정** — Wyoming은 **주 소득세(개인·법인) 없음, franchise tax 없음.** 연 의무는 **annual report license tax = max($60, WY 소재 자산 × 0.0002)** + 설립 기념월 1일 마감뿐. Sales/use tax는 주 4%(지역 합산 최대 8%), **경제적 nexus = 직전/당해 연도 WY向 총매출 $100,000 초과**(200건 임계는 2024-07-01 폐지). 투어/여행 용역 과세 여부 및 마켓플레이스 facilitator 적용은 **여전히 CPA 판정 필요**. [Wyoming SOS, Sales Tax Institute, Avalara]
   - **⚠️ 외국인 소유 시 연방 추가 의무 (소유구조 확인 필요):** ATOC Korea LLC가 비미국인(한국 개인/법인) 소유의 single-member/disregarded LLC면 **Form 5472 + pro-forma 1120 연 신고 의무**, 미신고 시 **건당 $25,000 벌금**. 주가 무세(Wyoming)라도 이 연방 정보신고는 별개로 발생. → §G-4 서류에 편입. [O&G Tax Foreign-Owned WY LLC FAQ 2026]
7. **기록 보존** — 일반 3년, 고용세 4년, 25%↑ 누락 6년, 무신고/사기 무기한. W-8 통상 3년. → 거래별 불변 레코드 + 보존 클래스. [IRS recordkeeping]
8. **벌칙 리스크** — 원천징수 오류 시 **withholding agent 1차 책임**(IRC §1461; §1463도 이자·벌금은 면제 안 함). 1099 오류 §6721/§6722 + 24% backup withholding. agent/principal 오분류 시 총수입·과세표준·nexus 임계 연쇄 오류.

## G-4. 자동 생성 서류 (Phase 6, SIGN-OFF 게이트 후)
- **연간 수익인식 요약**: gross 뷰(매출/원가/마진) + net 뷰(수수료) 동시 산출(상품군별) → CPA가 포지션 선택, 양쪽 장부 정합.
- **Stripe 1099-K 대사 리포트**: `1099-K gross = recognized revenue + merchant payouts + refunds/chargebacks ± FX/timing` 라인별, 미설명 delta 플래그.
- **W-8 컴플라이언스 대시보드**: tenant별 유효/만료 W-8BEN-E, 3년 만료 전 알림.
- **외국 수취인 sourcing 원장 + 1042-S export stub**: US-source로 표시된 지급만 1042-S 처리(기대값: 비어 있음 = 방어 기록).
- **1099-NEC 후보 리포트**: 미국인 수취인 연 $600↑만, W-8 외국 tenant 명시 제외.
- **Nexus 모니터 + 주별 징수액 리포트**: 12개월 롤링 매출·건수 vs 주별 임계 알림.
- **Wyoming 신고 캘린더**: annual report(설립 기념월 1일) license tax 알림 = max($60, WY자산×0.0002). 주 소득세·franchise 없음 → 캘린더 단순.
- **Form 5472 + pro-forma 1120 트래커**(외국인 소유 시): 연 신고 마감 알림 + 보고대상 거래(reportable transactions) 집계. 건당 $25k 벌금 방지.
- **연간 세무기록 아카이브 export**(불변, ≥7년): 거래 원장 + Stripe 대사 + W-8 세트 + 정산 명세.

## G-5. 필수 전문가 SIGN-OFF (자동 서류 신뢰 전 게이트)
미국 세무 변호사 + CPA가 다음을 승인해야 Phase 6 착수: (1) 상품별 agent-vs-principal(§G-3.1), (2) 한국 tenant foreign-source·무원천징수 결론(§G-3.3), (3) 실제 nexus 주의 과세 여부(§G-3.5), (4) 주 확정 후 franchise/income 신고(§G-3.6).

---

# §H. UI/UX 전면 개편 플랜

> 진단: 사용자 표현대로 "원시적". 근거 — **3개 팔레트 혼재**(대시보드 slate/blue · 주문 indigo/gray/green · 분석 rainbow-emoji 🏢🎫📦💰), 페이지마다 **영/한 무작위 혼용**, **`alert()` 저장 확인**, 정보 위계 부재(text-xl~text-3xl 제각각), 빈/로딩/에러 상태 비일관, 모바일에서 죽는 컨트롤(미리보기 desktop-only 등), 강력한 analytics가 메뉴에 노출 안 됨(IA 결함), placeholder 화면이 메인 분석으로 노출.

## H-1. 디자인 시스템 통합 (Phase 2 — 전 페이지 개편의 선행 조건)
> ⚠️ **검증 정정(§K-6):** 당초 "토큰/컴포넌트 키트를 **신규 도입**"이라 했으나 코드 감사 결과 **토큰 시스템(`tailwind.config.js:40-185`)도 16개 `components/ui/*` 라이브러리(button/card/input/badge/select/tabs/skeleton/**sonner 토스트 호스트** 등)도 이미 존재**하며 어드민이 **100% 우회**(미사용). 따라서 작업은 "신규 도입"이 아니라 **기존 토큰·`ui/*` 채택 + 어드민 전용 갭 컴포넌트만 신설**. 상세 사양·매핑표는 §K-6.
- **토큰**: 신규 발명 금지 — 기존 shadcn 중립(oklch) 토큰(`--primary`/`--card`/`--muted`/`--border`/`--ring`, `globals.css:1095+`)을 어드민 surface/text 기반으로 채택, accent 1개(`brand.blue #1E4EDF` 또는 customer amber 중 §J #7 결정), 상태색은 `status.{success/warning/error/info}`(`src/design/tokens.ts`)로 통일. raw `slate/indigo/gray/green/...` 하드코딩 제거. (현재값→토큰 매핑표 = §K-6.3.)
- **컴포넌트 키트**: 기존 `components/ui/*`(Button/Card/Input/Select/Badge/Tabs/Skeleton/Dialog/Sheet/Sonner) **채택**; 어드민 전용으로 **신설**할 것만: `PageHeading`, `StatCard`(현재 3중 구현 통합), `EmptyState`, `FilterBar`, `DataTable`(정렬·빈·로딩·페이지네이션), `ConfirmDialog`(=`confirm()` 대체). `components/admin/`엔 현재 `BookingStatusBadge`·`ImageUploader` 2개뿐.
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
1. ✅ **등록 주 = Wyoming 확정**(2026-06-24). 주 소득세·franchise 없음 → §G-3.6/G-4 반영 완료. (sales tax 투어 과세 여부만 CPA 잔여.)
2. 🔲 **소유구조 = 외국인(한국) 소유 여부 확인** — 외국인 소유면 **Form 5472 + pro-forma 1120**(건당 $25k 벌금) 추적 필요. §G-3.6/G-4.
3. ⚠️ **수익인식 정책(상품군별 gross/net) — "임의 선택"이 아니라 CPA 사실판정** — §G-3.1 게이트. 아래 설명 참조. ATOC가 가격/할인 재량·전액 수금·차지백 리스크·예약계약을 가지면 회계상 **principal(gross)** 쪽으로 기움(자체 프라이빗투어는 거의 확실히 principal). 대리판매 tenant 상품은 "통제권이 진짜 tenant에 있는가"에 따라 agent(net) 가능. **gross/net은 보고 총수입을 ~10× 좌우**(sales tax 과세표준·nexus 임계·1099-K 대사에 연쇄)하므로 CPA가 상품군별로 확정해야 함. → 시스템은 양쪽(gross/net) 뷰를 모두 산출하도록 설계(§G-4)하여 CPA가 포지션만 고르면 되게 함.
4. 🔲 **모든 tenant 투어가 한국에서 수행됨 확인** — §G-3.3 sourcing 앵커.
5. 🔲 **미국 거주 계약자/제휴자에게 연 $600↑ 지급 여부** — §G-3.4(1099-NEC) on/off.
6. 🔲 **머천트별 실원가(원가) 소스** — 기존 예약 백필 방법(계약서 단가표 등).
7. 🔲 **어드민 디자인 방향성** — 어드민 전용 중립 톤 vs customer amber 계승 정도.

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

---

# §K. 검증 2차 패스 (Plan Audit v2 — 2026-06-24)

> 목적: 1차 플랜(§D~§J)의 모든 주장을 **실제 코드/마이그레이션과 재대조**하여 오류·과장·로직모순·잠재위험을 잡고, 신규 결함·업그레이드 여지를 추가. 방법: 3개 독립 코드감사 에이전트(§D-1~9 / §D-10~15 / §G·§E·§F)가 인용 file:line을 직접 열어 CONFIRMED/REFUTED/IMPRECISE/STALE 판정 + 증거 인용. 결과: 핵심 주장 대부분 CONFIRMED, 아래 정정/신규 항목 도출. §D/§D-15 본문은 위에서 직접 수정 완료, 여기엔 전체 감사 기록을 보존.

## K-0. 라이브 DB 검증 한계 (중요)
- 이 세션의 Supabase MCP는 **다른 프로젝트("Kursoflow", ref `thgyevrqykkscvcpwmfp")에 연결**돼 있음 — atockorea(`config.toml` project_id=`atockorea`, 실제 ref `cghyvbwmijqpahnoduyv`)가 아님. atockorea의 어떤 테이블(bookings/merchants/tours/analytics_events/chat_messages/settlements 등)도 거기 없음.
- 따라서 **라이브 배포 DB 직접 검증은 불가**. 모든 DB 주장은 **repo 마이그레이션 파일 기준**(코드가 기대하는 스키마의 single source of truth)으로 검증됨. 1차 분석이 "live 존재 불확실"로 표기한 `payments` 등은 여전히 미확인.
- **액션 필요**: 라이브 검증을 원하면 atockorea Supabase 프로젝트를 이 세션 MCP에 연결. (배포 누락 RPC — K-2 N1 — 확인의 전제이기도 함.)

## K-1. 정정 항목 (플랜 본문 반영 완료)
| ID | 위치 | 정정 내용 |
|---|---|---|
| C1 | §D-2 | 주문 email "**항상 공란**"은 과장 → BLOCKER→MAJOR 하향. `contact_email` 폴백 작동, 폴백 없는 로그인-유저 건만 공란. |
| C2 | §D-2 | `no_show` 옵션 cite `310-314`→`314`(select 블록 `304-315`). 전용 no-show 버튼(`654-666`)은 정상. BLOCKER 유지. |
| C3 | §D-2 | `special_requests`는 try/catch로 감싼 parse(크래시 없음·미표시) — "무조건 parse" 부정확. Unit/Total `₩0`은 빌더 미입력 결과. |
| C4 | §D-3 | settle "**유일하게** adminAuthJsonResponse"는 과장 — merchants·emails/reply도 사용. "orders/정산 체인에서 유일"로 정정. |
| C5 | §D-15 | overview: `total_sessions`(`:69-72`)는 **정확**, `total_visitors`(`:73-76`)만 과대. timeseries(`:99-112`)도 과대. cite 정정. |
| C6 | §D-15 | funnels 윈도우는 `conversion_window_seconds`(기본 30분, `:188`) **설정 가능** — "30분 하드코딩" 부정확. 세션 한정이 진짜 결함. |
| C7 | §D-15 | retention은 "윈도우 가장자리 고정"이 아니라 **윈도우 내 first-seen left-censoring**(`:47-61,87`). 주석의 `analytics_users` 조인 주장은 허위. |
| C8 | §D-12 | "죽은 컨트롤"→**기간 선택기 자체가 없음(30 하드코딩)**. 카운트 일부만 무필터(전체기간)/일부만 윈도우. |
| C9 | §E-1 | 견적 funnel 실제 이벤트명은 `itinerary_recommend_succeeded/empty/failed`·`itinerary_builder_booking_submitted`(plan 약칭은 쿼리 미스매치 유발). 중간 스테이지 이벤트는 **0개 실재**(신규 정의 필요는 그대로). |
| C10 | §E-1 | `tour_quote_requests` 마이그레이션 파일명 정정: 생성=`20260517130000_create_tour_quote_requests.sql`, 차단=`20260529001000_block_quote_table_writes.sql`(INSERT-only, UPDATE 허용), 완화=`20260529002000_relax_quote_table_trigger_to_insert_only.sql`. 차단 대상에 `quote_memory`·`quote_presets` 포함. |
| C11 | §D-10 | lat/lng 범위 경고는 **인라인 소프트 경고 존재**(`PoiEditorPane.tsx:473`); 다만 **서버 거부는 toast로만** 표면화·필드 인라인 매핑 없음. "인라인 표시 없음"은 부정확. |
| C12 | §D-13 | support `limit`은 쿼리로 최대 200까지 설정 가능하나 **UI가 미전송 → 실효 50**(`tickets/route.ts:21`, `page.tsx:51`). |

판정 요약: §D-1~D-15 및 §G/§E/§F의 **핵심 주장은 모두 CONFIRMED**(STALE/완전 REFUTED 없음). 위 C1~C12는 심각도/메커니즘/인용 정밀화이며 결함 자체는 실재.

## K-2. 신규 결함 (플랜이 놓친 것 — Phase 1/4/5에 편입)
| ID | 심각도 | 결함 | 증거 |
|---|---|---|---|
| N1 | **BLOCKER** | 90일 익명화 cron이 호출하는 RPC `anonymize_old_analytics`가 **어떤 마이그레이션에도 없음** → 프라이버시 스크럽이 프로덕션에서 무음 500 가능. `analytics_health_snapshot()`(§D-15)와 같은 부류. | `app/api/cron/analytics-anonymize/route.ts` rpc 호출 vs `supabase/**` grep 0건. §F-1 "미배포 RPC" 목록에 추가. |
| N2 | **MAJOR(보안)** | `lib/file-upload.ts:validateFile`(크기+타입 검증)이 **dead code** — upload 라우트가 호출 안 함 → product 5MB/gallery 10MB/video 250MB 한도 전부 미적용(D-7 BLOCKER의 근본원인). | `route.ts`는 `allowedTypes.includes(file.type)`만 검사. |
| N3 | **MAJOR(데이터)** | `bookings.currency` 기본값이 archive 스키마 `'USD'`(대문자) vs 마이그레이션 `'usd'`(소문자), 체크아웃/웹훅 분기는 대소문자 민감(`=== 'krw'`). 신규 통화 의존 정산 컬럼은 case 정규화 필수. | archive vs `20260529000000`. |
| N4 | MAJOR | UI 경로(`/api/admin/merchants` POST)로 생성된 머천트는 **rollback뿐 아니라 `merchant_settings` 행·audit_logs도 누락** — `/create` 라우트만 셋 다 수행. | `route.ts:119-194` vs `create/route.ts:80-136`. |
| N5 | MAJOR | overview 일별 timeseries(`:99-112`) visitor/conversion **과대**(C5와 동근), 멀티-디바이스/locale 유저 중복. 플랜은 헤드라인 total만 지적. | — |
| N6 | MAJOR | events/route.ts raw-24h 병합이 신규 이벤트를 `event_count:0`으로 추가 후 `:136` 정렬 → 신선 이벤트가 **0건으로 최하위 오정렬**. | `:118-133,136`. |
| N7 | MAJOR | experiments 전환이 `void conversionFilter`로 funnel 필터 폐기 + **세션이 전환 이벤트명만 1회 발화하면 전환 처리**(`:108`) → 분자/분모 모두 step 순서 무시. chi-square도 variant[0]vs[1] 하드코딩(3+ 미지원). | `:90-95,108,114,140-149`. |
| N8 | MINOR | `merchants/[id]/page.tsx:333` 투어 링크 `/tour/${tour.id}` — **prefix 오류 + slug 자리에 id**(이중 404). | — |
| N9 | MINOR | upload 다중파일 `Promise.all`(`:137-140`)이 일부 실패 시 **이미 업로드된 파일 Storage 고아** + 500. | — |
| N10 | MINOR | qa-pairs GET 카운트 6개를 **순차 await**(`route.ts:42-48`), 그중 `true`/`false` 2개는 항상-0 낭비 쿼리(D-14 BLOCKER 강화). | — |

## K-3. 제안 변경의 위험 (Phase 4/5/6 설계 보강)
- **R1 — 정산 재작성 vs frozen 스냅샷:** `settlement_bookings`는 `UNIQUE(booking_id)` + RPC의 `NOT EXISTS` 가드로 **이미 정산된 건은 재정산 불가**. 따라서 flat-10% → 원가기준 전환은 신규 정산엔 안전하나 **과거 정산은 옛 10% 기준으로 동결**되어 두 회계기준이 공존. 마이그레이션 브리지(컬럼 의미 유지/신규 컬럼/기간 straddle 처리) 명시 필요.
- **R2 — RPC 시그니처 변경 배포 동기화:** `create_merchant_settlement`에 cost 파라미터 추가 시 `app/api/settlements/route.ts`(현 3-arg 호출)와 **동일 배포로** 갱신 안 하면 런타임 파손.
- **R3 — FX 백필은 best-effort:** 과거 환율 저장본 없음. 감사급 소스는 Stripe balance-txn `exchange_rate`뿐 → `stripe_balance_txn_id` 향후 저장 전제 + capture된 건만 가능(offline 수금 건 불가). 플랜의 "거래일 포착" 백필은 **근사치**로 강등.
- **R4 — 귀속 비정규화 vs 익명화:** `bookings`/`support_tickets`에 utm/referrer/anonymous_id 추가 시 익명화 RPC 범위 밖 → **90일 스크럽을 무력화하는 PII 사본** 생성. 익명화 RPC 범위에 신규 컬럼 포함 또는 write 시 해시 필수.

## K-4. 업그레이드/확장 여지 (코드 근거)
- **U1 — null-safe 표준화:** dashboard(`page.tsx:303`)는 크래시형 `parseFloat(x.toString())`, orders-list(`:367,432`)는 안전형 `parseFloat(String(x))` — 이미 안전 패턴이 repo에 존재. 전역 `String(...)` 표준 + 머천트(`[id]:340`, list `:179-181`) 적용.
- **U2 — search sanitize 재사용:** `contacts/route.ts:45`가 이미 `.slice(0,200).replace(/'/g,"''")` 적용 — merchants(`route.ts:31`) 인젝션 수정은 신규 발명 말고 이 패턴 재사용.
- **U3 — upload 보안 일괄:** `validateFile`(N2) 호출 + 매직바이트 sniff + `folder` 화이트리스트 + 부분실패 정리(N9) 동시 처리.
- **U4 — 미배포 RPC 게이트:** N1·`analytics_health_snapshot` 등 "코드가 호출하나 마이그레이션에 없는 RPC"를 CI/배포 체크로 가드(반복 결함 부류).
- **U5 — analytics 집계 정합 테스트:** distinct/세션/cohort 계열에 known-input→expected-output 골든 테스트(C5~C7, N5~N7 회귀 방지).

## K-5. 다음 세션 범위 (생략·건너뛰기 없이 진행)
1. **§H UI/UX 심층 검증** — 페이지별 실제 className/팔레트/i18n/모바일 패리티를 코드로 대조해 토큰 매핑표(현재값→토큰) 작성.
2. **§E/§F 기능 설계 정밀화** — `quote_drafts` 스키마·이벤트 taxonomy(C9 반영)·`unified_inquiries` view DDL 초안·per-product funnel matview 정의.
3. **§G 세무** — 소유구조(§J #2) 확인 후 Form 5472 데이터 요구 확정; settlement 마이그레이션 브리지(R1/R2) 상세 설계.
4. **라이브 DB 대조** — atockorea 프로젝트 MCP 연결 시 K-0/N1 실배포 상태 확정.

---

# §K-6. UI/UX 코드 감사 결과 + §H 실행 사양 (2026-06-24)

> §K-5 ①(§H 심층 검증) 수행 완료. 3개 독립 UI 감사 에이전트가 전 어드민 페이지의 실제 className·팔레트·타이포·i18n·alert·모바일·a11y를 file:line으로 추출. 결과를 §H 실행 사양으로 정리.

## K-6.0 핵심 발견 (§H 근본 정정)
1. **어드민은 디자인 토큰 0개·공유 UI 프리미티브 0개 사용.** 완전한 토큰 시스템(`tailwind.config.js:40-185`: fontSize 스케일·`brand`/`status` 색·`design-*` shadow/radius·`motion-*`)과 **16개 `components/ui/*`**(button·card·input·badge·dialog·select·tabs·skeleton·**sonner**…)가 존재하나 **모든 어드민 페이지가 import 0건**. 최대 레버 = `ui/{button,card,input,badge,skeleton,tabs}` + `StatCard`/`EmptyState` 채택.
2. **3개 디자인 세대 공존:** (a) 레거시 `gray`+이모지+`alert`+placeholder 차트(`/admin/analytics`), (b) 정제된 slate+blue+sonner 에디터(`products`·`match-pois`), (c) 플랫 모노크롬 데이터 대시보드(`analytics/product`). `chatbot-analytics`는 (b)의 카드 + (a)의 이모지/alert 습관을 혼용.
3. **shell(`layout.tsx`)이 최고 수준**(slate+blue-600, Lucide, 우수한 a11y/모바일) — 대시보드는 이를 계승하나 나머지는 indigo/gray로 드리프트.

## K-6.1 디자인 기반 인벤토리
- `tailwind.config.js`: `font-sans=Pretendard`, fontSize xs~5xl(주석이 "arbitrary `text-[12.5px]` 금지" 명시하나 어드민이 `text-[9px]/[10px]/[11px]/[13px]` 남용), `brand{navy,blue,ocean}`·`status{success,warning,error,info,neutral}`, `design-{sm,md,lg}` shadow/radius, `motion-{fast,base,slow}`.
- `globals.css`: customer amber 토큰(`--accent: amber.700`) + shadcn 중립 oklch 토큰(`--primary`≈near-black·`--card`·`--muted`·`--border`·`--ring`, line 1095+).
- `components/ui/*`(16): accordion·badge·button(CVA variants)·card·dialog·dropdown-menu·input·label·select·separator·sheet·skeleton·sonner·tabs·textarea.
- `components/admin/*`(2): `BookingStatusBadge`(green/yellow/red/blue/rose), `ImageUploader`(indigo+이모지+alert, products MediaSection로 대체됨).

## K-6.2 드리프트 정량화 (증거 기반)
| 차원 | 실태 |
|---|---|
| accent | **2개 시스템 공존** — shell/대시보드 `blue-600` vs 나머지 `indigo-600`; chatbot은 `sky-950`. merchants-list는 blue accent인데 spinner는 indigo(자기모순) |
| neutral | **2개** — shell/대시보드/products/poi/analytics-product/chatbot `slate-*` vs orders/merchants/contacts/legacy-analytics `gray-*` |
| spinner | **3개 구현** — `border-2 border-t-transparent h-11`(shell)·`h-10`(대시보드/orders/contacts)·`border-b-2 h-12`(orders-detail/merchants) |
| H1 | **4종** — `text-xl/semibold`(대시보드)·`text-2xl/bold`(orders/contacts)·`text-xl→2xl`(merchants-list)·`text-3xl/bold`(detail/create/legacy-analytics) |
| card | **3종** — `rounded-xl slate-200/80`·`rounded-lg gray-200/60`·`rounded-xl gray-200`; analytics-product만 `rounded-lg` no-shadow |
| 피드백 | **27+ raw `alert()`/`confirm()`**(order-detail만 ~13; merchants/create는 **로그인 자격증명을 alert에 담음**) + cms 블루 status 배너 + support/qa 인라인 배너 3종 혼재. products/poi/analytics-product는 sonner/인라인(모범) |
| 빈/에러 | contacts는 **에러 무음**(console만), legacy-analytics·chatbot은 빈 상태 없음/널에 blank |
| i18n | settings=영어전용, cms=한국어전용, merchants list=한국어인데 detail/create=영어전용(동일 기능), order-detail=버튼 안에서 한·영 병기, **emails 코드주석은 중국어** |
| 상태색 | **3중 분기** — `BookingStatusBadge` green/yellow/red vs 패널 emerald/amber/rose vs analytics red |
| KPI 카드 | **3중 비호환 구현** — legacy 인라인×4 vs `KpiCard`(analytics-product) vs `Stat`(chatbot) |
| 이모지 아이콘 | legacy-analytics 🏢🎫📦💰, chatbot 👍👎✓, support-detail 📋💬👤⚠️ (aria 없음) |
| 컴포넌트 재사용 | `ui/*` 0건, `components/admin/*` 0건(in-scope); order-detail은 `BookingStatusBadge` 재구현; input className 9~15회 복붙 |

## K-6.3 토큰 채택 전략 + 현재값→토큰 매핑 (Phase 2 산출물)
- 결정 축(§J #7): **어드민 중립 톤 채택** 권장 — surface/text = shadcn 중립 oklch, accent 1개 = `brand.blue`(shell이 이미 blue-600), 상태 = `status.*`.

| 현재 (하드코딩) | → 토큰/표준 |
|---|---|
| `text-gray-900/700/...`, `bg-gray-50` | `text-foreground`/`text-muted-foreground`, `bg-muted` (slate 계열로 통일) |
| `bg-blue-600 / bg-indigo-600 / bg-sky-950` (primary 버튼) | `ui/button variant=default`(=`bg-primary`) 또는 accent 토큰 |
| `bg-green-*/emerald-*`(성공), `amber/yellow`(경고), `red/rose`(에러) | `status.success / status.warning / status.error` |
| `bg-blue-500/green-500/purple-500/orange-500`(legacy KPI) | 채도 솔리드 폐기 → 모노크롬 `StatCard` |
| `rounded-lg/xl` 혼용, `shadow-sm/lg/xl/2xl` | `rounded-design-md`(12px) + `shadow-design-sm/md` |
| `text-[9px]/[10px]/[11px]/[13px]` | fontSize 토큰(`text-xs` 최소) |
| spinner 3종 | `ui/skeleton` + 단일 Spinner |
| `🏢🎫📦💰👍👎` 이모지 | Lucide 아이콘 |

## K-6.4 컴포넌트 키트 (존재 채택 + 신설)
- **채택(이미 존재):** `ui/button`(CVA), `ui/card`, `ui/input`, `ui/label`, `ui/select`, `ui/textarea`, `ui/badge`, `ui/tabs`, `ui/skeleton`, `ui/dialog`, `ui/sheet`, `ui/sonner`(토스트 호스트 — 전역 1회 마운트 후 `toast()` 통일).
- **신설(어드민 전용):** `PageHeading`(타이틀+액션+breadcrumb, H1 4종 통일), `StatCard`(KPI 3중 구현 통합·모노크롬), `EmptyState`(아이콘+카피+액션), `FilterBar`(칩+검색 디바운스+날짜), `DataTable`(정렬·빈·로딩·페이지네이션·모바일 카드 폴백), `ConfirmDialog`(=`confirm()` 대체), `StatusBadge` 통합(BookingStatusBadge + 패널 상태색 단일화).

## K-6.5 i18n · 피드백 · a11y 표준
- **i18n:** 어드민 문자열 ko 1차 키화(`messages/`), 한 화면 내 영/한 혼용·버튼 내 병기 제거, 숫자/통화는 `toLocaleString('ko-KR')` 일괄(현재 일부만). **중국어 코드주석(emails) 정리.**
- **피드백:** `alert()/confirm()` 27+건 전량 → `toast`(성공/에러) + `ConfirmDialog`(파괴적 액션) + 인라인 폼 에러. **자격증명을 alert로 노출(merchants/create)** 즉시 제거.
- **a11y:** 모든 `select`/`input`에 `label`+`htmlFor`, 글리프 버튼(`↻`·`✕`·`ⓘ`)에 `aria-label`, 이모지 아이콘 → Lucide + `aria-hidden`, 클릭 `div`(emails 행) → `button`, 색상-단독 신호(unread dot) 보조 텍스트, `min-h-touch`(44px) 적용.

## K-6.6 페이지별 개편 우선순위
1. **`/admin/analytics`(레거시) — 최우선 폐기/교체**: 레인보우 `*-500` 솔리드·이모지·영어전용·`alert()`·**production에 "Chart will be added here" placeholder**(`:205`)·`÷30` 가짜 평균. 바로 옆 `analytics/product`(모던·실데이터)로 흡수하거나 모노크롬 재작성. (§B 결정 "nav→자체 엔진 연결"과 직결.)
2. 주문/예약·통합 문의·정산(운영 핵심, gray→slate·indigo→accent·alert→toast·DataTable).
3. 머천트(i18n 통일 list↔detail, 자격증명 alert 제거).
4. 대시보드(인라인 SVG→Lucide, 하드코딩 0/null 동반 수정).
5. chatbot-analytics(이모지/alert 제거, KpiCard 통합, 기간 선택기).
6. POI/CMS/업로드/설정/지원/QA(토큰 채택, 모바일 패리티 — support 테이블 `overflow-x` 등).
- 모범 사례(products·match-pois·analytics-product)는 토큰/`ui/*` 채택만 추가, 구조 보존.

## K-6.7 신규 발견 (UI 영역, 플랜 본문 §H 보강)
| ID | 항목 |
|---|---|
| UI-1 | 16개 `components/ui/*` + 토큰 전부 미사용(최대 레버) — §H-1 정정 반영 완료 |
| UI-2 | `ImageUploader`(admin) vs products `MediaSection` 2개 업로더가 accent·피드백 불일치 — 단일화 |
| UI-3 | `match-pois` 모바일 흐름 깨짐: 리스트 `w-80` 비축소 + 높이 계산이 모바일 bottom-nav(4rem) 무시(`page.tsx:35`) → "목록으로" 복귀 불가 |
| UI-4 | contacts 모바일 시트가 헤더 높이 `top-[52px]` 하드코딩 결합(브리틀) |
| UI-5 | legacy-analytics `÷30` 가짜 일평균 + placeholder 차트 production 노출 |
| UI-6 | 상태색·KPI카드 3중 분기 통합(StatusBadge/StatCard) |
