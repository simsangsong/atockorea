# `tour_matching_profiles` — source of truth

- **Runtime / production:** rows in Supabase `public.tour_matching_profiles` (apply migrations, then optional manual SQL or patch migrations).
- **Local & `TOUR_MATCH_PROFILE_SOURCE=seed`:** `lib/tour-product-match/seed-profiles.ts` should match the DB after migrations (avoid drift when falling back to seed).
- **Legacy / reference:** `supabase/manual/upsert-tour-matching-profiles-three-products.sql` and per-product `insert-*-product.sql` files; treat as historical unless you intentionally regenerate them.

Patch-only updates (e.g. `20260415220000_patch_tour_matching_profiles_v3.sql`) intentionally avoid editing those large manual INSERT files.

- **Traveler intent:** `TravelerIntentV1.desired_product_type` / `product_type_intent_strength` (from Gemini) take precedence for product-type gating; if both are unset, `mergeDeterministicIntentBoost` + `parseProductTypeIntent(rawText)` fill them before scoring (`resolveProductTypeIntent`).
- **`POST /api/tour-product/match`:** returns `matchOutcome`, `noMatchReason`, capped/slim `matchedProducts` & `ranked`, `resolvedProductTypeIntent`, `textParserProductTypeIntent`, `fallbackAvailable`, and `winner: null` when nothing is eligible. Supabase reads use `TOUR_MATCHING_PROFILE_COLUMNS` (no `*`). Default log line includes `gemini_ms`, `db_ms`, `scoring_ms`, `explanation_ms`, `total_ms`. Set `TOUR_MATCH_TRACE_LOG=1` for raw text + top channel rows (computed only when enabled). Gemini intent failure falls back to `emptyTravelerIntent()` so scoring still runs.
