# CLAUDE.md — 프로젝트 메모리

## 🔴 진행 중 (최신): 스마트앱 **UI/UX 감사 트랙** — U9 수정 중 (통합 트랙 UI 티켓을 흡수)

**이어받으면 이것부터:** **`docs/smartapp-uiux-audit-master-plan-2026-08-03.md`** (§4 루브릭 6축 · §5 WBS)
**차기 트랙 플랜(2026-08-04 수립, 미착수):** `docs/smartapp-grammar-uiux-sweep-plan-2026-08-04.md` —
메신저 동사 격자(전달·공유·검색·이모지 피커 등 ✗ 7종은 **후보이지 결함 아님**, §5 사장님 결정 6건) +
미검 영역 스캔(판정불가 하니스 12·rally 0/5·스킨 3/10·관제/D-1/종료 후 흐름) + 업그레이드 후보 발굴.
**원장:** `docs/audit/UIUX-LEDGER-2026-08.md` — 발견 전부 + 재현 명령. **UX-000 을 먼저 읽어라.**
기준선(2026-08-04): tsc **0** · jest **5,894 pass / 0 fail**(551 스위트) · Vercel 빌드 green.

**PR #682 머지(2026-08-04)** — 플랜 + U0~U8(커버리지 생성기·C축 게이트·실렌더/흐름 하니스) +
U9 수정 7건: UX-001(콘솔 스켈레톤 셸) · UX-009(링크 오누명 = token `undefined`/`null` 분리) ·
UX-002(재시도 버튼) · UX-008(`Retry-After` 소비, 10로케일) · UX-005(서랍 제목 전문) ·
**UX-003(문자열 로딩 스윕 — 공용 `LoadingHint`/`SkeletonRows`, C-2 천장 19→2)** ·
**UX-004(스킨 스와치 → 생성물 `skinSwatch.gen.ts`, C-1 천장 104→65)**.
이 트랙이 X9·X10·X12·T0·T1v2·T3·T5·O6 을 **흡수**했다(플랜 §6) — 통합 트랙 §4 표는 그만큼 닫힘.

**U9 잔여:** UX-006(primary 없는 화면 — 손님 홈·채팅·관제) · UX-007(콕핏 하단 31%) ·
T1v2(기사 모드 통합·제거, 사장님 확정) · P-18(`/admin/tour-ops` 199KB·TBT 848ms —
🔴 동적 import 전에 TBT 프로파일부터) → 그 다음 U10a 실기기(사람 게이트).
**T3 완료(2026-08-04):** 서랍 미디어 more 버튼(서버 커서는 이미 있었다 — 소비처 부재) +
Lightbox Esc 가 최상위 레이어만 닫음(뮤테이션 검증).
**기사 단독 시나리오 감사(2026-08-04):** 골격은 완성(음성 브릿지·도착 해설·복귀·정산·명단 전부 있음).
코드 수정 3건 = **SOS·전 시그널이 이제 기사 기기를 울리고**(전엔 늦어요·길잃음이 무음) **콕핏이
시그널 캡슐을 한국어로 낭독**. 남은 전제(코드 아님): ① 기사 단독 투어는 「투어룸 발송」 수동 버튼이
운영 절차여야 함(자동 발송 금지 결정은 유지) ② 집합 데이터(픽업 장소 0건·시각 상수) = 임포트/운영
③ U10a 실기기 30분 ④ Gemini 복구 실측.
**2차 스윕(같은 날):** 음성 왕복·손님 듣기·3초 취소·명단/QR·연장·정직한 빈 도착·오프라인 카드 = 전부 확인.
**2차 스윕 잔여 6건 전부 구현(같은 날, 사장님 지시 "조인도 기사 단독이 최우선 목적"):**
① 🔴 **조인 기사 단독** — 기사 콘솔이 픽업순 팀 목록→팀별 콕핏(세션 캐시·PIN 1회·오디오 언락 유지),
`sendDriverRoomPush` 가 **같은 투어일 형제 예약 전체**를 뒤져 어느 방의 SOS/시그널이든 기사 기기에 닿음
(endpoint unique 제약 하 DDL 없이) ② 현장 재합류 — 콕핏 명단 시트 [손님 입장 QR](`/reinvite`,
스태프 전용·rate gate·invite 원장 감사) ③ unsend — 15분 창 툼스톤(스태프=자기 역할, 손님=참가자 ID
스탬프 매칭), 10로케일 「삭제된 메시지」 ④ 즉흥 정차 — 콕핏 일정 시트에 장소명 직접 입력→도착 카드
⑤ 원장 ≈환산 병기(로케일 통화, 정직 폴백) ⑥ 발송 시 **일정 미확정 N팀 경고 토스트**(confirm=콘텐츠
생성 트리거). 상설 게이트 6종이 새 코드를 물어 전부 통과시킴(K4 59쌍·여정 그리드·G1·CJK·C축 64/2·A1 91).
⚠ UX-006/007 은 **실렌더 판정 필수** — 키·시뮬 있는 로컬 세션에서.

**성능 트랙:** `docs/NEXT-SESSION-SMARTAPP-PERF-2026-08-04.md` — ✅ **Gemini 결제 해소**(사장님,
2026-08-04) → **다음 측정 세션 첫 일감 = 복구 실측 + Tier1·다이닝 MISS 재측정·예산 확정**.
P-01 은 ⏸ 데이터 대기(PR #702 판정 — 픽업 장소 0건·시각 상수). 잔여: 라우트 p50/p95(8/15) ·
`plan` p95 973ms 원인.

🔴 **X1 · X7 · X10 · UX-005 — 티켓의 처방이 반복해서 틀렸다.**
**티켓은 *무엇이 문제인지*로만 읽고, 숫자는 직접 다시 재라.** 그리고 **0 을 초록으로 읽지 마라**(UX-000).

## ✅ 완료: 제주 투어 코스 개편 (2026-08-04, 사장님 지시)

수국(hydrangea) 상품 2종 내림 + 동/남/서남 제주 투어 3종 오픈. 가시성은 두 쪽이 한 세트다:
`lib/tour-consumer-visibility.ts` 블록리스트(레포) + **`supabase/pending-db-apply/2026-08-04-*.sql`
(⚠ DB 미적용 — DB 접근 세션에서 순서대로 적용 후 `import-match-v18.mjs --single` 3슬러그 재동기화)**.
동부(`jeju-eastern-unesco-spots-day-tour`)는 **만장굴→성읍→점심→성산→해녀쇼→함덕**으로 재편
(6로케일 전부, 변환기 `scripts/jeju-east-reorder-2026-08.mjs` + 콘텐츠 `scripts/jeju-east-reorder-content/`).
남부·서남부는 v18(2026-06-24)에 이미 요청 코스와 일치했다 — **콘텐츠 재작성 금지, 플래그만**.
de/fr/it/ru 상품 페이지는 설계상 EN 폴백(i18n 확장 트랙 사람 게이트) — 콘텐츠 로케일 실체는 6개.

**+부산 신규 상품(같은 날, 사장님 지시):** `busan-small-group-yonggungsa-skycapsule-gamcheon-tour` —
해동용궁사→청사포 다릿돌전망대→스카이캡슐(⚠티켓 포함/불포함 = 예약 시 선택, offers 2행)→점심→감천→
닥밭골&소망계단 모노레일. 도너 `busan-top-attractions-day-tour`(픽업 3역·용궁사·감천 스톱 재사용) +
빌더 `scripts/build-busan-smallgroup-2026-08.mjs` / 콘텐츠 `scripts/busan-smallgroup-content/`(6로케일).
**가격 사장님 확정(2026-08-04): $59(캡슐 제외) / $79(포함).** 다릿돌·닥밭골은 보유 사진 0(이미지 없는 스톱).
DB는 `2026-08-04-03-*.sql`(⚠ 미적용) + `import-match-v18 --single`.

## ✅ 완료: 스마트앱 **기능** 감사 — **F-1 · F0~F8 전 페이즈 종결**

**요약·다음:** **`docs/NEXT-SESSION-SMARTAPP-FEATURE-AUDIT-2026-08-04.md`**
(무엇이 끝났나 · 일부러 안 한 것 · 사장님 결정 · **§6 에 다음 트랙**)
**플랜 정본:** `docs/smartapp-feature-audit-plan-2026-08-03.md` (**§F 실행 로그 = 결과**)
**격자(생성물, 손대지 말 것):** `docs/audit/feature-journey.md`

2026-08-03 사장님 지시 = *"스마트앱 전력 개발 단계. 먼저 **앱 기능만** 리뷰·검증·감사·테스트·수정."*
**PR 15건 머지(#683~#699).** 기준선: tsc **0** · jest **5,844 pass / 0 fail**(544 스위트) ·
build **exit 0** · 상설 게이트 `__tests__/audit` **30종**.

**후반 세션이 닫은 다섯:** K1a **클라이언트** 절반(#695) · 자정 집합시각(#696) ·
동시 편집 = 플래너+원장(#697) · F8 배선 래칫 2종(#698) · declared-props 스캐너(#699).

🔴 **가장 큰 발견은 코드가 아니라 배달이었다.** 진짜 예약 18건 중 룸이 생긴 건 3건이고
그 3건 전부 **초대 0 · 참가자 0** — DB 의 활동은 **전부 사장님 수동 테스트**(`manual-test-2026-07`)다.

✅ **사장님 결정(2026-08-03): 투어룸을 손님에게 발송하지 않는다.**
→ **"실사용 0" 은 결함이 아니라 의도다. 다시 결함으로 올리지 말 것.**
→ 🔴 **자동 발송 경로를 만들지 말 것** — 「투어룸 발송」이 어드민 수동 버튼인 게 이 결정을 지킨다.
→ `scripts/qa-live-silence.ts` 는 **발송을 시작한 날 이후**부터 값이 있다.

🔴 **이 트랙의 지배 결함은 이제 필드 단위다 — 그리고 두 번 더 나왔다.**
`GuideConsole.participants`(선언만) 에 이어 **`tour_day_plans.version`(쓰고 화면에 찍기만 하고
아무도 안 읽어 동시 편집이 조용히 덮어씀)** 과 **`RoomDrawer.onOpenConcierge`(살아 있는 핸들러를
넘기는데 안 부름)**. 게이트: `declaredButUnread` · `planConcurrency` · `declaredPropsScan`(**0 고정**).

🔴 **두 세션에 걸쳐 내 처방이 여섯 번 뒤집혔고 전부 실측/그 자리의 주석이 잡았다.**
후반 셋: K1a 서버는 **이미 끝나 있었다** · `onOpenConcierge` 는 배선이 아니라 **제거**가 답이었다
(`conciergeDoorCount` 가 "문은 둘"이라고 못 박아 둠) · 래칫의 **"113+" 는 출력의 나머지 줄 오독**(실제 125).
**티켓은 *무엇이 문제인지*로만 읽고, 처방은 그 자리의 코드와 그 옆의 게이트를 읽고 다시 정하라.**

⚠ **tsc 가 못 잡은 회귀가 하나 있었다** — 전역 치환이 `tourTitle` 을 **살아 있는 소비처 둘**에서도
지웠는데 **옵셔널 prop 이라 컴파일러가 조용했다.** **diff 를 읽어서** 잡았다.
⚠ **워크트리는 HMR 이 안 먹는다** — 소스를 고쳤으면 **dev 재시작 후** 워크를 돌려라.
⚠ **로컬 `main` 이 뒤처져 게이트를 헛잰 적이 있다** → 검증은 `git checkout -B x origin/main`.

## 🔴 사장님 선언(2026-07-31): 다음 세션 = 앱 전면 점검(풀 오디트)

**"지금까지 실행한 내역 전부 되돌아 보고 UI→기능→성능 모든 파트 일일이 점검."**
플랜 정본: **`docs/full-app-audit-plan-2026-08-01.md`** (§0 부트스트랩 → §B 원칙 6 →
§C 페이즈 A0~A8). 감사와 수정 분리 — 결함은 원장으로만, 수정은 A8. 아래 통합 트랙
잔여 14건은 이 오디트 **뒤로** 밀린다.

## 대기 중: 스마트앱 / 관제 통합 트랙 — 잔여 14건 (기능 감사 **뒤로** 밀림)

**이어받으면 이것부터:** `docs/NEXT-SESSION-SMARTAPP-2026-08-01.md`
(무엇부터 · 환경·함정 · 머지 전 게이트 · **§9 에 실행 프롬프트 통째로**)
**직전 세션 기록:** `docs/SESSION-STATE-2026-07-31.md` (야간 6라운드, **PR #615~#635**, 교훈 20~31) ← **최신**
**플래너 정본:** `docs/planner-overhaul-p7-master-plan-2026-07-30.md` (§F 실행 로그 = 결과)
**마스터 플랜(SoT, 왜):** `docs/ops-staff-design-unification-master-plan-2026-07-27.md` (Part A~O)
**사장님 결정:** `docs/OWNER-DECISIONS-2026-07-29.md`

**2026-07-31 기준 — P7 전 10단계 + 잔여 [1]~[5] 완료(PR #615~#635, 21건).**
플래너 재편(사진 8.9→60.5% · 커밋버튼 36→56px · 다크 승강 복구 · 「내 하루」를 주인공으로 ·
3,750→2,491줄) · **K4v2 20방 커버리지 53/53** · **X15 기사 지오펜스** · **X18 매트릭스 두 소스** ·
**X20 룸 하베스터 배선** · **N3잔여+N8 광원**.
게이트: tsc **0** · jest **5,472 pass/실패 0** · build **exit 0** · 시뮬 드레인.

**남은 것(순서 고정, 부트스트랩 §4):** X1 잔여 → X7 → X12 → X10 → X9 → X8(⚠세무 보고만) →
X11 → X19 → T0 → T1v2 → T3 → T5 → O6 → R6.

🔴 **이 트랙의 지배적 결함 유형 — 착수 전에 이걸 먼저 의심하라.**
직전 세션에서 **같은 모양이 다섯 번**: 플래너 사진(두 컬럼 중 하나만 읽음) · 글자크기(셸 계약 미소비) ·
지오펜스(엔진 있는데 소비처가 손님뿐) · 매트릭스(도착 테이블 둘 중 하나) · 코퍼스(413줄 모듈을 아무도 안 부름).
**전부 "만드는 문제"가 아니라 "연결하는 문제"였고 전부 테스트가 초록이었다** —
결함이 *호출자의 부재*라 단위 테스트로 안 잡힌다. → **소스 게이트 + 뮤테이션 테스트**.
그리고 **"미착수"를 일곱 번 틀리게 적었다** → **착수 전 5분 grep**.

🔴 **게이트가 조용해지는 두 가지(둘 다 저지를 뻔했다):** ① **주석 안의 중괄호**가 브레이스 파서를
무너뜨려 "아무것도 안 재면서 초록" ② **`var()` 별칭**이 검사값을 NaN 으로 만들고 **NaN 은 건너뛴다**.
**게이트를 죽이는 건 코드가 아니라 그 옆의 것이다 — 산문·별칭·리팩터.**
그리고 **생성되는 문서(`docs/audit/K4-coverage.md` 등)에 손으로 쓰지 말 것 —
문서만 고쳐도 게이트를 다시 돌 것**(이걸 어겨 회귀를 한 번 머지했다).

⚠ **플래너를 볼 때 게이트는 셋이다:** ① 전세 상품 ② **룸 토큰 `?rt=`** ③ lead.
전부 `scripts/qa-planner-walk.mjs` 에 있고 편집기가 아니면 **exit 2**.

*(아래는 2026-07-28 기준 기록 — 1순위 6건은 전부 종결됐다)*

**1순위 6건만 옮겨 적는다** — 지난 두 라운드가 이걸 열어둔 채 UI 연마를 했다:
`K1a` SSE 폴백 방어(실시간이 한 번만 흔들리면 손님 1명당 2초마다 DB + 함수 수명마다 인증 한 벌이 **재연결 순환**으로 반복) ·
`L1` OTA 리스팅에 "투어 중 옵션·연장은 현장 현금" 한 줄 — 🔴 **현금 연장 가능한 전세 예약 7건 전부 OTA, 자사 직판 0건** ·
`N5` **콕핏 재질 회귀 확인**(승강체계·rim을 전역에 넣었는데 콕핏은 다크 고정 + 스킨 캐스케이드 누수 함정 기록됨 — PIN 게이트로 판정 못 했다) · `N6` `/tour-mode` 진입 hydration 에러 ·
`P0`·`P1` **미착수 P1 버그 2건**(전세 코스 선택 불가 · 플래너 권한 영구 잠금) · `X1` CJK 불변 규칙 위반 222 후보.

**사장님 결정 7건 대기** — 부트스트랩 §5. 그중 🔴 8/17 예약 `d8e12b1d`는 카드 미저장 `pending`이라
**재승인 크론이 영영 안 집는다**(운영 확인 필요).

## 완료: 관제센터 + 정산 체인 + 손님 안내 (2026-07-26, 브랜치 `fix/smartguide-recovery-2026-07-25`)

**플랜(단일 기준):** `docs/ops-center-settlement-upgrade-plan-2026-07-25.md` (v2, W1~W11 + M1~M5)
**체인 전수 감사:** `docs/ops-guest-message-chain-2026-07-26.md` ← **이 영역 손대기 전에 이걸 먼저 읽어라**

**W1~W11 + M1~M5 전부 구현·검증 완료.** 게이트: `npx tsc --noEmit` 0 · `npx jest` 4355 pass / 21 skip / 0 fail.

신규: `ops_vehicles`(차량 마스터) · 배정 충돌 차단(API+**DB 트리거**) · 투어룸 월간 뷰 ·
근무/배차 달력(한 컴포넌트 두 축) · 오토파일럿(제안 전용) · **의존성 0 xlsx 작성기** ·
일괄 worked · 가이드별 원천징수영수증 · 날씨 자동 삽입(Open-Meteo, 키 불필요) ·
이메일 원버튼 일괄 발송(미리보기→발송) · 투어별 문구 오버라이드 · 어드민 사이드바 23→6그룹.

**🔴 다시 만들지 말 것 (이미 있다):** 왓츠앱 순차 발송·개인 토큰 링크·명단 픽업 그룹핑 ·
3.3% 원천징수 산식·세무 서식 4종·월 정산 멱등 배치. `lib/ops/parse/autopilot-trigger.ts`는
**OTA 파서용 동명이인**이며 관제 오토파일럿(`lib/ops/autopilot/**`)과 무관하다.

**검증 하니스:** `npx tsx scripts/qa-ops-center-queries.ts --cleanup` (라이브 15검사, 쓰기는
오토파일럿뿐이고 --cleanup 이 되돌린다) · `npx tsx scripts/qa-admin-cjk.ts` (세션 없으면
**exit 2** — 예전엔 조용히 0건을 보고했다).

**사람 게이트 3건:** ① `OPS_GUIDE_PII_ENC_KEY` 설정(한 번 넣으면 교체 금지) ② 실기기 리허설
(마이크·TTS·푸시·GPS) ③ 세무 서식 CPA 검수 후 `ops_finance_config.expert_reviewed`.

## 진행 중: 다국어 확장 de/fr/it/ru (2026-07-26 착수)

**마스터 플랜(단일 기준):** `docs/i18n-expansion-plan-v2-2026-07-25.md` (v3.2)
**다음 세션 부트스트랩:** `docs/NEXT-SESSION-I18N-EXPANSION-2026-07-26.md` ← **이 트랙 이어받으면 이걸 먼저**
**첫 명령:** `npm run i18n:status`

**왜 라이브 DB에 써도 안전한가 (이 트랙의 핵심 전제):**
`app/tour-product/[slug]/tourProductPageBody.tsx`에서 de/fr/it/ru은 `TOUR_PRODUCT_FALLBACK_URL_LOCALES`에 있다. 즉 **`tour_product_pages`에 `locale='de'` 행을 넣어도 그 배열을 고치기 전까지 고객 화면은 안 바뀐다.** 번역을 비가시적으로 스테이징하고 오픈은 별도 사람 결정으로 분리하는 구조. `__tests__/app/tourProductLocaleRouting.test.ts`가 이 이원 구조를 강제한다.

**🔴 건드리면 안 되는 것:** ① 위 로케일 배열 2개(오픈 결정=사람) ② 기존 로케일 행 UPDATE(`apply.ts`는 INSERT만) ③ `messages/*.json` 기존 키 ④ `match_pois.names_other_locales`(게이트가 없어 쓰는 즉시 고객 반영 — 플랜 Q10/Q12)

**상태:** P0 인프라 완료(`lib/i18n/pipeline/` 테스트 74 green, tsc 0) · 글로서리 L1 4언어 × POI 122건 완료 · 독일어 Tier1 10슬러그 추출(112 unit) · **독일어 `jeju-grand-highlights-loop` DB 발행 완료**. 잔여는 독일어 9슬러그 + fr/it/ru 전량.

**⚠ 워크트리 경합:** `atockorea-main-merge`는 타 세션과 공유된다. 커밋 시 **`git add -A` 금지, 경로 명시**(2026-07-26에 외부 커밋이 진행 중 파일을 쓸어간 사례 있음).

## 🔴 UI 불변 규칙: CJK 텍스트는 절대 글자 단위 줄바꿈 금지 (P1-5, 2026-07-25)

한국어·중국어·일본어는 띄어쓰기가 없어 **CSS 기본값(`word-break: normal`)만으로도 글자 단위로 쪼개진다.** 그래서 표 헤더/버튼/뱃지가 `빈민` `유형` `준비전`처럼 세로로 무너진다. **원인은 `break-all`이 아니라 "아무 것도 지정하지 않은 것"** — `break-all`을 grep해서는 대부분의 사고 지점을 찾지 못한다.

🔴 **2026-07-30 변경 — 이제 옵트인이 아니라 기본값이다.** `app/globals.css` `@layer base` 의
`html { word-break: keep-all; overflow-wrap: break-word }` 가 **모든 요소에 상속**된다(포털 포함).
네 번의 요소별 스윕이 583건을 못 닫고 오히려 576→583으로 늘던 것을 여기서 끊었다.
실측: 한국어 홈의 불법 줄바꿈 **11 → 0**, 컴포넌트는 한 줄도 안 고치고.
동반 규칙 `td, th { overflow-wrap: anywhere }` 가 없으면 표가 벌어진다(실측 150px→176px).

- **`.text-cjk-body`** — **이제 전역 기본값이다.** 새로 붙일 일은 거의 없다.
- **`.text-cjk-safe`** — `nowrap + ellipsis + min-width:0`. **기본값이 못 하는 일만** 한다:
  박스가 어절보다 좁으면 기본값으로도 결국 쪼개진다(실측 — 36px 탭의 `준비전`은 기본값에서 2줄,
  `.text-cjk-safe` 에서 1줄). **잘림이 줄바꿈보다 낫다는 판단**이 설 때만 붙인다.

지켜야 할 것:
1. 라벨이 **자기 어절보다 좁은 상자**에 들어가면 `.text-cjk-safe` 를 붙인다. 그 외 CJK 본문은
   기본값이 이미 지킨다. **소스로는 좁은지 알 수 없다** — 판정은 `scripts/qa-cjk-render.mjs`
   (실렌더에서 "CJK 두 글자 사이에서 줄이 바뀌었는가"를 직접 센다)가 한다.
2. `break-all`은 **URL·해시·ID 등 ASCII 연속문자에만** 허용. CJK 텍스트에 붙이면 안 된다.
3. 가로 스크롤 표는 `overflow-x-auto` + **`min-w-[Npx]`를 같이** 준다. `w-full`만 있으면 스크롤이 발동하지 않고 컬럼이 짜부라져 같은 사고가 난다. (참고 구현: `app/admin/guide-settlements/page.tsx`)
4. 공용 프리미티브(`components/admin/DataTable.tsx`)에 이미 적용돼 있으니 **새 관리자 표는 이걸 쓰는 것이 기본**이다.
5. **게이트는 `__tests__/audit/cjkInvariant.test.ts`.** 전역 기본값의 존재 · 규칙 2 위반 0 ·
   스캐너 상한(certain 492 / suspect 428)을 강제하고, **기본값을 지우면 실패하는 뮤테이션 테스트**를
   들고 있다. 전에는 게이트가 아예 없어서 숫자가 조용히 늘었다.


## 완료: 투어룸 UI/UX 글로벌 리디자인 v1 (프레젠테이션 전용, U0~U8)

**마스터 플랜(단일 기준):** `docs/tour-room-ui-redesign-master-plan-2026-07-15.md` (§A 진단 → §C 바인딩 결정 U-D1~12 → §K WBS 8웨이브/46티켓)
**상태:** Wave U0~U8 전체 구현 완료 + main 머지 완료(2026-07-15). 토큰 시스템·메신저 레이아웃·버블 시스템·컴포저·카드 리스킨·탭 개편 배포, 테스트 228개 green. **단, U-D2(카카오 옐로 버블)는 아래 v2에서 개정됨 — 이 문서의 색 토큰 표는 더 이상 유효하지 않고 구조 결정(레이아웃·그룹핑·꼬리·FAB 등)만 유효.**

## 진행 중: 스마트 가이드 프라이빗 모드 (W0 완료)

**마스터 플랜(단일 기준):** `docs/smart-guide-private-mode-master-plan-v2-2026-07-16.md` — v1 초안을 2026-07-16 코드 전수 감사로 검증·완성한 SoT. 8-프리미티브(PIN/TIMER/SIGNAL/MUTATE/LEDGER/CARD/ESCALATE/BRIDGE) 조합으로 79+1 시나리오 해결. §A 코드 리얼리티 감사(재사용✅/확장🔶/부재❌) → §B 바인딩 결정 P-D1~14(오픈퀘스천 4개 확정: POI 이원 유지·**정산=당일 가이드 현금 직불(사용자 확정 2026-07-16, LEDGER는 기록·투명성 장치, Stripe 미개입)**·드라이버=신규 scope+차량PIN·다일=tour_date 키만) → §I WBS W0~W5(MVP=W0→W3). **상태: W0+W3(보이스 브릿지)+W1.5(자동 콘텐츠)+복귀타이머 완료·main 머지 — "한국어만 하는 기사 단독 투어" MVP 코어 배포됨.** ① **W0**(PR #323): 스키마 4테이블+역할확장 라이브, `dayPlan.ts` 4단 리졸버(소비처 3곳), `events.ts` idempotent 로그 ② **W3**(PR #325): `/tour-mode/driver` 기사 콘솔 — 원탭 녹음→자동송신(3초 취소창, messages 라우트 audio multipart 재사용)→손님 언어 말풍선, 수신 손님메시지 자동 한국어 TTS(운행시작 탭으로 오디오 언락), 수동 도착 트리거(§O-8 첫 구현 `manual-arrival` — 손님 언어 콘텐츠 카드 발사), 원탭 시그널 4종(`driver-signal`: 지연/주차핀(tour_room_pins)/차량도착/차량문제→ops푸시), driver 토큰 scope+차량번호 뒤4자리 PIN 게이트(join, `driver.ts` fail-open), PII-미니멀 `driver/overview`(리졸버 일정+match_pois 좌표), 링크 발급 `POST /api/tour-mode/driver/link`(admin 로그인 or 가이드 토큰), 내비 딥링크 `nav-links.ts`(카카오/티맵/네이버/구글), sender_role 'driver' 마이그레이션, broadcast·guide overview는 role guide 명시 제한 ③ **W1.5**(PR #326): P-D16 자동 POI 콘텐츠 — `generatedContent.ts`(Places 사실→batch 레더 LLM 서사→비평가 패스→`generated_spot_content` upsert, 컨시어지 일일예산 편승), 서빙 curated→poi_kb→**generated**→null + AI 배지(SpotArrivalCard), 트리거 2종(도착 온디맨드 후속카드 + `plan` 라우트 confirm), **`/api/tour-rooms/[bookingId]/plan` GET/PUT = W1.4 서버 슬라이스**(가이드/드라이버/admin이 일정 작성·confirm 가능 — /plan 손님 UI는 미구현) ④ **복귀타이머**(PR #327): driver-signal 'return_time' = 기존 free_time_timer 메타데이터 계약 재사용 → 손님 카운트다운 배너+Tier0 즉답 무변경 동작, 콘솔 [복귀시간] +30/45/60/90 칩. **테스트 위생: access/voice/routes 픽스처 날짜부패(2026-07-15 토큰 만료) 동적 미래날짜로 수정 + web-push/qrcode/@playwright 로컬 설치로 4개 스위트 치유 — 투어룸+api 327 green, tsc 0.** ⑤ **W1**(PR #328, 2026-07-17): 손님 /plan D-1 에디터 — `/tour-mode/plan/[bookingId]` 5로케일 3탭(추천 course_templates 31종 시딩·직접 고르기 match_pois 피커+Places 폴백 ~120m poi_key 스냅·가이드에게 맡기기=itinerary.guide_curated), A10 니즈 체크리스트→needs, A2 자동저장, W1.3 실행가능성 v1(`feasibility.ts` 총합·휴무(poi_key 포함 키워드)·권역 — 경고만) PUT마다 저장, P-D13 lead guest(첫 customer join is_lead·owner 승계·draft만 편집·confirm 불가·확정 후 409), submit/delegate 캡슐 팬아웃, `plan/templates` 라우트. **+🔴 핫픽스: verifyRoomSession이 driver role 거부 → W3 기사 콘솔 후속 호출 전부 403이던 라이브 버그 1줄 수정+회귀 테스트.** ⑥ **W2 코어**(PR #329+#330, 2026-07-17): 가이드 콘솔 `GuidePlanPanel` — 룸 카드별 초안 검토(§G diff `planReview.ts` 신규 배지·니즈 요약·경고)→원탭 확정, 확정 후 MUTATE(reorder/추가/skip+reason — plan 라우트 status/skip_reason 화이트리스트, skip 시 동일 category 반경 20km 교체 추천), 스톱별 [도착](§O-8 manual-arrival 재사용) + **rally 사다리**(`rallyStage()` 순수 시간파생 set→remind→due→overdue→contact, NoticeBanner overdue "일행 대기"·contact 전화 칩, T+5 크로싱 idempotent `rally_overdue` — UNIQUE subject_key 디듀프 라이브 검증) + **손님 SIGNAL 라우트** `/signals`(running_late·rest_stop·lost=lost_me 핀 TTL30분·rally_overdue, 5로케일 `guestSignals.ts`). **워크트리** `C:\Users\sangsong\atockorea-private`(.env.local에 플래그 ON, dev 포트 3160 `private-dev`). ⑦ **W2 완결**(PR #331+#332): LEDGER — `extras` GET/POST/PATCH(`ledger.ts` §C-3 전이 화이트리스트, 전이마다 5로케일 캡슐=감사추적) + 피드 `ExtraLedgerCard`(최신 캡슐만 라이브 상태+손님 [확인]) + 가이드 `GuideLedgerPanel`(미수취 합계·기록·수취완료/취소) + 손님 `QuickSignalBar`(늦어요/잠깐 정차/길잃음→lost_me 위치 1회 공유) + W2.5 `activeCard.ts` 보조 카드 리졸버(지연 ETA 45분 TTL>차량핀 60분 TTL>정산 대기, `SecondaryCardBanner`는 rally 공지 활성 시 전면 억제=P-D8 1장 불변식). ⑧ **W4 슬라이스1**(PR #333): A1 초대 이메일 /plan CTA 5로케일 + P-D12 `inPostTourWindow()`(투어일 종료+48h, ⚠extras 테스트 픽스처 tour_date=kstToday() 동적 필수) + G4 [정산 요약 발송]+G7 ATM 힌트 + H1 응급실/약국 딥링크·B1 차량 라인(`vehicleLineFromPayload`) ⑨ **W4 완결+W5**(PR #334, 2026-07-18 — **코드 트랙 전체 종결**): W4.1 손님 웹푸시(P-D7 — `push_subscriptions.booking_id` 마이그레이션·`guestPush.ts` 로케일 본문·`push-subscribe` 라우트·sw-tour-mode push 핸들러·`PushOptInBanner` 집합/지연 2종 절제 옵트인, 발신=broadcast 공지+driver delay/return_time+rally_overdue) + rally_overdue **이메일 폴백**(notice당 1회) / W4.2 E5 스크린샷 힌트·E6 `OfflineInfoCard`(localStorage 스냅샷→오프라인 시 집합·일정·긴급번호 렌더) / W4.3 F1 `allergyCard.ts` 한국어 식당 카드(/plan 에디터) / **W5 주간 크론** `/api/cron/tour-room-flywheel`(월 16:00Z, vercel.json 등록): ①매트릭스 학습(도착 레그 gap−체류 5..240분 밴드→`poi_travel_matrix` 러닝민) ②ops 다이제스트 이메일(휴무 스킵 제보 후보+구글픽 수요역류) ③퍼지(needs 30일 P-D11·핀/위치 R-17) / W5.2 I3 분실물(`lost_item` 시그널 post_tour 윈도우 게이트+ops/가이드 푸시, EndedCard mailto→원탭 승격). ⑩′ **언어 무제한 브릿지**(PR #336, 사용자 확정 2026-07-18): 손님이 어떤 언어로 쓰든 번역 라우터가 감지→`tour_room_participants.chat_locale`(raw 코드, 마이그레이션 적용)에 기억→팬아웃 타겟에 합류(`getRoomTranslationTargets`, 룸 로케일 우선 8개 캡)→기사 한국어 답장이 손님 언어 버블로(`ChatFeed preferredLocale`, `deriveChatLocale` 스트림 파생). **POI/공지/시그널/정산 캡슐은 기존 룸 5로케일 유지.** E2E: FR→ko 표시/ko→fr 버블/중간 de 전환/POI 캡슐 5로케일 확인. ⑩ **iOS 모의 QA 스윕**(PR #335): Playwright WebKit(사파리 엔진)+iPhone13 프로필 전 표면 주행 — 🔴**hydration 결정론 수정**(Node≥21 전역 navigator가 서버 로케일을 SSR에 누수→기기 로케일 다른 모든 손님 전체 트리 재생성; detectEntryLocale/detectLocale `typeof window` 가드+sr-only suppressHydrationWarning, 에러 5→0) + POI 썸네일 404 스와치 폴백 + 시그널 칩 accent-soft 위계 + 가이드 스톱 제목 line-clamp-2. 하니스=`scripts/qa-ios-smoke.ts`(멱등 sim 리셋, dev:3160+sim-tour-day 필요). ⚠기록된 엣지: 자정 넘는 집합 시각은 당일 00:00으로 해석되어 즉시 만료(야간 투어 도입 시 재검토). **코드 잔여 없음 — 의도적 보류**: B5 그리팅(가이드 사진/자격 DB 부재)·I5 리뷰쿠폰(V4 TIMELINE10 사람 게이트)·A5 정밀 영업시간(§L-2)·W4.5 예산 통합(선택) / **사람 게이트: 실기기 리허설(기사 콘솔 마이크·TTS 자동재생 iOS Safari + /plan·가이드 일정 패널 시각 QA — MCP 브라우저 hidden-tab으로 픽셀 검증 미완), 플래그 `NEXT_PUBLIC_TOUR_MODE_V1` ON 결정, §L 4건(연장 단가·open_hours·poi_kb 필드·파일럿 대상)**. ⚠사전존재: TourRoomClient.tsx L285 react-hooks/refs lint 에러(main에도 있음).

## 완료: 투어룸 AI 컨시어지 + UI/UX 엘레강스 리파인 v2 (V0~V6 전부)

**마스터 플랜(단일 기준):** `docs/tour-room-concierge-uiux-v2-master-plan-2026-07-15.md` (§A 라이브 시뮬 진단 → §B 외부 전략메모 채택맵 → §C 색 개정(U-D2→U2-D1) → §D AI 컨시어지 Tier0/1/2 → §G WBS)
**부트스트랩:** `docs/NEXT-SESSION-CONCIERGE-UIUX-V2-2026-07-16.md` ← **이 트랙 이어받으면 이걸 먼저**(잔여 V1·V4·V5·V6 티켓 상세 + 자산 인벤토리 + gotcha)
**개발 브랜치:** `claude/tour-mode-uiux-concierge-p7k2vm` (워크트리 `C:\Users\sangsong\atockorea-tourmode-uiux`, node_modules는 `atockorea-tourmode`에서 정션)
**상태:** Wave V0~V6 **전부 완료**(V0+V2+V3는 PR #317 `23e54f5c` main 머지; V1·V4·V5·V6은 브랜치 `claude/tour-mode-uiux-concierge-p7k2vm`에 커밋 — **PR/머지 대기**). ① V0: 전역 챗봇 위젯 `/tour-mode` 누수 수정 + 카카오 옐로→아이보리·앤틱브라스 팔레트(SOS 레드 유지) ② V1(`19f2bc58`): PresenceBar·LocationShareCard·SosButton "connected" 잔여 emerald 점→`--tr-safe`(SOS 레드 무변경) ③ V2: 스마트 가이드 시트, 퀵칩 4종+5로케일 키워드 Tier 0(네트워크 0회) ④ V3: `/concierge` 엔드포인트+가드레일 4종+피드 에스컬레이션+관제 어텐션+`rag:harvest` 플라이휠+3중 예산 ⑤ V4(`fc7f3f89`): Travel Timeline(spot_arrival+vision_answer 재집계, 신규 스키마·LLM 0) 시트 + `POST /timeline-coupon`(멱등 `coupon_grants`, 정직 폴백) + `TIMELINE10` 프로모 런치게이트 + "리뷰 남기기"는 쿠폰과 분리(AI 초안 없음) ⑥ V5(`beb6d7a1`): "AI concierge 24/7" 문장 내부 모순 교정 5로케일 ⑦ V6: §J QA 체크리스트 통과. 투어 스위트 307 green, tsc 0, 라이트/다크×en/ko 시뮬 실구동 검증(콘솔 에러 0). ⚠ 전체 `npm test`의 5스위트 실패는 사전존재 환경 이슈(Node/undici, 이 트랙 무관). **남은 것: (a) 브랜치 PR·머지 (b) 사람 게이트 — `TIMELINE10` 활성화(is_active=true)+할인율 결정, 마이그레이션 라이브 적용.** 시뮬 재현: `sim-tour-day.ts`→`sim-populate.ts`→`sim-concierge-screens.mjs`/`sim-timeline-screens.mjs`.

## 완료: 투어모드(Tour Mode) 개발 — 실시간 투어룸 (코드 트랙 종결)

**마스터 플랜(단일 기준):** `docs/tour-mode-master-plan-2026-07-14.md` (§A~§O, T0~T8.1 전부 ✅)
**후속 트랙:** `docs/NEXT-SESSION-OPS-CENTER-APP-2026-07-15.md` — 관제센터 앱화/PWA W1~W7 전부 ✅(PR #312~#316)
**상태:** 기능 코드 트랙(T0~T8.1) + 관제 PWA 트랙(W1~W7) 전부 main 머지 완료, 플래그 `NEXT_PUBLIC_TOUR_MODE_V1` OFF. 테스트 290+ green, tsc 0, advisors 신규 0(2026-07-15 재확인). **남은 건 전부 사람 게이트(코드 작업 없음):** ① §I-4 실기기 리허설(iOS Safari/Android Chrome — 녹음·TTS·PWA 설치·SOS 수신) ② 파일럿 스팟 좌표 검수(`docs/tour-mode-pilot-spot-checklist-2026-07-14.md`) ③ T8.2 런칭: 남은 env 체크(`docs/tour-mode-hardening-T8-2026-07-15.md` §5 — 플래그 ON 시점 결정, `NEXT_PUBLIC_TOUR_OPS_PHONE`, SOS 수신 이메일, 파일럿 메트릭 쿼리 등록). `TOUR_ROOM_TOKEN_SECRET`·VAPID·cron은 이미 설정 확인됨. 다음 세션은 사람이 위 3게이트를 통과시킨 뒤 파일럿 오픈으로 재개.

## 진행 중인 대규모 작업: 어드민 대시보드 전면 개편

**마스터 플랜(단일 기준):** `docs/admin-dashboard-upgrade-master-plan-2026-06-24.md`
**모바일 설계 상세:** `docs/admin-premium-mobile-design-spec-2026-06-24.md`
**다음 세션 실행 프롬프트:** `docs/NEXT-SESSION-EXECUTION-PROMPT-2026-06-25-wave4.md` ← **구현 이어받으면 이걸 먼저**(Wave 4 페이지 개편 + 원격 Linux 환경 인수인계, 최신)
**개발 브랜치:** 환경별 상이 — 원격 Linux(web) 세션은 `claude/next-session-execution-ysuww9`(매 스텝 main 머지), 플랜 표준은 `claude/admin-dashboard-upgrade-yvb88c`. 부트스트랩 문서의 §1 확인.

**상태: 진단·플랜(Phase 0~0.13) 완료 → Wave 0/1/3/9 + D-15 + W5.7 머지. 현재 Wave 4(페이지별 프리미엄 모바일 개편) 진행 중 — 대시보드·주문목록·분석허브·챗봇분석·머천트(목록·생성·상세) 완료(PR #182~187). 다음 = 분석 엔진 페이지 §8.4.**

이어받을 때 읽기 순서:
- `docs/NEXT-SESSION-EXECUTION-PROMPT.md` (구현 부트스트랩)
- 플랜 **§L 인수인계 → §A 상태 → §R 실행 WBS(웨이브·티켓)** → 착수 티켓 관련 섹션(§T 보안·§G-6 정산·§U/컴패니언 모바일)

### 핵심 규칙 (이 작업 한정)
1. **브랜치는 로컬 부재 가능 → `git fetch origin` 후 워크트리 `C:\Users\sangsong\atockorea-admin`에서 작업.** 메인 dir은 타 세션 경합.
2. **라이브 DB는 `mcp__atockorea__*`로 연결됨**(`cghyvbwmijqpahnoduyv`). DDL은 additive + 적용 후 `get_advisors` 재실행.
3. **🔴 W0.1 P1 권한상승(고객→admin RLS WITH CHECK 부재)이 단일 최우선** — 라이브 확정, 마이그레이션 1줄.
4. **세무(Wave 8)는 자율 제출 금지** — CPA/세무변호사 SIGN-OFF + §J #2/#3 게이트 후에만.
5. 병렬 감사 에이전트에는 **"하위 에이전트 spawn 금지 + 최종 메시지로 직접 반환"** 항상 명시.
6. **커밋 푸터에 모델 식별자 절대 금지**(`Co-Authored-By: Claude <noreply@anthropic.com>`만). 커밋/푸시는 위 브랜치.
7. 진행 보고는 **한국어**(코드·커밋은 영어).

**다음 착수 지점:** §R Wave 0 → **W0.1 P1 권한상승 차단**(사용자 승인 즉시).
