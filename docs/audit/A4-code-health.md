# A4 — 코드 건강도 (진행 중)

**축:** 3 코드 · **감사일:** 2026-07-25
**상태:** A4.2 완료 · A4.1/A4.3/A4.4/A4.5/A4.6 미착수

> §J의 "A0.1을 기다리지 않아도 되는 것"에 A4 전부가 들어 있다. 시뮬 환경과 무관하다.

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

## 미착수

| 티켓 | 내용 | 비고 |
|---|---|---|
| A4.1 | 중복 진실 사냥 | B1-D3(집계 중복 금지)·B2.1b(정원 우선순위)의 **사후 검증**이기도 하다 — 두 결정이 실제로 단일 지점을 지켰는지 |
| A4.3 | 죽은 코드·미사용 export | |
| A4.4 | 테스트 공백 지도 | 특히 라우트 레벨 |
| A4.5 | 타입 거짓말 (`as` 남용) | 특히 supabase row → 도메인 타입 |
| A4.6 | 사전존재 결함 청산 | `TourRoomClient.tsx` react-hooks lint · 사전존재 실패 5스위트 |
