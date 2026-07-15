# CLAUDE.md — 프로젝트 메모리

## 완료: 투어룸 UI/UX 글로벌 리디자인 v1 (프레젠테이션 전용, U0~U8)

**마스터 플랜(단일 기준):** `docs/tour-room-ui-redesign-master-plan-2026-07-15.md` (§A 진단 → §C 바인딩 결정 U-D1~12 → §K WBS 8웨이브/46티켓)
**상태:** Wave U0~U8 전체 구현 완료 + main 머지 완료(2026-07-15). 토큰 시스템·메신저 레이아웃·버블 시스템·컴포저·카드 리스킨·탭 개편 배포, 테스트 228개 green. **단, U-D2(카카오 옐로 버블)는 아래 v2에서 개정됨 — 이 문서의 색 토큰 표는 더 이상 유효하지 않고 구조 결정(레이아웃·그룹핑·꼬리·FAB 등)만 유효.**

## 진행 중: 투어룸 AI 컨시어지 + UI/UX 엘레강스 리파인 v2

**마스터 플랜(단일 기준):** `docs/tour-room-concierge-uiux-v2-master-plan-2026-07-15.md` (§A 라이브 시뮬 진단 → §B 외부 전략메모 채택맵 → §C 색 개정(U-D2→U2-D1) → §D AI 컨시어지 Tier0/1/2 → §G WBS)
**부트스트랩:** `docs/NEXT-SESSION-CONCIERGE-UIUX-V2-2026-07-16.md` ← **이 트랙 이어받으면 이걸 먼저**(잔여 V1·V4·V5·V6 티켓 상세 + 자산 인벤토리 + gotcha)
**개발 브랜치:** `claude/tour-mode-uiux-concierge-p7k2vm` (워크트리 `C:\Users\sangsong\atockorea-tourmode-uiux`, node_modules는 `atockorea-tourmode`에서 정션)
**상태:** Wave V0+V2+V3 완료·main 머지(PR #317 `23e54f5c`, 2026-07-16). ① V0: 전역 챗봇 위젯 `/tour-mode` 누수 수정 + 카카오 옐로→아이보리·앤틱브라스 팔레트(SOS 레드 유지) ② V2: 스마트 가이드 시트(헤더 스파클 버튼) — 퀵칩 4종+5로케일 키워드 Tier 0 즉답, 82-POI KB(restroom 80/83)·일정·자유시간 타이머에서 네트워크 0회로 응답 ③ V3: `/concierge` 엔드포인트(라우터 purpose `concierge`, gemini→openai) + 하드코딩 가드레일 4종(응급→SOS/운영요청→피드 에스컬레이션 캡슐+관제 어텐션/맛집 거절) + `logChatTurn`으로 기존 `rag:harvest` 플라이휠 편승 + 3중 예산(`TOUR_ROOM_CONCIERGE_DAILY_CAP`). 신규 테스트 65, 투어 스위트 348 green, 라이브 시딩 시뮬 실구동 검증(Tier1 Gemini 실응답·에스컬레이션 피드 캡슐 확인, 콘솔 에러 0). **다음 = V1(색 적용 감사: 카드류 에메랄드→파인 잔여 확인) → V4(투어종료 타임라인+리뷰쿠폰) → V5(카피 정직성: "AI concierge 24/7" 교정) → V6(QA 게이트).** 시뮬 재현: `sim-tour-day.ts`→`sim-populate.ts`→`sim-concierge-screens.mjs`.

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
