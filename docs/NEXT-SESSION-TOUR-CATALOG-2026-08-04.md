# 투어 카탈로그 개편 (2026-08-04) — **종결**

> ## ✅ DB 반쪽 적용 완료 (2026-08-04)
>
> `2026-08-04-0{1..7}.sql` 7개 전부 라이브 적용 + `import-match-v18 --single` 6슬러그.
> 검증 21항목 전부 통과(아래 §2′). 파일은 `pending-db-apply/applied/` 로 이동했고
> **pending 루트에는 2026-06-24 잔여 2건만 남았다**(이 트랙과 무관).
> 이 문서의 나머지는 그 작업의 기록이다 — 지시대로 다시 실행할 것은 없다.

---

## 0′. 적용하며 드러난 것 (🔴 다음 배치가 이걸 먼저 읽어라)

**적용은 첫 시도에 깨졌다.** 두 번째 파일에서:

```
column "badges" is of type text[] but expression is of type jsonb
```

`tour_product_pages.badges` 는 `text[]` 인데 `tours.badges` 는 **같은 이름의 jsonb** 다.
생성기 4개가 두 곳에 같은 `jsonb()` 헬퍼를 썼고, 페이지 쪽만 틀렸다.

🔴 **이건 새 버그가 아니다 — 2026-06-24 배치에서 똑같이 터졌던 것이다.**
그때는 **적용 스크립트가 메모리에서 SQL 을 고쳐서** 넘어갔고 **생성기는 안 고쳤다.**
그래서 두 달 뒤 같은 생성기가 같은 SQL 을 또 뱉었다.

**이번엔 생성기를 고쳤다** — `textArray()` 헬퍼 추가 + 페이지 컨텍스트 5곳 교체
(`gen-jeju-east-reorder` · `gen-busan-smallgroup` ×2 · `gen-pocheon-geopark` ·
`gen-gyeongju-recourse`) → 재생성 → diff 는 정확히 badges 32줄(파일×로케일)만 바뀌었다.

**그리고 게이트를 붙였다** — `__tests__/audit/pendingSqlColumnTypes.test.ts` +
스냅샷 `data/db-column-types.json`. 컬럼↔값을 위치로 짝지어 jsonb↔text[] 뒤집힘을 잡는다.
게이트를 처음 돌리자마자 레거시 1건(`applied/2026-06-24-07-jeju-eastern-...sql`)을
찾아냈다 — 위 기록이 정확했다는 증거다(그 파일은 `KNOWN_LEGACY` 에 이유와 함께 등록).

> **교훈:** 기존 `schemaDrift` 게이트는 **테이블 이름만** 본다. 컬럼 타입은 아무도
> 안 봤고, 그래서 같은 실패가 두 번 통과했다. **적용 시점의 우회는 수정이 아니다 —
> 생성기를 고치지 않으면 반드시 돌아온다.**

### 적용 경로 (psql 없는 워크트리에서)

이 워크트리엔 `psql` 도 DB 연결 문자열도 없었다. 스크립트가 안내하는 **B 경로**를 썼다:
임시 `public._atoc_pending_exec(text[])`(SECURITY INVOKER, `service_role` 전용 ACL)를
만들고, 인용부호를 아는 로컬 스플리터로 파일을 문장 배열로 보내 **파일당 한 트랜잭션**으로
실행한 뒤 헬퍼를 즉시 DROP. 그다음 `npm run tours:apply-2026-08-04 -- --skip-sql` 로
match 동기화 + 검증만 마저 돌렸다. (SQL 본문이 컨텍스트를 통과하지 않아 MCP 인라인 한계도 피한다.)

---

## 0. 로컬 세션 첫 명령 (원커맨드)

```bash
npm run tours:apply-2026-08-04 -- --dry-run   # 계획만 출력, DB 무변경
npm run tours:apply-2026-08-04                # 실제 적용
```

`scripts/apply-tour-catalog-2026-08-04.mjs` 가 하는 일 — **멱등, 재실행 안전**:

0. **사전 점검** — env, SQL 파일 존재, 부산 번들 10로케일 파스 + 가격 일치,
   SQL 03 의 offers 금액이 번들 가격과 같은지(어긋나면 생성기 재실행하라고 알려주고 중단)
1. `-01` → `-02` → … → `-07` **파일명 순서대로** `psql` 로 적용
   (각 파일이 단일 트랜잭션 — 실패하면 그 파일은 통째로 롤백되고 뒤 파일은 실행되지 않는다)
2. `import-match-v18.mjs --single` **5슬러그** 실행 → 추천엔진 `match_tours` 동기화
   (포천 패스가 신규 `jaein_falls` POI 를 `match_pois` 에 함께 임포트한다)
3. **검증** — 수국 2종 `is_active=false` · 제주 3종 + 부산 `is_active=true` ·
   `tours.price` 가 번들과 일치 · 페이지 로케일별 `is_published`(콘텐츠 6 + 스테이징 4) ·
   부산 offers 2행($59 기본 / $79 캡슐 포함) · 포천 스톱 4개 + 픽업/하차 2/2 · `match_tours` 5행
4. 적용 성공 + 검증 통과한 SQL 만 `pending-db-apply/applied/` 로 이동
   (검증 실패 시 파일을 그대로 두어 재시도 가능하게 남긴다)

**필요 env** (`.env.local` 에서 읽음):
`NEXT_PUBLIC_SUPABASE_URL`(또는 `SUPABASE_URL`) · `SUPABASE_SERVICE_ROLE_KEY` ·
그리고 SQL 적용용 연결 문자열 `SUPABASE_DB_URL`(또는 `DATABASE_URL`/`POSTGRES_URL`).

**연결 문자열이 없거나 `psql` 이 없으면** 스크립트가 두 갈래 안내를 출력하고 **아무것도 쓰지 않고 중단**한다:
(A) 연결 문자열을 주고 재실행, 또는 (B) SQL 을 Supabase MCP/SQL 에디터로 직접 적용한 뒤
`npm run tours:apply-2026-08-04 -- --skip-sql` 로 2~4단계만 마저 돌리기.

> ⚠ `--dry-run` 없이 돌리면 **라이브 소비자 DB 에 쓴다**. 그게 이 작업의 목적이다.

---

## 1. 사장님 지시와 그 결과 (2026-08-04)

| 지시 | 결과 | PR |
|---|---|---|
| 수국(hydrangea) 상품 내리기 | 2종 블록리스트 + DB 플래그 off | #711 |
| 제주 동/남/서남 투어 오픈 | 3종 블록리스트 해제 + DB 플래그 on | #711 |
| 동부 코스 변경 | 만장굴→성읍→점심→성산→해녀쇼→함덕 (6로케일 재작성) | #711 |
| 남/서남 코스 변경 | **이미 요청 코스와 일치**(v18, 2026-06-24) — 플래그만 | #711 |
| 부산 스몰그룹 신규 | 용궁사→다릿돌→스카이캡슐(티켓 선택)→점심→감천→닥밭골 | #714 |
| 부산 가격 | **$59 캡슐 제외 / $79 캡슐 포함** (사장님 확정) | #714 |
| 신규 투어 10로케일 번역 | de/fr/it/ru 풀 번들 추가 → 10로케일 완비 | #717 |
| 포천 투어 개편(경쟁사 스크린샷) | 허브아일랜드 → 재인폭포 + 이동갈비 점심, 한탄강 지질공원 서사, 10로케일 | #720 |
| 포천 픽업/드롭오프(사장님 이미지) | 3지점 → **2지점**(홍대 8번 08:00 / 명동 2번 08:30 → 명동 18:00 / 홍대 18:30), 전 스톱 재산정 | #720 |

기준선: tsc **0** · jest **559 스위트 / 5,926 pass / 0 fail**. POI KB **v1.30**(`jaein_falls` 신규).

---

## 2. 지금 라이브인 것 / 아직 아닌 것

**레포(배포 완료, Vercel green):**
- 수국 2종은 **모든 소비자 표면에서 이미 사라짐** — 블록리스트가 앱 레이어에서 거르므로 DB 무관.
- 제주 3종 + 부산 신규는 **정적 카탈로그**(`/tours/list`)와 **상세 페이지**(`/tour-product/...`)에 노출.

**~~DB 미적용이라 아직 안 되는 것~~ → ✅ 전부 닫혔다 (2026-08-04):**
- ~~`/api/tours` 기반 목록·홈 피드~~ · ~~챗봇/매처 추천~~ · ~~`/tour/[id]/checkout` 결제 진입~~

### §2′ 적용 후 검증 결과 (21/21 통과)

| 항목 | 결과 |
|---|---|
| 수국 2종 `is_active=false` | ✓ ✓ |
| 제주 동/남/서남 `is_active=true` | ✓ ✓ ✓ |
| 부산 신규 `is_active=true` · `tours.price=59` | ✓ ✓ |
| 부산 offers 2행 | ✓ 기본 $59 / 캡슐 포함 $79 |
| 페이지 발행 로케일 | 남·서남 6 · 부산 콘텐츠 6 + 스테이징 4 |
| `match_tours` 6슬러그 | ✓ ×6 (경주·포천 포함 — 구 코스 잔존 해소) |

**두 가지 관찰(결함 아님, 기록용):**
1. **제주 동부는 9로케일이 발행됐다**(de/fr/it 포함). 파일 01 의 무조건
   `UPDATE tour_product_pages SET is_published=true WHERE slug IN (…)` 가 i18n 트랙이
   스테이징해 둔 행까지 켠 것이다. **누수는 아니다** — 확인함:
   `TOUR_PRODUCT_FALLBACK_URL_LOCALES = ["fr","de","it","ru"]`
   (`app/(marketing)/tour-product/[slug]/tourProductPageBody.tsx:53`) 가 그대로라
   손님은 여전히 EN 을 본다. 오픈은 여전히 사장님 결정이다.
2. **경주는 가시성 무변경**을 적용 전후 대조로 확인했다 — `is_active=false` ·
   `is_featured=false` · `price=39.00` · 6로케일 전부 `is_published=false`.
   07 은 상품이 **무엇을 말하는지만** 고쳤다.

역방향 노출 위험은 없다: 수국은 앱에서 이미 숨겨져 있고, 신규/재오픈 상품은 DB 가 붙기 전까지
정적 표면에만 보인다.

---

## 3. 파일 지도

### 제주
- 블록리스트(두 쪽 중 레포 쪽): `lib/tour-consumer-visibility.ts` — 수국 2종 추가, 3종 제거
- 동부 재코스 변환기: `scripts/jeju-east-reorder-2026-08.mjs`
  + 콘텐츠 `scripts/jeju-east-reorder-content/<loc>.json` (6로케일)
- 동부 DB 동기화 생성기: `scripts/gen-jeju-east-reorder-sql-2026-08.mjs`

### 부산 신규 (`busan-small-group-yonggungsa-skycapsule-gamcheon-tour`)
- 빌더: `scripts/build-busan-smallgroup-2026-08.mjs` — **재생성은 항상 이걸로**. 번들 직접 편집 금지.
- 콘텐츠 스펙: `scripts/busan-smallgroup-content/<loc>.json` (10로케일)
- 도너 오버레이: `scripts/busan-smallgroup-content/donor-overlay/<loc>.json` (en + de/fr/it/ru)
  — 도너에서 가져온 스톱(픽업·용궁사·감천)과 UI 블록의 번역본
- 번들 출력: `components/product-tour-static/busan-small-group-yonggungsa-skycapsule-gamcheon-tour/*.json`
- SQL 생성기: `scripts/gen-busan-smallgroup-sql-2026-08.mjs` (파일 03 + 04 동시 출력)
- 등록 3곳: `_shared/tourProductBundleSlugs.ts` · `_shared/tourProductBundleRegistry.ts` ·
  `catalog/staticTourProductRegistry.ts`(SLUG_OVERRIDES `listPriceUsd: 59, maxGroupSize: 12`)
  + 날씨 앵커 `lib/weather/tour-weather-anchor.ts`

### 포천 (`pocheon-sanjeong-lake-herb-island-art-valley`)
- 빌더: `scripts/build-pocheon-geopark-2026-08.mjs` — 번들 직접 편집 금지
- 콘텐츠: `scripts/pocheon-geopark-content/<loc>.json` (10로케일) + `donor-overlay/`(de/fr/it/ru)
- SQL 생성기: `scripts/gen-pocheon-geopark-sql-2026-08.mjs` (05 + 06 동시 출력)
- 🔴 **슬러그에 `herb-island` 가 남아 있는 건 의도**다 — 라이브 Klook SKU 의 URL·OTA 링크.
  가지 않는 곳 이름이 주소에 있는 건 알고 남긴 비용이다. 바꾸려면 리다이렉트 + OTA 재연결이 세트.
- ⚠ **가격 불일치는 이 트랙이 만든 게 아니다**: 번들 $54 vs `SLUG_OVERRIDES.listPriceUsd` 49.
  개편 전부터 어긋나 있었고 일부러 손대지 않았다(사장님 결정).
  📌 **참고 데이터**: 사장님이 보낸 Klook 달력이 **54.55 USD** 로 표시된다 — 즉 **번들 $54 쪽이
  맞고 레지스트리 49 가 이상값**이다. 판단 근거는 생겼으니 사장님 확답만 받으면 정리 가능.
- 🔴 **운영 요일 = 월·목·토** (사장님 제공 Klook 달력, 2026-08-04). 개편 전 번들은
  **출발 요일을 아예 언급하지 않아서** 손님이 아무 날짜나 고르고 결제 단계에서야 막혔다.
  이제 카드 뱃지 · 「출발 요일」 아코디언 · FAQ · `lessIdealFor` · `matching_profile
  .available_days_signature` 에 10로케일로 들어 있다. 문구는 스펙(`departureDays` 블록)에 있고
  **빌더가 조립한다 — 번들을 직접 고치지 말 것.**
- 허브아일랜드 시절 매칭 시그널 6종(`mediterranean_herb_garden_fit`,
  `korea_largest_herb_museum_fit`, `year_round_lighting_festival_fit`,
  `korea_drama_filming_density_high_fit`, K드라마 2종)이 **재코스 후에도 1점으로 살아남아**
  가지 않는 스톱으로 추천을 끌고 있었다 → 빌더에서 삭제. 코드가 이름으로 읽는 곳은 없다.

### 카탈로그 카드(생성물 — 손으로 고치지 말 것)
`node scripts/build-catalog-cards.mjs` → `components/product-tour-static/catalog/catalogCards.*.generated.ts`

---

## 4. 🔴 이 트랙에서 배운 것 (다음 세션이 반복하지 말 것)

1. **"코스를 바꿔라"는 대개 콘텐츠 재작성이 아니다.** 남부·서남부는 v18 에 이미 요청 코스와
   글자 그대로 일치했다 — 6로케일 재작성을 시작하기 전에 **현재 `itineraryStops` 를 먼저 읽어라.**
   실제로 재작성이 필요했던 건 동부 하나뿐이었다.

2. **순서를 바꾸면 순서를 말하는 문장이 전부 거짓이 된다.** 동부 재편에서 고쳐야 했던 건
   배열 순서가 아니라 그 안의 산문이었다: `whyOnRoute`("첫 정차"·"마지막") · `routePhases` ·
   `routeShapeIntro` · 도보 안내 줄 순서 · 하차 예상 시각 · SEO · 카드 문구 · 갤러리 순서.
   **변환 스크립트를 쓰고, 로케일별 하드코딩 문자열은 `descReplace` 로 검증하며 치환하라**
   (못 찾으면 throw — 조용한 미치환이 최악이다).

3. **도너 재사용은 도너의 버그도 함께 가져온다.** 부산 신규 상품이 도너에서 상속한 것 중
   ① 픽업 스톱 설명이 도너의 뒷 스톱(유엔기념공원)을 언급 → 로케일별 패치로 해결
   ② 비EN 스티키 바 문구가 **개발 주석 오번역**(`checkout_tour_id…`) → `STICKY_NOTES` 로 우회.
   ⚠ **도너(`busan-top-attractions-day-tour`) 자체는 아직 이 버그를 라이브로 내보내고 있다** —
   별도 티켓. 아래 §6 참조.

4. **`page_sections` 는 미러다 — 빌더가 자동 동기화하지만 예외가 있었다.** `props.note`(스티키)는
   키 이름이 top-level 과 달라 EN 이 그대로 복사됐다. 10로케일 누수 스캔으로 잡았다.
   **번들 빌드 후에는 항상 "EN 원문 문자열이 비EN 번들에 남았는가" 스캔을 돌려라.**

5. **가격은 3곳에 있다** — 번들 `price`/`sticky_booking_bar.price`, `SLUG_OVERRIDES.listPriceUsd`,
   offers SQL(minor units). 하나만 고치면 화면과 결제가 어긋난다. 빌더+생성기를 다시 돌려서 맞춰라.

6. 🔴 **번들을 고쳐도 손님 화면은 안 바뀐다.** `tourProductPageBody.tsx:130` 이 **Supabase 우선**,
   레포 JSON 은 폴백이다. 손님에게 닿게 하려면 `tour_product_pages.detail_payload` 를 같이
   고쳐야 한다. 이번에 문구 수정 176건을 SQL 07 로 따로 만든 이유가 이것이다.
   **`detail_payload` 를 통째로 덮어쓰지 마라** — 어드민 Product Editor 가 같은 컬럼에 쓴다.
   경로 단위 `jsonb_set` + 원래 값 `WHERE` 가드가 정답(멱등 + 남의 편집 보존).

7. **"이 결함은 이 상품 하나"라고 적기 전에 스윕부터 하라.** §6 은 "도너 1건" 티켓으로 시작해
   **23개 상품 / 127파일**로 끝났고, 그 과정에서 **성격이 다른 두 번째 오염(번역가 노트 45건)**
   까지 나왔다. 그리고 `matching_metadata` 안의 `checkout_tour_id`·`user_port` 는 **결함이 아니라
   추천엔진 문서**다 — 스캔 결과를 경로별로 갈라 보지 않으면 멀쩡한 걸 고치게 된다.

8. **필드가 "라이브"인지 먼저 확정하라.** `lib/i18n/pipeline/segments.ts` 가 분류표다:
   `sticky_booking_bar` = **A1(렌더됨)**, `page_sections` = **DEAD**, `priceSource` = **FORBIDDEN**.
   같은 오염이라도 A1 이면 손님이 읽고 DEAD 면 아무도 안 읽는다. 이번에 `priceSource
   .discountNote` 를 처음엔 "라이브 손님 노출"로 잘못 적었다가 분류표를 보고 정정했다.

---

## 5. 사람 게이트 (코드 아님)

1. **de/fr/it/ru 오픈 결정** — 번역은 완비됐지만 `TOUR_PRODUCT_FALLBACK_URL_LOCALES`
   (`app/(marketing)/tour-product/[slug]/tourProductPageBody.tsx`)가 이 4로케일을 EN 으로 좁힌다.
   🔴 **이 배열은 사장님 결정 없이 건드리지 말 것**(i18n 확장 트랙 불변 규칙).
   여는 날 할 일: 배열에서 제거 + 6로케일 타입(`TourProductPageLocale`) 확장 + 레지스트리 등록 +
   4로케일 실렌더 QA. 지금은 DB 행(`-04`)과 번들이 **대기 상태로 준비**되어 있다.
2. **다릿돌전망대·닥밭골 사진 0장** — 두 스톱은 이미지 없이 나간다. 촬영분이 생기면
   `public/images/tours/` 에 넣고 빌더의 이미지 상수에 연결.
3. **포천 재인폭포·점심 사진 0장** — 두 스톱은 이미지 없이 나간다. 촬영분 생기면 빌더의 `IMG` 상수에 연결.
4. **부산 신규 상품 운영 검수** — 스카이캡슐 티켓 포함 옵션의 실제 예약 절차(캡슐 사전 예약 담당·
   2인 1캡슐 정산)를 운영팀과 확정.

---

## 6. 손님 노출 문구 오염 — 스윕 완료, **수정됨** (PR #721)

§6 은 원래 "도너 부산 상품 1건" 티켓이었다. 스윕해 보니 **훨씬 넓었고 두 종류였다.**

### 6-1. 예약 바 개발 주석 — 23개 상품 / 127개 번들 파일
`sticky_booking_bar.note` 가 "checkout_tour_id는 런타임 시 Supabase / env에서 확인되며,
정적 JSONB의 일부가 아닙니다." 를 **손님용 예약 문구로** 싣고 있었다. **11개 상품은 영어에서도**
그랬다. `lib/i18n/pipeline/segments.ts:55` 가 이 필드를 **A1(번역 대상 CTA 문구)** 로 분류한다
= 실제로 렌더된다. → 10로케일 정상 문구로 교체.

### 6-2. 번역가 작업 노트가 라이브 필드에 — 45개 문자열 / 16개 상품
`"**Notes:** Lines 3 & 4 are CSS class names, kept as-is"` 류가 일정 하이라이트·
`routePhases.phase`·`bookingSupportSteps`·`practicalAccordionItems.content`·
`pricingTiers.tiers[].paxLabel` 뒤에 그대로 붙어 있었다. 🔴 **2건은 `iconBg` 값 자체**라
CSS 클래스 문자열이 깨져 아이콘 배경이 클래스 없이 렌더됐다. 노트 시작 마커에서 잘라내고
앞쪽 문구는 그대로 뒀다. `page_sections.*` 미러(129경로)는 **일부러 안 고쳤다** —
`segments.ts` 가 DEAD 로 못 박았고 렌더 경로가 읽지 않는다는 테스트가 있다.

### 6-3. 🔴 **번들만 고치면 손님에게 안 닿는다** (이번 트랙 최대 함정)
`app/(marketing)/tour-product/[slug]/tourProductPageBody.tsx:130` 이
**Supabase 를 먼저** 읽고 레포 JSON 번들은 **폴백일 뿐**이다. 즉 `detail_payload` 를 안 고치면
번들 수정은 화면에 반영되지 않는다. → **`2026-08-04-07-guest-copy-repair.sql`**:
28개 상품 **176개 `jsonb_set`**, 각 문장이 **오염된 원래 값과 정확히 일치할 때만** 쓰도록
`WHERE` 로 가드했다. 그래서 **멱등**이고, 어드민 Product Editor(같은 `detail_payload` 에 쓴다)로
수정된 값을 **덮어쓰지 않는다.** 재생성: `node scripts/gen-copy-repair-sql-2026-08.mjs`

### 재스윕 명령 (0 이어야 정상)
```bash
grep -rl "checkout_tour_id" components/product-tour-static/*/*.json   # _publication 변경로그만 남음
```
DB 쪽 검증은 SQL 07 파일 끝의 주석 쿼리를 쓸 것.

---

## 7. 이번 트랙의 PR

- **#711** 수국 내림 + 제주 3종 오픈 + 동부 재코스 (merged `fa0871d8`)
- **#714** 부산 스몰그룹 신규 상품 + 가격 $59/$79 (merged `cb7f42b6`)
- **#717** 신규 상품 10로케일 번역 (merged `85cca61a`)
- **#720** 포천 코스 개편(재인폭포·이동갈비) + POI KB v1.30 + 10로케일 (merged `732d91a2`)
- **#721** 손님 노출 문구 오염 수정(스티키 127파일 / 번역가 노트 45건) +
  포천 월·목·토 출발 요일 + SQL 07
