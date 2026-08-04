# 서울발 신규 상품 2종 (2026-08-04) — **종결**

> **한 줄 요약:** ①②③ 전부 닫혔다. 가격 확정(가평 $59 / 겨울 $69) · POI 재검증 완료 ·
> DB 적용 완료(SQL 은 **10~13** 으로 재번호, `applied/` 로 이동 — 처음 05~08 로 썼다가
> 포천/경주와 곹쳐 08~11 로, 다시 병행 세션이 08/09 를 가져가 10~13 으로 — **두 번 재번호했다**). 남은 건 **사람 게이트 2건뿐**:
> 어비계곡 마을에 2026-27 시즌 확인(031-585-3551), 그리고 **겨울 상품 판매 오픈 결정**.

## 🔴 이 문서를 읽는 다음 세션이 먼저 알아야 할 것

1. **아래 §1·§2·§6 의 상당수는 이미 해결됐다.** 남아 있는 건 역사 기록이다.
   실제 잔여는 이 블록과 §9 뿐이다.
2. **겨울 상품은 판매 중지 상태다 — `is_active=false` **그리고**
   `CONSUMER_BLOCKED_TOUR_SLUGS`, 두 쪽 다.**
   🔴 프로덕션 실측이 제 첫 가정을 반증했다: `is_active=false` 만으로는 `/api/tours`(17건)에서만
   빠지고 **`/tours/list` 에는 카드 링크가 그대로 있었다**(같은 방식으로 재본 블록리스트 상품은 `href=false`).
   카드를 떼는 건 블록리스트고, **블록리스트는 상품 페이지까지 404 로 만든다**
   (`assertRegisteredConsumerSlug` → `isTourSlugBlockedFromConsumerSurfaces` → `notFound()`).
   즉 지금 겨울 상품은 **시야에서 완전히 빠졌다.** 이게 경주가 재오픈 전까지 있던 상태와 같다. 데이터·페이지·offer 전부 라이브 DB 에
   있지만 팔리지 않는다. 이유: 상품 자신의 운영 노트가 "do not open year-round sales" 인데
   **`matching_profile.seasonality`(=`winter_only`)를 읽는 코드가 앱 어디에도 없다**(2026-08-04 확인).
   즉 시즌은 판매를 막지 못한다. 추천 엔진만 `match_tours.available_months=[12,1,2]` 로 막는다.
   여는 법 — 마을 확인 후:
   ```
   node --env-file=.env.local scripts/apply-seoul-new-products-2026-08.mjs --only seoul-winter-seoraksan-nami-eobi-ice-valley-day-tour
   ```
   (`--inactive` 를 빼면 `is_active=true` 로 올라간다.)
3. **`npm run tours:apply-2026-08-04` 는 이 환경에서 못 돈다** — `psql` 도 `SUPABASE_DB_URL` 도 없다.
   대체 경로가 `scripts/apply-seoul-new-products-2026-08.mjs`(supabase-js)다. 행 매핑은
   `scripts/seoul-new-products-rows-2026-08.mjs` 한 곳에 있고 SQL 생성기도 같은 걸 읽는다.
4. 🔴 **"pending-db-apply 에 파일이 있다" ≠ "미적용"이다.** 이 문서와 CLAUDE.md 가 둘 다
   "01~04 미적용"이라고 적어 놨지만 **DB 를 조회해 보니 01~07 전부 이미 적용돼 있었다.**
   어떤 세션이 적용하고 파일만 안 옮긴 것이다. **판정은 객체 존재로 하라.**

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

## 1′. ✅ 사장님 결정 (2026-08-04) — §1 의 ①②③ 을 닫는다

| 항목 | 결정 | 반영 위치 |
|---|---|---|
| 가평 가격 | **$59** (형제 상품 역산값 유지) | 빌더 상수 · SLUG_OVERRIDES ×2 · offers · DB |
| 겨울 가격 | **$69** (스크린샷 Klook $69.25 반올림) | 위와 동일 |
| maxGroupSize | **40** (조인 대형버스, 8은 거짓) | SLUG_OVERRIDES ×2 · `group_size` 문자열 |
| 어비 도착 16:45 | **일정 유지, 문구만 정직하게** | 10로케일 × 3필드 + 운영 노트 |
| 겨울 시즌 | **12월 중순 ~ 2월 중순 잠정 표기** | 10로케일 `visitBasics.closed` |

⚠ **가격은 이제 게이트가 지킨다.** `tours:qa-seoul-2026-08` 이 번들 · SLUG_OVERRIDES 두 파일 ·
offers SQL 네 곳을 대조하고, 어긋나면 exit 1 한다(양성대조로 확인함).

---

## 1. (역사) 사람 게이트 — 순서대로

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

## 2′. ✅ 재검증 결과 (2026-08-04 후속 세션, egress 열림) — §2 를 대체한다

출처 우선순위: **운영 주체 공식 사이트 > 지역 정론지 > 검색 스니펫**.

### 어비계곡 — 마을 공식 사이트가 정본
`어비계곡마을` (https://www.xn--h89a2b7dz4p95kqrk16mt3b.com/)

| 항목 | 확정값 | 이전 |
|---|---|---|
| 주소 | **경기도 가평군 설악면 어비산길 168** | 4개가 돌았음 |
| 좌표 | **37.595339, 127.509512** (Google Geocoding ROOFTOP) | 없었음 |
| 전화 | 031-585-3551 | 없었음 |
| 운영시간 | **10:00 – 17:00** | "reported roughly" |
| 운영기간 | **2025.12.20 – 2026.02.19** | 종료일만 알았음 |
| 빙벽 관람료 | **₩1,000/인** · 계곡 자체는 무료 | ₩1,000 vs 무료 "충돌" |
| 체험 패스 | ₩5,000 ~ ₩30,000 | 없었음 |
| 주차비 | **무료**(마을 입구 첫 주차장) + 데크길 **약 500m 도보** | ₩3,000/5,000/10,000 |

🔴 **₩1,000 과 "무료"는 충돌이 아니었다** — 계곡은 무료, 관람 구역이 유료다. 대상이 다르다.

### 인공 여부 — §3 는 옳다, 유지 확정
경인일보가 **「어비계곡 인공 빙벽」**, **「일부 주민 등이 조성한」**, **「2023년 겨울 … 처음으로 조성」**
로 못 박는다. ⚠ 반대 주장 1건 발견(아던트뉴스 "자연이 만든 빙벽") — **소수 오보다.**
자연 지형에는 조성 연도가 없다.

### 남이섬 — namisum.com (WebFetch 403, 인앱 브라우저로 열림)
- 입도 첫 배 **08:00** / 마지막 **21:00**, 출도 마지막 **21:05**
- 간격 08–09시 30분 · **09–18시 10~20분** · 18–21시 30분 · 승선 **약 5분**
- 입장료 **일반 ₩19,000**(왕복 선박 포함)
- 🔴 **"마지막 입장 18:00"은 오정보였다.** 18:00 은 섬 안 상점이 닫는 시각이고
  기존 콘텐츠가 **이미 맞게** 적고 있었다. 공식은 12~3월 18:01 이후 매표 할인까지 운영한다.

### 아침고요 / 쁘띠프랑스 — 도너 값 전부 확인
- 아침고요 **08:30–19:00 · 입장마감 18:00 · 어른 ₩11,000** ✓
- 쁘띠프랑스 **09:00–18:00 · 대인 ₩12,000 · 통합권 ₩19,500** ✓
- ₩10,000 의 정체 = **가평군민·경로·장애인·유공자 할인가**(도너 모순의 원인)

### 구간 이동시간 — 실측 (Kakao Mobility)
🔴 **Google Directions 는 한국 내 자동차 경로를 안 준다(전 구간 ZERO_RESULTS).** Kakao 를 써라.

| 구간 | 실측 | 페이지 표기 | 판정 |
|---|---|---|---|
| 명동 → 남이섬 | 94분 | ~1.5시간 | ✓ |
| 남이섬 → 아침고요 | 37분 | ~35분 | ✓ |
| 아침고요 → 쁘띠프랑스 | **45분** | "Half an hour" | 🔴 **고쳤다** → 쁘띠 도착 15:45→16:00 |
| 명동 → 설악산 | 161분 | ~3시간(휴게 포함) | ✓ |
| 설악산 → 남이섬 | 122분 | ~2시간 | ✓ |
| 남이섬 → 어비계곡 | **40분** | "Forty minutes" | ✓ 정확 |
| 어비계곡 → 명동/홍대 | 67 / 90분 | ~1.5시간 | ✓ |

### 🔴 재검증이 잡은 결함 3건
1. **겨울 상품이 어비계곡에 16:45 도착인데 공식 운영 종료가 17:00.** 게다가 1월 가평 일몰이
   17:20 전후라 「조명 켜지는 시간 / blue hour」는 **운영시간 안에서 못 지키는 약속**이었다.
   → 사장님 결정: **일정 유지, 문구만 정직하게**. 10로케일에서 조명 약속을 뺐고
   운영 노트에 "가이드가 당일 전화 확인" 을 넣었다.
2. **아침고요→쁘띠프랑스 45분**(위 표).
3. **소요시간 표기 13시간 vs 실제 13.5시간**(06:00 픽업 → 19:30 홍대 하차,
   `matching_profile.duration_hours` 는 이미 13.5였다). 10로케일 + SQL 정정.

---

## 2. 🔴 (역사) 최초 세션의 제약 — POI 검증이 반쪽이었다

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

---

## 8′. 실렌더 QA 결과 (2026-08-04) — 여기서 결함 3건이 더 나왔다

🔴 **번들만 고치면 화면은 안 바뀐다.** 상품 페이지의 렌더 정본은 **DB(`tour_product_pages.detail_payload`)**
이고 정적 JSON 은 폴백이다. 이 세션에서 세 번 헛다리를 짚었다:
① dev 재시작으로 될 줄 알았다(아니었다) ② 번들이 깨끗한 걸 확인하고 끝난 줄 알았다(DB 가 낡아 있었다)
③ 스테이징 로케일은 INSERT-only 라 재적용해도 안 바뀐다(`--update-staged` 필요).

### 실렌더가 잡은 결함
1. **아코디언에 마크다운 `**` 가 그대로 찍혔다** — 상품당 24개. `practicalAccordionItems` 의
   `content`·`preview` 는 **평문 렌더**인데 도너 본문과 작성 카피가 둘 다 `**` 를 쓴다.
   빌더의 `toPlain()`/`toPreview()` 가 벗긴다. **스톱 설명은 마크다운 렌더라 그대로 둔다.**
2. **`matching_profile.walking_notes` 가 도너 것 그대로였다** — 가평은 11.5시간인데 「13-hour day」,
   **가지도 않는 설악산·케이블카**를 적고 있었고, 겨울은 **가지도 않는 아침고요**를 적고 있었다.
   `duration_hours` 도 11(라벨 11.5)이었다. 둘 다 명시 지정으로 교체.
3. **「13시간」프로즈가 FAQ 2개 + 신뢰 배지에 남아 있었다**(라벨만 13.5로 고쳤을 때).
   빌더가 로케일별로 정규화하고 **살아남으면 경로를 찍어 throw** 한다.

### 대조군을 세워야 판정이 된다 (이 세션의 큰 교훈)
- 처음 대조군으로 쓴 도너 페이지는 **렌더 자체가 안 됐다**(visible 63자). "도너는 0건"은 무의미했다.
- 제대로 된 대조군 = **부산 소그룹(17,177자 렌더)**. 그것과 비교해서야 24 vs 0 이 결함이 됐다.
- 반대로 CJK 는 대조군이 **선존재**임을 증명했다 — 아래 표.

### CJK 줄바꿈 실측 (`scripts/qa-cjk-tour-product.mjs`, 모바일 390px)
| 페이지 | ko | ja | zh-CN | zh-TW |
|---|---|---|---|---|
| 신규 가평 | 1 | 58 | 6 | 6 |
| 신규 겨울 | 1 | 55 | 5 | 6 |
| **대조군 부산(라이브)** | **0** | **44** | **12** | **13** |

→ **ja 가 전 상품에서 최악이고 이건 선존재 조건이다.** 신규 2종은 zh/zh-TW 에서 오히려 대조군보다 낫다.
깨지는 건 「아침고요수목⏎원」·「雪岳山国立⏎公園」처럼 **긴 고유명사가 좁은 칩에 들어갈 때**다.
고치려면 공용 컴포넌트를 건드려야 하고 **38개 상품 전부에 영향**이 간다 → 별도 티켓.

### 선존재 결함 하나 더
`/de|fr|it|ru/tour-product/<slug>` 는 코드 주석이 약속한 「308 → EN 경로」가 아니라 **404** 를 준다
(53.5KB 홈 셸). **부산·포천 라이브도 똑같다** — 전 상품 공통이며 이 트랙과 무관하다.

---

## 9. 잔여 (2026-08-04 종결 시점)

**코드 잔여 없음.** 남은 건 전부 사람 게이트다.

1. 🔴 **어비계곡 마을에 2026-27 시즌 확인** — 031-585-3551 (가일2리 자치회).
   확인되면 10로케일 `eobi.visitBasics.closed` 를 구체화하고 빌더 재실행.
2. 🔴 **겨울 상품 판매 오픈 결정** — 지금 `is_active=false`. 여는 명령은 이 문서 맨 위 §2번.
3. **어비계곡 사진 0장** — 촬영분이 생기면 빌더의 `EOBI_IMAGES` 에 연결.
4. **de/fr/it/ru 는 여전히 스테이징** — DB 행은 있고 손님에겐 EN 이 나간다.
   `TOUR_PRODUCT_FALLBACK_URL_LOCALES` 는 사장님 결정(§5).

### 별도 티켓감 (이 트랙 밖에서 발견)
- 🔴 **`/de|fr|it|ru/tour-product/<slug>` 가 404** — 코드는 「308 → EN, never a 404」라고 적어 놨다
  (`tourProductPageBody.tsx` P1-7 주석). 라이브 전 상품 공통.
- 🔴 **상품 페이지 CJK 줄바꿈이 ja 에서 광범위하게 깨진다**(라이브 부산 44건). 긴 고유명사 × 좁은 칩.
  공용 컴포넌트 문제라 38개 상품에 동시 영향.
- 도너 `seoul-private-nami-morning-calm-petite-france` 는 **쁘띠프랑스 입장료 모순
  (₩12,000 vs ₩10,000)을 아직 라이브로 내보내고 있다.** ₩10,000 은 군민·경로 할인가다.
- `jeju-eastern-unesco-spots-day-tour` 의 픽업 `timeUsed` 가 아직
  「Eastbound Route 1132 to **Hamdeok**」이라고 적는다 — 재편으로 함덕은 **마지막** 정차가 됐다.
  스톱 순서 자체는 정상(만장굴→성읍→점심→성산→해녀쇼→함덕).
- 부산 신상품이 `catalogRegistrationBuilder.ts`(**실제 배포되는 쪽**)에 등록이 빠져
  `maxGroupSize` 가 카드에서 조용히 사라진다.

---

## 8. (역사) 최초 세션이 남긴 실행 프롬프트

```
서울발 신규 상품 2종 트랙을 이어받는다. PR #722 (브랜치
claude/seoul-gapyeong-tour-poi-mrjhkf) 가 레포 쪽을 끝내 놓았다.

먼저 이것부터 읽어라:
  docs/NEXT-SESSION-SEOUL-GAPYEONG-WINTER-2026-08-04.md
  (§1 사람 게이트 · §2 검증 제약 · §3 인공 빙벽 · §6 함정)

착수 전 5분 grep 으로 현재 상태를 직접 확인하라. 이 문서의 처방을 그대로 믿지 말고
"무엇이 문제인지"로만 읽어라. 숫자는 직접 다시 재라 —
특히 tsc/jest 는 파이프 뒤의 $? 가 아니라 종료코드를 직접 확인하라
(node_modules 가 비어 있으면 npm install 부터. 지난 세션이 여기서 한 번 헛짚었다).

## 우선순위 (순서 고정)

[1] 🔴 POI 재검증 — 지난 세션은 외부 egress 가 막혀(WebFetch 전 호스트 403)
    공식 페이지를 한 장도 못 열었다. 이 세션에서 WebFetch 가 되는지부터 확인하고,
    되면 §2 의 재검증 목록을 닫아라:
      - 어비계곡 좌표/주소 (어비산길 168 / 233 / 130-18 / 99번길 9-10 — 4개가 돈다)
      - 어비계곡 관람료 (₩1,000 vs "무료") 와 주차비 (₩3,000/5,000/10,000)
      - 남이섬 최종 입장 시각 (페리 21:00 vs 마지막 입장 18:00 충돌)
      - 아침고요 오색별빛정원전 시간 (10:00 / 11:00 / 17:00 세 가지)
      - 구간 이동 시간 전부 (라우팅 API 없이 블로그 추정치로 썼다)
    확정되면 scripts/seoul-*-content/<loc>.json 을 고치고 빌더를 다시 돌려라.
    🔴 어비계곡 얼음벽이 인공이라는 사실은 되돌리지 마라 (§3). KTO 영문 페이지가
    natural 이라고 적고 있지만 틀렸다. 한국어 기록이 「인공빙벽」으로 못 박는다.

[2] 사장님 결정 3건을 받아 반영 (§1)
      - 가격 $59 / $64 확정  → 4곳 전부 (빌더 상수 · SLUG_OVERRIDES 2파일 · offers SQL)
      - maxGroupSize (지금 일부러 비어 있다. 조인 버스에 8명은 거짓)
      - 겨울 상품 운영 시즌 (마을이 정한다. 2025-26 은 2/19 종료였다)

[3] DB 적용 — supabase/pending-db-apply/ 를 파일명 순서대로.
    ⚠ 앞선 트랙의 01~04 (제주·부산) 가 아직 미적용이다. 05~08 이 이번 것.
    적용 후: node scripts/import-match-v18.mjs --single <slug>  (2개 슬러그)

[4] 실렌더 QA — 10로케일 × 2상품을 눈으로. 특히 CJK 줄바꿈(qa-cjk-render.mjs)과
    일본어 용어 일관성(도너가 晨静苑 / 晨靜苑 로 갈려 있다 — 선존재 결함).

## 재현 명령

  npm run tours:build-seoul-2026-08     # 오버레이 → 번들 20개 → 카드 → SQL
  npm run tours:qa-seoul-2026-08        # EN 누수 · 슬러그 무결성 · 구조 동형성
  npx tsc --noEmit ; echo $?
  npx jest

## 손대면 안 되는 것

  - 번들 JSON (components/product-tour-static/<slug>/*.json) 은 생성물이다.
    고칠 일이 있으면 scripts/seoul-*-content/ 를 고치고 빌더를 돌려라.
  - catalog_card.slug 을 번역하지 마라 — 404 유령 카드가 생긴다.
  - TOUR_PRODUCT_FALLBACK_URL_LOCALES (de/fr/it/ru 게이트) — 사장님 결정.
  - docs/audit/ 의 생성물 문서에 손으로 쓰지 마라.

진행 보고는 한국어, 코드·커밋은 영어.
```
