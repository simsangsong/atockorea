# supabase/pending-db-apply

Staging area for SQL that must be applied to the **production** `tour_product_pages`
(and related) tables in a later session / environment that has database access.

The connected dev Supabase project does **not** contain `tour_product_pages`
(the consumer tour-product pages fall back to the static JSON bundles under
`components/product-tour-static/`), so data edits made here cannot be applied to
the live DB from this session. Each file below mirrors a static-bundle change and
should be run together when a session with production DB access is available.

## How to apply

Run each `.sql` file once (they are idempotent — safe to re-run):

```bash
psql "$DATABASE_URL" -f supabase/pending-db-apply/<file>.sql
# or paste into the Supabase SQL editor
```

After applying, delete the file (or move it to `supabase/manual/_archive/`) so the
folder only ever holds **not-yet-applied** SQL.

## Files

| File | What it does |
|---|---|
| `update-jeju-island-private-car-charter-tour-detail-payload.sql` | Surgical `jsonb_set` on `detail_payload` for the Jeju private car charter tour (6 locales): itineraryStops → 3 sample route slots (East/South/Southwest), `whyTourWorks.routeLogicSections` → `[]`, refreshed `practicalAccordionItems` (only admission + meals excluded), `hero.pills[2]` → East/South/Southwest, and a new `privateTourPolicy` rules block. Preserves `hero.imageUrl`, gallery images and all card/seo/price columns. UPDATE-only (no-op if the row is absent — run the product's full insert first). |
