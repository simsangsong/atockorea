# supabase/pending-upload — staging area for SQL to batch-apply

This folder collects **idempotent** seed/update SQL that still needs to be run
against the production Supabase database (the project connected to the current
agent session does **not** contain the `tours` / `tour_product_pages` /
`tour_matching_profiles` tables, so these files could not be applied here).

In a later cloud session that **is** connected to the production DB, apply every
`*.sql` in this folder in one batch (each script wraps its statements in
`BEGIN; … COMMIT;` and is safe to re-run):

```bash
for f in supabase/pending-upload/*.sql; do
  echo "applying $f"
  psql "$DATABASE_URL" -f "$f"
done
```

Or paste each file into the Supabase SQL editor.

## Files

| File | What it does |
| --- | --- |
| `insert-jeju-eastern-unesco-spots-day-tour-product.generated.sql` | Re-courses the Jeju Eastern UNESCO day tour: new itinerary (Manjanggul Lava Tube + live haenyeo diving performance, lunch moved ahead of Seongsan), price **US$47** (was $59), refreshed `detail_payload` (full EN view-model), and updated `tour_matching_profiles`. Idempotent: `tours` `ON CONFLICT (slug)`, `tour_product_pages` `ON CONFLICT (slug, locale)`, `tour_matching_profiles` `ON CONFLICT (product_id)`. Regenerate with `node scripts/gen-jeju-east-recourse-sql.mjs`. |

The same file is also kept in `supabase/manual/` as the canonical generated seed.

> After applying, the trailing `SELECT` statements echo the affected rows so you
> can confirm price, published pages, and the matching profile updated.
