# supabase/pending-upload — SQL staged for batch DB upload

This folder collects **ready-to-apply SQL** that could not be run against the
live Supabase DB from the cloud session that generated it (no DB credentials in
the sandbox). Apply everything here in one batch from a session/machine that has
DB access, then delete the applied files (or move them to `supabase/_archive/`).

All files are **idempotent** (re-running is safe).

## 2026-06-24 — Seoul bus-tour update (5 products)

Schedule/price/i18n changes already merged to `main` in the static JSON + catalog.
These SQL files push the same changes to the DB-backed tables.

**Apply order:**

1. `insert-<slug>-product.generated.sql` ×5 — `tours` + `tour_product_pages`
   (all 6 locales, full `detail_payload`) + default `tour_product_offers`.
   - seoul-suwon-hwaseong-waujeongsa-starfield  ($51, 4 stops, +Haenggung)
   - seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library  ($53, 6 stops, −Nammun Market)
   - seoul-suwon-hwaseong-folk-village-starfield-library  ($60)
   - seoul-seoraksan-nami-island-morning-calm-day-tour  ($71)
   - seoul-seoraksan-naksansa-temple-naksan-beach-day-trip  ($53)

2. `update-match-tours-seoul-bus-tours.generated.sql` — refreshes
   `match_tours.matching_profile / matching_metadata / full_document` + derived
   `text[]` columns for the recommender. **UPDATE-only**: rows must already exist.
   If a slug has no `match_tours` row yet, instead run:
   `node scripts/import-match-v18.mjs --single <slug>` (needs SERVICE_ROLE key).

**Regeneration:** `node scripts/gen-tour-product-sql.mjs <slug...> --out-dir supabase/pending-upload`
(mirrors `scripts/apply-tour-product.mjs`). The product `tours.original_price`
is `NULL` by design — the strike-through compare-at price lives only in the
static registry (`staticTourProductRegistry.ts`), not the DB.

> Note: prices are KRW B2B converted to USD at 1480 KRW/USD and stored in USD.
