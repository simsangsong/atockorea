# NEXT SESSION — 제주 명소 가이드 영상 8종 + VIDEO2 폴더정리 (2026-08-04)

**이 문서는 PC 로컬 세션용이다.** 원격(모바일) 세션은 `D:/VIDEO2` 에 접근할 수 없어 만장굴(업로드 22클립)까지만 처리했다.
브랜치: `claude/manjangul-video-script-reorder-18zg52` (만장굴 v3.1 스펙 커밋 2건). 이어받으면 이 브랜치에서 계속하거나 main 머지 후 새 브랜치.

## §0 첫 커맨드

```bash
npm run video:guide -- --check     # 전 스펙 실측·게이트. 소스/베드/ffmpeg 선행조건도 여기서 다 잡힌다
```

빨간 줄이 나오면 그 메시지가 시키는 대로 고친 뒤 다시. 초록이면 `--full` 로 렌더한다.
표준 문법: `docs/video-guide-standard-grammar-2026-08-04.md`

## §1 지금 상태

- **만장굴 완료:** `docs/video-specs/manjanggul-lava-tube.json` v3.1 — 8/4 재촬영 22클립 기준 전면 재작성.
  turns.mjs·motioncut.mjs 실측 반영, validate 게이트 0 FAIL (48비트 · 1x 34% · ~171s).
  드래프트(960×540) 렌더를 원격 세션에서 실제로 돌려 사장님께 480p 압축본 전달함(2026-08-04).
- **만장굴 잔여:** ① 사장님 최종 컨펌 ② 풀 렌더(crf17) — 야외 컷(A~F·V) 하이라이트 클리핑 확인 ③ 음악 베드(현재 용궁사 베드 공유, Suno A15 대기).
- **잔여 8명소(사장님 지시 순서):** 주상절리 → 약천사 → 산방산 → 천지연폭포 → 오설록 → 올레7코스&외돌개 → 애월한담 → 정방폭포.

## §2 첫 일감 = VIDEO2 폴더정리 (사장님 지시: 스펙 착수 전에 먼저)

규약은 기존 그대로: **`D:/VIDEO2/<도시>/<명소>`** (부산/감천문화마을 · 부산/해동용궁사 · 제주/성산일출봉 · 제주/만장굴).
8/4 제주 촬영분이 섞여 있으면 **파일명 타임스탬프 + 내용 프레임 확인**으로 명소별 폴더에 분류하라.

- 🔴 **만장굴 22개는 이미 스펙에 파일명이 박혀 있다** (`20260804_102609.mp4` ~ `20260804_105845.mp4`, 스펙 sources 표 참조).
  `D:/VIDEO2/제주/만장굴/` 에 원본 파일명 그대로 두는 것이 기본. 리네임(재순번)하면 스펙 sources 표를 반드시 같이 갱신.
- 🔴 **타임스탬프만 믿지 마라** — 만장굴에서 매표소·검표소·하강로는 다 보고 나온 **맨 뒤(10:58)에 재촬영**돼 있었다.
  분류는 내용으로 판정하고, 재촬영 클립은 편집 순서상 동선 위치로 들어간다(§4-⑥).

## §3 명소별 스펙 착수 순서와 준비물

| 순서 | 명소 | 스펙 파일(제안) | 비고 |
|---|---|---|---|
| 1 | 주상절리(중문 대포해안) | jusangjeolli-cliff.json | |
| 2 | 약천사 | yakcheonsa-temple.json | 용궁사 스펙의 사찰 문법 참고 |
| 3 | 산방산 | sanbangsan-mountain.json | |
| 4 | 천지연폭포 | cheonjiyeon-falls.json | |
| 5 | 오설록 | osulloc-tea-museum.json | |
| 6 | 올레7코스&외돌개 | olle7-oedolgae.json | 두 스팟 한 영상인지 사장님 확인 |
| 7 | 애월한담 | aewol-handam-coast.json | |
| 8 | 정방폭포 | jeongbang-falls.json | |

- poiKey·클레임(요금·휴무·수치)은 **match_pois.content_locales 에서 확인** 후 캡션에 사용. 단위 스펠아웃(gate E-3).
- output/encode/grade 는 만장굴 스펙을 시작점으로 복사하되, **그레이드는 명소 실측으로 재조정**(만장굴 그레이드는 동굴 저조도 맞춤이다 — 야외 명소에 그대로 쓰면 안 된다. 감천/용궁사 스펙의 야외 그레이드 참고).

## §4 확정된 워크플로 (만장굴에서 검증됨 — 이 순서 그대로)

1. 클립 전수 컨택트시트(클립당 6프레임)로 내용 식별 — **파일명·순번을 믿지 말고 화면을 봐라.**
2. 스펙 v1 작성 (콜드오픈 → promise → 동선 순 비트 → stopLabel/폴라로이드/freeze → recap).
3. `node scripts/video-guide/turns.mjs <spec>` — 턴 실측 → turn 비트를 실측 창에 맞춤. **팬 0건인 클립에 turn 달지 마라.**
4. `node scripts/video-guide/motioncut.mjs <spec>` — 경계 스냅.
5. `node scripts/video-guide/validate.mjs <spec>` — **0 FAIL 까지.** (1x 40% 상한 · 연속 고속 5.2s 상한 · 폴라로이드 시각 정합 · 캡션 노출시간 · 챕터 간격 10s 등을 다 잡아준다.)
6. `node scripts/video-guide/build.mjs <spec> --draft` → 사장님 프리뷰 → 컨펌 후 풀 렌더.

## §5 사장님 규칙 (2026-08-04 만장굴에서 확정 — 8명소 전부 적용)

① **팬(회전)과 겹치는 트랜짓은 1.2~1.5x** — "휙휙 돌아가는 빨리감기" 금지. turns.mjs 창과 겹치면 무조건 감속.
② 팬 없는 직선 구간만 2x.
③ **배속 상한 2x** (구판의 3x+ 금지. 야외 장거리도 2x까지).
④ 연속 고속 5.2s 상한 — 넘으면 실측 팬 지점에서 비트를 쪼개고 motioncut 재실행.
⑤ 화살표 금지(2026-08-01 결정 유지) — 중요 포인트는 「정지 + 셸 타이포 라벨」만.
⑥ **진입 시퀀스는 실제 동선 순** — 매표소→검표소→진입 같은 동선 비트가 재촬영으로 타임스탬프 뒤에 가 있어도 편집에선 동선 위치로 끌어올린다(만장굴: 105845·105811을 D와 G 사이로).

## §6 함정 (이번 세션에서 실제로 밟았거나 확인한 것)

- `sharp`/`playwright` 는 메인 체크아웃에 없다 — `scripts/video-guide/lib/deps.mjs` 의 HOSTS(ops-next 체크아웃) 또는 `VIDEO_GUIDE_DEP_HOST` env.
- validate 의 소스 존재 검사는 sourceDir 기준 — 스펙의 sourceDir 은 항상 `D:/VIDEO2/...` 로 커밋하고, 다른 머신에서 검증할 땐 임시로만 바꿔라(커밋 금지).
- 음악 베드: 현재 전 스펙이 용궁사 베드 공유. 명소별 베드는 Suno 프롬프트 A15 대기(사람 게이트).
- 만장굴 fps 잡탕(23.75~30) 같은 저조도 가변 프레임레이트가 다른 명소에도 있을 수 있다 — ffprobe로 전수 확인 후 _notes 에 기록.

## §7 추가(2026-08-04 후속): 표준 문법 확정 — 기존 3편 재단은 PC 세션 몫

**표준 정본: `docs/video-guide-standard-grammar-2026-08-04.md`** (만장굴 문법 v1). 신규 8명소는 전부 이 표준으로.

기존 3편(감천 28 · 용궁사 17 · 성산일출봉 32개의 >2x 트랜짓)도 표준 §2(중간 잘라내기)로 재단해야 한다.
🔴 **스펙은 아직 구판 그대로다** — 원격 세션에서 소스 없이 등간격으로 잘라 봤다가 사장님 지시
("직접 자르는 게 아니라 방식을 문서화해서 다음 세션에서 참조")로 되돌렸다. 절차는 표준 §6에 통째로 있다:
**반드시 소스 프레임을 열어 보면서** 슬라이스를 고르고, 폴라로이드 §3 검수까지 같이 한 뒤 재렌더한다.
+ 만장굴 음악 베드 4곡 mp3 를 assets/audio/video-guide/ 에 복사(리포엔 없다 — 사장님이 대화로 전달한
원본을 다시 받거나 보관본 사용), 기존 3편도 heedotrip 풀에서 본편보다 긴 곡으로 베드 교체 검토.

## §8 별건(2026-08-04): 수원·스타필드 투어 트랙 — 여기서 한 것과 남은 것

**한 것 — 서울 픽업 통일(커밋 65d038b).** 사장님 스크린샷(K One Tour 미팅포인트 카드)이 기준:
출발 08:00 홍대입구역 8번 출구 → 08:30 명동역 2번 출구, 복귀 18:00 명동 → 18:30 홍대입구.
라이브에 실제 오류가 있었다 — 와우정사 상품이 **4번 출구**(정답 8번)에 출발도 **30분 늦은**
08:30/09:00 이었고 복귀 시각이 아예 없었다. 형제 상품 둘은 "2번 또는 4번"으로 얼버무리고 있었다.
Schema A 서울 당일투어 4개 × 6로케일 = 24파일 수정. 설악산은 **자기 출발시각(07:00/07:30) 유지** —
운행거리가 달라 08:00 로 통일하면 틀린다. 미팅 지점만 맞췄다. (이 판단은 사장님 확인 필요.)

**🔴 남은 것 1 — 10로케일은 구조 결정이다.** 정적 투어 상품 35개 중 fr/de/it/ru 파일은 **0개**이고,
`TourProductPageLocale` 은 6로케일(en/ko/zh/zh-TW/es/ja)로 **타입에 박혀** 있다. 수원 상품 하나만
10로케일로 만들 방법이 없다 — `PER_LOCALE_PRODUCTS: Record<Locale, ...>` 가 로케일마다 전 상품을
요구하므로, 배열을 열면 나머지 34개가 같이 열린다. 그리고 그 배열 수정은 **사람 결정**이다
(CLAUDE.md 🔴 · `TOUR_PRODUCT_FALLBACK_URL_LOCALES` 가 지금 fr/de/it/ru 를 영어로 폴백시키는 중).
→ 정석 경로는 정적 JSON 이 아니라 **DB 스테이징**: `npm run i18n:extract/verify/apply -- --locale=de`
가 `tour_product_pages` 에 INSERT 만 하고, 화면은 배열을 열기 전까지 안 바뀐다. 수원 3형제를
이 파이프라인에 태우는 것이 다음 일감. **정적 파일로 fr/de/it/ru 를 만들면 아무도 안 읽는다**(선언-미사용).

**남은 것 2 — 경쟁사 대비 부족분.** 스크린샷의 Klook 3패키지는 우리도 이미 별도 상품으로 다 있다
(`...-waujeongsa-starfield` · `...-folk-village-starfield-library` · `...-gwangmyeong-cave-starfield-library`).
세 상품 모두 `itinerary_variants: []` 라 **서로를 모른다** — Klook 은 한 페이지에서 패키지를 갈아끼운다.
세 형제를 상호 링크(변형 선택 UI)하는 것이 실질 개편 포인트. 가격도 비어 있다(Klook 와우정사 ₩71,300 ·
민속촌 ₩93,300 — 우리 `price.amountLabel` 은 공백).

## §9 수원 3형제 — 10로케일 DB 스테이징 (사장님 결정 2026-08-04: "DB 스테이징으로")

**결정 근거는 코드로 확인했다.** `tourProductPageBody.tsx` 의 해결 순서는
`Supabase(locale) → 정적 JSON(locale) → Supabase(en)` 이고, URL 로케일은 `toTourProductPageLocale()`
가 6로케일로 좁힌다 — **de/fr/it/ru URL 은 locale='en' 으로 해석**되므로 `tour_product_pages` 에
de 행을 넣어도 배열을 열기 전까지 고객 화면은 안 바뀐다. 무인 실행이 안전한 이유가 이것이다.

**🔴 원격 세션에서는 실행 불가** — extract/apply 가 `SUPABASE_SERVICE_ROLE_KEY` 를 요구하는데
클라우드 컨테이너에 `.env.local` 이 없고, Supabase MCP 는 이 테이블에 권한이 없다(실제로 시도해
`permission denied` 받음). **PC 세션에서 아래를 그대로 돌려라.**

```bash
SLUGS=seoul-suwon-hwaseong-waujeongsa-starfield,seoul-suwon-hwaseong-folk-village-starfield-library,seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library

npm run i18n:status                                     # 현재 큐 확인
npm run i18n:extract -- --locale=de --slugs=$SLUGS       # 1) 유닛 추출 → i18n-work/in/
#   2) 번역: i18n-work/RULES.md 전문을 주입한 서브에이전트로 in/ → out/   (요약 주입 금지)
npm run i18n:verify                                     # 3) 게이트
npm run i18n:apply -- --locale=de                       # 4) 드라이런
npm run i18n:apply -- --locale=de --apply               #    실제 INSERT (기존 행은 절대 안 건드림)
# fr / it / ru 반복
```

**선행 확인 하나:** 이 3슬러그가 `tour_product_pages` 에 `locale='en'` 행으로 있어야 extract 가 집는다.
지금 매니페스트에 잡힌 10개(Tier1)에는 **없다**. 없으면 정적 JSON 의 en 문서를 먼저 DB 에 올려야 한다 —
이건 스테이징이 아니라 **소스 등록**이므로 사장님 확인 후에.

**🔴 정적 JSON 으로 fr/de/it/ru 파일을 만들지 마라.** `TourProductPageLocale` 이 6로케일로 타입에
박혀 있어 레지스트리가 읽지 않는다 — 만들면 선언-미사용이 된다(이 리포의 지배적 결함 유형).

## §10 추천 코스 연결 완료 (사장님 결정: 추천 레일에서만, 클룩 모방 X)

법적·파트너십 리스크를 피해 **패키지 스와핑 UI 를 만들지 않았다.** 기존 추천 레일
(`TourRecommendationsSection` ← `pickTourRecommendations`)이 형제를 못 집던 원인만 고쳤다:
와우정사는 region 이 "Suwon & Yongin" 인데 나머지 둘은 "Gyeonggi-do (south of Seoul)" 이라
region 토큰 교집합이 0 이었다(region 은 가중치 ×4 로 가장 무겁다). 실제 지리대로 고쳤다 —
한국민속촌은 **용인**, 광명동굴은 **광명**(각 상품 자기 스톱 목록이 근거). 측정: 세 페이지 모두
형제 2/2 가 상위 6 안에 노출(고치기 전엔 민속촌·광명 페이지가 각각 1/2, 와우정사를 못 집었다).
