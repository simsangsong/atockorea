# 다음 세션 부트스트랩 — 투어 카탈로그 개편 (2026-08-04)

> **이 문서 한 줄 요약:** 레포 쪽은 전부 끝나 main 에 머지됐다(PR #711 · #714 · #717).
> **남은 건 DB 반쪽 하나뿐** — `supabase/pending-db-apply/2026-08-04-0{1,2,3,4}.sql` 을
> 순서대로 적용하고 `import-match-v18.mjs --single` 을 4슬러그에 돌리는 것.
> 이 세션(클라우드)은 소비자 Supabase 프로젝트에 MCP 권한이 없어 SQL 을 스테이징만 했다.

---

## 0. 로컬 세션 첫 명령 (원커맨드)

```bash
npm run tours:apply-2026-08-04 -- --dry-run   # 계획만 출력, DB 무변경
npm run tours:apply-2026-08-04                # 실제 적용
```

`scripts/apply-tour-catalog-2026-08-04.mjs` 가 하는 일 — **멱등, 재실행 안전**:

0. **사전 점검** — env, 4개 SQL 존재, 부산 번들 10로케일 파스 + 가격 일치,
   SQL 03 의 offers 금액이 번들 가격과 같은지(어긋나면 생성기 재실행하라고 알려주고 중단)
1. `-01` → `-02` → `-03` → `-04` **파일명 순서대로** `psql` 로 적용
   (각 파일이 단일 트랜잭션 — 실패하면 그 파일은 통째로 롤백되고 뒤 파일은 실행되지 않는다)
2. `import-match-v18.mjs --single` 4슬러그 실행 → 추천엔진 `match_tours` 동기화
3. **검증** — 수국 2종 `is_active=false` · 제주 3종 + 부산 `is_active=true` ·
   `tours.price` 가 번들과 일치 · 페이지 로케일별 `is_published`(콘텐츠 6 + 스테이징 4) ·
   부산 offers 2행($59 기본 / $79 캡슐 포함) · `match_tours` 4행
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

기준선: tsc **0** · jest **559 스위트 / 5,926 pass / 0 fail**.

---

## 2. 지금 라이브인 것 / 아직 아닌 것

**레포(배포 완료, Vercel green):**
- 수국 2종은 **모든 소비자 표면에서 이미 사라짐** — 블록리스트가 앱 레이어에서 거르므로 DB 무관.
- 제주 3종 + 부산 신규는 **정적 카탈로그**(`/tours/list`)와 **상세 페이지**(`/tour-product/...`)에 노출.

**DB 미적용이라 아직 안 되는 것:**
- `/api/tours` 기반 목록·홈 피드(`tours.is_active` 를 읽음)
- 챗봇/매처 추천(`match_tours` 행 부재 또는 구 코스)
- `/tour/[id]/checkout` 결제 진입(신규 부산 상품은 `tours` 행 자체가 없음)
- → **위 원커맨드가 이 넷을 한 번에 닫는다.**

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

---

## 5. 사람 게이트 (코드 아님)

1. **de/fr/it/ru 오픈 결정** — 번역은 완비됐지만 `TOUR_PRODUCT_FALLBACK_URL_LOCALES`
   (`app/(marketing)/tour-product/[slug]/tourProductPageBody.tsx`)가 이 4로케일을 EN 으로 좁힌다.
   🔴 **이 배열은 사장님 결정 없이 건드리지 말 것**(i18n 확장 트랙 불변 규칙).
   여는 날 할 일: 배열에서 제거 + 6로케일 타입(`TourProductPageLocale`) 확장 + 레지스트리 등록 +
   4로케일 실렌더 QA. 지금은 DB 행(`-04`)과 번들이 **대기 상태로 준비**되어 있다.
2. **다릿돌전망대·닥밭골 사진 0장** — 두 스톱은 이미지 없이 나간다. 촬영분이 생기면
   `public/images/tours/` 에 넣고 빌더의 이미지 상수에 연결.
3. **부산 신규 상품 운영 검수** — 스카이캡슐 티켓 포함 옵션의 실제 예약 절차(캡슐 사전 예약 담당·
   2인 1캡슐 정산)를 운영팀과 확정.

---

## 6. 알려진 잔여 결함 (이번 트랙에서 발견, 미수정)

**도너 상품 `busan-top-attractions-day-tour` 의 비EN 스티키 바 문구가 개발 주석 오번역이다.**
ko/ja/zh/zh-TW/es 5개 로케일에서 예약 바에 "checkout_tour_id는 런타임 시 Supabase / env에서
확인되며, 정적 JSONB의 일부가 아닙니다." 가 그대로 노출된다. 신규 부산 상품은 우회했지만
도너는 라이브다. 같은 오염이 다른 상품에도 있는지 스윕 필요:

```bash
grep -rl "checkout_tour_id" components/product-tour-static/*/*.json
```

---

## 7. 이번 트랙의 PR

- **#711** 수국 내림 + 제주 3종 오픈 + 동부 재코스 (merged `fa0871d8`)
- **#714** 부산 스몰그룹 신규 상품 + 가격 $59/$79 (merged `cb7f42b6`)
- **#717** 신규 상품 10로케일 번역 (merged `85cca61a`)
