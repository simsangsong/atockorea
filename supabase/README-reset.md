# Pre-launch Database Reset — Runbook

This folder contains a **one-way** reset procedure used on 2026-04-22 to
transition from "prototype with many exploratory pipelines" to the
launch-ready baseline: **East Signature Nature Core** and **Jeju Grand
Highlights Loop** as the only products, matching engine as the only
intent pipeline, AtoC Korea as the sole merchant.

> ⚠️  This is intended for **pre-launch** only (no real customer data).
> After go-live, use targeted migrations instead.

---

## 0. What will change

### Code (already applied in this commit)

Deleted feature verticals:

- Itinerary parser + NL plan pipeline (`lib/itinerary/`, `lib/parser/`,
  `app/api/itinerary/`, `app/api/admin/itinerary-parser-preview/`)
- Places / POI ingestion (`lib/places-lookup.ts`, `lib/places-embedding.ts`,
  `lib/jeju-photo-gallery/`, `app/admin/pois/`, `app/api/admin/pois/`,
  `app/api/admin/seed-places-overviews/`, `app/api/places/`)
- Travel-time caches (`lib/travel-time/`)
- Tour-mode (`app/api/tour-mode/`, bus / guide-spots / facilities admin
  routes under `app/api/admin/tours/[id]/`)
- Custom-join-tour feature (`app/custom-join-tour/`, `app/api/custom-join-tour/`)
- Saved itineraries (`app/api/saved-itineraries/`, `app/mypage/saved-itineraries/`)
- Legacy "premium" homepage components (`src/components/home/*Premium*`,
  `PremiumHomePage.tsx`, etc. — replaced by `components/home/v2/`)
- Scripts: `scripts/jeju-tourapi/`, `scripts/import-jeju-*.ts`,
  `scripts/score-jeju-places.ts`, `scripts/jeju-photo-gallery-backfill.ts`

Retained code paths: tour detail v2 template, small-group tour registry,
`scripts/gen-tour-product-sql.mjs`, homepage v2, checkout, reviews,
user profiles, merchant admin, email CRM.

### Database (applied by the scripts in this folder)

**Dropped** (14 tables + related functions):
`parsed_intent_cache`, `request_profiles`, `request_parse_logs`,
`itinerary_generation_logs`, `itinerary_runs`, `itinerary_templates`,
`saved_itineraries`, `places`, `jeju_kor_tourapi_places`, `poi_reco_features`,
`travel_time_edges`, `endpoint_travel_cache`, `tour_bus_details`,
`tour_guide_spots`, `tour_facilities`, `proposed_tours`, `tour_mode_*`.

**Truncated** (rows wiped, table shape kept): all product/order/review/
CMS tables listed in `02-truncate-reset-data.sql`.

**Preserved**: `auth.users` rows + `public.user_profiles` rows for the
admin accounts you allow-list before running Step 3.

### Legacy migrations

All 51 migrations under `supabase/migrations/` and 36 root `.sql` files
were moved to `supabase/_archive/<timestamp>/` (git-tracked, recoverable).
The new canonical migration history starts at step 6 below.

---

## 1. Backup the current database

Choose **one** of:

**Supabase Dashboard (recommended, quickest)**
1. Open project in Supabase Dashboard.
2. Database → Backups → **Create manual backup**.
3. Wait until the backup status shows "completed".

**Supabase CLI (gives you a file you can keep)**
```powershell
# Requires `supabase` CLI installed (npm i -g supabase) and linked project.
supabase db dump --db-url "$env:SUPABASE_DB_URL" --schema public -f ".\supabase\_archive\pre-reset-snapshot.sql"
```

Do not continue until the backup is confirmed.

---

## 2. (Dashboard only) Delete non-admin auth users

Supabase SQL Editor cannot write to `auth.users`. Do this in the UI.

1. Dashboard → Authentication → Users.
2. Sort by email. Select every row whose email is **not** an admin you
   want to keep.
3. Click "Delete user" for each. Their `user_profiles` row will be wiped
   by the `DELETE` in step 3 automatically.

If you have no non-admin test users yet, skip this step.

---

## 3. Run the two SQL scripts in order

Open **SQL Editor** in Supabase Dashboard.

### 3a. Drop dead tables

Paste the contents of `supabase/manual/01-drop-dead-tables.sql` and run.
Expected: no errors; returns "Success. No rows returned." All DROP
statements use `IF EXISTS` so they are idempotent.

Sanity check (paste into SQL Editor after the script):
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```
None of the 14 dropped tables should appear.

### 3b. Truncate test data + keep admin

Open `supabase/manual/02-truncate-reset-data.sql` and **edit the admin
email allow-list** near the bottom:

```sql
DELETE FROM public.user_profiles
WHERE id NOT IN (
  SELECT id FROM auth.users
  WHERE email IN (
    'admin@atockorea.com'  -- ← replace with your real admin email(s)
  )
);
```

Paste and run. Expected: no errors.

Sanity check:
```sql
SELECT COUNT(*) FROM public.tours;             -- expect 0
SELECT COUNT(*) FROM public.user_profiles;      -- expect N admin rows
SELECT COUNT(*) FROM public.bookings;           -- expect 0
```

---

## 4. Create one merchant row for AtoC Korea

Every `tours` row needs a `merchant_id`. Create one before seeding.

```sql
INSERT INTO public.merchants (
  user_id,
  company_name,
  contact_person,
  contact_email,
  contact_phone,
  status,
  is_verified
) VALUES (
  (SELECT id FROM auth.users WHERE email = 'admin@atockorea.com' LIMIT 1),
  'AtoC Korea',
  'AtoC Korea Operations',
  'admin@atockorea.com',
  '+82-10-0000-0000',
  'active',
  true
)
RETURNING id;
```

Copy the returned `id` (merchant UUID) into the generator config. The
generator reads `FEATURED_MERCHANT_ID` from `scripts/_lib/tour-product-sql-config.mjs`
(create / update that file if needed), **or** hardcode the UUID when
pasting the seed SQL in step 5.

---

## 5. Re-seed East + Jeju via the generator

From the repo root:

```powershell
# East Signature Nature Core (flagship small-group)
node scripts/gen-tour-product-sql.mjs east-signature-nature-core > .\supabase\manual\seed-east.sql

# Jeju Grand Highlights Loop
node scripts/gen-tour-product-sql.mjs jeju-grand-highlights-loop > .\supabase\manual\seed-jeju.sql
```

Each generated SQL file contains:
- `INSERT INTO tours` (one row)
- `INSERT INTO tour_product_pages` (six locales)
- `INSERT INTO tour_product_offers` (sticky bar pricing)
- `INSERT INTO tour_matching_profiles` (matching engine data)

Open each `seed-*.sql`, paste into SQL Editor, and run. Verify:

```sql
SELECT slug, city, is_active FROM public.tours ORDER BY slug;
-- expect two rows: east-signature-nature-core, jeju-grand-highlights-loop

SELECT product_id, COUNT(*) AS locales
FROM public.tour_product_pages
GROUP BY product_id;
-- expect 6 per product

SELECT product_id FROM public.tour_matching_profiles;
-- expect two rows (one per product)
```

### When you only swap a language JSON later

If you edit one of the locale JSON files (e.g. `jeju-grand-highlights-loop.ja.json`)
without changing pricing / matching, re-run the generator and re-execute the
`INSERT INTO tour_product_pages ... ON CONFLICT DO UPDATE` block only. The rest
is idempotent either way.

---

## 6. Export the new baseline migration

Now that the DB reflects the launch baseline, snapshot it as migration 0:

```powershell
supabase db dump --db-url "$env:SUPABASE_DB_URL" --schema public `
  -f ".\supabase\migrations\00000000000000_launch_baseline.sql"
```

Open that file, sanity-check that:
- No dropped tables appear
- All KEEP tables appear with final column set
- RLS / policies / triggers / functions are present

Commit it. From this point forward, every schema change must be a new
timestamped migration file **after** this baseline.

---

## 7. Smoke test the live app

```powershell
npm run dev
```

Open:
- `http://localhost:3000/` — homepage hero "See My Best Matches" should
  return one of the two seeded products.
- `http://localhost:3000/tour-product/east-signature-nature-core` — all
  six locales render.
- `http://localhost:3000/tour-product/jeju-grand-highlights-loop` — same.
- `http://localhost:3000/mypage` — admin can sign in; no
  saved-itineraries menu item; no custom-join-tour references anywhere.
- `http://localhost:3000/cart` / checkout — works against a seeded tour.

Run `npx tsc --noEmit` to confirm the code side is still clean.

---

## Rollback

If the reset produced an incorrect state:

1. In Supabase Dashboard → Database → Backups, restore the manual backup
   you took in step 1.
2. Run `git restore supabase/` to pull the archived migrations back out
   of `_archive/` (they remain in git history either way).
3. Restart the dev server.

---

## What NOT to do after this reset

- ❌ Re-introduce migrations that reference dropped tables — they will
  silently fail or re-create dead schema.
- ❌ Seed tours via the legacy `insert-*.sql` files in `_archive/`.
  They reference columns that no longer exist or use outdated shapes.
  Always use `scripts/gen-tour-product-sql.mjs` from now on.
- ❌ Add `places` / `itinerary_*` / `travel_time_*` tables without a
  matching frontend feature — the code that used them is deleted.
