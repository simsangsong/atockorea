# 투어 카탈로그 (`/tours/list`) UI/UX 마스터 플랜

작성일: 2026-05-20
문서 상태: **표준 마스터 플랜 (유일한 실행 기준)**
대상: AtoC Korea 카탈로그 페이지 `app/tours/list/page.tsx`
관련 허브 페이지: `app/tours/page.tsx` (이미 매거진 톤 완성 — list가 그 톤을 이어받는 작업)

## 0. 이 문서의 위치

| 문서 | 역할 |
|---|---|
| **이 문서** | **표준. 모든 `/tours/list` 실행은 이 기준.** |
| `docs/landing-page-uiux-master-plan-v3-2026-05-17.md` | 랜딩 페이지 — 가족 컬러·매거진 톤·amber 정책의 기준. **이 플랜은 그 톤을 list로 확장하는 것** |
| `docs/tour-product-detail-ui-ux-audit-response-2026-05-17.md` | 상세 페이지 — 색상 다이어트(17→5)·radius role-based·CTA `bg-primary`·trust strip 위치 등 binding decisions 일치 |
| `docs/itinerary-builder-redesign-master-plan-2026-05-18.md` | 빌더 V2 — list의 conversion rescue band에서 `/itinerary-builder`로 분기 동선 |

작성 배경:
1. **사용자 진단 (2026-05-20):** `/tours/list`는 허브(`/tours`)·상세(`/tour-product/[slug]`)와 비교했을 때 **유일하게 매거진 톤이 아닌 admin 검색창** 상태. 7가지 다운그레이드 신호 진단 완료.
2. **사용자 안전장치 요청:** "또 이상한 미니멀리즘·단색화·flat 흑백 잡지 느낌 만들지 말 것". 상세페이지 1차 audit 때 다운그레이드된 트라우마. → §13 "안 할 일" + §B 영구 결정으로 가드.
3. **메모리 룰 반영 (`feedback_premium_default_enrichment.md`):** "프리미엄 UI/UX = enrichment, never 'what to cut'". 모든 의사결정의 디폴트는 "어디에 craft를 더할지", 절대 "뭘 뺄지"가 아님.

---

## §A. 상태 대시보드

| Phase | 상태 | 시작일 | 완료일 | 마지막 커밋 | 비고 |
|---|---|---|---|---|---|
| 0 — 코드 실사 + 토큰 락 + Phase 1 사전 게이트 | ✅ 완료 | 2026-05-20 | 2026-05-20 | 649956fd | 7/7 sub-task 통과. 카드 baseline SHA `a931fe4e`. i18n 6/6×6/6=36 entry. Type-check clean. 사용자 "Phase 1 진입 승인" 완료 (2026-05-20) |
| 1 — Catalogue Hero (240→88 collapsing magazine cover) + 푸터 strip | ✅ 완료 | 2026-05-20 | 2026-05-20 | 2d3041f2 | 사용자 "좋아 완벽해" 표지 격 통과 (2026-05-20). 카드 SHA `a931fe4e` 변경 0 (B2). slate-200/900 grep = 0 (B1). i18n 6/6. type-check clean. B18-B31 사용자 직접 디자인 반복 14회 반영 (italic 금지 / 사진 3회 교체 / dark warm Kinfolk 톤 / Noto Serif KR / text-deck-left layout / 자연 cream 오버레이 / 큐레이터 라인 제거) |
| 2 — Sticky Filter Rail 격상 (site-native: 화이트+slate, h-11, active filter chip strip) | ✅ 완료 | 2026-05-20 | 2026-05-20 | 407aa8e2 | B32로 ivory+amber → site-native(반투명 화이트 + slate-900) 전환. 2.1/2.2/2.3/2.4/2.5/2.6/2.8/2.9/2.10 완료. **2.7 More는 Tier B 필터(Phase 4.10)와 함께로 이관**. acceptance: amber-900 grep=0 · 카드 SHA `a931fe4e` · ActiveFilterStrip dismissible · 모바일 drawer 0.3s · type-check clean. 사용자 모바일 확인 완료 |
| 3 — Contextual Vignette Band + Empty State 업그레이드 | ✅ 완료 | 2026-05-20 | 2026-05-20 | 31dcef0e | ContextualVignetteBand(7-accent) + EmptyStateRecovery(3-action) 완료. 3.4/3.5(ResultsMeta+view toggle)는 Editorial 그리드 의존으로 Phase 4 이관. 카드 SHA `a931fe4e`. 사용자 "계속" 진행 |
| 4 — Editorial Grid (3-up vertical default + view toggle) + 6번째마다 Editorial Insert + Conversion Rescue Band | 🔄 (시각 코어 완료, 4.10 Tier B 남음) | 2026-05-20 | — | 70f965ba | 4.0-4.9 완료 (Editorial 그리드·view toggle·Insert·RescueBand·End-of-results). acceptance 충족. **4.10 Tier B(Duration/Features)+More(2.7)는 durations API 계약 확인 필요.** 카드 SHA `a931fe4e` 유지 |
| 5 — Tier B 필터 (Duration·Time·Group·Language) — **API 확장 의존** | 📦 보류 | — | — | — | time/group/language는 DB 컬럼 부재. 백엔드 스프린트 필요. Phase 0 게이트에서 재평가 |
| 6 — 모션 폴리시 (hero scroll-collapse·card stagger·refetch shimmer·editorial insert reveal) | ⏳ | — | — | — | scroll-freeze 가드 (상세페이지 트라우마 동일 적용) |

상태 마커: ⏳ 대기 / 🔄 진행 중 / ⏸ 보류 / ✅ 완료 / ❌ 중단·롤백 / 📦 백로그

**현재 활성 Phase: Phase 4 — Editorial Grid + view toggle + Editorial Insert + Rescue Band + Tier B 필터 (🔄 진행 중).**
**다음 액션: §6.4 4.0(ResultsMeta+view toggle 이관분) → 4.1 Editorial 3-up 그리드 → 4.2 카드 layout='vertical' → 4.3 Compact toggle → 4.4-4.6 EditorialInsert → 4.7-4.9 RescueBand + End-of-results → 4.10 Tier B 필터 + More(2.7) → 4.11 i18n. 카드 SHA `a931fe4e` 매 커밋 재검증 (call-site layout prop만 변경).**

**참고: B32로 B1(ivory+amber)이 site-native(파스텔 메시 + 반투명 화이트 + slate-900)로 번복됨. Phase 3 신규 컴포넌트도 site-native 톤. 단, ContextualVignetteBand의 destination accent(volcano teal 등 7색)는 B6 약속이라 유지 — accent는 컨텍스트 강조용이지 base 톤 아님.**

**Phase 1 종료 노트 (LCP)**: 사용자 "표지 격 통과" 시각 승인이 1차 게이트. LCP는 Lighthouse 정밀 측정 미실시 — hero는 Next/Image `priority` + `quality=88` + 자동 WebP 변환. 원본 jpg 2.0MB는 Next 최적화로 실제 전송은 훨씬 작음. Phase 6(모션 폴리시)에서 Lighthouse pass + 필요 시 소스 WebP 사전 변환 권장 (§D 후보).

---

## §B. 결정 로그 (binding)

각 행은 binding decision. 번복 시 새 행으로 추가 (삭제 금지, 이력 보존).

| # | 날짜 | 결정 | 이유 | 번복 |
|---|---|---|---|---|
| B1 | 2026-05-20 | **베이스 컬러 = ivory (`#faf8f3`) + amber 액센트.** slate-only 금지 | 허브 `/tours`(faf9f7 ivory) + 상세 페이지 색상 다이어트 정책과 가족 컬러. slate-only는 흑백 잡지 다운그레이드 신호 | **번복 (B32, 2026-05-20)** — 실제 사이트는 ivory+amber가 아니라 파스텔 메시 + 반투명 화이트 + slate-900 차콜 |
| B2 | 2026-05-20 | **카드(`TourListCard`) 시각 자산 일체 보존.** film grain·vignette·Vogue 필터(saturate 1.08 contrast 1.06)·warm shadow·spring tap·gradient — 전부 유지, 손대지 않음 | 카드는 이미 프리미엄. 작업 범위는 카드 *주변*(hero·rail·meta·insert·footer·empty) | — |
| B3 | 2026-05-20 | **Hero 필수 도입** (현재 0px). 240px → 스크롤 시 88px collapsing magazine cover. ken burns 16s | 허브와 같은 매거진 표지 DNA. list 단독 진입 시에도 "카탈로그 매거진" 약속이 즉시 보여야 함 | — |
| B4 | 2026-05-20 | **필터 필드 높이 h-8 → h-11.** 폰트 12px → 13.5px. border slate-200 → amber-200/70 | h-8/12px는 admin form 톤. 격을 올리려면 두께를 키워야 함 (메모리 룰 — 절대 "뺄셈" 아닌 "덧셈") | — |
| B5 | 2026-05-20 | **활성 필터 dismissible chip strip 신규.** rail 바로 아래, `bg-amber-50 border-amber-200/70 text-amber-900`. 각 칩 X 클릭 시 해당 필터만 해제. Clear all 우측 underline | 현재는 활성 필터가 select 안에 숨음 → control감 부재 | — |
| B6 | 2026-05-20 | **Destination별 액센트 컬러 약속을 list가 계승.** `TourCollectionStrip`의 `StripAccent`(signature/volcano/harbor/palace/ocean/temple/blossom) 재사용 — 신규 시스템 만들지 않음 | 허브가 약속한 컬러(Jeju=teal, Busan=indigo, Seoul=plum, Cruise=sky, Heritage=oxblood, Seasonal=blossom)를 list가 깨면 일관성 파탄 | — |
| B7 | 2026-05-20 | **Editorial 3-up vertical을 기본 view, Compact horizontal은 toggle.** 컨테이너 max-w-5xl(1024px) → max-w-[1320px] | 현재 horizontal-only는 search-result 톤. 매거진은 vertical 3-up이 정체성 | — |
| B8 | 2026-05-20 | **6번째 카드마다 Editorial Insert col-span-full.** Editor's Pick / In-season / Curator note 3종 로테이션 | 24개 동일 카드 반복은 큐레이션 신호 부재. 인서트로 시각 리듬 | — |
| B9 | 2026-05-20 | **Conversion Rescue Band는 28장 본 뒤만 등장** (`visibleCount >= 28`). 빌더 동선 분기 | 처음부터 노출하면 카탈로그 신뢰 약화. 충분히 봤는데 결정 못 한 사람에게만 | — |
| B10 | 2026-05-20 | **Empty state는 3-action recovery.** (a) 가장 제약 큰 필터 자동 감지·1개 해제 제안, (b) 빌더 이동, (c) 컨시어지 (WhatsApp/카톡). 단순 reset 버튼 1개 금지 | 현재 reset 단일 동선은 dead-end. 매거진은 우회로를 제시 | — |
| B11 | 2026-05-20 | **scroll-freeze 가드 (상세페이지 트라우마 적용).** 신규 scroll-linked 애니메이션·스택 backdrop-blur·신규 carousel 라이브러리·hero video·heavy IntersectionObserver layout read 금지. framer-motion + 기존 hub hero 패턴이 ceiling | 상세 페이지 §6 가드와 동일 — 회귀 방지 | — |
| B12 | 2026-05-20 | **신규 라이브러리 도입 금지.** carousel·bottom-sheet·virtual list 모두 framer-motion + 기존 IntersectionObserver 내에서 구현 | 번들·성능·일관성. 랜딩·상세·빌더 모두 같은 룰 | — |
| B13 | 2026-05-20 | **Tier B 필터 중 time/group/language는 Phase 5로 분리.** DB 컬럼 부재. Phase 1-4는 기존 API 필드(destination·tourType·sort·minPrice·maxPrice·features·durations)만 사용 | 백엔드 확장 없이 frontend가 "약속만 보여주고 동작 안 함"이면 신뢰 손상 | — |
| B14 | 2026-05-20 | **i18n 6 locale 동시 랜딩 의무화** (en/ko/zh/zh-TW/es/ja). 새 카피 추가 시 PR 단위로 6개 모두. `toursList.*` 네임스페이스에 적층 | 기존 `toursList.*` 키 베이스 6 locale 모두 존재. 깨면 i18n 회귀 | — |
| B15 | 2026-05-20 | **카드 자체 수정 시 별도 PR + 별도 결정 row 필요.** 이 플랜 범위는 카드 *외부* 표면. 만일 카드 수정이 불가피하면 §B에 reversal로 명시 후 진행 | B2 보호. 카드는 이미 검증된 자산, 부수 효과 위험 |  — |
| B16 | 2026-05-20 | **랜딩 페이지·상세 페이지의 binding decisions은 list에서도 자동 적용.** (a) amber eyebrow 유지, (b) 새 라이브러리 금지, (c) 색상 다이어트 정신 — list 전용 토큰도 brand/accent/success/danger/neutral + ivory/amber 액센트 가족 내에서만 | 페이지 간 일관성. 사이트 전체 디자인 시스템 위반 금지 | **부분 수정 (B32)** — "ivory/amber 액센트 가족"이 오해였음. 실제 사이트 = 파스텔 메시 + slate-900. rail/배경은 site-native, hero/footer만 amber 매거진 시그니처 |
| B17 | 2026-05-20 | **Phase 0 게이트 통과 전 Phase 1 시작 절대 금지.** §6.0 체크리스트 7개 모두 통과 + 사용자 승인 필수 | 코드 실사·토큰 정의·anti-downgrade 가드 확정 전 작업 시 다운그레이드 위험 |  — |
| B18 | 2026-05-20 | **italic 전면 금지 (§9 italic-serif 가족 약속 번복).** Catalogue hero/footer/모든 list 컴포넌트의 모든 className에서 `italic` 사용 금지. 대체 — 업라이트 serif (`font-serif font-light tracking-[-0.005em]` for display accent / `font-serif text-[11.5px] tracking-[0.02em]` for curator). 토큰 `LIST_DISPLAY_ACCENT_CLS` + `LIST_CURATOR_CLS` 갱신, `LIST_REQUIRED_TOKENS`에서 `'italic'` → `'font-serif'` 교체, `LIST_BANNED_TYPOGRAPHY = ['italic']` 추가. | 사용자 2026-05-20 직접 지시 — "italic 절대 금지, 다른 고급스런 폰트로". italic은 fashion-editorial 톤이지만 사용자 기준 catalogue에는 어울리지 않음. Kinfolk/Vogue cover 업라이트 serif가 premium 톤의 다른 길 (메모리 룰 `feedback_premium_default_enrichment.md` — enrichment 방향) | — |
| B19 | 2026-05-20 | **Hero 사진은 사용자 업로드 자산 사용 (`public/images/tours-list/catalogue-hero.png`).** Unsplash 외부 URL → 로컬 PNG. Next/Image `quality={88}`로 최적화. 대체 alt: "Korea tour catalogue cover — Hallasan framed by hydrangea and wisteria blooms" | 사용자가 2026-05-20에 직접 업로드 — Hallasan + 수국 + 등나무 (한국 여름·매거진 톤). 외부 Unsplash는 placeholder였음 | **번복 (B20, 2026-05-20)** — 한복 + 경복궁 사진으로 재교체 |
| B20 | 2026-05-20 | **Hero 사진 재교체 + 텍스트 가독 강화 (B19 1차 번복).** 사진 → `public/images/tours-list/catalogue-hero.jpg` (한복 + 경복궁, portrait). `object-position: top` — 하단 워터마크/바닥 회피, 팔레스 처마 + 하늘 우선. 텍스트 가독: bottom-half scrim `bg-gradient-to-t from-black/75 via-black/45`, top-third scrim `from-black/55`, 모든 텍스트에 `[text-shadow:0_*px_*px_rgba(0,0,0,0.7+)]` 추가. dark gradient `slate-950/40-30-75` → `slate-950/55-45-90` 상향. | 사용자 2026-05-20 두 번째 지시: "글씨 안 보여, 표지 둘째사진". 첫 사진(Hallasan)은 너무 밝아 white text 대비 부족. 한복+경복궁 사진도 비슷하게 밝지만 dark scrim 적층 + text-shadow로 가독 확보 가능. 워터마크 (xiaohongshu 소스) 우려 — `object-[center_top]`으로 시각적으로 회피 (영구 대응은 후속 photoshop) | **번복 (B21, 2026-05-20)** — 깨끗한 landscape 버전으로 재교체, crop 정상화 |
| B21 | 2026-05-20 | **Hero 사진 3번째 교체 — landscape 한복+경복궁 (B20 1차 번복).** `public/images/tours-list/catalogue-hero.jpg` 갱신 (2.05 MB, 16:9 가로). 워터마크 없음 → `object-position`을 `center top` → `center` 정상화. 텍스트 가독 강화(scrim×2 + text-shadow)는 B20 그대로 유지 (사진이 여전히 밝음). | 사용자 2026-05-20 3차 지시: "표지이거" + 새 landscape 사진 업로드. 같은 한복 모티프지만 가로 구도 + 워터마크 없음 — portrait crop workaround 불필요. 시각 가독 보강은 그대로 (사진 밝기 동일) | **부분 번복 (B22, 2026-05-20)** — scrim×2 제거, 사진 노출 강화 |
| B22 | 2026-05-20 | **Hero에 카드와 동일한 Vogue 필터 + 오버레이 적용 + 화보 톤 + 카피 아래로 (B20 scrim 일부 번복).** ① Image inline style `filter: saturate(1.08) contrast(1.06) brightness(0.99)` (카드 L158과 픽셀 동일). ② 카드 L161-170 film grain SVG fractalNoise baseFreq 0.9 / octaves 2 / stitchTiles + feColorMatrix 0.55 + opacity 0.12 + mix-blend-overlay 적용. ③ 카드 L171-178 soft vignette `radial-gradient ellipse at center, transparent 60%, rgba(0,0,0,0.15) 100%` 적용. ④ 무거운 dark gradient `slate-950/55-45-90` → `slate-950/10-transparent-35`로 가벼움. ⑤ 신규 scrim 2개 중 top scrim 삭제, bottom scrim `h-3/5 from-black/75 via-black/45` → `h-[42%] from-black/55 via-black/15`로 축소. ⑥ Display block padding `pb-6/8/10` → `pb-3/4/5` (카피 약간 아래로, Vogue cover deck 톤). ⑦ Bottom fade `h-12 from-[#faf8f3] via-[#faf8f3]/70` → `h-6 from-[#faf8f3] via-[#faf8f3]/50` (카피 위 ivory 침범 방지). ⑧ 텍스트 자체 text-shadow는 B20 그대로 유지 (contrast 보장). amber wash 0.22 → 0.18로 미세 완화. | 사용자 2026-05-20 4차 지시: "카드사진에 쓰인 필터랑 오버레이도 다. 적용, 프리미엄 화보느낌, 카피 조금 아래로, 사진 많이 가리지 말고". 핵심 — 사진을 매거진 화보처럼 노출하되, 텍스트 가독은 per-element text-shadow가 담당 (scrim 의존 줄임). 카드 필터를 hero에 박아서 hero ↔ 그리드 카드가 같은 톤·가족으로 묶임 (Vogue ad page → 매거진 spread 일관성) | **부분 번복 (B23, 2026-05-20)** — bottom scrim 강화, 흰 카피 가독 회복 |
| B23 | 2026-05-20 | **흰 카피 가독 회복 — bottom deck shadow 강화 (B22 scrim 축소 부분 번복).** ① bottom scrim `h-[42%] from-black/55 via-black/15` → `h-[58%] from-black/88 via-black/45` (매거진 cover deck shadow 톤). ② base dark gradient `slate-950/10-transparent-35` → `slate-950/8-transparent-30` (미세 완화). ③ Text shadow 3-stop 적층: h1 `0_2px_22px/0.95 + 0_1px_6px/0.85 + 0_0_2px/0.5`, sub `0_1px_10px/0.95 + 0_1px_3px/0.8`, curator `0_1px_8px/0.95 + 0_1px_2px/0.7`. ④ curator color `white/90` → `white` (가장 가독성 우선), curator rule `white/60` → `white/70`. **상단 60% 사진 깨끗 유지** (Vogue cover 컨벤션: photo top half pure, deck text bottom half). | 사용자 2026-05-20 5차 지시: "카피가 흰색이라 글씨 한개도 안 보여". B22에서 scrim을 너무 줄여 한복+stone 위 흰 카피 illegible. 매거진 cover 표준: 상단 = photo pure, 하단 = 강한 deck shadow + 흰 카피. text color 변경 X (premium 톤 일관성) — scrim + text-shadow가 contrast 담당. | **전면 번복 (B24, 2026-05-20)** — text color 완전 dark warm로 전환, deck shadow 검정→크림 반전 |
| B24 | 2026-05-20 | **텍스트 컬러 전면 dark warm 전환 + cream deck wash (Kinfolk/Cereal 톤).** 사용자 6차 지시: "글씨 자체를 어두운색으로 고급지게 표현". 흰 텍스트 + dark scrim → 어두운 warm 텍스트 + cream/ivory deck wash로 컬러 시스템 전면 반전. ① bottom deck wash `h-[58%] from-black/88 via-black/45` → `h-[55%] from-[#faf8f3]/82 via-[#faf8f3]/38` (검정→크림, 동일 위치). ② atmosphere gradient `slate-950/8-transparent-30` → `amber-950/5-transparent-12` (cold→warm). amber wash radial 0.18 → 0.14 (미세). ③ 모든 텍스트 color: white → dark warm — masthead amber-200→amber-900, h1 white→stone-950, h1 accent amber-100→amber-800, sub white→stone-800, curator white→amber-900, curator rule white/70→amber-700/65. ④ Count badge 재skin — bg-amber-900/40 text-amber-100 → bg-[#faf8f3]/85 text-amber-900 + cream pill + amber dot. ⑤ Text-shadow halo flip — 검정 halo → cream/white halo: `0_1px_2px_rgba(255,255,255,0.95) + 0_0_*px_rgba(255,252,240,0.5-0.7)` (글씨 주변 cream press-print 후광). | 사용자 6차 지시. dark warm text는 premium magazine 본질 — Kinfolk·Cereal·Apartamento·Toiletpaper 모두 흰 photo 위 dark stone/amber 톤. white-on-dark은 화보 톤이지만 hanbok+stone 같은 bright photo에선 contrast 불가. dark warm + cream halo는 "press-print on paper" 효과 → 진정한 화보 격. text color 변경 = §9 가족 약속 ("white-on-photo")이 list에서 깨짐 — list 전용 dark text 가족 신설. | — |
| B25 | 2026-05-20 | **한글 매거진 명조 폰트 적용 — Noto Serif KR (본명조).** 사용자 7차 지시: "한글폰트". `app/layout.tsx` Google Fonts link에 `Noto+Serif+KR:wght@300;400;500;600;700;900` 추가. `app/globals.css`에 `.font-magazine-serif-ko { font-family: "Noto Serif KR", "Cormorant Garamond", Georgia, "Times New Roman", serif; font-feature-settings: ... }` 추가. CatalogueHero h1/sub/curator 모두 `font-magazine-serif-ko` 적용 — 한글은 본명조, 라틴 (h1 accent + curator)은 Cormorant Garamond → Georgia fallback. h1 tracking `-0.03em` → `-0.025em` (명조 가독 조정). sub size `text-[12.5/13.5]` → `text-[13/14]` (명조 더 큰 weight 필요). curator weight `normal` → `medium`, size `text-[10.5/11.5]` → `text-[11/12]`. | 사용자 7차 지시. 현재 한글 = Pretendard sans-bold = 평범. 매거진 표지 (Vogue Korea / Bazaar Korea / Kinfolk Korea) 약속 = 본명조. Noto Serif KR (Source Han Serif KR equivalent) Google Fonts 무료 + unicode-range로 한국어 visitor만 다운로드. **scope = catalogue only** — 다른 페이지(landing/hub/detail)는 §B reversal 없이 확장 금지. | — |
| B26 | 2026-05-20 | **text-deck-left + subject-right cover layout (B24 bottom wash 전면 번복).** 사용자 8차 진단 + 지시: "2014 빼라" + "글씨 잘 안 보이지? 배경이랑 겹쳐서? 해결방법 자세히 생각해봐". 진단: B24 bottom horizontal wash는 텍스트가 가로로 펴져 우측 한복(밝은 cream/pink)과 겹쳐 illegible. 어떤 cream halo도 dancer body 위에서 못 살림 → 근본 해결 = 텍스트를 dancer 영역에서 격리. ① bottom wash `h-[55%] from-[#faf8f3]/82` 삭제. ② LEFT 세로 wash 신규 — 90deg multi-stop linear-gradient: `0%: rgba(250,248,243,0.92)` → `28%: 0.72` → `52%: 0.38` → `70%: 0.12` → `82%+: transparent`. left 0-30%까지 cream solid, dancer (~70%부터) 사진 그대로. ③ 텍스트 컨테이너 `max-w-[820px]` → `max-w-[78%] sm:max-w-[58%] lg:max-w-[50%]`. 자연 줄바꿈, 카피가 사진 우측으로 안 흐름. ④ heroCurator i18n 6 locale 카피 `Edited from Seoul, since 2014` → `Edited from Seoul` (모든 locale 동일). 36→30 entry. Vogue Korea / Bazaar / Numéro 표지 컨벤션: text deck 좌측, model/subject 우측. | 사용자 8차 진단의 정확성 — bottom horizontal cream은 dancer right-half과 충돌 불가피. 매거진 cover layout은 본질적으로 "type column + subject column" 2-column. 좌측 type column에 cream wash를 가두고 텍스트 폭을 거기 맞추면 contrast 문제가 구조적으로 해결됨 (halo 의존 X). "since 2014"는 magazine convention "Edited from {city}" 으로 충분, 연도는 footer strip (Curated by KR team)에서 다룸 — 중복 제거. | **부분 번복 (B27, 2026-05-20)** — wide viewport max-w 누수 fix |
| B27 | 2026-05-20 | **wide-viewport h1 누수 fix — hard-pixel max-w + 명시적 br (B26 max-w-% leak 보강).** 사용자 9차 진단 (스크린샷 첨부): "이번엔 이 카피 오른쪽이 겹쳐서 안 보이는데?". 진단: B26 `max-w-[50%]`만으로는 ≥1700px wide viewport에서 h1 "The Catalogue, every tour, hand-picked." 전체(~38자)가 한 줄에 들어가 wrap 안 됨 → 우측 hand-picked. 한복 위로 흘러 illegible. 해결: ① 텍스트 컨테이너 max-w `78/58/50%` → `92%/64%/500px(hard cap)`. lg는 픽셀값 hard cap으로 viewport 무관 보장. ② h1에 명시적 `<br />` 삽입 — heroAccent를 항상 새 줄에서 시작 (어떤 viewport에서도 1줄 못 됨). ③ LEFT wash width 매칭: `w-[96%] sm:w-[68%] lg:w-[540px]` (텍스트보다 40px 넉넉 = halo 여유). ④ wash gradient stops 재조정: `0% cream/92 → 45% cream/88 → 72% cream/55 → 90% cream/18 → 100% transparent` — 첫 45%는 거의 solid cream (정확한 텍스트 배경). ⑤ h1 font size 26/34/40 → 24/30/36 (2줄로 늘어났으니 약간 줄임). h1 line-height 1.05 → 1.12 (2줄 간격). | 사용자 9차 진단. B26은 좋은 방향이었지만 % bound는 wide-viewport corner case에서 누수. 픽셀 hard cap + 명시적 br는 viewport-invariant 보장 (반응형 변동 가능성 0). 매거진 cover h1은 보통 2-3 줄로 layered — 한 줄 long line은 search-result 톤. | **부분 번복 (B28, 2026-05-20)** — 강제 br + 큰 폰트가 Vogue Korea 흐름 깸 |
| B28 | 2026-05-20 | **자연 wrap + 폰트 축소 — Vogue Korea 흐름 복원 (B27 강제 br 번복).** 사용자 10차 지시: "제목 포함 카피를 첫째 스크린샷처럼 그냥 왼쪽에 자연스럽게 가두면 안돼? 카피 폰트 좀 줄여갖고. 지금 폰트 너무 커지고 아까 코리아보그 그 스타일 없어졌어 그게 좋은데". 해결: ① h1 강제 `<br />` 제거 → `{heroTitle}{' '}<span>{heroAccent}</span>` 자연 inline flow. ② h1 font size 24/30/36 → **19/22/26** (대폭 축소, B25 refined 톤). ③ h1 line-height 1.12 → 1.26 (자연 multi-line 호흡). ④ max-w `92%/64%/500px` → `88%/56%/420px` (작은 폰트에 맞춰 tighter — 자연 word-boundary wrap). ⑤ sub font `13/14` → `11.5/12.5`, curator `11/12` → `10/11` (전체 축소). ⑥ 요소 간 mt `2/2.5·2/3` → `1.5/2·1.5/2.5` (작은 폰트에 맞춰 tighter spacing). ⑦ wash width `96%/68%/540px` → `92%/60%/460px` 매칭. | 사용자 10차 — B27 강제 br는 contrast는 풀었지만 "stacked banner" 톤이 되어 B25의 elegant Vogue Korea flowing deck 느낌을 잃음. 작은 refined serif + 자연 wrap = 진짜 코리아보그 cover 톤 (큰 글자 1-2줄 banner ≠ 매거진 deck). 작은 폰트면 max-w 안에서 자연 줄바꿈해도 우측 안 침범. | **추가 조정 (B29, 2026-05-20)** — 흰 패널 또렷 + 폰트 더 축소 |
| B29 | 2026-05-20 | **흰색 cream 패널 또렷화 + 카피 패널 안으로 (B28 미세 보강).** 사용자 11차 지시: "아까 했던 왼쪽이 하얗게 된 필터 그거 씌우고 카피들 사이즈 확 줄여서 그 흰색 필터 안에 넣으라고". ① LEFT wash gradient를 더 solid 패널로 — `0%/0.95 → 62%/0.93 (near-solid) → 82%/0.70 → 94%/0.26 → transparent`. 첫 62%가 거의 불투명 cream (또렷한 패널). wash width `92%/60%/460px` → `88%/56%/440px`. ② 카피 폰트 확 축소: h1 `19/22/26` → **15/17/20**, sub `11.5/12.5` → **10/11**, curator `10/11` → **9/9.5**. ③ max-w `88%/56%/420px` → `80%/50%/360px` (패널 solid 영역 안에 완전히 nest). ④ h1 line-height 1.26 → 1.3, text-shadow halo 미세 약화 (작은 글자라 과한 halo 불필요). curator rule w-6 → w-5. | 사용자 11차 — "흰색 필터 또렷하게 + 카피 그 안에". 핵심: 패널을 명확한 cream surface로 만들고 (gradient 약한 fade 아닌 solid 60%+), 작은 editorial deck 텍스트가 그 패널 안에 완전히 들어가게. 큰 글자 + 약한 wash = 사진과 충돌, 작은 글자 + 또렷 패널 = 진짜 매거진 deck box 톤. | **wash 부분 번복 (B30, 2026-05-20)** — solid 패널 → 자연 그라데이션 |
| B30 | 2026-05-20 | **자연 single-layer 오버레이 복구 (B29 solid 패널 wash 번복, B26 wash 복원).** 사용자 12차 지시: "두세 대화 전 사진 왼쪽 부분에 흰색 오버레이 한층 자연스럽게 씌운 적 있잖아 그거 복구". B29의 또렷한 solid 패널(첫 62% near-opaque)이 boxy하게 읽힘 → B26의 부드러운 연속 fade로 복원. wash `inset-y-0 left-0 w-[88%/56%/440px]` + `0%/0.95 → 62%/0.93 → 82%/0.70 → 94%/0.26 → transparent` (solid 패널) → **`inset-y-0 left-0 right-0` (full-width) + `0%/0.92 → 28%/0.72 → 52%/0.38 → 70%/0.12 → 82%/transparent`** (B26 연속 smooth fade). **카피 폰트(B29: 15/17/20)·max-w·spacing은 그대로 유지** — 오버레이만 자연스러운 버전으로 교체. | 사용자 12차 — solid 패널은 "필터" 의도와 달리 박스처럼 boxy. B26 연속 fade가 사진에 organic하게 녹아들면서 좌측 작은 카피는 여전히 cream 위에 앉음. wash만 교체, 작은 폰트는 유지 (B29 폰트 OK). | — |
| B31 | 2026-05-20 | **Hero 큐레이터 라인 ("Edited from Seoul") 제거.** 사용자 13차 지시: "edited from seoul 이거도 지워". CatalogueHero에서 큐레이터 `<p>` + `heroCurator` const 삭제. hero는 이제 masthead(Issue·Spring) + h1(title+accent) + sub 3요소만. 큐레이터 시그니처는 footer strip(`footerCuratorLine`)에만 존재. `toursList.heroCurator` i18n 키는 보존 (재사용 대비, dead 아님). | 사용자 13차 — hero가 더 간결해짐. 큐레이터 시그니처는 footer에서 한 번이면 충분 (hero+footer 중복 제거). B26에서 "since 2014" 뺀 것의 연장선. | — |
| B32 | 2026-05-20 | **B1 전면 번복 — list 배경/rail/액센트를 site-native(파스텔 메시 + 반투명 화이트 + slate-900)로.** 사용자 14차 지시 + AskUserQuestion 3답: "아이보리 배경도 별로 브라운도 별로, 메인페이지·리스트 전체톤에 안 맞아" → ①배경=중립 화이트(메시 약하게), ②액센트=사이트 동일 slate-900 차콜, ③Hero=그대로 유지. **코드 실사 결과**: `body::before` 파스텔 메시(peach `rgba(255,237,213)` + sky `191,219,254` + lavender `221,214,254` + mint `187,247,208` on `#fffaf6→#f7fbff→#fbf7ff`), SitePageShell `bg-transparent`, 랜딩 매처 칩 `bg-slate-900 text-white`. ivory `#faf8f3`는 이 메시를 덮고 amber-900은 차콜 톤과 충돌. **수정**: (a) `app/tours/list/page.tsx` main `bg-[#faf8f3]` → `bg-white/55` (메시 약하게 비침). (b) rail 토큰(`LIST_RAIL_BG/BORDER/SHADOW_WARM`·`LIST_FIELD_CLS`·`LIST_SELECT_CLS`·`LIST_CHIP_ACTIVE/INACTIVE`)을 amber → 반투명 화이트 + slate-900으로. (c) page.tsx 인라인 amber(eyebrow/divider/reset/apply/mobile chip/refetch)를 slate/neutral로. (d) `LIST_FORBIDDEN_TOKENS`에서 slate-900 제거(이제 액센트), `LIST_REQUIRED_TOKENS` amber→slate 갱신. **Hero(inline amber)·footer(amber 토큰 EYEBROW/CURATOR/DISPLAY)는 매거진 시그니처로 유지** (사용자 "Hero 그대로"). | 사용자 정확한 진단 — B1(ivory+amber)이 처음부터 실제 사이트 톤 오해였음. 진짜 가족 컬러 = 파스텔 메시 + slate-900. 업그레이드의 본질은 컬러(ivory+amber)가 아니라 구조(h-11·spacing·segmented·dismissible chip·hero). 컬러는 site-native, 구조만 격상. Hero는 warm 매거진 cover로 별개 유지 (cover warm + body neutral은 정상 매거진 패턴) | — |

---

## §C. 변경 로그

Phase 진행 시 한 줄씩 추가. 커밋 단위.

| 날짜 | 항목 | 커밋 | 비고 |
|---|---|---|---|
| 2026-05-20 | **Phase 3.2/3.3 — ContextualVignetteBand (destination 7-accent, B6).** mapContextToAccent+ACCENT(lib/tours-hub-accents) 활용. destination/feature 컨텍스트에서만 등장, accent 그라데이션 rule + 틴트 eyebrow + reset. base는 site-native, accent는 컨텍스트 강조. i18n 6 locale 2키. | b707eeaa | Jeju→teal 등 7-accent 계승. 카드 SHA `a931fe4e` |
| 2026-05-20 | **Phase 3.6/3.7/3.8 — EmptyStateRecovery 3-action (B10).** (a) 최제약 필터 자동 감지·해제(휴리스틱 price>dest>features>type>search), (b) /itinerary-builder, (c) /support 컨시어지. page.tsx empty 브랜치 교체. i18n 6 locale 5키. 3.4/3.5(ResultsMeta+view toggle)는 Phase 4 이관. | 31dcef0e | Phase 3 코어 완료. 카드 SHA `a931fe4e` |
| 2026-05-20 | **Phase 4.0–4.9 — Editorial Grid + view toggle + Insert + Rescue Band.** 4.0 ResultsMetaStrip(count 제외) + view toggle(localStorage). 4.1/4.2/4.3 Editorial 3-up(vertical, max-w-1320) ↔ Compact 2-up, 카드 layout prop만 변경(SHA 유지). 4.4/4.5/4.6 EditorialInsert 3변형 6/12/18 슬롯(B8). 4.7/4.8/4.9 ConversionRescueBand(visibleCount>=28, B9) + End-of-results 시그니처. i18n 6 locale 다수 키. | 9e218a1e · 7c0e882f · 70f965ba | Phase 4 ✅ acceptance(그리드 리듬·rescue 28+·view toggle·카드 diff 0) 충족. **4.10 Tier B 필터(Duration/Features)+More(2.7)는 durations API 계약 확인 필요 — 별도 진행.** 카드 SHA `a931fe4e` |
| 2026-05-20 | **Phase 3 ✅ + Phase 4 시작 (planner-first).** 사용자 "계속" 진행. Phase 3 acceptance: Jeju teal band · empty 3-action · 카드 diff 0 (3.4/3.5는 Phase 4 이관). Phase 4 (Editorial Grid + view toggle + Insert + Rescue Band + Tier B) 🔄. | (pending) | 카드 layout='vertical'은 call-site prop만 변경 (B2/B15 허용 — 카드 파일 SHA 유지). §6.4 4.0→4.11 |
| 2026-05-20 | 마스터 플랜 v1 작성 | (pending) | `docs/tours-list-uiux-master-plan-2026-05-20.md` + `.claude/skills/tours-list-uiux/SKILL.md` + MEMORY.md pointer |
| 2026-05-20 | Phase 0 시작 — §A 🔄 / §C entry / planner-first 커밋 | 3525e2b0 | sub-task 0.1 → 0.7 순차 실행 |
| 2026-05-20 | Phase 0.1 ✅ — StripAccent + ACCENT + mapContextToAccent를 lib/tours-hub-accents로 추출. TourCollectionStrip은 새 lib에서 import + StripAccent re-export로 기존 call site 보존 | c3160d2e | `npx tsc --noEmit -p . → errors 0`. B6 (7-accent 약속) 기술적 전제 마련 |
| 2026-05-20 | Phase 0.2 ✅ — lib/tours-list-tokens.ts 신규 (15 토큰 상수 + LIST_FORBIDDEN_TOKENS + LIST_REQUIRED_TOKENS) | a15536f4 | §5 토큰 단일 출처화. B1 grep enforcement 베이스. type-check clean |
| 2026-05-20 | Phase 0.4 ✅ — i18n Phase 1 카피 6 locale × 6 키 = 36 entry 동시 추가 (heroIssue/heroTitle/heroAccent/heroSub/heroCurator/footerCuratorLine) | 61e74569 | B14 의무 준수. 6/6 locale 모두 신규 키 6/6 검증 통과 (node -e require parse) |
| 2026-05-20 | Phase 0.3 ✅ — SkeletonGrid ivory(#faf8f3) sanity 검증 (class 분석 방식) | (no commit, verification) | SkeletonGrid는 `bg-white/95` 카드 + `bg-slate-200/70` shimmer. 95% 흰색이 ivory 위에서 살짝 따뜻한 오프-화이트 카드 → 시각 회귀 없음. Phase 1 ivory 전환 시 SkeletonGrid 수정 불필요 |
| 2026-05-20 | Phase 0.5 ✅ — scroll-freeze FPS baseline 기록 | (no commit, baseline) | 현재 ceiling: 단일 backdrop-blur-md (rail 1개 + 카드 wishlist 버튼 1개), 스택 없음. 60fps 기대치. Phase 6 ✅ 시 동등 또는 우수 측정 의무 |
| 2026-05-20 | Phase 0.6 ✅ — TourListCard baseline (B2 보호용) source-level 캡처 | (no commit, baseline) | **SHA1: a931fe4e8de9d02e3af235690ca78d86f8c089f9** / 347 줄 / 17358 byte. 핵심 시각 시그니처 9개 라인 박제: L102-103 spring 560/22 · L113-119 whileTap brightness 0.94 · L127 root border + 1.6rem radius + 흰색 gradient + warm shadow · L128 hover blue-200 ring · L130 motion-reduce guard · L158 Vogue 필터 saturate 1.08 contrast 1.06 brightness 0.99 · L161-170 film grain SVG fractalNoise baseFreq 0.9 + feColorMatrix 0.55 + opacity 0.12 · L171-178 vignette radial-gradient 0.15. **Phase 1-4 ✅ 시 `git hash-object components/tour/TourListCard.tsx`로 동일 SHA 검증** → 이게 변하면 B2 위반 자동 감지 |
| 2026-05-20 | Phase 0.6 우회 — preview 탭 background visibility로 screenshot 30s timeout. SHA + 시각 시그니처 라인 박제로 더 엄격하게 baseline 확보 (screenshot은 JPEG 압축 노이즈로 byte-exact diff 불가능, SHA는 픽셀-정확) | — | preview MCP 한계 → source-level approach. 결과적으로 B2 검증이 강화됨 |
| 2026-05-20 | Phase 0 ✅ — 7/7 sub-task 모두 통과. 사용자 "Phase 1 진입 승인" 대기 | 61e74569 | 다음: 사용자 승인 후 Phase 1 (Catalogue Hero + Footer Strip) §6.1 진입 |
| 2026-05-20 | Phase 0 게이트 문서화 — Phase 1 진입 사용자 승인 완료 (사용자 "이어서 진행해줘" 메시지) | 649956fd | docs(tours-list): Phase 0 게이트 7/7 통과 — Phase 1 승인 대기 |
| 2026-05-20 | Phase 1 시작 — §A 🔄 / §C entry / planner-first 커밋. sub-task 1.1 → 1.8 순차 실행 | 0f48744b | 카드 baseline SHA `a931fe4e8de9d02e3af235690ca78d86f8c089f9` 재확인 (Phase 0.6 baseline 일치). framer-motion ^12.38.0 확인 — useScroll + useTransform 사용 가능 |
| 2026-05-20 | Phase 1.1–1.7 ✅ — Catalogue Hero (240→88) + Footer Strip 코드 완료. page.tsx ivory(#faf8f3) 전환 + 단일 sticky parent로 hero+filter rail wrap (collapse window overlap 방지) | 6ef3cb21 | components/tours-list/CatalogueHero.tsx (147L) + CatalogueFooterStrip.tsx (45L) 신규. page.tsx 13 line edited. **검증 결과**: 카드 SHA `a931fe4e` 유지 (0 touch) · slate-200/900 grep in components/tours-list/ = 0 · amber/ivory/italic 토큰 11 occurrence · type-check clean · next build --webpack /tours/list 정상 컴파일 |
| 2026-05-20 | Phase 1.8 ✅ — i18n 6 locale × 6 키 = 36 entry 재검증 (Phase 0.4 적층분 100% 사용, MISSING 0) | (verification only) | node script: `i18n gate: 36 present / 0 missing (target 36)` — heroIssue/heroTitle/heroAccent/heroSub/heroCurator/footerCuratorLine × en/ko/zh/zh-TW/es/ja |
| 2026-05-20 | Phase 1 코드 완료 — 사용자 "표지 격 통과" 시각 확인 대기 (240/200px 매거진 cover + 88px collapse + ken burns + amber wash + 큐레이터 시그니처 + 풀블리드 사진). LCP/CLS 측정은 사용자 dev 환경 확인 후 §C 보강 예정 | (pending acceptance) | 사용자가 `/tours/list`에서 hero 표시·collapse·atmosphere·footer strip 시각 합격 시 §A Phase 1 ✅ 마킹 |
| 2026-05-20 | **B18 + B19 §B reversal — italic 전면 금지 + hero 사진 교체.** 사용자 직접 지시: "표지 사진은 이걸로(업로드), 폰트는 italic 절대 금지, 다른 고급스런 폰트로". Catalogue 전체에서 italic 제거 (CatalogueHero.tsx · CatalogueFooterStrip.tsx · lib/tours-list-tokens.ts: `LIST_DISPLAY_ACCENT_CLS` `LIST_CURATOR_CLS` 토큰 갱신, `LIST_BANNED_TYPOGRAPHY` 신규). Hero 사진 → public/images/tours-list/catalogue-hero.png (Hallasan + 수국 + 등나무). §9 가족 약속 표에 list italic ~~strikethrough~~ + B18 참조 | 16c09703 | 다른 페이지 (허브 hero "hand-picked." 등) italic은 그대로 유지. type-check clean. 카드 SHA `a931fe4e` 여전히 유지 (0 touch) |
| 2026-05-20 | **B20 §B reversal — hero 사진 재교체 + 텍스트 가독 강화.** 사용자 2차 지시: "글씨 안 보여, 표지 둘째사진". 사진 png → jpg (한복 + 경복궁 1.13MB). `object-position: center top`으로 하단 워터마크 회피. atmosphere dark gradient `/55-/45-/90` 상향 + 2개 신규 scrim (bottom-3/5 from-black/75, top-1/3 from-black/55). 모든 텍스트(masthead/h1/sub/curator)에 `[text-shadow:0_*_*_rgba(0,0,0,0.7+)]` 추가. amber-100 + white/90 (75→90)으로 contrast 보강 | 7aac3484 | type-check clean. 카드 SHA `a931fe4e` 유지 (0 touch) |
| 2026-05-20 | **B21 §B reversal — hero 사진 3번째 교체 (landscape, 워터마크 없음).** 사용자 3차 지시: "표지이거" + 새 landscape 한복+경복궁 사진 업로드 (2.05 MB, 16:9). object-position `center top` → `center` 정상화 (워터마크 회피 workaround 해제). 텍스트 가독 강화(scrim×2 + text-shadow)는 B20 그대로 유지 — 사진 밝기 비슷하므로 동일 보호 필요 | 6dac0c7d | type-check clean. 카드 SHA `a931fe4e` 유지 (0 touch) |
| 2026-05-20 | **B22 §B reversal — 카드 Vogue 필터·film grain·vignette를 hero에 박음 + 카피 아래로 + 사진 노출 강화.** 사용자 4차 지시: "카드사진에 쓰인 필터랑 오버레이도 다. 적용, 프리미엄 화보느낌, 카피 조금 아래로, 사진 많이 가리지 말고". CatalogueHero.tsx: Image `style={{ filter: 'saturate(1.08) contrast(1.06) brightness(0.99)' }}` (카드 L158 동일) + film grain SVG (카드 L161-170 동일) + soft vignette (카드 L171-178 동일). 무거운 dark gradient·top scrim·heavy bottom scrim 제거 → `slate-950/10-transparent-35` + `h-[42%] from-black/55 via-black/15`로 가벼움. Display block pb-6/8/10 → pb-3/4/5. Bottom fade h-12 → h-6. 텍스트 text-shadow는 B20 그대로. | 5cd67d18 | hero 사진 ↔ 그리드 카드가 동일한 Vogue 필터·grain·vignette로 묶여 매거진 spread 일관성. type-check clean. 카드 SHA `a931fe4e` 유지 (B2 0 touch — 카드 코드 인용은 했지만 파일은 안 건드림). italic className 여전히 0 (B18 유지). |
| 2026-05-20 | **B23 §B reversal — 흰 카피 가독 회복 (Vogue cover deck shadow).** 사용자 5차 지시: "카피가 흰색이라 글씨 한개도 안 보여". B22 scrim 축소가 너무 과해 흰 텍스트가 한복+stone 밝은 부분 위에서 illegible. bottom scrim `h-[42%] from-black/55 via-black/15` → `h-[58%] from-black/88 via-black/45` (강한 deck shadow, 상단 60% 사진은 그대로 깨끗). text-shadow 3-stop layered로 강화 (모든 텍스트). curator color white/90 → white. base dark gradient 미세 완화 (slate-950/10 → /8). Vogue cover convention 정착: 상단 = photo pure, 하단 = deck text + shadow. | 6aa17661 | type-check clean. 카드 SHA `a931fe4e` 유지 (B2 0 touch). italic className = 0 (B18 유지). |
| 2026-05-20 | **B24 §B reversal — dark warm 텍스트 + cream deck wash 전면 전환 (Kinfolk/Cereal 톤).** 사용자 6차 지시: "글씨 자체를 어두운색으로 고급지게 표현". white-on-dark scrim → dark-warm-on-cream-wash 컬러 시스템 전면 반전. ① bottom deck wash `from-black/88` → `from-[#faf8f3]/82` (검정→크림 동일 위치). ② atmosphere gradient slate-950 → amber-950 (cold→warm). ③ masthead amber-200→amber-900, h1 white→stone-950, h1 accent amber-100→amber-800, sub white→stone-800, curator white→amber-900, curator rule amber-700/65. ④ count badge bg-amber-900/40 text-amber-100 → bg-[#faf8f3]/85 text-amber-900 + cream pill. ⑤ text-shadow halo 검정→크림: `rgba(255,255,255,0.95) + rgba(255,252,240,0.5-0.7)` (cream press-print 후광). | b51ca07d | type-check clean. 카드 SHA `a931fe4e` 유지. italic className = 0. **§9 가족 약속 일부 list 전용으로 분기** — 다른 페이지(허브/상세) white-on-photo는 그대로 유지, list만 dark warm text 가족. |
| 2026-05-20 | **B25 §B reversal — Noto Serif KR (본명조) 적용.** 사용자 7차 지시: "한글폰트". app/layout.tsx Google Fonts link에 `Noto+Serif+KR` 추가. app/globals.css에 `.font-magazine-serif-ko { font-family: 'Noto Serif KR', 'Cormorant Garamond', Georgia, serif; ... }` 추가. CatalogueHero h1/sub/curator에 `font-magazine-serif-ko` 적용. h1 tracking -0.03 → -0.025 (명조 가독). sub/curator size 상향 (명조는 큰 weight 필요). | 2f0c2d8f | type-check clean. 카드 SHA `a931fe4e` 유지. italic className = 0. scope = catalogue 전용 (Phase 2-4 surfaces 재사용 가능). |
| 2026-05-20 | **B26 §B reversal — text-deck-left + subject-right cover layout + 'since 2014' 제거.** 사용자 8차 진단 (스크린샷 첨부) + 지시. 진단: B24 bottom horizontal cream wash가 우측 한복 영역에서 illegible — halo로도 못 살림. 해결: LEFT 세로 90deg multi-stop wash (0%cream92→82%transparent) + 텍스트 max-w `78/58/50%`로 좁힘 → 텍스트는 좌측 type column, dancer는 우측 그대로 노출 (Vogue Korea / Bazaar 표지 컨벤션). 동시에 `heroCurator` 6 locale 카피 `Edited from Seoul, since 2014` → `Edited from Seoul` (총 30 entry 갱신). | 1459eef0 | type-check clean. 카드 SHA `a931fe4e` 유지. italic className = 0. i18n 6/6 검증 통과 (Edited from Seoul). |
| 2026-05-20 | **B27 §B reversal — wide-viewport h1 누수 fix (B26 max-w-% leak 보강).** 사용자 9차 진단 (스크린샷): "이번엔 이 카피 오른쪽이 겹쳐서 안 보이는데?". 진단: max-w-[50%]가 ≥1700px viewport에서 h1 전체(~38자)가 한 줄에 들어가 wrap 안 됨 → 우측 hand-picked가 한복 위로 흘러 illegible. 해결: ① max-w `78/58/50%` → `92%/64%/500px(픽셀 hard cap)`. ② h1에 명시적 `<br />` 삽입 (heroAccent를 새 줄에서 시작). ③ wash width 매칭 `96%/68%/540px`. ④ wash gradient stops 재조정 (첫 45% solid cream). ⑤ h1 font 26/34/40 → 24/30/36, line-height 1.05 → 1.12 (2줄 간격). | 5771fddf | type-check clean. 카드 SHA `a931fe4e` 유지. italic className = 0. 픽셀 hard cap + br로 viewport-invariant 보장. |
| 2026-05-20 | **B28 §B reversal — 자연 wrap + 폰트 축소 (Vogue Korea 흐름 복원).** 사용자 10차 지시: "제목 포함 카피를 그냥 왼쪽에 자연스럽게 가두면 안돼? 폰트 좀 줄여. 지금 폰트 너무 커지고 아까 코리아보그 스타일 없어졌어 그게 좋은데". B27 강제 br + 큰 폰트가 stacked banner 톤 되어 B25 elegant flow 잃음. 해결: ① h1 강제 br 제거 → 자연 inline flow. ② h1 font 24/30/36 → 19/22/26 (대폭 축소). ③ line-height 1.12 → 1.26. ④ max-w `92%/64%/500px` → `88%/56%/420px`. ⑤ sub 13/14 → 11.5/12.5, curator 11/12 → 10/11. ⑥ 요소 간격 tighter. ⑦ wash width `96%/68%/540px` → `92%/60%/460px`. | b80b575f | type-check clean. 카드 SHA `a931fe4e` 유지. italic = 0. 작은 refined serif + 자연 wrap = 진짜 코리아보그 deck 톤. |
| 2026-05-20 | **B29 — 흰색 패널 또렷화 + 카피 확 축소.** 사용자 11차. wash solid 패널(0.95/62% near-opaque) + 폰트 15/17/20·10/11·9/9.5 + max-w 80%/50%/360px. | 484193bb | type-check clean. 카드 SHA 유지. italic 0. |
| 2026-05-20 | **B30 — 자연 single-layer 오버레이 복구 (B26 wash).** 사용자 12차: "자연스럽게 씌운 흰색 오버레이 복구". solid 패널 → full-width 연속 fade (0.92→0.72→0.38→0.12→투명@82%). 폰트는 B29 유지. | a1942b86 | type-check clean. 카드 SHA 유지. italic 0. |
| 2026-05-20 | **Phase 2 ✅ 완료 + Phase 3 시작 (planner-first).** Phase 2 (Sticky Filter Rail 격상): 2.1/2.2/2.3/2.4/2.5/2.6/2.8/2.9/2.10 완료, 2.7(More)은 Phase 4.10(Tier B 필터)로 이관. B32로 site-native(반투명 화이트+slate-900) 전환. acceptance: amber-900 grep=0 · 카드 SHA `a931fe4e` · ActiveFilterStrip dismissible · 모바일 drawer 0.3s · type-check clean · 사용자 모바일 확인. Phase 3 (Contextual Vignette Band + Results Meta + Empty State) 🔄 진입. | 407aa8e2 | §D에 2.7 등록. Phase 3 §6.3 sub-task 3.1→3.9 |
| 2026-05-20 | **B31 — Hero 큐레이터 라인 제거.** 사용자 13차: "edited from seoul 이것도 지워". CatalogueHero에서 큐레이터 `<p>` + heroCurator const 삭제. hero = masthead + h1 + sub 3요소만. 큐레이터 시그니처는 footer strip에만. heroCurator i18n 키는 보존. | 2d3041f2 | type-check clean. 카드 SHA `a931fe4e` 유지. italic = 0. |
| 2026-05-20 | **Phase 1 ✅ 완료 — 사용자 "좋아 완벽해" 표지 격 통과.** Catalogue Hero (240→88 collapse, 한복+경복궁 사진, dark warm Kinfolk 톤, Noto Serif KR 본명조, text-deck-left + 자연 cream 오버레이, masthead+h1+sub 3요소) + Footer Strip. B18-B31 사용자 직접 디자인 반복 14회 반영. acceptance: 카드 SHA `a931fe4e` 변경 0 (B2) · slate grep 0 (B1) · i18n 6/6 (B14) · type-check clean. | 2d3041f2 | LCP Lighthouse 미측정 (Phase 6로 이월). 사용자 시각 승인이 1차 게이트 통과 |
| 2026-05-20 | **Phase 2 시작 — Sticky Filter Rail 격상.** §A Phase 1 ✅ + Phase 2 🔄 / 시작일 fill / §C entry / planner-first 커밋. §6.2 sub-task 2.1 → 2.10 순차 실행 예정 (rail ivory+amber 베이스 · 필드 h-11 · DestinationPillSelect · SortSegmented · type chips amber · More 버튼 · ActiveFilterStrip · 모바일 drawer · refetch dot). | 8e74327f | 코드 전 planner 박기 (planner-first). 현재 filter rail은 Phase 1에서 단일 sticky parent 안에 hero와 함께 wrap됨 (sticky 제거 상태) — Phase 2에서 reskin |
| 2026-05-20 | **카피 정리 — 플랫폼 네이밍 일반화 + 총 투어 개수 노출 제거 (사용자 지시).** ① footerCuratorLine 6 locale: 플랫폼 실명(Klook/GetYourGuide/Viator) → "글로벌 여행 플랫폼"으로 일반화. ② 총 투어 개수("{count} tours"/"{count}개 데이투어") 사이트 노출 전면 제거 — CatalogueHero 우측 count 배지 삭제 + count prop 제거, heroSub 6 locale count 인터폴레이션 제거, footerCuratorLine count 세그먼트 제거, CatalogueFooterStrip count prop 제거, page.tsx 양쪽 call site count 없이. | 94afd6ad | 사용자 "투어수 적다는거 홍보 아냐". list 페이지 총 카운트 노출 = 0. hub per-city 카운트는 별개라 미변경. type-check clean. 카드 SHA `a931fe4e` 유지 |
| 2026-05-20 | **글로벌 Header 배경 변경 (list 범위 외 — 사용자 명시 승인).** 사용자가 "헤더 배경색"이 글로벌 nav Header(`components/Header.tsx`)였음을 스크린샷으로 확인. AskUserQuestion → ①범위=사이트 전체 ②색=깨끗한 따뜻한 화이트. Header default(light) variant `bg-[rgba(238,242,239,0.48)] backdrop-saturate-[0.92]` (차가운 세이지-그레이) → `bg-[#fdfdfc]/[0.85] backdrop-blur-md` + 부드러운 shadow (상세페이지 pt variant와 동일 화이트 패밀리). **랜딩·허브·리스트·검색 등 모든 light 페이지 영향.** 동시에 list rail 토큰 `LIST_RAIL_BG`도 `bg-[#fdfdfc]/82 backdrop-blur-md`로 통일 (header↔rail sticky 스택 일관성). | (pending) | **이 변경은 tours-list 플랜 범위 밖** — 사이트 전역 컴포넌트. 사용자 직접 승인하에 진행. dark page variant + premium-tour variant는 미변경. type-check clean |
| 2026-05-20 | **Phase 2.1+2.2+2.6 ✅ — filter rail ivory+amber foundational reskin.** 토큰 import (LIST_FIELD_CLS/SELECT_CLS/CHIP_ACTIVE/INACTIVE/RAIL_BG/RAIL_BORDER/SHADOW_WARM). rail 베이스 bg-white/72 → ivory gradient + amber-100 border + warm shadow. fieldCls/selectCls h-8 slate → h-11 amber-200/70 text-[13.5px]. chipCls bg-slate-900 → amber-900/95 text-amber-50 (desktop+mobile). desktop row h-52 → h-64. eyebrow/dividers/reset/apply/refetch-bar 전부 amber. mobile 필드 height override 제거 (토큰 h-11 적용). | 28e90f38 | type-check clean. **filter rail 내 slate-200/900 = 0 (B1)** — 남은 slate는 empty/error/skeleton/load-more (Phase 3/4 scope) + em-dash 중립. 카드 SHA `a931fe4e` 유지. 남은 2.3/2.4/2.5/2.7/2.8/2.9/2.10 진행 예정 |

---

## §D. 보류 아이디어 (Scope Creep Registry)

플랜 안에 없지만 좋은 아이디어. Phase 끝나기 전엔 손대지 말 것. 추가 시 출처 + 보류 이유 명시.

| 아이디어 | 출처 | 보류 이유 |
|---|---|---|
| 비교 트레이(compare tray) — 카드 선택 후 사이드 패널에서 2-3개 비교 | 일반 e-commerce 패턴 | Phase 4 완료 후 효과 검증. compare 데이터 모델·세션 저장소 필요 |
| 위시리스트 사이드 drawer (현재는 카드 heart만) | 사용자 워크플로 | 별도 mypage/wishlist 페이지 존재. duplicate 우려 → 충분한 사용 데이터 확인 후 |
| Saved searches — "Jeju + Private + ₩300k 이하" 저장 | 일반 패턴 | 로그인 의무화 필요. signup 마찰과 트레이드 |
| Map view toggle — `/tours/list?view=map` | 빌더와의 연계 | 빌더가 이미 `/itinerary-builder` 지도 — 이중 동선. 사용자 혼란 |
| Personalized rail "추천: 너만의 픽" at top | 개인화 | 행동 데이터(home matcher result 등) 누적 후 |
| 비교 차트 (가격·평점·후기 3축) | 일반 e-commerce | scroll-freeze 위험. SVG renderer + observer 필요 |
| Hero에 video 배경 | 매거진 fashion | scroll-freeze 가드 + LCP 위협. 정지 사진 + ken burns가 ceiling |
| Infinite scroll → pagination 회귀 | SEO 의견 | 현재 sentinel + manual "load more" 하이브리드가 best practice |
| Filter rail 좌측 사이드바 (Booking.com 식) | 데스크탑 패턴 | 모바일 호환 비용 ↑, 현재 sticky top rail이 모바일-친화. Phase 4까지 보류 |
| 2.7 "More" 버튼 (Tier B 펼치기 + 활성 카운터) | Phase 2.7 | Tier B 필터(Duration/Features)가 Phase 4.10이라 펼칠 내용 부재. Phase 4에서 Tier B 필터와 함께 구현 |

---

## §1. 코드 실사 스냅샷 (current state)

### 1.1 파일 경로

- 페이지: `app/tours/list/page.tsx` (867줄, client component)
- 레이아웃: `app/tours/layout.tsx` (SEO metadata만)
- 카드: `components/tour/TourListCard.tsx` (`horizontal` layout 사용 중)
- 사이트 셸: `src/components/layout/SitePageShell.tsx`
- 어댑터: `src/lib/adapters/tours-adapter.ts` → `adaptToursListResponse`
- API: `app/api/tours/route.ts` (search/filter/sort), `app/api/tours/destinations/route.ts` (도시 마스터 리스트)
- 허브: `app/tours/page.tsx` + `components/tours-hub/{ToursHubHero,TourCollectionStrip,DestinationGrid}.tsx`
- 액센트 시스템: `components/tours-hub/TourCollectionStrip.tsx` → `StripAccent` + `ACCENT` (재사용 대상)

### 1.2 현재 컴포넌트 구조 (top → bottom)

```
SitePageShell
└── main.pb-24
    ├── div.sticky (필터 바, top-0 z-30 bg-white/72 backdrop-blur-md)
    │   ├── desktop row (lg:flex, h-[52px])
    │   │   ├── eyebrow span (text-[9px] uppercase)
    │   │   ├── search input (h-8 text-[12px])
    │   │   ├── destination select (h-8 w-32)
    │   │   ├── sort select (h-8 w-36)
    │   │   ├── divider
    │   │   ├── type chips × 4 (all/private/join/bus, h-7 text-[10px] uppercase tracking-[0.14em])
    │   │   ├── divider
    │   │   ├── price chip + popover
    │   │   └── reset button (조건부)
    │   ├── mobile rows (lg:hidden, 3 rows)
    │   │   ├── row1: search + reset
    │   │   ├── row2: type chips × 4 (flex-1 각)
    │   │   ├── row3: destination select + sort select
    │   │   └── row4: price chip
    │   └── refetch pulse bar (h-0.5 absolute bottom)
    └── section.max-w-5xl (그리드 컨테이너)
        ├── loading: SkeletonGrid (24장)
        ├── error: panel + reset
        ├── empty: panel + reset (조건부)
        └── default: grid grid-cols-1 lg:grid-cols-2 + load-more
            └── TourListCard × N (layout='horizontal')
```

### 1.3 현재 API 필드 지원 (확인됨)

| Query param | 현재 사용 | DB 지원 | 비고 |
|---|---|---|---|
| `search` | ✅ | ✅ | 제목 ILIKE |
| `destinations` (CSV) | ✅ (단일) | ✅ | 도시 IN 필터 |
| `tourType` | ✅ | ✅ | private/join/bus |
| `sortBy` + `sortOrder` + `useScoreSort` | ✅ | ✅ | popular/newest/rating/sales/priceAsc/priceDesc |
| `minPriceUsd` / `maxPriceUsd` | ✅ | ✅ | USD 환산 |
| `features` (CSV) | ✅ (단일 string) | ✅ | UNESCO/Cruise/etc |
| `durations` (CSV) | ❌ 미사용 | ✅ | Half-day/Full-day/Multi-day 추가 가능 |
| `locale` | ✅ | ✅ | 6 locale 번역 |
| ⚠️ time-of-day | ❌ | ❌ | DB 컬럼 부재 — Phase 5 백엔드 작업 |
| ⚠️ group-size | ❌ | ❌ | DB 컬럼 부재 — Phase 5 백엔드 작업 |
| ⚠️ language | ❌ | ❌ | DB 컬럼 부재 — Phase 5 백엔드 작업 |

### 1.4 현재 i18n `toursList.*` 키 (6 locale 존재 확인)

`subtitle / loadingTours / noToursFound / loadFailed / eyebrow / resultsCount / price / priceFrom / priceUpTo / priceRange / minPlaceholder / maxPlaceholder / apply / reset / resetFilters / loadMore / loadingMore / emptyTitle / emptyHint / searchAriaLabel / destinationAriaLabel / sortAriaLabel / priceAriaLabel / popularHint`

→ Phase별 신규 카피는 이 네임스페이스에 적층. 6 locale 동시 랜딩 의무.

### 1.5 카드(`TourListCard`)의 현재 프리미엄 자산 — **보존 필수**

- Film grain noise overlay (`mix-blend-overlay opacity 0.12`)
- Soft radial vignette (`radial-gradient transparent 60% → rgba(0,0,0,0.15) 100%`)
- Vogue 필터 (`saturate(1.08) contrast(1.06) brightness(0.99)`)
- Warm drop shadow (`shadow-[0_16px_38px_-24px_rgba(15,23,42,0.34)]`)
- Hover lift + blue ring (`hover:-translate-y-1 hover:border-blue-200/80`)
- Group image scale (`group-hover:scale-[1.03]`)
- Spring tap (`scale 0.958, y:4, brightness 0.94, stiffness 560 damping 22`)
- Quality 75 next/image (안 건드림)
- Wishlist heart overlay

→ 이 자산을 깨는 어떤 변경도 §B15 reversal 없이는 금지.

---

## §2. 진단 (현재 다운그레이드 신호 7가지)

| # | 진단 | 다운그레이드 톤 |
|---|---|---|
| D1 | **헤로 0px** — `SitePageShell` 다음 바로 sticky filter | 허브(720px ken burns)와 상세(360-420px hero)에 비해 list만 admin 검색창. 같은 사이트로 안 느껴짐 |
| D2 | **필터 바 form-tool 톤** — `h-8 / text-[12px] / border-slate-200/75 / white/82` | 작은 회색 필드 + 회색 칩 = "보험 견적 계산기". 매거진은 두께·여백·gold line 필요 |
| D3 | **활성 필터 시각화 부재** — 3개 필터 걸어도 어디 뭐 걸렸는지 안 보임 | dismissible chip rail 없음 → control감 부재 |
| D4 | **결과 컨텍스트 없음** — "Showing 24 of 217 tours" 류 없음 | 큐레이션 신호 + control 모두 부재 |
| D5 | **destination 필터 적용 시 페이지 톤 불변** — `?destination=Jeju`에서도 동일 | 허브 약속(Jeju=volcano teal)을 list가 깸 |
| D6 | **그리드 시각 리듬 0** — 24장 동일 카드 연속 | 매거진 인서트·큐레이터 컷·시즌 노트 부재 |
| D7 | **빈 상태 dead-end** — reset 한 버튼만 | 빌더·컨시어지 우회로 부재 |

---

## §3. 노스타 (한 줄)

> **"카탈로그가 아니라 한국 데이투어의 *카탈로그 매거진*."**
> 필터는 매거진의 디렉터리, 카드는 화보 페이지, 헤더는 표지.
> 허브가 "매거진 표지"라면 `/tours/list`는 "디렉터리/인덱스 페이지"가 되어야 한다.

---

## §4. 페이지 구성안 (top → bottom, 11 sections)

```
[0]  SitePageShell Header (unchanged)
─────────────────────────────────────────────────────
[1]  CATALOGUE HERO — 240px collapsing magazine cover (Phase 1)
     · Issue / Season masthead 좌상단
     · "The Catalogue, " + italic serif "every tour, hand-picked." (52/64px)
     · 한 줄 카피: "217 tours · curated by the AtoC Korea editorial team"
     · 큐레이터 시그니처 — "Edited from Seoul, since 2014"
     · 스크롤 200px↓ 시 88px sticky로 압축 (masthead + count만 유지)
     · 풀블리드 사진 + ken burns 16s + amber 워시 + 라디얼 비네트
─────────────────────────────────────────────────────
[2]  CONTEXTUAL VIGNETTE BAND — 56px (Phase 3, 조건부)
     · destination/feature/tourType 강한 컨텍스트일 때만 등장
     · accent 컬러 그라데이션 (volcano/harbor/palace/ocean/temple/blossom/signature)
     · 큐레이터 한 줄 + reset 링크
─────────────────────────────────────────────────────
[3]  STICKY FILTER RAIL — 2-tier 64px (Phase 2)
     Tier A (always): Search · Destination pill · Sort segmented · "More" button
     Tier B (expand or wide screen): Type chips · Duration · Features
       (Phase 5 추가: Time of day · Group · Language — DB 확장 후)
     ─ Active filter dismissible chip strip (Phase 2, 신규)
─────────────────────────────────────────────────────
[4]  RESULTS META STRIP (Phase 3)
     · "Showing 1–24 of 217 · Sorted by Editor's pick"
     · 큐레이터 시그니처 italic 한 줄
     · 우측: Editorial 3-up ↔ Compact 2-up view toggle
─────────────────────────────────────────────────────
[5]  TOUR GRID (Phase 4)
     · 기본: vertical 3-up (md:2 lg:3), max-w-[1320px]
     · 토글: horizontal 2-up (현재 디자인)
     · 6번째 슬롯마다 Editorial Insert (col-span-full)
─────────────────────────────────────────────────────
[6]  EDITORIAL INSERT — 6장마다 (Phase 4)
     · Editor's Pick · 시즌 노트 · 큐레이터 컷 3종 로테이션
     · col-span-full, amber rule, italic serif accent, CTA
─────────────────────────────────────────────────────
[7]  EDITORIAL INSERT (next batch) — 12장 후 등장
─────────────────────────────────────────────────────
[8]  CONVERSION RESCUE BAND — 28장 본 뒤 (Phase 4)
     · "원하는 그림이 카탈로그에 없으신가요?" → /itinerary-builder
     · amber-50 그라데이션, serif italic
─────────────────────────────────────────────────────
[9]  LOAD MORE / END-OF-RESULTS
     · 더 있으면: "Load 24 more" 큰 둥근 버튼 + 큐레이션 마이크로 카피
     · 끝이면: "You've reached the end — 217 of 217" 시그니처 한 줄
─────────────────────────────────────────────────────
[10] EMPTY STATE (Phase 3)
     · 매거진 톤 + 3-action recovery
       (a) 가장 제약 큰 필터 자동 1개 해제 제안
       (b) /itinerary-builder
       (c) 컨시어지 (WhatsApp/카톡)
─────────────────────────────────────────────────────
[11] FOOTER STRIP — "Curated since 2014 · 217 tours · KR team" (Phase 1)
```

---

## §5. 디자인 토큰 (List 전용 namespace)

> ⚠️ **B16 적용**: brand/accent/success/danger/neutral 5색 + ivory/amber 액센트 가족 내에서만.
> 신규 색상 도입 시 §B reversal row 필수.

| 토큰 | 값 | 용도 |
|---|---|---|
| `--list-bg` | `#faf8f3` (ivory) | 페이지 베이스 |
| `--list-rail-bg` | `linear-gradient(180deg,#fdfcf8,#faf9f4)` | sticky filter rail |
| `--list-rail-border` | `border-b border-amber-100/70` | rail 하단 라인 |
| `--list-accent-line` | `linear-gradient(90deg, theme(colors.amber.400), theme(colors.amber.300), theme(colors.amber.500))` | masthead/eyebrow line |
| `--list-active-chip` | `bg-amber-900/95 text-amber-50` (NOT slate-900) | 활성 chip |
| `--list-inactive-chip` | `bg-white/95 border border-amber-200/70 text-slate-700` | 비활성 chip |
| `--list-active-filter` | `bg-amber-50 border-amber-200/70 text-amber-900` | dismissible 활성 필터 |
| `--list-shadow-warm` | `0 12px 32px -20px rgba(120,90,40,0.22)` | rail / 인서트 그림자 |
| `--list-eyebrow` | `text-amber-700/90 italic font-medium tracking-[0.22em] uppercase text-[10.5px]` | 모든 eyebrow |
| `--list-display` | `font-bold leading-[1.04] tracking-[-0.03em]` + italic serif accent | hero / insert headline |
| `--list-curator` | `text-[11.5px] italic text-amber-700/80` + `w-6 amber line prefix` | 큐레이터 시그니처 |
| `--list-field-h` | `h-11` (현재 h-8) | 필터 input/select |
| `--list-field-text` | `text-[13.5px]` (현재 text-[12px]) | 필터 입력 |

### accent 컬러 약속 (B6 — 허브와 동일)

```ts
// Reuse from `components/tours-hub/TourCollectionStrip.tsx` → StripAccent
import type { StripAccent } from '@/components/tours-hub/TourCollectionStrip';
// signature(amber) / volcano(teal) / harbor(indigo) /
// palace(fuchsia) / ocean(sky) / temple(red) / blossom(rose)
```

→ **신규 액센트 시스템 만들지 않음.** `ACCENT` 객체를 `lib/tours-hub-accents.ts`로 추출하여 list가 import.

---

## §6. Phase별 실행 계획

### 6.0 Phase 0 — 게이트 (코드 실사 + 토큰 락 + Anti-downgrade 가드 확정)

**목적**: Phase 1 시작 전 모든 안전장치가 박혀있는지 확인. 통과 못하면 Phase 1 시작 금지.

| # | 체크리스트 | 통과 기준 |
|---|---|---|
| 0.1 | `TourCollectionStrip.tsx`의 `StripAccent` + `ACCENT`를 `lib/tours-hub-accents.ts`로 추출 | import 깨지지 않음 (허브 page 빌드 클린) |
| 0.2 | `lib/tours-list-tokens.ts` 신규 — §5 토큰을 TS 상수로 export | 토큰 명세 일치, 타입 안전 |
| 0.3 | `app/tours/list/page.tsx` SkeletonGrid가 ivory 베이스에서도 자연스러운지 확인 (배경만 #faf8f3으로 변경해 미리 검증) | 시각 회귀 없음 |
| 0.4 | `messages/*.json` 6 locale 모두에 `toursList.heroIssue` / `toursList.heroTitle` / `toursList.heroAccent` / `toursList.heroSub` / `toursList.heroCurator` / `toursList.footerCuratorLine` 등 Phase 1 키 추가 (값은 가안, 카피라이팅 별도 PR로 정밀화) | 6 locale × 6 키 = 36 entry 추가, 빌드 클린 |
| 0.5 | scroll-freeze 가드 sanity — 현재 페이지에 stacked backdrop-blur 추가 시 어떻게 reflow하는지 한 번 dev 측정 (이후 Phase 1-4에서 회귀 즉시 감지용 baseline) | dev FPS 60 유지 (baseline 기록) |
| 0.6 | `TourListCard` snapshot 백업 — Phase 1-4에서 카드 시각이 절대 변하지 않았음을 입증하기 위해 모바일/데스크탑 스크린샷 보관 | screenshot 2장 보관 (Phase 4 ✅ 시 diff 확인) |
| 0.7 | §A 대시보드 + §B 결정 로그 + §C 변경 로그 git commit (planner-first 룰 — 코드 전에 플랜 박기) | commit hash 기록 |

**Phase 0 ✅ 조건**: 위 7개 모두 통과 + 사용자에게 "Phase 1 진입 승인" 받음.

---

### 6.1 Phase 1 — Catalogue Hero + Footer Strip

**목적**: 단독으로 "이 사이트 격이 올라갔다" 통과되는 매거진 표지.

| # | 작업 | 파일 | 통과 기준 | 상태 |
|---|---|---|---|---|
| 1.1 | `components/tours-list/CatalogueHero.tsx` 신규 — 240px collapsing | 신규 | 데스크탑 240px / 모바일 200px 마운트, ken burns 16s 동작 | ✅ 6ef3cb21 |
| 1.2 | scroll-driven collapse 88px (framer `useScroll` + `useTransform`) | CatalogueHero | scroll 200px↓ 시 88px로 reflow, masthead + tour count만 유지 | ✅ 6ef3cb21 |
| 1.3 | masthead (`Issue 14 · Spring 2026`) + 메인 (`The Catalogue,` + italic serif `every tour, hand-picked.`) + sub + 큐레이터 라인 | CatalogueHero | 6 locale 카피 검증 | ✅ 6ef3cb21 |
| 1.4 | 풀블리드 사진 + 어둠 그라데이션 + amber 워시 + 라디얼 비네트 (허브 hero와 같은 레이어 패턴) | CatalogueHero | 허브와 시각 가족감 일치 | ✅ 6ef3cb21 |
| 1.5 | `app/tours/list/page.tsx`에 Hero 마운트 + `bg-white` → `bg-[#faf8f3]` | page.tsx | 페이지 베이스 ivory 전환 | ✅ 6ef3cb21 |
| 1.6 | `components/tours-list/CatalogueFooterStrip.tsx` 신규 — "Curated since 2014 · 217 tours · KR team" 큐레이터 시그니처 | 신규 | grid 끝 + load-more 사이 마운트 | ✅ 6ef3cb21 |
| 1.7 | 카드 베이스 색 verify — ivory 페이지 위에서 카드 white/97 그대로 자연스러움 확인 (회귀 없음) | page.tsx | B2 카드 보존 검증, screenshot diff vs Phase 0.6 | ✅ SHA a931fe4e 일치 |
| 1.8 | i18n 6 locale 카피 정밀화 (`heroTitle/heroAccent/heroSub/heroCurator/footerCuratorLine`) | messages/*.json | 카피라이터 톤 PR로 분리 가능 | ✅ 36/36 entry |

**Phase 1 ✅ 조건**: 사용자가 "표지 격 통과" 확인. Phase 0.6 카드 스크린샷과 Phase 1 후 카드 스크린샷 비교 시 카드 자체 변경 0. LCP regression ≤ +50ms (Hero 이미지 priority).

---

### 6.2 Phase 2 — Sticky Filter Rail 격상

**목적**: form-tool 톤 (slate-h8-12px) → 매거진 디렉터리 톤 (ivory-amber-h11-13.5px).

| # | 작업 | 파일 | 통과 기준 | 상태 |
|---|---|---|---|---|
| 2.1 | rail 베이스: `bg-white/72 backdrop-blur-md` → `bg-[linear-gradient(180deg,#fdfcf8,#faf9f4)] backdrop-blur-md` + `border-b border-amber-100/70` + warm shadow | page.tsx | 톤 검증 | ✅ 28e90f38 (LIST_RAIL_BG/BORDER/SHADOW 토큰) |
| 2.2 | 모든 필터 필드 h-8 → h-11, text-[12px] → text-[13.5px], border slate-200 → amber-200/70 | page.tsx (`fieldCls`, `selectCls`) | 측정 | ✅ 28e90f38 (LIST_FIELD_CLS/SELECT_CLS, row h-64) |
| 2.3 | search input — 좌측 돋보기 아이콘 추가, `rounded-2xl`, inner highlight shadow | page.tsx | input 좌측 16px 패딩 with 아이콘 | ⏳ |
| 2.4 | destination select → **Pill select** with 핀 아이콘 + 도시명 + count badge | 신규 `components/tours-list/DestinationPillSelect.tsx` | 카운트 노출, 클릭 시 floating panel | ⏳ |
| 2.5 | sort select → **Segmented control** (인기/최신/평점/판매/가격↑↓) | 신규 `components/tours-list/SortSegmented.tsx` | active = `bg-amber-900/95 text-amber-50 shadow-inner` | ⏳ |
| 2.6 | type chips (all/private/join/bus) — chip 톤 amber로 격상 (active = `bg-amber-900/95 text-amber-50`, inactive = `bg-white/95 border-amber-200/70 text-slate-700`) | page.tsx (`chipCls`) | active 시 amber, slate-900 사용 금지 | ✅ 28e90f38 (desktop+mobile chips amber) |
| 2.7 | ~~"More" 버튼 신규 — Tier B 펼치기 + 활성 카운터 배지~~ → **Phase 4.10 (Tier B Duration/Features 필터)와 함께로 이관**. 지금은 펼칠 Tier B 내용이 없어 placeholder가 됨 | 신규 | (Phase 4로 이관) | 📦 Phase 4 |
| 2.8 | **Active Filter Chip Strip 신규** (`components/tours-list/ActiveFilterStrip.tsx`) — rail 바로 아래, `bg-amber-50 border-amber-200/70 text-amber-900`. dismissible 칩 + Clear all | 신규 | 각 필터별 칩 등장/해제 검증 | ⏳ |
| 2.9 | 모바일: rail Tier A 단일 row → `Filter` 버튼 → full-sheet drawer (framer-motion bottom-sheet) | page.tsx (lg:hidden 분기) | 모바일 1탭으로 필터 전체 접근 | ✅ 407aa8e2 (bottom-sheet 0.3s, scroll lock, ESC) |
| 2.10 | refetch indicator: 하단 0.5px pulse → rail 내부 sort label 옆 spinning dot | page.tsx | 시각적으로 더 명확하되 layout shift 없음 | ✅ e6b04b91 (pulse bar 제거 → spinning dot) |

**Phase 2 ✅ 조건**: 필터 걸어도 admin form-tool 톤 안 나옴. 활성 필터 dismissible 칩 모든 시나리오에서 등장/해제. 모바일 full-sheet 0.30s 이내 (상세 페이지 drawer 정책과 동일). 색상 검증: `grep -E "(slate-200|slate-900)" components/tours-list/`에서 슬레이트 컬러 거의 0 (B1 적용).

---

### 6.3 Phase 3 — Contextual Vignette Band + Results Meta + Empty State

**목적**: 허브의 7-accent 약속을 list에서 계승. 결과 컨텍스트 + control감 부여.

| # | 작업 | 파일 | 통과 기준 |
|---|---|---|---|
| 3.1 | `lib/tours-hub-accents.ts`로 `StripAccent` + `ACCENT` 추출 (Phase 0.1 완료분 활용) | 신규 lib | 허브 page + list 양쪽에서 import 동작 |
| 3.2 | `components/tours-list/ContextualVignetteBand.tsx` 신규 — 56px, accent 그라데이션, 큐레이터 한 줄, reset | 신규 | destination/feature/tourType 강한 컨텍스트에서만 등장 |
| 3.3 | accent 매핑 룰 — destination=Jeju→volcano / Busan→harbor / Seoul→palace / features=Cruise→ocean / features=UNESCO→temple / features=Seasonal→blossom / 그 외→signature | 신규 helper `mapContextToAccent()` | 단위 테스트 (jest 또는 vitest 기존 setup) |
| 3.1 | `lib/tours-hub-accents.ts` accent 추출 | 신규 lib | ✅ Phase 0.1 (c3160d2e) |
| 3.2 | `ContextualVignetteBand.tsx` 신규 | 신규 | ✅ b707eeaa (7-accent, 컨텍스트에서만 등장) |
| 3.3 | accent 매핑 룰 `mapContextToAccent()` | lib | ✅ Phase 0.1 (lib/tours-hub-accents) |
| 3.4 | ~~`ResultsMetaStrip.tsx` — "Showing X–Y of N · Sorted by Z"~~ → **Phase 4 이관**. 총 개수("of N")는 count 미노출 정책으로 제외, view toggle은 Editorial 그리드(4.1)와 상호의존이라 함께 구현 | 신규 | 📦 Phase 4 |
| 3.5 | ~~view toggle (Editorial 3-up ↔ Compact 2-up)~~ → **Phase 4 이관** (전환 대상 Editorial 그리드가 4.1) | 신규 | 📦 Phase 4 |
| 3.6 | Empty state 3-action recovery (`EmptyStateRecovery.tsx`) | 신규 | ✅ 31dcef0e |
| 3.7 | 가장 제약 큰 필터 감지 — 휴리스틱: price > destination > features > type > search | page.tsx `suggestedFilterToRemove` | ✅ 31dcef0e |
| 3.8 | 컨시어지 동선 — 공개 WhatsApp/카톡 deep link 부재 → **내부 `/support` 라우트**로 (전화번호/채널 임의 생성 안 함) | EmptyStateRecovery | ✅ 31dcef0e (/support) |
| 3.9 | i18n 6 locale (contextBand·emptyRecovery 키) | messages/*.json | ✅ (contextBandLine/Reset + emptyRecovery 5키 × 6 locale) |

**Phase 3 ✅ 조건**: `?destination=Jeju`로 진입 시 volcano teal band 노출 ✅. empty state에 reset 단일 동선 아닌 3-action 모두 노출 ✅. ~~view toggle persist~~ → Phase 4. 카드 자체 변경 0 ✅. **3.4/3.5(ResultsMeta+view toggle)는 Phase 4.1 Editorial 그리드와 함께 구현하기로 이관.**

---

### 6.4 Phase 4 — Editorial Grid + Editorial Insert + Rescue Band

**목적**: 그리드 시각 리듬 + 빌더 동선 분기.

| # | 작업 | 파일 | 통과 기준 |
|---|---|---|---|
| 4.0 | (Phase 3에서 이관) **ResultsMetaStrip** (총 개수 제외 — sort label + 큐레이터 라인) + **view toggle** (Editorial 3-up ↔ Compact, localStorage persist) — Editorial 그리드와 함께 구현 | 신규 + page.tsx | sort label localized, toggle persist |
| 4.1 | 그리드 기본 Editorial 3-up (vertical) — `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`, `max-w-[1320px]`, gap-y-8 lg:gap-x-8 lg:gap-y-10 | page.tsx | view toggle Editorial 선택 시 적용 |
| 4.2 | `TourListCard layout="vertical"` 사용 — B2 카드 자산 그대로 (수정 0) | page.tsx | screenshot diff 카드 부분 0 |
| 4.3 | Compact 2-up (horizontal) — 현재 디자인 그대로 toggle 분기에 유지 | page.tsx | toggle 시 매끄러운 전환 |
| 4.4 | `components/tours-list/EditorialInsert.tsx` 신규 — 3 변형 (EditorPick · SeasonNote · CuratorCut) | 신규 | col-span-full, amber rule + italic serif |
| 4.5 | 6, 12, 18번째 카드 슬롯마다 인서트 삽입 (`visibleTours.map` 사이) | page.tsx | 3-up 그리드에서 col-span-full로 자연스럽게 들어감 |
| 4.6 | 인서트 콘텐츠 데이터 — 정적 (Phase 4) → 동적 (Phase 4+, 큐레이터 admin은 백로그) | 신규 lib `lib/tours-list-editorial-inserts.ts` | 정적 3종 × 6 locale |
| 4.7 | `components/tours-list/ConversionRescueBand.tsx` 신규 — 28장 본 뒤만 등장 | 신규 | amber-50 그라데이션 + serif italic + 빌더 CTA |
| 4.8 | 등장 트리거 — `visibleCount >= 28` (load-more 위쪽에 삽입) | page.tsx | 시뮬레이션 통과 |
| 4.9 | End-of-results 시그니처 — "You've reached the end — N of N · Curated since 2014" | page.tsx | load-more 자리 대체 |
| 4.10 | Tier B 추가 필터 — Duration (Half-day/Full-day/Multi-day, `durations` CSV API) + Features 다중 select (UNESCO/Cruise/Sunrise/Seasonal 등) | page.tsx + Tier B drawer | API 호환 |
| 4.11 | i18n 6 locale 카피 (editorialInsert·rescueBand·endOfResults·durations·featuresLabels 신규 키) | messages/*.json | 적층 |

**Phase 4 ✅ 조건**: 24장 스크롤 시 동일 카드 반복 느낌 사라짐. 28장↓ 시 rescue band 등장. view toggle 통해 horizontal 회귀 가능. **카드 스크린샷 vs Phase 0.6 diff = 0 (시각 자산 100% 보존).**

---

### 6.5 Phase 5 — Tier B 백엔드 확장 필터 (Time/Group/Language)

**📦 보류 — Phase 0 게이트에서 재평가.**

| # | 작업 | 통과 기준 |
|---|---|---|
| 5.1 | DB 스키마 — `tours.time_of_day` (sunrise/morning/afternoon/sunset) | migration + backfill |
| 5.2 | DB 스키마 — `tours.max_group_size` (int) | migration + backfill |
| 5.3 | DB 스키마 — `tours.guide_languages` (text[]) | migration + backfill |
| 5.4 | API `/api/tours` 확장 — `times`, `groupSize`, `languages` CSV 필터 | route.ts |
| 5.5 | frontend Tier B 필터 추가 — segmented controls | Tier B drawer |
| 5.6 | i18n 6 locale | messages |

**Phase 5 진입 조건**: Phase 1-4 완료 + 사용자가 "필터 부족하다" 요청 + 백엔드 작업 우선순위 합의.

---

### 6.6 Phase 6 — 모션 폴리시

**목적**: 매거진 톤을 모션이 마무리.

| # | 작업 | 통과 기준 |
|---|---|---|
| 6.1 | Hero ken burns 16s linear scale 1.05→1.12 (Phase 1.1 마운트 시점부터 실행) | 부드러운 zoom |
| 6.2 | Hero scroll-collapse 240→88 framer `useScroll`+`useTransform` | scroll 0-200px 범위에서 reflow |
| 6.3 | Card stagger mount — `framer-motion` viewport-trigger, 12장까지만 60ms stagger | LCP-safe (above-fold 우선 마운트) |
| 6.4 | Sort change refetch — grid `opacity 100→70` (현재 60→100 회귀 방지) + sort label spinning dot | layout shift 없음 |
| 6.5 | Editorial insert reveal — viewport 진입 시 `opacity 0→1 + y 12→0`, 0.55s ease | reduce-motion 가드 |
| 6.6 | Active filter chip dismiss — `layout` + `AnimatePresence` fade-scale | 자연스러운 chip 사라짐 |
| 6.7 | Empty state etc 등장 — italic 라인 delay 0.1s reveal | 매거진 톤 |
| 6.8 | **scroll-freeze 회귀 측정** — Chrome DevTools Performance, 60fps 유지 | Phase 0.5 baseline 대비 동등 또는 우수 |

**Phase 6 ✅ 조건**: 60fps 유지. reduce-motion 환경에서 모든 모션 비활성화. mobile/desktop 모두 LCP regression ≤ +50ms.

---

## §7. 모션 / 마이크로 인터랙션 spec

| 요소 | 모션 | 기준값 |
|---|---|---|
| Hero ken burns | linear, 16s, scale 1.05 → 1.12 | 허브와 동일 |
| Hero collapse | `useScroll(0-200px)` → `useTransform(240→88)` | scroll-driven, layout shift 격리 |
| Sticky rail blur | `backdrop-blur-md` (ceiling) | 스택 금지 |
| Filter chip toggle | spring stiffness:560 damping:22 mass:0.72 | 카드 spring과 일치 |
| Active filter dismiss | `layout` + `AnimatePresence`, fade-scale 0.2s | 자연 |
| Mobile filter drawer | bottom-sheet, 0.30s ease-out (상세 페이지 drawer 정책 일치) | 0.78s 금지 |
| Card mount stagger | 12장까지 60ms, 이후 즉시 | LCP-safe |
| Sort refetch | grid opacity 100→70, label spinning dot | 60→100 회귀 금지 |
| Editorial insert reveal | viewport trigger, opacity 0→1 + y 12→0, 0.55s ease | reduce-motion 가드 |
| Empty state | italic delay 0.1s reveal | 매거진 톤 |

---

## §8. 안티 다운그레이드 가드 (절대 NO 리스트)

### 8.1 절대 NO

- ❌ **Slate-only 흑백 톤** — ivory + amber 베이스가 default
- ❌ **카드를 "테두리 선만 있는 흰 박스"로** — film grain·vignette·Vogue 필터·warm shadow·spring tap 100% 보존
- ❌ **카드 직접 수정** — §B15 reversal 없이 금지
- ❌ **h-8 / text-[12px] / border-slate-200 form-tool 톤 유지** — h-11 / text-[13.5px] / border-amber-200/70로 격상
- ❌ **"심플하게 정리" / "여백 더 주기" / "장식 빼기"** — enrichment가 default (메모리 룰)
- ❌ **흑백 매거진 톤** (상세 페이지 1차 audit 트라우마) — italic serif는 amber-200 또는 amber-700 with gold line, 절대 monochrome 아님
- ❌ **Hero 생략** — 240px 매거진 cover 필수, 0px 금지
- ❌ **sort을 작은 select로 유지** — segmented control로 격상
- ❌ **active filter를 select 안에 숨기기** — dismissible chip strip 외부화
- ❌ **빈 상태 단일 reset 버튼** — 3-action recovery
- ❌ **destination별 액센트 무시** — 허브 7-accent 시스템 계승 의무
- ❌ **그리드를 24장 동일 카드로** — 6번째마다 editorial insert
- ❌ **시간/그룹/언어 필터 frontend만 표시, 동작 안 함** — DB 확장 전 Phase 5 보류
- ❌ **신규 라이브러리 (carousel/bottom-sheet/virtual list)** — framer-motion + IntersectionObserver만
- ❌ **scroll-linked 신규 애니메이션 / stacked backdrop-blur / heavy IO** — scroll-freeze 가드 (B11)
- ❌ **Hero에 video 배경** — LCP + scroll-freeze 위협
- ❌ **§A planner 업데이트 없이 코드 커밋** — planner-first 룰 (다른 스킬과 동일)
- ❌ **Phase ✅ 표시 전 acceptance 검증 생략**
- ❌ **카드 시각 자산 1개라도 회귀** (B2) — screenshot diff로 입증
- ❌ **i18n 6 locale 중 일부만 추가** — 6개 동시 랜딩 (B14)

### 8.2 절대 DO

- ✅ 모든 Phase 시작 전 §A 시작일 fill + §C entry + 플래너 커밋
- ✅ 모든 Phase 종료 전 acceptance 검증 evidence 페이스트 (스크린샷·grep 결과·LCP delta)
- ✅ 카드 시각 자산 보존 검증 (Phase 0.6 vs Phase 4 ✅ screenshot diff)
- ✅ 색상 baseline grep — `grep -E "(slate-200|slate-900)" components/tours-list/` 거의 0
- ✅ 모션 baseline FPS 60 (Phase 0.5 측정 → Phase 6 ✅ 시 대비)
- ✅ i18n 6 locale 동시 랜딩
- ✅ Phase 1-4 각 종료 시 사용자에게 "다음 Phase 진입" 명시 승인 요청

---

## §9. 가족 컬러 약속 (cross-page inheritance)

list 페이지의 색·톤·모션은 사이트의 다른 페이지와 가족이 되어야 함:

| 가족 | 페이지 | 공통 약속 |
|---|---|---|
| ivory base | 랜딩 home v2 (#faf9f7), 허브 (#faf9f7 gradient), 상세 (token 베이스), **list (#faf8f3 ← 신규 약속)** | 흰색 베이스 금지 |
| amber accent | 랜딩 hero eyebrow (amber-200/700), 허브 masthead (amber-400/200), 빌더 CTA (amber-600), **list eyebrow + active chip (amber-700/900 ← 신규 약속)** | slate-900 active 톤 금지 |
| italic serif | 허브 hero (`hand-picked.`), 상세 hero (`every detail.`), 빌더 (`map.`), ~~list hero~~ — **사용자 직접 지시로 list는 업라이트 serif (B18 reversal, 2026-05-20)**. 다른 페이지는 italic 유지. | 매거진 시그니처 (list 제외 — list는 upright serif Kinfolk 톤) |
| 큐레이터 시그니처 | 허브 (`Edited from Seoul, since 2014`), 상세 (없음 — 추가 보류), 빌더 (`Itinerary desk — open 9–9 KST`), **list (`Edited from Seoul, since 2014` ← 신규 약속)** | 매거진 톤 |
| ken burns | 허브 16s, 상세 (정책-pending), **list 16s ← 신규 약속** | 같은 호흡 |
| destination 7-accent | 허브 TourCollectionStrip (volcano/harbor/palace/ocean/temple/blossom/signature), **list Contextual Vignette Band (동일 import) ← 신규 약속** | 신규 액센트 금지 |
| 카드 비주얼 | 카드 자체 (film grain·vignette·Vogue 필터·warm shadow·spring tap) | 모든 페이지에서 동일 카드, 외부 표면만 페이지마다 다름 |
| 모션 spring | 카드 spring (stiffness:560 damping:22 mass:0.72), 모든 chip toggle 일치 | 일관 |

---

## §10. 롤백 트리거

다음 조건 발생 시 즉시 해당 Phase 롤백 (자동):

| 트리거 | 임계 | 대상 |
|---|---|---|
| LCP regression | +50ms 이상 | Phase 1 (Hero) — 이미지 크기·priority·sizes 점검 |
| CLS jump | +0.02 이상 | Phase 1 (Hero collapse), Phase 6 (모든 모션) |
| FPS drop | 60 → 50 이하 | Phase 6 모션 폴리시 |
| 카드 screenshot diff | 0이 아닌 변화 | Phase 1-4 전부 (B2 위반) |
| 색상 grep regression | `slate-900` 등 회색 active 색 list 컴포넌트에 새로 등장 | Phase 2-4 (B1 위반) |
| i18n missing | 6 locale 중 1개라도 키 누락 | Phase 1-4 전부 (B14 위반) |
| Build error | 임의 | 즉시 모든 작업 정지 |
| 사용자 "다운그레이드 느낌이다" 피드백 | 1회라도 | 즉시 해당 Phase 작업 정지 + §B reversal row + 재기획 |

---

## §11. 다국어 / locale QA gate

Phase별 신규 카피는 6 locale (en/ko/zh/zh-TW/es/ja) 동시 랜딩 의무 (B14):

- Phase 1: `toursList.heroIssue` / `heroTitle` / `heroAccent` / `heroSub` / `heroCurator` / `footerCuratorLine` (6 × 6 = 36 entry)
- Phase 2: `toursList.searchPlaceholder` / `moreFilters` / `clearAll` / `filterDuration` / etc.
- Phase 3: `toursList.resultsCountFull` / `sortedBy` / `editorial` / `compact` / `emptyAutoSuggest` / etc.
- Phase 4: `toursList.editorPickEyebrow` / `seasonNoteTitle` / `rescueBandTitle` / `rescueCta` / `endOfResults` / `durationHalfDay/FullDay/MultiDay` / etc.

검증: 각 Phase ✅ 직전 `grep -L "newKey" messages/*.json` 결과 비어있음 확인.

---

## §12. 안 할 일 (anti-patterns)

| # | 패턴 | 이유 |
|---|---|---|
| AP1 | "Hero 없이 진행, 필터부터 시작이 빠름" | B3 위반 — list가 매거진 가족에서 이탈 |
| AP2 | "필터 필드 h-8 그대로 두고 톤만 살짝" | B4 위반 — admin form 톤 미해결 |
| AP3 | "사이트 어디서나 같은 slate-900 active 톤이 일관성" | B1·B16 위반 — ivory/amber 가족 컬러 약속 깸 |
| AP4 | "destination별 컬러는 list에선 생략, 허브에만" | B6 위반 — 허브 약속 list가 깸 |
| AP5 | "카드 톤도 ivory에 맞춰 살짝만 조정" | B2·B15 위반 — 카드 회귀 위험 |
| AP6 | "compact horizontal을 기본으로 유지 (현재 그대로)" | B7 위반 — search-result 톤 유지 |
| AP7 | "Editorial Insert는 광고 같으니 빼자" | B8 위반 — 시각 리듬 부재 + 큐레이션 신호 부재 |
| AP8 | "Rescue band를 처음부터 노출" | B9 위반 — 카탈로그 신뢰 약화 |
| AP9 | "Empty state는 단순 reset이 깔끔" | B10 위반 — dead-end |
| AP10 | "scroll-linked 모션 1개 정도는 괜찮음" | B11 위반 — scroll-freeze 위험 |
| AP11 | "framer-motion 외 bottom-sheet 라이브러리 추가하면 코드 줄어듦" | B12 위반 — 번들·일관성 |
| AP12 | "Time/Group/Language 필터를 일단 UI만 만들고 동작은 추후" | B13 위반 — 동작 안 하는 UI는 신뢰 손상 |
| AP13 | "ko만 먼저 추가하고 나머지 5 locale은 다음 PR에서" | B14 위반 — i18n 회귀 위험 |
| AP14 | "카드 시각 자산 약간만 조정 (film grain 빼기 등)" | B2 위반 — 절대 NO |
| AP15 | "Phase 0 게이트 생략, 바로 Phase 1 시작" | B17 위반 — 안전장치 미확정 상태 진입 |
| AP16 | "§A planner 업데이트는 PR 별도로" | planner-first 룰 (랜딩·상세·빌더 모두 동일) |
| AP17 | "Phase ✅ acceptance 검증 evidence 페이스트 생략" | 검증 안 된 ✅는 ✅ 아님 |
| AP18 | "Hero에 video 배경" | LCP + scroll-freeze 위협 |
| AP19 | "기본 view를 Compact으로 두고 Editorial은 토글" | B7 위반 — 매거진 톤이 default |
| AP20 | "list에 dark mode 추가" | 사이트 전체 dark mode 미정. 별도 sprint |

---

## §13. 부록 — 파일 맵 (이 스킬이 커버하는 범위)

### 직접 작업 대상
- `app/tours/list/page.tsx` (페이지 entry — Phase 1-4 마운트)
- `app/tours/layout.tsx` (SEO metadata — Phase 1 description 갱신 가능)
- `components/tours-list/CatalogueHero.tsx` (Phase 1 신규)
- `components/tours-list/CatalogueFooterStrip.tsx` (Phase 1 신규)
- `components/tours-list/DestinationPillSelect.tsx` (Phase 2 신규)
- `components/tours-list/SortSegmented.tsx` (Phase 2 신규)
- `components/tours-list/ActiveFilterStrip.tsx` (Phase 2 신규)
- `components/tours-list/ContextualVignetteBand.tsx` (Phase 3 신규)
- `components/tours-list/ResultsMetaStrip.tsx` (Phase 3 신규)
- `components/tours-list/EmptyStateRecovery.tsx` (Phase 3 신규)
- `components/tours-list/EditorialInsert.tsx` (Phase 4 신규)
- `components/tours-list/ConversionRescueBand.tsx` (Phase 4 신규)
- `lib/tours-hub-accents.ts` (Phase 0 추출)
- `lib/tours-list-tokens.ts` (Phase 0 신규)
- `lib/tours-list-editorial-inserts.ts` (Phase 4 정적 콘텐츠)
- `messages/{en,ko,zh,zh-TW,es,ja}.json` (각 Phase에서 6 locale 동시 추가)

### 의존 (수정 시 §B reversal 필요)
- `components/tour/TourListCard.tsx` (B2·B15 — 카드 자산 보존)
- `components/tours-hub/TourCollectionStrip.tsx` (Phase 0.1 — `StripAccent` 추출 후 import 갱신)

### Out of scope (이 스킬에서 손대지 않음)
- `app/tours/page.tsx` (허브) — 별도 스킬 없음, 변경 시 사용자에게 명시 승인
- `app/tour-product/[slug]/page.tsx` (상세) → `tour-product-detail-uiux`
- `app/itinerary-builder/*` → `itinerary-builder-redesign` / `itinerary-builder`
- `components/home/v2/*` → `landing-page-uiux`
- `app/api/tours/route.ts` 수정 — Phase 5 (DB 확장)에서만, 별도 백엔드 작업

---

## §14. 진행 시 사용자에게 보고할 항목 (per turn)

각 작업 turn 종료 시 다음 항목 포함하여 보고:

1. 방금 완료한 task (§A Phase + §6 sub-task 번호 인용, 예: "Phase 2.5 SortSegmented done")
2. 업데이트한 §A / §C entry (한 줄씩)
3. 다음 unchecked task (활성 Phase 안에서)
4. 현재 Phase가 ✅인지 (✅면 다음 Phase 진입 명시 승인 요청)
5. §D 추가된 보류 아이디어 또는 §B reversal row
6. i18n 6 locale QA 상태 (touched 시)
7. 카드 screenshot diff 결과 (Phase 1-4 모든 turn — B2 보호)
8. 색상/모션 baseline 비교 결과 (Phase 2-6 모든 turn — B1·B11 보호)

---

**문서 끝.**

이 플랜은 `feedback_premium_default_enrichment.md` ("프리미엄 = enrichment, never 'what to cut'") + `feedback_home_visual_energy.md` (amber 유지·dark 라이트화 금지) + 사용자의 2026-05-20 명시 요청 ("flat 흑백 잡지 느낌 만들지 말 것") 3중 안전장치 위에서 작동합니다.
