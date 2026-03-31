# Deployment QA — Itinerary / Admin / Saved itineraries

**Scope:** `/api/itinerary/generate`, `lib/itinerary/*`, `/api/admin/pois/**`, `/admin/pois/**`, itinerary result UI, saved itineraries, pipeline logging.  
**Review type:** Static code review + targeted fixes (no production traffic). Re-run manual checks after deploy.

---

## A. Functional QA

| Check | Status | Notes |
|-------|--------|--------|
| 1. `/itinerary` generation success | **Pass (code)** | `POST /api/itinerary/generate` → validate → hydrate → JSON; requires candidates & env as documented. |
| 2. Claude failure → Gemini-only | **Pass (code)** | On Claude error, draft from Gemini/rule is kept; `claudeReviewSummary` omitted; event `claude_reviewed` with `success: false`. |
| 3. Full AI failure → rule-based | **Pass (code)** | No `GEMINI_API_KEY` or Gemini exception → `buildRuleBasedDraft`; empty stops after validation → recovery draft + warning. |
| 4. `/admin/pois` list/filter/pagination | **Pass (code)** | Query params: `search`, `region_group`, `manual_hidden`, `sort`, `order`, `limit`, `offset`, `boosted`; returns `rows`, `total`. |
| 5. `/admin/pois/[id]` save | **Pass (code)** | `PATCH` whitelisted fields + `updated_by`; service-role server client. |
| 6. Saved itineraries CRUD | **Pass (code)** | `/api/saved-itineraries` uses user JWT + RLS; flows wired from UI. |

---

## B. Security QA

| Check | Status | Notes |
|-------|--------|--------|
| 1. `requireAdmin` on admin POI APIs | **Pass (code)** | `GET`/`PATCH` list & detail & stats call `requireAdmin`. |
| 2. Service role server-only | **Pass (code)** | `createServerClient()` uses `SUPABASE_SERVICE_ROLE_KEY` only in API/server; not exposed to client bundles. |
| 3. Non-admin cannot access `/api/admin/pois` | **Pass (fixed)** | `requireRole` throws `Forbidden: Insufficient permissions`. Catch blocks now return **403** via `httpStatusForAuthError` (previously list route could return 401 for forbidden). |
| 4. Logs — sensitive data | **Pass (fixed)** | `itinerary_generation_logs.final_result` now uses **`sanitizeItineraryForPipelineLog`** (redacts `tel`, `addr1`, `addr2`, `reservationInfo` per stop). Client API response unchanged. |

---

## C. Data / quality QA

| Check | Status | Notes |
|-------|--------|--------|
| 1. No `manual_hidden` in output | **Pass (code)** | Candidates query excludes hidden; `validateDraftAgainstDb` drops hidden rows. |
| 2. No unknown POI ids in response | **Pass (code)** | Stops filtered to candidate set; hydrate uses same map. |
| 3. Stop ordering | **Pass (code)** | Sorted by `sortOrder`; validation renumbers; route feasibility may reorder. |
| 4. Total duration realistic | **Pass (code)** | Dwell + travel vs budget; `validationMeta` / `routeMetrics` exposed. |
| 5. Route backtracking | **Pass (code)** | Region ping-pong repair + route feasibility (see `route-feasibility.ts`, `validation.ts`). |
| 6. EN copy quality | **Partial** | `hydrateStops` prefers `admin_short_desc_en` when `locale === 'en'`. Model `reason` text may still feel generic — content issue, not a bug. |

---

## D. Fixes applied in this pass

1. **`httpStatusForAuthError`** (`lib/auth.ts`) — correct **403** for `Forbidden` from `requireRole` / `requireAdmin`.
2. **Admin POI routes** — `GET` list, `GET`/`PATCH` `[id]`, `GET` stats: catch blocks use `httpStatusForAuthError` (replacing brittle `includes('Admin')` on list).
3. **`sanitizeItineraryForPipelineLog`** (`lib/itinerary/log-sanitize.ts`) — redact PII-like fields before persisting `final_result` on `itinerary_generation_logs`.

---

## E. Remaining known limitations

- **Admin UI** (`/admin/pois`): Client-side layout gate + API `requireAdmin`; non-admin who bypasses UI still gets 403 from API — OK.
- **Pipeline logs** still store `gemini_raw` / `claude_raw` (truncated) — may contain prompt/candidate text; review retention policy in production.
- **`user_input` log slice** is minimal (destination, duration, style) — no email; OK.
- **Saved itineraries** store full `itinerary_json` per user — intended; RLS scoped to owner.
- **E2E not run** in this pass — run smoke tests on staging after migration deploy.

---

## F. Recommended next priority

1. Staging smoke: one full itinerary + one save + one admin POI edit + confirm log row has redacted addresses/phone.
2. Optional: add rate limiting on `POST /api/itinerary/generate` if abuse is a concern.
3. Optional: shorten or hash `candidate_ids` in logs if IDs are considered sensitive at scale.

---

## G. Verdict

**Go** for deploy after: Supabase migrations applied (including `saved_itineraries` if not yet), env vars set (`GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, Supabase keys), and a short staging smoke per section A.
