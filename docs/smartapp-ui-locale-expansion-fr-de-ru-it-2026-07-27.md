# 스마트앱 UI 로케일 확장 fr·de·ru·it — 마스터 플랜 (2026-07-27)

**SoT = 이 문서.** 사용자 지시: 스마트앱(투어룸) UI 언어를 프랑스어·독일어·러시아어·이탈리아어로 확장. **원어민 톤**, 기존과 **충돌 없이 로케일 추가만**, 플랜→재리뷰→실행→**번역 감수**→최종 리뷰→머지 원큐.

선행 관계: 마케팅 사이트 UI는 이미 10로케일(PR #457, `messages/*.json`) — **별개 시스템, 무접촉**. 이번 대상은 투어룸 스마트앱의 `RoomLocale` 체계(en/ko/zh/ja/es 5종 → 9종).

---

## §A 진단 (코드 실측)

- **A-1 정본**: `lib/tour-room/snapshot.ts` — `ROOM_LOCALES = ['en','ko','zh','ja','es']` + `RoomLocale` 유니언 + `normalizeRoomLocale`(BCP47 프리픽스 → 룸 로케일). §D A4.1 규율로 **로케일 목록 사본 금지**가 이미 강제되어 있어, 정본 1곳 확장 → `Record<RoomLocale,…>` 전부가 tsc 비완전성 오류로 드러난다. **tsc가 곧 완전성 게이트.**
- **A-2 규모**: `Record<RoomLocale` 120건 / 코드 52파일 — components/tour-mode 23, lib/tour-room 20, lib/ops(seating 카드셋·dining) 9. 추정 원문 ~1,000줄 × 4언어 ≈ 4,000 신규 문자열. 별도로 `locale === 'ko' ? … :` 5분기 조건 체인(RoomDrawer 세션만료 등)이 소수 존재 — 실행 중 grep으로 전수 수거.
- **A-3 비용 결합(핵심 리스크)**: LLM 번역 팬아웃은 두 갈래.
  ① `getRoomTranslationTargets` = **참여자 locale+chat_locale 기반 동적**(스냅샷 실측) → UI 로케일 확장으로 비용이 **자동 증가하지 않음**. fr 손님이 실제 입장했을 때만 fr 타깃 합류(사용량 비례 — 이상적).
  ② 정적 `[...ROOM_LOCALES]` 리스트 6개 라우트(messages·retranslate·broadcast·spot-events의 DEFAULT_TARGET_LOCALES, signals L202, arrival-bundle L87/L385) — 여기만 5→9로 새면 해당 경로 LLM 비용 +80%. **동결 상수로 차단해야 한다.**
- **A-4 파생 인프라**: 로케일→BCP47(Intl 날짜, `timeFormat.ts`) · TTS lang(`tts.ts`) · 진입 감지(`entryCopy.ts`는 ROOM_LOCALES 파생이라 자동) · SettingsTab 언어 그리드(grid-cols-3: 5→9 = 3×3 정합) · 이메일 초대(`lib/email-templates/tour-room.ts`) · 푸시 본문(`guestPush`).
- **A-5 테스트 결합**: `Object.keys(translations) == ROOM_LOCALES`를 단언하는 스위트(spotContentWatcher·concierge·approach·driverBridge·briefingCards·quickReplies)는 전부 **정적 템플릿 빌더** 기반 → 정본 확장+번역 추가 시 9종으로 자동 통과. briefingCards는 로케일별 본문 **유일성**까지 단언(L82) — 복붙 번역 원천 차단 장치로 그대로 활용.
- **A-6 무접촉 영역**: `CHAT_LANGUAGES`(채팅 언어 무제한 브릿지 — fr/de/ru/it 이미 지원) · match_pois 콘텐츠 로케일 · 투어상품 로케일 라우팅 · 가이드/기사 콘솔(ko 전용, P-D10) · 관제.

## §B 바인딩 결정 (L-D1 ~ L-D8)

**L-D1 이원 구조(마케팅 전례 계승).** `ROOM_LOCALES` = 9종(UI·정적 카피·참여자 로케일·푸시·이메일·감지). 신규 **`CORE_TRANSLATION_LOCALES` = 기존 5종 동결** — A-3②의 정적 리스트 6곳만 이 상수로 치환(오늘과 바이트 단위 동일 동작). 동적 타깃(①)은 무접촉 → fr 손님 입장 시 채팅·공지 번역은 자동으로 fr 포함. LLM 캡슐(도착 번들 등)의 fr 정적 포함은 후속 레버(라우트당 1줄)로 문서화만.

**L-D2 언어 레지스터(원어민 톤의 뼈대).**
| | 존칭 | 근거 |
|---|---|---|
| fr | **vous** | 서비스 표준. 관광 고객층(크루즈·프라이빗) 격식 기대 |
| de | **Sie** | 여행 서비스 관례(Booking·기성 고객층). du는 위험 비대칭 |
| ru | **вы** (소문자) | 서비스 표준. «Вы» 대문자는 서신체 — 앱 UI는 소문자 |
| it | **tu** | 이탈리아 앱 관례(은행·항공도 tu) — Lei는 앱에서 구식 |

**L-D3 용어 글로서리(전 파일 일관).** guide=Guide/Guide/гид/guida · driver=chauffeur/Fahrer/водитель/autista · meeting point=point de rendez-vous/Treffpunkt/место сбора/punto di ritrovo · meeting time=heure de rendez-vous/Treffzeit/время сбора/orario di ritrovo · pickup=prise en charge/Abholung/трансфер(서비스)·место посадки(지점)/pick-up · Smart Guide=Guide intelligent/Smart Guide/Умный гид/Guida smart · emergency=Urgence/Notfall/SOS·экстренный вызов/Emergenza · 홈화면 추가=OS 표준 문구(Apple/Google 로컬라이즈 문구 준용: "Ajouter à l'écran d'accueil"/"Zum Home-Bildschirm hinzufügen"/«На экран "Домой"» 계열/"Aggiungi alla schermata Home") · tab labels: Accueil·Chat·Carte·Aujourd'hui·Réglages / Start·Chat·Karte·Heute·Einstellungen / Главная·Чат·Карта·Сегодня·Настройки / Home·Chat·Mappa·Oggi·Impostazioni.

**L-D4 표기 규율.** 독일어 명사 대문자 엄수·합성어 남발 금지(탭·칩은 짧은 실무어). 프랑스어 élision( l'/d'/qu' ) + 곡선 아포스트로피(’, 코드베이스 관례와 동일); !·? 앞 공백은 **일반 공백 생략형**(모바일 UI 관례, 불가시 문자 리스크 회피 — 의도된 실용 결정). 러시아어 ё 미사용(е 표준)·명령형은 -йте 존댓형. 이탈리아어 아포스트로피(un'ora)·악센트(è/più) 엄수. **이모지·플레이스홀더({name}, {n}분 등)·마크업은 원문 보존.**

**L-D5 추가 방식.** 기존 en/ko/ja/es/zh 값 **한 글자도 불변**(additive-only). 새 키 순서는 각 Record에서 기존 키들 뒤에 `fr, de, ru, it` 고정 순서로. `LOCALE_NAME` 네이티브 표기: Français·Deutsch·Русский·Italiano. SettingsTab 언어 버튼에 `data-testid="app-locale-${code}"` 부여(walk 안정성, 시각 검증용 소규모 추가 허용).

**L-D6 파생 인프라 매핑.** timeFormat BCP47: fr→fr-FR, de→de-DE, ru→ru-RU, it→it-IT · tts lang 동일 · normalize/감지는 정본 파생이라 자동 · CJK 행간 규칙(ja/zh/ko)은 유럽어 무관(무접촉).

**L-D7 실행 분업.** 톤 민감 코어 표면(셸·설정·홈·서랍·컴포저·채팅·긴급·컨시어지·퀵리플라이·시그널·설치·플랜 에디터·엔트리 등 components/tour-mode 전부)은 **직접 작성**. lib 벌크(arrivalBundle·appManual·weather·seating 카드셋·dining 등)는 **병렬 서브에이전트 3기**에 글로서리+레지스터+diff 규율(포맷 무변경·기존 키 무접촉·명령 실행 금지·최종 보고는 직접 반환)을 브리핑해 위임 → 내가 diff 전수 검토.

**L-D8 감수(사용자 요구 명시 단계).** 코드 완성 후 **언어별 원어민 감수 에이전트 4기 병렬**: 각자 git diff에서 자기 언어 신규 문자열 전량을 en/ko 원문 대조로 검토 — 레지스터 일관(vous/Sie/вы/tu 혼입 0)·글로서리 준수·자연스러움·UI 길이(탭/칩 과장어 금지)·표기 규율 — 파일:라인 단위 수정안을 반환, 내가 선별 적용. 이후 tsc·jest·build·walk(fr/de 스크린샷 — 탭바 라벨 잘림 육안 확인, 특히 "Einstellungen"/"Impostazioni") 최종 게이트.

## §C WBS

- **L0 인프라**: ROOM_LOCALES 9종 + CORE_TRANSLATION_LOCALES 동결 + 6개 라우트 상수 치환 + timeFormat/tts/LOCALE_NAME/SettingsTab testid → tsc 오류 목록 = 작업 목록 확정
- **L1 코어 표면 직접 번역** (components/tour-mode 23파일 + 조건 체인)
- **L2 lib 벌크 위임** (서브에이전트 3: ① lib/tour-room A~m ② lib/tour-room n~z ③ lib/ops seating+dining) → diff 전수 검토
- **L3 감수**: 4언어 병렬 리뷰 → 수정 반영
- **L4 게이트**: tsc 0 · 투어모드+ops jest green · `npm run build` · walk + fr/de 설정 전환 샷 육안
- **L5 커밋/PR/머지/한국어 보고**

## §D 리스크

| # | 리스크 | 완화 |
|---|---|---|
| R1 | 정적 팬아웃 리스트로 LLM 비용 +80% 누수 | L-D1 동결 상수 — L0에서 최우선 치환, 라우트별 diff로 확인 |
| R2 | Record 누락 | tsc가 전수 강제(비완전 Record=컴파일 에러) |
| R3 | 서브에이전트가 기존 로케일 값 변형/재포맷 | 브리핑에 additive-only 명시 + git diff에서 기존 줄 변경 0 검증(`git diff -U0`로 -줄이 카피 파일에 없어야 함) |
| R4 | 독일어/이탈리아어 장어로 탭·칩 깨짐 | L-D3 짧은 라벨 고정 + walk 실렌더 육안 |
| R5 | 레지스터 혼입(du/tu/ты 섞임) | L-D8 감수 에이전트의 1순위 체크 항목 |
| R6 | briefingCards 유일성 단언 실패(동일 번역 복붙) | 감수 전 jest 선행으로 즉발 |
| R7 | 5분기 조건 체인 미수거 | `locale === '` 전역 grep 전수 |

## §E 실행 로그
- [x] L0 — ROOM_LOCALES 9종 + `CORE_TRANSLATION_LOCALES` 동결 + LLM 팬아웃 6라우트 치환(잔여 `[...ROOM_LOCALES]` 스프레드 0 — arrival-bundle L385 verbatim 맵은 의도적으로 9키 유지=fr 손님에게 집합장소 원문 그대로) + LOCALE_TAG/TTS_LANG/TODAY_LABEL + SettingsTab `app-locale-*` testid + walk fr/de 스텝
- [x] L1 — 코어 표면 직접 번역 완료: RoomShell(7맵)·SettingsTab·RoomDrawer(+세션만료 체인)·HomeTab·InstallCard/Banner·entryCopy·Composer(6맵)·ChatFeed(8맵)·QuickSignalBar·SosButton·ConciergeInlineAnswer·PickupBoard(2)·PresenceBar·SpotArrivalCard·LobbyCard·NoticeBanner·PlanNudgeModal·TourRoomClient(3)·EndedCard(3)·PlanStopCards(콘텐츠 6로케일 드로어 → `drawerContentLocale` 협착, fr/de/ru/it=en 콘텐츠 폴백)
- [x] L1.5 — **tsc 사각지대(느슨한 Record<string>) 5파일 수거**: guestSignals(시그널 캡슐 7종)·ledger(정산 캡슐 5맵)·notices(Intl 태그)·companion(정원 초과 문구)·layouts(차량 표시명 5종)·guestPush(푸시 타이틀)
- [x] L2 — 위임 에이전트: 컴포넌트 세컨더리 19파일 완료(보고 수신 — PlanEditorClient 60키×4 포함; fr '투어룸' 용어 분기 발견 → L3에서 'salon de visite'로 통일). lib/tour-room 17파일 + lib/ops 9파일 진행 중
- [x] L3 감수 — 4언어 원어민 리뷰 에이전트 병렬(수정 권한): fr 40+건(«espace tour»·«fil du voyage» 통일, !?:; 앞 공백 13, 칼크 교정) · de 20건(**존재하지 않는 탭 참조 „Zeitplan/Programm“→„Heute“**, n=1 문법, „KI-generierter Guide“ 오독, NoticeBanner 성별-안전 „Treffpunkt: p“) · ru 20+건(원장 캡슐 **여격→조격**, «собирайтесь»=짐싸기 오독 제거, «таймлайн»→«лента путешествия», 수사 격 회피 라벨형) · it 13건(**rinviare→reinviare 실오역**, n=1 3건, «diario di viaggio» 통일). 잔존 의도적 예외는 각 보고에 기록.
- [x] L4 게이트 — tsc 0 · jest 146스위트/1582(감수 후 1604) green(5로케일 박제 테스트 3파일 갱신) · `npm run build` · walk 33컷 콘솔 0 + fr/de 홈·설정 육안(탭바 „Einstellungen“/« Réglages » 수납 확인). **관찰된 사전존재 니트(무접촉)**: es `Faltan 1 días`(LobbyCard dday n=1).
- [x] L5 — main 전진분(#500 등) 머지: 유일 충돌 guestSignals.ts = 정확히만나기(핀 URL 별도 줄 문법 + share_location/meeting_propose 신설)와 교차 → **main 신문법 채택 + 9로케일 이식**, MeetSetCard·QuickSignalBar 신키 5종도 4언어 완성. 게이트 재통과 후 **PR #501 머지(8f9424ad)**.
- ⚠ 기록: 로케일 변경은 룸 재조인→셸이 홈 탭으로 리마운트(walk에 문서화). CORE_TRANSLATION_LOCALES 덕에 LLM 팬아웃 비용은 fr/de/ru/it 손님이 실제 입장할 때만 발생.

## §F 후속 라운드 — zh-TW(번체) 추가 + 니트 수정 (2026-07-27)

**사용자 지시:** "수정할거 수정하고 이번엔 zh-TW도 locale 추가".

**F-D1 정규화 특례(신규 계약).** `ROOM_LOCALES`에 `'zh-TW'` 추가(10종, zh 바로 뒤). 지금까지 `normalizeRoomLocale`은 **모든 태그를 기저 언어로 접었다**(`zh-TW`→`zh`) — 그 폴딩을 깨야 번체가 산다. 규칙: `zh-tw|zh-hk|zh-mo|zh-hant*` → `'zh-TW'`, 그 외는 종전대로 기저 언어. `entryCopy.normalize`(기기 로케일 감지)도 동일 규칙으로 맞춤 — 대만/홍콩 기기가 자동으로 번체로 착지한다.
**F-D2 언어 이름 분화.** 버튼이 둘 다 "中文"이면 고를 수 없다 → `zh: 简体中文` / `zh-TW: 繁體中文`.
**F-D3 파생 인프라.** LOCALE_TAG/TTS_LANG `zh-TW`, CJK 행간 CSS 셀렉터에 `[data-locale='zh-TW']` 추가(번체도 1.55), 느슨한 Record 3곳(guestPush 타이틀·companion 정원초과·notices Intl 태그) 수동 수거.
**F-D4 LLM 팬아웃 불변.** `CORE_TRANSLATION_LOCALES`는 **5종 그대로** — 번체 UI 추가가 번역 호출을 늘리지 않는다(번체 손님이 실제 입장하면 동적 타깃이 알아서 합류).
**F-D5 번역 규율.** 간체의 기계 변환 금지 — 대만 어휘 강제(訊息/網路/影片/計程車/設定/螢幕/主畫面/便利商店/QR Code/帳戶/登入/預設/智慧…), 「」 인용부호, Apple zh-TW 실문구「加入主畫面」.

**니트 수정(감수 기록분):** es 복수형 3건 — LobbyCard `Falta 1 día`, checkinCopy welcomeParty/partyPrompt를 라벨형으로.
**A1 원장:** 이번 트랙 신규 3종(InstallCard·SkinScenery·useInstallPrompt) 등록 — 원장 테스트가 먼저 울었다(규율대로 작동).

**실행 로그:**
- [x] F0 인프라(정본·정규화·파생·CSS·언어명) + 니트 3건
- [x] F1 번역 65파일(에이전트 3기 중 2기가 세션 한도로 중단 → 잔여 15파일 직접 완료: dining 2·seating 6·tour-room 5·PlanEditor 1 등)
- [x] F2 테스트 갱신 — `singleSourceOfTruth`(5→10 스냅샷, **main에서 이미 깨져 있던 것**)·timeFormat·chatFeed 픽스처·A1 원장
- [ ] F3 대만 원어민 감수 → F4 게이트(tsc·jest·build·walk zh-TW 컷) → F5 머지
