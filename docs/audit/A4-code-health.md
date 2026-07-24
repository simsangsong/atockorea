# A4 — 코드 건강도 (진행 중)

**축:** 3 코드 · **감사일:** 2026-07-25
**상태:** A4.1~A4.6 **전부 완료**

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

## A4.3 — 죽은 코드·미사용 export ✅

### 🔴 결론이 곧 성과다 — 이 저장소엔 해로운 죽은 코드가 거의 없다

죽은 코드는 삭제 목록이 길수록 성과처럼 보이지만, **오탐이 섞인 삭제는 의도된 API를
지운다.** A4.2가 배운 것과 같다 — 늑대를 외치는 검사는 무시당한다. 그래서 스캔을 두 번 좁혔다:

| 단계 | 대상 | 결과 |
|---|---|---|
| 1차 | 모든 export(타입 포함) 미참조 | 432건 |
| 2차 | **값 export만**(fn/const/class) | 104건 |
| 3차 | 값 export 중 **선언 외 참조 0** | **18건** |

**타입 export를 뺀 이유:** 미사용 타입은 런타임 비용이 0이고 대개 의도된 공개면이다.
432건의 대부분이 그거였다 — 넣으면 리포트를 아무도 안 본다.

**18건도 자동 삭제 대상이 아니다.** 스캔은 "참조되지 않음"만 알지 "실수인가 의도인가"를
모른다. 실제로 파 보니 셋으로 갈렸다:

1. **의도된 잠재 API** — `lib/ops/sim/simScope.ts`의 `excludeSim`은 A0.1이 만든 시뮬 배제
   툴킷의 일부다. A0.1 문서가 *"29개 `from('bookings')` 사이트 전부에 적용하지 않았다"*고
   명시했으니, `excludeSim`은 앞으로 쓸 자리를 위해 **일부러 제공된** 헬퍼다. 지우면 안 된다.
2. **문서용 상수** — `lib/ops/tax/withholding.ts`의 `WITHHOLDING_INCOME_TAX_RATE = 0.03` 등.
   🔴 처음엔 "상수는 죽어 있고 계산부는 `(gross*3)/100` 매직넘버를 쓴다 → A4.1 드리프트 함정"으로
   봤으나, **파일 헤더가 정확히 그 반대를 못박고 있었다**: *"부동소수 오차가 원단위 절사를 1원
   어긋내지 않도록 정수 연산(×3/100, ÷10)을 쓴다 · 리팩터 금지."* 즉 매직넘버가 **옳은 구현**이고
   `0.03` 상수는 참조용 문서다. 세무 로직이라 §J(사인오프)이기도 하니 **손대지 않는다.**
   (계산은 `lib/ops/tax/__tests__/withholding.test.ts` 28케이스로 이미 보호된다 — §A4.4 참조.)
3. **테스트 훅** — `tts.ts`의 `__resetAudioPrimingForTests`·`isAudioPrimed`. 쓰는 테스트가 없어
   죽어 있지만 삭제 이득이 미미하고, 향후 테스트가 부를 자리다. 남긴다.

### 실제로 지운 것: 죽은 i18n 키 2건

A1.7이 넘긴 `settingsPage.saveNotifications`·`alertNotificationsSaved`. 설정 화면은
`useTranslations()`(무스코프)라 전체 경로로 참조하는데, 두 키의 전체 경로도 leaf도
**어디에도 없다.** 10개 번들 전부에서 제거(각 -2줄, JSON 유효성 검증). `localeFit` 회귀 통과.

### 재사용 가능한 스캐너

`scripts/audit-dead-exports.mjs` — 위 3단 로직을 커밋했다. `node scripts/audit-dead-exports.mjs`.
**테스트로 고정하지 않은 이유:** 잠재 API·테스트 훅이 섞여 매 커밋 빨개지면 그게 늑대다.
스캐너는 사람이 주기적으로 돌려 판단하는 도구지, 게이트가 아니다.

---

## A4.4 — 테스트 공백 지도 ✅

### 🔴 자기교정 1건 — 세무 계산은 사실 보호되고 있다

처음에 `withholding.ts` 헤더가 가리키는 `__tests__/withholding.test.ts`가 없다고 판단하고
"리팩터 금지인데 가드가 없다"는 P1을 적으려 했다. **틀렸다** — 테스트는
`lib/ops/tax/__tests__/withholding.test.ts`에 **병치(co-located)**돼 있고 28케이스가 돈다.
최상위 `__tests__/`만 검색해서 놓쳤다. 헤더의 경로 표기가 부정확할 뿐, 계산은 보호된다.
(교훈: 이 저장소는 `lib/**/__tests__/`에도 테스트를 둔다 — 검색 시 포함할 것.)

### 라우트 레벨 공백 (플랜이 지목한 표적)

전체 243개 라우트 중 테스트가 라우트 모듈을 import하지 않는 것 153개. 그중 **감사 소관
(tour-room/ops) 16개**:

| 라우트 | 성격 | 우선순위 |
|---|---|---|
| `/api/ops/checkin/context` · `/checkin/signal` | B5 자동 체크인 판정·미등록 시그널 — **분기 많음** | 🔴 높음 |
| `/api/tour-rooms/[id]/manual-arrival` | §O-8 도착 카드 발사 | 🟠 중 |
| `/api/tour-mode/driver/link` · `/driver/overview` | 기사 링크 발급·PII 최소 뷰 | 🟠 중 |
| `/api/tour-rooms/[id]/plan/templates` | 코스 템플릿 서빙 | 🟡 낮음 |
| `/api/tour-rooms/[id]/{typing,read,reactions,push-subscribe}` | 얇은 통과 — 로직은 이미 테스트된 lib에 있음 | 🟢 낮음 |

**우선순위 판정 기준:** 라우트 자체에 분기가 있으면 높음, lib 위임 통과면 낮음.
`checkin/context`는 8개 상태(ready/already/no_seats/not_open/no_token/wrong_room/unregistered/error)를
분기하는데 라우트 테스트가 없다 — A1.8이 클라이언트(`CheckinLanding`)는 봤지만 서버 판정은 미검이다.
**여기서 16개 테스트를 쓰지 않는 이유:** 각 라우트가 Supabase 목업 하니스를 요구해 슬라이스가
커진다. 이 지도를 A8.2 백로그로 넘기되, `checkin/context`만은 우선 티켓으로 표시한다.

---

## A4.5 — 타입 거짓말 (`as` 남용) ✅

### 결론: 감사 소관에 `as any`는 0건, 이중 캐스트는 대부분 정당

- **`as any`: 0건** (grep 히트 1건은 주석의 "as any guest" 문구).
- **`as unknown as`: 48건** — 표본 검토 결과 **대부분 정당**:
  - 브라우저 벤더 프리픽스 API(`webkitSpeechRecognition`·`webkitAudioContext`·`navigator.wakeLock`) —
    TS lib에 타입이 없어 불가피.
  - 서명된 토큰 페이로드(`companionToken`) — 서명 검증 후 신뢰.
  - 테스트 seam(`speechSynthesis as SynthLike`) — 목업 주입점.

### 🟡 유일한 백로그 후보 — `ChatFeed`의 메타데이터 캐스트 7건

`ChatFeed.tsx:415~489`가 `message.metadata as unknown as ArrivalBundleMeta`(외 6종)로
**검증 없이** JSON을 카드 prop 타입으로 단언한다. `kind` 스위치로 감싸여 실무상 형태는 맞지만,
`kind`↔`meta` 대응을 TS가 검증하지 못한다 — 서버 스키마가 드리프트하면 카드가 깨진다.
**지금 고치지 않는 이유:** 올바른 해법은 판별 유니온 + 런타임 검증인데 메타데이터 타이핑을
통째로 바꾸는 큰 작업이다. A8.2 백로그(**"cast-not-validate 경계"**)로 남긴다.

### ✅ `TourRoomClient` react-hooks lint — 청산

`244행`(메모리의 285는 낡음)의 `react-hooks/set-state-in-effect`. **제품 결함이 아니다** —
`attempted.current`로 1회만 도는 마운트 초기화가 **클라이언트 전용 URL 파라미터**(`?rt=`)를 읽어
상태에 옮기는 것이다. SSR 렌더에서 못 돌고 리렌더 루프도 없다(규칙이 막는 대상이 아니다).
**이유를 적은 `eslint-disable`로 청산**했다 — 이 저장소가 쓰는 "중첩 함수로 우회" 트릭보다 정직하다.
그 트릭은 같은 setState를 린터 눈에서 숨길 뿐이다. `npx eslint` 통과 확인.

---

## 미착수

없음. A4 전체(A4.1~A4.6) 완료.
※ A8.2 백로그로 넘긴 것: ChatFeed 메타데이터 판별유니온 · 라우트 16개(특히 `checkin/context`) ·
18개 미사용 값 export 재검토.
