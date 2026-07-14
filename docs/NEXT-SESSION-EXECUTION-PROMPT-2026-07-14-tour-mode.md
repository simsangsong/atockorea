# 다음 세션 실행 프롬프트 — 투어모드(Tour Mode) 구현

**최초 작성:** 2026-07-14 (플랜 세션) / **전면 개정:** 2026-07-14 (Wave T0~T1 구현 세션 종료 시점)
**마스터 플랜(단일 기준):** `docs/tour-mode-master-plan-2026-07-14.md` ← 모든 결정·티켓·리스크의 유일한 출처 (§F에 티켓별 완료 커밋 해시 기록됨)
**개발 브랜치:** `claude/tour-mode-iql6ho` — 원격 세션은 각자 지정 브랜치에 **이 브랜치를 머지**해 이어가고, 티켓 완료 시 §F 갱신 커밋을 남긴다
**현재 상태:** **Wave T0 전체 완료(9/9) + Wave T1 사실상 완료** — T1.1~T1.10, T1.12 완료 / T1.11은 ⑧(QR·취소 revoke, T5.1 동반)만 잔여. E2E(playwright) 신설·통과, tsc 0. 다음 = **Wave T2(음성)**. 플랜은 58티켓으로 개정됨(2026-07-14 사용자 결정 2건 반영).

---

## 1. 이어받는 즉시 할 일 (순서 고정)

1. `git fetch origin claude/tour-mode-iql6ho` 후 지정 브랜치에 머지(또는 checkout). 착수 전 `git merge origin/main`으로 최신화.
2. ~~T0.3 라이브 DDL 적용~~ — **✅ 완료(2026-07-14, 로컬 Windows 세션에서 `mcp__atockorea__apply_migration`으로 적용).** 20260714090000·091000 + 후속 20260714150000(created_by 커버링 인덱스)까지 라이브 반영. 어드바이저 확인 결과는 마스터 플랜 §F T0.3 참조.
3. 마스터 플랜을 이 순서로 읽는다: **§0(요약) → §B(결정 D-1~D-10) → §O(확정 사양) → §F(WBS에서 `✅` 없는 첫 티켓)**.
4. 다음 미완 티켓 순서: ~~T1.9~~(✅ 83c79209) → ~~T1.11 로비 뷰~~(✅ 8c7c30d6; QR·취소 revoke는 T5.1과 함께) → **Wave T2(음성 — 개정된 T2.2 확인 필수)**.
5. 티켓 완료 시 §F 해당 줄에 `✅ 완료(커밋해시)` 갱신 커밋을 함께 남긴다(인수인계 체인 유지).

## 2. 절대 규칙 (위반 금지)

- **커밋 푸터는 `Co-Authored-By: Claude <noreply@anthropic.com>`만.** 모델 식별자 절대 금지. 커밋/코드는 영어, 사용자 보고는 한국어.
- 라이브 DB 마이그레이션은 additive만. 적용 후 `get_advisors` 재실행. (T0.3은 승인 완료 상태 — §1-2 참조.)
- 기존 API 계약을 깨지 않는다. 회귀 테스트가 지키고 있다: `__tests__/api/tour-rooms-routes.test.ts`(22), `tour-rooms-join.test.ts`(6).
- 플랜에 없는 스코프는 구현하지 말고 §H 백로그에 기록. §K 오픈 퀘스천은 기본값으로 진행 가능.
- 푸시는 세션 지정 브랜치로 `git push -u origin <브랜치>`. 다른 브랜치 푸시 금지.

## 3. 핵심 결정 요약 (플랜 안 읽고 착수하는 사고 방지용)

- 전송: **Supabase Realtime Broadcast**(서버가 insert 후 HTTP Broadcast 송출, §O-7) + SSE 폴백. 채널명 `tour-room:{roomId}:{HMAC시크릿8자}` — join 응답으로만 전달(R-23).
- 입장: **토큰 링크 = 로그인 없이 1클릭 다이렉트 입장**(§O-1). 손님 토큰=booking 스코프, 가이드 토큰=**tour-date 스코프**(§O-3). 모든 입장은 `POST /join` 단일 관문 → 룸세션(`x-tour-room-auth`) 발급.
- AI: **Gemini 2.5 Flash-Lite 기본**, DeepSeek는 비PII 배치 전용, TTS는 기기 내장 우선(§O-2). 번역 메모리 캐시 + 참가자 로케일 타게팅(D-8). 목표 <$0.1/투어일(§M).
- **[신규 2026-07-14] 음성 발신은 "발송 전 STT 텍스트 확인"이 기본**(T2.2 개정): 녹음 → STT 전용 엔드포인트 → Composer에 채워 확인·수정 → 텍스트 경로로 발송. 설정 토글(기본 ON)로 제어, 저품질은 항상 강제 확인.
- **[신규 2026-07-14] 룸 설정 탭**(T1.12, 구현 완료): 언어(재join으로 D-8 동기화)·라이트/다크/자동·음성확인 토글·자동낭독 토글·글자크기. localStorage `tour_mode_settings`.

## 4. 구현 현황 인벤토리 (이번 세션 산출물 — 재사용하라)

| 자산 | 위치 | 비고 |
|---|---|---|
| 마이그레이션 M-1~M-6 | `supabase/migrations/20260714090000` · `091000` | **라이브 미적용(T0.3)**. invites는 §O-3 정합 CHECK 포함 |
| 초대 토큰 | `lib/tour-room/token.ts` | HMAC, 듀얼 시크릿 로테이션(§O-13), `hashToken`=폐기 대장 키 |
| 단일 인가 | `lib/tour-room/access.ts` | `resolveRoomActor` (admin>토큰>룸세션>owner>merchant>게스트), 룸세션 sign/verify, SSE용 `rs` 쿼리 인가 |
| geo 순수함수 | `lib/tour-room/geo.ts` | 히스테리시스·60s dwell·속도 가드(R-9/R-10) |
| KST 시간 | `lib/tour-room/time.ts` | `kstToday`, `roomLifecycle`(lobby/live/ended), R-7 수정 완료 |
| 서버 Broadcast | `lib/tour-room/realtime.ts` | HTTP 엔드포인트 송출(§O-7), `roomChannelTopic` 시크릿 |
| 스냅샷 빌더 | `lib/tour-room/snapshot.ts` | 콜드스타트 1왕복 번들, `getParticipantLocales`(D-8), `normalizeRoomLocale` |
| AI 라우터 | `lib/ai/router.ts` | 3사 env 스위칭, 데모션, 번역 메모리(§M-2 ④), 스킵 휴리스틱(⑤). `translateTextForLocales`가 경유 |
| 퀵답장 상수 | `lib/tour-room/quickReplies.ts` | 8종×5로케일, 서버가 `presetKey`로 소비(LLM 0회) |
| 긴급 연락처 | `lib/tour-room/emergency.ts` | 119/112/1330 + env `NEXT_PUBLIC_TOUR_OPS_PHONE` |
| 플래그 | `lib/tour-room/flags.ts` | `NEXT_PUBLIC_TOUR_MODE_V1` |
| API | `app/api/tour-rooms/[bookingId]/{join,messages,events,spot-events}` · `app/api/tour-mode/room/[bookingId]/snapshot` | join 응답 = `{room, lifecycle, participant, session, channel.topic, snapshot}`. messages POST: D-8 타게팅+Broadcast+원문 선게시(R-6)+`presetKey` |
| 훅 | `hooks/useTourRoomSession.ts` · `useTourRoomChannel.ts` · `useTourRoomSettings.ts` | device_key(§O-4)·재입장(§O-1 ④) / Realtime→SSE→visibility 재동기화(§O-6)+발신 큐(R-5) / 설정 스토어 |
| UI | `components/tour-mode/` (RoomShell 4탭·ChatFeed·Composer·SettingsTab·EmergencyCard·WebviewEscapeBanner·TourModeEntry·TourRoomClient) + `app/tour-mode/` | 다크모드는 룸 스코프 `.dark`, 5로케일 정적 상수(entryCopy) |
| 미들웨어 | `middleware.ts` | `/tour-mode` 로케일 중립 통과 + RESERVED_ROOT_SEGMENTS 등재(§O-1 ①) |
| i18n | `messages/*.json` `tourMode.*` | 6로케일 패리티 테스트 |
| 테스트 | `__tests__/{lib/tour-room,lib/ai,api,hooks,components/tour-mode,i18n}` | 14스위트 164개 |

## 5. 환경 메모 (원격 Linux 클라우드 세션 함정 모음)

- `npm install --ignore-scripts` 사용 — `supabase` 패키지 postinstall이 프록시에서 Z_DATA_ERROR로 깨짐. jest/tsc/eslint에는 지장 없음.
- node 환경 API 라우트 테스트는 **첫 import로 `@/test-utils/restoreWebPrimitives`** 필수(jest.setup의 Response 스텁 때문에 NextResponse.json이 조용히 빈 body가 됨).
- `__tests__/api/tours.test.ts` 2건 실패는 **이 작업 이전부터 있던 기존 실패** — 건드리지 말 것.
- `gh` CLI 없음 — GitHub은 `mcp__github__*`. Supabase는 `mcp__Supabase__*`인데 **연결 계정이 세션마다 다름** — `list_projects` 먼저.
- Playwright Chromium 사전 설치(`/opt/pw-browsers`, `playwright install` 금지) — 단 레포에 playwright 설정 자체가 없어 T1.9는 config·의존성 신설부터.
- 세션 컨테이너 휘발성 — **티켓 단위로 즉시 커밋+푸시**.

## 6. 웨이브별 머지 게이트 (변동 없음)

T0~T2 완료 → 플래그 OFF 상태로 PR 갱신 → T3~T5 → 내부 리허설(§I 실기기 체크리스트) → T6~T7 → T8 파일럿. 각 웨이브 종료 시 lint/typecheck/기존 테스트 통과 확인 후 커밋.

## 7. 관련 문서

- 마스터 플랜: `docs/tour-mode-master-plan-2026-07-14.md` (§F에 완료 해시, §O에 확정 사양)
- 플랜 문서 원본 브랜치(머지됨): `claude/tour-mode-dev-iaa0b8` (PR #302)
- 참조 패턴: 토큰 `lib/agent/quoteToken.ts`, 레이트리밋 `lib/durable-rate-limit.ts`, 이메일 `lib/email.ts`, publication 마이그레이션 `20260626000000`
