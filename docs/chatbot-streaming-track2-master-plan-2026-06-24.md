# Track 2 — 챗봇 응답 스트리밍 (SSE) 마스터 플랜

작성 2026-06-24 · 기준 커밋 origin/main `9894edf2` (Track 3 머지 직후) · 상태 **착수 대기 (집중 세션)**

상위 로드맵: `docs/chatbot-agent-roadmap-master-plan-2026-06-23.md` · 메모리 `project_chatbot_agent_roadmap`(트랙 2 / 결정 H8).

---

## 0. 한 줄 요약

메인 챗 라우트의 **모델 자유답변만** SSE로 토큰 스트리밍한다. 결정론 게이트(견적·예약조회·핸드오프·정책·unconfigured)는 **지금처럼 한 방 JSON**으로 유지하고, 후처리(에스컬레이션·티켓·핸드오프 프롬프트·세션기억)는 **스트림 종료 후 전체 버퍼로 1회** 실행한다. 클라이언트는 응답 `Content-Type`으로 스트림/JSON을 구분한다.

비목표: WebSocket, 양방향, 결정론 게이트 스트리밍, 위젯 UI 리디자인.

---

## 1. 코드 실사 스냅샷 (검증 완료 2026-06-24)

| 자산 | 위치 | 사실 |
|---|---|---|
| 메인 라우트 | `app/api/tour-product/assistant/route.ts` (`runtime="nodejs"`) | POST 1개. 다수 결정론 게이트가 **early-return JSON** (handoff ~385, booking ~454, quote ~562, legal/privacy ~573, unconfigured ~600). 모델 호출 `chat.sendMessage(last.content)` (~843). 그 뒤 후처리: 카탈로그 폴백(~859), misrouted override(~888), 핸드오프 프롬프트(~903), 로깅·에스컬레이션·티켓·텔레그램(~908, `CHAT_AUDIT_LOG`/`TOUR_MATCH_AUDIT_LOG` 게이트), 세션기억 갱신(~995, Track 3.2). 최종 `NextResponse.json({reply, ticket_id, escalated, escalation_reason, handoff_offered, checkout_url?, debug_intent?})` (~1008). |
| SSE 레퍼런스 | `app/api/tour-rooms/[bookingId]/events/route.ts` | `ReadableStream{ start(controller) }` + `controller.enqueue(encoder.encode("event: X\ndata: ${JSON}\n\n"))` + `: heartbeat\n\n` + `while(!req.signal.aborted)` + 헤더 `text/event-stream; charset=utf-8`, `Cache-Control: no-cache, no-transform`, `Connection: keep-alive`. **이 골격을 그대로 미러링.** |
| Gemini SDK | `@google/generative-ai@0.24.1` | `ChatSession.sendMessageStream(req)` 존재 → `{ stream, response }` 반환. `stream`=청크 async-iterable(각 `chunk.text()`), `response`=await 시 최종 집계. |
| 위젯 소비 | `components/product-tour-static/_shared/TourProductAiAssistantWidget.tsx` `runAssistant` (~294) | 현재 `fetch(... )` → `await res.json()` → `setMessages([...next, {role:'assistant', content:data.reply, origin:'ai'}])` + `data.handoff_offered`/`ticket_id`/`checkout_url` 처리. **여기에 스트리밍 분기 추가.** |
| 응답 타입 | 같은 파일 `AssistantResponse` | `{reply, error?, message?, ticket_id, escalated, escalation_reason, handoff_offered, checkout_url?}`. 스트리밍 done 이벤트가 동일 필드를 실어야 함. |

⚠ **다른 소비자 확인 (착수 첫 작업)**: `/api/tour-product/assistant`를 호출하는 위젯이 위 하나뿐인지 grep으로 확인. 사이트 전역 어시스턴트가 같은 위젯을 재사용하는지/별도 컴포넌트인지 검증 후 스코프 확정. 별도 컴포넌트면 동일 분기를 양쪽에.

---

## 2. 설계 결정 (binding)

- **D-T2-1 단일 엔드포인트 + 콘텐츠 협상.** 새 라우트를 만들지 않는다(게이트 1000줄 복제 금지). 클라가 body에 `stream:true`를 보내고, 서버는 **모든 게이트가 통과해 모델 자유답변에 도달했을 때만** SSE Response를 반환. 게이트 early-return은 그대로 `application/json`. 클라는 `res.headers.get('content-type')`로 분기 → `text/event-stream`이면 스트림 소비, 아니면 기존 `res.json()` 경로(=폴백).
- **D-T2-2 결정론은 절대 스트리밍 안 함 (H8).** 견적·예약조회·핸드오프·정책 폴백·unconfigured·legal/privacy는 토큰을 못 되돌리므로 버퍼드 JSON 유지.
- **D-T2-3 후처리는 스트림 종료 후 1회.** 모델 토큰을 다 모은 **full buffer**로 카탈로그 폴백/misrouted override/핸드오프/로깅/에스컬레이션/세션기억 실행. 스트리밍 중 사이드이펙트 금지.
- **D-T2-4 `done` 이벤트의 `reply`가 권위 텍스트.** 후처리가 답을 통째로 교체할 수 있다(misrouted→policyFallback, low_confidence→handoff). 그래서 `done`에 **최종 reply 전체**를 싣고, 클라는 done 수신 시 메시지 본문을 `reply`로 **확정 교체**한다. 평상시엔 스트림 버퍼와 동일(무변화), 드물게 override 시 스냅 교정.
- **D-T2-5 킬스위치 `CHAT_STREAMING`.** 서버는 `process.env.CHAT_STREAMING !== "0"` 일 때만 스트리밍. `=0`이면 `stream:true`여도 기존 JSON 반환 → **롤백은 env 한 줄, 코드 재배포 불필요**(클라가 자동 폴백). **초기 출시는 default-off(`CHAT_STREAMING=0`)로 다크 머지 → 프로덕션 QA 후 켠다.**
- **D-T2-6 프록시 버퍼링 방지.** SSE 응답에 `X-Accel-Buffering: no` 추가(Vercel/Nginx 버퍼링 차단), `Cache-Control: no-cache, no-transform`.

---

## 3. 이벤트 프로토콜

```
event: delta
data: {"text":"안녕하세요, 제주"}

event: delta
data: {"text":" 프라이빗 투어는"}

: heartbeat            ← 청크 간 공백이 길 때만(선택)

event: done
data: {"reply":"<최종 권위 텍스트 전체>","ticket_id":null,"escalated":false,"escalation_reason":null,"handoff_offered":false,"checkout_url":null}

event: error
data: {"error":"assistant_failed"}   ← 모델 실패 시. 클라는 폴백 메시지 표시
```

규칙: `done` 또는 `error` 중 **정확히 하나**로 종료, 그 후 `controller.close()`. 클라는 `done.reply`로 본문 확정.

---

## 4. 파일별 변경

### 4.1 `lib/chatbot/sseStream.ts` (신규, 순수 유틸 → 단위 테스트 대상)
- `sseEvent(name: string, data: unknown): Uint8Array` — `encoder.encode("event: "+name+"\ndata: "+JSON.stringify(data)+"\n\n")`.
- `sseComment(text): Uint8Array` — `: ${text}\n\n`.
- `SSE_HEADERS` 상수 (위 D-T2-6 헤더).
- (선택) `shouldStreamIntent(intent)` — 모든 자유답변 인텐트는 스트리밍 가능하므로 사실상 항상 true지만, 향후 특정 인텐트 제외용 훅으로 둠.

### 4.2 `app/api/tour-product/assistant/route.ts`
1. 요청 스키마에 `stream: z.boolean().optional()` 추가.
2. 게이트는 전부 그대로(JSON early-return 유지).
3. 모델 호출부(~830~1008)를 **분기**:
   - `const wantStream = parsed.data.stream === true && process.env.CHAT_STREAMING !== "0" && !debugNoSideEffects;`
   - `wantStream === false` → **현행 경로 그대로**(`sendMessage` + 후처리 + `NextResponse.json`). 변경 0. (회귀 안전망)
   - `wantStream === true` → `ReadableStream` 반환:
     ```
     start(controller):
       try:
         chat = model.startChat({history, generationConfig})
         const {stream} = await chat.sendMessageStream(last.content)
         let buf = ""
         for await (chunk of stream):
           if (req.signal.aborted) break
           const t = chunk.text(); if (t) { buf += t; enqueue(sseEvent("delta",{text:t})) }
         // ── 스트림 종료: full buffer로 후처리 (현행 로직 추출본 재사용) ──
         let replyText = buf.trim()
         [카탈로그 폴백 / misrouted override / 핸드오프 / 로깅·에스컬레이션·티켓 / 세션기억]  ← 현행과 동일 함수 호출
         enqueue(sseEvent("done",{reply:replyText, ticket_id, escalated, escalation_reason, handoff_offered, checkout_url}))
       catch e:
         enqueue(sseEvent("error",{error:"assistant_failed"}))
       finally:
         controller.close()
     ```
   - **후처리 코드 중복 제거**: 현행 후처리 블록(라인 ~845~1003)을 `finalizeAssistantTurn({sb, ctx, replyText, ...}): Promise<{reply, ticket_id, escalated, escalation_reason, handoff_offered}>` 같은 **공용 함수로 추출**해 버퍼드 경로와 스트리밍 경로가 **같은 함수**를 호출하게 한다. 이게 이 트랙의 핵심 리팩터(분기마다 후처리가 갈라지면 버그 온상).
4. 세션쿠키: 스트리밍 Response에도 `applySessionCookie` 동등 처리(Set-Cookie 헤더를 `new Response(stream, {headers})`에 직접 부여).

### 4.3 위젯 `runAssistant` (TourProductAiAssistantWidget.tsx)
- body에 `stream: true` 추가.
- `const ct = res.headers.get("content-type") || "";`
  - `ct.includes("text/event-stream")` → 스트림 소비:
    - 자리표시 assistant 메시지 1개 추가(빈 content), `res.body.getReader()` + `TextDecoder`로 라인 파싱(`event:`/`data:`), `delta`마다 마지막 메시지 content에 append(setMessages로 갱신), `done`이면 content를 `reply`로 확정 + `handoff_offered`/`ticket_id`/`checkout_url` 처리, `error`면 폴백 메시지.
  - 아니면 → **기존 `res.json()` 경로 그대로**(결정론 응답·폴백·구버전 서버 호환).
- 작은 SSE 파서는 컴포넌트 내 헬퍼 or `lib/chatbot/clientSse.ts`(브라우저용)로 분리. 청크 경계가 이벤트 중간을 자를 수 있으니 **버퍼에 누적 후 `\n\n` 단위로 분리** 필수.
- 로딩 인디케이터: 첫 `delta` 도착 시 타이핑 표시로 전환.
- ⚠ 사이트 전역 어시스턴트가 별도 컴포넌트면 동일 분기 적용.

---

## 5. 단계 (순서대로, 각 단계 후 tsc+test)

- **S0 스코프 확정** — `/api/tour-product/assistant` 소비자 전수 grep, 사이트 전역 위젯 동일/별도 판정. 워크트리 격리(origin/main 기준, junction 주의 → [[feedback_worktree_isolation]]).
- **S1 후처리 추출 (리팩터, 무동작변경)** — 현행 후처리 블록을 `finalizeAssistantTurn(...)`로 추출, **버퍼드 경로가 이 함수를 쓰도록 교체**. 기존 E2E/유닛 그대로 그린이어야 함(순수 리팩터, 출력 동일). ← **가장 중요·위험한 단계, 독립 커밋.**
- **S2 SSE 유틸 + 스트리밍 분기** — `sseStream.ts` + 라우트에 `wantStream` 분기 추가(`finalizeAssistantTurn` 재사용). `CHAT_STREAMING` 기본 off라 프로덕션 무영향. 세션쿠키 처리.
- **S3 클라이언트 소비** — 위젯 `runAssistant` 스트림 분기 + SSE 파서. content-type 분기로 결정론·폴백 무영향.
- **S4 QA(로컬, `CHAT_STREAMING=1`)** — 타이핑 효과, 중단(탭 닫기/abort), 모델 에러 중간 발생, 결정론 게이트(견적·예약·핸드오프) 여전히 즉답 JSON, 세션기억 갱신 정상, checkout_url 버튼 정상.
- **S5 다크 머지** — `CHAT_STREAMING` 미설정(=off)으로 main 머지. 프로덕션 영향 0.
- **S6 프로덕션 점등** — Vercel env `CHAT_STREAMING=1` + 재배포(⚠ env는 재배포해야 적용 — Track 0 교훈). 실서버에서 S4 재검. 문제 시 `=0`로 즉시 롤백.

---

## 6. 테스트 / 수용 기준

- **단위**: `sseStream.test.ts` — `sseEvent` 포맷(`event: x\ndata: {...}\n\n`), 클라 SSE 파서(청크가 이벤트 경계 가로지를 때 정확히 분리, 부분 라인 버퍼링).
- **회귀(필수)**: S1 후 기존 챗봇 유닛 + 예약/견적 E2E 전부 그린(출력 바이트 동일). 후처리 추출이 동작을 바꾸지 않았음을 증명.
- **통합(가능 범위)**: 라우트 핸들러를 Gemini stream 모킹으로 호출 → 응답 `Content-Type: text/event-stream`, `delta` ≥1 + `done` 정확히 1개 + `done.reply`가 버퍼와 일치. 게이트 입력(견적 메시지)은 여전히 `application/json`.
- **수동 QA**: S4 체크리스트.
- **수용**: 위 전부 통과 + `npm run build` 그린 + 결정론/폴백/구버전호환 무회귀 + 롤백(env=0)이 코드 재배포 없이 동작.

---

## 7. 리스크

| ID | 리스크 | 완화 |
|---|---|---|
| R1 | 후처리 추출(S1)이 미묘하게 동작 변경 | 무동작 리팩터로 분리 커밋 + 회귀 스위트 바이트 동일 검증 |
| R2 | done 전에 후처리가 reply 교체 → 클라 깜빡임 | D-T2-4: done.reply 권위 교체. override는 드물고 교정은 의도된 동작 |
| R3 | 프록시/Vercel 버퍼링으로 스트림 안 흐름 | `X-Accel-Buffering: no` + `no-transform`, Node runtime, 로컬·프로덕션 양쪽 S4 |
| R4 | 서버리스 함수 타임아웃/중단 | 짧은 챗 응답이라 영향 낮음. abort 시 finally close, 사이드이펙트 try/catch |
| R5 | SSE 파서가 청크 경계 오분리 | 버퍼 누적 후 `\n\n` 분리 단위 테스트 |
| R6 | 세션기억/로깅이 스트림 경로에서 누락 | finalizeAssistantTurn 공용화로 양 경로 동일 보장 |
| R7 | 다른 소비자(사이트 위젯) 미반영 | S0에서 전수 확인 후 양쪽 분기 |

## 8. 롤백

`CHAT_STREAMING=0`(또는 변수 삭제) + 재배포 → 서버가 `stream:true`를 무시하고 JSON 반환, 클라가 content-type 분기로 자동 폴백. 코드 변경 불필요.

## 9. 진행 로그 (착수 시 갱신)

- 2026-06-24 플랜 작성(이 문서). 코드 실사 완료, 자산 검증(sendMessageStream@0.24.1, SSE 레퍼런스, 위젯 소비). 착수 대기.
- 2026-06-24 **구현 완료 (S0–S5, 집중 세션)**. 기준 origin/main `1ee54b6`(9894edf2 이후, Track 3 머지 직후). 브랜치 `claude/chatbot-sse-streaming-track2-q4zcdh`.
  - **S0 스코프 확정**: `/api/tour-product/assistant` POST 런타임 소비자는 위젯 `TourProductAiAssistantWidget.tsx` 하나뿐. 홈 섹션(ai-agent-band/final-cta/choose-travel-style)은 모두 `atc:open-assistant` CustomEvent로 같은 위젯을 열 뿐 직접 호출 안 함. `live`/`feedback`는 별개 엔드포인트, 압박테스트 스크립트는 stream 미지정→JSON. → 단일 분기로 충분(R7 해소). 워크트리: ephemeral 컨테이너 자체가 격리이고 보호할 병행 main 체크아웃이 없어 junction footgun 회피 위해 지정 브랜치 클린 체크아웃에서 직접 작업.
  - **S1 후처리 추출 (무동작, 독립 커밋 `7908181`)**: 모델호출 이후 블록(카탈로그폴백·misrouted override·핸드오프·로깅/에스컬레이션/티켓·세션기억)을 `finalizeAssistantTurn(...)`로 추출, 버퍼드 경로가 호출하도록 교체. 앱코드 tsc 클린 + chatbot/support/quote jest 129/129 그린(바이트 동일). R1 해소.
  - **S2 SSE 유틸 + 라우트 분기 (커밋 `3e50e08`, default-off 보정 후속 커밋)**: `lib/chatbot/sseStream.ts`(sseEvent/sseComment/SSE_HEADERS, X-Accel-Buffering:no+no-transform). 라우트에 `stream` 스키마 필드 + `wantStream = stream===true && CHAT_STREAMING==="1" && !debug` 분기. **킬스위치 기본 OFF(`=== "1"`)** — 사용자 결정으로 D-T2-5의 "초기 출시 default-off 다크 머지" 의도를 채택(공식 산문 `!== "0"`은 폐기). env 미설정=다크. 스트리밍 시 delta enqueue→full buffer로 `finalizeAssistantTurn` 재사용→done 1개(또는 error). abort 시 사이드이펙트 스킵. 세션쿠키 Set-Cookie 직렬화. 게이트/버퍼드 경로 무변경.
  - **S3 위젯 클라이언트 (커밋 `a3a8c49`)**: `lib/chatbot/clientSse.ts`(`parseSseBuffer` — 청크 경계 누적 분리). runAssistant `stream:true` + content-type 분기. delta 단일 버블 누적, 첫 토큰 시 타이핑 표시 해제, done.reply 확정 교체(handoff/ticket/checkout 적용), error 폴백. 비-SSE 응답은 기존 res.json() 경로(롤백 무변경). 핸드오프 fetch는 게이트 경로라 그대로.
  - **S4 검증**: 단위 sseStream(5)+clientSse 경계(7, 바이트단위·불규칙청크). 통합 `__tests__/integration/assistant-streaming.test.ts`(Gemini stream 모킹→text/event-stream+X-Accel-Buffering:no, delta≥1+done 1+done.reply=버퍼; privacy 게이트는 stream:true여도 application/json). 전체 jest 363 pass(기존 무관 실패 5 suite 동일). `npm run build` 그린(exit 0).
  - **S5 다크 머지**: 킬스위치 기본 OFF(`=== "1"`)라 `CHAT_STREAMING` 미설정으로 main 머지 시 프로덕션 **완전 다크**(클라가 stream:true를 보내도 서버는 버퍼드 JSON, 클라는 content-type으로 자동 폴백). 통합 테스트 "ships dark"가 이 동작을 고정.
  - **S6 프로덕션 점등(후속, 코드 외)**: Vercel env `CHAT_STREAMING=1` + 재배포(env는 재배포해야 적용). 실서버에서 S4 재검(타이핑/abort/모델에러/게이트 즉답/세션기억/checkout 버튼). 문제 시 변수 삭제 또는 `=0` + 재배포로 즉시 롤백(코드 재배포 불필요).
  - **미해결/후속**: 메모리 `project_chatbot_agent_roadmap` 트랙2 갱신은 이 세션에 메모리 쓰기 도구가 없어 미반영 — 사용자/후속 세션에서 반영 필요.
