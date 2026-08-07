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

### 🔴 2-a′. **최종 범위 (2026-08-07 갱신) — 라이브 20종 · 35행**

비공개 2종을 내린 뒤 실측. 판정 쿼리는 `is_published AND tours.is_active` 조인이다
(둘 중 하나만 보면 틀린다).

| 그룹 | 슬러그 | 부족 |
|---|---|---|
| **G2** ru 만 | `from-busan-gyeongju` · `jeju-cruise-small-group` · `jeju-eastern` · `jeju-island-private-car` · `jeju-southern` | 5 |
| **G1** | `southwest-hallasan-osulloc-aewol` | it, ru = 2 |
| **G3** 🔴 미추출 | `busan-small-group-sightseeing-tour-cruise-passengers` · `seoul-seoraksan-naksansa-temple-naksan-beach-day-trip` · `seoul-seoraksan-nami-island-morning-calm-day-tour` · `seoul-suburbs-private-chartered-car-10hr` · `seoul-suwon-hwaseong-folk-village-starfield-library` · `seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library` · `seoul-suwon-hwaseong-waujeongsa-starfield` | 7×4 = **28** |
| **G4** | 다른 세션이 추가중인 **부산 프라이빗 투어** — 나타나면 4행 | +4 |

**완비 6종:** busan-cruise-bus · busan-private-charter-cruise · busan-small-group-yonggungsa ·
busan-top-attractions · incheon-seoul-private-car · jeju-grand-highlights ·
seoul-winter-eobi. (이 목록도 매번 다시 재라 — 병행 세션이 바꾼다.)

⚠ **G3 7종은 `i18n:extract` 부터** 해야 한다. G1·G2 의 84 unit 은 이미 `in/` 에 있다.

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
| **S1** | §3 `messages/*.json` 잔여 134 | ~6,000자 | **1** | UI+챗봇 동시 |
| **S2** | it `southwest` 7 unit | 28,819자 | **1** | **1행** |
| **S3~S12** | ru 6슬러그 63 unit | 262,350자 | **10** | **6행** |
| **S13** | 🔴 **G3 7슬러그 추출**(`i18n:extract` ×4로케일) | — | **1** | 도구 |
| **S14~S48** | G3 7슬러그 × 4로케일 | **추정 968,884자** | **35** | **28행** |
| **S49** | 신규 부산 프라이빗(다른 세션 산출물) | 미정 | **1~2** | 4행 |
| **P1** | POI 빠진 로케일 126건 | 소규모 | **2~3** | §4 |
| **R** | 검수(§R) — 번역과 **다른 세션**에서 | 병행 | 배치당 40~60 | §R |

**합계 원문 약 1,260,000자 → 46세션(추정).**
⚠ **TM 중복제거가 이걸 크게 깎는다** — ru 6슬러그 실측이 **62.6%** 였다(고유 533/전체 1,425).
다만 **깎인 뒤 숫자를 계획에 쓰지 마라**: 중복률은 슬러그 조합마다 다르다. 총량으로 잡고
실제로 빨라지면 그건 이득으로 두는 편이 낫다.

🔴 **G3 가 전체의 77% 다.** S1~S12(12세션)까지 하면 **라이브 20종 중 13종이 4언어 완비**가 되고,
남은 7종이 G3 다. **게이트는 그 7종까지 끝난 뒤에 연다**(§0-3).

### 6-3′. G3 7슬러그 — 추출부터 해야 한다

| 슬러그 | payload | 번역대상(추정) |
|---|---|---|
| `busan-small-group-sightseeing-tour-cruise-passengers` | 132,554 | 59,600 |
| `seoul-suburbs-private-chartered-car-10hr` | 79,229 | 35,700 |
| `seoul-suwon-hwaseong-folk-village-starfield-library` | 69,482 | 31,300 |
| `seoul-suwon-hwaseong-waujeongsa-starfield` | 69,393 | 31,200 |
| `seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library` | 68,586 | 30,900 |
| `seoul-seoraksan-nami-island-morning-calm-day-tour` | 60,483 | 27,200 |
| `seoul-seoraksan-naksansa-temple-naksan-beach-day-trip` | 58,542 | 26,300 |

**번역대상 추정은 payload × 0.45** 다. 이 비율은 **추출 끝난 4슬러그로 실측**했다
(0.32~0.65, 평균 0.45). 🔴 **폭이 넓으니 S13 추출 직후 실제 `sourceChars` 로 다시 재고
이 표를 갱신하라** — 여기 숫자는 계획용이지 결과가 아니다.

**수원 3종은 서로 매우 닮았다**(같은 화성+스타필드 뼈대). 한 세션에 3종을 같은 로케일로
묶으면 TM 이 가장 크게 듣는다. 설악 2종도 마찬가지다.

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

그리고 **S1 — `messages/*.json` 잔여 134건**부터. 가장 싸고, UI 와 챗봇 색인을 동시에 채운다.
(`home.customJoinTour` 는 2026-08-07 에 끝냈다. 남은 건 `home.premium`·`settingsPage`·
`errors`·`toursList`·`itineraryBuilder`.)

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
