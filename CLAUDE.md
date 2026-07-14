# CLAUDE.md — 프로젝트 메모리

## 진행 중: 투어모드(Tour Mode) 개발 — 실시간 투어룸

**마스터 플랜(단일 기준):** `docs/tour-mode-master-plan-2026-07-14.md` (§A~§O, 9웨이브/57티켓)
**부트스트랩:** `docs/NEXT-SESSION-EXECUTION-PROMPT-2026-07-14-tour-mode.md` ← **투어모드 이어받으면 이걸 먼저**
**개발 브랜치:** `claude/tour-mode-iql6ho` (플랜 문서 브랜치 `claude/tour-mode-dev-iaa0b8`를 머지해 구현 진행)
**상태:** Wave T0 완료 + Wave T1 진행 중(T1.1~T1.5 완료 — join/snapshot API, D-8 로케일 타게팅+Broadcast+원문 선게시, 진입/룸 페이지, Realtime 채널 훅. 테스트 123개). **T0.3 라이브 DDL만 사용자 승인 대기.** 다음 = T1.6.

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
