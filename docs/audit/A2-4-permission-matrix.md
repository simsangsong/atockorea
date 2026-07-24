# A2-4 — 권한 경계 매트릭스 (정적 추출)

**축:** 7 안전/신뢰 · **감사일:** 2026-07-25
**판정:** 🟢 **P0 없음.** 인증되지 않은 채 뮤테이트하는 라우트는 전부 **의도된 공개면**이었다.

---

## 0. 왜 손으로 안 채웠나 (A-plan-review R11)

5역할 × 237라우트 = 1,000칸이 넘는 매트릭스를 사람이 손으로 채우면 §H-4대로 **반드시
미완으로 끝나고 미완인 채 "확인함"이 된다.** 그래서 라우트 파일에서 **가드 심볼을 정적
추출**하고, 사람은 **가드 0개 뮤테이션 라우트(P0 후보)만** 본다.

- 순수부: `lib/audit/routeGuards.ts` (`analyzeRoute` · `guardlessMutating`)
- 회귀: `__tests__/audit/routeGuards.test.ts` — **가드 없는 뮤테이션 라우트 집합 == 검토된 공개 허용목록**을
  테스트로 고정. 🔴 **새 라우트가 가드 없이 들어오면 CI가 먼저 운다** — 매트릭스가 스스로 유지된다.

## 1. 🔴 스캐너를 세 번 좁혔다 — 매번 오탐이 "가드 어휘의 구멍"이었다

| 단계 | 가드 없는 뮤테이션 | 빠졌던 가드 |
|---|---|---|
| 1차 | 31 | `getAuthUser`(주 인증 헬퍼)·`verifyQuote` |
| 2차 | 21 | webhook 서명(`svix`·telegram secret)·`verifyRoomCheckinToken` |
| 3차 | **16** | (전부 진짜 공개면) |

**이게 A4.2에서 배운 것과 같은 규율이다:** 검사기가 뱉은 위반이 오탐이면, 코드가 아니라
**검사기(가드 어휘)를 고친다.** 31건을 P0로 적었다면 전부 오탐이라 다음 사람이 이 검사를 버렸을 것이다.

## 2. 남은 16건 — 전수 개별 검증, 전부 의도된 공개면

| 라우트 | 왜 공개가 옳은가 | 남용 방어 |
|---|---|---|
| `auth/{check-email,forgot-id,merchant/login,send-verification-code,verify-code}` | 인증을 요구할 수 없는 인증 플로우 | `send-verification-code` 3/min·IP |
| `contact` | 문의 폼 | 3/min·IP |
| `analytics/events` · `logs/error` | 클라이언트 텔레메트리/에러 싱크 — 민감 뮤테이션 없음 | (남용가치 낮음) |
| `tour-product/{assistant/live,assistant/feedback,match,match-explanation}` | 구매 전 상품페이지 AI — 로그인 전 표면 | 🔴 **LLM 호출이라 전부 rate-limit**(live 10/min·sess, match 10/min·IP) |
| `tours/[id]/availability` · `itinerary/match` | 공개 재고/플래너 | — |
| `agent/v1/quote` | 서명된 견적 토큰 **발급**처 (그 토큰이 이후 크리덴셜) | — |
| `promo-codes/validate` | 코드 유효성 조회 (값 뮤테이션 없음, `.select`만) | — |

### 🔴 돈을 쓰는 공개면은 전부 rate-limit이 걸려 있었다

공개 + LLM(상품 어시스턴트) 또는 공개 + 이메일/SMS(인증코드·문의)는 **비용 DoS**가 된다.
넷 다 `requestGate`/`allowRequestDurable`로 분당 상한이 걸려 있음을 확인했다. 인증 경계뿐 아니라
**비용 경계도** 서 있다.

## 3. 가드가 있어 스캐너가 통과시킨 것 중, 어휘로 오탐이던 것들 (기록)

이들은 실제로는 **토큰/서명이 크리덴셜**이라 안전한데 1~2차에서 잠깐 빨갰다:

- `ops/checkin/{context,signal}` — `verifyRoomCheckinToken` + `requestGate`. QR 토큰이 크리덴셜이고
  판정은 rate-limited. A1.8이 클라이언트를, 여기서 서버 판정을 확인.
- `webhooks/resend` · `inbound/email` — **svix 서명 검증**, 시크릿 부재 시 fail-closed(501/401).
- `telegram/support-webhook` — `x-telegram-bot-api-secret-token` 검증, 시크릿 미설정 시 503(fail-closed).
- `agent/v1/book` — `verifyQuote(quote_token)`. `cart`·`wishlist`·`user-settings`·`upload` — `getAuthUser`(401).

## 4. 미검 / 넘긴 것

- **가드가 **있다**고 통과한 라우트의 가드가 **올바른 역할**을 강제하는지**는 이 스캔의 범위 밖이다
  (예: guide 전용 라우트에 customer 토큰이 통과하는지). 이건 A2.1/A2.2 컴포넌트 감사 + 라우트별
  역할 테스트의 몫이다. 이 티켓은 **"가드가 있는가"**까지만 단언한다.
- 정적 추출이라 **가드를 import했지만 실제로 호출하지 않는** 라우트는 통과시킨다(오탐 반대 방향).
  237개 표본에서 그런 사례는 검토 중 보이지 않았으나, 역할 강제 테스트(A2.4 후속)가 잡을 층이다.

## 5. 결론

**인증 경계에 P0 없음.** 공개면은 전부 의도적이고, 비용 드는 공개면은 rate-limit이 걸려 있다.
이 결과는 스캐너가 스스로(테스트로) 유지되므로, 다음에 누가 가드 없는 뮤테이션 라우트를 추가하면
**리뷰 전에 CI가 막는다.** — A2.4의 산출은 "지금 깨끗하다"가 아니라 **"앞으로도 새는 걸 막는 장치"**다.
