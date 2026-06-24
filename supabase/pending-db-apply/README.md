# `supabase/pending-db-apply/`

A staging area for SQL that needs to be applied to the Supabase database but
**could not be applied from the session that authored it** — typically a cloud
/ headless session that has no direct database access (no Supabase MCP, no
`psql`).

Drop SQL here, and a later session (or person) with DB access applies
everything in one batch.

## Rules

1. **One file per change.** Name it `YYYYMMDDHHMMSS_short_description.sql`,
   matching `supabase/migrations/` so ordering is unambiguous.
2. **Idempotent only.** Use `create table if not exists`, `create index if not
   exists`, `... if not exists`, `on conflict do nothing`, etc. The batch may be
   run more than once (or partially overlap with what's already live), so every
   file must be safe to re-run.
3. **Header comment on every file:** what it does, who authored it, whether it
   was *already applied live* (and how), and any ordering dependency.
4. **Status is tracked in the table below.** Update it when you add a file and
   when it's applied.

## How to batch-apply (session with DB access)

1. Read every `*.sql` here in filename (timestamp) order.
2. Apply each via the Supabase MCP `apply_migration` (preferred — records it in
   `supabase_migrations.schema_migrations`) or `execute_sql`.
3. Verify (table/column/index exists, RLS as intended).
4. Move the applied file into `supabase/migrations/` (so local migration history
   matches the DB) **or** delete it, and mark it ✅ below.

## Status

_Empty — nothing pending. All staged SQL has been applied and moved to
`supabase/migrations/`._

| File | Change | Authored | Applied to prod? |
|---|---|---|---|
| `20260624033518_create_chat_memory.sql` | `chat_memory` table (Track 3.2 rolling cross-session chatbot memory) | 2026-06-24 | ✅ applied live via MCP `apply_migration` (migration `20260624033518`). **Moved to `supabase/migrations/` on 2026-06-24** after a batch-apply pass confirmed it live. |
