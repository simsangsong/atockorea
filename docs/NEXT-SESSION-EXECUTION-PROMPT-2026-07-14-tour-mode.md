# 다음 세션 실행 프롬프트 — 투어모드(Tour Mode) 구현

**작성일:** 2026-07-14 (원격 Linux 클라우드 세션에서 작성)
**마스터 플랜(단일 기준):** `docs/tour-mode-master-plan-2026-07-14.md` ← 모든 결정·티켓·리스크의 유일한 출처
**개발 브랜치:** `claude/tour-mode-dev-iaa0b8` (main에서 분기, 플랜 문서 커밋됨)
**현재 상태:** 플랜 완결(§A~§O, 9웨이브/57티켓) + PR 오픈. **구현 착수 전 — 다음 작업 = Wave T0.**

---

## 1. 이어받는 즉시 할 일 (순서 고정)

1. `git fetch origin claude/tour-mode-dev-iaa0b8 && git checkout claude/tour-mode-dev-iaa0b8` (없으면 `-B`로 origin 기준 생성). 착수 전 `git merge origin/main`으로 최신화.
2. 마스터 플랜을 이 순서로 읽는다: **§0(요약) → §A(자산 인벤토리) → §B(아키텍처 결정 D-1~D-10) → §O(최종 리뷰 확정사항) → §F(WBS에서 다음 미완 티켓 확인)**.
3. §F에서 `✅` 표시가 없는 첫 티켓부터 착수. 최초 세션이면 **T0.1(마이그레이션 M-1~M-5 작성)**.
4. 티켓 완료 시 §F 해당 줄에 `✅ 완료(커밋해시)`를 추가하는 커밋을 함께 남긴다(인수인계 체인 유지).

## 2. 절대 규칙 (위반 금지)

- **커밋 푸터는 `Co-Authored-By: Claude <noreply@anthropic.com>`만.** 모델 식별자 절대 금지. 커밋/코드는 영어, 사용자 보고는 한국어.
- **라이브 DB 마이그레이션(T0.3)은 사용자 승인 후에만** `mcp__Supabase__apply_migration` 실행. DDL은 전부 additive. 적용 후 `get_advisors` 재실행해 신규 경고 0 확인.
- 기존 kursoflow 이식 API(messages/events/spot-events)의 요청·응답 계약을 깨지 않는다(T0.8은 동작 불변 리팩터만).
- 플랜에 없는 스코프는 구현하지 말고 §H 백로그에 기록. §K 오픈 퀘스천은 기본값으로 진행 가능.
- 푸시는 `git push -u origin claude/tour-mode-dev-iaa0b8`. 다른 브랜치 푸시 금지.

## 3. 핵심 결정 요약 (플랜 안 읽고 착수하는 사고 방지용 5줄)

- 전송: **Supabase Realtime Broadcast**(서버 API가 insert 후 HTTP Broadcast 송출, §O-7) + 기존 SSE 폴백. 자체 소켓 서버 없음.
- 입장: **토큰 링크 = 로그인 없이 1클릭 다이렉트 입장**(§O-1 8원칙). 손님 토큰=booking 스코프, 가이드 토큰=**tour-date 스코프**(§O-3).
- AI: **Gemini 2.5 Flash-Lite 기본**(번역·자막·비전), DeepSeek는 비PII 배치 전용, TTS는 기기 내장 우선 + 서버 캐시 폴백(§O-2 3단 래더). 목표 비용 <$0.1/투어일(§M).
- 위치: 핑 15s 서버 경유 rebroadcast + 30s 스냅샷, 손님은 옵트인, SOS는 1회성 위치 첨부(T7.3).
- 룸 단위: booking당 1룸 + 가이드 콘솔 팬아웃(D-3). 참가자 식별은 `device_key`(§O-4).

## 4. 환경 메모 (원격 Linux 클라우드 세션)

- `gh` CLI 없음 — GitHub 작업은 `mcp__github__*` 도구 사용(PR 생성/코멘트/CI 상태).
- 라이브 DB는 `mcp__Supabase__*`(프로젝트 `cghyvbwmijqpahnoduyv`). 스키마 확인은 `list_tables`, 문제 시 `get_logs`/`get_advisors` 먼저.
- Playwright Chromium 사전 설치(`/opt/pw-browsers`) — `playwright install` 실행 금지.
- 세션 컨테이너는 휘발성 — **의미 있는 변경은 즉시 커밋+푸시**.

## 5. 웨이브별 머지 게이트 (T8 전 순서)

T0~T2 완료 → 플래그 OFF 상태로 PR 갱신 → T3~T5 → 내부 리허설(§I 실기기 체크리스트) → T6~T7 → T8 파일럿. 각 웨이브 종료 시 lint/typecheck/기존 테스트 통과 확인 후 커밋.

## 6. 관련 문서

- 마스터 플랜: `docs/tour-mode-master-plan-2026-07-14.md`
- 기존 이식 코드: `app/api/tour-rooms/`, `app/api/tour-mode/`, `lib/openai-server.ts`, `lib/stt-router.ts`, 마이그레이션 `20260515133521`·`20260515142056`
- 참조 패턴: 토큰 `lib/agent/quoteToken.ts`, Realtime 훅 `lib/admin/useRealtimeActivity.ts`, publication 마이그레이션 `20260626000000`, 레이트리밋 `lib/durable-rate-limit.ts`, 이메일 `lib/email.ts`
