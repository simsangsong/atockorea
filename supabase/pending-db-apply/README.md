# Pending DB apply — staging area

SQL changes that are **committed in the repo but NOT yet applied to the live
consumer Supabase database** (the project that holds `tour_product_pages`,
`tour_matching_profiles`, `match_tours`, `tours`, `tour_product_offers`).

## Why this folder exists

Some Claude Code / cloud sessions cannot reach the consumer Supabase project
through MCP (they only see unrelated projects). When that happens, the SQL is
generated and dropped here so a **later session that IS connected to the
correct project can batch-apply everything at once**, in filename order.

## How to apply

Run every file **in filename order** against the consumer DB
(`tour_product_pages` etc. must exist). Each file is a single idempotent
transaction (`BEGIN … COMMIT`, `ON CONFLICT … DO UPDATE`), so re-running is safe.

- Supabase SQL editor: paste each file and run, oldest filename first, **or**
- `psql "$DATABASE_URL" -f supabase/pending-db-apply/<file>.sql`
- MCP: `mcp__Supabase__execute_sql` with the file contents.

Each file ends with verification `SELECT`s — check their output after running.

After a file is confirmed applied, move it to `supabase/pending-db-apply/applied/`
(or delete it) and tick it off in the manifest below.

## Naming convention (for future sessions)

`YYYY-MM-DD-NN-<short-slug>.sql` — date the change was generated, a 2-digit
order number for that day, then a short description. Append a manifest row.

## Manifest

| File | Status | What it does |
|------|--------|--------------|
| `2026-06-23-01-jeju-grand-highlights-loop-all-locales.sql` | ⏳ pending | Republish **jeju-grand-highlights-loop** as the 7-stop UNESCO grand-loop course (Hallasan 1100 → Jusangjeolli → Jeongbang → lunch → Seongsan haenyeo show → Seongsan Ilchulbong → Manjanggul). Upserts `tours`, `tour_product_pages` × **6 locales** (en/ko/ja/zh/zh-TW/es) `detail_payload`, `tour_product_offers` (US$100 / 10000 minor units), and `tour_matching_profiles` (profile_version 6, refreshed scores). |

## Notes

- `match_tours` is the source the matcher reads (`lib/tour-match-v2/fetch-tours.ts`).
  If it is a **view** over `tour_product_pages` / `tour_matching_profiles`, these
  upserts propagate automatically. If it is a **materialized view or table**,
  refresh / re-sync it after applying (`REFRESH MATERIALIZED VIEW ...`).
- Static JSON in `components/product-tour-static/jeju-grand-highlights-loop/`
  is already updated and merged; it is the authoring source + render fallback.
  The DB rows above are what the live page reads first.
