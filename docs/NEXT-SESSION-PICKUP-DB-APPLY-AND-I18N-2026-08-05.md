# NEXT SESSION — de/fr/it/ru 번역 잔여 (2026-08-07 2차 갱신)

**§1(픽업 SQL 적용·머지)은 끝났다.** PR #735 머지 — 기록으로만 읽어라.
**§2 는 여전히 크레딧에 막혀 있다.** 번역은 한 줄도 못 돌렸다.

**그러나 오탐 6건은 게이트를 고쳐서 닫았고**(검증 실패 **9 → 0**), 그 덕에
**크레딧 없이 2행을 발행했다** — `southwest…:fr`(세그먼트 525) · `from-busan-gyeongju…:it`(603).
잔여는 **11행**이고 전부 번역이 실제로 필요한 것들이다.

---

## §A 🔴 먼저 확인할 것 — Anthropic API 크레딧 (2026-08-07 재확인: **여전히 막힘**)

```
400 invalid_request_error — "Your credit balance is too low to access the Anthropic API."
```

크레딧이 살아났는지는 **1초짜리 호출**로 먼저 확인하라. 번역을 돌려서 확인하지 마라 —
실패해도 유닛 하나가 몇 분씩 걸린다.

```bash
node --env-file=.env.local --input-type=module -e "import A from '@anthropic-ai/sdk'; const m=await new A().messages.create({model:'claude-haiku-4-5-20251001',max_tokens:4,messages:[{role:'user',content:'hi'}]}); console.log('OK',m.stop_reason)"
```

이게 400 을 뱉으면 **이 세션에서 §2 잔여는 못 한다. 된다고 가정하고 시작하지 마라.**

### ⚠ 워크트리 부트스트랩 — 이것부터 안 하면 위 명령이 엉뚱하게 실패한다

워크트리에는 `.env.local` 도 `node_modules` 도 없다. 둘 다 본체에서 가져와야 한다.

```bash
cp /c/Users/sangsong/atockorea/.env.local .env.local
```
```powershell
New-Item -ItemType Junction -Path .\node_modules -Target C:\Users\sangsong\atockorea\node_modules
```

`ERR_MODULE_NOT_FOUND` 나 `.env.local: not found` 가 나오면 크레딧 문제가 아니라 이것이다.

---

## §B 지금 어디까지 됐나 — DB 실측 (2026-08-07)

🔴 **원본 §B 의 "남은 것 11행" 은 틀렸다. 실제로는 13행이고, ru 대상 슬러그도 5개가 아니라 7개다.**
원본 표가 9슬러그만 보고 있었는데 DB 에는 18슬러그가 있다. 아래는 `tour_product_pages` 직접 조회다.

| 슬러그 | de | fr | it | ru |
|---|---|---|---|---|
| `busan-cruise-shore-excursion-bus-tour` | ✅ | ✅ | ✅ | ✅ |
| `busan-private-car-charter-cruise-shore` | ✅ | ✅ | ✅ | ✅ |
| `busan-small-group-…-gamcheon-tour` | ✅ | ✅ | ✅ | ✅ |
| `busan-top-attractions-day-tour` | ✅ | ✅ | ✅ | ✅ |
| `from-incheon-seoul-day-tour-cruise-guests` | ✅ | ✅ | ✅ | ✅ |
| `incheon-seoul-private-car-shore-excursion-cruise` | ✅ | ✅ | ✅ | ✅ |
| `jeju-grand-highlights-loop` | ✅ | ✅ | ✅ | ✅ |
| `pocheon-sanjeong-lake-herb-island-art-valley` | ✅ | ✅ | ✅ | ✅ |
| `seoul-dmz-private-3rd-tunnel-suspension-bridge` | ✅ | ✅ | ✅ | ✅ |
| `seoul-gapyeong-…-day-tour` | ✅ | ✅ | ✅ | ✅ |
| `seoul-winter-…-eobi-ice-valley-day-tour` | ✅ | ✅ | ✅ | ✅ |
| `jeju-cruise-shore-excursion-bus-tour` | ✅ | ✅ | ✅ | **없음** |
| `jeju-cruise-shore-excursion-small-group-tour` | ✅ | ✅ | ✅ | **없음** |
| `jeju-eastern-unesco-spots-day-tour` | ✅ | ✅ | ✅ | **없음** |
| `jeju-island-private-car-charter-tour` | ✅ | ✅ | ✅ | **없음** |
| `jeju-southern-top-unesco-spots-tour` | **잘림 1** | ✅ | ✅ | **없음** |
| `from-busan-gyeongju-ancient-capital-day-tour` | **잘림 1 + 미번역 1** | ✅ | ✅ 신규 | **없음** |
| `southwest-hallasan-osulloc-aewol` | **잘림 1** | ✅ 신규 | **미번역 7** | **없음** |

**남은 것 = 11행** — ru 7 · de 3 · it 1.
**부족한 unit 은 총 88개**: ru 77 · it southwest 7 · de 4(잘림 3 + 미번역 1).

⚠ de 매니페스트에는 `busan-*`·`incheon-*`·`jeju-cruise-*`·`jeju-eastern` 의 `pending` unit 이
잔뜩 남아 있는데 **그 슬러그들은 이미 de 행이 있다**(다른 경로로 먼저 들어갔다). apply 가
`행이 이미 존재` 로 건너뛰므로 **공백이 아니다.** 매니페스트 pending 수를 잔여로 세지 마라.

🔴 **`jeju-cruise-*` 두 슬러그는 ru 매니페스트에 아예 없었다** — 그래서 원본이 5개로 셌다.
**이번에 추출해 넣었다**(ru 49 → **77 unit**, 7슬러그 전부). 크레딧만 돌아오면 명령 하나로 덮인다.
de/fr/it 상태는 손대지 않았다(extract 는 `status: existing?.status ?? 'pending'` 로 진척을 보존한다 —
실측으로 확인: 152/40/40 유닛 tally 무변화).

---

## §C 검증 실패 — 🔴 **진짜 결함은 4건이 아니라 3건이다**

원본은 `it:from-busan-gyeongju:itineraryStops-3` 을 "진짜 결함(1970 소실)" 으로 분류했다.
**틀렸다. 원문을 열어 보면 오탐이다:**

| | |
|---|---|
| EN | `…became widely known in the **1970s**…` |
| IT | `…divenne largamente noto **negli anni Settanta**…` |

이탈리아어에서 연대를 말하는 표준 표기다. 독일어 `24 hours → rund um die Uhr` 를
원본이 스스로 오탐으로 분류해 둔 것과 **정확히 같은 종류**다. 길이비 1.18 이 이미 신호였다
(잘림이면 비율이 무너진다). → **재번역하면 크레딧만 버린다.**

### 진짜 결함 3건 — 전부 독일어, 전부 **문장 중간 잘림**

| unit | 포인터 | 길이비 |
|---|---|---|
| `from-busan-gyeongju…:de:staticQuestions-2` | `/staticQuestions/13/answer` | 0.43 |
| `jeju-southern…:de:itineraryStops` | `/itineraryStops/1/description` | 0.54 |
| `southwest…:de:itineraryStops-4` | `/itineraryStops/5/description` | **0.08** |

⚠ 원본이 마지막 건의 unit 을 `itineraryStops-5` 로 적었는데 **`itineraryStops-4` 다**
(`-5` 는 `24시간` 오탐 쪽이다).

### 🔴 원인 — 셋 다 독일어 여는 따옴표 `„` 직후에서 끊겼다

```
…für „Cafés mit Meerblick          ← 여기서 끝
…Legende „Seobulgwacha (徐市過此)   ← 여기서 끝
…„Gyeongnidan-gil von Hwangnam-dong ← 여기서 끝
```

`max_tokens` 가 아니다 — **잘린 포인터 뒤의 세그먼트들은 멀쩡히 번역돼 있었고**
총 출력은 상한(32k)의 20%도 안 됐다. 한 건은 `note` 에 `.}]}` + 백틱 같은 JSON 파편이
담겨 있었다: 모델이 문자열 밖으로 튀어나갔고 스키마가 그 잔해를 `note` 로 삼킨 것이다.

**`translate.ts` 는 포인터 *집합*만 맞으면 통과시켜서 못 봤고, 몇 시간 뒤 verify 의
G3(숫자 소실)가 대신 잡았다.** → §F 에서 고쳤다.

### 오탐 6건 — ✅ **닫혔다**(사장님 승인 2026-08-07). 다시 열지 마라

전부 같은 세 유형이었고 번역 자체는 **맞았다**. G3 를 좁게 고쳐 통과시킨다.

| 원문 | 번역 | 게이트가 보던 것 | 처리 |
|---|---|---|---|
| `between 6:30 and 7:00 p.m.` | `entre 18 h 30 et 19 h 00` | `6 7` 소실 | **면제**(값이 같음이 증명됨) |
| `open 24 hours` | `rund um die Uhr geöffnet` | `24` 소실 | fail → **flag** |
| `in the 1970s` | `negli anni Settanta` | `1970` 소실 | fail → **flag** |

🔴 **`--partial` 로 가지 않은 이유 — 실측하고 결정을 뒤집었다.**
원래 권고는 `--partial` 이었는데, blocked unit 이 들고 있는 세그먼트를 세어 보니
**478개**였다(fr A1 88 · it A1 88 · de A1 88 · de itineraryStops 50 …).
`apply.ts` 는 **INSERT-only 라 발행 후 갱신 경로가 없다** — 오탐 6개를 피하려고
**478개를 영구히 영어로** 박는 거래였다. 게이트를 좁게 고치는 쪽이 압도적으로 싸다.

🔴 **게이트를 무디게 만들지 않았다는 근거:**
- 12시제는 **`H+12` 가 번역에 있고 `H` 는 없을 때만** 면제한다. 시각을 실제로 바꾸면
  (`19:00`→`20:00`) 그대로 fail 이다.
- 낱말 표기는 **원문의 리터럴 패턴**으로만 정한다 — `1970s`(s 필수) · `24 hours`.
  맨 연도 `1771` 이나 `24 rooms` 는 면제 대상이 아니다. 로케일별 어휘표도 필요 없다.
- `flag` 는 `PUBLISHABLE` 이라 발행되면서 **사람 감수 큐에는 남는다**(연대 축약과 같은 처리).
- **뮤테이션 테스트 6개**가 위 경계를 못 박는다 — 특히 「잘린 번역은 여전히 fail」.
- 그리고 이제 잘림은 **G3 가 아니라 `findTruncatedSegments` 가** 생성 시점에 잡는다(§F).
  「G3 를 엄격히 둬야 잘림을 잡는다」는 근거가 그만큼 약해졌다.

**결과: 검증 실패 de 3·fr 1·it 2 = 9 → 전부 0.**

---

## §D 파이프라인 — 4단계 전부 스크립트

```bash
npm run i18n:extract   -- --locale=ru --slugs=<slug>     # 읽기 전용, DB 미접촉, 매니페스트 병합
npm run i18n:translate -- --locale=ru --slugs=<slug>     # 중단되면 남은 unit 부터 재개
npm run i18n:verify    -- --locale=ru
npm run i18n:apply     -- --locale=ru --slugs=<slug> --apply   # INSERT-only
```

- **출력 파일이 있으면 translate 가 건너뛴다.** 크레딧이 끊긴 지점부터 그냥 다시 돌리면 된다.
- RULES.md 를 통째로 시스템 프롬프트에 싣는다. 로케일당 하나라 두 번째 unit 부터 캐시가 듣는다.
- 출력 스키마는 unit 마다가 아니라 하나를 공유한다(포인터를 키가 아니라 배열 원소로 받는다).
- 포인터 집합이 어긋나면 어긋난 목록을 되돌려주며 3회까지 다시 시킨다.
- **잘리면 잘린 포인터만 다시 시킨다**(신규 — §F).

### 크레딧이 돌아오면 이것만 하면 끝난다 (잔여 88 unit → 11행)

```bash
# 1) ru 7슬러그 (77 unit) — 가장 큰 덩어리
npm run i18n:translate -- --locale=ru --concurrency=3

# 2) de 4 unit (잘림 3 + 미번역 1) — 파일을 지워 뒀으므로 이것만 다시 돈다
npm run i18n:translate -- --locale=de --slugs=from-busan-gyeongju-ancient-capital-day-tour,jeju-southern-top-unesco-spots-tour,southwest-hallasan-osulloc-aewol

# 3) it southwest 7 unit
npm run i18n:translate -- --locale=it --slugs=southwest-hallasan-osulloc-aewol

# 4) 검증 → 발행
for L in ru de it; do npm run i18n:verify -- --locale=$L && npm run i18n:apply -- --locale=$L --apply; done
```

🔴 **`--force` 를 붙이지 마라.** 붙이면 그 슬러그의 **멀쩡한 유닛 30여 개까지** 다시
번역해 크레딧을 버린다. 다시 해야 할 것만 골라 파일을 지워 뒀다.

🔴 **`--partial` 도 쓰지 마라.** `apply.ts` 는 INSERT-only라 **부분 발행한 행은 영원히
그대로다.** 지금 남은 11행은 전부 「번역이 실제로 없는」 것이라, 부분 발행하면 그 자리가
영구히 영어로 박힌다. 반드시 번역을 끝내고 커버리지 100% 로 발행하라.

---

## §E 🔴 건드리면 안 되는 것

1. **`TOUR_PRODUCT_FALLBACK_URL_LOCALES`**
   (`app/(marketing)/tour-product/[slug]/tourProductPageBody.tsx`, `["fr","de","it","ru"]`).
   **오픈은 사람 결정이다.** 이 배열이 있는 한 DB 에 넣어도 손님은 EN 을 본다 — 그게 이
   트랙이 라이브 DB 에 안전하게 쓸 수 있는 전제다. 이번 세션도 손대지 않았다.
2. **기존 6로케일 행 UPDATE.** `apply.ts` 는 INSERT-only. 대상 행이 있으면 건너뛴다.
3. **`match_pois.names_other_locales`** — 게이트가 없어 쓰는 즉시 고객에게 반영된다.
4. **`messages/*.json` 기존 키.**
5. **`TourProductPageLocale`** 은 6로케일 고정 타입이다. de/fr/it/ru 는 DB 행으로만 스테이징.

---

## §F 이번 세션이 한 것 — 잘림을 **생성하는 자리에서** 잡는다

`translate.ts` 가 포인터 집합만 보고 내용의 완결성은 안 봤다. 그래서 잘린 3건이 조용히
출력 파일에 들어갔고 verify 가 몇 시간 뒤에 잡았다. 세 가지를 넣었다.

1. **`findTruncatedSegments`**(`lib/i18n/pipeline/gates.ts`) — 원문 200자 이상이고
   길이비 **0.6 미만**이면 잘림으로 본다.
   🔴 **G8(de 0.9–1.5)과 문턱이 다른 건 의도다.** G8 은 품질 대역이라 플래그만 하지만
   이건 **재요청을 발동시키므로** 정상 압축에 걸리면 안 된다.
   **실측: de·fr·it 번역 세그먼트 6,752개 중 0.6 미만은 정확히 3개, 셋 다 진짜 잘림. 오탐 0.**
   문턱을 올리려면 같은 corpus 로 다시 재라.
2. **`repairTruncated`**(`scripts/i18n/translate.ts`) — 잘린 **포인터만** 새 요청으로
   좁혀 2회까지 다시 시킨다. 유닛 전체를 다시 돌리면 멀쩡한 55개를 버린다.
   그래도 안 되면 **파일을 쓰지 않는다** — 다음 실행이 그 unit 을 다시 집도록.
3. **`stop_reason === 'max_tokens'` 판정** — 전엔 이게 잘린 JSON → `JSON parse` 오류로
   위장돼서 "unit 을 쪼개라" 는 처방이 안 보였다.

### 그리고 G3 오탐 3유형을 좁게 닫았다 (§C)

`clockNotationLosses` 에 **12시제 범위**(meridiem 이 범위 끝에만 붙는 경우) 추가 +
`spelledOutLosses` 신설(`1970s`·`24 hours` → fail 대신 flag). 둘 다 상한이 있고,
**로케일별 어휘표가 필요 없다** — 「어떤 낱말로 옮겼는가」가 아니라 「낱말로 옮겨지는 게
정상인 자리인가」만 원문 패턴으로 묻기 때문이다.

게이트: `npx tsc --noEmit` **0** · `gates.test.ts` **85 pass**(잘림 5 + G3 오탐 10 신규,
그중 6개가 「경계를 넘으면 여전히 fail」 뮤테이션) · `lib/i18n`+`__tests__/audit` **524 pass**.
검증 실패 **9 → 0**. 이 변경은 `apply-region-script-locale.ts`·`translate-poi-locales.ts`
(ja/es/zh/zh-TW)도 같은 게이트를 쓰지만, fail→flag 하향과 값이 증명된 면제뿐이라 안전하다.

**잘린 출력 파일 3개는 지웠다**(`git rm`) — 그래야 다음 실행이 `--force` 없이 그것만 다시 집는다.
매니페스트에서 그 3 unit 은 `blocked` 로 남아 있는데 의도된 상태다: verify 는 출력 파일이
없으면 상태를 바꾸지 않고, `blocked` 라서 apply 가 발행하지 않는다. translate 는 파일 존재로
큐를 만들므로 정상적으로 다시 집는다.

---

## §G 이번에 닫힌 것 — 다시 열지 마라

- **`catalog_card.slug` 유령 카드** — `jeju-eastern…` 의 `.es` 가 `…unesco-**lugares**-…`
  였다. 레포·DB 양쪽 수정. 전체 275행·전 번들 스캔에서 이것 하나뿐이었다.
  🔴 파이프라인으로는 재발할 수 없다 — `segments.ts:204` 가 깊이에 상관없이
  `slug`·`id`·`url` 류 리프 키를 번역 대상에서 뺀다.
- **부산 데이투어 de/fr/it/ru 의 낡은 픽업** — `applied/2026-08-05-16-*.sql` 로 갱신.
- **`departure` 가 0인 102행** — 레거시 `meeting_points` 스키마 13슬러그이고 EN 도 같다.
  **로케일 결함이 아니다.**
- **`it:1970` 은 결함이 아니다**(§C). 재번역 목록에 다시 올리지 마라.

---

## §H 사장님 결정 대기

1. **부산 데이투어 소요시간 표기.** 첫 픽업 08:10 이 되면서 라벨 "10.5시간"이 실제
   (08:10 → 약 19:00 = 10.8시간)보다 20분 적다. 11시간으로 올릴지는 결정 사항.
2. **스몰그룹 하차.** 픽업만 호텔 도어투도어가 됐고 하차는 시내 4개 역 그대로다.
3. **스몰그룹 점심·하차 시각은 유도값이다.**
4. ✅ **§C 오탐 — 2026-08-07 사장님 승인으로 닫혔다.** 게이트를 좁게 고쳤고 2행이 발행됐다.
   결정 과정에서 **`--partial` 권고를 실측으로 뒤집었다**(478 세그먼트 영구 영어 vs 오탐 6개).
   다시 열지 마라.
5. 🔴 **남은 진짜 게이트는 Anthropic API 크레딧 하나뿐이다.** 코드 잔여 없음.
   충전되면 §D 의 4줄로 11행이 닫힌다.
