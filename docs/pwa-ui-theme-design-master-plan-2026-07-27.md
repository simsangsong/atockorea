# 스마트앱 PWA 진입점 + 파스텔 스킨 확장 + 테마 풍경(SVG) — 마스터 플랜 (2026-07-27)

**SoT = 이 문서.** 사용자 지시(2026-07-27, 전권 위임·무질문 완주):
① 고객용 PWA 설치 버튼을 앱 여기저기에 + 설정탭 "퀵 메시지 모음"은 존재 의미가 없으니 제거
② 미팅시간 설정의 숫자가 "커도 너무 큼" → 축소
③ 각 테마 배경에 SVG 무늬 — 둥근 산봉우리+흰 구름 / 제주(돌하르방·해녀 큐티) / 서울(남산타워·한강대교·경복궁) / 부산(해운대·용궁사·스카이캡슐) 등 실제 포인트를 캐리커처로. 어떻게/어디에/배치까지 설계
④ 테마 색 확장 — 앰비언트·파스텔 계열
⑤ 테마별 SVG 요소 배치 설계
⑥ 버튼/헤더/바텀바 UI 완성도 재리뷰 + polish
프로세스: 플랜 → 플랜 재리뷰 → 실행 → 점검 → 코드 리뷰 → 기능 테스트 → 실기기급 시각 리뷰(Playwright walk).

선행 SoT 계승: `docs/smartapp-chat-ui-theme-master-plan-2026-07-27.md`(스킨 6종·`--tr-chrome`·C-D10 불가침), `docs/smartapp-ui-premium-upgrade-master-plan-2026-07-26.md`(딥 파인 시그니처).

---

## §A 진단 (코드 실측)

- **A-1 퀵 메시지 모음** = `SettingsTab.tsx` 마지막 섹션(L420-432): `quickRepliesForRole` 프리셋을 **읽기 전용 칩으로 나열만** 하는 A6 리마인더 카드. 탭해도 아무 일도 없다. 실제 퀵리플라이는 Composer(+트레이)에 살아 있으므로 설정의 카드는 순수 장식 — 사용자 판단("의미가 뭐지") 그대로 제거 가능. `lib/tour-room/quickReplies.ts`와 Composer 사용처는 무접촉.
- **A-2 PWA 설치 현황**: `InstallBanner`(TourRoomClient, D-1~투어일+부킹당 1회+해제 시 영구 숨김)가 유일한 고객 진입점. 배너를 놓치면(당일 아님/한 번 해제) **설치 경로가 0**. `beforeinstallprompt`는 페이지 초기에 1회 발화 → 늦게 마운트되는 컴포넌트는 놓친다 → **모듈 레벨 캡처 훅** 필요. iOS Safari는 프로그램 설치 불가 → 공유→홈 화면 안내 문법(배너에 이미 존재).
- **A-3 미팅시간 큰 숫자** = 콕핏 도착 시트 "집합 시간"·복귀 시트의 `TimeWheel`: 두 컬럼이 **각각 flex-1(시트 절반 폭)** × 44px 행 × **5행 노출 = 220px** — 18~20px 볼드 숫자 10개가 벽처럼 선다. 지연/복귀 ±N분 칩의 큰 숫자는 "이해하는데" 범주(주행 글랜스용)로 유지.
- **A-4 스킨 시스템**: `TOUR_SKINS` 6종(classic/sky/winter/forest/meadow/contrast), CSS는 `.tr-root[data-tr-skin=X]` 라이트+다크 블록, sanitize 화이트리스트라 값 추가만으로 하위호환. 66쌍 대비검증은 **일회성이었고 테스트로 영구화 안 됨** — 이번에 스킨 수가 10으로 늘므로 수치 게이트를 테스트로 상설화한다.
- **A-5 풍경을 그릴 자리**: RoomShell 탭 영역 래퍼(L557 `relative flex min-h-0 flex-1`)와 StaffShell 판넬 래퍼(L174)가 이미 `relative` — absolute 바닥 레이어를 꽂을 지점이 있다. 단 콘텐츠 래퍼가 static이라 **positioned 풍경이 위에 칠해진다** → 콘텐츠 래퍼에 `relative z-[1]` 필요(칠 순서 역전 방지). 콕핏은 `data-tr-skin` 스탬프가 없다(주행 다크 고정) → 풍경 대상 아님.
- **A-6 폴리시 실측 결함**: ① SettingsTab Toggle knob이 `bg-white` 하드코딩 — **고대비 다크에서 트랙(accent=흰색) 위 흰 knob = 소실**. ② SettingsTab SegmentedControl `min-h-[36px]` — 44px 규율 미달(StaffSettings 동종 컨트롤은 44). ③ RoomDrawer close 버튼 `w-9` — 헤더 버튼 40px 규격과 불일치.

## §B 바인딩 결정 (T-D1 ~ T-D8)

**T-D1 퀵 메시지 카드 제거.** SettingsTab 마지막 섹션 + `quickRepliesForRole` import + `viewerRole` prop 소비부 제거(호출부는 prop 잔존해도 무해하나 정리). 그 자리는 T-D2의 [앱 설치] 카드가 아니라 — 설치 카드는 **상단권**(iOS 서랍 타일이 설정 탭으로 보내는 착지 지점)에 둔다. 설정탭 끝은 깔끔하게 비운다.

**T-D2 설치 진입점 4곳(고객) + 1곳(스태프).**
- `hooks/useInstallPrompt.ts` 신설: 모듈 레벨 `beforeinstallprompt` 캡처(+`appinstalled` 시 소거), `useSyncExternalStore` 구독. 파생 상태 `'unavailable' | 'native' | 'ios'` — standalone·인앱웹뷰·(iOS Safari 아님 && 이벤트 없음)이면 unavailable. `promptInstall()`은 1회 소모 후 unavailable 전이. UA 판별 함수는 훅 파일에서 export(배너의 동일 로직은 무접촉 — 검증된 코드).
- `components/tour-mode/InstallCard.tsx` 신설(5로케일): 아이콘 + "홈 화면에 추가" + 부제. native → [설치] 버튼(원탭). ios → 인라인 2단계 안내(공유 아이콘 → "홈 화면에 추가"). unavailable → null(자기 은닉). `surface` prop으로 room 카드/home 타일 문법 전환.
- 배치: ① SettingsTab 상단권(AppManual·동행초대 아래, 화면 모드 위) ② RoomDrawer 바로가기 타일 — native면 즉시 프롬프트, ios면 설정 탭 이동(카드가 상단이라 스크롤 불필요) ③ HomeTab 하단 행(more 행 위) ④ 기존 InstallBanner 유지(윈도우·1회 규율 그대로) ⑤ StaffSettings(ko)에도 카드 — 가이드·기사가 매일 쓰는 당사자.
- 전부 unavailable이면 **아무 표면에도 아무것도 안 그린다**(이미 설치/웹뷰/데스크톱 크롬 무이벤트).

**T-D3 TimeWheel 컴팩트.** VISIBLE 5→3(220→132px), 휠 폭 `max-w-[248px] mx-auto`(전폭 → 다이얼 폭), 미선택 행 `tr-body-lg semibold` → `tr-body font-medium`(벽 효과 제거), 선택 행 `tr-display` 유지(주행 글랜스), **ITEM_H 44 불변**(터치 불가침). 지연/복귀 칩 무접촉.

**T-D4 파스텔 스킨 4종 추가** — `TourSkin += 'jeju' | 'seoul' | 'busan' | 'blossom'` (총 10종).

| 스킨 | 무드 | L canvas | L bubble-me/accent | D canvas | D accent |
|---|---|---|---|---|---|
| jeju 제주 | 감귤 크림·현무암·봄바다 | #f7ead8 | #8a5a2a권(딥 귤갈색) | #1a1510 | 살구 파스텔 |
| seoul 서울 | 새벽 라벤더·한강 안개 | #e7e6f2 | #55519e권(딥 페리윙클) | #14131c | 라벤더 |
| busan 부산 | 노을 피치·딥 마린 | #fae4da | #21607a권(딥 마린) | #171213 | 피치/마린 |
| blossom 벚꽃 | 벚꽃 파스텔·딥 로즈 | #f8e7ed | #a34d6d권(딥 로즈) | #1a1316 | 로즈 |

- 정확 수치는 §D 대비 게이트(T-D7)를 **통과하도록** 구현 중 확정. 불변식: danger/danger-soft 무접촉, accent↔bubble-me-ink 페어 ≥4.5, ink-3↔canvas ≥4.5, chip-grad-accent도 스킨 색으로 동행.
- SkinPicker: SWATCH·SKIN_NAME 4종 추가(ko 제주/서울/부산/벚꽃, en Jeju/Seoul/Busan/Blossom, ja 済州/ソウル/釜山/さくら, es Jeju/Seúl/Busan/Cerezo, zh 济州/首尔/釜山/樱花). 3열 그리드 유지(10칸=4행). 스와치에 풍경 힌트(하단 언덕 아크 1개) 추가 — 풍경 있는 스킨만.

**T-D5 테마 풍경(SkinScenery) — 어떻게/어디에/배치.**
- **어떻게**: `components/tour-mode/scenery/SkinScenery.tsx` 단일 파일 — 스킨별 순수 inline SVG 씬(외부 요청 0, 노드 <40/씬). viewBox **720×200**, `preserveAspectRatio="xMidYMax slice"` — 모바일(390px)에서는 중앙 ±195px만 보이므로 **핵심 모티프는 중앙 존, 좌우는 언덕/파도 연장**으로 채운다. 캐리커처 문법: 둥근·통통한 실루엣, 디테일은 점·아크 최소, 얼굴은 돌하르방·해녀만 점눈+미소 아크.
- **어디에**: RoomShell·StaffShell 콘텐츠 영역의 **absolute 바닥 밴드**(bottom-0, `mx-auto w-full max-w-2xl` — 콘텐츠 컬럼과 정렬되어 광폭 화면에서 slice 확대·크롭이 발생하지 않음, 높이 200px·pointer-events-none·aria-hidden·select-none). 채팅 버블/카드가 **풍경 위로 스크롤**(카톡 월페이퍼 문법). 콘텐츠 래퍼 `relative z-[1]`, 배너 z-20 유지. 콕핏·플랜 에디터·조인/체크인 = 무풍경(스탬프 없음). **contrast 스킨 = 무풍경**(접근성 스킨에 장식은 역행).
- **색 규율(밴드/액센트 이원)**: 씬 팔레트를 `bands`(언덕·파도·지붕 등 대면적 fill)와 `accents`(구름·눈꽃·귤·캡슐 등 소형 모티프)로 나눈다. **bands는 ink-3 vs fill ≥ 4.5:1을 T-D7 테스트로 강제**(타임스탬프가 대면적 위에 앉아도 AA). accents는 소형·부분 겹침이라 수치 게이트 제외하되 저채도 파스텔로 절제(카톡 월페이퍼 전례). 다크 모드는 **밤 풍경 문법**: bands는 캔버스보다 어둡거나 동일 휘도(=ink-3 대비를 깎지 않음), 밝은 액센트(달·별·눈)는 소형만.
- **씬별 구성(9씬)** — (좌 | 중 | 우), 높이는 밴드 내 비율:

| 스킨 | 씬 | 배치 |
|---|---|---|
| classic | 둥근 산봉우리 + 흰 구름 | 낮은 산줄기(전폭 2겹) \| 중앙 큰 봉우리+구름 2 \| 낮은 봉우리 |
| sky | 뭉게구름 하늘 | 작은 구름 \| 큰 뭉게구름+새 v 2 \| 중간 구름 |
| winter | 설산 | 눈 덮인 봉(흰 캡) 2겹 \| 중앙 최고봉+구름 \| 눈송이 점 산개 |
| forest | 숲 능선 | 둥근 수관 군락 2겹 전폭 \| 중앙 큰 나무 \| 안개 밴드 |
| meadow | 구릉 들녘 | 구릉 2겹 전폭 \| 중앙 언덕+구름 \| 꽃 점 3-4 |
| jeju | 한라산·돌하르방·해녀 | 물결 밴드+테왁·해녀 \| 한라산(완만)+구름, 그 앞 돌하르방 2기(점눈·미소) \| 귤 2알 가지 |
| seoul | 남산·경복궁·한강대교 | 경복궁 지붕 실루엣 \| 남산 언덕+타워(전망대 볼) \| 한강대교 아치+주탑, 상공 구름 |
| busan | 해운대·용궁사·스카이캡슐 | 용궁사 다층탑(바위 위) \| 파도+해변 곡선, 상공 갈매기 v \| 고가 레일 위 스카이캡슐 1량 |
| blossom | 벚꽃 | 좌상단 벚가지 드리움 \| 흩날리는 꽃잎 점 \| 낮은 언덕 |

**T-D6 폴리시 패스(버튼/헤더/바텀바).** ① Toggle knob: checked=`bg-[var(--tr-bubble-me-ink)]`(페어링 불변식이 전 스킨 대비 보장) / unchecked=`bg-[var(--tr-surface)] border border-[var(--tr-hairline)]` — 고대비 다크 소실 해소 ② SettingsTab SegmentedControl 36→44px ③ RoomDrawer close w-9→w-10(헤더 규격 통일) ④ walk 시각 리뷰에서 발견되는 追加 항목은 §E 로그에 기록 후 즉시 수정.

**T-D7 대비 수치 게이트 상설화.** `__tests__/components/tour-mode/skinContrast.test.ts` 신설: tour-room-theme.css를 파싱해 스킨×(라이트/다크) 토큰 머지 후 — ink/canvas·ink/surface·ink-2/surface·ink-3/canvas·bubble-me-ink/bubble-me·bubble-in-ink/bubble-in·bubble-me-ink/accent·accent-deep/canvas·ink/home-tile ≥4.5, safe/surface ≥3.0. + SkinScenery가 export하는 씬 팔레트 **bands** vs ink-3 ≥4.5(라이트/다크 각각). + TOUR_SKINS ↔ CSS 블록 ↔ SWATCH ↔ SKIN_NAME ↔ 씬 매핑 동기 검증(스킨 추가 시 누락 원천 차단).

**T-D8 불가침.** SOS 레드 전 스킨 불변 · 44px 터치 · CJK `text-cjk-safe/body` · 타이포는 tr-* 스케일만 · lucide 배럴만 · ActionGrid 트레이 무접촉 · pruneTarget 무접촉 · 빌드는 `npm run build`만 · 기존 로케일 키 삭제 금지 · 콕핏 다크 고정 유지.

## §C WBS

- **P1 설치 인프라**: useInstallPrompt + InstallCard + SettingsTab(퀵메시지 제거·설치 카드 상단) + RoomDrawer 타일 + HomeTab 행 + StaffSettings + 테스트(설정/서랍/훅)
- **P2 TimeWheel 컴팩트** + cockpit 테스트 확인
- **P3 스킨 4종**: CSS 라이트+다크 블록 + TOUR_SKINS + SkinPicker(스와치·라벨·풍경 힌트)
- **P4 SkinScenery 9씬** + RoomShell/StaffShell 배선(z-레이어)
- **P5 skinContrast 테스트 신설** + 기존 테스트 갱신(skinPicker·settings·roomDrawer·themeToggle 영향 확인)
- **P6 폴리시**(T-D6 ①②③ + walk 발견분)
- **P7 게이트**: `npx tsc --noEmit` 0 → 투어모드 jest green → `npm run build` → dev:3161+sim-tour-day → walk(신규 스킨×채팅/홈 + 설치 카드/타일 + 컴팩트 휠 샷 추가) 콘솔 에러 0 → **스크린샷 육안 적대 리뷰 → 수정 라운드** → 커밋/PR/머지 → 한국어 보고

## §D 리스크 레지스터

| # | 리스크 | 완화 |
|---|---|---|
| R1 | 풍경이 positioned라 콘텐츠 위에 칠해짐 | 콘텐츠 래퍼 `relative z-[1]` 명시, walk 샷으로 육안 확인 |
| R2 | 풍경 fill 위 타임스탬프(ink-3) 대비 붕괴 | T-D7 수치 게이트(전 fill ≥4.5) — 테스트가 리그레션 차단 |
| R3 | 신규 스킨 accent가 60+ CTA 짝(bubble-me-ink)과 어긋남 | T-D7 페어 검증 + 스킨은 항상 세트로 정의 |
| R4 | beforeinstallprompt를 놓친 늦은 마운트 | 모듈 레벨 캡처(임포트 시점 등록) + appinstalled 소거 |
| R5 | jsdom에서 설치 UI가 전부 unavailable → 테스트 공백 | 훅 모킹 + UA 주입 유닛(iOS 판별) 이중 커버 |
| R6 | TimeWheel 축소가 cockpit.test 기대와 충돌 | 사전 실행으로 확인, testId·계약(HH:MM) 불변 |
| R7 | 스와치 하드코딩과 CSS 괴리 | T-D7 동기 검증(키 셋 일치) |
| R8 | walk 스킨 루프가 6종 가정 | 신규 스킨 포함하도록 스크립트 갱신(P7) |
| R9 | headless에는 beforeinstallprompt가 없어 설치 UI 촬영 불가 | walk에서 합성 이벤트 디스패치(prompt 스텁) 후 촬영 — 훅은 모듈 리스너라 수신 |
| R10 | 채팅 피드 래퍼가 불투명 bg면 풍경이 가려짐 | P4에서 피드 계열 bg 실측, 불투명이면 투명화(캔버스는 tr-root가 소유) |

## §E 실행 로그 (2026-07-27)
- [x] P1 설치 인프라 — `hooks/useInstallPrompt.ts`(모듈 레벨 캡처+appinstalled 소거+테스트 시임) · `InstallCard`(5로케일, room/home/staff 3문법, 자기 은닉) · SettingsTab 상단 배치+**퀵 메시지 카드 제거**(Composer의 라이브 퀵리플라이 무접촉) · RoomDrawer [앱 설치] 타일(native=즉시 프롬프트, iOS=설정 탭 랜딩) · HomeTab 행 · StaffSettings 카드 · installEntry/roomDrawer 테스트
- [x] P2 TimeWheel 컴팩트 — VISIBLE 5→3(220→132px), max-w-[248px] 다이얼, 미선택 tr-body medium, 선택 밴드가 다이얼 폭에 정합, ITEM_H 44 불변 — walk 19컷으로 실렌더 확인
- [x] P3 스킨 4종 — jeju/seoul/busan/blossom 라이트+다크 CSS, TOUR_SKINS 10종(contrast 마지막), SkinPicker 스와치+풍경 힌트 아크+5로케일. **부수 발견·수정: sky 다크 캐스케이드 갭**(스킨 라이트 블록(0,2,0 후순위)이 베이스 다크와 동률이라 다크-스카이가 라이트 safe/accent-soft를 상속 — safe 대비 2.47:1이던 라이브 버그, 다크 블록에 재선언)
- [x] P4 SkinScenery 9씬 — viewBox 720×**300**(1차 200은 채팅 하단 스택에 전부 가려짐 → 워크 실측 후 상향), 시그니처는 **상단 75px 스트립**(칩 위로 보이는 존)+모바일 가시존 x∈[165,555] 재배치(용궁사·스카이캡슐·돌하르방 크롭 수정), 다크=밤 실루엣(캔버스보다 반 단계 밝게 — 순수 어둡게는 실화면에서 소실), 한라산 순상화산 오목 사면 2차 보정, RoomShell/StaffShell z-레이어 배선
- [x] P5 skinContrast.test.ts — CSS 실파싱 캐스케이드 재현(파일 순서=명시도 동률 해석 포함) × 10스킨 × 2테마 × 10쌍 + scenery bands ≥3.5 + 씬/스킨 동기 + danger 불변 가드. 기존 skinPicker/settings/roomDrawer 테스트 갱신
- [x] P6 폴리시 — Toggle knob 상태 이원(checked=bubble-me-ink 페어링 불변식 활용 — 고대비 다크 white-on-white 소실 해소) · SegmentedControl 44px · 서랍 close w-10
- [x] P7 게이트 — tsc 0 · 투어모드 111스위트 1011 green · `npm run build` 통과 · Playwright walk 29컷 **WALK OK·콘솔 에러 0**(스킨 9종 채팅 + 홈 풍경 2 + 밤 씬 + 설치 UI 합성 이벤트 + 콕핏 휠) · 스크린샷 적대 리뷰 3라운드(200px 가림→300 상향 / 가시존 크롭 / 타워·레일·한라산 조형) 후 재검증
- ⚠ 기록: 이 워크트리의 webpack dev는 **파일 변경을 못 본다**(정션 node_modules + 워크트리 경로 감시 실패 추정) — 컴포넌트 수정 후에는 dev 서버 재시작이 필수. 시드는 공유 라이브 DB라 타 세션 --cleanup에 지워질 수 있음(재시드 즉시 walk).
- [x] **P8 모티프 레퍼런스 라운드** (사용자 실물 레퍼런스 2장+제주 벡터 링크, 2026-07-27 후속): ① 스카이캡슐 = 실물 문법(노란 차체+흰 지붕캡/스커트+짙은 통유리 3분할+원형 뱃지+빔 위 보기·상부 주행 튜브) ② **부산 씬에 광안대교 신설**(H형 주탑 2기 해중 교각+주케이블 스웁+행어 13+데크 우측 프레임아웃 — 업로드 일러스트 문법) ③ 돌하르방 = 왕방울 눈(글린트)+벙거지 챙+뭉툭 코 셰이딩+손 위아래 스태거+현무암 기공 4점 ④ 해녀 = 후드+얼굴+원형 물안경/스트랩+테왁 그물+오리발 킥+물보라 ⑤ 한강대교 = 타이드아치를 데크 **위**로(행어 12+교각 5). 팔레트 키 추가: jeju.skin, busan.bridge/capsuleTrim(+capsuleWin 라이트=짙은 유리/다크=불 켜진 창). 게이트 재통과(대비 5/1011 jest/tsc/build/walk9 콘솔 0).
