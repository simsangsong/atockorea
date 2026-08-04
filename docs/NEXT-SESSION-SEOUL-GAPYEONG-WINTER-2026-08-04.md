# 다음 세션 부트스트랩 — 서울발 신규 상품 2종 (2026-08-04)

> **한 줄 요약:** 레포 쪽은 끝났다. 남은 건 **① 가격 사장님 확정 ② DB 적용
> (`2026-08-04-0{5,6,7,8}.sql`) ③ POI 사실 재검증(이 세션은 외부 egress 가 막혀 있었다)**.

---

## 0. 무엇을 만들었나

사장님 지시(2026-08-04, 스크린샷 2세트): **"서울 가평투어 추가, poi 정보들 검색 검증해서 채우고
10locale번역"** + **"이 투어도 추가하도록"**(겨울 특가).

| 슬러그 | 무엇 | 가격(잠정) | 시즌 |
|---|---|---|---|
| `seoul-gapyeong-nami-morning-calm-petite-france-day-tour` | 남이섬 → 점심 → 아침고요수목원 → 쁘띠프랑스 | **$59** | 연중 |
| `seoul-winter-seoraksan-nami-eobi-ice-valley-day-tour` | 설악산 → 점심 → 남이섬 → 어비계곡 얼음벽 | **$64** | **겨울 한정** |

**둘 다 진짜 공백이었다** — 착수 전 5분 grep 으로 확인했다:
- 가평 3종 조합은 **전세(`seoul-private-nami-morning-calm-petite-france`)만** 있었고 조인 그룹이 없었다.
- 어비계곡은 전 번들 **0건**.
- 사장님이 첫 스크린샷으로 보여준 「설악+남이+아침고요」와 「설악+낙산사+해변」은 **이미 레포에 있다**
  (`seoul-seoraksan-nami-island-morning-calm-day-tour`, `seoul-seoraksan-naksansa-temple-naksan-beach-day-trip`).
  그래서 "가평투어"를 **설악산 없는 가평 조인 투어**로 해석했다. 이 해석이 틀렸다면 여기서부터 되돌려라.

---

## 1. 🔴 사람 게이트 (코드 아님) — 순서대로

### ① 가격 확정 (가장 먼저)
$59 / $64 는 **사장님 결정이 아니다.** 레포의 형제 상품이 Klook 대비 약 8~10% 낮게 책정된
패턴에서 역산한 값이다(설악+남이+아침고요 $71 vs Klook $79.29 / 설악+낙산사 $53 vs $55.95,
겨울 특가 Klook $69.25).

**가격은 4곳에 있다** — 하나만 고치면 화면과 결제가 어긋난다:
1. 빌더의 `PRICE_USD` 상수 (`scripts/build-seoul-*.mjs`)
2. `components/product-tour-static/catalog/staticTourProductRegistry.ts` `SLUG_OVERRIDES`
3. `components/product-tour-static/catalog/catalogRegistrationBuilder.ts` `SLUG_OVERRIDES`
   ⚠ **두 파일에 같은 맵이 중복 존재하고, 실제로 카드·홈·사이트맵에 쓰이는 건 후자다.**
   (부산 신상품은 후자에 등록이 빠져 `maxGroupSize` 가 조용히 사라져 있다 — 별도 티켓)
4. offers SQL (`gen-seoul-new-products-sql-2026-08.mjs` 가 번들에서 읽어 생성)

바꾸는 법: 빌더 상수 → `node scripts/build-seoul-*.mjs` → `node scripts/build-catalog-cards.mjs`
→ `node scripts/gen-seoul-new-products-sql-2026-08.mjs` → 오버라이드 2곳 수동 수정.

### ② `maxGroupSize` 결정
**일부러 비워 뒀다.** 둘 다 조인 그룹 대형 버스인데 서울 형제 상품들은 `maxGroupSize: 8`
(소그룹)로 적혀 있다 — 버스 투어에 8명 상한은 사실이 아니다. 사장님이 실제 정원을 주면 넣어라.
출처 스크린샷에는 "Group size: 5 to 40" 이 찍혀 있다.

### ③ 겨울 상품 운영 시즌 확정
어비계곡 얼음벽은 **마을이 만드는 것이고 마을이 여는 날을 정한다.** 2025-26 시즌은
**2월 19일 종료**였다(Klook 표기 2/28 과 불일치). 2026-27 시즌은 미발표.
**판매 오픈 전에 마을(가일2리 자치회)에 직접 확인해야 한다.**

### ④ 어비계곡 사진 0장
`public/images/tours/` 에 어비계곡 이미지가 없다. 스톱이 사진 없이 나간다
(부산 다릿돌·닥밭골과 같은 자세). 촬영분이 생기면 빌더의 `EOBI_IMAGES` 에 연결.

---

## 2. 🔴 이 세션의 결정적 제약 — POI 검증이 반쪽이다

**이 클라우드 세션은 외부 egress 가 정책으로 막혀 있었다.** `WebFetch` 가 모든 호스트에
**403** 을 반환했다 — `namisum.com`, `morningcalm.co.kr`, `pfcamp.com`, `visitkorea.or.kr`,
심지어 `wikipedia.org` 까지. `curl` 도 프록시에서 `connect_rejected … policy denial`.
**공식 페이지를 단 한 장도 직접 열지 못했다.** 조사는 전부 검색 스니펫 수준이다.

그래서 취한 자세:
- **남이섬 · 아침고요 · 쁘띠프랑스 · 설악산은 새로 쓰지 않고 레포 도너의 KB 검증 본문
  (`verified_date: 2026-04-29`)을 재사용**했다. 검색 결과가 도너 값(남이섬 ₩19,000 ·
  아침고요 ₩11,000 · 쁘띠프랑스 ₩12,000 · 통합권 ₩19,500)을 **확인**해 줬다.
- **도너 모순 1건 수정:** 쁘띠프랑스 입장료가 `visitBasics` ₩12,000 / `highlights` ₩10,000 로
  엇갈렸다. ₩12,000 이 맞아서 빌더가 그 하이라이트 한 줄을 지운다(마커 불일치 시 throw).
- **어비계곡만 새로 썼고, 불확실한 건 전부 불확실하다고 적었다.**

### 재검증이 필요한 목록 (egress 열린 세션에서)
1. **어비계곡 좌표와 주소** — 주소가 4개나 돌아다닌다(어비산길 168 / 233 / 130-18 / 99번길 9-10).
   현재 코드에 어비 좌표는 **안 넣었다**(날씨 앵커는 설악산 기준). 네이버/카카오로 핀을 찍어라.
2. **어비계곡 운영시간·요금** — 얼음벽 관람 ₩1,000 vs "무료"가 둘 다 돌아다닌다.
   주차비는 ₩3,000 / ₩5,000 / ₩10,000 세 가지. 페이지에는 **단일 숫자를 안 박고**
   "마을이 정하며 해마다 바뀐다"로 썼다. 확인되면 구체화하라.
3. **남이섬 최종 입장 시각** — 페리 21:00 vs 마지막 입장 18:00 이 충돌한다.
4. **아침고요 오색별빛정원전 시간** — 10:00 / 11:00 / 17:00 시작이 소스마다 다르다.
5. **구간 이동 시간 전부** — 라우팅 API 를 못 써서 블로그 추정치다.

---

## 3. 🔴 어비계곡 얼음벽은 인공이다 — 이걸 되돌리지 말 것

**가장 중요한 발견.** 영어권 인터넷은 이걸 자연 빙폭으로 잘못 적고 있다:
- **KTO 영문 페이지**가 *"a 25-meter **natural** ice wall"* 이라고 쓴다 — **틀렸다.**
- 경기관광공사 영문 블로그도 *"Nature-Sculpted"* — **틀렸다.**
- Klook · KKday · Creatrip 전부 "natural".

한국어 기록은 명확하다:
- **경인일보 헤드라인이 「가평 어비계곡 인공빙벽」** 이라고 못 박는다.
- *"계곡 암반을 타고 흐르던 물 위로 **인위적으로 물을 뿌려 얼린** 빙벽"*
- 중앙TV: *"한파가 얼리고, **사람이 키운** 얼음성"*
- **2023년 겨울 가일2리 주민들이 처음 만들었다.** 자연 지형에 "만든 해"가 있을 리 없다.
- 운영 주체: **어비계곡마을 / 가일2리 자치회, 주민 약 30명**(상시 10 · 예비 20).

높이는 **25m** 다. 62m 라고 쓴 영문 블로그가 있는데 **거짓이다.**

→ 상품 페이지 카피는 이 사실을 정면으로 쓴다. 유료 페이지에 "자연 빙폭"이라고 적으면
공식처럼 보이는 출처의 오류를 그대로 복제하는 것이다. **다음 세션이 "KTO 에 natural 이라
쓰여 있다"며 되돌리지 말 것.**

---

## 4. 파일 지도

### 빌더 (재생성은 항상 이걸로 — 번들 직접 편집 금지)
- `scripts/build-seoul-gapyeong-2026-08.mjs`
- `scripts/build-seoul-winter-eobi-2026-08.mjs`
- `scripts/gen-seoul-overlay-en-2026-08.mjs` — **생성물** 오버레이 EN 마스터를 도너에서 뽑는다

### 콘텐츠 (사람이 쓰는 곳)
- `scripts/seoul-gapyeong-content/<loc>.json` (10로케일)
- `scripts/seoul-gapyeong-content/donor-overlay/<loc>.json` (en + de/fr/it/ru)
- `scripts/seoul-winter-eobi-content/…` 동일 구조

### 출력
- `components/product-tour-static/<slug>/<slug>.<loc>.json` (10개씩)

### 등록 (5곳 — 전부 반영 완료)
1. `_shared/tourProductBundleSlugs.ts` — 슬러그 목록(타입 소스)
2. `_shared/tourProductBundleRegistry.ts` — 로케일별 lazy 로더 6개씩
3. `catalog/staticTourProductRegistry.ts` — 임포트 12 + `RAW_PAGES_BY_LOCALE` 6맵 + `SLUG_ORDER` + `SLUG_OVERRIDES`
4. `catalog/catalogRegistrationBuilder.ts` — `SLUG_OVERRIDES` (**실제 배포되는 쪽**)
5. `lib/weather/tour-weather-anchor.ts` — 앵커 2개
   ⚠ 빠뜨리면 **에러 없이 제주 날씨가 뜬다**(미지 슬러그 기본값이 성산일출봉).

### 검증
- `scripts/qa-seoul-new-products-2026-08.mjs` — EN 누수 · 슬러그 무결성 · 로케일 구조 동형성 ·
  가격 일치 · 겨울 불변식. **실패 시 exit 1.**
- `node scripts/build-catalog-cards.mjs` — 카탈로그 카드 **생성물**(손으로 고치지 말 것)

### DB (⚠ 미적용)
- `supabase/pending-db-apply/2026-08-04-05-seoul-gapyeong-new-product.sql`
- `supabase/pending-db-apply/2026-08-04-06-seoul-gapyeong-staged-locales.sql`
- `supabase/pending-db-apply/2026-08-04-07-seoul-winter-eobi-new-product.sql`
- `supabase/pending-db-apply/2026-08-04-08-seoul-winter-eobi-staged-locales.sql`
- 생성기: `scripts/gen-seoul-new-products-sql-2026-08.mjs`
- 적용 후: `node scripts/import-match-v18.mjs --single <slug>` (2개 슬러그)

⚠ **`2026-08-04-01~04` 가 아직 미적용이다**(제주·부산 트랙). 파일명 순서대로 적용하라.

---

## 5. de/fr/it/ru 는 스테이징이다

부산 신상품과 같은 자세다. 번들과 DB 행은 준비돼 있지만 **손님에게는 EN 이 나간다** —
`TOUR_PRODUCT_FALLBACK_URL_LOCALES`(`app/(marketing)/tour-product/[slug]/tourProductPageBody.tsx`)가
이 4로케일을 EN 으로 좁히기 때문이다.
🔴 **이 배열은 사장님 결정 없이 건드리지 말 것**(i18n 확장 트랙 불변 규칙).
카탈로그 카드 생성기는 파일시스템 기반이라 4로케일 카드는 이미 생성된다.

---

## 6. 함정 (다음 세션이 반복하지 말 것)

1. **`catalog_card.slug` 을 절대 번역하지 말 것.** 카드 생성기가 파일명보다 JSON 안의 값을
   믿어서(`build-catalog-cards.mjs`), 번역된 슬러그는 **404 로 가는 유령 카드**를 만든다.
   `jeju-eastern-unesco-spots-day-tour` 의 `.es` 가 실제로 이 사고를 냈고 지금도 라이브다
   (`jeju-eastern-unesco-lugares-day-tour`). QA 스크립트가 이걸 막는다.
2. **`SLUG_OVERRIDES` 는 두 파일에 있다.** 헤더 주석이 "여기에만 있다"고 주장하지만 거짓이다.
   두 맵의 값이 서로 다르기까지 하다(예: `jeju-grand-highlights-loop` 93 vs 79).
3. **날씨 앵커 누락은 조용하다** — 에러 없이 제주 날씨를 서빙한다.
4. **`__tests__/tour-content/phase-z-known-bad-strings.test.ts` 는 새 슬러그를 자동 등록한다**
   (디렉터리 스캔). 슬러그 수를 세는 게이트는 없지만 이 콘텐츠 스캔은 새 상품에도 걸린다.
5. **도너 재사용은 도너의 버그도 가져온다.** 이번엔 쁘띠프랑스 입장료 모순이었다.
   도너 상품(`seoul-private-nami-morning-calm-petite-france`)은 **아직 이 모순을 라이브로
   내보내고 있다** — 별도 티켓감.

---

## 7. 기준선

- `npx tsc --noEmit` → **0** (작업 전 확인, 작업 후 재확인)
- 신규 파일은 전부 생성물이거나 스크립트라 기존 테스트 스위트에 영향 없음
- 상품 2종 × 10로케일 = 번들 20개
