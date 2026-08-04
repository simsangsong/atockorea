# de/fr/it/ru 오픈 — 착수 전 채워야 할 것 (2026-08-04 사장님 결정)

> **사장님 결정 (2026-08-04): "번역 먼저, 오픈은 나중."**
> 그리고 **챗봇 대화 문구도 4개 언어로 번역한다**(영어 폴백 아님).
>
> 🔴 **그때까지 `TOUR_PRODUCT_FALLBACK_URL_LOCALES` 는 건드리지 말 것.**
> (`app/(marketing)/tour-product/[slug]/tourProductPageBody.tsx:53`)

---

## 왜 지금 안 열었나 — "번역 완비"가 사실이 아니었다

인수인계 문서는 "번역 완비, 게이트만 열면 됨"이라고 적혀 있었다. **실측은 달랐다.**
손님에게 실제로 보이는 상품(= `tours.is_active` **AND** 레포 블록리스트 통과) **15개** 기준:

| 상태 | 개수 | 상품 |
|---|---|---|
| **READY** (de/fr/it/ru 4개 다 있음) | **7** | busan-private-car-charter-cruise-shore · busan-small-group-yonggungsa-skycapsule-gamcheon-tour · busan-top-attractions-day-tour · incheon-seoul-private-car-shore-excursion-cruise · jeju-grand-highlights-loop · pocheon-sanjeong-lake-herb-island-art-valley · seoul-gapyeong-nami-morning-calm-petite-france-day-tour |
| **PARTIAL** (ru 만 없음) | **2** | jeju-cruise-shore-excursion-small-group-tour · jeju-eastern-unesco-spots-day-tour |
| **NONE** (4개 다 없음) | **6** | busan-small-group-sightseeing-tour-cruise-passengers · jeju-island-private-car-charter-tour · jeju-southern-top-unesco-spots-tour · seoul-private-nami-morning-calm-petite-france · seoul-suburbs-private-chartered-car-10hr · southwest-hallasan-osulloc-aewol |

**+ 경주**(`from-busan-gyeongju-ancient-capital-day-tour`)가 2026-08-04 재오픈으로 판매 목록에 합류했고,
이 상품도 **de/fr/it/ru 0개**다 → **NONE 은 실질 7개**.

재현 명령(숫자를 믿지 말고 다시 재라):

```bash
node --env-file=.env.local -e "const{createClient}=require('@supabase/supabase-js');(async()=>{const sb=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);const{data:p}=await sb.from('tour_product_pages').select('slug,locale').eq('is_published',true);const{data:t}=await sb.from('tours').select('slug').eq('is_active',true);const has=(s,l)=>p.some(x=>x.slug===s&&x.locale===l);for(const{slug}of t){if(!has(slug,'en'))continue;const n=['de','fr','it','ru'].filter(l=>has(slug,l));if(n.length<4)console.log(n.length,slug)}})()"
```

⚠ 위 명령은 **레포 블록리스트를 반영하지 않는다**(앱 레이어 필터라 DB 에 없다).
정확한 "손님에게 보이는" 집합은 `isTourSlugBlockedFromConsumerSurfaces` 를 통과시켜야 한다.

---

## 왜 "그냥 열고 영어 폴백"이 선택지였는가 (그리고 왜 안 골랐나)

`tourProductPageBody.tsx` 의 해석 순서는 **Supabase(로케일) → 정적 JSON(로케일) → Supabase(EN) → notFound()**.
즉 de 행이 없어도 **영어 본문으로 우아하게 떨어진다. 빈 페이지가 아니다.**

🔴 **그 파일의 주석은 이걸 반대로 적고 있다** — "adding them … would render an empty page".
그 주석은 **EN 폴백(3단계)이 추가되기 전에 쓰인 것**이라 지금은 틀렸다.
**주석 말고 코드를 읽어라.** (같은 교훈이 이 레포에 반복 기록돼 있다.)

그래도 안 연 이유는 깨져서가 아니라, **독일어 URL 에 영어 본문이 실리는 것**이 8개 상품에서
손님 경험·hreflang/SEO 상 좋지 않기 때문이고, 사장님이 그걸 택하지 않았다.

---

## 여는 날 할 일 (순서 고정)

1. **번역 채우기** — NONE 7개 + PARTIAL 2개(ru). 상품당 `tour_product_pages` 행 + 번들.
   기존 파이프라인: `lib/i18n/pipeline/` · `docs/i18n-expansion-plan-v2-2026-07-25.md`.
   🔴 `apply.ts` 는 **INSERT 전용**(기존 로케일 행 UPDATE 금지).
2. **타입 6→10** — `lib/tour-product/tourProductPageLocale.ts` 의 `TourProductPageLocale`
   와 `TOUR_PRODUCT_PAGE_LOCALES`.
3. 🔴 **챗봇 문구 23곳** — 타입을 넓히는 순간 `Record<TourProductPageLocale, …>` 맵이
   4개 언어씩 비어 **tsc 가 막는다**(이건 기능이지 버그가 아니다). **약 92개 문자열.**
   대부분 `lib/chatbot/quoteFlow.ts`(15곳), 나머지 `answerSources`·`bookingChange`·
   `chatTelemetry`·`followUpChips`·`instantAnswers`·`api/tour-product/assistant/route.ts`.
   ✅ **사장님 결정: 영어 폴백이 아니라 실제 4개 언어 번역.**
   `components/.../tourProductBundleRegistry.ts` 는 `Partial<Record<…>>` 라 안 막힌다.
4. **라우팅 배열 둘** — `TOUR_PRODUCT_URL_LOCALES` 에 추가 +
   `TOUR_PRODUCT_FALLBACK_URL_LOCALES` 에서 제거 (같은 파일).
5. **게이트 테스트 개정** — `__tests__/app/tourProductLocaleRouting.test.ts` 는 지금
   **`TOUR_PRODUCT_URL_LOCALES` 가 'fr' 을 포함하지 않을 것**을 단언한다(= 현재 상태의 자물쇠).
   여는 커밋에서 이 단언을 "모든 사이트 로케일이 렌더 가능하다"로 바꿔야 한다.
   **단언을 지우지 말고 뒤집어라** — 지우면 게이트가 조용해진다.
6. **4로케일 실렌더 QA** — 소스 리뷰로 판정하지 말 것.

---

## 사장님 결정이 아직 안 난 것 (이 트랙 아님)

- **경주 가격**: 재오픈은 했지만 **USD 39 그대로**다. 그 가격은 10.5시간짜리였고
  재코스로 **11.5시간(하차 ≈19:50)** 이 됐다. 재가격은 지시에 없어 **손대지 않았다.**
