# 다음 세션 마스터 프롬프트 — 어드민 대시보드 개편 **구현 실행** (Phase 0/Wave 0부터)

> 아래 블록 전체를 다음 세션 첫 메시지로 붙여넣으면 그대로 실행 가능. 진단·플랜(Phase 0~0.13)은 **완료**. 이 세션부터는 **실제 코드/DB 구현**.

---

역할: 너는 세계 최고의 풀스택 엔지니어이자 1등 UI/UX 디자이너이며 꼼꼼한 코드 감사자다. AtoC Korea 어드민 대시보드 전면 개편의 **구현 단계**를 이어받아 실행한다.

## 0) 시작 전 반드시 (순서 엄수)
1. **브랜치·워크트리(중요·비자명):** 작업 브랜치 `claude/admin-dashboard-upgrade-yvb88c`는 **로컬에 없을 수 있다**. `git fetch origin` 후 **전용 워크트리**에서 작업: 이미 `C:\Users\sangsong\atockorea-admin`가 있으면 거기서, 없으면 `git worktree add C:\Users\sangsong\atockorea-admin claude/admin-dashboard-upgrade-yvb88c`. 메인 working dir(`C:\Users\sangsong\atockorea`)은 타 세션과 경합하니 쓰지 말 것.
2. 읽기 순서: `CLAUDE.md` → `docs/admin-dashboard-upgrade-master-plan-2026-06-24.md`의 **§L(인수인계) → §A(상태) → §R(실행 WBS v2)** → 착수 티켓 관련 섹션(§T 보안·§G-6 정산·§U/컴패니언 모바일) → 모바일 작업이면 `docs/admin-premium-mobile-design-spec-2026-06-24.md`.
3. **라이브 DB:** `mcp__atockorea__*` 도구가 atockorea(`cghyvbwmijqpahnoduyv`)에 연결됨. 읽기 조회는 자유, **DDL 변경은 additive + 적용 후 반드시 `mcp__atockorea__get_advisors`(security/performance) 재실행**으로 회귀 확인.

## 1) 실행 순서 = §R 웨이브 (W0가 가장 먼저)
**Wave 0 — 즉시 핫픽스(라이브 보안·머니, 각 독립 소형 PR)를 가장 먼저.** 그중에서도:
- **W0.1 P1 권한상승 차단이 단일 최우선** — `user_profiles` UPDATE/INSERT RLS에 role `WITH CHECK` 추가(또는 role을 admin-only SECURITY DEFINER RPC로 분리). 현재 **임의 고객이 PostgREST에 `PATCH /rest/v1/user_profiles {"role":"admin"}`로 관리자 자기승격 가능**(라이브 확정). 적용 후 비-admin 토큰으로 PATCH가 거부되는지 라이브 재현 테스트.
- 이어 W0.2(N27 REVOKE)·W0.3(cron secret URL)·W0.4(cron fail-open)·W0.5(B-1 노쇼 부분캡처)·W0.6(W-1 webhook 상태가드).

그다음 **Wave 1(프리미엄 모바일 기반)** → **Wave 2(마이그레이션 정합 게이트)** → **Wave 3(기능 안정화)** → **Wave 4(페이지별 프리미엄 모바일)** → **Wave 5(데이터)** → 6(통계) → 7(신규기능) → 8(세무, 게이트) → 9(공개 보안, 병렬) → 10(머천트 포털) → 11(검증). 각 티켓의 파일·의존·DoD는 §R 참조.

## 2) 티켓 실행 루프 (각 PR마다)
1. §R에서 다음 티켓 선택(웨이브 순, 의존 충족분). 착수 전 한 줄 계획 공유.
2. 구현. **모든 file:line 가정은 코드 직접 대조로 확인**(플랜의 줄번호는 작성 시점 기준 — 변동 가능).
3. 검증: 빌드 green + 변경범위 단위/회귀 테스트 + (DB) advisor 재실행 + (UI) 가능하면 preview로 모바일 뷰포트 확인.
4. 커밋(티켓 단위) → 푸시 `git push -u origin claude/admin-dashboard-upgrade-yvb88c`. **커밋 푸터에 모델 식별자 금지**(`Co-Authored-By: Claude <noreply@anthropic.com>`만; 세션 URL 조작 금지).
5. 플랜 §A 상태·§C 변경로그 한 줄 갱신.

## 3) 절대 규칙 / 게이트
- **W0.1(P1)·Wave 9는 라이브 즉시 리스크** — 어드민 개편과 무관하게 우선/병렬 가능. P1은 다른 결정 대기 없이 바로.
- **마이그레이션은 additive only**(`ADD COLUMN IF NOT EXISTS`/`CREATE ... IF NOT EXISTS`). RPC 시그니처 변경(W5.2)은 GRANT 재발급 + 호출부 **원자 배포**.
- **세무(Wave 8)는 자율 제출 금지** — 데이터·초안까지만, CPA/세무변호사 SIGN-OFF(§G-5) + §J #2/#3 후에만 착수.
- **§J 오픈입력이 막는 웨이브:** #2 소유구조·#3 gross/net→Wave 8(+W5.1 revenue_treatment 의미); #6 원가소스→cost_plus 정산; #12 PITR→W2.1; #11 보안트랙 착수; #15 dashboard 포털→W10.2; #16 다크범위; #17 통합인박스. **막힌 티켓은 건너뛰고 가능분 먼저**, 막힌 사유를 사용자에게 보고.
- **신규 의존성 0** 원칙(모바일): 기존 토큰·`components/ui/*`·`components/mypage/ConfirmDialog`·framer-motion·sonner 재사용. durable rate-limit(W9.11)만 Upstash/KV 신규 허용.
- **하지 말 것(회귀 금지):** requireAdmin(서버 DB검증) 약화·service-role 키를 클라 번들 노출·웹훅 서명검증 제거·머니 cron fail-open화·pricing 정수/반올림 변경·재고(product_inventory) UI 추가(availability unlimited 결정).
- 병렬 감사가 필요하면 Agent에 **"하위 에이전트 spawn 금지 + 최종 메시지로 직접 반환"** 명시.

## 4) 완료 보고
진행상황·상태 보고는 **한국어**(코드·커밋 메시지는 영어). 각 웨이브 종료 시 빌드/테스트/advisor 결과를 사실대로 보고(실패는 출력과 함께).

**다음 착수 지점: Wave 0 → W0.1(P1 권한상승 차단). 사용자 승인 즉시 시작.**
