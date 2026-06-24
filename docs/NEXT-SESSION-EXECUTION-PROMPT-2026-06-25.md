# 다음 세션 마스터 프롬프트 — 어드민 대시보드 개편 **구현 이어가기** (Wave 0·1기반·3 머지 완료 후)

> 아래 블록 전체를 다음 세션 첫 메시지로 붙여넣으면 그대로 실행 가능. 진단(Phase 0~0.13)·Wave 0·Wave 1 기반·Wave 3 안정화는 **이미 머지 완료**. 이 세션은 **남은 게이트 해제 + 다음 배치 구현**.

---

역할: 너는 세계 최고의 풀스택 엔지니어이자 1등 UI/UX 디자이너이며 꼼꼼한 코드 감사자다. AtoC Korea 어드민 대시보드 전면 개편의 **구현 단계**를 이어받아 실행한다. 진행상황·상태 보고는 **한국어**(코드·커밋 메시지는 영어).

## 0) 시작 전 반드시 (순서 엄수)
1. **브랜치·워크트리:** 작업 브랜치 `claude/admin-dashboard-upgrade-yvb88c`. `git fetch origin` 후 전용 워크트리 `C:\Users\sangsong\atockorea-admin`에서 작업(있으면 거기서, 없으면 `git worktree add`). 메인 working dir은 타 세션 경합 — 쓰지 말 것. 시작 시 `git merge --ff-only origin/main`로 최신화.
2. **빌드/테스트 환경(비자명·중요):** 이 워크트리엔 `node_modules`가 **없다**. lockfile은 main과 동일하므로 **정션**으로 재사용: `New-Item -ItemType Junction -Path C:\Users\sangsong\atockorea-admin\node_modules -Target C:\Users\sangsong\atockorea\node_modules`. 빌드용 env는 `cp C:\Users\sangsong\atockorea\.env.local .env.local`(gitignore). 실행은 **로컬 바이너리 직접**: `node_modules/.bin/jest …`, `node_modules/.bin/tsc --noEmit -p tsconfig.json`, `npm run build`. ⚠️ `npx jest`는 엉뚱한 버전을 받아 `next/jest` 해석 실패하니 쓰지 말 것.
3. **읽기 순서:** 이 파일 → `docs/admin-dashboard-upgrade-master-plan-2026-06-24.md`의 **§A(상태)·§C(변경로그, 최신)·§R(WBS)** → 착수 티켓 섹션(§T 보안·§D 결함·§G-6 정산). 모바일이면 `docs/admin-premium-mobile-design-spec-2026-06-24.md`(이미 구현된 토큰/키트 참조).
4. **라이브 DB:** `mcp__atockorea__*`가 atockorea(`cghyvbwmijqpahnoduyv`)에 연결됨. 읽기 자유, **DDL은 additive + 적용 후 `get_advisors`(security/performance) 재실행**으로 회귀 확인.

## 1) 지금까지 완료(머지됨) — 다시 하지 말 것
- **Wave 0**(PR #167 `7b222ba7`): P1 권한상승·N27·cron secret/fail-open·B-1 노쇼·W-1 webhook.
- **Wave 1 기반**(PR #168 `c0804e60`): `--admin-*` 토큰(globals.css+tailwind.config.js)·16px 입력·sonner Toaster·44px·유틸키트(`lib/admin/haptics·useUrlFilters`, `components/admin/Spinner·Skeleton·SwipeRow`)·`AdminPageShell`·Tier1/2 키트(`components/admin/AdminPageHeader·StatCard·FilterBar·DataTable·DataCard·EmptyState·ActivityRow·ConfirmSheet·FilterSheet`)·BookingStatusBadge 아이콘+pill.
- **Wave 3 안정화**(PR #169 `b545605c` + #170 `3263e82f`): LIB-1·S-F2·D-4·B-3·M-4·M-6·D-14·N-5/S-F7·AR-1·AR-3. 헬퍼 전부 단위테스트(`lib/admin/temp-password·booking-status-transition·kst-day·merchant-update·content-generate-guard·pickup-points`, `lib/payments/no-show-capture`).
- **✅ Wave 9 공개 보안 배치1**(PR #171 `b39963fd`, 2026-06-25): PA-1(판정정정: 이미 안전·`lib/cron-auth` 추출)·PA-2/N17(upload DELETE 소유권·`lib/upload-auth`)·N11(inventory requireAdmin)·N13(promo-codes requireAdmin)·N16(confirm-email)·P2(create-profile) accessToken 필수화·P4(check-email per-IP RL)·CB-5(챗봇 예약 throttle)·PA-3(senderRole 서버권위). 테스트 +25.
- **✅ D-15 analytics 3 BLOCKER**(PR #172 `c3e91ae3`, 2026-06-25): experiments(`void conversionFilter` 폐기→`lib/analytics/event-match`로 필터적용+다변형 pairwise chi-square)·funnels(세션→**방문자 그룹**, `lib/analytics/funnel-walk`)·events/[name](timeseries 신선도 반전·cap totals 라벨, `lib/analytics/event-detail`). 골든 +30. **보류 2건(설계게이트): overview/events `total_visitors` distinct-over-range·retention left-censor — 일별집계로 정확값 불가, 원시 COUNT DISTINCT/신규 MV·RPC 결정 선행(+M-1 retention cap).**
- **✅ W5.7/W-10 환불경로(refund-only)**(PR #173 `c3865d14`, 2026-06-25): `POST /api/admin/orders/[id]/refund`(admin-gated, settle 패턴; 전액/부분; idempotencyKey; payment_status/refund_amount/refund_processed; audit_logs) + `charge.refunded` 웹훅(out-of-band 환불도 동기화) + 순수 `lib/payments/refund`. 골든 +11. **정산 대사 반영은 §G 후속(미반영).**
- **테스트 baseline:** 전체 `node_modules/.bin/jest --ci` = (위 작업 후) **489 pass / 8 fail**. ⚠️ **8 fail은 origin/main의 기존 환경결함**(폴리필 부재: tours/error-handler/logger/test-utils + **phase-z=콘텐츠 stale**: `jeju-grand-highlights-loop` haenyeo 타이밍 13:30/15:00→14:00, 보안/analytics와 무관·별도 추적). **회귀 아님** — 새 변경 후에도 이 8개만 실패해야 정상(임시 워크트리 `git worktree add -d <tmp> origin/main` + 정션으로 baseline 재확인 가능).

## 2) 다음 세션 우선순위 = **남은 야간/무인 친화 + 게이트 해제**
**추천순위 3건(Wave 9·D-15·W5.7)은 위에서 완료.** 남은 게이트 없는/낮은 후보:
- **⚙️ W3.8 인증/세션 로직:** P3(middleware `/admin` 서버가드 — 동작 확인 권장)·P5/P6(세션응답·비번변경). P5/P6은 순수로직 추출 가능.
- **🔒 Wave 9 잔여(§R-9):** P1(user_profiles RLS WITH CHECK — Wave0서 처리됐는지 재확인)·N14(checkout 소유권 IDOR)·N15(oversell 원자성)·N18(LINE OAuth)·N19(maps)·N20(보안헤더)·N21(middleware)·N34(storage)·PA-4~6(게스트/AI/contact RL). **CB-1(CORS)·CB-2(durable RL=Upstash)는 W9.11(신규 의존성 허용된 유일 케이스).**
- **📊 D-15 보류 2건:** visitors distinct-over-range·retention left-censor — **설계 결정 필요**(원시 COUNT DISTINCT 쿼리 vs 신규 MV/RPC). 사용자/아키텍처 결정 게이트.

## 3) 게이트로 **막힌** 것(임의로 하지 말 것 — 사용자에게 물어 해제)
- **preview(시각검증) 필요:** Wave 4 페이지별 프리미엄 모바일 개편(키트는 준비됨)·W1.9 이모지→Lucide(analytics 수백개)·W1.10 바텀내비 5슬롯(`/admin/inbox`=W4.4 선행)·대시보드 D-1·D-5 contacts. → **preview 도구를 켤 수 있으면 진행.**
- **pricing 민감:** LIB-2(DMZ 7-9인 차량등급 `solati`↔`van`)·LIB-3(FX 폴백 1480 하드코딩). 실제 AtoC 요금표 대조/사용자 확인 필요. **정수/반올림 변경 금지.**
- **사용자 결정:** M-7(tour-product-pages 형제로케일 덮어쓰기 — opt-out 동작 결정)·§J 오픈입력(#2 소유구조·#3 gross/net→Wave8·#6 원가소스·#11 보안트랙·#12 PITR→W2.1·#15 dashboard 포털·#16 다크범위·#17 통합인박스).
- **마이그레이션 게이트:** W3.1 site_settings(N33)는 **W2.1 마이그레이션 정합**(§Q-2 런북, §J #12 PITR 확인) 선행. Wave 5 데이터모델·Wave 8 세무(§G-5 CPA SIGN-OFF)도 게이트.

## 4) 티켓 실행 루프 (각 PR마다)
1. 다음 티켓 선택(§2 우선). 착수 전 한 줄 계획 공유. **모든 file:line은 코드 직접 대조**(플랜 줄번호는 변동 가능).
2. 구현 — **로직은 순수 헬퍼로 추출해 단위테스트**(기존 `lib/admin/*` 패턴). UI는 Wave 1 키트 재사용(신규 의존성 0).
3. 검증: `node_modules/.bin/tsc --noEmit` 0에러 + 변경범위 jest + `npm run build` exit 0 + (DB) advisor 재실행 + (UI·가능시) preview 모바일 뷰포트.
4. 커밋(티켓 단위) → `git push -u origin claude/admin-dashboard-upgrade-yvb88c`. **커밋 푸터는 `Co-Authored-By: Claude <noreply@anthropic.com>`만**(모델 식별자·세션 URL 금지).
5. 플랜 §C 변경로그·§A 상태 갱신.
6. **배치(2~10 티켓) 단위로 main 머지:** gh 미설치 → GitHub REST API + git credential 토큰(`printf "protocol=https\nhost=github.com\n\n" | git credential fill`로 추출). PR 생성→`merge_method:"merge"`로 머지. ⚠️ PR 본문은 Write 도구로 **절대경로 파일** 작성 후 `python json.dumps(open(...).read())`로 payload(bash `/tmp`↔Windows python 경로 불일치 주의). 머지 후 `git merge --ff-only origin/main`로 브랜치 재동기화.

## 5) 절대 규칙 / 회귀 금지
- **하지 말 것:** requireAdmin(서버 DB검증) 약화·service-role 키 클라번들 노출·웹훅 서명검증 제거·머니 cron fail-open화·pricing 정수/반올림 변경·재고(product_inventory) UI 추가(availability unlimited 결정).
- **마이그레이션 additive only**(`ADD COLUMN/CREATE … IF NOT EXISTS`). RPC 시그니처 변경은 GRANT 재발급 + 호출부 원자 배포.
- **세무(Wave 8) 자율 제출 금지** — 데이터·초안까지만, CPA SIGN-OFF(§G-5) 후.
- **신규 의존성 0**(모바일): 기존 토큰·`components/ui/*`·`components/admin/*`(이미 구축)·`ConfirmDialog`·framer-motion·sonner 재사용. durable rate-limit(W9.11)만 Upstash/KV 허용.
- 병렬 감사는 Agent에 **"하위 에이전트 spawn 금지 + 최종 메시지로 직접 반환"** 명시.

## 6) 완료 보고
각 배치/웨이브 종료 시 빌드/테스트(8 baseline fail 제외)/advisor 결과를 **사실대로** 한국어 보고(실패는 출력과 함께). 게이트로 막힌 건 사유와 함께 보고.

**다음 착수 지점: §2 — Wave 9·D-15·W5.7은 머지 완료(PR #171~#173). 다음은 ⚙️ W3.8(P3 미들웨어 가드·P5/P6) 또는 🔒 Wave 9 잔여(N14·N15·N18~21·N34·PA-4~6), 또는 사용자가 preview를 켜면 Wave 4 페이지 개편. D-15 보류 2건은 설계 결정 게이트. 승인 즉시 시작.**

> 갱신: 2026-06-25 세션 — Wave 9 보안 9건 + D-15 analytics 3건 + W5.7 환불경로 머지(PR #171~#173, 테스트 +66, 회귀0). 상세 §1 + 플랜 §A/§C.
