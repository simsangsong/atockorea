# 투어 앱 하이엔드 모션·머티리얼 마스터플랜 (2026-07-22)

**이 문서가 이 트랙의 SoT.** 대상 = 투어 운영 3표면 전부(손님 룸, 기사 콕핏, 가이드 콘솔) + 플래너 + ops 콘솔 정합.
선행: `docs/ui-compact-premium-reupgrade-master-plan-2026-07-19.md`(구조·컴팩트, W1~W4 머지)와 `docs/tour-room-concierge-uiux-v2-master-plan-2026-07-15.md`(팔레트 U3-D3v2). 이 플랜은 그 위의 **모션·질감·조작감** 레이어다.

## §0 사용자 요구 (2026-07-22, 원문 요지)

> 가이드 앱이든 손님 앱이든 무조건 UX가 편하고 직관적이고 조작이 쉬워야 하고, UI는 고급스럽고, 콘텐츠 전환 애니메이션도 고급스럽고, 버튼은 고급 물리버튼 느낌 또는 하이엔드 앱 느낌으로 깔끔+고급. **기능은 전부 유지 또는 업그레이드 — 다운그레이드·생략·축소 절대 불가.**

## §A 진단 (2026-07-22 코드 실측)

| # | 발견 | 위치 | 판정 |
|---|---|---|---|
| A1 | **네이티브 `window.confirm` 5곳** — 아침브리핑·차량문제·출발 인원확인(콕핏), 길잃음·픽업요청(QuickSignalBar), 초대메일(OpsRoomManager). 브라우저 기본 다이얼로그 = 하이엔드와 정반대. **⚠기능 버그 겸함: iOS WebView는 confirm을 조용히 true 반환**(admin `ConfirmSheet.tsx` 주석에 기록된 실사고 패턴) → 출발 안내가 확인 없이 나갈 수 있음 | Cockpit.tsx:641,1292,1306 / QuickSignalBar.tsx:122,127 / OpsRoomManager.tsx:195 | 🔴 최우선 |
| A2 | **탭 전환 애니메이션 0** — RoomShell 탭이 `tab === 'x' && …` 즉시 스왑. 홈↔채팅↔지도↔일정↔설정이 뚝뚝 끊김 | RoomShell.tsx:436-519 | 🔴 |
| A3 | **시트 이중화** — 룸 Sheet는 framer 스프링(잘 됨), **콕핏 로컬 Sheet는 애니메이션 0**(즉시 오버레이) + 포커스 트랩·Escape 없음 | Cockpit.tsx:1960 vs tour-mode/Sheet.tsx | 🔴 |
| A4 | **버튼 물리감 부재** — 콕핏 ActionButton = 플랫 surface-2 + `active:scale-0.97`뿐. 눌림 깊이(그림자 압축·하이라이트)·스프링 복귀·햅틱 없음. 손님측 버튼 대부분 `active:bg` 색 스왑뿐 | Cockpit.tsx:1946, SettingsTab, QuickReplyBar 등 | 🟠 |
| A5 | **모션 어휘 3개뿐** — tr-bubble-in(140ms)·shimmer·concierge-pulse. 공유 이징/스프링/듀레이션 토큰 없음 → 표면마다 임의 값(160ms ease, 스프링 380/34, transition-all 5곳 혼재) | tour-room-theme.css:307-355 | 🟠 |
| A6 | **"프리미엄 머티리얼"이 홈 타일에만 존재** — tr-chip 그라디언트 스쿼클+글로스는 홈 전용. 콕핏·시트·CTA는 무광 플랫 | tour-room-theme.css:273-288 | 🟠 |
| A7 | Toggle 스위치(설정) knob이 transition-all — 스프링 없음. 세그먼트 컨트롤 선택 이동 애니메이션 없음 | SettingsTab.tsx:153-200 | 🟡 |
| A8 | 카드·배너 등장이 일괄 렌더 — NoticeBanner·ArrivalBundleCard 섹션·홈 타일 stagger 없음 | 각 컴포넌트 | 🟡 |
| A9 | 햅틱은 집합 경고(진동)에만 — 버튼 탭 촉각 피드백 없음 (Android vibrate 가능, iOS Safari는 웹 햅틱 불가) | NoticeBanner만 | 🟡 |
| A10 | 잘 된 것(보존 기준점): 룸 Sheet 스프링·reduced-motion 준수, 홈 tr-chip 머티리얼, 플랜 카드 press(0.995)+그림자, 버블 진입, 스켈레톤 | — | ✅ |

## §B 바인딩 결정 M-D1~M-D10

- **M-D1 기능 패리티 절대 게이트.** 모든 슬라이스 PR은 ①터치한 컴포넌트의 기존 테스트 전부 green ②`data-testid` 계약 불변 ③기능 목록 diff 0(버튼·입력·상태·분기 하나도 제거 금지)을 통과해야 머지. 시각·모션만 바뀐다. **"심플하게" = 조작 단계 축소이지 기능 제거가 아니다**(premium=enrichment 원칙).
- **M-D2 팔레트 불변.** U3-D3v2(잉크차콜·딥파인·--tr-danger 레드 유지) 색 값 변경 금지. 고급감은 **깊이(그림자·글로스)·모션·질감**으로만 낸다.
- **M-D3 모션 토큰 단일 어휘.** `--tr-dur-fast 120ms / --tr-dur-base 200ms / --tr-dur-slow 320ms`, `--tr-ease-out cubic-bezier(0.2,0.8,0.2,1)`, 스프링은 framer `{stiffness:380, damping:34}` 하나로 통일(룸 Sheet 기존값). 새 임의 duration/easing·transition-all 금지.
- **M-D4 버튼 물리 스펙("고급 물리버튼").** pressed = `scale(0.97) + translateY(1px) + 그림자 압축 + inset 상단 하이라이트 감쇠`, 복귀는 ease-out 스프링 감. 프라이머리 CTA는 tr-chip 그라디언트+글로스 머티리얼로 승격(홈 칩 문법을 전 표면 CTA로 확장). 클래스 3종: `.tr-btn-physical`(CTA)·`.tr-btn-flat`(보조)·`.tr-btn-quiet`(텍스트) — CSS만으로 구현.
- **M-D5 전환 = transform/opacity만.** 탭 전환: 크로스페이드 120ms + 진입 패널 6px 상승. layout 속성 애니메이션 금지(저사양 60fps 가드). `prefers-reduced-motion` 전면 준수.
- **M-D6 confirm 전면 퇴출.** `window.confirm`/`alert`는 tour-mode·tour-ops에서 0이 목표. 공용 `ConfirmSheet`(기존 Sheet 재사용, 위험 액션은 danger 스타일) — **iOS WebView 자동-true 실버그 해소** 겸함. eslint no-restricted-globals 가드 추가.
- **M-D7 시트 단일화.** 콕핏 로컬 Sheet 삭제 → 공용 tour-mode/Sheet(스프링·포커스·Escape) 채택. 콕핏 다크 토큰은 tr-* 그대로 상속.
- **M-D8 햅틱 = Android progressive enhancement.** `.tr-btn-physical` 탭 시 `navigator.vibrate(8)`(지원 기기 한정, 실패 무시). iOS 웹 햅틱 불가는 한계로 기록 — 과장 금지.
- **M-D9 44px 불가침 유지**(컴팩트 플랜 결정 승계). 모션이 터치 타깃을 줄이면 안 된다.
- **M-D10 진행 보고 한국어, 코드·커밋 영어.**

## §C WBS

| 웨이브 | 내용 | 비고 |
|---|---|---|
| **M0 파운데이션** | 모션 토큰(--tr-dur/--tr-ease) + `.tr-btn-physical/flat/quiet` + `.tr-press` 유틸 CSS, 공용 `ConfirmSheet`(tour-mode), eslint confirm/alert 가드 | theme.css·Sheet 확장 |
| **M1 confirm 퇴출** | 콕핏 3곳(출발 인원·차량문제·아침브리핑)·QuickSignalBar 2곳·OpsRoomManager 1곳 → ConfirmSheet. 출발 confirm은 인원수 큰 숫자 표시로 승격 | **=A1 버그픽스**, 문구·분기 전부 보존 |
| **M2 버튼 물리** | 콕핏 ActionButton·시트 버튼·QuickSignalBar·퀵리플라이 칩·세그먼트(선택 pill 슬라이드)+Toggle(스프링 knob)·플래너 CTA — `.tr-btn-*` 일괄 적용 + Android 햅틱 | 시각만, testid 불변 |
| **M3 전환** | RoomShell 탭 크로스페이드+상승, 콕핏 Sheet→공용 Sheet 통합, 시트 내부 섹션 60ms stagger, 홈 타일 진입 stagger | reduced-motion 분기 |
| **M4 피드·배너 모션** | NoticeBanner 등장/quiet→countdown 캡슐 전환, ArrivalBundleCard 섹션 순차 진입, 비디오 카드 포스터→플레이어 페이드, 토스트(say) 스프링 | 카운트다운 사다리 로직 무변경 |
| **M5 정합 스윕** | 가이드 콘솔(GuidePlanPanel·GuideLedgerPanel)·플래너·ops 콘솔에 M1~M4 문법 적용, 라이트/다크 × 5로케일 시각 QA | 파편화 0 |
| **M6 QA 게이트** | ①기능 패리티 체크리스트(M-D1) ②Playwright 시뮬 스크린샷(라이트/다크×주요 표면) ③60fps 프로파일 ④실기기(사람) | 전 스위트 green·tsc 0 |

권장 실행: **M0+M1 한 PR**(버그픽스 동반, 최우선) → M2 → M3 → M4 → M5 → M6.

## §D 사람 게이트

1. M1 후 실기기(iOS Safari/WebView)에서 출발 confirm 정상 동작 확인 — A1 버그 실증
2. M6 실기기 모션 QA(60fps 체감·햅틱)
3. 스타일 픽: 프라이머리 CTA 머티리얼(그라디언트+글로스) 적용 범위 — 시안 스크린샷 제시 후 결정

## §F 플랜 셀프리뷰 (2026-07-22 밤, 실행 전 결함 4건 → 계획 수정)

1. **탭 크로스페이드의 이중 마운트 함정** — AnimatePresence exit+enter 동시 마운트는 채팅 스크롤 상태·지도 재초기화를 건드림 → **진입 애니메이션만**(패널은 전환 시 마운트되므로 mount 애니메이션 = 전환, CSS `tr-anim-panel-in`)으로 확정. framer 신규 사용 없음.
2. **ConfirmSheet는 Promise 기반 필수** — QuickSignalBar의 "확인→위치수집→전송" 비동기 체인 때문. `useConfirmSheet().confirm/prompt` 훅으로 구현(**prompt 대체까지** — 진단 A1에 빠져 있던 `window.prompt`(드랍 변경) 1곳 추가 발견).
3. **eslint 가드 스코프** — 전역 금지는 어드민·스크립트 파손 → `components/tour-mode/**`·`components/tour-ops/**` 한정 오버라이드.
4. **M6 정직성** — 밤샘 자율 구간의 QA는 jest+tsc+패리티 게이트까지. 픽셀·60fps·실기기는 아침 사람 게이트로 명시 이관.
5. CTA 그라디언트 머티리얼 전면 적용은 §D-3 스타일 픽 대기 → 야간에는 **기존 색 유지 + 눌림 물리 `.tr-btn-raised`**(배경 보존형)로 적용, 풀 머티리얼은 ConfirmSheet 확인 버튼에만 선적용(아침 시안 역할).

## §E 착수 로그

- 2026-07-22: 진단(§A 실측 10건)·플랜 확정 → §F 셀프리뷰로 4건 수정.
- **M0~M4 + M5 부분 구현(같은 날 밤):** ①모션 토큰+`.tr-btn-physical/raised/flat/quiet/press`+`tr-anim-panel-in`+`tr-stagger`+`tr-knob`(reduced-motion 전면 대응) ②`useConfirmSheet`(confirm+prompt, framer 스프링 시트, 물리 버튼) ③confirm/prompt 6곳 전부 교체(콕핏 출발 인원=큰 숫자 표시 승격·차량문제 danger·아침브리핑 / QuickSignalBar 길잃음·픽업·드랍 prompt 5로케일 라벨 / OpsRoomManager 초대) + eslint 가드 ④버튼 물리: 콕핏 ActionButton·CTA 6종(raised)·설정 토글(스프링 knob)+세그먼트+언어그리드·시그널 칩·퀵리플라이 칩·Composer 전송·탭바 ⑤전환: 탭 패널 5종 진입 애니·콕핏 시트 스프링 승격(+그랩핸들·그림자)·도착 시트/설정/홈 그리드/번들 카드 stagger ⑥NoticeBanner 등장+카운트다운 캡슐 등장·비디오 카드 재생 전환·콕핏 토스트 등장. **잔여: M5 나머지(가이드 콘솔 패널·플래너 CTA 일부)·§D 사람 게이트 3건.**
