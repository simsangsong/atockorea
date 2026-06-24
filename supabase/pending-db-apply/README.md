# supabase/pending-db-apply

SQL that is **ready but not yet applied** to the live Supabase project. This
folder is a staging area so a later session (or a maintainer with DB access)
can batch-upload everything at once.

## How to apply

Run each `.sql` file against the linked project, e.g.:

```bash
supabase db query --linked < supabase/pending-db-apply/<file>.sql
# or paste into the Supabase SQL editor
```

All files here are written to be **idempotent** (safe to run more than once)
and are generated from the in-repo source of truth (JSON bundles / scripts),
so re-running them only re-syncs the DB to the committed content.

After a file has been applied to production, move it to `supabase/_archive/`
(or delete it) and note the apply date in the commit message.

## Pending files

| File | What it does | Source of truth |
|---|---|---|
| `2026-06-24_seoul-suburbs-private-sample-itineraries.sql` | Merges the `sampleItineraries` key into `tour_product_pages.detail_payload` for `seoul-suburbs-private-chartered-car-10hr` (6 locales). | `components/product-tour-static/seoul-suburbs-private-chartered-car-10hr/*.json` via `scripts/apply-sample-itineraries.py` |
