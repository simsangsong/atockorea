# A4 — 코드 건강도 (진행 중)

**축:** 3 코드 · **감사일:** 2026-07-25
**상태:** A4.1 · A4.2 · A4.6 완료 · A4.3/A4.4/A4.5 미착수

> §J의 "A0.1을 기다리지 않아도 되는 것"에 A4 전부가 들어 있다. 시뮬 환경과 무관하다.

---

## A4.1 — 중복 진실 사냥 ✅

### 발견: 로케일 목록이 프로덕션 7곳에 복제돼 있었다

정본은 `lib/tour-room/snapshot.ts`의 `ROOM_LOCALES` 하나다. 그런데 같은 5개 로케일이
**프로덕션 파일 7곳**에 다시 적혀 있었다:

| 파일 | 형태 | 판정 |
|---|---|---|
| `app/api/tour-rooms/broadcast/route.ts` | `DEFAULT_TARGET_LOCALES` | 🔴 **`ROOM_LOCALES`를 이미 import해 놓고 바로 아래에 사본을 정의**하고 있었다 |
| `app/api/tour-rooms/[bookingId]/messages/route.ts` | `DEFAULT_TARGET_LOCALES` | 🔴 복제 |
| `app/api/tour-rooms/[bookingId]/messages/[messageId]/retranslate/route.ts` | `DEFAULT_TARGET_LOCALES` | 🔴 복제 |
| `app/api/tour-rooms/[bookingId]/spot-events/route.ts` | `DEFAULT_TARGET_LOCALES` | 🔴 복제 |
| `components/tour-mode/plan/PlanEditorClient.tsx` | `ROOM_LOCALE_VALUES` | 🔴 복제 |
| `components/tour-mode/TourRoomClient.tsx` | `ROOM_LOCALE_VALUES` | 🔴 **순서가 달랐다** (`['en','ko','ja','es','zh']`) |
| `components/tour-mode/entryCopy.ts` | 인라인 리터럴 | 🔴 **순서가 달랐다** |

**순서가 다르다는 것은 이미 어긋났다는 뜻이다.** 두 사본이 같은 값을 담고 있다고 믿을
근거가 그 시점에 사라진다.

**왜 위험한가:** 6번째 로케일이 추가되는 날, 이 네 라우트는 조용히 5개 로케일로만
번역을 계속한다. tsc도 jest도 빌드도 아무 말 하지 않는다 — 손님이 자기 언어로 된
공지를 못 받는 것으로만 드러난다.

**조치:** 7곳 전부 `ROOM_LOCALES`에서 파생하도록 고쳤다.
`OpsRoomCardSetPanel`은 운영자 기본이 한국어라 `ko`를 앞으로 돌리되 **목록 자체는 정본**을 쓴다.

### 🔴 예외 1건 — 이유와 함께 허용

`app/api/admin/tour-content/generate/route.ts`의 `AUDIO_LOCALES`는 **투어 콘텐츠 오디오
생성** 집합이지 룸 로케일이 아니다. 지금 구성원이 같은 것은 우연이고, 룸에 6번째
로케일이 생겨도 오디오가 따라가야 할 이유는 없다 — **묶는 것이 오히려 결합 오류다.**

허용 목록에 이유를 적어 둔 이유: 이유 없는 예외는 다음 사람이 "여기 넣으면 통과하네"로
읽고, 그 순간 이 검사가 죽는다.

### 확인했고 문제없음 (드리프트 아님)

1. **초과요금 단가** — `lib/tour-room/overtime.ts`가 유일한 정의처다. 제주 ₩30,000 ·
   부산 ₩40,000이 다른 어디에도 없다. 그 파일이 스스로 적어 둔 약속
   ("no rate is hardcoded elsewhere … plan §12 Q3")이 실제로 지켜지고 있었다.
2. **크로스아일랜드 ₩70,000** — `lib/quote-engine/pricing-policy.ts` 한 곳.
3. **정원 해석 순서(B2.1b)** — `productCapacity`/`effectiveCapacity`가 `capacity.ts` 하나에만 있다.
   B2-D3가 "우선순위를 안 적으면 드리프트가 확정된다"고 못 박은 지점이 실제로 지켜졌다.
4. **룸 누락 판정(B1-D2)** — `roomGapFor`가 `unified.ts` 하나에만 있다.
5. **CSV 인코더** — `aoaToCsv`가 `lib/ops/tax/forms.ts` 하나. B1.6이 재사용했고 두 번째를 만들지 않았다.
6. **LLM 예산·출력 상한(§L)** — `lib/ai/usage.ts` 하나.

### 재발 방지

`__tests__/audit/singleSourceOfTruth.test.ts` — 위 6개 계약을 **저장소 전수 스캔으로**
고정했다. 주석은 지켜지지 않아도 아무 일이 없지만 테스트는 운다.

---

## A4.2 — client/server 경계 ✅

### 왜 이게 A4의 첫 티켓인가

§H-1이 이 저장소의 가장 위험한 함정으로 지목한 부류다: **tsc·jest가 전부 green인데
`next build --webpack`만 깨진다.** client 페이지가 `node:*`·`sharp` 같은 서버 전용
모듈을 (직접이든 전이든) import하면 프로덕션 빌드만 실패하고, 실제로 main을
배포 불가 상태로 만든 적이 있다(§13 `720b466c`).

빌드가 결국 잡아주긴 한다. 문제는 **늦다**는 것이다 — 전 파일 컴파일이 끝나야
알려주고, 그때는 이미 커밋이 쌓여 있다. import 그래프만 훑으면 초 단위로 같은 답이 나온다.

### 구현

| 항목 | 내용 |
|---|---|
| 순수부 | `lib/audit/clientBoundary.ts` — `isClientModule` · `staticImports` · `findBoundaryViolations` |
| 실행 | `__tests__/audit/clientBoundary.test.ts` — **저장소 전체를 실제로 훑는다.** 테스트라서 매 커밋에 돈다 |
| 범위 | `app/` `components/` `lib/` `hooks/` — 1,000+ 모듈 |
| 판정 패턴 | `node:*` · `fs`/`path`/`crypto` · `sharp` · `*.server` 접미사(이 저장소 규약) |

### 🔴 첫 실행에서 위반 9건 — **전부 오탐이었다**

첫 실행이 9건을 뱉었다. 전부 같은 사슬로 수렴했다:

```
components/tour-ops/OpsApp.tsx
  → components/tour-ops/OpsRoomDrawer.tsx
  → lib/tour-room/quickReplies.ts
  → lib/tour-room/snapshot.ts
  → lib/tour-room/access.ts   ← node:crypto
```

그런데 **빌드는 통과한다.** 이유는 마지막 두 단계가 `import type`이기 때문이다:

```ts
// lib/tour-room/snapshot.ts:11
import type { RoomBooking, RoomDbClient, TourRoom } from '@/lib/tour-room/access';
```

타입은 컴파일 시점에 지워지므로 번들에 아무것도 남지 않는다. **틀린 것은 코드가 아니라
검사기였다.**

**이걸 기록하는 이유:** 오탐이 섞인 검사는 며칠 만에 무시당하고, 무시당하는 검사는
없는 것보다 나쁘다(있다고 믿게 만드니까). 검사기를 고쳐 `import type`/`export type`을
제외했고, 그 사실을 테스트로 고정했다.

**동적 import도 제외한다.** 이 저장소는 서버 전용 모듈을 `await import()`로 격리하는
패턴을 **의도적으로** 쓴다(`defaultCacheDb` · `usage.server` · `prewarm.server`).
번들에 안 들어가므로 위반이 아니고, 잡으면 올바른 패턴을 쓰는 코드가 전부 빨개진다.

### 결과

**현재 위반 0.** 합성 케이스로 탐지가 실제 동작함을 별도 검증했다 —
직접 위반 · 전이 위반 · `.server` 접미사 · server 컴포넌트 제외 · 순환 import 종료.

### 확인했고 문제없음

1. `'use client'` 파일 **290개** 전부가 서버 전용 모듈을 정적으로 끌어오지 않는다.
2. `.server.ts` 모듈 11개는 전부 서버 경로에서만, 또는 동적 import로만 소비된다.
3. 스캐너가 **실제로 저장소를 읽고 있다**는 것 자체를 테스트로 고정했다(모듈 500개 이상).
   경로 오타로 "0건 통과"가 나오는 것이 이런 검사의 가장 흔한 거짓 안심이다.

### 알려진 한계 (숨기지 않는다)

- `import { type A, type B } from 'x'`처럼 **지정자가 전부 타입인 인라인 형태**는
  값 import로 오판한다. 저장소에 그 형태가 없어 지금은 무해하다. 오탐이 나오면
  지정자 단위 파싱으로 올린다.
- 외부 패키지(node_modules) 내부는 따라가지 않는다. 느리고, 우리가 고칠 수도 없다.
- `next/dynamic`으로 감싼 client 컴포넌트는 정적 import로 보인다 — 보수적인 쪽이라 둔다.

---

## A4.6 — 사전존재 결함 청산 ✅

### 🔴 **실패 5스위트는 하나도 제품 결함이 아니었다**

이 5개는 세션 인수인계 문서마다 "사전존재 실패(무시)"로 적혀 왔다. 실제로 파 보니
**전부 테스트 인프라 문제거나 낡은 테스트**였고, 제품 버그는 하나도 없었다.

| 스위트 | 진짜 원인 | 조치 |
|---|---|---|
| `__tests__/utils/test-utils.tsx` | **테스트가 아니라 헬퍼 파일**인데 `__tests__/` 안에 있어서 jest가 스위트로 집었다 → "must contain at least one test" | `test-utils/render.tsx`로 이동. `lib/ops/report/test-support/supabase-mock.ts`가 **같은 이유로 이미 밖에 있었다** — 전례가 있는데 반복됐다 |
| `__tests__/lib/logger.test.ts` | 🔴 **실제 취약점.** `isDevelopment`가 클래스 필드라 **모듈 로드 시점에 한 번** 스냅샷됐다. 테스트가 `beforeEach`에서 NODE_ENV를 바꿔도 이미 늦었고, debug/info가 영원히 죽어 있었다 | getter로 바꿔 호출 시점에 읽는다. 숨은 import-순서 결합이 사라진다 |
| `__tests__/lib/error-handler.test.ts` | 테스트가 개발 모드를 **가정만 하고 설정하지 않았다**. 원문 메시지 노출은 개발 모드 전용(운영에선 가려짐 — 그건 옳다) | 그 케이스에서만 NODE_ENV를 명시하고 `finally`로 복원 |
| `__tests__/api/tours.test.ts` | jsdom에 정적 `Response.json`이 없어 `NextResponse.json`이 터진다 | `@jest-environment node` + `restoreWebPrimitives` — **다른 라우트 스위트들이 이미 쓰는 조합** |
| `__tests__/integration/assistant-streaming.test.ts` | 두 가지가 겹쳤다: ①질문("weather in Jeju")이 **나중에 생긴 결정적 날씨 즉답**에 먹혀 모델이 아예 호출되지 않았다 ②목업 모델 답이 41자라, 추천 의도에서 "모델이 쓸 만한 걸 못 냈다"로 판정돼 카탈로그 top-3으로 갈아끼워졌다 | 게이트에 안 걸리는 자유서술 질문 + **현실적인 길이(180자 이상)의 목업 답**. 프롬프트만 바꾸면 게이트가 하나 늘 때마다 또 깨진다 |

### 왜 이게 중요한가

**무시가 기본값이 되면 진짜 회귀가 섞여도 안 보인다.** 이번 세션에서 실제로 그 일이
일어났다 — §L L0이 만든 회귀(`captions` 라우트의 인자 변경)가 `__tests__/`에 있었는데,
표준 머지 게이트의 스위트 목록에 `__tests__/`가 빠져 있어 **B3 단계에서야** 잡혔다.
빨간 게 상시로 있으면 새로 빨개진 것을 구분할 수 없다.

### 결과

**전체 스위트 381개 전부 green (실패 0).** 이 저장소에서 처음이다.

### 잔여

- `TourRoomClient.tsx` L285 react-hooks/refs lint 에러는 여전히 있다(main에도 있던 것).
  lint는 별도 게이트라 이번 범위 밖으로 둔다 — A4.5(타입 거짓말)와 함께 볼 것.

---

## 미착수

| 티켓 | 내용 | 비고 |
|---|---|---|
| A4.3 | 죽은 코드·미사용 export | |
| A4.4 | 테스트 공백 지도 | 특히 라우트 레벨 |
| A4.5 | 타입 거짓말 (`as` 남용) | 특히 supabase row → 도메인 타입 |
| A4.6 | 사전존재 결함 청산 | `TourRoomClient.tsx` react-hooks lint · 사전존재 실패 5스위트 |
