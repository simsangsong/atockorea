# 전 표면 다국어 채우기 — 실행 플랜 (2026-08-07)

> **이 플랜의 목적:** 사이트 + 스마트앱 전 표면에서 미번역을 찾아 10로케일을 채운다.
> **API 를 쓰지 않는다.** 번역은 Claude Code 가 플랜 한도 안에서 직접 하고, 세션을 쪼갠다.
> 아래 숫자는 전부 **2026-08-07 실측**이다(추정은 「추정」이라고 표시했다).

---

## §0 🔴 시작 전에 읽을 것

### 0-1. 상시 규칙 — API 금지

CLAUDE.md 맨 위 규칙이다. `scripts/i18n/translate.ts` 는 `--yes-bill-the-api` 없이는 exit 2 다.
**「API 크레딧 대기」라고 적힌 인수인계를 만나면 그건 대기가 아니라 규칙 위반이다.**

### 0-2. 이 플랜이 지키는 안전 전제

| 대상 | 왜 안전한가 |
|---|---|
| `tour_product_pages` de/fr/it/ru | `TOUR_PRODUCT_FALLBACK_URL_LOCALES` 가 막고 있어 **DB 에 넣어도 손님은 EN 을 본다**. 오픈은 사람 결정. |
| `messages/*.json` | 기존 키 **값만** 채운다. 키 추가·삭제 금지(파이프라인이 EN 키를 덮은 전례 있음 — `[[feedback-i18n-translate-script-drops-keys]]`). |
| `match_pois` | 🔴 **`names_other_locales` 는 게이트가 없어 쓰는 즉시 손님에게 반영된다. 절대 손대지 마라.** `content_locales` 는 별개 컬럼이지만 **§4 에서 안전성부터 확인**하고 착수한다. |

### 0-3. ✅ 사장님 결정 — **전부 정해졌다 (2026-08-07)**

1. 🔴 **번역 대상은 「지금 라이브인 상품」뿐이다.**
   **이미 비공개인 것도, 비공개 예정인 것도 번역을 보류한다.** 판정은 매번 DB 로 다시 하라 —
   병행 세션이 상품을 열고 닫는다(이 세션에서만 가평이 남의 손에 닫혔고, 수원 3종·설악 3종은
   내 워크트리가 낡아서 「막혀 있다」고 잘못 볼 뻔했다. §6-5-8 참조).
2. **비공개 전환 2종(2026-08-07 지시):** `seoul-private-nami-morning-calm-petite-france` ·
   `pocheon-sanjeong-lake-herb-island-art-valley`. **두 쪽 다 내렸다** —
   `tours.is_active=false` + 전 로케일 `is_published=false` + `CONSUMER_BLOCKED_TOUR_SLUGS`.
   (DB 플래그만으로는 `/tours/list` 카드가 남는다 — 그 실측표가 그 파일 안에 있다.)
   **이 둘은 번역하지 않는다.**
3. 🔴 **POI 는 상품과 무관하게 전부 번역한다** — §4. 앞서 「범위에서 뺀다」고 적었던 것을
   사장님 지시로 **되돌린다.**
4. **§5 챗봇/왓츠앱은 손대지 않는다** — 청크는 파생물이고 생성기가 6로케일 타입에 묶여 있다.
   §2·§3 를 채우면 따라온다.

**게이트 오픈 순서(사장님 지시):** 라이브 상품 + 신규 부산 프라이빗 번역을 **끝내고 나서**
`TOUR_PRODUCT_FALLBACK_URL_LOCALES` 를 연다. 🔴 **먼저 열면 안 된다** — 지금 라이브 20종 중
행이 없는 게 7종이라, 여는 순간 그 7종이 어떻게 되는지(영어 폴백인지 깨지는지) 미검증이다.

### 🔴 0-4. 게이트 차단 요인 #2 — **번역된 `badges` 가 선반과 필터를 조용히 죽인다** (2026-08-07 확인)

번역을 다 끝내도 **이걸 먼저 고치지 않으면 게이트를 열면 안 된다.** `catalog_card.badges` 는
표시용이 아니라 **영어 정규식으로 매칭되는 판정값**이고, 그 정규식에 de/fr/it/ru 가 없다.

| 소비처 | 커버 로케일 | 번역 후 결과 |
|---|---|---|
| `lib/tours-shelves.ts:186` `SMALL_GROUP_BADGE_RE` | en·ko·ja·zh·zh-TW·es | **소그룹 선반이 통째로 빔** |
| `lib/tour-catalog-type-infer.ts:25` `SMALL_GROUP_TEXT_RE` | 같음 | 카드 유형(프라이빗/조인/버스) 오판 |
| `components/tours/TourListFilterBar.tsx:65-68` | **영어 부분문자열만** | 버스·프라이빗·크루즈 필터가 **0건** 반환 |

🔴 **이건 가정이 아니라 이미 한 번 난 사고다.** `tours-shelves.ts:180-183` 주석이
「영어 전용 정규식이 **비영어 페이지 전부에서 선반을 조용히 떨어뜨렸다**」고 적고 있다.
그때 6로케일을 넣고 멈췄는데, `scripts/build-catalog-cards.mjs:26` 는 이미 **10로케일**을 뽑는다.

⚠ **정규식만 넓히면 안 된다 — 문구 자체가 로케일 안에서 갈라져 있다**(라이브 실측):
`de` = `Kleingruppe`(6) + `Kleine Gruppe`(2) · `ru` = `Малая группа`(6) + `Мини-группа`(2) +
`Небольшой общий микроавтобус`(1) · `de` 프라이빗 = `Private Tour`/`Privat`/`Privattour` ·
`ru` = `Индивидуальный тур`/`Индивидуальный`/`Приватный тур`.
→ **정본 문구를 먼저 정하고**(번역 트랙이 끝나야 확정된다) 그 다음 정규식을 넓혀라.

⚠ `catalog_card.tags` 는 **반대로 소비처가 0개다**(`build-catalog-cards.mjs:34-49` 화이트리스트에
없어 번들에 들어가지도 않는다). 화면의 칩은 `badges` 에서 나온다. **밑줄 있는 `small_group`·`day_trip`
은 추출기가 이미 건너뛰고**(`segments.ts:219`), 낱말인 `culture`·`cave` 는 5개 로케일이 전부
번역해 뒀다 — 어느 쪽이든 동작에 영향이 없으니 기존 관례를 따르면 된다.

---

## §1 전 표면 실측 결과 — 어디가 비어 있나

| # | 표면 | 상태 | 남은 일 |
|---|---|---|---|
| A | `messages/*.json` UI 크롬 | 키 패리티 **2,261 × 10 완전** · 값에 구멍 | **321 (키×로케일)** |
| B | `tour_product_pages` 투어 콘텐츠 | 6로케일 37슬러그 / de 18·fr 18·it 17·ru 11 | **판매중 39행** (+은퇴 45행) |
| C | `region_script_locales` 지역 해설 | **10로케일 완전** (160행) | 없음 |
| D | `match_pois.content_locales` | 125 POI — ja 77·ru 90·it 112·de 113·ko 114·fr 118 | ja 48·ru 35·it 13·de 12·ko 11·fr 7 |
| E | `knowledge_chunks` 챗봇 RAG | 1,397행 — **de/fr/it/ru 없음** | 결정 대기 |
| F | `ops_whatsapp_templates` | 30행 — **de/fr/it/ru 없음** | 결정 대기 |

**A 와 B 가 손님이 실제로 보는 것이다. 여기부터 한다.**

---

## §2 표면 B — 투어 콘텐츠 (가장 큰 덩어리)

### 🔴 2-a″. **현재 범위 (2026-08-07 S2 종료 후 재실측) — 라이브 21종 · 38행**

**S2 가 it `southwest` 를 닫았고(−1), G4 부산 프라이빗이 실제로 라이브에 나타났다(+4).**
35 − 1 + 4 = **38행**. 판정 쿼리는 `is_published AND tours.is_active` 조인이다
(둘 중 하나만 보면 틀린다).

| 그룹 | 슬러그 | 부족 |
|---|---|---|
| ~~**G2** ru 만~~ | ✅ **2026-08-07 전부 종료** — ru 행 21/21 완비 | 0 |
| **G3** 🔴 미추출 | `busan-small-group-sightseeing-tour-cruise-passengers` · `seoul-seoraksan-naksansa-temple-naksan-beach-day-trip` · `seoul-seoraksan-nami-island-morning-calm-day-tour` · `seoul-suburbs-private-chartered-car-10hr` · `seoul-suwon-hwaseong-folk-village-starfield-library` · `seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library` · `seoul-suwon-hwaseong-waujeongsa-starfield` | 7×4 = **28** |
| **G4** 🔴 미추출 — **새로 나타났다** | `busan-private-car-charter-city-tour` | 4 |

**완비 7종:** busan-cruise-shore-excursion-bus-tour · busan-private-car-charter-cruise-shore ·
busan-small-group-yonggungsa-skycapsule-gamcheon · busan-top-attractions ·
incheon-seoul-private-car-shore-excursion-cruise · jeju-grand-highlights-loop ·
seoul-winter-seoraksan-nami-eobi. (이 목록도 매번 다시 재라 — 병행 세션이 바꾼다.)

✅ **G1 종료(S2, 2026-08-07):** it `southwest` 7 unit · 525 세그먼트 · 커버리지 100% · 발행됨
(payload 89,707자 — fr 90,641 · de 87,686 과 같은 급). `i18n:verify --locale=it` **fail 0 / 40 unit**.

⚠ **G3 7종 + G4 1종은 `i18n:extract` 부터** 해야 한다. G2 의 ru 77 unit 은 이미 `in/` 에 있다.

🔴 **G4 는 이 플랜이 「나타나면」이라고만 적어 둔 것이 실제로 나타난 경우다.** 라이브 목록을
매번 DB 로 다시 재라는 §0-3-1 이 이번에 값을 했다 — 플랜의 20종/35행을 그대로 믿었으면
새 상품 하나가 통째로 누락됐다.

---

### 2-a. (기록) 착수 시점 실측 — 판매중 23슬러그 · 39행

| 그룹 | 슬러그 | 부족 | 상태 |
|---|---|---|---|
| **G1** 이미 추출됨 | `southwest-hallasan-osulloc-aewol` | it, ru | it 7 unit 은 `in/` 에 있다 |
| **G2** ru 만 부족 | `from-busan-gyeongju` · `jeju-cruise-small-group` · `jeju-eastern` · `jeju-island-private-car` · `jeju-southern` | ru ×5 | ru 77 unit 이 `in/` 에 있다 |
| **G3** 🔴 **추출조차 안 됨** | `busan-small-group-sightseeing-cruise-passengers` · `seoul-private-nami-morning-calm-petite-france` · `seoul-seoraksan-naksansa` · `seoul-seoraksan-nami-morning-calm` · `seoul-suburbs-private-chartered-car-10hr` · `seoul-suwon-hwaseong-folk-village` · `seoul-suwon-hwaseong-gwangmyeong-cave` · `seoul-suwon-hwaseong-waujeongsa` | 4언어 × 8 = **32행** | `i18n:extract` 부터 |

**G1·G2 = 84 unit 이 이미 `in/` 에 준비돼 있다.** 여기부터 하면 도구 작업이 0이다.

### 2-b. 은퇴 14슬러그 — 45행 (사장님 결정 §0-3-1, 권고: 보류)

### 2-c. 분량 (실측 원문 글자수)

| 대상 | unit | 원문 |
|---|---|---|
| it `southwest` | 7 | 28,819자 |
| ru 7슬러그 | 77 | 322,621자 |
| G3 8슬러그 × 4언어 | 미추출 | **추정** 30,000자/슬러그-로케일 → 약 96만자 |

🔴 **G3 가 전체의 70% 다. 만만찮다** — 이 플랜은 **G1 → G2 → G3** 순서를 권한다.
G3 착수 전에 §0-3 결정을 받아 범위를 확정하라.

---

## §3 표면 A — `messages/*.json` (작고 효과 큼 — **먼저 하라**)

### 3-a. 🔴 가장 큰 발견 — 예상과 정반대다

`home.customJoinTour.*`(AI 커스텀 투어 = **예약 퍼널**) 124키 중:

| ko | ja | zh | zh-TW | es | fr | de | it | ru |
|---|---|---|---|---|---|---|---|---|
| 6 | **63** | **69** | **69** | **71** | 12 | 13 | 12 | 6 |

**핵심 로케일(ja·zh·zh-TW·es)이 신규 로케일(fr·de·it·ru)보다 훨씬 나쁘다.**
기능을 만들 때 신규 4언어만 채우고 **구 핵심 로케일을 백필하지 않은 것**이다.
「핵심 로케일은 당연히 완전하다」는 가정으로 보면 영영 안 보인다.

### 3-b. 나머지 (키×로케일)

`settingsPage` 20 · `errors` 20 · `toursList` 18 · `tour` 9 · `cart` 2 · `admin` 12(스태프용, 후순위)

### 3-c. 번역하면 안 되는 것 — 오탐

`home.footer.registeredAddress`(법인 주소) · `platformOperator`(`AtoC Korea, LLC`) ·
고유명사(`Seoul`·`Busan`·`Jeju`·`UNESCO`·`Google`) · 사람 이름(`Sarah M.`) ·
독일어에서 그대로인 차용어(`Filter`·`Name`·`Route`·`Support`·`FAQ`).
**RULES.md §47 제품명 4언어 영어 유지도 그대로 적용된다**(`AtoC Korea`·`Tour Room`·`Smart Guide`·`Smart Pass`).

### 3-d. 분량

원문 총 3,274자(124키) 기준, 미번역 321건 = **추정 8,000~10,000자**.
→ **한 세션에 끝난다.** 효과 대비 가장 싼 작업이므로 **S1 에 배치**한다.

---

## §4 표면 D — POI 콘텐츠 — **채우기(P1) + 검수(P2), 둘 다 범위 안**

`content_locales` 는 **게이트가 있다. `names_other_locales` 와 다르다.**
소비처 두 곳이 **fail-closed** 로 막는다 — `lib/itinerary-builder/locale-content.ts:42` ·
`lib/tour-room/poiContent.server.ts:62`, 둘 다 `content_locale_status[locale] === 'approved'` 일 때만 서빙.

🔴 **그리고 de/fr/it/ru 번역은 **이미 쓰여 있다**:**

| | ko | ja | zh | zh-TW | es | de | fr | it | ru |
|---|---|---|---|---|---|---|---|---|---|
| 콘텐츠 있음 | 114 | 77 | 77 | 77 | 77 | **113** | **118** | **112** | **90** |
| **approved** | 114 | 77 | 77 | 77 | 77 | **0** | **0** | **0** | **0** |

**433개 POI-로케일 항목이 안 열린 검수 게이트 뒤에 쌓여 있다.**
🔴 **사장님 지시(2026-08-07): POI 는 상품과 무관하게 전부 번역한다.**
위의 「번역하지 마라」 권고는 **철회됐다.** 상품 범위(라이브만)와 달리 POI 에는 제한이 없다.

**할 일 두 가지 — 성격이 다르니 섞지 마라:**

| | 무엇 | 규모 | 성격 |
|---|---|---|---|
| **P1** | 빠진 로케일 채우기 | de 12 · fr 7 · it 13 · ru 35 · ko 11 · ja 48 = **126** | 번역 (내가 한다) |
| **P2** | 이미 쓰여 있는 433건 검수 | de 113 · fr 118 · it 112 · ru 90 | **사람 판단** (기계번역이 손님에게 나간다) |

**P1 은 지금 해도 된다** — approved 가 아니면 서빙되지 않으므로 `tour_product_pages` 와 같은
스테이징이다. **P2 는 사장님 결정**이고, P1 을 끝낸 뒤 한 번에 올리는 편이 낫다.

⚠ **`names_other_locales` 는 여전히 손대지 마라** — 그쪽은 게이트가 없다.

---

## §5 표면 E·F — 챗봇 RAG · 왓츠앱 — ✅ **실측 완료: 이것도 번역 작업이 아니다**

**청크는 파생물이다.** `source_type` = `site`·`policy`·`qa`·`tour_product` — 즉
**`messages/*.json` 과 `tour_product_pages` 에서 생성된다**(`lib/chatbot/siteKnowledge.ts`).
그리고 그 생성기는 **`TourProductPageLocale` 타입에 묶여 있다** —
`lib/tour-product/tourProductPageLocale.ts:2` 의 **6로케일 고정**이다.

→ **de/fr/it/ru 청크는 그 타입이 넓어지기 전엔 존재할 수 없다.** 다른 모든 표면과 **같은 6로케일 경계**다.

**지금 독일어로 물으면 무엇이 나오나:** `lib/rag/retrieve.ts:118` 의 로케일 처리는
**필터가 아니라 가산점**(`LOCALE_BONUS = 0.15`)이다. 그래서 **검색은 된다** — 다른 로케일 청크가
잡히고 답변은 독일어로 나온다. **망가진 게 아니라 랭킹만 불리하다**(전체 1,397청크 중
로케일 무관 `all` 은 88개뿐이라 나머지 1,309는 남의 언어 청크다).

→ **권고: 손대지 마라. 손으로 번역하면 전부 버리는 일이 된다.**
`messages/*.json`(§3)과 `tour_product_pages`(§2)를 채우면 **게이트가 열릴 때 재색인으로 공짜로 생긴다.**
🔴 **그래서 S1(messages)은 복리다** — UI·챗봇 두 표면을 한 번에 채운다.

---

## §6 🔴 세션 운영 규약 — 이대로 하면 쪼개도 정확하다

### 6-1. 파일이 진척이다

**모든 표면을 파일 계약으로 돌린다.** 세션이 끝나도 진척은 파일에 남고, 다음 세션은
「출력 파일이 없는 것」만 집으면 된다. 사람이 다시 셀 필요가 없다.

| 표면 | 입력 | 출력 |
|---|---|---|
| B 투어 콘텐츠 | `i18n-work/in/tour_product_pages/<unit>.json` | `i18n-work/out/tour_product_pages/<loc>/<unit>.json` |
| A messages | `messages/en.json` | `messages/<loc>.json` (**값만 교체**) |

### 6-2. 한 세션의 모양 (그대로 따라라)

1. **남은 것 확인** — §6-4 의 명령 하나. 인수인계 문장을 믿지 말고 직접 세라.
2. **RULES.md 전문 + `styleguide/<locale>.md` 를 읽는다.** 요약하지 마라(RULES.md 스스로 금지).
3. **unit 하나씩** 번역해 출력 파일을 쓴다. 🔴 **포인터 키 집합은 입력과 정확히 같아야 한다.**
4. `npm run i18n:verify -- --locale=<loc>` → **fail 0** 확인.
5. **커버리지 100% 가 된 슬러그는 그 자리에서 발행한다** —
   `npm run i18n:apply -- --locale=<loc> --slugs=<slug> --apply`.
   🔴 **`--partial` 금지**: `apply.ts` 는 INSERT-only라 부분 발행한 행은 **영원히 그대로**다.
6. 커밋 + 인수인계 문서에 **남은 수치**를 갱신한다.

### 6-3. 🔴 최종 실행 순서 (2026-08-07 확정) — 라이브 20종 기준

**세션당 분량:** 2026-08-07 에 **독일어 4 unit = 19,444자**를 다른 작업과 병행해 끝냈다.
번역 전용 세션이면 **25,000~30,000자**가 계획치다(**실측 1회에서 잡은 추정**).

| 단계 | 대상 | 원문 | 세션 | 산출 |
|---|---|---|---|---|
| ✅ **S1** | §3 `messages/*.json` | — | **1 (끝)** | **190건 적용** |
| ✅ **S2** | it `southwest` 7 unit | 28,819자 | **1 (끝)** | **1행 발행** |
| ✅ **S3a** | ru `jeju-island-private-car-charter-tour` 7 unit | 318 세그먼트 | **끝** | **1행 발행** |
| ✅ **S3b** | ru `jeju-southern-top-unesco-spots-tour` 9 unit | 470 세그먼트 | **끝** | **1행 발행** |
| ✅ **S3c** | ru `southwest-hallasan-osulloc-aewol` 10 unit | 525 세그먼트 | **끝** | **1행 발행** |
| ✅ **S3d~S3f** | ru 잔여 3슬러그 · 37 unit · 1,852 세그먼트 | — | **1 (끝)** | **3행 발행** |
| ✅ **S13** | G3 7 + G4 1 슬러그 추출 ×4로케일 + `sectionUi` 등급 구멍 수정 | — | **1 (끝)** | **328 unit** |
| **S14~** | 8슬러그 × 4로케일 — **실측 1,181,476자 · 328 unit** | 실측 | **~40** | **32행** |
| **P1** | POI 빠진 로케일 126건 | 소규모 | **2~3** | §4 |
| **R** | 검수(§R) — 번역과 **다른 세션**에서 | 병행 | 배치당 40~60 | §R |

🔴 **S1 실측 — 플랜의 134 는 과소집계였다.** 134 는 「3어절 이상」 스캔의 값이고, 그 필터가
**짧은 문자열로만 된 미번역 구획을 통째로 숨기고 있었다**: `settingsPage` 뒤쪽 24키가
ja·zh·zh-TW·es 넷에서 전부 영어였는데(`Male`·`Female`·`Friend`·`Save changes`…), 그중
3어절 이상인 5키만 134 에 잡혔다. **실제 적용은 190건**이고 전체 「영어와 동일」 항목은
**558 → 368**로 줄었다. **다음에 이 숫자를 셀 땐 §6-4 의 3어절 필터를 빼고도 한 번 세라.**
남은 51건(3어절 기준)은 **전부 의도된 무작업**이다 — 법인명·미국 등기주소·`{min} – {max}`
플레이스홀더·언어태그 상수(`verifySuccessEn`/`Es`)·대상 언어에서 철자가 같은 차용어.

**합계 원문 약 1,260,000자 → 46세션(추정).**
⚠ **TM 중복제거가 이걸 크게 깎는다** — ru 6슬러그 실측이 **62.6%** 였다(고유 533/전체 1,425).
다만 **깎인 뒤 숫자를 계획에 쓰지 마라**: 중복률은 슬러그 조합마다 다르다. 총량으로 잡고
실제로 빨라지면 그건 이득으로 두는 편이 낫다.

🔴 **G3 가 전체의 77% 다.** S1~S12(12세션)까지 하면 **라이브 20종 중 13종이 4언어 완비**가 되고,
남은 7종이 G3 다. **게이트는 그 7종까지 끝난 뒤에 연다**(§0-3).

### 6-3′. ✅ G3+G4 8슬러그 — **추출 완료(2026-08-07, S13). 이제 추정이 아니라 실측이다.**

| 슬러그 | unit | **번역대상(실측)** | 고유 | payload 대비 |
|---|---|---|---|---|
| `busan-small-group-sightseeing-tour-cruise-passengers` | 15 | **58,705** | 496 | 0.441 |
| `seoul-suwon-hwaseong-folk-village-starfield-library` | 10 | **38,381** | 330 | 0.382 |
| `seoul-seoraksan-nami-island-morning-calm-day-tour` | 10 | **36,529** | 333 | 0.603 |
| `seoul-suwon-hwaseong-waujeongsa-starfield` | 11 | **36,499** | 321 | 0.380 |
| `seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library` | 9 | **35,947** | 334 | 0.353 |
| `seoul-seoraksan-naksansa-temple-naksan-beach-day-trip` | 11 | **35,406** | 331 | 0.604 |
| `seoul-suburbs-private-chartered-car-10hr` | 8 | **28,106** | 301 | 0.353 |
| `busan-private-car-charter-city-tour` | 8 | **25,796** | 281 | 0.518 |
| **로케일당 합계** | **82** | **295,369** | 2,160 | — |

**4언어 합계 = 1,181,476자 · 328 unit.** (로케일당 3,411 세그먼트 중 고유 2,160 —
**같은 로케일 안에서 36.7% 가 중복**이라 실제 손으로 쓰는 양은 이보다 적다.)

🔴 **`payload × 비율` 은 애초에 나쁜 추정기였다 — 이번에 그게 증명됐다.**
플랜은 와우정사 한 슬러그를 재서 **0.558** 을 전체에 밀었는데, 같은 슬러그의 지금 비율은
**0.380** 이다. 번역대상이 줄어서가 아니다(38,744 → 36,499, 거의 그대로) —
**payload 가 69,393 → 95,931 로 커졌다.** 사진 큐레이션 트랙(PR #787·#792)이 갤러리를
늘렸기 때문이다. 즉 **분모에 이미지 URL 이 들어 있어서, 번역과 무관한 트랙이 비율을 움직인다.**
→ **비율로 추정하지 마라. 추출은 읽기 전용이고 몇 분이면 끝나니 그냥 뽑아서 세라.**
(실측 폭 0.353~0.604 — 서울 설악 2종만 0.6대인 건 그쪽 갤러리가 아직 안 늘어서다.)

🔴 **추출기의 「등급 미부여」 경고가 진짜 구멍을 가리키고 있었다 — `sectionUi`.**
안에 든 것은 섹션 제목·부제·픽업 문구이고 `TourAtAGlance`·`TourAtmosphereGallery`·
`TourBookingSupportSection`·`TourDesktopBookingCard` 가 전부 렌더한다. 판정은 추측이 아니라
라이브 데이터로 했다 — 이 키를 가진 유일한 슬러그의 **ko·ja·zh·zh-TW·es 다섯 로케일이 전부
번역해 두었다.** 번역 대상인 게 이미 합의돼 있었고 **de/fr/it/ru 파이프라인만 등급이 없어
조용히 건너뛰고 있었다.** `sectionUi: 'A1'` 추가(`sticky_booking_bar` 와 같은 부류·같은 이유).
같이 `sql_overrides: 'FORBIDDEN'`(가격 오버라이드) — **번역하려는 게 아니라 경고에서 빼려는 것**이다.
정상 키가 경고에 섞여 있으면 경고 자체를 흘려보게 되고, 그러면 다음 `sectionUi` 도 안 보인다.

### 🔴 2026-08-07 검증 프로브 — 가정 하나를 실제로 재봤다

플랜의 35세션이 이 비율 하나에 얹혀 있어서, `seoul-suwon-hwaseong-waujeongsa-starfield`
**한 슬러그를 실제로 추출**했다(de). 결과가 두 가지를 바로잡았다:

| | 플랜 가정 | **실측** |
|---|---|---|
| payload 대비 번역대상 | 0.45 | **0.558** (38,744자 / 11 unit) |
| G3 7슬러그 × 4로케일 | 968,884자 | **1,202,121자** |
| TM 적중 | (미상, 「이득으로 둔다」) | **415 세그먼트 중 170 = 41%** |

→ **총량은 126만 → 약 149만자, 46 → 약 55세션으로 늘어난다.**
→ 🔴 **그런데 TM 이 첫 슬러그부터 41% 를 적중했다.** 이건 이 상품군의 뼈대가 이미
번역된 상품들과 겹친다는 뜻이고, 뒤로 갈수록 더 오른다.
**두 수치를 상계하지 마라** — 하나는 잰 것이고 하나는 아직 안 잰 것이다. 총량은 149만으로
계획하고, TM 은 실제로 빨라질 때 이득으로 받아라.

🔴 **남은 6슬러그도 추출 직후 같은 방식으로 다시 재라.** 비율 폭이 0.32~0.65 로 넓다 —
한 슬러그의 0.558 을 전체에 그대로 미는 것도 추정이다.

**수원 3종은 서로 매우 닮았다**(같은 화성+스타필드 뼈대) — 실제로 이번 프로브에서
TM 41% 가 그걸 보여줬다. 한 세션에 3종을 **같은 로케일로 묶어라.** 설악 2종도 마찬가지다.
**로케일별로 돌리지 말고 슬러그군별로 돌리는 게 TM 이 가장 크게 듣는 배치다.**

### 6-4. 남은 것 세는 명령 (복붙)

```bash
# B 투어 콘텐츠 — 출력 파일이 아직 없는 unit
node -e "const fs=require('fs');const m=JSON.parse(fs.readFileSync('i18n-work/manifest.json','utf8'));for(const u of m.units){const f=u.id.replace(/[^\w.-]+/g,'_');if(fs.existsSync('i18n-work/out/tour_product_pages/'+u.locale+'/'+f+'.json'))continue;console.log(u.locale+' '+u.slug+' '+u.chunk+' — 세그먼트 '+u.segments)}"
```

```bash
# A messages — 영어와 값이 같은 키(고유명사 오탐 포함, 눈으로 거르기)
node -e "const fs=require('fs');const F=(o,p='',t={})=>{for(const[k,v]of Object.entries(o)){const K=p?p+'.'+k:k;typeof v==='string'?t[K]=v:v&&typeof v==='object'&&F(v,K,t)}return t};const en=F(JSON.parse(fs.readFileSync('messages/en.json','utf8')));for(const L of ['ko','ja','zh','zh-TW','es','fr','de','it','ru']){const m=F(JSON.parse(fs.readFileSync('messages/'+L+'.json','utf8')));const g=Object.keys(en).filter(k=>m[k]===en[k]&&/\p{L}/u.test(en[k])&&en[k].trim().split(/\s+/).length>=3);console.log(L+': '+g.length)}"
```

### 6-5. 🔴 이번에 배운 함정 — 다음 세션도 밟는다

1. **워크트리엔 `.env.local` 도 `node_modules` 도 없다.** 본체에서 복사 + 정션. `ERR_MODULE_NOT_FOUND` 는 크레딧 문제가 아니다.
2. **포인터 집합만 맞으면 통과한다 — 내용 완결성은 별개다.** `findTruncatedSegments` 가 잡지만, 직접 번역할 땐 **끝까지 옮겼는지 스스로 확인**하라.
3. **독일어 숫자 서식은 안전하다** — `numberMultiset` 은 숫자 런으로 쪼개므로 `5,5` 와 `5.5` 가 같다. 천단위 `1.000` 도 정규화된다.
4. **`**강조**` 개수를 맞춰라**(G6). 긴 설명문은 20~25쌍이 흔하다.
5. **`⟦G숫자⟧` 토큰은 그대로.** 번역·공백 삽입 금지(G2 즉시 실패).
6. **갤러리 캡션처럼 고유명사뿐인 문자열은 원문과 같아도 정상**이다(G9 flag, 발행됨).
7. **매니페스트 `pending` 을 잔여로 세지 마라** — 이미 DB 행이 있는 슬러그가 섞여 있다. **판정은 DB 로.**
8. 🔴 **`lib/tour-consumer-visibility.ts` 를 고치기 전에 반드시 `git fetch origin main` 하라.**
   이 세션에서 워크트리가 **52커밋 뒤처져** 있었고, 그 낡은 블록리스트에는 수원 3종·설악 3종이
   **아직 막힌 것으로** 들어 있었다(PR #748·#753 이 재오픈한 것들이다). 그대로 고쳐 머지했으면
   **방금 연 상품 6종을 다시 닫을 뻔했다.** 스크린샷의 라이브 목록과 파일이 어긋나면
   **파일이 낡은 것을 먼저 의심하라.**
9. **가시성은 두 쪽이 한 세트다** — `tours.is_active` + 전 로케일 `is_published` + 블록리스트.
   DB 플래그만 내리면 `/tours/list` 카드가 그대로 남는다(그 실측표가 그 파일 안에 있다).
   그리고 **라이브 판정 쿼리는 두 테이블을 조인**해야 한다: `is_published AND tours.is_active`.
10. 🔴 **「영어와 같은 값」 스캔의 3어절 필터가 미번역 구획을 숨긴다** — S1 실측(§6-3 하단).
    필터를 빼고도 한 번 세라. 대신 뺀 쪽은 오탐(고유명사·차용어)이 많으니 **눈으로 거르는 건 필수**다.
11. **de/fr 산출물을 참조할 때 그게 서로 어긋날 수 있다.** it `southwest` 작업 중 실측: 같은
    장소 라벨을 **페이지 갤러리에선 영어로, 스톱 갤러리에선 번역해서** 내보내고 있었다(de·fr 둘 다).
    → **판정은 `i18n-work/glossary/<loc>.json` 으로 하라.** 거기 규칙이 정본이다
    (「고유명사 로마자 유지 · 수식어만 번역」). 앞선 로케일을 그대로 베끼면 그 드리프트를 물려받는다.
12. 🔴 **숫자를 말로 풀면 G3 가 실패로 잡는다 — 세 번 반복했다.** it 에서 `1.5 km` → `il chilometro
    e mezzo`, ru 에서 `1 km` → `километровый` **두 번**. 서식(`1,5`·`1 000`)은 정규화되지만
    **철자로 푼 숫자는 소실로 잡힌다.** 로망스어·러시아어 모두 「1km」를 형용사로 만드는 게
    자연스러워서 손이 그리로 간다 — **숫자는 숫자로 남겨라.**
13. **러시아어에는 G10(키릴 비율 60%) 게이트가 따로 있다.** 짧은 나열형 세그먼트에서 라틴 브랜드명
    하나가 비율을 깬다 — `Хёпчэ, ⟦G0⟧, Osulloc, Эволь` 가 59% 로 실패했다.
    해법은 전사가 아니라 **글로서리 정식명 사용**(`Чайный музей Osulloc`)이다. 브랜드를 억지로
    키릴로 바꾸지 마라.
14. 🔴 **매니페스트의 `pending` 에는 은퇴 상품이 섞여 있다(§6-5-7 의 실제 사례).**
    ru pending 77 unit 중 **14 unit 이 `jeju-cruise-shore-excursion-bus-tour`** 인데 이 슬러그는
    `is_active=false` + `is_published=false` 즉 **은퇴 상품**이다. 사장님 라이브 전용 규칙(§0-3-1)에
    따라 범위 밖 → **실제 잔여는 63 unit / 6슬러그.** 매니페스트만 보고 착수했으면
    **팔지도 않는 상품에 세션 하나를 통째로 썼다.**
15. 🔴 **`apply.ts` 의 「포인터 불일치」는 대개 정상 드리프트지만, 세어 보지 말고 *어떤* 포인터인지 봐라.**
    실측: jeju-eastern 9 · **gyeongju 135** · cruise 24 — 전부 갤러리 `alt`/`caption`/`location` 이었다.
    gyeongju 는 EN 갤러리가 추출 이후 **35 → 9 로 잘렸고**, 그래서 이미 발행된 de/fr/it 는 낡은 35개를
    아직 들고 있다(적용 603 vs ru 468). 즉 **payload 가 작은 쪽이 최신이다** — 잘림이 아니다.
    확인은 EN payload 를 직접 조회해 포인터 존재를 보는 것. 산문·요금·시각 포인터가 하나라도 섞여
    있으면 그건 드리프트가 아니라 재추출 신호다. 커버리지는 **unit 단위**라 이 숫자와 무관하다.
16. 🔴 **TM 자동 재사용은 문맥 의존 문자열에서 거짓말한다.** cruise 슬러그는 이미 번역한 것과
    **40.3% 가 정확히 같은 원문**이라 재사용이 크게 이득이었는데, 같은 원문이 두 값을 갖는 소스가
    **23건** 있었다. 대부분은 `мин.`/`мин` 차이(앞 세션 잔재)지만 **`High` 는 진짜다** —
    `Фотопотенциал`(남성) 은 `Высокий`, `Пригодность для семей`(여성) 은 `Высокая`.
    → **값이 둘 이상인 소스는 자동 재사용에서 빼고 손으로 정하라.**
17. 🔴 **같은 본문이 `\n\n` 있는 판과 없는 판으로 두 번 들어 있다.** cruise 슬러그의
    `itineraryStops/*` 와 `itinerary_variants/0/stops/*` 가 그렇다. 두 번 번역하면 그 자체가 드리프트다 —
    **문단 구분만 접었다 폈다 해서 파생시켜라.**
18. 🔴 **기계 태그를 번역하면 매칭이 깨진다 — 그리고 라이브에 그 사고가 이미 있다.**
    `theme_tags_in_variant`(`volcano`·`coast`·`culture`·`alpine`…)는 en·fr·it·ja 넷이 원문을 유지하는데
    **de 만 번역했다**(`Vulkan`·`Küste`). de 조차 `iconic_landmarks`·`first_time_friendly` 는 남겼다 —
    **밑줄이 있으면 태그로 보이고 낱말처럼 생기면 번역해 버린 것**이 그 증거다.
    `liveStatusWidget`·`bgClass`·`iconBg` 도 같은 부류. **규칙 6(빈 문자열 + note)** 로 두면
    apply 가 영어로 폴백해 값이 같아지고 G9 플래그도 안 난다.
19. 🔴 **숫자를 관용구로 바꾸면 G3 가 잡는다 — §6-5-12 의 다른 얼굴이고, 이번에 세 번 더 밟았다.**
    `Top-3`→`трёх` · `24/7`→`круглосуточный` · `24 hours`→`круглосуточно` 전부 실패.
    셋 다 러시아어로는 **더 자연스러운** 표현이라 손이 그리로 간다 — 그게 함정이다.
    ⚠ 반대로 **12시제→24시제는 안전하다**: `around 2 pm`→`около 14:00` 은 게이트의
    `clockNotationLosses` 가 흡수한다(gates.ts:267 에 그렇게 적혀 있다). 로마 숫자(`7th`→`VII`)와
    연대 축약(`1970s`→`1970-е`)도 흡수된다. **흡수되는 것과 실패하는 것을 헷갈리지 마라.**

### 6-6. ⚠ 원문 자체의 결함 2건 — 번역이 아니라 **콘텐츠 티켓**이다

규칙 8(원문 수정 금지)에 따라 **그대로 옮겼다.** 고칠 사람은 콘텐츠 쪽이다.

1. 🔴 **`southwest-hallasan-osulloc-aewol` 의 천제연 영업시간이 한 페이지에서 서로 다르다** —
   `visitBasics.hours` 는 **09:00–17:50(최종입장 17:10)**, 같은 스톱의 `description` 끝은
   **09:00–18:00(최종입장 17:30)**. 손님이 보는 시각 정보이고 **전 로케일에 그대로 복제된다**
   (en·ko·ja·zh·zh-TW·es·de·fr·it 전부). 원문(en)을 고치고 재추출해야 닫힌다.
2. **`home.customJoinTour.*` 124키는 앱 코드에서 아무도 읽지 않는다.** 리터럴 `customJoinTour`
   가 `messages/*.json` 밖에서는 `scripts/i18n-loc-c-translations.mjs` 한 줄뿐이고, 그 줄이
   참조하는 `verifySuccessKo` 는 **en.json 에 존재하지도 않는다.** 즉 이 플랜 §3-a 가
   「예약 퍼널」이라며 최우선으로 꼽았던 124키는 **사문(死文)일 가능성이 높다.**
   🔴 **키 삭제는 이 트랙의 범위가 아니다**(§0-2 — 키 추가·삭제 금지). 별도 티켓으로 확인하라.
   그 안의 `verifySuccess{En,Ja,Zh,ZhTw,Es}` 는 **로케일별 값이 아니라 「그 언어로 된 상수」**다
   (접미사가 대상 언어를 가리킨다) — 그래서 9개 로케일 파일 전부에서 같은 값이어야 정상이고,
   ⚠ **`de` 만 `verifySuccessEn` 을 독일어로 번역해 두었다**(누군가 미번역으로 오인한 흔적).

---

## §R 검수 — 사람 게이트 대신 **검수 에이전트**가 한다

🔴 **사장님 지시(2026-08-07): 사람 검수 게이트는 운영이 불가능하다.**
그래서 이 트랙의 모든 「사람 검수 대기」는 **`i18n-reviewer` 에이전트**로 대체한다.
정의: **`.claude/agents/i18n-reviewer.md`**.

### R-1. 왜 별도 에이전트인가 — 이게 설계의 핵심이다

🔴 **번역한 맥락에서 검수하면 자기 글을 승인하게 된다.** 그래서 검수는 **번역과 다른 호출**
(다른 세션 또는 서브에이전트)에서 돌린다. 이건 편의가 아니라 **판정의 독립성** 문제다.

그리고 검수관은 **게이트가 못 보는 것만** 본다. 원래 플랜 §3-[4]「적대적 역번역」이
**규정만 되고 구현된 적이 없던** 자리가 정확히 여기다.

| | 누가 | 무엇 |
|---|---|---|
| 결정론 | `i18n:verify` (G1~G11) | 숫자·토큰·통화·플레이스홀더·마크업·길이비·문자셋·구조 |
| **의미** | **`i18n-reviewer`** | **뜻이 뒤집혔는가 · 절이 사라졌는가 · 없던 정보가 생겼는가 · 용어·문체** |

**게이트를 통과한 것(fail 0)만 검수관에게 보낸다.** 이미 기계가 100% 잡는 걸 다시 세게 하면
검수관의 주의가 거기 쏠려 정작 볼 것을 못 본다.

### R-2. 심각도와 판정

`S1` 사실 왜곡(포함↔불포함, 부정문 소실, 조건 누락) → `blocked` · `S2` 정보 손실/추가 →
`blocked` · `S3` 용어 불일치 · `S4` 문체·격식 · `S5` 표기 관례 → `flagged`.
판정은 `approved`/`flagged`/`blocked`/`unreviewable`.

🔴 **확신 없으면 통과시키지 않는다.** 모르면 `unreviewable` 로 남긴다 — 조용한 통과가 최악이다.
🔴 **관례를 결함으로 올리지 않는다** — `24 hours`→`rund um die Uhr`, `1970s`→`anni Settanta`,
`6:30 p.m.`→`18:30` 은 정상이다(이걸 결함으로 올린 전례가 있어 게이트를 고쳐야 했다).

### R-3. 무엇을 검수하는가 — 우선순위

1. 🔴 **POI 433건**(§4-P2) — 지금 approved 를 막고 있는 것. **기계번역이 손님에게 나간다.**
2. 내가 번역한 투어 콘텐츠 — **S1 필드 우선**(`visitBasics`·`pickup_dropoff`·요금·FAQ).
   손님이 손해를 보는 건 산문이 아니라 **시각·요금·포함여부**다.
3. `messages/*.json` — 짧고 맥락이 적어 오역이 눈에 안 띈다. 배치로 훑는다.

### R-4. 파일 계약 — 여기도 진척은 파일이다

입력 배치 **40~60 포인터**(그 이상은 뒤로 갈수록 판정이 무뎌진다) →
출력 `i18n-work/review/<surface>/<locale>/<batch>.json`.
**`approved` 는 생략하고 결함만 적는다** — 파일이 곧 할 일 목록이 된다.
판정 파일이 없는 배치가 다음 세션의 대상이다.

### R-5. 🔴 검수 결과를 어떻게 쓰는가

- `blocked` → **재번역**. 그 unit 의 출력 파일을 지우면 다음 실행이 다시 집는다
  (`--force` 쓰지 마라 — 멀쩡한 유닛까지 다시 돈다).
- `flagged` → 발행하되 기록. `flagged` 는 이미 `PUBLISHABLE` 이다.
- POI 는 `blocked` 0 인 로케일만 `content_locale_status` 를 `approved` 로 올린다.

---

## §7 다음 세션 첫 명령

**사장님 결정은 전부 끝났다(§0-3). 다음 세션은 확인 없이 바로 번역에 들어가면 된다.**

```bash
cp /c/Users/sangsong/atockorea/.env.local .env.local
```
```powershell
New-Item -ItemType Junction -Path .\node_modules -Target C:\Users\sangsong\atockorea\node_modules
```

✅ **S1 · S2 · S3a~S3f 는 2026-08-07 에 끝났다.** **러시아어 트랙 종료 —
지금 라이브인 21종 중 ru 행이 없는 슬러그는 0개다**(판정은 DB 조인 쿼리, 아래).

✅ **S13 도 끝났다(2026-08-07)** — 8슬러그 × 4로케일 추출 완료, 입력이 전부 `i18n-work/in/` 에 있다.
**남은 건 순수 번역이다: 328 unit · 1,181,476자**(§6-3′ 에 슬러그별 실측표).

🔴 **다음 세션은 배치를 슬러그군 × 한 로케일로 잡아라**(§6-3 하단 규약).
수원 3종은 뼈대가 같아 로케일당 고유 세그먼트가 321~334 로 거의 겹치고, 설악 2종도 마찬가지다.
로케일별로 흩으면 그 이득을 버린다. 권장 순서:
**① 수원 3종(de) → ② 설악 2종(de) → ③ 부산 소그룹(de) → ④ 서울근교+부산전세(de) → fr·it·ru 반복.**

🔴 **`jeju-cruise-shore-excursion-bus-tour`(14 unit · 712 세그먼트)는 매니페스트에 남아 있지만 범위 밖이다** —
은퇴 상품이다(§6-5-14). `npm run i18n:verify -- --locale=ru` 의 「미번역 14 unit」이 정확히 이것이고,
**0 이 되면 안 된다.** 세지 마라.

용어는 **지어내지 말고 이미 발행된 ru 행에서 가져와라**(§6-5 아래 「ru 착수 메모」).
슬러그 하나가 100% 되면 그 자리에서 발행하라(`--partial` 금지).

### 🔴 ru 트랙 종료 기록 (2026-08-07, S3d~S3f) — de/fr/it 를 할 때 그대로 쓴다

**라이브 ru 행 21/21 완비.** 이 세션에서 확정한 것 중 다음 로케일에도 그대로 적용되는 것:

- 🔴 **`glanceItems` 라벨이 ru 안에서 두 갈래로 갈려 있었다.** 제주 3행은
  `Насыщенность пейзажами`/`Сложность пеших участков`, 부산 2행은 `Пейзажи`/`Ходьба` —
  **영문 라벨은 같은데 러시아어가 다르다.** 플랜 §7-1 이 이름한 제주 쪽(3행 대 1행)으로 통일했다.
  **부산 행이 이상치이고, 그걸 고치는 건 별도 티켓이다** — 번역 도중에 손대지 마라.
  ⚠ 단 크루즈 슬러그는 **영문 라벨 자체가 다르다**(`Photo Value`·`Scenic`·`Rain Safety`·`Family Fit`) —
  다른 영어를 다르게 옮기는 건 드리프트가 아니다. `Duration` → `Продолжительность` 는 부산 크루즈 행에서.
- **경주·크루즈에서 새로 고정한 표기**(다음 로케일도 이 뜻으로 옮겨라):
  `Хваннидан-гиль`(황리단길, ㅇ+ㄹ 비음동화) · `Кённидан-гиль` · `выпечка Хваннам`(황남빵) ·
  `Кёдон Попчу` · `Ёсоккун` · `Соль Чхон` · `Чхонмачхон` · `Хваннамдэчхон` · `Комунорым` ·
  `Ильчжумун`·`Чхонунгё`·`Пэгунгё`·`Тэунджон`·`Таботхап`·`Соккатхап`·`Пироджон`·`Кыннакчон` ·
  `порт Канджон` · `время окончания посадки на судно`(all-aboard) · `отход судна`(sail-away).
- 🔴 **`Damyang Juknokwon` 은 로마자로 남겼다** — Kontsevich 유도가 비음동화 연쇄에서 갈린다.
  §7-6 의 기준을 그대로 적용한 것이고, `Oedolgae`·`Gotjawal`·`Seogwang Dawon` 과 같은 부류다.
- **드라마 제목은 원어 유지**가 이번에도 유지됐다: `«Dae Jang Geum»` · `«The King: Eternal Monarch»` ·
  `«Moon Lovers»` · `«All In»` · `«My Girl»`.

### 🔴 ru 착수 메모 — 이 셋을 먼저 하면 재작업이 없다

1. **기존 ru 행에서 용어를 뽑아라.** `messages`·글로서리만으로는 부족하다. 실제로 쓰인 형태:
   `Фотопотенциал` · `Насыщенность пейзажами` · `Сложность пеших участков` · `Пригодность в дождь` ·
   `Темп` · `Обзор/Маршрут/Детали/FAQ/Отзывы` · `Чунмун` · `морское ушко` ·
   `чеджуская чёрная свинина` · `пибим-куксу` · `хэнё` · `лицензированный англоговорящий водитель-гид` ·
   `индивидуальный чартер автомобиля`. 조회: `SELECT detail_payload FROM tour_product_pages WHERE locale='ru'`.
2. **고유명사는 `glossary/ru.json`(Kontsevich)에서만.** 없으면 **로마자 유지**가 정답이다
   (styleguide: 잘못된 전사는 존재하지 않는 지명을 만든다).
   🔴 지금까지 그렇게 남긴 것: **`Oedolgae` · `Gotjawal` · `Seogwang Dawon`.** 뒤 세션도 그대로 두라
   — 한 슬러그에서만 키릴로 바꾸면 그게 곧 드리프트다. (`Oedolgae` 는 손으로 유도해 보니
   **Ведолькэ / Ведольге 두 답**이 나왔다. 중간 자음 유성화 여부에서 갈린다 — 정확히 이런 경우를
   styleguide 가 경고한다.)
3. **G10(키릴 60%)과 G3(숫자)를 의식하고 써라** — §6-5-12·13.
4. 🔴 **호텔 브랜드명만으로 된 세그먼트는 G10 을 통째로 실패시킨다**(키릴 0자).
   해법은 **수식어를 번역하고 브랜드는 남기는 것** — `Ocean Suites Jeju Hotel` →
   `отель Ocean Suites Jeju`.
   ⚠ **이미 발행된 `jeju-grand-highlights-loop` ru 행에는 원문 그대로 `Ocean Suites Jeju Hotel` ·
   `LOTTE City Hotel Jeju` 가 들어 있다 — 지금 게이트로 재면 실패한다.**
   즉 **라이브 ru 데이터가 일관되게 게이트를 통과한 상태가 아니다.** 기존 행을 참고할 땐
   용어는 가져오되 **게이트 적합성까지 믿지는 마라.**
5. **드라마 제목은 원어 유지**(`«All In»` · `«Dae Jang Geum»` · `«Boys Over Flowers»`).
   러시아 개봉명으로 바꾸지 마라 — 슬러그마다 갈리면 그게 드리프트다.
   ⚠ 단 **영어 제목만 든 짧은 줄은 G10 을 깬다**(55%). 같은 문서가 이미 말한 「K-드라마」를
   되풀이해 주면 풀린다 — `место съёмок корейской дорамы **«…»**`.
6. 🔴 **`Ихо Тхэу`·`Хандам` 은 전사하고 `Oedolgae`·`Gotjawal`·`Seogwang Dawon` 은 로마자로 둔다.**
   기준은 취향이 아니라 **Kontsevich 유도가 자음 유성화에서 갈리는가**다. 갈리면 로마자,
   안 갈리면 전사. 어차피 **맨 지명 라벨은 G10 이 키릴을 강제**한다(`Пляж Iho Tewoo` = 33%).
7. 🔴 **`npm run i18n:verify` 는 스크립트 혼입을 못 잡는다 — 별도로 훑어라.**
   이 슬러그에서 키릴 단어 안에 **한자·타밀·말라얄람 글자가 각각 하나씩** 박혀 있었다
   (`Чеджу形` · `Кваகчи` · `Кваകчи` · `Дни長`). G1~G11 어디에도 「문자 체계 혼입」 검사가 없고,
   눈으로는 글자가 비슷해 그냥 읽힌다. 실행:
   ```bash
   node -e "const fs=require('fs');const d='i18n-work/out/tour_product_pages/ru';for(const f of fs.readdirSync(d)){const j=JSON.parse(fs.readFileSync(d+'/'+f,'utf8'));for(const[k,v]of Object.entries(j.segments)){const m=v.match(/[^Ѐ-ӿ -ɏ가-힯一-鿿　-〿 -⁯₠-⃏⟦-⟿←-⇿∀-⋿№㎡\s ]/g);if(m)console.log(f,k,[...new Set(m)].join(' '))}}"
   ```
   (⟦⟧·화살표·₩·№·㎡ 는 정상이라 화이트리스트에 있다.)

### 착수 전 30초 — 이것만 확인하라

```bash
git fetch origin main && git rev-list --count HEAD..origin/main   # 0 이 아니면 먼저 머지
```
🔴 **라이브 목록은 매번 DB 로 다시 재라.** 병행 세션이 상품을 열고 닫는다 —
이 플랜을 쓰는 동안에도 가평이 닫혔고, 수원·설악 6종은 내 워크트리가 낡아서
「막혀 있다」고 잘못 볼 뻔했다(§6-5-8).

```sql
SELECT e.slug FROM tour_product_pages e JOIN tours t ON t.slug=e.slug
WHERE e.locale='en' AND e.is_published AND t.is_active ORDER BY e.slug;
```

### 이 플랜이 끝나는 조건

**라이브 20종 + 신규 부산 프라이빗이 de/fr/it/ru 4언어 완비 → 그때 게이트를 연다.**
그 전에는 열지 않는다(행 없는 슬러그의 폴백 동작이 미검증이다 — 여는 세션이 먼저 실측하라).
