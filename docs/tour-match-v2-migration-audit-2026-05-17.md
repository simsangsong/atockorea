# tour-match-v2 마이그레이션 Audit + 랜딩 계획

작성일: 2026-05-17
문서 상태: **랜딩 진행 전 진단 + 7-step 작업 단위 권장**
대상: `lib/tour-product-match/` (legacy) → `lib/tour-match-v2/` (신규) 전환 + 그에 동반된 in-flight 변경

## 1. 진단 시점 상태

`git status` 88 changes (M/D/?? 합산). 본 세션 시점 v3 landing-page-uiux 마무리 직후 audit 수행.

### 1.1 안전성 점검 결과

| 항목 | 상태 |
|---|---|
| `npm run build` (HEAD = 808a2779) | ✅ 클린 |
| `@/lib/tour-product-match` TS path alias 참조 | ✅ 0건 (잔류 import 없음) |
| `lib/tour-product-match` 폴더 참조 | 2건 — 모두 historical SQL migration (무관) |
| `lib/tour-match-v2/api-types.ts` 컴파일 자족성 | ✅ pure type, 외부 의존 0 |
| **`api-types.ts` 파일 자체 git 상태** | ⚠️ **untracked** — 4개 파일에서 import 중 |

### 1.2 위험 신호 (immediate)

**`lib/tour-match-v2/api-types.ts`가 untracked인데 다음 4파일에서 사용 중**:
- `components/home/v2/HomeV2MatchProvider.tsx`
- `lib/home/adapters/v2-best-match-result-vm.ts`
- `app/match/page.tsx`
- `lib/tour-match-v2/adapter-v1.ts`

Push 시 Vercel 빌드 fail 확정. v3 Phase B.2 `DeferredBestMatchPreview` 사건과 동일 패턴. **PR 1에 반드시 포함.**

## 2. 변경 분류 (8 functional groups)

### Group A — match-v2 코어 (atomic, 분할 불가)
- M `lib/tour-match-v2/{adapter-v1, matcher, parser-haiku, parser-rule}.ts`
- M `lib/tour-match-v2/data/matching_dimensions_taxonomy.json`
- A `lib/tour-match-v2/api-types.ts`
- D `lib/tour-product-match/*` (15 files)

### Group B — 매처 consumer (Group A 의존, 같이 가야 함)
- M `app/api/tour-product/{match,assistant}/route.ts`
- M `app/match/page.tsx`
- M `__tests__/lib/tour-match-v2/match-engine-smoke.test.ts`
- M `components/home/v2/HomeV2MatchProvider.tsx`
- M `lib/home/adapters/v2-best-match-result-vm.ts`
- M `lib/home/featured-join-tour-offer.ts`
- M `lib/tour-consumer-visibility.ts`
- M 스크립트: `scripts/match-haiku-live.ts`, `scripts/match-regression.ts`, `scripts/import-match-v18.mjs`, `scripts/_lib/matching-profile-validator.mjs`, `scripts/apply-tour-product.mjs`
- D 스크립트: `scripts/gen-{jeju-grand-highlights,southwest,}tour-product-sql.mjs`

### Group C — Hybrid settlement 모델 (메모리: authorize-then-settle)
- M `app/api/admin/orders/[id]/route.ts`
- M `app/admin/orders/{[id]/page,page}.tsx`
- M `app/api/bookings/route.ts`
- M `app/api/stripe/webhook/route.ts`
- M `app/api/settlements/route.ts`
- M `app/api/cron/recapture-holds/route.ts`
- M `lib/email.ts`
- M `components/admin/BookingStatusBadge.tsx`
- A `app/api/admin/orders/[id]/settle/` (신규 endpoint)
- + supabase migration `20260515120000_create_merchant_settlement_rpc.sql`
- + supabase migration `20260515122000_restrict_create_merchant_settlement_rpc.sql`

### Group D — Admin tour management
- M `app/admin/products/v2/_{components/ProductsListPane,hooks/types}.tsx?`
- M `app/api/admin/tours/{,[id]}/route.ts`
- M `app/api/tours/route.ts`
- A `app/api/admin/tour-content/` (신규 endpoint)

### Group E — Tour-mode + tour-rooms + mypage (신규 feature)
- A `app/api/tour-mode/`
- A `app/api/tour-rooms/`
- A `app/api/mypage/`
- A `lib/openai-server.ts`
- A `lib/stt-router.ts`
- M `app/mypage/page.tsx`
- M `app/merchant/orders/page.tsx`
- + supabase migration `20260515121000_tour_mode_and_translation_room.sql`
- + supabase migration `20260515123000_tour_room_message_metadata_and_spot_events.sql`

### Group F — Product detail + admin UI 폴리시
- M `app/tour-product/[slug]/page.tsx`
- M `components/product-tour-static/east-signature-nature-core/tour-detail-sections/TourHeroSection.tsx`
- M `components/product-tour-static/east-signature-nature-core/tour-product-v2-scope.css`

### Group G — Supabase helpers
- M `lib/supabase.ts` (shared — 어느 그룹에 포함시킬지 검토 필요)

### Group H — Docs + skills (위험 0, 본 세션 PR 7로 분리 권장)
- A `docs/{landing-page-uiux-audit-2026-05-16, landing-page-uiux-upgrade-plan-2026-05-17, landing-page-uiux-upgrade-plan-review-2026-05-17}.md`
- A `docs/{tour-product-detail-ui-ux-audit, ...-review-2026-05-17, ...-response-2026-05-17}.md`
- A `.claude/skills/{landing-page-uiux,tour-product-detail-uiux}/`
- A `docs/tour-match-v2-migration-audit-2026-05-17.md` (이 문서)

### Group I — Misc 스크립트 (낮은 가치, 보류 가능)
- 다양한 .py/.csv/.json 임시 스크립트 (scripts/_tmp-translate-missing-fields.py, scripts/cleanup_translations.py, scripts/poi-coord-audit.csv 등)
- + 신규 .mjs: scripts/deactivate-tour.mjs, scripts/finalize-seoraksan-naksansa-locales.mjs

## 3. 추천 랜딩 순서 (7 PR)

각 PR은 독립 커밋 + main 직 push (현 워크플로 따라). PR 1부터 순차 진행 권장.

| # | 제목 | 파일 수 | 의존 | 위험 |
|---|---|---|---|---|
| **PR 7** | docs + skills (이 audit 포함) | ~10 | — | **0** — 가장 먼저 |
| **PR 1** | feat: tour-match-v2 migration (A + B) | ~30 | — | 중 (atomic 30파일, 런타임 검증 필요) |
| **PR 4** | feat: tour-mode + rooms + mypage (E, 독립) | ~10 + 2 migration | — | 중 (신규 feature + DB) |
| **PR 2** | feat: hybrid settlement model (C) | ~10 + 2 migration | PR 1 | 중 (Stripe + 결제) |
| **PR 3** | feat: admin tour management (D) | ~5 + tour-content/ | PR 1 | 낮음 |
| **PR 5** | feat: product detail + admin 폴리시 (F + G) | ~5 | — | 낮음 |
| **PR 6** | chore: drop legacy `tour_matching_profiles` table | 1 supabase mig | **PR 1 production live + 무사고 1주 후** | 높음 (DB DROP) |

### 위험 완화 가이드

- **PR 1**은 atomic이라 분할 불가. 커밋 본문에 변경 내역(매처 알고리즘 차이, 정확도 회귀 측정, fallback 동작 등)을 상세 기록해 future bisect 가능하게.
- **PR 2/4**의 supabase migration은 `npx supabase migration up` 또는 `mcp__atockorea__apply_migration`로 단계별 검증 후 production 적용.
- **PR 6**은 PR 1 → production live + observation period 1주 후만 실행. 롤백 시 legacy 데이터 필요할 수 있음.

## 4. 즉시 액션 항목 (low risk wins)

- ✅ **PR 7 (이 audit + skills + 마스터 플랜 참조 docs)** — 본 세션에서 처리
- 다음 세션:
  - PR 1 (match-v2 코어)
  - PR 4 (tour-mode 신규 feature)
- 그 후 순차

## 5. 미해결 결정

| 항목 | 결정 필요 |
|---|---|
| Group G `lib/supabase.ts` | 변경 내용 확인 후 PR 1 또는 PR 2/3/4 중 가장 의존도 높은 곳에 포함 |
| Group I 스크립트 묶음 | 보존 가치? 임시 스크립트면 staged 안 함 |
| supabase migration `20260514120000_drop_legacy_tour_matching_profiles.sql` (untracked) | PR 6 시점 결정 |

## 6. 회귀 측정 권장

PR 1 production live 후:
- 매처 CTA 클릭률 (Phase 0a `home_cta_click` source=hero_planner_match) — baseline 대비 변화
- 매처 결과 카드 클릭률 (`home_cta_click` source=best_match_result_primary)
- 에러율 (Sentry / Vercel logs)
- 사용자 클레임 (지원 채널)

Phase 0b provider 의사결정 후 본격 정량 추적. Phase 0b 미확보 시 정성 + 직관 판단만.
