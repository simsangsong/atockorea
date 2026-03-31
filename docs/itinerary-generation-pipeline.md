# Itinerary generation pipeline (Jeju POI)

## Overview

End-to-end flow for `/itinerary` (tour-style day planning) using **`jeju_kor_tourapi_places`** as the only source of place facts. LLMs **select and order** IDs from a server-built candidate list; they do not invent venues or operational details.

## Data flow

1. **Client** (`app/itinerary/page.tsx`) collects preferences (destination, group, indoor/outdoor, rainy, hours, must-see keyword, duration).
2. **POST `/api/itinerary/generate`** (`app/api/itinerary/generate/route.ts`):
   - Loads **20–55 candidates** via `lib/itinerary/candidate-query.ts` (excludes `manual_hidden`, sorts by `manual_priority`, `base_score`, data quality).
   - **Gemini** (`lib/itinerary/gemini-generate.ts`): JSON draft with `{ tourTitle, tourSummary, stops: [{ contentId, contentTypeId, reason, plannedDurationMin, sortOrder }] }`. JSON mode + schema validation (Zod).
   - **Claude** (`lib/itinerary/claude-review.ts`): reviews draft against the same candidate JSON + user prefs; removes invalid IDs, duplicates, and tightens time budget messaging.
   - **Fallback**: if Gemini fails → `lib/itinerary/rule-based-fallback.ts`. If Claude fails → keep Gemini draft.
   - **Validation** (`lib/itinerary/validation.ts`): dedupe, filter unknown/hidden IDs, optional time trim.
   - **Hydration** (`lib/itinerary/merge-poi-details.ts`): merge full DB rows for each stop (addresses, images, fees, admin notes, tags).
3. **Response** matches `GeneratedItineraryResponse` in `lib/itinerary/types.ts`.
4. **Optional log** row in `itinerary_generation_logs` (reduced `user_input`, raw model text, truncated).

## Admin dashboard

- **List**: `/admin/pois` — search, region, hidden, sort, pagination; stats cards (`/api/admin/pois/stats`).
- **Edit**: `/admin/pois/[id]` — numeric primary key (`id` column). Updates notes, short descriptions, duration, scores, tags, `manual_hidden` via **PATCH `/api/admin/pois/[id]`** (requires admin session + service role on server).

Admin edits are **manual signals** (`manual_priority`, `admin_short_desc_*`, `recommended_duration_min`, scores). The batch `base_score` from `npm run score:jeju:places` is complementary; generation reads live DB values at request time.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only; candidate fetch, logs, admin API writes |
| `GEMINI_API_KEY` | Gemini API |
| `GEMINI_MODEL` | e.g. `gemini-2.0-flash` (override per project) |
| `ANTHROPIC_API_KEY` | Claude Messages API |
| `ANTHROPIC_MODEL` | e.g. `claude-sonnet-4-20250514` |

## Migrations

- `20250322170000_jeju_kor_tourapi_places_scoring.sql` — scoring / classification columns (if not already applied).
- `20250323120000_jeju_poi_admin_fields_and_logs.sql` — `admin_note_*`, `admin_short_desc_*`, `recommended_duration_min`, `admin_tags`, `updated_by`, `admin_updated_at`, `itinerary_generation_logs`.

Apply via Supabase SQL or `supabase db push`.

## Testing

1. Apply migrations; ensure `jeju_kor_tourapi_places` has rows.
2. Set env vars locally in `.env.local`.
3. `npm run dev` → open `/itinerary` → Generate.
4. Admin: sign in as `user_profiles.role = admin` → `/admin/pois` → edit a row → Save (toast).

## Legacy

- **`POST /api/generate`** — older demo (Gemini + Maps + Claude) **unchanged**; new flow is **`/api/itinerary/generate`** only.

## TODO / extensions

- Bulk hide/show for selected rows.
- Stronger geographic distance checks (needs coords + haversine).
- Virtualized table for very large POI tables.
- Per-user saved itineraries table (optional).
