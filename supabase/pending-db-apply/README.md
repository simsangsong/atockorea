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
| `2026-06-24-01-seoul-suwon-hwaseong-waujeongsa-starfield.sql` | ⏳ pending | **Waujeongsa** tour: add Hwaseong Haenggung stop → 4 stops (화성+행궁+스타필드+와우정사). Upserts `tours` (price **US$51**), `tour_product_pages` ×6 locales `detail_payload`, default `tour_product_offers` (5100 minor). |
| `2026-06-24-02-seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library.sql` | ⏳ pending | **Gwangmyeong Cave** tour: remove Nammun Market → 6 stops; lunch at Starfield. `tours` (price **US$53**), `tour_product_pages` ×6, offer (5300 minor). |
| `2026-06-24-03-seoul-suwon-hwaseong-folk-village-starfield-library.sql` | ⏳ pending | **Folk Village** tour: price **US$53→US$60**. `tours`, `tour_product_pages` ×6, offer (6000 minor). |
| `2026-06-24-04-seoul-seoraksan-nami-island-morning-calm-day-tour.sql` | ⏳ pending | **Seoraksan + Nami + Morning Calm**: price **US$71**. `tours`, `tour_product_pages` ×6, offer (7100 minor). |
| `2026-06-24-05-seoul-seoraksan-naksansa-temple-naksan-beach-day-trip.sql` | ⏳ pending | **Seoraksan + Naksansa + Naksan Beach**: price **US$53**. `tours`, `tour_product_pages` ×6, offer (5300 minor). |
| `2026-06-24-06-match-tours-seoul-bus-tours.sql` | ⏳ pending | Recommender sync for the 5 tours above: `UPDATE match_tours` matching_profile/matching_metadata/full_document + derived `text[]` cols (waujeongsa +haenggung anchor; gwangmyeong −nammun_market, food_fit 0.65). **UPDATE-only** — if a row is missing run `node scripts/import-match-v18.mjs --single <slug>`. |
| `2026-06-24-07-jeju-eastern-unesco-spots-day-tour.sql` | ⏳ pending | Re-course **jeju-eastern-unesco-spots-day-tour**: Hamdeok → Seongeup → lunch → Seongsan Ilchulbong (UNESCO) → live **haenyeo diving performance** (Haenyeo Museum fallback) → **Manjanggul** lava tube (UNESCO) → drop-off. Upserts `tours` (price **US$47**, was $59), `tour_product_pages` × **6 locales** (en/ko/ja/zh/zh-TW/es) `detail_payload`, default `tour_product_offers` (4700 minor), and `tour_matching_profiles` (profile_version **7**, twin-WHS rescore, poi_tags micheon→manjanggul). Regenerate with `node scripts/gen-jeju-east-recourse-sql.mjs`. **Recommender:** after applying, run `node scripts/import-match-v18.mjs --single jeju-eastern-unesco-spots-day-tour` to refresh `match_tours` + `match_itinerary_stops` (unless `match_tours` is a view over the tables above). |
| `2026-06-24-08-agent-reservations.sql` | ⏳ pending | **AI Agent Channel (Phase 3):** create **`public.agent_reservations`** — an isolated table for reservation leads from the agent channel (`/api/agent/v1/book` + MCP `create_booking`). Decoupled from `bookings`/`product_inventory` (agent never charges a card or holds inventory); idempotency-key unique, RLS enabled (service-role only). The booking handoff persists best-effort and degrades gracefully until this is applied, so order doesn't matter. **Not** part of the tour-content batch above. |
| `2026-06-24-09-agent-channel-events.sql` | ⏳ pending | **AI Agent Channel (Phase 5):** create **`public.agent_channel_events`** — append-only telemetry for the agent funnel (`quote_issued`, `booking_handoff`, `availability_checked`, `mcp_tool_call`, …). No raw IP stored (bot User-Agent only); RLS enabled (service-role only). Agent endpoints log best-effort and degrade gracefully until applied. Standalone. |
| `2026-06-24-10-agent-reservations-updated-at.sql` | ⏳ pending | **AI Agent Channel:** BEFORE UPDATE trigger so `agent_reservations.updated_at` refreshes on status changes. Dedicated trigger fn (no global clobber). **Depends on file 08.** |

## Notes

- `match_tours` is the source the matcher reads (`lib/tour-match-v2/fetch-tours.ts`).
  If it is a **view** over `tour_product_pages` / `tour_matching_profiles`, these
  upserts propagate automatically. If it is a **materialized view or table**,
  refresh / re-sync it after applying (`REFRESH MATERIALIZED VIEW ...`).
- Static JSON in `components/product-tour-static/jeju-grand-highlights-loop/`
  is already updated and merged; it is the authoring source + render fallback.
  The DB rows above are what the live page reads first.
