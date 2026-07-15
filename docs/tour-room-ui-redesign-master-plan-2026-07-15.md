# 투어룸 UI/UX 글로벌 리디자인 마스터 플랜 — "월드클래스 메신저" (2026-07-15)

> **단일 기준 문서.** 투어룸(Tour Mode room)의 시각·인터랙션 품질을 KakaoTalk / Telegram / WhatsApp 급으로 끌어올리는 리디자인의 유일한 기준. 기능(§M 가드레일)은 절대 불변 — 프레젠테이션 레이어만 교체한다.
>
> **개발 브랜치:** `claude/atockorea-tourroom-ui-redesign-m96qmw`
> **선행 플랜과의 관계:** 기능 마스터 플랜(`docs/tour-mode-master-plan-2026-07-14.md`)의 티켓 체계(T1.x~)와 독립. 이 문서의 티켓은 **U0~U8 웨이브 / U-티켓**으로 구분한다.

---

## §0. 한 줄 요약

현재 투어룸은 기능적으로 완성됐지만 시각 언어가 "카드 대시보드"다 — 채팅앱이 아니다. 이 플랜은 ① 레이아웃을 메신저 문법(슬림 헤더 · 풀블리드 피드 · 하단 네비 · 도킹 컴포저)으로 재조립하고, ② 버블 시스템(그룹핑·아바타·타임스탬프·날짜 구분선·꼬리)을 카카오톡/텔레그램 수준으로 신설하고, ③ 이모지-아이콘·임의 px 타이포·색상 난립을 토큰 기반 디자인 시스템으로 전면 교체한다. 총 8웨이브 / 46티켓, 전부 프레젠테이션 전용(마이그레이션·API 변경 0건).

---

## §A. 현재 상태 전수 진단 (2026-07-15 코드 실사)

심각도: 🔴 치명(채팅앱으로 안 보이는 원인) / 🟠 중대(저급해 보이는 원인) / 🟡 개선(폴리시)

### A-1. 레이아웃 — 🔴 "채팅앱"이 아니라 "카드 스택"

| # | 문제 | 근거 |
|---|------|------|
| A-1a | 룸 전체가 `max-w-md px-4` 카드 컬럼 — 피드가 엣지-투-엣지가 아님. 모든 메신저는 피드가 뷰포트 전체를 소유 | `RoomShell.tsx:96` |
| A-1b | 헤더 + 긴급카드 + 배너 + 탭바가 피드 **위에 상시 적층** — 첫 화면에서 세로 ~180px 소모. 카카오/텔레그램 헤더는 48~56px 단일 바 | `RoomShell.tsx:97-131` |
| A-1c | 탭 네비가 화면 **중간**의 세그먼트 컨트롤 — 엄지 존(하단) 위반, 앱이 아니라 웹 위젯처럼 보임 | `RoomShell.tsx:114` |
| A-1d | 긴급카드가 항상 헤더 아래 고정 카드로 노출 — 평시엔 죽은 공간. 메신저 문법은 헤더 아이콘 → 시트 | `RoomShell.tsx:108-110`, `EmergencyCard.tsx` |
| A-1e | 컴포저가 스크롤 컬럼의 일부(fixed 아님) — safe-area(-bottom) 미처리, 키보드 대응 스펙 없음 | `TourRoomClient.tsx:470-478` |
| A-1f | 채팅 캔버스 색이 페이지 배경(#faf9f6)과 동일 — 흰 버블이 ring/shadow 없이는 안 보여서 모든 버블에 테두리+그림자를 바르게 된 근본 원인 | `RoomShell.tsx:96`, `ChatFeed.tsx:185-193` |

### A-2. 메시지 버블 — 🔴 메신저 table-stakes 부재

| # | 문제 | 근거 |
|---|------|------|
| A-2a | **타임스탬프가 아예 없음.** 날짜 구분선도 없음 — 채팅앱 최소 요건 미달 | `ChatFeed.tsx` 전체 |
| A-2b | 아바타 없음 — 수신 버블에 발신자 식별 요소가 11px 텍스트 라벨뿐 | `ChatFeed.tsx:172-181` |
| A-2c | 연속 메시지 그룹핑 없음 — 같은 사람이 3번 보내면 라벨 3번, 균일 간격. 카카오/텔레그램은 그룹 내 2px / 그룹 간 12px + 이름·꼬리 1회 | `ChatFeed.tsx:126-214` |
| A-2d | 내 버블 `bg-amber-500 + text-white` — 대비 ≈ 2.2:1로 **WCAG AA 탈락**, 야외 직사광(투어 상황!)에서 안 읽힘 | `ChatFeed.tsx:187` |
| A-2e | 모든 버블에 `shadow-sm + ring` — 시각 소음. 플랫 버블 + 캔버스 대비가 정석 | `ChatFeed.tsx:185-190` |
| A-2f | 버블 꼬리 없음, `max-w-[85%]`로 과폭(정석 70~78%) | `ChatFeed.tsx:171` |
| A-2g | 번역 힌트 "🌐 original"이 **모든 번역 버블 안에** 상시 노출 — 본문 오염 | `ChatFeed.tsx:196-200` |
| A-2h | 전송중=투명도, 실패=빨간 ring뿐 — 상태 아이콘(시계/재시도) 없음, 실패 재전송이 피드 하단의 `↻ n` 빨간 바 하나 | `ChatFeed.tsx:191-192`, `TourRoomClient.tsx:461-469` |
| A-2i | 버블 전체가 `<button>` — 텍스트 선택(복사) 불가 | `ChatFeed.tsx:182` |
| A-2j | 스크롤-투-바텀 FAB 없음, 새 메시지 구분선("여기까지 읽음") 없음 | `ChatFeed.tsx` |

### A-3. 타이포그래피 — 🟠

- 임의 px 난립: `text-[10px]`~`text-[17px]` 9종이 컴포넌트마다 제각각. tailwind.config가 "토큰 쓰라"고 명시하는데 투어룸 전체가 위반.
- 본문 14px는 채팅 본문으로 작음(카카오 ~15.5px, 텔레그램 16px). 메타 10~11px는 시니어 여행자 페르소나에 치명적.
- CJK(ja/zh) line-height 보정 없음.

### A-4. 색상 — 🟠 "색상 카니발"

- 한 화면에 amber(주황) + emerald(초록) + sky(하늘) + red + 그라데이션 카드 2종(sky→white, emerald→white)이 동시 등장: `LobbyCard.tsx:98`, `PickupBoard.tsx:97`, `NoticeBanner.tsx:122-126`, `PresenceBar.tsx`.
- 역할 없는 색: emerald가 "연결됨"이면서 "픽업"이면서 "운영팀 응답"이면서 "온라인". 의미 체계 부재.
- 다크모드가 `gray-950/900` 일괄 치환 — 캔버스/서피스/버블 위계 없음.

### A-5. 아이콘 — 🔴 이모지 = 저급함의 최대 원인

`🆘 ▲ ▼ 🎤 📷 ➤ 🌐 ↩ 🚌 ✨ 📍 🕐 🚫 🎟️ 🚶 🚻 🅿️ 📸 🏪 💡 ⏳ 📣 🗺 🚩 ☀️ 🌙 ✅ 🔍 🏁` — UI 크롬(버튼·라벨·상태)에 이모지 28종. OS마다 렌더가 다르고 크기·굵기·색 통제 불가. **lucide-react가 이미 의존성에 있는데 투어룸만 미사용.**

### A-6. 컴포넌트 디테일 — 🟠

- 전송 버튼이 사각형 안의 `➤` 텍스트(`Composer.tsx:432-439`) — 원형 아이콘 버튼 + mic↔send 모핑(텔레그램 문법)이 정석.
- 입력창이 단일행 `<input>` — 멀티라인 자동 성장 textarea 아님(`Composer.tsx:386-395`).
- 퀵답장 칩이 컴포저 위에 상시 1열 — 흰 칩 + ring이라 존재감 약하고 공간만 차지(`Composer.tsx:264-275`).
- 로딩 상태가 회색 텍스트 한 줄(`TourRoomClient.tsx:101-107`) — 스켈레톤 없음.
- 토글/세그먼트(`SettingsTab.tsx`)는 준수하나 44px 타깃 미달 다수(탭 py-2, 칩 py-1.5).

### A-7. 되어 있는 것 (보존 대상 자산) ✅

- 윈도우 렌더링(60개) + near-bottom 자동 추적(`ChatFeed.tsx:87-101`) — 로직 우수, UI만 교체.
- 번역 우선 표시 + 탭-토글 원문, 5개 로케일 무LLM 카피 체계.
- 다크모드 인프라(룸 스코프 `.dark`), 설정 탭 구조, 텍스트 크기 설정.
- SOS 2단 확인 + 운영팀 응답 하이라이트 플로우(UX 설계 자체는 좋음 — 스킨만 교체).
- data-testid 계약 + 테스트 164개.

---

## §B. 벤치마크 — 무엇을 어디서 가져오나

| 패턴 | 출처 | 채택 형태 |
|------|------|-----------|
| **밝은 브랜드색 버블 + 진한 텍스트** (노란 버블 + 검정 글자) | KakaoTalk | 내 버블 = 웜 앰버 옐로 + 잉크 텍스트. 브랜드(amber) 유지하면서 AA 대비 확보 — U-D2 |
| 채팅 캔버스를 서피스와 분리된 톤으로 | KakaoTalk(블루그레이), WhatsApp(패턴) | 라이트: 웜 그레이지 캔버스 / 다크: 딥 차콜 — 버블이 ring 없이 뜬다 |
| 버블 옆 밑정렬 소형 타임스탬프(그룹 마지막에만) | KakaoTalk | 그대로 채택 |
| 날짜 필 구분선(스크롤 시 플로팅) | Telegram | 그대로 채택 |
| 버블 꼬리(그룹 마지막 버블에만) | Telegram / KakaoTalk | radius 비대칭(18/4px)으로 구현 — svg 꼬리 불필요 |
| mic↔send 모핑 원형 버튼, 첨부 "+" 좌측 | Telegram | 그대로 채택 |
| 스크롤-투-바텀 FAB + 미읽음 배지 | Telegram | 그대로 채택 |
| 시스템 메시지 = 중앙 캡슐 필 | 전 메신저 공통 | 현 회색 카드 → 반투명 캡슐 |
| 하단 탭 네비 + 미읽음 도트 | KakaoTalk / LINE | 4탭 하단 고정, 키보드 열리면 숨김 |
| 헤더에 통화/알림 아이콘 → 시트 | 전 메신저 공통 | 긴급/SOS를 헤더 아이콘 + 바텀시트로 이동 |
| 새 메시지 도착 스프링 인 애니메이션 | Telegram | framer-motion(이미 의존성) 120~200ms |
| 읽음표시·타이핑 인디케이터 | 전 메신저 | **백로그(§H-백로그)** — 서버 이벤트 필요, 이번 범위 밖 |

---

## §C. 바인딩 디자인 결정 (U-D1 ~ U-D12) — 번복 시 이 문서 개정 필수

- **U-D1. 프레젠테이션 전용.** DB·API·훅 시그니처·메시지 프로토콜 변경 0건. `data-testid` 전부 보존. 기존 테스트 164개 green 유지(스타일 단언만 수정 허용).
- **U-D2. 내 버블 = 카카오 문법.** 라이트/다크 공통 "웜 옐로 버블 + 잉크 텍스트"(#FBE471 / #1A1A14 계열). `amber-500 + white` 조합은 투어룸에서 **금지**. amber-500은 전송 버튼·활성 상태 등 "행동 액센트"로만.
- **U-D3. 이모지 아이콘 전면 퇴출.** UI 크롬(버튼·탭·상태·라벨)은 lucide-react만. 이모지는 "콘텐츠"(퀵답장 프리셋 텍스트 등 메시지 본문)에만 잔류 허용.
- **U-D4. 레이아웃 문법 = 메신저.** 슬림 헤더(52px) / 풀블리드 피드 / 하단 탭바(사파에어리어) / 도킹 컴포저. 긴급카드는 헤더 아이콘 → 바텀시트로 이동(오프라인 정적 콘텐츠 성질 유지). 배너류는 피드 위 **오버레이**(레이아웃 시프트 금지).
- **U-D5. 버블 시스템 신설.** 3분/동일발신 그룹핑, 아바타(수신만·이니셜+결정적 파스텔 해시·가이드는 브랜드 배지), 그룹 말미 타임스탬프, 날짜 필, 꼬리(그룹 말미), max-w 78%, 플랫(ring/shadow 금지 — 캔버스 대비로 분리).
- **U-D6. 타이포 토큰.** 채팅 본문 15px/1.45(large 18px), 발신자명 13px/600, 메타·타임스탬프 11px, 카드 제목 15px/600, 카드 본문 13px/1.5. 투어룸 내 임의 px 신규 사용 금지. ja/zh는 line-height +0.05.
- **U-D7. 색 역할 고정.** amber=브랜드·행동 / emerald=**연결·안전 상태 전용** / red=긴급 전용 / sky·gradient **퇴출**. 카드 1장당 액센트 1색.
- **U-D8. 모션 시스템.** framer-motion. 진입 120ms fade+4px rise(새 버블), 시트 260ms spring, 탭 크로스페이드 150ms, FAB scale 150ms. `prefers-reduced-motion` 전면 존중.
- **U-D9. 다크모드 3계층.** 캔버스 #0D1013 / 서피스 #171B20 / 수신 버블 #1F242B. `gray-*` 일괄 매핑 폐기, 내 버블은 라이트와 동일 옐로(카카오 다크 문법).
- **U-D10. 터치 타깃 ≥44px, 텍스트 대비 AA(4.5:1).** 아웃도어 사용 전제 — 회색 400번대 텍스트를 본문에 쓰지 않는다.
- **U-D11. 번역 어포던스 이동.** 버블 내부 "🌐 original" 제거 → 그룹 메타 라인의 소형 globe 아이콘(원문 표시 중엔 undo 아이콘). 탭-토글 동작 자체는 유지하되 래퍼를 `<button>`→`<div role="button">`+텍스트 선택 허용으로.
- **U-D12. 읽음표시·타이핑 인디케이터·이모지 리액션은 이번 범위 밖.** 서버 이벤트가 필요한 기능은 §H 백로그로 — 이 플랜은 순수 UI 리프트.

---

## §D. 디자인 토큰 (`app/tour-room-theme.css` 신설, 룸 루트 스코프)

투어룸 루트(`RoomShell`)에 `.tr-root` 클래스를 부여하고 CSS 변수로 정의 — 사이트 전역 토큰 오염 없음.

```css
.tr-root {
  /* 캔버스·서피스 */
  --tr-canvas: #EFEBE3;        /* 채팅 배경 — 웜 그레이지 */
  --tr-surface: #FFFFFF;       /* 카드·시트·헤더 */
  --tr-surface-2: #F6F4EF;     /* 헤더 하위·인풋 배경 */
  /* 버블 */
  --tr-bubble-me: #FBE471;     /* 카카오 문법: 웜 옐로 */
  --tr-bubble-me-ink: #201C0A;
  --tr-bubble-in: #FFFFFF;
  --tr-bubble-in-ink: #1A1D21;
  --tr-bubble-system: rgba(23, 27, 32, 0.06);
  /* 텍스트 */
  --tr-ink: #1A1D21;  --tr-ink-2: #565D66;  --tr-ink-3: #8A919B;
  /* 역할색 */
  --tr-accent: #F59E0B;        /* amber-500 — 행동 전용 */
  --tr-accent-deep: #B45309;   /* amber-700 — 텍스트 대비용 */
  --tr-safe: #059669;          /* emerald-600 — 연결·안전 */
  --tr-danger: #DC2626;
  /* 지오메트리 */
  --tr-radius-bubble: 18px; --tr-radius-tail: 4px;
  --tr-radius-card: 20px;   --tr-radius-input: 22px;
  --tr-header-h: 52px;      --tr-tabbar-h: 56px;
}
.dark .tr-root {
  --tr-canvas: #0D1013; --tr-surface: #171B20; --tr-surface-2: #1F242B;
  --tr-bubble-me: #F5DE6A; --tr-bubble-me-ink: #201C0A;
  --tr-bubble-in: #1F242B; --tr-bubble-in-ink: #E8EAED;
  --tr-bubble-system: rgba(232, 234, 237, 0.08);
  --tr-ink: #E8EAED; --tr-ink-2: #A6ADB6; --tr-ink-3: #6E757E;
}
```

- **타이포 스케일(§C U-D6)**: `tr-body(15/1.45) · tr-body-lg(18/1.45) · tr-name(13/600) · tr-meta(11/1.3) · tr-title(15/600) · tr-card(13/1.5)` — Tailwind arbitrary 대신 유틸 클래스로 함께 정의.
- **아이콘 매핑(발췌)**: 긴급 `PhoneCall`/`ShieldAlert` · 전송 `ArrowUp`(원형) · 마이크 `Mic` · 카메라 `Camera` · 번역 `Globe`/`Undo2` · 탭 `MessageCircle / Map / CalendarDays / Settings` · 도착 `MapPin` · 집합 `Megaphone` · 자유시간 `Hourglass` · 픽업 `Bus` · 청취 `Volume2` · 재시도 `RotateCcw` · 전송중 `Clock`.
- **엘리베이션**: 피드 요소 플랫(그림자 0) / 오버레이(FAB·필·시트)만 `0 4px 16px rgba(0,0,0,.12)`.

---

## §E. 레이아웃 아키텍처 (RoomShell 재조립)

```
┌──────────────────────────────┐
│ 헤더 52px: [투어명+LIVE점] [🛟] │ ← 서피스색, 하단 헤어라인
├──────────────────────────────┤
│ (오버레이 존: 공지필·자막필)      │ ← absolute, 레이아웃 시프트 0
│                              │
│   풀블리드 채팅 캔버스           │ ← --tr-canvas, 좌우 패딩 12px
│   (피드가 화면 전체 소유)        │
│                        [FAB] │
├──────────────────────────────┤
│ 컴포저: [+] [입력 필]  [(mic|➤)]│ ← 서피스색, 상단 헤어라인
├──────────────────────────────┤
│ 탭바 56px: 채팅 지도 오늘 설정    │ ← 키보드 열리면 숨김, safe-area
└──────────────────────────────┘
```

- **헤더**: 좌측 투어명(15px/600) + 상태 서브라인 1줄(날짜·도시 / 연결 저하 시에만 "재연결 중…" 앰버 텍스트로 대체 — 평시 연결점 노출 안 함, LIVE 배지는 이름 옆 6px 그린 도트+`LIVE` 캡슐 유지). 우측 긴급 아이콘 버튼(44px) → 바텀시트(긴급연락처+SOS, 기존 EmergencyCard/SosButton 콘텐츠 이식).
- **탭바**: 아이콘 22px+라벨 10px, 활성=amber-600+상단 2px 인디케이터 대신 아이콘 필 배경, 채팅 탭에 미읽음 도트(타 탭 체류 중 수신 시). `env(safe-area-inset-bottom)` 패딩.
- **최대 폭**: 피드는 뷰포트 전체, 콘텐츠만 `max-w-2xl mx-auto`(태블릿 대비) — `max-w-md` 카드 컬럼 폐기.
- **키보드**: `visualViewport` 리스너로 컴포저 도킹 유지 + 탭바 숨김 + 피드 하단 고정.
- **배너류(공지 카운트다운·라이브 자막)**: 피드 상단 absolute 오버레이 필. 자막은 하단(컴포저 위) 다크 필 유지 — 스타일만 토큰화.

## §F. 채팅 코어 스펙 (ChatFeed 재작성)

1. **그룹핑 유틸** `lib/tour-room/messageGroups.ts` (순수 함수+테스트): 동일 `sender_role`(+동일 발신자) & 5분 이내 & 사이에 시스템/카드 없음 → 그룹. 그룹 내 간격 2px, 그룹 간 12px.
2. **수신 그룹**: 아바타 36px(그룹 첫 버블에만, 이하 40px 들여쓰기) + 이름 13px(그룹 첫 버블 위) + 그룹 마지막 버블 옆에 11px 타임스탬프(밑정렬). 가이드 아바타 = amber 배경 + `Flag` 아이콘, admin = 브랜드 로고색, 여행자 = 이니셜+파스텔 해시(이름 기반 결정적).
3. **발신 그룹**: 아바타·이름 없음, 우측 정렬, 타임스탬프 좌측 밑정렬 + 상태(전송중 `Clock` 12px, 실패 `RotateCcw` 빨강 탭=개별 재전송, 기존 일괄 재시도 바는 "n개 전송 실패 · 모두 재시도" 필로 리스킨).
4. **꼬리**: 그룹 마지막 버블만 발신측 하단 코너 4px(나머지 18px).
5. **날짜 구분선**: `formatRoomDate(locale)` 유틸 신설 — 중앙 캡슐 필(`--tr-bubble-system`), 최상단 "이전 메시지 보기"는 같은 필 스타일로 통일.
6. **시스템 메시지**: 중앙 캡슐 필 12px, 최대 85%.
7. **새 메시지 구분선**: 탭 복귀/재입장 시 마지막 읽은 지점에 "여기서부터 안 읽음" 헤어라인+라벨(세션 메모리, 서버 없음).
8. **스크롤 FAB**: near-bottom 아닐 때 표시(ChevronDown 원형 40px), 벗어난 사이 수신 개수 배지, 탭=smooth bottom.
9. **운영팀 응답 하이라이트**: ring-2 → 수신 버블 좌측 3px emerald 액센트 바 + 이름 옆 `ShieldCheck` 14px로 절제.
10. **버블 진입 모션**: 신규 메시지만 120ms fade + y4 rise(윈도우 로드분 제외), reduced-motion 시 즉시.

## §G. 컴포저 스펙 (Composer 재작성)

- **필 컨테이너**: `--tr-surface-2` 배경 radius 22px textarea(1→5행 자동 성장, `field-sizing` 폴백 포함), placeholder 로케일 카피 신설("메시지 보내기…" 5개 로케일).
- **좌측 `+`**: 카메라(사진 질문)를 attachment 행으로 — 탭 시 컴포저 위로 액션 행 슬라이드(카메라/앨범). 기존 vision 패널은 시트형으로 리스킨.
- **우측 원형 44px 버튼**: draft 비면 `Mic`(surface 톤), 있으면 `ArrowUp`(amber-500 원형+백 아이콘, 아이콘은 장식이라 white 허용) — 90ms 크로스모프.
- **퀵답장 칩**: 컴포저 위 1열 유지하되 리스킨 — `--tr-surface` 필 + 13px, 탭 시 스프링 축소 피드백. 5분 무입력 시 접힘(칩 행 ↔ `Zap` 토글) — *접힘 로직은 U4.4에서 A/B 판단, 우선 리스킨만.*
- **녹음 바**: 텔레그램 문법 — 좌측 빨강 점 + 타이머, 중앙 라이브 파형(기존 레벨 로직 재사용), 우측 취소(텍스트)·완료(빨강 원형 `Check`). 전사 중 바는 파형 자리에 3-dot 웨이브.
- **음성 확인 힌트/에러**: 인라인 노트 → 컴포저 위 오버레이 토스트 필(3초, 확인 힌트는 입력 필 amber 헤어라인 글로우로 대체).

## §H. 카드·배너 리스킨 (공통 카드 레시피)

**레시피**: `--tr-surface` / radius 20px / 그림자·그라데이션·ring 금지(캔버스 대비) / 헤더 행 = lucide 아이콘 18px + tr-title / 카드당 액센트 1색.

| 컴포넌트 | 핵심 변경 |
|---|---|
| SpotArrivalCard | 이미지 라운드 상단 유지, "도착" 오버라인 → `MapPin`+amber-700, 이모지 행 아이콘화(`Clock/Ticket/Footprints/…`), 오디오 버튼 = amber 필 + `Play/Pause` |
| LobbyCard | sky 그라데이션 퇴출 → 서피스 카드 + D-day 캡슐(amber), `CalendarDays`/`Bus` 아이콘 |
| PickupBoard | emerald 그라데이션 퇴출 → 서피스 카드 + ETA 캡슐만 emerald(안전/상태 역할), 버튼 44px |
| NoticeBanner | 오버레이 필로 이동(§E), urgent 시 전체 pulse → 카운트다운 캡슐만 스케일 펄스 |
| CaptionBanner | 다크 필 유지, LIVE 도트+`AudioLines`, 토큰화 |
| EmergencyCard+SosButton | 헤더 아이콘 → 바텀시트(드래그 핸들, 연락처 리스트 = `Phone` 행 44px, SOS 플로우 동일하되 시트 안에서) |
| EndedCard / InstallBanner / WebviewEscapeBanner | 카드 레시피 통일, 이모지 제거, Install은 하단 스낵바형 |
| 에러/로딩 화면 | 로딩 = 룸 스켈레톤(헤더+버블 3개 셰이머), 에러 = `CompassIcon`+카드 |

## §I. 지도·오늘·설정 탭 + 엔트리

- **오늘(일정)**: 카드 리스트 → 세로 타임라인(시간 레일 + 도트 + 카드, 현재 진행 항목 amber 도트+굵게, KST 기준 자동 판별). `Bus` 출발시간 아이콘화.
- **지도**: PresenceBar·LocationShareCard·FindGuideCard 카드 레시피 적용, follow 버튼 = 지도 위 원형 FAB(`Navigation`), 지도만 풀블리드로.
- **설정**: 섹션 그룹 리스트(iOS Settings 문법) — 카드 대신 그룹 리스트+헤어라인, 토글 lucide 없음(현 토글 재사용, 51×31 사이즈업).
- **엔트리(`TourModeEntry`)**: 예약 카드에 투어 썸네일(`tours.image_url` 이미 응답에 존재) + `ChevronRight`, 게스트 폼 인풋 radius/포커스 토큰 통일.
- **가이드 콘솔·GuideCaptionBar**: 다크 필 토큰화 + 아이콘화(범위 확대 금지 — 스킨만).

## §J. 접근성·국제화·성능 체크리스트 (U8 게이트)

- [ ] 본문·메타 텍스트 전수 AA(4.5:1) — 특히 `--tr-ink-3` 사용처는 메타 전용인지 확인
- [ ] 터치 타깃 44px 전수(탭·칩·아이콘 버튼·토글)
- [ ] `prefers-reduced-motion` 전 모션 무효화
- [ ] ja/zh line-height 보정, es 장문 라벨 오버플로 확인(5로케일 스크린샷 매트릭스)
- [ ] 자막/공지 `aria-live="polite"`, 탭 `role="tablist"` 유지, 시트 포커스 트랩
- [ ] 프레임 예산: 버블 모션은 transform/opacity만, 윈도우 렌더링 로직 불변

---

## §K. 실행 WBS — 8웨이브 / 46 나노티켓

> 티켓 규칙: 1티켓 = 1커밋 단위, 각 웨이브 종료 시 `npm test` + 5로케일 × 라이트/다크 육안 확인. 기존 테스트의 스타일 단언 외 수정 금지.

### Wave U0 — 파운데이션 【6】
- U0.1 `app/tour-room-theme.css` 토큰 + `.tr-root` 스코프, RoomShell에 연결
- U0.2 타이포 유틸(tr-body 등) + 아이콘 매핑 상수(`components/tour-mode/icons.ts`)
- U0.3 `lib/tour-room/messageGroups.ts` 그룹핑 순수함수 + 테스트
- U0.4 `lib/tour-room/timeFormat.ts` 로케일 타임스탬프·날짜필 포맷 + 테스트
- U0.5 `Avatar.tsx`(이니셜 파스텔 해시·역할 배지) + 테스트
- U0.6 공통 `Sheet.tsx`(바텀시트, framer-motion, 포커스 트랩)

### Wave U1 — 셸·레이아웃 【7】
- U1.1 RoomShell 풀블리드 재조립(헤더 52px·캔버스·`max-w-md` 폐기)
- U1.2 하단 탭바(아이콘+라벨+safe-area+미읽음 도트)
- U1.3 긴급카드 → 헤더 아이콘+바텀시트 이식(SOS 포함, testid 보존)
- U1.4 연결 상태 = 서브라인 절제 표기(저하 시에만)
- U1.5 배너 오버레이 존(공지·자막 absolute화)
- U1.6 키보드 대응(visualViewport·탭바 숨김)
- U1.7 로딩 스켈레톤 + 에러 화면 리스킨

### Wave U2 — 버블 시스템 【8】
- U2.1 ChatFeed 그룹 렌더러 교체(그룹핑+간격+max-w 78%)
- U2.2 버블 스킨(옐로/서피스, 꼬리, 플랫, 텍스트 선택 허용)
- U2.3 아바타+발신자명(수신 그룹)
- U2.4 타임스탬프(그룹 말미 측면) + 날짜 필 구분선
- U2.5 시스템 메시지 캡슐 필 + "이전 메시지" 필 통일
- U2.6 전송 상태(Clock/개별 재시도) + 일괄 재시도 필 리스킨
- U2.7 번역 어포던스 이동(U-D11) + AudioButton 메타행 통합
- U2.8 운영팀 응답 하이라이트 절제 리스킨(액센트 바+ShieldCheck)

### Wave U3 — 피드 UX 【4】
- U3.1 스크롤-투-바텀 FAB + 미도착 배지
- U3.2 새 메시지(안 읽음) 구분선
- U3.3 신규 버블 진입 모션(+reduced-motion)
- U3.4 빈 피드 상태(가이드 인사 대기 일러스트 카피)

### Wave U4 — 컴포저 【6】
- U4.1 필 textarea(자동 성장) + placeholder 카피 5로케일
- U4.2 원형 mic↔send 모핑 버튼
- U4.3 `+` 첨부 행 + vision 패널 시트화
- U4.4 퀵답장 칩 리스킨
- U4.5 녹음·전사 바 텔레그램 문법 리스킨(파형 재사용)
- U4.6 음성 노트/확인 힌트 → 토스트·글로우 치환

### Wave U5 — 카드·배너 【7】
- U5.1 SpotArrivalCard / U5.2 LobbyCard / U5.3 PickupBoard / U5.4 NoticeBanner(오버레이 필) / U5.5 CaptionBanner·GuideCaptionBar / U5.6 EndedCard·InstallBanner·WebviewEscapeBanner / U5.7 SOS 시트 내 플로우 검증(모의 시나리오)

### Wave U6 — 탭·엔트리 【5】
- U6.1 오늘 탭 타임라인 / U6.2 지도 탭 카드·FAB / U6.3 설정 탭 그룹 리스트 / U6.4 엔트리 페이지 리스킨 / U6.5 PresenceBar 리스킨

### Wave U7 — 다크모드·모션 폴리시 【2】
- U7.1 다크 3계층 전수 적용 감사(컴포넌트별 잔여 gray-* 치환)
- U7.2 모션 일괄 감사(값 통일·reduced-motion·60fps 확인)

### Wave U8 — QA 게이트 【1】
- U8.1 §J 체크리스트 전수 + 5로케일×2테마 스크린샷 매트릭스 + `npm test` + CLAUDE.md/이 문서 §L 상태 갱신

---

## §L. 상태 보드 (세션마다 갱신)

| 웨이브 | 상태 | 비고 |
|---|---|---|
| U0 파운데이션 | ✅ 완료 (2026-07-15) | 토큰 css·icons.ts·messageGroups·timeFormat·avatarColor·Avatar·Sheet + 신규 테스트 17개 |
| U1 셸·레이아웃 | ✅ 완료 | 슬림 헤더·하단 탭바(미읽음 도트·키보드 숨김)·긴급 시트·배너 오버레이 존·스켈레톤·에러 리스킨 |
| U2/U3 버블·피드 UX | ✅ 완료 | 그룹핑·아바타·타임스탬프·날짜필·시스템 캡슐·전송상태·FAB·안읽음 구분선·진입 모션·빈 상태 |
| U4 컴포저 | ✅ 완료 | 자동성장 textarea·mic↔send 모핑·도킹 바·녹음/전사 바·비전 패널·퀵답장 리스킨 |
| U5 카드·배너 | ✅ 완료 | SpotArrival·Lobby·Pickup·Notice·Caption·GuideCaptionBar·Ended·Install·SOS·AudioButton |
| U6 탭·엔트리 | ✅ 완료 | 오늘 타임라인(KST 현재 스팟 하이라이트)·지도 카드·설정 그룹 리스트·엔트리·PresenceBar |
| U7/U8 감사·QA | ✅ 완료 | ink-3 대비 강화, GuideConsole·ComingSoon 라이트 스킨, 투어룸 테스트 228개 green |

**파킹(범위 밖 잔여):**
- `RoomMapCanvas` 지도 마커 이모지(🚌/🅿) — 지도 콘텐츠 글리프로 잔류. 커스텀 마커 아이콘화는 지도 로직 파일 수정이 필요해 §M-1 가드레일상 보류.
- 탭 전환 크로스페이드(U-D8 일부) — 탭 패널이 조건부 마운트(지도 SDK 지연 로드 §O-1 ②)라 AnimatePresence 도입 시 마운트 계약이 바뀜. 보류.
- 읽음표시·타이핑 인디케이터·리액션 = U-D12대로 기능 백로그(서버 이벤트 필요).
- 전 리포 기준 실패 테스트 7개(logger·error-handler·api/tours·test-utils)는 **main에서도 동일 실패** — 본 리디자인과 무관(환경 이슈).

## §M. 가드레일 — 기능 회귀 방지

1. **수정 금지 파일**: `lib/tour-room/*`(신규 유틸 추가만 허용), `hooks/*`, `app/api/**` — 이 플랜에서 로직 파일은 건드리지 않는다.
2. **testid 계약 보존**: `chat-feed, quick-replies, recording-bar, transcribing-bar, vision-*, sos-*, pickup-*, notice-*, settings-tab, presence-bar, lobby-card, spot-arrival-card, onboard-*, ops-reply-dot` 등 전부 유지. 이동은 허용(시트 안 등), 제거 금지.
3. **동작 계약 보존**: 탭-토글 원문, near-bottom 자동 스크롤, 윈도우 렌더링, 퀵답장 쿨다운, 음성 확인 플로우, SOS 2단 확인, 로케일 재조인 — 렌더 트리가 바뀌어도 동작 동일해야 함.
4. 웨이브 단위 커밋·푸시(브랜치 고정), 커밋 푸터 `Co-Authored-By: Claude <noreply@anthropic.com>`만(모델 식별자 금지).
5. 기능 백로그(읽음표시·타이핑 인디케이터·리액션·이미지 메시지 피드 게시)는 기능 마스터 플랜 §H로 이관 — 이 브랜치에서 구현 금지.

## §N. 완료 기준 (DoD)

- "스크린샷을 카카오톡·텔레그램 옆에 놓았을 때 같은 급으로 보인다" — 구체적으로: 타임스탬프·날짜 구분·아바타·그룹핑·꼬리·FAB·하단 네비·도킹 컴포저가 전부 존재하고, UI 크롬에 이모지 0개, 임의 px 0개(토큰만), AA 대비 전수 통과, 164+ 테스트 green, 5로케일×2테마 깨짐 0건.
