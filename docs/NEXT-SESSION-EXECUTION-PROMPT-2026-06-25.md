# 다음 세션 마스터 프롬프트 — 어드민 대시보드 개편 **구현 이어가기** (보안/인증 트랙 13티켓 머지 후)

> 아래 블록 전체를 다음 세션 첫 메시지로 붙여넣으면 그대로 실행 가능. 진단(Phase 0~0.13)·Wave 0/1기반/3·Wave 9 보안 트랙(배치1~PA-4)·D-15·W5.7·W3.8은 **이미 머지 완료**. 이 세션은 **사용자 결정 게이트 해제 + 다음 트랙 구현**.

---

역할: 너는 세계 최고의 풀스택 엔지니어이자 1등 UI/UX 디자이너이며 꼼꼼한 코드 감사자다. AtoC Korea 어드민 대시보드 전면 개편의 **구현 단계**를 이어받아 실행한다. 진행상황·상태 보고는 **한국어**(코드·커밋 메시지는 영어).

## 0) 시작 전 반드시 (순서 엄수)
1. **브랜치·워크트리:** 작업 브랜치 `claude/admin-dashboard-upgrade-yvb88c`. `git fetch origin` 후 전용 워크트리 `C:\Users\sangsong\atockorea-admin`에서 작업(있으면 거기서, 없으면 `git worktree add`). 메인 working dir은 타 세션 경합 — 쓰지 말 것. 시작 시 `git merge --ff-only origin/main`로 최신화.
2. **빌드/테스트 환경(비자명·중요):** 이 워크트리의 `node_modules`는 main과 **정션** 공유(없으면 `New-Item -ItemType Junction -Path C:\Users\sangsong\atockorea-admin\node_modules -Target C:\Users\sangsong\atockorea\node_modules`). 빌드용 env는 `.env.local`(이미 존재, gitignore). 실행은 **로컬 바이너리 직접**: `node_modules/.bin/jest --ci`, `node_modules/.bin/tsc --noEmit -p tsconfig.json`, `npm run build`. ⚠️ `npx jest` 금지(엉뚱한 버전). ⚠️ **새 npm 의존성 추가 금지** — node_modules가 main과 정션이라 타 세션 오염. 외부 서비스는 SDK 대신 `fetch`로(예: durable RL = Upstash REST).
3. **읽기 순서:** 이 파일 → `docs/admin-dashboard-upgrade-master-plan-2026-06-24.md`의 **§A(상태)·§C(변경로그, 최신이 위)·§R(WBS)**. 모바일이면 `docs/admin-premium-mobile-design-spec-2026-06-24.md`.
4. **라이브 DB:** `mcp__atockorea__*`가 atockorea(`cghyvbwmijqpahnoduyv`)에 연결됨. 읽기 자유. **DDL/storage 설정 변경은 사용자 승인 필요**(하네스가 차단함 — 기존 직접쓰기 권한은 투어 데이터 한정). 적용 후 `get_advisors`(security/performance) 재실행으로 회귀 확인.

## 1) 지금까지 완료(머지됨) — 다시 하지 말 것
- **Wave 0**(PR #167 `7b222ba7`): P1 권한상승·N27·cron secret/fail-open·B-1 노쇼·W-1 webhook.
- **Wave 1 기반**(PR #168 `c0804e60`): `--admin-*` 토큰·16px 입력·sonner Toaster·44px·유틸키트·`AdminPageShell`·Tier1/2 키트.
- **Wave 3 안정화**(PR #169 `b545605c`+#170 `3263e82f`): LIB-1·S-F2·D-4·B-3·M-4·M-6·D-14·N-5/S-F7·AR-1·AR-3.
- **Wave 9 보안 배치1**(PR #171 `b39963fd`): PA-1·PA-2/N17·N11·N13·N16·P2·P4·CB-5·PA-3.
- **D-15 analytics 3 BLOCKER**(PR #172 `c3e91ae3`): experiments·funnels·events/[name]. **보류 2건(설계게이트)**: visitors distinct-over-range·retention left-censor.
- **W5.7/W-10 환불경로**(PR #173 `c3865d14`): `POST /api/admin/orders/[id]/refund` + `charge.refunded` 웹훅. **정산 대사는 §G 후속(미반영)**.

### ⭐ 2026-06-25 세션(이번)에 추가 머지 (PR #174~#181) — 보안/인증 트랙
- **#174 `730c84ef`**: **N14**(checkout IDOR 🔴 — `/api/stripe/checkout`에 caller-supplied 이메일 ↔ 예약 owner 이메일 일치 검증, `lib/checkout-auth.ts`)·**N19**(maps/static 빌링남용 — 파라미터 화이트리스트+per-IP RL, `lib/maps-proxy.ts`)·**N20**(`next.config.js` `headers()` 보안헤더). +17 테스트.
- **#175 `2572409d`**: **N18**(LINE OAuth — id_token을 LINE `/oauth2/v2.1/verify`로 검증 + 랜덤 CSRF state httpOnly 쿠키, `lib/line-auth.ts`)·**P6**(change-password 무음성공 차단). +8 테스트.
- **#176 `2c28b3a0`**: **N34**(storage 버킷 바운딩 — email-assets 5MB·product-images 10MB+image MIME, 마이그레이션 `20260625000000_bound_storage_buckets_n34.sql`, **라이브 적용 완료**·advisor 신규0).
- **#177 `ad688da4`**: **B-2**(admin layout `onAuthStateChange` 만료표시)·**M-8**(인증가드 PGRST116 프로필 자동생성 제거, 순수 `lib/admin/admin-auth-guard.ts`). +7 테스트.
- **#178 `64983087`**: **N21/P3 verify-and-document** — admin API **44/44 서버 가드 전수 감사**(43=`requireAdmin`, 1=`/api/admin/contacts`는 `withAuth`+DB-role). 누락0. middleware matcher 주석.
- **#179 `6a450734`**: **CB-2 durable RL 인프라** — `lib/durable-rate-limit.ts`(Upstash Redis REST, **fetch만·의존성0**) + durable-aware 래퍼(chatbot booking-lookup/throttle). **env 미설정 시 인메모리 fail-open 폴백**. +14 테스트.
- **#180 `d976ee83`**: **PA-5·PA-6** — 무인증 라우트 per-IP RL: `itinerary/match`·`tour-product/match-explanation`(AI 10/분·60/시), `contact`·`send-verification-code`(이메일 3/분·10/시). 일반게이트 `requestGate`+`clientIpKey` 추가. +6 테스트.
- **#181 `1ab8d672`**: **PA-4** — tour-rooms `GET /events`·`POST /spot-events` 게스트 이메일경로 per-IP 브레이크(15/분·60/시, authed 우회). `messages GET`은 authed-only라 제외.

**세션 누적: 보안/인증 13티켓+1감사, 테스트 +52, 회귀 0, advisor 신규 0, build 전부 green. 전체 jest baseline = 541 pass / 8 fail.**

⚠️ **8 fail은 origin/main의 기존 환경결함**(폴리필 부재: tours/error-handler/logger/test-utils + phase-z=`jeju-grand-highlights-loop` haenyeo 타이밍 stale 콘텐츠). **회귀 아님** — 새 작업 후에도 이 8개만 실패해야 정상.

## 2) 다음 세션 우선순위 — **사용자 결정 게이트가 핵심** (§R-9 비-게이트 코드 항목은 소진됨)

### 즉시 처리 가능(사용자 1-답변/입력이면 코드 진행)
1. **🔑 durable RL 실제 활성화**(권장 1순위): CB-2/PA-4/5/6 보호는 코드 머지됐으나 **Upstash 미설정이라 현재 인메모리 폴백**. 사용자가 Upstash Redis(또는 Vercel Marketplace Upstash) 프로비저닝 후 Vercel env에 `UPSTASH_REDIS_REST_URL`+`UPSTASH_REDIS_REST_TOKEN` 설정 → 재배포하면 cross-instance 활성화. **env 주면 에이전트가 적용 가능**. (`.env.example`에 문서화됨.)
2. **CB-1 (CORS `*`) 확인**: `Access-Control-Allow-Origin: *`는 챗봇이 아니라 **`/api/agent/v1/*`(외부 AI 에이전트 채널: mcp/openapi/book/quote/tours/availability)**. 외부 에이전트 호출용이면 와일드카드가 의도적 → **사용자 확인: 이 에이전트 API는 외부 공개 의도인가?** 공개면 그대로 두고 종결, 아니면 신뢰 도메인 화이트리스트로 좁힘.

### 게이트(사용자 결정 후 해제)
- **P1**(user_profiles RLS WITH CHECK): Wave0(W0.1 `7d7c2244`)에서 처리됐는지 **라이브 RLS 재확인 후** 중복이면 종결.
- **preview 도구 ON → Wave 4**: 페이지별 프리미엄 모바일 개편(키트 준비됨)·W1.9 이모지→Lucide·W1.10 바텀내비·D-1 대시보드. preview 켜지면 진행.
- **pricing 민감(LIB-2/LIB-3)**: DMZ 7-9인 차량등급(`solati`↔`van`)·FX 폴백 1480 하드코딩. 실제 AtoC 요금표 대조 필요. **정수/반올림 변경 금지.**
- **D-15 보류 2건**: visitors distinct-over-range·retention left-censor — 원시 COUNT DISTINCT vs 신규 MV/RPC 설계 결정.
- **마이그레이션 정합/PITR(W2.1)**: repo≠live 드리프트 정합 + §J #12 PITR. Phase 4(데이터모델)·W3.1 site_settings 하드 선행.
- **§J 오픈입력**: #2 소유구조·#6 원가소스·#16 다크범위·#17 통합인박스·M-7(형제로케일 덮어쓰기 동작) 등.

### 연기(문서화됨, breaking이라 보류)
- **P5**(merchant login이 session/refresh_token을 JSON 바디로 반환 → httpOnly 쿠키 핸드셰이크 리팩터=클라 인증방식 변경).
- **P3**(middleware `/admin` Edge 서버가드 → Bearer-토큰 클라가 쿠키세션 미설정이라 admin 락아웃 위험). **데이터는 API requireAdmin로 안전**(#178 감사 확인).
- **public_bucket_allows_listing**(product-images/tour-gallery/tour-images broad SELECT) → 어드민 이미지 리스팅 깨짐 위험.
- **N15**(oversell 원자성) → availability-unlimited 결정과 충돌, 파킹.

## 3) 티켓 실행 루프 (각 PR마다)
1. 다음 티켓 선택. 착수 전 한 줄 계획 공유. **모든 file:line은 코드 직접 대조**.
2. 구현 — **로직은 순수 헬퍼로 추출해 단위테스트**(기존 `lib/*` 패턴). **신규 의존성 0**(외부 서비스는 fetch). UI는 Wave 1 키트 재사용.
3. 검증: `node_modules/.bin/tsc --noEmit` 0에러 + 변경범위/전체 jest(8 baseline fail만 허용) + `npm run build` exit 0 + (DB변경 시) advisor 재실행.
4. 커밋(티켓 단위). **푸터는 `Co-Authored-By: Claude <noreply@anthropic.com>`만**(모델 식별자·세션 URL 금지).
5. 플랜 §C 변경로그·§A 상태 갱신.
6. **배치 단위 main 머지**: gh 미설치 → GitHub REST API + git credential 토큰(`printf "protocol=https\nhost=github.com\n\n" | git credential fill`로 password 추출). PR body는 Write로 절대경로 파일 작성 후 python `urllib`로 POST/merge(`merge_method:"merge"`). 머지 후 `git merge --ff-only origin/main` 재동기화 + PR body 임시파일 삭제.

## 4) 절대 규칙 / 회귀 금지
- **하지 말 것:** requireAdmin 약화·service-role 키 클라번들 노출·웹훅 서명검증 제거·머니 cron fail-open화·pricing 정수/반올림 변경·재고(product_inventory) UI 추가(availability unlimited)·**신규 npm 의존성 추가**(node_modules 정션 오염).
- **마이그레이션/DDL/storage 설정 변경 = 사용자 승인 게이트**(하네스 차단). additive only.
- **세무(Wave 8) 자율 제출 금지** — CPA SIGN-OFF(§G-5) 후.
- 병렬 감사는 Agent에 "하위 에이전트 spawn 금지 + 최종 메시지로 직접 반환" 명시.

## 5) 완료 보고
각 배치 종료 시 빌드/테스트(8 baseline fail 제외)/advisor 결과를 **사실대로** 한국어 보고. 게이트로 막힌 건 사유와 함께 보고.

**다음 착수 지점: §2 — 1순위는 (a) 사용자가 Upstash env 제공 시 durable RL 활성화, (b) CB-1 외부공개 의도 확인. 그 외 코드 작업은 전부 사용자 결정 게이트(preview/pricing/마이그레이션/D-15/Wave4) 해제 후. 승인 즉시 시작.**

> 갱신: 2026-06-25 세션 — 보안/인증 8 PR(#174~#181, 13티켓+1감사, 테스트+52, 회귀0) 머지. §R-9 비-게이트 코드 항목 소진. 상세 §1 + 플랜 §A/§C 최신 행.
