# `supabase/pending-db-apply/` — staged SQL inbox

A holding area for **ad-hoc SQL that has been authored but not yet applied** to
the live database. Cloud/agent sessions that change code which *needs* a DB
change but cannot (or should not) run it themselves drop the `.sql` here so a
later, DB-authorized session can review and apply everything in **one batch**.

This is **not** the migrations folder. Tracked schema changes still belong in
`supabase/migrations/` and ship via `supabase db push`. This inbox is for SQL
that, for whatever reason, a session couldn't apply in the moment — one-off
backfills, data fixes, or migrations awaiting a session with DB credentials.

## Conventions

- **One change per file.** Name files with an ordered, sortable prefix so the
  batch applies in a deterministic order:
  `NNNN-short-description.sql` (e.g. `0001-backfill-cruise-port.sql`).
- **Make each file idempotent** where possible (`IF NOT EXISTS`,
  `ON CONFLICT DO NOTHING`, guarded `UPDATE ... WHERE`) so a re-run is safe.
- **Header comment** at the top of every file: what it does, why it couldn't be
  applied in-session, which branch/PR/commit produced it, and the date.
- After a file is successfully applied, **move it to `applied/`** (or delete it)
  and record it in the log below — don't leave applied SQL sitting here.

## How to apply (for the DB-authorized session)

1. Confirm the **target project**. The app's `supabase/config.toml` declares
   `project_id = "atockorea"`. ⚠️ A previous session found the Supabase MCP
   connected only to a *different* project (`Kursoflow` /
   `thgyevrqykkscvcpwmfp`) whose migration history does **not** overlap this
   repo's `supabase/migrations/`. Verify you are pointed at the right
   `atockorea` project before running anything.
2. Apply files in filename order (e.g. via the SQL editor, `supabase db
   execute`, or the MCP `apply_migration` tool).
3. Move applied files to `applied/` and update the log.

## Pending files

_(none — this inbox is currently empty)_

## Apply log

| Date | File | Project | Applied by | Notes |
|------|------|---------|-----------|-------|

## Session notes

- **2026-06-24 — cruise private pricing + schedule
  (`claude/cruise-private-pricing-schedule-64r4cr`, merged to `main`):**
  **No SQL required.** The cruise premium (`₩50,000` flat + `₩20,000` Gangjeong
  distance surcharge) lives entirely in `lib/quote-engine/pricing-policy.ts`
  (a pure, DB-free module) and i18n JSON. The selected docking port
  (`cruise_port`) and the itemized price `breakdown` are persisted inside the
  existing `bookings.itinerary` jsonb column — no schema or data migration.
