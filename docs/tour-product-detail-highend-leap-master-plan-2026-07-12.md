# 투어 상세 페이지 하이엔드 도약 마스터 플랜 v2.2 — 컴팩트 · 프리미엄 · 전환 최우선 · 성능 비회귀

작성: 2026-07-12 (v1) → 2026-07-13 v2(디렉티브 4개조+멀티에이전트 재설계) → **2026-07-13 v2.2 최종판** (5렌즈 가드 리뷰 35건 반영 + 성능 비회귀 프로토콜 §P + 리포 작업 규칙 §L 신설)
대상: `app/tour-product/[slug]/page.tsx` + `app/[locale]/tour-product/[slug]` + `components/product-tour-static/**`
선행 문서: `docs/tour-product-detail-ui-ux-audit-response-2026-05-17.md` — §B 바인딩 승계하되 **§B의 "선행 §B 대체 명세"가 우선**. 스킬(tour-product-detail-uiux)이 선행 문서를 SoT로 발동해도 **실행 SoT는 본 문서 §R**이다.

---

## §0 사용자 디렉티브 5개조 (이 플랜의 헌법 — 모든 티켓 self-check)

1. **깔끔 · 컴팩트 · 고급** — 페이지는 무조건 이 세 가지로 보여야 한다.
2. **정보전달 + 고객전환 최우선.**
3. **정보과밀 · 나열 과다 · 첫눈에 피로한 레이아웃 금지.**
4. **흑백/단색화로 격 하락 금지, 동시에 과채색으로 유치해지는 것도 금지** — 색채가 여러 개 섞여 있는 것은 환영. 적은 색의 개수가 아니라 부조화(원색 난립·효과 스택·틴트 제각각)와 캔디화(대면적 고채도) 양쪽이다. self-check는 두 질문: "색을 뺐는가?" / "원색·캔디로 기울었는가?"
5. **모든 변경의 전제 = 현재 로딩속도 비회귀.** 매 티켓 build→프리뷰→측정→회귀 시 즉시 수정(24h 내 해소 불가 시 리버트가 디폴트). 집행 절차는 §P.

---

## §A 상태 대시보드

| Wave | 이름 | 상태 | 시작일 | 완료일 | 마지막 커밋 |
|---|---|---|---|---|---|
| W0 | 성능 베이스라인 + 환경 셋업 | ✅ | 2026-07-14 | 2026-07-14 | (W1.1 PR) |
| W1 | 컨버전 코어 | 🔄 W1.1 완료 (W1.2만 🔶G-2) | 2026-07-14 | — | — |
| W2 | IA 컴프레션 (17→상시12) | ⏳ | — | — | — |
| W3 | 컬러 하모나이징 & 타이포 | ⏳ | — | — | — |
| W4 | 소셜프루프 & 신뢰 | ⏳ 🔶G-1/G-3 | — | — | — |
| W5 | 에디토리얼 시그니처 | ⏳ | — | — | — |
| W6 | 측정 & 가드 CI화 (병행) | ⏳ | — | — | — |

**다음 착수 지점**: 세션 시작 → §G G-1~G-4를 사용자에게 일괄 질의(비차단 — 응답 대기하며 진행) → **W0.1 베이스라인 → W1.1부터 즉시 착수**. 게이트 의존은 티켓 단위로만: W1.2←G-2, W4.1/W4.2←G-1, W4.3←G-3. 나머지 전 티켓은 게이트 무관.

## §B 결정 로그 (binding)

| 날짜 | 결정 | 이유 |
|---|---|---|
| 2026-07-12 | 가짜 urgency 금지 · 리뷰 날조 금지 · 콘텐츠 데이터 비파괴(표시 계층만) · conversion-first 순서 · scroll-freeze 가드(신규 스크롤 연동 모션·마퀴·라이브러리·backdrop-blur 스택 0) | v1 유지 |
| 2026-07-13 | §0 디렉티브 5개조 최상위 바인딩 | 사용자 직접 지시 |
| 2026-07-13 | **3-tier 정보 계층 + 노출 하한**(§F-3): 확신 정보는 클릭 0회 사수, 참조 정보만 접기 | 디렉티브 2×3 동시 충족 |
| 2026-07-13 | **색 시스템 = Rich but Harmonized**(§F-6): hue 수 감축 금지(6색 glance·4계절 4색·다색 스텝 보존 — 보존 대상은 "색 개수+항목별 고정 배정"이지 현행 raw hue 값이 아님), 조화 규율 4개+수치 밴드로 집행 | 사용자 2차 지시. 단일 액센트 문법도 단색화로 간주해 기각 |
| 2026-07-13 | **선행 §B 대체 명세**: ① §2.1(색 17→5)→§F-6으로 대체 ② §2.5(At-A-Glance 6색 폐기→text pill) **폐기** — 6색 유지+팔레트 재조율(§I #3) ③ §1.4의 "단색화" 문구 무효 — 위치·역할 압축(W2.1)만 유효 ④ 선행 §8 픽셀 audit의 무채색 전환 권고 일괄 무효(copper→slate 지도 마커 포함) — 충돌 시 본 문서 §F-6 우선 ⑤ 선행 문서의 게이트는 "구G-n"으로 지칭(본 문서 §G와 번호 무관) | fresh 세션의 정반대 집행 함정 제거 (가드 리뷰 HIGH) |
| 2026-07-13 | **ISR 불변식**: 상세 페이지는 `revalidate=3600`+`generateStaticParams` ISR(2026-07-04 성능 트랙 T1 확정). 페이지 서버 트리에 `cookies()`/`headers()`/서버 `searchParams` 소비·`no-store` fetch **추가 금지** — 실시간·개인화 데이터는 전부 클라이언트 fetch. 집행 = 매 PR `npm run build` 라우트 심볼 검사(동적 전환=머지 블록) | TTFB 0.13s(CDN HIT) 보호. 어기면 빌드는 green인 채 조용히 동적 강등 |
| 2026-07-13 | **가격 표면 규칙**: 나열(매트릭스)=요금표 시트 1회 유일 / 진입점(From $X 단일 숫자)=스티키바·예약카드·AtAGlance 시트 버튼 **정확히 3곳 고정**(추가 금지). Live 스트립에 가격 넣지 않음 | §F-1과 신설 요소의 내적 모순 해소 (가드 리뷰 HIGH) |
| 2026-07-13 | **디스클로저 문법 4종 고정**(§F-8) + 신규 오버레이/제스처는 기존 1종 제거와 맞교환 | 인터랙션 어휘 인플레 방지 |
| 2026-07-13 | **W2에도 목업 승인 게이트**: 제거·병합 티켓(W2.1/W2.3+2.4/W2.5)은 375px before/after 스크린샷 사용자 승인 후 머지 | 다운그레이드 방지 핵심 장치가 가장 위험한 웨이브에 없었음 (가드 리뷰 HIGH) |
| 2026-07-13 | **평점(★) 노출 게이트**: 외부 집계 실수치 검증+플래그 ON 전까지 전 표면 평점 미표시 | 출처 없는 ★ = 날조 |
| 2026-07-13 | **리뷰 0건 처리**: 리뷰 섹션+TabsNav Reviews 탭 동시 조건부 미노출. 단 `#reviews-write` 해시(또는 `?write=1`) 진입 시 작성 폼만 렌더 | 콜드스타트 데드락(W4.3 메일→폼 없음) 방지 |
| 2026-07-13 | **히어로 모바일 29vh 유지**(확대 기각). 데스크탑 max 360→420은 W3.2에 편입 실행 | LCP 보호 + 선행 §1.2 |
| 2026-07-13 | **픽업 중복 해소 = Phase 1 점프링크**: PickupDropoffSection이 유일 canonical 지면, 타임라인 양끝은 요약 노드+점프. 드로어 이식은 계측 후 Phase 2(§D) | 기존 361 LOC 재활용 = 최저 리스크 |
| 2026-07-13 | **DOM 라운드트립 검증 = 모든 병합/압축 PR DoD** (접힘 상태 DOM에 전체 카피 존재 — 가능하면 스냅샷 테스트) | 비파괴 바인딩의 집행 장치 |
| 2026-07-13 | 신규 UI 라벨 = `sectionUi` 옵셔널 키+EN 폴백 즉시 출시, 36투어×6로케일 백필은 별도 스크립트 티켓. 한 줄 제약 문자열은 es(최장)·ja/zh 기준 375px QA 필수 | 다국어 오버플로 = 컴팩트 설계 1호 리스크 |

## §C 변경 로그

| 날짜 | 작업 | 커밋 | 비고 |
|---|---|---|---|
| 2026-07-12 | v1 (실사 3종) | — | |
| 2026-07-13 | v2 (디렉티브+4렌즈×3심) → v2.1 (색 Rich but Harmonized) | — | |
| 2026-07-13 | **v2.2 최종판** — 가드 리뷰 5렌즈 35건(HIGH 9) 반영: §P 성능 프로토콜·§L 리포 규칙·선행 §B 대체 명세·ISR 불변식·가격 표면 규칙·디스클로저 4종·W2 목업 게이트·투어 타입 매트릭스·색 수치 밴드·리뷰 콜드스타트 예외. **origin/main 재검증**: 로컬 main 119커밋 stale, 상세는 ISR 확정(UI 실사 수치는 origin/main 동일 확인) | — | 실행 준비 완료 판정 |
| 2026-07-14 | **W0.1 성능 베이스라인 (§P-0, origin/main df5b9d42 + W1.1 모션 상수)** — ① 라우트 JS(프리렌더 HTML 실측, `scripts/perf-budget-tour-product.mjs` 신설): 4 QA 슬러그 전부 **493.1KB gz / 1677.0KB raw** (union 27 scripts, BASELINE_GZ=504,976B). `/[locale]` 슬러그는 온디맨드 ISR(정적 HTML 없음) ② 로컬 Lighthouse ×3 median (mobile·simulate·`next start`): **EN LCP 12,470ms · FCP 6,311 · TBT 309 · CLS 0.022 · score 0.54** / **KO LCP 14,806 · FCP 7,833 · TBT 217 · CLS 0.012 · score 0.54** (로컬 상대비교 전용 — 절대치 게이트는 프로드 Speed Insights) ③ 프로드: TTFB **0.11s**(x-vercel-cache HIT), HTML gz **60,940B** ④ 375px 네트워크·스크롤(§P-0.4): jeju-grand **9,003px**·49img 1,449KB / jeju-charter **8,696px**·16img 538KB / busan-cruise **8,579px**·62img 1,857KB / seoul-nami **7,184px**·32img 1,108KB, 폰트 22~24 req(Pretendard subset+next/font), 총 요청 118~165. W2 스크롤 −35% 목표선: jeju-grand ≤5,852px | (W1.1 PR) | 이후 모든 §P-1 판정 기준 |
| 2026-07-14 | **W1.1 드로어 모션 다이어트** — TourStickyBookingBar: 드로어 0.78→**0.28s**, 백드롭 0.55→**0.25s**, 캘린더 fade delay 0.48s+0.85s→**0.25s·delay 0**. 4슬러그 탭→캘린더 표시 실측 **367~382ms**(기존 ~1.3s), 오픈+400ms 시점 opacity 1. 빌드: ISR revalidate=3600 유지, JS union gz **diff 0B**(§P-1 통과). 요소 대차대조표: 추가 0·제거 0(모션 상수만) | (W1.1 PR) | P-LOW |

## §D 보류 / parked

| 항목 | 이유 | 재검토 |
|---|---|---|
| Field Notes(가이드 계절 필드노트) | UI 티켓이 아닌 콘텐츠 저작 파이프라인(36×6) + 날조 오인 리스크 | G-1 부결 시 대안 승격 |
| 사진배경 계절 세그먼트 탭 | 계절 사진 에셋 파이프라인 미견적 — W3.5는 텍스트+시즌 틴트로 | 에셋 확보 후 |
| 픽업 드로어 완전 이식(Phase 2) | Phase 1 배포 후 점프링크 사용률·픽업 문의량 계측 | W2 +4주 |
| 히어로 모바일 높이 확대 | §B 기각 — 목업+LCP 게이트 후 | 사용자 요청 시 |
| 폴리오 면수 인덱스(04/12)·러닝 폴리오 | 조건부 섹션으로 투어별 총 면수 가변 → 고정 넘버링 성립 불가 | 구조 안정화 후 |
| Live 스트립 "오늘 가격" | 가격 표면 규칙(진입점 3곳 고정)과 충돌 — 스트립은 날씨+운영 라이브 신호 전용 | — |
| 인터랙티브 지도 / 다크모드 / 가격비교 위젯 / Q&A | v1 유지 | — |

---

## §E 코드 실사 (2026-07-12 감사 + 2026-07-13 origin/main 재검증)

- ⚠ **로컬 main은 origin/main보다 119커밋 stale** — 반드시 `git fetch origin` 후 **origin/main 기준** 워크트리에서 작업(§L).
- ⚠ **렌더링 모드(2026-07-04 성능 트랙 T1 확정, origin/main 검증됨)**: 상세는 `export const revalidate = 3600` + `generateStaticParams` ISR, EN 베어 경로 + `app/[locale]/tour-product/[slug]` 실라우트 6로케일, 어드민 즉시반영은 `revalidatePath`(`revalidateTag` 금지 — Next 16). TTFB 0.13s(CDN HIT)가 현재 베이스라인. ISR 불변식(§B) 준수.
- ⚠ **캐노니컬 번들 경로 주의**: 섹션 컴포넌트 17종은 전부 `components/product-tour-static/east-signature-nature-core/tour-detail-sections/*.tsx` — 폴더명이 슬러그처럼 보이지만 **전 투어 공용 컴포넌트 번들**이다(다른 슬러그 폴더는 로케일 JSON만). `_shared/`에는 orchestrator(`TourProductDetailClient.tsx`)와 `bookingShared.tsx`.
- UI 실사(아래 수치 origin/main에서 재확인됨): 드로어 0.78s(`TourStickyBookingBar.tsx:349`, 백드롭 0.55s `:334`, 캘린더 fade delay `:422`) / CTA `bg-foreground`(Sticky `:306`, Desktop `TourDesktopBookingCard.tsx:545`) / 가격 매트릭스 2회 렌더(본문 `TourProductDetailClient.tsx:162-212` + 카드 `:367-443`) / 신뢰 문구 4개소 / 6색 무지개(`TourAtAGlance.tsx:6-13`) / rose 3중 pill(`TourHeroSection.tsx:264`) / 아코디언 5개 / copper 그라데이션(`TourPickupDropoffSection.tsx:169,207`).
- 리뷰 전 상품 0건, `SHOW_EXTERNAL_REVIEWS=false`(`TourProductDetailClient.tsx:50`), `/api/tours/[id]/availability/range` 존재·미연결. `tierPriceUsd` 인원 연동 가격은 이미 구현(Sticky `:103-119`).
- **온디맨드 가용성 모델**: `product_inventory`가 비어 있는 것은 의도(가용성 무한) — 빈 인벤토리=가용이 디폴트 시맨틱, 희소성 UI 금지 바인딩 유효.
- 모바일 sticky bar는 이미 `fixed bottom-0` 상시 렌더(first-fold 상주) — 티켓 아님.
- 자산: Vogue 화보 갤러리(필름그레인+Bodoni+pull-quote), 이슈넘버 히어로, 라이브 날씨/해녀쇼, 스톱 드로어(1,310 LOC 검증됨), AI 어시스턴트, `?date=&guests=` 딥링크(클라 파싱 — T1 설계).

## §L 작업 환경 · 리포 규칙 (fresh 세션 필수)

1. **워크트리 필수** — 메인 dir은 동시 세션 경합. `git fetch origin` → `git worktree add C:\Users\sangsong\atockorea-tourdetail -b feat/tour-detail-highend origin/main` → node_modules는 메인에서 정션(`cmd /c mklink /J`). 이후 모든 작업·빌드·프리뷰는 워크트리에서.
2. **프리뷰**: `.claude/launch.json`에 설정 추가 — `{"name":"tour-detail-dev","runtimeExecutable":"npm","runtimeArgs":["run","dev","--prefix","C:/Users/sangsong/atockorea-tourdetail","--","--port","3120"],"port":3120}` — 다른 트랙 포트(3110)와 충돌 금지.
3. **커밋 푸터**: `Co-Authored-By: Claude <noreply@anthropic.com>`만. **모델 식별자 절대 금지.** 코드·커밋 영어, 진행 보고 한국어.
4. **머지 플로**: gh CLI 미설치 → GitHub REST API(git credential 활용, bash+파일 방식). 빌드·lint·테스트 그린 + 해당 티켓 DoD 통과 시 커밋→PR→머지 자율 진행(기존 승인 워크플로). 단 **목업 게이트가 걸린 티켓(W2.1/W2.3+2.4/W2.5/W3)은 사용자 승인 전 머지 금지**.
5. **콘텐츠 비파괴**: 로케일 JSON 투어 카피는 additive-only(변경·삭제·축약 금지). 압축은 표시 계층에서만.
6. PR 단위: **티켓 ≤2 · 변경 파일 ≤6**(로케일 JSON 백필·스냅샷 제외).

## §P 성능 비회귀 프로토콜 (디렉티브 5조의 집행)

### P-0 베이스라인 캡처 (= W0.1, 첫 코드 PR 이전 필수)
1. 워크트리에서 `npm run build` → `/tour-product/[slug]` + `/[locale]/tour-product/[slug]` 라우트의 **First Load JS + 렌더 심볼(ISR 유지)** 기록.
2. `npm run start` 후 `npx lighthouse http://localhost:3000/tour-product/jeju-grand-highlights-loop --form-factor=mobile --screenEmulation.mobile --throttling-method=simulate --only-categories=performance` ×3 median — LCP/FCP/TBT/CLS 기록 (EN 베어 + `/ko` 각 1개, 별개 라우트).
3. 프로드 `curl -sI` ×2 → `x-vercel-cache: HIT`·TTFB·HTML gz 기록 + Vercel Speed Insights 상세 라우트 p75 7일치.
4. 네트워크 인벤토리: 폰트 요청 목록, 375px 첫 화면 이미지 전송량, **문서 총 스크롤 높이(px, 375px 뷰포트)** — 스크롤 뎁스 KPI의 baseline.
5. 전부 §C에 수치로 기록. (선택) `scripts/perf-budget-tour-product.mjs` 신설 — .next 매니페스트 기반 라우트 JS gz 합계를 체크인하고 `--check`로 예산 초과 시 exit 1 (W6에서 CI화).

### P-1 매 PR 게이트 (공통 DoD)
- `npm run build` → ISR 심볼 유지 + First Load JS diff 기록. **예산: PR당 +5KB gz 초과 금지, 플랜 전체 누적 +15KB gz 상한**(W1.4/1.5 매트릭스 제거·W2 병합으로 순감이 목표). 초과 시 `npm run analyze`로 원인 규명 후 상쇄.
- P-HIGH 티켓(신규 fetch/폰트/이미지/스크롤 연동: W1.6·W2.3·W5.1·W5.2·W5.4)은 로컬 Lighthouse ×3 median before/after 첨부 — **LCP +300ms 또는 CLS >0.05 시 머지 블록**. P-MED(W1.3~1.5·W2.1~2.5·W4.1)는 프리뷰 배포 curl HIT 확인. P-LOW(W1.1·W1.2·W1.7·W2.6·W3.x)는 빌드 diff만.
- 절대치 게이트(p75 LCP ≤2.5s)는 프로드 Speed Insights에만 적용(로컬은 런간 편차).
- 머지 후 48h Speed Insights 확인 — 베이스라인 +10% 회귀 시 24h 내 수정 or 리버트. **Vercel 결제 이슈 중 머지=빌드 스킵 전례** → 머지 후 프로덕션 빌드 실제 반영(빌드 로그) 확인.

## §F 디자인 헌장 — 8원칙

1. **단일 소스**: 같은 정보 나열은 1회. 픽업 상세 1회(픽업 섹션), 신뢰 문구 2회(히어로 마이크로라인 + 데스크탑 예약카드/모바일은 스티키바 드로어 내 1줄). **가격 각주**: 나열=요금표 시트 1회 / 진입점(From $X)=스티키바·예약카드·AtAGlance 시트 버튼 3곳 고정.
2. **섹션 캡**: 상시 렌더 톱레벨 12 이하, 조건부(Live 스트립·Reviews/Proof) 포함 최대 14. 신규 섹션은 기존 1개 병합과 맞교환.
3. **3-tier + 노출 하한**: Glance→섹션 기본 노출→드로어/시트. 하한(클릭 0회 사수): 포함 6+불포함 3, Best for 4+Less ideal 4, FAQ 상위 5. **하한이지 캡이 아님** — 항목 수가 하한+2 이내면 전량 노출, 초과분만 "외 N개" 접기. 접기 허용=참조 정보만(픽업 전체 리스트·요금표·Route logic·비활성 계절·FAQ 6+).
4. **중첩 아코디언 0**: 접힘은 1단만.
5. **리듬**: 같은 밀도 텍스트 블록 3연속 금지, 텍스트↔비주얼 교차.
6. **Rich but Harmonized** (색 — 디렉티브 4 집행):
   - **수치 밴드**: 기준 앵커=home v2 앰버 토큰의 OKLCH L/C를 전 hue에 적용. 풀 톤(아이콘·도트) C 0.09~0.14 / L 0.58~0.68, 딥 톤(텍스트) C 0.06~0.10 / L 0.35~0.45, wash=풀 톤의 5~8% 알파(정확값은 앰버 앵커에서 캘리브레이션). **"보석톤"의 조작적 정의 = raw tailwind-500(C 0.17~0.25) 대비 채도 25~40% 하향 + 명도 밴드 통일** — 채도를 올리는 게 아니라 깊이를 주는 것.
   - **틴트 4슬롯**: wash(대면적 저틴트) / 풀 톤(24px 이하 아이콘·도트·2px 헤어라인 소면적만) / 딥 톤(텍스트) / **액션 톤**(CTA·활성 탭·가격 앵커 전용 풀·딥 솔리드 — 뷰포트당 대면적(h≥44px) 풀 톤 블록은 CTA 계열 1개 한정). 지면의 주인은 웜 아이보리와 사진, 유채색은 그 위의 사건(뷰포트 내 사진 제외 유채색 면적 체감 10~15%).
   - **효과 스택 ≤1**: 한 요소에 gradient+ring+shadow 다중 금지 (색은 유지, 효과만 정리).
   - **의미 고정 + 색-의미 매핑표**(W3.1 산출물): hue별 배정 의미 1개. 시스템 간 충돌(예: 그린=라이브 도트/포함 체크/계절) 발견 시 hue 미세 분리 또는 의미 통합으로 해소, 매핑표 커밋 후 모든 색 PR은 매핑표 대조.
   - 하한: CTA·활성·가격 무채색 금지(토큰 차단), 쿨그레이 지면 금지, 섹션당 유채색 액센트 ≥1(**기존 색의 보존 체크이지 무채 섹션에 신규 색을 발명하라는 의무가 아님** — 신규 색은 매핑표 등록 의미가 있을 때만), 사진 밀도 불감소, 에디토리얼 존(화보·이슈넘버·pull-quote) 불변.
7. **모션 다이어트**: 드로어 0.28s, 전환 0.2s대, 신규 스크롤 연동 모션·마퀴 0.
8. **디스클로저 문법 4종 고정**: ① 딥다이브=드로어(스톱·Route logic·픽업 Phase 2 — 동일 헤더 문법) ② 참조표=시트(요금표 유일) ③ 섹션 내 전환=세그먼트 토글(시즌·기본|샘플 — **공유 컴포넌트 1개**) ④ 페이지 내 이동=점프링크. 이 4종 밖 신규 오버레이/제스처는 기존 1종 제거와 맞교환.

## §I IA 최종 맵 — 17 → 상시 12 (+조건부 2)

### 모바일 first-fold (375×812, 스크롤 0)
```
[Hero 29vh]  사진(첫 프레임 정적 렌더) + N° 이슈넘버 + 제목
[메타 1줄]   "10시간 · 7 스톱" (★평점은 G-1 게이트 후)
[신뢰 1줄]   ✓무료취소 · 즉시확정 · 24/7  ← 본문 유일 (체크 아이콘+딥 톤, 회색 fine-print 금지)
[TabsNav]    스티키 진입
[AtAGlance]  상단 2행 폴드 걸침 → 스크롤 어포던스
[sticky bar] (상시·기존) 좌: From $240 · 그룹당 / 우: 유채색 CTA "날짜 확인" (색=G-2 확정값, 권고 앰버)
```

### 섹션 재편표 (구→신 전체 매핑은 부록 A, 타입별 노출은 부록 B)

| # | v2 섹션 | 처리 |
|---|---|---|
| 1 | **Hero** | pill 3중 효과→1효과(gradient 유지, ring·shadow 제거 — 색 보존), 메타 1줄. Trust strip(구2) 흡수→마이크로라인 |
| 2 | **TabsNav** | 앵커 재매핑(병합과 동일 PR·구 앵커 호환). Reviews 탭 리뷰 0건 시 미노출 |
| 3 | **At a Glance** | 6색 유지(항목별 고정 배정) — 팔레트 톤 재조율. **셀 배경은 웜 아이보리 단일 — hue별 wash 셀 도색 금지, 색은 아이콘·도트·라벨 소면적만**. hue 분포도 큐레이션(색상환 등간격 무지개 배열 금지, 웜 앵커 중심 비대칭). 하단 "From $X · 전체 요금표" 시트 버튼 |
| 4 | **Atmosphere 화보** | 불변 (에디토리얼 존) |
| 5 | **Live from Korea** (조건부·신설) | 해녀쇼(구7)+날씨(구14 일부): 오늘 날씨·운영 상태·라이브 도트+KST 타임스탬프. **가격 없음**(§B). 클라 전용+고정 높이(§R W5.1). es 오버플로 대비 줄바꿈 허용 |
| 6 | **Itinerary** | DayFlow(구8)→**스톱 커버 사진 썸네일 스크러버**(비스티키 인라인 — 텍스트·도트 only 금지, 기존 이미지 재사용). 픽업4·드롭5 나열→양끝 요약 노드(지도 썸네일+첫 픽업 시각)+§7 점프. 샘플(구10)→"기본｜샘플" 토글(공유 투어 한정 렌더). 스크러버와 토글은 수직 분리 배치(동일 행 병렬 금지) |
| 7 | **Pickup & Map** | 유일 canonical 지면(구11 유지·재조판). 점프 도착점에 "일정으로 돌아가기" 리턴 링크 + `scroll-margin-top`(스티키 겹침 방지) |
| 8 | **What's included** | 포함 6+불포함 3 즉시 노출(하한). wash는 틴트 공식으로 재조율(2종 상이 틴트 통일 — 제거 아님) |
| 9 | **Is this tour for you** | Best 4+Less ideal 4 전량 2열 플랫. amber wash 유지·틴트 조율. Route logic→드로어 |
| 10 | **Practical & Seasons** | 4계절 4색 유지 — 시즌 세그먼트 1카드(현재 시즌 기본). 실용정보 상위 3+접힘. 날씨는 §5로 |
| 11 | **FAQ & After you book** | BookingSupport(구15) **레이아웃만** 슬림 스텝라인으로 압축 — 스텝 수·카피·스텝별 고유색 전부 보존(§B). trust 아이템 카피는 W4.4 직영 신뢰 카드가 수용. FAQ 상위 5 펼침 |
| 12 | **Recommendations** | 유지 (이탈 회수) |
| +조건부 | **Reviews / Proof** | 0건→섹션+탭 미노출(`#reviews-write` 예외). G-1 후 외부 집계 Proof 지면 |
| 상시 | 예약카드/스티키바 | W1 — 가격 단일 SoT, W5.2 Rate Card 조판 |

### 부록 A — 구 17 섹션 → 파일 → 신 귀속

| 구 | 컴포넌트 (전부 `east-signature-nature-core/tour-detail-sections/`) | 신 |
|---|---|---|
| 1 Hero | TourHeroSection.tsx | #1 |
| 2 Trust strip | (인라인, `_shared/TourProductDetailClient.tsx:132-152`) | #1 흡수 |
| 3 TabsNav | TourTabsNav.tsx | #2 |
| 4 AtAGlance | TourAtAGlance.tsx | #3 |
| 5 Pricing 테이블 | (인라인, `TourProductDetailClient.tsx:162-212`) | → W1.4 요금표 시트로 이동(본문 소멸) |
| 6 Gallery | TourAtmosphereGallery.tsx | #4 불변 |
| 7 HaenyeoStatus | (HaenyeoStatusButton) | #5 흡수 |
| 8 DayFlow | TourDayFlowSection.tsx | #6 스크러버로 흡수 |
| 9 Timeline | TourTimelineSection.tsx | #6 본체 |
| 10 PrivateSample | TourPrivateSampleItinerarySection.tsx | #6 토글 |
| 11 PickupDropoff | TourPickupDropoffSection.tsx | #7 |
| 12 Included | TourIncludedSection.tsx | #8 |
| 13 Fit | TourFitSection.tsx | #9 |
| 14 Practical | TourPracticalDetails.tsx | #10 (날씨→#5) |
| 15 BookingSupport | TourBookingSupportSection.tsx | #11 흡수 |
| 16 FAQ | TourFaqSection.tsx | #11 |
| 17 Reviews | TourReviewsSection.tsx (+TourExternalReviewsSection) | 조건부 |
| 18 Recommendations | TourRecommendationsSection.tsx | #12 |
| — 예약 | TourDesktopBookingCard.tsx / TourStickyBookingBar.tsx / `_shared/bookingShared.tsx` | 상시 |

### 부록 B — 투어 타입별 렌더 매트릭스 (모든 W1/W2 PR의 QA 세트)

QA 대표 슬러그 4종: 공유=`jeju-grand-highlights-loop` / 프라이빗 차터=`jeju-island-private-car-charter-tour` / 크루즈=`busan-small-group-sightseeing-tour-cruise-passengers` / 서울권=`seoul-private-nami-morning-calm-petite-france` — 전부 375px 프리뷰.

| 요소 | 공유 | 프라이빗/차터 | 크루즈 |
|---|---|---|---|
| W1.3 가격 라벨 | 티어: "N인 · $X/인" | **정액: "그룹당 $X"** (인당 환산 병기 금지) | 티어/정액 상품별 |
| #6 기본｜샘플 토글 | 렌더 안 함 | 샘플 보유 4슬러그만 토글, 그 외 미노출 | 미노출 |
| #6 픽업 요약 노드 | "픽업 · N개 지점 · HH:MM부터" | 호텔 픽업 문구 | **포트 문구 별도 키**(단일 항구) |
| #5 Live 스트립 | 지역 날씨 | 동일 | 동일+포트 |
| Pricing 시트 | pax×duration 매트릭스 | 시간(4~10h)×tier 매트릭스 | 상품별 |
| 조건부 조합 검증 | 리뷰·Live·샘플·해녀 온오프 조합에서 TabsNav 앵커·섹션 수 자연스러움 확인 | 동일 | 동일 |

## §G 사용자 결정 게이트

| # | 게이트 | 질문 | 권고 |
|---|---|---|---|
| G-1 | `SHOW_EXTERNAL_REVIEWS` | 데모 시드→실수치 교체 검증 **후** ON (두 게이트 모두) | ON |
| G-2 | CTA 액센트 색 (W1.2만 블로킹) | 앰버 계열 vs 브랜드 블루 — W1.2에서 두 색 목업 제시 후 확정 | 앰버 |
| G-3 | 리뷰 수집 이메일(D+1, Resend) | 외부 발신 자동화 | ON |
| G-4 | Viator 링크 확대 | 집계 배지 재설계 후 | 재설계 후 |

## §R 실행 로드맵

> **공통 DoD (전 티켓)**: ① §0 5개조 self-check(색은 두 질문) ② §P-1 성능 게이트(빌드 diff·ISR 심볼·등급별 측정) ③ DOM 라운드트립(병합/압축 PR) ④ TabsNav 앵커 재매핑 동일 PR ⑤ 부록 B 4슬러그 375px 프리뷰 ⑥ es/ja/zh 375px 렌더 QA(한 줄 문자열) ⑦ **요소 대차대조표** — PR 설명에 추가/제거한 시각 요소(칩·배지·도트·라벨·오버레이) 목록, W2/W3은 순증 ≤0 ⑧ scroll-freeze 체크. PR 단위: 티켓 ≤2·파일 ≤6.

### Wave 0 — 베이스라인 + 셋업 (반나절)
| 티켓 | 작업 |
|---|---|
| W0.1 | §P-0 성능 베이스라인 캡처 전 항목 → §C 기록 (스크롤 높이 baseline 포함) |
| W0.2 | §L 환경: 워크트리+launch.json+프리뷰 기동 확인. §G 4건 사용자 일괄 질의(비차단) |

### Wave 1 — 컨버전 코어 (3~4일) — W1.2만 🔶G-2
| 티켓 | 작업 | 성능등급 |
|---|---|---|
| W1.1 | 드로어 0.78→0.28s + 백드롭 0.55→0.25s + 캘린더 fade delay 제거 (`TourStickyBookingBar.tsx:349,334,422` — framer-motion duration 수정) | LOW |
| W1.2 | CTA 유채색 전환 — **두 색(앰버/블루) 목업 제시→G-2 확정→적용** (Sticky `:306,456`, Desktop `:545`) | LOW |
| W1.3 | CTA 가격 통합 + 파티 인지형 실시간 라벨(`tierPriceUsd` 기구현 — 라벨만). **타입 분기(부록 B): 티어="N인 · $X/인" / 정액="그룹당 $X"**. 시드는 클라 파싱 유지(T1 설계 — 서버 searchParams 소비 재도입 금지) | MED |
| W1.4 | 본문 Pricing cut-display → 요금표 **시트**(스티키바 드로어 매트릭스 로직 재사용, 하드코딩 영문 i18n 부채 청산). **모바일=바텀시트 / 데스크탑=예약카드 인접 팝오버 또는 중앙 모달(max-w)**. 진입점=AtAGlance 시트 버튼+예약카드 링크, 오픈 0.28s | MED |
| W1.5 | 예약카드 내 매트릭스 → 현재 선택 요약 1행+시트 링크 (가격 단일 SoT 완성) | MED |
| W1.6 | 가용성 캘린더(range API): **시맨틱 — 빈 인벤토리=가용(온디맨드 디폴트), dim은 명시적 블랙아웃만, 전 날짜 균일 가용이면 도트 생략(희소성 UI 금지)**. `next/dynamic` 코드 스플릿 — 드로어 최초 오픈 시 로드(First Load JS ±0 증명), fetch는 캘린더 오픈 시점+월 캐시+AbortController, 실패 시 현행 폴백. DoD: 대표 투어 골든 3케이스(가용/블랙아웃/API실패)+라이브 육안, 오픈→인터랙티브 <400ms | **HIGH** |
| W1.7 | 드로어 drag handle + swipe-down dismiss | LOW |
| W1.8 | 퍼널 이벤트 — **기존 analytics 파이프라인 재사용(신규 서드파티 SDK 금지, sendBeacon)**, 이벤트 5종 고정: `pd_drawer_open / pd_date_set / pd_availability_ok / pd_cta_click / pd_rates_sheet_open` | LOW |

**완료 기준**: 부킹 플로우 5종 QA + 캘린더 골든 3케이스 + 5로케일 CTA 스크린샷 + 이벤트 수신 + §P-1 통과.

### Wave 2 — IA 컴프레션 (1.5주, 단계 분리 배포 — 목업 게이트 3건)
| 티켓 | 작업 | 성능등급 |
|---|---|---|
| W2.1 | Trust strip 독립 섹션 제거 → 히어로 마이크로라인(체크 아이콘+딥 톤 — 회색 fine-print 금지) + 데스크탑 예약카드 1줄 + **모바일 스티키바 드로어 내 1줄**(결제 결심 순간 커버). 기존 `t()` 키 재사용 — 신규 번역 0. **🖼 목업 승인 후 머지** | MED |
| W2.2 | 타임라인 픽업4·드롭5 나열 → 양끝 요약 노드(지도 썸네일+첫 픽업 시각)+#7 점프링크. 크루즈 포트 문구 별도 키. 도착점 리턴 링크+scroll-margin | MED |
| W2.3 | DayFlow → 스톱 **사진 썸네일** 스크러버(비스티키 인라인). 활성 표시는 **기존 TabsNav IO 콜백 확장(옵저버 순증 0)**+memo 리본만 재렌더. DoD: 전체 스크롤 트레이스 50ms+ long task 0. **🖼 W2.4와 같은 목업 단위 승인** | **HIGH** |
| W2.4 | 샘플 → "기본｜샘플" 세그먼트 토글(§F-8 공유 컴포넌트, 공유 투어 한정, 스크러버와 수직 분리) | MED |
| W2.5 | BookingSupport → FAQ 상단 슬림 스텝라인: **폐기 대상은 grid 레이아웃뿐 — 스텝 수·카피·스텝별 고유색 전부 보존**(색은 팔레트 톤 재조율, W3.1 전이면 임시 배정 후 승격). trust 아이템 카피는 W4.4로 수용. 선행 문서 구G-2(서포트 색 단일화)는 다색 유지 결정으로 게이트 소멸 — **본 문서 §G-2(CTA 색)와 무관**. **🖼 목업 승인 후 머지** | MED |
| W2.6 | 리뷰 0건: 섹션+Reviews 탭 동시 미노출 + **`#reviews-write`/`?write=1` 진입 시 작성 폼만 렌더**(콜드스타트 예외) | LOW |
| W2.7 | TabsNav 앵커 재매핑+구 앵커 호환 (각 병합 PR 분산) | LOW |

**완료 기준**: 상시 섹션 12(**Live 스트립은 W5.1 — 구7·구14는 그 전까지 원형 유지, 선제거 금지**), 스크롤 높이(부록 B 4슬러그, 375px) baseline 대비 **−35%↑**, 중복 나열 0, 목업 게이트 3건 승인 완료, 점프·시트 오픈율 계측 개시.

### Wave 3 — 컬러 하모나이징 & 타이포 (1.5주) — 색을 빼는 웨이브가 아니라 전 색을 팔레트 토큰으로 승격하는 웨이브
| 티켓 | 작업 |
|---|---|
| W3.1 | **큐레이션 팔레트 토큰화**: §F-6 수치 밴드로 전 장식색(emerald·amber·orange·rose·violet·sky·copper·4계절) 재조율 → `tour-product-v2-scope.css`의 `tour-product-v2-static-root` 스코프 CSS 변수(페이지 밖 오염 방지). 산출물: **색-의미 매핑표**(§F-6ⓓ, 그린 충돌 해소 포함) 커밋. ESLint: `no-restricted-syntax`로 디렉토리 한정 raw 원색·인라인 hex 차단(수치 밴드 밖 신규 토큰도). 판정 명령 병기: `grep -rE "(emerald|rose|violet|sky|orange|amber|teal)-(400|500|600)" components/product-tour-static/east-signature-nature-core/` → 0 |
| W3.2 | Hero: pill gradient 유지·ring/shadow 제거, eyebrow 정리, 별 amber 통일 + **데스크탑 히어로 max 360→420(선행 §1.2 실행)** — 에디토리얼 존 불변 |
| W3.3 | AtAGlance: §I #3 세칙(셀 wash 금지·hue 비대칭 큐레이션·소면적 색) + `rounded-[26px]`→토큰 + 시트 버튼. 목업에 wash-on/off 비교컷 포함 |
| W3.4 | Included/Fit: 노출 하한 플랫화 + wash 틴트 공식 재조율 |
| W3.5 | Practical 시즌 세그먼트(4색 유지, §F-8 공유 토글) + Pickup copper→팔레트 톤(그라데이션 캐리어만 정리, 지도 마커 무채색화 금지 — §B 대체 명세 ④) |
| W3.6 | 공유 섹션 헤더 컴포넌트 1개(킥커+헤어라인+타이틀, CJK=자간 절제 고딕 변형) — **accent 팔레트 토큰을 prop으로 받아 섹션별 고정색 적용(구조 1종·색은 의미 고정)**. 적용 제외: Atmosphere 화보 헤더·이슈넘버·pull-quote. **신규 폰트 네트워크 요청 0** — 기로드 패밀리·웨이트만 |
| W3.7 | 타입 6단계 유틸 + radius role-based 토큰화 |

**완료 기준**: 판정 grep 0, 효과 스택 ≤1 전 요소, 틴트 공식 위반 0, 매핑표 커밋, **양방향 목업 승인** — "빠짐으로 읽히지 않는가 + 캔디/토이로 읽히지 않는가", 레퍼런스 병치 스쿼시 테스트(Hermès 제품 페이지·Monocle 인덱스·Aesop 스크린샷 옆에 두고 우리만 채도가 튀면 실패).

### Wave 4 — 소셜프루프 & 신뢰 (1주+게이트) 🔶G-1/G-3
| 티켓 | 작업 |
|---|---|
| W4.1 | 외부 집계 데모 시드→실수치 교체+검증 → G-1 승인 시 ON, Proof 지면(출처 배지+링크) | 
| W4.2 | 평점 게이트 해제(히어로 메타·추천 카드 ★ — G-1 후에만) |
| W4.3 | 리뷰 수집 루프(G-3): D+1 메일→`/reviews#reviews-write` 딥링크. **W2.6 예외 경로와 E2E 연동 확인 DoD**. 리뷰 ≥1건부터 AggregateRating JSON-LD 자동 활성(기구현) |
| W4.4 | "Operated by AtoC Korea" 직영 신뢰 1카드 — #11에 통합(신규 섹션 아님), 구15 trust 아이템 카피 수용처 |

### Wave 5 — 에디토리얼 시그니처 (1.5주)
| 티켓 | 작업 | 성능등급 |
|---|---|---|
| W5.1 | **Live from Korea 스트립**(#5): 날씨+해녀쇼 상태+라이브 도트+KST(가격 없음). **클라 전용 — hydration 후 idle fetch, 서버 트리 실시간 데이터 유입 금지(ISR 불변식)**. 고정 min-height 스켈레톤을 서버 HTML에 예약 — 데이터 도착/비노출 양쪽 CLS 0(비노출=높이 유지+정적 대체 문구). **아이템 단위 부분 렌더**(가용 ≥1이면 해당만, 0일 때만 스트립 비노출). 기존 해녀·날씨 fetch 통합 — **네트워크 요청 순증 0**(전후 요청 수 DoD 기록). 폴링·웹소켓 금지, 마운트 1회 | **HIGH** |
| W5.2 | Rate Card 예약카드: Bodoni 가격 숫자(화보가 이미 로드하는 패밀리·웨이트만 — **신규 폰트 요청 0**, 필요 시 사이즈 명기 별도 게이트) + `font-variant-numeric: tabular-nums`+고정폭(스왑 시프트 방지) + 가용성 도트 캘린더(W1.6과 동일 소스·lazy 재사용, 별도 fetch 경로 금지) | **HIGH** |
| W5.3 | 드로어 디자인 언어 통일(스톱·Route logic·요금표 시트 동일 헤더 문법 — §F-8 ①②) | LOW |
| W5.4 | 챕터 사이 풀블리드 사진 브레이크(갤러리 컷·**동일 URL 변형 재사용 우선**): next/image lazy+`sizes=100vw`+aspect-ratio 고정(CLS 0), `priority` 금지, **페이지당 ≤3장·375px 추가 전송 ≤300KB** + Hero 첫 프레임 정적 렌더 | **HIGH** |
| W5.5 | 스톱 카드 16:9 커버·드로어 픽셀 폴리시(선행 §8.6 — 단 무채색화 권고는 무효, §F-6 적용) | MED |

### Wave 6 — 측정 & 가드 CI화 (병행)
- `scripts/perf-budget-tour-product.mjs` CI화(§P-0.5) + ESLint 토큰 가드 상시화.
- **구조 스냅샷 자동 테스트**: 부록 B 4슬러그의 톱레벨 섹션 수(상시 ≤12)+오버레이 트리거 수 — 늘면 CI 빨간불 (DOM 라운드트립 인프라 재사용).
- 퍼널 대시보드(W1.8 이벤트) + Speed Insights 주간 리뷰.

## §H KPI — "뛰어넘었다"의 정의

| 지표 | 현재 (W0.1 확정) | 목표 |
|---|---|---|
| 모바일 스크롤 높이 (부록 B 4슬러그, 375px) | W0.1 기록 | **−35~40%** |
| 상시 톱레벨 섹션 | 17+상시3 | **12 (조건부 포함 ≤14)** |
| 동일 정보 중복 | 가격 나열 2·픽업 2·신뢰 4 | **나열 1(시트)·진입점 ≤3 / 1 / 2** |
| 확신 정보 클릭 비용 | 아코디언 5개 | **0클릭** (하한 §F-3) |
| 장식색 조화 | raw 원색 122건·틴트 제각각·효과 3중 | **팔레트 토큰 100% · 틴트 공식 · 효과 ≤1 · 대면적 풀 톤=CTA 1개** (hue 수 유지) |
| 드로어 체감 | 0.78~1.3s | **≤0.3s** |
| **상세 TTFB (CDN HIT)** | 0.13s | **유지 (회귀 0)** |
| **프로드 p75 LCP** | W0.1 기록 | **≤베이스라인, 절대 상한 2.5s** |
| **라우트 First Load JS** | W0.1 기록 | **누적 +15KB gz 상한 (목표 순감)** |
| **CLS / 신규 폰트·서드파티 요청** | W0.1 기록 / 0 | **≤0.05 / 0** |
| 소셜프루프 | 0 | 외부 집계 실수치 + 수집 루프 가동 |

**성공 문장**: "Klook보다 빨리 예약되고, Airbnb보다 깊게 읽히고, 지금과 똑같이 빠르면서, 첫 스크롤에서 피로 대신 확신을 주는 페이지."
