# NEXT SESSION — de/fr/it/ru 번역 잔여 (2026-08-07 갱신)

**§1(픽업 SQL 적용·머지)은 끝났다.** PR #735 머지 — 이 문서의 §1 은 기록으로만 읽어라.
**§2 는 부분 완료다.** 남은 것은 아래 §A 하나뿐이고, **막고 있는 것은 코드가 아니라 API 크레딧이다.**

---

## §A 🔴 먼저 확인할 것 — Anthropic API 크레딧

2026-08-07 실행이 169 unit 중 111 를 끝내고 **크레딧 소진으로 멈췄다**(57 실패 중 56이
`credit balance is too low`). 이탈리아어가 도중에 끊겼고 러시아어는 한 unit 도 못 돌았다.

```
npm run i18n:translate -- --locale=ru --slugs=<아래 목록> --concurrency=3
```
가 401/400 없이 한 unit 이라도 성공하면 크레딧이 복구된 것이다. 안 되면 이 세션에서
§2 잔여는 못 한다 — **된다고 가정하고 시작하지 마라.** CLAUDE.md 의 Gemini 결제 건과 같은 종류다.

---

## §B 지금 어디까지 됐나 — 실측 (2026-08-07)

**인수인계 원본 §2-c 는 틀렸다.** "실질 1개만 끝났다"는 매니페스트 기준이고, DB 를 보면
네 상품이 이미 4언어 완비였다. 아래는 DB 조회 결과다.

| 슬러그 | de | fr | it | ru |
|---|---|---|---|---|
| `jeju-grand-highlights-loop` | ✅ | ✅ | ✅ | ✅ |
| `busan-private-car-charter-cruise-shore` | ✅ | ✅ | ✅ | ✅ |
| `busan-small-group-…-gamcheon-tour` | ✅ | ✅ | ✅ | ✅ |
| `busan-top-attractions-day-tour` | ✅ | ✅ | ✅ | ✅ |
| `jeju-eastern-unesco-spots-day-tour` | ✅ | ✅ | ✅ | **없음** |
| `jeju-island-private-car-charter-tour` | ✅ 신규 | ✅ 신규 | ✅ 신규 | **없음** |
| `jeju-southern-top-unesco-spots-tour` | 번역결함 | ✅ 신규 | ✅ 신규 | **없음** |
| `from-busan-gyeongju-ancient-capital-day-tour` | 미완 | ✅ 신규 | 번역결함 | **없음** |
| `southwest-hallasan-osulloc-aewol` | 번역결함 | 번역결함 | 미완 | **없음** |

**이번에 발행한 것 = 6행**(de 1 · fr 3 · it 2). 전부 coverage 1 · `auto_pass` ·
`pickup_dropoff` 포함 · `catalog_card.slug` 무결.

**남은 것 = 11행:**
- **ru 5슬러그 전부**(49 unit) — 번역 자체가 0
- **de 3슬러그 · fr 1 · it 2** — 아래 §C 의 결함 4건을 고쳐야 발행된다

---

## §C 🔴 남은 검증 실패 9건 — 4건만 진짜다

`npm run i18n:verify -- --locale=de` 로 재현된다. 게이트가 어긋난 게 아니라
**번역이 실제로 잘린 것 4건 + 게이트 잔여 오탐 5건**이다.

### 진짜 결함 — 재번역해야 한다 (전부 독일어)

| unit | 포인터 | 길이비 |
|---|---|---|
| `from-busan-gyeongju…:de:staticQuestions-2` | `/staticQuestions/13/answer` | 0.43 |
| `jeju-southern…:de:itineraryStops` | `/itineraryStops/1/description` | 0.54 |
| `southwest…:de:itineraryStops-5` | `/itineraryStops/5/description` | **0.08** |
| `it:from-busan-gyeongju…:itineraryStops-3` | `/itineraryStops/3/description` (`1970` 소실) | 1.18 |

세그먼트 하나가 문장 중간에서 끊긴 것이지 `max_tokens` 문제가 아니다 — 같은 unit 의
다른 세그먼트는 1.1~1.3 비율로 멀쩡하다. 고치는 법:

```
npm run i18n:translate -- --locale=de --slugs=<슬러그> --force
```
(`--force` 없으면 출력 파일이 있어서 건너뛴다.)

### 게이트 잔여 오탐 — 고치지 말고 알고만 있어라

이번에 G3/G4 의 시각·통화 표기 맹점은 고쳤다(실패 21→9). **남은 5건은 더 넓히지 않기로
한 판단이다** — 면제 범위를 늘릴수록 게이트가 무뎌지고, 잘림을 잡아낸 게 바로 이 게이트다.

| 원문 | 번역 | 게이트가 보는 것 |
|---|---|---|
| `between 6:30 and 7:00 p.m.` | `entre 18 h 30 et 19 h 00` | `6 7` 소실 (범위에 p.m. 이 하나뿐) |
| `open 24 hours` | `rund um die Uhr geöffnet` | `24` 소실 (독일어 관용구) |

셋 다 `southwest…:*:A1` 의 같은 세그먼트 하나(`/practicalAccordionItems/0/content/1`)와
`itineraryStops/*/visitBasics/hours` 다. 이 unit 들은 **오탐 때문에 발행이 막혀 있다** —
번역 자체는 맞다. 열려면 게이트를 더 넓히거나(권장 안 함), 해당 세그먼트만 원문 표기를
유지하도록 다시 시키거나, `--partial` 로 부분 발행하는 세 갈래가 있다. **사람 판단감이다.**

---

## §D 파이프라인 — 이제 4단계 전부 스크립트다

```
npm run i18n:extract   -- --locale=de --slugs=<slug>     # 읽기 전용, DB 미접촉
npm run i18n:translate -- --locale=de --slugs=<slug>     # 신규. 중단되면 남은 unit 부터 재개
npm run i18n:verify    -- --locale=de
npm run i18n:apply     -- --locale=de --slugs=<slug> --apply   # INSERT-only
```

`scripts/i18n/translate.ts` 가 이번에 생겼다. 알아야 할 것:
- **출력 파일이 있으면 건너뛴다.** 그래서 크레딧이 끊긴 지점부터 그냥 다시 돌리면 된다.
- RULES.md 를 통째로 시스템 프롬프트에 싣는다(요약 금지는 그 파일이 스스로 못 박아 둔 것).
  로케일당 하나라서 두 번째 unit 부터는 프롬프트 캐시가 듣는다.
- 출력 스키마는 unit 마다가 아니라 **하나를 공유**한다(포인터를 키가 아니라 배열 원소로 받는다).
  키로 받으면 unit 마다 스키마가 새로 컴파일된다.
- 포인터 집합이 어긋나면 어긋난 목록을 되돌려주며 3회까지 다시 시킨다.
- `--concurrency=3` 기본. `--dry-run` 은 쓰지만 않는다.

### 잔여 대상 슬러그 (복붙용)

```
jeju-southern-top-unesco-spots-tour,southwest-hallasan-osulloc-aewol,from-busan-gyeongju-ancient-capital-day-tour,jeju-island-private-car-charter-tour,jeju-eastern-unesco-spots-day-tour
```
ru 는 위 5개 전부, de/fr/it 는 `jeju-eastern` 을 뺀 4개(이미 행이 있다 → apply 가 건너뛴다).

---

## §E 🔴 건드리면 안 되는 것 — 원본에서 그대로 유지

1. **`TOUR_PRODUCT_FALLBACK_URL_LOCALES`**
   (`app/(marketing)/tour-product/[slug]/tourProductPageBody.tsx`, `["fr","de","it","ru"]`).
   **오픈은 사람 결정이다.** 이 배열이 있는 한 DB 에 넣어도 손님은 EN 을 본다 — 그게 이
   트랙이 라이브 DB 에 안전하게 쓸 수 있는 전제다. 이번 세션도 손대지 않았다.
2. **기존 6로케일 행 UPDATE.** `apply.ts` 는 INSERT-only. 대상 행이 이미 있으면 건너뛴다.
3. **`match_pois.names_other_locales`** — 게이트가 없어 쓰는 즉시 고객에게 반영된다.
4. **`messages/*.json` 기존 키.**
5. **`TourProductPageLocale`** 은 6로케일 고정 타입이다. de/fr/it/ru 는 DB 행으로만 스테이징.

---

## §F 이번에 닫힌 것 — 다시 열지 마라

- **`catalog_card.slug` 유령 카드** — `jeju-eastern…` 의 `.es` 가 `…unesco-**lugares**-…`
  였다. 레포·DB 양쪽 수정. 전체 275행·전 번들 스캔에서 **이것 하나뿐**이었다.
  🔴 그리고 파이프라인으로는 재발할 수 없다 — `segments.ts:204` 가 깊이에 상관없이
  `slug`·`id`·`url` 류 리프 키를 번역 대상에서 뺀다. 실측: 전 unit 파일에 `/slug` 로
  끝나는 포인터 0개.
- **부산 데이투어 de/fr/it/ru 의 낡은 픽업** — `applied/2026-08-05-16-*.sql` 로 갱신.
  10로케일 전부 08:10/08:30/09:10 일치.
- **`departure` 가 0인 102행** — 레거시 `meeting_points` 스키마 13슬러그이고 EN 도 같다.
  **로케일 결함이 아니다.** §0 의 검증 쿼리는 그 형태에 해당이 없다.

---

## §G 사장님 결정 대기 (번역과 무관, 원본에서 이월)

1. **부산 데이투어 소요시간 표기.** 첫 픽업 08:10 이 되면서 라벨 "10.5시간"이 실제
   (08:10 → 약 19:00 = 10.8시간)보다 20분 적다. 11시간으로 올릴지는 결정 사항.
2. **스몰그룹 하차.** 픽업만 호텔 도어투도어가 됐고 하차는 시내 4개 역 그대로다.
3. **스몰그룹 점심·하차 시각은 유도값이다**(13:20→14:10 빈 구간에 점심 45분, 하차는
   기존 +20/+20/+30 간격 유지).
4. **§C 오탐 5건을 어떻게 할지** — 게이트를 넓힐지, 해당 세그먼트만 다시 시킬지,
   `--partial` 로 갈지.
