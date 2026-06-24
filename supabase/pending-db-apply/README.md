# supabase/pending-db-apply

SQL that must be applied to the **remote** Supabase project but could not be
applied from the cloud session that generated it (no service-role credentials in
that environment). Files here are staged so a later session — or a human with DB
access — can batch-apply them together.

## How to apply

Each `.sql` file is **idempotent** (uses `ON CONFLICT … DO UPDATE` / insert-if-absent
+ explicit price update) and wrapped in a single `BEGIN; … COMMIT;`. Apply with any
of:

- Supabase SQL editor (paste the file), or
- `psql "$DATABASE_URL" -f <file>.sql`, or
- the Supabase MCP `apply_migration` / `execute_sql` tools.

Apply in filename (date) order. After applying, you may delete the file (or move it
to `supabase/_archive/`).

## Files

| File | What it does |
| --- | --- |
| `2026-06-24-jeju-southern-top-unesco-spots-tour-route-change.sql` | Syncs the DB to the new **Jeju Southern (Seogwipo) Signature Day Tour** itinerary (Jeongbang Falls → Oedolgae & Olle 7 → Yakcheonsa → Lunch → Osulloc → Hallasan Eoseungsaengak). Updates `tours`, `tour_product_pages` (6 locales, `detail_payload`), `tour_product_offers` (price → USD 49 / ₩≈72,000), `tour_matching_profiles`, and `match_tours` (recommender `matching_profile` + `matching_metadata` + index columns). Pickup/drop-off points unchanged. |

> Note: the static catalog/registry price (`staticTourProductRegistry.ts`,
> `staticTourCatalogCards.ts`) is already committed in the repo as `listPriceUsd: 49`,
> so the static `/tour-product/[slug]` "From" price updates at build time without DB.
> The SQL above is what updates the **DB-backed** detail page, booking offer, and
> recommender.
