# NEXT SESSION — Unified Guide/Driver Console + Input Pipeline Fix

- 작성일: 2026-07-19
- 트랙: 스마트 가이드 프라이빗 모드 (SoT `docs/smart-guide-private-mode-master-plan-v2-2026-07-16.md`)
- 상태: 계획 확정, 구현 전. **Phase 0부터 순서대로 진행.**
- 절대 목표: **손님·가이드·기사가 서로 대화(채팅)·번역·음성/텍스트 입력하는 데 아무런 지장이 없어야 한다.** 이걸 못 지키면 나머지는 의미 없음.

최근 머지된 관련 PR: #348 플래너 넛지 · #349 가이드콘솔 통일 · #350 기사 콕핏 · #351 기사 푸시·지출. 진행 보고는 한국어, 코드/커밋은 영어.

---

## 1. 확정된 근본원인 (진단 완료)

🔴 **마이크/카메라 권한 팝업이 안 뜨는 진짜 원인 = `next.config.js` 약 164줄 Permissions-Policy 헤더.**

```
value: 'camera=(), microphone=(), geolocation=(self), browsing-topics=()',
```

`microphone=()` / `camera=()` = 자기 자신(self) 포함 **사이트 전체에서 마이크·카메라 원천 차단**. 이러면 `navigator.mediaDevices.getUserMedia()`가 **권한 프롬프트도 없이 즉시 거부**됨 → 브라우저는 "마이크 차단됨"만 표시. 손님·가이드·기사 전부 음성/사진 입력이 막혀 있음.

**수정:**
```
value: 'camera=(self), microphone=(self), geolocation=(self), browsing-topics=()',
```
(self만 허용 — 서드파티 아님, 보안 적정.) 헤더는 **재배포돼야 적용**됨.

---

## 2. 제공자/키 진실표 (검증 완료 — 라우터 기반, OpenAI는 만능 폴백)

`lib/openai-server.ts`는 겉만 OpenAI고 실제로는 라우터에 위임한다. 착각 주의.

| 기능 | 1순위 | 폴백 | 코드 | 키 |
| --- | --- | --- | --- | --- |
| STT | **Groq Whisper** `whisper-large-v3-turbo` | OpenAI `gpt-4o-mini-transcribe` | `lib/stt-router.ts:133` (`STT_PRIMARY_PROVIDER` 기본 `groq`) | `GROQ_API_KEY`(+선택 `GROQ_STT_MODEL`) / `OPENAI_API_KEY` |
| 번역 | **Gemini 2.5 Flash-Lite** `gemini-2.5-flash-lite` | OpenAI `gpt-5-mini` | `lib/ai/router.ts:57` (`translate` 래더 `gemini→openai`) + `tour_translation_cache` 선조회(히트 시 LLM 0회) | `GEMINI_API_KEY` / `OPENAI_API_KEY` |
| TTS | **기기 자체 TTS** (Web Speech, `speakWithDevice`) | OpenAI `gpt-4o-mini-tts` | `lib/tour-room/tts.ts` (device tier) → `/tts` 라우트 유료 폴백 | 유료 폴백만 `OPENAI_API_KEY` |

- 라우터 규칙: **키가 설정된 provider만 체인에 들어감.** OpenAI만 있어도 전부 폴백으로 동작. 아무 키도 없으면 `"No AI provider configured (set GEMINI_API_KEY / OPENAI_API_KEY)"`.
- ✅ **`atockorea`(Vercel) 프로젝트 env에 `GROQ_API_KEY`·`GEMINI_API_KEY`·`OPENAI_API_KEY` 전부 설정 확인됨** (2026-07-19). VAPID 2종(`WEB_PUSH_VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY`)·`WEB_PUSH_CONTACT`·`NEXT_PUBLIC_TOUR_OPS_PHONE`·`NEXT_PUBLIC_TOUR_MODE_V1`·`CRON_SECRET` 도 존재. → **키 작업 불필요.**
- ⚠️ Vercel env는 **프로젝트별**. Groq/Gemini는 한때 `kursoflow-app`에만 있었고 2026-07-19에 `atockorea`에도 추가함. 다시 확인할 땐 `atockorea` 프로젝트로 필터.

**녹음 경로**: `lib/tour-room/recorder.ts` `startVoiceRecording`(→`getUserMedia`). `Composer`(손님)·`DriverConsole`(기사)가 공유. 기사 음성: 녹음→3초 취소창→`POST /messages`(audio multipart)→서버 STT+번역. 손님 `Composer`: 녹음→`POST /stt`(받아쓰기만)→입력창 검토 후 전송.

---

## 3. Phase 0 — 입력 원천 차단 해제 (최우선, 작음)

1. `next.config.js` Permissions-Policy를 `microphone=(self), camera=(self)` 로 수정(§1).
2. 커밋→PR→머지→**재배포**(헤더는 배포돼야 적용).
3. 배포 후 실제 브라우저에서 마이크 허용 프롬프트가 실제로 뜨는지 확인.
4. 종단 검증: 텍스트 전송→상대 언어 번역 도착 / 음성 녹음→STT→상대 언어 버블 / 상대 메시지→TTS 재생.
   - 플래그 `NEXT_PUBLIC_TOUR_MODE_V1` 값 확인 — ON이면 프로덕션 사용자 영향.
   - 시드 룸+토큰 필요한 픽셀/기기 QA는 `scripts/qa-ios-smoke.ts`(Playwright) 사람 게이트.

---

## 4. Phase 1 — 모든 입력방식 오픈 (STT·타이핑·TTS) + 견고한 권한 UX

- 기사/통합 콕핏(`DriverConsole.tsx`)에 **풀 입력 바**(`components/tour-mode/Composer.tsx` 재사용 검토): 타이핑 + 음성(STT→검토→전송) + 프리셋. 지금 기사앱은 음성 전용이라 텍스트가 막혀 있음 → **텍스트 오픈.**
- **전체 공지(broadcast)에도 음성 입력** 추가(녹음→STT→문구 채움→전송). 현재 guide broadcast는 텍스트 전용.
- **선제 마이크 권한 플로우**: "🎤 마이크 허용" 버튼 + 짧은 설명 → `getUserMedia`로 프롬프트 유발. `navigator.permissions.query({name:'microphone'})`로 상태(prompt/granted/denied) 감지해 안내(denied면 초기화 방법 안내).
- **인앱 브라우저(카카오톡/네이버 웹뷰) 감지 → "크롬/사파리로 열기" 강제 유도**(웹뷰는 헤더 고쳐도 mic 막힘; 기존 `components/tour-mode/WebviewEscapeBanner.tsx` 활용). 실패 시 항상 텍스트 입력으로 폴백 가능하게.

---

## 5. Phase 2 — 가이드 앱 + 기사 앱 통합 (기능 생략 0)

- 배경: 손님 적으면 가이드가 직접 운전, 스몰그룹은 전부 가이드 운전. **양쪽 모든 기능 합치되 생략 금지.**
- 아키텍처(확정): **공용 `Cockpit` 컴포넌트**를 만들어 `/tour-mode/driver`(순수 기사, 차량PIN)와 가이드 앱이 **공유**.
  - 가이드 앱(`components/tour-mode/guide/GuideConsole.tsx`) = **통합 홈**(멀티룸 디스패치·라이트 `tr-plan-root` UI 유지) + 룸 카드마다 **"운전 모드"** → 그 룸의 **다크 콕핏**(4앱 내비·음성 브릿지·원탭 시그널 타세요/지연/복귀/도착/주차핀/차량문제·Wake Lock·지출·백그라운드 푸시)로 진입.
  - 가이드 세션으로 join → `driver-signal`·`manual-arrival`·`/messages`·`/extras` 전부 **이미 guide role 허용됨.**
  - 나머지 가이드 도구(일정 확정·정산 원장·전체공지·집합·자유시간) 유지.
- 내비 좌표: run-mode는 `GET /plan`의 저장 stops 좌표(쓰기 시 `enrichStopCoords`로 채워짐) 사용.
- **UI = 좋은 것만**: 정지(계획·디스패치)=가이드 라이트 카드, 운전 중=기사 다크 고대비 큰 버튼. 룸별 토글.
- 순수 기사(가이드 아님·큰 그룹)용 `/driver`는 같은 Cockpit 컴포넌트로 유지.

---

## 6. 수용 기준 (전부 통과해야 완료)

1. 가이드/기사가 타이핑→전송 시 손님이 자기 언어로 번역돼 받는다.
2. 가이드/기사가 말하기→STT→손님이 자기 언어 버블로 받는다.
3. 손님 메시지→가이드/기사가 TTS로 듣고 번역된 텍스트를 본다.
4. 전체 공지(broadcast)가 텍스트·음성 둘 다 된다.
5. 헤더 수정 후 일반 브라우저에서 첫 사용 시 마이크 허용 프롬프트가 실제로 뜬다. 인앱 웹뷰는 "브라우저로 열기" 유도.
6. 번역=Gemini→OpenAI, STT=Groq→OpenAI 경로대로 동작(키 전부 존재).

---

## 7. 컨벤션/게이트

- 검증: `npx tsc --noEmit` / `npx eslint <files>` / `npx jest ... --testPathIgnorePatterns "\.claude[\\/]worktrees"`.
  - jest가 `.claude/worktrees`의 낡은 다른 브랜치 테스트를 주워 FAIL 표시 → 무시.
  - `tours.test.ts` 2건은 `Response.json is not a function` jest 환경 이슈로 **main에서도 실패하는 사전존재 건**, 무관.
- 머지: `gh` 미설치 → GitHub REST API(`git credential fill`→python urllib). 매번 `origin/main` fetch 후 **새 브랜치를 origin/main에서 분기**(로컬 브랜치는 보통 stale/behind), 커밋→push→PR→merge(`merge_method: 'merge'`). 스크래치패드 `merge_pr*.py` 템플릿 참고.
- 커밋 푸터: `Co-Authored-By: Claude <noreply@anthropic.com>` (모델 식별자 절대 금지).
- DB 변경 시: `mcp__atockorea__apply_migration` + `supabase/migrations` 파일 + 이후 `get_advisors`.
- 각 Phase 별도 PR로 머지.

**Phase 0부터 시작.**
