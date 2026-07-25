# 다국어 확장 플랜 — 러시아어·프랑스어·독일어·이탈리아어

> **버전: v3.2 (2026-07-26 야간)** — 파일명은 고정, 버전은 이 줄로 관리.
> v1 = 커밋 `afd60e73` `docs/ui-overhaul-and-i18n-expansion-plan-2026-07-25.md` §B (뼈대)
> v2.0 = 실측 재검증 + 파이프라인·할루시네이션 방어 정의
> v2.2 = 범위를 전 고객노출면으로 확장 + 실행모델을 API배치 → Claude Code 세션으로 교체
> v3.0 = ① 「구현 금지」해제 — 사용자 실행 승인 ② 코드 레벨 노출 게이트 실측 발견 → "DB 추가는 고객영향 0" 증명 ③ 실행순서를 고객가치순 → 위험순으로 재배치 ④ Q1~Q7을 "번역을 막는 것"과 "오픈만 막는 것"으로 분리
> **v3.1 = ⑤ §3 자체 정정 — "de/fr/it은 로마자 승계로 LLM 불필요"는 단일 표본 오판이었다. 기존 es/ja 데이터의 절반이 규칙 1(정보 추가 금지) 위반 상태임을 확인 ⑥ 마스킹+격변화/성 한계 발견 ⑦ P1의 선결 대상은 DB가 아니라 글로서리 파일 → S3 즉시 착수 가능, 라이브 영향 0**
>
> **실행 문서.** v2.2의 "구현 금지"는 해제됨.

---

## 0. v3에서 뒤집힌 것 — 노출 게이트가 이미 코드에 있다

v2.2는 "번역을 DB에 넣으면 고객에게 반영된다"는 암묵적 가정 아래 신중론을 펼쳤다. **실측 결과 이 가정은 상품상세에 관해 거짓이다.**

`app/tour-product/[slug]/tourProductPageBody.tsx`
```ts
:38  export const TOUR_PRODUCT_URL_LOCALES = ["ko","ja","es","zh-CN","zh-TW"] as const;
:53  export const TOUR_PRODUCT_FALLBACK_URL_LOCALES = ["fr","de","it","ru"] as const;
```

de/fr/it/ru은 **영어 폴백 로케일로 코드에 하드코딩**돼 있다(P1-7이 만든 구조). 즉

> **`tour_product_pages`에 `locale='de'` 행을 아무리 넣어도, 위 배열 2개를 손대기 전까지 고객 화면은 1픽셀도 바뀌지 않는다.**

이것이 v3의 실행 근거다. 번역을 DB에 **완전히 비가시적으로 스테이징**하고, 오픈은 나중에 별도 코드 1줄 플립으로 분리한다. `__tests__/app/tourProductLocaleRouting.test.ts`가 이 이원 구조를 이미 강제하고 있어서, 플립 시 한쪽 배열에서 빼고 다른 쪽에 넣지 않으면 테스트가 깨진다.

### 표면별 게이트 유무 — v3의 핵심 분류표

| 표면 | DB 추가 시 고객 영향 | 게이트 | 야간 무인 |
|---|---|---|---|
| **S3 상품상세** `tour_product_pages` | **없음 (0)** | 코드 배열 2개 | ✅ **최적** |
| S2 POI 명칭 `names_other_locales` | 있음 — 즉시 반영 (현재 `names.en` 폴백) | 없음 | ⚠ 검증 후 |
| S5 컨시어지 RAG `knowledge_chunks` | 있음 — 즉시 반영 | 없음 | ⚠ 검증 후 |
| S6 WhatsApp `ops_whatsapp_templates` | 있음 | 없음 | ⚠ 검증 후 |
| S4 POI 설명 `content_locales` | 있음 | 없음 | ⚠ 검증 후 |
| S9 이메일 · S10/S11 외부화 | **코드 리팩터** | — | ❌ **금지** |

**❌ 금지 근거:** S9~S11은 하드코딩 문자열을 카탈로그로 빼내는 리팩터다. v2.2가 "P1-5 사고와 같은 성격 — 화면 단위 분할·빌드·**시각 확인**·개별 커밋"이라고 명시했고, **시각 확인은 사람만 할 수 있다.** 무인 야간작업에서 제외한다. 이건 신중론이 아니라 작업 성격의 문제다.

---

## 1. 오픈 퀘스천 재분류 — 무엇이 실제로 막고 있나 (v3 신규)

v2.2 §9의 Q1~Q7을 "번역 실행을 막는가"로 다시 물으면 **막는 것은 하나도 없다.**

| # | 질문 | v2.2 권고 | **v3 판정** |
|---|---|---|---|
| Q1 | `content_locales`의 기존 de/fr/it/ru 13건 출처·품질? | 검증기 통과시켜 보고 실패 시 폐기 | **자동 판정 가능.** 사람 결정 아님 — 검증기가 판정. S4 착수 시점까지 유예 |
| Q2 | 이탈리아어 격식 **Lei** 유지? | 유지 | **결정 불필요.** 현행이 Lei이고 유지가 기본값. 바꾸는 쪽이 2,734키 재작업이라 비대칭 |
| Q3 | 약관·환불·개인정보를 법률검토 없이 노출? | 비권고 | **범위에서 제외하면 소멸.** 추출 화이트리스트에서 법적 문구 키를 빼면 질문 자체가 사라짐 |
| Q4 | 제품명(Tour Room·Smart Guide) 번역? | 영어 유지 | **채택.** 글로서리 L2에 박음 |
| Q5 | 사람 감수 인력 | 오픈 언어 수를 줄여라 | **오픈 게이트 문제.** 번역·스테이징에는 불필요 |
| Q6 | 러시아 결제·제재 리스크 | 번역 착수 전 확인 | **오픈 게이트 문제.** 러시아어 스테이징은 리스크 0 — 노출 안 하니까 |
| Q7 | S7 `tours.translations` 26건 현역/폐기? | 확인 후 폐기 | **조회로 확인 가능.** P9 사안 |

**결론: Q3·Q5·Q6는 "오픈 결정"이고 "번역 결정"이 아니다.** 오픈 게이트를 건드리지 않는 한 이 세 질문 없이 번역을 끝까지 진행할 수 있다. v2.2가 이 둘을 섞어서 착수를 막았다.

**단 Q6는 러시아어 오픈 직전에 반드시 회수해야 한다** — 번역을 다 해놓고 결제가 막혀 못 여는 건 낭비지만, 낭비의 크기가 스테이징 비용뿐이라 진행이 옳다.

---

## 2. P0 인프라 6종 — 정체와 구현 가능성 (v3 신규)

v2.2는 "P0 인프라: 개발 3~4일(사람)"이라고만 적어 착수를 막았다. 실물이 무엇인지 정의한다.

| # | 물건 | 정체 | 없으면 무슨 일이 나는가 | 구현 가능? |
|---|---|---|---|---|
| **①** | `scripts/i18n/extract.ts` **추출기** | `detail_payload`(jsonb)를 재귀 순회해 **번역 대상 리프만** `(json_pointer, text)`로 뽑음. 화이트리스트 기반 | `matching_profile`·URL·enum·`product_id`까지 번역돼 **매칭 엔진과 라우팅이 깨진다** | ✅ 순수 TS. 외부 의존 0 |
| **②** | `scripts/i18n/verify.ts` **G1~G11 검증기** | 결정론적 게이트 11종 (구조/토큰/숫자/단위/플레이스홀더/마크업/URL/길이비/미번역/문자셋/금지어) | 숫자 변조·사실 누락·잘린 JSON이 **그대로 발행된다.** P0의 최대 가치 | ✅ 순수 함수 + 유닛테스트 |
| **③** | `i18n-work/manifest.json` **매니페스트** | unit별 상태(`pending`→`auto_pass`/`verify_fail`/`blocked`) | 세션이 끊기면 **어디까지 했는지 소실.** 야간 무인작업의 생명줄 | ✅ JSON + 헬퍼 |
| **④** | `i18n-work/RULES.md` **규칙** | 서브에이전트 주입용 규칙 8개 (v2.2 §3-[2]에 초안 존재) | 에이전트가 "개선"·"요약"·범위이탈 | ✅ 초안 있음 |
| **⑤** | `i18n-work/glossary/*.json` **글로서리** | L1 고유명사(POI 124) + L2 브랜드 + L3 도메인 | 마스킹 불가 → **H1 고유명사 창작**(감천→甘泉류) 방어 소멸 | ⚠ **L1은 S2 산출물** — 순환의존, P1이 선행 |
| **⑥** | `i18n-work/styleguide/*.md` **스타일가이드** | 호칭(Sie/vous/Lei/вы)·숫자·날짜·시각 서식 1p (v2.2 §5-②에 표 존재) | 문체·서식 불일치 | ✅ 표 있음 |

**판정: 6종 전부 오늘 구현 가능. 외부 의존 0, 사람 결정 0, 라이브 영향 0**(전부 신규 파일). ⑤의 L1만 P1(S2) 완료 후 자동 생성된다 — 이것이 실행 순서를 결정한다.

기존 자산 `lib/ai/glossary.ts`(158줄) 재사용 확인: `maskGlossaryTerms` / `restoreGlossaryTerms` / `hasUnresolvedToken` / `collectUnknownProperNouns` / `glossaryToken` 전부 존재. **`:114`의 `names.en ??` 폴백도 실측 확인 — S2 미완 시 독일어 본문에 영어 지명이 박히는 경로가 실재한다.**

---

## 3. S2 POI 명칭 — 실측 재검증 (v3.1 정정)

> **⚠ v3.0 초판 정정.** 초판은 `hallasan_eoseungsaengak` 단일 샘플(`es: "Hallasan Eoseungsaengak"`)을 보고 **"스페인어는 순수 로마자이므로 de/fr/it은 결정론적 승계 가능"**이라고 썼다. **표본을 넓히자 거짓으로 판명됐다.**

### 실측 — 기존 es/ja 데이터는 일관되지 않다

| `name_en` | 기존 `es` | 성격 |
|---|---|---|
| `Hallasan Eoseungsaengak` | `Hallasan Eoseungsaengak` | 순수 로마자 |
| `Bukchon Hanok Village` | `Bukchon Hanok Village` | 순수 로마자 |
| `Gamcheon Culture Village` | `Pueblo Cultural de Gamcheon` | **수식어 번역** |
| `Gukje Market` | `Mercado Gukje` | 수식어 번역 |
| `Bulguksa Temple` | `Templo Bulguksa (Patrimonio Mundial de la UNESCO)` | 🔴 **정보 추가** (규칙 1 위반) |
| `Cheonjeyeon Falls` | `Cascada de Cheonjeyeon (Estanque de los Dioses)` | 🔴 **정보 추가** |
| `Gwangjang Market` | `Almuerzo en el Mercado Gwangjang` | 🔴 **이름이 아니라 일정 라벨**("점심") |
| `Cheongsapo Blue Line Park` | `Cheongsapo y Haeundae Blue Line Park` | 🔴 **다른 장소를 추가** |

**결론 1: de/fr/it도 판단이 필요한 번역 작업이다.** 결정론적 스크립트로 끝나지 않는다.
**결론 2: 기존 es/ja를 규범으로 삼으면 안 된다.** 절반은 규칙 1(정보 추가 금지)을 위반하고 있다. 피벗은 **`name_en`**이다.

### v3.1 처리 규범

| 언어 | 고유명사 | 수식어(Village/Temple/Falls/Market…) | 괄호 주석 |
|---|---|---|---|
| de / fr / it | `name_en`의 로마자 **그대로** | **번역** | **금지** |
| ru | **키릴 전사**(Kontsevich) | 번역 | 금지 |

- ✅ `Gamcheon Culture Village` → de `Kulturdorf Gamcheon` / fr `Village culturel de Gamcheon` / ru `Деревня культуры Камчхон`
- ❌ 괄호 주석·UNESCO 표기·활동("점심") 추가 — **원문에 없으면 넣지 않는다**

### 🔴 알려진 한계 — 마스킹 + 격변화/성 (신규 발견)

`maskGlossaryTerms`는 **이름 전체**를 `⟦G0⟧`로 치환하고, `restoreGlossaryTerms`가 대상 로케일 명칭을 **주격 고정형**으로 되꽂는다. 따라서

- **독일어:** 번역가는 `⟦G0⟧`의 문법성을 모른 채 관사를 써야 한다 → `das/der/die` 오류 가능
- **러시아어:** 되꽂히는 형태가 주격이라 `Посетите деревню…`(대격) 자리에 주격이 들어간다 → 격 불일치

이건 명칭 데이터의 문제가 아니라 **마스킹 단위의 문제**다(코드 변경 사안, 이번 범위 밖).
→ **완화:** ① 수식어가 짧고 격변화 영향이 작은 형태를 고른다 ② A-1 사람 감수에서 POI 명칭 주변 문장을 필수 확인 항목으로 둔다 ③ ru는 §7 Q10에 따라 **미적용 유지**가 기본.

### 🟢 P1의 진짜 선결 대상은 DB가 아니라 글로서리 파일이다 (v3.1 핵심)

`maskGlossaryTerms(text, entries)`는 **엔트리를 인자로 받는다** — DB를 읽지 않는다. 즉

> **`i18n-work/glossary/*.json`만 채우면 마스킹·복원 파이프라인이 완전히 작동한다. `match_pois` 쓰기는 필요 없다.**

따라서 P1을 **파일 산출까지만** 하고 DB 쓰기는 분리한다. 결과:
- S3 번역이 **즉시 착수 가능**(선결 해제)
- 라이브 고객 영향 **0** — ungated 표면을 야간에 건드리지 않는다
- `match_pois` 추가는 아침에 사람이 검토하는 **별도 1스텝**으로 남는다

이것이 v3.0의 "de/fr/it 자동 적용" 판단을 대체한다.

---

## 4. 실행 순서 — 고객가치순(v2.2) → 위험순(v3)

v2.2 §7의 P0~P9는 **고객 가치 순서**였다(이메일이 P2로 앞에 옴). 무인 야간작업에는 **위험 순서**가 맞다.

| 순 | 단계 | 표면 | 근거 |
|---|---|---|---|
| **N1** | P0 인프라 | 신규 파일만 | 라이브 영향 0. 이후 전부가 이걸 공유 |
| **N2** | S2 POI 명칭 | **글로서리 파일까지만** — `match_pois` 쓰기는 아침 승인 | 글로서리 L1 선결. §3.1 — 파일만으로 선결 해제됨 |
| **N3** | S3 독일어 | `tour_product_pages` INSERT | **게이트 있음 → 고객영향 0.** 가장 안전한 대량 작업 |
| **N4** | S3 프랑스어 → 이탈리아어 → 러시아어 | 동일 | N3에서 검증된 규칙 재사용 |
| **N5** | S5 RAG · S6 WhatsApp · S4 POI설명 | 게이트 없음 | 검증 통과분만. 사람 확인 후 |
| **N6** | S1 LQA 감사 | 기존 2,734키 | 품질 이미 양호 — 표본 감사 |
| — | **S9 이메일 · S10/S11 외부화 · S13 SEO** | 코드 리팩터 | **야간 무인 제외.** 사람 시각확인 필수 |

**v2.2 §7 대비 변경점:** P2(이메일)·P3(외부화)를 야간 큐에서 빼고 맨 뒤로 보냈다. 고객 가치는 높지만 **작업 성격이 무인에 부적합**하다. 낮 세션에서 사람과 함께 한다.

---

## 5. 추출 화이트리스트 — 실측 키 기준 (v2.2 §1 정정)

v2.2의 등급표는 실제 스키마와 어긋나 있었다. 실측 키로 교체한다.
(v2.2가 B등급 최대 물량으로 잡았던 `page_sections`는 24슬러그에 **존재하지만 렌더되지 않는다** — §8.5 ① 참조.)

`detail_payload` 실측 top-level 30키:
```
seo hero slug price locale product_id glanceItems routePhases subnavItems
catalog_card galleryItems guestReviews whyTourWorks document_kind
headlineLine1 headlineLine2 itineraryStops pickup_dropoff reviewsSummary
routeFlowStops schema_version routeShapeIntro staticQuestions
matching_profile bookingTrustItems matching_metadata seasonalVariations
bookingSupportSteps practicalWeatherStatic practicalAccordionItems
```

| 등급 | 키 | 처리 |
|---|---|---|
| **A-1** 사람 100% 감수 | `hero` `headlineLine1` `headlineLine2` `glanceItems` `catalog_card` `seo` `pickup_dropoff` `practicalAccordionItems` `subnavItems` | 오픈 게이트 필수 |
| **A-2** 자동 + 20% 표본 | `whyTourWorks` `staticQuestions` `bookingTrustItems` `seasonalVariations` `bookingSupportSteps` `practicalWeatherStatic` `routeShapeIntro` | |
| **B** 자동 전량 + 표본 | `itineraryStops` `routePhases` `routeFlowStops` `galleryItems` | 최대 물량 |
| **🚫 금지** | `slug` `locale` `product_id` `document_kind` `schema_version` `matching_profile` `matching_metadata` `price` | **건드리면 실패로 간주.** 매칭엔진·라우팅 파괴 |
| **⚠ 보류** | `guestReviews` `reviewsSummary` | §7 Q8 — 실고객 리뷰 번역의 진실성 문제 |

**분량 실측:** 34슬러그 `detail_payload` = 58,542 ~ 150,669자 JSON (최대 `jeju-eastern-unesco-spots-day-tour`). 번역 대상 텍스트는 이보다 작다.

---

## 6. 불변 규칙 — 야간 무인작업 안전판 (v3 신규)

사용자 위임 조건은 **"기존 있는 내용들을 절대 건드리지만 않으면"**이다. 이를 기계적으로 강제한다.

1. **INSERT만, UPDATE 금지.** `tour_product_pages`는 신규 `locale` 행 INSERT. 기존 6로케일 행은 `WHERE locale IN (...)`에 절대 등장하지 않는다.
2. **jsonb는 병합만.** `names_other_locales = names_other_locales || '{"de":...}'` — 기존 키를 덮어쓰는 경로 없음. 적용 전 `? 'de'` 로 부재 확인.
3. **오픈 게이트 배열은 건드리지 않는다.** `TOUR_PRODUCT_URL_LOCALES` / `TOUR_PRODUCT_FALLBACK_URL_LOCALES` 수정 = 사람 결정.
4. **`messages/*.json` 기존 키 수정 금지.** S1은 감사만(N6), 재번역 아님.
5. **매 라운드 `git status`** — 지정 경로 외 변경 0 확인. 서브에이전트 범위이탈(H9) 방어.
6. **불확실하면 발행하지 않는다.** 3회 검증 실패·빈 결과·Critical → 미발행. 영어 폴백이 틀린 독일어보다 낫다.
7. **적용 전 롤백 SQL을 같은 파일에 적어둔다.** 추가만 했으므로 롤백은 `- 'de'` 키 삭제 / `DELETE WHERE locale='de'`로 완결된다.

---

## 7. 오픈 퀘스천 — v3 갱신

Q1~Q7은 §1에서 재분류(전부 번역을 막지 않음). 신규:

| # | 질문 | 권고 |
|---|---|---|
| **Q8** | `guestReviews`·`reviewsSummary` = 실제 고객 리뷰. 4언어 번역이 진실성 문제인가? | 기존 6로케일에 선례가 있으나 **일단 보류**하고 A/B군에서 제외. 사람 판단 |
| **Q9** | 오픈 시 `TOUR_PRODUCT_URL_LOCALES` 플립은 언어별 개별? | 개별. §8 게이트 통과 언어만 |
| **Q10** | ru 키릴 전사(Kontsevich) 감수자가 있는가? | 없으면 **ru POI 명칭은 스테이징만 하고 미적용 유지** — de/fr/it만 적용 |
| **Q11** | `pricingTiers.paxLabel`("1–6 pax")을 번역할 것인가? | **비권고.** 같은 객체의 `unit`·`durations`가 코드 값이라 가격 위젯 파손 위험이 이득보다 크다. 필요하면 `paxLabel`만 별도 경로로 |
| **Q12** | `match_pois` POI 명칭 DB 적용을 언제 할 것인가? | 글로서리 파일만으로 파이프라인이 돌므로 **급하지 않다.** ru는 Q10 통과 후, de/fr/it은 표본 확인 후 |

---

## 8. 노출(go-live) 게이트 — v2.2 §8 유지 + 게이트 위치 명시

한 로케일이 아래를 전부 통과하기 전에는 언어 스위처에 노출하지 않는다. **v3 추가: 플립 지점이 `TOUR_PRODUCT_URL_LOCALES`임을 명시.**

1. POI 명칭 100% (124/124), 글로서리 `names.en` 폴백 0건
2. Tier1 슬러그 전량 발행 + A-1 사람 감수 MQM 합격
3. 자동 검증 Critical 0 (G2·G3·G4·G5·G7)
4. 거래 이메일 4언어 동작 확인 (실발송) ← **S9 미완이면 여기서 막힌다**
5. 결제·마이페이지 영어 잔존 0 ← **S10/S11 미완이면 여기서 막힌다**
6. SEO hreflang/sitemap. ⚠ 미번역 로케일에 hreflang 발행 금지

**즉 야간작업으로 오픈까지 가지 않는다** — 4·5번이 사람 작업(S9~S11)에 걸려 있다. 야간작업의 목표는 **"오픈 직전까지 스테이징을 끝내두는 것"**이다. 이것이 v3의 정직한 스코프다.

---

## 8.5 구현 중 나온 실측 정정 (v3.2 — 2026-07-26 야간)

파이프라인을 실제로 돌리자 플랜이 몰랐던 것들이 나왔다. **전부 작업량을 줄이는 방향이었다.**

### ① `page_sections` = 죽은 데이터 — 24슬러그 × 39,000자

`components/product-tour-static/_shared/tourProductFullPageJsonTypes.ts:6` 이
"Fields unused by the template (e.g. `seo`, `page_sections`)"라고 명시하고, **저장소 전체 grep에서 `page_sections` 소비처가 그 주석 하나뿐**이다. DB 렌더 경로(`loadTourProductPage.ts`)는 읽지 않는다.

- v2.2는 이걸 **B등급 36,000자**로 잡아 번역 대상에 넣었다 → **전량 오판**
- 게다가 최상위 키의 복제라, 번역하면 **같은 문구의 사본 두 개가 갈라진다**
- → 신규 등급 `DEAD` 도입. `FORBIDDEN`(건드리면 깨짐)과 이유가 달라 구분한다

### ② TM 중복 45.1% (실측)

독일어 Tier1 10슬러그 = 세그먼트 5,566개 중 **고유 3,056개.** 슬러그마다 예약안내·신뢰항목·실용정보가 거의 같기 때문이다.
v2.2는 "실측 35% 절감"이라 했는데 실제로는 더 크다. → `lib/i18n/pipeline/tm.ts` 구현. TM은 **비용 장치이기 이전에 일관성 장치**다 — 같은 원문이 슬러그마다 다르게 번역되면 L3 도메인 용어가 문서 간에 갈린다.

### ③ 실제 번역 분량은 JSON 크기의 1/4

`detail_payload`는 슬러그당 58k~150k자지만 **번역 대상 리프는 34,208자**(jeju-grand-highlights-loop 실측). 나머지는 구조·식별자·좌표·URL이다. v2.2의 "슬러그당 ~10,000단어" 추정은 대체로 맞았다.

### ④ 렌더를 깨뜨릴 뻔한 리프 2종

- `page_sections[].component` = `"TourHeroSection"` — **React 컴포넌트명.** 번역되면 렌더가 죽는다
- `hero.imagePosition` = `"center 35%"` — CSS 값

둘 다 공백 없는 영단어라 초기 휴리스틱을 **통과**했다. → 키 이름 블랙리스트에 `component`·`position`·`align`·`layout`·`unit`·`durations`·`currency` 추가.
**교훈: 값만 보는 휴리스틱은 부족하다. 키 이름이 1차 신호다.**

### ⑤ `guestReviews`는 런타임에 덮어써진다

`loadTourProductPage.ts:271` `assembleTourProductReviews()`가 리뷰 시스템 값으로 교체한다 — payload 값은 폴백일 뿐이다. Q8(진실성)과 별개로 **번역 효용 자체가 낮다.**

### ⑥ `pricingTiers` → 신규 Q11

`{unit:"vehicle", tiers:[{paxLabel:"1–6 pax", prices:{"8h":359}}], durations:["8h"]}`.
번역 가치가 있는 건 `paxLabel` 하나인데 `unit`·`durations`가 코드 값이라 **가격 위젯이 깨질 위험이 이득보다 크다.** → FORBIDDEN 처리, Q11로 사람 판단에 넘김.

### ⑦ 원문(en) 데이터 결함 2건 — 번역가들이 잡아냄

| POI | 결함 | 발견 |
|---|---|---|
| `un_memorial_cemetery` | `name_en = "Un Memorial Cemetery"` — 부산 **UN**기념공원의 대소문자 깨짐 | de·fr·it **3개 에이전트가 독립적으로** 지적 |
| `hallasumokwon_arboretum` | `"Hallasumokwon Arboretum"` = 한라**수목원** + arboretum → **"수목원 수목원"** | ru 에이전트가 `ko`를 근거로 발견 → `Дендрарий Халла` |

**서로 다른 컨텍스트의 에이전트가 같은 결함에 수렴한 것은 신호다.** 마스킹·격리 구조가 의도대로 작동한다는 방증이기도 하다.

### ⑧ Tier1 선정 — 예약 데이터로는 불가능했다

`bookings` 전수 = **7건**(jeju-grand-highlights-loop 5 · busan-private-car-charter-cruise-shore 2). 매출 순위를 만들 표본이 아니다.
→ 대안 기준: **크루즈 기항지 투어 = 유럽 승객 유입 경로.** de/fr/it/ru 손님이 실제로 들어오는 문이다.
Tier1 10슬러그 = 실주문 2 + 크루즈기항 5 + 플래그십 데이투어 3.

### ⑨ 🔴 마스킹이 **표기 변형**을 놓친다 — 유닛 간 불일치

독일어 1차 팬아웃에서 같은 슬러그의 두 유닛이 **같은 장소를 다르게** 옮겼다.

| 유닛 | 원문 | 번역 |
|---|---|---|
| `B` | `Jeongbang Waterfall` | `Jeongbang-Wasserfall` |
| `A2-2` | `Jeongbang Waterfall` | `Jeongbang Waterfall` (원형 유지) |

원인: 글로서리 L1의 확정 표기는 **`Jeongbang Falls`**(= `match_pois.name_en`)인데 본문은 **`Jeongbang Waterfall`**로 쓰여 있다. `maskGlossaryTerms`는 등록된 표면형과 **문자열이 일치할 때만** 치환하므로 변형 표기는 마스킹되지 않고, 번역가가 각자 판단하게 된다.

**이건 컨텍스트 격리(§3-[2])의 대가다.** 격리가 오염을 막는 대신 유닛 간 합의를 없앤다. G1~G11은 유닛 **안**만 보므로 이 불일치를 잡지 못한다.

→ **완화 3단**
1. **글로서리에 표면형 변형을 등록한다** — `Falls`/`Waterfall`, `Mountain`/`Mt.`, `Cave`/`Lava Tube` 류. `GlossaryEntry.names`는 임의 키를 받으므로 `alt1`·`alt2`로 넣으면 `surfaceForms()`가 그대로 집는다(코드 변경 불요).
2. **TM이 2차 방어** — 같은 원문이면 같은 번역이 나간다. 단 이번처럼 원문이 같아도 유닛이 동시에 돌면 TM이 비어 있어 못 막는다. **슬러그 1개를 먼저 끝내 TM을 채운 뒤 나머지를 돌리는 순서가 유리하다.**
3. **교차 유닛 일관성 검사(G12) 신설 후보** — 한 슬러그 안에서 같은 원문이 다르게 번역됐는지 검사. 미구현.

### ⑩ ⚠ 워크트리 경합 (운영 주의)

`atockorea-main-merge`는 **다른 세션과 공유 중**이다. 이 세션 도중 커밋 4개가 외부에서 쌓였고, 그중 `edf700b6`이 broad `git add`로 진행 중이던 `i18n-work/` 파일을 함께 커밋했다.
→ **커밋 시 `git add -A` 금지. 경로를 명시하라.** (CLAUDE.md의 "메인 dir은 타 세션 경합" 경고와 같은 사안)

---

## 9. v2.2에서 그대로 유효한 것

아래는 변경 없이 v2.2 본문을 따른다.
- §2 번역 방향 (피벗=영어, 3원 소스 `source_en`+`context_ko`+`glossary`, 중역 금지)
- §3-[1] 마스킹 / [2] 서브에이전트 프롬프트 뼈대 8규칙 / [3] G1~G11 정의 / [4] 적대적 역번역 / [5] MQM 감수 / [6] 발행·추적
- §4 작업 디렉터리 계약 + 세션 시작 절차 6단
- §5 3층 장치 (용어집 3계층 · 스타일가이드 4×1p · CI 회귀방지)
- §6 할루시네이션 H1~H9 방어표 + 관통 3원칙
- §11 명시적 비범위 (RTL·이미지내 텍스트·통화현지화·법적문구 법률검토·운영자 화면)

## 10. 공수 — v3 조정

| 단계 | v2.2 | **v3** | 조정 근거 |
|---|---|---|---|
| P0 인프라 | 3~4일(사람) | **1세션** | 신규 파일만, 사람 결정 0 |
| S2 POI 명칭 | 1세션 | **스크립트 1회 + ru 124건** | §3 로마자 승계 발견 |
| S3 Tier1 ×4언어 | 8~12세션 | 유지 | |
| S3 잔여 24슬러그 ×4 | 20~30세션 | 유지 | TM 중복제거 35% 효과는 여기서 |
| S9~S11 | 5~7세션 | **낮 세션 전용** | 시각확인 필수 |

**"하룻밤에 독일어 완성"은 불가능하다** — S3 독일어만 34슬러그 × 4청크 = 136 unit이다. 야간작업의 산출물은 **매니페스트에 기록된 진척**이고, 끊긴 지점에서 다음 세션이 이어받는다(§4 세션 절차). 이것이 이 플랜의 설계 목적이다.
