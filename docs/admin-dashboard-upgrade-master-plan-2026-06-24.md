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
| **`docs/admin-premium-mobile-design-spec-2026-06-24.md`** | **§U의 실행 상세(프리미엄 모바일 buildable spec — 토큰·컴포넌트 키트·인터랙션 라이브러리·페이지 청사진). Phase 2/3 모바일 개편의 단일 구현 기준** |

> ⚠️ **법무·세무 면책:** §G(세무/정산)와 본 문서의 모든 세법 해석은 **1차 리서치 결과이며 법률·세무 자문이 아니다.** "SIGN-OFF 필수"로 표기된 항목은 **미국 세무 변호사 + CPA의 검토·승인 전에는 어떤 자동 생성 서류도 신뢰·제출 금지.**

---

## §A. 상태 대시보드

| Phase | 제목 | 상태 | 비고 |
|---|---|---|---|
| 0 | 진단 + 마스터 플랜 (이 문서) | ✅ 완료 | 5개 도메인 병렬 코드감사 + 세법 리서치 종합 |
| 0.5 | 검증 2차 패스 (§K) — 전 주장 코드 재대조 | ✅ 완료 | 3개 감사 에이전트 재검증. 핵심 주장 CONFIRMED, C1~C12 정정 + N1~N10 신규결함 + R1~R4 위험. 라이브 DB는 MCP 미연결(K-0) |
| 0.6 | UI/UX 코드 심층 감사 (§K-6) — §H 실행 사양화 | ✅ 완료 | 3개 UI 감사 에이전트. 토큰·`ui/*` 16개 100% 미사용 발견 → §H-1 정정(신규도입→채택). 드리프트 정량화 + 현재값→토큰 매핑표 + 우선순위(legacy analytics #1) |
| 0.7 | §E/§F 기능 설계 사양 (§K-7) — DDL + 이벤트 taxonomy | ✅ 완료 | 마이그레이션 대조 후 quote_drafts·빌더 이벤트+funnel·귀속FK+익명화정합(R4/N1)·audit 헬퍼·unified_inquiries 뷰·상품 funnel matview 구체 DDL |
| 0.75 | §G 정산/세무 데이터모델 + 마이그레이션 브리지 (§G-6) | ✅ 완료 | RPC/스키마/settle 라우트 직접 재검증(F1~F8). tours.cost_price·bookings 원가/FX/Stripe·settlements 통화/basis DDL + RPC v2(원가기준·통화강제) + R1 라벨링 브리지 + R2 배포동기화 + R3 FX 강등. 신규 결함: RPC 통화혼입(F3) |
| 0.8 | Codex 플랜 리뷰 통합 (§M) — 인접범위 전체스택 감사 | ✅ 완료 | 3 감사 에이전트 file:line 검증. N11~N26 신규(공개 보안 BLOCKER 4 + MAJOR 다수) + 정정 로그(REFUTED 2: RAG·reviews버킷 / IMPRECISE 6). 별도 doc 생성 거부(단일 SoT). 공개 보안 트랙 분리 권고 |
| 0.9 | 라이브 DB 대조 (§N) — K-0 해소 | ✅ 완료 | atockorea MCP 라이브 연결. **마이그레이션 드리프트(repo≠live, BLOCKER급 거버넌스)** 발견. N1 REFUTED→드리프트 재분류. **N27(anon-exec PII 익명화 RPC, BLOCKER)**·N28~N32 + perf 62/62/134. §G-6 DDL 충돌0·F1~F3/R1 라이브 확정. D-14·notifications·payments부재 확정 |
| 0.10 | 플랜 완전화 감사 v3 (§O~§R) | ✅ 완료 | 3 감사 에이전트(완전성갭/신규결함·업그레이드/DDL어드버서리얼). **N33(site_settings 부재 BLOCKER)·B-1(노쇼 전액청구 돈버그 BLOCKER)·B-2/B-3/M-4/M-6/M-7/M-8**. §G-6 DDL 정정 12델타(C#3 FOR UPDATE는 라이브 probe로 REFUTED). 횡단 워크스트림 WS-A~J. 업그레이드 U-1~U-10(§P). 준비사양(§Q: N27 SQL·정합 런북·Phase1 턴키). **실행 WBS(§R) PR 단위 티켓화** |
| 0.11 | 섹션별 딥 리뷰 + 모바일/UX (§S) | ✅ 완료 | 8 에이전트(페이지군6+모바일전담+UX전담). **모바일 판정: 부분 사용가능**(셸 OK, 29p중 12p 반응형0). 신규 결함 S-F1~F16(S-F1 stats OOM·**S-F2 Math.random 비번**·S-F3 audit actor·S-F4/F5 에디터 데이터손상 BLOCKER급). UX 시스템 S-U1~U11(ConfirmDialog/Sonner 기존자산 미사용·URL필터·nav IA). REFUTED 2(SortableImageCard 케이싱·"전부 데스크톱") |
| 0.12 | 최종 전수 검수 — 미검수 영역 (§T) | ✅ 완료 | 7 에이전트(미진단 어드민라우트·Stripe머니패스·인증RBAC·챗봇·공개API·lib·고객UI) + 라이브 DB/RLS/storage 스윕. 🔴🔴 **P1 라이브확정 권한상승**(고객→admin RLS WITH CHECK 부재). W1-15(머니패스: 환불라우트 부재·webhook 상태가드·cron secret URL)·CB1-15(예약 enumeration·CORS*)·PA(reminders GET·upload DELETE)·CK1-3(카트 세금/프로모)·LIB(이메일XSS·FX폴백)·N34. **굿뉴스: requireAdmin 견고·service-role 번들유출0·웹훅서명O** |
| 0.13 | 프리미엄 모바일 도약 + 완성도 보정 (§U + 컴패니언) | ✅ 완료 | 7 에이전트(누락스윕 + 프리미엄모바일 6). **신규 blind spot: `app/merchant/**` 포털·`app/dashboard/**`·미언급 공개API 다수.** 프리미엄 결정 8(바텀내비5·AdminPageShell·시트/스와이프/낙관적·alert폐기·토큰·타입램프·폼16px·다크). 4 페이지 청사진. 본문 stale 정정(D-11/D-15/N1/G-6.2). WBS 고아 입양. 컴패니언 `docs/admin-premium-mobile-design-spec-2026-06-24.md`. **진단 종결** |
| 1 | 기능 안정화 (BLOCKER/MAJOR 버그 수정) | ⏳ 대기 | §D + §O.2 + §S.2 + §T. 선행 게이트 R0 + R2.0(프리미엄 모바일 기반). 티켓=§R-1. **🔒 R9.0 P1(권한상승)이 전 항목 최우선** |
| 2 | 디자인 시스템 통합 (토큰·팔레트·타이포·i18n) | ⏳ 대기 | §H.1. 모든 페이지 개편의 선행 조건 |
| 3 | 페이지별 UI/UX 개편 | ⏳ 대기 | §H.2~. Phase 2 토큰 위에서 한 페이지씩 |
| 4 | 데이터 모델 확장 (정산 원가/수수료·귀속·감사로그·견적 이탈) | ⏳ 대기 | §E·§F·§G. 마이그레이션 + 백필 |
| 5 | 통계/Analytics 정확성 수정 + 확장 | ⏳ 대기 | §F. 기존 엔진 수학 버그 수정이 먼저 |
| 6 | 세무 정산 자동화 (서류 자동 생성) | ⏳ 대기 | §G. CPA SIGN-OFF 게이트 통과 후에만 |
| 7 | 신규 운영 기능 (통합 인박스·견적 추적·대화 뷰어·감사 로그 UI) | ⏳ 대기 | §E |
| 8 | 압력 테스트 + 회귀 검증 + 운영 인수인계 | ⏳ 대기 | §I |

상태 마커: ⏳ 대기 / 🔄 진행 중 / ⏸ 보류 / ✅ 완료 / ❌ 중단

**현재 활성 Phase: ✅ Wave 0(6건) main 머지완료(PR #167). ✅ Wave 1 기반 W1.1~W1.8 완료(토큰·16px·Toaster·유틸키트·44px·AdminPageShell·Tier1/2 키트; 테스트 30 그린). W1.9(이모지sweep)·W1.10(inbox 의존)·W1.11(CI)은 preview/Wave4 세션으로 연기. Wave 3(기능 안정화) 배치1·2 완료·머지(11건: LIB-1·S-F2·D-4·B-3·M-4·M-6·D-14·N-5·S-F7·AR-1·AR-3, 테스트+52). **남은 Wave3는 preview/마이그레이션/pricing/사용자결정 게이트**: D-1(대시보드 하드코딩0→UI)·✅D-15 3/5(experiments·funnels·events/[name] 머지 PR #172; 보류 2=visitors distinct-over-range·retention left-censor=설계게이트)·M-7(형제로케일 덮어쓰기, 동작 결정 필요)·LIB-2(DMZ 차량등급, pricing 민감)·LIB-3(FX 폴백, pricing)·D-5(contacts UI)·W3.1 site_settings(W2.1 마이그레이션 정합=§J #12 PITR 게이트). W1.9(이모지)·W1.10(inbox)·W1.11(CI)·Wave4(페이지 프리미엄 모바일)는 preview 세션. 진단(Phase 0~0.13) 종결. 다음 액션 = 사용자 결정(§J #11~14 + #2/#6/#8~10) → R0(N27 REVOKE·마이그레이션 정합·미진단라우트)+R2.0(모바일 기반) → Phase 1(§R-1). 🔒 보안 트랙(§R-9) — ✅ **배치1 머지(PR #171 `b39963fd`, 2026-06-25): PA-1·PA-2/N17·N11·N13·N16·P2·P4·CB-5·PA-3 (9티켓, 테스트+25·회귀0)**. ✅ **배치2 구현(2026-06-25): N14(checkout IDOR BLOCKER)·N19(maps 빌링남용)·N20(보안헤더) — 테스트+17·회귀0**. ✅ **배치3 구현(2026-06-25): N18(LINE OAuth id_token 검증+CSRF state)·P6(change-password 무음성공 차단) — 테스트+8·회귀0**. ✅ **N34(storage 버킷 size/MIME 바운딩) 구현+라이브 적용(2026-06-25, 사용자 승인)·advisor 신규0**. ✅ **W3.8 B-2(layout onAuthStateChange 만료표시)·M-8(인증가드 프로필 자동생성 제거) 구현(2026-06-25)·테스트+7·회귀0**. ✅ **N21/P3 verify-and-document 종결(2026-06-25): admin API 44/44 서버 가드 확인·누락0**. ✅ **CB-2 durable 레이트리밋 인프라 구현(2026-06-25, W9.11): Upstash REST(의존성0)+인메모리 fail-open 폴백·테스트+14·env 설정 전 무변경**. ✅ **PA-5·PA-6 무인증 4라우트 per-IP RL 적용(2026-06-25)·테스트+6**. ✅ **PA-4 tour-rooms 게스트 enumeration 브레이크(2026-06-25)**. ✅ **CB-1(CORS) verify-and-document 종결(2026-06-25, 사용자 확인): `/api/agent/v1/*` 와일드카드는 의도적·안전**(무자격증명 CORS=`Allow-Credentials` 부재·쿠키/세션 인증 0·인증=`x-api-key`+서명 quote 토큰=ambient 자격증명 0·공개 에이전트 디스커버리 채널 `.well-known/*`+`/for-agents`·book은 카드 미청구 핸드오프). 제한 시 채널 파손+보안이득0→**코드 변경 없음**. **§R-9 보안 트랙 비-게이트 항목 소진 완료**. 남은 §R-9 = P1(user_profiles RLS WITH CHECK·DDL 게이트, Wave0서 처리됐는지 재확인)·public_bucket_allows_listing(어드민 리스팅 깨짐 위험으로 미변경)·CB-2(durable RL=W9.11 게이트)·N15(oversell=availability-unlimited 충돌 파킹)·P3(미들웨어 /admin 가드=verify-and-document, Edge 쿠키세션 미보장)·P5(merchant session 바디=httpOnly 핸드셰이크 리팩터, breaking)·PA-4~6(durable RL 게이트) 등. 💴 머니패스 무결성 트랙(§T.10) — ✅ **W5.7/W-10 환불경로(refund-only) 머지(PR #173 `c3865d14`)**: 환불 실행+예약/감사 기록까지. **정산 대사 반영은 §G 후속(미반영)**. ⚙️ **W3.10 lib 비-pricing 배치(구현, 2026-06-25 `1fba271`): LIB-6(authorized 한국어 라벨 복원·`lib/email/payment-status-label.ts` 추출)·LIB-good(`lib/email.ts` server-only 가드)·테스트+4·jest 545pass/8fail(회귀0)·build ✓. 남은 W3.10=LIB-2/LIB-3 pricing 게이트·LIB-5 관측성.** 🎨 **Wave 4 페이지 개편 착수(preview 게이트 사용자 해제, §B 결정·매 스텝 main 머지→라이브 검증): ✅ W4.3 대시보드(`87b0fe7`, §8.1 액션큐 우선·7일 스파크라인·D-1 실카운트/null-safe/toast). ✅ W4.2 주문목록(`38e80c6`, §8.2 sticky 필터바+검색·URL필터·토큰·D-2 CSV currency). ✅ W4.7-a 레거시 analytics 폐기→엔진 허브(`0906ccb`, §B IA 결함 해소·₩오라벨/가짜차트 제거·엔진 8섹션 런처). ✅ W4.8 챗봇분석(`4b5abe5`, 에스컬레이션율 KPI·기간선택기·StatCard 토큰·이모지→Lucide·toast/skeleton). ✅ W4.6 머천트 영역 완료(목록 `3f231cf`·생성+상세 `ccaeb62`: confirm→ConfirmSheet·alert→toast·자격증명alert 제거·sticky CTA·dirty가드·토큰·skeleton). ✅ **W4.7 분석 엔진 오버뷰(§8.4): KPI 4종(이벤트/세션/방문자/전환) 카드 내 스파크라인으로 재구성→별도 MiniBarChart 패널 3개(~480px) 제거·통합 일일트렌드 단일차트(메트릭 토글·90일은 주간 13버킷)·상위이벤트 5+모두보기·stale 공지 상단 이동·공유 `Sparkline` 컴포넌트 추출(대시보드 재배선)+StatCard `chart` 슬롯(additive)·순수 `lib/admin/analytics-overview.ts` bucketTimeseries·테스트+5·회귀0**. ✅ **W4.7 엔진 §8.4 잔여 완료: sessions(grid-cols-12 31px→`SessionCard` 모바일+토큰화 데스크톱 테이블·✓이모지→CheckCircle2)·retention(frozen 1열 `sticky left-0`·4주 기본·`min-w-[44px]` 셀·skeleton·토큰)·회귀0**. ✅ **W4.9-a match-pois 모바일(2-pane→모바일 단일창 전환): 항상 side-by-side(w-80+편집기)이던 것을 모바일 단일창(목록⇄편집기, lg+ 2-pane)으로·자동선택 lg 전용 게이트·PoiListPane `w-full lg:w-80`+가시성 className·admin-bg/surface 토큰·skeleton 토큰화. 회귀0**. ✅ **W4.9-bc CMS+업로드: CMS=gray팔레트→slate/admin 토큰·`bg-white rounded-xl`→`bg-admin-surface rounded-design-md shadow-admin-card`·alert→toast·로딩→Skeleton·h1 text-3xl→text-xl·URL입력 16px/44px·세이브버튼 rainbow(emerald/indigo)→blue-600 통일. 업로드=동일 토큰·alert 4개→toast·이모지(✅📖)→Lucide·**갤러리 hover전용 복사 오버레이→tap(모바일 상시 코너 복사버튼)**. 회귀0**. **W4.9 POI/CMS/업로드 전체 완료.** ✅ **W4.4 통합 인박스(§E-4/§8.3): 신규 `/api/admin/inbox`(contact/email/ticket UNION, 인-라우트 키셋 머지=DDL 게이트 회피)+`/admin/inbox` 페이지(소스/카테고리 칩·날짜그룹·검색·미처리 배지·바텀시트 상세·읽음 토글)+바텀탭 수신함 슬롯(문의 탭 대체). 순수 `lib/admin/inbox.ts`+테스트6·라이브검증(티켓53 미처리). 회귀0**. 다음 후보=W4.1 주문상세 머니시트(신중)·W4.10 설정(토큰부분)·W4.11 횡단.** ⚠️ R0.2(repo≠live 정합)는 Phase 4 하드 선행. 준비사양 §Q — 승인 시 즉시 실행.**

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
| 2026-06-25 | **Wave 4 페이지 개편을 preview 없이 진행** — 매 스텝 완료 시 main 머지·푸시 → 사용자가 **라이브에서 직접 시각 검증** (사용자 지시) | preview 도구 부재가 페이지 개편의 유일 게이트였음. 사용자가 라이브 검증을 맡기로 하여 게이트 해제. 빌드 green + tsc 0 + 변경범위 테스트가 코드 안전망, 시각/UX는 라이브 확인. 머니 직결 페이지(orders/[id])는 블라인드 리스크 커 신중 |

---

## §C. 변경 로그

Phase 진행 시 한 줄씩 추가. 커밋 단위.

| 날짜 | 항목 | 커밋 | 비고 |
|---|---|---|---|
| 2026-06-24 | Phase 0 — 어드민 전면 진단 + 마스터 플랜 작성 | (this) | 5개 도메인 병렬 감사(페이지·API·DB·정산/세무·UI) 종합 |
| 2026-06-24 | §J 갱신 — 등록 주=Wyoming 확정 + Form 5472 + 수익인식 설명 | fae9319 | — |
| 2026-06-24 | Phase 0.5 — 검증 2차 패스(§K). 전 주장 코드 재대조, C1~C12 정정·N1~N10 신규·R1~R4 위험. §D/§D-15 본문 직접 수정 | (this) | 라이브 DB는 MCP가 타 프로젝트(Kursoflow) 연결로 미검증(K-0) |
| 2026-06-24 | Phase 0.6 — UI/UX 코드 심층 감사(§K-6). 토큰·`ui/*` 16개 미사용 발견 → §H-1 정정, 현재값→토큰 매핑표·컴포넌트 키트·우선순위 | (this) | 모범 사례 products/match-pois/analytics-product 구조 보존 |
| 2026-06-24 | Phase 0.7 — §E/§F 기능 설계(§K-7). quote_drafts·빌더 이벤트+funnel·귀속FK+익명화정합·audit 헬퍼·unified_inquiries·상품 funnel matview DDL. 실제 스키마(contact_inquiries/audit_logs/bookings/analytics_funnels/matview) 대조 | (this) | event_name free-form·payload 평면스칼라 확인 → 신규 이벤트 등록 불필요 |
| 2026-06-24 | Phase 0.75 — §G-6 정산/세무 데이터모델+마이그레이션 브리지. RPC 본문/GRANT/settle 라우트/스키마 직접 재검증(F1~F8). 신규 DDL(tours.cost_price·bookings 11컬럼·settlements basis/통화·merchants W-8) + RPC v2(원가기준·1정산1통화) + R1 라벨링 브리지 + R2 원자배포 체크리스트 + R3 FX 강등 + J-8~J-10 | (this) | 신규 결함 F3: RPC가 통화필터 없이 final_price SUM → usd/krw 혼입 |
| 2026-06-24 | Phase 0.8 — §M Codex 리뷰 통합. 3 감사 에이전트(공개커머스/보안인프라/데이터RAG성능) file:line 검증. N11~N26 + R5/R6 REFUTED + P1~P3. 별도 deep-audit doc 생성 거부(단일 SoT). 공개 보안 트랙 분리 | (this) | Codex 21주장 중 REFUTED 2(RAG 완전연결·reviews=폴더)·IMPRECISE 6 — 무검증 인용 차단 |
| 2026-06-24 | Phase 0.9 — §N 라이브 DB 대조(atockorea MCP). 마이그레이션 드리프트(repo 32 vs live 48, ~9만 일치)·N1 REFUTED→드리프트·N27 anon-exec PII RPC(BLOCKER)·N28~N32·perf 62/62/134. §G-6 DDL 라이브 충돌0, F1~F3/R1 라이브 확정 | (this) | K-0 해소. pending-db-apply 수동 워크플로가 드리프트 원인. payments/notifications 라이브 부재 확정 |
| 2026-06-24 | Phase 0.10 — §O~§R 플랜 완전화. 3 감사 에이전트 + 라이브 검증. N33(site_settings 부재)·B-1(노쇼 돈버그)·B-2/B-3/M-4/M-6/M-7/M-8 신규. §G-6 DDL 12델타 정정(C#3 FOR UPDATE는 probe로 REFUTED). 횡단 WS-A~J·업그레이드 U-1~10·준비사양(N27 SQL/정합 런북/Phase1 턴키)·실행 WBS(§R) | (this) | unified_inquiries 컬럼 라이브 검증·E-5 재고UI 보류(availability unlimited 충돌)·N1/D-15 stale 정정 |
| 2026-06-24 | Phase 0.11 — §S 섹션별 딥리뷰 + 모바일/UX. 8 에이전트. 모바일 정량판정(29p중 12p 반응형0·최악 support/match-pois/sessions/retention). 신규 S-F1~F16(stats OOM·Math.random 비번·audit actor·에디터 데이터손상)·S-U1~U11(ConfirmDialog/Sonner 기존자산·URL필터·nav IA). 모바일 패턴 카탈로그→R2.0 기반 티켓 | (this) | REFUTED: SortableImageCard 케이싱·"전부 데스크톱전용"(셸은 모바일 인지) |
| 2026-06-24 | Phase 0.12 — §T 최종 전수검수(미검수영역). 7 에이전트(미진단어드민라우트·Stripe머니패스·인증RBAC·챗봇·공개API·lib·고객UI)+라이브 DB/RLS/storage 스윕. 🔴🔴 P1 라이브확정 권한상승(고객→admin). W1-15·CB1-15·PA·AR·LIB·CK1-3·N34. 보안트랙 대폭확장+머니패스 무결성 트랙 신설 | (this) | 굿뉴스 확정: requireAdmin 서버DB검증·service-role 번들유출0·웹훅서명O·머니cron fail-closed·pricing 수학 깨끗 |
| 2026-06-24 | Phase 0.13 — §U 프리미엄 모바일 도약 + 완성도 보정. 7 에이전트(누락스윕+프리미엄모바일6). blind spot(merchant/dashboard 포털·미언급 공개API). 프리미엄 결정8·4페이지 청사진·본문 stale 정정·WBS 고아 입양. 컴패니언 설계스펙 문서 신설 | (this)+`docs/admin-premium-mobile-design-spec-2026-06-24.md` | settlements requireAdmin 보유(REFUTED)·vercel cron 5개 확인. 신규 R10(머천트포털)·J #15~17. **진단 종결** |
| 2026-06-24 | **W0.1 🔒 P1 권한상승 차단(구현)** — `user_profiles` UPDATE/INSERT RLS에 role 가드 추가. UPDATE는 role 불변(`private.current_profile_role()` SECURITY DEFINER 헬퍼로 재귀 회피, private 스키마=비노출), INSERT는 customer만 허용. 마이그레이션 `20260624000000_secure_user_profiles_role_rls.sql` | 7d7c2244 | 라이브 재현 테스트 4종 PASS(고객 role→admin UPDATE 거부·정상 필드수정 통과·INSERT admin 거부·INSERT customer 통과). advisor 순회귀 0(헬퍼 비노출). 정상 흐름 무영향(role 변경은 전부 service-role 경로) |
| 2026-06-24 | **W0.2 🔒 N27 anon-exec REVOKE(구현)** — analytics 4 SECURITY DEFINER 함수(`anonymize_old_analytics`·`refresh_analytics_materialized_views`·`analytics_health_snapshot`·`handle_new_user`) EXECUTE를 PUBLIC/anon/authenticated에서 회수, service_role만 부여. 마이그레이션 `20260624001000_revoke_anon_exec_analytics_funcs.sql` | 7497bc89 | 호출부 3개(cron 2 + admin health) 전부 service-role → 무영향. advisor 0028·0029 SECURITY DEFINER 항목 전부 소거 확인. handle_new_user는 트리거라 발화 무관 |
| 2026-06-24 | **W0.3 🔒 W-3 cron secret URL 제거(구현)** — `recapture-holds`·`capture-tour-day-payments`의 `?secret=` 쿼리 폴백 삭제, `Authorization: Bearer` 헤더만 허용. 수동 트리거 스크립트 `stress-noshow-hold.ts` 2곳도 헤더 방식 전환 | a67593aa | Vercel Cron은 Bearer 헤더 자동주입 → 스케줄 무영향. tsc 전체 0에러. `?secret=` 쿼리는 더 이상 인증 안 됨 |
| 2026-06-24 | **W0.4 🔒 N23 cron fail-open 제거(구현)** — `analytics-anonymize`·`analytics-refresh-views`의 `if(!secret) return true`→`return false`(시크릿 미설정 시 거부). 같은 파일의 `?secret=` 쿼리 폴백도 제거(W-3 일관성) | cbba8a61 | 두 라우트가 유일한 fail-open(머니 cron은 이미 fail-closed). 쿼리-secret 호출부 0 확인. tsc 0에러 |
| 2026-06-24 | **W0.5 💰 B-1 노쇼 부분캡처(구현)** — settle capture에 `amount_to_capture`(노쇼·USD·유효 fee일 때 `min(no_show_fee_usd_cents, 승인액)`) + 멱등키 `settle:capture:${piId}`. 순수 헬퍼 `lib/payments/no-show-capture.ts` 추출 | 1b0b43ec | ⚠️ **라이브 데이터 정정**: 플랜 가정($60 fee<$300 hold)과 달리 현재 `no_show_fee_usd_cents==전체가격`(checkout이 amountMinor 그대로 저장), KRW는 null → **오늘은 fee==hold라 동작 동일(회귀0)**, 부분-fee 정책 도입 시 과청구 방지. 골든 테스트 7개 그린($300·$60→$60), 결제/체크아웃 17 그린, tsc 0 |
| 2026-06-24 | **W0.6 🔒💰 W-1 webhook 상태가드(구현)** — `payment_intent.succeeded`에 `.neq('status','cancelled').neq('payment_intent_status','canceled')` 추가(취소예약 되살리기·released hold 캡처 차단), 가드시 0행은 500 대신 무시로그(Stripe 무한재시도 방지). 동일클래스 `checkout.session.async_payment_succeeded`에도 `.neq('status','cancelled')` | 80233e9d | 라이브 술어검증(cancelled 행 배제 논리적 확정), tsc 0. webhook 테스트 인프라 없음→tsc+코드리뷰+라이브 술어 probe로 검증 |
| 2026-06-25 | **✅ Wave 0 전체 main 머지** (PR #167 `7b222ba7`) — 로컬빌드 green·전체jest 371pass(8fail=main 기존 환경결함, 회귀0)·origin/main 머지 충돌0 검증 후 머지 | 7b222ba7 | 라이브 보안·머니 6건 프로덕션 반영 |
| 2026-06-25 | **Wave 3 기능 안정화 배치1(구현)** — LIB-1(구 이메일 템플릿 XSS escape)·S-F2(머천트 임시비번 Math.random→crypto 헬퍼)·D-4(create 응답 평문비번 제거)·B-3(주문 상태 state machine)·M-4(투어 DELETE 활성예약 가드)·M-6(stats "오늘" KST)·D-14(qa-pairs 카운트 legacy 값 정리)·N-5/S-F7(머천트 PUT allowlist+빈PUT 가드) | PR #169 b545605c | 신규 테스트 +42, 헬퍼 temp-password·booking-status-transition·kst-day·merchant-update(전부 테스트) |
| 2026-06-25 | **Wave 3 배치2(구현)** — AR-1(tour-content/generate 로케일·페이로드 비용 캡)·AR-3(투어 픽업 무음/비원자 손실 수정: POST 경고·PATCH delete전검증+복원) | PR #170 3263e82f | 헬퍼 content-generate-guard·pickup-points(+10 테스트). 전체 423 pass(8 fail=main 기존), 빌드 green |
| 2026-06-25 | **W1.1~W1.8 프리미엄 모바일 기반(구현)** — W1.1 `--admin-*` 토큰+tabular-nums+radius(globals/tailwind/layout) · W1.4 입력 16px 모바일 floor(iOS줌) · W1.2 sonner Toaster(top-center) · W1.6 유틸키트(haptics·Spinner·Skeleton+shimmer·SwipeRow·useUrlFilters) · W1.5 44px터치+safe-area-top · W1.3 AdminPageShell · W1.7 Tier1(AdminPageHeader·StatCard·FilterBar·DataTable·StatusBadge아이콘+pill) · W1.8 Tier2(DataCard·EmptyState·ActivityRow·ConfirmSheet·FilterSheet) | aa9146a9~107c3e0f | 단위/렌더 테스트 30개 그린, 빌드 green. **W1.9(이모지/Lucide 수백개·analytics 전반→Wave4 W4.7와 함께)·W1.10(미존재 /admin/inbox=Wave4 의존)·W1.11(axe CI/i18n)는 preview 가능 세션으로 연기** |
| 2026-06-25 | **✅ W5.7/W-10 환불경로(refund-only) main 머지** (PR #173 `c3865d14`) — `POST /api/admin/orders/[id]/refund`(admin-gated, settle 패턴; 전액/부분 `amountMinor`; idempotencyKey; payment_status refunded/partially_refunded·refund_amount·refund_processed; audit_logs `booking_refund`; 미캡처 홀드 거부→settle release) + `charge.refunded` 웹훅(payment_intent_id 매칭, dashboard out-of-band 환불도 동기화) + 순수 `lib/payments/refund.ts`(resolveRefundAmount 이중환불가드·toStripeRefundReason). **정산 대사는 §G 후속(미반영)**. 골든 11 | PR #173 c3865d14 | jest 489pass/8fail(=기존, 회귀0)·build green. 신규의존성0. 사용자 결정=환불전용만 |
| 2026-06-25 | **✅ D-15 analytics 수학버그 배치 main 머지** (PR #172 `c3e91ae3`) — 3 BLOCKER: experiments(`void conversionFilter` 폐기→공유 매처로 필터적용+세션dedup+다변형 pairwise chi-square)·funnels(세션→**방문자 그룹**으로 다중세션 완료, `visitors_considered`)·events/[name](timeseries 신선도 반전→과거=matview/오늘=raw·50k cap을 totals로 라벨→병합합계+`events_sampled`). 순수헬퍼 4종(`lib/analytics/event-match·experiment-stats·funnel-walk·event-detail`) + 골든 30. **보류(설계게이트): overview/events `total_visitors` distinct-over-range 과대·retention left-censor — 일별집계로 정확값 불가, 원시 COUNT DISTINCT/신규 MV·RPC 결정 선행(+M-1 retention cap)** | PR #172 c3e91ae3 | jest 478pass/8fail(=기존, 회귀0)·build green. 신규의존성0 |
| 2026-06-25 | **✅ Wave 9 공개 보안 트랙 배치1 main 머지** (PR #171 `b39963fd`) — 9티켓: PA-1(reminders GET **판정 정정**: 이미 안전→`lib/cron-auth` 추출+회귀잠금)·PA-2/N17(`DELETE /api/upload` 소유권 IDOR→버킷화이트리스트+네임스페이스+`..`차단, `lib/upload-auth`)·N11(`/api/inventory` 4핸들러 requireAdmin)·N13(`/api/promo-codes` 목록/생성 requireAdmin, `/validate` 공개유지)·N16(confirm-email accessToken 필수화 IDOR)·P2(create-profile accessToken 필수화)·P4(check-email per-IP RL 15/분)·CB-5(chatbot 예약 전용 throttle 2/분·8/시간)·PA-3(tour-rooms senderRole 서버권위 고정) | PR #171 b39963fd | 신규 테스트 +25(cron-auth 15·upload-auth 10), tsc 0·jest 448pass/8fail(=main 기존, 회귀0)·build green. 호출부0 엔드포인트 다수→무위험. phase-z 실패는 jeju haenyeo 타이밍 stale 콘텐츠(별도 추적) |
| 2026-06-25 | **PA-4 tour-rooms 게스트 enumeration 브레이크(구현)** — tour-rooms SSE/이벤트 라우트가 공개 bookingId에 contact_email 일치만으로 게스트 인가(lockout 0)→이메일 스프레이 enumeration. `GET /events`·`POST /spot-events`의 **무인증 게스트 경로에 per-IP 브레이크**(`requestGate` 15/분·60/시; owner/admin/guide는 우회). `messages GET`은 authed-only라 게스트 경로 없음→제외. CB-2 durable 인프라 재사용 | b97eb2d0 | tsc 0·jest 541pass/8fail(=main 기존, 회귀0)·build exit0. CB-1(CORS *)은 `/api/agent/v1/*`(외부 AI에이전트 채널)이라 와일드카드가 의도적일 가능성→사용자 확인 대기(임의 제한 시 에이전트 채널 파손 위험) |
| 2026-06-25 | **PA-5·PA-6 무인증 라우트 per-IP 레이트리밋(구현)** — CB-2 durable 인프라 위에 일반 게이트(`requestGate`+`clientIpKey`+순수 sliding-window 폴백) 추가 후 무제한이던 4개 무인증 라우트에 적용: PA-5(AI비용) `itinerary/match`·`tour-product/match-explanation`(Gemini, 10/분·60/시), PA-6(스팸/메일폭탄) `contact`·`send-verification-code`(이메일, 3/분·10/시). 429+Retry-After. durable(Upstash 설정 시 인스턴스 간)·미설정 시 인메모리 폴백(동일 fail-open) | cf3fd3d4 | 신규 테스트 +6(sliding-window 코어+게이트 폴백+ip키), tsc 0·jest 541pass/8fail(=main 기존, 회귀0)·build exit0. prompt-injection(PA-5)·moderation/receipt-token(PA-6)은 RL 외 별도 |
| 2026-06-25 | **CB-2 durable 레이트리밋(구현, W9.11)** — 챗봇 예약조회 enumeration/PII 브레이크 + LLM비용 throttle이 인메모리(서버리스 인스턴스별)라 람다 분산으로 우회 가능하던 것을 **Upstash Redis REST(=`lib/durable-rate-limit.ts`, fetch만·신규 npm 의존성 0)** 공유 카운터로. durable-aware async 래퍼(`allowRequestDurable`·`checkBookingLookupAllowedDurable`/`record*Durable`)가 `UPSTASH_REDIS_REST_URL`/`TOKEN` 설정 시 durable, **미설정/Redis오류 시 기존 인메모리로 fail-open 폴백**(Redis 다운이 챗봇/지원 락아웃을 안 일으킴). assistant route 6개 호출부를 await로 전환. **env 설정 전엔 동작 무변경**(인메모리 함수·테스트 그대로 보존=폴백) | f91b9edc | 신규 테스트 +14(durable backend 11 mocked fetch + 폴백 패리티 3), tsc 0·jest 535pass/8fail(=main 기존, 회귀0)·build exit0. .env.example에 env 문서화. **활성화=사용자가 Upstash 프로비저닝+env 설정** |
| 2026-06-25 | **N21/P3 verify-and-document(감사+문서화)** — `/api`가 middleware matcher에서 제외된 게 보안홀인지 전수 감사: `app/api/admin/*` **44개 라우트 전부 서버 가드 확인**(43=`requireAdmin`, 1=`/api/admin/contacts`는 `withAuth`+DB-role `role==='admin'` 체크). 역할은 `getAuthUser`가 `user_profiles` 테이블을 service-role로 조회(위조가능 JWT 메타 아님)→신뢰가능. **누락 가드 0**. middleware.ts matcher에 보안모델 설명 주석 추가, N21/P3을 verify-and-document로 종결(코드 수정 불요) | (commit) | tsc 0·build exit0. Edge 미들웨어 가드는 Bearer-토큰 API 클라가 쿠키세션 미설정이라 부적합→per-route 가드가 SoT. 잔여 코드 비-게이트 항목 소진 |
| 2026-06-25 | **W3.8 인증/세션 B-2·M-8(구현)** — M-8(어드민 layout 인증가드가 PGRST116 시 `customer` 프로필 자동 INSERT하던 데이터변이 제거: 삭제한 프로필 재생성·무의미했음→순수 `lib/admin/admin-auth-guard.ts` `decideAdminGuard`로 분기 추출, 변이 0)·B-2(layout이 마운트 1회 checkAuth만→`onAuthStateChange` 구독 추가, SIGNED_OUT(만료/리프레시실패) 시 즉시 signin 리다이렉트=만료 표시) | cfa8ad1b | 신규 테스트 +7(admin-auth-guard), tsc 0·jest 521pass/8fail(=main 기존, 회귀0)·build exit0. 같은 파일이라 1커밋. DoD(만료 표시) 충족. P3(서버게이트)는 verify-and-document로 별도 |
| 2026-06-25 | **Wave 9 N34 storage 버킷 바운딩(구현+라이브 적용)** — `email-assets`·`product-images`가 `file_size_limit=NULL`·`allowed_mime_types=NULL`(무제한)이던 것을 이미지 타입+크기 캡으로 제한(email-assets 5MB, product-images 10MB; tour-images/gallery는 이미 제한됨). 업로드 시점만 강제·기존 객체/읽기 무영향=additive(email-assets=작은 PNG 1개·service-role 전용 쓰기, product-images=빈 버킷). 추적 마이그레이션 `20260625000000_bound_storage_buckets_n34.sql` + **라이브 적용(사용자 승인)**·get_advisors 재실행 신규 findings 0 | 5322b80c | "Auth Upload" INSERT 정책은 withcheck가 이미 `auth.role()='authenticated'` 강제→실질 무홀, 크기/MIME 바운드로 남용 한정. **잔여(문서화)**: product-images "Public Access" SELECT가 버킷 리스팅 허용→어드민 이미지 리스팅 깨짐 위험으로 미변경. DB 변경=storage.buckets UPDATE만(스키마 DDL 0) |
| 2026-06-25 | **W3.8/Wave 9 인증·세션 보안 배치3(구현)** — N18(LINE OAuth: id_token 미검증 base64 디코드 → LINE `/oauth2/v2.1/verify`로 서명/aud/exp 검증, aud 불일치/실패 시 email=null 폴백=무회귀 + 정적 state→랜덤 state httpOnly Lax 쿠키(GET)·콜백 검증·1회용, 순수 `lib/line-auth.ts`)·P6(change-password 무음성공 차단: signIn 세션 존재 + updateUser user 반환 단언) | (commit) | 신규 테스트 +8(line-auth), tsc 0·jest 514pass/8fail(=main 기존, 회귀0)·build exit0. 신규의존성0. **연기(문서화)**: P5(merchant login session 바디 노출→httpOnly 쿠키 핸드셰이크 리팩터=breaking)·magicLink 바디(콜백이 Location 리다이렉트로만 사용→대부분 완화)·P3(middleware /admin 가드: 현재 client-side+API requireAdmin로 데이터안전, Edge 쿠키세션 미보장으로 admin 락아웃 위험→verify-and-document) |
| 2026-06-25 | **Wave 9 공개 보안 트랙 배치2(구현)** — 3티켓: **N14**(🔴 BLOCKER checkout IDOR: `/api/stripe/checkout`가 공개 UUID만으로 예약 조회 후 prior intent cancel/신규 hold 생성→소유권 검증 추가. 호출자 제공 이메일(`bookingData.customerInfo.email`)이 예약 owner 이메일(contact_email + user_id auth 이메일 폴백)과 일치해야 진행. **서버 폴백이 아닌 caller-supplied 이메일로 검증**, 순수 `lib/checkout-auth.ts`)·**N19**(maps/static 빌링남용: 파라미터 화이트리스트+caller `key` 차단+param/길이 캡 `lib/maps-proxy.ts` + per-IP RL 60/분; referer 가드는 크로스오리진/모바일 무referer 깨짐 방지로 의도적 제외)·**N20**(보안헤더 부재→`next.config.js` `headers()`: HSTS·nosniff·X-Frame/frame-ancestors·Referrer-Policy·Permissions-Policy 안전 서브셋; 풀 CSP는 Stripe/Maps 인라인 nonce 패스 선행으로 연기) | (commit) | 신규 테스트 +17(checkout-auth 8·maps-proxy 9), tsc 0·jest 506pass/8fail(=main 기존, 회귀0)·build exit0. 신규의존성0. 정당한 3개 checkout 호출부(투어/빌더/모바일) 모두 이미 이메일 전송→무회귀. N15(oversell)은 availability-unlimited 결정과 충돌→파킹, PA-4~6/CB-1·2는 durable RL(W9.11 Upstash 게이트)→제외 |
| 2026-06-25 | **CB-1 CORS 와일드카드 verify-and-document(감사+문서화, 사용자 확인)** — `/api/agent/v1/*`(book·quote·tours·availability)·`/api/agent/mcp`·`/api/agent/openapi.json`·`.well-known/{ai-plugin,agent}.json`의 `Access-Control-Allow-Origin: *`가 보안홀인지 코드 대조: ① `Access-Control-Allow-Credentials`가 repo 전체 부재→와일드카드+무자격증명=브라우저가 교차출처 쿠키 미전송(안전 조합) ② 에이전트 라우트에 쿠키/세션 인증 0(`grep cookies\|getSession\|credentials`=NONE), 인증=명시적 `x-api-key` 헤더+서명 quote 토큰(`verifyQuote`)→CSRF로 탈취될 ambient 자격증명 자체가 없음 ③ 설계 의도=공개 에이전트 채널(디스커버리 매니페스트 `.well-known/*`+`/for-agents` 문서), `book`은 카드 미청구 human-in-the-loop 핸드오프(격리 `agent_reservations`·멱등키·레이트리밋). **제한 시 외부 에이전트 채널 파손+보안이득0**→코드 변경 없음, verify-and-document로 종결(N21/P3·N34 잔여와 동일 처분). **§R-9 보안 트랙 비-게이트 항목 소진 완료** | (docs) | 코드 수정 0(문서만). 와일드카드 메서드/헤더도 이미 최소(POST/OPTIONS·Content-Type). 원격 Linux 환경=라이브 DB 미접근·풀빌드 env 부재로 DB/빌드 의존 티켓 검증 불가→문서 처분이 적합 |
| 2026-06-25 | **W4.6-b 머천트 생성+상세 프리미엄 패스(구현)** — 머천트 영역 마무리. **create**: 전영문→한국어·토큰·16px/44px·**자격증명 alert 제거**(API가 임시비번을 sendMerchantWelcomeEmail로 발송·응답에 비번 없음[D-4]→"securely 발송" alert는 오해소지였음→정확한 인라인 성공상태로 "임시비번을 담당자 이메일로 발송" 표기)·**sticky CTA 바**(취소/생성)·toast·**dirty 가드**(beforeunload). **detail**: 전영문→한국어·토큰·status confirm()→ConfirmSheet·verify토글+전 alert→toast·skeleton/에러·pill emerald/amber·날짜 ko-KR | ccaeb62 | tsc 0·jest 549pass/8fail(=main 기존, 회귀0)·`next build` ✓(create+[id]). 신규의존성0. **머천트 영역(목록·생성·상세) 개편 완료** |
| 2026-06-25 | **W4.6-a 머천트 목록 ConfirmSheet+토큰 패스(구현)** — 디자인시스템+alert/confirm 마이그레이션. **`window.confirm()` 2개 mutation→단일 ConfirmSheet**(삭제=destructive 빨강·"되돌릴 수 없습니다" 노트, 상태변경=대상상태 표시; iOS WebView가 confirm()에 silently true 반환→"무다이얼로그 발화" 홀도 차단)·전 `alert()`(영문 "Admin access required"/"Please sign in"/성공·실패 포함)→sonner toast(액션 성공 toast)·어드민 토큰(surface/border/hover·rounded-design-md·shadow-admin-card, status pill green/yellow→emerald/amber, 날짜 ko-KR)·skeleton 로딩(indigo 스피너 대체)·44px 터치·16px 검색. 데스크톱 테이블+모바일 카드 유지, 검색/필터 동작 불변 | 3f231cf | tsc 0·jest 549pass/8fail(=main 기존, 회귀0)·`next build` ✓(`/admin/merchants`). 신규의존성0. 머천트 상세/create는 후속 |
| 2026-06-25 | **W4.8 챗봇 분석 프리미엄 패스(구현)** — 이미 한국어/구조 양호하던 페이지를 디자인시스템에 맞춤. **에스컬레이션율 KPI 렌더**(API가 `escalationRate` 계산했으나 페이지는 디플렉션만 표시→둘 다 노출)·**기간선택기 7/30/90일**(하드코딩 `days=30`→API days 파라미터 연동, 부제는 data-driven `window_days`)·로컬 Stat→StatCard 키트+토큰(admin-surface/border·rounded-design-md·shadow-admin-card·tabular-nums)·이모지(👍/👎/✓)→Lucide·`alert()`→toast(초안 생성 성공 toast 추가)·skeleton/에러 재시도·44px 터치. 라벨=데이터 유지, 전 섹션(퍼널·Q&A 파이프라인·RAG·카테고리·갭+원클릭 초안) 동작 불변 | 4b5abe5 | tsc 0·jest 549pass/8fail(=main 기존, 회귀0)·`next build` ✓(`/admin/chatbot-analytics`). 신규의존성0 |
| 2026-06-25 | **W4.7-a 레거시 `/admin/analytics` 폐기→엔진 허브(구현, §B)** — 레거시 페이지가 죽은 placeholder였음(대시보드와 동일 `/api/admin/stats` 재호출·가짜 "Chart visualization will be added here" 패널·무지개 이모지/영문·**USD 총매출을 ₩로 오라벨**=totalRevenue가 USD 버킷). 강력한 자체 엔진 `/admin/analytics/product/*`이 IA에 미노출(§B 결함). §B 결정대로 허브로 재구축: 통화정확 비즈니스 요약(StatCard·USD 헤드라인+KRW 서브, ₩오라벨·가짜차트 제거)+엔진 런처 그리드(상품분석/이벤트/퍼널/리텐션/A·B실험/세션/챗봇/헬스)·한국어1차+토큰+Lucide·alert→toast·skeleton | 0906ccb | tsc 0·jest 549pass/8fail(=main 기존, 회귀0)·`next build` ✓(`/admin/analytics`). 신규의존성0. 엔진 페이지 자체(product/* KPI·세션·리텐션)는 §8.4 후속 |
| 2026-06-25 | **W4.2 주문 목록 프리미엄 모바일 개편(구현, §8.2)** — Wave 4 두번째 페이지. **sticky 필터바**(검색+칩이 글로벌 헤더 아래 고정→긴 목록서 필터 안 사라짐, §8.2 1번 윈)·**신규 클라이언트 검색**(투어/고객/이메일/전화/주문ID/ref, clear 버튼+필터/전체 결과메타)·필터(status/source/sort) **URL 이관**(`useUrlFilters`→새로고침/뒤로/딥링크 보존, 대시보드 `?status=pending` 연동)·한국어 1차+어드민 토큰(admin-surface/border/hover·rounded-design-md·tabular-nums, gray/indigo 드리프트 제거)·`alert()`→toast·skeleton 로딩. **D-2**: CSV에 Source+Currency 컬럼 추가(KRW 340000 vs USD 52.00 모호성 제거)·금액 null-safe. 데스크톱 테이블+모바일 카드 유지(토큰화). 목록 전용(상세 머니시트=W4.1 별도) | 38e80c6 | tsc 0·jest 549pass/8fail(=main 기존, 회귀0)·`next build` ✓(`/admin/orders` 빌드). 신규의존성0. 레이아웃 글로벌 sticky 헤더 아래 `sticky top-0` 안착(AdminPageShell 미사용) |
| 2026-06-25 | **W4.3 대시보드 프리미엄 모바일 개편(구현, §8.1)** — preview 게이트 해제(사용자 라이브검증) 후 첫 페이지. **액션큐 우선 배치**(대기예약+미처리문의 2-up·비0=amber)·KPI 그리드(StatCard 키트: 업체/상품/주문)+**의존성0 7일 매출 스파크라인**(USD 헤드라인·KRW 서브, 인라인 SVG)·skeleton 로딩·floating help 버튼 제거(마지막 카드 가림 해소). **D-1 수정**: 미처리 문의=실카운트(`contact_inquiries status='new'`, 기존 하드코딩0)·가짜 "새 리뷰" 0카드 제거(reviews 모더레이션 큐/어드민 페이지 부재)·최근활동 가격 null-safe(`final_price` null 시 `.toString()` 크래시 경로 제거)·`alert()`→sonner toast. API(`/api/admin/stats`): `newContacts`+`revenueTrend7d`(최근 7 KST일 paid 매출, USD/KRW 분리) 추가, 순수 `lib/admin/revenue-trend.ts` | 87b0fe7 | 신규 테스트 +4(revenue-trend KST 버케팅), tsc 0·jest 549pass/8fail(=main 기존, 회귀0)·`next build` ✓ Compiled(`/admin` 빌드). 신규의존성0(StatCard·ActivityRow·sonner·lucide 재사용). 키트가 이미 머지돼 1페이지에 바로 적용. 레이아웃 글로벌 sticky 헤더 존재→AdminPageShell 미사용(헤더 중복 회피) |
| 2026-06-25 | **W3.10 lib 정확성 비-pricing 배치(구현)** — **LIB-6**(PAYMENT_STATUS 한국어 라벨 유실: PR #134이 주입한 stray `PAYMENT_STATUS_LABELS.authorized = 'Card registered'` 오버라이드가 `authorized`(카드온파일 자동청구 모델의 핵심 상태)의 이중언어 라벨을 평문 영어로 클로버링→고객이 "투어 당일 KST 10시 자동청구" 설명·한국어 카피 유실. 라벨맵+리졸버를 부작용없는 `lib/email/payment-status-label.ts`로 추출(Resend 인스턴스화 회피=단위테스트 가능)·stray 제거·unknown/빈/nullish→`pending` 폴백 보존·hasOwnProperty로 프로토타입키 차단)·**LIB-good server-only 가드**(`lib/email.ts`가 `RESEND_API_KEY`를 import 시 읽고 app/api/** 라우트만 import→`import 'server-only'` 추가로 Client Component 실수 import 시 하드 빌드에러=메일시크릿 번들유출 원천차단; 전 importer가 API 라우트임을 grep 정적증명) | 1fba271 | 신규 테스트 +4(payment-status-label), tsc 0·jest 545pass/8fail(=main 기존 폴리필/stale, 회귀0)·`next build` ✓ Compiled successfully(server-only 가드가 클라 그래프 미파손 확인; placeholder Supabase URL의 prerender fetch 에러는 가짜 DB라 예상·컴파일 무관). 신규의존성0. **남은 W3.10=LIB-2(DMZ 차량등급)·LIB-3(FX 폴백)=pricing 게이트 유지**·LIB-5(notifications 무음실패 알림)=관측성 트랙(WS-A) |
| 2026-06-25 | **W4.7 분석 엔진 오버뷰 프리미엄 모바일 개편(구현, §8.4)** — Wave 4 엔진 본체 첫 페이지(허브에서 링크만 됐던 `/admin/analytics/product` 오버뷰). 레이아웃: stale 공지(materialized view 일일refresh)를 **상단으로** 이동(숫자 프레이밍)·range 칩 토큰화(min-h-9·aria-pressed). **KPI 4종(이벤트/세션/방문자/전환)을 StatCard 키트 + 카드 내 스파크라인**으로 재구성→기존 별도 MiniBarChart 패널 3개(~480px) 제거(§8.4 1번 윈)·각 KPI에 Lucide 아이콘. **통합 일일트렌드 단일 차트**(메트릭 토글 4종·탭/호버 시 day+값 readout·blue-600 활성바)·90일 시리즈는 **주간 13버킷으로 축약**(§5.3, 90바×3.5px 가독성). 상위이벤트 **5개+모두보기** 토글(모바일, 바는 sm 이상에서만). 어드민 토큰(admin-surface/border/hover·rounded-design-md·shadow-admin-card·tabular-nums)·skeleton(StatCardSkeleton×4+행)·인라인 에러 `role=alert`. 공유 `Sparkline` 컴포넌트 추출(대시보드 §8.1 로컬 정의→`components/admin/Sparkline.tsx`, 대시보드 재배선)·StatCard에 `chart` 슬롯 추가(additive, 기존 3사용처 무영향). 순수 `lib/admin/analytics-overview.ts`(`bucketTimeseries` 주간버킷·`OVERVIEW_METRICS`) | (commit) | 신규 테스트 +5(bucketTimeseries 주간버킷/부분주/메트릭순서), tsc 0·jest 554pass/8fail(=main 기존, 회귀0)·`next build` ✓ Compiled(`/admin/analytics/product`). 신규의존성0. 데이터 fetch 불변(`/api/admin/analytics/overview`). **엔진 잔여=sessions(SessionCard·grid-cols-12 교체)·retention(frozen 1열 히트맵) 후속**. D-15 보류(total_visitors distinct-over-range 과대)는 별도 설계게이트 유지 |
| 2026-06-25 | **W4.7 분석 엔진 세션·리텐션 프리미엄 모바일 개편(구현, §8.4)** — 엔진 §8.4 잔여 2페이지(허브 링크만 됐던 `analytics/product/sessions`·`retention`). **sessions**: `grid-cols-12`(col-span-1=~31px 컬럼, 모바일 판독불가)을 **모바일 `SessionCard`**(시작·지속/이벤트/PV·진입경로+utm칩·device/viewport/locale/국가, 카드 전체 링크)+데스크톱 dense 테이블(`hidden md:block`)로 분리·✓이모지→`CheckCircle2`·`text-[11px]/[10px]`→토큰 사이즈·`불러오는 중…`→Skeleton 카드·정렬/range 칩 토큰화+min-h-9·`aria-pressed`·tabular-nums. **retention**: 히트맵 좌측 **코호트 주 열 frozen**(`sticky left-0 z-10 bg-admin-surface`, 헤더 z-20)→가로 스크롤 시 라벨 유지·**기본 8주→4주**(모바일 우선)·셀 `min-w-[44px]`·`불러오는 중…`→Skeleton·admin 토큰(surface/border/hover·rounded-design-md·shadow-admin-card)·single-hue slate 램프 유지(§2 color-calm). 둘 다 순수 UI(신규 로직0→신규 테스트0) | (commit) | tsc 0·jest 554pass/8fail(=main 기존, 회귀0)·`next build` ✓ Compiled. 신규의존성0. 데이터 fetch/API 불변. **W4.7 엔진 §8.4 전체 완료(overview+sessions+retention)**. 남은 Wave 4=W4.9 POI/CMS/업로드·W4.4 인박스(API 선행)·W4.1 머니시트(신중)·W4.10 설정(게이트) |
| 2026-06-25 | **W4.9-a match-pois 모바일 사용가능화(구현, §8.4)** — 모바일 0 페이지였던 `/admin/match-pois`(2-pane 마스터-디테일). 페이지가 항상 `flex`로 `w-80` 목록창+편집기를 **모든 폭에서 side-by-side** 렌더→모바일에서 320px 사이드바+편집기 압착·판독불가. **모바일 단일창 전환**: 선택 전=목록 full-width, 선택 후=편집기 full-width(편집기엔 이미 `lg:hidden` ArrowLeft 뒤로 버튼 존재)·`lg+`는 2-pane 유지. 페이지 컨테이너에서 가시성 제어(목록 `selectedKey ? hidden lg:flex : flex`·편집기영역 `selectedKey ? flex : hidden lg:flex`). **자동선택(첫 POI) `window.matchMedia('(min-width:1024px)')` 게이트**→모바일은 목록부터(편집기 직행 방지). PoiListPane에 `className` prop 추가(`w-80` 하드→`w-full lg:w-80`)·`bg-white`/`border-slate-200`→`bg-admin-surface`/`border-admin-border`. 페이지 캔버스 `bg-slate-50`→`bg-admin-bg`·EditorSkeleton 토큰화(rounded-design-md·admin-surface/border) | (commit) | tsc 0·jest 554pass/8fail(=main 기존, 회귀0)·`next build` ✓ Compiled(`/admin/match-pois`). 신규의존성0. 편집기 pane 내부(300+줄)는 범위 외(DoD=모바일 사용가능 충족). 데이터/API/upsert 불변. 다음=W4.9-b CMS·W4.9-c 업로드 |
| 2026-06-25 | **W4.9-bc CMS·업로드 프리미엄 토큰/피드백 패스(구현, §8.4)** — Wave 4 POI/CMS/업로드 마무리. **CMS**(`/admin/cms`, 599줄 문자열 JSON·이미지 도구): gray-* 팔레트 전체→slate/admin 토큰·섹션카드 `bg-white rounded-xl shadow-sm border-gray-200`→`bg-admin-surface rounded-design-md shadow-admin-card border-admin-border`·403 `alert()`→`toast.error`·로딩 `불러오는 중…`→Skeleton 카드·h1 `text-3xl`→`text-xl font-semibold`(§5.1)·URL 텍스트입력 `text-sm`→`text-base min-h-11`(iOS줌/44px)·세이브버튼 emerald-600/indigo-600 rainbow→`blue-600` 단일 액센트(§1.4 color-calm). **업로드**(`/admin/upload`): 동일 토큰화·`alert()` 4개(25/35/69/119)→toast(복사/완료/빈상태)·이모지 ✅📖→Lucide(Check/Copy/BookOpen)·**갤러리 복사 어포던스 hover전용(`opacity-0 group-hover`)→tap**: 모바일 상시 코너 복사버튼(`sm:hidden`) + 오버레이 `group-active`도 표시(터치 hover부재 대응, W4.9 DoD "hover→tap"). 로직/업로드 파이프라인/이미지키 불변 | (commit) | tsc 0·jest 554pass/8fail(=main 기존, 회귀0)·`next build` ✓ Compiled(`/admin/cms`·`/admin/upload`). 신규의존성0. **W4.9 전체 완료(match-pois+cms+upload)**. 남은 Wave 4=W4.4 인박스(신규 API 선행)·W4.1 머니시트(신중)·W4.10 설정(게이트)·W4.11 횡단 |
| 2026-06-25 | **W4.4 통합 인박스 신설(구현, §E-4/§8.3)** — 문의 3원화(contact_inquiries·received_emails·support_tickets)를 단일 인박스로. **API `GET/PATCH /api/admin/inbox`**(requireAdmin): §K-7.5 view는 DDL 게이트라 회피하고 **인-라우트 3-소스 키셋 머지**(각 소스 `created_at/received_at desc limit+1`·`< cursor`·status/검색 필터→`lib/admin/inbox.mergeInbox`로 전역 desc 상위 N). 라이브 스키마 대조 정정: `support_tickets.id`=bigint(uuid 아님)·`unread_for_admin`=boolean(§K-7.5 초안 `>0` 오류)·`received_emails.is_spam` 제외. 미처리 카운트(첫 페이지만, is_read=false/unread_for_admin). PATCH=소스별 읽음 디스패치. **페이지 `/admin/inbox`**: 소스칩(전체/문의/메일/티켓)+미처리 토글(배지)+검색(디바운스·URL `useUrlFilters`)+날짜그룹(KST `kstDayBounds` 오늘/어제/이전)+InboxItemCard(미처리 dot·소스/카테고리 칩·상대시각·예약ref)+바텀시트 상세(드래그핸들·본문·읽음 토글·원본 딥링크)+더보기 커서·skeleton. **바텀탭**: 문의 탭→수신함(`/admin/inbox`)·사이드바 수신함 NEW 추가. 순수 `lib/admin/inbox.ts`(normalize×3·mergeInbox 키셋·sanitizeSearch) | (commit) | 신규 테스트 +6(normalize/merge/cursor/sanitize), tsc 0·jest 560pass/8fail(=main 기존, 회귀0)·`next build` ✓(`/admin/inbox`·`/api/admin/inbox`)·**라이브 검증**(contact3/email3/ticket57·미처리 ticket53). 신규의존성0·DDL 0(view 미생성→게이트 회피). **연기**: 인박스 내 답장 컴포저·스와이프 해결(3소스 mutation 상이)→원본 페이지 딥링크로 처리·5슬롯 더보기 IA 재편(W1.10). 남은 Wave 4=W4.1 머니시트(신중)·W4.10 설정·W4.11 횡단 |

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

## G-6. 정산/세무 데이터모델 + 마이그레이션 브리지 상세 설계 (Phase 4 — §L-2 ③)

> §L-2 ③ 착수. **코드 직접 대조로 전 사실 재검증 완료**(2026-06-24): RPC 본문(`20260515132911`)·GRANT(`20260515134209`)·`settlements`/`settlement_bookings`/`bookings`/`tours` 스키마(archive `complete-database-schema.sql`)·`bookings` 확장(`20260529000000`)·holds 컬럼(`20260501100000`)·settle 라우트(`app/api/admin/orders/[id]/settle/route.ts`)·settlements 라우트. 모든 마이그레이션은 **additive**(`ADD COLUMN IF NOT EXISTS`). 배포 전 K-0(라이브 DB 미연결) 대조 필수.

### G-6.0 검증된 기준 사실 (설계 근거 — file:line)
| # | 사실 | 증거 |
|---|---|---|
| F1 | RPC 실제 시그니처는 **4-arg** `create_merchant_settlement(p_merchant_id uuid, p_period_start date, p_period_end date, p_platform_fee_rate numeric DEFAULT 0.10)`. **호출부는 3-arg**(rate 미전달 → 기본 0.10) `app/api/settlements/route.ts:110-114`. (플랜 R2의 "3-arg"는 **호출부** 기준 — 함수 자체는 4-arg가 정확.) | `20260515132911_*.sql:6-11`, `settlements/route.ts:110-114` |
| F2 | GRANT/REVOKE는 **정확히 `(uuid, date, date, numeric)` 시그니처**에 묶임 → 시그니처 변경 시 **신규 시그니처에 GRANT 재발급 필수**(안 하면 service_role도 실행 불가, 런타임 파손). | `20260515134209_*.sql:3-7` |
| F3 | RPC가 `SUM(final_price)`를 **통화 필터 없이** 집계(`b.payment_status='paid' AND b.status='completed' AND b.settlement_status='pending'`만 필터) → **usd·krw 예약이 한 SUM에 혼입**(현재진행형 결함). `settlements`에 통화 컬럼 없음. | `20260515132911_*.sql:42-60`, archive `:429-466` |
| F4 | `settlement_bookings`는 `CONSTRAINT unique_booking_settlement UNIQUE(booking_id)` + RPC `NOT EXISTS (SELECT 1 FROM settlement_bookings WHERE booking_id=b.id)` 가드 → **이미 정산된 건 재정산 불가**(R1 확정). `settlement_bookings`는 `booking_revenue/platform_fee_amount/merchant_payout_amount` **스냅샷**(불변 회계 기록). | archive `:473-487`, `20260515132911_*.sql:51-55,88-101` |
| F5 | `tours`에 **원가 컬럼 전무**(cost/wholesale/net_price grep 0건). `bookings`에 charge_id·balance_transaction·fee·통화환산 컬럼 **전무**(holds 마이그레이션은 PI/SI/customer/PM id + status만 추가). | archive `tours :137+`, `20260501100000_*.sql:19-26` |
| F6 | **코드 어디서도 Stripe `balance_transaction`/`exchange_rate`/`stripe_fee`/`application_fee` 미포착**(grep 0건). settle 캡처는 `captured.amount_received`·`captured.currency`만 읽음 → fee·FX 정보 버려짐(R3 확정의 근본 원인). | settle `:203-204`, grep app/+lib/ 0건 |
| F7 | N3 재확인: `payments.currency DEFAULT 'USD'`(archive `:321`, 대문자) vs `bookings.currency DEFAULT 'usd'`(`20260529000000_*.sql:5`, 소문자). 신규 통화 의존 컬럼·정산 필터는 **case 정규화(lower) 필수**. | archive `:321`, `20260529000000_*.sql:5` |
| F8 | `payments` 테이블은 **archive canonical 스키마에 정의됨**(`:314`) — §0 기준 canonical. 라이브 배포 여부만 K-0 미확정. | archive `:314-346` |

### G-6.1 신규 컬럼 DDL (additive — Phase 4)
```sql
-- (a) tours: 도매 원가 (머천트 상품의 원가 SoT)
ALTER TABLE public.tours
  ADD COLUMN IF NOT EXISTS cost_price numeric(12,2),       -- 머천트 도매 원가
  ADD COLUMN IF NOT EXISTS cost_currency text DEFAULT 'usd';
ALTER TABLE public.tours
  ADD CONSTRAINT tours_cost_currency_lower CHECK (cost_currency = lower(cost_currency)) NOT VALID;

-- (b) bookings: 거래별 원가·운영수수료·통화·FX·Stripe 추적·수익인식
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS merchant_cost numeric(12,2),          -- 이 예약의 실원가 (tour 단가×인원 또는 계약 단가)
  ADD COLUMN IF NOT EXISTS operational_fee numeric(12,2),        -- = customer_amount − merchant_cost (ATOC 실수취 마진)
  ADD COLUMN IF NOT EXISTS fx_rate_to_usd numeric(18,8),         -- 거래일(캡처 시점) KRW→USD; usd 예약은 1
  ADD COLUMN IF NOT EXISTS usd_amount numeric(12,2),             -- final_price × fx_rate_to_usd (감사용 USD 환산)
  ADD COLUMN IF NOT EXISTS stripe_charge_id text,                -- latest_charge id
  ADD COLUMN IF NOT EXISTS stripe_balance_txn_id text,           -- balance_transaction id (exchange_rate·fee 출처)
  ADD COLUMN IF NOT EXISTS stripe_fee numeric(12,2),             -- Stripe 수수료 (balance_txn.fee)
  ADD COLUMN IF NOT EXISTS revenue_treatment text                -- gross(principal) | net(agent) — CPA 사실판정(§G-3.1)
    CHECK (revenue_treatment IS NULL OR revenue_treatment IN ('gross','net')),
  ADD COLUMN IF NOT EXISTS place_of_performance text DEFAULT 'KR',  -- 용역 수행지 (sourcing 앵커, §G-3.3)
  ADD COLUMN IF NOT EXISTS us_source boolean DEFAULT false;      -- US-source 소득 여부 (1042-S 트리거; 기대값 false)
CREATE INDEX IF NOT EXISTS idx_bookings_balance_txn ON public.bookings(stripe_balance_txn_id) WHERE stripe_balance_txn_id IS NOT NULL;

-- (c) settlements: 통화 + 정산기준(basis) 라벨 + 실제 적용 rate (R1 브리지 핵심)
ALTER TABLE public.settlements
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'usd',
  ADD COLUMN IF NOT EXISTS fee_basis text NOT NULL DEFAULT 'flat_rate'  -- 'flat_rate'(레거시 10%) | 'cost_plus'(원가기준)
    CHECK (fee_basis IN ('flat_rate','cost_plus')),
  ADD COLUMN IF NOT EXISTS platform_fee_rate numeric,    -- flat_rate일 때 적용된 rate(과거=0.10), cost_plus면 NULL
  ADD COLUMN IF NOT EXISTS total_merchant_cost numeric(12,2),    -- cost_plus 집계 합
  ADD COLUMN IF NOT EXISTS total_operational_fee numeric(12,2),  -- cost_plus 마진 합 (= platform_fee와 일치)
  ADD COLUMN IF NOT EXISTS total_usd_amount numeric(12,2);       -- 통화 혼합 방지용 USD 환산 합
ALTER TABLE public.settlement_bookings
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS merchant_cost_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS operational_fee_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS fee_basis text;        -- 행 단위로도 basis 동결(스냅샷 회계 무결성)

-- (d) merchants: 세무 신분 (W-8 / 원천징수 판정 입력)
ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS is_us_person boolean,
  ADD COLUMN IF NOT EXISTS tax_id text,           -- 암호화/마스킹 저장 권장 (PII)
  ADD COLUMN IF NOT EXISTS w8_on_file boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS w8_expiry date;
```
> ⚠️ `tax_id`는 PII·민감정보 → 평문 저장 금지(앱 레벨 암호화 또는 별도 vault). 익명화 RPC(K-7.3) 범위에는 **넣지 않음**(세무 보존 7년 > 90일 스크럽). 대신 접근 통제·감사로 보호.

### G-6.2 RPC v2 — 원가 기준 정산 (`create_merchant_settlement` 교체)
설계 원칙: **(1) 통화를 1정산=1통화로 강제**(F3 혼입 차단), **(2) basis 파라미터로 flat_rate/cost_plus 선택**(과거 호환 + 신규), **(3) cost_plus는 `operational_fee = customer − merchant_cost`**, **(4) merchant_cost 결손 건은 정산 후보에서 제외 + 카운트 반환**(조용한 0원 마진 방지).

```sql
DROP FUNCTION IF EXISTS public.create_merchant_settlement(uuid, date, date, numeric);  -- F2: 기존 시그니처 폐기
CREATE OR REPLACE FUNCTION public.create_merchant_settlement(
  p_merchant_id uuid,
  p_period_start date,
  p_period_end date,
  p_currency text DEFAULT 'usd',                 -- 1정산=1통화 (lower 강제)
  p_fee_basis text DEFAULT 'cost_plus',          -- 신규 기본 = 원가기준
  p_platform_fee_rate numeric DEFAULT 0.10       -- flat_rate일 때만 사용 (레거시 재현용)
) RETURNS public.settlements
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_settlement public.settlements; v_currency text := lower(p_currency);
        v_rev numeric; v_cost numeric; v_fee numeric; v_n int; v_skipped int;
BEGIN
  -- (검증 가드: merchant_id/period/basis/통화/rate 범위 — 기존 22023/P0002 패턴 유지)
  IF p_fee_basis NOT IN ('flat_rate','cost_plus') THEN RAISE EXCEPTION 'invalid fee_basis' USING ERRCODE='22023'; END IF;

  CREATE TEMP TABLE pg_temp.cand ON COMMIT DROP AS
  SELECT b.id, b.final_price, b.merchant_cost, b.currency,
         (b.final_price - b.merchant_cost) AS op_fee
  FROM public.bookings b
  WHERE b.merchant_id = p_merchant_id
    AND b.payment_status='paid' AND b.status='completed' AND b.settlement_status='pending'
    AND lower(b.currency) = v_currency                       -- F3 통화 혼입 차단
    AND b.booking_date BETWEEN p_period_start AND p_period_end
    AND NOT EXISTS (SELECT 1 FROM public.settlement_bookings sb WHERE sb.booking_id=b.id)  -- F4 재정산 차단
    AND (p_fee_basis='flat_rate' OR b.merchant_cost IS NOT NULL)   -- cost_plus는 원가 있는 건만
  FOR UPDATE OF b;

  SELECT count(*) INTO v_skipped FROM public.bookings b
   WHERE b.merchant_id=p_merchant_id AND b.payment_status='paid' AND b.status='completed'
     AND b.settlement_status='pending' AND lower(b.currency)=v_currency
     AND b.booking_date BETWEEN p_period_start AND p_period_end
     AND p_fee_basis='cost_plus' AND b.merchant_cost IS NULL;   -- 원가결손으로 제외된 건 수

  SELECT COALESCE(SUM(final_price),0), COALESCE(SUM(merchant_cost),0),
         CASE WHEN p_fee_basis='flat_rate' THEN ROUND(COALESCE(SUM(final_price),0)*p_platform_fee_rate,2)
              ELSE COALESCE(SUM(op_fee),0) END, count(*)
    INTO v_rev, v_cost, v_fee, v_n FROM pg_temp.cand;
  IF v_n = 0 THEN RAISE EXCEPTION 'no settleable bookings (skipped_missing_cost=%)', v_skipped USING ERRCODE='P0002'; END IF;

  INSERT INTO public.settlements (merchant_id, settlement_period_start, settlement_period_end,
     total_revenue, platform_fee, merchant_payout, total_bookings, status,
     currency, fee_basis, platform_fee_rate, total_merchant_cost, total_operational_fee)
  VALUES (p_merchant_id, p_period_start, p_period_end, v_rev,
     v_fee, (v_rev - v_fee), v_n, 'pending',
     v_currency, p_fee_basis, CASE WHEN p_fee_basis='flat_rate' THEN p_platform_fee_rate END, v_cost, v_fee)
  RETURNING * INTO v_settlement;

  INSERT INTO public.settlement_bookings (settlement_id, booking_id, booking_revenue,
     platform_fee_amount, merchant_payout_amount, currency, merchant_cost_amount, operational_fee_amount, fee_basis)
  SELECT v_settlement.id, id, final_price,
     CASE WHEN p_fee_basis='flat_rate' THEN ROUND(final_price*p_platform_fee_rate,2) ELSE op_fee END,
     CASE WHEN p_fee_basis='flat_rate' THEN ROUND(final_price*(1-p_platform_fee_rate),2) ELSE merchant_cost END,
     v_currency, merchant_cost, op_fee, p_fee_basis
  FROM pg_temp.cand;
  RETURN v_settlement;
END; $$;

-- F2: 신규 시그니처에 GRANT 재발급 (동일 마이그레이션 — 안 하면 service_role도 실행 불가)
REVOKE ALL ON FUNCTION public.create_merchant_settlement(uuid,date,date,text,text,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_merchant_settlement(uuid,date,date,text,text,numeric) TO service_role;
```

### G-6.3 R1 — 과거(10%)/신규(원가기준) 회계기준 공존 브리지
- **핵심 통찰:** `settlement_bookings.UNIQUE(booking_id)` + RPC `NOT EXISTS` 가드 덕분에 **마이그레이션이 과거 정산을 건드릴 필요가 없다.** 과거에 이미 정산된 예약은 새 RPC 후보 쿼리에서 자동 제외되고, 과거 `settlements`/`settlement_bookings` 행은 옛 10% 스냅샷 그대로 **동결**(불변 회계 기록으로 올바름 — 소급 재계산은 회계상 오히려 위험).
- **브리지 = 데이터 재계산이 아니라 "기준 라벨링":** 과거 행에 `fee_basis='flat_rate'`, `platform_fee_rate=0.10`, `currency=<추정>`만 백필 → 리포트가 두 기준을 **합산하지 않고 분리 집계**하게 함. 신규 정산은 `fee_basis='cost_plus'`.
  ```sql
  UPDATE public.settlements SET fee_basis='flat_rate', platform_fee_rate=0.10
    WHERE fee_basis IS DISTINCT FROM 'cost_plus' AND platform_fee_rate IS NULL;
  UPDATE public.settlement_bookings SET fee_basis='flat_rate' WHERE fee_basis IS NULL;
  -- currency 백필: 레거시는 거의 usd. 라이브 대조 후 실제 분포 확인하여 보정(K-0).
  ```
- **기간 straddle(한 정산기간에 과거 정산건 + 신규 미정산건 혼재):** 새 RPC가 미정산 건만 집어가므로 **double-count 불가** — 같은 기간에 cost_plus 정산을 추가 생성하면 과거 flat 정산과 별개 행으로 공존. 리포트는 `(merchant_id, period, fee_basis)`로 그룹.
- **불변식:** 한 booking은 평생 정확히 1개 settlement_bookings 행(UNIQUE) → 기준 전환이 과거 지급액을 변경하지 않음. 머천트 분쟁 방지.

### G-6.4 R2 — RPC 시그니처 변경 배포 동기화 (파손 방지 체크리스트)
1. `DROP FUNCTION (uuid,date,date,numeric)` + `CREATE` 신규 6-arg + `GRANT ... TO service_role` (신규 시그니처) — **한 마이그레이션**.
2. **동일 배포에서** `app/api/settlements/route.ts:110-114` 호출을 신규 파라미터로 갱신(`p_currency`/`p_fee_basis` 전달; 미전달 시 기본 cost_plus·usd). 어드민 정산 운영 화면(§E-5)도 통화·basis 선택 UI 동반.
3. 순서 위험: 마이그레이션 먼저 배포되고 앱이 옛 3-arg를 호출하면 **함수 없음 → 런타임 500.** ∴ 마이그레이션+코드 **원자 배포**(같은 PR/릴리스). 롤백 시 역순.
4. 회귀 테스트: flat_rate 경로가 과거와 **동일 숫자** 산출(골든 테스트)임을 먼저 증명 후 cost_plus 활성화.

### G-6.5 R3 — FX·Stripe fee 백필 (best-effort, 강등)
- **과거 건:** 거래일 환율 저장본 없음 + Stripe `balance_transaction`/`charge_id` 미포착(F6) → **감사급 USD 환산·실수수료 소급 불가.** 과거 KRW 예약의 `usd_amount`/`fx_rate_to_usd`/`stripe_fee`는 **NULL 유지 또는 근사치 + `fx_source='approx'` 플래그**(절대 감사 신뢰 금지).
- **신규 건(전진 포착):** 캡처 시 PaymentIntent를 `expand:['latest_charge.balance_transaction']`로 조회 → `balance_transaction.exchange_rate`(거래일 FX)·`.fee`(실수수료)·`charge.id`·`balance_transaction.id`를 settle 라우트에서 `bookings`에 기록. **이 변경은 Phase 4 settle 라우트 수정과 묶임**(현재 settle은 `amount_received`/`currency`만 읽음 — F6). offline 수금 건은 Stripe 거래 없음 → FX 포착 불가(수기 입력).
- **결론:** "거래일 포착" 백필은 **신규 건부터만 정확**, 과거는 근사·플래그. §G-4 1099-K 대사 리포트는 이 한계를 명시.

### G-6.6 merchant_cost 백필 (§J #6 오픈 입력 의존)
- `bookings.merchant_cost` 소급: 당시 미수집 → **머천트 계약 단가표 기반 수기/스크립트 보정**(tour×인원 또는 계약 단가). §J #6 미해결이면 cost_plus 정산은 **신규 건부터만** 의미(과거는 flat_rate 동결 유지).
- 신규 건: 체크아웃/예약 생성 시 `tours.cost_price × number_of_guests`(또는 빌더 원가 모델)로 `merchant_cost`·`operational_fee` 자동 계산·기록 → 정산 RPC는 읽기만.

### G-6.7 마이그레이션 순서 · 게이트
1. **무해 additive(G-6.1 컬럼·인덱스)** — 언제든 선배포 가능(코드 무의존).
2. **RPC v2 + GRANT + 호출부(G-6.2/R2)** — 원자 배포. flat_rate 골든 테스트 통과 후.
3. **settle 라우트 FX/fee 포착(G-6.5)** — Phase 4 코드 작업.
4. **백필(G-6.3 라벨링 즉시 / G-6.6 원가 = §J #6 후 / G-6.5 FX = 신규만)**.
5. **자동 서류(§G-4)는 절대 여기 포함 금지** — §J #2(소유구조)·CPA SIGN-OFF(§G-5) 게이트 통과 후 Phase 6.
- **신규 오픈 입력 → §J 편입:** (J-8) 1정산=1통화 강제가 머천트 운영과 맞는지(다통화 머천트는 통화별 분리 정산), (J-9) `operational_fee = customer − merchant_cost` 음수(원가 역전) 시 처리 정책, (J-10) `revenue_treatment` 행 단위 기록 시점(예약 생성 vs 정산 vs 결산).

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
6. 🔲 **머천트별 실원가(원가) 소스** — 기존 예약 백필 방법(계약서 단가표 등). (§G-6.6)
7. 🔲 **어드민 디자인 방향성** — 어드민 전용 중립 톤 vs customer amber 계승 정도.
8. 🔲 **1정산=1통화 강제 적합성**(§G-6.7) — 다통화 머천트는 통화별 분리 정산으로 운영 OK인지.
9. 🔲 **원가 역전(operational_fee < 0) 처리 정책**(§G-6.7) — customer < merchant_cost 건 차단/경고/허용.
10. 🔲 **`revenue_treatment` 기록 시점**(§G-6.7) — 예약 생성 vs 정산 vs 결산 중 언제 gross/net 확정.
11. 🔲 **공개 보안 트랙 착수 승인**(§M.4/§N.3) — N11/N13/N14/N16/**N27**(라이브 확정 BLOCKER) 등 어드민과 별개의 즉시 라이브 리스크를 별도 PR로 우선 패치할지 / 어드민 Phase 1과 병행할지. **N27은 REVOKE 한 줄로 즉시 차단 가능.**
12. 🔲 **마이그레이션 정합(§N.1) 착수 승인** — repo `migrations/`가 라이브와 크게 갈림(pending-db-apply 수동 워크플로). `db pull` baseline + 정식화 + CI drift 체크. **Phase 4 정산 마이그레이션의 안전 배포 선행 조건.**
13. 🔲 **RLS-no-policy 13개 테이블 의도 확인**(§N.3 N31) — service_role 전용 의도면 정상, user-readable 의도면 정책 누락.
14. 🔴🔲 **P1 권한상승 즉시 패치 승인(§T.1, 라이브 확정)** — `user_profiles` UPDATE/INSERT RLS에 role `WITH CHECK` 추가. **전 항목 최우선**(고객이 직접 admin 자기승격 가능). 마이그레이션 1줄. 다른 결정과 무관하게 **지금 바로** 권고.
15. 🔲 **`app/dashboard/**` 정체·존속 결정**(§U.0.1) — 미상 4페이지 포털, 레거시 폐기 vs 흡수.
16. 🔲 **다크모드 도입 범위**(§U.1) — 어드민 전용 vs 전사.
17. 🔲 **통합 인박스(`/admin/inbox`) 확정**(§U.2/§E-4) — contacts/emails/support 3페이지 대체 여부.

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

## K-0. 라이브 DB 검증 한계 → ✅ 해소 (2026-06-24, §N 참조)
- ~~이 세션의 Supabase MCP는 다른 프로젝트(Kursoflow)에 연결~~ → **정정/해소:** `~/.claude.json` mcpServers에 **`atockorea` 서버가 올바른 project_ref(`cghyvbwmijqpahnoduyv`)로 이미 구성**돼 있었음. 이전 세션이 `mcp__atockorea__*` 도구를 안 썼을 뿐. 설정 변경 불필요.
- **§N에서 라이브 직접 검증 완료**(테이블 70개·RPC·제약·트리거·정책·advisor). 미검증 잔여 없음. `payments`는 **라이브 부재로 확정**(§N.4), N1 함수는 **라이브 실재**(§N.2 — 진짜 문제는 repo 드리프트 §N.1).
- (역사 보존) 1차~0.7 단계의 DB 주장은 repo 마이그레이션 기준이었고, §N에서 라이브와 대조해 대부분 확정·일부 재분류(N1).

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

---

# §K-7. §E/§F 기능 설계 사양 (DDL + 이벤트 taxonomy, 2026-06-24)

> §K-5 ② 수행. 실제 마이그레이션/스키마와 대조해 충돌 없는 구체 DDL·이벤트 정의로 정밀화. **모든 마이그레이션은 additive(`ADD COLUMN IF NOT EXISTS`/`CREATE ... IF NOT EXISTS`)**. 라이브 DB 미연결이므로 배포 전 K-0 대조 필수.

## K-7.0 검증된 기준 사실 (DDL 근거)
- `analytics_events`: `event_name`는 **free-form**(`z.string().min(1).max(128)`, 인제스트 `app/api/analytics/events/route.ts:44`) — **신규 이벤트명 등록 불필요**. `payload`는 flat key→scalar(`z.record(union(string,number,boolean,null))`) + 서버 `scrubPayload` PII 드롭리스트. 신규 payload 필드는 평면 스칼라면 자동 흐름.
- `analytics_funnels(key,name,description,steps jsonb,conversion_window_seconds default 1800)`; step 형태: `{"event_name","filter": {...}|null,"label"}`, filter 연산자 예 `page_path`/`page_path_like`/`source`/`phase`.
- matview 패턴(`analytics_events_daily`): `WHERE anonymized_at IS NULL AND server_ts >= now()-'90 days'` + `GROUP BY` + UNIQUE index(동시 refresh). refresh는 cron `analytics-refresh-views`.
- `contact_inquiries`(archive `contact-inquiries-schema.sql`): id·full_name·email·subject·message·booking_reference·tour_date·phone_whatsapp·attachment_urls·status(new/in_progress/resolved/closed)·is_read·admin_notes·privacy_consent·created_at·updated_at.
- `audit_logs`(archive): id·user_id(→auth.users)·action·resource_type·resource_id(uuid)·details jsonb·ip_address inet·user_agent·created_at + 인덱스 4개. **이미 존재, 컬럼 추가 불필요.**
- `bookings` 현존 컬럼: 기본 + payment_intent_id·setup_intent_id·stripe_customer_id·stripe_payment_method_id·payment_intent_status·authorization_expires_at·no_show_fee_usd_cents·card_collection_method·**currency('usd')·source('tour_product')·itinerary jsonb**. **부재(신설 대상):** anonymous_id·session_id·utm_*·referrer·landing_path + (§G) merchant_cost·operational_fee·fx_rate_to_usd·usd_amount·stripe_charge_id·stripe_balance_txn_id·stripe_fee·revenue_treatment·place_of_performance·us_source.
- N1 재확인: `anonymize_old_analytics`·`analytics_health_snapshot` CREATE FUNCTION **마이그레이션에 없음** → Phase 5에서 신설.

## K-7.1 `quote_drafts` — 견적/빌더 진행 + 이탈 추적 (Phase 4)
```sql
CREATE TABLE IF NOT EXISTS public.quote_drafts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  anonymous_id text NOT NULL,                 -- analytics 쿠키와 동일 (세션 join 키)
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id text,
  region text, track text,                    -- private/cruise/dmz 등
  poi_keys text[] DEFAULT '{}',
  party_size integer, requested_date date,
  intake jsonb DEFAULT '{}'::jsonb,           -- 연락처/메모 (PII 가능 → 익명화 대상)
  last_stage text NOT NULL DEFAULT 'started'  -- started|poi_added|quote_modal|intake|price_shown|abandoned|converted
    CHECK (last_stage IN ('started','poi_added','quote_modal','intake','price_shown','abandoned','converted')),
  price_shown_krw integer,
  converted_booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  abandoned_at timestamptz,
  anonymized_at timestamptz,                  -- 90일 익명화 (intake/anonymous_id 스크럽)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_quote_drafts_anon ON public.quote_drafts(anonymous_id);
CREATE INDEX IF NOT EXISTS idx_quote_drafts_stage ON public.quote_drafts(last_stage);
CREATE INDEX IF NOT EXISTS idx_quote_drafts_created ON public.quote_drafts(created_at DESC);
ALTER TABLE public.quote_drafts ENABLE ROW LEVEL SECURITY;  -- write=service_role, read=admin (analytics 패턴 동일)
```
- 빌더 진행 시 `anonymous_id` 기준 upsert로 `last_stage` 전진. `converted_booking_id` 채워지면 전환. **`tour_quote_requests`(write-blocked, 은퇴)와 별개** — 그 테이블은 건드리지 않음.
- 어드민 "견적 요청" 탭: `last_stage` 깔때기 + 미전환(`abandoned`/`intake`) 드래프트에 연락처 있으면 follow-up. retention: `intake`/`anonymous_id`는 K-7.3 익명화 RPC 범위에 포함.

## K-7.2 빌더 스테이지 이벤트 taxonomy + funnel (Phase 5)
신규 이벤트(기존 `itinerary_*` 컨벤션 준수, payload는 평면 스칼라):
| event_name | payload(예) | 비고 |
|---|---|---|
| `itinerary_builder_poi_added` | `{region, track, poi_key, poi_count}` | 담기 |
| `itinerary_builder_poi_removed` | `{region, poi_key, poi_count}` | |
| `itinerary_builder_quote_modal_opened` | `{region, track, poi_count}` | 견적 모달 |
| `itinerary_builder_intake_submitted` | `{region, track, party_size}` | 연락처 입력(본문 미저장) |
| `itinerary_builder_price_shown` | `{region, track, price_krw}` | 가격 노출 |
| `itinerary_builder_abandoned` | `{region, last_stage, poi_count}` | beforeunload/sendBeacon |
- `itinerary_builder_booking_submitted`(기존)을 `CONVERSION_EVENT_NAMES`에 추가할지 검토(세션 converted 반영). funnel 시드 1행:
```sql
INSERT INTO public.analytics_funnels (key,name,description,steps) VALUES
('builder_quote_funnel','빌더 견적 펀널',
 'build start → poi add → quote modal → intake → price shown → booking',
 '[{"event_name":"unified_planner_build_start","filter":null,"label":"빌드 시작"},
   {"event_name":"itinerary_builder_poi_added","filter":null,"label":"POI 담기"},
   {"event_name":"itinerary_builder_quote_modal_opened","filter":null,"label":"견적 모달"},
   {"event_name":"itinerary_builder_intake_submitted","filter":null,"label":"인테이크"},
   {"event_name":"itinerary_builder_price_shown","filter":null,"label":"가격 노출"},
   {"event_name":"itinerary_builder_booking_submitted","filter":null,"label":"예약 제출"}]'::jsonb)
ON CONFLICT (key) DO NOTHING;
```

## K-7.3 귀속 FK + 익명화 정합 (Phase 4 — R4/N1 동시 해결)
```sql
-- 주문/문의/티켓에 first-touch 귀속 비정규화 (체크아웃/제출 시 SDK 쿠키에서 set)
ALTER TABLE public.bookings        ADD COLUMN IF NOT EXISTS anonymous_id text,
  ADD COLUMN IF NOT EXISTS attribution_session_id text,
  ADD COLUMN IF NOT EXISTS utm_source text, ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text, ADD COLUMN IF NOT EXISTS referrer text,
  ADD COLUMN IF NOT EXISTS landing_path text;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS anonymous_id text,
  ADD COLUMN IF NOT EXISTS utm_source text, ADD COLUMN IF NOT EXISTS referrer text, ADD COLUMN IF NOT EXISTS landing_path text;
ALTER TABLE public.contact_inquiries ADD COLUMN IF NOT EXISTS anonymous_id text,
  ADD COLUMN IF NOT EXISTS utm_source text, ADD COLUMN IF NOT EXISTS referrer text, ADD COLUMN IF NOT EXISTS landing_path text;
```
- **R4 정합 규칙(중요):** `bookings`는 세무상 ≥7년 보존(§G) → 90일 익명화로 행 삭제 불가. 따라서 익명화 RPC가 이 컬럼들에서 **`anonymous_id`는 해시·`referrer`는 NULL(쿼리스트링 PII 가능)** 처리하되 **`utm_*`/`landing_path`(비PII)는 보존**. `support_tickets`/`contact_inquiries`/`quote_drafts.intake`도 동일 스크럽 범위에 추가.
- **N1 해결:** `anonymize_old_analytics()` RPC를 **신설**(현재 cron이 호출하나 정의 없음)하고 위 신규 컬럼 + analytics 테이블을 한 함수에서 스크럽. `analytics_health_snapshot()`도 동일 마이그레이션에서 신설(§D-15). 배포 체크(U4)로 "호출되나 미정의 RPC" 재발 방지.

## K-7.4 `audit_logs` 채택 (Phase 4 — 테이블 재사용, 헬퍼 신설)
- 헬퍼 `lib/admin/audit.ts`: `logAdminAction({ userId, action, resourceType, resourceId, details, ip, userAgent })` → 기존 insert 형태(`merchants/create/route.ts:129`)와 동일 컬럼. service-role로 best-effort(실패해도 주 작업 비차단), 단 **실패 시 console.error + 알림**.
- 의무 적용 라우트(현재 2곳 → 전 mutation): orders status/settle, 환불, settlements 생성, support 답장, tour/product 편집, merchant 생성/수정/정지, settings 변경, qa-pairs 승인/거부. `details`에 before/after diff(jsonb).
- 어드민 "활동 기록" 화면: actor·action·resource·diff 펼치기 + 날짜/액션/actor 필터(`audit_logs` 인덱스 이미 존재).

## K-7.5 `unified_inquiries` 통합 인박스 뷰 (Phase 4)
```sql
CREATE OR REPLACE VIEW public.unified_inquiries AS
  SELECT 'contact'::text AS source, ci.id, ci.full_name AS contact_name, ci.email AS contact_email,
         ci.subject AS title, ci.status, ci.is_read, NULL::text AS category, ci.created_at
    FROM public.contact_inquiries ci
  UNION ALL
  SELECT 'email', re.id, re.from_name, re.from_email, re.subject,
         CASE WHEN re.is_archived THEN 'archived' ELSE 'open' END, re.is_read, re.category, re.received_at
    FROM public.received_emails re
  UNION ALL
  SELECT 'ticket', st.id, NULL, NULL, st.initial_summary, st.status,
         (st.unread_for_admin > 0), st.escalation_reason, st.created_at
    FROM public.support_tickets st;
```
- 어드민 단일 인박스: source 칩(contact/email/ticket) + 카테고리 칩 + **날짜 그룹 + 접기/펼치기** + 검색. 미처리 배지 = 대시보드 D-1 하드코딩 0 대체(`SELECT count(*) ... WHERE is_read=false/status='new'/unread_for_admin>0`). (정렬/페이지네이션은 뷰 위 쿼리에서; 대량 시 matview 전환.)
- 주의: 컬럼명은 K-7.0 확인값 기준. `received_emails.from_name`/`category`/`received_at`, `support_tickets.initial_summary`/`unread_for_admin`/`escalation_reason` 실재 확인 후 배포(K-0).

## K-7.6 상품별 funnel matview + slug 표준화 (Phase 5)
- **선행:** product-funnel 이벤트에 `slug`(또는 `product_id`) **평면 필드 표준 부착** — 현재 `home_featured_card_click{slug}`만 보유, `detail_viewed`/`checkout_started`/`booking_confirmed`는 비일관. SDK 호출부에 `slug` 추가.
- matview(events_daily 패턴 mirror):
```sql
CREATE MATERIALIZED VIEW IF NOT EXISTS public.analytics_product_funnel_daily AS
SELECT date_trunc('day', server_ts) AS day,
       (payload->>'slug') AS slug,
       count(*) FILTER (WHERE event_name='product_impression')      AS impressions,
       count(*) FILTER (WHERE event_name='home_featured_card_click') AS card_clicks,
       count(*) FILTER (WHERE event_name='detail_viewed')           AS detail_views,
       count(*) FILTER (WHERE event_name='checkout_started')        AS checkouts,
       count(*) FILTER (WHERE event_name='booking_confirmed')       AS conversions,
       count(DISTINCT session_id)                                   AS sessions
FROM public.analytics_events
WHERE anonymized_at IS NULL AND server_ts >= now()-interval '90 days'
  AND (payload ? 'slug')
GROUP BY 1,2;
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_funnel_daily_unique ON public.analytics_product_funnel_daily(day, slug);
```
- bounce rate = 상품 상세 단일-페이지 세션 비율(별도 세션 파생). refresh를 기존 `analytics-refresh-views` cron에 추가. 신규 이벤트 `product_impression`(노출, payload `{slug, position}`) 신설.

## K-7.7 마이그레이션 순서·백필·오픈
1. 순서: (a) quote_drafts/attribution ALTER/audit 무관 additive → 언제든. (b) `anonymize_old_analytics`·`analytics_health_snapshot` RPC 신설은 cron 의존이라 **우선**. (c) product-funnel matview는 slug 이벤트 표준화 배포 후 데이터 쌓이면 의미.
2. 백필: 과거 bookings 귀속(utm/anonymous_id)은 **소급 불가**(당시 미수집) — 신규 건부터. quote_drafts도 신규부터.
3. 오픈: `CONVERSION_EVENT_NAMES`에 builder 이벤트 추가 여부; unified_inquiries 대량 시 matview 전환 임계; product_impression 노출 정의(viewport 진입 기준).

---

# §M. Codex 플랜 리뷰 통합 — 전체 스택 인접범위 감사 (2026-06-24, Phase 0.8)

> **경위:** 외부 "Codex" 에이전트가 별도 통합 감사 문서(`atockorea-full-stack-deep-audit-2026-06-24.md`) 생성을 제안하며 공개 커머스·API 보안·DB 드리프트·성능·RAG 등 **어드민 범위 밖 신규 주장 다수**를 제기. 본 세션 판단으로 **별도 문서는 생성하지 않음**(아래 §M.0 근거 — 단일 SoT 원칙). 대신 Codex 주장 중 가치 있는 항목을 **3개 독립 코드감사 에이전트로 file:line 직접 검증**(CONFIRMED/REFUTED/IMPRECISE)한 뒤, 검증된 것만 이 플랜에 편입. **Codex 주장은 그 자체로 사실이 아니며**, 아래 검증 verdict가 진실 기준.

## M.0 메타 판단 — Codex 리뷰의 가치와 처리 방침
| 판단 | 내용 |
|---|---|
| **가치 있음** | Codex는 **어드민 범위 밖**(공개 커머스·공개 API 보안·인프라 config)의 실재 BLOCKER 보안결함 다수를 정확히 포착. 이 플랜이 `app/admin/**`에 집중해 놓친 영역. → 검증 후 §M에 보존. |
| **신뢰 불가(그대로 반영 금지)** | Codex 주장의 **상당수가 부정확/과장/STALE**. 검증 결과 21개 중 **REFUTED 2 + IMPRECISE 6**. 특히 "RAG 미연결"은 완전 오류(실제 완전 연결·활성). 무검증 인용은 플랜 철칙(§K) 위반 → **전수 file:line 재검증 후 편입**. |
| **별도 문서 생성 거부** | Codex가 제안한 `atockorea-full-stack-deep-audit-2026-06-24.md` **생성 안 함.** 근거: §0 "이 문서가 어드민 개편의 **유일한** 실행 기준" — 경쟁 문서는 SoT 분열. 인접범위 보안은 §M에 **레지스터로 기록 + 별도 보안 하드닝 트랙으로 분리**(어드민 Phase 1~8과 독립). |
| **범위 경계** | 공개 커머스/인증/인프라 결함은 **어드민 대시보드 개편 Phase가 아님** → "🔒 보안 트랙(별도 PR)"로 태깅. 어드민 범위와 겹치는 것(overfetch·notifications 드리프트·analytics cron·webhook)만 기존 Phase에 매핑. |

## M.1 검증 결과 통합 (3 감사 에이전트, file:line 직접 대조)
심각도: 🔴 BLOCKER · 🟠 MAJOR · 🟡 MINOR/NOTE. 트랙: 🔒=공개 보안(별도) · ⚙️=어드민/인프라(기존 Phase).

| ID | Verdict | 심각도/트랙 | 결함 (검증된 정확한 메커니즘) | 증거 file:line |
|---|---|---|---|---|
| **N11** | CONFIRMED | 🔴🔒 | `/api/inventory` (GET/POST) + `/api/inventory/[id]` (GET/PUT) **인증 0건** — 첫 줄부터 service-role 클라이언트. 익명 누구나 재고 생성/덮어쓰기(RLS 우회). | `inventory/route.ts:10-198`, `[id]/route.ts:8-117` |
| **N12** | CONFIRMED | 🟡🔒 | `cart_items` **TS 타입(`lib/supabase.ts:234-249`)이 SQL과 불일치** — `booking_date`/`number_of_guests` 누락, `quantity` vs `number_of_guests`. 코드는 SQL 실컬럼 사용(런타임 동작은 함, 타입 안전성만 깨짐). *(Codex "live schema 불일치"는 과장 — 타입 드리프트.)* | `lib/supabase.ts:234-249` vs archive `:404-418`, `cart/route.ts:134,141-191` |
| **N13** | CONFIRMED | 🔴🔒 | `/api/promo-codes` **GET(전체 목록)·POST(생성) 인증 없음**(코드 주석이 "admin only - add auth check if needed"로 누락 자인). validate도 무인증. → 누구나 프로모코드 생성·열람. *(Codex "coupon-apply GET/필드 불일치"는 부정확 — validate는 POST, 필드 일치.)* | `promo-codes/route.ts:8-92,98-190`, `validate/route.ts:8` |
| **N14** | CONFIRMED | 🔴🔒 | `/api/stripe/checkout`가 **공개 `bookingId`를 소유권 검증 없이 신뢰** → 기존 PI/SI를 무조건 cancel(`:163-176`). 유효 UUID 아는 자가 **타인 예약의 결제 hold 취소**(IDOR). | `stripe/checkout/route.ts:58,97,163-176` |
| **N15** | CONFIRMED | 🟠🔒 | 예약 생성이 **non-atomic read-then-write**(FOR UPDATE/트랜잭션 없음): 재고 조회→앱에서 잔여 계산→insert→별도 재고 update(에러 무음 흡수) → **동시요청 oversell**(TOCTOU). | `bookings/route.ts:219-250,369,394-423` |
| **N16** | CONFIRMED | 🔴🔒 | `confirm-email`의 `accessToken`이 **선택적** — 생략하면 소유권 가드(`if(accessToken&&…)`)를 건너뛰고 바로 `auth.admin.updateUserById(userId,{email_confirm:true})` → **임의 userId 이메일 확인**(IDOR). *(Codex "토큰 전혀 불요"는 약간 과장 — 정확히는 토큰 생략 시 우회.)* | `auth/confirm-email/route.ts:16-30` |
| **N17** | CONFIRMED | 🟠🔒 | 공개 `/api/upload`은 **인증 요구됨**(`:71-83`, anon 아님 — Codex 오류) BUT (1) `file.type`만 검사·**매직바이트 sniff 없음**(`:99-103`), (2) DELETE `bucket` 파라미터 **화이트리스트 없음**(`:239`) → 인증유저가 타 버킷 삭제 시도(IDOR). | `upload/route.ts:71-83,99-103,234-255` |
| **N18** | CONFIRMED | 🟠🔒 | LINE OAuth: **static state `'line_oauth_state'`**(`:48`, CSRF 무방비) + **id_token 서명 미검증**(base64 디코드만, 주석이 자인 `:124-132`) + **magic-link URL을 API 응답 본문에 반환**(`:251`). | `auth/line/route.ts:48,124-132,251` |
| **N19** | CONFIRMED | 🟠🔒 | `/api/maps/static`이 **raw 쿼리스트링 전체를 Google에 그대로 전달**(`:16,25`), 인증·rate-limit·파라미터 화이트리스트 전무 → 누구나 앱 키로 고비용 요청 남발(빌링 남용). | `maps/static/route.ts:16,22,25` |
| **N20** | CONFIRMED | 🟠🔒 | `next.config.js`에 **`headers()` 함수 부재** — CSP/X-Frame-Options/HSTS/X-Content-Type-Options/Permissions-Policy 전무. | `next.config.js:7-245` |
| **N21** | CONFIRMED | 🟡🔒 | `middleware.ts` matcher가 **`/api` 전체 제외**(`:379` `['/((?!_next|api|.*\\..*).*)']`) → 미들웨어 보호가 API 라우트에 미적용(각 라우트가 자체 가드 책임). | `middleware.ts:253-258,379` |
| **N22** | IMPRECISE | 🟠⚙️ | analytics 인제스트는 **Zod 스키마+봇필터+PII 스크럽 방어 존재**(Codex가 축소) BUT **rate-limit·origin 체크 없음** → 위조 이벤트 poisoning 가능(형태는 Zod로 제한). | `analytics/events/route.ts:62-83,96-98,123-129` |
| **N23** | CONFIRMED | 🔴⚙️ | analytics cron **fail-open**: `if(!secret) return true`(`analytics-anonymize:15-23`, refresh-views 동일) → `CRON_SECRET` 미설정/회전 시 **누구나 비가역 익명화 트리거**. N1(미배포 RPC)과 결합 시 더 위험. | `cron/analytics-anonymize/route.ts:15-23`, `analytics-refresh-views:11-19` |
| **N24** | CONFIRMED | 🟠⚙️ | Resend 웹훅 **비멱등**: `received_emails`는 `message_id` 중복 시 200 조기반환(`:201-202`) → 1차에 `contact_inquiries` insert 실패(`:212,222-228`) 후 재시도 시 **문의가 영구 유실**(early-return이 inquiry insert 전). | `webhooks/resend/route.ts:193,201-202,212,222-228` |
| **N25** | CONFIRMED | 🟠⚙️ | `notifications` 테이블이 **코드 7곳 참조**(`api/notifications/**`, `lib/notifications.ts:37`)하나 **migrations에 CREATE 없음**(archive `notifications-schema.sql`만 — 미승격). N1·`analytics_health_snapshot`와 **동일 드리프트 부류** → migration-only 리셋 시 알림기능 파손. §E-5 알림센터의 전제. | `api/notifications/route.ts:29,52,115`, `lib/notifications.ts:37`, migrations grep 0건 |
| **N26** | CONFIRMED(부분) | 🟠⚙️ | admin orders `select('*')` 최대 **5만행**+JS측 조인 조립(`orders/route.ts:35,69-118`) = §D-2/§I 재확인. *(단 stats route는 대부분 `count head:true`로 효율적, revenue만 3컬럼 JS reduce — Codex "stats 대량 select" 과장.)* | `admin/orders/route.ts:35,69-118`, `admin/stats/route.ts:21-64` |
| **R5** | REFUTED | — | ❌ Codex "RAG/`knowledge_chunks`/`chat_feedback`/`chat_memory`가 챗봇 경로에 미연결"은 **오류**. 실제 메인 챗봇(`tour-product/assistant/route.ts`)이 하이브리드 RAG 검색(`retrieveKnowledge` `:722-734`, `match_knowledge_chunks`+`keyword_knowledge_chunks` RRF)·`chat_memory` 읽기(`:710-712`)·쓰기(`:1004-1013`) **완전 연결·활성**(kill switch `CHAT_RAG=0`만 옵션). 프로젝트 메모리 PR #139~143과 일치. | `assistant/route.ts:36-40,57-58,710-734,1004-1013`, `lib/rag/retrieve`, `lib/chatbot/sessionMemory:63` |
| **R6** | REFUTED | — | ❌ Codex "review 업로드가 존재하지 않는 `reviews` 버킷 사용"은 **오류**. `REVIEW_FOLDER='reviews'`는 **버킷이 아니라 폴더 프리픽스** — 실제 업로드는 `type='product'`→**`tour-images` 버킷**(실재, `storage-setup.sql:15-26`). `reviews` 버킷 참조 코드 0건. | `lib/review-upload-client.ts:4,37`, `upload/route.ts:93` |

## M.2 성능 관찰 (Codex 제기 — 정밀 정정, Phase 5/별도 perf 트랙)
| ID | Verdict | 정밀 사실 | 처리 |
|---|---|---|---|
| P1 | IMPRECISE | tours-list **SSR preload + 클라 `no-store` refetch** 이중요청은 실재하나 **의도적 회복탄력 패턴**(SSR 실패 삼키고 클라 재요청, 첫 렌더 flash 없음·`initialMediaBySlug`로 초기화). | perf 최적화 후보(첫 로드 시 클라 fetch 단락). 버그 아님. `tours/list/page.tsx:19,33`, `useTourProductCardMedia.ts:41-58` |
| P2 | IMPRECISE | `tour-product-card-media`는 `force-dynamic`+`no-store`이나 **요청당 2쿼리(2N 아님)** — `.in("slug", uniqueSlugs)` 배치(최대 160 slug 1요청). Codex "slug당 2쿼리"는 오류. | 캐시 도입 여지(force-dynamic 완화). `route.ts:5-6`, `resolveTourProductCardMedia.server.ts:87-96` |
| P3 | IMPRECISE | builder POI payload는 **~100-400KB/지역 추정**(1MB+ 아님 — Codex 과장). `content_locales` 6-locale JSONB가 지배적. `force-dynamic`·무압축. | 압축/컬럼 슬림/캐시 후보. `itinerary-builder/pois/route.ts:37`, `poi_kb json 296KB` |

## M.3 플랜 편입 결정
1. **🔒 공개 보안 트랙 신설(별도, 어드민 Phase와 독립):** N11·N13·N14·N16·**N27**(BLOCKER) + N15·N17·N18·N19·N20·N12·N21·**N28·N29·N30**(MAJOR/MINOR). **어드민 대시보드 개편과 무관하나 라이브 서비스의 즉시 리스크** → 사용자에게 **별도 보안 하드닝 PR 트랙**으로 분리 권고(이 플랜의 Phase 1~8에 섞지 않음 — 범위·배포 단위 상이). §J에 게이트로 등재. **N27(라이브 확정, §N.3)은 DB 한 줄 REVOKE로 즉시 차단 가능 — 최우선.**
2. **⚙️ 어드민/인프라 — 기존 Phase 매핑:**
   - N23(cron fail-open) → **Phase 1 BLOCKER 추가**(N1·N2와 같은 "미배포/페일오픈 인프라" 묶음, U4 배포 게이트 확장).
   - N25(notifications 드리프트) → **Phase 4** 스키마 정합(N1 RPC 신설과 동일 마이그레이션 부류) + §E-5 알림센터 선행.
   - N24(Resend 웹훅 비멱등) → **Phase 4/7** §E-4 통합 인박스의 데이터 무결성 선행(문의 유실 차단).
   - N22(analytics poisoning) → **Phase 5** §F-1 엔진 정합과 함께(rate-limit·origin).
   - N26(admin overfetch) → 기존 §D-2·§I에 이미 포함 — 재확인만.
   - P1·P2·P3(perf) → **Phase 5/별도 perf 트랙**(perf/site-load-tier1 브랜치 계열과 조율).
3. **정정 로그(숨기지 않음):** Codex 21개 주장 중 **REFUTED 2(R5 RAG·R6 reviews버킷) + IMPRECISE 6(N12·N16·N17·N22·N26 + P1/P2/P3 과장)**. 무검증 인용 금지 원칙(§K) 준수 — verdict가 사실 기준.

## M.4 신규 오픈 입력 (§J 편입)
- **J-11 🔲 공개 보안 트랙 착수 승인** — N11/N13/N14/N16 등은 어드민 개편과 별개의 **즉시 라이브 리스크**. 별도 PR로 우선 패치할지, 어드민 Phase 1과 병행할지 사용자 결정 필요.

---

# §N. 라이브 DB 대조 결과 (K-0 해소, Phase 0.9 — 2026-06-24)

> §K-5 ④ 수행. **atockorea Supabase MCP가 라이브 연결됨**(project_ref `cghyvbwmijqpahnoduyv`, URL `https://cghyvbwmijqpahnoduyv.supabase.co`) — K-0의 "MCP 미연결" 한계 **해소**. 이전 세션은 `mcp__atockorea__*` 도구를 안 썼을 뿐, 설정은 이미 올바름(`~/.claude.json` mcpServers.atockorea, project_ref 정확). 이하 모든 주장은 **라이브 DB 직접 쿼리 + Supabase advisor 린트**로 검증.

## N.0 연결·도구
- 도구: `mcp__atockorea__{get_project_url,list_tables,execute_sql,list_migrations,get_advisors}`. 읽기 전용 조회만 수행(스키마 변경 0). 라이브 테이블 70개 확인(bookings 7행·tours 34·chat_messages 1382·analytics_events 3132·knowledge_chunks 2193 등).

## N.1 ⚠️ 마이그레이션 드리프트 — repo ≠ live (BLOCKER급 거버넌스 결함, 신규)
- **사실:** 라이브 마이그레이션 48개 vs repo `supabase/migrations/` 32개 중 **버전 일치 ~9개뿐.** repo는 라운드 타임스탬프(`…120000`/`…100000`/`…000000`), 라이브는 정밀(`…075806`/`…153016`). **라이브 전용 39개**(예: `analytics_maintenance_functions`·`anonymize_use_builtin_sha256`·`security_rls_hardening`·`function_search_path_hardening`·`agent_reservations`·`agent_channel_events`·`creative_studio_*`·`chatbot_rag_*`·`create_chat_memory`·`chat_feedback`)가 repo `migrations/`에 **없음**. repo 전용 23개는 라이브에 다른 버전으로 존재하거나 부재.
- **원인:** `supabase/pending-db-apply/`(수동 SQL 스테이징, 예 `2026-06-24-08-agent-reservations.sql`·`-10-agent-channel-events.sql`가 라이브 전용 마이그레이션과 일치) + `supabase/manual/`로 **수기 적용** → 라이브 마이그레이션 히스토리만 갱신되고 repo `migrations/`는 미동기. `create_analytics_schema`는 repo `20260517140000` vs 라이브 `20260517062504`로 **버전·내용 모두 갈림**.
- **함의(왜 BLOCKER급):** repo `migrations/`로 `supabase db reset`/CI/신규 환경 재현 시 **라이브와 다른 스키마 생성**(라이브 전용 39개 누락) → N1류 "코드는 호출하나 함수/테이블 없음"이 **재현 환경에서만 폭발**. `db push`는 버전 불일치로 전량 재적용 시도 위험. **repo는 라이브 스키마의 신뢰 가능한 SoT가 아님.**
- **Phase 매핑:** Phase 0(데이터) 선행 과제로 **마이그레이션 정합(reconciliation)** 추가 — 라이브 스키마를 `supabase db pull`로 baseline 스냅샷화 + pending-db-apply 워크플로를 정식 마이그레이션으로 흡수 + CI drift 체크(U4 확장). **이게 안 되면 Phase 4 정산 마이그레이션도 안전 배포 불가.**

## N.2 N1 재정의 — REFUTED(라이브) → 드리프트로 재분류
- `anonymize_old_analytics(retention_days integer DEFAULT 90)`·`analytics_health_snapshot()`·`refresh_analytics_materialized_views()` **모두 라이브 실재**(SECURITY DEFINER). cron/health 라우트 호출명·인자 **일치**(cron은 `rpc('anonymize_old_analytics',{...})`, 기본값 90 → 인자 생략도 동작). ∴ **프로덕션에서 500 안 남** — 플랜 N1의 "미배포 → 무음 500"은 **라이브 기준 틀림**.
- **단, repo `migrations/`엔 이 함수들의 CREATE가 없음**(§N.1) → N1의 본질은 "미배포"가 아니라 **repo 드리프트**(재현 환경에서만 부재). N1을 **§N.1 드리프트 항목으로 재분류**, 심각도는 유지(재현·CI 리스크).

## N.3 🔴 신규 라이브 보안 결함 (Supabase advisor + 직접 확인)
| ID | 심각도 | 결함 | 증거 |
|---|---|---|---|
| **N27** | 🔴 BLOCKER | `anonymize_old_analytics`·`refresh_analytics_materialized_views`·`analytics_health_snapshot`의 EXECUTE가 **PUBLIC·anon·authenticated에 부여** → **누구나 REST `/rest/v1/rpc/anonymize_old_analytics` 직접 호출로 비가역 PII 익명화/매트뷰 강제refresh DoS**. N23(cron fail-open)보다 심각 — cron 시크릿과 무관하게 DB-레벨에서 노출. **정산 RPC(`create_merchant_settlement`)는 `service_role`+`postgres`로 정확히 REVOKE됨** — 같은 패턴을 analytics 함수에 미적용한 누락. | advisor `anon_security_definer_function_executable` + `routine_privileges` grantee=PUBLIC/anon/authenticated. 정산 grant=service_role/postgres만 |
| **N28** | 🟠 MAJOR | `contact_inquiries` INSERT 정책 `"Anyone can create contact inquiries"` **WITH CHECK (true)**(anon/authenticated) → DB-레벨 무제한 문의 생성(스팸/poisoning). SELECT/UPDATE는 admin-only(정상). 공개 폼 자체는 정상이나 **rate-limit·검증이 앱 레벨에만** 의존. | advisor `rls_policy_always_true` + pg_policies |
| **N29** | 🟠 MAJOR | 매트뷰 `analytics_sessions_daily`·`analytics_events_daily`가 **anon/authenticated에 SELECT 노출**(Data API) → 집계 분석 데이터 공개 열람 가능. | advisor `materialized_view_in_api` |
| **N30** | 🟡 MINOR | public 버킷 `product-images`·`tour-gallery`·`tour-images`가 **broad SELECT 정책으로 전체 파일 리스팅 허용**(객체 URL 접근엔 불필요). 파일 열거 노출. | advisor `public_bucket_allows_listing` |
| **N31** | 🟡 INFO | RLS enabled·**정책 0개** 테이블 13개(`agent_channel_events`·`agent_reservations`·`chat_feedback`·`chat_memory`·`knowledge_chunks`·`verification_codes`·`tour_rooms`·`tour_room_messages`·`tour_audio_assets`·`tour_content_jobs`·`tour_generated_courses`·`tour_room_spot_events`·`tour_room_messages`). service_role 전용이면 정상(의도)이나, user-readable 의도면 깨진 것 → 의도 확인 필요. | advisor `rls_enabled_no_policy` |
| **N32** | 🟡 WARN | 하드닝 잔여: `function_search_path_mutable` 2개(`tg_*_set_updated_at`), `extension_in_public`(`vector`·`pg_trgm`), Auth `leaked_password_protection` 비활성. | advisor |

> N27은 §M의 N23(cron route fail-open)과 **합산 시 동일 표면의 2중 노출** — 앱 라우트와 DB RPC 양쪽 다 무방비. 수정: 두 analytics maintenance 함수에 `REVOKE EXECUTE FROM PUBLIC, anon, authenticated` + cron route 시크릿 강제(N23). **공개 보안 트랙(§M.3)에 N27 BLOCKER 추가.**

## N.4 §G-6 정산/세무 DDL 라이브 정합 (충돌 0 — 안전)
- **라이브 컬럼 대조(F1~F8 라이브 검증):**
  - `bookings`: `currency`(default `'usd'` 소문자, NOT NULL)·`source`·`itinerary` **실재**(+ 라이브 추가분 `tax_amount`·`promo_code`·`promo_discount`·`paid_at`·`preferred_language`·`booking_reference`·`number_of_people` — archive보다 풍부). **§G-6.1 신규 11컬럼은 전부 부재** → `ADD COLUMN IF NOT EXISTS` 충돌 없음. ✓
  - `settlements` 컬럼 = archive와 동일(currency/fee_basis/basis 컬럼 **부재**) → §G-6.1(c) 충돌 없음. ✓
  - `settlement_bookings` 제약 = **`UNIQUE (booking_id)` 라이브 확인**(+FK 2·PK) → **R1 가드 라이브 실재 확정**. cost/통화 컬럼 부재 → §G-6.1 충돌 없음. ✓
  - `settlements` 트리거 2개: **`update_booking_settlement_status_trigger`**(정산 시 `bookings.settlement_status` 자동 전이 — §G-6.2 RPC v2가 의존하는 동작, 별도 코드 불요)·`update_settlement_updated_at`. settlement_bookings 트리거 없음.
  - `tours` 원가 컬럼·`merchants` 세무(w8/tax/us_person) 컬럼 **부재** → §G-6.1(a)(d) 충돌 없음. ✓
  - `create_merchant_settlement` 라이브 시그니처 = `(p_merchant_id uuid, p_period_start date, p_period_end date, p_platform_fee_rate numeric)` — **F1(4-arg) 라이브 확정**. EXECUTE grant=`service_role`+`postgres`만 — **F2(REVOKE) 라이브 확정**. → §G-6.2 R2(시그니처 변경 시 GRANT 재발급) 그대로 유효.
- **F3(통화 혼입) 라이브 ACTIVE 확정:** `bookings.currency` 실데이터에 **`krw`·`usd` 둘 다 존재**(7행). 현 RPC가 통화필터 없이 `SUM(final_price)` → 두 통화 혼산 위험이 **이론이 아니라 실재 데이터로 성립**. §G-6.2 "1정산=1통화" 강제 정당성 라이브 입증. (현재 `settlement_status`는 전부 `pending` → 아직 정산 0건이라 과거 동결(R1) 이슈는 미발생, 설계는 그대로 필요.)
- **payments 테이블:** 라이브 **부재**(archive `:314` 정의되나 미배포) → F8 "존재 불확실"을 **부재로 확정**. 정산/결제 추적은 `bookings` 단일 테이블에 의존(payments 미사용).

## N.5 데이터·기능 결함 라이브 재확인
- **D-14 BLOCKER 확정:** `qa_pairs` 8행 **전부 `review_status='draft'`** → 쿼리의 `.eq('review_status','true'/'false')`는 영구 0행. 라이브 데이터로 재확인.
- **D-1 null 크래시:** 현재 `bookings.final_price` null **0건**(7행 모두 채워짐) → 크래시는 **잠복**(데이터가 운 좋게 안전). 방어코드는 여전히 필요(미래 null 진입 시 폭발).
- **빌더 funnel 부재 확정:** `analytics_funnels` 5개(`matcher_funnel`·`featured_pickup_funnel`·`idle_preview_funnel`·`destinations_funnel`·`tour_mode_funnel`) — **`builder_quote_funnel` 없음** → §K-7.2 시드 필요 확정.
- **audit_logs 0행 / chat_feedback 0행 / chat_memory 0행** — §E-3(감사로그 미기록)·피드백 미수집 라이브 확인. **knowledge_chunks 2193행** → §M R5(RAG 완전연결) 라이브 재확증.
- **N25(notifications) 라이브 CONFIRMED 부재** / quote_drafts·unified_inquiries·analytics_product_funnel_daily 부재(신규 대상, 예상대로).

## N.6 성능 어드바이저 (Phase 5 / perf 트랙)
283개 perf 린트: **unused_index 134**(INFO, 쓰기 오버헤드·블로트), **auth_rls_initplan 62**(WARN, RLS가 행마다 `auth.uid()` 재평가 → `(select auth.uid())`로 래핑 필요; repo에 `optimize_user_profiles_rls_auth_uid` 선례 있으나 62개 잔존), **multiple_permissive_policies 62**(WARN, 중복 허용정책 — 예 `emails` SELECT에 "Admins view all"+"Users view own" 동시 평가), **unindexed_foreign_keys 24**(INFO), **auth_db_connections_absolute 1**(Auth 커넥션 10 상한). → Phase 5/별도 perf 트랙. 정산·analytics 쿼리 스케일(§I 5만행) 전 RLS initplan·FK 인덱스 우선.

## N.7 플랜 본문 반영 매핑
| 항목 | 갱신 |
|---|---|
| K-0 | **해소** — 라이브 연결됨(§N.0). 잔여 "미검증"은 없음. |
| N1 | REFUTED(라이브 실재) → **§N.1 마이그레이션 드리프트로 재분류**(재현/CI 리스크 유지). |
| N25 / payments | 라이브 **부재 CONFIRMED**. |
| R5(RAG) | knowledge_chunks 2193행으로 **라이브 재확증**. |
| F1·F2·F3·R1 | 라이브 확정(§N.4). §G-6 DDL **충돌 0 — Phase 4 안전 배포 가능**(단 §N.1 드리프트 정합 선행). |
| 신규 | **N27(BLOCKER)·N28·N29·N30·N31·N32** + **마이그레이션 드리프트(§N.1, BLOCKER급)** + perf 62/62/134(§N.6). |

---

# §O. 플랜 완전화 감사 v3 (Phase 0.10 — 2026-06-24)

> 사용자 지시("플랜 마지막 전반 심층 감사 → 모든 문제·업그레이드 상정 → 완전화"). 3개 독립 감사 에이전트(완전성 갭 / 신규결함·업그레이드 / §G-6·§K-7 DDL 어드버서리얼) + 세션 라이브 검증. 전 항목 file:line/플랜 위치 인용. **에이전트 주장도 무검증 반영 금지** — 검증 가능한 것은 검증함(예: C#3 FOR UPDATE 구문 → 라이브 probe로 REFUTED).

## O.1 커버리지 갭 — 플랜이 진단 안 한 어드민 표면 (Phase 1/3 편입)
| 대상 | 상태 | 조치 |
|---|---|---|
| `app/admin/analytics/product/sessions/page.tsx` + `[id]/page.tsx` | **미진단** | §D-15는 라우트 수학만 — 이 두 UI 페이지는 어디에도 없음. §D에 D-17로 추가, §H-3 순서에 편입 |
| `api/admin/tours/route.ts`·`[id]/route.ts`·`[id]/bus-detail`·`[id]/tour-mode` | **미진단** | 투어 CRUD/버스/투어모드 — D-9(상품에디터)와 별개 경로. **M-4(DELETE가 예약 무시) 포함** → Phase 1 |
| `api/admin/tour-product-pages/[slug]/route.ts` | **미진단** | 핵심 콘텐츠 write 경로. **M-7(형제 로케일 무동의 덮어쓰기) 포함** → Phase 1/3 |
| `api/admin/cms/{export,import,section-images}` | **미진단** | CMS 보조 경로(§D-8은 메인만). import는 대량 write → 안전성 미평가 |
| `api/admin/homepage-product-card-images/route.ts` | **미진단** | **N33(site_settings 부재) 직격** → Phase 1 |
| `api/admin/email-diag/route.ts` | **미진단** | 진단 GET이 어떤 env 세팅됐는지 노출(정보 유출 가능) → 보안 트랙 |
| `api/admin/tour-content/generate/route.ts` | **미진단** | OpenAI+TTS+Storage write 복합. 비용/실패/멱등 미평가 |
| `api/admin/stats/route.ts` | 부분(N26 각주) | **M-6(KST 타임존 오프셋) 포함** → Phase 1 |

## O.2 신규 결함 레지스터 (감사 v3 — N33·B·M·N)
심각도 🔴BLOCKER 🟠MAJOR 🟡MINOR. 트랙: ⚙️어드민 🔒보안.
| ID | 심각도 | 결함 (검증된 메커니즘) | 증거 |
|---|---|---|---|
| **N33** | 🔴⚙️ | **`site_settings` 테이블이 어떤 스키마에도 라이브 부재**인데 D-11 설정저장·D-8 CMS 오버라이드·홈 상품카드 이미지가 모두 read/write → 영속 전부 무력(쓰기 에러, 읽기는 D-11 "에러 삼키고 기본값"으로 위장). **D-8/D-11을 더 깊게 정정**(no-op의 진짜 원인=테이블 부재). notifications(N25)·드리프트(§N.1)와 동류. | `settings/route.ts:27,87,107`·`lib/cms-content.server.ts:48,77`·`homepage-product-card-images/route.ts:30,104`; live `to_regclass` 전 스키마 NULL |
| **B-1** | 🔴⚙️💰 | **no-show 정산이 위약금 대신 전액 청구.** settle가 `no_show_fee_usd_cents`를 select만 하고 `paymentIntents.capture()`에 `amount_to_capture` 미전달 → Stripe 기본=전액 캡처. 노쇼 $60 의도가 $300 청구. | `settle/route.ts:90,165` |
| **B-2** | 🟠⚙️ | 어드민 layout이 `checkAuth()` 마운트 1회만, `onAuthStateChange` 구독 없음 → 세션 만료 무표시(액션 실패로만 발견). 전역 `auth-session.tsx`는 올바른데 layout 미연결. | `layout.tsx:126-128,169-263` |
| **B-3** | 🟠⚙️ | 주문 상태 전이 state machine 부재 — `no_show`/`payment_status`만 차단, 그 외 `body.status`는 검증 없이 통과(`completed→pending`·`cancelled→confirmed`·임의 문자열). | `orders/[id]/route.ts:122-134` |
| **M-4** | 🟠⚙️ | `DELETE /api/admin/tours/[id]`가 활성/미래 예약 검사 없이 삭제(pickup_points만 정리) → 예약이 NULL-join 고아화. merchant DELETE는 `ACTIVE_BOOKING_STATUSES` 가드 있음(대조). | `tours/[id]/route.ts:333-372` vs `merchants/[id]/route.ts:192-201` |
| **M-6** | 🟠⚙️ | `stats`의 `today=new Date().toISOString()`(UTC) → KST(+9) 오전 9시간 동안 "오늘 주문 0" 오표시. 취소 시 재고복원 날짜 매칭(`orders/[id]:151`)도 동일 오프셋. | `stats/route.ts:43-47`, `orders/[id]/route.ts:151` |
| **M-7** | 🟠⚙️ | `tour-product-pages PATCH`가 한 로케일 편집 시 형제 로케일의 thumbnail/hero/catalog_card까지 덮어씀(의도지만 opt-out·확인·audit 없음) → 계절 KO 캠페인 편집이 EN/JA/ZH hero 파괴. | `tour-product-pages/[slug]/route.ts:317-354` |
| **M-8** | 🟠⚙️ | layout이 `PGRST116`(프로필 없음) 시 인증 가드 안에서 `customer` 프로필 자동 INSERT(데이터 변이). 자기 프로필 삭제 유저가 `/admin` 방문마다 재생성. | `layout.tsx:221-238` |
| **M-1** | 🟠⚙️ | retention 라우트 `.limit(500_000)` 원시 이벤트 Node 적재 → 트래픽 증가 시 Vercel 1GB 초과 크래시(안전밸브 없음). §D-15 retention 결함과 별개의 스케일 폭탄. | `analytics/retention/route.ts:37-38` |
| **N-2** | 🟡⚙️ | `bus-detail POST`가 `payload` 임의 JSON 무검증 저장(크기/형태). | `tours/[id]/bus-detail/route.ts:22` |
| **N-3** | 🟡⚙️ | `events/[name]` summary `total_events`가 raw-pull cap(≤50k) 길이 → 고볼륨 이벤트는 항상 "50000" 오표시. | `analytics/events/[name]/route.ts:163` |
| **N-5** | 🟡⚙️ | `merchants [id] PUT`가 allowlist 없이 필드 수용 — `contactEmail` 형식·`status` enum 미검증("hacked" 영속). | `merchants/[id]/route.ts:108-116` |
| (중복) | — | **M-3**=experiments 필터 폐기(기존 N7), **M-5**=qa-pairs 순차 count(기존 N10), **M-2**=funnel cap 무음(기존 §D-15), **N-1**=upload DELETE bucket(기존 N17), **N-4**=layout stale token(B-2 일부). 신규 아님 — 기존 항목 강화. |

## O.3 §G-6/§K-7 DDL 어드버서리얼 정정 (적용 델타 — 구현 전 필수)
> 에이전트 C 15건 중 검증 결과. **C#3(FOR UPDATE 구문 무효)는 라이브 probe로 REFUTED** — `CREATE TEMP TABLE AS SELECT … FOR UPDATE OF b`는 유효·v1 정상. 나머지 유효 결함의 **수정 델타**(§G-6.2 RPC v2·§G-6.1 DDL·§K-7에 적용):
| # | 심각도 | 결함 | 수정 델타 |
|---|---|---|---|
| C1 | 🔴 | `v_skipped` 별도 SELECT가 `NOT EXISTS`·cand 제외 누락 → 과대카운트·dirty read | `v_skipped`를 `pg_temp.cand` 빌드 쿼리 한 패스에서 `count(*) FILTER (WHERE merchant_cost IS NULL)`로 산출(별도 테이블스캔 제거) |
| C2 | 🔴 | `settlement_bookings`에서 `platform_fee_amount==operational_fee_amount`, `merchant_payout_amount==merchant_cost_amount` 중복·명명 혼란(`platform_fee_amount`가 실제론 op_fee) | cost_plus에선 `platform_fee_amount`에 op_fee 넣지 말고 **`operational_fee_amount` 단일 사용**, `platform_fee_amount`는 flat_rate 전용(NULL for cost_plus)으로 의미 분리. 리포트 조인 영향 문서화 |
| C4 | 🟠 | 음수 `op_fee`(final_price<merchant_cost) 무음 수용 → 음수 fee/과대 payout | 후보 필터에 `AND (p_fee_basis='flat_rate' OR b.final_price>=b.merchant_cost)` + 제외건 `v_negative_margin` 카운트 반환(§J-9 정책 확정 전 차단·보고) |
| C5 | 🟠 | `total_usd_amount` 컬럼 추가하나 RPC가 미채움 → 항상 NULL(세무 USD 대사 핵심) | RPC INSERT에 `total_usd_amount = (SELECT SUM(usd_amount) FROM cand)` 추가. usd_amount 미포착건 있으면 NULL-aware |
| C6 | 🟠 | `DROP FUNCTION (4-arg)` 후, 재현환경 replay 시 옛 `restrict_…` GRANT 마이그레이션이 없는 시그니처에 REVOKE/GRANT → 에러 | §N.1 정합 시 옛 restrict 마이그레이션을 신규 시그니처로 갱신 또는 `IF EXISTS` 가드. (드리프트 정합과 묶기) |
| C7 | 🟠 | `settlements.currency NOT NULL DEFAULT 'usd'` → 미래에 과거 KRW 정산이 생기면 'usd'로 오백필 | 백필 단계는 **nullable**로 추가 → §G-6.3 UPDATE로 통화 보정 → 검증 후 `SET NOT NULL` |
| C8 | 🟠 | `partially_refunded` 건이 `payment_status='paid'` 필터에서 영구 누락(정산 0회). `collectedOffline` 경로가 취소/환불건도 paid化(D-3) | RPC에 partial-refund 처리(net `final_price−refund_amount` 정산 또는 `v_excluded_partial` 카운트) + D-3 가드를 정산 전제로 명시 |
| C9 | 🟡 | `usd_amount=final_price×fx_rate_to_usd`(settle 코드, §G-6.5) 명시 ROUND 없음 | settle 코드에 `ROUND(...,2)` + KRW는 정수화 규칙 명시 |
| C10 | 🟡 | (no-bug, 문서화) 트리거는 `settlements.status→completed`에서 발화, settlement_bookings INSERT 아님 → `settlement_status='pending'` 필터는 `NOT EXISTS`와 부분 중복. | §N.4에 "재정산 차단의 진짜 락은 NOT EXISTS, settlement_status는 보조" 주석 추가 |
| C11 | 🟡 | `quote_drafts.price_shown_krw integer`가 KRW 하드코딩 → USD 견적 손실 | `price_shown numeric(12,2)` + `price_shown_currency text`로 교체(§K-7.1) |
| C12 | 🟡 | `unified_inquiries`가 ticket 브랜치 `escalation_reason`을 `category`로 사용 → 카테고리 칩 오염 | ticket `category`는 별도/NULL, `escalation_reason`은 `details` 컬럼으로 분리(§K-7.5) |
| C13 | 🟡 | 상품 funnel matview: `payload->>'slug'=''` 빈문자가 UNIQUE 충돌; cron의 `REFRESH … CONCURRENTLY` 사용 미확인 | matview WHERE에 `AND nullif(payload->>'slug','') IS NOT NULL`; cron이 CONCURRENT 쓰는지 확인(§K-7.6) |
| C14/C15 | 🟡 | `NOT VALID` 의미 주석 필요; §G-6.3 백필 WHERE의 `IS DISTINCT FROM 'cost_plus'` 불필요 | 주석 추가 + `WHERE platform_fee_rate IS NULL`로 단순화 |
> **참고(검증된 사실):** unified_inquiries가 참조하는 컬럼은 **라이브 전수 실재 확인**(received_emails.from_name/category/received_at·support_tickets.initial_summary/unread_for_admin/escalation_reason·contact_inquiries.full_name 등) → 시퀀싱 리스크 해소.

## O.4 누락 횡단 워크스트림 (플랜 신규 편입 — "하이엔드" 전제)
| WS | 갭 | 편입 |
|---|---|---|
| **WS-A 관측성** | 에러추적/구조화로그/알림 부재(Telegram만). 어드민 mutation 실패 알림 경로 없음 | Sentry류 + audit 실패 alert + P95/에러율 임계. Phase 1 말 + §P U-10 |
| **WS-B 테스트 전략** | §I가 종류만, 목표치 0(커버리지%·E2E 시나리오·perf 임계·Stripe/Supabase 모킹) | 각 Phase DoD에 골든테스트(analytics 수학)·E2E 핵심플로우·계약테스트 구체화 |
| **WS-C 롤백/플래그** | RPC만 롤백 명시. UI 16페이지 개편·Phase1 패치 롤백 절차 없음 | 페이지별 feature flag + Phase1 패치 역적용 절차 |
| **WS-D Rate-limit(어드민)** | 공개 API만 다룸. 어드민 라우트 자체 무제한(탈취 토큰 DoS/대량변이) | 어드민 글로벌 rate-limit + 멱등키(§P U-2) |
| **WS-E i18n 인벤토리** | "키화"만, 택소노미/키수/네임스페이스(`admin.orders.*`) 없음 | 키 인벤토리 + 네임스페이스 설계 + 영어전용(settings) 키화 범위 |
| **WS-F a11y 체크리스트** | 방향성만. WCAG 레벨·axe CI 게이트·수동범위 없음 | WCAG 2.1 AA 목표 + axe-core CI + 키보드/대비 체크리스트 |
| **WS-G perf 예산** | 페이지네이션 기본값·쿼리 타임아웃·응답 목표 없음. 62 RLS initplan/62 multi-policy(§N.6) | 리스트 기본 50행·쿼리 타임아웃·RLS initplan `(select auth.uid())` 래핑·FK 인덱스 |
| **WS-H 백업/DR** | 세무 7년만. RPO/RTO·PITR·복구테스트 없음. §N.1 드리프트 자체가 DR 갭 | Supabase PITR 확인 + repo 재현성 복구(=§N.1) + 복구 리허설 |
| **WS-I RBAC 세분화** | 단일 `admin` 게이트. read-only 분석가/풀어드민/머천트 레벨 미검토. N31 13테이블 | 역할/권한 모델 설계(최소 admin·analyst·support) |
| **WS-J 시크릿 위생** | 평문 PAT(D-4)·tax_id PII(§G-6.1)·email-diag 노출. 회전정책/vault 없음 | env 인벤토리 + 회전정책 + tax_id 암호화/vault |

## O.5 정합성 정정 (본문 stale → 갱신 필요)
| 위치 | 문제 | 조치(이 문서 내) |
|---|---|---|
| §K-7.3 / §K-7.7 | "N1 해결: `anonymize_old_analytics()` **신설**(정의 없음)" — §N.2에서 라이브 실재로 REFUTED됐는데 신설 문구 잔존 | 본 절에서 정정: **신설 아님 → repo 마이그레이션에 흡수(드리프트 정합, §N.1)** + N27 REVOKE 포함 |
| §D-15 | "health/route.ts:20 미배포 시 500" — §N.2에서 라이브 실재로 해소 | 정정: 함수 라이브 실재(프로덕션 정상), 잔여는 §N.1 드리프트(재현환경) |
| §E-5 | "재고/가용성 관리 UI 신설" — **프로젝트 결정 `availability unlimited → no scarcity UI`와 충돌**(빈 product_inventory는 의도) | 정정: 재고 편집 UI는 **보류**(온디맨드=무한). 정산·환불·알림·⌘K만 §E-5 유지 |
| §K-7.4 | audit 의무 라우트가 미진단 경로(tours/[id]·tour-product-pages) 누락 | O.1 미진단 라우트 진단 후 audit 목록에 편입 |
| §B / §G-6.4 | "모든 mutation에 audit_logs" vs RPC 스왑 체크리스트에 audit 단계 없음 | §G-6.4에 정산 마이그레이션 audit 단계 추가 |
| §G-6.5 / §G-4 | FX 신규건만 vs 1099-K 대사가 과거 FX 가정 | §G-4 리포트에 "과거 FX 근사·미설명 delta 플래그" 명시(CPA 고지) |

## O.6 시퀀싱 게이트 (의존 그래프 — Phase 순서 확정)
1. **G0 마이그레이션 정합(§N.1)** → 모든 Phase 4~6 DDL의 **하드 선행**. 안 되면 정산/익명화/matview 배포 위험.
2. **G1 N27 REVOKE** → Phase 4 `anonymize_old_analytics` 확장(귀속컬럼 스크럽) **전에** 필수(안 그러면 확장표면이 anon 호출 가능).
3. **G2 J-3(gross/net) 사전응답** → Phase 4 `revenue_treatment` 컬럼이 의미 가지려면 필요(미정 시 전건 NULL).
4. **G3 slug 이벤트 계측(Phase 4 조기)** → Phase 5 상품 funnel matview 데이터 전제.
5. **G4 RPC v2 + 호출부 + 정산 UI 동시배포(R2)** → 정산 UI(§E-5)를 Phase 7로 미루면 옛 3-arg 호출로 수개월 파손 → **정산 UI를 RPC와 같은 릴리스(Phase 4)로 당김**.
6. **G5 미진단 라우트 진단(O.1)** → audit 의무(§K-7.4)·Phase 3 UI 개편 전.

---

# §P. 하이엔드 업그레이드 로드맵 (목표: "더 업그레이드 불필요" 수준)
> 감사 v3 도출. 각 항목 [가치 / 근거 / 노력 / 확장 Phase]. 우선순위 = 운영 임팩트.
| ID | 업그레이드 | 가치·근거 | 노력 | Phase |
|---|---|---|---|---|
| **U-1** | Supabase Realtime 라이브 피드(주문/문의/티켓) | 투어당일 실시간 유입을 새로고침 없이. 현 전부 mount 1회 fetch | 1-2d | 3(리스트) |
| **U-2** | Stripe capture/release **멱등키** + 어드민 mutation 멱등 | 더블클릭/재시도 시 2중 캡처·DB 2회 update 방지. settle 무방비 | 0.5d | 4(정산) |
| **U-3** | 서버드리븐 가상화 DataTable + URL 필터상태 | 5만행 일괄→북마크/공유가능·빠름. `?status=pending&page=2` | 3-4d | 3 |
| **U-4** | ⌘K 커맨드 팔레트(주문/POI/CMS/이동) | 키보드 우선 — "월드클래스" 체감. 현 클릭 과다 | 2d | 신규 |
| **U-5** | 인라인 audit/diff 뷰어(편집 이력 드로어) | M-7 형제로케일 덮어쓰기 등 "누가 뭘" 가시화. audit_logs(§E-3) 위 | 3d | 7 |
| **U-6** | 파괴적 액션 **undo**(soft-delete+30s) | 투어/머천트/QA 영구삭제 비가역 → 표준 안전망 | 2d | 3/7 |
| **U-7** | 주문/QA **bulk 액션**(다중선택 batch) | 성수기 반복작업 급감. batch API+상태가드 재사용 | 2-3d | 3 |
| **U-8** | Saved views + URL 상태 영속(분석/주문) | 필터 북마크/공유/새로고침 생존 | 1-2d/섹션 | 3/5 |
| **U-9** | 알림센터(노쇼위험·hold만료·에스컬·부정피드백) | 시급 액션을 벨로 집약. 현 수동확인 | 2d | 7 |
| **U-10** | 관측성 미니대시(라우트 지연·쿼리비용) | 솔로 운영자 회귀 조기감지. health 페이지 확장 | 1-2d | 5 |

---

# §Q. 비구현 준비 사양 (turnkey — 적용 전, 승인 시 즉시 실행 가능)

> 사용자 지시("추천순서 중 실제 구현 제외 스텝 진행"). 아래는 **코드/DB 미적용** 상태의 완성 사양. 승인 시 그대로 실행.

## Q-1. N27 즉시 차단 SQL (라이브 검증된 정확 대상)
라이브 확인: 과다권한 SECURITY DEFINER 함수 = 정확히 4개. 정산 RPC는 이미 올바름(레퍼런스).
```sql
-- 적용 마이그레이션 (additive·idempotent). 정산 RPC restrict 패턴 복제.
REVOKE EXECUTE ON FUNCTION public.anonymize_old_analytics(integer)          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_analytics_materialized_views()    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.analytics_health_snapshot()               FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                         FROM PUBLIC;   -- 트리거 전용, API 불요
GRANT  EXECUTE ON FUNCTION public.anonymize_old_analytics(integer)          TO service_role;
GRANT  EXECUTE ON FUNCTION public.refresh_analytics_materialized_views()    TO service_role;
GRANT  EXECUTE ON FUNCTION public.analytics_health_snapshot()               TO service_role;
```
- **검증(적용 후):** `SELECT routine_name, grantee FROM information_schema.routine_privileges WHERE routine_name IN (…) AND grantee IN ('PUBLIC','anon','authenticated');` → **0행** 기대. + `get_advisors(security)`에서 `anon_security_definer_function_executable` 4건 소거 확인.
- **영향:** cron/health 라우트는 service-role 사용 → 정상. anon/authenticated REST 호출만 차단. **롤백:** 위 GRANT를 PUBLIC으로 되돌리면 됨(권장 안 함).
- **주의:** `handle_new_user`는 `auth.users` 트리거 — EXECUTE grant와 무관하게 트리거는 발화하므로 REVOKE 안전.

## Q-2. §N.1 마이그레이션 정합 런북 (repo↔live 재현성 복구)
> 목표: repo `supabase/migrations/`로 라이브를 재현 가능하게 + drift 재발 방지. **DDL 미적용 — 절차만.**
1. **백업/안전:** Supabase PITR 시점 확인 + `pg_dump --schema-only` 스냅샷 보관.
2. **baseline 스냅샷:** `supabase db pull`(또는 `pg_dump --schema-only`)로 **라이브 실스키마**를 단일 baseline 마이그레이션으로 추출 → 기존 repo `migrations/`(드리프트본)와 비교.
3. **차분 분류:** 라이브 전용 39개(§N.1) 각각을 (a)정식 마이그레이션 흡수 (b)pending-db-apply 출처 매핑. repo 전용 23개는 라이브 미적용/이중스탬프 판별.
4. **재정렬:** baseline 이후로 마이그레이션 히스토리 단일화. `supabase migration repair`로 버전 정합(라운드↔정밀 스탬프 충돌 해소).
5. **pending-db-apply 정식화:** 향후 모든 스키마 변경은 `migrations/`로만. `pending-db-apply`/`manual`은 일회성 데이터 패치 전용으로 격리.
6. **CI drift 게이트(U4):** PR에서 `supabase db diff`로 repo↔shadow DB 차이 0 검증. "코드가 호출하나 미정의 RPC/테이블"(N1·N25·N33류) 정적 체크 추가.
7. **검증:** 새 shadow 환경에 repo만으로 `db reset` → 라이브와 스키마 동등 확인.

## Q-3. Phase 1 BLOCKER 턴키 수정 사양 (코드 미적용)
| ID | 파일 | 수정 사양 | DoD/테스트 |
|---|---|---|---|
| B-1 | `settle/route.ts:165` | `capture(piId, { amount_to_capture: reason==='no_show' ? booking.no_show_fee_usd_cents : undefined, idempotencyKey:… })`. KRW/USD 단위 일치 확인(cents) | 노쇼 캡처액=위약금. 골든: $300 hold·$60 fee→$60 캡처 |
| N33 | site_settings | **마이그레이션 신설**(`CREATE TABLE site_settings`, archive `notifications-schema` 패턴) + RLS(service-role write/admin) **또는** 코드가 기대하는 컬럼 스키마 도출 후 정식화. §N.1 정합과 묶기 | settings 저장→재로드 영속. CMS 오버라이드 반영 |
| N23+N27 | cron + DB | N27=Q-1 REVOKE. N23=cron `if(!secret) return true` 제거(시크릿 필수화) | anon REST 호출 차단(401), 시크릿 없으면 cron 거부 |
| D-2 no_show | `orders/[id]/route.ts:116` | 드롭다운 `no_show` 옵션 제거 또는 PUT가 settle 경로로 위임 | 드롭다운 no_show 선택이 실패 안 함 |
| D-14 | `qa-pairs/route.ts:35` | `.eq('review_status', …)` 값을 `draft|approved|rejected|needs_edit`로 교정(UI 옵션도) | 필터가 실제 행 반환 |
| D-11/settings | settings 토글 | maintenance/registration **reader 구현**(미들웨어 게이트) 또는 토글 제거 + N33 site_settings 영속 | 토글이 실제 강제 |
| D-1 | `page.tsx:119,129,303` | 하드코딩 0 → 실 카운트(unified_inquiries 등), `parseFloat(x.toString())`→`String(x)` null-safe | 대시보드 실데이터·null 무크래시 |
| B-3 | `orders/[id]/route.ts:122` | 상태 전이 allowlist(state machine) | 불법 전이 400 |
| 머천트 평문비번(D-4) | `merchants/create/route.ts:164-176` | 응답에서 평문 비번 제거(주석이 "remove in production") | 응답에 비번 없음 |

---

# §R. 실행 WBS — 웨이브·티켓 (PR 단위, 잘게 분할 v2)

> 각 티켓 = 1 PR. 형식 `[track] 제목 — 핵심파일 | 의존 | DoD`. 트랙: 🔒보안 ⚙️기능 🧱데이터 📊통계 🎨UI/모바일 💴세무 🏪머천트. **공통 DoD(전 티켓):** 빌드 green · 변경범위 단위/회귀 테스트 · 커밋 푸터 모델식별자 금지 · DB변경 티켓은 additive + 적용 후 `mcp__atockorea__get_advisors` 재실행. **웨이브 = 의존 순서**(W0가 가장 먼저). 같은 웨이브 내 티켓은 병렬 가능.

## Wave 0 — 🔴 즉시 핫픽스 (라이브 보안·머니, 각 독립·소형 PR — 승인 즉시 최우선)
- **W0.1 🔒 P1 권한상승 차단** — `user_profiles` UPDATE/INSERT RLS에 role `WITH CHECK` 추가(또는 role을 admin-only SECURITY DEFINER RPC로 분리). 마이그레이션 1개 | 의존 없음 | DoD: 비-admin이 PATCH로 role 변경 시 RLS 거부(라이브 재현 테스트), advisor 재실행. *(전 항목 최우선, §T.1)*
- **W0.2 🔒 N27 anon-exec REVOKE**(§Q-1) — analytics 4함수 `REVOKE EXECUTE FROM PUBLIC,anon,authenticated` + service_role GRANT | 의존 없음 | DoD: advisor `anon_security_definer_function_executable` 4건 0, cron/health 정상.
- **W0.3 🔒 W-3 cron secret URL 제거** — `recapture-holds`·`capture-tour-day` `?secret=` 폴백 삭제, `Authorization: Bearer`만 | 의존 없음 | DoD: 쿼리 secret 거부.
- **W0.4 🔒 N23 cron fail-open 제거** — `analytics-anonymize`·`analytics-refresh-views` `if(!secret) return true`→`false` | 의존 없음 | DoD: 시크릿 없으면 cron 거부.
- **W0.5 💰 B-1 노쇼 부분캡처**(§Q-3) — `settle/route.ts:165` `amount_to_capture` + 멱등키 | 의존 없음 | DoD: 골든($300 hold·$60 fee→$60).
- **W0.6 🔒💰 W-1 webhook 상태가드** — `payment_intent.succeeded`가 cancelled/no_show 덮어쓰기 차단(`.not('status','in',...)`) | 의존 없음 | DoD: 취소예약이 paid로 안 바뀜.

## Wave 1 — 🎨 프리미엄 모바일 기반 (R2.0, 전 페이지 개편의 토대 — 컴패니언 §2~7)
> ⚠️ Wave 4(페이지 개편) 전 필수. 순서: W1.1→나머지 병렬.
- **W1.1 🎨 디자인 토큰** — `globals.css`에 `--admin-*`(surface/border/shadow) + `.admin-root` tabular-nums + radius 12px 매핑(`tailwind.config.js`) + navy 다크 토큰 | 의존 없음 | DoD: 토큰 정의, 라이트/다크 렌더.
- **W1.2 🎨 Toaster 마운트 + sonner 채택 시작** — `app/admin/layout.tsx`에 `<Toaster position="top-center" richColors/>` | W1.1 | DoD: toast 표시.
- **W1.3 🎨 AdminPageShell** — 공통 크롬(sticky헤더+`pt-[env(safe-area-inset-top)]`+필터바 슬롯+`pb-[calc(4rem+safe-area)]`) | W1.1 | DoD: 1페이지 적용 데모.
- **W1.4 🎨 입력 16px 전역** — `lib/mypage-ui.ts:143` `AUTH_INPUT` 15→16px + 어드민 입력 `text-sm`→`text-base` + 전역 `input,select,textarea{font-size:max(16px,1em)}` | 의존 없음 | DoD: iOS 줌 없음.
- **W1.5 🎨 터치타깃 44px + safe-area** — `layout.tsx` 헤더(`size-9`/`h-8`→`min-h-11`)·바텀탭·아이콘버튼 | W1.1 | DoD: 핵심 인터랙티브 ≥44px.
- **W1.6 🎨 유틸 키트** — `lib/admin/haptics.ts`·단일 `Spinner`·`SwipeRow`(framer)·skeleton(`admin-shimmer`)·`useUrlFilters` 훅 | W1.1 | DoD: 각 단위 테스트.
- **W1.7 🎨 컴포넌트 키트 Tier1** — `AdminPageHeader·StatCard·DataTable·FilterBar·StatusBadge`(아이콘+pill)(컴패니언 §7) | W1.1 | DoD: Storybook/데모 렌더.
- **W1.8 🎨 컴포넌트 키트 Tier2** — `DataCard·FilterSheet·EmptyState·ConfirmSheet·ActivityRow` | W1.7 | DoD: 동일.
- **W1.9 🎨 Lucide 일괄 + 이모지 제거** — 인라인 SVG(`page.tsx:112-136`)·이모지(`orders:237` 📋 등)→Lucide, stroke 규율 | W1.1 | DoD: 어드민 이모지 0.
- **W1.10 🎨 바텀내비 5슬롯 재편 + nav 그룹핑** — `layout.tsx:38-59` 홈/주문/수신함/챗봇/더보기 + support·QA 추가 + More 그룹 | W1.3 | DoD: 전 섹션 도달 가능.
- **W1.11 🎨 i18n 인벤토리·네임스페이스(WS-E) + a11y 체크리스트·axe CI(WS-F)** | 의존 없음 | DoD: 키 택소노미 + CI 게이트.

## Wave 2 — 🧱 인프라 게이트 (데이터 작업 선행)
- **W2.1 🧱 마이그레이션 정합**(§Q-2 런북 7단계) — `db pull` baseline + pending-db-apply 정식화 + CI drift 게이트 | PITR 확인(§J) | DoD: shadow `db reset`=live 동등.
- **W2.2 📊 미진단 라우트 진단 마무리**(§U.0.1: cms/import·머천트포털 API 등 잔여) | 없음 | DoD: §D 본문에 신규 결함 등재.
- **W2.3 🔒 N32 하드닝** — function search_path·extension out of public·leaked-password-protection 활성 | 없음 | DoD: advisor WARN 소거.

## Wave 3 — ⚙️ 기능 안정화 (Phase 1, 페이지/도메인별 소형 PR)
- **W3.1 ⚙️ N33 site_settings 정식화** — 마이그레이션 + RLS(D-8/D-11 동반) | W2.1 | DoD: 설정 저장→영속, CMS 오버라이드 반영.
- **W3.2 ⚙️ 주문 라우트** — D-2(email select)·no_show 드롭다운 제거·B-3 state machine·status 검증·**S-F1 stats OOM(SQL 집계)**·M-6 KST | W1.* | DoD: 불법전이 400·매출 SQL 집계·KST 오늘.
- **W3.3 ⚙️ 대시보드** — D-1(하드코딩0→실카운트·null-safe `String()`) | W1.7 | DoD: 실데이터, null 무크래시.
- **W3.4 ⚙️ 머천트** — D-4 평문비번 제거·**S-F2 Math.random→crypto**·롤백·**S-F3 audit actor=admin**·S-F6 DELETE순서·S-F7 빈PUT·S-F8 이중필터·N4/N5 allowlist·S-F13 addressLine2·S-F14 settings | W1.* | DoD: 각 결함 회귀테스트.
- **W3.5 ⚙️ 문의/메일/지원/QA** — D-5(페이지리셋·디바운스)·D-6·D-14(review_status 값)·S-F9 emails 500·S-F12 holdMsLeft·support 더블탭 가드 | W1.* | DoD: 필터/검색 정상·중복발송 차단.
- **W3.6 ⚙️ 설정/업로드** — D-11(토글 reader 또는 제거)·D-7/N2(validateFile·매직바이트)·N17 bucket allowlist | W3.1 | DoD: 토글 강제·업로드 검증.
- **W3.7 ⚙️ 투어/콘텐츠 라우트** — M-4(DELETE 예약가드)·M-7(형제로케일 opt-out+audit)·AR-1(tour-content 캡)·AR-3(픽업 비원자) | W2.2 | DoD: 삭제 가드·원자 교체.
- **W3.8 ⚙️ 인증/세션** — B-2(onAuthStateChange)·M-8(프로필 자동생성 제거)·P3(middleware /admin 서버가드)·P5/P6(세션 응답·비번변경) | W1.2 | DoD: 만료 표시·서버 게이트.
- **W3.9 📊 analytics 수학버그 + 골든테스트** — D-15(visitors distinct·funnel 세션·retention left-censor·experiments filter)·M-1 retention cap·S-F10 NaN | 없음 | DoD: known-input→expected 골든.
- **W3.10 ⚙️ lib 정확성** — LIB-1 이메일 XSS(escapeHtml)·LIB-2 DMZ 차량·LIB-3 FX 폴백(env+알림)·LIB-6 라벨·`import 'server-only'` | 없음 | DoD: 템플릿 escape·FX 경고.

## Wave 4 — 🎨 페이지별 프리미엄 모바일 개편 (Phase 2/3, 컴패니언 §8 청사진 순)
> 각 페이지 DoD: 반응형(테이블→DataCard)·터치44·16px·stale유지·URL필터·alert/confirm→toast/ConfirmDialog·dirty가드·다크·a11y. 머니 직결 우선.
- **W4.1 🎨💰 주문 상세 머니액션 시트** — confirm()→머니 확인 시트(금액·멱등)·sticky 바텀바·toast | W1.8 | DoD: iOS WebView 무확인 발화 차단.
- **W4.2 🎨 주문 목록** — sticky 필터바+검색 신규·DataCard 스와이프·skeleton·prefetch | W1.* | DoD: 청사진 §8.2.
- **W4.3 🎨 대시보드** — 액션큐 strip·매출 KPI 2-up·스파크라인·floating help 제거 | W3.3 | DoD: 청사진 §8.1.
- **W4.4 🎨 통합 인박스 `/admin/inbox`**(§E-4) — `/api/admin/inbox` UNION·카테고리칩·스와이프해결·바텀시트 답장 | W1.8 | DoD: 청사진 §8.3.
- **W4.5 🎨 정산 운영 UI** — `app/admin/settlements/**`(§E-5) — RPC v2 동시배포(W5.2 게이트)·통화/basis·명세서 | W5.2 | DoD: 정산 생성·미리보기.
- **W4.6 🎨 머천트 페이지** — i18n 통일·머니없는 폼·멀티스텝 create·자격증명 alert 제거 | W3.4 | DoD: KO 통일·sticky CTA.
- **W4.7 🎨 분석 페이지군** — 레거시 `/admin/analytics` 폐기→엔진 연결·KPI 스파크라인·SessionCard·frozen 히트맵·기간선택기 | W3.9 | DoD: 청사진 §8.4.
- **W4.8 🎨 챗봇분석** — 이모지/alert 제거·KpiCard 통합·escalation율 렌더·기간선택기 | W1.7 | DoD: 라벨=데이터.
- **W4.9 🎨 POI/CMS/업로드** — match-pois 모바일(w-80→lg:flex)·CMS·업로드 hover→tap | W1.* | DoD: 모바일 사용가능.
- **W4.10 🎨 설정/감사로그 UI** — 토큰 채택·감사 타임라인(W5.4) | W3.6 | DoD: slate 통일.
- **W4.11 🎨 횡단 인터랙션** — U-1 Realtime·U-3 가상 DataTable·U-6 undo·U-7 bulk·U-8 saved views | W1.6 | DoD: 각 적용.

## Wave 5 — 🧱 데이터 모델 (Phase 4, §G-6/§K-7, **O.3 델타 필수 적용**)
- **W5.1 🧱 정산/세무 DDL**(§G-6.1) — additive 컬럼·인덱스(tours.cost_price·bookings 11·settlements basis/통화·merchants W-8) | W2.1 | DoD: advisor 재실행.
- **W5.2 🧱 RPC v2 + 호출부 + 정산UI 동시배포**(§G-6.2, O.3 C1/C2/C4/C5/C7/C8) + U-2 멱등키 | W5.1 | DoD: flat_rate 골든=과거 동일, GRANT 재발급.
- **W5.3 🧱 귀속FK + 익명화 정합**(§K-7.3, R4/N1) + N27 후 RPC 확장 | W0.2·W2.1 | DoD: 90일 스크럽이 신규 컬럼 포함.
- **W5.4 🧱 audit_logs 헬퍼**(§K-7.4) — `lib/admin/audit.ts` actor=admin + 전 mutation 의무호출 | W2.1 | DoD: 정산/환불/편집에 기록.
- **W5.5 🧱 quote_drafts**(§K-7.1, C11)·**unified_inquiries**(§K-7.5, C12)·빌더 이벤트(§K-7.2) | W2.1 | DoD: 뷰 생성·이벤트 발화.
- **W5.6 🧱 slug 이벤트 계측**(G3) — Phase 5 matview 전제 | 없음 | DoD: product 이벤트에 slug.
- **W5.7 💰 환불 경로 신설**(W-10) — `POST /api/admin/orders/[id]/refund` + `charge.refunded` 핸들러 | W0.6 | DoD: 환불→DB paid→refunded 동기화. *(§G 정산 대사 전제)*

## Wave 6 — 📊 통계 (Phase 5)
- W6.1 수학버그 골든(W3.9 연계) · W6.2 상품 funnel matview(§K-7.6, C13) · W6.3 귀속/이탈/bounce · W6.4 perf(WS-G: RLS initplan 62·multi-policy 62·FK인덱스·unused index) · W6.5 U-10 관측성(WS-A) | 의존 W5.6.

## Wave 7 — ⚙️ 신규 운영기능 (Phase 7)
- W7.1 환불/취소 워크플로 UI(W5.7) · W7.2 알림센터(U-9, notifications 테이블 선행) · W7.3 ⌘K(U-4) · W7.4 audit UI(U-5, W5.4) · W7.5 글로벌 검색. **재고 UI 보류**(O.5).

## Wave 8 — 💴 세무 (Phase 6, §G-5 SIGN-OFF + §J #2/#3 후에만)
- §G-4 서류별 1티켓: 수익요약·1099-K대사(W5.7 환불 전제)·W-8 대시보드·sourcing 원장·nexus 모니터·WY 캘린더·5472 트래커·아카이브.

## Wave 9 — 🔒 공개 보안 트랙 (어드민과 독립·병렬 PR — §M.3/§T)
- W9.1 N11 inventory 인증 · W9.2 N13 promo-codes 인증 · W9.3 N14 checkout 소유권 + W-7 · W9.4 N16 confirm-email + P2 create-profile · W9.5 N15 oversell 원자성 · W9.6 N17 upload DELETE 소유권(PA-2)·N19 maps·N18 LINE OAuth · W9.7 N20 보안헤더·N21 middleware · W9.8 N28 contact_inquiries·N29 matview API·N30/N34 버킷 · W9.9 N24 Resend 멱등·PA-1 reminders GET · W9.10 P4 check-email RL·PA-3 senderRole·PA-4 게스트 스프레이·PA-5 AI RL·PA-6 contact/verification RL · W9.11 챗봇 CB-1 CORS·CB-2 durable RL(Upstash)·CB-3 debug flag·CB-5 무인증 예약·CB-6/10/12/15 · W9.12 고객 머니 CK-1 세금·CK-2/3 프로모·CK-6/7/9.

## Wave 10 — 🏪 머천트/레거시 포털 (§U.0.1 blind spot)
- W10.1 🏪 머천트 포털(`app/merchant/**`) 인증/RLS 스코프 감사 + 모바일 패리티 | W0.1·W1.* | DoD: merchant role 데이터 격리 검증.
- W10.2 ⚙️ `app/dashboard/**` 정체 확정(§J #15) → 폐기 또는 흡수.

## Wave 11 — ✅ 검증 (Phase 8, §I + WS-B)
- 부하(5만행)·null회귀·권한·금액정합(Stripe대사)·analytics 골든·E2E 핵심플로우·**advisor 재실행(보안/perf 회귀)**·Playwright 모바일 뷰포트.

> **크로스컷 워크스트림(WS-A~J)은 위 웨이브에 분산:** 관측성(W6.5)·테스트(전 DoD)·롤백/플래그(각 페이지)·rate-limit(W9.10/11)·i18n(W1.11)·a11y(W1.11)·perf(W6.4)·DR(W2.1)·RBAC(W10.1)·시크릿(W0.*).

---

# §S. 섹션별 딥 리뷰 + 모바일/UX 집중 감사 (Phase 0.11 — 2026-06-24)

> 사용자 지시("섹션별 에이전트 전부 파견, 더 깊은 리뷰, UI/UX 중점 + 모바일 최적화(사용 절반+이 모바일)"). 8개 에이전트(페이지군 6 + 모바일 전담 + UI/UX 휴리스틱 전담) file:line 직접 대조. **검증 가능한 에이전트 주장은 검증**(예: SortableImageCard 케이싱·셸 데스크톱전용 → REFUTED). 기존 §D/§K-6/§M/§N/§O와 중복은 제거, 신규만 등재.

## S.0 왜 딥 리뷰마다 결함이 나오나 (수렴 진단)
- **매 패스 = 새 렌즈/표면.** Phase0(mock-trace)→§K(재검증)→§M(공개API)→§N(라이브DB)→§O(미진단 라우트)→§S(모바일/UX 품질). 매번 *직전에 안 본 코드*를 봄 → 신규 결함은 부실이 아니라 범위 확장의 정상 산물.
- **수렴 신호:** 이미 본 영역에선 *정정*만, 신규 correctness 버그는 새 표면에서만. §S는 마지막 큰 미탐색 렌즈(실제 UX/모바일). **이후 패스는 회귀(중복)율이 급증할 것** — §S를 사실상 진단 종료점으로 보고 Phase 1 착수 권고.
- **근본 원인:** 어드민이 여러 세션에 걸쳐 빠르게 증축됨 + 신/구 코드 세대 공존(products/poi=현대, orders/merchants/contacts=레거시) → 결함 밀도가 구세대에 집중.

## S.1 모바일 정량 판정 (사용 절반+ = 1급 렌즈)
- **판정: 부분 사용가능.** ✅ 셸은 모바일 인지(`layout.tsx`: 햄버거+드로어 `w-[264px]`·하단 탭바·`pb-[calc(4rem+safe-area)]`) → "어드민 전부 데스크톱 전용"은 **REFUTED**. ✅ orders/merchants/contacts/dashboard는 `md:hidden` 카드 폴백 보유.
- **❌ 그러나 29개 페이지 파일 중 12개가 반응형 클래스(`sm:/md:/lg:`) 0개**, 7개는 1~2개뿐. 개별 페이지 콘텐츠(테이블·에디터·차트)가 모바일에서 깨짐.
- **최악(375px 즉시 파손):** ① `support`(9컬럼 `<table>` 폴백 0) ② `match-pois`(`w-80 flex-shrink-0` 2-pane, 브레이크포인트 0 → 에디터 ~55px 슬리버, **완전 사용불가**) ③ `analytics/product/sessions`·`events`(`grid-cols-12` 반응형 0) ④ `retention`(코호트 매트릭스, 레이아웃 컨테이너 `overflow` 미제약으로 뷰포트 밖 출혈) ⑤ `qa-review`·`settings`(반응형 0).

### S.1-MOB 모바일 패턴 카탈로그 (반복 결함 — 토큰/기반에서 일괄 처리)
| 패턴 | 심각도 | 대표 증거 | 일괄 수정 |
|---|---|---|---|
| **iOS 입력 줌**(`<input/select/textarea>` font<16px) | 🟠 광범위(~30+) | `SortableImageCard.tsx:128,135`·`ProductEditorPane.tsx:832`·`contacts:371`·`emails:430`·`support/[id]:211` `text-sm/xs` | 전역 CSS `input,select,textarea{font-size:max(16px,1em)}` 또는 `text-base` 일괄 |
| **터치타깃 <44px**(`p-1/p-1.5/h-7` 아이콘버튼) | 🟠 광범위 | `ProductsListPane:109`·`MediaSection:413`·`PoiListPane:97,106`·`merchants:422`·`orders:244` | `min-h-[44px] min-w-[44px]` 또는 hit-area 확장 wrapper |
| **마이크로 텍스트** `text-[9/10/11px]` | 🟠 다수 | `SortableImageCard:100-116`(9px)·`layout:351`·`sessions:140`(11px mono)·`orders:400`(10px) | 의미전달 텍스트 최소 `text-xs`(12px) |
| **반응형 없는 데이터 테이블/그리드** | 🔴 5+ 페이지 | `support:105`(9-col)·`sessions:119`·`events:117`(grid-12)·`retention:112` | `overflow-x-auto`+`min-w` 또는 `md:hidden` 테이블 / 카드 폴백(orders 패턴 복제) |
| **고정폭 pane 미붕괴** | 🔴 | `match-pois/PoiListPane:87` `w-80 flex-shrink-0`(브레이크포인트 0) | `hidden lg:flex`+모바일 list→detail 푸시(products 패턴 복제) |
| **hover 전용 툴팁/액션**(터치 무반응) | 🟠 | `analytics/product/page:78`·`events/[name]:69`·`retention:151` `title+group-hover`; `upload:108` 복사버튼 | tap 팝오버 또는 상시 표시 |
| **90바 차트 ~3.5px 비가시** | 🟠 | `product/page` MiniBarChart·`events/[name]` 90일 | >30바 다운샘플 또는 라인차트 |
| **`top-[52px]`/`100vh` 모바일 취약** | 🟡 | `contacts:346` `top-[52px]`·`match-pois:35` `100vh`(dvh 아님) | CSS var(헤더h)·`100dvh` |
| **헤더 safe-area-inset-top 누락**(노치 침범) | 🟡 | `layout:371` `h-[52px] sticky` | `pt-[env(safe-area-inset-top)]` |
| **iOS WebView `confirm()` 억제** → 정산 무음실패 | 🟠 | `orders/[id]:123`·`merchants:82,117` native `confirm` | ConfirmDialog 교체(S.3와 동일 수정) |

## S.2 신규 기능/정확성 결함 (8 에이전트 합산·중복제거, §D/§N/§O 기존 제외)
| ID | 심각도 | 결함 | 증거 |
|---|---|---|---|
| **S-F1** | 🔴 | `stats` 매출이 **전 paid 예약을 Node로 적재해 JS SUM**(`.limit()` 없음) → 5만행+ OOM/타임아웃. (§N26 overfetch와 별개 — 이건 stats route) | `api/admin/stats/route.ts:59-71` |
| **S-F2** | 🔴 | 머천트 생성이 **`Math.random()`로 임시 비밀번호 생성**(비-CSPRNG). 안전한 `/create`(crypto.randomBytes)는 dead. UI는 약한 쪽 호출. | `api/admin/merchants/route.ts:117` vs `create/route.ts:46` |
| **S-F3** | 🟠 | 머천트 생성 audit_logs actor가 **관리자 아닌 신규 머천트 user_id**(주석은 "Admin user ID"라 자칭) → 감사 추적 무효. §E-3/§K-7.4 헬퍼 설계에 직접 영향. | `create/route.ts:127-139` |
| **S-F4** | 🟠 | ProductEditor `onMediaChange`가 교차상품 stale-save 가드 우회 → 갤러리 드래그가 상품전환 후 완료 시 **다른 상품 미디어 덮어씀**(무음 데이터 손상). | `ProductEditorPane.tsx:387` |
| **S-F5** | 🟠 | 로케일 전환이 `useEffect([row])`로 `draft`를 즉시 덮어써 **미저장 편집 무음 폐기**(beforeunload·확인 없음). | `ProductEditorPane.tsx:95-105,409` |
| **S-F6** | 🟠 | 머천트 DELETE가 **merchants 삭제 후 user_profiles 역할 리셋** → FK cascade면 역할리셋 no-op, Auth 계정 불일치. | `merchants/[id]/route.ts:208-218` |
| **S-F7** | 🟠 | 머천트 PUT가 빈 body(`{}`) 수용 → `.update({})` no-op인데 **200 success 반환**(무변경 위장). | `merchants/[id]/route.ts:117-122` |
| **S-F8** | 🟠 | 머천트 검색이 **서버+클라 이중 필터**(`page.tsx:177` 클라 재필터 + `:51` 서버) → status+검색 동시 시 모순 결과. effect dep에 `searchQuery` 누락(stale closure). | `merchants/page.tsx:33-35,177-182` |
| **S-F9** | 🟠 | `emails` 페이지가 `response.json()`을 `response.ok` 검사 **전에** 호출 → 비-JSON 5xx 시 파싱 throw로 `finally` 미실행 → **로딩 영구 고착**. | `emails/page.tsx:104-105` |
| **S-F10** | 🟠 | `experiments/[key]` 막대폭이 빈 데이터에서 `Math.max(...[])=-Infinity` → `width:NaN%`(무음 오표시). funnels/[key]·events도 유사 빈배열 spread. | `experiments/[key]/page.tsx:99` |
| **S-F11** | 🟡 | settle 캡처가 `tour_completed`에도 booking을 즉시 `completed`로 — 투어 미실행 시 조기 완료 표기 + 정산후 메일 없음. | `settle/route.ts:175` |
| **S-F12** | 🟡 | `orders/[id]` `holdMsLeft`가 렌더시 `Date.now()` 1회 계산 → "Xh left"/"EXPIRED" 정적(만료 임박 오표시). | `orders/[id]/page.tsx:281-288` |
| **S-F13** | 🟡 | merchant create 폼에 `addressLine2` state는 있으나 **입력 필드 미렌더**(수집·편집 불가). | `create/page.tsx:19` vs JSX |
| **S-F14** | 🟡 | 머천트 `merchant_settings` insert fire-and-forget(에러 삼킴) → 설정 없는 머천트 고아 가능. | `create/route.ts:119-125` |
| **S-F15** | 🟡 | contacts read-마킹 낙관적 업데이트가 PATCH 실패 시 **롤백 없음**(세션 내내 잘못된 read 상태). | `contacts/page.tsx:92-118` |
| **S-F16** | 🟡 | match-pois `dirty`가 `JSON.stringify` 키순서 의존 → API 응답 키 재정렬 시 **첫 로드부터 false-dirty**(Save 즉시 활성). products `detail_payload` 비교도 동일. | `PoiEditorPane.tsx:29-36`·`ProductEditorPane.tsx:129` |

## S.3 UI/UX 시스템 결함 (휴리스틱 — §K-6 드리프트 넘어선 품질)
> 최악 휴리스틱 = **에러 예방/복구**. 핵심: 재사용 자산이 이미 있는데 미사용.
| ID | 항목 | 증거·기회 |
|---|---|---|
| **S-U1** | **`ConfirmDialog`가 이미 존재**(`components/mypage/ConfirmDialog.tsx`) + **Sonner 설치·products에서 사용 중**인데, 레거시 페이지는 27+ `alert()/confirm()` 그대로. | 신규 컴포넌트 발명 불필요 — 기존 채택. merchants/orders/contacts/layout. iOS WebView `confirm` 억제(S.1-MOB) 동시 해결 |
| **S-U2** | **URL 필터 영속 전무**(orders/merchants/contacts/support 전부 useState만) → 새로고침·공유·뒤로가기로 필터 컨텍스트 소실. | `useSearchParams`+`router.replace` 패턴(§P U-8과 연계) |
| **S-U3** | **재fetch 시 전체 스피너 교체**(stale 미유지) → 필터/정렬마다 리스트 전체가 사라짐(최고트래픽 orders). | `isFetching` 오버레이로 전환(데이터 유지) |
| **S-U4** | **날짜포맷 3개 로케일 혼재**(`ko-KR`/`en-US`/무인자) + `getStatusColor` 3곳 복붙. | 공유 유틸 `lib/format/date.ts`·`booking-status.ts` |
| **S-U5** | **support·qa-review가 nav(`adminMenuItems`)에 없음** → 내부 링크로만 도달(IA 결함). nav 그룹핑(운영/소통/콘텐츠/분석/시스템)도 없음. | `layout.tsx:38-51` |
| **S-U6** | **레거시 `/admin/analytics` ↔ `/product/*` 상호 링크/리다이렉트 없음** → 강력한 엔진이 사이드바에서 안 보임(§B 결정 직결). chatbot escalation율은 계산되나 **미렌더**. | `analytics/page.tsx`·`chatbot-analytics/page.tsx:125` |
| **S-U7** | **"Coming Soon: 오토세이브+단축키" 카드가 사실과 반대**(오토세이브는 이미 구현됨 L191) — 라이브 UI에 잘못된 미래약속 표시. | `ProductEditorPane.tsx:709-717` |
| **S-U8** | contacts 관리자 노트·ProductEditor에 **dirty/미저장 경고 부재**(전환 시 무음 폐기). 폼 일반: disabled-on-submit·필드별 에러·autofocus 부재(레거시 전반). | `contacts:148-178` |
| **S-U9** | support 채팅 버블 **정렬 깨짐**(assistant `self-end`가 column flex에서 무효 → 전부 좌측). 메타에 날짜 없이 시각만(멀티데이 모호). | `support/[id]/page.tsx:165-184,177` |
| **S-U10** | 색상 단독 신호(unread dot·상태배지)에 aria/텍스트 보조 없음; 인박스 행 `<button>`에 aria-label 없음; 셀렉트 visible label 없음. | `contacts:292`·`orders:255`(aria-label 0) |
| **S-U11** | chatbot-analytics `p-6`가 셸 `p-4` 위에 **이중 패딩**(40px 거터, 타 페이지 16px); settings는 `gray-*`/`indigo-*`(타 페이지 `slate-*`/`blue-*`). | `chatbot-analytics:113`·`settings:94+` |

## S.4 검증/정정 (에이전트 주장 재검증)
- ❌ **REFUTED — SortableImageCard 케이싱**: 에이전트4가 "파일 없음(케이싱)"이라 했으나 `app/admin/products/_components/sections/SortableImageCard.tsx` **정확한 케이싱으로 실재**(glob 실패였음). CI 빌드 리스크 없음.
- ❌ **REFUTED — "어드민 전부 데스크톱 전용"**: 셸은 모바일 인지(S.1). 정확히는 **셸 OK / 개별 페이지 콘텐츠 파손**.
- ✅ 기존 강화 확인(중복, 신규 아님): D-1 하드코딩0·D-8 cms loadState·D-12 chatbot 30일·D-13 support 더블서밋·B-2 onAuthStateChange·M-6 KST·M-8 프로필 자동생성·N10 qa serial count — 라이브/코드 재확인됨.

## S.5 §R WBS 반영 (모바일/UX를 기반·페이지에 분배)
- **R2(토큰) 확장 — 신규 R2.0 "모바일 기반 + 공유 유틸"(선행):** 전역 입력 16px(iOS줌)·터치타깃 44px 유틸·`text-xs` 최소·`100dvh`·safe-area-inset·`ConfirmDialog`/Sonner 채택·`lib/format/{date,booking-status}` 공유유틸·`useUrlFilters` 훅. **이게 R3 모든 페이지 개편의 기반.**
- **R3(페이지 개편) DoD에 "모바일 패리티" 필수화:** 각 페이지 = 반응형(테이블→카드 폴백) + 터치타깃 + 입력16px + stale-유지 fetch + URL필터 + alert→ConfirmDialog/toast + dirty가드. **우선순위 재정렬(모바일 최악순):** support(R3.x)·match-pois·analytics sessions/events/retention을 상위로.
- **R1(기능 안정화)에 신규 BLOCKER 추가:** S-F1(stats OOM)·S-F2(Math.random 비번)·S-F3(audit actor)·S-F4/S-F5(에디터 데이터손상).
- **§E-3/§K-7.4 audit 설계 정정:** actor=관리자 id 보장(S-F3).
- **nav IA 수정(S-U5)·analytics 엔진 노출(S-U6)** → R3.1/H-2에 편입.

---

# §T. 최종 전수 심층 검수 — 미검수 영역 (Phase 0.12 — 2026-06-24)

> 사용자 지시("에이전트 전수 파견, 지금까지 검수 안 한 부분 완전 재검수, 마지막"). 7 코드 에이전트(미진단 어드민 라우트·Stripe 머니패스·인증/RBAC·챗봇/에이전트·공개 API·공유 lib·고객 머니패스 UI) + **세션 라이브 DB/RLS/storage 스윕(직접)**. 검증 가능한 주장은 라이브 확정(예: **P1 권한상승 — 라이브 CONFIRMED**). **이로써 진단(Phase 0) 종결** — 남은 건 사용자 승인 후 구현(§R).

## T.0 메타 — 가장 중대한 발견 + 굿뉴스
- 🔴🔴 **최중대(라이브 확정): P1 — 임의 고객이 관리자로 자기승격 가능**(RLS `WITH CHECK` 부재). 전 엔진먼트 통틀어 가장 시급. 마이그레이션 1줄로 차단.
- **굿뉴스(검증된 견고함):** ① `requireAdmin`은 **서버 DB 검증**(JWT 클레임 신뢰 아님) — 견고. ② **service-role 키 클라이언트 번들 유출 없음**(39개 `.tsx` 확인). ③ Stripe 웹훅 **서명검증 O**. ④ 머니 cron(recapture/capture-tour-day)은 **fail-closed**(analytics cron만 fail-open=N23). ⑤ pricing 정수 KRW 누적·반올림 **수학 깨끗**(float drift 없음). ⑥ 예약조회 anti-enumeration **설계 자체는 건전**(단 RL 저장소가 문제=CB-2).

## T.1 🔴 권한상승 — P1 (라이브 CONFIRMED, 최우선)
| ID | 심각도 | 결함 (라이브 검증) | 증거 |
|---|---|---|---|
| **P1** | 🔴🔒 **CRITICAL** | `user_profiles` UPDATE 정책 `"Users can update own profile"`의 **`with_check = NULL`**(role 컬럼 미가드) + role CHECK가 `'admin'` 허용 + `authenticated` UPDATE grant=true → **임의 인증 고객이 자기 JWT로 `PATCH /rest/v1/user_profiles?id=eq.<uid>` `{"role":"admin"}` 직접 호출 → 관리자 자기승격**(Next.js 레이어 완전 우회). INSERT 정책도 role 미가드(자기삽입 admin 가능). | 라이브 `pg_policies`: UPDATE with_check=null; CHECK `role = ANY('customer','merchant','admin')`; `has_table_privilege('authenticated',...,'UPDATE')=true` |
| **P1-fix** | — | `ALTER POLICY` UPDATE에 `WITH CHECK (auth.uid()=id AND role = (SELECT role FROM user_profiles WHERE id=auth.uid()))` 또는 role을 user-writable에서 제거 + admin-only SECURITY DEFINER RPC로 역할변경. INSERT도 동일 가드. **🔒 보안 트랙 R9.0 최우선.** | — |

## T.2 인증/세션/RBAC (P2~P11)
| ID | 심각도 | 결함 | 증거 |
|---|---|---|---|
| **P2** | 🔴🔒 | `create-profile`가 `accessToken` 없으면 **무인증 service-role INSERT**(caller `userId`) → 임의 UUID 프로필 생성(기본 customer라 폭발반경 제한). | `auth/create-profile/route.ts:41-65` |
| **P3** | 🟠🔒 | 어드민 UI 보호가 **클라이언트 JS 전용** — middleware가 `/admin/*`에 `NextResponse.next()`(auth 0). SSR 콘텐츠가 직접 fetch/curl에 무방비(개별 API는 requireAdmin로 보호되나 페이지 게이트 부재). | `middleware.ts:253-275`·`layout.tsx:117-263` |
| **P4** | 🟠🔒 | `check-email`이 **무인증 service-role 사용자 enumeration**(이메일 가입여부 oracle), rate-limit 0. | `auth/check-email/route.ts:9-58` |
| **P5** | 🟠🔒 | `merchant/login`이 service-role로 `signInWithPassword` + **전체 session(refresh_token) JSON 응답 반환**(httpOnly 쿠키 아님 → JS 탈취 가능). | `auth/merchant/login/route.ts:26-90` |
| **P6** | 🟠🔒 | `change-password`가 `persistSession:false` anon 클라로 `updateUser` → 세션 미전달 시 **비번 미변경인데 success 반환** 가능. | `auth/change-password/route.ts:35-54` |
| P8 | 🟡🔒 | 머천트 create 응답에 평문 임시비번(D-4 재확인, "remove in production" 주석). P9: verification code가 비-prod 응답에 노출. P10: `createServiceRoleClient` alias(우발 RLS 우회 위험). P11: delete-user race. | 각 라우트 |

## T.3 Stripe 머니패스 (W1~W15)
| ID | 심각도 | 결함 | 증거 |
|---|---|---|---|
| **W-1** | 🔴 | `payment_intent.succeeded` 핸들러가 상태가드 없이 `paid/captured` 덮어씀 → **취소/노쇼 예약을 paid로 되살림**. | `stripe/webhook/route.ts:131-162` |
| **W-3** | 🔴🔒 | `recapture-holds`·`capture-tour-day-payments` cron이 **`?secret=`를 URL로 수용** → 로그/Referer 유출 시 누구나 오프세션 청구 트리거. | `cron/recapture-holds/route.ts:37-44` |
| **W-10** | 🟠 | **환불 라우트 부재** + `charge.refunded` 핸들러 부재 → 캡처 후 환불은 Stripe 대시보드 수동만, DB 영구 `paid` → **정산 대사 붕괴**(§G·O.3 C8 직결). | grep `stripe.refunds.create`=0 |
| **W-9** | 🟠 | capture-tour-day가 `booking_date OR tour_date` 매칭 → **예약 시점(투어 30일 전) 조기 청구** 가능. | `capture-tour-day-payments/route.ts:84` |
| **W-2/W-6** | 🔴/🟠 | settle↔webhook 경쟁(락/멱등키 없음, W-2); recapture가 DB write 실패 시 **중복 PI 생성**(이중 hold/이중 청구, W-6). | settle+webhook; recapture `:131-238` |
| W-5/W-8/W-11/W-12 | 🟠 | 캡처 웹훅 멱등키 없음→`paid_at` 손상(W-5); 고객취소가 SI/PI 미취소(카드 vault 잔류, W-8); `async_payment_failed`가 로그만→ghost confirmed(W-11); stale `authorized`로 재시도 차단(W-12). | webhook/checkout |

## T.4 챗봇/에이전트 파이프라인 (CB1~CB15)
| ID | 심각도 | 결함 | 증거 |
|---|---|---|---|
| **CB-2** | 🔴🔒 | 예약조회 lockout·일반 RL이 **인메모리 Map**(서버리스 인스턴스 간 미공유) → 람다 분산으로 **예약 enumeration/LLM비용 무제한**. 예약조회 PII 가드의 핵심 방어 무력화. | `lib/chatbot/bookingLookupRateLimit.ts`·`requestRateLimit.ts` |
| **CB-1** | 🔴🔒 | `/api/agent/v1/quote`·`/api/agent/mcp`에 **CORS `*`**(HMAC 토큰·agent_reservations write 머니인접) → CSRF. | `agent/v1/quote:23`·`agent/mcp:33` |
| **CB-3** | 🟠🔒 | `debugNoSideEffects` 플래그가 `NODE_ENV` 게이트 → 프리뷰/스테이징서 로깅·예약생성·핸드오프 우회. | `assistant/route.ts:642,885` |
| **CB-5** | 🟠 | `createQuoteBooking`이 **무인증 service-role로 bookings write** → 임의 이메일 PENDING 예약 양산. | `lib/chatbot/quoteFlow.ts:259-306` |
| CB-6/12/15 | 🟠/🟡 | 메모리 요약 프롬프트 인젝션 영속(CB-6); 피드백 위조 쿠키 표 조작(CB-12); MCP 배치 무제한 DB 고갈(CB-15); RAG chunk raw 인젝션(CB-10). | 각 |

## T.5 공개/고객 API (PA — 신규 다수)
| ID | 심각도 | 결함 | 증거 |
|---|---|---|---|
| **PA-1** | 🔴🔒 | `emails/reminders` **GET이 CRON_SECRET 없이 POST 위임** → 누구나 대량 리마인더 메일 발송. | `emails/reminders/route.ts:169-173` |
| **PA-2** | 🔴🔒 | `upload` **DELETE 소유권 검사 0** → 인증유저가 임의 path/bucket 파일 삭제(N17 강화 확정). | `upload/route.ts:234-281` |
| **PA-3** | 🟠🔒 | `tour-rooms/[bookingId]/messages` **`senderRole` 클라 제어** → 고객이 `system` 역할 메시지 위조. | `tour-rooms/.../messages:151-163` |
| **PA-4** | 🟠🔒 | tour-rooms `spot-events`/`events`(SSE)가 **게스트 이메일 스프레이**(bookingId+이메일 추측, lockout 0) → 예약 enumeration. | `spot-events:116-125`·`events:69-79` |
| **PA-5** | 🟠🔒 | `itinerary/match`·`tour-product/match-explanation` **무인증·무 rate-limit AI**(비용) + match-explanation은 **client `parsed_query` → 프롬프트 인젝션**. | `itinerary/match:49`·`match-explanation:36-57` |
| **PA-6** | 🟠🔒 | `contact`·`send-verification-code` **rate-limit 0**(스팸/이메일 폭탄); reviews `is_visible:true` 강제(모더레이션 우회); reactions GET이 `user_id` 노출; guest 예약이 **결제 전 재고 차감**(DoS); receipt 토큰 `?token=` 쿼리. | 각 라우트 |

## T.6 미진단 어드민 라우트 (AR — 10개 전부 requireAdmin 보유)
| ID | 심각도 | 결함 | 증거 |
|---|---|---|---|
| **AR-1** | 🟠 | `tour-content/generate` **로케일/페이로드/rate 캡 0** → OpenAI+TTS 비용 드레인; `sourcePayload` 프롬프트 인젝션; 공개버킷 자동생성. | `tour-content/generate/route.ts:60-90` |
| **AR-2** | 🟠🔒 | `email-diag`의 **`supabase_otp` 모드가 임의 이메일 OTP 발송**(스팸/쿼터) + 시크릿 설정여부 노출. | `email-diag/route.ts:113-127` |
| **AR-3** | 🟠 | `tours` 픽업포인트 insert 실패 무음(201 success)·**비원자 delete+insert 교체**(insert 실패 시 픽업 전손실). | `tours/route.ts:104-123,299-325` |
| **AR-4** | 🟡 | **N33 site_settings 부재로 3개 write 라우트 하드 500**: `homepage-product-card-images PUT`·`settings PUT`·`cms/section-images PUT`(GET은 안전 degrade). bus-detail 날짜 무검증. | mapping |

## T.7 공유 lib (LIB1~LIB8)
| ID | 심각도 | 결함 | 증거 |
|---|---|---|---|
| **LIB-1** | 🟠🔒 | `sendBookingCancellationEmail` 외 3개 구 이메일 템플릿이 **사용자 문자열 escape 없이 raw HTML 삽입** → 트랜잭션 이메일 XSS(신규 confirmation만 escapeHtml). | `lib/email.ts:539-592,686-695` |
| **LIB-3** | 🟠 | **FX 폴백 1480 하드코딩 ~7% 오차** → FX API 다운 시 서버권위 예약가 stale, Stripe 틀린 USD 청구(클라+서버 동일폴백→mismatch 가드 미발화); 30분 쿨다운 창 전체 영향. | `lib/exchange/usdBasedRates.server.ts:29,91` |
| **LIB-2** | 🟡 | DMZ 7-9인 차량등급 오류(`solati` vs PAX_TIERS `van`). LIB-5: notifications 무음실패 무알림(N25). LIB-6: PAYMENT_STATUS 라벨 한국어 유실. isPeakSeason 교차연도 취약. | 각 |
| **LIB-good** | ✅ | service-role 키 클라 번들 유출 **없음**(검증) — `import 'server-only'` 가드만 권장. 포맷/반올림 깨끗. | `lib/supabase.ts`·`lib/format/*` |

## T.8 고객 머니패스 UI (CK1~CK16)
| ID | 심각도 | 결함 | 증거 |
|---|---|---|---|
| **CK-1** | 🔴 | 카트가 **유령 10% 세금 표시·합산**(`subtotal*0.1`)인데 체크아웃/서버는 미적용 → **표시 $110, 청구 $100**. | `cart/page.tsx:335-336` |
| **CK-2** | 🔴 | 프로모 검증이 **GET인데 라우트는 POST만** → 항상 405 → **프로모 할인 영구 미적용**(Codex "쿠폰 깨짐" 확정). | `cart/page.tsx:262` vs `promo-codes/validate:8` |
| **CK-3** | 🔴 | 프로모가 작동해도 `/api/bookings`가 프로모 무인지 → **PRICE_MISMATCH 400 → 예약 실패**. | `cart:276-287`·`bookings:299` |
| **CK-9** | 🟠 | 빌더 체크아웃이 `booking.currency` null/stale 시 기본 `'usd'` → **800000 KRW를 $8000로 Stripe 청구** 위험(N3 case 결함과 결합). | `itinerary-builder/checkout:152`·`stripe/checkout:120` |
| **CK-6/7** | 🟠 | stripe/checkout 더블서밋 경쟁(auth_pending 창, CK-6); 예약이 Stripe 셋업 전 생성→Stripe 실패 시 **고아 PENDING + 복구 UI 없음**(CK-7). | checkout |
| **CK-mob** | 🟠 | **모바일서 결제 버튼 비-sticky**(폼 아래로 밀려 화면 밖); 체크아웃 입력 **15px → iOS 줌**; QuoteModal 입력 14px 줌; 카트 alert/confirm; aria-required 부재. | `checkout:653`·`mypage-ui.ts:143`·`QuoteModal:169` |

## T.9 DB/RLS/storage 라이브 스윕 (직접)
| ID | 결과 |
|---|---|
| ✅ | **RLS 비활성 테이블 0** (75개 전부 RLS on). N31(13개 no-policy)는 service-role 전용 → 의도 확인만(§J #13). |
| ✅ | anon 실행가능 함수 대량이나 **대부분 pgvector/pg_trgm 확장연산자+트리거**(무해). 위험 SECURITY DEFINER는 **N27 그대로**(신규 없음). matcher/RAG 함수는 SECURITY INVOKER(RLS 적용, 의도된 공개). |
| **N34** | 🟡🔒 storage 버킷 4개 전부 public; **`email-assets`·`product-images`는 size/MIME 제한 없음**; INSERT 정책 `"Auth Upload"` role=public → 라우트 우회 직접 업로드 여지(N30/N17과 함께 보안트랙). |
| ✅ | anon 읽기 매트뷰 = `analytics_sessions_daily`·`analytics_events_daily`(**N29 재확인**). |

## T.10 §R WBS 반영 (트랙 확장)
- **🔒 보안 트랙(R9) 대폭 확장 — 신규 R9.0 최우선 = P1 RLS WITH CHECK(라이브 확정 권한상승)**. 이어 P2(create-profile)·PA-1(reminders GET)·PA-2(upload DELETE)·W-3(cron secret URL)·CB-1(CORS)·CB-2(durable RL)·W-1(webhook 상태가드). 그 뒤 P3~P11·PA-3~6·AR-2·CB-3~15·N34·LIB-1(이메일 XSS).
- **신규 💴 머니패스 무결성 트랙:** W-1·W-2·W-6·W-9·W-10(환불 라우트+`charge.refunded`)·LIB-3(FX 폴백)·CK-1(세금)·CK-2/3(프로모)·CK-9(통화). **§G 정산은 W-10 환불경로 없이는 대사 불가** → §G-6에 환불 핸들러 선행 추가.
- **고객 체크아웃 UX/모바일:** CK-mob(sticky 버튼·iOS줌·alert) → R3 고객측(어드민과 별개) 또는 별도 트랙.
- **공통 인프라:** durable rate-limit(Upstash/KV)는 CB-2·PA-5/6·P4의 공통 의존 → 단일 기반 작업(§Q에 준비사양 추가 대상).
- **관측성(WS-A) 격상:** notifications 무음실패(LIB-5)·이메일 드롭·FX 폴백·결제 불일치 = 무알림 다발 → 구조화 로그+알림 1순위.

---

# §U. 프리미엄 모바일 SaaS 도약 + 완성도 보정 (Phase 0.13 — 2026-06-24)

> 사용자 지시("전 Phase 누락 점검 + 모바일 UI를 프리미엄 SaaS로 도약 — 조작편의·가독성·모바일 적합도 세계 최고 수준"). 7 에이전트(전체플랜 누락스윕 + 프리미엄 모바일 6: IA·인터랙션·가독성·폼/머니·디자인시스템·페이지청사진) + 라이브 검증. **실행 상세(컴포넌트/토큰/청사진/마이그레이션 맵)는 컴패니언 문서 `docs/admin-premium-mobile-design-spec-2026-06-24.md` (= 이 §U의 buildable spec).**

## U.0 완성도 보정 — 전체 플랜 누락 스윕 (Track A)
### U.0.1 진짜 blind spot (8 라운드 전부 미언급 — 신규)
| 표면 | 사실 | 조치 |
|---|---|---|
| **`app/merchant/**` 머천트 포털 전체** | 6 페이지(login·orders·products·analytics·settings + page)+`layout.tsx` + `api/merchant/orders`·`api/merchant/products`. **인증/RLS/데이터 스코프 미감사.** 라이브 확인됨. | 신규 감사 트랙 R10(머천트 포털) — 어드민과 별개 사용자(merchant role). P1 권한상승과 함께 RLS 스코프 점검 |
| **`app/dashboard/**`** | 4 페이지(page·bookings·members·stats). 미상 레거시/2차 대시보드. | 정체·인증 확인 후 폐기 또는 흡수 결정(§J #15) |
| 미언급 공개 API | `telegram/support-webhook`(웹훅 인증?)·`haenyeo-status`·`tour-mode/bookings`·`tours/[id]/availability`·`tours/destinations`·공개 `tours`·`user-settings`·`wishlist`·`weather/forecast`·`logs/error`·공개 `cms/content`·**`assistant/live`(3번째 챗봇 엔드포인트)**·**`tour-product/match`(주 매처)**·`analytics/identify`·`analytics/experiments/active`·`agent/openapi.json`. | 🔒 보안 트랙 R9에 "공개 API 2차 스윕" 추가 |
### U.0.2 검증으로 정정/안심 (라이브/코드 확인)
- ✅ **`api/settlements/route.ts`는 POST에 `requireAdmin`(:93)·GET에 getAuthUser(:22) 보유** → "auth 가드 부재" 우려 **REFUTED**(가드됨).
- ✅ **vercel.json 크론 5개 확인**: emails/reminders(9시)·recapture-holds(19시)·capture-tour-day(1시)·analytics-refresh(17시)·analytics-anonymize(18시). cron 스케줄 자체는 정상(emails/reminders GET 우회=PA-1만 버그).
- ✅ SortableImageCard 케이싱·"전부 데스크톱전용"은 이미 §S.4에서 REFUTED.
### U.0.3 본문 stale 정정 (§N이 refute한 텍스트가 본문에 잔존 — 명시 정정)
| 위치 | stale | 정정 |
|---|---|---|
| §D-15 "health/route.ts:20 미배포시 500" | §N.2가 라이브 실재 확인 | **함수 라이브 실재(프로덕션 정상), 잔여=repo 드리프트(§N.1)**. §D-15 단독 독해 주의 |
| §D-11 "설정 저장은 되나 강제 안함" | N33이 site_settings 부재 확인 | **저장도 무력**(테이블 부재로 쓰기 에러, 읽기는 기본값 위장). D-11+N33 합본 |
| §K-7.7 / §K-7.3 "N1 RPC 신설" | §N.2 라이브 실재 | **신설 아님 → repo 마이그레이션 흡수**(드리프트 정합) |
| §G-6.2 RPC v2 SQL 블록 | O.3 C2 정정이 블록에 미반영 | **구현 시 O.3 C1·C2·C4·C5·C7·C8 델타 반드시 적용**(블록 verbatim 구현 금지) |
### U.0.4 WBS 고아 입양 (티켓 없던 결함 → §R 배치)
- **R1 추가:** S-F6~F16(머천트 DELETE순서·빈PUT200·이중필터·emails 500·experiment NaN·settle조기완료·holdMsLeft·addressLine2·merchant_settings·contacts롤백·false-dirty)·LIB-2(DMZ 차량)·LIB-6(라벨)·AR-3(픽업 비원자).
- **R9 추가:** PA-3~PA-6·CB-3·CB-6/10/12/15·N32(search_path·extension·leaked-pw)·N34(storage)·공개 API 2차 스윕·머천트 포털 RLS.
- **💴 머니패스 트랙 추가:** W-2·W-5·W-8·W-11·W-12·LIB-3(FX)·CK-1/2/3/6/7/9.
- **WS-A~J(횡단 10) 각각 R-티켓화**(관측성=1순위: notifications/이메일/FX/결제불일치 무알림 다발). **U-1~U-10 각 R-서브티켓.**

## U.1 프리미엄 모바일 — 핵심 결정 (binding)
> 진단(§S)이 "무엇이 깨졌나"였다면, §U는 "세계 최고 프리미엄 SaaS로 어떻게"다. 전부 **신규 의존성 0**(기존 토큰·`components/ui/*`·framer-motion·sonner·ConfirmDialog).
| # | 결정 | 근거 |
|---|---|---|
| 1 | **바텀내비 5슬롯 재편**(홈·주문·**수신함**(contacts+support)·챗봇·더보기) + More 그룹핑 + **support/QA를 nav에 추가** | 현 12 flat·support·QA nav 부재(IA결함) |
| 2 | **`AdminPageShell` 공통 크롬 계약**(sticky헤더+safe-area-inset-top+필터바+바텀패딩) | 12/29 무반응형 페이지가 1줄로 패리티 |
| 3 | **시트 우선**(상세·필터·정산=바텀시트) + **SwipeRow**(스와이프 액션) + **낙관적+Undo** + **재fetch stale 유지** | 현 풀스피너 교체·confirm()·무제스처 |
| 4 | **alert/confirm 전수 폐기 → toast(Sonner)+ConfirmDialog**, **Toaster 미마운트 → 추가** | iOS WebView `confirm()` 무확인 true 반환 = **정산 머니버그** |
| 5 | **디자인 토큰 확정**(`--admin-*` surface/border/shadow + 간격 4/6/8/12 + radius 12px + **tabular-nums** + 단일 accent brand.blue) | 3팔레트·raw hex·4 H1·`text-[9/10/11px]` 44곳 |
| 6 | **5역할 타입 램프 + DataCard 폴백**(모든 테이블) + **차트 모바일화**(스파크라인·주간버킷·frozen 히트맵) | support 9-col·sessions grid-12·90바 ~3.5px |
| 7 | **폼 16px 입력 + inputmode + sticky CTA + 머니 확인 시트** | AUTH_INPUT 15px(iOS줌)·체크아웃 CTA 화면밖·정산 확인 부재 |
| 8 | **프리미엄 다크모드**(navy-tinted oklch) + Lucide stroke 규율(이모지 제거) + 절제된 모션(skeleton shimmer·spring 드로어) | "generic 내부툴"→"프리미엄 SaaS" |

## U.2 페이지 청사진 요약 (4 템플릿 — 상세는 컴패니언 §8)
- **대시보드:** 액션 큐 strip(대기예약·미처리문의·에스컬) + 매출 KPI 2-up(USD/KRW) + 스파크라인을 above-fold; floating help 제거.
- **주문:** sticky 필터바+검색(신규) + DataCard 스와이프; 상세에 **sticky 바텀 머니 액션바**(청구/현장/노쇼, hold상태색).
- **통합 인박스(`/admin/inbox` 신규):** 3소스 UNION + 카테고리칩 + 스와이프-해결 + 바텀시트 상세/답장 컴포저.
- **분석:** KPI 카드 내 스파크라인(별도 차트 제거) + SessionCard(grid-12 대체) + frozen-column 히트맵.

## U.3 §R WBS — 프리미엄 모바일 트랙 (R2.0 확장 + R3 재정의)
- **R2.0(기반, 선행) 대폭 확장:** Toaster 마운트 + `AdminPageShell` + 토큰(`--admin-*`·tabular-nums·radius12) + 16px 입력 전역 + 44px 터치 + 100dvh/safe-area + `lib/admin/haptics`·단일 Spinner·`SwipeRow`·skeleton·`useUrlFilters`·Lucide 일괄. **이게 R3 전 페이지의 빌드 기반.**
- **R3(페이지) DoD 강화:** 청사진(U.2/컴패니언§8) 순 + 모바일 패리티(반응형·터치44·16px·stale유지·URL필터·toast/ConfirmDialog·dirty가드·inputmode·다크·a11y). 우선순위: 머니 안전 직결(orders/[id] confirm→머니시트·support 더블탭·AUTH_INPUT) → 대시보드 → 주문 → 통합인박스 → 분석.
- **신규 R10 머천트 포털 트랙**(U.0.1) — RLS 스코프·인증 감사 후 모바일 패리티.

## U.4 신규 오픈 입력 (§J)
- **J-15** 🔲 `app/dashboard/**` 정체·존속 결정(레거시 폐기 vs 흡수). **J-16** 🔲 다크모드 도입 범위(어드민 전용 vs 전사). **J-17** 🔲 통합 인박스(`/admin/inbox`)가 contacts/emails/support 3페이지를 대체할지(§E-4 확정).

---

# §L. 세션 인수인계 (다음 세션이 100% 이어받기 위한 단일 요약)

## L-0. 한 줄 상태
어드민 대시보드 전면 개편 **플랜 수립·검증 단계**. **코드는 아직 한 줄도 안 고침**(사용자 지시: 진단·플랜만). 산출물 = 이 문서 1개. 브랜치 `claude/admin-dashboard-upgrade-yvb88c`.

## L-1. 지금까지 (Phase 0~0.8 ✅, §A·§C 참조)
- **0 진단**(§D 기능·§E 신규기능·§F 통계·§G 세무/정산·§H UI/UX·§J 오픈입력): 5개 도메인 병렬 코드감사 + 미국 세법 리서치.
- **0.5 검증**(§K): 전 주장 코드 재대조 → C1~C12 정정(과장/오인용 수정, §D 본문 반영), N1~N10 신규결함, R1~R4 위험.
- **0.6 UI 감사**(§K-6): 토큰+`components/ui/*` 16개가 존재하나 어드민 100% 미사용 → §H "신규 도입→채택"으로 정정. 현재값→토큰 매핑표.
- **0.7 기능 설계**(§K-7): quote_drafts·빌더 이벤트+funnel·귀속FK+익명화정합·audit 헬퍼·unified_inquiries 뷰·상품 funnel matview **구체 DDL**(마이그레이션 대조 완료).
- **0.75 §G 정산/세무**(§G-6): RPC/GRANT/settle 라우트/스키마 직접 재검증(F1~F8) → tours.cost_price·bookings 원가/FX/Stripe·settlements basis/통화·merchants W-8 **DDL** + **RPC v2**(원가기준 `fee=customer−cost`·1정산1통화) + **R1 라벨링 브리지**(과거 flat_rate 동결·재계산 불필요) + **R2 원자배포**(4-arg→6-arg, GRANT 재발급) + **R3 FX 신규건만**. 신규결함 F3(RPC 통화혼입).
- **0.8 Codex 통합**(§M): 3 감사 에이전트 file:line 검증 → 공개 보안 BLOCKER 4(N11 inventory·N13 promo·N14 checkout IDOR·N16 confirm-email IDOR) + MAJOR 다수 + ⚙️어드민(N23 cron fail-open·N24 webhook·N25 notifications드리프트·N26 overfetch). **REFUTED 2**(R5 RAG 완전연결·R6 reviews=폴더), IMPRECISE 6. 별도 doc 생성 거부.
- **0.9 라이브 DB 대조**(§N): atockorea MCP 라이브 연결(K-0 해소). **마이그레이션 드리프트(repo 32 vs live 48, ~9만 일치 — pending-db-apply 수동 워크플로)** = BLOCKER급 거버넌스. N1 REFUTED(라이브 실재)→드리프트 재분류. **N27**(anon/PUBLIC이 REST로 비가역 PII 익명화 RPC 호출, BLOCKER)·N28(contact_inquiries permissive insert)·N29(matview API 노출)·N30~N32. §G-6 DDL 라이브 충돌0·F1~F3(통화혼입 ACTIVE: krw+usd 실데이터)·R1(UNIQUE) 라이브 확정. payments/notifications 라이브 부재 확정. perf 62 rls_initplan/62 multi-policy/134 unused-index.
- **0.10 완전화 감사**(§O~§R): 3 감사 에이전트 + 라이브 검증. **N33**(site_settings 어떤 스키마에도 부재 → D-11 설정·D-8 CMS·홈카드 영속 전부 무력, BLOCKER)·**B-1**(노쇼가 위약금 아닌 전액 청구, 돈 BLOCKER)·B-2(layout onAuthStateChange 없음)·B-3(상태 state machine 없음)·M-4(투어 DELETE 예약무시)·M-6(KST 타임존)·M-7(형제로케일 덮어쓰기)·M-8(layout 프로필 자동생성). §G-6 DDL **12 정정 델타**(O.3) — C#3 FOR UPDATE는 라이브 probe로 **REFUTED**(구문 유효). 누락 횡단 워크스트림 WS-A~J(관측성·테스트·롤백·rate-limit·i18n·a11y·perf·DR·RBAC·시크릿). 업그레이드 U-1~U-10(§P). 준비사양 §Q(N27 SQL·정합 런북·Phase1 턴키). **실행 WBS §R**(PR단위 티켓 R0~R9).
- **0.13 프리미엄 모바일 + 완성도 보정**(§U + 컴패니언 `docs/admin-premium-mobile-design-spec-2026-06-24.md`): 7 에이전트(누락스윕+프리미엄모바일6). **blind spot: `app/merchant/**` 포털(6p+2api)·`app/dashboard/**`(4p)·미언급 공개API 다수**(assistant/live·tour-product/match·wishlist·user-settings 등). 프리미엄 결정8(바텀내비5+수신함통합·`AdminPageShell` 공통크롬·시트우선+SwipeRow+낙관적Undo·alert/confirm 전수폐기→toast/ConfirmDialog+Toaster마운트·`--admin-*` 토큰+tabular-nums+radius12·5역할 타입램프+DataCard·폼16px+머니확인시트·navy 다크모드). 4 페이지 청사진(대시보드 액션큐·주문 sticky머니바·통합인박스·분석 스파크라인/frozen히트맵). 본문 stale 정정(D-11/D-15/N1/G-6.2). WBS 고아 입양(S-F6~16·PA-3~6·WS-A~J·U-1~10). 신규 R10 머천트포털. **검증: settlements requireAdmin 보유(REFUTED)·cron 5개 확인.**
- **0.12 최종 전수검수**(§T): 7 에이전트(미진단어드민라우트·Stripe머니패스·인증RBAC·챗봇·공개API·lib·고객UI) + 라이브 DB/RLS/storage 스윕. 🔴🔴 **P1 라이브확정: 고객→admin 권한상승**(`user_profiles` UPDATE/INSERT RLS에 role WITH CHECK 부재 → PostgREST 직접 PATCH로 자기승격). W1-15 머니패스(**환불 라우트 부재 W-10**·webhook 상태가드 W-1·cron secret URL W-3·캡처 조기청구 W-9)·CB1-15(**예약 enumeration: 인메모리 RL CB-2**·CORS* CB-1·무인증 챗봇예약 CB-5)·PA(reminders GET 메일발송·upload DELETE IDOR)·CK1-3(카트 유령세금·프로모 GET/POST 깨짐)·LIB-1(이메일XSS)·LIB-3(FX폴백 7%)·N34(storage). **굿뉴스: requireAdmin 서버DB검증·service-role 번들유출0·웹훅서명O·머니cron fail-closed·pricing 수학 깨끗.** 보안트랙 R9 대폭확장 + 💴머니패스 무결성 트랙 신설. **진단(Phase 0) 종결.**
- **0.11 섹션별 딥리뷰 + 모바일/UX**(§S): 8 에이전트. **모바일 부분 사용가능**(셸은 햄버거+드로어+하단탭으로 모바일 인지 — "전부 데스크톱전용" REFUTED / 그러나 29p중 12p 반응형0, 최악 support·match-pois·sessions·retention). 신규 기능결함 **S-F1**(stats 매출 OOM)·**S-F2**(머천트 비번 `Math.random()` 비-CSPRNG)·**S-F3**(audit actor=관리자 아닌 신규머천트)·S-F4/F5(에디터 교차상품/로케일 데이터손상)·F6~F16. UX 시스템 **S-U1**(ConfirmDialog·Sonner 기존자산 미사용→27+ alert/confirm)·S-U2(URL필터 영속0)·S-U3(재fetch 스피너교체)·S-U4(날짜포맷/getStatusColor 중복)·S-U5(support·qa-review nav 부재 IA)·S-U6~U11. 모바일 패턴 카탈로그(iOS줌·터치44px·micro텍스트·테이블폴백) → **R2.0 기반 티켓** 신설, R3 페이지 DoD에 모바일패리티 필수화. **진단 종료점 — Phase 1 착수 권고.**

## L-2. 다음 할 일 (우선순위)
1. ✅ **③ §G 정산/세무 데이터모델 + 마이그레이션 브리지 — 완료**(§G-6). 다음 세션은 이 설계를 Phase 4 마이그레이션으로 구현(사용자 승인 + §J #2/#6/#8~10 입력 후).
2. **사용자 결정 대기(블로킹):**
   - **§J #11 — 공개 보안 트랙**: §M의 N11/N13/N14/N16(BLOCKER IDOR/무인증) 등을 **어드민 Phase와 별개로 즉시 패치할지** 결정. (이건 어드민 개편이 아니라 라이브 서비스 보안 — 가장 시급할 수 있음.)
   - **§J #2 소유구조 / #6 원가소스 / #8~10 정산 정책** — Phase 4·6 블로커.
3. ✅ **④ 라이브 DB 대조 — 완료**(§N). atockorea MCP는 **이미 연결돼 있었음**(`mcp__atockorea__*` 사용). K-0 해소.
4. ✅ **⑤ 플랜 완전화 감사 — 완료**(§O~§R). 모든 가능 문제·업그레이드 상정 → §O(완전화)·§P(업그레이드)·§Q(준비사양)·§R(WBS). 실제 코드/DB 구현만 제외하고 준비스텝 완료.
5. **실행 = §R WBS 순서** (PR단위):
   - **R0 선행 게이트**(코드 전): R0.1 N27 REVOKE(§Q-1, 1줄·즉시) → R0.2 마이그레이션 정합(§Q-2 런북) → R0.3 미진단 라우트 진단(§O.1).
   - **R1 기능 안정화** → R2 토큰 → R3 UI → R4 데이터(§G-6 O.3 델타 반영) → R5 통계 → R6 세무(SIGN-OFF 후) → R7 신규기능 → R8 검증.
   - **R9 🔒 공개 보안 트랙**(별도 PR, 어드민 독립): N11/N13/N14/N16/N27/N28~N30/N15/N17~21/N24.
6. **사용자 결정 대기(블로킹)**: §J #11(공개보안 트랙)·#12(마이그레이션 정합)·#13(RLS no-policy)·#2/#6/#8~10(정산·세무). + 코드/DB 수정 착수 승인(지금까지 플랜만).

## L-3. 절대 잊지 말 컨텍스트 / 함정
- **코드 수정 착수 전 사용자 승인 필수** (지금까지 "플랜만"). 착수 시 Phase 1부터.
- **§J 오픈입력**: 등록 주=Wyoming ✅확정 / 소유구조(외국인?)·수익인식(gross·net, CPA판정)·tenant 한국수행·미국인 계약자·머천트 원가소스 = 미정.
- **세무는 절대 자율 제출 금지** — 데이터·초안 워크시트까지만, CPA/세무변호사 SIGN-OFF 게이트(§G-5).
- **방법론**: 병렬 감사는 Agent(general-purpose) 사용. ⚠️ **에이전트에게 "하위 에이전트 spawn 금지 + 최종 메시지로 직접 반환" 명시** — 안 하면 손자 에이전트가 부모에게 전달 못 해 결과 유실됨(이번 세션 교훈).
- 모든 file:line 주장은 코드 직접 대조로 검증됨(§K). 새 주장도 동일 기준 유지.
- 작업 후 항상 `git add` → commit(Co-Authored-By/Claude-Session 푸터) → `git push -u origin claude/admin-dashboard-upgrade-yvb88c`.

## L-4. 핵심 사실 압축 (재조사 불필요)
- 토큰·`components/ui/*`(16) + `components/admin/*`(2: BookingStatusBadge·ImageUploader) 존재, 어드민 미사용.
- 정산 모델이 flat 10%만 — 원가/운영수수료/FX 미포착(=핵심 결함). settle 라우트 자체는 Stripe서 금액 읽고 멱등(견고).
- 자체 analytics 엔진에 집계 수학 버그 다수(§D-15: visitors distinct 합산·funnel 세션한정·retention left-censor·experiments filter 폐기).
- N1 재정의(§N.2): `anonymize_old_analytics`·`analytics_health_snapshot`·`refresh_analytics_materialized_views`는 **라이브 실재**(프로덕션 정상). 진짜 문제 = **repo migrations 누락(§N.1 드리프트)** → CI/reset에서만 부재. **N25 notifications·payments도 라이브 부재 확정.**
- **마이그레이션 드리프트(§N.1)**: repo `supabase/migrations/`(32)와 라이브(48)가 크게 갈림(`pending-db-apply` 수동 적용). repo로 라이브 재현 불가 → Phase 4 선행 정합 필수.
- **N27(§N.3, 라이브 BLOCKER)**: analytics maintenance 함수가 PUBLIC/anon에 EXECUTE → 누구나 REST로 비가역 PII 익명화 호출. 정산 RPC는 REVOKE됨(대조). REVOKE 한 줄로 차단.
- 이벤트 인제스트: `event_name` free-form, payload 평면 스칼라 → 신규 이벤트 등록 불필요.
- **§G-6 핵심**: RPC 실제 4-arg `(uuid,date,date,numeric)`+GRANT가 그 시그니처에 묶임(호출부는 3-arg). RPC가 통화필터 없이 `SUM(final_price)`→usd/krw 혼입(F3). tours 원가컬럼·bookings charge/fee/FX·코드 FX포착 전무. R1=과거 정산 재계산 불필요(라벨링만), R2=시그니처 변경 원자배포+GRANT 재발급, R3=FX 신규건만.
- **§M 핵심(Codex 통합)**: 공개 보안 BLOCKER 실재 — `/api/inventory`·`/api/promo-codes` 무인증, `/api/stripe/checkout`·`confirm-email` IDOR, cron fail-open(N23). **RAG는 완전 연결됨**(Codex 오류 R5). Codex 무검증 인용 금지 — verdict가 사실.
- **방법론 함정**: 작업 브랜치는 **로컬 부재 → `git fetch origin` 후 `origin/claude/admin-dashboard-upgrade-yvb88c`에서 워크트리**(`C:\Users\sangsong\atockorea-admin`)로 작업(메인 working dir은 타 세션과 경합). CLAUDE.md·플랜은 이 브랜치에만 존재.
- **라이브 DB(§N)**: `mcp__atockorea__*` 도구로 atockorea(`cghyvbwmijqpahnoduyv`) 직접 조회 가능(읽기 전용 유지, 스키마 변경 금지 — 플랜만). **repo migrations ≠ live**(§N.1) — DB 사실은 라이브 우선, repo 마이그레이션만 믿지 말 것.
- **N27/N28/N29(§N.3)**: Supabase advisor가 잡은 라이브 보안결함 — anon이 REST로 SECURITY DEFINER PII 함수 실행·contact_inquiries permissive insert·matview API 노출. 어드민 코드 밖이지만 즉시 리스크 → 🔒 보안 트랙.
- **신규 advisor 재실행 권장**: DDL 변경(Phase 4) 후 `mcp__atockorea__get_advisors`(security/performance) 재실행해 RLS·grant 회귀 확인(U4 게이트).
- 분석 진짜 화면은 `/admin/analytics/product/*`(모던), nav의 `/admin/analytics`는 placeholder(폐기 대상).
