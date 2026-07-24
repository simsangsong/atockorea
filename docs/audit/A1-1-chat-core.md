# A1-1 — 채팅 코어 감사

**대상:** `ChatFeed` `Composer` `ReplyPreview` `Avatar` `Lightbox` `ConfirmSheet` (6개, 2,031줄)
**감사일:** 2026-07-25 · **축:** 1 UI/UX · 2 기능 · 7 안전/신뢰
**방법:** 코드 정독 + 호출부 추적. 실기기 픽셀 검증은 미실시(A0.1 시뮬 주행 필요).

**판정: P0 없음.** P1 1건 · P2 3건 · P3 1건. 아래 §2 참조.

---

## 1. 확인했고 문제없음

다음 세션이 같은 곳을 다시 파지 않도록 적는다.

1. **`ReplyPreview`의 로케일 처리가 완전하다.** `ROLE_LABEL`·`KIND_LABEL`이 `Record<RoomLocale, …>`로
   타입 고정돼 있어 로케일이 늘면 **컴파일이 막는다.** 하드코딩 맵이지만 드리프트 위험이 없다
   (A4.1이 잡은 부류와 다르다 — 그쪽은 `as const` 배열이라 타입이 안 지켜줬다).
2. **`ConfirmSheet`가 존재하는 이유가 문서화돼 있고 그 이유가 옳다.**
   iOS WebView에서 `window.confirm`이 **조용히 true를 반환**하는 사고 패턴 때문이고,
   콕핏에서 그건 "확인 없이 출발 공지가 나간다"를 뜻했다. promise 기반이라 기존
   `await confirm(...)` 코드 모양을 유지한다. 🔴 이 컴포넌트는 건드리지 말 것.
3. **`ConfirmSheet`가 `window.prompt`의 cancel≠빈문자 구분을 보존한다**(`allowEmpty`).
   흔히 뭉개는 지점인데 의식적으로 지켰다.
4. **`Avatar`의 `aria-hidden`은 옳다.** 아바타는 장식이고 발신자 이름은 버블에 따로 있다.
   여기에 라벨을 붙이면 스크린리더가 이름을 두 번 읽는다.
5. **`Lightbox`가 body 스크롤을 잠그고 복원한다.** 원래 값을 저장해 두었다가 되돌린다 —
   `overflow: ''`로 밀어버리지 않는다.
6. **`Lightbox`가 이미지 클릭에 `stopPropagation`을 건다.** 사진을 확대해 보려고 탭했을 때
   닫히지 않는다. 다운로드 링크도 마찬가지.

---

## 2. findings

### 🟠 P1 — 손님이 가이드와 기사를 구분할 수 없다

- **재현 경로:** `components/tour-mode/Avatar.tsx:34-62`. 기사 메시지가 있는 룸에서 피드를 본다.
- **관측된 동작:** `guide`와 `driver`가 **같은 글리프**(`IconGuide`)를 쓰고 배경색만 다르다.
  라이트 테마에서 guide `--tr-ink` = `#1a1d21`, driver `--tr-ink-2` = `#565d66` —
  36px 원 안의 진회색과 중회색이다. 다크 테마도 `#e8eaed` vs `#a6adb6`로 같은 문제다.
- **기대 동작:** 두 역할이 **한눈에** 구분되어야 한다(다른 글리프, 또는 색상 대비 확대).
- **왜 P1인가:** 기사는 W3 브릿지로 한국어만 말하고 번역되어 도착한다. 손님에게
  "지금 말하는 사람이 가이드인가 기사인가"는 무엇을 물어봐도 되는지를 정하는 정보다
  (§A S4 이해가능성 · S6 신뢰). `ReplyPreview`는 역할 라벨을 **글자로** 정확히 구분해 주는데
  (`가이드`/`기사님`), 피드 아바타만 뭉개져 있다 — 같은 앱 안에서 두 표면이 다른 답을 준다.

### 🟡 P2 — 채팅 코어의 `aria-label` 9개가 영어 고정

- **재현 경로:** 아래 9곳. 한국어 스크린리더로 룸에 진입해 컴포저를 훑는다.

  | 파일 | 줄 | 라벨 |
  |---|---|---|
  | `ChatFeed.tsx` | 571 | `message actions` |
  | `ChatFeed.tsx` | 808 | `scroll to latest messages` |
  | `Composer.tsx` | 659 | `attach a photo or file` |
  | `Composer.tsx` | 684 | `ask about a photo` |
  | `Composer.tsx` | 714 | `record voice message` |
  | `Composer.tsx` | 724 | `send` |
  | `Lightbox.tsx` | 48 | `close` |
  | `Lightbox.tsx` | 60 | `download` |
  | `ReplyPreview.tsx` | 75 | `cancel reply` |

- **관측된 동작:** 보이는 문구는 전부 5로케일인데 **스크린리더가 읽는 이름만 영어**다.
  ko/ja/zh/es 사용자는 모든 조작 요소를 영어로 듣는다.
- **기대 동작:** 로케일 상수로 옮긴다.
- **비고:** `ChatFeed`·`Composer`·`ReplyPreview`는 **이미 `locale` prop을 받는다**
  (`ChatFeed.tsx:141`, `Composer.tsx:152`, ReplyPreview). 제약이 아니라 누락이다.
  `Lightbox`만 prop 추가가 필요하다.

### 🟡 P2 — `Lightbox`의 이펙트가 인라인 `onClose`에 의존한다 (이미 한 번 값을 치른 패턴)

- **재현 경로:** `Lightbox.tsx:24-35`의 `useEffect(..., [url, onClose])`.
  호출부 두 곳이 전부 인라인 화살표를 넘긴다 —
  `ChatFeed.tsx:822`, `cockpit/Cockpit.tsx:2258` (`onClose={() => setLightbox(null)}`).
- **관측된 동작:** `onClose`가 매 렌더 새 함수라, 라이트박스가 열려 있는 동안 **부모가
  리렌더될 때마다** 이펙트가 정리→재실행된다. `ChatFeed`는 실시간 피드라 메시지가 올 때마다
  리렌더된다 → 스크롤 잠금이 풀렸다 다시 걸린다. 정상 흐름에서는 자기 교정되지만
  잠금이 순간적으로 풀리는 구간이 매 메시지마다 생긴다.
- **기대 동작:** `onClose`를 ref로 잡아 이펙트 의존에서 뺀다.
- **🔴 왜 중요한가:** **이건 이 저장소가 이미 P0로 겪은 버그와 같은 부류다.**
  §11.A A1: *"`Sheet.tsx` 포커스 이펙트가 인라인 onClose 의존으로 부모 리렌더마다 재실행 →
  입력 포커스 강탈 (모바일 키보드 오픈이 리렌더를 유발 = 결정론적 잠금)"*.
  그때 `Sheet.tsx`는 고쳤지만 **형제 컴포넌트의 같은 패턴은 남았다.** 여기서는 증상이
  가벼울 뿐이고, 원인은 동일하다.

### 🟡 P2 — `Lightbox`에 다이얼로그 시맨틱·포커스 트랩이 없다

- **재현 경로:** `Lightbox.tsx:38-45`. 사진 버블을 탭해 연 뒤 Tab을 누른다.
- **관측된 동작:** 배경 `div`에 `role="dialog"`·`aria-modal`이 없고 포커스 트랩도 없다.
  포커스가 **뒤쪽 피드에 그대로 남아** Tab이 가려진 요소들 사이를 돈다.
  Esc 닫기는 동작한다(그건 구현돼 있다).
- **기대 동작:** `role="dialog" aria-modal="true"` + 열릴 때 닫기 버튼에 포커스.
- **비고:** `Sheet.tsx`는 포커스 계약을 갖고 있다(`ConfirmSheet` 주석이 "the Sheet itself brings
  the spring + backdrop + Escape + focus contract"라고 적고 있다). `Lightbox`만 그 계약 밖이다.

### 🔵 P3 — `Avatar`의 `driver` 배경이 폴백 체인을 쓴다

- **재현 경로:** `Avatar.tsx:46` — `bg-[var(--tr-ink-2,var(--tr-ink))]`.
- **관측된 동작:** `--tr-ink-2`가 없으면 `--tr-ink`로 떨어진다. 그 경우 기사 아바타가
  가이드와 **완전히 동일**해진다. 현재 테마엔 두 토큰이 다 있어서 발현되지 않는다.
- **기대 동작:** P1을 고칠 때 함께 정리(글리프를 다르게 하면 색 폴백이 무해해진다).
- §G 확장 뱅크가 아니라 위 P1의 하위 항목으로 둔다.

---

## 3. 미검증 (이 티켓에서 못 한 것)

- **실기기 픽셀 검증** — 375px에서 컴포저·버블·리플라이 바 레이아웃. A0.1 시뮬 주행 후 A5에서.
- **긴 메시지·긴 파일명 오버플로** — A0.4 하니스는 `messages/*.json`(사이트)만 본다.
  룸 5로케일 캡슐은 별도 스위트가 키 누락만 지킨다. 실렌더 확인 필요.
- **`ChatFeed` 890줄 전체 로직**(그룹핑·번역 토글·읽음/타이핑·딥링크)은 이번 정독에서
  구조만 확인했다. 동작 검증은 A5 시뮬에서.

## 4. 이 티켓의 조치

**P0가 없으므로 즉시 수정은 없다**(§0 규칙 7: P0는 즉시, 나머지는 백로그).
P1 1건 + P2 3건 + P3 1건을 **A8.2 수정 백로그**로 넘긴다.

P1(가이드/기사 아바타)은 백로그 상위에 둘 것 — 손님이 "누가 말하는가"를 못 읽는 것은
S4·S6를 동시에 깎고, 고치는 비용은 글리프 하나다.
