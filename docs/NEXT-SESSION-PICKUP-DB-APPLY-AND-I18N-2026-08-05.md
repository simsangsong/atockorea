# NEXT SESSION — 픽업 SQL 적용·머지 + de/fr/it/ru 번역 (2026-08-05 사장님 지시)

**부트스트랩 순서: §0 → §1 (DB·머지) → §2 (번역).**
§1 을 끝내기 전에 §2 를 시작하지 마라. 이유는 §2-a 에 있다 — 번역 원문이 바뀐다.

브랜치: **`claude/pickup-schedule-times-2bgdgm`** (커밋 4개, 푸시됨, **미머지**)
직전 세션이 만든 것: 픽업 순서·시간 변경 2건 + 라이브 결함 1건 수정 + 상설 게이트 1개.

---

## §0 착수 전 5분 — 이 셋을 먼저 확인하라

1. **`origin/main` 이 이 브랜치를 아직 안 물었는지.** 물었으면 §1-a 는 끝난 것이다.
   `git fetch origin && git log origin/main --oneline -1`
2. **DB 접근이 되는 세션인지.** 직전 세션은 **안 됐다** — `.env.local` 도 `psql` 도
   `SUPABASE_DB_URL` 도 없었고, 붙어 있던 Supabase MCP 는 **다른 계정**이었다
   (프로젝트 목록에 `Kursoflow` 하나뿐, atockorea `cghyvbwmijqpahnoduyv` 는 안 보임).
   안 되면 §1-b 는 이 세션에서 못 한다 — **된다고 가정하고 진행하지 마라.**
3. 🔴 **"pending 에 SQL 파일이 있다"는 미적용의 증거가 아니다.** CLAUDE.md 가 기록한
   실패다 — 병행 세션이 적용하고 파일만 안 옮긴 구간이 있었다. **판정은 DB 객체 조회로.**
   ```sql
   SELECT slug, locale,
          COALESCE(jsonb_array_length(detail_payload #> '{pickup_dropoff,departure}'), 0) AS pts,
          detail_payload #>> '{pickup_dropoff,departure,0,time}' AS first_pickup
     FROM public.tour_product_pages
    WHERE slug IN ('busan-top-attractions-day-tour',
                   'busan-small-group-yonggungsa-skycapsule-gamcheon-tour')
    ORDER BY slug, locale;
   ```
   `pts = 0` 이 하나라도 있으면 **그 페이지는 픽업 섹션 없이 손님에게 나가고 있다.**

---

## §1 DB 적용 + 머지

### §1-a 무엇이 왜 밀려 있나

🔴 **레포만 고쳐서는 손님 화면이 안 바뀐다.** `TOUR_PRODUCT_USE_SUPABASE=1` 이라
`/tour-product/[slug]` 는 `tour_product_pages.detail_payload` 를 그린다. 정적 번들은
폴백일 뿐이다. 그래서 **SQL 적용이 진짜 병목**이고, 머지만 해서는 아무것도 안 고쳐진다.

### §1-b 적용할 파일 (순서 무관, 전부 멱등)

| 파일 | 문 | 내용 |
|---|---|---|
| `supabase/pending-db-apply/2026-08-05-13-busan-top-attractions-pickup.sql` | 79 | 부산 데이투어 픽업 **부산역 08:10 → 서면 08:30 → 해운대 09:10** (6로케일) |
| `supabase/pending-db-apply/2026-08-05-14-busan-smallgroup-hotel-pickup.sql` | 11 | 스몰그룹 **시내 호텔 도어투도어 09:00–10:00** + 재편 일정 + 해운대해수욕장 신규 스톱 (10로케일) |
| `supabase/pending-db-apply/2026-08-05-15-missing-pickup-dropoff.sql` | 45 | 🔴 **라이브 결함** — 비EN 페이지에서 픽업/드롭오프 섹션이 통째로 사라진 것 |

13·15 는 경로별 가드, 14 는 블록 통째 교체(스톱이 추가돼 인덱스가 밀렸다).
**셋 다 재실행이 무해하다.** 가격·`is_active`·`is_published` 는 아무것도 안 건드린다.

적용 후 추천 엔진 재동기화:
```
node scripts/import-match-v18.mjs --single busan-top-attractions-day-tour
node scripts/import-match-v18.mjs --single busan-small-group-yonggungsa-skycapsule-gamcheon-tour
```

⚠ `npm run tours:apply-*` 계열은 `psql` + `SUPABASE_DB_URL` 을 요구해 그 PC 에서
죽은 전례가 있다. 그때의 우회로가 `scripts/apply-seoul-new-products-2026-08.mjs`
(supabase-js)다 — 같은 문제를 만나면 그걸 본으로 삼아라.

### §1-c 15번이 고치는 결함 — 다시 결함으로 올리지 말 것

상세 페이지는 `pickup_dropoff` 가 뷰모델에 **있을 때만** 「Pickup & Map」 섹션 전체를
그린다(`TourProductDetailClient.tsx` 의 `vm.pickup_dropoff ?` + `loadTourProductPage.ts`
가 null 아닐 때만 키를 넘김). 없으면 지도·픽업 목록·하차 목록이 **아예 안 나오고**
타임라인이 마지막 스톱에서 곧장 「포함 사항」으로 넘어간다.

| 상품 | en | ko | ja | zh | zh-TW | es |
|---|---|---|---|---|---|---|
| busan-top-attractions-day-tour | O | 없음 | 없음 | 없음 | 없음 | 없음 |
| jeju-grand-highlights-loop | O | 없음 | 없음 | 없음 | 없음 | 없음 |
| busan-small-group-sightseeing-…-passengers | O | 없음 | – | – | – | – |
| incheon-seoul-private-car-shore-excursion… | O | 없음 | – | – | – | – |

**원인은 코드가 아니라 소스가 반쪽이었던 것.** 블록이 EN 번들에만 있었고, 예전
`scripts/gen_pickup_sql.js` 가 번역본을 **DB 에만** 써 넣고 레포에 안 돌려놨다. 그래서
나중에 어떤 SQL 이든 그 로케일 payload 를 번들에서 다시 만들면 섹션이 조용히 사라졌다.
**tsc 도 jest 도 계속 초록이었다.**

🔴 **측정 함정 — 한 번 밟았다.** `/zh/` 는 클라이언트 렌더라 서버 HTML 이 ~32KB 셸이고,
`id="pickup-dropoff"` 가 **멀쩡한 상품에서도 0** 으로 나온다. 이걸 결함으로 세서 정상
상품 3개를 오판했다. zh 가 위 표에 있는 근거는 서버 HTML 이 아니라 **라이브 화면 캡처**다.
서버 HTML 카운트만 보고 zh 를 표에서 빼지 마라.

상설 게이트 `__tests__/audit/pickupDropoffLocaleParity.test.ts` 가 레포 쪽 재발을 막는다
(EN 에 있으면 전 로케일에 있어야 하고, CJK 안내문이 EN 복사본이면 실패).

### §1-d 머지

DB 적용을 확인한 **뒤에** PR → main. 머지 전 게이트(직전 세션 기준선):
`npx tsc --noEmit` **0** · `npx jest` **5,994 pass / 0 fail** (569 스위트).

---

## §2 de/fr/it/ru 번역 (사장님 지시)

### §2-a 🔴 §1 을 먼저 끝내야 하는 이유

**부산 데이투어와 스몰그룹의 원문이 이 브랜치에서 바뀐다.** 픽업 시각·하루 일정·
스톱 개수가 전부 달라졌다. §1 전에 번역하면 **낡은 원문을 4개 언어로 번역해 박제**하게
된다. 파이프라인은 DB 에서 읽으므로, DB 가 새 내용이 된 뒤에 추출하라.

### §2-b 대상 8종 — 전부 라이브다

| 상품 | 슬러그 |
|---|---|
| 제주 동부 | `jeju-eastern-unesco-spots-day-tour` |
| 제주 남부 | `jeju-southern-top-unesco-spots-tour` |
| 제주 서남부 | `southwest-hallasan-osulloc-aewol` |
| 제주 환도 | `jeju-grand-highlights-loop` |
| 부산 데이투어 | `busan-top-attractions-day-tour` |
| 경주 | `from-busan-gyeongju-ancient-capital-day-tour` |
| 제주 프라이빗 | `jeju-island-private-car-charter-tour` |
| 부산 프라이빗 | `busan-private-car-charter-cruise-shore` |

**부산 스몰그룹(`busan-small-group-yonggungsa-skycapsule-gamcheon-tour`)은 이미 4개
언어가 다 있다** — 새로 만들지 말고 §1 적용 후 값이 맞는지 확인만 하라.

⚠ `southwest-hallasan-osulloc-aewol` 과 `jeju-grand-highlights-loop` 를
`lib/tour-consumer-visibility.ts` 에서 grep 하면 히트가 난다. **둘 다 블록리스트가
아니다** — `CANONICAL_*_PATH` 상수와 주석에 슬러그가 적혀 있을 뿐이다. CLAUDE.md 가
경고한 바로 그 함정이니 라인을 직접 읽어라.

### §2-c 현재 상태 — 실측

`npx tsx scripts/i18n/status.ts` (매니페스트 2026-07-25 기준):

- **독일어만** 10슬러그 추출됨, 112유닛 중 **발행가능 24.1%** (pending 85 · flagged 23 · auto_pass 4)
- 번역 산출물이 실제로 나온 건 **3슬러그**뿐:
  `jeju-grand-highlights-loop` · `busan-private-car-charter-cruise-shore` · `seoul-dmz-…`
- **DB 발행까지 간 건 `jeju-grand-highlights-loop` 하나**
- **fr/it/ru 는 글로서리 L1(POI 122건)만 있고 본문 추출조차 시작 안 됐다**

즉 8종 × 4언어 = **32 로케일 페이지 중 실질 1개**만 끝나 있다.

### §2-d 어느 경로로 할 것인가

**파이프라인(`scripts/i18n/*`)을 써라.** DB payload 에서 일반적으로 동작하므로 8종에
전부 적용된다.
```
npm run i18n:extract -- --locale=de --slugs=<slug>     # 읽기 전용, DB에 안 씀
npm run i18n:verify
npm run i18n:apply                                      # INSERT-only
npm run i18n:status
```
플랜 정본 `docs/i18n-expansion-plan-v2-2026-07-25.md`, 부트스트랩
`docs/NEXT-SESSION-I18N-EXPANSION-2026-07-26.md`.

⚠ **스몰그룹이 쓴 빌더+오버레이 방식은 이 8종에 안 맞는다.** 그건 신규 상품이라
빌더(`scripts/build-busan-smallgroup-2026-08.mjs` + `donor-overlay/`)가 있었기
때문이고, 이 8종은 손으로 관리되는 번들이라 빌더가 없다. 참고만 하라.

### §2-e 🔴 건드리면 안 되는 것

1. **`TOUR_PRODUCT_FALLBACK_URL_LOCALES`**
   (`app/(marketing)/tour-product/[slug]/tourProductPageBody.tsx:53`, `["fr","de","it","ru"]`).
   **오픈은 사람 결정이다.** 이 배열이 있는 한 번역을 DB 에 넣어도 손님은 EN 을 본다 —
   그게 이 트랙이 라이브 DB 에 안전하게 쓸 수 있는 전제다.
   `__tests__/app/tourProductLocaleRouting.test.ts` 가 이 이원 구조를 강제한다.
2. **기존 6로케일 행 UPDATE.** `apply.ts` 는 INSERT-only다. 그대로 둬라.
3. **`match_pois.names_other_locales`** — 게이트가 없어 쓰는 즉시 고객에게 반영된다.
4. **`messages/*.json` 기존 키.**
5. **`TourProductPageLocale`** (`lib/tour-product/tourProductPageLocale.ts`) 은
   6로케일 고정 타입이다. de/fr/it/ru 는 여기 넣는 게 아니라 DB 행 + 번들로만 스테이징된다.

### §2-f 번역 중 반드시 지킬 것

- 🔴 **`catalog_card.slug` 을 번역하면 404 유령 카드가 생긴다.** 생성기가 파일명보다
  JSON 값을 믿는다. `jeju-eastern-unesco-spots-day-tour` 의 `.es` 가 실제 사고를 냈고
  **지금도 라이브다** — 이번에 같이 고칠 수 있으면 고쳐라.
- 🔴 **새로 만드는 de/fr/it/ru 번들에 `pickup_dropoff` 를 반드시 넣어라.**
  §1-c 의 결함이 정확히 이것이고, 상설 게이트가 이제 이걸 막는다.
- **`page_sections` 는 DEAD** — 번역하지 마라. 슬러그당 ~39,000자 순수 낭비다.
- CJK 불변 규칙(글자 단위 줄바꿈 금지)은 전역 기본값이 지킨다. 판정은
  `scripts/qa-cjk-render.mjs` 실렌더로.

### §2-g SQL 번호

다음 빈 번호는 **`2026-08-05-16`** 이다(13·14·15 사용 중).
🔴 **번호는 착수 때가 아니라 커밋 직전에 다시 확인하라** — 2026-08-04 에 네 세션이
동시에 같은 날짜를 쓰면서 10번이 3개, 11번이 2개 생긴 전례가 있다.
🔴 **`applied/` 로 옮겨진 파일은 다시 번호 매기지 마라** — 실행 기록이 깨진다.

---

## §3 사장님 결정 대기 — 번역과 무관하게 남아 있는 것

1. **부산 데이투어 소요시간 표기.** 첫 픽업이 08:30 → 08:10 이 되면서 라벨 "10.5시간"이
   실제(08:10 → 약 19:00 = 10.8시간)보다 20분 적다. 경주 형제 상품도 같은 방식으로
   내림 표기한다(11:40 → "11.5시간"). **11시간으로 올릴지는 결정 사항.**
2. **스몰그룹 하차.** 픽업만 호텔 도어투도어로 바뀌었고 하차는 시내 4개 역 그대로다.
   하차까지 호텔로 돌릴지는 운영 결정.
3. **스몰그룹 점심·하차 시각은 유도값이다.** 사장님이 주신 목록의 유일한 빈 구간
   (13:20→14:10)에 점심을 45분으로 넣었고, 하차는 기존에 게시된 +20/+20/+30 간격을
   유지해 17:10/17:30/17:50/18:20 로 계산했다. 실제 운영과 다르면 알려 달라.
