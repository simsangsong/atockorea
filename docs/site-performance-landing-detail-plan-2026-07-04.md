# 랜딩 + 투어 상세 로딩 성능 — Phase 2 실행 플랜

작성일: 2026-07-04
선행 문서: `docs/atockorea-site-performance-master-plan-2026-06-25.md` (1차 통합 플랜 — P0 대부분 출하 완료)
이 문서의 위치: 1차 플랜의 P0 트랙이 머지된 **현재 코드 기준으로** 랜딩(`/`)과 상세(`/tour-product/[slug]`) 두 경로를 재감사한 결과 + 남은 병목의 우선순위 실행 플랜. 기능(어드민 즉시 반영, 애니메이션 정체성, 예약 카드 동작)은 전부 보존한다.

---

## 0. 이미 끝난 것 (재작업 금지)

1차 플랜 P0는 사실상 전부 머지됨 — 코드 대조 확인(2026-07-04):

| 항목 | PR | 상태 |
|------|----|------|
| B1 middleware 비로그인 auth 스킵 | #197 | ✅ `middleware.ts` — `sb-*-auth-token` 쿠키 없으면 Supabase 호출 0 |
| D1/D2 Currency·I18n provider 마운트 블로킹 해소 | #195 | ✅ Suspense 래핑, 비블로킹 |
| C1/C2 Maps lazy + Supabase preconnect | #199 | ✅ 픽업맵 in-view 게이트, preconnect 4종 |
| B2/B3 admin/stats·tour-product 순차 await 병렬화 | #201 | ✅ checkout+외부리뷰 병렬 |
| K1 카드 미디어 재요청 스킵 | #202 | ✅ |
| C4 상세 히어로 preload | #204 | ✅ `ReactDOM.preload` + `fetchPriority:"high"` |
| A1 로케일 홈 서버 컴포넌트화 | #210 | ✅ |
| B5/K3 빌더 POI 캐시, D4 그리드 memo | #212/#214 | ✅ |
| 홈 ISR 정적 셸 (root layout 쿠키 제거) | #221 | ✅ `/`는 `revalidate=600` ISR |
| F3 FK 인덱스 24개 | #211 | ✅ 라이브 적용 |

**랜딩은 이미 구조적으로 건강하다**: ISR 600초 + preconnect + 폰트 swap + 매처 lazy + 히어로 2번째 슬라이드 이후 800ms 지연 마운트. 남은 건 미세 다이어트.
**진짜 남은 큰 덩어리는 상세페이지다.**

---

## 1. 현재 병목 진단 (2026-07-04 코드 재감사)

### 상세 `/tour-product/[slug]` — 주범

- **D-1 [CRITICAL] `force-dynamic + revalidate=0`** — `app/tour-product/[slug]/page.tsx:54-55`. 매 요청 풀 SSR → TTFB가 서버리스 웜/콜드에 좌우(체감 0.5~2s). 코멘트 근거는 "어드민 저장 즉시 반영"인데, 이건 **on-demand revalidateTag로 동일하게 충족 가능**(ISR과 즉시반영은 양자택일이 아님).
- **D-2 [HIGH] 번들 레지스트리 204개 JSON 정적 import** — `components/product-tour-static/_shared/tourProductBundleRegistry.ts` (34투어 × 6로케일, 개당 150~180KB, 합계 ~5.5MB raw). 서버 전용이라 브라우저엔 안 가지만, **서버리스 함수 번들·메모리·콜드스타트**를 키운다. D-1과 결합 시(캐시 0 → 콜드 빈도↑) 최악의 조합. 같은 레지스트리를 assistant route·RAG도 import.
- **D-3 [HIGH] viewModel RSC 페이로드** — 160KB급 full-page JSON에서 만든 viewModel + 추천 + checkoutContext가 client 컴포넌트 prop으로 직렬화되어 **HTML 안에 그대로 실림**. 라이트박스용 풀사이즈 이미지 URL 40여 개, 아래 접힌 섹션 데이터까지 전부 첫 바이트에 포함.
- **D-4 [MED] 히어로가 CSS background-image** — `TourHeroSection.tsx:127-143`. preload 힌트는 있지만(#204) `<img>` 대비 브라우저 스캐너 발견이 늦고 srcset/포맷 협상 없음. LCP 직결.
- **D-5 [MED] 전 섹션 eager 마운트** — `TourProductDetailClient.tsx`가 히어로~FAQ~추천~AI위젯까지 한 번에 hydration. 아래 접힌 섹션(리뷰·FAQ·추천·AI위젯)이 TTI를 끌어내림. (DatePicker·Maps는 이미 lazy — 잘 돼 있음.)
- **D-6 [LOW] 갤러리/타임라인 `<img>`에 `sizes`/srcset 없음** — 풀해상도 단일 URL. lazy는 걸려 있음.
- **D-7 [LOW] 요청마다 추천 스코어링** — `pickTourRecommendations`가 34개 투어 전수 스코어링. D-1이 ISR로 바뀌면 자동으로 무의미해짐(재생성 시 1회).

### 랜딩 `/` — 미세 다이어트만 남음

- **L-1 [MED] `choose-travel-style.tsx` 31KB eager client** — framer-motion + AnimatePresence 상태 머신이 첫 번들에 상시 포함. below-fold인데 lazy 아님.
- **L-2 [MED] featured rail 클라이언트 마운트 fetch** — `featured-products-showcase.tsx:192`가 `/api/tours`를 useEffect에서 호출. 미디어는 서버 시드(#202)됐지만 투어 데이터는 여전히 클라 fetch → 카드 콘텐츠 지연 + CLS 위험. 페이지가 이미 ISR이므로 **서버에서 같이 시드**하면 fetch 자체가 사라짐.
- **L-3 [MED] 히어로 5장 합계 ~1.3MB** — 1번 슬라이드(201KB)만 priority, 나머지 800ms 지연은 좋으나 절대량이 큼. 2~5번은 화질 75로 강등 + 저해상도 생성 여지.
- **L-4 [LOW] CSS 합계 ~133KB** (globals 52KB는 사이트 공통) — 홈 전용은 이미 작음. 감사만.
- **L-5 [GUARD] 신규 콜라주 PNG 2.8MB** — `public/images/tours/jeju-main-thumbnail-collage(.title).png`가 워킹트리에 추가됨(미참조). **절대 PNG 직접 참조 금지** — next/image를 태우거나 WebP(540KB)만 사용, 이상적으로는 quality 75 재인코딩(~300KB 예상).

---

## 2. 실행 플랜 (우선순위 = 임팩트 × 리스크)

### Wave 0 — 측정 게이트 (반나절, 코드 0)
- [x] **G0** 프로덕션 실측 완료 (2026-07-04, 한국에서 curl 3회 반복 + Lighthouse 모바일):

| 경로 | CDN | TTFB | 문서 완료 | HTML (raw/gz) |
|------|-----|------|-----------|----------------|
| `/` | **HIT** (ISR) | **0.10s** | 0.10s | 60.7KB / 6.3KB |
| `/tour-product/jeju-grand-highlights-loop` | **MISS 매회** (no-store) | 0.37~0.44s | **2.1~3.2s** | **351.8KB / 56.8KB** |
| `/tour-product/busan-top-attractions-day-tour` | **MISS 매회** (no-store) | 0.34~0.51s | **1.8~2.2s** | **387.9KB / 64.9KB** |

  - 핵심: 상세는 TTFB보다 **스트리밍 SSR 완료까지의 시간**(1.5~2.7s)이 지배적 — 서버가 렌더하며 흘려보내는 동안 문서가 안 끝남. ISR 캐시 히트면 이 구간이 통째로 사라져 홈 수준(~0.1s)이 된다. D-1 진단 실측 확정.
  - HTML 352~388KB는 D-3(viewModel RSC 직렬화) 실측 확정 — 홈(60KB)의 6배.
  - 참고: `east-signature-nature-core`는 프로덕션에서 404 폴백(consumer-blocked) — 커스텀 페이지 ISR 대상에서 상태 재확인 필요.
  - 이 수치가 T1~T6의 전/후 비교 기준. 미국 방문자는 여기에 태평양 RTT·콜드스타트가 가산되므로 실이득은 더 큼(Speed Insights 6/26 실측 US TTFB p75 ~12s 전례).

  **Lighthouse 모바일(4G 시뮬레이션) — 🔥 최대 병목은 폰트로 판명:**

| 경로 | 점수 | FCP | LCP | TBT | CLS |
|------|------|-----|-----|-----|-----|
| `/` | 55 | 17.1s | **21.3s** | 0ms | 0.002 |
| 상세(jeju-grand-highlights-loop) | 55 | 21.0s | **61.7s** | 30ms | 0.02 |

  바이트 상위 항목이 페이지 콘텐츠가 아니라 **폰트**:
  - **FO-1 [CRITICAL·전 페이지]** Pretendard가 `pretendard.min.css`(정적 빌드) → **웨이트당 풀 woff2 ~750~776KB × 5 = 약 3.8MB**. layout.tsx:73 주석("unicode-range로 필요한 글리프만")은 dynamic-subset 빌드에만 해당 — 정적 빌드는 Latin 텍스트만으로도 풀 파일을 받는다. → `pretendardvariable-dynamic-subset.min.css`(CSS 13KB gz + 유니코드 범위별 소형 청크; EN 페이지는 몇 KB만)로 교체 + font-family 스택에 "Pretendard Variable" 추가.
  - **FO-2 [CRITICAL·전 페이지]** Google Fonts css2(JP/SC/TC×4웨이트 + Serif KR×6웨이트)가 **렌더 블로킹 CSS gzip 517KB**. → 렌더 비블로킹 전환(첫 페인트 후 클라이언트 주입). CJK 시스템 폴백(PingFang/Meiryo/Malgun)이 globals.css 폰트 스택에 이미 있어 swap 전에도 tofu 없음. 웨이트는 무변경(시각 다운그레이드 금지).
  - **IM-1 [HIGH·상세]** 상세페이지 이미지가 next/image 우회 원본 서빙 — 히어로/스톱 이미지 450~673KB webp 다수(T3/T6과 동일 항목, 실측 확정). 홈 이미지는 이미 `_next/image` 최적화(75~79KB)로 건강.
  - JS는 문제 아님(TBT 0~30ms, unused JS ~143KB 수준). D-3 HTML 388KB는 4G에서 ~2s 상당.

### Wave 1a — 폰트 응급수술 (G0 실측으로 최우선 승격, 전 페이지 공통)
- [x] **F1: Pretendard → variable dynamic-subset** (FO-1) — ✅ PR #245 (2026-07-04). variable dynamic-subset CSS(13KB gz) + 폰트 스택에 `"Pretendard Variable"` 선행. 3.8MB → EN 페이지 기준 수 KB.
- [x] **F2: Noto CJK CSS 렌더 비블로킹화** (FO-2) — ✅ PR #245. `DeferredCjkFontsCss`가 idle 후 동일 스타일시트 주입. 웨이트·패밀리 무변경, swap 전 시스템 CJK 폴백.

### Wave 1 — 상세페이지 TTFB 제거 (최대 레버리지)
- [x] **T1: force-dynamic → ISR + on-demand revalidate** — ✅ 구현 완료 (2026-07-04). 실제 구현이 플랜과 다른 지점: 로케일이 searchParams가 아니라 **NEXT_LOCALE 쿠키**로 콘텐츠를 갈랐음(캐시 불가 원인) → 홈 패턴 그대로 **EN=베어 경로 ISR + `app/[locale]/tour-product/[slug]` 실제 라우트 신설**(on-demand ISR) + 미들웨어 쿠키 307/패스스루로 해결. 시드(?date/guests)는 클라이언트 파싱+key 리마운트. FX fetch `no-store`→`revalidate:3600`(동적 강등 원인 제거). 어드민 저장 시 6개 로케일 전부 revalidatePath. 로컬 검증: x-nextjs-cache HIT·쿠키 307·/ko 200 한국어·/en 307 정규화.
  - `app/tour-product/[slug]/page.tsx`: `dynamic`/`revalidate=0` 제거 → `revalidate = 3600` + `generateStaticParams`(레지스트리 슬러그 전수, 34개면 빌드 부담 없음).
  - 커스텀 페이지(`east-signature-nature-core`, `jeju-grand-highlights-loop`)도 동일 적용.
  - **어드민 즉시 반영 보존**: `tour_product_pages`를 쓰는 모든 어드민 저장 경로(admin products v2 editor API, import 스크립트)에 `revalidatePath('/tour-product/'+slug)` 추가. 블록리스트/비활성화 변경 경로도 포함. ⚠ **`revalidateTag` 말고 `revalidatePath` 사용** — Next 16에서 revalidateTag가 2-인자('use cache' 프로파일) 시그니처로 바뀌어 legacy 태그 무효화 의미론이 불명확(2026-06-26 빌더 POI 캐시에서 같은 이유로 보류한 전례). ISR 페이지 무효화는 revalidatePath가 확실.
  - 검색파라미터 시딩(`?date=&guests=`)은 클라이언트에서만 소비되므로 ISR과 충돌 없음 — 단, 페이지가 searchParams를 서버에서 읽는 부분(파티 파싱)은 클라로 내리거나 `<Suspense>` 분리 필요. **구현 시 최우선 확인 지점.**
  - 기대: TTFB 0.5~2s → CDN 히트 ~100ms. 상세페이지 단일 수정 중 최대 효과.
- [x] **T2: 레지스트리 다이어트** (D-2) — ✅ PR #248. 204개 정적 import → slug×locale lazy `import()`; `getStaticTourProductFullPageJson` async화(assistant route·RAG `collectTourRecords→reindexKnowledge` 체인 전파); 등록 체크는 슬러그 리스트로 sync 유지. page.js 서버 청크 18KB, JSON은 274개 지연 청크로 분리. 추천은 이미 슬림 카탈로그 사용 확인.

### Wave 2 — 상세 LCP·hydration — ✅ PR #249 (2026-07-04)
- [x] **🔥 신규 발견·수리 (플랜에 없던 최대 항목): 사이트 전역 CSR bailout** — Suspense 경계 없는 `useSearchParams()` 3곳(AnalyticsPageViewTracker=루트 레이아웃·LanguageSwitcher=Header·FloatingLanguageToggle)이 **모든 정적 페이지를 통째로 `BAILOUT_TO_CLIENT_SIDE_RENDERING`** 시키고 있었음. 프로덕션 "정적" HTML이 빈 셸(홈 6KB)이었고 콘텐츠는 JS 전체 로드 후 페인트 — 홈 LCP 21s의 숨은 정체. force-dynamic 시절엔 무증상이라 발견 불가, T1 ISR 전환이 드러냄. 트래커=미사용 훅 삭제, 스위처=클릭 시 window.location.search. 홈 HTML 60KB 셸 → 199KB 콘텐츠 SSR.
- [x] **T3: 히어로 next/image 전환** — fill+priority(1번), 보조 슬라이드 2.5s 지연 마운트, 원본 raw-URL preload 제거(최적화 URL preload로 대체). Ken Burns·그레인·비네트 래퍼 유지 — 실브라우저 픽셀 확인.
- [x] **T4(경량): AI어시스턴트 위젯 `dynamic(ssr:false)`** — 리뷰·FAQ 등의 추가 lazy는 TBT 0~30ms 실측으로 불필요 판정(가치 없는 복잡도).
- [ ] **T5: RSC 페이로드 다이어트** — 보류. 재측정 후 문서 크기가 여전히 지배적일 때만.
- [x] **T6: 갤러리·타임라인 next/image** — 벤토 타일(fill+sizes)·라이트박스 스트립(40×28)·타임라인 썸네일(80×56)·데이플로우 원형(48px). 원본 450~670KB → 수 KB 변형.
- [x] **(부수) 잠복 SSR 크래시 2건** — `inferReturnBand`가 `notes: string[]`만 가정, 크루즈 투어 행은 string → SSR 크래시(기존엔 bailout이 은폐). 두 사본 모두 방어 처리.

### Wave 3 — 랜딩 마무리 — 재측정 결과로 **의도적 종결(스킵)**
- [~] **H1 스킵**: choose-travel-style은 W1e-1 "primary action" 섹션(폴드 직하) + TBT 실측 0ms — lazy 분리는 리스크(상호작용 지연)>이득(JS는 병목 아님).
- [~] **H2 스킵**: 미디어는 이미 서버 시드로 즉시 렌더, 마운트 fetch는 비블로킹 정제(+/api/tours 엣지캐시 30s). LCP 무관.
- [~] **H3 불필요**: 홈 히어로는 이미 next/image — 실전송은 75~79KB 최적화 변형(raw 파일 크기 무관).
- [!] **H4 가드 유지**: `jeju-main-thumbnail-collage.png` 2.8MB — 랜딩 투입 시 반드시 WebP+next/image. PNG 원본 리포 제거 검토.

### 보류 (이 트랙에서 제외)
- F1 RLS initplan / F2 정책 통합 — 비로그인 랜딩·상세에는 영향 미미(anon 쿼리는 ISR 뒤로 숨음). 1차 플랜 보류 상태 유지.
- 챗봇 응답속도 — 별도 트랙(`docs/chatbot-excellence-master-plan-2026-07-04.md`).
- 정적/DB 이중 소스(K6) — 정확성 트랙.

---

## 3. 완료 기준 (G0 베이스라인 대비)

- `/tour-product/[slug]` TTFB p75 ≤ 200ms (CDN 히트 기준), LCP p75 ≤ 2.5s (모바일 4G).
- 어드민에서 투어 저장 → 라이브 상세 반영 ≤ 5s (revalidate 훅 동작 증명, 회귀 테스트 포함).
- `/` LCP p75 ≤ 2.0s, 첫 로드 클라이언트 JS 변화량 −30KB 이상(H1), featured rail 클라 fetch 0(H2).
- 상세 HTML 문서 크기(뷰모델 직렬화 포함) 측정 후 −30% 목표(T5).
- 비주얼 회귀 0: 히어로 Ken Burns·패럴럭스·갤러리 라이트박스·부킹카드 동작 동일.

## 4. 리스크 / 가드

- **T1이 유일한 중위험**: revalidate 훅 누락 시 어드민 저장이 최대 1시간 지연 노출. → `tour_product_pages` write 경로 전수 grep 후 훅 부착 + 수동 revalidate API(escape hatch) 하나 추가. searchParams 서버 소비 여부 구현 전 확인.
- T3 히어로 전환은 픽셀 회귀 위험 → 전/후 스크린샷 비교를 완료 조건에 포함.
- H2 서버 시드는 `/api/tours` 응답 스키마와 시드 데이터 불일치 시 카드 깨짐 → 동일 함수 재사용(핸들러 로직을 lib로 추출해 공유).
- 모든 수정은 additive — 투어 카피/JSON 데이터 원본 무변경 원칙 유지.
