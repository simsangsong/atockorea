# 다국어 확장 플랜 — 러시아어·프랑스어·독일어·이탈리아어

> **버전: v3.0 (2026-07-25 야간)** — 파일명은 고정, 버전은 이 줄로 관리.
> v1 = 커밋 `afd60e73` `docs/ui-overhaul-and-i18n-expansion-plan-2026-07-25.md` §B (뼈대)
> v2.0 = 실측 재검증 + 파이프라인·할루시네이션 방어 정의
> v2.2 = 범위를 전 고객노출면으로 확장 + 실행모델을 API배치 → Claude Code 세션으로 교체
> **v3.0 = ① 「구현 금지」해제 — 사용자 실행 승인(2026-07-25) ② 코드 레벨 노출 게이트 실측 발견 → "DB 추가는 고객영향 0"이 증명됨 ③ 실행순서를 고객가치순 → 위험순으로 재배치 ④ Q1~Q7을 "번역을 막는 것"과 "오픈만 막는 것"으로 분리 ⑤ S2가 번역이 아니라 로마자 표기 승계임을 발견(de/fr/it은 LLM 불필요)**
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

## 3. S2는 번역이 아니라 로마자 표기 승계다 (v3 신규 발견)

`names_other_locales` 실측 샘플 (`hallasan_eoseungsaengak`):
```json
{"es":"Hallasan Eoseungsaengak","ja":"漢拏山 オスンセンアク","zh":"汉拿山御乘生岳","zh-TW":"漢拿山御乘生岳"}
```

**스페인어가 순수 로마자다** — 번역된 수식어(`Monte`, `Pico`)가 붙지 않는다. 즉 현행 규범은 **"라틴문자 로케일은 개정로마자 표기를 그대로 쓴다"**이고, de/fr/it도 같은 규범을 따르면 된다.

| 언어 | 처리 | LLM |
|---|---|---|
| **de / fr / it** | `name_en`의 로마자를 **그대로 승계** (es 선례와 동일) | **불필요 — 결정론적 스크립트** |
| **ru** | 키릴 전사. **Kontsevich 체계**(система Концевича) — 감천→Камчхон, 제주→Чеджу | 필요 (유일한 판단 작업) |

**절감: 124×4=496건 중 372건(de/fr/it)이 LLM 없이 끝난다.** v2.2는 이것을 "1세션"으로 잡았는데, 실제로는 스크립트 1회 + 러시아어 124건만 남는다.

⚠ **ru 전사가 이 프로젝트에서 유일하게 "즉시 고객 반영 + 되돌리기 어려운" 판단이다.** 키릴 전사가 틀리면 러시아 손님에게 존재하지 않는 지명이 노출된다. → **ru만 파일 스테이징 후 사람 승인**, de/fr/it은 자동 적용.

---

## 4. 실행 순서 — 고객가치순(v2.2) → 위험순(v3)

v2.2 §7의 P0~P9는 **고객 가치 순서**였다(이메일이 P2로 앞에 옴). 무인 야간작업에는 **위험 순서**가 맞다.

| 순 | 단계 | 표면 | 근거 |
|---|---|---|---|
| **N1** | P0 인프라 | 신규 파일만 | 라이브 영향 0. 이후 전부가 이걸 공유 |
| **N2** | S2 POI 명칭 | de/fr/it 자동 + **ru 승인 대기** | 글로서리 L1 선결. §3 절감 적용 |
| **N3** | S3 독일어 | `tour_product_pages` INSERT | **게이트 있음 → 고객영향 0.** 가장 안전한 대량 작업 |
| **N4** | S3 프랑스어 → 이탈리아어 → 러시아어 | 동일 | N3에서 검증된 규칙 재사용 |
| **N5** | S5 RAG · S6 WhatsApp · S4 POI설명 | 게이트 없음 | 검증 통과분만. 사람 확인 후 |
| **N6** | S1 LQA 감사 | 기존 2,734키 | 품질 이미 양호 — 표본 감사 |
| — | **S9 이메일 · S10/S11 외부화 · S13 SEO** | 코드 리팩터 | **야간 무인 제외.** 사람 시각확인 필수 |

**v2.2 §7 대비 변경점:** P2(이메일)·P3(외부화)를 야간 큐에서 빼고 맨 뒤로 보냈다. 고객 가치는 높지만 **작업 성격이 무인에 부적합**하다. 낮 세션에서 사람과 함께 한다.

---

## 5. 추출 화이트리스트 — 실측 키 기준 (v2.2 §1 정정)

v2.2의 등급표는 `page_sections` 같은 **존재하지 않는 키**를 참조하고 있었다. 실측 34키로 교체한다.

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
